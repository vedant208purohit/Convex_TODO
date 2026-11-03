"use client";

import React from "react";

interface Props {
  modificationCount: number;
  onOpenAddDrawer: () => void;
  onResetDefaults: () => void;
  onDiscard: () => void;
  onApply: () => void;
  isSaving: boolean;
}

export function DashboardControlBar({
  modificationCount,
  onOpenAddDrawer,
  onResetDefaults,
  onDiscard,
  onApply,
  isSaving,
}: Props) {
  const hasModifications = modificationCount > 0;

  return (
    <section className="sticky top-0 z-30 w-full bg-secondary-container/95 backdrop-blur-md px-margin py-space-md shadow-sm transition-all duration-300 border-b border-outline-variant/30">
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="inline-flex items-center px-space-sm py-0.5 rounded-full text-label-sm font-label-sm uppercase bg-primary text-on-primary font-medium tracking-wide">
                Layout Engine Active
              </span>
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
              <span className="text-label-sm font-label-sm text-on-secondary-container uppercase tracking-wider font-semibold">
                {hasModifications
                  ? `Unsaved Staging: ${modificationCount} Modification${
                      modificationCount > 1 ? "s" : ""
                    }`
                  : "In Sync"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Cluster */}
        <div className="flex items-center gap-space-sm flex-wrap">
          <button
            onClick={onOpenAddDrawer}
            className="flex items-center gap-space-xs px-space-md py-space-sm rounded-full bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors shadow-sm font-label-md text-label-md active:scale-95 cursor-pointer"
            id="add-widget-btn"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Widget</span>
          </button>

          <button
            onClick={onResetDefaults}
            className="flex items-center gap-space-xs px-space-md py-space-sm rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-dim transition-colors font-label-md text-label-md active:scale-95 cursor-pointer"
            title="Reset to store default layout"
          >
            <span className="material-symbols-outlined text-[18px]">
              restart_alt
            </span>
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={onDiscard}
            disabled={!hasModifications || isSaving}
            className={`px-space-md py-space-sm rounded-full font-label-md text-label-md transition-colors cursor-pointer ${
              hasModifications
                ? "text-secondary hover:text-on-surface hover:bg-surface-container-high/50 active:scale-95"
                : "text-outline/50 cursor-not-allowed"
            }`}
          >
            Discard
          </button>

          <button
            onClick={onApply}
            disabled={!hasModifications || isSaving}
            className={`flex items-center gap-space-xs px-space-lg py-space-sm rounded-full font-label-md text-label-md shadow-md transition-all ${
              hasModifications
                ? "bg-primary text-on-primary hover:bg-inverse-surface active:scale-95 cursor-pointer"
                : "bg-primary/40 text-on-primary/60 cursor-not-allowed shadow-none"
            }`}
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">
                  check_circle
                </span>
                <span>
                  Apply Canvas{" "}
                  {hasModifications ? `(${modificationCount})` : ""}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
