"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface TableItem {
  id: string;
  name: string;
  seats: number;
  placement?: string;
  status: "Active" | "Inactive" | "Pending QR";
  isGenerated: boolean;
  qrId?: string;
  qrUrl?: string;
  qrType?: string;
  scansToday?: number;
  avgDwellMinutes?: number;
}

interface QrPerformanceDashboardProps {
  tablesList: TableItem[];
  activeOrg: any;
  storeSlug: string;
  showToast: (msg: string) => void;
  onSelectTable?: (tableId: string) => void;
}

// Pixel-Perfect SVG Icons (PREST Theme)
function QrCodeScannerIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}

function DevicesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="12" rx="2" />
      <line x1="6" y1="20" x2="12" y2="20" />
      <rect x="14" y="8" width="8" height="12" rx="2" />
    </svg>
  );
}

function ReceiptLongIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="12" y2="14" />
    </svg>
  );
}

function CurrencyRupeeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12" />
      <path d="M6 8h12" />
      <path d="M6 13h3a4 4 0 0 0 0-8" />
      <path d="M9 13l6 8" />
    </svg>
  );
}

function PercentIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function ArrowUpwardIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
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

function RefreshIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function TableRestaurantIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2v20M18 2a4 4 0 0 0-4 4v4h4" />
      <path d="M6 2v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
      <path d="M8 11v11" />
    </svg>
  );
}

function TakeoutDiningIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h16l-1 10H5L4 10z" />
      <path d="M8 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
    </svg>
  );
}

function MopedIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="18" r="3" />
      <circle cx="19" cy="18" r="3" />
      <path d="M12 18V8l-4 4" />
      <path d="M9 4h5l3 7h4" />
    </svg>
  );
}

function PaymentsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
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

