import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import { STATUS_META, type AnalysisStatus } from "@/lib/analyses";

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
    .select("onboarding_completed_at")
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

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const list = analyses ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-[1100px] flex-col gap-8 px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <form action={signOut}>
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Your analyses</h2>
        <Link href="/analyses/new" className={buttonVariants()}>
          New analysis
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-muted-foreground">
            No analyses yet. Start with your first idea — you&apos;ll get an
            evidence-backed verdict.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((analysis, i) => {
            const meta = STATUS_META[analysis.status as AnalysisStatus];
            return (
              <Reveal key={analysis.id} as="li" index={i}>
                <Link
                  href={`/analyses/${analysis.id}`}
                  className="card-hover flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="line-clamp-2 text-sm text-foreground">
                    {analysis.idea_text}
                  </span>
                  {meta && (
                    <Badge variant={meta.badge} className="shrink-0">
                      {meta.label}
                    </Badge>
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
