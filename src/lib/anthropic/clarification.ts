import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./client";
import { logLlmCost } from "./costs";
import {
  buildSystemPrompt,
  buildUserPrompt,
  CLARIFICATION_MODEL,
  CLARIFICATION_STAGE,
  clarificationResponseSchema,
  IDK_OPTION,
} from "@/prompts/clarification-questions.v1";

export type ClarificationQuestion = { question: string; options: string[] };

type JsonParse =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

function parseJson(text: string): JsonParse {
  let cleaned = text.trim();
  // Strip a ```json ... ``` fence if the model added one despite instructions.
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) cleaned = fenced[1].trim();
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "invalid JSON" };
  }
}

/**
 * Generate 5 idea-specific clarification questions with Sonnet, Zod-validate the
 * JSON response, and retry once on a parse/validation failure. Every call (both
 * attempts) is logged to `llm_costs`. Returns the questions with "I don't know"
 * appended to each. Throws if both attempts fail to produce a valid response.
 */
export async function generateClarificationQuestions(
  ideaText: string,
  analysisId: string | null,
): Promise<ClarificationQuestion[]> {
  const anthropic = getAnthropic();
  const system = buildSystemPrompt();
  const baseUser = buildUserPrompt(ideaText);

  let lastError = "no response";

  // Two attempts total: the initial call plus one retry on parse failure.
  for (let attempt = 0; attempt < 2; attempt++) {
    const userContent =
      attempt === 0
        ? baseUser
        : `${baseUser}\n\nYour previous response could not be parsed (${lastError}). Respond again with ONLY the JSON object described — no prose, no code fences.`;

    const message = await anthropic.messages.create({
      model: CLARIFICATION_MODEL,
      max_tokens: 2000,
      thinking: { type: "disabled" },
      system,
      messages: [{ role: "user", content: userContent }],
    });

    await logLlmCost({
      analysisId,
      stage: CLARIFICATION_STAGE,
      model: CLARIFICATION_MODEL,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = parseJson(text);
    if (!parsed.ok) {
      lastError = parsed.error;
      continue;
    }

    const validated = clarificationResponseSchema.safeParse(parsed.value);
    if (!validated.success) {
      lastError = validated.error.issues[0]?.message ?? "response did not match schema";
      continue;
    }

    return validated.data.questions.map((q) => ({
      question: q.question,
      // Ensure "I don't know" is present exactly once, always last.
      options: [
        ...q.options.filter((o) => o.trim().toLowerCase() !== IDK_OPTION.toLowerCase()),
        IDK_OPTION,
      ],
    }));
  }

  throw new Error(`Clarification question generation failed: ${lastError}`);
}
