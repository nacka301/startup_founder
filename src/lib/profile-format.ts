/**
 * Format a user's onboarding profile into a human-readable block for the Stage C
 * (verdict) and Stage D (plan) prompts. Maps raw stored values to their display
 * labels via the onboarding option lists (imported read-only), and treats missing
 * or "prefer not to say" values as "not provided" so the model scores personal
 * feasibility with the right amount of uncertainty.
 *
 * Pure module (no server/client imports) so the versioned prompt files stay pure.
 */

import {
  OCCUPATION_OPTIONS,
  SKILL_OPTIONS,
  WEEKLY_HOURS_OPTIONS,
  BUDGET_RANGE_OPTIONS,
  WORK_PREFERENCE_OPTIONS,
  PREFER_NOT_TO_SAY,
} from "./onboarding";

/** Raw onboarding columns as read from `profiles` (any may be null/unset). */
export type ProfileInput = {
  occupation: string | null;
  skills: string[] | null;
  weekly_hours: string | null;
  budget_range: string | null;
  work_preference: string | null;
};

type Option = { value: string; label: string };

/** Label for a single-select value, or null if unset / prefer-not-to-say. */
function labelOf(options: Option[], value: string | null | undefined): string | null {
  if (!value || value === PREFER_NOT_TO_SAY) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

const NOT_PROVIDED = "not provided";

export function formatProfileForPrompt(profile: ProfileInput): string {
  const skills = (profile.skills ?? [])
    .map((s) => labelOf(SKILL_OPTIONS, s))
    .filter((x): x is string => x !== null);

  return [
    `- Occupation: ${labelOf(OCCUPATION_OPTIONS, profile.occupation) ?? NOT_PROVIDED}`,
    `- Skills: ${skills.length > 0 ? skills.join(", ") : NOT_PROVIDED}`,
    `- Weekly time available: ${labelOf(WEEKLY_HOURS_OPTIONS, profile.weekly_hours) ?? NOT_PROVIDED}`,
    `- Budget available: ${labelOf(BUDGET_RANGE_OPTIONS, profile.budget_range) ?? NOT_PROVIDED}`,
    `- Enjoys most: ${labelOf(WORK_PREFERENCE_OPTIONS, profile.work_preference) ?? NOT_PROVIDED}`,
  ].join("\n");
}
