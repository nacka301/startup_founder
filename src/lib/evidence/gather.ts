import "server-only";
import type { createServiceClient } from "@/lib/supabase/service";
import { MAX_CANDIDATES, type Candidate } from "./config";
import { tavilySearch } from "./tavily";
import { redditSearch } from "./reddit";

type ServiceClient = ReturnType<typeof createServiceClient>;

type RawPayload = { candidates: Candidate[] };

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

/**
 * Gather up to MAX_CANDIDATES candidate items for an analysis across the planned
 * queries, from Tavily (Reddit + forums) and direct Reddit search, deduped by
 * normalized URL.
 *
 * Results are cached in `analysis_raw_evidence` keyed by analysis: on a
 * Trigger.dev retry the cached payload is returned as-is, so Reddit is never
 * re-fetched and politeness limits aren't re-spent.
 */
export async function gatherCandidates(
  service: ServiceClient,
  analysisId: string,
  queries: string[],
): Promise<Candidate[]> {
  // 1. Return the cached payload if a prior attempt already fetched.
  const { data: cached } = await service
    .from("analysis_raw_evidence")
    .select("payload")
    .eq("analysis_id", analysisId)
    .maybeSingle();

  if (cached?.payload) {
    const payload = cached.payload as RawPayload;
    if (Array.isArray(payload.candidates)) {
      return payload.candidates;
    }
  }

  // 2. Fresh gather. Dedupe by normalized URL as we go; stop at the cap.
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
    // Tavily (Reddit + forums) and direct Reddit search per query. Reddit is
    // rate-limited internally; a block just yields [] and we keep Tavily results.
    const [tavily, reddit] = await Promise.all([
      tavilySearch(query),
      redditSearch(query),
    ]);
    add(tavily);
    add(reddit);
  }

  const candidates = [...byUrl.values()];

  // 3. Persist the raw payload so a retry re-uses it. Never let a cache-write
  // failure fail the job — the candidates are already in memory for this run.
  const { error } = await service
    .from("analysis_raw_evidence")
    .upsert(
      { analysis_id: analysisId, payload: { candidates } satisfies RawPayload },
      { onConflict: "analysis_id" },
    );
  if (error) {
    console.error("Failed to cache raw evidence:", error.message);
  }

  return candidates;
}
