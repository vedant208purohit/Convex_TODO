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

export const CUSTOMER_CATALOG_WIDGETS: OrdersCatalogWidget[] = [
  {
    id: "customers_total",
    categoryTrack: "Audience Reach",
    title: "Total Customers",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "All unique guest profiles registered across dine-in, takeaway, and digital online channels.",
    defaultWidth: 4,
  },
  {
    id: "customers_new",
    categoryTrack: "Acquisition Rate",
    title: "New Customers",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "First-time registered dining folios and newly created guest accounts in the selected period.",
    defaultWidth: 4,
  },
  {
    id: "customers_returning",
    categoryTrack: "Retention & Loyalty",
    title: "Returning Customers",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Repeat patrons with 2 or more historical dining visits.",
    defaultWidth: 4,
  },
  {
    id: "customers_recent",
    categoryTrack: "Guest Log",
    title: "Recent Customers",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Real-time ledger of latest seated and billed patrons with spend history and table location.",
    defaultWidth: 4,
  },
  {
    id: "customers_most_frequent",
    categoryTrack: "Top Patrons",
    title: "Most Frequent Customers",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Ranked customer leaderboard by order frequency and cumulative spend.",
    defaultWidth: 4,
  },
  {
    id: "customers_order_frequency",
    categoryTrack: "Visit Frequency",
    title: "Customer Order Frequency",
    type: "CHART",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Distribution of customer visit counts across one-time, occasional, and frequent diners.",
    defaultWidth: 4,
  },
];

