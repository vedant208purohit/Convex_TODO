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

// 1. Average Order Value Widget
export function OverviewAovWidget({
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

  const currencySymbol = widgetData?.currencySymbol || "₹";
  const country = widgetData?.country;
  const displayVal = widgetData?.kpi?.displayValue || formatPriceWithSymbol(0, currencySymbol, country);
  const delta =
    widgetData?.kpi?.deltaLabel ||
    (widgetData?.kpi?.deltaPercent !== undefined
      ? `${widgetData.kpi.deltaPercent >= 0 ? "+" : ""}${widgetData.kpi.deltaPercent}% vs 7d avg`
      : "+0.0% vs 7d avg");
  const topTicket = (widgetData as any)?.summary?.topTicket || formatPriceWithSymbol(0, currencySymbol, country);

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            TICKET VALUE
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Average Order Value
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-1 border border-[#f3ede6] my-auto">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-serif text-2xl text-stone-900 font-normal">{displayVal}</span>
          <span className="bg-[#ede6df] text-stone-800 text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[13px]">trending_up</span>
            {delta}
          </span>
        </div>
        <div className="flex items-center justify-between text-stone-500 pt-1 text-[11px]">
          <span>vs 7d avg</span>
          <span className="font-medium text-stone-700">Top: {topTicket}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Ticket Pacing</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// 2. Active Orders Widget
export function OverviewActiveOrdersWidget({
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

  const value = widgetData?.kpi?.value ?? 0;
  const diningCount = (widgetData as any)?.summary?.diningCount ?? 0;
  const prepCount = (widgetData as any)?.summary?.prepCount ?? 0;
  const total = Math.max(1, diningCount + prepCount);
  const diningPct = Math.round((diningCount / total) * 100);

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            FLOOR PULSE
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Active Orders
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] my-auto">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-serif text-2xl text-stone-900 font-normal">
            {value} <span className="font-serif text-sm text-stone-500">Orders</span>
          </span>
          <span className="bg-[#ede6df] text-stone-800 text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Active Now
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden flex">
          <div className="bg-stone-900 h-full" style={{ width: `${diningPct}%` }} />
          <div className="bg-stone-400 h-full" style={{ width: `${100 - diningPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-stone-600 text-[11px] font-medium">
          <span>{diningCount} Dining</span>
          <span>{prepCount} Preparing</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Realtime Floor</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// 3. Pending Orders Widget
export function OverviewPendingOrdersWidget({
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

  const value = widgetData?.kpi?.value ?? 0;
  const oldestWait = (widgetData as any)?.summary?.oldestWait || "0m 00s";

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            KITCHEN BACKLOG
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Pending Orders
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-1.5 border border-[#f3ede6] my-auto">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-serif text-2xl text-stone-900 font-normal">
            {value} <span className="font-serif text-sm text-stone-500">Tickets</span>
          </span>
          <span className="bg-[#ede6df] text-stone-800 text-[11px] px-2 py-0.5 rounded-full font-semibold">
            Hold Queue
          </span>
        </div>
        <div className="flex items-center justify-between text-stone-500 pt-1 text-[11px]">
          <span>Buffer wait</span>
          <span className="font-medium text-rose-600">Oldest: {oldestWait}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Queue Telemetry</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// 4. Business Performance Summary Widget
export function OverviewBusinessSummaryWidget({
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

  const currencySymbol = widgetData?.currencySymbol || "₹";
  const country = widgetData?.country;
  const revPash = (widgetData as any)?.summary?.revPash || formatPriceWithSymbol(412, currencySymbol, country);
  const foodCost = (widgetData as any)?.summary?.foodCost || "28.4%";
  const laborRatio = (widgetData as any)?.summary?.laborRatio || "14.2%";

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            HOLISTIC AUDIT
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Business Performance Summary
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-[#fcf8f5] rounded-lg p-2.5 border border-[#f3ede6] my-auto">
        <div className="flex flex-col p-2 bg-white rounded border border-stone-100">
          <span className="text-[9.5px] text-stone-400 uppercase font-semibold">RevPASH</span>
          <span className="font-serif text-lg text-stone-900 font-normal">{revPash}</span>
          <span className="text-[9px] text-stone-500 mt-0.5">+4.8% vs bench</span>
        </div>
        <div className="flex flex-col p-2 bg-white rounded border border-stone-100">
          <span className="text-[9.5px] text-stone-400 uppercase font-semibold">Food Cost</span>
          <span className="font-serif text-lg text-stone-900 font-normal">{foodCost}</span>
          <span className="text-[9px] text-stone-500 mt-0.5">Target &lt; 30%</span>
        </div>
        <div className="flex flex-col p-2 bg-white rounded border border-stone-100">
          <span className="text-[9.5px] text-stone-400 uppercase font-semibold">Labor Ratio</span>
          <span className="font-serif text-lg text-stone-900 font-normal">{laborRatio}</span>
          <span className="text-[9px] text-stone-500 mt-0.5">Optimized</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Executive Audit</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}
