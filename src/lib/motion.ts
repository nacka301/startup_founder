/**
 * Shared motion tokens (UI-STYLE-GUIDE "Motion system"). Single source of
 * truth for easing/duration/stagger so every animated component — Reveal,
 * ScoreGauge, hero entrance — moves at the same pace and feel.
 */

/** Standard "settle" easing for reveals and entrances — snappy start, soft landing. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const DURATION = {
  fast: 0.2,
  base: 0.45,
  slow: 0.9,
} as const;

/** Per-item delay step for staggered groups (cards, list rows, questions). */
export const STAGGER_STEP = 0.08;

/** Spring used for hover/press micro-interactions driven by framer-motion. */
export const SPRING_SNAPPY = {
  type: "spring" as const,
  stiffness: 400,
  damping: 28,
};

export function staggerDelay(index: number, step: number = STAGGER_STEP): number {
  return index * step;
}
