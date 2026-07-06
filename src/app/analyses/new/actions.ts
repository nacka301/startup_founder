"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateClarificationQuestions } from "@/lib/anthropic/clarification";
import { ACTIVE_STATUSES, MAX_IDEA_LENGTH, MIN_IDEA_LENGTH } from "@/lib/analyses";

type CreateResult = { error: string };
type ServiceClient = ReturnType<typeof createServiceClient>;

/** The user's in-progress analysis id, if any (clarifying/queued/running). */
async function findActiveAnalysisId(
  service: ServiceClient,
  userId: string,
): Promise<string | null> {
  const { data } = await service
    .from("analyses")
    .select("id")
    .eq("user_id", userId)
    .in("status", [...ACTIVE_STATUSES])
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Step 1 → 2: create the analysis (status 'clarifying'), generate its 5
 * clarification questions with Sonnet, store them, and redirect to the analysis
 * page. Gating and validation are re-checked server-side; the client UI is not
 * trusted. On success this redirects (never returns) — it only returns on failure.
 */
export async function createAnalysis(ideaText: string): Promise<CreateResult> {
  const idea = ideaText.trim();
  if (idea.length < MIN_IDEA_LENGTH) {
    return {
      error: `Please describe your idea in at least ${MIN_IDEA_LENGTH} characters.`,
    };
  }
  if (idea.length > MAX_IDEA_LENGTH) {
    return { error: "That's a lot of detail — please keep it under 2000 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Please sign in again." };
  }

  const service = createServiceClient();

  // Gate 1: one active analysis at a time. If one exists, take the user straight
  // to it rather than dead-ending on an error.
  const activeId = await findActiveAnalysisId(service, user.id);
  if (activeId) {
    redirect(`/analyses/${activeId}`);
  }

  // Gate 2: free users get one analysis.
  const { data: profile } = await service
    .from("profiles")
    .select("plan, free_credit_used")
    .eq("id", user.id)
    .single();

  if (profile?.plan === "free" && profile.free_credit_used) {
    return { error: "You've used your free analysis. Upgrade to run more." };
  }

  // Reserve the row first (status 'clarifying') so the active slot is taken,
  // then call Claude.
  const { data: analysis, error: insertError } = await service
    .from("analyses")
    .insert({ user_id: user.id, idea_text: idea, status: "clarifying" })
    .select("id")
    .single();

  if (insertError || !analysis) {
    // A concurrent request won the unique index — send the user to that one.
    const racedId = await findActiveAnalysisId(service, user.id);
    if (racedId) {
      redirect(`/analyses/${racedId}`);
    }
    // Otherwise it's a real DB error (e.g. migration not applied) — surface it
    // in the server logs rather than masking it behind a generic message.
    if (insertError) {
      console.error("Failed to create analysis:", insertError.message);
    }
    return { error: "Couldn't start your analysis. Please try again." };
  }

  let questions;
  try {
    questions = await generateClarificationQuestions(idea, analysis.id);
  } catch {
    // Roll back the reserved row so a failed generation doesn't block the user.
    await service.from("analyses").delete().eq("id", analysis.id);
    return { error: "We couldn't prepare your questions just now. Please try again." };
  }

  const rows = questions.map((q, i) => ({
    analysis_id: analysis.id,
    position: i + 1,
    question: q.question,
    options: q.options,
  }));

  const { error: questionsError } = await service
    .from("analysis_questions")
    .insert(rows);

  if (questionsError) {
    await service.from("analyses").delete().eq("id", analysis.id);
    return { error: "Something went wrong preparing your questions. Please try again." };
  }

  redirect(`/analyses/${analysis.id}`);
}
