/**
 * Post-auth redirect target validation.
 *
 * Only a same-origin absolute path (e.g. "/dashboard", "/analyses/new") is ever
 * returned; anything else falls back to "/dashboard". This blocks open redirects:
 *   - absolute URLs ("https://evil.com")           — don't start with "/"
 *   - protocol-relative values ("//evil.com")       — start with "//"
 *   - backslash tricks ("/\evil.com", "/\/evil.com")— contain "\", which some
 *     browsers normalize to "/" when resolving a Location header
 *
 * Pure module (no server/client imports) so the /auth/callback route and the
 * verifyCode server action share one source of truth.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (
    raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
  ) {
    return raw;
  }
  return "/dashboard";
}
