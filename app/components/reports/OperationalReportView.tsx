"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  formatPriceWithSymbol,
  getCurrencyForCountry,
} from "../../../lib/constants/countries";
import { DateRange, ChevronRightIcon } from "./ReportHeader";
import {
  computeOperationalReportData,
  isDataZero,
} from "../../reports/reportCalculations";
import { Toast, type ToastMessage } from "../Toast";
import { OrderDateRangePicker } from "../OrderDateRangePicker";

interface OperationalReportViewProps {
  orders: any[];
  tables?: any[];
  layouts?: any[];
  processes?: any[];
  loading?: boolean;
  currencySymbol?: string;
  countryCode?: string;
  timezone?: string;
  operationTiming?: any;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
}

export function OperationalReportView({
  orders = [],
  tables = [],
  layouts = [],
  processes = [],
  loading = false,
  currencySymbol: passedCurrencySymbol,
  countryCode = "IN",
  timezone,
  operationTiming,
  selectedRange,
  onRangeChange,
}: OperationalReportViewProps) {
  const currencySymbol =
    passedCurrencySymbol || getCurrencyForCountry(countryCode || "IN").symbol || "$";
  // 3 Tabs matching defx-pos-frontend OperationalReport.jsx: 'payment' | 'restaurant' | 'order'
  const [operationalTab, setOperationalTab] = useState<
    "payment" | "restaurant" | "order"
  >("payment");

  // Pagination states for the 3 sub-views
  const [paymentPage, setPaymentPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const [processPage, setProcessPage] = useState(1);
  const pageSize = 10;

  // Standard Menu Toaster Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string,
  ) => {
    setToast({ message, type, subtext });
  };

  // Date range dropdown state
  const [isDateOpen, setIsDateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close date dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute 100% Dynamic Operational Report Data from live orders (zero hardcoded mock datasets)
  const operationalData = useMemo(() => {
    return computeOperationalReportData(
      orders,
      tables,
      layouts,
      processes,
      currencySymbol,
      countryCode,
      timezone,
      operationTiming,
    );
  }, [
    orders,
    tables,
    layouts,
    processes,
    currencySymbol,
    countryCode,
    timezone,
    operationTiming,
  ]);

  const { paymentReport, restaurantTableReport, orderProcessReport } =
    operationalData;

  // Paginated Data
  const totalPaymentPages = Math.ceil(
    (paymentReport?.table_data?.length || 1) / pageSize,
  );
  const paginatedPaymentData = useMemo(() => {
    const start = (paymentPage - 1) * pageSize;
    return (paymentReport?.table_data || []).slice(start, start + pageSize);
  }, [paymentReport?.table_data, paymentPage, pageSize]);

  const totalTablePages = Math.ceil(
    (restaurantTableReport?.table_data?.length || 1) / pageSize,
  );
  const paginatedTableData = useMemo(() => {
    const start = (tablePage - 1) * pageSize;
    return (restaurantTableReport?.table_data || []).slice(
      start,
      start + pageSize,
    );
  }, [restaurantTableReport?.table_data, tablePage, pageSize]);

  const totalProcessPages = Math.ceil(
    (orderProcessReport?.table_data?.length || 1) / pageSize,
  );
  const paginatedProcessData = useMemo(() => {
    const start = (processPage - 1) * pageSize;
    return (orderProcessReport?.table_data || []).slice(
      start,
      start + pageSize,
    );
  }, [orderProcessReport?.table_data, processPage, pageSize]);

  // Preset Date Selection Handler
  const currentDateLabel = selectedRange?.preset || "Today";

  const handleSelectPreset = (presetName: string) => {
    setIsDateOpen(false);
    if (!onRangeChange) return;

    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (presetName === "Today") {
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
      );
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );
    } else if (presetName === "Yesterday") {
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        0,
        0,
        0,
      );
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        23,
        59,
        59,
      );
    } else if (presetName === "Last 7 Days") {
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 6,
        0,
        0,
        0,
      );
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );
    } else if (presetName === "This Month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );
    } else if (presetName === "Last Month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    onRangeChange({ startDate: start, endDate: end, preset: presetName });
  };

  // Export CSV handler for active tab
  const handleExportCsv = () => {
    if (operationalTab === "payment") {
      if (!paymentReport?.table_data || paymentReport.table_data.length === 0) {
        showToast(
          "No payment records available to export for this period.",
          "warning",
        );
        return;
      }
      const headers = [
        "Date",
        "Total Payments",
        "Total Payments Value",
        "Avg Used Payment Mode",
        "Percentage of Total Payments",
        "Avg Transaction Value",
      ];
      const rows = paymentReport.table_data.map((d) => [
        `"${d.date}"`,
        d.total_payments,
        `"${d.total_payments_value}"`,
        `"${d.avg_used_payment_mode}"`,
        `"${d.percentage_of_total_payments}"`,
        `"${d.avg_transaction_value}"`,
      ]);
      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `payment-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Payment modes CSV exported successfully", "success");
    } else if (operationalTab === "restaurant") {
      if (
        !restaurantTableReport?.table_data ||
        restaurantTableReport.table_data.length === 0
      ) {
        showToast(
          "No table records available to export for this period.",
          "warning",
        );
        return;
      }
      const headers = [
        "Date",
        "Most Used Table",
        "Layout",
        "Total Orders Served",
        "Avg Occupancy Duration",
        "Avg Occupancy Rate",
        "Avg Order Value",
      ];
      const rows = restaurantTableReport.table_data.map((d) => [
        `"${d.date}"`,
        `"${d.most_used_table}"`,
        `"${d.layout}"`,
        d.total_orders_served,
        `"${d.avg_occupancy_duration}"`,
        `"${d.avg_occupancy_rate}"`,
        `"${d.avg_order_value}"`,
      ]);
      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `restaurant-tables-report-${Date.now()}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Restaurant tables CSV exported successfully", "success");
    } else {
      if (
        !orderProcessReport?.table_data ||
        orderProcessReport.table_data.length === 0
      ) {
        showToast(
          "No order process records available to export for this period.",
          "warning",
        );
        return;
      }
      const headers = [
        "Date",
        "Total Orders Received",
        "Avg Time In Each Process",
        "Order Processing Efficiency",
      ];
      const rows = orderProcessReport.table_data.map((d) => [
        `"${d.date}"`,
        d.total_orders_recieved,
        `"${d.avg_time_in_each_process}"`,
        `"${d.order_processing_efficiency}"`,
      ]);
      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `order-processes-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Order processes CSV exported successfully", "success");
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Editorial Page Header & Controls */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-2">
        <div className="flex flex-col max-w-2xl space-y-1">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center text-[13px] text-[#5e5e5e] mb-2 gap-2 font-sans font-medium"
          >
            <Link
              href="/reports"
              className="hover:text-[#141010] transition-colors cursor-pointer"
            >
              Reports
            </Link>
            <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
            <span className="text-[#141010] font-semibold">
              Operational Report
            </span>
          </nav>
          <h1
            className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Operational Report
          </h1>
          <p className="text-[#5e5e5e] text-[14px] mt-1 font-normal leading-relaxed">
            Audit tender payment modes, dining table occupancy, and kitchen
            order processing speed.
          </p>
        </div>

        {/* Right Controls: Date Range Selector & CSV Export */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start sm:self-end shrink-0 w-full sm:w-auto">
          {selectedRange && onRangeChange ? (
            <OrderDateRangePicker
              startDate={selectedRange.startDate}
              endDate={selectedRange.endDate}
              preset={selectedRange.preset}
              onChange={onRangeChange}
              countryCode={countryCode}
              timezone={timezone}
              variant="pill"
              align="right"
            />
          ) : null}

          <button
            onClick={handleExportCsv}
            type="button"
            style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
            className="btn-primary inline-flex items-center gap-2 bg-[#0c0a09] !text-white text-xs font-semibold px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full shadow-xs hover:bg-[#262626] transition-colors cursor-pointer shrink-0"
          >
            <svg
              className="w-4 h-4 !text-white stroke-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
              />
              <polyline
                strokeLinecap="round"
                strokeLinejoin="round"
                points="7 10 12 15 17 10"
              />
              <line
                strokeLinecap="round"
                strokeLinejoin="round"
                x1="12"
                y1="15"
                x2="12"
                y2="3"
              />
            </svg>
            <span
              className="!text-white font-semibold"
              style={{ color: "#ffffff" }}
            >
              Export CSV
            </span>
          </button>
        </div>
      </header>

      {/* 3 Tabs matching defx-pos-frontend OperationalReport.jsx: Payment modes, Restaurant tables, Order processes */}
      <div className="border-b border-[#e9e1dd] flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar whitespace-nowrap">
        <button
          type="button"
          onClick={() => setOperationalTab("payment")}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer relative shrink-0 ${
            operationalTab === "payment"
              ? "text-[#1e1b19]"
              : "text-[#7f7570] hover:text-[#1e1b19]"
          }`}
        >
          <span>Payment modes</span>
          {operationalTab === "payment" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1e1b19] rounded-full"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setOperationalTab("restaurant")}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer relative shrink-0 ${
            operationalTab === "restaurant"
              ? "text-[#1e1b19]"
              : "text-[#7f7570] hover:text-[#1e1b19]"
          }`}
        >
          <span>Restaurant tables</span>
          {operationalTab === "restaurant" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1e1b19] rounded-full"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setOperationalTab("order")}
          className={`pb-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer relative shrink-0 ${
            operationalTab === "order"
              ? "text-[#1e1b19]"
              : "text-[#7f7570] hover:text-[#1e1b19]"
          }`}
        >
          <span>Order processes</span>
          {operationalTab === "order" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1e1b19] rounded-full"></span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* SUB-VIEW 1: PAYMENT MODES (PaymentModeReport)            */}
      {/* ======================================================== */}
      {operationalTab === "payment" && (
        <div className="space-y-6">
          {/* 4 KPI Cards matching defx-pos-frontend lines 139-166 */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Total payment processed */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold truncate">
                  Total payments
                </span>
                <svg
                  className="w-4 h-4 text-[#7f7570] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <div>
                <div
                  className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {loading
                    ? "..."
                    : paymentReport?.total_payments_count === 0
                      ? "-"
                      : paymentReport?.total_payments_count}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Total completed payments
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium">
                  Reconciled
                </span>
              </div>
            </div>

            {/* Card 2: Total payment value */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold truncate">
                  Payment value
                </span>
                <svg
                  className="w-4 h-4 text-[#7f7570] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div>
                <div
                  className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] leading-tight tabular-nums truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {loading
                    ? "..."
                    : isDataZero(paymentReport?.total_payment_value)}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Gross settled revenue
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1b873f]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium">
                  Total Turnover
                </span>
              </div>
            </div>

            {/* Card 3: Most used payment mode */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold truncate"
                  title="Most used payment mode"
                >
                  Top payment mode
                </span>
                <svg
                  className="w-4 h-4 text-[#1b873f] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div
                  className="text-lg sm:text-xl lg:text-2xl font-normal text-[#1e1b19] leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  title={String(paymentReport?.most_used_mode || "-")}
                >
                  {loading ? "..." : paymentReport?.most_used_mode || "-"}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Preferred customer tender
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1b873f]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium">
                  Top Volume
                </span>
              </div>
            </div>

            {/* Card 4: Least used payment mode */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#1e1b19] font-bold truncate"
                  title="Least used payment mode"
                >
                  Least used mode
                </span>
                <svg
                  className="w-4 h-4 text-[#7f7570] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div>
                <div
                  className="text-lg sm:text-xl lg:text-2xl font-normal text-[#1e1b19] leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  title={String(paymentReport?.least_used_mode || "-")}
                >
                  {loading ? "..." : paymentReport?.least_used_mode || "-"}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Lowest volume tender
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium tabular-nums">
                  Low Volume
                </span>
              </div>
            </div>
          </section>

          {/* Table 1: Payment Mode Breakdown matching defx-pos-frontend lines 170-178 */}
          <section className="bg-white border border-[#e9e1dd] rounded-2xl p-4 sm:p-6 shadow-xs">
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Tender Allocation
              </span>
              <h2
                className="text-lg sm:text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Payment mode breakdown
              </h2>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[620px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                    <th className="py-3 px-4 font-semibold">Mode</th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Total payments
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Percentage of total payments
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Total payment value
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Avg transaction value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
                  {paymentReport?.payment_mode_breakdown?.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-[#7f7570]"
                      >
                        No payment records available for this period.
                      </td>
                    </tr>
                  ) : (
                    paymentReport?.payment_mode_breakdown?.map((m, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#faf2ee] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#1e1b19]">
                          {m.mode}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums">
                          <span className="px-2.5 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] font-medium text-[11px]">
                            {m.total_payments} txns
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#1b873f] font-semibold">
                          {m.percentage_of_total_payments}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#1e1b19]">
                          {m.total_payment_value}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#645d58]">
                          {m.avg_transaction_value}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Table 2: Daily Table Data matching defx-pos-frontend lines 180-187 */}
          <section className="bg-white border border-[#e9e1dd] rounded-2xl p-4 sm:p-6 shadow-xs">
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Daily Ledger
              </span>
              <h2
                className="text-lg sm:text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Daily Payment Settlement
              </h2>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[720px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Total payments
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Total payments value
                    </th>
                    <th className="py-3 px-4 font-semibold">
                      Avg used payment mode
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Percentage of Total payments
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Avg transaction value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
                  {paginatedPaymentData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-[#7f7570]"
                      >
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="text-2xl">📋</span>
                          <p className="font-medium text-sm text-[#1e1b19]">
                            No Reports Available Yet
                          </p>
                          <p className="text-xs text-[#7f7570]">
                            Reports will appear once you start recording
                            transactions.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedPaymentData.map((d, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#faf2ee] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#1e1b19]">
                          {d.date}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums">
                          <span className="px-2.5 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] font-medium text-[11px]">
                            {d.total_payments} txns
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#1e1b19]">
                          {d.total_payments_value}
                        </td>
                        <td className="py-3.5 px-4 text-[#645d58]">
                          {d.avg_used_payment_mode}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#1b873f] font-semibold">
                          {d.percentage_of_total_payments}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#1e1b19]">
                          {d.avg_transaction_value}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(paymentReport?.table_data?.length || 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-[#e9e1dd] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#645d58] text-center sm:text-left">
                <span>
                  Showing{" "}
                  <strong className="text-[#1e1b19] font-semibold">
                    {(paymentPage - 1) * pageSize + 1}–
                    {Math.min(
                      paymentPage * pageSize,
                      paymentReport.table_data.length,
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-[#1e1b19] font-semibold">
                    {paymentReport.table_data.length}
                  </strong>{" "}
                  settlement days
                </span>
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={paymentPage === 1}
                    onClick={() => setPaymentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPaymentPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPaymentPage(i + 1)}
                      style={
                        paymentPage === i + 1
                          ? { backgroundColor: "#0c0a09", color: "#ffffff" }
                          : undefined
                      }
                      className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        paymentPage === i + 1
                          ? "bg-[#0c0a09] !text-white shadow-xs"
                          : "bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] hover:bg-[#eee7e3]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={
                      paymentPage === totalPaymentPages ||
                      totalPaymentPages === 0
                    }
                    onClick={() =>
                      setPaymentPage((p) => Math.min(totalPaymentPages, p + 1))
                    }
                    className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-VIEW 2: RESTAURANT TABLES (RestaurantTableReport)    */}
      {/* ======================================================== */}
      {operationalTab === "restaurant" && (
        <div className="space-y-6">
          {/* 4 KPI Cards matching defx-pos-frontend lines 223-250 */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Most occupied layout */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold truncate"
                  title="Most occupied layout"
                >
                  Peak layout
                </span>
                <svg
                  className="w-4 h-4 text-[#1b873f] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div>
                <div
                  className="text-lg sm:text-xl lg:text-2xl font-normal text-[#1e1b19] leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  title={String(
                    restaurantTableReport?.most_occupied_layout || "-",
                  )}
                >
                  {loading
                    ? "..."
                    : restaurantTableReport?.most_occupied_layout || "-"}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Highest dining room traffic
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1b873f]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium">
                  Peak Layout
                </span>
              </div>
            </div>

            {/* Card 2: Layout with most free tables */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold truncate"
                  title="Layout with most free tables"
                >
                  Most free tables
                </span>
                <svg
                  className="w-4 h-4 text-[#7f7570] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </div>
              <div>
                <div
                  className="text-lg sm:text-xl lg:text-2xl font-normal text-[#1e1b19] leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  title={String(
                    restaurantTableReport?.layout_with_most_free_tables || "-",
                  )}
                >
                  {loading
                    ? "..."
                    : restaurantTableReport?.layout_with_most_free_tables ||
                      "-"}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Available seating buffer
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#645d58]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#645d58] font-medium">
                  Capacity Buffer
                </span>
              </div>
            </div>

            {/* Card 3: Avg occupancy duration */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold truncate">
                  Avg dwell duration
                </span>
                <svg
                  className="w-4 h-4 text-[#7f7570] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <div
                  className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {loading
                    ? "..."
                    : restaurantTableReport?.avg_occupancy_duration || "-"}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Average table dwell time
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium">
                  Dwell Cadence
                </span>
              </div>
            </div>

            {/* Card 4: Total occupied percentage */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#1e1b19] font-bold truncate">
                  Occupancy rate
                </span>
                <svg
                  className="w-4 h-4 text-[#1e1b19] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 20V10M12 20V4M6 20v-6" />
                </svg>
              </div>
              <div>
                <div
                  className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {loading
                    ? "..."
                    : restaurantTableReport?.total_occupied_percentage ||
                      "0.0%"}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Current table utilization
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium tabular-nums">
                  Floor Utilization
                </span>
              </div>
            </div>
          </section>

          {/* Table 1: Layouts Breakdown matching defx-pos-frontend lines 254-262 */}
          <section className="bg-white border border-[#e9e1dd] rounded-2xl p-4 sm:p-6 shadow-xs">
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Floor Plan Analytics
              </span>
              <h2
                className="text-lg sm:text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Layouts breakdown
              </h2>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[700px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                    <th className="py-3 px-4 font-semibold">Layout</th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Total tables
                    </th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Total orders served
                    </th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Occupancy rate
                    </th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Peak occupancy time
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Layout revenue contribution
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Average order value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
                  {restaurantTableReport?.layouts_breakdown?.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-[#7f7570]"
                      >
                        No layout records available for this period.
                      </td>
                    </tr>
                  ) : (
                    restaurantTableReport?.layouts_breakdown?.map((l, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#faf2ee] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#1e1b19]">
                          {l.layout}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums text-[#645d58]">
                          {l.total_tables}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums font-semibold text-[#1e1b19]">
                          {l.total_orders_served}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums text-[#1b873f] font-semibold">
                          {l.occupancy_rate}
                        </td>
                        <td className="py-3.5 px-4 text-center text-[#645d58]">
                          {l.peak_occupancy_time}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#1e1b19]">
                          {l.layout_revenue_contribution}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#645d58]">
                          {l.average_order_value}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Table 2: Daily Table Data matching defx-pos-frontend lines 264-272 */}
          <section className="bg-white border border-[#e9e1dd] rounded-2xl p-4 sm:p-6 shadow-xs">
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Daily Timeline
              </span>
              <h2
                className="text-lg sm:text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Daily Table Occupancy
              </h2>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[740px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Most used table</th>
                    <th className="py-3 px-4 font-semibold">Layout</th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Total orders served
                    </th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Avg occupancy duration
                    </th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Avg occupancy rate
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Avg order value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
                  {paginatedTableData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-[#7f7570]"
                      >
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="text-2xl">📋</span>
                          <p className="font-medium text-sm text-[#1e1b19]">
                            No Reports Available Yet
                          </p>
                          <p className="text-xs text-[#7f7570]">
                            Reports will appear once you start recording
                            transactions.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedTableData.map((d, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#faf2ee] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#1e1b19]">
                          {d.date}
                        </td>
                        <td className="py-3.5 px-4 text-[#1e1b19] font-medium">
                          {d.most_used_table}
                        </td>
                        <td className="py-3.5 px-4 text-[#645d58]">
                          {d.layout}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums font-semibold text-[#1e1b19]">
                          {d.total_orders_served}
                        </td>
                        <td className="py-3.5 px-4 text-center text-[#645d58]">
                          {d.avg_occupancy_duration}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums text-[#1b873f] font-semibold">
                          {d.avg_occupancy_rate}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#1e1b19]">
                          {d.avg_order_value}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(restaurantTableReport?.table_data?.length || 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-[#e9e1dd] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#645d58] text-center sm:text-left">
                <span>
                  Showing{" "}
                  <strong className="text-[#1e1b19] font-semibold">
                    {(tablePage - 1) * pageSize + 1}–
                    {Math.min(
                      tablePage * pageSize,
                      restaurantTableReport.table_data.length,
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-[#1e1b19] font-semibold">
                    {restaurantTableReport.table_data.length}
                  </strong>{" "}
                  dining days
                </span>
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={tablePage === 1}
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalTablePages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTablePage(i + 1)}
                      style={
                        tablePage === i + 1
                          ? { backgroundColor: "#0c0a09", color: "#ffffff" }
                          : undefined
                      }
                      className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        tablePage === i + 1
                          ? "bg-[#0c0a09] !text-white shadow-xs"
                          : "bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] hover:bg-[#eee7e3]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={
                      tablePage === totalTablePages || totalTablePages === 0
                    }
                    onClick={() =>
                      setTablePage((p) => Math.min(totalTablePages, p + 1))
                    }
                    className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUB-VIEW 3: ORDER PROCESSES (OrderProcessReport)         */}
      {/* ======================================================== */}
      {operationalTab === "order" && (
        <div className="space-y-6">
          {/* 3 KPI Cards matching defx-pos-frontend lines 295-316 */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Card 1: Total orders recieved */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold truncate">
                  Total orders received
                </span>
                <svg
                  className="w-4 h-4 text-[#7f7570] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div>
                <div
                  className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {loading
                    ? "..."
                    : (orderProcessReport?.total_orders_received ?? 0)}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Orders routed to kitchen &amp; bar
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium">
                  Kitchen Intake
                </span>
              </div>
            </div>

            {/* Card 2: Avg time in each process */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#645d58] font-semibold truncate">
                  Avg process time
                </span>
                <svg
                  className="w-4 h-4 text-[#7f7570] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <div
                  className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {loading
                    ? "..."
                    : (orderProcessReport?.avg_time_in_each_process ?? "-")}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Order prep to fulfillment cadence
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1b873f]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium">
                  Prep Velocity
                </span>
              </div>
            </div>

            {/* Card 3: Order processing efficiency */}
            <div className="bg-white border border-[#e9e1dd] rounded-2xl p-3.5 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#1e1b19] font-bold truncate">
                  Processing efficiency
                </span>
                <svg
                  className="w-4 h-4 text-[#1e1b19] shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <div
                  className="text-xl sm:text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight truncate"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  {loading
                    ? "..."
                    : (orderProcessReport?.order_processing_efficiency ??
                      "100.0%")}
                </div>
                <div className="text-[11px] sm:text-xs text-[#7f7570] mt-0.5 sm:mt-1 truncate">
                  Completed vs received ratio
                </div>
              </div>
              <div className="mt-2.5 sm:mt-4 pt-0.5 sm:pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-2.5 sm:px-3 py-0.5 sm:py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19]"></span>
                <span className="text-[10px] sm:text-[11px] text-[#1e1b19] font-medium tabular-nums">
                  100% Fulfillment
                </span>
              </div>
            </div>
          </section>

          {/* Table: Daily Order Processes Table matching defx-pos-frontend lines 319-327 */}
          <section className="bg-white border border-[#e9e1dd] rounded-2xl p-4 sm:p-6 shadow-xs">
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Kitchen Throughput
              </span>
              <h2
                className="text-lg sm:text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Order Processing Ledger
              </h2>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[560px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Total orders recieved
                    </th>
                    <th className="py-3 px-4 font-semibold text-center">
                      Avg time in each process
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">
                      Order processing efficiency
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
                  {paginatedProcessData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-12 text-center text-[#7f7570]"
                      >
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="text-2xl">📋</span>
                          <p className="font-medium text-sm text-[#1e1b19]">
                            No Reports Available Yet
                          </p>
                          <p className="text-xs text-[#7f7570]">
                            Reports will appear once you start recording
                            transactions.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedProcessData.map((d, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#faf2ee] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#1e1b19]">
                          {d.date}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums">
                          <span className="px-2.5 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] font-medium text-[11px]">
                            {d.total_orders_recieved} orders
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-[#645d58]">
                          {d.avg_time_in_each_process}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#1b873f] font-bold">
                          {d.order_processing_efficiency}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(orderProcessReport?.table_data?.length || 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-[#e9e1dd] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#645d58] text-center sm:text-left">
                <span>
                  Showing{" "}
                  <strong className="text-[#1e1b19] font-semibold">
                    {(processPage - 1) * pageSize + 1}–
                    {Math.min(
                      processPage * pageSize,
                      orderProcessReport.table_data.length,
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-[#1e1b19] font-semibold">
                    {orderProcessReport.table_data.length}
                  </strong>{" "}
                  processing days
                </span>
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={processPage === 1}
                    onClick={() => setProcessPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalProcessPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setProcessPage(i + 1)}
                      style={
                        processPage === i + 1
                          ? { backgroundColor: "#0c0a09", color: "#ffffff" }
                          : undefined
                      }
                      className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        processPage === i + 1
                          ? "bg-[#0c0a09] !text-white shadow-xs"
                          : "bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] hover:bg-[#eee7e3]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={
                      processPage === totalProcessPages ||
                      totalProcessPages === 0
                    }
                    onClick={() =>
                      setProcessPage((p) => Math.min(totalProcessPages, p + 1))
                    }
                    className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Standard Menu Toaster Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
