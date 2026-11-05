"use client";

import React from "react";
import { OrdersCatalogWidget } from "../AddWidgetDrawer";
import { formatPriceWithSymbol } from "@/lib/constants/countries";

export interface DrawerCardProps {
  widget: OrdersCatalogWidget;
  isPlaced: boolean;
  placement?: { gridRow: number; gridCol: number };
  onAdd: () => void;
  data?: any;
}

export const OVERVIEW_CATALOG_WIDGETS: OrdersCatalogWidget[] = [
  {
    id: "overview_net_revenue",
    categoryTrack: "REVENUE METRIC",
    title: "Net Sales",
    type: "KPI",
    typeBadgeBg: "bg-surface-container-high text-on-surface",
    description: "Sum of settled bills minus voids and refunds for the active trading period.",
    defaultWidth: 4,
  },
  {
    id: "overview_total_orders",
    categoryTrack: "ORDER VELOCITY",
    title: "Total Orders",
    type: "KPI",
    typeBadgeBg: "bg-surface-container-high text-on-surface",
    description: "Gross ticket count processed across all dining and digital dispatch channels.",
    defaultWidth: 4,
  },
  {
    id: "overview_average_order_value",
    categoryTrack: "TICKET VALUE",
    title: "Average Order Value",
    type: "KPI",
    typeBadgeBg: "bg-surface-container-high text-on-surface",
    description: "Mean financial spend per guest check, factoring beverage and food items.",
    defaultWidth: 4,
  },
  {
    id: "overview_active_orders",
    categoryTrack: "FLOOR PULSE",
    title: "Active Orders",
    type: "KPI",
    typeBadgeBg: "bg-surface-container-high text-on-surface",
    description: "Running tables and takeaway tickets currently open and unpaid.",
    defaultWidth: 4,
  },
  {
    id: "overview_pending_orders",
    categoryTrack: "KITCHEN BACKLOG",
    title: "Pending Orders",
    type: "KPI",
    typeBadgeBg: "bg-surface-container-high text-on-surface",
    description: "Orders submitted to kitchen stations waiting for cook line acknowledgment.",
    defaultWidth: 4,
  },
  {
    id: "overview_sales_trends",
    categoryTrack: "TEMPORAL INTRADAY",
    title: "Sales Trend",
    type: "CHART",
    typeBadgeBg: "bg-surface-container-high text-on-surface",
    description: "Hourly sales throughput curve tracking lunch rush and dinner peak against targets.",
    defaultWidth: 6,
  },
  {
    id: "overview_order_status_distribution",
    categoryTrack: "FULFILMENT STAGES",
    title: "Order Status Summary",
    type: "CHART",
    typeBadgeBg: "bg-surface-container-high text-on-surface",
    description: "Proportional split of order volume across completed, billed, in-prep, and cancelled.",
    defaultWidth: 4,
  },
  {
    id: "overview_business_summary",
    categoryTrack: "HOLISTIC AUDIT",
    title: "Business Performance Summary",
    type: "KPI",
    typeBadgeBg: "bg-surface-container-high text-on-surface",
    description: "Consolidated executive card comparing revPASH, food cost %, and labor ratio.",
    defaultWidth: 6,
  },
];

// Helper to strip redundant period suffix from delta strings in compact card pills
function formatCleanDelta(delta?: string): string {
  if (!delta) return "+0.0%";
  const match = delta.match(/^[+-]?\d+(?:\.\d+)?%/);
  if (match) return match[0];
  return delta.replace(/\s*vs\s+.*$/i, "").trim();
}

