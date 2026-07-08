"use client";

import { cn } from "@/lib/utils";

/**
 * RadioCardGroup — single-select answer cards (UI-STYLE-GUIDE signature
 * component). Selected card = indigo border + light indigo background. Reused
 * by the analysis wizard later.
 */

export type RadioCardOption = {
  value: string;
  label: string;
  description?: string;
};

type RadioCardGroupProps = {
  name: string;
  options: RadioCardOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Optional accessible label id for the group. */
  "aria-labelledby"?: string;
};

export function RadioCardGroup({
  name,
  options,
  value,
  onChange,
  "aria-labelledby": ariaLabelledby,
}: RadioCardGroupProps) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={ariaLabelledby}
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            name={name}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left text-sm transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-primary/10 ring-1 ring-primary shadow-glow"
                : "border-border bg-card hover:bg-card hover:shadow-elevated",
            )}
          >
            <span className="font-medium text-foreground">{option.label}</span>
            {option.description && (
              <span className="text-[13px] text-muted-foreground">
                {option.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
