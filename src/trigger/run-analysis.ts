import { logger, task } from "@trigger.dev/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { callClaudeJson } from "@/lib/anthropic/json";
import { sendReportReadyEmail } from "@/lib/email/send-report-ready";
import * as queriesPrompt from "@/prompts/search-queries.v1";
import * as extractPrompt from "@/prompts/evidence-extraction.v1";
import * as verdictPrompt from "@/prompts/verdict.v1";
import * as planPrompt from "@/prompts/realization-plan.v1";
import type { ProfileInput } from "@/lib/profile-format";
import {
  gatherCandidates,
  readRawPayload,
  writeRawPayload,
} from "@/lib/evidence/gather";
import {
  CANDIDATE_TEXT_LIMIT,
  EXTRACT_BATCH_SIZE,
  MIN_EVIDENCE,
  type EvidenceRow,
} from "@/lib/evidence/config";
import {
  AnalysisFailure,
  codeFromSerializedError,
  type FailureCode,
} from "@/lib/failure";

type RunAnalysisPayload = { analysisId: string };

/**
 * The run's own time budget, deliberately well under `maxDuration` (900s) in
 * trigger.config.ts. Trigger.dev does NOT call onFailure/onSuccess/cleanup when a
 * run exceeds `maxDuration` — the run would just die and leave the analysis stuck
 * in 'running' forever. Tripping this deadline first throws an ordinary error, so
 * the normal failure path runs and the analysis is always finalized.
 */
const DEADLINE_MS = 600_000;

/** Throws `timed_out` once the run's budget is spent. Called between stages. */
function checkDeadline(deadline: number): void {
  if (Date.now() > deadline) throw new AnalysisFailure("timed_out");
}

/**
 * Tag whatever a stage throws with that stage's machine-safe code, then RETHROW.
 * Rethrowing is the point: the task's `retry` config and the
 * `analysis_raw_evidence` checkpointing both depend on transient errors bubbling
 * up so a retry can resume. Swallowing here would turn a retryable blip into a
 * permanent failure. Finalization happens once, in onFailure.
 */
async function runStage<T>(code: FailureCode, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw e instanceof AnalysisFailure ? e : new AnalysisFailure(code, e);
  }
}

/** Structured, secret-free failure log. Never the stack, never `cause`. */
function logFailure(
  message: string,
  analysisId: string,
  code: FailureCode,
  error: unknown,
): void {
  logger.error(message, {
    analysisId,
    code,
    // Our own `"<code>: <detail>"` message — a Zod issue, a Postgres message, an
    // HTTP status. Truncated, and never interpolated into anything user-facing.
    detail:
      error instanceof Error ? error.message.slice(0, 300) : "non-error thrown",
  });
}

/**
 * The single place an analysis becomes 'failed'. Guarded on queued/running so it
 * can never clobber a 'done' or 'insufficient_evidence' row, and wrapped so it can
 * never throw — a throw here is exactly what would leave the row stuck.
 *
 * The credit needs no refund: it is consumed only as the final write alongside the
 * 'done' flip, so a run that reaches this function never spent one. Same principle
 * as the insufficient_evidence path.
 *
 * Returns true only if this call performed the transition (so the caller knows
 * whether to send the apologetic email).
 */