// Card 1: Net Sales
export function DrawerOverviewNetSalesCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const currencySymbol = data?.currencySymbol || "₹";
  const displayVal = data?.kpi?.displayValue || formatPriceWithSymbol(0, currencySymbol, data?.country);
  const delta = data?.kpi?.deltaFormatted || "+0.0% vs yesterday";
  const cleanDelta = formatCleanDelta(delta);
  const isPos = !delta.includes("-");
  const settledCount = data?.summary?.settledCount ?? 0;
  const openCount = data?.summary?.openCount ?? 0;

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-1 border border-[#f3ede6]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-serif text-2xl sm:text-[26px] text-stone-900 font-normal tracking-tight whitespace-nowrap">
              {displayVal}
            </span>
            <span className="bg-[#ede6df] text-stone-800 text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap">
              <span className="material-symbols-outlined text-[13px]">{isPos ? "trending_up" : "trending_down"}</span>
              <span>{cleanDelta}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-stone-500 pt-1 text-[11px]">
            <span>vs yesterday</span>
            <span className="font-medium text-stone-700">{settledCount} Settled • {openCount} Open</span>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}` : "1X1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs">
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95">
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 2: Total Orders
export function DrawerOverviewTotalOrdersCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const value = data?.kpi?.value ?? 0;
  const delta = data?.kpi?.deltaFormatted || "+0.0%";
  const cleanDelta = formatCleanDelta(delta);
  const isPos = !delta.includes("-");
  const dineInCount = data?.summary?.dineInCount ?? 0;
  const onlineCount = data?.summary?.onlineCount ?? 0;

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-1 border border-[#f3ede6]">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-serif text-2xl sm:text-[26px] text-stone-900 font-normal tracking-tight">
                {value}
              </span>
              <span className="text-xs font-sans text-stone-500 font-normal">
                Tkts
              </span>
            </div>
            <span className="bg-[#ede6df] text-stone-800 text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap">
              <span className="material-symbols-outlined text-[13px]">{isPos ? "trending_up" : "trending_down"}</span>
              <span>{cleanDelta}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-stone-500 pt-1 text-[11px]">
            <span>Today active</span>
            <span className="font-medium text-stone-700">{dineInCount} Dine-In / {onlineCount} Online</span>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}` : "1X1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs">
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95">
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 3: Average Order Value
export function DrawerOverviewAovCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const currencySymbol = data?.currencySymbol || "₹";
  const displayVal = data?.kpi?.displayValue || formatPriceWithSymbol(0, currencySymbol, data?.country);
  const delta = data?.kpi?.deltaFormatted || "+0.0% vs 7d avg";
  const cleanDelta = formatCleanDelta(delta);
  const isPos = !delta.includes("-");
  const topTicket = data?.summary?.topTicket || formatPriceWithSymbol(0, currencySymbol, data?.country);

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-1 border border-[#f3ede6]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-serif text-2xl sm:text-[26px] text-stone-900 font-normal tracking-tight whitespace-nowrap">
              {displayVal}
            </span>
            <span className="bg-[#ede6df] text-stone-800 text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap">
              <span className="material-symbols-outlined text-[13px]">{isPos ? "trending_up" : "trending_down"}</span>
              <span>{cleanDelta}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-stone-500 pt-1 text-[11px]">
            <span>vs 7d avg</span>
            <span className="font-medium text-stone-700">Top: {topTicket}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}` : "1X1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs">
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95">
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 4: Active Orders
export function DrawerOverviewActiveOrdersCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const value = data?.kpi?.value ?? 0;
  const diningCount = data?.summary?.diningCount ?? 0;
  const prepCount = data?.summary?.prepCount ?? 0;
  const total = Math.max(1, diningCount + prepCount);
  const diningPct = Math.round((diningCount / total) * 100);

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6]">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-serif text-2xl sm:text-[26px] text-stone-900 font-normal tracking-tight">
                {value}
              </span>
              <span className="text-xs font-sans text-stone-500 font-normal">
                Orders
              </span>
            </div>
            <span className="bg-[#ede6df] text-stone-800 text-[11px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 shrink-0 whitespace-nowrap">
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
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}` : "1X1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs">
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95">
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 5: Pending Orders
export function DrawerOverviewPendingOrdersCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const value = data?.kpi?.value ?? 0;
  const oldestWait = data?.summary?.oldestWait || "0m 00s";

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-1.5 border border-[#f3ede6]">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-serif text-2xl sm:text-[26px] text-stone-900 font-normal tracking-tight">
                {value}
              </span>
              <span className="text-xs font-sans text-stone-500 font-normal">
                Tickets
              </span>
            </div>
            <span className="bg-[#ede6df] text-stone-800 text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 whitespace-nowrap">
              Hold Queue
            </span>
          </div>
          <div className="flex items-center justify-between text-stone-500 pt-1 text-[11px]">
            <span>Buffer wait</span>
            <span className="font-medium text-rose-600">Oldest: {oldestWait}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}` : "1X1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs">
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95">
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 6: Sales Trend
export function DrawerOverviewSalesTrendsCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const currencySymbol = data?.currencySymbol || "₹";
  const peakText = data?.summary?.peakText || "No sales recorded yet";
  const bars: Array<{ label: string; value: number }> = data?.chart?.data || data?.summary?.bars || [
    { label: "11a", value: 0 },
    { label: "1p", value: 0 },
    { label: "3p", value: 0 },
    { label: "5p", value: 0 },
    { label: "7p", value: 0 },
    { label: "9p", value: 0 },
  ];
  const maxVal = Math.max(...bars.map((b) => b.value), 0);

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6]">
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
                        ? "bg-stone-300 hover:bg-stone-400"
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
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}` : "2X1 STRIP"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs">
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95">
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 7: Order Status Summary
export function DrawerOverviewOrderStatusSummaryCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const total = data?.summary?.total ?? data?.kpi?.value ?? 0;
  const completed = data?.summary?.completed ?? 0;
  const billed = data?.summary?.billed ?? 0;
  const inPrep = data?.summary?.inPrep ?? 0;
  const newOther = data?.summary?.newOther ?? Math.max(0, total - completed - billed - inPrep);

  const compPct = total > 0 ? (completed / total) * 88 : 0;
  const billedPct = total > 0 ? (billed / total) * 88 : 0;
  const prepPct = total > 0 ? (inPrep / total) * 88 : 0;

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex items-center justify-between gap-3 border border-[#f3ede6]">
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
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}` : "1X1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs">
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95">
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 8: Business Performance Summary
export function DrawerOverviewBusinessSummaryCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const currencySymbol = data?.currencySymbol || "₹";
  const revPash = data?.summary?.revPash || formatPriceWithSymbol(0, currencySymbol, data?.country);
  const revPashSubtext = data?.summary?.revPashSubtext || "Realized / Seat-Hour";
  const foodCost = data?.summary?.foodCost || "100%";
  const foodCostSubtext = data?.summary?.foodCostSubtext || "Net Realization";
  const laborRatio = data?.summary?.laborRatio || "0.0%";
  const laborRatioSubtext = data?.summary?.laborRatioSubtext || "Discount Ratio";

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="grid grid-cols-3 gap-2 bg-[#fcf8f5] rounded-lg p-2.5 border border-[#f3ede6]">
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
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}` : "2X1 STRIP"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs">
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95">
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function renderOverviewDrawerCard(
  widget: OrdersCatalogWidget,
  isPlaced: boolean,
  placement: { gridRow: number; gridCol: number } | undefined,
  onAdd: () => void,
  data: any
) {
  switch (widget.id) {
    case "overview_net_revenue":
      return <DrawerOverviewNetSalesCard key={widget.id} widget={widget} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={data} />;
    case "overview_total_orders":
      return <DrawerOverviewTotalOrdersCard key={widget.id} widget={widget} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={data} />;
    case "overview_average_order_value":
      return <DrawerOverviewAovCard key={widget.id} widget={widget} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={data} />;
    case "overview_active_orders":
      return <DrawerOverviewActiveOrdersCard key={widget.id} widget={widget} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={data} />;
    case "overview_pending_orders":
      return <DrawerOverviewPendingOrdersCard key={widget.id} widget={widget} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={data} />;
    case "overview_sales_trends":
      return <DrawerOverviewSalesTrendsCard key={widget.id} widget={widget} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={data} />;
    case "overview_order_status_distribution":
      return <DrawerOverviewOrderStatusSummaryCard key={widget.id} widget={widget} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={data} />;
    case "overview_business_summary":
      return <DrawerOverviewBusinessSummaryCard key={widget.id} widget={widget} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={data} />;
    default:
      return null;
  }
}

