import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ScoreRing } from "@/components/report/score-ring";
import { SegmentedMeter } from "@/components/report/segmented-meter";
import { VERDICT_DISPLAY } from "@/lib/report-schema";
import { FREE_PLAN, PAID_PLAN } from "@/lib/pricing";
import { Reveal } from "@/components/motion/reveal";
import { WaitlistForm } from "@/components/marketing/waitlist-form";

export const metadata: Metadata = {
  title: "BuildWorthy — an evidence-backed verdict on your business idea",
  description:
    "Describe your business idea, answer 5 quick questions, and in 5–10 minutes get a 1–100 score, a GO/CAUTION/STOP verdict, real evidence from Reddit and forums, an MVP sketch, and a realization plan.",
  openGraph: {
    title: "BuildWorthy — an evidence-backed verdict on your business idea",
    description:
      "A 1–100 score, a GO/CAUTION/STOP verdict, and real evidence from people online — on your business idea, in 5–10 minutes.",
    siteName: "BuildWorthy",
    type: "website",
  },
};

// Illustrative sample data for the hero report-preview card. Real reports are
// generated per idea from live evidence — these are static placeholders.
const SAMPLE_VERDICT = "go" as const;
const SAMPLE_SCORE = 78;
const PREVIEW_CRITERIA = [
  { label: "Problem severity", score: 82 },
  { label: "Competition", score: 71 },
  { label: "Personal fit", score: 78 },
  { label: "Monetization", score: 68 },
];

// Marketing social proof (placeholder copy). Avatar initials + brand-tint bg.
const AVATARS = [
  { initials: "JM", bg: "#6366F1" },
  { initials: "AK", bg: "#8B5CF6" },
  { initials: "RT", bg: "#22C55E" },
  { initials: "LN", bg: "#F59E0B" },
  { initials: "SD", bg: "#818CF8" },
];
const USER_COUNT = "7,428";

const TESTIMONIALS = [
  {
    quote:
      "Saved me from building something nobody wanted. The evidence was right there — real people, real complaints. Honestly a relief.",
    name: "Jonas M.",
    role: "Indie hacker",
    initials: "JM",
    bg: "#6366F1",
  },
  {
    quote:
      "The verdict was blunt and I needed that. It flagged the monetization gap I'd been ignoring for weeks.",
    name: "Amara K.",
    role: "Freelance designer",
    initials: "AK",
    bg: "#8B5CF6",
  },
  {
    quote:
      "Ran three ideas through it in a day. Two got a STOP, one got a GO — and that GO is now my side project.",
    name: "Rui T.",
    role: "Solo founder",
    initials: "RT",
    bg: "#22C55E",
  },
];

const HOW_IT_WORKS = [
  {
    n: 1,
    title: "Describe your idea",
    body: "A sentence or two on the problem you want to solve and who has it. No pitch deck, no jargon.",
  },
  {
    n: 2,
    title: "Answer 5 questions",
    body: "Our AI asks targeted questions to sharpen the idea. Not sure? “I don’t know” is a valid answer we account for.",
  },
  {
    n: 3,
    title: "Get your verdict",
    body: "In 5–10 minutes: a 1–100 score, a clear GO / CAUTION / STOP, and the evidence behind it.",
  },
];

const FREE_FEATURES = [
  `${FREE_PLAN.analyses} full analysis, with score and verdict`,
  "Real evidence with sources and links",
  "Web report + email summary",
  "Realization plan locked (preview only)",
];
const PAID_FEATURES = [
  `${PAID_PLAN.analysesPerMonth} analyses per month`,
  "The full realization plan for every idea",
  "MVP definition and week-by-week steps",
  "Dashboard access to all your reports",
];

const container = "mx-auto w-full max-w-[1100px] px-6";
const navLink =
  "rounded-lg px-[13px] py-[9px] text-sm font-medium text-[#9CA3AF] transition-colors hover:bg-white/5 hover:text-white";

