import { ExternalLink } from "lucide-react";
import { CRITERION_KEYS } from "@/prompts/verdict.v1";
import {
  CRITERION_LABELS,
  VERDICT_DISPLAY,
  type EvidenceItem,
  type ReportCriterion,
} from "@/lib/report-schema";
import { Reveal } from "@/components/motion/reveal";
import { SegmentedMeter } from "./segmented-meter";
import { sourceLabel } from "./source-label";

/**
 * Criteria breakdown (PRD §6.2): the four criteria, each scored with a
 * verdict-colored bar and a reasoning paragraph. Ordered by CRITERION_KEYS so
 * the report reads the same regardless of the order the model returned them.
 * Each criterion cites the evidence backing it (PRD §6.3) via its evidence_ids;
 * personal_feasibility is annotated as profile-derived (it cites no evidence).
 */
export function CriteriaBreakdown({
  criteria,
  verdict,
  evidence,
}: {
  criteria: ReportCriterion[];
  verdict: "go" | "caution" | "stop";
  evidence: EvidenceItem[];
}) {
  const byKey = new Map(criteria.map((c) => [c.key, c]));
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const color = VERDICT_DISPLAY[verdict].color;

  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold tracking-tight">Criteria breakdown</h2>
      <div className="flex flex-col gap-6">
        {CRITERION_KEYS.map((key, index) => {
          const c = byKey.get(key);
          if (!c) return null;
          // Resolve this criterion's cited evidence, deduped by source URL.
          const cites = Array.from(
            new Map(
              c.evidence_ids
                .map((eid) => byId.get(eid))
                .filter((e): e is EvidenceItem => Boolean(e))
                .map((e) => [e.url, e]),
            ).values(),
          );
          return (
            <Reveal key={key} index={index} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-[15px] font-medium text-foreground">
                  {CRITERION_LABELS[key]}
                </h3>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {c.score}
                  <span className="font-normal text-muted-foreground">/100</span>
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={c.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={CRITERION_LABELS[key]}
              >
                <SegmentedMeter score={c.score} color={color} />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {c.reasoning}
              </p>
              {cites.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    Evidence
                  </span>
                  {cites.map((e) => (
                    <a
                      key={e.id}
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[12px] text-primary hover:underline"
                    >
                      {sourceLabel(e.url)}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ))}
                </div>
              )}
              {key === "personal_feasibility" && (
                <p className="text-[13px] text-muted-foreground/80">
                  Based on your onboarding profile, not public evidence.
                </p>
              )}
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
