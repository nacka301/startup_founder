import { z } from "zod";
import {
  CRITERION_KEYS,
  CONFIDENCE_LEVELS,
  type CriterionKey,
  type ConfidenceLevel,
} from "@/prompts/verdict.v2";

/**
 * Read-side validation for the report JSON stored by the analysis job.
 *
 * The write side (Stage C/D prompts) validates what the model produces before it
 * is persisted; these schemas validate again when the report page and share route
 * READ the jsonb back, per CLAUDE.md ("Zod-validate every LLM/DB JSON where you
 * read it"). They are deliberately independent of and looser than the write
 * schemas — a report written by an older prompt version must still render — but
 * strict enough that the renderer never has to guess at a shape.
 */

/** One scored criterion as stored in `reports.criteria`. */
export const reportCriterionSchema = z.object({
  key: z.enum(CRITERION_KEYS),
  score: z.number().int().min(0).max(100),
  reasoning: z.string().min(1),
  evidence_ids: z.array(z.string()).default([]),
});
export type ReportCriterion = z.infer<typeof reportCriterionSchema>;

export const reportCriteriaSchema = z.array(reportCriterionSchema);

/** `reports.solutions` — the free-tier MVP/solutions teaser (PRD §6.4). */
export const reportSolutionsSchema = z.object({
  mvp_sketch: z.string().min(1),
  possible_solutions: z.array(z.string().min(1)),
});
export type ReportSolutions = z.infer<typeof reportSolutionsSchema>;

/** `reports.plan` — the paid realization plan (PRD §6.5). Render-gated. */
export const reportPlanSchema = z.object({
  mvp: z.string().min(1),
  weekly_steps: z.array(
    z.object({
      week: z.number().int().min(1),
      focus: z.string().min(1),
      tasks: z.array(z.string().min(1)),
    }),
  ),
  tools: z.array(
    z.object({
      name: z.string().min(1),
      purpose: z.string().min(1),
    }),
  ),
  marketing: z.object({
    first_customers: z.array(z.string().min(1)),
    channels: z.array(z.string().min(1)),
  }),
});
export type ReportPlan = z.infer<typeof reportPlanSchema>;

/** One row of `evidence_items` as rendered. */
export const evidenceItemSchema = z.object({
  id: z.string(),
  source: z.string(),
  url: z.string().url(), // must be a real URL — never let a junk href reach the DOM
  quote: z.string().min(1),
  author_handle: z.string().nullable().default(null),
  // Extraction produces 1–3 (mild → serious); clamp on read so a stray value
  // still renders as a sane 3-step indicator rather than dropping the row.
  severity: z
    .number()
    .int()
    .transform((v) => Math.min(3, Math.max(1, v))),
  topic: z.string(),
  similar_count: z.number().int().min(1).default(1),
});
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

/**
 * Drop malformed rows rather than failing the whole report — a single bad
 * evidence row (e.g. a non-URL url) must not blank an otherwise valid report.
 */
export const evidenceItemsSchema = z
  .array(z.unknown())
  .transform((rows) =>
    rows.flatMap((r) => {
      const parsed = evidenceItemSchema.safeParse(r);
      return parsed.success ? [parsed.data] : [];
    }),
  );

export type Verdict = "go" | "caution" | "stop" | "insufficient";

/**
 * Display metadata for the three real verdicts. Colors are the verdict palette
 * from UI-STYLE-GUIDE — the only place in the app that uses green/amber/red — so
 * they are hardcoded here rather than routed through a theme token.
 */
export const VERDICT_DISPLAY: Record<
  "go" | "caution" | "stop",
  { label: string; color: string; blurb: string }
> = {
  go: { label: "GO", color: "#22C55E", blurb: "Worth pursuing" },
  caution: { label: "CAUTION", color: "#FBBF24", blurb: "Real, with open questions" },
  stop: { label: "STOP", color: "#EF4444", blurb: "The evidence is against it" },
};

export type { ConfidenceLevel };

/**
 * Read-side validation for `reports.confidence`. Tolerant: a NULL column (legacy
 * or insufficient-evidence report) or any unrecognized value degrades to null so
 * the header simply omits the confidence line rather than crashing.
 */
export function parseConfidence(value: unknown): ConfidenceLevel | null {
  const parsed = z.enum(CONFIDENCE_LEVELS).safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Human-readable labels + one-line meaning for the three confidence levels. */
export const CONFIDENCE_DISPLAY: Record<
  ConfidenceLevel,
  { label: string; blurb: string }
> = {
  low: { label: "Low confidence", blurb: "evidence is thin or mixed" },
  moderate: { label: "Moderate confidence", blurb: "evidence is reasonable" },
  high: { label: "High confidence", blurb: "evidence is strong and consistent" },
};

/** Human-readable labels for the four criteria, in report order. */
export const CRITERION_LABELS: Record<CriterionKey, string> = {
  problem_severity: "Problem severity & frequency",
  competition: "Competition & their weaknesses",
  personal_feasibility: "Personal feasibility",
  monetization: "Monetization potential",
};
