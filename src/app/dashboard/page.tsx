import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

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

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1100px] flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <form action={signOut}>
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
      </div>
      <p className="text-muted-foreground">
        You&apos;re signed in as{" "}
        <span className="font-medium text-foreground">{user.email}</span>. This is a
        placeholder — your analyses will appear here.
      </p>
    </main>
  );
}
