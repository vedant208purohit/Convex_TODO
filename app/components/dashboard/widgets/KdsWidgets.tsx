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

// 1. Live Kitchen Orders Widget
export function KdsLiveOrdersWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const capacityPercent =
    typeof summary.capacityPercent === "number" ? summary.capacityPercent : 0;
  const inPrepCount =
    typeof summary.inPrepCount === "number"
      ? summary.inPrepCount
      : widgetData?.kpi?.value || 0;
  const atPassCount =
    typeof summary.atPassCount === "number" ? summary.atPassCount : 0;
  const rows = widgetData?.table?.rows || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-[10px] tracking-widest uppercase">
              LIVE
            </span>
            <span className="font-label-sm text-[11px] text-on-surface-variant flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Streaming
            </span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
            Live Kitchen Orders
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-sm my-auto">
        <div className="flex items-center justify-between text-on-surface">
          <span className="font-label-md text-label-md uppercase tracking-wider text-secondary">
            Workstation Traffic
          </span>
          <span className="font-label-sm text-label-sm font-semibold">
            {capacityPercent > 0
              ? `${capacityPercent}% Capacity`
              : "Normal Pace"}
          </span>
        </div>

        <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${Math.max(4, Math.min(100, capacityPercent))}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
          <div className="bg-surface-container-lowest p-space-sm rounded-DEFAULT flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
              In Prep
            </span>
            <span className="font-headline-md text-headline-md text-on-surface mt-0.5">
              {String(inPrepCount).padStart(2, "0")}
            </span>
            <span className="font-body-sm text-body-sm text-secondary">
              Active tickets
            </span>
          </div>

          <div className="bg-surface-container-lowest p-space-sm rounded-DEFAULT flex flex-col">
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
              At Pass
            </span>
            <span className="font-headline-md text-headline-md text-on-surface mt-0.5">
              {String(atPassCount).padStart(2, "0")}
            </span>
            <span className="font-body-sm text-body-sm text-secondary">
              Ready to serve
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span className="text-label-sm font-label-sm text-outline">
          {rows.length > 0
            ? `${rows.length} Tickets in Stream`
            : "0 Active Tickets"}
        </span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// 2. Pending Kitchen Orders Widget
export function KdsPendingTicketsWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const pendingCount =
    typeof summary.pendingCount === "number"
      ? summary.pendingCount
      : widgetData?.kpi?.value || 0;
  const oldestElapsed = summary.oldestElapsed || "--";
  const attentionRequired = summary.statusTag === "Attention";

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-on-tertiary-container flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-[13px]">
                timer
              </span>
              Hold Queue
            </span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
            Pending Kitchen Orders
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col justify-between gap-space-md my-auto">
        <div className="flex items-start justify-between">
          <div>
            <span className="font-display-sm text-display-sm text-on-surface font-normal leading-none">
              {pendingCount}
            </span>
            <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary mt-1">
              Tickets Pending Fire
            </p>
          </div>

          <div
            className={`px-space-sm py-1 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1 ${
              attentionRequired
                ? "bg-tertiary-fixed text-on-tertiary-fixed"
                : "bg-surface-container-lowest text-secondary"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${attentionRequired ? "bg-on-tertiary-fixed" : "bg-primary"}`}
            />
            {attentionRequired ? "Attention" : "Optimal"}
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-sm rounded-DEFAULT flex items-center justify-between">
          <div className="flex items-center gap-space-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">
              history
            </span>
            <span className="font-body-sm text-body-sm">Oldest in buffer</span>
          </div>
          <span className="font-label-md text-label-md text-on-surface font-semibold">
            {oldestElapsed}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span className="text-label-sm font-label-sm text-outline">
          Kitchen Display
        </span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// 3. Specific KDS Station Widget
