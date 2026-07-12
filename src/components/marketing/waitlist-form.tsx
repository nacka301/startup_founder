"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinWaitlist } from "@/app/actions";

type Status =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    setStatus({ kind: "idle" });

    startTransition(async () => {
      let result;
      try {
        result = await joinWaitlist(email);
      } catch {
        setStatus({
          kind: "error",
          message: "Something went wrong. Please try again.",
        });
        return;
      }

      if ("error" in result) {
        setStatus({ kind: "error", message: result.error });
        return;
      }
      setEmail("");
      setStatus({
        kind: "success",
        message: result.already
          ? "You're already on the list."
          : "You're on the list — we'll be in touch.",
      });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          required
          placeholder="you@example.com"
          aria-label="Email address"
          className="h-10 sm:flex-1"
        />
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Joining…" : "Join the waitlist"}
        </Button>
      </div>

      {status.kind !== "idle" && (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            status.kind === "error"
              ? "text-sm text-destructive"
              : "text-sm text-primary"
          }
        >
          {status.message}
        </p>
      )}
    </form>
  );
}
