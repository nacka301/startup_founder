import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_META, type AnalysisStatus } from "@/lib/analyses";
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
  "mx-auto flex min-h-screen max-w-[720px] flex-col gap-8 px-6 py-16";

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

  // RLS scopes this to the owner; anyone else (or a bad id) gets null → 404.
  const { data: analysis } = await supabase
    .from("analyses")
    .select("id, status, idea_text, share_enabled, share_token, failure_code")
    .eq("id", id)
    .maybeSingle();

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
        <main className={WRAPPER}>
          <div className="flex flex-col items-start gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
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
      <main className={WRAPPER}>
        <WizardStepper current={2} />
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            A few quick questions
          </h1>
          <p className="text-muted-foreground">
            Your answers sharpen the verdict. Pick the closest option for each —
            there are no wrong answers.
          </p>
        </header>
        <ClarifyForm analysisId={id} questions={list} />
        <DiscardButton analysisId={id} />
      </main>
    );
  }

  // Still working — confirmation / progress (not a broken page).
  if (status === "queued" || status === "running") {
    const meta = STATUS_META[status];
    return (
      <main className={WRAPPER}>
        <WizardStepper current={3} />
        <div className="flex flex-col items-start gap-4">
          <Badge variant={meta.badge}>{meta.label}</Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">We&apos;re on it</h1>
            <p className="text-muted-foreground">
              {status === "queued"
                ? "Thanks — your answers are in. We're researching your idea now, which takes a few minutes. We'll email you the moment your verdict is ready."
                : "We're reading through the evidence and scoring your idea. This takes a few minutes — we'll email you when it's ready."}
            </p>
          </div>
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {analysis.idea_text}
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
          <h1 className="text-3xl font-semibold tracking-tight">
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
        <h2 className="text-xl font-semibold tracking-tight">Realization plan</h2>
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
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] uppercase tracking-wide text-muted-foreground">
            Your verdict
          </span>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {analysis.idea_text}
          </p>
        </div>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Dashboard
        </Link>
      </header>

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
