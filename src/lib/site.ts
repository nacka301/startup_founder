import { APP_URL } from "@/lib/env";

/**
 * Absolute URLs for links that leave the request context — the report-ready
 * email and shareable `/r/[token]` URLs (the Trigger.dev task has no incoming
 * request to derive an origin from).
 *
 * The base is `NEXT_PUBLIC_APP_URL` (e.g. https://buildworthy.tech), validated
 * in `@/lib/env`. It must be set in the Vercel BUILD environment — the share
 * control is a client component, so the value is inlined into the browser
 * bundle at build time — and in the Trigger.dev environment, which builds the
 * email link from it at runtime.
 */

/** Build an absolute URL for a path (leading slash optional). */
export function absoluteUrl(path: string): string {
  return `${APP_URL}/${path.replace(/^\/+/, "")}`;
}
