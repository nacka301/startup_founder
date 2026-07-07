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

type RunAnalysisPayload = { analysisId: string };

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
    | { status: "insufficient_evidence"; analysisId: string; summary: string },
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
        : {
            to: email,
            analysisId: params.analysisId,
            status: "insufficient_evidence",
            summary: params.summary,
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
      const result = await callClaudeJson({
        model: queriesPrompt.QUERIES_MODEL,
        stage: queriesPrompt.QUERIES_STAGE,
        analysisId,
        system: queriesPrompt.buildSystemPrompt(),
        user: queriesPrompt.buildUserPrompt(analysis.idea_text, answers),
        schema: queriesPrompt.searchQueriesResponseSchema,
        maxTokens: 1000,
      });
      queries = result.queries;
      logger.info("Planned search queries", { count: queries.length });
    }

    // 4. Gather candidates (Tavily — Reddit + forums), cached for retries.
    const candidates = await gatherCandidates(
      service,
      analysisId,
      queries,
      cachedPayload,
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
      const batch = candidates.slice(
        batchIndex * EXTRACT_BATCH_SIZE,
        (batchIndex + 1) * EXTRACT_BATCH_SIZE,
      );
      const batchInput = batch.map((c, j) => ({
        index: j,
        source: c.source,
        text: `${c.title}\n${c.content}`.trim().slice(0, CANDIDATE_TEXT_LIMIT),
      }));

      const { items } = await callClaudeJson({
        model: extractPrompt.EXTRACT_MODEL,
        stage: extractPrompt.EXTRACT_STAGE,
        analysisId,
        system: extractPrompt.buildSystemPrompt(),
        user: extractPrompt.buildUserPrompt(analysis.idea_text, batchInput),
        schema: extractPrompt.evidenceExtractionResponseSchema,
        maxTokens: 2000,
      });

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

      await writeRawPayload(service, analysisId, {
        queries,
        candidates,
        extracted,
        batchesDone: batchIndex + 1,
      });
    }

    // Dedupe by URL, then by near-identical quote; similar_count reflects merges.
    const deduped = dedupeBy(
      dedupeBy(extracted, (r) => normalizeUrl(r.url)),
      (r) => normalizeQuote(r.quote),
    );

    // Clean slate + rebuild, done once per attempt from the fully accumulated
    // (possibly resumed) extraction — never partial. Select back the persisted
    // rows so Stage C can cite their real evidence_items IDs.
    await service.from("evidence_items").delete().eq("analysis_id", analysisId);
    let persistedEvidence: {
      id: string;
      source: string;
      url: string;
      quote: string;
      severity: number;
      topic: string;
      similar_count: number;
    }[] = [];
    if (deduped.length > 0) {
      const { data: inserted, error } = await service
        .from("evidence_items")
        .insert(deduped)
        .select("id, source, url, quote, severity, topic, similar_count");
      if (error) {
        throw new Error(`Failed to insert evidence_items: ${error.message}`);
      }
      persistedEvidence = inserted ?? [];
    }
    logger.info("Extracted evidence", { relevant: deduped.length });

    // 6. Insufficient-evidence gate.
    if (deduped.length < MIN_EVIDENCE) {
      await service
        .from("analyses")
        .update({ status: "insufficient_evidence" })
        .eq("id", analysisId)
        .in("status", ["queued", "running"]);

      await service.from("reports").upsert(
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

      return { status: "insufficient_evidence", evidenceCount: deduped.length } as const;
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
    const verdict = await callClaudeJson({
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
    });
    logger.info("Scored verdict", {
      score: verdict.score,
      verdict: verdict.verdict,
    });

    // Stage D — realization plan (always generated; UI gates it for free users).
    const plan = await callClaudeJson({
      model: planPrompt.PLAN_MODEL,
      stage: planPrompt.PLAN_STAGE,
      analysisId,
      system: planPrompt.buildSystemPrompt(),
      user: planPrompt.buildUserPrompt(analysis.idea_text, answers, profileForPrompt, {
        summary: verdict.summary,
        mvpSketch: verdict.solutions.mvp_sketch,
        possibleSolutions: verdict.solutions.possible_solutions,
      }),
      schema: planPrompt.realizationPlanResponseSchema,
      maxTokens: 2500,
    });
    logger.info("Generated realization plan");

    // 8. Persist the report, then consume the credit as the final commit.
    await service.from("reports").upsert(
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
    await service
      .from("analyses")
      .update({ status: "done", consumed_credit: true })
      .eq("id", analysisId)
      .in("status", ["queued", "running"]);

    logger.info("Analysis done", { score: verdict.score, verdict: verdict.verdict });

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
  },

  // Runs only after all retries are exhausted: mark failed, credit untouched.
  onFailure: async ({ payload }) => {
    const { analysisId } = payload;
    const service = createServiceClient();
    await service
      .from("analyses")
      .update({ status: "failed" })
      .eq("id", analysisId)
      .in("status", ["queued", "running"]);
  },
});
