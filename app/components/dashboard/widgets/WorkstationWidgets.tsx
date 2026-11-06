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

// 1. Workstation Order Summary Widget
export function WorkstationOrderSummaryWidget({
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
  const total = widgetData?.kpi?.value ?? 0;
  const lanes: Array<{ name: string; count: number }> =
    summary.lanes && summary.lanes.length > 0
      ? summary.lanes
      : [{ name: "Main", count: Number(total) || 0 }];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">LANE SUMMARY</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Workstation Order Summary</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto">
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">
            Active Lane Volume
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </div>
        <div
          className={`grid gap-space-xs text-center py-1 ${
            lanes.length === 1
              ? "grid-cols-1"
              : lanes.length === 2
              ? "grid-cols-2"
              : "grid-cols-3"
          }`}
        >
          {lanes.map((lane: any, idx: number) => (
            <div key={idx} className="bg-surface-container-lowest p-space-xs rounded-DEFAULT flex flex-col">
              <span className="font-label-sm text-[10px] text-outline truncate">{lane.name}</span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">{lane.count}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between bg-surface-container-high px-space-sm py-1 rounded-full text-xs">
          <span className="text-on-surface font-medium">Total Spool Pool</span>
          <span className="font-semibold text-primary">{total} Active Tasks</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Workstation Terminal Ledger</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Live Lane Sync
        </span>
      </div>
    </div>
  );
}

// 2. Orders by Workstation Widget
export function WorkstationOrdersByWorkstationWidget({
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

  const breakdown = (widgetData as any)?.summary?.stationBreakdown || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              CHART
            </span>
            <span className="font-label-sm text-[11px] text-secondary">DISTRIBUTION</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Orders by Workstation</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto">
        <div className="flex justify-between items-center text-outline font-label-sm text-[10px] uppercase">
          <span>Workstation</span>
          <span>Tkts</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {breakdown.length > 0 ? (
            breakdown.slice(0, 3).map((st: any, idx: number) => (
              <div key={idx} className="flex flex-col gap-0.5">
                <div className="flex justify-between text-on-surface font-body-sm text-xs">
                  <span className="truncate max-w-[140px]">{st.name}</span>
                  <span className="font-medium">{st.count}</span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${idx === 0 ? "bg-primary" : "bg-secondary"}`}
                    style={{ width: `${Math.max(4, st.pct)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="py-3 text-center text-secondary text-xs">
              0 orders processed across workstations
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Hardware Dispatch Load</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Synchronized
        </span>
      </div>
    </div>
  );
}

// 3. Active Workstation Tasks Widget
export function WorkstationActiveTasksWidget({
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

  const tasksList = (widgetData as any)?.summary?.activeTasksList || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              LIVE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">DISPATCH QUEUE</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Active Workstation Tasks</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-1.5 my-auto">
        {tasksList.length > 0 ? (
          tasksList.slice(0, 2).map((t: any, idx: number) => (
            <div
              key={idx}
              className="bg-surface-container-lowest p-space-xs px-space-sm rounded-DEFAULT flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <div className="flex flex-col">
                  <span className="font-medium text-on-surface truncate max-w-[130px]">
                    {t.taskNo} {t.title}
                  </span>
                  <span className="text-[10px] text-outline">
                    {t.station} • {t.elapsed}
                  </span>
                </div>
              </div>
              <span className="text-[10px] bg-surface-container px-1.5 py-0.5 rounded text-on-surface font-medium">
                {t.status}
              </span>
            </div>
          ))
        ) : (
          <div className="py-3 text-center text-secondary text-xs">
            0 active tasks in queue
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Printer & Spool Dispatch</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Queue Nominal
        </span>
      </div>
    </div>
  );
}

// 4. Workstation Queue Widget
export function WorkstationQueueWidget({
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
  const depth = widgetData?.kpi?.value ?? (summary.bufferDepth ?? 0);

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">BUFFER DEPTH</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Workstation Queue</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto">
        <div className="flex items-center justify-between">
          <span className="font-display-sm text-display-sm text-on-surface font-normal">
            {depth}
          </span>
          <span className="bg-surface-container-highest text-[11px] px-2 py-0.5 rounded-full text-secondary font-semibold">
            {summary.spoolStatus || (depth > 0 ? "Nominal Spool" : "Queue Idle")}
          </span>
        </div>
        <div className="space-y-1 text-xs pt-1 border-t border-surface-container-high/60">
          <div className="flex justify-between">
            <span className="text-secondary">Buffer Depth</span>
            <span className="font-semibold text-on-surface">{depth} Orders</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Oldest Waiting Task</span>
            <span className="font-semibold text-on-surface">{summary.oldestWaiting || "--"}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Order Spool Capacity</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Active
        </span>
      </div>
    </div>
  );
}

// 5. Preparation Time by Workstation Widget
export function WorkstationPrepTimeWidget({
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
  const stationBars: Array<{ name: string; prep: string }> =
    summary.stationBars && summary.stationBars.length > 0
      ? summary.stationBars
      : [{ name: "Main", prep: summary.displayValue ? `${summary.displayValue}m` : "--" }];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              CHART
            </span>
            <span className="font-label-sm text-[11px] text-secondary">EFFICIENCY AUDIT</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Prep Time by Workstation</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-1.5 my-auto">
        <div className="flex items-baseline justify-between">
          <span className="font-display-sm text-display-sm text-on-surface font-normal">
            {summary.displayValue || "--"}
          </span>
          <span className="text-[11px] text-secondary">
            Target: {summary.slaGoal || "< 20.0m"}
          </span>
        </div>
        <div className="flex items-end justify-around h-10 pt-1 px-4 border-b border-surface-container-high">
          {stationBars.map((sb, idx) => (
            <div key={idx} className="flex flex-col items-center gap-0.5">
              <div
                className={`w-4 rounded-t-sm h-6 ${
                  idx === 0
                    ? "bg-primary"
                    : idx === 1
                    ? "bg-secondary"
                    : "bg-surface-container-highest"
                }`}
              />
              <span className="text-[9px] text-outline truncate max-w-[60px]">{sb.name}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center text-xs text-outline">
          <span>Efficiency Pace:</span>
          <span className="font-semibold text-on-surface">{summary.deltaText || "Within SLA"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Turnaround Benchmark</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Tracked
        </span>
      </div>
    </div>
  );
}

// 6. Delayed Workstation Orders Widget
export function WorkstationDelayedOrdersWidget({
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

  const alertCount = widgetData?.alert?.count ?? 0;
  const isDelayed = alertCount > 0;

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`px-space-xs py-0.5 rounded-full ${isDelayed ? "bg-error-container text-on-error-container" : "bg-secondary-container text-on-secondary-container"} font-label-sm text-[10px] tracking-widest uppercase font-semibold`}>
              ALERT
            </span>
            <span className="font-label-sm text-[11px] text-secondary">BOTTLENECK DETECTION</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Delayed Workstation Orders</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-1.5 my-auto">
        <div className={`${isDelayed ? "bg-error-container/40 border border-error-container" : "bg-surface-container-lowest"} p-space-xs px-space-sm rounded-DEFAULT flex items-center gap-2`}>
          <span className={`material-symbols-outlined ${isDelayed ? "text-error" : "text-primary"} text-[18px]`}>
            {isDelayed ? "warning" : "check_circle"}
          </span>
          <span className={`text-xs font-semibold ${isDelayed ? "text-on-error-container" : "text-on-surface"}`}>
            {alertCount} Tickets Exceeding Target SLA
          </span>
        </div>
        <div className="text-xs text-secondary pt-0.5">
          {widgetData?.alert?.message || "All station registers running within 15-minute SLA."}
        </div>
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>SLA Escalation Queue</span>
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isDelayed ? "bg-error" : "bg-primary"}`} />
          {isDelayed ? "Escalation Active" : "Nominal"}
        </span>
      </div>
    </div>
  );
}

// 7. Workstation Performance Widget
export function WorkstationPerformanceWidget({
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

  const performances = (widgetData as any)?.summary?.performances || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              CHART
            </span>
            <span className="font-label-sm text-[11px] text-secondary">THROUGHPUT RATIO</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Workstation Performance</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-1.5 my-auto">
        {performances.length > 0 ? (
          performances.slice(0, 3).map((p: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between text-xs text-on-surface">
              <span className="truncate max-w-[110px]">{p.name}</span>
              <div className="flex items-center gap-2 w-32 justify-end">
                <div className="w-16 bg-surface-container-highest rounded-full h-1.5">
                  <div
                    className={`h-full rounded-full ${idx === 0 ? "bg-primary" : "bg-secondary"}`}
                    style={{ width: `${Math.max(5, p.pct)}%` }}
                  />
                </div>
                <span className="font-medium text-right text-[11px] w-6">{p.pct}%</span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-3 text-center text-secondary text-xs">
            0 dishes completed across workstations
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Completion Throughput</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Balancing Active
        </span>
      </div>
    </div>
  );
}

// 8. Workstation Availability Widget
export function WorkstationAvailabilityWidget({
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

  const terminals = (widgetData as any)?.summary?.terminalsList || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              LIVE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">SYSTEM HEALTH</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Workstation Availability</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-1.5 my-auto">
        {terminals.length > 0 ? (
          terminals.slice(0, 3).map((term: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-surface-container-lowest p-space-xs px-space-sm rounded-DEFAULT text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${term.status === "Online" ? "bg-primary" : "bg-error"}`} />
                <span className="font-medium text-on-surface">{term.name}</span>
              </div>
              <span className="text-[11px] text-outline">
                {term.status} • {term.latency}
              </span>
            </div>
          ))
        ) : (
          <div className="py-3 text-center text-secondary text-xs">
            No physical terminals configured
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Hardware Ping Telemetry</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          LAN Healthy
        </span>
      </div>
    </div>
  );
}
