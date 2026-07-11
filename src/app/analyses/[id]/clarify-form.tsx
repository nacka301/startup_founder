"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { submitAnswers } from "./actions";

export type ClarifyQuestion = {
  id: string;
  position: number;
  question: string;
  options: string[];
  answer: string | null;
};

export function ClarifyForm({
  analysisId,
  questions,
}: {
  analysisId: string;
  questions: ClarifyQuestion[];
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      questions
        .filter((q) => q.answer)
        .map((q) => [q.id, q.answer as string]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allAnswered = questions.every((q) => Boolean(answers[q.id]));

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAnswered || isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await submitAnswers(
        analysisId,
        questions.map((q) => ({ id: q.id, answer: answers[q.id] })),
      );
      // On success the action redirects and this line is never reached.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[30px]">
      {questions.map((q, idx) => {
        const labelId = `q-${q.id}`;
        const selected = answers[q.id] ?? null;
        return (
          <Reveal key={q.id} as="section" index={idx} className="flex flex-col gap-3.5">
            <h2 id={labelId} className="text-[15px] font-semibold text-foreground">
              <span className="font-mono text-[#818CF8]">
                {String(q.position).padStart(2, "0")}
              </span>{" "}
              {q.question}
            </h2>
            <div
              role="radiogroup"
              aria-labelledby={labelId}
              className="flex flex-col gap-[9px]"
            >
              {q.options.map((option) => {
                const isSelected = selected === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    name={q.id}
                    onClick={() => setAnswer(q.id, option)}
                    className={cn(
                      "card-hover flex items-center gap-3 rounded-[12px] border px-4 py-[13px] text-left text-sm text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-card",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0 rounded-full",
                        isSelected
                          ? "border-[5px] border-primary bg-background"
                          : "border-2 border-white/[0.22]",
                      )}
                    />
                    {option}
                  </button>
                );
              })}
            </div>
          </Reveal>
        );
      })}

      {error && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={!allAnswered || isPending}
        className="h-[52px] w-full rounded-[12px] text-[15px]"
      >
        {isPending ? "Submitting…" : "Run the analysis"}
      </Button>
    </form>
  );
}
