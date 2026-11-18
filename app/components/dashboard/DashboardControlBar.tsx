"use client";

import React from "react";
import { OrderDateRangePicker } from "../OrderDateRangePicker";

interface Props {
  modificationCount: number;
  onOpenAddDrawer: () => void;
  onResetDefaults?: () => void;
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
  isEditMode?: boolean;
  onToggleEditMode?: () => void;
}

export function DashboardControlBar({
  modificationCount,
  onOpenAddDrawer,
  onDiscard,
  onApply,
  isSaving,
  startDate,
  endDate,
  datePreset,
  onDateRangeChange,
  countryCode,
  timezone,
  isEditMode = false,
  onToggleEditMode,
}: Props) {
  const hasModifications = modificationCount > 0;

  return (
    <section className="sticky top-0 z-30 w-full bg-secondary-container/95 backdrop-blur-md px-margin py-2 shadow-xs transition-all duration-200 border-b border-outline-variant/30">
      <div className="w-full flex flex-wrap items-center justify-between gap-y-2 gap-x-space-md">
        {/* Left Cluster: Calendar Date Range Picker */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onDateRangeChange && startDate && endDate && (
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
          )}
        </div>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit Mode Toggle Button */}
          {onToggleEditMode && (
            <button
              type="button"
              onClick={onToggleEditMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-all shadow-xs active:scale-95 cursor-pointer font-medium ${
                isEditMode
                  ? "bg-stone-900 text-white hover:bg-stone-800 shadow-sm"
                  : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-high border border-outline-variant/40"
              }`}
              title={isEditMode ? "Exit Edit Mode" : "Enter Edit Mode to customize widgets"}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isEditMode ? "check" : "edit"}
              </span>
              <span>{isEditMode ? "Done" : "Edit"}</span>
            </button>
          )}

          {/* Add Widget - Always visible */}
          <button
            type="button"
            onClick={onOpenAddDrawer}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors shadow-xs font-label-sm text-label-sm active:scale-95 cursor-pointer font-medium border border-outline-variant/40"
            id="add-widget-btn"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add Widget</span>
          </button>

          {/* Discard (Visible when there are unsaved changes) */}
          {hasModifications && (
            <button
              type="button"
              onClick={onDiscard}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-full font-label-sm text-label-sm transition-colors text-secondary hover:text-on-surface hover:bg-surface-container-high/50 active:scale-95 cursor-pointer"
            >
              Discard
            </button>
          )}

          {/* Save Layout */}
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
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">
                  check_circle
                </span>
                <span>
                  Save Layout{hasModifications ? ` (${modificationCount})` : ""}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
