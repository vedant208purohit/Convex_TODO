"use client";

import React from "react";
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

export function BeveragePullRateWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId: widgetId || "iot_beverage_pour_rate",
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const summary = (widgetData as any)?.summary || (widgetData as any)?.payload;
  const totalOrders = (widgetData?.kpi?.value as number) ?? summary?.totalOrders ?? summary?.totalVolume ?? 0;
  const craftPercent = totalOrders > 0 ? (summary?.craftPercent ?? 0) : 0;
  const items: Array<{ name: string; count: number; progress: number; barClass?: string }> = summary?.topSpirits ?? [];
  const bottleVariance = totalOrders > 0 ? (summary?.bottleVariance || "0.0%") : "0.0%";

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Mixology Station
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Beverage Pull Rate</h3>
        </div>
        <span className="font-label-md text-label-md px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold">
          {totalOrders} Orders
        </span>
      </div>

      {/* Metric Donut & Top Spirits */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-surface-container-low rounded-lg text-secondary my-space-md">
          <span className="material-symbols-outlined text-3xl mb-1 text-outline">local_bar</span>
          <span className="text-body-sm font-medium">No beverage telemetry recorded</span>
          <span className="text-label-sm text-outline">Dispenser pour rates will reflect here</span>
        </div>
      ) : (
        <div className="flex items-center gap-space-md py-space-sm">
          <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-surface-container"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="text-primary"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${craftPercent}, 100`}
                strokeLinecap="round"
                strokeWidth="4"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline-sm text-headline-sm leading-none text-on-surface font-semibold">
                {craftPercent}%
              </span>
              <span className="font-label-sm text-label-sm text-outline scale-90">Craft</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 w-full text-body-sm font-body-sm">
            {items.map((it: any, i: number) => (
              <div key={i} className="flex flex-col gap-0.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-on-surface font-medium truncate">{it.name}</span>
                  <span className="font-semibold text-on-surface ml-1">{it.count}</span>
                </div>
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${it.barClass || (i === 0 ? "bg-primary" : "bg-secondary")}`}
                    style={{ width: `${it.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-space-sm pt-space-xs flex justify-between items-center text-body-sm font-body-sm text-secondary border-t border-surface-container/60">
        <span>
          Bottle Variance: <strong className="text-on-surface">{bottleVariance}</strong>
        </span>
        <span className="text-label-sm font-label-sm text-outline">Real-time Dispenser</span>
      </div>
    </div>
  );
}
