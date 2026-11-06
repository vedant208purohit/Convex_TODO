"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PosShell } from "../../../components/PosShell";
import { OrderDateRangePicker } from "../../../components/OrderDateRangePicker";

function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export default function CashierCatalogPage() {
  const router = useRouter();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isAddingId, setIsAddingId] = useState<string | null>(null);

  // Date Range state for Calendar & telemetry basis
  const [selectedPreset, setSelectedPreset] = useState<string>("Today");
  const [startDate, setStartDate] = useState<Date>(() => getStartOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => getEndOfDay(new Date()));

  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  const dashboardData = useQuery(
    api.dashboards.getDashboard,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );

  const draftData = useQuery(
    api.dashboards.getDraft,
    dashboardData?.dashboard ? { dashboardId: dashboardData.dashboard._id } : "skip"
  );

  const createOrUpdateDraftMutation = useMutation(api.dashboards.createOrUpdateDraft);

  // Map user preset string to Convex DateRangePreset
  const dateRangePresetArg = useMemo(() => {
    switch (selectedPreset) {
      case "Today":
        return "today";
      case "Yesterday":
        return "yesterday";
      case "Last 7 Days":
        return "last_7_days";
      case "Last 30 Days":
        return "last_30_days";
      case "This Month":
        return "this_month";
      case "Last Month":
        return "last_month";
      default:
        return "custom";
    }
  }, [selectedPreset]);

  // Active placements
  const currentPlacements = useMemo(() => {
    if (draftData?.placements && draftData.placements.length > 0) {
      return draftData.placements;
    }
    if (dashboardData?.placements && dashboardData.placements.length > 0) {
      return dashboardData.placements;
    }
    return [];
  }, [draftData?.placements, dashboardData?.placements]);

  const placedWidgetMap = useMemo(() => {
    const map = new Map<string, { gridRow: number; gridCol: number; width: number }>();
    for (const p of currentPlacements) {
      map.set(p.widgetId, { gridRow: p.gridRow, gridCol: p.gridCol, width: p.width });
    }
    return map;
  }, [currentPlacements]);

  // Common query args based on calendar selection
  const queryArgs = useMemo(() => {
    if (!activeOrg) return "skip";
    return {
      organizationId: activeOrg._id,
      dateRangePreset: dateRangePresetArg as any,
      fromTimestamp: startDate.getTime(),
      toTimestamp: endDate.getTime(),
    };
  }, [activeOrg, dateRangePresetArg, startDate, endDate]);

  // Scoped on-demand telemetry queries for Cashier
  const shiftSummaryData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "cashier_shift_summary" } : "skip"
  );

  const totalTransactionsData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "cashier_total_transactions" } : "skip"
  );

  const cashSalesData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "cashier_cash_sales" } : "skip"
  );

  const digitalSalesData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "cashier_digital_sales" } : "skip"
  );

  const paymentBreakdownData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "cashier_payment_breakdown" } : "skip"
  );

  const refundSummaryData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "cashier_refund_summary" } : "skip"
  );

  const transactionHistoryData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "cashier_transaction_history" } : "skip"
  );

  const openSessionsData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "cashier_open_sessions" } : "skip"
  );

  // Handle Add Widget directly to current dashboard draft
  const handleAddWidget = async (widgetId: string, defaultWidth = 4, defaultHeight = 1) => {
    if (!activeOrg || !dashboardData?.dashboard || placedWidgetMap.has(widgetId)) return;
    setIsAddingId(widgetId);

    try {
      const nextPlacements = [
        ...currentPlacements,
        {
          widgetId,
          gridRow: 0,
          gridCol: 0,
          width: defaultWidth,
          height: defaultHeight,
          displayOrder: currentPlacements.length + 1,
          isEnabled: true,
        },
      ];

      // Auto-pack 12-column grid
      let currentRow = 0;
      let currentCol = 0;
      const packed = nextPlacements.map((p) => {
        const width = Math.min(12, Math.max(1, p.width || 4));
        const height = Math.max(1, p.height || 1);

        if (currentCol + width > 12) {
          currentRow += 1;
          currentCol = 0;
        }

        const assignedCol = currentCol;
        const assignedRow = currentRow;

        currentCol += width;
        if (currentCol >= 12) {
          currentRow += 1;
          currentCol = 0;
        }

        return {
          widgetId: p.widgetId,
          gridRow: assignedRow,
          gridCol: assignedCol,
          width,
          height,
          displayOrder: p.displayOrder,
          isEnabled: p.isEnabled ?? true,
        };
      });

      await createOrUpdateDraftMutation({
        dashboardId: dashboardData.dashboard._id,
        baseRevision: dashboardData.dashboard.revision ?? 1,
        placements: packed,
      });
    } catch (err) {
      console.error("Failed to add cashier widget to draft:", err);
    } finally {
      setIsAddingId(null);
    }
  };

  const widgetsList = [
    {
      id: "cashier_shift_summary",
      title: "Current Shift Summary",
      track: "Shift Telemetry",
      badge: "KPI",
      desc: "Real-time aggregated gross intake, cash in drawer, and variance status for active shift.",
      width: 4,
    },
    {
      id: "cashier_total_transactions",
      title: "Total Transactions",
      track: "Volume Metric",
      badge: "KPI",
      desc: "Number of completed billing transactions processed during the active service period.",
      width: 4,
    },
    {
      id: "cashier_cash_sales",
      title: "Cash Sales",
      track: "Tender Audit",
      badge: "KPI",
      desc: "Total currency bills and coins tendered into the physical register drawer.",
      width: 4,
    },
    {
      id: "cashier_digital_sales",
      title: "Digital Payment Sales",
      track: "Digital Reconciliation",
      badge: "KPI",
      desc: "Settled online transfers including Dynamic UPI, credit/debit cards, and payment links.",
      width: 4,
    },
    {
      id: "cashier_payment_breakdown",
      title: "Payment Method Breakdown",
      track: "Tender Split",
      badge: "Chart",
      desc: "Percentage and monetary distribution of settlements across all accepted payment instruments.",
      width: 4,
    },
    {
      id: "cashier_refund_summary",
      title: "Refund Summary",
      track: "Reversal Ledger",
      badge: "KPI",
      desc: "Disputed folios, manager void reversals, and settled line-item customer refunds.",
      width: 4,
    },
    {
      id: "cashier_transaction_history",
      title: "Cashier Transaction History",
      track: "Register Stream",
      badge: "Table",
      desc: "Compact chronological ledger of the latest settled bills, payment modes, and cashier IDs.",
      width: 8,
      isWide: true,
    },
    {
      id: "cashier_open_sessions",
      title: "Open Cashier Sessions",
      track: "Terminal Status",
      badge: "Live",
      desc: "Active counter register sessions, assigned operators, and login durations.",
      width: 4,
    },
  ];

  const filteredWidgets = widgetsList.filter((w) =>
    w.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    w.desc.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    w.track.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  const activeCount = widgetsList.filter((w) => placedWidgetMap.has(w.id)).length;

  return (
    <PosShell
      title="Cashier Front Counter"
      subtitle="Telemetry Catalog · Shift Reconciliation & Audit"
    >
      <div className="flex flex-col w-full min-h-screen bg-surface">
        {/* Top Action / Breadcrumb Bar */}
        <section className="px-space-xl py-space-md bg-surface-container-low/70 flex flex-wrap items-center justify-between gap-space-md border-b border-outline-variant/30">
          <div className="flex items-center gap-space-md">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-space-xs font-label-md text-label-md text-secondary hover:text-primary transition-colors uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to Dashboard</span>
            </Link>
            <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
            <div className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-high text-on-surface">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider">
                8 Widgets Available • {activeCount} Configured
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-space-xs px-space-lg py-space-sm rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity"
          >
            <span>Done / Return to Dashboard</span>
            <span className="material-symbols-outlined text-[18px]">check</span>
          </button>
        </section>

        {/* Category Banner Header */}
        <header className="px-space-xl pt-space-xl pb-space-lg">
          <section className="bg-surface-container-low rounded-DEFAULT p-space-lg shadow-sm border border-outline-variant/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-lg">
              <div className="flex items-start gap-space-md max-w-2xl">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-on-primary text-[24px]">point_of_sale</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-semibold">
                    Settlement, Drawers &amp; Audit Telemetry
                  </span>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface font-normal">
                    Cashier
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
                    Monitor register sessions, tender distributions, shift cash reconciliation, and live transaction velocity across physical front counters.
                  </p>
                </div>
              </div>

              {/* Search & Calendar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Search Cashier widgets..."
                    className="w-full bg-surface-container-lowest text-on-surface font-body-sm text-body-sm pl-10 pr-space-md py-space-xs rounded-full outline-none placeholder:text-outline shadow-sm border border-outline-variant/30"
                  />
                </div>

                <div className="shrink-0">
                  <OrderDateRangePicker
                    preset={selectedPreset}
                    startDate={startDate}
                    endDate={endDate}
                    onChange={({ startDate: s, endDate: e, preset: p }) => {
                      setSelectedPreset(p);
                      setStartDate(s);
                      setEndDate(e);
                    }}
                  />
                </div>

                <div className="text-right px-space-xs shrink-0">
                  <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase">
                    8 WIDGETS • {activeCount} ACTIVE
                  </span>
                </div>
              </div>
            </div>
          </section>
        </header>

        {/* 3-Column Widget Cards Grid */}
        <main className="px-space-xl pb-space-xl flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
            {/* Card 1: Current Shift Summary */}
            {filteredWidgets.some((w) => w.id === "cashier_shift_summary") && (
              <div className="bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
                      Shift Telemetry
                    </span>
                    <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase">
                      KPI
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                      Current Shift Summary
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                      Real-time aggregated gross intake, cash in hand, and digital settlements for active shift.
                    </p>
                  </div>

                  {/* Preview Frame */}
                  <div className="bg-surface-container rounded-DEFAULT p-space-md my-space-xs flex flex-col gap-space-xs min-h-[110px] justify-center">
                    <div className="flex justify-between items-baseline">
                      <span className="font-label-sm text-label-sm text-secondary uppercase">Gross Intake</span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        {shiftSummaryData?.summary?.grossIntake || "₹ 0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-label-sm text-label-sm text-secondary uppercase">Cash Collected</span>
                      <span className="font-label-md text-label-md font-semibold text-on-surface">
                        {shiftSummaryData?.summary?.cashCollected || "₹ 0.00"}
                      </span>
                    </div>
                    <div className="pt-space-xs flex justify-between items-baseline border-t border-outline-variant/20">
                      <span className="font-label-sm text-label-sm text-secondary uppercase">Digital & UPI</span>
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface bg-surface-container-highest px-space-xs py-0.5 rounded-full">
                        {shiftSummaryData?.summary?.digitalCollected || "₹ 0.00"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-space-md flex items-center justify-between border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("cashier_shift_summary") ? (
                    <button className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shadow-sm cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("cashier_shift_summary", 4, 1)}
                      disabled={isAddingId === "cashier_shift_summary"}
                      className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Widget</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 2: Total Transactions */}
            {filteredWidgets.some((w) => w.id === "cashier_total_transactions") && (
              <div className="bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
                      Volume Metric
                    </span>
                    <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase">
                      KPI
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                      Total Transactions
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                      Number of completed billing transactions processed during the active service period.
                    </p>
                  </div>

                  {/* Preview Frame */}
                  <div className="bg-surface-container rounded-DEFAULT p-space-md my-space-xs flex flex-col justify-center min-h-[110px]">
                    <div className="flex items-baseline gap-space-sm">
                      <span className="font-display-sm text-display-sm text-on-surface font-normal">
                        {totalTransactionsData?.summary?.count !== undefined ? totalTransactionsData.summary.count : 0}
                      </span>
                      <span className="font-label-md text-label-md text-secondary">Txns</span>
                      <span className="ml-auto font-label-sm text-label-sm text-on-surface bg-surface-container-highest px-space-xs py-0.5 rounded-full">
                        {totalTransactionsData?.summary?.deltaPercent || "+0.0% vs last shift"}
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                      {totalTransactionsData?.summary?.settledCount !== undefined ? totalTransactionsData.summary.settledCount : 0} Settled • {totalTransactionsData?.summary?.splitCount !== undefined ? totalTransactionsData.summary.splitCount : 0} Split Bills
                    </span>
                  </div>
                </div>

                <div className="pt-space-md flex items-center justify-between border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("cashier_total_transactions") ? (
                    <button className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shadow-sm cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("cashier_total_transactions", 4, 1)}
                      disabled={isAddingId === "cashier_total_transactions"}
                      className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Widget</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 3: Cash Sales */}
            {filteredWidgets.some((w) => w.id === "cashier_cash_sales") && (
              <div className="bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
                      Tender Audit
                    </span>
                    <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase">
                      KPI
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                      Cash Sales
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                      Total currency bills and coins tendered into the physical register drawer.
                    </p>
                  </div>

                  {/* Preview Frame */}
                  <div className="bg-surface-container rounded-DEFAULT p-space-md my-space-xs flex flex-col justify-center min-h-[110px]">
                    <div className="flex items-baseline justify-between">
                      <span className="font-headline-lg text-headline-lg text-on-surface font-normal">
                        {cashSalesData?.summary?.cashVolume || "₹ 0.00"}
                      </span>
                      <span className="font-label-sm text-label-sm text-secondary">
                        {cashSalesData?.summary?.txnCount || "0 Transactions"}
                      </span>
                    </div>
                    <div className="mt-space-xs flex items-center gap-space-xs">
                      <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, cashSalesData?.summary?.percentNum || 0))}%` }}
                        />
                      </div>
                      <span className="font-label-sm text-label-sm text-secondary whitespace-nowrap">
                        {cashSalesData?.summary?.volPercent || "0% of vol"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-space-md flex items-center justify-between border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("cashier_cash_sales") ? (
                    <button className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shadow-sm cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("cashier_cash_sales", 4, 1)}
                      disabled={isAddingId === "cashier_cash_sales"}
                      className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Widget</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 4: Digital Payment Sales */}
            {filteredWidgets.some((w) => w.id === "cashier_digital_sales") && (
              <div className="bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
                      Digital Reconciliation
                    </span>
                    <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase">
                      KPI
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                      Digital Payment Sales
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                      Settled online transfers including Dynamic UPI, credit/debit cards, and payment links.
                    </p>
                  </div>

                  {/* Preview Frame */}
                  <div className="bg-surface-container rounded-DEFAULT p-space-md my-space-xs flex flex-col justify-center min-h-[110px]">
                    <div className="flex items-baseline justify-between">
                      <span className="font-headline-lg text-headline-lg text-on-surface font-normal">
                        {digitalSalesData?.summary?.digitalVolume || "₹ 0.00"}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface bg-surface-container-highest px-space-xs py-0.5 rounded-full">
                        {digitalSalesData?.summary?.deltaPercent || "▲ 0.0%"}
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                      {digitalSalesData?.summary?.totalCount || 0} Transactions (UPI: {digitalSalesData?.summary?.upiCount || 0}, Card: {digitalSalesData?.summary?.cardCount || 0})
                    </span>
                  </div>
                </div>

                <div className="pt-space-md flex items-center justify-between border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("cashier_digital_sales") ? (
                    <button className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shadow-sm cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("cashier_digital_sales", 4, 1)}
                      disabled={isAddingId === "cashier_digital_sales"}
                      className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Widget</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 5: Payment Method Breakdown */}
            {filteredWidgets.some((w) => w.id === "cashier_payment_breakdown") && (
              <div className="bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
                      Tender Split
                    </span>
                    <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase">
                      Chart
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                      Payment Method Breakdown
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                      Percentage and monetary distribution of settlements across all accepted payment instruments.
                    </p>
                  </div>

                  {/* Preview Frame with Donut Chart */}
                  <div className="bg-surface-container rounded-DEFAULT p-space-md my-space-xs flex items-center gap-space-md min-h-[110px]">
                    <div className="w-16 h-16 relative flex items-center justify-center flex-shrink-0">
                      <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                        <circle className="text-surface-container-highest" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeWidth="4" />
                        {paymentBreakdownData?.summary?.breakdown && paymentBreakdownData.summary.breakdown.length > 0 ? (
                          (() => {
                            let accumulated = 0;
                            const strokeColors = ["text-primary", "text-secondary", "text-outline", "text-amber-600", "text-emerald-600"];
                            return paymentBreakdownData.summary.breakdown.map((item: any, idx: number) => {
                              const pct = Math.max(0, Math.min(100, item.percentNum || parseInt(item.percent, 10) || 0));
                              const offset = accumulated;
                              accumulated += pct;
                              if (pct === 0) return null;
                              return (
                                <circle
                                  key={idx}
                                  className={strokeColors[idx % strokeColors.length]}
                                  cx="18"
                                  cy="18"
                                  fill="none"
                                  r="14"
                                  stroke="currentColor"
                                  strokeDasharray={`${pct} 100`}
                                  strokeDashoffset={offset === 0 ? "0" : `-${offset}`}
                                  strokeWidth="4"
                                />
                              );
                            });
                          })()
                        ) : (
                          <>
                            <circle className="text-primary" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="54 100" strokeDashoffset="0" strokeWidth="4" />
                            <circle className="text-secondary" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="31 100" strokeDashoffset="-54" strokeWidth="4" />
                            <circle className="text-outline" cx="18" cy="18" fill="none" r="14" stroke="currentColor" strokeDasharray="15 100" strokeDashoffset="-85" strokeWidth="4" />
                          </>
                        )}
                      </svg>
                      <span className="absolute font-label-sm text-label-sm font-semibold text-on-surface">POS</span>
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0 text-on-surface-variant">
                      {paymentBreakdownData?.summary?.breakdown && paymentBreakdownData.summary.breakdown.length > 0 ? (
                        paymentBreakdownData.summary.breakdown.map((item: any, idx: number) => {
                          const colors = ["bg-primary", "bg-secondary", "bg-outline", "bg-amber-600", "bg-emerald-600"];
                          const color = colors[idx % colors.length];
                          return (
                            <div key={idx} className="flex justify-between items-center font-body-sm text-body-sm">
                              <span className="flex items-center gap-1 truncate">
                                <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`}></span>
                                {item.name} ({item.percent})
                              </span>
                              <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                                {item.amount}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <>
                          <div className="flex justify-between items-center font-body-sm text-body-sm">
                            <span className="flex items-center gap-1 truncate">
                              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>
                              UPI ({paymentBreakdownData?.summary?.upiPercent || "0%"})
                            </span>
                            <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                              {paymentBreakdownData?.summary?.upiAmount || "₹0"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center font-body-sm text-body-sm">
                            <span className="flex items-center gap-1 truncate">
                              <span className="w-2 h-2 rounded-full bg-secondary flex-shrink-0"></span>
                              Cards ({paymentBreakdownData?.summary?.cardsPercent || "0%"})
                            </span>
                            <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                              {paymentBreakdownData?.summary?.cardsAmount || "₹0"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center font-body-sm text-body-sm">
                            <span className="flex items-center gap-1 truncate">
                              <span className="w-2 h-2 rounded-full bg-outline flex-shrink-0"></span>
                              Cash ({paymentBreakdownData?.summary?.cashPercent || "0%"})
                            </span>
                            <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                              {paymentBreakdownData?.summary?.cashAmount || "₹0"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-space-md flex items-center justify-between border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("cashier_payment_breakdown") ? (
                    <button className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shadow-sm cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("cashier_payment_breakdown", 4, 1)}
                      disabled={isAddingId === "cashier_payment_breakdown"}
                      className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Widget</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 6: Refund Summary */}
            {filteredWidgets.some((w) => w.id === "cashier_refund_summary") && (
              <div className="bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
                      Reversal Ledger
                    </span>
                    <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase">
                      KPI
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                      Refund Summary
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                      Disputed folios, manager void reversals, and settled line-item customer refunds.
                    </p>
                  </div>

                  {/* Preview Frame */}
                  <div className="bg-surface-container rounded-DEFAULT p-space-md my-space-xs flex flex-col gap-space-xs min-h-[110px] justify-center">
                    <div className="flex items-baseline justify-between">
                      <span className="font-headline-lg text-headline-lg text-on-surface font-normal">
                        {refundSummaryData?.summary?.refundTotal || "₹ 0.00"}
                      </span>
                      <span className="font-label-sm text-label-sm text-secondary">
                        {refundSummaryData?.summary?.refundCount || "0 Refunds Settled"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-body-sm font-body-sm text-on-surface-variant">
                      <span>Void Count: {refundSummaryData?.summary?.voidCount || "0 Items"}</span>
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                        {refundSummaryData?.summary?.voidTotal || "₹ 0.00"}
                      </span>
                    </div>
                    <span className="font-label-sm text-label-sm text-outline">
                      Approval Audit: {refundSummaryData?.summary?.managerAuth || "Verified Ledger"}
                    </span>
                  </div>
                </div>

                <div className="pt-space-md flex items-center justify-between border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("cashier_refund_summary") ? (
                    <button className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shadow-sm cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("cashier_refund_summary", 4, 1)}
                      disabled={isAddingId === "cashier_refund_summary"}
                      className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Widget</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 7: Cashier Transaction History (2x1 Strip spanning 2 cols on lg) */}
            {filteredWidgets.some((w) => w.id === "cashier_transaction_history") && (
              <div className="bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow lg:col-span-2 border border-outline-variant/20">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
                      Register Stream
                    </span>
                    <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase">
                      Table
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                      Cashier Transaction History
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                      Compact chronological ledger of the latest settled bills, payment modes, and cashier IDs.
                    </p>
                  </div>

                  {/* Preview Table */}
                  <div className="bg-surface-container rounded-DEFAULT p-space-md my-space-xs flex flex-col gap-space-xs min-h-[110px] justify-center">
                    {transactionHistoryData?.summary?.recentTxns && transactionHistoryData.summary.recentTxns.length > 0 ? (
                      transactionHistoryData.summary.recentTxns.map((txn: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-1 font-body-sm text-body-sm border-b border-outline-variant/10 last:border-b-0">
                          <span className="font-label-md text-label-md text-on-surface font-semibold">
                            {txn.orderNumber || txn.billNumber}
                          </span>
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
                </div>

                <div className="pt-space-md flex items-center justify-between border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline tracking-wider">
                    LAYOUT: 2X1 STRIP (8 COLS)
                  </span>
                  {placedWidgetMap.has("cashier_transaction_history") ? (
                    <button className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shadow-sm cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("cashier_transaction_history", 8, 1)}
                      disabled={isAddingId === "cashier_transaction_history"}
                      className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Widget</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 8: Open Cashier Sessions */}
            {filteredWidgets.some((w) => w.id === "cashier_open_sessions") && (
              <div className="bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
                      Terminal Status
                    </span>
                    <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase">
                      Live
                    </span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                      Open Cashier Sessions
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-xs">
                      Active counter register sessions, assigned operators, and login durations.
                    </p>
                  </div>

                  {/* Preview Frame */}
                  <div className="bg-surface-container rounded-DEFAULT p-space-md my-space-xs flex flex-col gap-space-xs min-h-[110px] justify-center">
                    {openSessionsData?.summary?.activeRegisters && openSessionsData.summary.activeRegisters.length > 0 ? (
                      openSessionsData.summary.activeRegisters.map((reg: any, idx: number) => (
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
                </div>

                <div className="pt-space-md flex items-center justify-between border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("cashier_open_sessions") ? (
                    <button className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md shadow-sm cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("cashier_open_sessions", 4, 1)}
                      disabled={isAddingId === "cashier_open_sessions"}
                      className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:opacity-90 transition-opacity"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Widget</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Bottom Info Bar */}
        <footer className="px-space-xl pb-space-xl">
          <div className="bg-surface-container-low rounded-DEFAULT px-space-lg py-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm shadow-sm border border-outline-variant/20">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-secondary text-[20px]">info</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Configured cashier widgets sync directly with daily Z-reports and drawer reconciliation logs.
              </span>
            </div>
            <Link
              href="/dashboard"
              className="font-label-md text-label-md text-on-surface font-semibold hover:underline inline-flex items-center gap-space-xs flex-shrink-0"
            >
              <span>Manage Dashboard Layout</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </footer>
      </div>
    </PosShell>
  );
}
