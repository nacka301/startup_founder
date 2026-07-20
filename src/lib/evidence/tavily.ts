import "server-only";
import {
  CANDIDATE_TEXT_LIMIT,
  SEARCH_FETCH_TIMEOUT_MS,
  SEARCH_INCLUDE_DOMAINS,
  isHttpUrl,
  type Candidate,
} from "./config";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  /** Fuller extracted page text when include_raw_content is set; richer than the
   * short `content` snippet, so quotes are pulled from real post/comment text. */
  raw_content?: string;
};

type TavilyResponse = {
  results?: TavilyResult[];
};

function sourceForUrl(url: string): Candidate["source"] {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "reddit.com" || host.endsWith(".reddit.com")) return "reddit";
    return "forum";
  } catch {
    return "web";
  }
}

/**
 * Run one Tavily search restricted to Reddit + the forum allowlist. Returns
 * normalized candidates; on any error (missing key, non-200, bad JSON) logs and
 * returns an empty array so gathering degrades gracefully rather than failing
 * the whole job (ARCHITECTURE.md §5).
 */
export async function tavilySearch(
  query: string,
  maxResults = 15,
): Promise<Candidate[]> {
  const apiKey = process.env.SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: SEARCH_API_KEY");
  }

  let data: TavilyResponse;
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        // "advanced" ranks and extracts more relevant passages than "basic";
        // include_raw_content pulls fuller post/comment text so the extractor
        // judges relevance and quotes from real text, not a short snippet.
        search_depth: "advanced",
        include_raw_content: true,
        include_domains: SEARCH_INCLUDE_DOMAINS,
        max_results: maxResults,
      }),
      signal: AbortSignal.timeout(SEARCH_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`Tavily search failed (${res.status}) for query: ${query}`);
      return [];
    }
    data = (await res.json()) as TavilyResponse;
  } catch (e) {
    console.error(
      `Tavily search error for query "${query}":`,
      e instanceof Error ? e.message : e,
    );
    return [];
  }

  return (data.results ?? [])
    .filter((r): r is TavilyResult & { url: string } => typeof r.url === "string")
    .filter((r) => isHttpUrl(r.url))
    .map((r) => {
      // Prefer the fuller raw_content when it carries more text than the snippet.
      const snippet = r.content ?? "";
      const raw = r.raw_content ?? "";
      const body = raw.length > snippet.length ? raw : snippet;
      return {
        source: sourceForUrl(r.url),
        url: r.url,
        title: (r.title ?? "").slice(0, 300),
        content: body.slice(0, CANDIDATE_TEXT_LIMIT),
        authorHandle: null,
      };
    });
}
