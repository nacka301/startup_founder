import type { ReactNode } from "react";
import { VerdictHeader } from "./verdict-header";
import { CriteriaBreakdown } from "./criteria-breakdown";
import { EvidenceSection } from "./evidence-section";
import { SolutionsSection } from "./solutions-section";
import type {
  ConfidenceLevel,
  EvidenceItem,
  ReportCriterion,
  ReportSolutions,
} from "@/lib/report-schema";

/**
 * The full report renderer (PRD §6), shared by the owner page and the public
 * share route. One calm, top-to-bottom document (UI-STYLE-GUIDE §6): verdict →
 * criteria → evidence → MVP sketch → realization plan, with hairline dividers
 * between the major blocks so everything is visible by scrolling — no tabs
 * hiding the evidence depth or the free→paid upsell. `planSlot` is passed in so
 * each caller controls gating (the real PlanSection for a paid owner, LockedPlan
 * for a free owner, or nothing for the share view); it renders as the emphasized
 * final block. This component never touches plan data itself.
 */
export function ReportView({
  score,
  verdict,
  summary,
  confidence,
  criteria,
  solutions,
  evidence,
  planSlot,
}: {
  score: number;
  verdict: "go" | "caution" | "stop";
  summary: string;
  confidence?: ConfidenceLevel | null;
  criteria: ReportCriterion[];
  solutions: ReportSolutions;
  evidence: EvidenceItem[];
  planSlot?: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-8 sm:gap-12">
      <VerdictHeader
        score={score}
        verdict={verdict}
        summary={summary}
        confidence={confidence ?? null}
      />
      <CriteriaBreakdown criteria={criteria} verdict={verdict} evidence={evidence} />

      <hr className="border-border" />
      <EvidenceSection evidence={evidence} />

      <hr className="border-border" />
      <SolutionsSection solutions={solutions} />

      {planSlot !== undefined && planSlot !== null && (
        <>
          <hr className="border-border" />
          {planSlot}
        </>
      )}

      <p className="text-[12.5px] leading-relaxed text-[#6B7280]">
        This is research assistance, not guaranteed business advice — treat it as
        a starting point for your own judgement, not a decision.
      </p>
    </article>
  );
}
