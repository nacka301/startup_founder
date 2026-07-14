import { z } from "zod";

/**
 * Analysis failure taxonomy (ARCHITECTURE.md §5).
 *
 * Pure module (no server/client imports) so the Trigger.dev task, the report
 * page, and the email builder share one source of truth — same rule as
 * `analyses.ts`.
 *
 * Two hard invariants:
 *  1. `failed` is an ERROR. `insufficient_evidence` is a valid outcome and never
 *     produces a code — the two states must stay distinct everywhere.
 *  2. A code is machine-safe. Raw exception text, stack traces, env values, URLs
 *     and PII must never reach `analyses.failure_code` (the owner can SELECT it
 *     under RLS) nor the browser. The real error is logged server-side only.
 */

export const FAILURE_CODES = [
  "query_planning_failed",
  "evidence_search_failed",
  "evidence_extraction_failed",
  "evidence_persist_failed",
  "verdict_generation_failed",
  "plan_generation_failed",
  "report_persist_failed",
  "timed_out",
  "cancelled",
  "unknown",
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

/** Read-side validation for `analyses.failure_code` (CLAUDE.md: Zod-validate on read). */
export const failureCodeSchema = z.enum(FAILURE_CODES);

/**
 * Never throws. A NULL column, a legacy value, or a code written by a newer
 * deploy all degrade to 'unknown' — the generic message — rather than crashing
 * the report page.
 */
export function parseFailureCode(value: unknown): FailureCode {
  const parsed = failureCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : "unknown";
}

/**
 * User-facing copy, one honest sentence per code. Says what broke in plain
 * English without naming a vendor or leaking an internal detail. The code itself
 * is never rendered.
 */
export const FAILURE_COPY: Record<FailureCode, string> = {
  query_planning_failed:
    "We couldn't work out how to research this idea, so the analysis stopped before it started.",
  evidence_search_failed:
    "We couldn't reach our research sources while looking into your idea.",
  evidence_extraction_failed:
    "We found discussions about your idea but couldn't read through them reliably.",
  evidence_persist_failed:
    "We gathered the evidence for your idea but couldn't save it.",
  verdict_generation_failed:
    "We gathered the evidence but couldn't score your idea into a verdict.",
  plan_generation_failed:
    "We scored your idea but couldn't write up the realization plan that goes with it.",
  report_persist_failed:
    "We finished analyzing your idea but couldn't save the report.",
  timed_out:
    "The analysis took longer than we allow and we stopped it before it finished.",
  cancelled: "This analysis was cancelled before it finished.",
  unknown: "We hit an unexpected error while analyzing this idea.",
};

/**
 * A pipeline error tagged with its stage's code.
 *
 * `message` is `"<code>: <detail>"` so the code survives Trigger.dev's error
 * serialization — `onFailure` receives a plain `{name, message}` object, not this
 * instance, and recovers the code with `codeFromSerializedError`. `detail` is our
 * own short description; the original error is kept on `cause` for server-side
 * logging and is never persisted or sent to the client.
 */
export class AnalysisFailure extends Error {
  readonly code: FailureCode;

  constructor(code: FailureCode, cause?: unknown) {
    const detail =
      cause instanceof Error
        ? cause.message
        : typeof cause === "string"
          ? cause
          : "no detail";
    super(`${code}: ${detail}`);
    this.name = "AnalysisFailure";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Recover the code from an error that has crossed the Trigger.dev serialization
 * boundary (or from any stray error, which maps to 'unknown').
 */
export function codeFromSerializedError(error: unknown): FailureCode {
  if (error instanceof AnalysisFailure) return error.code;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  return parseFailureCode(message.split(":")[0]?.trim());
}
