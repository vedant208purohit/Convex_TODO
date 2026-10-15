"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { formatPriceWithSymbol } from "../../../lib/constants/countries";
import { DateRange } from "./ReportHeader";
import { computeMenuReportData, isDataZero } from "../../reports/reportCalculations";
import { Toast, type ToastMessage } from "../Toast";

interface MenuReportViewProps {
  orders: any[];
  allItems?: any[];
  allCategories?: any[];
  loading?: boolean;
  currencySymbol?: string;
  countryCode?: string;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
}

export function MenuReportView({
  orders = [],
  allItems = [],
  allCategories = [],
  loading = false,
  currencySymbol = "₹",
  countryCode = "IN",
  selectedRange,
  onRangeChange,
}: MenuReportViewProps) {
  // Tabs: 'item' | 'categories' (matches defx-pos-frontend MenuReport.jsx)
  const [reportBy, setReportBy] = useState<"item" | "categories">("item");
  const [itemPage, setItemPage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const pageSize = 10;

  // Standard Menu Toaster Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  const [isDateOpen, setIsDateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside date dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute Menu Report Data (100% dynamic from live orders, zero mock data)
  const menuReport = useMemo(() => {
    return computeMenuReportData(
      orders,
      allItems,
      allCategories,
      currencySymbol,
      countryCode
    );
  }, [orders, allItems, allCategories, currencySymbol, countryCode]);

  const { salesByItem, salesByCategory } = menuReport;

  // 4 KPI Cards calculated dynamically based on active tab (matches defx-pos-frontend MenuReport.jsx lines 49-64)
  const totalItemSold =
    reportBy === "item"
      ? salesByItem?.total_items_sold
      : salesByCategory?.total_items_sold_by_category;

  const topPerforming =
    reportBy === "item"
      ? salesByItem?.top_performing_item?.item_name || "-"
      : salesByCategory?.top_category || "-";

  const leastPerforming =
    reportBy === "item"
      ? salesByItem?.least_performing_item?.item_name || "-"
      : salesByCategory?.least_category || "-";

  const avgPrice =
    reportBy === "item"
      ? isDataZero(salesByItem?.avg_item_price)
      : isDataZero(salesByCategory?.avg_item_price_by_category);

  // Pagination for Sales by Item table
  const totalItemPages = Math.ceil((salesByItem?.table_data?.length || 1) / pageSize);
  const paginatedItems = useMemo(() => {
    const start = (itemPage - 1) * pageSize;
    return (salesByItem?.table_data || []).slice(start, start + pageSize);
  }, [salesByItem?.table_data, itemPage, pageSize]);

  // Pagination for Sales by Category table
  const totalCategoryPages = Math.ceil((salesByCategory?.table_data?.length || 1) / pageSize);
  const paginatedCategories = useMemo(() => {
    const start = (categoryPage - 1) * pageSize;
    return (salesByCategory?.table_data || []).slice(start, start + pageSize);
  }, [salesByCategory?.table_data, categoryPage, pageSize]);

  // Preset Date Selection Handler
  const currentDateLabel = selectedRange?.preset || "Today";

  const handleSelectPreset = (presetName: string) => {
    setIsDateOpen(false);
    if (!onRangeChange) return;

    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (presetName === "Today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (presetName === "Yesterday") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    } else if (presetName === "Last 7 Days") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (presetName === "This Month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (presetName === "Last Month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    onRangeChange({ startDate: start, endDate: end, preset: presetName });
  };

  // Export CSV handler matching active tab
  const handleExportCsv = () => {
    if (reportBy === "item") {
      if (!salesByItem?.table_data || salesByItem.table_data.length === 0) {
        showToast("No item records available to export for this period.", "warning");
        return;
      }
      const headers = [
        "Item Name",
        "Item Price",
        "Gross Sales",
        "Item Sold",
        "Tax Collected",
        "Net Sales",
      ];
      const rows = salesByItem.table_data.map((it) => [
        `"${it.item_name}"`,
        `"${it.item_price}"`,
        `"${it.gross_sales}"`,
        it.item_sold,
        `"${it.tax_collected}"`,
        `"${it.net_sales}"`,
      ]);
      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `menu-sales-by-item-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Menu items CSV exported successfully", "success");
    } else {
      if (!salesByCategory?.table_data || salesByCategory.table_data.length === 0) {
        showToast("No category records available to export for this period.", "warning");
        return;
      }
      const headers = [
        "Category Name",
        "Items Sold",
        "Gross Sales",
        "Tax Collected",
        "Net Sales",
        "Avg Item Price",
      ];
      const rows = salesByCategory.table_data.map((c) => [
        `"${c.category_name}"`,
        c.items_sold,
        `"${c.gross_sales}"`,
        `"${c.tax_collected}"`,
        `"${c.net_sales}"`,
        `"${c.avg_item_price}"`,
      ]);
      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `menu-sales-by-category-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Menu categories CSV exported successfully", "success");
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Editorial Page Header & Controls */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-2">
        <div className="flex flex-col max-w-2xl space-y-1">
          <nav className="flex items-center gap-2 mb-1">
            <Link
              href="/reports"
              className="text-[11px] tracking-widest text-[#645d58] hover:text-[#1e1b19] uppercase font-semibold transition-colors cursor-pointer"
            >
              Reports
            </Link>
            <span className="text-[#d0c4be] text-xs">/</span>
            <span className="text-[11px] tracking-widest text-[#1e1b19] uppercase font-semibold">
              Menu Report
            </span>
          </nav>
          <h1
            className="text-4xl lg:text-5xl text-[#1e1b19] tracking-tight leading-none font-normal"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Menu Report
          </h1>
          <p className="text-sm text-[#645d58] leading-relaxed pt-0.5">
            Audit item sales velocity, category mix performance, units sold, and net revenue across service channels.
          </p>
        </div>

        {/* Right Controls: Date Range Selector & CSV Export */}
        <div className="flex items-center gap-3 self-start lg:self-end shrink-0">
          {/* Date Range Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDateOpen(!isDateOpen)}
              type="button"
              className="appearance-none bg-white border border-[#e9e1dd] text-[#1e1b19] text-xs font-semibold pl-4 pr-9 py-2.5 rounded-full shadow-xs hover:bg-[#faf2ee] transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>{currentDateLabel}</span>
              <svg
                className="w-4 h-4 text-[#7f7570] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isDateOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl py-2 z-30 border border-[#e9e1dd]">
                {["Today", "Yesterday", "Last 7 Days", "This Month", "Last Month"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`w-full text-left px-4 py-2 text-xs transition-colors cursor-pointer ${
                      currentDateLabel === preset
                        ? "font-semibold text-[#1e1b19] bg-[#faf2ee]"
                        : "text-[#645d58] hover:bg-[#eee7e3]"
                    }`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            type="button"
            style={{ backgroundColor: "#0c0a09", color: "#ffffff" }}
            className="btn-primary inline-flex items-center gap-2 bg-[#0c0a09] !text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-xs hover:bg-[#262626] transition-colors cursor-pointer shrink-0"
          >
            <svg
              className="w-4 h-4 !text-white stroke-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline strokeLinecap="round" strokeLinejoin="round" points="7 10 12 15 17 10" />
              <line strokeLinecap="round" strokeLinejoin="round" x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="!text-white font-semibold" style={{ color: "#ffffff" }}>
              Export CSV
            </span>
          </button>
        </div>
      </header>

      {/* Tabs matching defx-pos-frontend MenuReport.jsx: Sales by item / Sales by category */}
      <div className="border-b border-[#e9e1dd] flex items-center gap-6">
        <button
          type="button"
          onClick={() => {
            setReportBy("item");
            setItemPage(1);
          }}
          className={`pb-3 text-sm font-semibold transition-colors cursor-pointer relative ${
            reportBy === "item"
              ? "text-[#1e1b19]"
              : "text-[#7f7570] hover:text-[#1e1b19]"
          }`}
        >
          <span>Sales by item</span>
          {reportBy === "item" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1e1b19] rounded-full"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setReportBy("categories");
            setCategoryPage(1);
          }}
          className={`pb-3 text-sm font-semibold transition-colors cursor-pointer relative ${
            reportBy === "categories"
              ? "text-[#1e1b19]"
              : "text-[#7f7570] hover:text-[#1e1b19]"
          }`}
        >
          <span>Sales by category</span>
          {reportBy === "categories" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1e1b19] rounded-full"></span>
          )}
        </button>
      </div>

      {/* 4 Dynamic KPI Cards matching defx-pos-frontend MenuReport.jsx */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total items sold */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
              Total items sold
            </span>
            <svg className="w-4 h-4 text-[#7f7570]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : (totalItemSold === 0 ? "-" : totalItemSold)}
            </div>
            <div className="text-xs text-[#7f7570] mt-1">
              {reportBy === "item" ? "Units dispatched across catalog" : "Units grouped by category"}
            </div>
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-3 py-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19]"></span>
            <span className="text-[11px] text-[#1e1b19] tabular-nums font-medium">
              {reportBy === "item" ? `${salesByItem?.length || 0} unique items` : `${salesByCategory?.length || 0} categories`}
            </span>
          </div>
        </div>

        {/* Card 2: Top performing item / category */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold truncate" title={`Top performing ${reportBy === "item" ? "item" : "category"}`}>
              Top performing {reportBy === "item" ? "item" : "category"}
            </span>
            <svg className="w-4 h-4 text-[#1b873f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div>
            <div
              className="text-xl lg:text-2xl font-normal text-[#1e1b19] leading-tight truncate"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              title={String(topPerforming)}
            >
              {loading ? "..." : topPerforming}
            </div>
            <div className="text-xs text-[#7f7570] mt-1">Highest gross revenue contribution</div>
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-3 py-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1b873f]"></span>
            <span className="text-[11px] text-[#1e1b19] font-medium">Top Velocity</span>
          </div>
        </div>

        {/* Card 3: Least performing item / category */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold truncate" title={`Least performing ${reportBy === "item" ? "item" : "category"}`}>
              Least performing {reportBy === "item" ? "item" : "category"}
            </span>
            <svg className="w-4 h-4 text-[#7f7570]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
              <polyline points="17 18 23 18 23 12" />
            </svg>
          </div>
          <div>
            <div
              className="text-xl lg:text-2xl font-normal text-[#1e1b19] leading-tight truncate"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              title={String(leastPerforming)}
            >
              {loading ? "..." : leastPerforming}
            </div>
            <div className="text-xs text-[#7f7570] mt-1">Lowest volume contributor</div>
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-3 py-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#645d58]"></span>
            <span className="text-[11px] text-[#645d58] font-medium">Low Velocity</span>
          </div>
        </div>

        {/* Card 4: Avg item price item / category */}
        <div className="bg-white border border-[#e9e1dd] rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#1e1b19] font-bold truncate" title={`Avg item price ${reportBy === "item" ? "item" : "category"}`}>
              Avg item price {reportBy === "item" ? "item" : "category"}
            </span>
            <svg className="w-4 h-4 text-[#1e1b19]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div
              className="text-2xl lg:text-3xl font-normal text-[#1e1b19] tabular-nums leading-tight"
              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              {loading ? "..." : avgPrice}
            </div>
            <div className="text-xs text-[#7f7570] mt-1">
              {reportBy === "item" ? "Average item selling value" : "Mean ticket across categories"}
            </div>
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 bg-[#faf2ee] border border-[#e9e1dd] rounded-full px-3 py-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1e1b19]"></span>
            <span className="text-[11px] text-[#1e1b19] font-medium tabular-nums">Realized Average</span>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* VIEW A: SALES BY ITEM (Matches defx-pos-frontend)        */}
      {/* ======================================================== */}
      {reportBy === "item" && (
        <div className="space-y-6">
          {/* Table 1: Top Performing Items */}
          <section className="bg-white border border-[#e9e1dd] rounded-2xl p-6 shadow-xs">
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                High Velocity
              </span>
              <h2
                className="text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Top performing items
              </h2>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                    <th className="py-3 px-4 font-semibold">Item name</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold text-right">Item price</th>
                    <th className="py-3 px-4 font-semibold text-center">Units sold</th>
                    <th className="py-3 px-4 font-semibold text-right">Total sales</th>
                    <th className="py-3 px-4 font-semibold text-right">Sales percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
                  {salesByItem?.top_performing_items?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#7f7570]">
                        No sales recorded for this period yet.
                      </td>
                    </tr>
                  ) : (
                    salesByItem?.top_performing_items?.map((it, idx) => (
                      <tr key={idx} className="hover:bg-[#faf2ee] transition-colors">
                        <td className="py-3.5 px-4 font-medium text-[#1e1b19]">
                          {it.item_name}
                        </td>
                        <td className="py-3.5 px-4 text-[#645d58]">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[11px]">
                            {it.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#645d58]">
                          {it.item_price}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums font-semibold text-[#1e1b19]">
                          {it.units_sold}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#1e1b19]">
                          {it.total_sales}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#1b873f] font-semibold">
                          {it.sales_percentage}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Table 2: Least Performing Items */}
          <section className="bg-white border border-[#e9e1dd] rounded-2xl p-6 shadow-xs">
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Low Velocity
              </span>
              <h2
                className="text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Least performing items
              </h2>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                    <th className="py-3 px-4 font-semibold">Item name</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold text-right">Item price</th>
                    <th className="py-3 px-4 font-semibold text-center">Units sold</th>
                    <th className="py-3 px-4 font-semibold text-right">Total sales</th>
                    <th className="py-3 px-4 font-semibold text-right">Sales percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
                  {salesByItem?.least_performing_items?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#7f7570]">
                        No sales recorded for this period yet.
                      </td>
                    </tr>
                  ) : (
                    salesByItem?.least_performing_items?.map((it, idx) => (
                      <tr key={idx} className="hover:bg-[#faf2ee] transition-colors">
                        <td className="py-3.5 px-4 font-medium text-[#1e1b19]">
                          {it.item_name}
                        </td>
                        <td className="py-3.5 px-4 text-[#645d58]">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[11px]">
                            {it.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#645d58]">
                          {it.item_price}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums font-semibold text-[#1e1b19]">
                          {it.units_sold}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#1e1b19]">
                          {it.total_sales}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#645d58] font-semibold">
                          {it.sales_percentage}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Table 3: General Item Sales Table (with Pagination) */}
          <section className="bg-white border border-[#e9e1dd] rounded-2xl p-6 shadow-xs">
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Complete Catalog
              </span>
              <h2
                className="text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Sales by Item
              </h2>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                    <th className="py-3 px-4 font-semibold">Item name</th>
                    <th className="py-3 px-4 font-semibold text-right">Item price</th>
                    <th className="py-3 px-4 font-semibold text-right">Gross sales</th>
                    <th className="py-3 px-4 font-semibold text-center">Item sold</th>
                    <th className="py-3 px-4 font-semibold text-right">Tax collected</th>
                    <th className="py-3 px-4 font-semibold text-right">Net sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#7f7570]">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="text-2xl">📋</span>
                          <p className="font-medium text-sm text-[#1e1b19]">No Reports Available Yet</p>
                          <p className="text-xs text-[#7f7570]">Reports will appear once you start recording transactions.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((it, idx) => (
                      <tr key={idx} className="hover:bg-[#faf2ee] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-[#1e1b19]">
                          {it.item_name}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#645d58]">
                          {it.item_price}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#1e1b19]">
                          {it.gross_sales}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums">
                          <span className="px-2.5 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] font-medium text-[11px]">
                            {it.item_sold} units
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#645d58]">
                          {it.tax_collected}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#1e1b19]">
                          {it.net_sales}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(salesByItem?.table_data?.length || 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-[#e9e1dd] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#645d58]">
                <span>
                  Showing <strong className="text-[#1e1b19] font-semibold">{((itemPage - 1) * pageSize) + 1}–{Math.min(itemPage * pageSize, salesByItem.table_data.length)}</strong> of{" "}
                  <strong className="text-[#1e1b19] font-semibold">{salesByItem.table_data.length}</strong> items
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={itemPage === 1}
                    onClick={() => setItemPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalItemPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setItemPage(i + 1)}
                      style={itemPage === i + 1 ? { backgroundColor: "#0c0a09", color: "#ffffff" } : undefined}
                      className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        itemPage === i + 1
                          ? "bg-[#0c0a09] !text-white shadow-xs"
                          : "bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] hover:bg-[#eee7e3]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={itemPage === totalItemPages || totalItemPages === 0}
                    onClick={() => setItemPage((p) => Math.min(totalItemPages, p + 1))}
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
      {/* VIEW B: SALES BY CATEGORY (Matches defx-pos-frontend)    */}
      {/* ======================================================== */}
      {reportBy === "categories" && (
        <div className="space-y-6">
          {/* Category General Table matching defx-pos-frontend */}
          <section className="bg-white border border-[#e9e1dd] rounded-2xl p-6 shadow-xs">
            <div className="mb-4">
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Category Breakdown
              </span>
              <h2
                className="text-xl text-[#1e1b19] font-normal"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Sales by category
              </h2>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf2ee] text-[#645d58] text-[11px] uppercase tracking-wider border-b border-[#e9e1dd]">
                    <th className="py-3 px-4 font-semibold">Category name</th>
                    <th className="py-3 px-4 font-semibold text-center">Items sold</th>
                    <th className="py-3 px-4 font-semibold text-right">Gross sales</th>
                    <th className="py-3 px-4 font-semibold text-right">Tax collected</th>
                    <th className="py-3 px-4 font-semibold text-right">Net sales</th>
                    <th className="py-3 px-4 font-semibold text-right">Avg item price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4ece8] text-[#1e1b19] text-xs">
                  {paginatedCategories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#7f7570]">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="text-2xl">📋</span>
                          <p className="font-medium text-sm text-[#1e1b19]">No Reports Available Yet</p>
                          <p className="text-xs text-[#7f7570]">Reports will appear once you start recording transactions.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedCategories.map((c, idx) => (
                      <tr key={idx} className="hover:bg-[#faf2ee] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-[#1e1b19]">
                          {c.category_name}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums">
                          <span className="px-2.5 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] font-medium text-[11px]">
                            {c.items_sold} units
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#1e1b19]">
                          {c.gross_sales}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#645d58]">
                          {c.tax_collected}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-bold text-[#1e1b19]">
                          {c.net_sales}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#645d58]">
                          {c.avg_item_price}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(salesByCategory?.table_data?.length || 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-[#e9e1dd] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#645d58]">
                <span>
                  Showing <strong className="text-[#1e1b19] font-semibold">{((categoryPage - 1) * pageSize) + 1}–{Math.min(categoryPage * pageSize, salesByCategory.table_data.length)}</strong> of{" "}
                  <strong className="text-[#1e1b19] font-semibold">{salesByCategory.table_data.length}</strong> categories
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={categoryPage === 1}
                    onClick={() => setCategoryPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-full border border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#eee7e3] text-[#1e1b19] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalCategoryPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCategoryPage(i + 1)}
                      style={categoryPage === i + 1 ? { backgroundColor: "#0c0a09", color: "#ffffff" } : undefined}
                      className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                        categoryPage === i + 1
                          ? "bg-[#0c0a09] !text-white shadow-xs"
                          : "bg-[#faf2ee] border border-[#e9e1dd] text-[#1e1b19] hover:bg-[#eee7e3]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={categoryPage === totalCategoryPages || totalCategoryPages === 0}
                    onClick={() => setCategoryPage((p) => Math.min(totalCategoryPages, p + 1))}
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
