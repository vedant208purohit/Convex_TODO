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

export function FloorOccupancyWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId: widgetId || "orders_dinein_occupancy",
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const summary = (widgetData as any)?.summary || (widgetData as any)?.payload;
  const occupancyPercent = (widgetData?.kpi?.value as number) ?? summary?.occupancyPercent ?? summary?.occupancyRate ?? 0;
  const activeTablesMetric = widgetData?.kpi?.secondaryMetrics?.find((m) => m.label.includes("Active"));
  const totalTablesMetric = widgetData?.kpi?.secondaryMetrics?.find((m) => m.label.includes("Total"));
  const occupiedTables = (activeTablesMetric?.value as number) ?? summary?.occupiedTablesCount ?? 0;
  const totalTables = (totalTablesMetric?.value as number) ?? summary?.totalTablesCount ?? 0;
  const turnRate = totalTables > 0 && occupiedTables > 0 ? (summary?.turnRate ?? 1.2) : 0;

  // Real table layout from summary or empty state if no tables configured
  const tablesList: Array<{ code: string; capacity: string; status: "occupied" | "vacant" | "billed" }> =
    summary?.tables ?? [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Terrace & Main Salon
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Floor Occupancy</h3>
        </div>
        <span className="font-label-md text-label-md px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold">
          {occupancyPercent}% Cap
        </span>
      </div>

      {/* Occupancy Visual Matrix */}
      {tablesList.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-surface-container-low rounded-lg text-secondary my-space-md">
          <span className="material-symbols-outlined text-3xl mb-1 text-outline">table_restaurant</span>
          <span className="text-body-sm font-medium">No dining tables configured</span>
          <span className="text-label-sm text-outline">Add tables in Organization Settings</span>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 my-space-md">
          {tablesList.slice(0, 8).map((table, idx) => {
            let cardStyle = "bg-primary text-on-primary";
            let capStyle = "font-bold";
            if (table.status === "vacant") {
              cardStyle = "bg-surface-container-high text-on-surface-variant";
              capStyle = "font-semibold";
            } else if (table.status === "billed") {
              cardStyle = "bg-secondary-container text-on-secondary-container";
              capStyle = "font-semibold";
            }

            return (
              <div key={idx} className={`p-2 rounded text-center transition-all ${cardStyle}`}>
                <div className="font-label-sm text-label-sm opacity-70">{table.code}</div>
                <div className={`font-label-md text-label-md ${capStyle}`}>{table.capacity}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span>
          Seated: <strong className="text-on-surface">{occupiedTables}/{totalTables} Tables</strong>
        </span>
        <span className="flex items-center gap-1 text-on-surface-variant">
          <span className="w-2 h-2 rounded-full bg-primary"></span>
          <span>Turn rate: {turnRate > 0 ? `${turnRate}x` : "--"}</span>
        </span>
      </div>
    </div>
  );
}
