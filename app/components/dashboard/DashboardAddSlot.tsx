"use client";

import React, { useState } from "react";

interface Props {
  onOpenDrawer: () => void;
  onQuickAdd: (widgetId: string, defaultWidth?: number) => void;
  onDropWidgetAtEnd?: () => void;
  isDraggingAny?: boolean;
}

export function DashboardAddSlot({
  onOpenDrawer,
  onQuickAdd,
  onDropWidgetAtEnd,
  isDraggingAny,
}: Props) {
  const [isHoveringDrop, setIsHoveringDrop] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!isDraggingAny) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (!isHoveringDrop) setIsHoveringDrop(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveringDrop(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHoveringDrop(false);
    if (onDropWidgetAtEnd) {
      onDropWidgetAtEnd();
    }
  };

  return (
    <div
      onClick={onOpenDrawer}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`col-span-12 relative rounded-DEFAULT p-space-xl transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer group ${
        isHoveringDrop
          ? "bg-primary/10 border-2 border-dashed border-primary ring-2 ring-primary ring-offset-2 ring-offset-surface"
          : "bg-surface-container-low/50 hover:bg-surface-container-low shadow-[inset_0_0_0_2px_#cfc4c5] hover:shadow-[inset_0_0_0_2px_#7f7570]"
      }`}
    >
      {isHoveringDrop ? (
        <div className="flex flex-col items-center justify-center py-2 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md mb-2">
            <span className="material-symbols-outlined text-[24px]">vertical_align_bottom</span>
          </div>
          <span className="font-headline-sm text-headline-sm text-primary font-semibold">
            Drop Here to Move to End of Canvas
          </span>
          <span className="font-body-sm text-body-sm text-secondary mt-0.5">
            Widget will be positioned after all active slots
          </span>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-surface-container-highest group-hover:bg-primary group-hover:text-on-primary transition-all flex items-center justify-center text-on-surface shadow-xs mb-space-sm">
            <span className="material-symbols-outlined text-[24px]">add</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            Add Widget to Canvas
          </h3>
          <p className="font-body-sm text-body-sm text-secondary max-w-md mt-0.5 mb-space-md">
            Click to browse all widgets or quick-add a popular component below
          </p>

          {/* Quick insert pills */}
          <div
            className="flex flex-wrap items-center justify-center gap-space-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onQuickAdd("customers_total", 4)}
              className="flex items-center gap-1.5 px-space-md py-1.5 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface text-label-md font-label-md transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">groups</span>
              <span>+ Total Customers</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd("menu_top_selling", 6)}
              className="flex items-center gap-1.5 px-space-md py-1.5 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface text-label-md font-label-md transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">restaurant_menu</span>
              <span>+ Top Selling Dishes</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd("cashier_payment_breakdown", 4)}
              className="flex items-center gap-1.5 px-space-md py-1.5 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface text-label-md font-label-md transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">payments</span>
              <span>+ Payment Breakdown (Cash/UPI/Cards)</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd("orders_live_feed", 6)}
              className="flex items-center gap-1.5 px-space-md py-1.5 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface text-label-md font-label-md transition-colors shadow-sm cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span>+ Live Orders Feed</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
