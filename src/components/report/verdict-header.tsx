"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ScoreRing } from "./score-ring";
import { VERDICT_DISPLAY } from "@/lib/report-schema";
import { DURATION, EASE_OUT } from "@/lib/motion";

/**
 * Top of the report (PRD §6.1): score ring + verdict badge + one-paragraph
 * summary. The verdict badge is the one place the report leans on the
 * green/amber/red palette, so its color comes straight from VERDICT_DISPLAY.
 * Entrance animation plays once on mount (this is above-the-fold content, so
 * it uses a plain mount transition rather than Reveal's scroll trigger).
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
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="glass-strong backdrop-blur-[18px] relative overflow-hidden rounded-[20px] p-6 sm:p-8"
      style={{
        boxShadow: `0 0 34px ${v.color}24, 0 20px 50px rgba(0, 0, 0, 0.45)`,
      }}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        <ScoreRing score={score} verdict={verdict} size={168} />
        <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold"
            style={{ color: v.color, backgroundColor: `${v.color}1a` }}
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: v.color, boxShadow: `0 0 8px ${v.color}` }}
            />
            {v.label} · {v.blurb}
          </span>
          <p className="text-base leading-relaxed text-[#E5E7EB]">{summary}</p>
        </div>
      </div>
    </motion.section>
  );
}
