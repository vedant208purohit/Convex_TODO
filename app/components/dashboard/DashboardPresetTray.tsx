"use client";

import React from "react";

interface Props {
  activeTemplateKey?: string;
  onSelectTemplate: (templateKey: string) => void;
  isLoading: boolean;
}

const TEMPLATE_PRESETS = [
  { key: "executive_dinner_peak", label: "Executive Dinner Peak" },
  { key: "breakfast_buffet_bakery", label: "Breakfast Buffet & Bakery" },
  { key: "late_night_bar_lounge", label: "Late Night Bar & Lounge" },
  { key: "financial_close_audit", label: "Financial Close & Audit" },
];

export function DashboardPresetTray({
  activeTemplateKey = "executive_dinner_peak",
  onSelectTemplate,
  isLoading,
}: Props) {
  return (
    <aside className="w-full bg-surface-container px-margin py-3 mt-space-xl text-on-surface shadow-inner border-t border-outline-variant/40">
      <div className="w-full flex flex-wrap items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">bookmarks</span>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
              View Templates
            </span>
          </div>

          <div className="flex items-center gap-space-sm flex-wrap">
            {TEMPLATE_PRESETS.map((preset) => {
              const isActive = activeTemplateKey === preset.key;
              return (
                <button
                  key={preset.key}
                  disabled={isLoading}
                  onClick={() => onSelectTemplate(preset.key)}
                  className={`px-space-md py-1.5 rounded-full font-label-md text-label-md transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-lowest hover:bg-surface-container-high text-on-surface shadow-xs"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
