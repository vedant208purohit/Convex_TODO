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

// 1. Current Queue Length (1x1 Square)
export function QueueLengthWidget({
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
  const partiesCount = summary.partiesCount ?? "00";
  const guestsCount = summary.guestsCount ?? 0;
  const indoorCount = summary.indoorCount ?? "00";
  const outdoorCount = summary.outdoorCount ?? "00";
  const statusTag = summary.statusTag ?? "Nominal Flow";

  const indoorNum = Number(indoorCount) || 0;
  const outdoorNum = Number(outdoorCount) || 0;
  const totalNum = indoorNum + outdoorNum;
  const indoorPct = totalNum > 0 ? Math.round((indoorNum / totalNum) * 100) : 0;
  const outdoorPct = totalNum > 0 ? 100 - indoorPct : 0;

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">LOBBY VOLUME</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Current Queue Length
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-serif text-3xl font-bold text-on-surface">{partiesCount}</span>
            <span className="text-xs text-secondary font-medium ml-1.5">Parties</span>
          </div>
          <div className="flex items-center gap-1 text-on-surface text-xs bg-surface-container-highest px-2.5 py-1 rounded-full font-medium">
            <span className="material-symbols-outlined text-[15px]">groups</span>
            <span>{guestsCount} Guests</span>
          </div>
        </div>

        <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden flex mt-1">
          {totalNum > 0 ? (
            <>
              <div className="bg-primary h-full transition-all" style={{ width: `${indoorPct}%` }}></div>
              <div className="bg-secondary h-full opacity-60 transition-all" style={{ width: `${outdoorPct}%` }}></div>
            </>
          ) : (
            <div className="bg-surface-container-high h-full w-full opacity-30"></div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-secondary pt-0.5">
          <span>Indoor: {indoorCount}</span>
          <span>Outdoor: {outdoorCount}</span>
          <span className="font-medium text-on-surface">{statusTag}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Host Stand</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
          Live Sync
        </span>
      </div>
    </div>
  );
}

// 2. Waiting Customers (1x1 Square)
export function QueueWaitingCustomersWidget({
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
  const waitingList = summary.waitingList || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest font-label-sm text-[10px] text-on-surface font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
              <span>LIVE</span>
            </span>
            <span className="font-label-sm text-[11px] text-secondary">WAITLIST STREAM</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Waiting Customers
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] border border-[#f3ede6] rounded-lg p-space-xs flex flex-col gap-1.5 my-auto min-h-[110px] justify-center">
        {waitingList.length === 0 ? (
          <div className="text-center py-4 text-xs text-secondary">
            No parties currently on waitlist
          </div>
        ) : (
          waitingList.slice(0, 3).map((item: any, idx: number) => (
            <div
              key={item.id || idx}
              className="flex items-center justify-between py-1 bg-surface-container-lowest px-space-xs rounded-DEFAULT shadow-2xs"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-bold text-on-surface">{item.ticket}</span>
                <span className="text-xs text-on-surface truncate">
                  {item.name} ({item.pax})
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-secondary">{item.waitMins}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    item.status === "Paged"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-surface-container-high text-on-surface"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Waitlist Queue</span>
        <span>{waitingList.length} In Line</span>
      </div>
    </div>
  );
}

// 3. Average Waiting Time (1x1 Square)
export function QueueAvgWaitTimeWidget({
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
  const avgWait = summary.avgWaitMins || "0.0";
  const deltaText = summary.deltaText || "No Active Queue";
  const quotedTime = summary.quotedTime || "--";
  const target = summary.target || "Target < 20m";

  const deltaBadgeClass =
    deltaText === "No Active Queue"
      ? "text-secondary bg-surface-container-highest"
      : deltaText.includes("Within")
        ? "text-emerald-700 bg-emerald-100/60"
        : "text-rose-700 bg-rose-100/60";

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">WAIT METRIC</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Average Waiting Time
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-serif text-3xl font-bold text-on-surface">{avgWait}</span>
            <span className="text-xs text-secondary font-medium ml-1.5">mins</span>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${deltaBadgeClass}`}>
            {deltaText}
          </span>
        </div>

        <div className="pt-1">
          {Number(avgWait) > 0 ? (
            <svg className="w-full h-7 overflow-visible stroke-primary" fill="none" viewBox="0 0 100 25">
              <path
                d="M0 18 Q 20 22, 40 12 T 70 8 T 100 14"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          ) : (
            <svg className="w-full h-7 overflow-visible stroke-outline-variant/40" fill="none" viewBox="0 0 100 25">
              <path
                d="M0 18 L 100 18"
                strokeLinecap="round"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
            </svg>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-secondary pt-0.5 border-t border-outline-variant/15">
          <span>Quoted: {quotedTime}</span>
          <span className="font-medium text-on-surface">{target}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Turnaround SLA</span>
        <span>20m Threshold</span>
      </div>
    </div>
  );
}

// 4. Recently Called Customers (1x1 Square)
export function QueueRecentCalloutsWidget({
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
  const calledList = summary.calledList || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">CALLOUT LOG</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Recently Called Customers
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] border border-[#f3ede6] rounded-lg p-space-xs flex flex-col gap-1.5 my-auto min-h-[110px] justify-center">
        {calledList.length === 0 ? (
          <div className="text-center py-4 text-xs text-secondary">
            No recently paged or seated parties
          </div>
        ) : (
          calledList.slice(0, 3).map((item: any, idx: number) => (
            <div
              key={item.id || idx}
              className="flex items-center justify-between py-1 bg-surface-container-lowest px-space-xs rounded-DEFAULT shadow-2xs"
            >
              <div className="flex flex-col min-w-0 pr-1">
                <span className="text-xs font-semibold text-on-surface truncate">
                  {item.ticket} • {item.name} ({item.pax})
                </span>
                <span className={`text-[10px] font-medium ${item.statusColor}`}>
                  {item.status}
                </span>
              </div>
              <span className="text-[11px] text-secondary shrink-0">{item.time}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Paging Ledger</span>
        <span>Audit Trail</span>
      </div>
    </div>
  );
}

// 5. Queue Status Breakdown (1x1 Square)
export function QueueStatusBreakdownWidget({
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
  const totalPax = summary.totalPax ?? 0;
  const couplesPercent = summary.couplesPercent ?? 0;
  const familiesPercent = summary.familiesPercent ?? 0;
  const largePercent = summary.largePercent ?? 0;

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              CHART
            </span>
            <span className="font-label-sm text-[11px] text-secondary">PARTY MIX</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Queue Status Breakdown
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex items-center justify-between my-auto min-h-[110px]">
        {/* Donut Chart representation */}
        <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle
              className="text-surface-container-highest stroke-current"
              cx="18"
              cy="18"
              fill="none"
              r="14"
              strokeWidth="4"
            />
            <circle
              className="text-primary stroke-current"
              cx="18"
              cy="18"
              fill="none"
              r="14"
              strokeDasharray={`${couplesPercent}, 100`}
              strokeDashoffset="0"
              strokeWidth="4"
            />
            <circle
              className="text-secondary stroke-current"
              cx="18"
              cy="18"
              fill="none"
              r="14"
              strokeDasharray={`${familiesPercent}, 100`}
              strokeDashoffset={`-${couplesPercent}`}
              strokeWidth="4"
            />
            <circle
              className="text-amber-600 stroke-current"
              cx="18"
              cy="18"
              fill="none"
              r="14"
              strokeDasharray={`${largePercent}, 100`}
              strokeDashoffset={`-${couplesPercent + familiesPercent}`}
              strokeWidth="4"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="font-serif text-sm font-bold text-on-surface leading-none">{totalPax}</span>
            <span className="text-[8px] text-secondary leading-none mt-0.5">Pax</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-[11px] flex-1 pl-3 min-w-0">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-secondary">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
              <span className="truncate">Couples (2p)</span>
            </span>
            <span className="font-bold text-on-surface shrink-0">{couplesPercent}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-secondary">
              <span className="w-2 h-2 rounded-full bg-secondary shrink-0"></span>
              <span className="truncate">Families (4-6p)</span>
            </span>
            <span className="font-bold text-on-surface shrink-0">{familiesPercent}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-secondary">
              <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0"></span>
              <span className="truncate">Large (7p+)</span>
            </span>
            <span className="font-bold text-on-surface shrink-0">{largePercent}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Dining Mix</span>
        <span>Table Optimiser</span>
      </div>
    </div>
  );
}

// 6. Queue Waiting Time Alerts (1x1 Square)
export function QueueWaitTimeAlertsWidget({
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
  const breachingParties = summary.breachingParties || [];
  const topBreach = breachingParties[0];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-rose-100 text-rose-800 font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              ALERT
            </span>
            <span className="font-label-sm text-[11px] text-secondary">BOTTLENECK ALERT</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Queue Waiting Time Alerts
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col justify-center my-auto min-h-[110px]">
        {breachingParties.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200/60 p-2.5 rounded-DEFAULT flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-lg">check_circle</span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-emerald-900">Wait Times Within SLA</span>
              <span className="text-[10px] text-emerald-700">All guests seated under 20 mins</span>
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 border border-rose-200/80 p-2.5 rounded-DEFAULT flex flex-col gap-1 shadow-2xs">
            <div className="flex items-start gap-1.5">
              <span className="material-symbols-outlined text-rose-600 text-base shrink-0 mt-0.5">warning</span>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wide">
                  Exceeding SLA ({topBreach?.elapsedMins}m elapsed)
                </span>
                <span className="text-xs font-semibold text-on-surface truncate">
                  {topBreach?.ticket} ({topBreach?.name}, {topBreach?.pax})
                </span>
                <span className="text-[10px] text-rose-700">Target &lt; 20m</span>
              </div>
            </div>
            <div className="mt-1 pt-1 border-t border-rose-200/40 text-[10px] text-secondary font-medium">
              Suggested: {topBreach?.suggestedTable || "Awaiting Table Assignment"}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>SLA Breaches</span>
        <span>{breachingParties.length} Flagged</span>
      </div>
    </div>
  );
}

