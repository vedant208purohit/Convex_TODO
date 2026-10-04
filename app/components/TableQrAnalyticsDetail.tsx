"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DynamicQrCode } from "./DynamicQrCode";

interface TableItem {
  id: string;
  name: string;
  seats: number;
  placement?: string;
  status: "Active" | "Inactive" | "Pending QR";
  isGenerated: boolean;
  qrId?: string;
  qrUrl?: string;
  scansToday?: number;
  avgDwellMinutes?: number;
}

interface TableQrAnalyticsDetailProps {
  table: TableItem;
  storeSlug: string;
  onBack: () => void;
  showToast: (msg: string) => void;
}

// Icons
function ArrowLeftIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function DownloadIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function InfoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function CalendarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

// Order Calendar Date Helpers
function formatDateDisplay(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
] as const;

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getPresetDateRange(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const today = getStartOfDay(now);
  if (preset === "Today") {
    return { start: today, end: today };
  }
  if (preset === "Yesterday") {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    return { start: y, end: y };
  }
  if (preset === "Last 7 Days") {
    const past = new Date(today);
    past.setDate(today.getDate() - 6);
    return { start: past, end: today };
  }
  if (preset === "Last 30 Days") {
    const past = new Date(today);
    past.setDate(today.getDate() - 29);
    return { start: past, end: today };
  }
  if (preset === "This Month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start, end: today };
  }
  if (preset === "Last Month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start, end };
  }
  return { start: today, end: today };
}

const DATE_RANGE_OPTIONS = [
  "Today",
  "Yesterday",
  "Last 7 Days",
  "Last 30 Days",
  "This Month",
  "Last Month",
  "Custom Range",
] as const;

