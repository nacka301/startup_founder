import { ExternalLink, MessageSquare } from "lucide-react";
import type { EvidenceItem } from "@/lib/report-schema";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { sourceLabel } from "./source-label";

const SEVERITY_LABEL: Record<number, string> = {
  1: "mild",
  2: "recurring",
  3: "serious",
};

/**
 * A restrained 3-step intensity indicator for an item's severity (1–3). Neutral
 * dots only — never the GO/CAUTION/STOP palette, which UI-STYLE-GUIDE reserves
 * for verdict meaning. Labelled for screen readers; the dots are decorative.
 */
function SeverityMeter({ severity }: { severity: number }) {
  const s = Math.min(3, Math.max(1, severity));
  return (
    <span
      className="inline-flex items-center gap-1.5"
      aria-label={`Severity: ${SEVERITY_LABEL[s]} (${s} of 3)`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B7280]">
        Severity
      </span>
      <span className="flex items-center gap-1" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "size-1.5 rounded-full",
              n <= s ? "bg-muted-foreground" : "bg-white/12",
            )}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * Evidence section (PRD §6.3): real quotes with links and a "N similar mentions"
 * count, grouped by topic so a reader sees the shape of each complaint. Long
 * groups collapse behind a native <details> ("Show all N") — SSR-safe, so this
 * stays a server component and every quote is present in the HTML.
 */

const PREVIEW_PER_TOPIC = 3;

function EvidenceCard({ item, index = 0 }: { item: EvidenceItem; index?: number }) {
  return (
    <Reveal index={index}>
      <figure className="glass backdrop-blur-[14px] card-hover flex flex-col gap-2.5 rounded-[14px] px-[18px] py-4">
        <blockquote className="font-serif text-base italic leading-relaxed text-[#E5E7EB]">
          &ldquo;{item.quote}&rdquo;
        </blockquote>
        <figcaption className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" aria-hidden />
            {sourceLabel(item.url)}
          </span>
          <SeverityMeter severity={item.severity} />
          {item.similar_count > 1 && (
            <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-0.5 font-mono text-xs font-medium">
              {item.similar_count} similar mentions
            </span>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-[#A5B4FC] hover:underline"
          >
            View source
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </figcaption>
      </figure>
    </Reveal>
  );
}

export function EvidenceSection({ evidence }: { evidence: EvidenceItem[] }) {
  if (evidence.length === 0) return null;

  // Group by topic, preserving first-seen order.
  const groups = new Map<string, EvidenceItem[]>();
  for (const item of evidence) {
    const list = groups.get(item.topic);
    if (list) list.push(item);
    else groups.set(item.topic, [item]);
  }

  const totalMentions = evidence.reduce(
    (sum, e) => sum + Math.max(1, e.similar_count),
    0,
  );

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold tracking-[-0.015em] sm:text-[21px]">Evidence</h2>
        <p className="text-sm text-muted-foreground">
          Real complaints and discussions we found online — {evidence.length}{" "}
          {evidence.length === 1 ? "item" : "items"} across {totalMentions}{" "}
          related mentions. Every claim above is grounded in these.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {[...groups.entries()].map(([topic, items]) => {
          const preview = items.slice(0, PREVIEW_PER_TOPIC);
          const rest = items.slice(PREVIEW_PER_TOPIC);
          return (
            <div key={topic} className="flex flex-col gap-3">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[#8A8F9A]">
                {topic}
              </h3>
              <div className="flex flex-col gap-2">
                {preview.map((item, i) => (
                  <EvidenceCard key={item.id} item={item} index={i} />
                ))}
              </div>
              {rest.length > 0 && (
                <details className="group flex flex-col gap-2">
                  <summary className="cursor-pointer list-none text-sm font-medium text-primary hover:underline">
                    <span className="group-open:hidden">
                      Show {rest.length} more
                    </span>
                    <span className="hidden group-open:inline">Show less</span>
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {rest.map((item) => (
                      <EvidenceCard key={item.id} item={item} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
