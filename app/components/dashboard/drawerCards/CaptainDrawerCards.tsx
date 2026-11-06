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

export const CAPTAIN_CATALOG_WIDGETS: OrdersCatalogWidget[] = [
  {
    id: "captain_active_orders",
    categoryTrack: "FLOOR ASSIGNMENT",
    title: "Active Orders by Captain",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Real-time ticket count and active covers assigned to each floor captain.",
    defaultWidth: 4,
  },
  {
    id: "captain_table_service_status",
    categoryTrack: "SERVICE PACING",
    title: "Table Service Status",
    type: "LIVE",
    typeBadgeBg: "bg-[#ffdad6] text-[#ba1a1a]",
    description: "Real-time course stages across active tables under captain supervision.",
    defaultWidth: 4,
  },
  {
    id: "captain_assigned_tables",
    categoryTrack: "ROSTER ALLOCATION",
    title: "Assigned Tables",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Section assignments and active table distribution per captain shift.",
    defaultWidth: 4,
  },
  {
    id: "captain_service_time",
    categoryTrack: "ATTENDANT TEMPO",
    title: "Service Time",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Average duration elapsed between guest seating, order taking, and bill presentation.",
    defaultWidth: 4,
  },
  {
    id: "captain_orders_awaiting_service",
    categoryTrack: "CALL BELL QUEUE",
    title: "Orders Awaiting Service",
    type: "ALERT",
    typeBadgeBg: "bg-[#ffdad6] text-[#ba1a1a]",
    description: "Food ready at kitchen pass waiting for server pickup and table delivery.",
    defaultWidth: 4,
  },
  {
    id: "captain_performance_summary",
    categoryTrack: "CAPTAIN METRICS",
    title: "Captain Performance Summary",
    type: "CHART",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Comparative sales volume, tip pool allocation, and cover turn efficiency across servers.",
    defaultWidth: 4,
  },
  {
    id: "captain_order_activity",
    categoryTrack: "AUDIT TRAIL",
    title: "Captain Order Activity",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Chronological audit trail of line items added, course fires, and discount requests by captains.",
    defaultWidth: 12,
  },
];