async function finalizeFailure(
  service: SupabaseClient,
  analysisId: string,
  code: FailureCode,
): Promise<boolean> {
  try {
    const { data, error } = await service
      .from("analyses")
      .update({ status: "failed", failure_code: code })
      .eq("id", analysisId)
      .in("status", ["queued", "running"])
      .select("id");

    if (error) {
      logger.error("Failed to mark analysis failed", {
        analysisId,
        code,
        detail: error.message.slice(0, 300),
      });
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (e) {
    logger.error("finalizeFailure threw", {
      analysisId,
      code,
      detail: e instanceof Error ? e.message.slice(0, 300) : "non-error thrown",
    });
    return false;
  }
}

/** Merge rows sharing a key, summing their similar_count (keeps the first row). */
function dedupeBy(
  rows: EvidenceRow[],
  keyFn: (r: EvidenceRow) => string,
): EvidenceRow[] {
  const map = new Map<string, EvidenceRow>();
  for (const r of rows) {
    const key = keyFn(r);
    const existing = map.get(key);
    if (existing) existing.similar_count += r.similar_count;
    else map.set(key, { ...r });
  }
  return [...map.values()];
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function normalizeQuote(quote: string): string {
  return quote.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * True only if `quote` actually appears in `sourceText` (the exact, already-
 * truncated text the model saw). Guards against an injected or hallucinated
 * quote reaching evidence_items and rendering as a "real" complaint.
 */
function quoteInSource(quote: string, sourceText: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const q = norm(quote).replace(/^[…"'\s]+|[…"'\s]+$/g, "");
  return q.length >= 12 && norm(sourceText).includes(q);
}

/** Honest, deterministic "not enough evidence" message (why + what to try). */
function buildInsufficientReason(facts: {
  queries: number;
  candidates: number;
  relevant: number;
}): string {
  return [
    `We ran ${facts.queries} complaint-focused searches across Reddit and forums and reviewed ${facts.candidates} posts, but only ${facts.relevant} clearly described this problem — we need at least ${MIN_EVIDENCE} to give a verdict you can trust.`,
    "This usually means the idea is phrased too broadly, targets a very niche audience, or the pain isn't discussed much in public yet.",
    "Try naming the specific person who has the problem, describing their exact frustration in their own words, or narrowing to one concrete use case — then run it again. Your free analysis hasn't been used.",
  ].join(" ");
}

/**
 * Best-effort "report ready" email (Stage E). Resolves the recipient via the
 * service-role admin API (email lives on auth.users, not profiles) and sends
 * through Resend. NEVER throws — email is a side-effect that must not fail or
 * retry the run, so every failure is logged and swallowed and the job still
 * completes with its status.
 */
async function notifyReportReady(
  service: SupabaseClient,
  userId: string,
  params:
    | {
        status: "done";
        analysisId: string;
        score: number;
        verdict: "go" | "caution" | "stop";
        summary: string;
      }
    | { status: "insufficient_evidence"; analysisId: string; summary: string }
    | { status: "failed"; analysisId: string },
): Promise<void> {
  try {
    const { data, error } = await service.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (error || !email) {
      logger.error("Report-ready email skipped: no recipient email", { userId });
      return;
    }

    const result = await sendReportReadyEmail(
      params.status === "done"
        ? {
            to: email,
            analysisId: params.analysisId,
            status: "done",
            score: params.score,
            verdict: params.verdict,
            summary: params.summary,
          }
        : params.status === "insufficient_evidence"
          ? {
              to: email,
              analysisId: params.analysisId,
              status: "insufficient_evidence",
              summary: params.summary,
            }
          : {
              to: email,
              analysisId: params.analysisId,
              status: "failed",
            },
    );

    if (!result.ok) {
      logger.error("Report-ready email failed to send", { error: result.error });
      return;
    }
    logger.info("Report-ready email sent", {
      emailId: result.id,
      status: params.status,
    });
  } catch (e) {
    logger.error("Report-ready email threw", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Stage B — evidence gathering (ARCHITECTURE.md). Triggered when the wizard sets
 * an analysis to 'queued'. Plans complaint-phrased searches (Sonnet), gathers
 * Reddit + forum evidence, extracts/filters/dedupes it (Haiku) into
 * evidence_items, and gates on the insufficient-evidence rule. On success the
 * analysis is left 'running' for the (not-yet-built) scoring stage.
 *
 * Idempotent across retries: planned queries, gathered candidates, and
 * extracted batches are all checkpointed per analysis in
 * `analysis_raw_evidence.payload`, so a retry resumes instead of re-spending
 * Sonnet/Haiku calls or re-fetching search results. evidence_items are wiped
 * and rebuilt from the accumulated extraction once per attempt.
 */
export const runAnalysis = task({
  id: "run-analysis",
  retry: {
    maxAttempts: 3, // initial + 2 retries
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: RunAnalysisPayload) => {
    const { analysisId } = payload;
    const service = createServiceClient();
    const deadline = Date.now() + DEADLINE_MS;

    // 1. Load the analysis and move queued → running (idempotent on retry).
    const { data: analysis } = await service
      .from("analyses")
      .select("id, user_id, idea_text, status")
      .eq("id", analysisId)
      .maybeSingle();

    if (!analysis) {
      throw new Error(`Analysis ${analysisId} not found`);
    }
    if (analysis.status !== "queued" && analysis.status !== "running") {
      logger.info("Analysis not in a runnable state; skipping", {
        status: analysis.status,
      });
      return { status: analysis.status, skipped: true } as const;
    }

    await service
      .from("analyses")
      .update({ status: "running" })
      .eq("id", analysisId)
      .in("status", ["queued", "running"]);

    // Everything below is wrapped: any stage error is tagged with a machine-safe
    // code, logged without secrets, and rethrown so Trigger.dev can retry and, once
    // retries are exhausted, onFailure can finalize the analysis as 'failed'.
    try {
      // 2. Load the 5 clarification answers.
      const { data: questions } = await service
        .from("analysis_questions")
        .select("position, question, answer")
        .eq("analysis_id", analysisId)
        .order("position");

      const answers = (questions ?? []).map((q) => ({
        question: q.question as string,
        answer: (q.answer as string | null) ?? "I don't know",
      }));

      // 3. Query planning (Sonnet) — reuse a cached plan on retry so a retry
      // never re-spends the Sonnet call.
      const cachedPayload = await readRawPayload(service, analysisId);

      let queries: string[];
      if (cachedPayload?.queries && cachedPayload.queries.length > 0) {
        queries = cachedPayload.queries;
        logger.info("Reusing cached search queries", { count: queries.length });
      } else {
        const result = await runStage("query_planning_failed", () =>
          callClaudeJson({
            model: queriesPrompt.QUERIES_MODEL,
            stage: queriesPrompt.QUERIES_STAGE,
            analysisId,
            system: queriesPrompt.buildSystemPrompt(),
            user: queriesPrompt.buildUserPrompt(analysis.idea_text, answers),
            schema: queriesPrompt.searchQueriesResponseSchema,
            maxTokens: 1000,
          }),
        );
        queries = result.queries;
        logger.info("Planned search queries", { count: queries.length });
      }

      // 4. Gather candidates (Tavily — Reddit + forums), cached for retries.
      checkDeadline(deadline);
      const candidates = await runStage("evidence_search_failed", () =>
        gatherCandidates(service, analysisId, queries, cachedPayload),
      );
      logger.info("Gathered candidates", { count: candidates.length });

      // 5. Extract with Haiku in batches, resuming from the last checkpointed
      // batch on retry so already-extracted batches aren't re-spent.
      const extracted: EvidenceRow[] = cachedPayload?.extracted
        ? [...cachedPayload.extracted]
        : [];
      const startBatch = cachedPayload?.batchesDone ?? 0;

      for (
        let batchIndex = startBatch;
        batchIndex * EXTRACT_BATCH_SIZE < candidates.length;
        batchIndex++
      ) {
        // Per-batch: a long extraction is where the run is most likely to eat its
        // whole budget, and every completed batch is already checkpointed.
        checkDeadline(deadline);

        const batch = candidates.slice(
          batchIndex * EXTRACT_BATCH_SIZE,
          (batchIndex + 1) * EXTRACT_BATCH_SIZE,
        );
        const batchInput = batch.map((c, j) => ({
          index: j,
          source: c.source,
          text: `${c.title}\n${c.content}`.trim().slice(0, CANDIDATE_TEXT_LIMIT),
        }));

        const { items } = await runStage("evidence_extraction_failed", () =>
          callClaudeJson({
            model: extractPrompt.EXTRACT_MODEL,
            stage: extractPrompt.EXTRACT_STAGE,
            analysisId,
            system: extractPrompt.buildSystemPrompt(),
            user: extractPrompt.buildUserPrompt(analysis.idea_text, batchInput),
            schema: extractPrompt.evidenceExtractionResponseSchema,
            maxTokens: 2000,
          }),
        );

        for (const item of items) {
          if (!item.relevant) continue;
          if (item.index < 0 || item.index >= batch.length) continue;
          if (!item.quote || !item.severity || !item.topic) continue;
          if (!quoteInSource(item.quote, batchInput[item.index].text)) continue;
          const cand = batch[item.index];
          extracted.push({
            analysis_id: analysisId,
            source: cand.source,
            url: cand.url,
            quote: item.quote,
            author_handle: cand.authorHandle,
            severity: item.severity,
            topic: item.topic,
            similar_count: 1,
          });
        }

        await runStage("evidence_persist_failed", () =>
          writeRawPayload(service, analysisId, {
            queries,
            candidates,
            extracted,
            batchesDone: batchIndex + 1,
          }),
        );
      }

      // Dedupe by URL, then by near-identical quote; similar_count reflects merges.
      const deduped = dedupeBy(
        dedupeBy(extracted, (r) => normalizeUrl(r.url)),
        (r) => normalizeQuote(r.quote),
      );

      // Clean slate + rebuild, done once per attempt from the fully accumulated
      // (possibly resumed) extraction — never partial. Select back the persisted
      // rows so Stage C can cite their real evidence_items IDs.
      const persistedEvidence = await runStage("evidence_persist_failed", async () => {
        await service.from("evidence_items").delete().eq("analysis_id", analysisId);
        if (deduped.length === 0) return [];
        const { data: inserted, error } = await service
          .from("evidence_items")
          .insert(deduped)
          .select("id, source, url, quote, severity, topic, similar_count");
        if (error) {
          throw new Error(`Failed to insert evidence_items: ${error.message}`);
        }
        return inserted ?? [];
      });
      logger.info("Extracted evidence", { relevant: deduped.length });

      // 6. Insufficient-evidence gate. This is a VALID OUTCOME, not a failure: it
      // never sets a failure_code and never reaches finalizeFailure.
      if (deduped.length < MIN_EVIDENCE) {
        // Write the report FIRST, then flip status — same ordering as the 'done'
        // path. If the flip is what fails, a retry re-runs to here (status still
        // queued/running) and rewrites the report; flipping first would strand an
        // 'insufficient_evidence' row whose reason never got written (the retry
        // would skip at the top-of-run status guard).
        await runStage("evidence_persist_failed", async () => {
          const { error } = await service.from("reports").upsert(
            {
              analysis_id: analysisId,
              verdict: "insufficient",
              score: null,
              summary:
                "We couldn't find enough public evidence about this problem yet to give a reliable verdict.",
              insufficient_reason: buildInsufficientReason({
                queries: queries.length,
                candidates: candidates.length,
                relevant: deduped.length,
              }),
            },
            { onConflict: "analysis_id" },
          );
          if (error) {
            throw new Error(`Failed to upsert insufficient report: ${error.message}`);
          }
        });

        await runStage("evidence_persist_failed", async () => {
          const { error } = await service
            .from("analyses")
            .update({ status: "insufficient_evidence" })
            .eq("id", analysisId)
            .in("status", ["queued", "running"]);
          if (error) {
            throw new Error(`Failed to mark insufficient_evidence: ${error.message}`);
          }
        });

        // Credit is intentionally NOT consumed here (nor is profiles.free_credit_used
        // touched) — reaching insufficient_evidence also frees the user's active slot.
        logger.info("Insufficient evidence; report written", {
          relevant: deduped.length,
        });

        // Stage E — notify the user (best-effort; never fails the run).
        await notifyReportReady(service, analysis.user_id, {
          status: "insufficient_evidence",
          analysisId,
          summary:
            "We couldn't find enough public evidence about this problem yet to give a reliable verdict.",
        });

        return {
          status: "insufficient_evidence",
          evidenceCount: deduped.length,
        } as const;
      }

      // 7. Sufficient — Stage C (verdict) + Stage D (plan), then finalize.

      // Load the founder's profile for personal-feasibility scoring and the credit
      // rule. (Done here so the insufficient-evidence path above is untouched.)
      const { data: profile } = await service
        .from("profiles")
        .select(
          "plan, free_credit_used, occupation, skills, weekly_hours, budget_range, work_preference",
        )
        .eq("id", analysis.user_id)
        .single();

      const profileForPrompt: ProfileInput = {
        occupation: (profile?.occupation as string | null) ?? null,
        skills: (profile?.skills as string[] | null) ?? null,
        weekly_hours: (profile?.weekly_hours as string | null) ?? null,
        budget_range: (profile?.budget_range as string | null) ?? null,
        work_preference: (profile?.work_preference as string | null) ?? null,
      };

      const evidenceForPrompt = persistedEvidence.map((e) => ({
        id: e.id,
        source: e.source,
        quote: e.quote,
        severity: e.severity,
        topic: e.topic,
        similar_count: e.similar_count,
        url: e.url,
      }));
      const validEvidenceIds = new Set(evidenceForPrompt.map((e) => e.id));

      // Stage C — verdict. Regenerated on every attempt (not checkpointed): the
      // extraction step above rebuilds evidence_items with fresh IDs each attempt,
      // so a cached verdict would cite deleted rows. The schema is parameterized
      // with this analysis's evidence IDs, so a hallucinated/missing reference fails
      // validation → one corrective retry (inside callClaudeJson) → the run fails
      // rather than storing an unsupported claim.
      checkDeadline(deadline);
      const verdict = await runStage("verdict_generation_failed", () =>
        callClaudeJson({
          model: verdictPrompt.VERDICT_MODEL,
          stage: verdictPrompt.VERDICT_STAGE,
          analysisId,
          system: verdictPrompt.buildSystemPrompt(),
          user: verdictPrompt.buildUserPrompt(
            analysis.idea_text,
            answers,
            profileForPrompt,
            evidenceForPrompt,
          ),
          schema: verdictPrompt.buildVerdictResponseSchema(validEvidenceIds),
          maxTokens: 2500,
        }),
      );
      logger.info("Scored verdict", {
        score: verdict.score,
        verdict: verdict.verdict,
      });

      // Stage D — realization plan (always generated; UI gates it for free users).
      checkDeadline(deadline);
      const plan = await runStage("plan_generation_failed", () =>
        callClaudeJson({
          model: planPrompt.PLAN_MODEL,
          stage: planPrompt.PLAN_STAGE,
          analysisId,
          system: planPrompt.buildSystemPrompt(),
          user: planPrompt.buildUserPrompt(
            analysis.idea_text,
            answers,
            profileForPrompt,
            {
              summary: verdict.summary,
              mvpSketch: verdict.solutions.mvp_sketch,
              possibleSolutions: verdict.solutions.possible_solutions,
            },
          ),
          schema: planPrompt.realizationPlanResponseSchema,
          maxTokens: 2500,
        }),
      );
      logger.info("Generated realization plan");

      // 8. Persist the report, then consume the credit as the final commit.
      await runStage("report_persist_failed", async () => {
        const { error } = await service.from("reports").upsert(
          {
            analysis_id: analysisId,
            score: verdict.score,
            verdict: verdict.verdict,
            summary: verdict.summary,
            criteria: verdict.criteria,
            solutions: verdict.solutions,
            plan,
            insufficient_reason: null,
          },
          { onConflict: "analysis_id" },
        );
        if (error) {
          throw new Error(`Failed to upsert report: ${error.message}`);
        }
      });

      // Consume the credit only now. free_credit_used gates a free user's next
      // analysis, so set it for anyone not explicitly paid. consumed_credit is set
      // for everyone (paid usage is counted from it). The guarded status flip to
      // 'done' is the last write: until it lands the status stays 'running', so any
      // transient failure retries cleanly and no failed run ever consumes credit.
      if (profile?.plan !== "paid") {
        await service
          .from("profiles")
          .update({ free_credit_used: true })
          .eq("id", analysis.user_id);
      }
      // Checked, not fire-and-forget: a silently-failed flip would return 'done'
      // from the task while the row stayed 'running' — stuck forever, since
      // onFailure never runs for a successful task. Throwing instead lets the
      // retry land it (both writes above are idempotent).
      await runStage("report_persist_failed", async () => {
        const { error } = await service
          .from("analyses")
          .update({ status: "done", consumed_credit: true })
          .eq("id", analysisId)
          .in("status", ["queued", "running"]);
        if (error) {
          throw new Error(`Failed to mark analysis done: ${error.message}`);
        }
      });

      logger.info("Analysis done", {
        score: verdict.score,
        verdict: verdict.verdict,
      });

      // Stage E — notify the user their verdict is ready (best-effort; a failed
      // send is logged and swallowed so the run still completes 'done').
      await notifyReportReady(service, analysis.user_id, {
        status: "done",
        analysisId,
        score: verdict.score,
        verdict: verdict.verdict,
        summary: verdict.summary,
      });

      return { status: "done", score: verdict.score } as const;
    } catch (error) {
      // Log here, where the error is still our typed AnalysisFailure, then rethrow
      // so Trigger.dev retries. Finalization is onFailure's job — marking 'failed'
      // now would block the remaining attempts from writing anything.
      const code = codeFromSerializedError(error);
      logFailure("Analysis stage failed", analysisId, code, error);
      throw error;
    }
  },

  /**
   * Runs only after all retries are exhausted. The single finalizer for a failed
   * run: mark 'failed' with the stage's code, then apologize by email. The whole
   * body is guarded because an uncaught throw here (a missing env var in
   * createServiceClient, say) is precisely what would strand the analysis in
   * 'running'. Credit is untouched — it is never consumed before the 'done' flip.
   */
  onFailure: async ({ payload, error }) => {
    const { analysisId } = payload;
    try {
      const code = codeFromSerializedError(error);
      logFailure("Analysis failed after all retries", analysisId, code, error);

      const service = createServiceClient();
      const finalized = await finalizeFailure(service, analysisId, code);

      // Only apologize if this call actually made the analysis 'failed'. A no-op
      // means the row already settled (done / insufficient_evidence) and the user
      // has their real email — a spurious failure notice would contradict it.
      if (!finalized) return;

      const { data: analysis } = await service
        .from("analyses")
        .select("user_id")
        .eq("id", analysisId)
        .maybeSingle();

      if (analysis?.user_id) {
        await notifyReportReady(service, analysis.user_id, {
          status: "failed",
          analysisId,
        });
      }
    } catch (e) {
      logger.error("onFailure handler threw", {
        analysisId,
        detail: e instanceof Error ? e.message.slice(0, 300) : "non-error thrown",
      });
    }
  },

  /**
   * A cancelled run never reaches onFailure, so it would otherwise sit in
   * 'running' forever. No email: the cancellation was deliberate.
   *
   * Caveat: Trigger.dev only calls this while the run is actively executing — a
   * run cancelled while still queued is not finalized here.
   */
  onCancel: async ({ payload }) => {
    const { analysisId } = payload as RunAnalysisPayload;
    try {
      await finalizeFailure(createServiceClient(), analysisId, "cancelled");
    } catch (e) {
      logger.error("onCancel handler threw", {
        analysisId,
        detail: e instanceof Error ? e.message.slice(0, 300) : "non-error thrown",
      });
    }
  },
});
