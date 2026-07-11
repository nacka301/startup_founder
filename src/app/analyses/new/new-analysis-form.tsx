"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MIN_IDEA_LENGTH } from "@/lib/analyses";
import { createAnalysis } from "./actions";

export function NewAnalysisForm({ defaultIdea = "" }: { defaultIdea?: string }) {
  const [idea, setIdea] = useState(defaultIdea);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <Textarea
        id="idea"
        aria-label="Your idea"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={6}
        disabled={isPending}
        placeholder="e.g. A tool that reminds freelancers to chase overdue invoices and drafts the follow-up email for them."
        aria-describedby="idea-hint"
        className="rounded-[14px] border-input bg-card p-4 text-[15px] leading-[1.6] md:text-[15px]"
      />
      <p
        id="idea-hint"
        className={`mt-2.5 font-mono text-xs font-medium ${
          longEnough ? "text-[#22C55E]" : "text-muted-foreground"
        }`}
      >
        {longEnough
          ? "Looks good — specific enough to work with."
          : `At least ${MIN_IDEA_LENGTH} characters (${trimmedLength}/${MIN_IDEA_LENGTH}).`}
      </p>

      {error && (
        <p role="alert" aria-live="polite" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="gradient"
        disabled={!longEnough || isPending}
        className="mt-4 h-[52px] w-full rounded-[12px] text-[15px]"
      >
        {isPending ? "Thinking through your idea…" : "Generate my 5 questions →"}
      </Button>
      <p className="mt-3 text-center text-[13px] text-muted-foreground">
        Our AI reads your idea and asks 5 targeted questions before running the
        analysis.
      </p>
    </form>
  );
}