export function KdsStationQueueWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const stationName = summary.stationName || "Tandoor & Clay Oven";
  const stationTag = summary.stationTag || "Stn 02";
  const stationTickets =
    typeof summary.ticketsCount === "number"
      ? summary.ticketsCount
      : widgetData?.kpi?.value || 0;
  const stationAvgPrep = summary.avgPrepText || "--";
  const stationLoadPercent =
    typeof summary.loadPercent === "number" ? summary.loadPercent : 0;

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-surface-variant text-on-surface-variant font-label-sm text-[10px] tracking-widest uppercase">
              CONFIGURABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary font-medium">
              Station Filtered
            </span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
            Specific KDS Station
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-sm my-auto">
        <div className="flex items-center justify-between bg-surface-container-lowest px-space-sm py-1.5 rounded-full">
          <span className="font-label-sm text-label-sm text-on-surface font-semibold truncate">
            {stationName}
          </span>
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-secondary">
            {stationTag}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-space-xs text-center pt-1">
          <div className="bg-surface-container-lowest p-space-xs rounded-DEFAULT">
            <span className="font-label-sm text-label-sm text-secondary block">
              Tickets
            </span>
            <span className="font-headline-md text-headline-md text-on-surface">
              {String(stationTickets).padStart(2, "0")}
            </span>
          </div>

          <div className="bg-surface-container-lowest p-space-xs rounded-DEFAULT">
            <span className="font-label-sm text-label-sm text-secondary block">
              Avg Prep
            </span>
            <span className="font-headline-md text-headline-md text-on-surface">
              {stationAvgPrep}
            </span>
          </div>

          <div className="bg-surface-container-lowest p-space-xs rounded-DEFAULT">
            <span className="font-label-sm text-label-sm text-secondary block">
              Load
            </span>
            <span className="font-headline-md text-headline-md text-on-surface">
              {stationLoadPercent}%
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span className="text-label-sm font-label-sm text-outline">
          Station: {stationName}
        </span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// 4. Kitchen Order Status Breakdown Widget
export function KdsStatusBreakdownWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const bInPrep = typeof summary.inPrep === "number" ? summary.inPrep : 0;
  const bReady = typeof summary.ready === "number" ? summary.ready : 0;
  const bHeld = typeof summary.held === "number" ? summary.held : 0;
  const bOverdue = typeof summary.overdue === "number" ? summary.overdue : 0;
  const bTotal =
    typeof summary.total === "number"
      ? summary.total
      : bInPrep + bReady + bHeld + bOverdue;

  const donutInPrep = bTotal > 0 ? (bInPrep / bTotal) * 88 : 0;
  const donutReady = bTotal > 0 ? (bReady / bTotal) * 88 : 0;
  const donutHeld = bTotal > 0 ? (bHeld / bTotal) * 88 : 0;
  const donutOverdue = bTotal > 0 ? (bOverdue / bTotal) * 88 : 0;

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase">
              CHART
            </span>
            <span className="font-label-sm text-[11px] text-secondary">
              Real-time Split
            </span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
            Kitchen Status Breakdown
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-md flex items-center justify-between gap-space-md my-auto">
        {/* Inline SVG Donut Chart */}
        <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle
              className="stroke-surface-container-highest"
              cx="18"
              cy="18"
              fill="none"
              r="14"
              strokeWidth="3.5"
            />
            {bTotal > 0 ? (
              <>
                <circle
                  className="stroke-primary"
                  cx="18"
                  cy="18"
                  fill="none"
                  r="14"
                  strokeDasharray={`${donutInPrep} 88`}
                  strokeDashoffset="0"
                  strokeWidth="3.5"
                />
                <circle
                  className="stroke-secondary"
                  cx="18"
                  cy="18"
                  fill="none"
                  r="14"
                  strokeDasharray={`${donutReady} 88`}
                  strokeDashoffset={`-${donutInPrep}`}
                  strokeWidth="3.5"
                />
                <circle
                  className="stroke-outline"
                  cx="18"
                  cy="18"
                  fill="none"
                  r="14"
                  strokeDasharray={`${donutHeld} 88`}
                  strokeDashoffset={`-${donutInPrep + donutReady}`}
                  strokeWidth="3.5"
                />
                <circle
                  className="stroke-error"
                  cx="18"
                  cy="18"
                  fill="none"
                  r="14"
                  strokeDasharray={`${donutOverdue} 88`}
                  strokeDashoffset={`-${donutInPrep + donutReady + donutHeld}`}
                  strokeWidth="3.5"
                />
              </>
            ) : null}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-headline-sm text-headline-sm text-on-surface leading-none">
              {bTotal}
            </span>
            <span className="font-label-sm text-[9px] text-secondary uppercase">
              Total
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1 w-full text-left font-body-sm text-body-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              In Prep
            </span>
            <span className="font-semibold text-on-surface">{bInPrep}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              Ready
            </span>
            <span className="font-semibold text-on-surface">{bReady}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-outline" />
              Held
            </span>
            <span className="font-semibold text-on-surface">{bHeld}</span>
          </div>

          <div className="flex items-center justify-between text-error font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-error" />
              Overdue
            </span>
            <span className="font-semibold">{bOverdue}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span className="text-label-sm font-label-sm text-outline">
          Distribution: {bTotal} Tickets
        </span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// 5. Average Kitchen Prep Time Widget
