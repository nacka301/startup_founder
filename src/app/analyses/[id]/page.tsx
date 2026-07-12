import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { STUCK_AFTER_MS, type AnalysisStatus } from "@/lib/analyses";
import { parseFailureCode } from "@/lib/failure";
import { parseDoneReport } from "@/lib/report";
import { AnalysisFailed } from "@/components/report/analysis-failed";
import { ReportView } from "@/components/report/report-view";
import { PlanSection } from "@/components/report/plan-section";
import { LockedPlan } from "@/components/report/locked-plan";
import { InsufficientEvidence } from "@/components/report/insufficient-evidence";
import { WizardStepper } from "@/components/wizard/stepper";
import { ClarifyForm, type ClarifyQuestion } from "./clarify-form";
import { DiscardButton } from "./discard-button";
import { ShareControls } from "./share-controls";

const WRAPPER =
  "mx-auto flex min-h-screen max-w-[760px] flex-col gap-6 px-6 pt-8 pb-24 sm:gap-8 sm:pt-9 sm:pb-[160px]";
// Wizard steps (clarify, running) share the narrower editorial width used by
// the rest of the wizard (analyses/new); the finished report keeps WRAPPER's
// wider 760px for its glass cards/tabs (README §5).
const WIZARD_WRAPPER =
  "mx-auto flex min-h-screen max-w-[660px] flex-col px-6 pt-8 pb-24 sm:pt-11 sm:pb-[140px]";
