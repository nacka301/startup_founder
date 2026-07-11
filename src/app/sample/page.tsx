import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ReportView } from "@/components/report/report-view";
import { PlanSection } from "@/components/report/plan-section";
import { LockedPlan } from "@/components/report/locked-plan";
import {
  SAMPLE_CRITERIA,
  SAMPLE_EVIDENCE,
  SAMPLE_IDEA,
  SAMPLE_PLAN,
  SAMPLE_SCORE,
  SAMPLE_SOLUTIONS,
  SAMPLE_SUMMARY,
  SAMPLE_VERDICT,
} from "@/lib/sample-report";

export const metadata: Metadata = {
  title: "Sample report — BuildWorthy",
  description:
    "An example BuildWorthy verdict: score, criteria, real evidence, MVP sketch, and realization plan.",
};

const WRAPPER =
  "mx-auto flex min-h-screen max-w-[720px] flex-col gap-8 px-6 py-16";

/**
 * Public, static sample report — the destination for the landing's "See a
 * sample report" (free view) and "Preview the full report" (`?plan=paid`) CTAs.
 * Renders the shared ReportView with illustrative data from sample-report.ts;
 * the `?plan=paid` variant unlocks PlanSection, otherwise LockedPlan shows the
 * upsell. No auth, no DB.
 */
export default async function SamplePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const isPaid = plan === "paid";

  return (
    <main className={WRAPPER}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[13px] uppercase tracking-wide text-muted-foreground">
            Sample verdict{isPaid ? " · full report" : ""}
          </span>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {SAMPLE_IDEA}
          </p>
        </div>
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
      </header>

      <ReportView
        score={SAMPLE_SCORE}
        verdict={SAMPLE_VERDICT}
        summary={SAMPLE_SUMMARY}
        criteria={SAMPLE_CRITERIA}
        solutions={SAMPLE_SOLUTIONS}
        evidence={SAMPLE_EVIDENCE}
        planSlot={isPaid ? <PlanSection plan={SAMPLE_PLAN} /> : <LockedPlan />}
      />

      <hr className="border-border" />
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          This is an example. Run your own idea to get a verdict grounded in live
          evidence.
        </p>
        <Link
          href="/analyses/new"
          className={buttonVariants({
            variant: "cta",
            className: "h-11 gap-2 rounded-[10px] px-6 text-[15px]",
          })}
        >
          Analyze your idea
        </Link>
      </div>
    </main>
  );
}