export default function Home() {
  const go = VERDICT_DISPLAY[SAMPLE_VERDICT];

  return (
    <div className="flex min-h-screen flex-col text-foreground">
      {/* ============ Header — sticky glass nav ============ */}
      <header
        className="sticky top-0 z-50 border-b border-border backdrop-blur-[16px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,6,10,0.78), rgba(5,6,10,0.52))",
        }}
      >
        <div className={`${container} flex h-16 items-center justify-between gap-5`}>
          <div className="flex items-center gap-[26px]">
            <Link href="/" className="flex items-center gap-2.5 text-foreground">
              {/* Logo — gradient square placeholder; swap for a real mark when ready. */}
              <span
                aria-hidden
                className="size-[26px] shrink-0 rounded-lg"
                style={{
                  background: "linear-gradient(135deg,#22D3EE,#A78BFA)",
                  boxShadow: "0 0 18px rgba(34,211,238,0.45)",
                }}
              />
              <span className="text-[17px] font-semibold tracking-[-0.02em]">
                BuildWorthy
              </span>
            </Link>
            <nav className="hidden items-center gap-0.5 sm:flex">
              <a href="#how-it-works" className={navLink}>
                How it works
              </a>
              <a href="#features" className={navLink}>
                Features
              </a>
              <a href="#pricing" className={navLink}>
                Pricing
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className={buttonVariants({
                variant: "ghost",
                className:
                  "h-9 rounded-[9px] border border-white/15 px-4 text-sm font-medium text-[#C7CAD1] hover:text-white",
              })}
            >
              Sign in
            </Link>
            <Link
              href="/analyses/new"
              className={buttonVariants({
                variant: "cta",
                className: "h-9 rounded-[9px] px-4 text-sm",
              })}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className={`${container} pb-[120px]`}>
        {/* ============ Hero — editorial ============ */}
        <section className="pt-[84px] pb-5">
          <div className="mb-[18px] font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-cyan">
            Idea validation · evidence-first
          </div>
          <h1 className="max-w-[720px] text-[34px] font-bold leading-[1.05] tracking-[-0.04em] sm:text-[64px] sm:leading-[1.02]">
            Stop guessing.
            <br />
            <span className="bg-[linear-gradient(100deg,#22D3EE,#A78BFA)] bg-clip-text text-transparent">
              Read the market.
            </span>
          </h1>
          <div className="mt-[34px] grid grid-cols-1 items-start gap-10 sm:grid-cols-2">
            <div>
              <p className="text-base leading-[1.65] text-muted-foreground">
                Every verdict cites its sources: direct quotes from people living
                with the problem, competitor gaps, and a feasibility read against
                your own time and budget. A 1–100 score and a clear GO / CAUTION /
                STOP in 5–10 minutes.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/analyses/new"
                  className={buttonVariants({
                    variant: "cta",
                    className:
                      "h-12 gap-2 rounded-[10px] px-6 text-[15px] max-sm:w-full",
                  })}
                >
                  Analyze your idea
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/sample"
                  className="inline-flex items-center justify-center px-1.5 py-3.5 text-[15px] font-semibold text-[#D1D5DB] underline underline-offset-4 transition-colors hover:text-white"
                >
                  See a sample report
                </Link>
              </div>
              <p className="mt-4 font-mono text-[13px] text-[#6B7280]">
                Free to try · No credit card · First analysis on us
              </p>
            </div>
            <div className="border-l-2 border-accent-cyan pl-5">
              <p className="font-serif text-[19px] italic leading-[1.5] text-[#D1D5DB]">
                “I spend every Friday chasing unpaid invoices. Two clients are 60+
                days late and I have no system for this.”
              </p>
              <p className="mt-3 font-mono text-[11.5px] text-[#6B7280]">
                r/freelance · 41 similar mentions · evidence pulled by BuildWorthy
              </p>
            </div>
          </div>
        </section>

        {/* ============ Report preview card ============ */}
        <section id="features" className="mt-16 flex justify-center scroll-mt-20">
          <Reveal
            className="w-full max-w-[820px] rounded-[20px] border border-border bg-card p-[30px]"
            style={{
              boxShadow:
                "0 0 40px rgba(34,197,94,0.10), 0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div className="mb-[22px] flex items-center justify-between gap-4">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B7280]">
                Example report
              </span>
              <span className="text-[12px] font-medium text-muted-foreground">
                Invoice-chasing tool for freelancers
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-[30px]">
              <ScoreRing score={SAMPLE_SCORE} verdict={SAMPLE_VERDICT} size={150} />
              <div className="min-w-[240px] flex-1">
                <span
                  className="inline-flex items-center gap-[7px] rounded-full px-3 py-[5px] text-[13px] font-semibold tracking-[0.04em]"
                  style={{ color: go.color, backgroundColor: `${go.color}1a` }}
                >
                  <span
                    className="size-[7px] rounded-full"
                    style={{ backgroundColor: go.color }}
                  />
                  {go.label} · {go.blurb}
                </span>
                <p className="mt-3.5 text-[15px] leading-[1.65] text-[#D1D5DB]">
                  A real, frequently-voiced problem with clear willingness to pay.
                  Competition exists but leaves obvious gaps, and it fits a solo
                  builder&apos;s time and budget.
                </p>
              </div>
            </div>
            <div className="my-6 h-px bg-border" />
            <div className="grid grid-cols-1 gap-x-[34px] gap-y-[18px] sm:grid-cols-2">
              {PREVIEW_CRITERIA.map((c) => (
                <div key={c.label}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[13px] text-[#D1D5DB]">{c.label}</span>
                    <span className="font-mono text-[13px] font-semibold text-foreground">
                      {c.score}
                    </span>
                  </div>
                  <SegmentedMeter score={c.score} color={go.color} segments={20} />
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ============ Social proof ============ */}
        <section className="mt-[88px]">
          <div className="mb-[34px] flex items-center justify-center gap-[14px]">
            <div className="flex -space-x-2.5">
              {AVATARS.map((a) => (
                <span
                  key={a.initials}
                  className="flex size-[34px] items-center justify-center rounded-full border-2 border-background text-[12px] font-semibold text-[#F8FAFC]"
                  style={{ backgroundColor: a.bg }}
                >
                  {a.initials}
                </span>
              ))}
            </div>
            <div className="text-left">
              <div className="font-mono text-[18px] font-bold tracking-[-0.01em]">
                {USER_COUNT}
              </div>
              <div className="text-[13px] text-muted-foreground">
                founders have run their idea through BuildWorthy
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} index={i}>
                <figure className="card-hover flex h-full flex-col gap-4 rounded-[16px] border border-border bg-card p-6">
                  <div className="flex gap-0.5 text-amber-400" aria-hidden>
                    {Array.from({ length: 5 }, (_, j) => (
                      <Star key={j} className="size-3.5 fill-current" />
                    ))}
                  </div>
                  <blockquote className="font-serif text-[16px] italic leading-[1.6] text-[#E5E7EB]">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-auto flex items-center gap-3 text-[13px]">
                    <span
                      className="flex size-[34px] items-center justify-center rounded-full text-[12px] font-semibold text-[#F8FAFC]"
                      style={{ backgroundColor: t.bg }}
                    >
                      {t.initials}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{t.name}</span>
                      <span className="text-[#6B7280]">{t.role}</span>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ============ How it works ============ */}
        <section id="how-it-works" className="mt-[96px] scroll-mt-20">
          <div className="mb-[44px] text-center">
            <h2 className="text-[30px] font-semibold tracking-[-0.02em]">
              Three steps to a verdict you can trust
            </h2>
          </div>
          <ol className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.title} as="li" index={i} className="list-none">
                <div className="card-hover flex h-full flex-col rounded-[16px] border border-border bg-card p-[26px]">
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      className="flex size-10 items-center justify-center rounded-[11px] font-mono text-[16px] font-semibold text-[#A5B4FC]"
                      style={{ backgroundColor: "rgba(99,102,241,0.12)" }}
                    >
                      {step.n}
                    </span>
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6B7280]">
                      Step {step.n}
                    </span>
                  </div>
                  <h3 className="mb-2 text-[18px] font-semibold tracking-[-0.01em]">
                    {step.title}
                  </h3>
                  <p className="text-[14px] leading-[1.6] text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* ============ Pricing ============ */}
        <section id="pricing" className="mt-[96px] scroll-mt-20">
          <div className="mb-[44px] text-center">
            <h2 className="text-[30px] font-semibold tracking-[-0.02em]">
              Start free. Upgrade for the plan.
            </h2>
          </div>
          <div className="mx-auto grid max-w-[760px] grid-cols-1 gap-[18px] sm:grid-cols-2">
            {/* Free */}
            <Reveal index={0} className="h-full">
              <div className="flex h-full flex-col rounded-[18px] border border-border bg-card p-7">
                <h3 className="text-[18px] font-semibold">Free</h3>
                <p className="mt-1.5 mb-5 text-[34px] font-semibold tracking-[-0.02em]">
                  $0
                </p>
                <ul className="flex flex-col gap-[11px]">
                  {FREE_FEATURES.map((f) => (
                    <PlanFeature key={f}>{f}</PlanFeature>
                  ))}
                </ul>
                <Link
                  href="/analyses/new"
                  className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-[11px] border border-white/15 bg-white/[0.04] text-[14px] font-semibold text-foreground transition-colors hover:bg-white/[0.07]"
                >
                  Start free
                </Link>
              </div>
            </Reveal>

            {/* Paid */}
            <Reveal index={1} className="h-full">
              <div
                className="flex h-full flex-col rounded-[18px] border border-primary bg-card p-7"
                style={{ boxShadow: "0 0 26px rgba(99,102,241,0.22)" }}
              >
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[18px] font-semibold">Paid</h3>
                  <span
                    className="rounded-full px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.08em] text-[#A5B4FC]"
                    style={{ backgroundColor: "rgba(99,102,241,0.14)" }}
                  >
                    COMING SOON
                  </span>
                </div>
                <p className="mt-2.5 mb-5 text-[22px] font-semibold tracking-[-0.01em] text-muted-foreground">
                  {PAID_PLAN.price ?? "Price announced at launch"}
                </p>
                <ul className="flex flex-col gap-[11px]">
                  {PAID_FEATURES.map((f) => (
                    <PlanFeature key={f} tone="paid">
                      {f}
                    </PlanFeature>
                  ))}
                </ul>
                <Link
                  href="/sample?plan=paid"
                  className={buttonVariants({
                    variant: "gradient",
                    className: "mt-6 h-11 w-full rounded-[11px] text-[14px]",
                  })}
                >
                  Preview the full report
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ============ Footer ============ */}
      <footer className="border-t border-border">
        {/* Build-in-public updates — secondary to the live "start now" CTAs above. */}
        <div className={`${container} py-12`}>
          <div className="mx-auto flex max-w-[440px] flex-col items-center gap-3 text-center">
            <h2 className="text-[18px] font-semibold tracking-[-0.01em]">
              Follow the build
            </h2>
            <p className="text-[13px] leading-[1.6] text-muted-foreground">
              BuildWorthy is built in public. Leave your email for the occasional
              update — new features and when the paid plan launches. No spam.
            </p>
            <div className="mt-1 w-full max-w-[380px]">
              <WaitlistForm />
            </div>
          </div>
        </div>

        <div className="border-t border-border">
          <div
            className={`${container} flex flex-col items-center justify-between gap-2 py-8 text-[13px] text-muted-foreground sm:flex-row`}
          >
            <span className="font-semibold text-foreground">BuildWorthy</span>
            <span>
              Research assistance for your idea — not guaranteed business advice.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PlanFeature({
  children,
  tone = "free",
}: {
  children: React.ReactNode;
  tone?: "free" | "paid";
}) {
  return (
    <li
      className={`flex items-start gap-2.5 text-[14px] ${
        tone === "paid" ? "text-[#D1D5DB]" : "text-muted-foreground"
      }`}
    >
      <Check className="mt-0.5 size-4 shrink-0 text-[#818CF8]" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
