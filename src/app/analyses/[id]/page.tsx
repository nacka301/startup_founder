import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_META, type AnalysisStatus } from "@/lib/analyses";
import { ClarifyForm, type ClarifyQuestion } from "./clarify-form";

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
    .select("id, status, idea_text")
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

    return (
      <main className={WRAPPER}>
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            A few quick questions
          </h1>
          <p className="text-muted-foreground">
            Your answers sharpen the verdict. Pick the closest option for each —
            there are no wrong answers.
          </p>
        </header>
        <ClarifyForm
          analysisId={id}
          questions={(questions ?? []) as ClarifyQuestion[]}
        />
      </main>
    );
  }

  // Step 3 — confirmation (queued) and any later status.
  const meta = STATUS_META[status];
  return (
    <main className={WRAPPER}>
      <div className="flex flex-col items-start gap-4">
        <Badge variant={meta.badge}>{meta.label}</Badge>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {status === "queued" ? "We're on it" : "Your analysis"}
          </h1>
          <p className="text-muted-foreground">
            {status === "queued"
              ? "Thanks — your answers are in. We're researching your idea now, which takes a few minutes. We'll email you the moment your verdict is ready."
              : "Here's the latest on this analysis."}
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
