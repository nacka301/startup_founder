/**
 * Absolute base URL of the app, for building links that leave the request
 * context — the report-ready email and shareable `/r/[token]` URLs (the
 * Trigger.dev task has no incoming request to derive an origin from).
 *
 * Reads `NEXT_PUBLIC_APP_URL` (e.g. https://ideaverdict.com); falls back to
 * localhost for dev. Must also be set in the Trigger.dev environment, since the
 * analysis job builds the email link from it.
 */
export function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = raw && raw.length > 0 ? raw : "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

/** Build an absolute URL for a path (leading slash optional). */
export function absoluteUrl(path: string): string {
  return `${appUrl()}/${path.replace(/^\/+/, "")}`;
}
