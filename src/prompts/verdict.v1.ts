import { z } from "zod";
import { formatProfileForPrompt, type ProfileInput } from "@/lib/profile-format";

/**
 * Prompt v1 — Stage C verdict/scoring (ARCHITECTURE.md §3).
 *
 * Sonnet receives the idea, the 5 clarification answers, the founder's onboarding
 * profile (for personal feasibility), and the full evidence set, and returns a
 * scored verdict: four criteria (each with reasoning and the evidence item IDs it
 * relies on), a 1–100 total, a go/caution/stop verdict, a 2–3 sentence summary,
 * and a short solutions / MVP sketch.
 *
 * Evidence discipline is enforced in the schema, not just the prompt: see
 * `buildVerdictResponseSchema`, which is parameterized with the valid evidence IDs
 * for this analysis so any hallucinated or missing reference fails validation and
 * triggers the one corrective retry in `callClaudeJson`.
 */

export const VERDICT_MODEL = "claude-sonnet-5";
export const VERDICT_STAGE = "verdict";

/** The four scoring criteria, in report order (ARCHITECTURE.md §3, PRD §6.2). */
export const CRITERION_KEYS = [
  "problem_severity",
  "competition",
  "personal_feasibility",
  "monetization",
] as const;
export type CriterionKey = (typeof CRITERION_KEYS)[number];

/**
 * Criteria that must cite at least one evidence item. `personal_feasibility` is
 * exempt — it is scored from the founder's profile, not from public evidence.
 */
const EVIDENCE_REQUIRED_KEYS: CriterionKey[] = [
  "problem_severity",
  "competition",
  "monetization",
];

/**
 * Build the verdict response schema for a specific analysis. `validEvidenceIds`
 * is the set of real `evidence_items.id`s for this analysis; every cited
 * `evidence_ids` value must be in it, and each evidence-required criterion must
 * cite at least one. Violations surface as Zod issues so `callClaudeJson` re-asks
 * once, then fails the run rather than storing unsupported claims.
 */
export function buildVerdictResponseSchema(validEvidenceIds: Set<string>) {
  const criterion = z.object({
    key: z.enum(CRITERION_KEYS),
    score: z.number().int().min(0).max(100),
    reasoning: z.string().min(1),
    evidence_ids: z.array(z.string()),
  });

  return z
    .object({
      score: z.number().int().min(1).max(100),
      verdict: z.enum(["go", "caution", "stop"]),
      summary: z.string().min(1),
      criteria: z.array(criterion),
      solutions: z.object({
        mvp_sketch: z.string().min(1),
        possible_solutions: z.array(z.string().min(1)).min(1),
      }),
    })
    .superRefine((data, ctx) => {
      const keys = data.criteria.map((c) => c.key);
      const present = new Set(keys);

      if (keys.length !== present.size) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria"],
          message:
            "criteria contains duplicate keys; include problem_severity, competition, personal_feasibility and monetization exactly once each",
        });
      }
      for (const k of CRITERION_KEYS) {
        if (!present.has(k)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["criteria"],
            message: `criteria is missing "${k}"; include all four criteria`,
          });
        }
      }

      for (const c of data.criteria) {
        for (const id of c.evidence_ids) {
          if (!validEvidenceIds.has(id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["criteria"],
              message: `evidence id "${id}" in criterion "${c.key}" is not one of this analysis's evidence items; only cite evidence IDs from the provided list`,
            });
          }
        }
        if (EVIDENCE_REQUIRED_KEYS.includes(c.key) && c.evidence_ids.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["criteria"],
            message: `criterion "${c.key}" must cite at least one evidence id from the provided evidence`,
          });
        }
      }
    });
}

export type VerdictResponse = z.infer<ReturnType<typeof buildVerdictResponseSchema>>;

export type AnswerPair = { question: string; answer: string };

/** One evidence item as presented to the model, with its real DB id to cite. */
export type EvidenceForPrompt = {
  id: string;
  source: string;
  quote: string;
  severity: number;
  topic: string;
  similar_count: number;
  url: string;
};

export function buildSystemPrompt(): string {
  return [
    "You are a rigorous, honest analyst giving a founder a verdict on their business idea. Your job is to be useful, not encouraging — no hype, no cheerleading. Ground every judgement in the evidence provided and say plainly when the evidence is thin or mixed.",
    "",
    "You are given the idea, the founder's answers to five clarification questions, the founder's profile, and a list of evidence items (real complaints/discussions found online). Each evidence item has an ID.",
    "",
    "Score four criteria, each 0–100 with a short reasoning paragraph:",
    '- "problem_severity": how real, frequent and painful the problem is, judged from the evidence.',
    '- "competition": how crowded the space is and how weak/strong existing options are (from the evidence).',
    '- "personal_feasibility": how well THIS founder — their occupation, skills, weekly time, budget and work preference — is placed to build and sustain this. Judge from the profile; where the profile is "not provided", assume nothing and say so.',
    '- "monetization": how plausibly people would pay, and whether the evidence shows willingness to pay or spend on workarounds.',
    "",
    "Evidence discipline (strict):",
    '- For "problem_severity", "competition" and "monetization", cite the specific evidence IDs your reasoning relies on in that criterion\'s "evidence_ids". Each of these three MUST cite at least one ID.',
    '- Only cite IDs that appear in the provided evidence list — never invent an ID.',
    '- "personal_feasibility" is scored from the profile; it may have an empty "evidence_ids".',
    "",
    'Then give an overall "score" (1–100) and a "verdict": "go" (strong, worth pursuing), "caution" (real but with serious open questions), or "stop" (evidence is against it). The overall score should be consistent with the criteria and the verdict.',
    'Write a "summary" of 2–3 sentences a founder can read first — honest, specific, and including any key uncertainty.',
    'Finally give "solutions": a short "mvp_sketch" (what a first version could look like) and a few "possible_solutions" (distinct angles worth considering). Keep this brief — it is the free-tier teaser, not the full plan.',
    "",
    "Respond with ONLY a JSON object, no markdown fences and no commentary, in exactly this shape:",
    '{"score":72,"verdict":"caution","summary":"...","criteria":[{"key":"problem_severity","score":80,"reasoning":"...","evidence_ids":["<id>","<id>"]},{"key":"competition","score":55,"reasoning":"...","evidence_ids":["<id>"]},{"key":"personal_feasibility","score":60,"reasoning":"...","evidence_ids":[]},{"key":"monetization","score":65,"reasoning":"...","evidence_ids":["<id>"]}],"solutions":{"mvp_sketch":"...","possible_solutions":["...","..."]}}',
  ].join("\n");
}

export function buildUserPrompt(
  ideaText: string,
  answers: AnswerPair[],
  profile: ProfileInput,
  evidence: EvidenceForPrompt[],
): string {
  const qa = answers
    .map((a, i) => `${i + 1}. ${a.question}\n   Answer: ${a.answer}`)
    .join("\n");

  const evidenceList = evidence
    .map(
      (e) =>
        `[${e.id}] (severity ${e.severity}, ~${e.similar_count} similar, ${e.source}, topic: ${e.topic})\n   "${e.quote}"\n   ${e.url}`,
    )
    .join("\n\n");

  return [
    "The founder's idea:",
    "",
    '"""',
    ideaText,
    '"""',
    "",
    "Their clarification answers:",
    qa,
    "",
    "The founder's profile (for personal feasibility):",
    formatProfileForPrompt(profile),
    "",
    "Evidence items (cite these IDs):",
    "",
    evidenceList,
    "",
    "Return the verdict JSON now, citing evidence IDs as instructed.",
  ].join("\n");
}
