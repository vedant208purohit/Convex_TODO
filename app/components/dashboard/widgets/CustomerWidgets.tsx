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

// 1. Total Customers (1x1 Square)
export function CustomerTotalWidget({
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
  const totalGuests = summary.totalGuests ?? "0";
  const deltaPercent = summary.deltaPercent ?? "▲ +12.4%";
  const dineInPercent = summary.dineInPercent ?? 67;
  const onlinePercent = summary.onlinePercent ?? 33;

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">AUDIENCE REACH</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Total Customers
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-serif text-3xl font-bold text-on-surface">{totalGuests}</span>
            <span className="text-xs text-secondary font-medium ml-1.5">Guests</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
            {deltaPercent}
          </span>
        </div>

        <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden flex mt-1">
          <div className="bg-primary h-full" style={{ width: `${dineInPercent}%` }}></div>
          <div className="bg-secondary h-full opacity-60" style={{ width: `${onlinePercent}%` }}></div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-secondary pt-0.5">
          <span>Dine-In: {dineInPercent}%</span>
          <span>Online: {onlinePercent}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Channel Reach</span>
        <span>All Channels</span>
      </div>
    </div>
  );
}

// 2. New Customers (1x1 Square)
export function CustomerNewWidget({
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
  const newCount = summary.newCount ?? 0;
  const deltaPercent = summary.deltaPercent ?? "▲ +8.1% vs prev week";
  const intakeRate = summary.intakeRate ?? "28% of today's total covers";
  const foliosOpened = summary.foliosOpened ?? "Folios Opened: 24";
  const fastTrack = summary.fastTrack ?? "Fast-Track QR: 12";

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">ACQUISITION RATE</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            New Customers
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-serif text-3xl font-bold text-on-surface">{newCount}</span>
            <span className="text-xs text-secondary font-medium ml-1.5">New</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
            {deltaPercent}
          </span>
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-DEFAULT bg-surface-container-highest text-[11px]">
          <span className="text-secondary">{intakeRate}</span>
          <span className="font-semibold text-on-surface">Active Intake</span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-secondary pt-0.5">
          <span>{foliosOpened}</span>
          <span>{fastTrack}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>First-time Diners</span>
        <span>Acquisition</span>
      </div>
    </div>
  );
}

// 3. Returning Customers (1x1 Square)
export function CustomerReturningWidget({
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
  const retentionPercent = summary.retentionPercent ?? "0%";
  const visitsCount = summary.visitsCount ?? "0 Visits";
  const redeemedFormatted = summary.redeemedFormatted ?? "₹ 48,200 redeemed";
  const avgFrequency = summary.avgFrequency ?? "3.2x / mo";

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">RETENTION & LOYALTY</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Returning Customers
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-serif text-3xl font-bold text-on-surface">{retentionPercent}</span>
            <span className="text-xs text-secondary font-medium ml-1.5">Retention</span>
          </div>
          <span className="text-[11px] font-semibold text-on-surface bg-surface-container-highest px-2 py-0.5 rounded-full">
            {visitsCount}
          </span>
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-DEFAULT bg-surface-container-highest text-[11px]">
          <div className="flex items-center gap-1 text-secondary">
            <span className="material-symbols-outlined text-[15px] text-amber-600">loyalty</span>
            <span>Redemptions:</span>
          </div>
          <span className="font-semibold text-on-surface">{redeemedFormatted}</span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-secondary pt-0.5">
          <span>Avg. Frequency</span>
          <span className="font-medium text-on-surface">{avgFrequency}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Patron Loyalty</span>
        <span>Retention</span>
      </div>
    </div>
  );
}

// 4. Recent Customers (1x1 Square)
export function CustomerRecentWidget({
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
  const recentGuests = summary.recentGuests || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">GUEST LOG</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Recent Customers
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-xs flex flex-col gap-1.5 my-auto min-h-[110px] justify-center">
        {recentGuests.length === 0 ? (
          <div className="text-center py-4 text-xs text-secondary">
            No customer order activity recorded
          </div>
        ) : (
          recentGuests.slice(0, 3).map((g: any, idx: number) => (
            <div
              key={g.id || idx}
              className="p-1.5 rounded-DEFAULT bg-surface-container-lowest flex items-center justify-between shadow-2xs"
            >
              <div className="flex flex-col min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-on-surface truncate">{g.name}</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-semibold">
                    {g.tier}
                  </span>
                </div>
                <span className="text-[10px] text-secondary mt-0.5">
                  {g.table} • {g.time}
                </span>
              </div>
              <span className="text-xs font-semibold text-on-surface shrink-0">{g.spend}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Folio Ledger</span>
        <span>Latest Checks</span>
      </div>
    </div>
  );
}

// 5. Most Frequent Customers (1x1 Square)
export function CustomerMostFrequentWidget({
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
  const topGuests = summary.topGuests || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">VIP DINING CLUB</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Most Frequent Customers
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-xs flex flex-col gap-1.5 my-auto min-h-[110px] justify-center">
        {topGuests.length === 0 ? (
          <div className="text-center py-4 text-xs text-secondary">
            No repeated diner history available
          </div>
        ) : (
          topGuests.slice(0, 3).map((g: any, idx: number) => (
            <div
              key={idx}
              className="p-1.5 rounded-DEFAULT bg-surface-container-lowest flex items-center justify-between shadow-2xs"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                  {g.rank}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-on-surface truncate">{g.name}</span>
                  <span className="text-[10px] text-secondary">
                    {g.visits} • {g.tier}
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold text-on-surface shrink-0">{g.spend}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>VIP Leaderboard</span>
        <span>Cumulative Spend</span>
      </div>
    </div>
  );
}

// 6. Customer Order Frequency (1x1 Square)
export function CustomerOrderFrequencyWidget({
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
  const cohorts = summary.cohorts || [
    { label: "1 Visit / Mo (Discovery)", percent: 38 },
    { label: "2-3 Visits (Core Regulars)", percent: 44 },
    { label: "4+ Visits (VIP Club)", percent: 18 },
  ];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              CHART
            </span>
            <span className="font-label-sm text-[11px] text-secondary">COHORT VELOCITY</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Customer Order Frequency
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-2 my-auto min-h-[110px] justify-center">
        {cohorts.map((c: any, idx: number) => (
          <div key={idx} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-secondary truncate">{c.label}</span>
              <span className="font-semibold text-on-surface shrink-0 ml-1">{c.percent}%</span>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  idx === 0 ? "bg-secondary" : idx === 1 ? "bg-primary" : "bg-amber-600"
                }`}
                style={{ width: `${c.percent}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Cohort Velocity</span>
        <span>Monthly Pace</span>
      </div>
    </div>
  );
}