export function QrPerformanceDashboard({
  tablesList,
  activeOrg,
  storeSlug,
  showToast,
  onSelectTable,
}: QrPerformanceDashboardProps) {
  const [selectedChannel, setSelectedChannel] = useState<"all" | "dine-in" | "takeaway" | "delivery">("all");
  const [tableSearchQuery, setTableSearchQuery] = useState("");

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

  // Fetch real overall performance & paginated analytics from Convex backend using date bounds
  const overallPerformance = useQuery(
    api.organizationQrAnalytics.getOverallPerformance,
    activeOrg
      ? {
          outletId: activeOrg._id,
          from: fromDateStr,
          to: toDateStr,
          type: selectedChannel === "all" ? "ALL" : selectedChannel.toUpperCase(),
          timezone: activeOrg.organizationTimeZone || undefined,
        }
      : "skip"
  );

  const convexAnalyticsData = useQuery(
    api.organizationQrAnalytics.listPaginated,
    activeOrg ? { outletId: activeOrg._id } : "skip"
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
              bgClass = "bg-[#141010] text-white font-semibold rounded-full";
              textClass = "text-white";
            } else if (isInRange) {
              bgClass = "bg-[#e5e7eb] rounded-none";
              textClass = "text-[#0c0a09]";
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDateCellClick(cell.date)}
                className={`w-7 h-7 flex items-center justify-center mx-auto text-xs cursor-pointer transition-colors ${bgClass} ${textClass} ${
                  isToday && !isSelectedStart && !isSelectedEnd ? "border border-[#141010] font-bold" : ""
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

  // Strictly dynamic table rows calculated 100% from real tablesList / Convex data
  const telemetryTableRows = useMemo(() => {
    if (!tablesList || tablesList.length === 0) return [];

    return tablesList.map((t) => {
      const typeStr = (t.qrType || "DineIn").toLowerCase();
      let typeKey = "dine-in";
      let typeLabel = "Dine-in";
      if (typeStr.includes("takeaway")) {
        typeKey = "takeaway";
        typeLabel = "Takeaway";
      } else if (typeStr.includes("delivery")) {
        typeKey = "delivery";
        typeLabel = "Delivery";
      } else if (typeStr.includes("queue") || typeStr.includes("schedule")) {
        typeKey = "dine-in";
        typeLabel = "Schedule Pickup";
      }

      // Match real Convex performance row if present
      const matchingRow = overallPerformance?.rows?.find(
        (r: any) => (t.qrId && r.qrId === t.qrId) || r.name?.toLowerCase() === t.name?.toLowerCase()
      );

      const scans = matchingRow?.scans ?? (t.scansToday || 0);
      const sessions = matchingRow?.sessions ?? 0;
      const orders = matchingRow?.orders ?? 0;
      const revenue = matchingRow?.revenue ?? 0;
      const conversion = matchingRow?.conversion !== undefined ? `${matchingRow.conversion}%` : (sessions > 0 ? `${((orders / sessions) * 100).toFixed(1)}%` : "0.0%");

      return {
        id: t.id,
        name: t.name,
        type: typeLabel,
        zone: t.placement || (typeKey === "takeaway" ? "Counter Pickup" : typeKey === "delivery" ? "Dispatch Sticker" : "Store"),
        isInactive: t.status === "Inactive" || t.status === "Pending QR",
        isGenerated: Boolean(t.isGenerated),
        qrId: t.qrId,
        status: t.status,
        scans,
        sessions,
        orders,
        conversion,
        revenue,
        typeKey,
      };
    });
  }, [tablesList, overallPerformance]);

  // Compute aggregated metric statistics strictly from real live Convex data
  const stats = useMemo(() => {
    if (overallPerformance && overallPerformance.summary) {
      const s = overallPerformance.summary;
      const scanToSessionRate = s.scans > 0 ? ((s.sessions / s.scans) * 100).toFixed(1) : "0.0";
      const conversionRate = s.sessions > 0 ? ((s.orders / s.sessions) * 100).toFixed(1) : "0.0";
      const avgTicketVal = s.orders > 0 ? Math.round(s.revenue / s.orders) : 0;

      return {
        totalScans: s.scans || 0,
        totalSessions: s.sessions || 0,
        totalOrders: s.orders || 0,
        totalRevenue: s.revenue || 0,
        scanToSessionRate,
        conversionRate,
        avgTicketVal,
      };
    }

    let totalScans = 0;
    let totalSessions = 0;
    let totalOrders = 0;
    let totalRevenue = 0;

    telemetryTableRows.forEach((row) => {
      totalScans += row.scans;
      totalSessions += row.sessions;
      totalOrders += row.orders;
      totalRevenue += row.revenue;
    });

    const scanToSessionRate = totalScans > 0 ? ((totalSessions / totalScans) * 100).toFixed(1) : "0.0";
    const conversionRate = totalSessions > 0 ? ((totalOrders / totalSessions) * 100).toFixed(1) : "0.0";
    const avgTicketVal = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return {
      totalScans,
      totalSessions,
      totalOrders,
      totalRevenue,
      scanToSessionRate,
      conversionRate,
      avgTicketVal,
    };
  }, [overallPerformance, telemetryTableRows]);

  // Compute top performing items strictly from real table rows
  const topTiles = useMemo(() => {
    if (telemetryTableRows.length === 0) return null;

    const byRev = [...telemetryTableRows].sort((a, b) => b.revenue - a.revenue)[0];
    const byOrders = [...telemetryTableRows].sort((a, b) => b.orders - a.orders)[0];
    const byScans = [...telemetryTableRows].sort((a, b) => b.scans - a.scans)[0];
    const byConv = [...telemetryTableRows].sort((a, b) => parseFloat(b.conversion) - parseFloat(a.conversion))[0];

    return {
      highestRevenue: byRev && byRev.revenue > 0 ? byRev : null,
      mostOrders: byOrders && byOrders.orders > 0 ? byOrders : null,
      mostScans: byScans && byScans.scans > 0 ? byScans : null,
      highestConversion: byConv && parseFloat(byConv.conversion) > 0 ? byConv : null,
    };
  }, [telemetryTableRows]);

  // Compute Channel Share strictly from live tablesList
  const channelShare = useMemo(() => {
    let dineInScans = 0;
    let takeawayScans = 0;
    let deliveryScans = 0;

    telemetryTableRows.forEach((r) => {
      if (r.typeKey === "takeaway") takeawayScans += r.scans;
      else if (r.typeKey === "delivery") deliveryScans += r.scans;
      else dineInScans += r.scans;
    });

    const total = dineInScans + takeawayScans + deliveryScans;
    const dineInPct = total > 0 ? ((dineInScans / total) * 100).toFixed(1) : "0.0";
    const takeawayPct = total > 0 ? ((takeawayScans / total) * 100).toFixed(1) : "0.0";
    const deliveryPct = total > 0 ? ((deliveryScans / total) * 100).toFixed(1) : "0.0";

    const dineInCount = tablesList.filter((t) => !t.qrType || t.qrType.toLowerCase().includes("dinein")).length;

    return {
      dineInScans,
      takeawayScans,
      deliveryScans,
      dineInPct,
      takeawayPct,
      deliveryPct,
      dineInCount,
    };
  }, [telemetryTableRows, tablesList]);

  // Filtered rows based on selectedChannel and tableSearchQuery
  const filteredTableRows = useMemo(() => {
    return telemetryTableRows.filter((row) => {
      const matchesChannel = selectedChannel === "all" || row.typeKey === selectedChannel;
      const matchesSearch = !tableSearchQuery || row.name.toLowerCase().includes(tableSearchQuery.toLowerCase());
      return matchesChannel && matchesSearch;
    });
  }, [telemetryTableRows, selectedChannel, tableSearchQuery]);

  const handleExportCsv = () => {
    if (filteredTableRows.length === 0) {
      showToast("No data to export.");
      return;
    }
    const csvHeader = "QR Name,Type,Scans,Sessions,Orders,Conversion,Revenue\n";
    const csvRows = filteredTableRows
      .map((r) => `"${r.name}","${r.type}",${r.scans},${r.sessions},${r.orders},"${r.conversion}",${r.revenue}`)
      .join("\n");
    const blob = new Blob([csvHeader + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `QR_Performance_Report_${storeSlug}_${fromDateStr}_to_${toDateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Downloaded QR Performance Report CSV!");
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in pb-8 font-sans text-[#1c1b1b]">
      {/* 1. Top Header Bar with Channel Filter Tabs & Order Calendar Date Range Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#e7e5e4] pb-4 w-full min-w-0">
        <h1 className="font-garamond text-2xl sm:text-3xl font-normal text-[#141010] leading-tight shrink-0">
          QR Performance
        </h1>

        <div className="flex flex-wrap items-center justify-start md:justify-end gap-2.5 min-w-0">
          {/* Segmented Channel Tab Controls */}
          <div className="inline-flex p-1 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedChannel("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedChannel === "all" ? "bg-[#141010] text-white shadow-xs" : "text-[#5e5e5e] hover:text-[#141010]"
              }`}
              style={selectedChannel === "all" ? { backgroundColor: "#141010", color: "#ffffff" } : undefined}
            >
              All Channels
            </button>
            <button
              type="button"
              onClick={() => setSelectedChannel("dine-in")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedChannel === "dine-in" ? "bg-[#141010] text-white shadow-xs" : "text-[#5e5e5e] hover:text-[#141010]"
              }`}
              style={selectedChannel === "dine-in" ? { backgroundColor: "#141010", color: "#ffffff" } : undefined}
            >
              Dine-in
            </button>
            <button
              type="button"
              onClick={() => setSelectedChannel("takeaway")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedChannel === "takeaway" ? "bg-[#141010] text-white shadow-xs" : "text-[#5e5e5e] hover:text-[#141010]"
              }`}
              style={selectedChannel === "takeaway" ? { backgroundColor: "#141010", color: "#ffffff" } : undefined}
            >
              Takeaway
            </button>
            <button
              type="button"
              onClick={() => setSelectedChannel("delivery")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedChannel === "delivery" ? "bg-[#141010] text-white shadow-xs" : "text-[#5e5e5e] hover:text-[#141010]"
              }`}
              style={selectedChannel === "delivery" ? { backgroundColor: "#141010", color: "#ffffff" } : undefined}
            >
              Delivery
            </button>
          </div>

          {/* Order Calendar Popover Dropdown */}
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
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-[#e7e5e4] rounded-xl text-xs font-medium text-[#141010] hover:bg-[#fdf8f7] transition-colors focus:ring-1 focus:ring-[#141010] cursor-pointer shadow-2xs"
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
              <div className="absolute right-0 sm:right-0 top-full mt-2.5 bg-white border border-[#d1d5db] rounded-2xl shadow-2xl z-50 overflow-visible font-sans animate-fadeIn">
                {/* Top pointer notch arrow */}
                <div className="absolute right-8 top-1.5 w-3 h-3 bg-white border-t border-l border-[#d1d5db] rotate-45 z-10" />

                {/* Main section: Presets list + Dual calendar */}
                <div className="flex flex-row">
                  {/* Left Sidebar Presets */}
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

                  {/* Right Dual Calendar side-by-side */}
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

                {/* Bottom Footer Bar */}
                <div className="border-t border-[#e5e7eb] px-4 py-2.5 bg-white flex items-center justify-between rounded-b-2xl">
                  <div className="text-xs font-medium text-stone-700">
                    {formatDateDisplay(draftStartDate)} -{" "}
                    {formatDateDisplay(draftEndDate)}
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

      {/* 2. Top Primary Telemetric Bento Cards System (Horizontal Scrollable Container) */}
      <div className="flex flex-nowrap overflow-x-auto gap-4 w-full pb-2 [scrollbar-width:thin] [scrollbar-color:#e7e5e4_transparent]">
        {/* Card 1: Total Scans */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-3 min-w-[220px] flex-1 shrink-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Total Scans</span>
            <QrCodeScannerIcon className="w-4 h-4 text-[#141010] shrink-0" />
          </div>
          <div className="flex items-baseline justify-between mt-1 gap-2">
            <span className="font-garamond text-3xl sm:text-4xl font-normal text-[#141010]">{stats.totalScans.toLocaleString()}</span>
            <span className="font-mono text-xs font-semibold text-emerald-700 flex items-center gap-0.5 shrink-0">
              <ArrowUpwardIcon className="w-3.5 h-3.5" /> Live
            </span>
          </div>
          <div className="pt-2 bg-[#fdf8f7] rounded-xl px-3 py-2 border border-[#e7e5e4] flex items-center justify-between text-xs gap-1 min-w-0">
            <span className="text-[#5e5e5e] font-medium whitespace-nowrap">Scan to Session</span>
            <span className="font-mono font-bold text-[#141010] shrink-0 ml-1">{stats.scanToSessionRate}%</span>
          </div>
        </div>

        {/* Card 2: Total Sessions */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-3 min-w-[220px] flex-1 shrink-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Total Sessions</span>
            <DevicesIcon className="w-4 h-4 text-[#141010] shrink-0" />
          </div>
          <div className="flex items-baseline justify-between mt-1 gap-2">
            <span className="font-garamond text-3xl sm:text-4xl font-normal text-[#141010]">{stats.totalSessions.toLocaleString()}</span>
            <span className="font-mono text-xs font-semibold text-emerald-700 flex items-center gap-0.5 shrink-0">
              <ArrowUpwardIcon className="w-3.5 h-3.5" /> Live
            </span>
          </div>
          <div className="pt-2 bg-[#fdf8f7] rounded-xl px-3 py-2 border border-[#e7e5e4] flex items-center justify-between text-xs gap-1 min-w-0">
            <span className="text-[#5e5e5e] font-medium whitespace-nowrap">Active Terminals</span>
            <span className="font-mono font-bold text-[#141010] shrink-0 ml-1">{tablesList.length} Units</span>
          </div>
        </div>

        {/* Card 3: Total Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-3 min-w-[220px] flex-1 shrink-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Total Orders</span>
            <ReceiptLongIcon className="w-4 h-4 text-[#141010] shrink-0" />
          </div>
          <div className="flex items-baseline justify-between mt-1 gap-2">
            <span className="font-garamond text-3xl sm:text-4xl font-normal text-[#141010]">{stats.totalOrders.toLocaleString()}</span>
            <span className="font-mono text-xs font-semibold text-emerald-700 flex items-center gap-0.5 shrink-0">
              <ArrowUpwardIcon className="w-3.5 h-3.5" /> Live
            </span>
          </div>
          <div className="pt-2 bg-[#fdf8f7] rounded-xl px-3 py-2 border border-[#e7e5e4] flex items-center justify-between text-xs gap-1 min-w-0">
            <span className="text-[#5e5e5e] font-medium whitespace-nowrap">Avg Ticket Val</span>
            <span className="font-mono font-bold text-[#141010] shrink-0 ml-1">₹{stats.avgTicketVal}</span>
          </div>
        </div>

        {/* Card 4: Total Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-3 min-w-[220px] flex-1 shrink-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Total Revenue</span>
            <CurrencyRupeeIcon className="w-4 h-4 text-[#141010] shrink-0" />
          </div>
          <div className="flex flex-col mt-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-garamond text-3xl sm:text-4xl font-normal text-[#141010]">
                ₹{stats.totalRevenue > 100000 ? `${(stats.totalRevenue / 100000).toFixed(2)}L` : stats.totalRevenue.toLocaleString()}
              </span>
              <span className="font-mono text-xs font-semibold text-emerald-700 flex items-center gap-0.5 shrink-0">
                <ArrowUpwardIcon className="w-3.5 h-3.5" /> Live
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#5e5e5e]">₹{stats.totalRevenue.toLocaleString()} exact</span>
          </div>
          <div className="pt-2 bg-[#fdf8f7] rounded-xl px-3 py-2 border border-[#e7e5e4] flex items-center justify-between text-xs gap-1 min-w-0">
            <span className="text-[#5e5e5e] font-medium whitespace-nowrap">Settled via KDS</span>
            <span className="font-mono font-bold text-[#141010] shrink-0 ml-1">{stats.totalOrders > 0 ? "100%" : "0%"}</span>
          </div>
        </div>

        {/* Card 5: Overall Conversion */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-3 min-w-[220px] flex-1 shrink-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Overall Conversion</span>
            <PercentIcon className="w-4 h-4 text-[#141010] shrink-0" />
          </div>
          <div className="flex flex-col mt-1">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="font-garamond text-3xl sm:text-4xl font-medium text-emerald-700">{stats.conversionRate}%</span>
              <span className="font-mono text-[11px] text-[#5e5e5e] shrink-0">Sessions → Orders</span>
            </div>
          </div>
          <div className="w-full bg-[#f1edec] h-2 rounded-full overflow-hidden mt-2">
            <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, parseFloat(stats.conversionRate)))}%` }} />
          </div>
        </div>
      </div>

      {/* 3. Inline Visualization & Atmosphere Band (Chart + Service Distribution) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-stretch">
        {/* Session Funnel & Velocity Chart (2 cols) */}
        <div className="md:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-garamond text-xl font-normal text-[#141010]">Hourly QR Velocity & Order Trajectory</h2>
              <p className="text-xs text-[#5e5e5e] mt-0.5">Real-time scan versus settled order pipeline across current service shift.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-[#5e5e5e]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e7e5e4]" />
                <span>Scans</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#141010]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#141010]" />
                <span>Orders Settled</span>
              </div>
            </div>
          </div>

          {/* SVG Vector Spark-Bar Chart - 100% Dynamic Baseline */}
          <div className="w-full h-40 flex flex-col justify-end pt-2 relative">
            {stats.totalScans === 0 && stats.totalOrders === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#fdf8f7]/50 rounded-xl border border-dashed border-[#e7e5e4] z-10 p-4">
                <span className="text-xs font-semibold text-[#5e5e5e]">Zero scan velocity recorded during current shift period</span>
                <span className="text-[11px] text-[#8e8e8e] mt-0.5">Live baseline active — chart updates automatically upon customer scan</span>
              </div>
            ) : null}

            <svg className="w-full h-32 text-[#141010]" fill="none" preserveAspectRatio="none" viewBox="0 0 600 120">
              {/* Grid baseline hairlines */}
              <line stroke="#e7e5e4" strokeWidth="1" x1="0" x2="600" y1="110" y2="110" />
              <line stroke="#e7e5e4" strokeWidth="1" x1="0" x2="600" y1="60" y2="60" />
              <line stroke="#e7e5e4" strokeWidth="1" x1="0" x2="600" y1="10" y2="10" />

              {/* Baseline Zero Path */}
              <path d="M 20 110 L 580 110" stroke="#141010" strokeDasharray="3 3" strokeOpacity="0.4" strokeWidth="1.5" />

              {/* Dynamic 24-Hour Velocity Bars from Live Backend Database */}
              {overallPerformance?.summary?.hourlyScans && (
                <>
                  {overallPerformance.summary.hourlyScans.map((scanCnt: number, hr: number) => {
                    const orderCnt = overallPerformance.summary?.hourlyOrders?.[hr] || 0;
                    if (scanCnt === 0 && orderCnt === 0) return null;

                    const maxVal = Math.max(1, ...overallPerformance.summary.hourlyScans, ...(overallPerformance.summary.hourlyOrders || []));
                    const x = 20 + (hr / 23) * 560;

                    const scanHeight = Math.min(90, (scanCnt / maxVal) * 90);
                    const orderHeight = Math.min(90, (orderCnt / maxVal) * 90);

                    return (
                      <g key={hr}>
                        {scanCnt > 0 && (
                          <rect
                            x={x - 4}
                            y={110 - scanHeight}
                            width="4"
                            height={scanHeight}
                            fill="#e7e5e4"
                            rx="1"
                          />
                        )}
                        {orderCnt > 0 && (
                          <rect
                            x={x + 1}
                            y={110 - orderHeight}
                            width="4"
                            height={orderHeight}
                            fill="#141010"
                            rx="1"
                          />
                        )}
                      </g>
                    );
                  })}
                </>
              )}
            </svg>
          </div>

          <div className="relative w-full h-5 text-[#5e5e5e] font-mono text-[10px] font-semibold pt-1 border-t border-[#e7e5e4]/60 whitespace-nowrap overflow-hidden">
            {[
              { hr: 0, label: "00:00" },
              { hr: 4, label: "04:00" },
              { hr: 8, label: "08:00" },
              { hr: 12, label: "12:00" },
              { hr: 16, label: "16:00" },
              { hr: 18, label: "18:00" },
              { hr: 20, label: "20:00" },
              { hr: 23, label: "23:00" },
            ].map((tick) => {
              const pct = ((20 + (tick.hr / 23) * 560) / 600) * 100;
              return (
                <span
                  key={tick.hr}
                  className="absolute top-1 transform -translate-x-1/2"
                  style={{ left: `${pct}%` }}
                >
                  {tick.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Channel Share Service Distribution (1 col) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-4">
          <div className="flex justify-between items-center gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5e5e5e]">Service Distribution</span>
              <h3 className="font-garamond text-xl font-normal text-[#141010] mt-0.5">Channel Share</h3>
            </div>
            <span className="px-3 py-1.5 rounded-full bg-[#fdf8f7] text-xs font-semibold text-[#141010] border border-[#e7e5e4] whitespace-nowrap shrink-0 shadow-2xs">
              Live Split
            </span>
          </div>

          <div className="flex flex-col gap-3.5 my-auto">
            {/* Dine-In Share */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#141010] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#141010]" />
                  <span>Dine-in ({channelShare.dineInCount} Endpoints)</span>
                </span>
                <span className="font-mono font-bold text-[#141010]">{channelShare.dineInPct}%</span>
              </div>
              <div className="w-full bg-[#f1edec] h-2 rounded-full overflow-hidden">
                <div className="bg-[#141010] h-full rounded-full transition-all" style={{ width: `${channelShare.dineInPct}%` }} />
              </div>
            </div>

            {/* Takeaway Share */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#141010] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span>Takeaway Counter</span>
                </span>
                <span className="font-mono font-bold text-[#141010]">{channelShare.takeawayPct}%</span>
              </div>
              <div className="w-full bg-[#f1edec] h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${channelShare.takeawayPct}%` }} />
              </div>
            </div>

            {/* Delivery Share */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#141010] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  <span>Delivery Packaging</span>
                </span>
                <span className="font-mono font-bold text-[#141010]">{channelShare.deliveryPct}%</span>
              </div>
              <div className="w-full bg-[#f1edec] h-2 rounded-full overflow-hidden">
                <div className="bg-amber-600 h-full rounded-full transition-all" style={{ width: `${channelShare.deliveryPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Performance Summary Tiles (4 Grid Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Tile 1: Highest Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Highest Revenue</span>
            <PaymentsIcon className="w-4 h-4 text-[#141010] shrink-0" />
          </div>
          <div className="flex flex-col my-1">
            <span className="font-garamond text-xl font-normal text-[#141010] truncate">
              {topTiles?.highestRevenue ? topTiles.highestRevenue.name : "—"}
            </span>
            <span className="font-garamond text-3xl font-medium text-[#141010] mt-0.5">
              {topTiles?.highestRevenue ? `₹${topTiles.highestRevenue.revenue.toLocaleString()}` : "₹0"}
            </span>
          </div>
          <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-between text-xs gap-1 min-w-0">
            <span className="text-[#5e5e5e] font-medium truncate">Channel</span>
            <span className="font-mono font-bold text-[#141010] shrink-0">
              {topTiles?.highestRevenue ? topTiles.highestRevenue.type : "—"}
            </span>
          </div>
        </div>

        {/* Tile 2: Most Orders */}
        <div className="bg-white p-5 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Most Orders</span>
            <ReceiptLongIcon className="w-4 h-4 text-[#141010] shrink-0" />
          </div>
          <div className="flex flex-col my-1">
            <span className="font-garamond text-xl font-normal text-[#141010] truncate">
              {topTiles?.mostOrders ? topTiles.mostOrders.name : "—"}
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-garamond text-3xl font-medium text-[#141010]">
                {topTiles?.mostOrders ? topTiles.mostOrders.orders : 0}
              </span>
              <span className="text-xs text-[#5e5e5e] font-medium">settled orders</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-between text-xs gap-1 min-w-0">
            <span className="text-[#5e5e5e] font-medium truncate">Volume Share</span>
            <span className="font-mono font-bold text-[#141010] shrink-0">
              {topTiles?.mostOrders ? topTiles.mostOrders.type : "—"}
            </span>
          </div>
        </div>

        {/* Tile 3: Most Scans */}
        <div className="bg-white p-5 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Most Scans</span>
            <QrCodeScannerIcon className="w-4 h-4 text-[#141010] shrink-0" />
          </div>
          <div className="flex flex-col my-1">
            <span className="font-garamond text-xl font-normal text-[#141010] truncate">
              {topTiles?.mostScans ? topTiles.mostScans.name : "—"}
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-garamond text-3xl font-medium text-[#141010]">
                {topTiles?.mostScans ? topTiles.mostScans.scans : 0}
              </span>
              <span className="text-xs text-[#5e5e5e] font-medium">scans</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-between text-xs gap-1 min-w-0">
            <span className="text-[#5e5e5e] font-medium truncate">Scan Channel</span>
            <span className="font-mono font-bold text-[#141010] shrink-0">
              {topTiles?.mostScans ? topTiles.mostScans.type : "—"}
            </span>
          </div>
        </div>

        {/* Tile 4: Highest Conversion */}
        <div className="bg-white p-5 rounded-2xl border border-[#e7e5e4] shadow-xs flex flex-col justify-between gap-3 min-w-0">
          <div className="flex items-center justify-between text-[#5e5e5e]">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Highest Conversion</span>
            <PercentIcon className="w-4 h-4 text-[#141010] shrink-0" />
          </div>
          <div className="flex flex-col my-1">
            <span className="font-garamond text-xl font-normal text-[#141010] truncate">
              {topTiles?.highestConversion ? topTiles.highestConversion.name : "—"}
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-garamond text-3xl font-medium text-emerald-700">
                {topTiles?.highestConversion ? topTiles.highestConversion.conversion : "0.0%"}
              </span>
              <span className="text-xs text-[#5e5e5e] font-medium">checkout rate</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-between text-xs gap-1 min-w-0">
            <span className="text-[#5e5e5e] font-medium truncate">Orders Ratio</span>
            <span className="font-mono font-bold text-[#141010] shrink-0">
              {topTiles?.highestConversion ? `${topTiles.highestConversion.orders} ord` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Table & Channel Telemetry (DISPLAYED LAST AT THE BOTTOM) */}
      <div className="w-full bg-white rounded-2xl shadow-xs border border-[#e7e5e4] overflow-hidden flex flex-col">
        {/* Header Bar inside Table Card with Export CSV button on the right */}
        <div className="px-5 py-4 bg-[#fdf8f7] border-b border-[#e7e5e4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="font-garamond text-xl font-normal text-[#141010]">Table & Channel Telemetry</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#f1edec] border border-[#e7e5e4] font-mono text-[11px] font-semibold text-[#141010]">
              {filteredTableRows.length} Endpoints
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              placeholder="Filter by endpoint..."
              className="bg-white px-3.5 py-1.5 rounded-xl border border-[#e7e5e4] text-xs font-medium text-[#141010] placeholder:text-[#5e5e5e] focus:outline-none focus:border-[#141010] transition-colors"
            />
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#141010] hover:bg-[#2d2622] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              style={{ backgroundColor: "#141010", color: "#ffffff" }}
            >
              <DownloadIcon className="w-3.5 h-3.5 text-white" />
              <span className="text-white font-bold whitespace-nowrap" style={{ color: "#ffffff" }}>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Tabular Data Block */}
        <div className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#fdf8f7] text-[#5e5e5e] border-b border-[#e7e5e4] text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3.5 pl-5 px-4 text-left min-w-[160px]">QR / Table</th>
                <th className="py-3.5 px-4 text-left min-w-[120px]">Type</th>
                <th className="py-3.5 px-4 text-center min-w-[70px]">Scans</th>
                <th className="py-3.5 px-4 text-center min-w-[70px]">Sessions</th>
                <th className="py-3.5 px-4 text-center min-w-[70px]">Orders</th>
                <th className="py-3.5 px-4 text-center min-w-[100px]">Conversion</th>
                <th className="py-3.5 px-4 text-right min-w-[90px]">Revenue</th>
                <th className="py-3.5 pr-5 pl-4 text-center min-w-[130px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e5e4] text-xs font-medium text-[#141010]">
              {filteredTableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-[#5e5e5e]">
                    No registered QR telemetry endpoints found matching current search/filter.
                  </td>
                </tr>
              ) : (
                filteredTableRows.map((row) => (
                  <tr key={row.id} className={`hover:bg-[#fdf8f7]/70 transition-colors ${row.isInactive ? "opacity-75" : ""}`}>
                    <td className="py-4 pl-5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        {row.typeKey === "takeaway" ? (
                          <TakeoutDiningIcon className="w-4 h-4 text-[#5e5e5e] shrink-0" />
                        ) : row.typeKey === "delivery" ? (
                          <MopedIcon className="w-4 h-4 text-[#5e5e5e] shrink-0" />
                        ) : (
                          <TableRestaurantIcon className="w-4 h-4 text-[#5e5e5e] shrink-0" />
                        )}
                        <span className="font-garamond text-base font-semibold text-[#141010]">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-[#f1edec] text-[#141010] text-[11px] font-bold border border-[#e7e5e4] whitespace-nowrap inline-flex">
                          {row.type}
                        </span>
                        {row.isInactive && (
                          <span className="px-2 py-0.5 rounded bg-[#f5f5f5] text-[#5e5e5e] text-[10px] font-bold uppercase whitespace-nowrap">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center font-mono text-xs">{row.scans}</td>
                    <td className="py-4 px-4 text-center font-mono text-xs">{row.sessions}</td>
                    <td className="py-4 px-4 text-center font-mono text-xs">{row.orders}</td>
                    <td className="py-4 px-4 text-center font-mono text-xs font-bold text-emerald-700">{row.conversion}</td>
                    <td className="py-4 px-4 text-right font-mono text-xs font-bold text-[#141010]">₹{row.revenue.toLocaleString()}</td>
                    <td className="py-4 pr-5 pl-4 text-center whitespace-nowrap">
                      {(() => {
                        const isAnalyticsAvailable = Boolean(
                          row.isGenerated &&
                            row.qrId &&
                            row.status === "Active" &&
                            !row.isInactive
                        );

                        return (
                          <button
                            type="button"
                            disabled={!isAnalyticsAvailable}
                            onClick={() => {
                              if (!isAnalyticsAvailable) {
                                showToast(
                                  "Analytics unavailable: QR code is not generated or endpoint is inactive."
                                );
                                return;
                              }
                              if (onSelectTable) {
                                onSelectTable(row.id);
                              } else {
                                showToast(`Opened analytics detail for ${row.name}`);
                              }
                            }}
                            title={
                              isAnalyticsAvailable
                                ? "View detailed analytics"
                                : "Analytics unavailable: QR code is not generated or endpoint is inactive"
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              isAnalyticsAvailable
                                ? "bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] cursor-pointer"
                                : "bg-[#f5f5f4] text-[#a8a29e] opacity-60 cursor-not-allowed"
                            }`}
                          >
                            View Analytics
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Sub-summary bar */}
        <div className="px-5 py-3 bg-[#fdf8f7] border-t border-[#e7e5e4] flex flex-col sm:flex-row items-center justify-between text-xs text-[#5e5e5e] font-medium gap-2">
          <span className="font-mono text-[11px]">Displaying {filteredTableRows.length} of {telemetryTableRows.length} active registered endpoints</span>
          <div className="flex items-center gap-4">
            <span>Sort: Default (Table ID)</span>
            <span className="font-mono text-[11px] text-[#141010] font-semibold">
              Total: {filteredTableRows.reduce((acc, r) => acc + r.orders, 0)} Orders
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
