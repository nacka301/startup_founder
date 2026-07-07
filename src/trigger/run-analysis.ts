import { logger, task } from "@trigger.dev/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { callClaudeJson } from "@/lib/anthropic/json";
import * as queriesPrompt from "@/prompts/search-queries.v1";
import * as extractPrompt from "@/prompts/evidence-extraction.v1";
import { gatherCandidates } from "@/lib/evidence/gather";
import {
  CANDIDATE_TEXT_LIMIT,
  EXTRACT_BATCH_SIZE,
  MIN_EVIDENCE,
  type Candidate,
} from "@/lib/evidence/config";

type RunAnalysisPayload = { analysisId: string };

type EvidenceRow = {
  analysis_id: string;
  source: Candidate["source"];
  url: string;
  quote: string;
  author_handle: string | null;
  severity: number;
  topic: string;
  similar_count: number;
};

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
 * Stage B — evidence gathering (ARCHITECTURE.md). Triggered when the wizard sets
 * an analysis to 'queued'. Plans complaint-phrased searches (Sonnet), gathers
 * Reddit + forum evidence, extracts/filters/dedupes it (Haiku) into
 * evidence_items, and gates on the insufficient-evidence rule. On success the
 * analysis is left 'running' for the (not-yet-built) scoring stage.
 *
 * Idempotent across retries: the raw search payload is cached per analysis, and
 * evidence_items are wiped and rebuilt each attempt.
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
      .select("id, idea_text, status")
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

    // 3. Query planning (Sonnet).
    const { queries } = await callClaudeJson({
      model: queriesPrompt.QUERIES_MODEL,
      stage: queriesPrompt.QUERIES_STAGE,
      analysisId,
      system: queriesPrompt.buildSystemPrompt(),
      user: queriesPrompt.buildUserPrompt(analysis.idea_text, answers),
      schema: queriesPrompt.searchQueriesResponseSchema,
      maxTokens: 1000,
    });
    logger.info("Planned search queries", { count: queries.length });

    // 4. Gather candidates (Tavily + Reddit), cached for retries.
    const candidates = await gatherCandidates(service, analysisId, queries);
    logger.info("Gathered candidates", { count: candidates.length });

    // 5. Extract with Haiku in batches; clean slate first for idempotent re-runs.
    await service.from("evidence_items").delete().eq("analysis_id", analysisId);

    const extracted: EvidenceRow[] = [];
    for (let i = 0; i < candidates.length; i += EXTRACT_BATCH_SIZE) {
      const batch = candidates.slice(i, i + EXTRACT_BATCH_SIZE);
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
    }

    // Dedupe by URL, then by near-identical quote; similar_count reflects merges.
    const deduped = dedupeBy(
      dedupeBy(extracted, (r) => normalizeUrl(r.url)),
      (r) => normalizeQuote(r.quote),
    );

    if (deduped.length > 0) {
      const { error } = await service.from("evidence_items").insert(deduped);
      if (error) {
        throw new Error(`Failed to insert evidence_items: ${error.message}`);
      }
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
      return { status: "insufficient_evidence", evidenceCount: deduped.length } as const;
    }

    // 7. Sufficient — leave status 'running' for the scoring stage.
    // TODO(Stage C): trigger scoring/verdict here (idea + answers + profile +
    // evidence_items) → write reports.score/criteria/solutions, then status 'done'.
    logger.info("Evidence gathered; awaiting scoring", {
      evidenceCount: deduped.length,
    });
    return { status: "running", evidenceCount: deduped.length } as const;
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
