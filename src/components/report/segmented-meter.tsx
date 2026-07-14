"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE_OUT } from "@/lib/motion";

/**
 * SegmentedMeter — the report's signature criteria bar (UI-STYLE-GUIDE): a row
 * of discrete ticks instead of one continuous fill, matching the ScoreGauge's
 * tick language. Segments up to `score` light up in `color`; the rest sit at
 * the neutral track color. Fills in on mount (skipped under reduced motion).
 */
export function SegmentedMeter({
  score,
  color,
  segments = 24,
}: {
  score: number;
  color: string;
  segments?: number;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const activeCount = Math.round((clamped / 100) * segments);
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex gap-[3px]" role="presentation">
      {Array.from({ length: segments }, (_, i) => {
        const active = i < activeCount;
        return (
          <motion.span
            key={i}
            className="h-[7px] flex-1 rounded-[2px]"
            initial={reduceMotion ? false : { backgroundColor: "rgba(255,255,255,0.09)" }}
            animate={{ backgroundColor: active ? color : "rgba(255,255,255,0.09)" }}
            transition={{
              duration: DURATION.fast,
              ease: EASE_OUT,
              delay: reduceMotion ? 0 : i * 0.012,
            }}
          />
        );
      })}
    </div>
  );
}
