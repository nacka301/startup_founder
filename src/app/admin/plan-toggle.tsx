"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setUserPlan, type PlanResult } from "./actions";

/**
 * Confirm-before-flip control for a user's plan (free ↔ paid). Modeled on the
 * share-confirm dialog. Shows the current value clearly, then calls the
 * admin-only server action; the action revalidates /admin so the row updates.
 */
export function PlanToggle({
  userId,
  email,
  currentPlan,
}: {
  userId: string;
  email: string;
  currentPlan: "free" | "paid";
}) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const nextPlan = currentPlan === "paid" ? "free" : "paid";

  function apply() {
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result: PlanResult = await setUserPlan(userId, nextPlan);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            Set {nextPlan}
          </Button>
        }
      />
      <DialogContent>
        <DialogTitle>Change plan</DialogTitle>
        <DialogDescription>
          <span className="font-medium text-foreground">{email}</span> is
          currently{" "}
          <span className="font-medium uppercase text-foreground">
            {currentPlan}
          </span>
          . Change to{" "}
          <span className="font-medium uppercase text-foreground">
            {nextPlan}
          </span>
          ?
        </DialogDescription>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={apply} disabled={isPending}>
            {isPending ? "Working…" : `Set ${nextPlan}`}
          </Button>
          <DialogClose
            render={
              <Button type="button" variant="outline">
                Cancel
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
