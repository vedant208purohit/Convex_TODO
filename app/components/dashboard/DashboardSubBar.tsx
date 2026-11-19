"use client";

import React, { useState } from "react";
import { OrderDateRangePicker } from "../OrderDateRangePicker";

interface Props {
  userName?: string;
  userRole?: string;
  gridResolution?: "1440px Fluid" | "Compact 1200px";
  onResolutionChange?: (res: "1440px Fluid" | "Compact 1200px") => void;
  autoAlign?: boolean;
  onToggleAutoAlign?: () => void;
  startDate?: Date;
  endDate?: Date;
  datePreset?: string;
  onDateRangeChange?: (range: {
    startDate: Date;
    endDate: Date;
    preset: string;
  }) => void;
  countryCode?: string;
  timezone?: string;
}

export function DashboardSubBar({
  startDate,
  endDate,
  datePreset,
  onDateRangeChange,
  countryCode,
  timezone,
}: Props) {
  const [showGuides, setShowGuides] = useState(false);

  return (
    <div className="w-full px-margin py-space-sm bg-surface-container-low flex flex-wrap items-center justify-between text-body-sm font-body-sm text-secondary border-b border-surface-container/60 gap-y-2">
      <div className="flex items-center gap-space-md flex-wrap">
        {onDateRangeChange && startDate && endDate && (
          <div className="relative z-30">
            <OrderDateRangePicker
              startDate={startDate}
              endDate={endDate}
              preset={datePreset || "Today"}
              onChange={onDateRangeChange}
              countryCode={countryCode || "IN"}
              timezone={timezone}
              variant="pill"
              align="left"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-space-sm text-label-sm font-label-sm relative">
        <button
          onClick={() => setShowGuides(!showGuides)}
          className="text-outline hover:text-primary flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">help</span>
          <span>Guides</span>
        </button>

        {showGuides && (
          <div className="absolute right-0 top-8 z-40 w-72 bg-surface rounded-DEFAULT shadow-xl border border-outline-variant p-space-md text-on-surface">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container mb-2">
              <span className="font-label-md text-label-md font-semibold">
                Canvas Grid Guides
              </span>
              <button
                onClick={() => setShowGuides(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">
                  close
                </span>
              </button>
            </div>
            <ul className="space-y-1.5 text-xs text-secondary list-disc pl-4">
              <li>
                Drag any card directly to reorder widgets across the canvas.
              </li>
              <li>
                Click <strong>Edit</strong> in the top bar to enter edit mode, customize widgets, or add new ones.
              </li>
              <li>
                Resize widgets using the bottom-right corner handle or <strong>⚙ Settings</strong> (4, 6, 8, 12 cols).
              </li>
              <li>
                Press <strong>Apply Canvas</strong> to save your customized layout.
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
