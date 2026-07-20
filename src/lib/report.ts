import {
  evidenceItemsSchema,
  parseConfidence,
  reportCriteriaSchema,
  reportPlanSchema,
  reportSolutionsSchema,
  type ConfidenceLevel,
  type EvidenceItem,
  type ReportCriterion,
  type ReportPlan,
  type ReportSolutions,
} from "@/lib/report-schema";

/** A validated, ready-to-render `done` report. */
export type RenderableReport = {
  score: number;
  verdict: "go" | "caution" | "stop";
  summary: string;
  /** Verdict confidence; null for legacy reports written before the column. */
  confidence: ConfidenceLevel | null;
  criteria: ReportCriterion[];
  solutions: ReportSolutions;
  /** Only ever non-null for paid owners; never populated for free/shared views. */
  plan: ReportPlan | null;
  evidence: EvidenceItem[];
};

/** The raw `reports` row shape this helper reads (jsonb columns as `unknown`). */
export type RawReportRow = {
  score: number | null;
  verdict: string | null;
  summary: string | null;
  /** Present when the caller SELECTed it; tolerant of null/legacy. */
  confidence?: unknown;
  criteria: unknown;
  solutions: unknown;
  /** Present only when the caller intentionally SELECTed it (paid owner). */
  plan?: unknown;
};

/**
 * Validate a stored `done` report + its evidence for rendering, per CLAUDE.md
 * (Zod-validate DB JSON on read). Returns null if anything essential is missing
 * or malformed so the caller can fall back to a graceful error state instead of
 * throwing in a Server Component.
 *
 * `plan` is parsed only if the caller passed it in `row.plan` — the free and
 * shared views never select it, so it can never reach the returned object (and
 * thus never the HTML) for them.
 */
export function parseDoneReport(
  row: RawReportRow,
  evidenceRaw: unknown,
): RenderableReport | null {
  if (
    row.score == null ||
    row.verdict == null ||
    row.summary == null ||
    (row.verdict !== "go" && row.verdict !== "caution" && row.verdict !== "stop")
  ) {
    return null;
  }

  const criteria = reportCriteriaSchema.safeParse(row.criteria);
  const solutions = reportSolutionsSchema.safeParse(row.solutions);
  const evidence = evidenceItemsSchema.safeParse(evidenceRaw ?? []);
  if (!criteria.success || !solutions.success || !evidence.success) {
    return null;
  }

  let plan: ReportPlan | null = null;
  if (row.plan != null) {
    const parsedPlan = reportPlanSchema.safeParse(row.plan);
    // A malformed plan shouldn't blank the whole report — just omit it.
    plan = parsedPlan.success ? parsedPlan.data : null;
  }

  return {
    score: row.score,
    verdict: row.verdict,
    summary: row.summary,
    confidence: parseConfidence(row.confidence),
    criteria: criteria.data,
    solutions: solutions.data,
    plan,
    evidence: evidence.data,
  };
}