export function TableQrAnalyticsDetail({
  table,
  storeSlug,
  onBack,
  showToast,
}: TableQrAnalyticsDetailProps) {
  // Applied Date Filter
  const [appliedPreset, setAppliedPreset] = useState<string>("Today");
  const [appliedStartDate, setAppliedStartDate] = useState<Date>(() => getPresetDateRange("Today").start);
  const [appliedEndDate, setAppliedEndDate] = useState<Date>(() => getPresetDateRange("Today").end);

  // Draft Date Filter (while popover is open)
  const [draftPreset, setDraftPreset] = useState<string>("Today");
  const [draftStartDate, setDraftStartDate] = useState<Date>(() => getPresetDateRange("Today").start);
  const [draftEndDate, setDraftEndDate] = useState<Date>(() => getPresetDateRange("Today").end);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(e.target as Node)
      ) {
        setIsDateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formattedDateRangeText = useMemo(() => {
    return `${formatDateDisplay(appliedStartDate)} - ${formatDateDisplay(appliedEndDate)}`;
  }, [appliedStartDate, appliedEndDate]);

  const toLocalIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const fromDateStr = useMemo(() => toLocalIso(appliedStartDate), [appliedStartDate]);
  const toDateStr = useMemo(() => toLocalIso(appliedEndDate), [appliedEndDate]);

  // Fetch real analytics strictly from Convex backend DB with date filtering
  const rawAnalytics = useQuery(
    api.organizationQrAnalytics.getIndividualAnalytics,
    table.qrId && table.qrId.length > 5
      ? {
          qrId: table.qrId as any,
          from: fromDateStr,
          to: toDateStr,
        }
      : "skip"
  );

  // Date Range Popover Handlers
  const handleOpenDateDropdown = () => {
    setDraftPreset(appliedPreset);
    setDraftStartDate(new Date(appliedStartDate));
    setDraftEndDate(new Date(appliedEndDate));
    setViewMonth(new Date(appliedStartDate.getFullYear(), appliedStartDate.getMonth(), 1));
    setIsDateDropdownOpen(true);
  };

  const handlePresetClick = (preset: string) => {
    setDraftPreset(preset);
    if (preset !== "Custom Range") {
      const { start, end } = getPresetDateRange(preset);
      setDraftStartDate(start);
      setDraftEndDate(end);
      setViewMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    }
  };

  const handleNavigateMonth = (direction: -1 | 1) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const handleDateCellClick = (clickedDate: Date) => {
    const normClicked = getStartOfDay(clickedDate);
    const normStart = getStartOfDay(draftStartDate);
    const normEnd = getStartOfDay(draftEndDate);

    if (normStart.getTime() === normEnd.getTime()) {
      if (normClicked.getTime() < normStart.getTime()) {
        setDraftStartDate(normClicked);
        setDraftEndDate(normStart);
      } else {
        setDraftEndDate(normClicked);
      }
    } else {
      setDraftStartDate(normClicked);
      setDraftEndDate(normClicked);
    }
    setDraftPreset("Custom Range");
  };

  const handleApplyDate = () => {
    setAppliedPreset(draftPreset);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setIsDateDropdownOpen(false);
  };

  const handleCancelDate = () => {
    setIsDateDropdownOpen(false);
  };

  // Download QR Code Action
  const handleDownloadQr = () => {
    if (!table) {
      showToast("No valid table QR selected.");
      return;
    }

    if (table.qrUrl && typeof window !== "undefined") {
      window.open(table.qrUrl, "_blank");
    }

    const qrContainer = document.getElementById(`qr-display-${table.id}`);
    const svgElement =
      qrContainer?.querySelector("svg") ||
      document.querySelector(`#qr-display-${table.id} svg`);

    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = svgUrl;
      downloadLink.download = `${table.name.replace(/\s+/g, "_")}_QR.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(svgUrl);
      showToast(`Downloaded vector SVG for ${table.name}!`);
    } else if (table.qrUrl) {
      if (typeof window !== "undefined") {
        window.open(table.qrUrl, "_blank");
      }
      showToast(`Opened digital route for ${table.name} in new tab!`);
    } else {
      window.print();
    }
  };

  // Compute metrics STRICTLY from real database records (0 default if no activity recorded)
  const metrics = useMemo(() => {
    if (rawAnalytics) {
      return {
        scans: rawAnalytics.scans || 0,
        sessions: rawAnalytics.sessions || 0,
        carts: rawAnalytics.carts || 0,
        orders: rawAnalytics.orders || 0,
        revenue: rawAnalytics.revenue || 0,
        sessionConversion: rawAnalytics.sessionConversion || 0,
        cartConversion: rawAnalytics.cartConversion || 0,
        orderConversion: rawAnalytics.orderConversion || 0,
        cartToOrderConversion: rawAnalytics.cartToOrderConversion || 0,
        peakTime: rawAnalytics.peakTime && rawAnalytics.peakTime !== "N/A" ? rawAnalytics.peakTime : "No Orders Yet",
        topItems: rawAnalytics.topItems
          ? rawAnalytics.topItems.map((item) => ({ name: item.name, orders: item.quantity }))
          : [],
        ordersByTime: rawAnalytics.ordersByTime || [],
        avgSessionMinutes: rawAnalytics.avgSessionMinutes ?? 0,
        avgSessionMinutesDisplay: rawAnalytics.avgSessionMinutesDisplay || "0 min",
        avgGuests: rawAnalytics.avgGuests !== undefined ? rawAnalytics.avgGuests : (table.seats || "N/A"),
      };
    }

    return {
      scans: table.scansToday || 0,
      sessions: 0,
      carts: 0,
      orders: 0,
      revenue: 0,
      sessionConversion: 0,
      cartConversion: 0,
      orderConversion: 0,
      cartToOrderConversion: 0,
      peakTime: "No Orders Yet",
      topItems: [],
      ordersByTime: [],
      avgSessionMinutes: 0,
      avgSessionMinutesDisplay: "0 min",
      avgGuests: table.seats || "N/A",
    };
  }, [rawAnalytics, table]);

  // Dynamic Store Operating Hours (2-Hour Interval Steps to prevent label crowding)
  const hourlyData = useMemo(() => {
    const hours = [
      { label: "12A", hourStart: 0, hourEnd: 1 },
      { label: "2A", hourStart: 2, hourEnd: 3 },
      { label: "4A", hourStart: 4, hourEnd: 5 },
      { label: "6A", hourStart: 6, hourEnd: 7 },
      { label: "8A", hourStart: 8, hourEnd: 9 },
      { label: "10A", hourStart: 10, hourEnd: 11 },
      { label: "12P (Lunch)", hourStart: 12, hourEnd: 13 },
      { label: "2P", hourStart: 14, hourEnd: 15 },
      { label: "4P", hourStart: 16, hourEnd: 17 },
      { label: "6P (Dinner)", hourStart: 18, hourEnd: 19 },
      { label: "8P", hourStart: 20, hourEnd: 21 },
      { label: "10P", hourStart: 22, hourEnd: 23 },
    ];

    const map: Record<number, number> = {};
    if (metrics.ordersByTime && metrics.ordersByTime.length > 0) {
      metrics.ordersByTime.forEach((item: any) => {
        map[item.hour] = item.orders;
      });
    }

    let maxVal = 0;
    hours.forEach((h) => {
      const count = (map[h.hourStart] || 0) + (map[h.hourEnd] || 0);
      if (count > maxVal) maxVal = count;
    });

    return hours.map((h) => {
      const count = (map[h.hourStart] || 0) + (map[h.hourEnd] || 0);
      const height = maxVal > 0 && count > 0 ? `${Math.round((count / maxVal) * 100)}%` : "4%";
      const isPeak = maxVal > 0 && count === maxVal;
      return {
        hour: h.label,
        count,
        height,
        isPeak,
      };
    });
  }, [metrics.ordersByTime]);

  const renderMonthCalendar = (
    year: number,
    month: number,
    isFirstMonth: boolean,
    isLastMonth: boolean,
  ) => {
    const monthName = MONTH_NAMES[month];
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      date: Date;
      isCurrentMonth: boolean;
      dayNum: number;
    }> = [];

    // Prev month trailing days
    for (let i = 0; i < firstDayOfWeek; i++) {
      const dayNum = daysInPrevMonth - firstDayOfWeek + 1 + i;
      cells.push({
        date: new Date(year, month - 1, dayNum),
        isCurrentMonth: false,
        dayNum,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
        dayNum: i,
      });
    }

    // Next month leading days
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        dayNum: i,
      });
    }

    const startNorm = getStartOfDay(draftStartDate).getTime();
    const endNorm = getStartOfDay(draftEndDate).getTime();

    return (
      <div className="w-56 font-sans">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-2">
          {isFirstMonth ? (
            <button
              type="button"
              onClick={() => handleNavigateMonth(-1)}
              className="p-1 hover:bg-[#f1edec] rounded text-[#5e5e5e] hover:text-[#141010] cursor-pointer"
            >
              &lt;
            </button>
          ) : (
            <div className="w-6" />
          )}

          <div className="text-xs font-semibold text-[#0c0a09]">
            {monthName} {year}
          </div>

          {isLastMonth ? (
            <button
              type="button"
              onClick={() => handleNavigateMonth(1)}
              className="p-1 hover:bg-[#f1edec] rounded text-[#5e5e5e] hover:text-[#141010] cursor-pointer"
            >
              &gt;
            </button>
          ) : (
            <div className="w-6" />
          )}
        </div>

        {/* Day Labels */}
        <div className="grid grid-cols-7 text-center text-[10px] font-medium text-[#7a716b] mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7 gap-y-0.5 text-center text-xs">
          {cells.map((cell, idx) => {
            const time = getStartOfDay(cell.date).getTime();
            const isSelectedStart = time === startNorm;
            const isSelectedEnd = time === endNorm;
            const isInRange = time >= startNorm && time <= endNorm;
            const isToday = isSameDay(cell.date, new Date());

            let bgClass = "hover:bg-[#f1edec]";
            let textClass = cell.isCurrentMonth ? "text-[#0c0a09]" : "text-[#b0a8a0]";

            if (isSelectedStart || isSelectedEnd) {
              bgClass = "bg-[#141010] text-white rounded-md font-bold";
              textClass = "text-white";
            } else if (isInRange) {
              bgClass = "bg-[#f1edec]";
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDateCellClick(cell.date)}
                className={`h-7 w-full flex items-center justify-center text-xs transition-colors cursor-pointer ${bgClass} ${textClass} ${
                  isToday && !isInRange ? "underline font-bold text-[#141010]" : ""
                }`}
              >
                {cell.dayNum}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-transparent text-[#141010] font-sans flex flex-col gap-5 p-1 sm:p-2 lg:p-3 min-w-0">
      {/* Top Header Row */}
      <div className="w-full bg-white rounded-2xl shadow-xs border border-[#e7e5e4] p-5 flex flex-col gap-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer group whitespace-nowrap"
          >
            <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to QR Management</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#141010] hover:bg-[#2d2622] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: "#141010", color: "#ffffff" }}
            >
              <DownloadIcon className="w-3.5 h-3.5 text-white" />
              <span className="text-white font-bold" style={{ color: "#ffffff" }}>Download QR</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#e7e5e4]/60 min-w-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Real Scannable QR Code Vector element */}
            <div
              id={`qr-display-${table.id}`}
              className="shrink-0 bg-white p-1.5 border border-[#e7e5e4] rounded-xl shadow-2xs w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center overflow-hidden"
              title="Scannable Table QR Code"
            >
              <DynamicQrCode
                value={
                  table.qrUrl && table.qrUrl.includes("store=")
                    ? table.qrUrl
                    : table.qrUrl
                      ? `${table.qrUrl}${table.qrUrl.includes("?") ? "&" : "?"}store=${encodeURIComponent(storeSlug)}`
                      : `${process.env.NEXT_PUBLIC_DIGITAL_STORE_BASE_URL || "https://dev-pos-user.get-prest.com/store"}?store=${encodeURIComponent(storeSlug)}&qr_id=${table.qrId || table.id}&type=DineIn&qr_name=${encodeURIComponent(table.name)}`
                }
                size={80}
              />
            </div>

            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h1 className="font-garamond text-xl sm:text-2xl lg:text-3xl font-medium text-[#141010] tracking-tight whitespace-nowrap truncate">
                  {table.name} — QR Analytics
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#fdf8f7] text-[#141010] border border-[#e7e5e4] whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {table.status}
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#5e5e5e] flex items-center gap-2 mt-0.5 whitespace-nowrap truncate">
                <span>{table.seats} Seats</span>
                <span>·</span>
                <span className="text-[#141010] font-semibold">{table.placement || "Indoor"}</span>
                <span>·</span>
                <span className="font-mono text-[10px] text-[#5e5e5e]">Store: {storeSlug}</span>
              </p>
            </div>
          </div>

          {/* Dual Calendar Order Date Range Filter Dropdown Popover */}
          <div className="relative shrink-0" ref={dateDropdownRef}>
            <button
              type="button"
              onClick={() => {
                if (isDateDropdownOpen) {
                  setIsDateDropdownOpen(false);
                } else {
                  handleOpenDateDropdown();
                }
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#e7e5e4] rounded-xl text-xs font-medium text-[#141010] hover:bg-[#fdf8f7] transition-colors focus:ring-1 focus:ring-[#141010] cursor-pointer shadow-2xs"
            >
              <CalendarIcon className="w-4 h-4 text-[#5e5e5e]" />
              <span className="font-semibold text-xs text-[#141010]">
                {formattedDateRangeText}
              </span>
              <ChevronDownIcon
                className={`w-3.5 h-3.5 text-[#5e5e5e] ml-1 transition-transform duration-150 ${
                  isDateDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isDateDropdownOpen && (
              <div className="absolute right-0 top-full mt-2.5 bg-white border border-[#d1d5db] rounded-2xl shadow-2xl z-50 overflow-visible font-sans animate-fadeIn">
                <div className="absolute right-8 top-1.5 w-3 h-3 bg-white border-t border-l border-[#d1d5db] rotate-45 z-10" />
                <div className="flex flex-row">
                  <div className="w-36 border-r border-[#e5e7eb] py-2 flex flex-col bg-white shrink-0">
                    {DATE_RANGE_OPTIONS.map((preset) => {
                      const isSelected = draftPreset === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handlePresetClick(preset)}
                          className={`w-full text-left px-4 py-2 text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#141010] text-white font-semibold"
                              : "text-stone-800 hover:bg-stone-100 font-normal"
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-4 flex flex-row gap-6 bg-white">
                    {renderMonthCalendar(
                      viewMonth.getFullYear(),
                      viewMonth.getMonth(),
                      true,
                      false,
                    )}
                    {renderMonthCalendar(
                      new Date(
                        viewMonth.getFullYear(),
                        viewMonth.getMonth() + 1,
                        1,
                      ).getFullYear(),
                      new Date(
                        viewMonth.getFullYear(),
                        viewMonth.getMonth() + 1,
                        1,
                      ).getMonth(),
                      false,
                      true,
                    )}
                  </div>
                </div>

                <div className="border-t border-[#e5e7eb] px-4 py-2.5 bg-white flex items-center justify-between rounded-b-2xl">
                  <div className="text-xs font-medium text-stone-700">
                    {formatDateDisplay(draftStartDate)} - {formatDateDisplay(draftEndDate)}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleCancelDate}
                      className="px-4 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyDate}
                      className="px-5 py-1.5 text-xs font-semibold text-white bg-[#141010] hover:bg-[#262626] rounded-md transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: TOP SUMMARY (4 MAIN CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
        {/* QR SCANS */}
        <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between hover:border-[#141010] transition-colors min-w-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">QR SCANS</span>
          </div>
          <div className="mt-3 flex flex-col">
            <span className="font-garamond text-3xl sm:text-4xl font-normal text-[#141010] tracking-tight">{metrics.scans.toLocaleString()}</span>
            <span className="text-xs text-[#5e5e5e] font-medium mt-1 whitespace-nowrap">Times QR was scanned</span>
          </div>
        </div>

        {/* SESSIONS */}
        <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between hover:border-[#141010] transition-colors min-w-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">SESSIONS</span>
          </div>
          <div className="mt-3 flex flex-col">
            <span className="font-garamond text-3xl sm:text-4xl font-normal text-[#141010] tracking-tight">{metrics.sessions.toLocaleString()}</span>
            <span className="text-xs text-[#5e5e5e] font-medium mt-1 whitespace-nowrap">Ordering sessions started</span>
            <div className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 text-[11px] font-bold px-2.5 py-1 rounded-full mt-2 w-fit whitespace-nowrap border border-emerald-200">
              <span>{metrics.sessionConversion}% of scans</span>
            </div>
          </div>
        </div>

        {/* ORDERS */}
        <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between hover:border-[#141010] transition-colors min-w-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">ORDERS</span>
          </div>
          <div className="mt-3 flex flex-col">
            <span className="font-garamond text-3xl sm:text-4xl font-normal text-[#141010] tracking-tight">{metrics.orders.toLocaleString()}</span>
            <span className="text-xs text-[#5e5e5e] font-medium mt-1 whitespace-nowrap">Orders placed from QR</span>
            <div className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 text-[11px] font-bold px-2.5 py-1 rounded-full mt-2 w-fit whitespace-nowrap border border-emerald-200">
              <span>{metrics.orderConversion}% conversion</span>
            </div>
          </div>
        </div>

        {/* REVENUE */}
        <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between hover:border-[#141010] transition-colors min-w-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">REVENUE</span>
          </div>
          <div className="mt-3 flex flex-col">
            <span className="font-garamond text-3xl sm:text-4xl font-normal text-[#141010] tracking-tight">
              ₹{metrics.revenue.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-[#5e5e5e] font-medium mt-1 whitespace-nowrap">Completed order sales</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: CUSTOMER JOURNEY FUNNEL (4-STEP) */}
      <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col gap-4 min-w-0">
        <div>
          <h2 className="font-garamond text-xl sm:text-2xl font-medium text-[#141010]">Customer Journey</h2>
          <p className="text-xs text-[#5e5e5e] mt-0.5">See how customers move from scanning the QR to placing an order.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
          {/* Step 1 */}
          <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col justify-between gap-3 min-w-0">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#5e5e5e] uppercase">1. QR Scans</span>
              <span className="font-garamond text-3xl font-normal text-[#141010]">{metrics.scans.toLocaleString()}</span>
              <span className="text-xs text-[#5e5e5e] truncate">Times QR was scanned</span>
            </div>
            <div className="w-full bg-[#e7e5e4] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#141010] h-full rounded-full" style={{ width: metrics.scans > 0 ? "100%" : "0%" }} />
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col justify-between gap-3 min-w-0">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#5e5e5e] uppercase">2. Sessions</span>
              <span className="font-garamond text-3xl font-normal text-[#141010]">{metrics.sessions.toLocaleString()}</span>
              <span className="text-xs text-[#5e5e5e] truncate">Sessions started</span>
            </div>
            <div>
              <div className="w-full bg-[#e7e5e4] h-1.5 rounded-full overflow-hidden mb-1">
                <div className="bg-[#141010] h-full rounded-full" style={{ width: `${metrics.sessionConversion}%` }} />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">{metrics.sessionConversion}% of scans</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col justify-between gap-3 min-w-0">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#5e5e5e] uppercase">3. Cart Created</span>
              <span className="font-garamond text-3xl font-normal text-[#141010]">{metrics.carts.toLocaleString()}</span>
              <span className="text-xs text-[#5e5e5e] truncate">Items added to cart</span>
            </div>
            <div>
              <div className="w-full bg-[#e7e5e4] h-1.5 rounded-full overflow-hidden mb-1">
                <div className="bg-[#141010] h-full rounded-full" style={{ width: `${metrics.cartConversion}%` }} />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">{metrics.cartConversion}% of sessions</span>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col justify-between gap-3 min-w-0">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#5e5e5e] uppercase">4. Order Placed</span>
              <span className="font-garamond text-3xl font-normal text-[#141010]">{metrics.orders.toLocaleString()}</span>
              <span className="text-xs text-[#5e5e5e] truncate">Placed orders</span>
            </div>
            <div>
              <div className="w-full bg-[#e7e5e4] h-1.5 rounded-full overflow-hidden mb-1">
                <div className="bg-[#141010] h-full rounded-full" style={{ width: `${metrics.cartToOrderConversion}%` }} />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">{metrics.cartToOrderConversion}% of carts</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: 2-COLUMN BALANCED GRID (TABLE USAGE & ORDER PERFORMANCE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 min-w-0">
        {/* Table Usage */}
        <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col gap-4 min-w-0">
          <div>
            <h2 className="font-garamond text-xl sm:text-2xl font-medium text-[#141010] whitespace-nowrap">Table Usage</h2>
            <p className="text-xs text-[#5e5e5e] mt-0.5 whitespace-nowrap">How customers use {table.name}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
            <div className="p-3.5 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col justify-between gap-1.5 min-w-0">
              <div className="flex items-center justify-between min-w-0">
                <span className="text-[10px] font-bold text-[#5e5e5e] uppercase truncate">Avg Session</span>
              </div>
              <div className="min-w-0">
                <span className="font-garamond text-xl lg:text-2xl font-normal text-[#141010] block whitespace-nowrap">
                  {metrics.avgSessionMinutesDisplay || (metrics.avgSessionMinutes > 0 ? `${metrics.avgSessionMinutes} min` : "0 min")}
                </span>
                <span className="text-[10px] text-[#5e5e5e] block truncate">Start to end time</span>
              </div>
            </div>

            <div className="p-3.5 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col justify-between gap-1.5 min-w-0">
              <div className="flex items-center justify-between min-w-0">
                <span className="text-[10px] font-bold text-[#5e5e5e] uppercase truncate">Avg Guests</span>
              </div>
              <div className="min-w-0">
                <span className="font-garamond text-xl lg:text-2xl font-normal text-[#141010] block whitespace-nowrap">
                  {metrics.avgGuests === "N/A" ? "N/A" : (typeof metrics.avgGuests === "number" && metrics.avgGuests > 0 ? metrics.avgGuests : (table.seats || "0"))}
                </span>
                <span className="text-[10px] text-[#5e5e5e] block truncate">Guests per session</span>
              </div>
            </div>

            <div className="p-3.5 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col justify-between gap-1.5 min-w-0">
              <div className="flex items-center justify-between min-w-0">
                <span className="text-[10px] font-bold text-[#5e5e5e] uppercase truncate">Peak Time</span>
              </div>
              <div className="min-w-0">
                <span className="font-garamond text-base sm:text-lg font-medium text-[#141010] block truncate" title={metrics.peakTime}>
                  {metrics.peakTime === "No Orders Yet" ? "None yet" : metrics.peakTime}
                </span>
                <span className="text-[10px] text-[#8d4b00] font-semibold block truncate">Most order volume</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Performance */}
        <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col gap-4 min-w-0">
          <div>
            <h2 className="font-garamond text-xl sm:text-2xl font-medium text-[#141010] whitespace-nowrap">Order Performance</h2>
            <p className="text-xs text-[#5e5e5e] mt-0.5 whitespace-nowrap">Summary of orders and sales from this QR</p>
          </div>

          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="p-3.5 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col gap-0.5 min-w-0">
              <span className="text-[10px] font-bold text-[#5e5e5e] uppercase">Orders</span>
              <span className="font-garamond text-2xl font-normal text-[#141010]">{metrics.orders.toLocaleString()}</span>
              <span className="text-[11px] text-[#5e5e5e]">Completed orders</span>
            </div>

            <div className="p-3.5 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col gap-0.5 min-w-0">
              <span className="text-[10px] font-bold text-[#5e5e5e] uppercase">Revenue</span>
              <span className="font-garamond text-2xl font-normal text-[#141010]">₹{metrics.revenue.toLocaleString("en-IN")}</span>
              <span className="text-[11px] text-[#5e5e5e]">Completed order sales</span>
            </div>

            <div className="p-3.5 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#5e5e5e] uppercase">Avg Order</span>
              </div>
              <span className="font-garamond text-2xl font-normal text-[#141010]">
                ₹{metrics.orders > 0 ? Math.round(metrics.revenue / metrics.orders) : 0}
              </span>
              <span className="text-[11px] text-[#5e5e5e]">Amount spent per order</span>
            </div>

            <div className="p-3.5 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex flex-col gap-0.5 min-w-0">
              <span className="text-[10px] font-bold text-[#5e5e5e] uppercase">Top Item</span>
              <div className="flex items-baseline gap-1 mt-0.5 truncate">
                <span className="font-garamond text-base sm:text-lg font-medium text-[#141010] truncate">
                  {metrics.topItems.length > 0 ? metrics.topItems[0].name : "None yet"}
                </span>
                {metrics.topItems.length > 0 && (
                  <span className="text-[11px] text-[#5e5e5e] shrink-0">({metrics.topItems[0].orders} orders)</span>
                )}
              </div>
              <span className="text-[11px] text-[#5e5e5e] truncate">Item ordered most often</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: 2-COLUMN BALANCED GRID (ORDERS BY TIME & TOP ORDERED ITEMS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6 min-w-0">
        {/* Orders by Time Bar Chart (2-Hour Interval Gaps spanning Operating Hours) */}
        <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div>
              <h2 className="font-garamond text-xl sm:text-2xl font-medium text-[#141010] whitespace-nowrap">Orders by Time</h2>
              <p className="text-xs text-[#5e5e5e] mt-0.5 whitespace-nowrap">When customers place orders across operating shift</p>
            </div>
            <span className="px-2.5 py-1 bg-[#fdf8f7] text-[#141010] border border-[#e7e5e4] rounded-full text-[10px] font-bold uppercase whitespace-nowrap">
              Peak: {metrics.peakTime === "No Orders Yet" ? "None" : metrics.peakTime}
            </span>
          </div>

          <div className="w-full flex flex-col gap-2 pt-2 min-w-0">
            <div className="h-36 w-full flex items-end justify-between gap-2 px-1">
              {hourlyData.map((bar) => (
                <div key={bar.hour} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end min-w-0">
                  {bar.isPeak && bar.count > 0 && (
                    <span className="font-mono text-[10px] text-[#141010] font-bold">{bar.count}</span>
                  )}
                  <div
                    className={`w-full max-w-[28px] rounded-t-md transition-all ${
                      bar.isPeak && bar.count > 0 ? "bg-[#141010] shadow-xs" : "bg-[#f1edec] hover:bg-[#e7e5e4]"
                    }`}
                    style={{ height: bar.height }}
                  />
                  <span className={`text-[10px] font-mono whitespace-nowrap ${bar.isPeak && bar.count > 0 ? "text-[#141010] font-bold" : "text-[#5e5e5e]"}`}>
                    {bar.hour}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Ordered Items List */}
        <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between min-w-0">
          <div className="flex flex-col gap-4 min-w-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-garamond text-xl sm:text-2xl font-medium text-[#141010] whitespace-nowrap">Top Ordered Items</h2>
              </div>
              <p className="text-xs text-[#5e5e5e] mt-0.5 whitespace-nowrap">Items ordered most often from {table.name}</p>
            </div>

            {metrics.topItems.length > 0 ? (
              <div className="flex flex-col gap-2.5 min-w-0">
                {metrics.topItems.map((item, idx) => (
                  <div key={item.name} className="p-3 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex items-center justify-between min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`font-mono text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          idx === 0 ? "bg-[#141010] text-white" : "bg-[#f1edec] text-[#5e5e5e]"
                        }`}
                        style={idx === 0 ? { backgroundColor: "#141010", color: "#ffffff" } : undefined}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-sm font-bold text-[#141010] truncate">{item.name}</span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#141010] shrink-0">{item.orders} orders</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs font-semibold text-[#5e5e5e] bg-[#fdf8f7] rounded-xl border border-dashed border-[#e7e5e4]">
                No items ordered from this QR code yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
