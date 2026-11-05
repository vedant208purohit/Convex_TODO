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

// 1. Net Sales Widget
export function OverviewNetSalesWidget({
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
  const displayVal =
    widgetData?.kpi?.displayValue ||
    formatPriceWithSymbol(0, currencySymbol, country);
  const delta = widgetData?.kpi?.deltaFormatted || "+0.0% vs yesterday";
  const isPos = !delta.includes("-");
  const settledCount = (widgetData as any)?.summary?.settledCount ?? 0;
  const openCount = (widgetData as any)?.summary?.openCount ?? 0;

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            REVENUE METRIC
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Net Sales
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
            <span className="material-symbols-outlined text-[13px]">{isPos ? "trending_up" : "trending_down"}</span>
            {delta}
          </span>
        </div>
        <div className="flex items-center justify-between text-stone-500 pt-1 text-[11px]">
          <span>vs yesterday</span>
          <span className="font-medium text-stone-700">{settledCount} Settled • {openCount} Open</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Pacing Ledger</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Online</span>
        </span>
      </div>
    </div>
  );
}

// 2. Total Orders Widget
export function OverviewTotalOrdersWidget({
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
  const delta = widgetData?.kpi?.deltaFormatted || "+0.0%";
  const isPos = !delta.includes("-");
  const dineInCount = (widgetData as any)?.summary?.dineInCount ?? 0;
  const onlineCount = (widgetData as any)?.summary?.onlineCount ?? 0;

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            ORDER VELOCITY
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Total Orders
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-1 border border-[#f3ede6] my-auto">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-serif text-2xl text-stone-900 font-normal">
            {value} <span className="font-serif text-sm text-stone-500">Tkts</span>
          </span>
          <span className="bg-[#ede6df] text-stone-800 text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[13px]">{isPos ? "arrow_upward" : "arrow_downward"}</span>
            {delta}
          </span>
        </div>
        <div className="flex items-center justify-between text-stone-500 pt-1 text-[11px]">
          <span>Today active</span>
          <span className="font-medium text-stone-700">{dineInCount} Dine-In / {onlineCount} Online</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Channel Reach</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>All Channels</span>
        </span>
      </div>
    </div>
  );
}

// 3. Average Order Value Widget
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
    widgetData?.kpi?.deltaFormatted ||
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

// 4. Active Orders Widget
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

// 5. Pending Orders Widget
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

// 6. Sales Trend Widget
export function OverviewSalesTrendsWidget({
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

  const peakText = (widgetData as any)?.summary?.peakText || "No sales recorded yet";
  const bars: Array<{ label: string; value: number }> =
    (widgetData as any)?.chart?.data || (widgetData as any)?.summary?.bars || [
      { label: "11a", value: 0 },
      { label: "1p", value: 0 },
      { label: "3p", value: 0 },
      { label: "5p", value: 0 },
      { label: "7p", value: 0 },
      { label: "9p", value: 0 },
    ];
  const maxVal = Math.max(...bars.map((b) => b.value), 0);

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            TEMPORAL INTRADAY
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Sales Trend
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] my-auto">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[10px] uppercase font-bold text-stone-400">Hourly Throughput</span>
          <span className="font-medium text-stone-800 text-[11px]">{peakText}</span>
        </div>

        <div className="flex items-end justify-between gap-1.5 h-16 pt-2">
          {bars.map((bar, idx) => {
            const heightPct = maxVal > 0 ? Math.round((bar.value / maxVal) * 100) : 0;
            const isPeak = maxVal > 0 && bar.value === maxVal;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  className={`w-full rounded-t transition-all ${
                    isPeak
                      ? "bg-stone-900"
                      : heightPct > 0
                      ? "bg-stone-400"
                      : "bg-stone-200"
                  }`}
                  style={{ height: `${Math.max(6, heightPct)}%` }}
                />
                <span className="text-[9px] text-stone-500">{bar.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Hourly Curve</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Active Sync</span>
        </span>
      </div>
    </div>
  );
}

// 7. Order Status Summary Widget
export function OverviewOrderStatusSummaryWidget({
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

  const total = (widgetData as any)?.summary?.total ?? widgetData?.kpi?.value ?? 0;
  const completed = (widgetData as any)?.summary?.completed ?? 0;
  const billed = (widgetData as any)?.summary?.billed ?? 0;
  const inPrep = (widgetData as any)?.summary?.inPrep ?? 0;
  const newOther = (widgetData as any)?.summary?.newOther ?? Math.max(0, total - completed - billed - inPrep);

  const compPct = total > 0 ? (completed / total) * 88 : 0;
  const billedPct = total > 0 ? (billed / total) * 88 : 0;
  const prepPct = total > 0 ? (inPrep / total) * 88 : 0;

  return (
    <div className="flex flex-col justify-between h-full font-sans">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <span className="font-label-sm text-[10px] font-bold text-stone-400 tracking-widest uppercase">
            FULFILMENT STAGES
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5">
            Order Status Summary
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-[#fcf8f5] rounded-lg p-3 flex items-center justify-between gap-3 border border-[#f3ede6] my-auto">
        <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle className="stroke-stone-200" cx="18" cy="18" fill="none" r="14" strokeWidth="4" />
            {total > 0 && (
              <>
                <circle className="stroke-stone-900" cx="18" cy="18" fill="none" r="14" strokeDasharray={`${compPct} 88`} strokeDashoffset="0" strokeWidth="4" />
                <circle className="stroke-stone-500" cx="18" cy="18" fill="none" r="14" strokeDasharray={`${billedPct} 88`} strokeDashoffset={`-${compPct}`} strokeWidth="4" />
                <circle className="stroke-stone-400" cx="18" cy="18" fill="none" r="14" strokeDasharray={`${prepPct} 88`} strokeDashoffset={`-${compPct + billedPct}`} strokeWidth="4" />
              </>
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-serif text-sm text-stone-900 font-bold leading-none">{total}</span>
            <span className="text-[7.5px] text-stone-400 uppercase font-semibold leading-none mt-0.5">Total</span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 text-xs w-full">
          <div className="flex items-center justify-between text-stone-700">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-stone-900" />Completed</span>
            <span className="font-semibold text-stone-900">{completed}</span>
          </div>
          <div className="flex items-center justify-between text-stone-700">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-stone-500" />Billed</span>
            <span className="font-semibold text-stone-900">{billed}</span>
          </div>
          <div className="flex items-center justify-between text-stone-700">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-stone-400" />In-Prep</span>
            <span className="font-semibold text-stone-900">{inPrep}</span>
          </div>
          <div className="flex items-center justify-between text-stone-500 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-stone-300" />New/Other</span>
            <span className="font-semibold">{newOther}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary pt-1 border-t border-surface-container/60 mt-1">
        <span className="text-label-sm font-label-sm text-outline">Fulfilment Stages</span>
        <span className="flex items-center gap-1 text-on-surface text-label-sm font-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
          <span>Live Sync</span>
        </span>
      </div>
    </div>
  );
}

// 8. Business Performance Summary Widget
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
  const revPash = (widgetData as any)?.summary?.revPash || formatPriceWithSymbol(0, currencySymbol, country);
  const revPashSubtext = (widgetData as any)?.summary?.revPashSubtext || "Realized / Seat-Hour";
  const foodCost = (widgetData as any)?.summary?.foodCost || "100%";
  const foodCostSubtext = (widgetData as any)?.summary?.foodCostSubtext || "Net Realization";
  const laborRatio = (widgetData as any)?.summary?.laborRatio || "0.0%";
  const laborRatioSubtext = (widgetData as any)?.summary?.laborRatioSubtext || "Discount Ratio";

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
          <span className="text-[9px] text-stone-500 mt-0.5">{revPashSubtext}</span>
        </div>
        <div className="flex flex-col p-2 bg-white rounded border border-stone-100">
          <span className="text-[9.5px] text-stone-400 uppercase font-semibold">Net Margin</span>
          <span className="font-serif text-lg text-stone-900 font-normal">{foodCost}</span>
          <span className="text-[9px] text-stone-500 mt-0.5">{foodCostSubtext}</span>
        </div>
        <div className="flex flex-col p-2 bg-white rounded border border-stone-100">
          <span className="text-[9.5px] text-stone-400 uppercase font-semibold">Discounts</span>
          <span className="font-serif text-lg text-stone-900 font-normal">{laborRatio}</span>
          <span className="text-[9px] text-stone-500 mt-0.5">{laborRatioSubtext}</span>
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
