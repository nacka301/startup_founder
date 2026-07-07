import "server-only";
import {
  CANDIDATE_TEXT_LIMIT,
  REDDIT_MIN_INTERVAL_MS,
  REDDIT_USER_AGENT,
  SEARCH_FETCH_TIMEOUT_MS,
  isHttpUrl,
  type Candidate,
} from "./config";

const REDDIT_SEARCH = "https://www.reddit.com/search.json";

type RedditChild = {
  data?: {
    title?: string;
    selftext?: string;
    permalink?: string;
    author?: string;
  };
};

type RedditListing = {
  data?: { children?: RedditChild[] };
};

// Module-level clock so ≤1 req/sec politeness holds across every call in a run.
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = REDDIT_MIN_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

/**
 * Search reddit.com directly via the public `search.json` endpoint. Rate-limited
 * to ≤1 req/sec with a proper User-Agent. On block/rate-limit/error, logs and
 * returns an empty array so the caller falls back to Tavily-only results
 * (ARCHITECTURE.md §5).
 */
export async function redditSearch(
  query: string,
  limit = 25,
): Promise<Candidate[]> {
  await throttle();

  const url = `${REDDIT_SEARCH}?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance&t=all&type=link`;

  let listing: RedditListing;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": REDDIT_USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(SEARCH_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`Reddit search failed (${res.status}) for query: ${query}`);
      return [];
    }
    listing = (await res.json()) as RedditListing;
  } catch (e) {
    console.error(
      `Reddit search error for query "${query}":`,
      e instanceof Error ? e.message : e,
    );
    return [];
  }

  return (listing.data?.children ?? [])
    .map((c) => c.data)
    .filter((d): d is NonNullable<RedditChild["data"]> & { permalink: string } =>
      typeof d?.permalink === "string" && d.permalink.startsWith("/"),
    )
    .map((d) => ({
      source: "reddit" as const,
      url: `https://www.reddit.com${d.permalink}`,
      title: (d.title ?? "").slice(0, 300),
      content: (d.selftext ?? "").slice(0, CANDIDATE_TEXT_LIMIT),
      authorHandle: d.author ?? null,
    }))
    .filter((c) => isHttpUrl(c.url));
}
