import type { ReportPlan } from "@/lib/report-schema";

/**
 * Realization plan (PRD §6.5) — the paid deliverable. Rendered only for paid
 * owners; the page never SELECTs `reports.plan` for anyone else, so this
 * component's real content cannot reach a free or shared HTML payload. The blurred
 * teaser free users see is LockedPlan, which contains only synthetic placeholder
 * text — never this.
 */
export function PlanSection({ plan }: { plan: ReportPlan }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Realization plan</h2>
        <p className="text-sm text-muted-foreground">
          A concrete path from today to a launched MVP, tailored to your time and
          budget.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[15px] font-medium text-foreground">Your MVP</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{plan.mvp}</p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-[15px] font-medium text-foreground">Week by week</h3>
        <ol className="flex flex-col gap-3">
          {plan.weekly_steps.map((step) => (
            <li
              key={step.week}
              className="rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-primary">
                  Week {step.week}
                </span>
                <span className="text-[15px] font-medium text-foreground">
                  {step.focus}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {step.tasks.map((task, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                  >
                    <span className="select-none text-primary">•</span>
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[15px] font-medium text-foreground">Suggested tools</h3>
        <ul className="flex flex-col gap-1.5">
          {plan.tools.map((tool, i) => (
            <li key={i} className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{tool.name}</span> —{" "}
              {tool.purpose}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-[15px] font-medium text-foreground">
          Finding your first customers
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Where they are
            </span>
            <ul className="flex flex-col gap-1">
              {plan.marketing.first_customers.map((c, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              How to reach them
            </span>
            <ul className="flex flex-col gap-1">
              {plan.marketing.channels.map((c, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
