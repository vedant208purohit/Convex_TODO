"use client";

import React from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { formatPriceWithSymbol } from "@/lib/constants/countries";

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
  const currencySymbol = (widgetData as any)?.currencySymbol || "₹";
  const country = (widgetData as any)?.country;

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
            FLOOR ASSIGNMENT
          </span>
          <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">Active Orders by Captain</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] my-auto">
        {captains.length > 0 ? (
          captains.map((c: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between p-1 bg-white rounded border border-[#f0eae3] text-xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-700">
                  {c.rank}
                </span>
                <div>
                  <div className="font-semibold text-stone-800">
                    {c.name} <span className="text-[10px] text-stone-400 font-normal">({c.zone})</span>
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {c.tablesCount} Tables • {c.covers} Covers
                  </div>
                </div>
              </div>
              <span className="font-bold text-stone-900">
                {c.amountFormatted || formatPriceWithSymbol(c.amount, currencySymbol, country, true)}
              </span>
            </div>
          ))
        ) : (
          <div className="py-2 text-center text-stone-400 text-xs">
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
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
            SERVICE PACING
          </span>
          <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">Table Service Status</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-wrap gap-1.5 border border-[#f3ede6] my-auto">
        {tableCards.length > 0 ? (
          tableCards.slice(0, 4).map((tc: any, idx: number) => (
            <div
              key={idx}
              className="flex-1 min-w-[80px] p-1.5 bg-white rounded border border-[#f0eae3] text-xs"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-800">{tc.tableNumber}</span>
                <span className="text-[10px] text-stone-400">{tc.seating}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-stone-500 mt-0.5">
                <span className="truncate">{tc.stage}</span>
                {tc.elapsed && <span className="text-emerald-600 font-medium ml-1 shrink-0">{tc.elapsed}</span>}
              </div>
            </div>
          ))
        ) : (
          <div className="w-full py-2 text-center text-stone-400 text-xs">
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
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
            ROSTER ALLOCATION
          </span>
          <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">Assigned Tables</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] my-auto">
        {rosters.length > 0 ? (
          rosters.map((r: any, idx: number) => (
            <div
              key={idx}
              className="flex justify-between items-center p-1 bg-white rounded border border-[#f0eae3] text-xs"
            >
              <div>
                <span className="font-semibold text-stone-800">{r.name}</span>
                <div className="text-[10px] text-stone-400">{r.section}</div>
              </div>
              <div className="text-right">
                <span className="font-bold text-stone-900">{r.activeCount} Active</span>
                <span className="text-[10px] text-stone-400 block">{r.activePct} load</span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-2 text-center text-stone-400 text-xs">
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
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
            ATTENDANT TEMPO
          </span>
          <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">Service Time</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] my-auto">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-serif text-stone-900">{summary.avgTurnMins ?? "--"}</span>
          <span className="text-[10px] text-stone-400">Benchmark: 42.0m</span>
        </div>
        <div className="flex justify-between text-xs text-stone-600 pt-1 border-t border-[#f0eae3]">
          <span>Fastest:</span>
          <span className="font-semibold text-stone-900">{summary.fastestSection || "--"}</span>
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
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
            CALL BELL QUEUE
          </span>
          <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">Orders Awaiting Service</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] my-auto">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
          <span
            className={`material-symbols-outlined ${
              isAwaiting ? "text-amber-500" : "text-emerald-500"
            } text-[16px]`}
          >
            {isAwaiting ? "notifications_active" : "check_circle"}
          </span>
          <span>{summary.countAtPass ?? 0} Orders at Pass</span>
        </div>
        <span className="text-[11px] text-stone-500">
          {isAwaiting ? "Runner needed for hot food pickup" : "No orders waiting at pass"}
        </span>
        {summary.ordersAtPass && summary.ordersAtPass.length > 0 && (
          <div className="pt-1 border-t border-[#f0eae3] flex flex-col gap-0.5">
            {summary.ordersAtPass.slice(0, 2).map((it: any, idx: number) => (
              <div key={idx} className="flex justify-between text-[11px]">
                <span className="font-medium text-stone-800">{it.table} Ready</span>
                <span className="text-amber-600 font-medium">{it.readyAgo}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-space-xs border-t border-surface-container/60 text-[11px] text-secondary">
        <span>Pass Expeditor Queue</span>
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${isAwaiting ? "bg-amber-500" : "bg-emerald-500"}`} />
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
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
            CAPTAIN METRICS
          </span>
          <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">Captain Performance</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] my-auto">
        {captains.length > 0 ? (
          captains.slice(0, 2).map((c: any, idx: number) => (
            <div
              key={idx}
              className="flex justify-between items-center p-1 bg-white rounded border border-[#f0eae3] text-xs"
            >
              <div>
                <div className="font-semibold text-stone-800">{c.name}</div>
                <div className="text-[10px] text-stone-400">{c.rank}</div>
              </div>
              <div className="text-right">
                <span className="font-bold text-stone-900">{c.sales}</span>
                <span className="text-[10px] text-emerald-600 block">{c.turnRate}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-2 text-center text-stone-400 text-xs">
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

// 7. Captain Order Activity Widget
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
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
            AUDIT TRAIL
          </span>
          <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">Captain Order Activity</h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg overflow-hidden border border-[#f3ede6] my-auto">
        <div className="grid grid-cols-12 px-3 py-1 bg-stone-100 text-[10px] font-bold uppercase text-stone-500">
          <span className="col-span-2">Time</span>
          <span className="col-span-3">Captain</span>
          <span className="col-span-5">Action</span>
          <span className="col-span-2 text-right">Table</span>
        </div>
        <div className="divide-y divide-[#f0eae3]">
          {auditEvents.length > 0 ? (
            auditEvents.slice(0, 3).map((ev: any, idx: number) => (
              <div
                key={idx}
                className="grid grid-cols-12 px-3 py-1.5 items-center text-xs bg-white"
              >
                <span className="col-span-2 text-stone-400 text-[11px]">{ev.time}</span>
                <span className="col-span-3 font-semibold text-stone-800 truncate">{ev.captain}</span>
                <span className="col-span-5 text-stone-700 truncate">{ev.action}</span>
                <span className="col-span-2 text-right font-bold text-stone-900">{ev.table}</span>
              </div>
            ))
          ) : (
            <div className="py-2 text-center text-stone-400 text-xs bg-white">
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
