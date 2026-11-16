"use client";

import React, { useState } from "react";
import { OrderDateRangePicker } from "../OrderDateRangePicker";

interface Props {
  modificationCount: number;
  onOpenAddDrawer: () => void;
  onResetDefaults: () => void;
  onDiscard: () => void;
  onApply: () => void;
  isSaving: boolean;
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

export function DashboardControlBar({
  modificationCount,
  onOpenAddDrawer,
  onResetDefaults,
  onDiscard,
  onApply,
  isSaving,
  startDate,
  endDate,
  datePreset,
  onDateRangeChange,
  countryCode,
  timezone,
}: Props) {
  const [showGuides, setShowGuides] = useState(false);
  const hasModifications = modificationCount > 0;

  return (
    <section className="sticky top-0 z-30 w-full bg-secondary-container/95 backdrop-blur-md px-margin py-2 shadow-xs transition-all duration-200 border-b border-outline-variant/30">
      <div className="w-full flex flex-wrap items-center justify-between gap-y-2 gap-x-space-md">
        {/* Left Cluster: Engine Status + Calendar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-on-primary shadow-xs">
            <span className="material-symbols-outlined text-[16px]">tune</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 relative">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  hasModifications ? "bg-error" : "bg-emerald-500"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  hasModifications ? "bg-error" : "bg-emerald-600"
                }`}
              />
            </span>
            <span className="text-[12px] font-semibold text-on-secondary-container tracking-wide">
              {hasModifications
                ? `${modificationCount} Unsaved`
                : "Saved"}
            </span>
          </div>

          {onDateRangeChange && startDate && endDate && (
            <>
              <span className="text-outline/30 mx-1 hidden sm:inline">|</span>
              <div className="relative z-30">
                <OrderDateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  preset={datePreset || "Today"}
                  onChange={onDateRangeChange}
                  countryCode={countryCode || "IN"}
                  timezone={timezone}
                  variant="default"
                  align="left"
                />
              </div>
            </>
          )}
        </div>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Guides Button & Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGuides(!showGuides)}
              className="text-secondary hover:text-primary flex items-center gap-1 cursor-pointer transition-colors text-label-sm font-label-sm px-2.5 py-1.5 rounded-full hover:bg-surface-container-high/60"
              title="Canvas Grid Guides"
            >
              <span className="material-symbols-outlined text-[16px]">help</span>
              <span>Guides</span>
            </button>

            {showGuides && (
              <div className="absolute right-0 top-10 z-50 w-72 bg-surface rounded-DEFAULT shadow-xl border border-outline-variant p-space-md text-on-surface">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container mb-2">
                  <span className="font-label-md text-label-md font-semibold">
                    Canvas Grid Guides
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGuides(false)}
                    className="text-outline hover:text-on-surface cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      close
                    </span>
                  </button>
                </div>
                <ul className="space-y-1.5 text-xs text-secondary list-disc pl-4">
                  <li>
                    Drag cards via the <strong>Drag handle</strong> to reorder.
                  </li>
                  <li>
                    Click <strong>Cols pill</strong> or bottom-right handle to cycle
                    widths (4, 6, 8, 12).
                  </li>
                  <li>
                    Press <strong>Apply Canvas</strong> to persist modifications to
                    your profile.
                  </li>
                  <li>
                    Switch between shift views with the preset templates tray below.
                  </li>
                </ul>
              </div>
            )}
          </div>

          <span className="text-outline/30 mx-0.5 hidden sm:inline">|</span>

          {/* Add Widget */}
          <button
            type="button"
            onClick={onOpenAddDrawer}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors shadow-xs font-label-sm text-label-sm active:scale-95 cursor-pointer font-medium"
            id="add-widget-btn"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add Widget</span>
          </button>

          {/* Reset Defaults: Compact Icon Button with Tooltip */}
          <div className="relative group flex items-center">
            <button
              type="button"
              onClick={onResetDefaults}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-dim transition-colors active:scale-95 cursor-pointer shadow-xs"
              aria-label="Reset Defaults"
            >
              <span className="material-symbols-outlined text-[18px]">
                restart_alt
              </span>
            </button>
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap bg-inverse-surface text-inverse-on-surface text-[11px] font-medium px-2.5 py-1 rounded shadow-lg">
              Reset Defaults
            </div>
          </div>

          {/* Discard */}
          <button
            type="button"
            onClick={onDiscard}
            disabled={!hasModifications || isSaving}
            className={`px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-colors ${
              hasModifications
                ? "text-secondary hover:text-on-surface hover:bg-surface-container-high/50 active:scale-95 cursor-pointer"
                : "text-outline/40 cursor-not-allowed"
            }`}
          >
            Discard
          </button>

          {/* Apply Canvas */}
          <button
            type="button"
            onClick={onApply}
            disabled={!hasModifications || isSaving}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-label-sm text-label-sm shadow-xs transition-all font-medium ${
              hasModifications
                ? "bg-primary text-on-primary hover:bg-inverse-surface active:scale-95 cursor-pointer shadow-sm"
                : "bg-primary/30 text-on-primary/60 cursor-not-allowed shadow-none"
            }`}
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">
                  check_circle
                </span>
                <span>
                  Apply Canvas{hasModifications ? ` (${modificationCount})` : ""}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
