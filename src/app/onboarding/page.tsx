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
    <main className="animate-fade-in-up mx-auto flex min-h-screen max-w-[640px] flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-[#A5B4FC]">
          Set up your profile · once
        </span>
        <h1 className="text-[32px] font-semibold tracking-[-0.025em]">
          Tell us about your situation
        </h1>
        <p className="text-[15px] text-muted-foreground">
          A few quick questions so your verdicts factor in your situation — not
          just the idea. This takes under a minute and you only do it once.
        </p>
      </header>
      <OnboardingForm />
    </main>
  );
}
