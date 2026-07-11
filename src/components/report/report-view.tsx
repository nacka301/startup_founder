import type { ReactNode } from "react";
import { VerdictHeader } from "./verdict-header";
import { CriteriaBreakdown } from "./criteria-breakdown";
import { EvidenceSection } from "./evidence-section";
import { SolutionsSection } from "./solutions-section";
import { ReportTabs } from "./report-tabs";
import type {
  EvidenceItem,
  ReportCriterion,
  ReportSolutions,
} from "@/lib/report-schema";

/**
 * The full report renderer (PRD §6), shared by the owner page and the public
 * share route. Verdict and criteria render up top; evidence, the MVP sketch,
 * and the plan sit behind client-side pill tabs (v2 — README §5) rather than
 * stacked hairline-separated sections. `planSlot` is passed in so each caller
 * controls gating — the real PlanSection (paid owner), LockedPlan (free
 * owner), or nothing (share). This component never touches plan data itself.
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
      <CriteriaBreakdown criteria={criteria} verdict={verdict} evidence={evidence} />
      <ReportTabs
        evidence={<EvidenceSection evidence={evidence} />}
        mvp={<SolutionsSection solutions={solutions} />}
        plan={planSlot}
      />
    </article>
  );
}
