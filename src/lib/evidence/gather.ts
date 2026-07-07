import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { MAX_CANDIDATES, type Candidate, type EvidenceRow } from "./config";
import { tavilySearch } from "./tavily";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * Per-analysis checkpoint cached in `analysis_raw_evidence.payload`, so a
 * Trigger.dev retry can resume instead of re-spending LLM calls and re-fetching
 * search results:
 * - `queries`/`candidates` are written once, after the first successful gather.
 * - `extracted`/`batchesDone` are updated after each extraction batch.
 *
 * Note: the scoring stages (verdict/plan) are deliberately NOT cached here — each
 * attempt wipes and rebuilds `evidence_items` with fresh IDs, so a cached verdict
 * would reference deleted evidence rows. They are regenerated per attempt instead.
 */
export type RawPayload = {
  queries?: string[];
  candidates?: Candidate[];
  extracted?: EvidenceRow[];
  batchesDone?: number;
};

/** Normalize a URL for dedupe: drop protocol case, query, hash, and trailing slash. */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.toLowerCase()}${path.toLowerCase()}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Read the cached checkpoint for an analysis, if any. */
export async function readRawPayload(
  service: ServiceClient,
  analysisId: string,
): Promise<RawPayload | null> {
  const { data } = await service
    .from("analysis_raw_evidence")
    .select("payload")
    .eq("analysis_id", analysisId)
    .maybeSingle();
  return (data?.payload as RawPayload) ?? null;
}

/** Persist the checkpoint. Never let a cache-write failure fail the job. */
export async function writeRawPayload(
  service: ServiceClient,
  analysisId: string,
  payload: RawPayload,
): Promise<void> {
  const { error } = await service
    .from("analysis_raw_evidence")
    .upsert(
      { analysis_id: analysisId, payload },
      { onConflict: "analysis_id" },
    );
  if (error) {
    console.error("Failed to cache raw evidence:", error.message);
  }
}

/**
 * Gather up to MAX_CANDIDATES candidate items for an analysis across the planned
 * queries, from Tavily (which searches Reddit + the forum allowlist), deduped by
 * normalized URL.
 *
 * `cached` is the checkpoint already read by the caller this attempt: if it has
 * candidates, they're returned as-is (a retry never re-fetches). A fresh gather
 * that comes back empty (e.g. a total search outage) is intentionally NOT
 * cached, so the next retry re-attempts instead of reading a dead empty result.
 */
export async function gatherCandidates(
  service: ServiceClient,
  analysisId: string,
  queries: string[],
  cached: RawPayload | null,
): Promise<Candidate[]> {
  if (cached?.candidates) {
    return cached.candidates;
  }

  // Fresh gather. Dedupe by normalized URL as we go; stop at the cap.
  const byUrl = new Map<string, Candidate>();

  const add = (items: Candidate[]) => {
    for (const item of items) {
      if (byUrl.size >= MAX_CANDIDATES) return;
      const key = normalizeUrl(item.url);
      if (!byUrl.has(key)) byUrl.set(key, item);
    }
  };

  for (const query of queries) {
    if (byUrl.size >= MAX_CANDIDATES) break;
    // Tavily searches Reddit (via include_domains) + the forum allowlist. We do
    // NOT call reddit.com/search.json directly: it 403s from datacenter IPs, and
    // Tavily already surfaces Reddit content richly (ARCHITECTURE.md §5 fallback).
    add(await tavilySearch(query));
  }

  const candidates = [...byUrl.values()];

  if (candidates.length > 0) {
    await writeRawPayload(service, analysisId, { ...cached, queries, candidates });
  }

  return candidates;
}
