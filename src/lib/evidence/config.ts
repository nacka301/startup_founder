/**
 * Stage B evidence-gathering constants and shared candidate type.
 *
 * Pure module (no server-only imports) so both the Trigger.dev task and the
 * search helpers can share these. Tuning values live here, not scattered across
 * the pipeline.
 */

/** Minimum relevant evidence items to proceed past the insufficient-evidence gate. */
export const MIN_EVIDENCE = 8;

/** Hard cap on candidate items gathered per analysis (across all queries). */
export const MAX_CANDIDATES = 100;

/** How many candidates to send to Haiku per extraction call. */
export const EXTRACT_BATCH_SIZE = 20;

/** Max characters of each candidate's text passed to extraction (keeps token cost bounded). */
export const CANDIDATE_TEXT_LIMIT = 1200;

/** Abort a Tavily search fetch after this long, so a hung upstream can't stall the run to maxDuration. */
export const SEARCH_FETCH_TIMEOUT_MS = 15_000;

/**
 * Domains searched alongside reddit.com. A pragmatic default set of places where
 * people discuss problems and workarounds — tune as evidence quality is reviewed
 * (this is a tuning knob, not a product commitment).
 */
export const FORUM_DOMAINS = [
  "news.ycombinator.com",
  "indiehackers.com",
  "quora.com",
  "stackexchange.com",
  "producthunt.com",
];

/** Domains passed to Tavily's include_domains: Reddit plus the forum allowlist. */
export const SEARCH_INCLUDE_DOMAINS = ["reddit.com", ...FORUM_DOMAINS];

/** True for a well-formed http(s) URL — guards against malformed permalinks reaching users as links. */
export function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * A normalized candidate item from any source, before extraction. This is the
 * shape cached in `analysis_raw_evidence.payload` and fed to Haiku.
 */
export type Candidate = {
  source: "reddit" | "forum" | "web";
  url: string;
  title: string;
  content: string;
  authorHandle: string | null;
};

/** A single extracted, relevant complaint — the row shape for `evidence_items`. */
export type EvidenceRow = {
  analysis_id: string;
  source: Candidate["source"];
  url: string;
  quote: string;
  author_handle: string | null;
  severity: number;
  topic: string;
  similar_count: number;
};
