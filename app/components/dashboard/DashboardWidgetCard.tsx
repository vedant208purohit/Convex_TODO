"use client";

import React, { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { DashboardWidgetRenderer } from "./DashboardWidgetRenderer";

export interface DashboardPlacementItem {
  widgetId: string;
  gridRow: number;
  gridCol: number;
  width: number;
  height: number;
  displayOrder: number;
  isEnabled: boolean;
  configuration?: any;
}

interface Props {
  organizationId: Id<"organizations">;
  placement: DashboardPlacementItem;
  index: number;
  onRemove: (widgetId: string) => void;
  onResize: (widgetId: string, nextWidth: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number, position: "before" | "after") => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number, position: "before" | "after") => void;
  onDragEnd: (e: React.DragEvent) => void;
  onMoveEarlier?: (index: number) => void;
  onMoveLater?: (index: number) => void;
  canMoveEarlier?: boolean;
  canMoveLater?: boolean;
  isDraggingThis: boolean;
  isDraggingAny: boolean;
  dropPosition: "before" | "after" | null;
  dateRangePreset?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  dateLabel?: string;
}

export function DashboardWidgetCard({
  organizationId,
  placement,
  index,
  onRemove,
  onResize,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveEarlier,
  onMoveLater,
  canMoveEarlier,
  canMoveLater,
  isDraggingThis,
  isDraggingAny,
  dropPosition,
  dateRangePreset,
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: Props) {
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Map width to Tailwind grid column span classes
  const getColSpanClass = (w: number) => {
    switch (w) {
      case 12:
        return "col-span-12";
      case 8:
        return "col-span-12 lg:col-span-8";
      case 6:
        return "col-span-12 lg:col-span-6";
      case 4:
      default:
        return "col-span-12 sm:col-span-6 lg:col-span-4";
    }
  };

  const cycleWidth = () => {
    const cycleMap: Record<number, number> = {
      4: 6,
      6: 8,
      8: 12,
      12: 4,
    };
    const nextW = cycleMap[placement.width] || 4;
    onResize(placement.widgetId, nextW);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const pos: "before" | "after" = e.clientX <= midX ? "before" : "after";

    onDragOver(e, index, pos);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const pos: "before" | "after" = e.clientX <= midX ? "before" : "after";

    onDrop(e, index, pos);
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
      className={`${getColSpanClass(
        placement.width
      )} group relative rounded-DEFAULT p-space-lg shadow-sm transition-all duration-150 select-none ${
        isDraggingThis
          ? "opacity-35 bg-surface-container/60 border-2 border-dashed border-primary/40"
          : "bg-surface-container-lowest hover:shadow-md cursor-grab active:cursor-grabbing"
      } ${
        dropPosition && !isDraggingThis
          ? "ring-2 ring-primary ring-offset-2 ring-offset-surface bg-primary/[0.02]"
          : ""
      }`}
    >
      {/* Drop Target Indicator Bar */}
      {dropPosition && !isDraggingThis && (
        <>
          {dropPosition === "before" && (
            <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-primary rounded-l-DEFAULT shadow-[0_0_12px_rgba(27,27,31,0.5)] z-30 pointer-events-none flex items-center justify-start">
              <span className="absolute -top-3 left-1 bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider flex items-center gap-0.5 whitespace-nowrap">
                <span className="material-symbols-outlined text-[12px]">arrow_back</span>
                Place Before
              </span>
            </div>
          )}
          {dropPosition === "after" && (
            <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-primary rounded-r-DEFAULT shadow-[0_0_12px_rgba(27,27,31,0.5)] z-30 pointer-events-none flex items-center justify-end">
              <span className="absolute -top-3 right-1 bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider flex items-center gap-0.5 whitespace-nowrap">
                Place After
                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              </span>
            </div>
          )}
        </>
      )}

      {/* Edit State Indicator Overlay Outline (Subtle border on hover) */}
      <div className="absolute inset-0 rounded-DEFAULT pointer-events-none transition-all shadow-none group-hover:shadow-[inset_0_0_0_2px_#7f7570]" />

      {/* Floating Edit Badge Toolbar (Appears on Hover) */}
      <div
        className={`absolute -top-3.5 right-4 z-20 flex items-center gap-1 bg-primary text-on-primary px-2.5 py-1 rounded-full shadow-lg transition-all duration-200 ${
          showConfigModal
            ? "opacity-100 pointer-events-auto translate-y-0 scale-100"
            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto -translate-y-1 group-hover:translate-y-0 scale-95 group-hover:scale-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-1 pr-1 cursor-grab active:cursor-grabbing hover:text-secondary-fixed text-label-sm font-label-sm"
          title="Drag anywhere on card or handle to reorder"
        >
          <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
          <span>Drag</span>
        </div>

        {/* Quick Shift Buttons */}
        {canMoveEarlier && onMoveEarlier && (
          <button
            type="button"
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMoveEarlier(index);
            }}
            className="p-0.5 hover:text-secondary-fixed transition-colors cursor-pointer"
            title="Move Earlier"
          >
            <span className="material-symbols-outlined text-[14px]">chevron_left</span>
          </button>
        )}
        {canMoveLater && onMoveLater && (
          <button
            type="button"
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMoveLater(index);
            }}
            className="p-0.5 hover:text-secondary-fixed transition-colors cursor-pointer"
            title="Move Later"
          >
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          </button>
        )}

        <span className="w-px h-3 bg-surface-tint" />
        <button
          type="button"
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            cycleWidth();
          }}
          className="px-1.5 py-0.5 rounded bg-surface-container-high/30 hover:bg-surface-container-high/50 text-surface text-label-sm font-label-sm transition-colors cursor-pointer"
          title="Click to cycle column width (4, 6, 8, 12)"
        >
          {placement.width} Cols
        </button>
        <span className="w-px h-3 bg-surface-tint" />
        <button
          type="button"
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setShowConfigModal(!showConfigModal);
          }}
          className="p-1 hover:text-secondary-fixed transition-colors cursor-pointer"
          title="Widget Options"
        >
          <span className="material-symbols-outlined text-[15px]">settings</span>
        </button>
        <button
          type="button"
          draggable={false}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(placement.widgetId);
          }}
          className="p-1 hover:text-error transition-colors cursor-pointer"
          title="Remove Widget"
        >
          <span className="material-symbols-outlined text-[15px]">close</span>
        </button>
      </div>

      {/* Actual Live Widget Renderer */}
      <div
        className={`w-full h-full min-h-[170px] flex flex-col ${
          isDraggingAny ? "pointer-events-none" : ""
        }`}
      >
        <DashboardWidgetRenderer
          organizationId={organizationId}
          widgetId={placement.widgetId}
          width={placement.width}
          dateRangePreset={placement.configuration?.dateRangePreset || dateRangePreset}
          fromTimestamp={fromTimestamp}
          toTimestamp={toTimestamp}
          dateLabel={placement.configuration?.dateRangePreset ? `Locked: ${placement.configuration.dateRangePreset}` : dateLabel}
        />
      </div>

      {/* Corner Resize Handle */}
      <button
        type="button"
        draggable={false}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          cycleWidth();
        }}
        className="absolute bottom-1.5 right-1.5 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 text-outline hover:text-primary transition-all cursor-pointer opacity-0 group-hover:opacity-100"
        title="Click to resize columns"
      >
        <svg fill="currentColor" height="10" viewBox="0 0 10 10" width="10">
          <path d="M8 2 L10 2 L10 10 L2 10 L2 8 L8 8 Z"></path>
          <path d="M5 5 L7 5 L7 7 L5 7 Z"></path>
        </svg>
      </button>

      {/* Widget Settings Tooltip/Modal */}
      {showConfigModal && (
        <div
          className="absolute top-10 right-4 z-30 w-64 bg-surface rounded-DEFAULT shadow-xl border border-outline-variant p-space-md text-on-surface"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 border-b border-surface-container">
            <span className="font-label-md text-label-md font-semibold">Widget Config</span>
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
              className="text-outline hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
          <div className="py-2 space-y-2 text-body-sm font-body-sm">
            <div className="flex justify-between items-center">
              <span className="text-secondary">Width Span:</span>
              <div className="flex gap-1">
                {[4, 6, 8, 12].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      onResize(placement.widgetId, w);
                      setShowConfigModal(false);
                    }}
                    className={`px-2 py-0.5 rounded text-xs cursor-pointer ${
                      placement.width === w
                        ? "bg-primary text-on-primary font-bold"
                        : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-secondary">Data Cadence:</span>
              <span className="font-medium text-xs">Realtime WebSocket</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
