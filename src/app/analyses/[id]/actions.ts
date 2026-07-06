"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Answer = { id: string; answer: string };
type SubmitResult = { error: string };

/**
 * Step 2 → 3: store the 5 answers and move the analysis to 'queued', then
 * redirect back to the analysis page (which now shows the confirmation). Answers
 * are validated against each question's stored options; ownership is enforced by
 * loading the analysis through the user's RLS-scoped session before writing with
 * the service client.
 */
export async function submitAnswers(
  analysisId: string,
  answers: Answer[],
): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Please sign in again." };
  }

  // RLS scopes this to the owner; a non-owner (or missing id) gets null.
  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, status")
    .eq("id", analysisId)
    .maybeSingle();

  if (!analysis) {
    return { error: "We couldn't find that analysis." };
  }
  if (analysis.status !== "clarifying") {
    return { error: "This analysis has already been submitted." };
  }

  const { data: questions } = await supabase
    .from("analysis_questions")
    .select("id, options")
    .eq("analysis_id", analysisId);

  if (!questions || questions.length === 0) {
    return { error: "Something went wrong. Please try again." };
  }

  // Validate: exactly one answer per question, each ∈ that question's options.
  const optionsById = new Map(
    questions.map((q) => [q.id as string, (q.options as string[]) ?? []]),
  );
  if (answers.length !== questions.length) {
    return { error: "Please answer every question." };
  }
  for (const a of answers) {
    const options = optionsById.get(a.id);
    if (!options) {
      return { error: "Something went wrong. Please try again." };
    }
    if (!options.includes(a.answer)) {
      return { error: "Please choose one of the suggested answers." };
    }
  }

  const service = createServiceClient();

  for (const a of answers) {
    const { error } = await service
      .from("analysis_questions")
      .update({ answer: a.answer })
      .eq("id", a.id)
      .eq("analysis_id", analysisId);
    if (error) {
      return { error: "Couldn't save your answers. Please try again." };
    }
  }

  // Guard on status = 'clarifying' so a double-submit can't re-queue.
  const { error: statusError } = await service
    .from("analyses")
    .update({ status: "queued" })
    .eq("id", analysisId)
    .eq("status", "clarifying");

  if (statusError) {
    return { error: "Couldn't submit your analysis. Please try again." };
  }

  redirect(`/analyses/${analysisId}`);
}
