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
  // Count + membership + no-duplicates together guarantee full unique coverage
  // (N distinct valid question ids out of N questions ⇒ every question answered).
  const optionsById = new Map(
    questions.map((q) => [q.id as string, (q.options as string[]) ?? []]),
  );
  if (answers.length !== questions.length) {
    return { error: "Please answer every question." };
  }
  const seen = new Set<string>();
  for (const a of answers) {
    const options = optionsById.get(a.id);
    if (!options) {
      return { error: "Something went wrong. Please try again." };
    }
    if (seen.has(a.id)) {
      return { error: "Please answer every question." };
    }
    seen.add(a.id);
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

/**
 * Discard an in-progress analysis so the user can start over. Ownership is
 * enforced by loading the row through the user's RLS-scoped session before the
 * service-role delete. Only a 'clarifying' analysis may be discarded — once it's
 * 'queued' (or later) the analysis job owns its lifecycle. Deleting the row frees
 * the user's single active slot and cascades to its questions; llm_costs rows
 * survive (analysis_id set null). Redirects to the new-analysis page on success.
 */
export async function cancelAnalysis(analysisId: string): Promise<SubmitResult> {
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
    return { error: "This analysis is already running and can't be discarded." };
  }

  // Guard on status = 'clarifying' so a concurrent submit can't have it deleted
  // out from under a running job.
  const service = createServiceClient();
  const { error } = await service
    .from("analyses")
    .delete()
    .eq("id", analysisId)
    .eq("status", "clarifying");

  if (error) {
    return { error: "Couldn't discard this analysis. Please try again." };
  }

  redirect("/analyses/new");
}
