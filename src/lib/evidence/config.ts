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

/** Reddit requires a descriptive, non-generic User-Agent or it rate-limits/blocks. */
export const REDDIT_USER_AGENT =
  "IdeaVerdict/0.1 (evidence research; +https://ideaverdict.com)";

/** Minimum gap between Reddit requests — politeness (≤1 req/sec). */
export const REDDIT_MIN_INTERVAL_MS = 1100;

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
