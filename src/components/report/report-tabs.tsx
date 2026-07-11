"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const ALL_TABS = [
  { id: "evidence", label: "Evidence" },
  { id: "mvp", label: "MVP sketch" },
  { id: "plan", label: "Realization plan" },
] as const;

type TabId = (typeof ALL_TABS)[number]["id"];

/**
 * ReportTabs (v2 — README §5): pill tabs switching between Evidence, MVP
 * sketch, and (when present) Realization plan, client-side, no navigation.
 * `plan` is optional — the public share route renders no plan section at all
 * (UI-STYLE-GUIDE §7), so when it's omitted the plan tab doesn't exist rather
 * than showing an empty/placeholder panel. Every rendered panel is still
 * server-rendered and present in the DOM — only visibility toggles
 * client-side (via `hidden`) — so the SSR guarantee (e.g. "every evidence
 * quote is present in the HTML") still holds.
 */
export function ReportTabs({
  evidence,
  mvp,
  plan,
}: {
  evidence: ReactNode;
  mvp: ReactNode;
  plan?: ReactNode;
}) {
  const TABS = plan !== undefined ? ALL_TABS : ALL_TABS.filter((t) => t.id !== "plan");
  const [active, setActive] = useState<TabId>("evidence");
  const panels: Partial<Record<TabId, ReactNode>> = { evidence, mvp, plan };

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap gap-2" role="tablist">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`report-panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={cn(
                "rounded-full border px-[18px] py-[11px] text-[13px] font-semibold transition-colors duration-150",
                isActive
                  ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan"
                  : "border-white/10 text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.id}
          id={`report-panel-${tab.id}`}
          role="tabpanel"
          hidden={active !== tab.id}
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}
