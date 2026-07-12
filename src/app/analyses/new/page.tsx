import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { ACTIVE_STATUSES } from "@/lib/analyses";
import { WizardStepper } from "@/components/wizard/stepper";
import { NewAnalysisForm } from "./new-analysis-form";

const WRAPPER =
  "mx-auto flex min-h-screen max-w-[660px] flex-col px-6 pt-8 pb-24 sm:pt-11 sm:pb-[140px]";
const BACK_LINK =
  "mb-7 inline-flex w-fit items-center gap-1.5 font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground";

function Blocked({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[30px]">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </div>
      <Link href={href} className={buttonVariants({ variant: "outline" })}>
        {cta}
      </Link>
    </div>
  );
}

export default async function NewAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware guards /analyses too; a Server Component must never assume auth.
  if (!user) {
    redirect("/login");
  }

  // Gate 1: one active analysis at a time — send the user to the one in progress.
  const { data: active } = await supabase
    .from("analyses")
    .select("id")
    .eq("user_id", user.id)
    .in("status", [...ACTIVE_STATUSES])
    .limit(1)
    .maybeSingle();

  if (active) {
    return (
      <main className={WRAPPER}>
        <Link href="/dashboard" className={BACK_LINK}>
          ← Back to dashboard
        </Link>
        <Blocked
          title="You've already got one on the go"
          body="You can run one analysis at a time. Pick up where you left off, then start a new one."
          href={`/analyses/${active.id}`}
          cta="Go to your analysis"
        />
      </main>
    );
  }

  // Gate 2: free users get one analysis.
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, free_credit_used")
    .eq("id", user.id)
    .single();

  if (profile?.plan === "free" && profile.free_credit_used) {
    return (
      <main className={WRAPPER}>
        <Link href="/dashboard" className={BACK_LINK}>
          ← Back to dashboard
        </Link>
        <Blocked
          title="You've used your free analysis"
          body="Your free verdict has been used. Upgrading unlocks more analyses and the full realization plan."
          href="/dashboard"
          cta="Back to dashboard"
        />
      </main>
    );
  }

  // Retry affordance: `?from=<id>` prefills the idea from a failed analysis so the
  // user doesn't retype it. Read through the user's RLS-scoped client and scoped to
  // their own failed rows, so `from` can never surface someone else's idea; passing
  // the id (not the text) keeps the idea out of browser history and referrers. Any
  // miss — bad id, wrong owner, wrong status — silently falls back to a blank form.
  let defaultIdea = "";
  if (from) {
    const { data: previous } = await supabase
      .from("analyses")
      .select("idea_text")
      .eq("id", from)
      .eq("user_id", user.id)
      .eq("status", "failed")
      .maybeSingle();
    defaultIdea = (previous?.idea_text as string | null) ?? "";
  }

  return (
    <main className={WRAPPER}>
      <Link href="/dashboard" className={BACK_LINK}>
        ← Back to dashboard
      </Link>
      <WizardStepper current={1} />
      <header className="mb-6 flex flex-col gap-2.5">
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[30px]">
          What&apos;s your idea?
        </h1>
        <p className="text-[15px] leading-[1.6] text-muted-foreground">
          {defaultIdea
            ? "We've brought your idea across from the analysis that failed. Edit it if you like, then run it again."
            : "Describe the problem you want to solve and who has it. The more specific you are, the sharper the verdict — a sentence or two beats a one-liner."}
        </p>
      </header>
      <NewAnalysisForm defaultIdea={defaultIdea} />
    </main>
  );
}
