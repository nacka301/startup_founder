import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { ACTIVE_STATUSES } from "@/lib/analyses";
import { NewAnalysisForm } from "./new-analysis-form";

const WRAPPER =
  "mx-auto flex min-h-screen max-w-[720px] flex-col gap-8 px-6 py-16";

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
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
      </div>
      <Link href={href} className={buttonVariants({ variant: "outline" })}>
        {cta}
      </Link>
    </div>
  );
}

export default async function NewAnalysisPage() {
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
        <Blocked
          title="You've used your free analysis"
          body="Your free verdict has been used. Upgrading unlocks more analyses and the full realization plan."
          href="/dashboard"
          cta="Back to dashboard"
        />
      </main>
    );
  }

  return (
    <main className={WRAPPER}>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Describe your idea
        </h1>
        <p className="text-muted-foreground">
          Tell us what you&apos;re thinking of building. Next, we&apos;ll ask a few
          questions to make the verdict as accurate as possible.
        </p>
      </header>
      <NewAnalysisForm />
    </main>
  );
}
