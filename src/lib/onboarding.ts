/**
 * Onboarding profile: option lists, types, and validation allow-lists.
 *
 * Pure module (no server/client imports) shared by the onboarding form and the
 * server action, so the UI options and server-side validation can never drift.
 *
 * Values for weekly_hours / budget_range / work_preference match DB-SCHEMA.md
 * exactly. `prefer_not_to_say` is stored as that literal string (skills uses an
 * empty array) so later feasibility scoring can treat it as "unknown".
 */

export const PREFER_NOT_TO_SAY = "prefer_not_to_say" as const;

type Option = { value: string; label: string; description?: string };

// Occupation — schema column is free text; these are our card categories.
export const OCCUPATION_OPTIONS: Option[] = [
  { value: "employed", label: "Employed", description: "Working a job" },
  { value: "freelancer", label: "Freelancer", description: "Self-employed / contracting" },
  { value: "founder", label: "Running a business", description: "Founder or business owner" },
  { value: "student", label: "Student" },
  { value: "between", label: "Between things", description: "Exploring what's next" },
  { value: PREFER_NOT_TO_SAY, label: "Prefer not to say" },
];

// Skills — multi-select. "Prefer not to say" is a separate chip stored as [].
export const SKILL_OPTIONS: Option[] = [
  { value: "coding", label: "Coding / Engineering" },
  { value: "design", label: "Design" },
  { value: "marketing", label: "Marketing" },
  { value: "sales", label: "Sales" },
  { value: "writing", label: "Writing / Content" },
  { value: "product", label: "Product / Strategy" },
  { value: "operations", label: "Operations / Finance" },
  { value: "data", label: "Data / AI" },
];

export const WEEKLY_HOURS_OPTIONS: Option[] = [
  { value: "<5", label: "Less than 5h / week" },
  { value: "5-15", label: "5–15h / week" },
  { value: "15-30", label: "15–30h / week" },
  { value: "30+", label: "30h+ / week" },
  { value: PREFER_NOT_TO_SAY, label: "Prefer not to say" },
];

export const BUDGET_RANGE_OPTIONS: Option[] = [
  { value: "<500", label: "Under €500" },
  { value: "500-5k", label: "€500 – €5k" },
  { value: "5k-20k", label: "€5k – €20k" },
  { value: "20k+", label: "€20k+" },
  { value: PREFER_NOT_TO_SAY, label: "Prefer not to say" },
];

export const WORK_PREFERENCE_OPTIONS: Option[] = [
  { value: "people", label: "Working with people", description: "Communicating, selling, connecting" },
  { value: "building", label: "Building things", description: "Coding, engineering, making" },
  { value: "creative", label: "Creative work", description: "Design, writing, ideas" },
  { value: "mixed", label: "A mix of everything" },
  { value: PREFER_NOT_TO_SAY, label: "Prefer not to say" },
];

// Allow-lists for server-side validation (single-select fields).
export const OCCUPATION_VALUES = OCCUPATION_OPTIONS.map((o) => o.value);
export const SKILL_VALUES = SKILL_OPTIONS.map((o) => o.value);
export const WEEKLY_HOURS_VALUES = WEEKLY_HOURS_OPTIONS.map((o) => o.value);
export const BUDGET_RANGE_VALUES = BUDGET_RANGE_OPTIONS.map((o) => o.value);
export const WORK_PREFERENCE_VALUES = WORK_PREFERENCE_OPTIONS.map((o) => o.value);

export type OnboardingInput = {
  occupation: string;
  skills: string[];
  weekly_hours: string;
  budget_range: string;
  work_preference: string;
};