const BACK_TO_DASHBOARD =
  "mb-7 inline-flex w-fit items-center gap-1.5 font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // RLS scopes this to the owner. Three distinct outcomes — keep them apart so a
  // failure can never masquerade as "page not found":
  //   - error set            → a DB/RLS/schema problem, NOT proof the row is
  //                            missing or unowned. Show a retryable state, never 404.
  //   - no error, data null  → genuinely missing or not-owned → notFound().
  //   - a row                → render by status below.
  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .select(
      "id, status, idea_text, share_enabled, share_token, failure_code, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (analysisError) {
    // Log the real reason server-side (Vercel logs) for diagnosis; the user only
    // ever sees a friendly, retryable message — never the raw error or a 404.
    console.error(`Failed to load analysis ${id}:`, analysisError.message);
    return (
      <main className={WIZARD_WRAPPER}>
        <Link href="/dashboard" className={BACK_TO_DASHBOARD}>
          ← Back to dashboard
        </Link>
        <div className="flex flex-col items-start gap-4">
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[30px]">
            We couldn&apos;t load this analysis
          </h1>
          <p className="text-muted-foreground">
            Something went wrong on our side. Please refresh in a moment — your
            analysis is safe.
          </p>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!analysis) {
    notFound();
  }

  const status = analysis.status as AnalysisStatus;

  // Step 2 — the clarification questions.
  if (status === "clarifying") {
    const { data: questions } = await supabase
      .from("analysis_questions")
      .select("id, position, question, options, answer")
      .eq("analysis_id", id)
      .order("position");

    const list = (questions ?? []) as ClarifyQuestion[];

    // Fail closed: a 'clarifying' row with no questions means setup didn't
    // finish (e.g. the server action was killed mid-generation). Don't render a
    // dead form — let the user discard it so their one active slot frees up.
    if (list.length === 0) {
      return (
        <main className={WIZARD_WRAPPER}>
          <Link href="/dashboard" className={BACK_TO_DASHBOARD}>
            ← Back to dashboard
          </Link>
          <div className="flex flex-col items-start gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[30px]">
                This one didn&apos;t finish setting up
              </h1>
              <p className="text-muted-foreground">
                We couldn&apos;t prepare the questions for this analysis. Discard
                it and start over — it only takes a moment.
              </p>
            </div>
            <DiscardButton analysisId={id} label="Start over" />
          </div>
        </main>
      );
    }

    return (
      <main className={WIZARD_WRAPPER}>
        <Link href="/dashboard" className={BACK_TO_DASHBOARD}>
          ← Back to dashboard
        </Link>
        <WizardStepper current={2} />
        <header className="mb-6 flex flex-col gap-2.5">
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[30px]">
            A few questions to sharpen it
          </h1>
          <p className="text-[15px] text-muted-foreground">
            Not sure on one? &ldquo;I don&apos;t know&rdquo; is a perfectly good
            answer — we account for it.
          </p>
        </header>
        <ClarifyForm analysisId={id} questions={list} />
        <div className="mt-4">
          <DiscardButton analysisId={id} />
        </div>
      </main>
    );
  }

  // Still working — confirmation / progress (not a broken page). No fake
  // stage-by-stage progress bar here — the pipeline doesn't expose granular
  // stage state (only queued/running), so the copy stays honest about that.
  if (status === "queued" || status === "running") {
    // Escape hatch for a stranded run (enqueued but never picked up, or killed by
    // maxDuration without onFailure). Only surfaces once the run is far past its
    // deadline, so it never tempts a user to cancel a healthy in-flight analysis.
    const stuck =
      Date.now() - new Date(analysis.updated_at as string).getTime() >
      STUCK_AFTER_MS;

    return (
      <main className={WIZARD_WRAPPER}>
        <Link href="/dashboard" className={BACK_TO_DASHBOARD}>
          ← Back to dashboard
        </Link>
        <WizardStepper current={3} />
        <div className="flex flex-col items-start gap-5 pt-3">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-cyan">
            Analyzing
          </span>
          <h1 className="max-w-[480px] text-[24px] font-semibold leading-[1.2] tracking-[-0.03em] sm:text-[30px]">
            Reading what people actually say about this problem.
          </h1>
          <p className="text-[15px] leading-[1.6] text-muted-foreground">
            {status === "queued"
              ? "Thanks — your answers are in. We're researching your idea now, which usually takes 5–10 minutes. We'll email you the moment your verdict is ready — you can safely leave this page."
              : "We're reading through the evidence and scoring your idea. This usually takes 5–10 minutes — we'll email you when it's ready. You can safely leave this page."}
          </p>
          <p className="w-full rounded-[14px] border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">
            {analysis.idea_text}
          </p>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to dashboard
          </Link>
          {stuck && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] text-muted-foreground">
                This is taking much longer than usual. Something may have gone
                wrong on our side — you can discard it and start over.
              </p>
              <DiscardButton
                analysisId={id}
                label="Discard and start over"
              />
            </div>
          )}
        </div>
      </main>
    );
  }

  // Failed — graceful error state, never a crash. `parseFailureCode` validates the
  // column on read, so a NULL/legacy/unrecognized value degrades to the generic
  // message instead of throwing. The user never sees the code or the real error.
  if (status === "failed") {
    return (
      <main className={WRAPPER}>
        <AnalysisFailed
          ideaText={analysis.idea_text}
          code={parseFailureCode(analysis.failure_code)}
          retryHref={`/analyses/new?from=${id}`}
        />
      </main>
    );
  }

  // Insufficient evidence — dedicated variant; credit was not consumed.
  if (status === "insufficient_evidence") {
    const { data: report } = await supabase
      .from("reports")
      .select("insufficient_reason")
      .eq("analysis_id", id)
      .maybeSingle();

    return (
      <main className={WRAPPER}>
        <InsufficientEvidence
          ideaText={analysis.idea_text}
          reason={(report?.insufficient_reason as string | null) ?? null}
        />
        <ShareControls
          analysisId={id}
          shareEnabled={analysis.share_enabled ?? false}
          shareToken={(analysis.share_token as string | null) ?? null}
        />
      </main>
    );
  }

  // status === 'done' — the full report.
  // Plan gate: only SELECT reports.plan for a paid viewer, so the real plan can
  // never reach a free user's HTML. free/paid is read from the caller's own
  // profile (read-only — never written here).
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  const isPaid = profile?.plan === "paid";

  const columns = isPaid
    ? "score, verdict, summary, criteria, solutions, plan"
    : "score, verdict, summary, criteria, solutions";

  const { data: report } = await supabase
    .from("reports")
    .select(columns)
    .eq("analysis_id", id)
    .maybeSingle();

  const { data: evidence } = await supabase
    .from("evidence_items")
    .select(
      "id, source, url, quote, author_handle, severity, topic, similar_count",
    )
    .eq("analysis_id", id);

  const reportRow = report as {
    score: number | null;
    verdict: string | null;
    summary: string | null;
    criteria: unknown;
    solutions: unknown;
    plan?: unknown;
  } | null;

  const parsed = reportRow
    ? parseDoneReport(reportRow, evidence ?? [])
    : null;

  // A 'done' analysis with a missing/malformed report shouldn't crash — show the
  // same graceful message as a failed run.
  if (!parsed) {
    return (
      <main className={WRAPPER}>
        <div className="flex flex-col items-start gap-4">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            We couldn&apos;t load this report
          </h1>
          <p className="text-muted-foreground">
            The report seems incomplete. Please try again in a moment, or start a
            new analysis.
          </p>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const planSlot = isPaid ? (
    parsed.plan ? (
      <PlanSection plan={parsed.plan} />
    ) : (
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Realization plan</h2>
        <p className="text-sm text-muted-foreground">
          Your plan isn&apos;t ready yet — refresh in a moment. If it doesn&apos;t
          appear, start a new analysis or contact support.
        </p>
      </section>
    )
  ) : (
    <LockedPlan />
  );

  return (
    <main className={WRAPPER}>
      <Link href="/dashboard" className={BACK_TO_DASHBOARD}>
        ← Back to dashboard
      </Link>
      <div className="-mt-4 flex flex-col gap-1">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">
          The idea
        </span>
        <p className="text-[13px] leading-[1.6] text-muted-foreground line-clamp-2">
          {analysis.idea_text}
        </p>
      </div>

      <ReportView
        score={parsed.score}
        verdict={parsed.verdict}
        summary={parsed.summary}
        criteria={parsed.criteria}
        solutions={parsed.solutions}
        evidence={parsed.evidence}
        planSlot={planSlot}
      />

      <hr className="border-border" />
      <ShareControls
        analysisId={id}
        shareEnabled={analysis.share_enabled ?? false}
        shareToken={(analysis.share_token as string | null) ?? null}
      />
    </main>
  );
}
