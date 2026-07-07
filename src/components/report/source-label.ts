/** A readable source label: r/<sub> for reddit, else the bare host. */
export function sourceLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.endsWith("reddit.com")) {
      const m = u.pathname.match(/\/r\/([^/]+)/i);
      return m ? `r/${m[1]}` : "reddit.com";
    }
    return host;
  } catch {
    return "source";
  }
}
