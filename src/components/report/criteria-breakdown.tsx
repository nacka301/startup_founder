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

/** Per-criterion color by its own score (v2: independent of the overall
 * verdict, so a weak criterion reads red/amber even inside a GO report). */
function scoreColor(score: number): string {
  if (score >= 65) return VERDICT_DISPLAY.go.color;
  if (score >= 45) return VERDICT_DISPLAY.caution.color;
  return VERDICT_DISPLAY.stop.color;
}

/**
 * Criteria breakdown (PRD §6.2): the four criteria, each scored with a
 * value-colored bar and a reasoning paragraph. Ordered by CRITERION_KEYS so
 * the report reads the same regardless of the order the model returned them.
 * Each criterion cites the evidence backing it (PRD §6.3) via its evidence_ids;
 * personal_feasibility is annotated as profile-derived (it cites no evidence).
 */
export function CriteriaBreakdown({
  criteria,
  evidence,
}: {
  criteria: ReportCriterion[];
  verdict: "go" | "caution" | "stop";
  evidence: EvidenceItem[];
}) {
  const byKey = new Map(criteria.map((c) => [c.key, c]));
  const byId = new Map(evidence.map((e) => [e.id, e]));

  return (
    <section className="flex flex-col gap-4 sm:gap-[22px]">
      <h2 className="text-lg font-semibold tracking-[-0.015em] sm:text-[21px]">
        Criteria breakdown
      </h2>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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
            <Reveal
              key={key}
              index={index}
              className="glass backdrop-blur-[14px] card-hover rounded-[16px] p-4 hover:border-accent-cyan/35 sm:p-5"
            >
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <h3 className="text-[15px] font-medium">
                  {CRITERION_LABELS[key]}
                </h3>
                <span
                  className="font-mono text-2xl font-bold"
                  style={{ color: scoreColor(c.score) }}
                >
                  {c.score}
                  <span className="text-[13px] font-medium text-[#6B7280]">
                    /100
                  </span>
                </span>
              </div>
              <div
                className="mb-3"
                role="progressbar"
                aria-valuenow={c.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={CRITERION_LABELS[key]}
              >
                <SegmentedMeter score={c.score} color={scoreColor(c.score)} />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {c.reasoning}
              </p>
              {cites.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                    Evidence
                  </span>
                  {cites.map((e) => (
                    <a
                      key={e.id}
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 rounded-full bg-[rgba(99,102,241,0.10)] px-2.5 py-[3px] text-xs font-medium text-[#A5B4FC] hover:underline"
                    >
                      {sourceLabel(e.url)}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ))}
                </div>
              )}
              {key === "personal_feasibility" && (
                <p className="mt-2.5 text-[12.5px] italic text-[#6B7280]">
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
