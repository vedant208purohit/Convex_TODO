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

// 1. Current Shift Summary
export function CashierShiftSummaryWidget({
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

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">SHIFT TELEMETRY</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Current Shift Summary
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        <div className="flex justify-between items-baseline">
          <span className="font-label-sm text-label-sm text-secondary uppercase">Gross Intake</span>
          <span className="font-label-md text-label-md font-semibold text-on-surface">
            {summary.grossIntake || "₹ 0.00"}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="font-label-sm text-label-sm text-secondary uppercase">Float Cash</span>
          <span className="font-label-md text-label-md text-on-surface">
            {summary.floatCash || "₹ 0.00"}
          </span>
        </div>
        <div className="pt-space-xs flex justify-between items-baseline border-t border-outline-variant/20">
          <span className="font-label-sm text-label-sm text-secondary uppercase">Drawer Variance</span>
          <span className="font-label-sm text-label-sm font-semibold text-on-surface bg-surface-container-highest px-space-xs py-0.5 rounded-full">
            {summary.drawerVariance || "+₹ 0.00 Balanced"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Drawer Balance</span>
        <span>Audited</span>
      </div>
    </div>
  );
}

// 2. Total Transactions
export function CashierTotalTransactionsWidget({
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

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">VOLUME METRIC</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Total Transactions
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col justify-center my-auto min-h-[110px]">
        <div className="flex items-baseline gap-space-sm">
          <span className="font-display-sm text-display-sm text-on-surface font-normal">
            {summary.count !== undefined ? summary.count : 0}
          </span>
          <span className="font-label-md text-label-md text-secondary">Txns</span>
          <span className="ml-auto font-label-sm text-label-sm text-on-surface bg-surface-container-highest px-space-xs py-0.5 rounded-full">
            {summary.deltaPercent || "+0.0% vs last shift"}
          </span>
        </div>
        <span className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
          {summary.settledCount !== undefined ? summary.settledCount : 0} Settled • {summary.splitCount !== undefined ? summary.splitCount : 0} Split Bills
        </span>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Folio Ledger</span>
        <span>Synchronized</span>
      </div>
    </div>
  );
}

// 3. Cash Sales
export function CashierCashSalesWidget({
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

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">TENDER AUDIT</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Cash Sales
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col justify-center my-auto min-h-[110px]">
        <div className="flex items-baseline justify-between">
          <span className="font-headline-lg text-headline-lg text-on-surface font-normal">
            {summary.cashVolume || "₹ 0.00"}
          </span>
          <span className="font-label-sm text-label-sm text-secondary">
            {summary.txnCount || "0 Transactions"}
          </span>
        </div>
        <div className="mt-space-xs flex items-center gap-space-xs">
          <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${Math.max(0, Math.min(100, summary.percentNum || 0))}%` }}
            />
          </div>
          <span className="font-label-sm text-label-sm text-secondary whitespace-nowrap">
            {summary.volPercent || "0% of vol"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Tender Share</span>
        <span>Drawer Audited</span>
      </div>
    </div>
  );
}

// 4. Digital Payment Sales
export function CashierDigitalSalesWidget({
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

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">DIGITAL RECONCILIATION</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Digital Payment Sales
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col justify-center my-auto min-h-[110px]">
        <div className="flex items-baseline justify-between">
          <span className="font-headline-lg text-headline-lg text-on-surface font-normal">
            {summary.digitalVolume || "₹ 0.00"}
          </span>
          <span className="font-label-sm text-label-sm text-on-surface bg-surface-container-highest px-space-xs py-0.5 rounded-full">
            {summary.deltaPercent || "▲ 0.0%"}
          </span>
        </div>
        <span className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
          {summary.totalCount || 0} Transactions (UPI: {summary.upiCount || 0}, Card: {summary.cardCount || 0})
        </span>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Payment Gateway Payouts</span>
        <span>Reconciled</span>
      </div>
    </div>
  );
}

// 5. Payment Method Breakdown
export function CashierPaymentBreakdownWidget({
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

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              CHART
            </span>
            <span className="font-label-sm text-[11px] text-secondary">TENDER SPLIT</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Payment Method Breakdown
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex items-center gap-space-md my-auto min-h-[110px]">
        <div className="w-16 h-16 relative flex items-center justify-center flex-shrink-0">
          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
            <circle className="text-surface-container-highest" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeWidth="4" />
            <circle className="text-primary" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="54 100" strokeDashoffset="0" strokeWidth="4" />
            <circle className="text-secondary" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="31 100" strokeDashoffset="-54" strokeWidth="4" />
            <circle className="text-outline" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="15 100" strokeDashoffset="-85" strokeWidth="4" />
          </svg>
          <span className="absolute font-label-sm text-label-sm font-semibold text-on-surface">POS</span>
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-0 text-on-surface-variant">
          <div className="flex justify-between items-center font-body-sm text-body-sm">
            <span className="flex items-center gap-1 truncate">
              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>
              UPI ({summary.upiPercent || "0%"})
            </span>
            <span className="font-label-sm text-label-sm font-semibold text-on-surface">
              {summary.upiAmount || "₹0"}
            </span>
          </div>
          <div className="flex justify-between items-center font-body-sm text-body-sm">
            <span className="flex items-center gap-1 truncate">
              <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0"></span>
              Cards ({summary.cardsPercent || "0%"})
            </span>
            <span className="font-label-sm text-label-sm font-semibold text-on-surface">
              {summary.cardsAmount || "₹0"}
            </span>
          </div>
          <div className="flex justify-between items-center font-body-sm text-body-sm">
            <span className="flex items-center gap-1 truncate">
              <span className="w-2 h-2 rounded-full bg-outline flex-shrink-0"></span>
              Cash ({summary.cashPercent || "0%"})
            </span>
            <span className="font-label-sm text-label-sm font-semibold text-on-surface">
              {summary.cashAmount || "₹0"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Multi-Tender Mix</span>
        <span>Live Sync</span>
      </div>
    </div>
  );
}

// 6. Refund Summary
export function CashierRefundSummaryWidget({
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

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">REVERSAL LEDGER</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Refund Summary
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        <div className="flex items-baseline justify-between">
          <span className="font-headline-lg text-headline-lg text-on-surface font-normal">
            {summary.refundTotal || "₹ 0.00"}
          </span>
          <span className="font-label-sm text-label-sm text-secondary">
            {summary.refundCount || "0 Refunds Settled"}
          </span>
        </div>
        <div className="flex justify-between items-center text-body-sm font-body-sm text-on-surface-variant">
          <span>Void Count: {summary.voidCount || "0 Items"}</span>
          <span className="font-label-sm text-label-sm font-semibold text-on-surface">
            {summary.voidTotal || "₹ 0.00"}
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-outline">
          Approval Audit: {summary.managerAuth || "Verified Ledger"}
        </span>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Manager Authorized</span>
        <span>Reversal Audit</span>
      </div>
    </div>
  );
}

// 7. Cashier Transaction History (Wide 8-col or 12-col)
export function CashierTransactionHistoryWidget({
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

  const recentTxns = (widgetData as any)?.summary?.recentTxns || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">REGISTER STREAM</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Cashier Transaction History
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        {recentTxns.length > 0 ? (
          recentTxns.slice(0, 4).map((txn: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between py-1 font-body-sm text-body-sm border-b border-outline-variant/10 last:border-b-0">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {txn.billNumber}
              </span>
              <span className="text-on-surface-variant">{txn.location}</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {txn.amount}
              </span>
              <span className="px-space-xs py-0.5 rounded bg-surface-container-highest font-label-sm text-label-sm text-on-surface">
                {txn.mode}
              </span>
              <span className="text-outline font-label-sm text-label-sm">{txn.time}</span>
            </div>
          ))
        ) : (
          <div className="py-2 text-center font-body-sm text-body-sm text-on-surface-variant">
            No settled transactions recorded in this period
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Z-Report Log</span>
        <span>Direct Feed</span>
      </div>
    </div>
  );
}

// 8. Open Cashier Sessions
export function CashierOpenSessionsWidget({
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

  const activeRegisters = (widgetData as any)?.summary?.activeRegisters || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest font-label-sm text-[10px] text-primary font-semibold tracking-widest uppercase">
              LIVE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">TERMINAL STATUS</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Open Cashier Sessions
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[110px] justify-center">
        {activeRegisters.length > 0 ? (
          activeRegisters.map((reg: any, idx: number) => (
            <div key={idx} className="flex flex-col pt-space-xs first:pt-0">
              <div className="flex justify-between items-center">
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  {reg.name}
                </span>
                <span className="w-2 h-2 rounded-full bg-primary"></span>
              </div>
              <div className="flex justify-between items-center font-body-sm text-body-sm text-on-surface-variant">
                <span>{reg.operator} • {reg.duration}</span>
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                  {reg.logged} logged
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant py-2">
            <span className="material-symbols-outlined text-[18px] text-outline">lock</span>
            <span>0 active register sessions open</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Terminal Fleet</span>
        <span>Real-time Sync</span>
      </div>
    </div>
  );
}

