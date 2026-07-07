import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { buttonVariants } from "@/components/ui/button";
import { parseDoneReport } from "@/lib/report";
import { ReportView } from "@/components/report/report-view";

/**
 * Public, read-only share view (ARCHITECTURE.md §4). Opt-in only: rendered solely
 * when an analysis has a matching `share_token` AND `share_enabled = true`. RLS
 * blocks anon reads, so this reads via the service-role client — deliberately
 * scoped to the share token and NEVER selecting `reports.plan`, so the paid
 * realization plan is fully absent from the payload (not blurred — gone).
 */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const service = createServiceClient();

  const { data: analysis } = await service
    .from("analyses")
    .select("id, status, idea_text")
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();

  if (
    !analysis ||
    (analysis.status !== "done" &&
      analysis.status !== "insufficient_evidence")
  ) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <Banner />
      <main className="mx-auto flex max-w-[720px] flex-col gap-8 px-6 py-12">
        {analysis.status === "done" ? (
          <SharedDone analysisId={analysis.id} ideaText={analysis.idea_text} />
        ) : (
          <SharedInsufficient
            analysisId={analysis.id}
            ideaText={analysis.idea_text}
          />
        )}
        <BottomCta />
      </main>
    </div>
  );
}

function Banner() {
  return (
    <div className="border-b border-border bg-muted/40">
      <div className="mx-auto flex max-w-[720px] items-center justify-between gap-4 px-6 py-3">
        <span className="text-sm font-semibold tracking-tight">BuildWorthy</span>
        <Link
          href="/"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Get a verdict on your idea
        </Link>
      </div>
    </div>
  );
}

function BottomCta() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/40 px-6 py-8 text-center">
      <p className="text-[15px] font-medium text-foreground">
        Have a business idea of your own?
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Get an honest, evidence-backed verdict — a 1–100 score and real quotes from
        people discussing the problem online.
      </p>
      <Link href="/" className={buttonVariants()}>
        Get your verdict
      </Link>
    </div>
  );
}

async function SharedDone({
  analysisId,
  ideaText,
}: {
  analysisId: string;
  ideaText: string;
}) {
  const service = createServiceClient();

  // NOTE: `plan` is intentionally NOT selected — the shared view must never carry
  // the paid realization plan into its HTML.
  const { data: report } = await service
    .from("reports")
    .select("score, verdict, summary, criteria, solutions")
    .eq("analysis_id", analysisId)
    .maybeSingle();

  const { data: evidence } = await service
    .from("evidence_items")
    .select(
      "id, source, url, quote, author_handle, severity, topic, similar_count",
    )
    .eq("analysis_id", analysisId);

  const parsed = report
    ? parseDoneReport(
        report as {
          score: number | null;
          verdict: string | null;
          summary: string | null;
          criteria: unknown;
          solutions: unknown;
        },
        evidence ?? [],
      )
    : null;

  if (!parsed) {
    notFound();
  }

  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="text-[13px] uppercase tracking-wide text-muted-foreground">
          Verdict for
        </span>
        <p className="text-sm text-muted-foreground">{ideaText}</p>
      </header>
      <ReportView
        score={parsed.score}
        verdict={parsed.verdict}
        summary={parsed.summary}
        criteria={parsed.criteria}
        solutions={parsed.solutions}
        evidence={parsed.evidence}
      />
    </>
  );
}

async function SharedInsufficient({
  analysisId,
  ideaText,
}: {
  analysisId: string;
  ideaText: string;
}) {
  const service = createServiceClient();
  const { data: report } = await service
    .from("reports")
    .select("insufficient_reason")
    .eq("analysis_id", analysisId)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <span className="inline-flex w-fit items-center rounded-full border border-border px-3 py-1 text-sm font-medium text-muted-foreground">
        Not enough evidence
      </span>
      <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {ideaText}
      </p>
      {report?.insufficient_reason && (
        <p className="text-[15px] leading-relaxed text-foreground">
          {report.insufficient_reason as string}
        </p>
      )}
    </div>
  );
}
