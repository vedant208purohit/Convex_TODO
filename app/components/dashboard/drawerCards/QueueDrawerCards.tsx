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

export const QUEUE_CATALOG_WIDGETS: OrdersCatalogWidget[] = [
  {
    id: "queue_length",
    categoryTrack: "Lobby Volume",
    title: "Current Queue Length",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Total parties and seated heads waiting for an available table at the host stand.",
    defaultWidth: 4,
  },
  {
    id: "queue_waiting_customers",
    categoryTrack: "Waitlist Stream",
    title: "Waiting Customers",
    type: "LIVE",
    typeBadgeBg: "bg-black text-white",
    description: "Live chronological waitlist ledger showing ticket tokens, party sizes, and elapsed wait times.",
    defaultWidth: 4,
  },
  {
    id: "queue_avg_wait_time",
    categoryTrack: "Wait Metric",
    title: "Average Waiting Time",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Mean turnaround time from guest check-in at host stand to table seating.",
    defaultWidth: 4,
  },
  {
    id: "queue_recent_callouts",
    categoryTrack: "Callout Log",
    title: "Recently Called Customers",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Chronological audit log of customer tickets called, seated, or marked as no-show.",
    defaultWidth: 4,
  },
  {
    id: "queue_status_breakdown",
    categoryTrack: "Party Mix",
    title: "Queue Status Breakdown",
    type: "CHART",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Real-time mix of waiting party sizes to optimize dining room turnover and table allocation.",
    defaultWidth: 4,
  },
  {
    id: "queue_wait_time_alerts",
    categoryTrack: "Bottleneck Alert",
    title: "Queue Waiting Time Alerts",
    type: "ALERT",
    typeBadgeBg: "bg-rose-100 text-rose-800",
    description: "Proactive bottleneck alert notifications when queue wait times breach the 20-minute SLA threshold.",
    defaultWidth: 4,
  },
];

// 1. Current Queue Length
export function DrawerQueueLengthCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const partiesCount = summary.partiesCount ?? "00";
  const guestsCount = summary.guestsCount ?? 0;
  const indoorCount = summary.indoorCount ?? "00";
  const outdoorCount = summary.outdoorCount ?? "00";
  const statusTag = summary.statusTag ?? "Nominal Flow";

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
              <span className="font-serif text-2xl font-bold text-stone-900">{partiesCount}</span>
              <span className="text-stone-500 text-xs">Parties</span>
            </div>
            <div className="flex items-center gap-1 text-stone-800 text-[11px] bg-stone-100 px-2 py-0.5 rounded-full font-medium">
              <span className="material-symbols-outlined text-[14px]">groups</span>
              <span>{guestsCount} Guests</span>
            </div>
          </div>
          <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden flex">
            <div className="bg-black h-full w-[65%]"></div>
            <div className="bg-stone-400 h-full w-[35%]"></div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5">
            <span>Indoor: {indoorCount}</span>
            <span>Outdoor: {outdoorCount}</span>
            <span className="font-semibold text-stone-800">{statusTag}</span>
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

