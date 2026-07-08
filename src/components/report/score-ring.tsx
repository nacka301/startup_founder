"use client";

import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { VERDICT_DISPLAY } from "@/lib/report-schema";
import { EASE_OUT, DURATION } from "@/lib/motion";

/**
 * ScoreRing — the report's signature gauge (UI-STYLE-GUIDE): a radial arc of
 * ticks, 1–100, colored by verdict, that count up and fill on mount. Client
 * component (the count-up needs JS); honors prefers-reduced-motion by jumping
 * straight to the final value instead of animating.
 */

const N_TICKS = 56;
const START_ANGLE = 135;
const SWEEP = 270;
const VIEW = 180;
const CENTER = VIEW / 2;
const R_IN = 62;
const R_OUT = 80;

export function ScoreRing({
  score,
  verdict,
  size = 132,
}: {
  score: number;
  verdict: "go" | "caution" | "stop";
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = VERDICT_DISPLAY[verdict].color;
  const reduceMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(reduceMotion ? clamped : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayed(clamped);
      return;
    }
    setDisplayed(0);
    const controls = animate(0, clamped, {
      duration: DURATION.slow,
      ease: EASE_OUT,
      onUpdate: setDisplayed,
    });
    return () => controls.stop();
  }, [clamped, reduceMotion]);

  const frac = displayed / 100;
  const ticks = Array.from({ length: N_TICKS }, (_, i) => {
    const f = i / (N_TICKS - 1);
    const angle = ((START_ANGLE + SWEEP * f) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const active = f <= frac + 1e-6;
    return {
      // Fixed precision: raw float64 trig output can print a different last
      // digit on the server vs. the client, which React flags as a hydration
      // mismatch even though the values are visually identical.
      x1: (CENTER + R_IN * cos).toFixed(2),
      y1: (CENTER + R_IN * sin).toFixed(2),
      x2: (CENTER + R_OUT * cos).toFixed(2),
      y2: (CENTER + R_OUT * sin).toFixed(2),
      color: active ? color : "rgba(255,255,255,0.09)",
      width: active ? 3.4 : 2,
    };
  });

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score ${clamped} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.color}
            strokeWidth={t.width}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono font-bold leading-none tracking-tight text-foreground tabular-nums"
          style={{ fontSize: size * 0.3 }}
        >
          {Math.round(displayed)}
        </span>
        <span className="mt-1 text-[11px] font-medium text-muted-foreground">
          / 100
        </span>
      </div>
    </div>
  );
}
