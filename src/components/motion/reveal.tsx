"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { DURATION, EASE_OUT, staggerDelay } from "@/lib/motion";

type RevealTag = "div" | "li" | "section";

const MOTION_TAG: Record<RevealTag, ElementType> = {
  div: motion.div,
  li: motion.li,
  section: motion.section,
};

/**
 * Reveal — fade + slide-up entrance that plays once when the element enters
 * the viewport. Used for grouped cards (how-it-works, pricing, criteria,
 * evidence, dashboard rows) so sections cascade in instead of popping in as a
 * block. Pass `index` to stagger siblings. Extra props (aria-*, id, etc.) pass
 * through to the underlying element.
 *
 * Respects prefers-reduced-motion by rendering the final state immediately —
 * no animated transform ever runs for a user who asked not to see it.
 */
export function Reveal({
  children,
  index = 0,
  className,
  as = "div",
  ...rest
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: RevealTag;
} & Omit<ComponentPropsWithoutRef<RevealTag>, "className" | "children">) {
  const reduceMotion = useReducedMotion();
  // Extra props (aria-*, id, ...) are validated by callers via the type above;
  // the union of div/li/section attribute types doesn't distribute cleanly
  // through a dynamically-selected element, so it's passed through untyped.
  const passthroughProps = rest as Record<string, unknown>;

  if (reduceMotion) {
    const Static = as;
    return (
      <Static className={className} {...passthroughProps}>
        {children}
      </Static>
    );
  }

  const Comp = MOTION_TAG[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: DURATION.base, ease: EASE_OUT, delay: staggerDelay(index) }}
      {...passthroughProps}
    >
      {children}
    </Comp>
  );
}
