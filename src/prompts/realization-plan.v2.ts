import { z } from "zod";
import { formatProfileForPrompt, type ProfileInput } from "@/lib/profile-format";

/**
 * Prompt v2 — Stage D realization plan (ARCHITECTURE.md §3, PRD §6.5).
 *
 * Sonnet turns the verdict into a concrete, do-this-next plan: an MVP definition,
 * week-by-week steps to launch, suggested tools, and a marketing-light section
 * (where to find the first customers). Always generated and stored in
 * `reports.plan`; the UI gates it for free users at render time, not here.
 *
 * Change over v1: the plan is also given the real communities and topics where
 * this idea's evidence was actually found, so "first_customers" points at the
 * places real complaints came from (e.g. the specific subreddits) instead of
 * generic guesses. The plan stays tailored to THIS founder — it takes their
 * profile (time, budget, skills) so the pace and tooling are realistic, plus the
 * verdict's summary and solution sketch for continuity.
 */

export const PLAN_MODEL = "claude-sonnet-5";
export const PLAN_STAGE = "plan";

export const realizationPlanResponseSchema = z.object({
  mvp: z.string().min(1),
  weekly_steps: z
    .array(
      z.object({
        week: z.number().int().min(1),
        focus: z.string().min(1),
        tasks: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
  tools: z
    .array(
      z.object({
        name: z.string().min(1),
        purpose: z.string().min(1),
      }),
    )
    .min(1),
  marketing: z.object({
    first_customers: z.array(z.string().min(1)).min(1),
    channels: z.array(z.string().min(1)).min(1),
  }),
});

export type RealizationPlanResponse = z.infer<typeof realizationPlanResponseSchema>;

export type AnswerPair = { question: string; answer: string };

/** The bits of the Stage C verdict the plan builds on, for continuity. */
export type VerdictContext = {
  summary: string;
  mvpSketch: string;
  possibleSolutions: string[];
};

/**
 * Where the evidence actually came from: distinct community/source labels (e.g.
 * "r/freelance", "indiehackers.com") and distinct topic labels, both derived from
 * this analysis's evidence_items. Used to ground "first_customers".
 */
export type EvidenceSources = {
  communities: string[];
  topics: string[];
};

export function buildSystemPrompt(): string {
  return [
    "You write a concrete, realistic realization plan that takes a validated business idea from today to a launched MVP. The reader is the founder; assume mixed technical skill and explain choices plainly. No hype — practical steps they can actually start on.",
    "",
    "You are given the idea, the founder's clarification answers, their profile (time, budget, skills, preferences), the verdict's summary and solution sketch, and the real communities and topics where this idea's evidence was found. Tailor the plan to this founder: match the weekly pace to their available time, and keep tool and cost suggestions within their stated budget where known.",
    "",
    "Produce:",
    '- "mvp": a concrete definition of the smallest first version worth launching — what it does, for whom, and explicitly what it leaves out.',
    '- "weekly_steps": an ordered, week-by-week path to launch. Each step has "week" (a number starting at 1), a short "focus", and a list of specific "tasks". Cover build, test-with-users, and launch — not just building.',
    '- "tools": a handful of suggested tools/services with a one-line "purpose" each. Prefer low-cost, well-known options suited to the founder\'s skills.',
    '- "marketing": marketing-light only — "first_customers" (specific places/communities where the first customers actually are) and "channels" (a few realistic ways to reach them). Not a full marketing plan.',
    "",
    'For "first_customers", PREFER the actual communities where this idea\'s evidence was found (given below) over generic guesses — those are places real people already voiced this problem. Only add others if genuinely relevant.',
    "",
    "Respond with ONLY a JSON object, no markdown fences and no commentary, in exactly this shape:",
    '{"mvp":"...","weekly_steps":[{"week":1,"focus":"...","tasks":["...","..."]}],"tools":[{"name":"...","purpose":"..."}],"marketing":{"first_customers":["..."],"channels":["..."]}}',
  ].join("\n");
}

export function buildUserPrompt(
  ideaText: string,
  answers: AnswerPair[],
  profile: ProfileInput,
  verdict: VerdictContext,
  sources: EvidenceSources,
): string {
  const qa = answers
    .map((a, i) => `${i + 1}. ${a.question}\n   Answer: ${a.answer}`)
    .join("\n");

  const solutions = verdict.possibleSolutions
    .map((s) => `- ${s}`)
    .join("\n");

  const communities =
    sources.communities.length > 0
      ? sources.communities.map((c) => `- ${c}`).join("\n")
      : "- (none identified)";
  const topics =
    sources.topics.length > 0
      ? sources.topics.map((t) => `- ${t}`).join("\n")
      : "- (none identified)";

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
    "The founder's profile:",
    formatProfileForPrompt(profile),
    "",
    "Verdict summary (for continuity):",
    verdict.summary,
    "",
    "MVP sketch from the verdict:",
    verdict.mvpSketch,
    "",
    "Possible solution directions:",
    solutions,
    "",
    "Communities where this idea's evidence was found (prefer these for first_customers):",
    communities,
    "",
    "Topics that came up in the evidence:",
    topics,
    "",
    "Return the realization plan JSON now, tailored to this founder's time and budget.",
  ].join("\n");
}
