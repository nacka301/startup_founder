import type { ReactNode } from "react";
import { VerdictHeader } from "./verdict-header";
import { CriteriaBreakdown } from "./criteria-breakdown";
import { EvidenceSection } from "./evidence-section";
import { SolutionsSection } from "./solutions-section";
import type {
  EvidenceItem,
  ReportCriterion,
  ReportSolutions,
} from "@/lib/report-schema";

/**
 * The full report renderer (PRD §6), shared by the owner page and the public
 * share route. Sections render in PRD order: verdict → criteria → evidence →
 * solutions → plan. The plan is passed in as `planSlot` so each caller controls
 * gating — the real PlanSection (paid owner), LockedPlan (free owner), or nothing
 * (share). This component never touches plan data itself.
 */
export function ReportView({
  score,
  verdict,
  summary,
  criteria,
  solutions,
  evidence,
  planSlot,
}: {
  score: number;
  verdict: "go" | "caution" | "stop";
  summary: string;
  criteria: ReportCriterion[];
  solutions: ReportSolutions;
  evidence: EvidenceItem[];
  planSlot?: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-10">
      <VerdictHeader score={score} verdict={verdict} summary={summary} />
      <hr className="border-border" />
      <CriteriaBreakdown criteria={criteria} verdict={verdict} evidence={evidence} />
      <hr className="border-border" />
      <EvidenceSection evidence={evidence} />
      <hr className="border-border" />
      <SolutionsSection solutions={solutions} />
      {planSlot && (
        <>
          <hr className="border-border" />
          {planSlot}
        </>
      )}
    </article>
  );
}
