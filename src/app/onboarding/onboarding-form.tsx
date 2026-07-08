"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RadioCardGroup } from "@/components/ui/radio-card";
import { Reveal } from "@/components/motion/reveal";
import {
  BUDGET_RANGE_OPTIONS,
  OCCUPATION_OPTIONS,
  SKILL_OPTIONS,
  WEEKLY_HOURS_OPTIONS,
  WORK_PREFERENCE_OPTIONS,
} from "@/lib/onboarding";
import { saveOnboarding } from "./actions";

function Question({
  id,
  index,
  title,
  hint,
  children,
}: {
  id: string;
  index: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal as="section" index={index} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="text-[15px] font-semibold text-foreground">
          {title}
        </h2>
        {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </Reveal>
  );
}

export function OnboardingForm() {
  const [occupation, setOccupation] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillsPreferNot, setSkillsPreferNot] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState<string | null>(null);
  const [budgetRange, setBudgetRange] = useState<string | null>(null);
  const [workPreference, setWorkPreference] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleSkill(value: string) {
    setSkillsPreferNot(false);
    setSkills((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value],
    );
  }

  const skillsAnswered = skillsPreferNot || skills.length > 0;
  const complete =
    !!occupation &&
    skillsAnswered &&
    !!weeklyHours &&
    !!budgetRange &&
    !!workPreference;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete || isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await saveOnboarding({
        occupation: occupation!,
        skills: skillsPreferNot ? [] : skills,
        weekly_hours: weeklyHours!,
        budget_range: budgetRange!,
        work_preference: workPreference!,
      });
      // On success the action redirects and this line is never reached.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      <Question
        id="q-occupation"
        index={0}
        title="What do you do?"
        hint="Helps us judge how an idea fits your situation."
      >
        <RadioCardGroup
          name="occupation"
          aria-labelledby="q-occupation"
          options={OCCUPATION_OPTIONS}
          value={occupation}
          onChange={setOccupation}
        />
      </Question>

      <Question
        id="q-skills"
        index={1}
        title="What are you good at?"
        hint="Pick any that apply."
      >
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="q-skills">
          {SKILL_OPTIONS.map((option) => {
            const selected = !skillsPreferNot && skills.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleSkill(option.value)}
                className={cn(
                  "flex min-h-11 items-center rounded-full border px-3.5 text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                    : "border-border bg-card text-foreground hover:bg-muted/50",
                )}
              >
                {option.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={skillsPreferNot}
            onClick={() => {
              setSkillsPreferNot((v) => !v);
              setSkills([]);
            }}
            className={cn(
              "flex min-h-11 items-center rounded-full border px-3.5 text-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              skillsPreferNot
                ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50",
            )}
          >
            Prefer not to say
          </button>
        </div>
      </Question>

      <Question
        id="q-weekly-hours"
        index={2}
        title="How much time can you put in each week?"
      >
        <RadioCardGroup
          name="weekly_hours"
          aria-labelledby="q-weekly-hours"
          options={WEEKLY_HOURS_OPTIONS}
          value={weeklyHours}
          onChange={setWeeklyHours}
        />
      </Question>

      <Question
        id="q-budget"
        index={3}
        title="What could you invest to get started?"
        hint="Rough range — money you could put toward building this."
      >
        <RadioCardGroup
          name="budget_range"
          aria-labelledby="q-budget"
          options={BUDGET_RANGE_OPTIONS}
          value={budgetRange}
          onChange={setBudgetRange}
        />
      </Question>

      <Question
        id="q-work-preference"
        index={4}
        title="What kind of work do you enjoy most?"
      >
        <RadioCardGroup
          name="work_preference"
          aria-labelledby="q-work-preference"
          options={WORK_PREFERENCE_OPTIONS}
          value={workPreference}
          onChange={setWorkPreference}
        />
      </Question>

      {error && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={!complete || isPending}>
          {isPending ? "Saving…" : "Continue to dashboard"}
        </Button>
        <p className="text-[13px] text-muted-foreground">
          You only fill this out once. Every question is optional — choose
          &ldquo;prefer not to say&rdquo; for anything you&apos;d rather skip.
        </p>
      </div>
    </form>
  );
}
