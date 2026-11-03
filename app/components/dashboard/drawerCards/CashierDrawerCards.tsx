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

export const CASHIER_CATALOG_WIDGETS: OrdersCatalogWidget[] = [
  {
    id: "cashier_shift_summary",
    categoryTrack: "Shift Telemetry",
    title: "Current Shift Summary",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Real-time aggregated gross intake, cash in drawer, and variance status for active shift.",
    defaultWidth: 4,
  },
  {
    id: "cashier_total_transactions",
    categoryTrack: "Volume Metric",
    title: "Total Transactions",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Number of completed billing transactions processed during the active service period.",
    defaultWidth: 4,
  },
  {
    id: "cashier_cash_sales",
    categoryTrack: "Tender Audit",
    title: "Cash Sales",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Total currency bills and coins tendered into the physical register drawer.",
    defaultWidth: 4,
  },
  {
    id: "cashier_digital_sales",
    categoryTrack: "Digital Reconciliation",
    title: "Digital Payment Sales",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Settled online transfers including Dynamic UPI, credit/debit cards, and payment links.",
    defaultWidth: 4,
  },
  {
    id: "cashier_payment_breakdown",
    categoryTrack: "Tender Split",
    title: "Payment Method Breakdown",
    type: "Chart",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Percentage and monetary distribution of settlements across all accepted payment instruments.",
    defaultWidth: 4,
  },
  {
    id: "cashier_refund_summary",
    categoryTrack: "Reversal Ledger",
    title: "Refund Summary",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Disputed folios, manager void reversals, and settled line-item customer refunds.",
    defaultWidth: 4,
  },
  {
    id: "cashier_transaction_history",
    categoryTrack: "Register Stream",
    title: "Cashier Transaction History",
    type: "Table",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Compact chronological ledger of the latest settled bills, payment modes, and cashier IDs.",
    defaultWidth: 8,
  },
  {
    id: "cashier_open_sessions",
    categoryTrack: "Terminal Status",
    title: "Open Cashier Sessions",
    type: "Live",
    typeBadgeBg: "bg-black text-white",
    description: "Active counter register sessions, assigned operators, and login durations.",
    defaultWidth: 4,
  },
];

// 1. Current Shift Summary
export function DrawerCashierShiftSummaryCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          <div className="flex justify-between items-baseline">
            <span className="text-stone-500 uppercase text-[10px] font-bold">Gross Intake</span>
            <span className="font-bold text-stone-900">{summary.grossIntake || "₹ 0.00"}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-stone-500 uppercase text-[10px] font-bold">Float Cash</span>
            <span className="text-stone-700 font-medium">{summary.floatCash || "₹ 0.00"}</span>
          </div>
          <div className="pt-1 flex justify-between items-baseline border-t border-[#f0eae3]">
            <span className="text-stone-500 uppercase text-[10px] font-bold">Variance</span>
            <span className="font-semibold text-stone-800 bg-stone-100 px-2 py-0.5 rounded text-[10px]">
              {summary.drawerVariance || "+₹ 0.00 Balanced"}
            </span>
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

