import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import {
  STATUS_META,
  formatRelativeTime,
  type AnalysisStatus,
} from "@/lib/analyses";
import { VERDICT_DISPLAY } from "@/lib/report-schema";

const IN_FLIGHT_STATUSES = new Set<AnalysisStatus>(["queued", "running"]);

// Status-chip palette. Terminal states read distinctly: done = green,
// failed = red (destructive), insufficient_evidence = neutral. The in-progress
// states share the primary purple. (The verdict green/amber/red palette stays
// reserved for the report itself — this is only the neutral status chip.)
const CHIP_CLASS: Record<AnalysisStatus, string> = {
  done: "bg-[rgba(34,197,94,0.10)] text-[#22C55E]",
  failed: "bg-[rgba(239,68,68,0.12)] text-[#F87171]",
  insufficient_evidence: "bg-white/[0.06] text-[#9CA3AF]",
  clarifying: "bg-[rgba(139,92,246,0.14)] text-[#C4B5FD]",
  queued: "bg-[rgba(139,92,246,0.14)] text-[#C4B5FD]",
  running: "bg-[rgba(139,92,246,0.14)] text-[#C4B5FD]",
};

function isRealVerdict(v: unknown): v is "go" | "caution" | "stop" {
  return v === "go" || v === "caution" || v === "stop";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense-in-depth: middleware already guards /dashboard, but a Server
  // Component must never assume a session.
  if (!user) {
    redirect("/login");
  }

  // First login lands here (via /auth/callback); if onboarding isn't done yet,
  // send the user to fill out their profile before seeing the dashboard.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, plan, free_credit_used")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  const { data: analyses } = await supabase
    .from("analyses")
    .select("id, idea_text, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const list = analyses ?? [];

  // Row score/verdict: a second, targeted query (matching this codebase's
  // existing pattern of separate queries over embedded selects — see
  // analyses/[id]/page.tsx) rather than SELECT *, scoped to only the 'done'
  // rows that actually have a report.
  const doneIds = list.filter((a) => a.status === "done").map((a) => a.id);
  const { data: reports } = doneIds.length
    ? await supabase
        .from("reports")
        .select("analysis_id, score, verdict")
        .in("analysis_id", doneIds)
    : { data: [] as { analysis_id: string; score: number | null; verdict: string | null }[] };

  const reportByAnalysis = new Map(
    (reports ?? []).map((r) => [r.analysis_id as string, r]),
  );

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1000px] flex-col px-6 pt-12 pb-[140px]">
      <div className="mb-[34px] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[30px] font-semibold tracking-[-0.025em]">
            Your analyses
          </h1>
          <p className="text-sm text-muted-foreground">
            {list.length} {list.length === 1 ? "idea" : "ideas"} run
            {profile.plan === "free" && (
              <>
                {" · "}
                <span className="text-[#818CF8]">
                  {profile.free_credit_used ? 1 : 0} credit used
                </span>{" "}
                of your free analysis
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={signOut}>
            <Button variant="outline" type="submit">
              Log out
            </Button>
          </form>
          <Link href="/analyses/new" className={buttonVariants({ className: "gap-2" })}>
            <span aria-hidden className="text-[17px] leading-none">
              +
            </span>
            New analysis
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-[16px] border border-border bg-card px-6 py-12 text-center">
          <p className="text-muted-foreground">
            No analyses yet. Start with your first idea — you&apos;ll get an
            evidence-backed verdict.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((analysis, i) => {
            const status = analysis.status as AnalysisStatus;
            const meta = STATUS_META[status];
            const report = reportByAnalysis.get(analysis.id);
            const verdict = isRealVerdict(report?.verdict) ? report.verdict : null;
            const score = verdict && report?.score != null ? report.score : null;
            const running = IN_FLIGHT_STATUSES.has(status);

            return (
              <Reveal key={analysis.id} as="li" index={i}>
                <Link
                  href={`/analyses/${analysis.id}`}
                  className="card-hover flex items-center gap-5 rounded-[14px] border border-border bg-card px-5 py-[18px]"
                >
                  <div className="flex w-[52px] shrink-0 flex-col items-center text-center">
                    {score !== null && verdict ? (
                      <>
                        <span
                          className="font-mono text-[26px] font-bold leading-none"
                          style={{ color: VERDICT_DISPLAY[verdict].color }}
                        >
                          {score}
                        </span>
                        <span
                          className="mt-[3px] font-mono text-[9px] font-semibold tracking-[0.14em]"
                          style={{ color: VERDICT_DISPLAY[verdict].color }}
                        >
                          {VERDICT_DISPLAY[verdict].label}
                        </span>
                      </>
                    ) : running ? (
                      <span
                        aria-hidden
                        className="size-[22px] animate-spin rounded-full border-[2.5px] border-white/10 border-t-[#8B5CF6]"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 line-clamp-2 text-[15px] leading-[1.45] text-foreground">
                      {analysis.idea_text}
                    </p>
                    <span className="font-mono text-xs font-medium text-[#6B7280]">
                      {formatRelativeTime(analysis.created_at)}
                    </span>
                  </div>
                  {meta && (
                    <span
                      className={`shrink-0 rounded-full px-[11px] py-[5px] text-xs font-medium ${CHIP_CLASS[status]}`}
                    >
                      {meta.label}
                    </span>
                  )}
                </Link>
              </Reveal>
            );
          })}
        </ul>
      )}
    </main>
  );
}