// Card 1: Active Orders by Captain
export function DrawerCaptainActiveOrdersCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const captains = data?.summary?.captains || [];

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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6]">
          {captains.length > 0 ? (
            captains.map((c: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-1 bg-white rounded border border-[#f0eae3] text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-700">
                    {c.rank}
                  </span>
                  <div>
                    <div className="font-semibold text-stone-800">{c.name} <span className="text-[10px] text-stone-400 font-normal">({c.zone})</span></div>
                    <div className="text-[10px] text-stone-500">{c.tablesCount} Tables • {c.covers} Covers</div>
                  </div>
                </div>
                <span className="font-bold text-stone-900">{c.amountFormatted || formatPriceWithSymbol(c.amount, data?.currencySymbol || "₹", data?.country, true)}</span>
              </div>
            ))
          ) : (
            <div className="py-2 text-center text-stone-400 text-xs">0 active seated tables assigned to captains</div>
          )}
        </div>
      </div>

      <div className="pt-3 flex items-center justify-between border-t border-[#f0eae3] mt-3">
        <span className="text-[10px] text-stone-400 uppercase font-medium">
          {isPlaced && placement ? `SLOT: R${placement.gridRow + 1}:C${placement.gridCol + 1}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1 rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1 rounded-full shadow-xs cursor-pointer">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 2: Table Service Status
export function DrawerCaptainTableServiceStatusCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const tableCards = data?.summary?.tableCards || [];

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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-wrap gap-1.5 border border-[#f3ede6]">
          {tableCards.length > 0 ? (
            tableCards.slice(0, 4).map((tc: any, idx: number) => (
              <div key={idx} className="flex-1 min-w-[80px] p-1.5 bg-white rounded border border-[#f0eae3] text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-800">{tc.tableNumber}</span>
                  <span className="text-[10px] text-stone-400">{tc.seating}</span>
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">{tc.stage}</div>
              </div>
            ))
          ) : (
            <div className="w-full py-2 text-center text-stone-400 text-xs">No active dining tables</div>
          )}
        </div>
      </div>

      <div className="pt-3 flex items-center justify-between border-t border-[#f0eae3] mt-3">
        <span className="text-[10px] text-stone-400 uppercase font-medium">
          {isPlaced && placement ? `SLOT: R${placement.gridRow + 1}:C${placement.gridCol + 1}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1 rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1 rounded-full shadow-xs cursor-pointer">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 3: Assigned Tables
export function DrawerCaptainAssignedTablesCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const rosters = data?.summary?.rosters || [];

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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6]">
          {rosters.length > 0 ? (
            rosters.map((r: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-1 bg-white rounded border border-[#f0eae3] text-xs">
                <div>
                  <div className="font-semibold text-stone-800">{r.name}</div>
                  <div className="text-[10px] text-stone-400">{r.section}</div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-stone-900">{r.activeCount} Active</span>
                  <span className="text-[10px] text-stone-400 block">{r.activePct} load</span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-2 text-center text-stone-400 text-xs">0 tables allocated</div>
          )}
        </div>
      </div>

      <div className="pt-3 flex items-center justify-between border-t border-[#f0eae3] mt-3">
        <span className="text-[10px] text-stone-400 uppercase font-medium">
          {isPlaced && placement ? `SLOT: R${placement.gridRow + 1}:C${placement.gridCol + 1}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1 rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1 rounded-full shadow-xs cursor-pointer">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 4: Service Time
export function DrawerCaptainServiceTimeCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const summary = data?.summary || {};

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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6]">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif text-stone-900">{summary.avgTurnMins ?? "--"}</span>
            <span className="text-[10px] text-stone-400">Benchmark: 42.0m</span>
          </div>
          <div className="flex justify-between text-xs text-stone-600 pt-1 border-t border-[#f0eae3]">
            <span>Fastest:</span>
            <span className="font-semibold text-stone-900">{summary.fastestSection || "--"}</span>
          </div>
        </div>
      </div>

      <div className="pt-3 flex items-center justify-between border-t border-[#f0eae3] mt-3">
        <span className="text-[10px] text-stone-400 uppercase font-medium">
          {isPlaced && placement ? `SLOT: R${placement.gridRow + 1}:C${placement.gridCol + 1}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1 rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1 rounded-full shadow-xs cursor-pointer">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 5: Orders Awaiting Service
export function DrawerCaptainOrdersAwaitingServiceCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const summary = data?.summary || {};
  const isAwaiting = (summary.countAtPass ?? 0) > 0;

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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
            <span className={`material-symbols-outlined ${isAwaiting ? "text-amber-500" : "text-emerald-500"} text-[16px]`}>
              {isAwaiting ? "notifications_active" : "check_circle"}
            </span>
            <span>{summary.countAtPass ?? 0} Orders at Pass</span>
          </div>
          <span className="text-[11px] text-stone-500">
            {isAwaiting ? "Runner needed for hot food pickup" : "No orders waiting at pass"}
          </span>
        </div>
      </div>

      <div className="pt-3 flex items-center justify-between border-t border-[#f0eae3] mt-3">
        <span className="text-[10px] text-stone-400 uppercase font-medium">
          {isPlaced && placement ? `SLOT: R${placement.gridRow + 1}:C${placement.gridCol + 1}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1 rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1 rounded-full shadow-xs cursor-pointer">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 6: Captain Performance Summary
export function DrawerCaptainPerformanceSummaryCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const captains = data?.summary?.captains || [];

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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6]">
          {captains.length > 0 ? (
            captains.slice(0, 2).map((c: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-1 bg-white rounded border border-[#f0eae3] text-xs">
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
            <div className="py-2 text-center text-stone-400 text-xs">0 covers served in this period</div>
          )}
        </div>
      </div>

      <div className="pt-3 flex items-center justify-between border-t border-[#f0eae3] mt-3">
        <span className="text-[10px] text-stone-400 uppercase font-medium">
          {isPlaced && placement ? `SLOT: R${placement.gridRow + 1}:C${placement.gridCol + 1}` : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1 rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1 rounded-full shadow-xs cursor-pointer">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// Card 7: Captain Order Activity
export function DrawerCaptainOrderActivityCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const events = data?.summary?.auditEvents || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] md:col-span-2 lg:col-span-3">
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
        <p className="text-xs text-stone-500 min-h-[24px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg overflow-hidden border border-[#f3ede6]">
          <div className="grid grid-cols-12 px-3 py-1 bg-stone-100 text-[10px] font-bold uppercase text-stone-500">
            <span className="col-span-2">Time</span>
            <span className="col-span-3">Captain</span>
            <span className="col-span-5">Action</span>
            <span className="col-span-2 text-right">Table</span>
          </div>
          <div className="divide-y divide-[#f0eae3]">
            {events.length > 0 ? (
              events.slice(0, 3).map((ev: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 px-3 py-1.5 items-center text-xs bg-white">
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
      </div>

      <div className="pt-3 flex items-center justify-between border-t border-[#f0eae3] mt-3">
        <span className="text-[10px] text-stone-400 uppercase font-medium">
          {isPlaced && placement ? `SLOT: R${placement.gridRow + 1}:C${placement.gridCol + 1}` : "SIZE: 2×1 STRIP"}
        </span>
        {isPlaced ? (
          <button disabled className="inline-flex items-center gap-1 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1 rounded-full cursor-default">
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button onClick={onAdd} className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1 rounded-full shadow-xs cursor-pointer">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

