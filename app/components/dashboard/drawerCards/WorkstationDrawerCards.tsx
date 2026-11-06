"use client";

import React from "react";
import { OrdersCatalogWidget } from "../AddWidgetDrawer";

export interface DrawerCardProps {
  widget: OrdersCatalogWidget;
  isPlaced: boolean;
  placement?: { gridRow: number; gridCol: number };
  onAdd: () => void;
  data?: any;
}

export const WORKSTATION_CATALOG_WIDGETS: OrdersCatalogWidget[] = [
  {
    id: "workstation_order_summary",
    categoryTrack: "LANE SUMMARY",
    title: "Workstation Order Summary",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Aggregated order totals and volume currently distributed across all station registers.",
    defaultWidth: 4,
  },
  {
    id: "workstation_orders_by_workstation",
    categoryTrack: "DISTRIBUTION",
    title: "Orders by Workstation",
    type: "CHART",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Comparative order volume processed across individual physical counter terminals.",
    defaultWidth: 4,
  },
  {
    id: "workstation_active_tasks",
    categoryTrack: "DISPATCH QUEUE",
    title: "Active Workstation Tasks",
    type: "LIVE",
    typeBadgeBg: "bg-black text-white",
    description: "Real-time queue of print jobs, kitchen slips, and dispatch triggers assigned to this station.",
    defaultWidth: 4,
  },
  {
    id: "workstation_queue",
    categoryTrack: "BUFFER DEPTH",
    title: "Workstation Queue",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Current volume of orders in buffer awaiting workstation processing.",
    defaultWidth: 4,
  },
  {
    id: "workstation_prep_time",
    categoryTrack: "EFFICIENCY AUDIT",
    title: "Preparation Time by Workstation",
    type: "CHART",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Average ticket turnaround times by station against defined service target SLA.",
    defaultWidth: 4,
  },
  {
    id: "workstation_delayed_orders",
    categoryTrack: "BOTTLENECK DETECTION",
    title: "Delayed Workstation Orders",
    type: "ALERT",
    typeBadgeBg: "bg-[#ffdad6] text-[#ba1a1a]",
    description: "Live alerts for orders exceeding maximum buffer thresholds at any active workstation.",
    defaultWidth: 4,
  },
  {
    id: "workstation_performance",
    categoryTrack: "THROUGHPUT RATIO",
    title: "Workstation Performance",
    type: "CHART",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Comparative processing throughput and load balance across all operational registers.",
    defaultWidth: 4,
  },
  {
    id: "workstation_availability",
    categoryTrack: "SYSTEM HEALTH",
    title: "Workstation Availability",
    type: "LIVE",
    typeBadgeBg: "bg-black text-white",
    description: "Real-time online status, LAN ping latency, and paper roll sensors for all terminals.",
    defaultWidth: 4,
  },
];

