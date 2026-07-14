import { z } from "zod";

/**
 * Prompt v1 — Stage B evidence extraction (ARCHITECTURE.md).
 *
 * Haiku reads a batch of ~20 candidate posts/comments and, for each, decides
 * whether it is genuinely about the founder's problem. For the relevant ones it
 * pulls a verbatim quote, a 1–3 severity, and a short canonical topic label. The
 * batch is keyed by `index` so results map back to the input candidates.
 */

export const EXTRACT_MODEL = "claude-haiku-4-5";
export const EXTRACT_STAGE = "extract";

/**
 * Lenient schema: every item reports `index` + `relevant`; the quote/severity/
 * topic fields are only meaningful (and only required by the caller) when
 * `relevant` is true. Keeping them optional avoids validation churn on the
 * irrelevant majority.
 */
export const evidenceExtractionResponseSchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int(),
      relevant: z.boolean(),
      quote: z.string().optional(),
      severity: z.number().int().min(1).max(3).optional(),
      topic: z.string().optional(),
    }),
  ),
});

export type EvidenceExtractionResponse = z.infer<
  typeof evidenceExtractionResponseSchema
>;

export type ExtractionCandidate = {
  index: number;
  source: string;
  text: string;
};

export function buildSystemPrompt(): string {
  return [
    "You screen online posts and comments as evidence that a specific problem is real and painful.",
    "",
    "You are given the problem context and a numbered batch of candidate items (Reddit posts/comments and forum snippets). For EACH item, decide whether it is genuinely about THIS problem — a real person describing the pain, a workaround, a complaint, or an unmet need. Marketing, off-topic chatter, and vague mentions are NOT relevant.",
    "",
    "For each item return an object with:",
    '- "index": the item\'s number.',
    '- "relevant": true only if it is real, on-topic evidence of the problem.',
    "When relevant is true, also include:",
    '- "quote": a short verbatim excerpt (one or two sentences) copied from the item — do not paraphrase or invent text.',
    '- "severity": 1 (mild annoyance), 2 (real recurring frustration), or 3 (serious pain, actively seeking a fix).',
    '- "topic": a short canonical label for the specific complaint (2–5 words), so similar items can be grouped.',
    "",
    "When relevant is false, omit quote/severity/topic. Be strict: it is better to drop a borderline item than to include a quote that does not clearly evidence the problem.",
    "",
    "Respond with ONLY a JSON object, no markdown fences and no commentary, in exactly this shape:",
    '{"items":[{"index":1,"relevant":true,"quote":"...","severity":2,"topic":"..."},{"index":2,"relevant":false}]}',
  ].join("\n");
}

export function buildUserPrompt(
  problemContext: string,
  candidates: ExtractionCandidate[],
): string {
  const list = candidates
    .map((c) => `[${c.index}] (${c.source}) ${c.text}`)
    .join("\n\n");
  return [
    "Problem context (the idea being evaluated):",
    "",
    '"""',
    problemContext,
    '"""',
    "",
    "Candidate items:",
    "",
    list,
    "",
    "Return the JSON judgement for every item by index.",
  ].join("\n");
}
