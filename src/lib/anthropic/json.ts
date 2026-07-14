import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { getAnthropic } from "./client";
import { logLlmCost } from "./costs";

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
 * Call Claude for a JSON response, Zod-validate it, and retry once on a
 * parse/validation failure. Every call (both attempts) is logged to `llm_costs`
 * with the given stage. Throws if both attempts fail to produce a valid response.
 *
 * This is the generic form of the parse/validate/retry loop used by Stage A
 * (`clarification.ts` keeps its own copy); the evidence stages (`queries`,
 * `extract`) share this one.
 */
export async function callClaudeJson<T>(params: {
  model: string;
  stage: string;
  analysisId: string | null;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
}): Promise<T> {
  const anthropic = getAnthropic();
  let lastError = "no response";

  // Two attempts total: the initial call plus one retry on parse failure.
  for (let attempt = 0; attempt < 2; attempt++) {
    const userContent =
      attempt === 0
        ? params.user
        : `${params.user}\n\nYour previous response could not be parsed (${lastError}). Respond again with ONLY the JSON described — no prose, no code fences.`;

    const message = await anthropic.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      thinking: { type: "disabled" },
      system: params.system,
      messages: [{ role: "user", content: userContent }],
    });

    await logLlmCost({
      analysisId: params.analysisId,
      stage: params.stage,
      model: params.model,
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

    const validated = params.schema.safeParse(parsed.value);
    if (!validated.success) {
      lastError = validated.error.issues[0]?.message ?? "response did not match schema";
      continue;
    }

    return validated.data;
  }

  throw new Error(`${params.stage} generation failed: ${lastError}`);
}
