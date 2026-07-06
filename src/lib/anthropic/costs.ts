import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Claude API list pricing in USD per 1,000,000 tokens. Keep in sync with
 * https://platform.claude.com/docs/en/about-claude/models/overview when models
 * or pricing change. Unknown models fall back to 0 (logged, not billed).
 */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
};

export function computeCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = PRICING[model];
  if (!rate) return 0;
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}

/**
 * Record one Claude call in `llm_costs`. Writes via the service-role client (the
 * table is not writable by users). Never throws — cost logging must not break the
 * user-facing flow; failures are logged for debugging only.
 */
export async function logLlmCost(params: {
  analysisId: string | null;
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("llm_costs").insert({
    analysis_id: params.analysisId,
    stage: params.stage,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_usd: computeCostUsd(params.model, params.inputTokens, params.outputTokens),
  });
  if (error) {
    console.error("Failed to write llm_costs row:", error.message);
  }
}
