"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateClarificationQuestions } from "@/lib/anthropic/clarification";
import {
  ACTIVE_STATUSES,
  MAX_IDEA_LENGTH,
  MIN_IDEA_LENGTH,
  startOfMonthISO,
} from "@/lib/analyses";
import { PAID_PLAN } from "@/lib/pricing";

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

  const { data: profile } = await service
    .from("profiles")
    .select("plan, free_credit_used, onboarding_completed_at")
    .eq("id", user.id)
    .single();

  // Gate 2: onboarding must be completed once before any analysis (PRD §5.2) —
  // the verdict's personal-feasibility score reads the profile. The page also
  // redirects, but the action is the enforcement point (the page can be skipped).
  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  // Gate 3: free users get one analysis; paid users get PAID_PLAN.analysesPerMonth
  // per calendar month (fair use, PRD §7). Credit is consumed only on success.
  if (profile.plan === "free" && profile.free_credit_used) {
    return { error: "You've used your free analysis. Upgrade to run more." };
  }
  if (profile.plan === "paid") {
    const { count } = await service
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("consumed_credit", true)
      .gte("created_at", startOfMonthISO());
    if ((count ?? 0) >= PAID_PLAN.analysesPerMonth) {
      return {
        error: `You've reached your ${PAID_PLAN.analysesPerMonth} analyses for this month. Your limit resets at the start of next month.`,
      };
    }
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