// 1. Total Customers
export function DrawerCustomerTotalCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const totalGuests = summary.totalGuests ?? (data?.kpi?.value != null ? String(data.kpi.value) : "0");
  const deltaPercent = summary.deltaPercent ?? "+0.0%";
  const dineInPercent = summary.dineInPercent ?? 0;
  const secondaryLabel =
    summary.secondaryChannelLabel ||
    (summary.takeawayCount > 0 ? "Takeaway" : summary.deliveryCount > 0 ? "Delivery" : summary.onlineCount > 0 ? "Online" : "Takeaway");
  const secondaryPercent = summary.secondaryChannelPercent ?? summary.onlinePercent ?? 0;

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-2xl font-bold text-stone-900">{totalGuests}</span>
              <span className="text-stone-500 text-xs">Guests</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
              {deltaPercent}
            </span>
          </div>
          <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden flex">
            {dineInPercent + secondaryPercent > 0 ? (
              <>
                <div className="bg-black h-full" style={{ width: `${dineInPercent}%` }}></div>
                <div className="bg-stone-400 h-full" style={{ width: `${secondaryPercent}%` }}></div>
              </>
            ) : (
              <div className="bg-stone-300 h-full w-full opacity-40"></div>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5">
            <span>Dine-In: {dineInPercent}%</span>
            <span>{secondaryLabel}: {secondaryPercent}%</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 2. New Customers
export function DrawerCustomerNewCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const newCount = summary.newCount ?? 0;
  const deltaPercent = summary.deltaPercent ?? "+0.0% vs prev period";
  const intakeRate = summary.intakeRate ?? `${newCount} New Diners`;
  const foliosOpened = summary.foliosOpened ?? `First Orders: ${newCount}`;
  const fastTrack = summary.fastTrack ?? `New Patrons: ${newCount}`;

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-2xl font-bold text-stone-900">{newCount}</span>
              <span className="text-stone-500 text-xs">New</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
              {deltaPercent}
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 rounded bg-stone-100 text-[10.5px]">
            <span className="text-stone-600 truncate">{intakeRate}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-stone-400 pt-0.5">
            <span>{foliosOpened}</span>
            <span>{fastTrack}</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 3. Returning Customers
export function DrawerCustomerReturningCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const retentionPercent = summary.retentionPercent ?? "0%";
  const visitsCount = summary.visitsCount ?? "0 Visits";
  const redeemedFormatted = summary.redeemedFormatted ?? "0 repeat visitors";
  const avgFrequency = summary.avgFrequency ?? "0.0x / patron";

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-2xl font-bold text-stone-900">{retentionPercent}</span>
              <span className="text-stone-500 text-xs">Retention</span>
            </div>
            <span className="text-[10px] font-semibold text-stone-800 bg-stone-100 px-2 py-0.5 rounded-full">
              {visitsCount}
            </span>
          </div>
          <div className="flex items-center justify-between px-2 py-1 rounded bg-stone-100 text-[10.5px]">
            <span className="text-stone-500">Repeat Visitors:</span>
            <span className="font-semibold text-stone-900">{redeemedFormatted}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5">
            <span>Avg. Frequency</span>
            <span className="font-semibold text-stone-800">{avgFrequency}</span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 4. Recent Customers
export function DrawerCustomerRecentCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const recentGuests = summary.recentGuests || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          {recentGuests.length === 0 ? (
            <div className="text-center py-2 text-xs text-stone-400">No recent guest folios</div>
          ) : (
            recentGuests.slice(0, 3).map((g: any, idx: number) => (
              <div key={idx} className="p-1 rounded bg-white border border-[#f0eae3] flex items-center justify-between">
                <div className="flex flex-col min-w-0 pr-1">
                  <span className="font-bold text-stone-900 text-[11px] truncate">{g.name}</span>
                  <span className="text-[9.5px] text-stone-400">{g.table} • {g.time}</span>
                </div>
                <span className="font-bold text-stone-900 text-[11px] shrink-0">{g.spend}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 5. Most Frequent Customers
export function DrawerCustomerMostFrequentCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const topGuests = summary.topGuests || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          {topGuests.length === 0 ? (
            <div className="text-center py-2 text-xs text-stone-400">No repeated diner records</div>
          ) : (
            topGuests.slice(0, 3).map((g: any, idx: number) => (
              <div key={idx} className="p-1 rounded bg-white border border-[#f0eae3] flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <span className="w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                    {g.rank}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-stone-900 text-[11px] truncate">{g.name}</span>
                    <span className="text-[9.5px] text-stone-400">{g.visits}</span>
                  </div>
                </div>
                <span className="font-bold text-stone-900 text-[11px] shrink-0">{g.spend}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 6. Customer Order Frequency
export function DrawerCustomerOrderFrequencyCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const cohorts = summary.cohorts || [
    { label: "1 Visit", percent: 0 },
    { label: "2 - 3 Visits", percent: 0 },
    { label: "4+ Visits", percent: 0 },
  ];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">{widget.title}</h3>
          </div>
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}>
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          {cohorts.map((c: any, idx: number) => (
            <div key={idx} className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-stone-600 truncate">{c.label}</span>
                <span className="font-bold text-stone-900 shrink-0">{c.percent}%</span>
              </div>
              <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${idx === 0 ? "bg-stone-500" : idx === 1 ? "bg-black" : "bg-amber-600"}`}
                  style={{ width: `${c.percent}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function renderCustomerDrawerCard(props: DrawerCardProps) {
  switch (props.widget.id) {
    case "customers_total":
      return <DrawerCustomerTotalCard key={props.widget.id} {...props} />;
    case "customers_new":
      return <DrawerCustomerNewCard key={props.widget.id} {...props} />;
    case "customers_returning":
      return <DrawerCustomerReturningCard key={props.widget.id} {...props} />;
    case "customers_recent":
      return <DrawerCustomerRecentCard key={props.widget.id} {...props} />;
    case "customers_frequent":
    case "customers_most_frequent":
      return <DrawerCustomerMostFrequentCard key={props.widget.id} {...props} />;
    case "customers_order_frequency":
      return <DrawerCustomerOrderFrequencyCard key={props.widget.id} {...props} />;
    default:
      return null;
  }
}

