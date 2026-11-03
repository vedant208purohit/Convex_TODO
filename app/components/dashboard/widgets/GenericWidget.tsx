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

export function GenericWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const widgetDef = useQuery(api.dashboards.getWidgetDefinitionById, { widgetId });

  const title = widgetDef?.name || widgetId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const category = widgetDef?.category || "Overview";
  const payload = (widgetData as any)?.payload;

  // Extract metric from kpi, alert, table, or chart
  const primaryValue =
    widgetData?.kpi?.displayValue ??
    (widgetData?.kpi?.value !== undefined ? String(widgetData.kpi.value) : undefined) ??
    (widgetData?.alert ? `${widgetData.alert.count ?? 0} Alerts` : undefined) ??
    (widgetData?.table ? `${widgetData.table.rows?.length ?? 0} Items` : undefined) ??
    payload?.primaryValue ??
    payload?.netRevenueFormatted ??
    payload?.totalOrders ??
    payload?.count ??
    "0";

  const secondaryValue =
    widgetData?.kpi?.deltaLabel ??
    widgetData?.alert?.title ??
    payload?.secondaryValue ??
    payload?.deltaLabel ??
    "Live Data Synchronized";

  const badgeText = dateLabel || (dateRangePreset ? dateRangePreset.replace(/_/g, " ").toUpperCase() : "Real-time");

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            {category}
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
            {title}
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {badgeText}
        </span>
      </div>

      <div className="my-auto py-space-sm flex flex-col">
        <div className="font-display-sm text-display-sm text-on-surface font-normal">
          {primaryValue}
        </div>
        <div className="font-body-sm text-body-sm text-secondary mt-1">
          {secondaryValue}
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span className="text-label-sm font-label-sm text-outline">Widget ID: {widgetId}</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}
