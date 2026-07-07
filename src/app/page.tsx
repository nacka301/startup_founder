import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Gauge,
  ListChecks,
  MessageSquare,
  PencilLine,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ScoreRing } from "@/components/report/score-ring";
import { VERDICT_DISPLAY } from "@/lib/report-schema";
import { FREE_PLAN, PAID_PLAN } from "@/lib/pricing";
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

// Sample data for the "What you get" report preview. Illustrative only — real
// reports are generated per idea from live evidence.
const SAMPLE_VERDICT = "go" as const;
const SAMPLE_SCORE = 78;
const SAMPLE_CRITERIA = [
  { label: "Problem severity & frequency", score: 82 },
  { label: "Competition & their weaknesses", score: 71 },
  { label: "Personal feasibility", score: 78 },
  { label: "Monetization potential", score: 68 },
];

const HOW_IT_WORKS = [
  {
    icon: PencilLine,
    title: "Describe your idea",
    body: "A sentence or two on the problem you want to solve and who has it. No pitch deck, no jargon.",
  },
  {
    icon: ListChecks,
    title: "Answer 5 quick questions",
    body: "Our AI asks 5 targeted questions to sharpen the idea. Not sure? “I don’t know” is a valid answer we account for.",
  },
  {
    icon: Gauge,
    title: "Get your verdict",
    body: "In 5–10 minutes: a 1–100 score, a clear GO / CAUTION / STOP, and the evidence behind it. We email you when it’s ready.",
  },
];

const container = "mx-auto w-full max-w-[1100px] px-6";

export default function Home() {
  const go = VERDICT_DISPLAY[SAMPLE_VERDICT];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className={`${container} flex h-16 items-center justify-between`}>
          <span className="text-lg font-semibold tracking-tight">BuildWorthy</span>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Sign in
            </Link>
            <Link
              href="/analyses/new"
              className={buttonVariants({ size: "sm" })}
            >
              Analyze your idea
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className={`${container} flex flex-col items-center gap-6 py-20 text-center sm:py-28`}>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Get an honest, evidence-backed verdict on your business idea
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Describe your idea, answer 5 quick questions, and in 5–10 minutes get
            a 1–100 score, a GO / CAUTION / STOP verdict, real evidence from Reddit
            and forums (with links), an MVP sketch, and a step-by-step realization
            plan.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/analyses/new"
              className={buttonVariants({ size: "lg" })}
            >
              Analyze your idea
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a
              href="#waitlist"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Join the waitlist
            </a>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Free to try · No credit card · Your first analysis is on us
          </p>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-[#FAFAF9]">
          <div className={`${container} py-16 sm:py-20`}>
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
              <p className="max-w-xl text-muted-foreground">
                Three steps from a rough idea to a verdict you can trust.
              </p>
            </div>
            <ol className="mt-12 grid gap-6 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.title}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Step {i + 1}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-[15px] leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* What you get */}
        <section className={`${container} py-16 sm:py-24`}>
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              What you get
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Not an opinion — a scored report grounded in what real people say
              online. Here&apos;s an example.
            </p>
          </div>

          <div className="mx-auto mt-12 flex max-w-[760px] flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Example report
            </span>

            {/* Verdict header (score ring + badge + summary) */}
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
              <ScoreRing score={SAMPLE_SCORE} verdict={SAMPLE_VERDICT} />
              <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
                  style={{ color: go.color, backgroundColor: `${go.color}1a` }}
                >
                  {go.label}
                </span>
                <p className="text-[15px] leading-relaxed text-foreground">
                  A real, frequently-voiced problem with clear willingness to pay.
                  Competition exists but leaves obvious gaps, and it fits a solo
                  builder&apos;s time and budget. Worth pursuing.
                </p>
              </div>
            </div>

            <hr className="border-border" />

            {/* Criteria breakdown */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold tracking-tight">
                Criteria breakdown
              </h3>
              <div className="flex flex-col gap-3">
                {SAMPLE_CRITERIA.map((c) => (
                  <div key={c.label} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-foreground">{c.label}</span>
                      <span className="text-muted-foreground">{c.score}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${c.score}%`,
                          backgroundColor: go.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-border" />

            {/* Evidence sample */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-tight">
                Real evidence, with links
              </h3>
              <figure className="flex flex-col gap-2 rounded-xl border border-border bg-background px-4 py-3">
                <blockquote className="font-serif text-[15px] italic leading-relaxed text-foreground">
                  &ldquo;I waste half a day every month chasing clients for
                  invoices they &apos;forgot&apos;. I&apos;d genuinely pay for
                  something that just did it for me.&rdquo;
                </blockquote>
                <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-3.5" aria-hidden />
                    reddit.com/r/freelance
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium">
                    34 similar mentions
                  </span>
                  <span className="inline-flex items-center gap-1 text-primary">
                    View source
                    <ExternalLink className="size-3.5" aria-hidden />
                  </span>
                </figcaption>
              </figure>
              <p className="text-[13px] text-muted-foreground">
                Every claim in your report is backed by quotes like this — you see
                exactly where the verdict comes from, plus a suggested MVP shape to
                build first.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-y border-border bg-[#FAFAF9]">
          <div className={`${container} py-16 sm:py-24`}>
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
              <p className="max-w-xl text-muted-foreground">
                Start free. Upgrade when you want more analyses and the full
                realization plan.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-[760px] gap-6 sm:grid-cols-2">
              {/* Free */}
              <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold tracking-tight">Free</h3>
                  <p className="text-3xl font-semibold tracking-tight">$0</p>
                </div>
                <ul className="flex flex-col gap-2 text-[15px] text-muted-foreground">
                  <PlanFeature>
                    {FREE_PLAN.analyses} full analysis, with score and verdict
                  </PlanFeature>
                  <PlanFeature>Real evidence with sources and links</PlanFeature>
                  <PlanFeature>Web report + email summary</PlanFeature>
                  <PlanFeature>Realization plan locked (preview only)</PlanFeature>
                </ul>
                <Link
                  href="/analyses/new"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Start free
                </Link>
              </div>

              {/* Paid */}
              <div className="flex flex-col gap-5 rounded-xl border border-primary bg-card p-6 ring-1 ring-primary">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-tight">Paid</h3>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">
                    {PAID_PLAN.price ?? (
                      <span className="text-xl text-muted-foreground">
                        Price announced at launch
                      </span>
                    )}
                  </p>
                </div>
                <ul className="flex flex-col gap-2 text-[15px] text-muted-foreground">
                  <PlanFeature>
                    {PAID_PLAN.analysesPerMonth} analyses per month
                  </PlanFeature>
                  <PlanFeature>
                    The full realization plan for every idea
                  </PlanFeature>
                  <PlanFeature>MVP definition and week-by-week steps</PlanFeature>
                  <PlanFeature>Dashboard access to all your reports</PlanFeature>
                </ul>
                <a href="#waitlist" className={buttonVariants()}>
                  Join the waitlist
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist" className={`${container} py-16 sm:py-24`}>
          <div className="mx-auto flex max-w-[560px] flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Not ready to sign up?
            </h2>
            <p className="text-muted-foreground">
              Join the waitlist and we&apos;ll email you when new features and paid
              plans go live. No spam, just the important updates.
            </p>
            <div className="mt-2 w-full">
              <WaitlistForm />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className={`${container} flex flex-col items-center justify-between gap-2 py-8 text-[13px] text-muted-foreground sm:flex-row`}>
          <span className="font-semibold text-foreground">BuildWorthy</span>
          <span>Research assistance for your idea — not guaranteed business advice.</span>
        </div>
      </footer>
    </div>
  );
}

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
