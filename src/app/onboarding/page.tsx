import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware guards this route too; a Server Component must never assume auth.
  if (!user) {
    redirect("/login");
  }

  // A returning user who already onboarded never sees this screen again.
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed_at) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Tell us a bit about you
        </h1>
        <p className="text-muted-foreground">
          A few quick questions so your verdicts factor in your situation — not
          just the idea. This takes under a minute and you only do it once.
        </p>
      </header>
      <OnboardingForm />
    </main>
  );
}
