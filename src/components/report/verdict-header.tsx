import { ScoreRing } from "./score-ring";
import { VERDICT_DISPLAY } from "@/lib/report-schema";

/**
 * Top of the report (PRD §6.1): score ring + verdict badge + one-paragraph
 * summary. The verdict badge is the one place the report leans on the
 * green/amber/red palette, so its color comes straight from VERDICT_DISPLAY.
 */
export function VerdictHeader({
  score,
  verdict,
  summary,
}: {
  score: number;
  verdict: "go" | "caution" | "stop";
  summary: string;
}) {
  const v = VERDICT_DISPLAY[verdict];

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-8"
      style={{
        boxShadow: `0 0 24px ${v.color}20, 0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.25)`,
      }}
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        <ScoreRing score={score} verdict={verdict} />
        <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
            style={{ color: v.color, backgroundColor: `${v.color}1a` }}
          >
            {v.label}
          </span>
          <p className="text-[15px] leading-relaxed text-foreground">{summary}</p>
        </div>
      </div>
    </section>
  );
}