// 2. Total Transactions
export function DrawerCashierTotalTransactionsCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col justify-center border border-[#f3ede6] min-h-[95px]">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-normal text-stone-900">{summary.count !== undefined ? summary.count : 0}</span>
            <span className="text-xs text-stone-500">Txns</span>
            <span className="ml-auto text-[10px] bg-stone-100 text-stone-700 font-semibold px-2 py-0.5 rounded">
              {summary.deltaPercent || "+0.0% vs last shift"}
            </span>
          </div>
          <span className="text-[11px] text-stone-500 mt-1">
            {summary.settledCount !== undefined ? summary.settledCount : 0} Settled • {summary.splitCount !== undefined ? summary.splitCount : 0} Split Bills
          </span>
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

// 3. Cash Sales
export function DrawerCashierCashSalesCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col justify-center border border-[#f3ede6] min-h-[95px]">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold text-stone-900">{summary.cashVolume || "₹ 0.00"}</span>
            <span className="text-[10px] text-stone-500">{summary.txnCount || "0 Txns"}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-stone-800 h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, summary.percentNum || 0))}%` }} />
            </div>
            <span className="text-[10px] text-stone-500 whitespace-nowrap">{summary.volPercent || "0%"}</span>
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

// 4. Digital Payment Sales
export function DrawerCashierDigitalSalesCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col justify-center border border-[#f3ede6] min-h-[95px]">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold text-stone-900">{summary.digitalVolume || "₹ 0.00"}</span>
            <span className="text-[10px] bg-stone-100 text-stone-700 font-semibold px-2 py-0.5 rounded">
              {summary.deltaPercent || "▲ 0.0%"}
            </span>
          </div>
          <span className="text-[11px] text-stone-500 mt-1">
            {summary.totalCount || 0} Txns (UPI: {summary.upiCount || 0}, Card: {summary.cardCount || 0})
          </span>
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

// 5. Payment Method Breakdown
export function DrawerCashierPaymentBreakdownCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex items-center gap-2 border border-[#f3ede6] min-h-[95px]">
          <div className="w-12 h-12 relative flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
              <circle className="text-stone-200" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeWidth="4" />
              <circle className="text-stone-900" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="54 100" strokeDashoffset="0" strokeWidth="4" />
              <circle className="text-stone-500" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="31 100" strokeDashoffset="-54" strokeWidth="4" />
              <circle className="text-stone-300" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="15 100" strokeDashoffset="-85" strokeWidth="4" />
            </svg>
            <span className="absolute text-[8px] font-bold text-stone-800">POS</span>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0 text-[10px]">
            <div className="flex justify-between items-center">
              <span className="truncate">UPI ({summary.upiPercent || "0%"})</span>
              <span className="font-bold text-stone-900">{summary.upiAmount || "₹0"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="truncate">Cards ({summary.cardsPercent || "0%"})</span>
              <span className="font-bold text-stone-900">{summary.cardsAmount || "₹0"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="truncate">Cash ({summary.cashPercent || "0%"})</span>
              <span className="font-bold text-stone-900">{summary.cashAmount || "₹0"}</span>
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

// 6. Refund Summary
export function DrawerCashierRefundSummaryCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center text-xs">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold text-stone-900">{summary.refundTotal || "₹ 0.00"}</span>
            <span className="text-[10px] text-stone-500">{summary.refundCount || "0 Refunds"}</span>
          </div>
          <div className="flex justify-between text-[11px] text-stone-600">
            <span>Void: {summary.voidCount || "0 Items"}</span>
            <span className="font-semibold text-stone-800">{summary.voidTotal || "₹ 0.00"}</span>
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

// 7. Cashier Transaction History
export function DrawerCashierTransactionHistoryCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const txns = data?.summary?.recentTxns || [];

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

        <div className="bg-[#fcf8f5] rounded-lg p-2 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center">
          {txns.length > 0 ? (
            txns.slice(0, 3).map((txn: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-xs py-0.5 border-b border-[#f3ede6] last:border-b-0">
                <span className="font-bold text-stone-800">{txn.billNumber}</span>
                <span className="text-stone-500 text-[10px]">{txn.location}</span>
                <span className="font-semibold text-stone-900">{txn.amount}</span>
                <span className="text-[9px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-700">{txn.mode}</span>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-stone-400">No settled transactions</div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}` : "LAYOUT: 2×1 STRIP (8 COLS)"}
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

// 8. Open Cashier Sessions
export function DrawerCashierOpenSessionsCard({ widget, isPlaced, placement, onAdd, data }: DrawerCardProps) {
  const regs = data?.summary?.activeRegisters || [];

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

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center">
          {regs.length > 0 ? (
            regs.slice(0, 2).map((r: any, idx: number) => (
              <div key={idx} className="flex flex-col text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-800 truncate">{r.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <div className="flex justify-between items-center text-[10px] text-stone-500">
                  <span>{r.operator}</span>
                  <span className="font-semibold text-stone-800">{r.logged}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-stone-400">0 active register sessions</div>
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

export function renderCashierDrawerCard(
  widget: OrdersCatalogWidget,
  isPlaced: boolean,
  placement: { gridRow: number; gridCol: number } | undefined,
  onAdd: () => void,
  data: any
) {
  const props: DrawerCardProps = { widget, isPlaced, placement, onAdd, data };

  switch (widget.id) {
    case "cashier_shift_summary":
      return <DrawerCashierShiftSummaryCard key={widget.id} {...props} />;
    case "cashier_total_transactions":
      return <DrawerCashierTotalTransactionsCard key={widget.id} {...props} />;
    case "cashier_cash_sales":
      return <DrawerCashierCashSalesCard key={widget.id} {...props} />;
    case "cashier_digital_sales":
      return <DrawerCashierDigitalSalesCard key={widget.id} {...props} />;
    case "cashier_payment_breakdown":
      return <DrawerCashierPaymentBreakdownCard key={widget.id} {...props} />;
    case "cashier_refund_summary":
      return <DrawerCashierRefundSummaryCard key={widget.id} {...props} />;
    case "cashier_transaction_history":
      return <DrawerCashierTransactionHistoryCard key={widget.id} {...props} />;
    case "cashier_open_sessions":
      return <DrawerCashierOpenSessionsCard key={widget.id} {...props} />;
    default:
      return null;
  }
}

