import { z } from "zod";

/**
 * Prompt v1 — Stage A clarification questions (ARCHITECTURE.md).
 *
 * Given a user's free-text business idea, Sonnet returns 5 clarification
 * questions tailored to THAT idea, each with 3–4 concrete suggested answers. The
 * "I don't know" option is appended in application code (never requested from the
 * model) so it is always present exactly once — it is a legitimate answer the
 * later analysis accounts for.
 */

export const CLARIFICATION_MODEL = "claude-sonnet-5";
export const CLARIFICATION_STAGE = "questions";
export const IDK_OPTION = "I don't know";

/** Zod schema for the raw model JSON (before the "I don't know" option is added). */
export const clarificationResponseSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string().min(1)).min(3).max(4),
      }),
    )
    .length(5),
});

export type ClarificationResponse = z.infer<typeof clarificationResponseSchema>;

export function buildSystemPrompt(): string {
  return [
    "You help evaluate early business ideas. Given a founder's rough idea, you write short clarification questions that surface the assumptions a rigorous evaluation would need to pin down: who exactly has the problem, how they solve it today, what would make this idea specific enough to research, and how it could make money.",
    "",
    "Write exactly 5 questions. Each must be specific to THIS idea — never generic startup boilerplate. For each question, give 3–4 concrete, mutually distinct suggested answers phrased in plain language a non-technical founder would use. Do NOT include an \"I don't know\" / \"unsure\" option; that is added separately.",
    "",
    "Tone: direct and neutral. No hype, no flattery.",
    "",
    "Respond with ONLY a JSON object, no markdown fences and no commentary, in exactly this shape:",
    '{"questions":[{"question":"...","options":["...","...","..."]}, ... 5 items]}',
  ].join("\n");
}

export function buildUserPrompt(ideaText: string): string {
  return `The founder's idea:\n\n"""\n${ideaText}\n"""\n\nWrite the 5 clarification questions as JSON.`;
}
