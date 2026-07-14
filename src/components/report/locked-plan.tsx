import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

/**
 * LockedPlan — the free-tier upsell in place of the realization plan (PRD §6.5,
 * UI-STYLE-GUIDE signature component). The blurred content below is entirely
 * SYNTHETIC placeholder text: the real plan is never SELECTed for free users, so
 * it cannot appear in the HTML. This keeps the teaser looking real (not an empty
 * box) without leaking a single word of the paid deliverable.
 */

// Generic, idea-agnostic filler so the blurred shape reads as a real plan.
const FILLER_WEEKS = [
  { week: 1, focus: "Shape the smallest useful version", n: 3 },
  { week: 2, focus: "Build the core flow end to end", n: 3 },
  { week: 3, focus: "Put it in front of ten real users", n: 2 },
  { week: 4, focus: "Tighten, price, and launch", n: 3 },
];
const FILLER_TASK =
  "Draft the first version of this step and set a clear done-for-now line.";

export function LockedPlan() {
  return (
    <Reveal as="section" aria-labelledby="locked-plan-heading" className="flex flex-col gap-4">
      <h2 id="locked-plan-heading" className="text-lg font-semibold tracking-[-0.015em] sm:text-[21px]">
        Realization plan
      </h2>

      <div className="relative overflow-hidden rounded-[16px] border border-border">
        {/* Blurred, non-interactive, screen-reader-hidden placeholder. */}
        <div
          aria-hidden
          className="pointer-events-none select-none px-5 py-6 blur-[6px]"
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h3 className="text-[15px] font-medium">Your MVP</h3>
              <p className="text-sm text-muted-foreground">
                A focused first version that solves one clear problem for one clear
                person, leaving everything else for later so you can launch in weeks.
              </p>
            </div>
            <ol className="flex flex-col gap-3">
              {FILLER_WEEKS.map((w) => (
                <li key={w.week} className="glass backdrop-blur-[14px] rounded-[14px] px-[18px] py-4">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                      Week {w.week}
                    </span>
                    <span className="text-[15px] font-medium">{w.focus}</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1">
                    {Array.from({ length: w.n }).map((_, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        • {FILLER_TASK}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Lock overlay + upsell CTA. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-background/30 via-background/60 to-background px-6 text-center shadow-glow">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-semibold text-foreground">
              Your realization plan is ready
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Unlock a week-by-week path to launch — MVP definition, tools, and
              where to find your first customers.
            </p>
          </div>
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Upgrade to unlock your realization plan
          </Link>
          <span className="font-mono text-xs text-[#6B7280]">
            Currently viewing: Free tier
          </span>
        </div>
      </div>
    </Reveal>
  );
}
