import { z } from "zod";
import { formatProfileForPrompt, type ProfileInput } from "@/lib/profile-format";

/**
 * Prompt v2 — Stage C verdict/scoring (ARCHITECTURE.md §3).
 *
 * Sonnet receives the idea, the 5 clarification answers, the founder's onboarding
 * profile (for personal feasibility), and the full evidence set, and returns a
 * scored verdict: four criteria (each with reasoning and the evidence item IDs it
 * relies on), a 1–100 total, a go/caution/stop verdict, a `confidence` level, a
 * 2–3 sentence summary, and a short solutions / MVP sketch.
 *
 * Changes over v1:
 *  - Adds `confidence` ("low"|"moderate"|"high") so a thin-evidence verdict reads
 *    honestly (PRD §11: verdicts must carry uncertainty). Stored in
 *    `reports.confidence`, surfaced under the verdict badge.
 *  - Binds the overall score to the verdict via explicit bands and requires it to
 *    cohere with the four criteria, so similar ideas don't get inconsistent calls.
 *  - Requires each criterion's reasoning to follow claim → evidence → implication
 *    (UI-STYLE-GUIDE tone), reducing generic prose.
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

/** The confidence levels, most-to-least uncertain. */
export const CONFIDENCE_LEVELS = ["low", "moderate", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/**
 * Score bands that map the overall 1–100 score to the verdict enum. Kept as a
 * single source so the prompt copy and any future validation agree.
 */
export const VERDICT_BANDS = {
  go: { min: 65, max: 100 },
  caution: { min: 40, max: 64 },
  stop: { min: 1, max: 39 },
} as const;

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
      confidence: z.enum(CONFIDENCE_LEVELS),
      summary: z.string().min(1),
      criteria: z.array(criterion),
      solutions: z.object({
        mvp_sketch: z.string().min(1),
        possible_solutions: z.array(z.string().min(1)).min(2),
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

      // Keep the overall score and the verdict enum in the same band, so a
      // "stop" can't ship with a 70 or a "go" with a 30.
      const band = VERDICT_BANDS[data.verdict];
      if (data.score < band.min || data.score > band.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["verdict"],
          message: `verdict "${data.verdict}" requires an overall score in ${band.min}–${band.max}; got ${data.score}. Use go for 65–100, caution for 40–64, stop for 1–39.`,
        });
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
    "Reasoning quality (each criterion's \"reasoning\"):",
    "- Follow claim → evidence → implication: state the judgement, ground it in the specific cited evidence (or, for personal_feasibility, the profile), then say what it means for this founder.",
    "- Be concrete and specific to THIS idea. No generic startup language, no filler, no restating the criterion name.",
    "",
    "Evidence discipline (strict):",
    '- For "problem_severity", "competition" and "monetization", cite the specific evidence IDs your reasoning relies on in that criterion\'s "evidence_ids". Each of these three MUST cite at least one ID.',
    '- Only cite IDs that appear in the provided evidence list — never invent an ID.',
    '- "personal_feasibility" is scored from the profile; it may have an empty "evidence_ids".',
    "",
    'Then give an overall "score" (1–100) and a "verdict". Map the score to the verdict by these bands — they must agree:',
    "- \"go\" = score 65–100: strong, worth pursuing.",
    "- \"caution\" = score 40–64: real, but with serious open questions.",
    "- \"stop\" = score 1–39: the evidence is against it.",
    "The overall score must be consistent with the four criteria — it should reflect their balance, not diverge from them.",
    "",
    'Also give a "confidence" — how much weight the founder should put on this verdict, based on the EVIDENCE STRENGTH, not on how positive the verdict is:',
    '- "low": evidence is thin (near the minimum we required), narrow (few distinct sources/topics), or contradictory.',
    '- "high": many independent items consistently point the same way.',
    '- "moderate": anything in between.',
    "",
    'Write a "summary" of 2–3 sentences a founder can read first — honest, specific, and stating the key uncertainty explicitly.',
    'Finally give "solutions": a short "mvp_sketch" (what a first version could look like) and at least two "possible_solutions" (distinct angles worth considering). Keep this brief — it is the free-tier teaser, not the full plan.',
    "",
    "Respond with ONLY a JSON object, no markdown fences and no commentary, in exactly this shape:",
    '{"score":72,"verdict":"go","confidence":"moderate","summary":"...","criteria":[{"key":"problem_severity","score":80,"reasoning":"...","evidence_ids":["<id>","<id>"]},{"key":"competition","score":55,"reasoning":"...","evidence_ids":["<id>"]},{"key":"personal_feasibility","score":60,"reasoning":"...","evidence_ids":[]},{"key":"monetization","score":65,"reasoning":"...","evidence_ids":["<id>"]}],"solutions":{"mvp_sketch":"...","possible_solutions":["...","..."]}}',
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
    `Evidence items (${evidence.length} total; cite these IDs):`,
    "",
    evidenceList,
    "",
    "Return the verdict JSON now, citing evidence IDs as instructed.",
  ].join("\n");
}
