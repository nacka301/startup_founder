import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { FAILURE_COPY, type FailureCode } from "@/lib/failure";

/**
 * Failed-analysis state (ARCHITECTURE.md §5). A sibling of `InsufficientEvidence`
 * by design — same shape, different message — because the two are separate
 * outcomes: insufficient evidence is an honest verdict, this is our error.
 *
 * `code` only selects a sentence from `FAILURE_COPY`. The code itself, the
 * underlying exception, and any stack are never rendered; the real error lives in
 * the server-side job logs.
 */
export function AnalysisFailed({
  ideaText,
  code,
  retryHref,
}: {
  ideaText: string;
  code: FailureCode;
  retryHref: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2.5">
        <span className="inline-flex w-fit items-center rounded-full border border-destructive/30 px-3 py-1 text-sm font-medium text-destructive">
          Failed
        </span>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[30px]">
          We couldn&apos;t finish this analysis
        </h1>
      </header>

      <p className="glass backdrop-blur-[14px] rounded-[14px] px-[18px] py-4 text-sm leading-relaxed text-muted-foreground">
        {ideaText}
      </p>

      <p className="text-[15px] leading-relaxed text-foreground">
        {FAILURE_COPY[code]} We&apos;ve logged the error and are looking into it.
      </p>

      <div className="rounded-[14px] border border-primary/20 bg-primary/5 px-[18px] py-4">
        <p className="text-sm text-foreground">
          <span className="font-medium">Your free analysis hasn&apos;t been used.</span>{" "}
          Start it again — it won&apos;t cost you a credit.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={retryHref} className={buttonVariants()}>
          Try again
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
