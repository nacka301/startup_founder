"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MIN_IDEA_LENGTH } from "@/lib/analyses";
import { createAnalysis } from "./actions";

export function NewAnalysisForm() {
  const [idea, setIdea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmedLength = idea.trim().length;
  const longEnough = trimmedLength >= MIN_IDEA_LENGTH;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!longEnough || isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await createAnalysis(idea);
      // On success the action redirects and this line is never reached.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="idea" className="text-[15px] font-semibold text-foreground">
          Your idea
        </label>
        <p className="text-[13px] text-muted-foreground">
          Describe the problem you want to solve and who has it. The more specific
          you are, the sharper the verdict — a sentence or two of context beats a
          one-liner.
        </p>
        <Textarea
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={6}
          disabled={isPending}
          placeholder="e.g. A tool that reminds freelancers to chase overdue invoices and drafts the follow-up email for them."
          aria-describedby="idea-hint"
        />
        <p id="idea-hint" className="text-[13px] text-muted-foreground">
          {longEnough
            ? "Looks good."
            : `At least ${MIN_IDEA_LENGTH} characters (${trimmedLength}/${MIN_IDEA_LENGTH}).`}
        </p>
      </div>

      {error && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={!longEnough || isPending}>
          {isPending ? "Thinking through your idea…" : "Generate my questions"}
        </Button>
        <p className="text-[13px] text-muted-foreground">
          We&apos;ll ask you 5 quick questions about your idea before running the
          analysis.
        </p>
      </div>
    </form>
  );
}
