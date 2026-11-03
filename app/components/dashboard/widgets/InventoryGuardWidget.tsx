"use client";

import React from "react";
import Link from "next/link";
import { Id } from "../../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface WidgetProps {
  organizationId: Id<"organizations">;
  widgetId: string;
  width: number;
  dateRangePreset?: any;
  fromTimestamp?: number;
  toTimestamp?: number;
  dateLabel?: string;
}

export function InventoryGuardWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId: widgetId || "inventory_critical_reorder",
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const summary = (widgetData as any)?.summary || (widgetData as any)?.payload;
  const alertCount = widgetData?.alert?.count ?? summary?.alertCount ?? 0;
  const items: Array<{
    name: string;
    stockRemaining: string;
    level: string;
    isCritical: boolean;
    actionLabel: string;
  }> = summary?.depletedItems ?? [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Inventory Guard
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            Critical Re-order Depletions
          </h3>
        </div>
        <span className={`font-label-md text-label-md px-2 py-0.5 rounded-full font-semibold ${
          alertCount > 0 ? "bg-error-container text-on-error-container" : "bg-surface-container text-on-surface"
        }`}>
          {alertCount} Alerts
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-surface-container-low rounded-lg text-secondary my-space-md">
          <span className="material-symbols-outlined text-3xl mb-1 text-emerald-600">check_circle</span>
          <span className="text-body-sm font-medium text-on-surface">All stock levels optimal</span>
          <span className="text-label-sm text-outline">0 critical depletions detected</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm my-space-sm">
          {items.slice(0, 3).map((item, idx) => (
          <div
            key={idx}
            className="p-space-sm rounded-DEFAULT bg-surface-container-low flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-label-sm font-label-sm uppercase font-semibold ${
                  item.isCritical ? "text-error" : "text-on-tertiary-container"
                }`}
              >
                {item.level}
              </span>
              <span
                className={`material-symbols-outlined text-[16px] ${
                  item.isCritical ? "text-error" : "text-on-tertiary-container"
                }`}
              >
                {item.isCritical ? "warning" : "hourglass_bottom"}
              </span>
            </div>
            <div className="my-1">
              <div className="font-headline-sm text-headline-sm text-on-surface font-medium truncate">
                {item.name}
              </div>
              <div className="text-label-sm text-secondary">{item.stockRemaining}</div>
            </div>
            <Link
              href="/inventory"
              className="mt-1 text-label-sm font-label-sm text-primary font-semibold text-left underline hover:text-outline transition-colors"
            >
              {item.actionLabel}
            </Link>
          </div>
        ))}
      </div>
      )}

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span>
          Supplier Sync: <strong className="text-on-surface">Active EDI</strong>
        </span>
        <span className="text-label-sm font-label-sm text-outline">Trigger Point: 15% Min Threshold</span>
      </div>
    </div>
  );
}
