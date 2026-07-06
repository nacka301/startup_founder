"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelAnalysis } from "./actions";

/**
 * Discards an in-progress ('clarifying') analysis and starts over. Used both on
 * the normal clarify view (so a user isn't trapped answering an idea they've
 * abandoned) and on the recovery card when question setup didn't finish.
 */
export function DiscardButton({
  analysisId,
  label = "Discard and start over",
}: {
  analysisId: string;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelAnalysis(analysisId);
      // On success the action redirects and this line is never reached.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "Discarding…" : label}
      </Button>
      {error && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
