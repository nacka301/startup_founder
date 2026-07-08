import type { ReportSolutions } from "@/lib/report-schema";
import { Reveal } from "@/components/motion/reveal";

/**
 * Possible solutions & MVP shape (PRD §6.4) — the free-tier teaser that precedes
 * the paid realization plan. Not gated.
 */
export function SolutionsSection({ solutions }: { solutions: ReportSolutions }) {
  return (
    <Reveal as="section" className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">
        Possible solutions & MVP shape
      </h2>
      <div className="flex flex-col gap-2">
        <h3 className="text-[15px] font-medium text-foreground">
          What a first version could look like
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {solutions.mvp_sketch}
        </p>
      </div>
      {solutions.possible_solutions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-medium text-foreground">
            Angles worth considering
          </h3>
          <ul className="flex flex-col gap-2">
            {solutions.possible_solutions.map((s, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
              >
                <span className="select-none text-primary">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Reveal>
  );
}
