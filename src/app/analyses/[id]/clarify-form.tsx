"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RadioCardGroup } from "@/components/ui/radio-card";
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      {questions.map((q) => {
        const labelId = `q-${q.id}`;
        return (
          <section key={q.id} className="flex flex-col gap-3">
            <h2 id={labelId} className="text-[15px] font-semibold text-foreground">
              <span className="text-muted-foreground">{q.position}.</span>{" "}
              {q.question}
            </h2>
            <RadioCardGroup
              name={q.id}
              aria-labelledby={labelId}
              options={q.options.map((o) => ({ value: o, label: o }))}
              value={answers[q.id] ?? null}
              onChange={(value) => setAnswer(q.id, value)}
            />
          </section>
        );
      })}

      {error && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={!allAnswered || isPending}>
          {isPending ? "Submitting…" : "Submit answers"}
        </Button>
        <p className="text-[13px] text-muted-foreground">
          Not sure on one? &ldquo;I don&apos;t know&rdquo; is a perfectly good
          answer — we account for it.
        </p>
      </div>
    </form>
  );
}