// Card 1: Workstation Order Summary
export function DrawerWorkstationOrderSummaryCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const summary = data?.summary || {};
  const total = data?.kpi?.value ?? 0;
  const lanes: Array<{ name: string; count: number }> =
    summary.lanes && summary.lanes.length > 0
      ? summary.lanes
      : [{ name: "Main", count: Number(total) }];

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
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-stone-800">Active Lane Volume</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div
            className={`grid gap-1.5 text-center py-1 ${
              lanes.length === 1
                ? "grid-cols-1"
                : lanes.length === 2
                ? "grid-cols-2"
                : "grid-cols-3"
            }`}
          >
            {lanes.map((lane: any, idx: number) => (
              <div key={idx} className="bg-white p-1 rounded border border-[#f0eae3]">
                <span className="text-[10px] text-stone-400 block truncate">{lane.name}</span>
                <span className="text-xs font-bold text-stone-800">{lane.count}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-stone-100 rounded text-xs">
            <span className="text-stone-600">Total Spool Pool</span>
            <span className="font-bold text-stone-900">{total} Tasks</span>
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

// Card 2: Orders by Workstation
export function DrawerWorkstationOrdersByWorkstationCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const breakdown = data?.summary?.stationBreakdown || [];

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
          <div className="flex justify-between text-[10px] text-stone-400 font-bold uppercase">
            <span>Workstation</span>
            <span>Tkts</span>
          </div>
          <div className="flex flex-col gap-1">
            {breakdown.length > 0 ? (
              breakdown.slice(0, 3).map((st: any, idx: number) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <div className="flex justify-between text-xs text-stone-800">
                    <span className="truncate max-w-[140px]">{st.name}</span>
                    <span className="font-semibold">{st.count}</span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-1 overflow-hidden">
                    <div className="bg-black h-full rounded-full" style={{ width: `${Math.max(5, st.pct)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-2 text-center text-stone-400 text-xs">0 orders at counter terminals</div>
            )}
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

// Card 3: Active Workstation Tasks
export function DrawerWorkstationActiveTasksCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const tasks = data?.summary?.activeTasksList || [];

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
          {tasks.length > 0 ? (
            tasks.slice(0, 2).map((t: any, idx: number) => (
              <div key={idx} className="bg-white p-1.5 rounded border border-[#f0eae3] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-medium text-stone-800 truncate">{t.taskNo} {t.title}</span>
                </div>
                <span className="text-[10px] bg-stone-100 px-1 py-0.5 rounded text-stone-600 shrink-0 font-medium">{t.status}</span>
              </div>
            ))
          ) : (
            <div className="py-2 text-center text-stone-400 text-xs">0 active tasks in queue</div>
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

// Card 4: Workstation Queue
export function DrawerWorkstationQueueCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const summary = data?.summary || {};
  const depth = data?.kpi?.value ?? (summary.bufferDepth ?? 0);

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
          <div className="flex items-center justify-between">
            <span className="text-2xl font-serif text-stone-900">{depth}</span>
            <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded-full font-semibold">
              {summary.spoolStatus || (depth > 0 ? "Nominal Spool" : "Queue Idle")}
            </span>
          </div>
          <div className="flex justify-between text-xs text-stone-600 pt-1 border-t border-[#f0eae3]">
            <span>Oldest Task:</span>
            <span className="font-semibold text-stone-900">{summary.oldestWaiting || "--"}</span>
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

// Card 5: Prep Time by Workstation
export function DrawerWorkstationPrepTimeCard({
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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6]">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif text-stone-900">{summary.displayValue || "--"}</span>
            <span className="text-[10px] text-stone-500">Goal: {summary.slaGoal || "< 20.0m"}</span>
          </div>
          <div className="flex justify-between text-xs text-stone-600 pt-1 border-t border-[#f0eae3]">
            <span>Efficiency Delta:</span>
            <span className="font-semibold text-stone-900">{summary.deltaText || "Within SLA"}</span>
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

// Card 6: Delayed Orders
export function DrawerWorkstationDelayedOrdersCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const alertCount = data?.alert?.count ?? 0;
  const isDelayed = alertCount > 0;

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
            <span className={`material-symbols-outlined ${isDelayed ? "text-red-500" : "text-emerald-500"} text-[16px]`}>
              {isDelayed ? "warning" : "check_circle"}
            </span>
            <span>{alertCount} Delayed Tickets</span>
          </div>
          <span className="text-[11px] text-stone-500">
            {data?.alert?.message || "All stations running within target SLA"}
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

// Card 7: Workstation Performance
export function DrawerWorkstationPerformanceCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const perfs = data?.summary?.performances || [];

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
          {perfs.length > 0 ? (
            perfs.slice(0, 3).map((p: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-xs text-stone-800">
                <span className="truncate max-w-[130px]">{p.name}</span>
                <span className="font-semibold text-stone-900">{p.pct}%</span>
              </div>
            ))
          ) : (
            <div className="py-2 text-center text-stone-400 text-xs">0 dishes completed</div>
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

// Card 8: Workstation Availability
export function DrawerWorkstationAvailabilityCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const terms = data?.summary?.terminalsList || [];

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
          {terms.length > 0 ? (
            terms.slice(0, 3).map((term: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-xs text-stone-800">
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${term.status === "Online" ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className="font-medium">{term.name}</span>
                </div>
                <span className="text-[10px] text-stone-400">{term.status} • {term.latency}</span>
              </div>
            ))
          ) : (
            <div className="py-2 text-center text-stone-400 text-xs">No physical terminals configured</div>
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