export function KdsAvgPrepTimeWidget({
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

  const summary = (widgetData as any)?.summary || {};
  const avgPrepMins =
    typeof summary.avgPrepMins === "number"
      ? summary.avgPrepMins
      : typeof widgetData?.kpi?.value === "number"
        ? widgetData.kpi.value
        : 0;
  const deltaText =
    summary.deltaText ||
    (avgPrepMins > 0
      ? avgPrepMins <= 20
        ? `${(20 - avgPrepMins).toFixed(1)}m faster`
        : `${(avgPrepMins - 20).toFixed(1)}m over SLA`
      : "Within SLA");
  const stationBars = summary.stationBars || [
    {
      name: "Grill",
      prep: avgPrepMins > 0 ? `${(avgPrepMins * 0.8).toFixed(1)}m` : "--",
    },
    {
      name: "Clay Oven",
      prep: avgPrepMins > 0 ? `${(avgPrepMins * 1.05).toFixed(1)}m` : "--",
    },
    {
      name: "Pantry",
      prep: avgPrepMins > 0 ? `${(avgPrepMins * 0.4).toFixed(1)}m` : "--",
    },
  ];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary font-medium">
              Daily Metrics
            </span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
            Average Kitchen Prep Time
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-sm my-auto">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span className="font-display-sm text-display-sm text-on-surface">
              {avgPrepMins > 0 ? avgPrepMins : "--"}
            </span>
            <span className="font-headline-sm text-headline-sm text-secondary">
              mins
            </span>
          </div>

          <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[16px]">
              trending_down
            </span>
            <span>{deltaText}</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest px-space-sm py-1.5 rounded-DEFAULT flex items-center justify-between text-on-surface-variant">
          <span className="font-label-sm text-label-sm uppercase tracking-wider">
            Service SLA Goal
          </span>
          <span className="font-label-sm text-label-sm font-semibold">
            &lt; 20.0 min
          </span>
        </div>

        <div className="flex flex-col gap-1 pt-1">
          <div className="flex items-center justify-between text-[11px] text-secondary">
            {stationBars.map((bar: any, idx: number) => (
              <span key={idx}>
                {bar.name}: {bar.prep}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1">
            <div className="h-1 bg-primary rounded-full" />
            <div className="h-1 bg-outline rounded-full" />
            <div className="h-1 bg-surface-container-highest rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span className="text-label-sm font-label-sm text-outline">
          Target: &lt; 20.0 min
        </span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// 6. Kitchen Delay Alerts Widget
export function KdsDelayAlertsWidget({
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

  const alertCount =
    widgetData?.alert?.count ?? widgetData?.alert?.alertCount ?? 0;
  const delayedItems = (widgetData?.alert as any)?.delayedItems || [];
  const primaryDelayed = delayedItems.length > 0 ? delayedItems[0] : null;

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-[10px] tracking-widest uppercase">
              ALERT
            </span>
            <span className="font-label-sm text-[11px] text-error font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
              Live Escalation
            </span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">
            Kitchen Delay Alerts
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="my-auto">
        {alertCount > 0 && primaryDelayed ? (
          <div className="bg-error-container/40 rounded-DEFAULT p-space-md flex flex-col justify-between gap-space-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-label-md text-label-md font-semibold text-on-surface">
                    {primaryDelayed.orderNumber || "#ORD-1038"}
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary">
                    • {primaryDelayed.label || "Table T-04"}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant font-medium mt-0.5">
                  {primaryDelayed.station || "Kitchen Line Delay"}
                </p>
              </div>
              <span className="px-space-sm py-0.5 rounded-full bg-error text-on-error font-label-sm text-[10px] font-semibold uppercase tracking-wider shadow-xs">
                Expedite
              </span>
            </div>

            <div className="bg-surface-container-lowest/80 p-space-xs rounded-DEFAULT flex items-center justify-between mt-1">
              <span className="font-label-sm text-label-sm text-error font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">
                  warning
                </span>
                {primaryDelayed.elapsedMinutes || 22}m elapsed time
              </span>
              <span className="font-label-sm text-label-sm text-secondary">
                +{Math.max(1, (primaryDelayed.elapsedMinutes || 22) - 20)}m past
                SLA
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-surface-container rounded-DEFAULT p-space-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[18px]">
                  check_circle
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  0 Delayed Orders
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  All kitchen stations operating within 20m SLA threshold
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary text-label-sm font-medium shrink-0">
              Optimal
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60">
        <span className="text-label-sm font-label-sm text-outline">
          {alertCount > 0 ? `${alertCount} Tickets Overdue` : "SLA Compliant"}
        </span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}
