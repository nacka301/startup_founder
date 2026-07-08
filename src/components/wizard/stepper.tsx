import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * WizardStepper — visual-only progress indicator across the analysis wizard
 * (idea → clarify → verdict). Driven by existing page/status state, no new
 * client state of its own — stays a plain server component.
 */

const STEPS = [
  { n: 1, label: "Your idea" },
  { n: 2, label: "Clarify" },
  { n: 3, label: "Verdict" },
] as const;

export function WizardStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="mb-10 flex items-center gap-2.5" aria-label="Analysis progress">
      {STEPS.map((step, idx) => {
        const done = current > step.n;
        const active = current === step.n;
        return (
          <div key={step.n} className="flex flex-1 items-center gap-2.5 last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-[26px] shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold transition-colors duration-200",
                  active && "bg-primary text-primary-foreground shadow-glow",
                  done && !active && "bg-primary/15 text-primary",
                  !active && !done && "border border-border bg-transparent text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : step.n}
              </span>
              <span
                className={cn(
                  "text-[13px] font-medium",
                  active
                    ? "text-foreground"
                    : done
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}
