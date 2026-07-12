/**
 * Analysis wizard: shared constants and status metadata.
 *
 * Pure module (no server/client imports) so pages, forms, and server actions
 * share one source of truth. Status values match DB-SCHEMA.md exactly.
 */

/** Minimum characters (trimmed) for an idea description. */
export const MIN_IDEA_LENGTH = 40;

/** Upper bound so a runaway paste can't blow up the LLM call. */
export const MAX_IDEA_LENGTH = 2000;

/** Statuses that count as "in progress" — only one allowed per user at a time. */
export const ACTIVE_STATUSES = ["clarifying", "queued", "running"] as const;

/**
 * How long a 'queued'/'running' analysis may sit untouched before the user is
 * offered a self-service discard. Set well beyond the job's 900s `maxDuration`
 * (trigger.config.ts) so the affordance only appears once a run is genuinely
 * stranded — never while a healthy job is still working. See cancelAnalysis.
 */
export const STUCK_AFTER_MS = 15 * 60_000;

/**
 * First instant of the current calendar month (UTC) as ISO — the lower bound for
 * the paid fair-use count (analyses this month, PRD §7). `now` is injectable for
 * tests.
 */
export function startOfMonthISO(now: Date = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

export type AnalysisStatus =
  | "clarifying"
  | "queued"
  | "running"
  | "done"
  | "insufficient_evidence"
  | "failed";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

/**
 * Display metadata for the dashboard status chips. Note: the verdict palette
 * (GO/CAUTION/STOP green/amber/red) is reserved for the report per the style
 * guide, so status chips stay on the neutral/primary/destructive tokens.
 */
export const STATUS_META: Record<
  AnalysisStatus,
  { label: string; badge: BadgeVariant }
> = {
  clarifying: { label: "Needs your answers", badge: "default" },
  queued: { label: "Queued", badge: "secondary" },
  running: { label: "Running", badge: "default" },
  done: { label: "Done", badge: "default" },
  insufficient_evidence: { label: "Not enough evidence", badge: "outline" },
  failed: { label: "Failed", badge: "destructive" },
};

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/**
 * Dashboard row timestamp ("2 days ago", "just now"). Uses the native
 * Intl.RelativeTimeFormat rather than a date library — no new dependency for
 * one formatting call. Falls back to an absolute date past ~30 days, where a
 * relative label stops being useful.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = then.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSeconds) < 60) return "just now";
  if (Math.abs(diffMinutes) < 60) return RELATIVE_TIME_FORMAT.format(diffMinutes, "minute");
  if (Math.abs(diffHours) < 24) return RELATIVE_TIME_FORMAT.format(diffHours, "hour");
  if (Math.abs(diffDays) < 7) return RELATIVE_TIME_FORMAT.format(diffDays, "day");
  if (Math.abs(diffDays) < 30) return RELATIVE_TIME_FORMAT.format(Math.round(diffDays / 7), "week");

  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
