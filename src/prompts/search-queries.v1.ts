import { z } from "zod";

/**
 * Prompt v1 — Stage B query planning (ARCHITECTURE.md).
 *
 * Given the founder's idea plus their 5 clarification answers, Sonnet produces
 * 6–10 complaint-phrased search queries — the words a real person frustrated by
 * the problem would type or post ("annoyed with X", "why is there no Y"), NOT
 * marketing/solution phrasing. These queries drive the Reddit + forum search.
 */

export const QUERIES_MODEL = "claude-sonnet-5";
export const QUERIES_STAGE = "queries";

export const MIN_QUERIES = 6;
export const MAX_QUERIES = 10;

/** Zod schema for the raw model JSON. */
export const searchQueriesResponseSchema = z.object({
  queries: z.array(z.string().min(1)).min(MIN_QUERIES).max(MAX_QUERIES),
});

export type SearchQueriesResponse = z.infer<typeof searchQueriesResponseSchema>;

export type AnswerPair = { question: string; answer: string };

export function buildSystemPrompt(): string {
  return [
    "You plan web searches that find real people complaining about a problem, to test whether a business idea addresses a genuine pain.",
    "",
    `Given a founder's idea and their answers to clarification questions, write ${MIN_QUERIES}–${MAX_QUERIES} search queries phrased the way a frustrated person would actually write online — complaints, gripes, and unmet needs. Examples of the register: "so annoyed with...", "why is there no app that...", "how do people deal with...", "hate that I have to...".`,
    "",
    "Rules:",
    '- Target the PROBLEM and the people who have it, never the founder\'s proposed solution or product name.',
    "- Use natural, everyday language a non-technical person would search or post — not keyword salad.",
    "- Make the set diverse: cover different phrasings, sub-problems, and audiences implied by the answers.",
    '- If an answer is "I don\'t know", don\'t invent specifics around it — lean on what the other answers make concrete.',
    "",
    'Respond with ONLY a JSON object, no markdown fences and no commentary, in exactly this shape:',
    '{"queries":["...","...", ... ]}',
  ].join("\n");
}

export function buildUserPrompt(ideaText: string, answers: AnswerPair[]): string {
  const qa = answers
    .map((a, i) => `${i + 1}. ${a.question}\n   Answer: ${a.answer}`)
    .join("\n");
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
    `Write the ${MIN_QUERIES}–${MAX_QUERIES} complaint-phrased search queries as JSON.`,
  ].join("\n");
}
