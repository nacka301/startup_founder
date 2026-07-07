import { VERDICT_DISPLAY } from "@/lib/report-schema";

/**
 * ScoreRing — the report's signature circular gauge (UI-STYLE-GUIDE). A 1–100
 * score in a ring colored by verdict, animating its fill on load. Pure CSS
 * (keyframes in globals.css) so it stays a server component — no client JS.
 */

const SIZE = 132;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreRing({
  score,
  verdict,
}: {
  score: number;
  verdict: "go" | "caution" | "stop";
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const color = VERDICT_DISPLAY[verdict].color;

  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={`Score ${clamped} out of 100`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="-rotate-90"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          className="animate-[score-ring_1s_ease-out_forwards]"
          style={
            {
              "--ring-circumference": `${CIRCUMFERENCE}`,
              "--ring-offset": `${offset}`,
              strokeDashoffset: offset,
            } as React.CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[56px] font-bold leading-none tracking-tight text-foreground">
          {clamped}
        </span>
        <span className="text-[13px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
