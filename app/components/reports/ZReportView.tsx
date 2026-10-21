"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { formatPriceWithSymbol } from "../../../lib/constants/countries";
import { DateRange } from "./ReportHeader";
import { computeZReportData } from "../../reports/reportCalculations";
import { Toast, type ToastMessage } from "../Toast";

interface ZReportViewProps {
  orders: any[];
  loading?: boolean;
  currencySymbol: string;
  countryCode?: string;
  timezone?: string;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  orgName?: string;
  branchName?: string;
}

export function ZReportView({
  orders = [],
  loading = false,
  currencySymbol = "₹",
  countryCode = "IN",
  timezone,
  selectedRange,
  onRangeChange,
  orgName = "Skyz Restaurant & Banquet",
  branchName = "Main Floor",
}: ZReportViewProps) {
  // Toast Notification state
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string,
  ) => {
    setToast({ message, type, subtext });
  };

  // Date Range Dropdown State
  const [isDateOpen, setIsDateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const datePresets = [
    "Today",
    "Yesterday",
    "Last 7 Days",
    "Last 30 Days",
    "This Month",
    "Last Month",
  ];

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

  const currentDateLabel = selectedRange?.preset || "Today";

  const handleSelectPreset = (preset: string) => {
    setIsDateOpen(false);
    if (!onRangeChange) return;

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    let start = new Date(startOfToday);
    let end = new Date(endOfToday);

    if (preset === "Yesterday") {
      start.setDate(start.getDate() - 1);
      end = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        23,
        59,
        59,
        999,
      );
    } else if (preset === "Last 7 Days") {
      start.setDate(start.getDate() - 6);
    } else if (preset === "Last 30 Days") {
      start.setDate(start.getDate() - 29);
    } else if (preset === "This Month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (preset === "Last Month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }

    onRangeChange({ startDate: start, endDate: end, preset });
  };

  // Compute Z-Report Metrics
  const zData = useMemo(() => {
    return computeZReportData(orders, currencySymbol, countryCode, timezone);
  }, [orders, currencySymbol, countryCode, timezone]);

  // Cash Drawer Reconciliation States (In currency units, e.g. Rupees)
  const [openingFloat, setOpeningFloat] = useState<string>("0");
  const [actualCountedCash, setActualCountedCash] = useState<string>("");

  // Cashier Input parsed to paise
  const openingFloatPaise = Math.round((parseFloat(openingFloat) || 0) * 100);
  const actualCountedPaise =
    actualCountedCash !== ""
      ? Math.round((parseFloat(actualCountedCash) || 0) * 100)
      : null;

  // Expected Cash = Opening Float + Cash Sales - Cash Refunds
  const expectedCashPaise = openingFloatPaise + zData.cash_sales_paise;
  const variancePaise =
    actualCountedPaise !== null ? actualCountedPaise - expectedCashPaise : null;

  const handlePrintSlip = () => {
    window.print();
  };

  const handleExportCSV = () => {
    try {
      const headers = ["Metric", "Value", "Notes"];
      const rows = [
        ["Report Type", "Z-Report (Shift Close)", "Audited Register Closeout"],
        ["Organization", orgName, branchName],
        [
          "Period Range",
          `${zData.shift_start_time} to ${zData.shift_end_time}`,
          currentDateLabel,
        ],
        ["Total Orders Received", String(zData.total_orders), "All orders in window"],
        ["Completed Orders", String(zData.completed_orders), "Settled and closed"],
        ["Cancelled / Voided Orders", String(zData.cancelled_orders), "Unsettled / Voided"],
        ["Gross Sales", zData.gross_sales, "Item sales before deductions"],
        ["Discounts", zData.discounts, "Promotional & item discounts"],
        ["Tax Collected", zData.tax_collected, "GST / Local sales taxes"],
        ["Refunds Issued", zData.refunds, "Total refunded value"],
        ["Net Sales", zData.net_sales, "Gross Sales - Tax - Refunds"],
        [
          "Opening Cash Float",
          formatPriceWithSymbol(openingFloatPaise, currencySymbol, countryCode, true),
          "Initial drawer cash",
        ],
        ["Cash Sales", zData.cash_sales, "Settled in Cash"],
        ["Card Sales", zData.card_sales, "Settled on POS Cards"],
        ["UPI / Digital Sales", zData.upi_sales, "Settled via QR / UPI"],
        ["Other Tender Sales", zData.other_sales, "Other payment modes"],
        [
          "Expected Cash in Drawer",
          formatPriceWithSymbol(expectedCashPaise, currencySymbol, countryCode, true),
          "Opening Float + Cash Sales",
        ],
        [
          "Actual Counted Cash",
          actualCountedPaise !== null
            ? formatPriceWithSymbol(actualCountedPaise, currencySymbol, countryCode, true)
            : "Not Counted",
          "Drawer count at shift close",
        ],
        [
          "Cash Variance (Over / Short)",
          variancePaise !== null
            ? formatPriceWithSymbol(variancePaise, currencySymbol, countryCode, true)
            : "N/A",
          variancePaise === 0
            ? "Balanced"
            : variancePaise && variancePaise > 0
            ? "Cash Overage"
            : "Cash Shortage",
        ],
      ];

      // Add tender breakdown rows
      rows.push(["--- TENDER BREAKDOWN ---", "", ""]);
      zData.payment_methods.forEach((pm: { mode: string; count: number; display_total: string; percentage: string }) => {
        rows.push([
          `Tender: ${pm.mode}`,
          pm.display_total,
          `${pm.count} transactions (${pm.percentage})`,
        ]);
      });

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [
          headers.join(","),
          ...rows.map((e) =>
            e.map((val) => `"${val.replace(/"/g, '""')}"`).join(","),
          ),
        ].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `z_report_shift_close_${currentDateLabel.toLowerCase().replace(/\s+/g, "_")}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast("Z-Report CSV exported successfully", "success");
    } catch {
      showToast("Failed to generate CSV export", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Container */}
      {toast && (
        <Toast
          toast={toast}
          onClose={() => setToast(null)}
        />
      )}

      {/* Screen Only: Navigation & Header Ribbon */}
      <div className="print:hidden">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-3 text-xs text-[#7f7570]">
          <Link
            href="/reports"
            className="hover:text-[#1e1b19] transition-colors flex items-center gap-1"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Reports Hub
          </Link>
          <span>/</span>
          <span className="text-[#1e1b19] font-medium">Z-Report / Shift Close</span>
        </div>

        {/* Header Ribbon */}
        <header className="w-full pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e9e1dd]">
          <div className="max-w-2xl space-y-1">
            <h1
              className="text-3xl lg:text-4xl text-[#1e1b19] font-normal tracking-tight leading-none"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              Z-Report / Shift Close
            </h1>
            <p className="text-sm text-[#645d58] pt-1">
              Final register reconciliation, tender auditing, and verified financial closeout.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Date Preset Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDateOpen(!isDateOpen)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-[#e9e1dd] text-xs font-semibold text-[#1e1b19] hover:bg-[#faf2ee] transition-colors shadow-xs"
              >
                <svg
                  className="w-3.5 h-3.5 text-[#7f7570]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>{currentDateLabel}</span>
                <svg
                  className={`w-3.5 h-3.5 text-[#7f7570] transition-transform duration-200 ${
                    isDateOpen ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isDateOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-48 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-[#e9e1dd] py-1.5 z-50">
                  {datePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                        currentDateLabel === preset
                          ? "font-semibold text-[#1e1b19] bg-[#faf2ee]"
                          : "text-[#645d58] hover:bg-[#faf2ee]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Print Chit Button */}
            <button
              type="button"
              onClick={handlePrintSlip}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#e9e1dd] text-xs font-semibold text-[#1e1b19] hover:bg-[#faf2ee] transition-colors shadow-xs"
            >
              <svg
                className="w-3.5 h-3.5 text-[#7f7570]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Print Chit (80mm)</span>
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1e1b19] text-white text-xs font-semibold hover:bg-[#292524] transition-colors shadow-xs"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export Audit CSV</span>
            </button>
          </div>
        </header>

        {/* Backend Limitation Notice Banner */}
        <div className="mt-4 bg-[#faf2ee] border border-[#e9e1dd] rounded-xl p-4 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-[#1e1b19] shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="text-xs text-[#645d58] space-y-1">
            <span className="font-semibold text-[#1e1b19] block">
              Shift Architecture &amp; Data Grounding
            </span>
            <p>
              All sales figures, taxes, discounts, refunds, and payment tenders below are calculated
              in real time from verified orders settled in the selected window. Because the database
              currently has no persistent shift session table, opening floats and counted drawer amounts
              are reconciled in this session and can be printed to physical receipt or exported to CSV.
            </p>
          </div>
        </div>
      </div>

      {/* Screen Only: Executive Financial KPI Cards */}
      <div className="print:hidden grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Gross Sales */}
        <div className="bg-white rounded-2xl p-4 border border-[#e9e1dd] shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-[#7f7570] font-semibold mb-1">
            Gross Sales
          </div>
          <div
            className="text-2xl font-normal text-[#1e1b19] tabular-nums"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            {loading ? "..." : zData.gross_sales}
          </div>
          <div className="text-[11px] text-[#645d58] mt-1">
            {zData.completed_orders} settled orders
          </div>
        </div>

        {/* Card 2: Net Sales */}
        <div className="bg-white rounded-2xl p-4 border border-[#e9e1dd] shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-[#7f7570] font-semibold mb-1">
            Net Sales
          </div>
          <div
            className="text-2xl font-normal text-[#1e1b19] tabular-nums"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            {loading ? "..." : zData.net_sales}
          </div>
          <div className="text-[11px] text-[#645d58] mt-1">
            Excl. Tax &amp; Refunds
          </div>
        </div>

        {/* Card 3: Tax Collected */}
        <div className="bg-white rounded-2xl p-4 border border-[#e9e1dd] shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-[#7f7570] font-semibold mb-1">
            Tax Collected
          </div>
          <div
            className="text-2xl font-normal text-[#1e1b19] tabular-nums"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            {loading ? "..." : zData.tax_collected}
          </div>
          <div className="text-[11px] text-[#645d58] mt-1">
            GST / Sales Tax
          </div>
        </div>

        {/* Card 4: Discounts */}
        <div className="bg-white rounded-2xl p-4 border border-[#e9e1dd] shadow-xs">
          <div className="text-[11px] uppercase tracking-wider text-[#7f7570] font-semibold mb-1">
            Discounts Given
          </div>
          <div
            className="text-2xl font-normal text-[#1e1b19] tabular-nums"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            {loading ? "..." : zData.discounts}
          </div>
          <div className="text-[11px] text-[#645d58] mt-1">
            Promotional allowances
          </div>
        </div>

        {/* Card 5: Refunds Issued */}
        <div className="bg-white rounded-2xl p-4 border border-[#e9e1dd] shadow-xs col-span-2 lg:col-span-1">
          <div className="text-[11px] uppercase tracking-wider text-[#7f7570] font-semibold mb-1">
            Refunds Issued
          </div>
          <div
            className="text-2xl font-normal text-[#1e1b19] tabular-nums"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            {loading ? "..." : zData.refunds}
          </div>
          <div className="text-[11px] text-[#645d58] mt-1">
            {zData.cancelled_orders} voided/rejected
          </div>
        </div>
      </div>

      {/* Screen Only: Two-Column Working Grid (Cash Reconciliation + Tender Matrix) */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Interactive Cash Drawer Reconciliation */}
        <div className="bg-white rounded-2xl p-6 border border-[#e9e1dd] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#e9e1dd]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1b873f]"></span>
                <h2 className="text-base font-semibold text-[#1e1b19]">
                  Cash Drawer Reconciliation
                </h2>
              </div>
              <span className="text-xs text-[#7f7570] font-mono">
                REGISTER-01
              </span>
            </div>

            <p className="text-xs text-[#645d58] mt-2 mb-5">
              Verify starting register float against counted closing cash to balance the shift.
            </p>

            <div className="space-y-4">
              {/* Row 1: Opening Cash Float Input */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#1e1b19] block">
                    Opening Cash Float ({currencySymbol})
                  </label>
                  <span className="text-[11px] text-[#7f7570]">
                    Beginning of shift cash in till
                  </span>
                </div>
                <div className="w-36">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-right px-3 py-1.5 rounded-lg border border-[#e9e1dd] text-xs font-semibold text-[#1e1b19] focus:outline-none focus:ring-1 focus:ring-[#1e1b19]"
                  />
                </div>
              </div>

              {/* Row 2: Cash Sales (Read-Only) */}
              <div className="flex items-center justify-between gap-4 py-2 border-t border-[#f5ece7]">
                <div>
                  <span className="text-xs font-medium text-[#1e1b19] block">
                    Cash Sales Collected
                  </span>
                  <span className="text-[11px] text-[#7f7570]">
                    Total cash received from orders
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-[#1e1b19] tabular-nums">
                    {zData.cash_sales}
                  </span>
                </div>
              </div>

              {/* Row 3: Cash Refunds (Read-Only) */}
              <div className="flex items-center justify-between gap-4 py-2 border-t border-[#f5ece7]">
                <div>
                  <span className="text-xs font-medium text-[#1e1b19] block">
                    Cash Refunds Paid Out
                  </span>
                  <span className="text-[11px] text-[#7f7570]">
                    Returned cash from register
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-[#645d58] tabular-nums">
                    - {currencySymbol}0.00
                  </span>
                </div>
              </div>

              {/* Row 4: Expected Cash in Drawer */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#faf2ee] border border-[#e9e1dd]">
                <div>
                  <span className="text-xs font-semibold text-[#1e1b19] block">
                    Expected Cash in Drawer
                  </span>
                  <span className="text-[10px] text-[#7f7570]">
                    Opening Float + Cash Sales
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-[#1e1b19] tabular-nums">
                    {formatPriceWithSymbol(expectedCashPaise, currencySymbol, countryCode, true)}
                  </span>
                </div>
              </div>

              {/* Row 5: Counted Drawer Cash Input */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-[#1e1b19] block">
                    Counted Closing Cash ({currencySymbol})
                  </label>
                  <span className="text-[11px] text-[#7f7570]">
                    Physical currency counted at close
                  </span>
                </div>
                <div className="w-36">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={actualCountedCash}
                    onChange={(e) => setActualCountedCash(e.target.value)}
                    placeholder="Enter total..."
                    className="w-full text-right px-3 py-1.5 rounded-lg border border-[#e9e1dd] text-xs font-semibold text-[#1e1b19] focus:outline-none focus:ring-1 focus:ring-[#1e1b19]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Variance Status Ribbon */}
          <div className="mt-6 pt-4 border-t border-[#e9e1dd] flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#7f7570] font-semibold block">
                Cash Variance
              </span>
              <span className="text-xs font-semibold text-[#1e1b19]">
                {variancePaise === null ? (
                  <span className="text-[#7f7570]">Enter counted cash to reconcile</span>
                ) : variancePaise === 0 ? (
                  <span className="text-[#1b873f]">Balanced (Exact Match)</span>
                ) : variancePaise > 0 ? (
                  <span className="text-[#1b873f]">
                    + {formatPriceWithSymbol(variancePaise, currencySymbol, countryCode, true)} (Over)
                  </span>
                ) : (
                  <span className="text-[#b91c1c]">
                    - {formatPriceWithSymbol(Math.abs(variancePaise), currencySymbol, countryCode, true)} (Short)
                  </span>
                )}
              </span>
            </div>
            <div>
              {variancePaise === null ? (
                <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#faf2ee] text-[#7f7570] border border-[#e9e1dd]">
                  Pending Count
                </span>
              ) : variancePaise === 0 ? (
                <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#eaf7ee] text-[#1b873f] border border-[#c1e7cb]">
                  Drawer Balanced
                </span>
              ) : variancePaise > 0 ? (
                <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#eaf7ee] text-[#1b873f] border border-[#c1e7cb]">
                  Drawer Over
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#fdf0f0] text-[#b91c1c] border border-[#f8c8c8]">
                  Drawer Short
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Payment Tender Breakdown Matrix */}
        <div className="bg-white rounded-2xl p-6 border border-[#e9e1dd] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#e9e1dd]">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-[#1e1b19]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <h2 className="text-base font-semibold text-[#1e1b19]">
                  Tender / Settlement Summary
                </h2>
              </div>
              <span className="text-xs text-[#7f7570]">
                {zData.payment_methods.length} Modes Audited
              </span>
            </div>

            <p className="text-xs text-[#645d58] mt-2 mb-4">
              Breakdown of total revenue settled across each payment method.
            </p>

            <div className="divide-y divide-[#f5ece7] border-y border-[#f5ece7]">
              {zData.payment_methods.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#7f7570]">
                  No payment transactions recorded in this period.
                </div>
              ) : (
                zData.payment_methods.map((pm: { mode: string; count: number; display_total: string; percentage: string }, idx: number) => (
                  <div
                    key={idx}
                    className="py-3 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#faf2ee] border border-[#e9e1dd] flex items-center justify-center font-bold text-[#1e1b19] text-[11px]">
                        {pm.mode.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-[#1e1b19]">
                          {pm.mode}
                        </div>
                        <div className="text-[11px] text-[#7f7570]">
                          {pm.count} {pm.count === 1 ? "receipt" : "receipts"} • {pm.percentage}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[#1e1b19] tabular-nums">
                        {pm.display_total}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Tender Summary Footer */}
          <div className="mt-6 pt-4 border-t border-[#e9e1dd] flex items-center justify-between text-xs">
            <span className="text-[#7f7570] font-semibold">
              Total Audited Tenders:
            </span>
            <span className="text-sm font-bold text-[#1e1b19] tabular-nums">
              {zData.gross_sales}
            </span>
          </div>
        </div>
      </div>

      {/* Screen & Print: 80mm ESC/POS Thermal Chit Preview */}
      <div className="mt-6 bg-white rounded-2xl p-6 border border-[#e9e1dd] shadow-xs print:shadow-none print:border-none print:p-0">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <div>
            <h3 className="text-sm font-semibold text-[#1e1b19]">
              Thermal Register Slip (80mm ESC/POS)
            </h3>
            <p className="text-xs text-[#645d58]">
              Standard shift closeout receipt for archiving in physical cash binder.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePrintSlip}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-xs font-medium text-[#1e1b19] hover:bg-[#e9e1dd] transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Print Thermal Chit</span>
          </button>
        </div>

        {/* 80mm Chit Container (Centered on screen, full-width on print) */}
        <div className="flex justify-center">
          <div
            id="z-report-chit"
            className="w-full max-w-[340px] bg-[#fffdfa] border border-[#e0d6ce] p-6 shadow-sm font-mono text-[11px] leading-tight text-[#1e1b19] print:max-w-none print:w-full print:border-none print:shadow-none print:p-0"
          >
            {/* Chit Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-[#a89f91]">
              <div className="text-xs font-bold uppercase tracking-wider">
                {orgName}
              </div>
              <div className="text-[10px] text-[#554e47]">{branchName}</div>
              <div className="text-[10px] font-bold mt-1 text-[#1e1b19]">
                *** Z-REPORT / REGISTER CLOSE ***
              </div>
              <div className="text-[9px] text-[#7f7570]">
                TERMINAL-01 • AUDIT ID: #ZR-{Date.now().toString().slice(-6)}
              </div>
            </div>

            {/* Shift Timestamps */}
            <div className="py-2.5 border-b border-dashed border-[#a89f91] space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-[#554e47]">Period Start:</span>
                <span>{zData.shift_start_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#554e47]">Period Close:</span>
                <span>{zData.shift_end_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#554e47]">Preset Window:</span>
                <span className="font-bold">{currentDateLabel}</span>
              </div>
            </div>

            {/* Financial Ledger Section */}
            <div className="py-2.5 border-b border-dashed border-[#a89f91] space-y-1">
              <div className="text-[10px] font-bold uppercase pb-1">
                Sales Financials
              </div>
              <div className="flex justify-between">
                <span>Total Orders:</span>
                <span className="font-bold">{zData.total_orders}</span>
              </div>
              <div className="flex justify-between text-[#554e47]">
                <span>- Settled / Closed:</span>
                <span>{zData.completed_orders}</span>
              </div>
              <div className="flex justify-between text-[#554e47]">
                <span>- Voided / Cancelled:</span>
                <span>{zData.cancelled_orders}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="font-bold">GROSS SALES:</span>
                <span className="font-bold">{zData.gross_sales}</span>
              </div>
              <div className="flex justify-between text-[#554e47]">
                <span>Total Discounts:</span>
                <span>- {zData.discounts}</span>
              </div>
              <div className="flex justify-between text-[#554e47]">
                <span>Total Tax (GST):</span>
                <span>{zData.tax_collected}</span>
              </div>
              <div className="flex justify-between text-[#554e47]">
                <span>Refunds / Returns:</span>
                <span>- {zData.refunds}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-dotted border-[#a89f91] font-bold text-xs">
                <span>NET SALES:</span>
                <span>{zData.net_sales}</span>
              </div>
            </div>

            {/* Tender Breakdown Section */}
            <div className="py-2.5 border-b border-dashed border-[#a89f91] space-y-1">
              <div className="text-[10px] font-bold uppercase pb-1">
                Tender Audit
              </div>
              {zData.payment_methods.map((pm: { mode: string; count: number; display_total: string }, idx: number) => (
                <div key={idx} className="flex justify-between text-[10px]">
                  <span>
                    {pm.mode} ({pm.count}):
                  </span>
                  <span className="font-semibold">{pm.display_total}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 font-bold">
                <span>TOTAL SETTLED:</span>
                <span>{zData.gross_sales}</span>
              </div>
            </div>

            {/* Cash Drawer Reconciliation Section */}
            <div className="py-2.5 border-b border-dashed border-[#a89f91] space-y-1">
              <div className="text-[10px] font-bold uppercase pb-1">
                Drawer Reconciliation
              </div>
              <div className="flex justify-between">
                <span>Opening Float:</span>
                <span>
                  {formatPriceWithSymbol(openingFloatPaise, currencySymbol, countryCode, true)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cash Sales:</span>
                <span>{zData.cash_sales}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Expected in Till:</span>
                <span>
                  {formatPriceWithSymbol(expectedCashPaise, currencySymbol, countryCode, true)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Counted Cash:</span>
                <span>
                  {actualCountedPaise !== null
                    ? formatPriceWithSymbol(actualCountedPaise, currencySymbol, countryCode, true)
                    : "---"}
                </span>
              </div>
              <div className="flex justify-between pt-1 font-bold border-t border-dotted border-[#a89f91]">
                <span>DRAWER VARIANCE:</span>
                <span>
                  {variancePaise === null
                    ? "PENDING"
                    : variancePaise === 0
                    ? "BALANCED (0.00)"
                    : variancePaise > 0
                    ? `OVER (+${formatPriceWithSymbol(variancePaise, currencySymbol, countryCode, true)})`
                    : `SHORT (-${formatPriceWithSymbol(Math.abs(variancePaise), currencySymbol, countryCode, true)})`}
                </span>
              </div>
            </div>

            {/* Signatures & Footer */}
            <div className="pt-3 space-y-4 text-[9px] text-[#554e47]">
              <div>
                <div className="mb-4">Cashier Signature: ______________________</div>
                <div>Manager Signature: ______________________</div>
              </div>
              <div className="text-center text-[8px] text-[#7f7570] pt-2 border-t border-dashed border-[#a89f91]">
                PREST POS SYSTEM • IMMUTABLE AUDIT RECORD
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
