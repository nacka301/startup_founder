import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Insufficient-evidence report variant (PRD §6 "Insufficient evidence rule").
 * Honest explanation of why there wasn't enough signal, an explicit note that the
 * free analysis was NOT consumed, and a path to try again. `reason` is the
 * deterministic message written by the job (`reports.insufficient_reason`).
 *
 * `showActions` (default true) gates the owner-only bits — the "your free
 * analysis wasn't used" note and the app navigation buttons — so the public share
 * route can reuse the exact same badge/heading/idea/reason without offering an
 * anonymous viewer credit copy or links into the owner's app.
 */
export function InsufficientEvidence({
  ideaText,
  reason,
  showActions = true,
}: {
  ideaText: string;
  reason: string | null;
  showActions?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2.5">
        <span className="inline-flex w-fit items-center rounded-full border border-border px-3 py-1 text-sm font-medium text-muted-foreground">
          Not enough evidence
        </span>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[30px]">
          We couldn&apos;t reach a verdict yet
        </h1>
      </header>

      <p className="glass backdrop-blur-[14px] rounded-[14px] px-[18px] py-4 text-sm leading-relaxed text-muted-foreground">
        {ideaText}
      </p>

      {reason && (
        <p className="text-[15px] leading-relaxed text-foreground">{reason}</p>
      )}

      {showActions && (
        <>
          <div className="rounded-[14px] border border-primary/20 bg-primary/5 px-[18px] py-4">
            <p className="text-sm text-foreground">
              <span className="font-medium">Your free analysis hasn&apos;t been used.</span>{" "}
              Sharpen the idea and run it again — it won&apos;t cost you a credit.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/analyses/new" className={buttonVariants()}>
              Try again
            </Link>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Back to dashboard
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
