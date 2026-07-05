"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  BUDGET_RANGE_VALUES,
  OCCUPATION_VALUES,
  SKILL_VALUES,
  WEEKLY_HOURS_VALUES,
  WORK_PREFERENCE_VALUES,
  type OnboardingInput,
} from "@/lib/onboarding";

type SaveResult = { error: string };

/**
 * Persist the one-time onboarding answers and mark onboarding complete, then
 * redirect to the dashboard. Every field is re-validated against the shared
 * allow-lists — the client UI restricts choices, but the server must not trust
 * that. On success this redirects (never returns); it only returns on failure.
 */
export async function saveOnboarding(
  input: OnboardingInput,
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session expired. Please sign in again." };
  }

  // Validate each field against its allow-list. Skills is a subset of the
  // known skill values (empty = "prefer not to say").
  const valid =
    OCCUPATION_VALUES.includes(input.occupation) &&
    WEEKLY_HOURS_VALUES.includes(input.weekly_hours) &&
    BUDGET_RANGE_VALUES.includes(input.budget_range) &&
    WORK_PREFERENCE_VALUES.includes(input.work_preference) &&
    Array.isArray(input.skills) &&
    input.skills.every((s) => SKILL_VALUES.includes(s));

  if (!valid) {
    return { error: "Some answers weren't recognised. Please try again." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      occupation: input.occupation,
      skills: input.skills,
      weekly_hours: input.weekly_hours,
      budget_range: input.budget_range,
      work_preference: input.work_preference,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Couldn't save your profile. Please try again." };
  }

  redirect("/dashboard");
}