// 2. Waiting Customers
export function DrawerQueueWaitingCustomersCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const waitingList = summary.waitingList || [];

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
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase flex items-center gap-1 ${widget.typeBadgeBg}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
            <span>{widget.type}</span>
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">{widget.description}</p>

        <div className="bg-[#fcf8f5] rounded-lg p-2 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          {waitingList.length === 0 ? (
            <div className="text-center py-2 text-xs text-stone-400">No parties waiting in queue</div>
          ) : (
            waitingList.slice(0, 3).map((w: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between py-1 px-1.5 rounded bg-white border border-[#f0eae3]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-stone-900 text-[11px]">{w.ticket}</span>
                  <span className="text-stone-700 truncate text-[11px]">{w.name} ({w.pax})</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-stone-400 text-[10px]">{w.waitMins}</span>
                  <span className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded-full ${w.status === "Paged" ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-700"}`}>
                    {w.status}
                  </span>
                </div>
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

// 3. Average Waiting Time
export function DrawerQueueAvgWaitTimeCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const avgWait = summary.avgWaitMins || "0.0";
  const deltaText = summary.deltaText || "Within Target SLA";
  const quotedTime = summary.quotedTime || "15–20m";
  const target = summary.target || "Target < 20m";

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
              <span className="font-serif text-2xl font-bold text-stone-900">{avgWait}</span>
              <span className="text-stone-500 text-xs">mins</span>
            </div>
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-full">
              {deltaText}
            </span>
          </div>
          <div className="w-full h-5">
            <svg className="w-full h-full overflow-visible stroke-stone-800" fill="none" viewBox="0 0 100 20">
              <path d="M0 15 Q 25 18, 50 8 T 100 10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
          <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5 border-t border-[#f0eae3]">
            <span>Quoted: {quotedTime}</span>
            <span className="font-semibold text-stone-800">{target}</span>
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

// 4. Recently Called Customers
export function DrawerQueueRecentCalloutsCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const calledList = summary.calledList || [];

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
          {calledList.length === 0 ? (
            <div className="text-center py-2 text-xs text-stone-400">No recently called parties</div>
          ) : (
            calledList.slice(0, 3).map((c: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between py-1 px-1.5 rounded bg-white border border-[#f0eae3]">
                <div className="flex flex-col min-w-0 pr-1">
                  <span className="text-[11px] font-bold text-stone-900 truncate">{c.ticket} • {c.name}</span>
                  <span className={`text-[9.5px] font-medium ${c.statusColor}`}>{c.status}</span>
                </div>
                <span className="text-[10px] text-stone-400 shrink-0">{c.time}</span>
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

// 5. Queue Status Breakdown
export function DrawerQueueStatusBreakdownCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const totalPax = summary.totalPax ?? 0;
  const couplesPercent = summary.couplesPercent ?? 42;
  const familiesPercent = summary.familiesPercent ?? 40;
  const largePercent = summary.largePercent ?? 18;

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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex items-center justify-between border border-[#f3ede6] min-h-[95px] text-xs">
          <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle className="text-stone-200 stroke-current" cx="18" cy="18" fill="none" r="14" strokeWidth="4" />
              <circle className="text-black stroke-current" cx="18" cy="18" fill="none" r="14" strokeDasharray={`${couplesPercent}, 100`} strokeDashoffset="0" strokeWidth="4" />
              <circle className="text-stone-500 stroke-current" cx="18" cy="18" fill="none" r="14" strokeDasharray={`${familiesPercent}, 100`} strokeDashoffset={`-${couplesPercent}`} strokeWidth="4" />
              <circle className="text-amber-600 stroke-current" cx="18" cy="18" fill="none" r="14" strokeDasharray={`${largePercent}, 100`} strokeDashoffset={`-${couplesPercent + familiesPercent}`} strokeWidth="4" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-bold text-xs leading-none">{totalPax}</span>
              <span className="text-[7.5px] text-stone-400 leading-none">Pax</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-[10px] flex-1 pl-2.5">
            <div className="flex justify-between">
              <span className="text-stone-600">Couples (2p)</span>
              <span className="font-bold text-stone-900">{couplesPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Families (4-6p)</span>
              <span className="font-bold text-stone-900">{familiesPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Large (7p+)</span>
              <span className="font-bold text-stone-900">{largePercent}%</span>
            </div>
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

// 6. Queue Waiting Time Alerts
export function DrawerQueueWaitTimeAlertsCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const summary = data?.summary || {};
  const breachingParties = summary.breachingParties || [];
  const topBreach = breachingParties[0];

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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col justify-center border border-[#f3ede6] min-h-[95px] text-xs">
          {breachingParties.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200/60 p-2 rounded flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-700 text-base">check_circle</span>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-emerald-900">Wait Times Within SLA</span>
                <span className="text-[9.5px] text-emerald-700">All guests seated under 20 mins</span>
              </div>
            </div>
          ) : (
            <div className="bg-rose-50 border border-rose-200/80 p-2 rounded flex flex-col gap-1">
              <div className="flex items-start gap-1">
                <span className="material-symbols-outlined text-rose-600 text-sm mt-0.5">warning</span>
                <div className="flex flex-col">
                  <span className="text-[9.5px] font-bold text-rose-800 uppercase">
                    Exceeding SLA ({topBreach?.elapsedMins}m elapsed)
                  </span>
                  <span className="text-[11px] font-bold text-stone-900 truncate">
                    {topBreach?.ticket} ({topBreach?.name})
                  </span>
                </div>
              </div>
              <div className="text-[9.5px] text-stone-500 pt-0.5 border-t border-rose-200/40">
                Suggested: {topBreach?.suggestedTable || "Seat Table T-12"}
              </div>
            </div>
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

export function renderQueueDrawerCard(props: DrawerCardProps) {
  switch (props.widget.id) {
    case "queue_length":
      return <DrawerQueueLengthCard key={props.widget.id} {...props} />;
    case "queue_waiting_customers":
      return <DrawerQueueWaitingCustomersCard key={props.widget.id} {...props} />;
    case "queue_avg_wait_time":
      return <DrawerQueueAvgWaitTimeCard key={props.widget.id} {...props} />;
    case "queue_recent_callouts":
      return <DrawerQueueRecentCalloutsCard key={props.widget.id} {...props} />;
    case "queue_status_breakdown":
      return <DrawerQueueStatusBreakdownCard key={props.widget.id} {...props} />;
    case "queue_wait_time_alerts":
      return <DrawerQueueWaitTimeAlertsCard key={props.widget.id} {...props} />;
    default:
      return null;
  }
}

