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

// 1. Active Orders by Captain Widget
export function CaptainActiveOrdersWidget({
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

  const captains = (widgetData as any)?.summary?.captains || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">FLOOR ASSIGNMENT</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Active Orders by Captain</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-1.5 my-auto">
        {captains.length > 0 ? (
          captains.map((c: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between p-1.5 rounded-DEFAULT bg-surface-container-lowest text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] font-semibold text-on-surface">
                  {c.rank}
                </span>
                <div>
                  <div className="font-medium text-on-surface">
                    {c.name} <span className="text-[10px] text-outline font-normal">({c.zone})</span>
                  </div>
                  <div className="text-[10px] text-secondary">
                    {c.tablesCount} Tables • {c.covers} Covers
                  </div>
                </div>
              </div>
              <span className="font-semibold text-on-surface">
                ₹ {c.amount.toLocaleString()}
              </span>
            </div>
          ))
        ) : (
          <div className="py-3 text-center text-secondary text-xs">
            0 active seated tables assigned to captains
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Attendant Allocation</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Shift Active
        </span>
      </div>
    </div>
  );
}

// 2. Table Service Status Widget
export function CaptainTableServiceStatusWidget({
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

  const tableCards = (widgetData as any)?.summary?.tableCards || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              LIVE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">SERVICE PACING</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Table Service Status</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-wrap gap-1.5 my-auto">
        {tableCards.length > 0 ? (
          tableCards.slice(0, 4).map((tc: any, idx: number) => (
            <div
              key={idx}
              className="flex-1 min-w-[90px] p-1.5 bg-surface-container-lowest rounded-DEFAULT text-xs flex flex-col gap-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-on-surface">{tc.tableNumber}</span>
                <span className="text-[10px] text-outline">{tc.seating}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-secondary truncate">{tc.stage}</span>
                {tc.elapsed && <span className="text-primary font-medium">{tc.elapsed}</span>}
              </div>
            </div>
          ))
        ) : (
          <div className="w-full py-3 text-center text-secondary text-xs">
            No active dining tables
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Dining Floor Status</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Realtime Stage
        </span>
      </div>
    </div>
  );
}

// 3. Assigned Tables Widget
export function CaptainAssignedTablesWidget({
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

  const rosters = (widgetData as any)?.summary?.rosters || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">ROSTER ALLOCATION</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Assigned Tables</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-1.5 my-auto">
        {rosters.length > 0 ? (
          rosters.map((r: any, idx: number) => (
            <div
              key={idx}
              className="p-1.5 rounded-DEFAULT bg-surface-container-lowest flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-semibold text-on-surface">{r.name}</span>
                <div className="text-[10px] text-secondary">{r.section}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-primary">{r.activeCount} Active</div>
                <div className="text-[10px] text-outline">{r.activePct} load</div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-3 text-center text-secondary text-xs">
            0 tables allocated in shift
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Section Distribution</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Balanced
        </span>
      </div>
    </div>
  );
}

// 4. Service Time Widget
export function CaptainServiceTimeWidget({
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

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">ATTENDANT TEMPO</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Service Time</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-1.5 my-auto">
        <div className="flex items-baseline justify-between">
          <span className="font-display-sm text-display-sm text-on-surface font-normal">
            {summary.avgTurnMins ?? "--"}
          </span>
          <span className="text-[11px] text-secondary">Benchmark: 42.0m</span>
        </div>
        <div className="flex justify-between items-center text-xs text-outline pt-1 border-t border-surface-container-high/60">
          <span>Turn Variance:</span>
          <span className="font-semibold text-on-surface">{summary.deltaBenchmark ?? "--"}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-outline">
          <span>Fastest Floor:</span>
          <span className="font-semibold text-on-surface">{summary.fastestSection ?? "Terrace"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Average Table Turn</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Synchronized
        </span>
      </div>
    </div>
  );
}

// 5. Orders Awaiting Service Widget
export function CaptainOrdersAwaitingServiceWidget({
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
  const isAwaiting = (summary.countAtPass ?? 0) > 0;

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`px-space-xs py-0.5 rounded-full ${isAwaiting ? "bg-error-container text-on-error-container" : "bg-secondary-container text-on-secondary-container"} font-label-sm text-[10px] tracking-widest uppercase font-semibold`}>
              ALERT
            </span>
            <span className="font-label-sm text-[11px] text-secondary">CALL BELL QUEUE</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Orders Awaiting Service</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-1.5 my-auto">
        <div className={`${isAwaiting ? "bg-error-container/40 border border-error-container" : "bg-surface-container-lowest"} p-space-xs px-space-sm rounded-DEFAULT flex items-center gap-2`}>
          <span className={`material-symbols-outlined ${isAwaiting ? "text-error" : "text-primary"} text-[18px]`}>
            {isAwaiting ? "notifications_active" : "check_circle"}
          </span>
          <span className={`text-xs font-semibold ${isAwaiting ? "text-on-error-container" : "text-on-surface"}`}>
            {summary.countAtPass ?? 0} Orders at Pass
          </span>
        </div>
        <div className="text-xs text-secondary pt-0.5">
          {summary.ordersAtPass && summary.ordersAtPass.length > 0 ? (
            summary.ordersAtPass.slice(0, 2).map((it: any, idx: number) => (
              <div key={idx} className="flex justify-between py-0.5">
                <span className="font-medium text-on-surface">{it.table} Ready</span>
                <span className="text-error font-medium">{it.readyAgo}</span>
              </div>
            ))
          ) : (
            "No food waiting at kitchen pass."
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Pass Expeditor Queue</span>
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isAwaiting ? "bg-error" : "bg-primary"}`} />
          {isAwaiting ? "Runner Needed" : "Pass Clear"}
        </span>
      </div>
    </div>
  );
}

// 6. Captain Performance Summary Widget
export function CaptainPerformanceSummaryWidget({
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

  const captains = (widgetData as any)?.summary?.captains || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              CHART
            </span>
            <span className="font-label-sm text-[11px] text-secondary">CAPTAIN METRICS</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Captain Performance</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-1.5 my-auto">
        {captains.length > 0 ? (
          captains.slice(0, 3).map((c: any, idx: number) => (
            <div
              key={idx}
              className="p-1.5 rounded-DEFAULT bg-surface-container-lowest flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-semibold text-on-surface">{c.name}</span>
                <div className="text-[10px] text-secondary">{c.rank}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-on-surface">{c.sales}</div>
                <div className="text-[10px] text-primary">{c.turnRate}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-3 text-center text-secondary text-xs">
            0 covers served in this period
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Table Pacing & Service SLA</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Benchmarked
        </span>
      </div>
    </div>
  );
}

// 7. Captain Order Activity Widget (can span full width or multi-col)
export function CaptainOrderActivityWidget({
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

  const auditEvents = (widgetData as any)?.summary?.auditEvents || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">AUDIT TRAIL</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">Captain Order Activity</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT overflow-hidden my-auto">
        <div className="grid grid-cols-12 px-space-sm py-1.5 bg-surface-container-high font-label-sm text-[10px] text-secondary font-semibold uppercase">
          <span className="col-span-2">Time</span>
          <span className="col-span-3">Captain</span>
          <span className="col-span-5">Action Event</span>
          <span className="col-span-2 text-right">Table</span>
        </div>
        <div className="divide-y divide-surface-container/50">
          {auditEvents.length > 0 ? (
            auditEvents.slice(0, 3).map((ev: any, idx: number) => (
              <div
                key={idx}
                className="grid grid-cols-12 px-space-sm py-2 items-center text-xs bg-surface-container-lowest"
              >
                <span className="col-span-2 text-outline font-medium text-[11px]">{ev.time}</span>
                <span className="col-span-3 font-medium text-on-surface truncate">{ev.captain}</span>
                <span className="col-span-5 text-on-surface flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="truncate">{ev.action}</span>
                </span>
                <span className="col-span-2 text-right font-semibold text-on-surface">{ev.table}</span>
              </div>
            ))
          ) : (
            <div className="py-3 text-center text-secondary text-xs bg-surface-container-lowest">
              No tableside activity in selected timeframe
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Chronological Floor Events</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Live Audit Stream
        </span>
      </div>
    </div>
  );
}

