"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { PosShell } from "../components/PosShell";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// ==========================================
// PIXEL-PERFECT SVG ICONS (PREST THEME)
// ==========================================

function CalendarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
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

function ChevronRightIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ExportIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SortIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function CheckmarkIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        clipRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        fillRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function PrintIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="6 9 6 2 18 2 18 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="6" y="14" width="12" height="8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeftIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentTextIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CreditCardIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefundIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M16 15v-1a4 4 0 00-4-4H4m0 0l3-3m-3 3l3 3m5 4v1a3 3 0 003 3h6a3 3 0 003-3V7a3 3 0 00-3-3h-6a3 3 0 00-3 3v1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TimelineIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDateDisplay(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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

function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
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

export default function OrdersPage() {
  // Query Organization
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  // Query Real Store Order Processes from DB
  const dbProcesses = useQuery(api.organizationOrderProcesses.list, { published: true });

  // Query Real Store Payment Modes from DB
  const paymentModesList = useQuery(
    api.paymentModes.list,
    activeOrg ? { organizationId: activeOrg._id } : {}
  );

  // Filter States
  const [activeStage, setActiveStage] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");

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
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setIsDateDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formattedDateRangeText = useMemo(() => {
    return `${formatDateDisplay(appliedStartDate)} - ${formatDateDisplay(appliedEndDate)}`;
  }, [appliedStartDate, appliedEndDate]);

  const [sortField, setSortField] = useState<"createdAt" | "totalAmount">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected Order Detail View & Unified Drawer States
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [drawerTab, setDrawerTab] = useState<"pay" | "timeline" | "refund" | null>(null);
  const [paymentTenderMode, setPaymentTenderMode] = useState<"Cash" | "UPI QR" | "Card / POS" | "Split">("Cash");
  const [tenderCashGiven, setTenderCashGiven] = useState("");
  const [refundPaymentMode, setRefundPaymentMode] = useState<"Cash" | "UPI / Instant" | "Card Return">("Cash");
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // Notification Toast
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  // Reset pagination to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedStartDate, appliedEndDate, activeStage, searchQuery, priceFrom, priceTo]);

  // Backend Queries & Mutations
  const ordersResponse = useQuery(
    api.orders.listOrders,
    activeOrg
      ? {
          organizationId: activeOrg._id,
          startDate: getStartOfDay(appliedStartDate).getTime(),
          endDate: getEndOfDay(appliedEndDate).getTime(),
          stage: activeStage !== "All" ? activeStage : undefined,
          search: searchQuery.trim() || undefined,
          minPrice: priceFrom ? Math.round(parseFloat(priceFrom) * 100) : undefined,
          maxPrice: priceTo ? Math.round(parseFloat(priceTo) * 100) : undefined,
          page: currentPage,
          pageSize,
        }
      : "skip"
  );

  const selectedOrderDetails = useQuery(
    api.orders.getOrderDetails,
    selectedOrderId ? { id: selectedOrderId } : "skip"
  );

  const addPaymentMutation = useMutation(api.orders.addOrderPayment);
  const cancelOrderMutation = useMutation(api.orders.cancelOrder);

  // Live Gross Total Calculation from actual database orders matching the selected filter
  const totalGrossSales = useMemo(() => {
    if (ordersResponse?.totalGrossAmount === undefined || ordersResponse.totalGrossAmount === null) return "₹0.00";
    return `₹${(ordersResponse.totalGrossAmount / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [ordersResponse]);

  // Real Status Pipeline Stages matching defx-pos & defx-pos-frontend
  const pipelineStages = useMemo(() => {
    const stages: Array<{ id: string; name: string; color: string; isSequence: boolean }> = [
      { id: "all", name: "All", color: "#141010", isSequence: false },
    ];

    if (dbProcesses && dbProcesses.length > 0) {
      for (const p of dbProcesses) {
        stages.push({
          id: p._id,
          name: p.name,
          color: p.processColor || (p.name.toLowerCase().includes("ready") ? "#FC8019" : p.name.toLowerCase().includes("deliver") ? "#219653" : "#EA9C1B"),
          isSequence: p.isSequence,
        });
      }
    } else {
      // Standard fallback matching defx-pos default seed
      stages.push(
        { id: "accepted", name: "Accepted", color: "#262626", isSequence: true },
        { id: "in_progress", name: "In progress", color: "#EA9C1B", isSequence: true },
        { id: "ready", name: "Ready to deliver", color: "#FC8019", isSequence: true },
        { id: "delivered", name: "Delivered", color: "#219653", isSequence: true },
        { id: "cancelled", name: "Cancelled", color: "#e11d48", isSequence: false }
      );
    }

    return stages;
  }, [dbProcesses]);

  // Dynamic status count map calculated directly from live database orders for the selected period
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: ordersResponse?.statusCounts?.All ?? ordersResponse?.totalCount ?? 0 };

    if (ordersResponse?.statusCounts) {
      for (const [key, val] of Object.entries(ordersResponse.statusCounts)) {
        if (key === "All") continue;
        for (const stage of pipelineStages) {
          if (stage.name === "All") continue;
          if (stage.name.trim().toLowerCase() === key.trim().toLowerCase()) {
            counts[stage.name] = (counts[stage.name] || 0) + val;
          }
        }
      }
    }

    return counts;
  }, [ordersResponse, pipelineStages]);

  // Displayed orders from backend query
  const displayedOrders = useMemo(() => {
    if (!ordersResponse?.orders) return [];
    const list = [...ordersResponse.orders];

    // Sort
    list.sort((a, b) => {
      const valA = sortField === "createdAt" ? a.createdAt : a.totalAmount;
      const valB = sortField === "createdAt" ? b.createdAt : b.totalAmount;
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    return list;
  }, [ordersResponse, sortField, sortOrder]);

  const totalOrdersCount = ordersResponse?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalOrdersCount / pageSize));
  const startOrderCount = totalOrdersCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endOrderCount = totalOrdersCount === 0 ? 0 : Math.min(totalOrdersCount, (currentPage - 1) * pageSize + displayedOrders.length);

  const toggleSort = (field: "createdAt" | "totalAmount") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const showToast = (msg: string) => {
    setNotificationMessage(msg);
    setTimeout(() => setNotificationMessage(null), 3500);
  };

  // Date Range Popover Handlers
  const handleOpenDateDropdown = () => {
    setDraftPreset(appliedPreset);
    setDraftStartDate(new Date(appliedStartDate));
    setDraftEndDate(new Date(appliedEndDate));
    setViewMonth(new Date(appliedStartDate.getFullYear(), appliedStartDate.getMonth(), 1));
    setIsDateDropdownOpen(true);
    setIsStatusDropdownOpen(false);
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
    isLastMonth: boolean
  ) => {
    const monthName = MONTH_NAMES[month];
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: Array<{ date: Date; isCurrentMonth: boolean; dayNum: number }> = [];

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

    // Next month leading days to complete grid (up to 42 cells)
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
              bgClass = "bg-[#0c0a09] text-white font-semibold rounded-full";
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
                  isToday && !isSelectedStart && !isSelectedEnd ? "border border-[#0c0a09] font-bold" : ""
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

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!displayedOrders || displayedOrders.length === 0) {
      showToast("No orders available to export.");
      return;
    }

    const headers = [
      "Order Number",
      "Token",
      "Status",
      "Customer Name",
      "Customer Phone",
      "Order Type",
      "Payment Status",
      "Total Amount (INR)",
      "Created At",
    ];

    const rows = displayedOrders.map((o) => [
      `"${o.orderNumber}"`,
      `"${o.tokenNumber}"`,
      `"${o.orderStatusName || "Accepted"}"`,
      `"${o.customerName || "Walk-in"}"`,
      `"${o.customerPhone || ""}"`,
      `"${o.orderType}"`,
      `"${o.paymentStatus}"`,
      `"${o.display_total_amount}"`,
      `"${new Date(o.createdAt).toLocaleString("en-IN")}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Export completed. CSV file downloaded.");
  };

  // Payment Settlement Handler
  const handleSettlePayment = async () => {
    if (!selectedOrderId || !selectedOrderDetails) return;
    try {
      const amountPaise = selectedOrderDetails.totalAmount;
      await addPaymentMutation({
        orderId: selectedOrderId,
        paymentModeName: paymentTenderMode,
        paymentType: "Credit",
        amount: amountPaise,
        transactionReference: `POS-PAY-${Date.now().toString().slice(-6)}`,
      });
      setDrawerTab(null);
      setTenderCashGiven("");
      showToast(`Payment of ₹${selectedOrderDetails.display_total_amount} via ${paymentTenderMode} recorded successfully.`);
    } catch (err: any) {
      showToast(err.message || "Failed to record payment");
    }
  };

  // Refund Submission Handler
  const handleIssueRefund = async () => {
    if (!selectedOrderId || !selectedOrderDetails) return;
    const amountVal = parseFloat(refundAmountInput || selectedOrderDetails.display_total_amount || "0");
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast("Please enter a valid refund amount");
      return;
    }
    try {
      await addPaymentMutation({
        orderId: selectedOrderId,
        paymentModeName: refundPaymentMode,
        paymentType: "Debit",
        amount: Math.round(amountVal * 100),
        transactionReference: `REFUND-${Date.now().toString().slice(-6)}`,
      });
      setDrawerTab(null);
      setRefundAmountInput("");
      showToast(`Refund of ₹${amountVal.toFixed(2)} processed successfully via ${refundPaymentMode}.`);
    } catch (err: any) {
      showToast(err.message || "Failed to process refund");
    }
  };

  // Confirm Delete Order
  const handleConfirmDeleteOrder = async () => {
    if (!selectedOrderId || !selectedOrderDetails) return;
    try {
      setIsDeletingOrder(true);
      await cancelOrderMutation({
        orderId: selectedOrderId,
        reason: "Deleted by admin from Order Details",
      });
      setIsDeleteDialogOpen(false);
      showToast(`Order ${selectedOrderDetails.orderNumber} deleted successfully.`);
      setSelectedOrderId(null);
    } catch (err: any) {
      showToast(err.message || "Failed to delete order");
    } finally {
      setIsDeletingOrder(false);
    }
  };

  // Print Thermal Receipt
  const handlePrintReceipt = () => {
    showToast("Receipt sent to paired thermal POS printer.");
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Download PDF Receipt (Opens formatted receipt in a new tab)
  const handleDownloadPDF = () => {
    if (!selectedOrderDetails) return;
    showToast("Opening order receipt PDF in a new tab...");

    const order = selectedOrderDetails;
    const orderCreatedDate = order?.createdAt ? new Date(order.createdAt) : new Date();
    const formattedOrderDate = formatDateDisplay(orderCreatedDate);
    const formattedOrderTime = orderCreatedDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receipt - ${order.orderNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f7f5f3;
      color: #000;
      padding: 40px 20px;
    }
    .receipt-container {
      max-width: 760px;
      margin: 0 auto;
      background: #fff;
      padding: 48px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
    .header .meta { font-size: 13px; color: #4b5563; line-height: 1.5; }
    .header .meta strong { color: #111; }
    .logo-badge {
      width: 44px;
      height: 44px;
      background: #000;
      color: #fff;
      border-radius: 6px;
      font-size: 22px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: auto;
      margin-bottom: 4px;
    }
    .store-name-top { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #111; text-align: right; }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      font-size: 13px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .details-col strong { color: #000; font-size: 14px; }
    .details-col p { margin-top: 3px; color: #4b5563; line-height: 1.4; }
    .details-right { text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    th {
      border-bottom: 2px solid #e5e7eb;
      padding: 10px 8px;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      color: #4b5563;
    }
    td {
      padding: 12px 8px;
      border-bottom: 1px solid #f3f4f6;
    }
    .text-right { text-align: right; }
    .item-name { font-weight: 600; color: #111; }
    .item-custom { font-size: 11px; color: #6b7280; font-style: italic; margin-top: 2px; }
    .summary-box {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 32px;
    }
    .summary-table { width: 280px; font-size: 13px; color: #4b5563; }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .summary-row.total {
      border-top: 2px solid #111;
      margin-top: 8px;
      padding-top: 8px;
      font-size: 16px;
      font-weight: 700;
      color: #000;
    }
    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .action-bar {
      max-width: 760px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn {
      background: #0c0a09;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt-container { box-shadow: none; padding: 0; max-width: 100%; border-radius: 0; }
      .action-bar { display: none !important; }
      @page { size: A4; margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="receipt-container">
    <div class="header">
      <div>
        <h1>Receipt</h1>
        <div class="meta">
          <p><strong>Receipt Number:</strong> ${order.orderNumber}</p>
          <p><strong>Date:</strong> ${formattedOrderDate} ${formattedOrderTime} IST</p>
        </div>
      </div>
      <div>
        <div class="logo-badge">P</div>
        <p class="store-name-top">${activeOrg?.name || "PREST POS"}</p>
      </div>
    </div>

    <div class="details-grid">
      <div class="details-col">
        <strong>${activeOrg?.name || "Store Location"}</strong>
        <p>${activeOrg?.address || "Main Street, Ground Floor, Commercial Arcade"}</p>
        <p style="margin-top: 8px;"><span style="color: #6b7280;">Legal Entity:</span> ${activeOrg?.name || "Prest Retail Corp"}</p>
        <p><span style="color: #6b7280;">GSTIN:</span> UNREGISTERED</p>
        <p><span style="color: #6b7280;">FSSAI:</span> UNREGISTERED</p>
      </div>
      <div class="details-col details-right">
        <strong>${order.customerName || "Walk-in Patron"}</strong>
        <p>${order.customerPhone || "+91 98200 12345"}</p>
        ${order.customerEmail ? `<p>${order.customerEmail}</p>` : ""}
        <p style="margin-top: 8px;"><strong>Type:</strong> ${order.orderType || "DineIn"}${order.table ? ` • Table ${order.table.number}` : ""}</p>
        <p><strong>Payment Mode:</strong> ${order.paymentMode || "Cash"}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Particulars</th>
          <th class="text-right">Gross value</th>
          <th class="text-right">Net value</th>
          <th class="text-right">Taxes (₹)</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${(order.items || []).map((item: any) => `
          <tr>
            <td>
              <div class="item-name">${item.quantity} x ${item.itemName}</div>
              ${item.customizations && item.customizations.length > 0 ? `
                <div class="item-custom">${item.customizations.map((c: any) => c.optionName).join(", ")}</div>
              ` : ""}
            </td>
            <td class="text-right">₹${item.display_item_price}</td>
            <td class="text-right">₹${item.display_item_price}</td>
            <td class="text-right">₹${((parseFloat(item.display_total_price) * 0.05) || 0).toFixed(2)}</td>
            <td class="text-right" style="font-weight: 600; color: #000;">₹${item.display_total_price}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="summary-box">
      <div class="summary-table">
        <div class="summary-row">
          <span>Sub Total:</span>
          <span style="font-weight: 600; color: #000;">₹${order.display_sub_total || "0.00"}</span>
        </div>
        <div class="summary-row">
          <span>GST (Tax Total):</span>
          <span style="font-weight: 600; color: #000;">₹${order.display_tax_total || "0.00"}</span>
        </div>
        ${parseFloat(order.display_discount_amount || "0") > 0 ? `
          <div class="summary-row" style="color: #059669;">
            <span>Discount:</span>
            <span style="font-weight: 600;">-₹${order.display_discount_amount}</span>
          </div>
        ` : ""}
        <div class="summary-row total">
          <span>Total:</span>
          <span>₹${order.display_total_amount || "0.00"}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Thanks for your business. Please contact us if you have any questions.</p>
    </div>
  </div>
</body>
</html>`;

    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(receiptHtml);
      newWindow.document.close();
    }
  };

  // =========================================================================
  // VIEW RENDER: ORDER DETAILS SCREEN (WHEN selectedOrderId IS NOT NULL)
  // =========================================================================
  if (selectedOrderId) {
    const order = selectedOrderDetails;
    const orderCreatedDate = order?.createdAt ? new Date(order.createdAt) : new Date();
    const formattedOrderDate = formatDateDisplay(orderCreatedDate);
    const formattedOrderTime = orderCreatedDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const isPaid = order?.paymentStatus === "Paid";

    return (
      <PosShell title={order ? `Order ${order.orderNumber}` : "Order Details"}>
        {/* Toast Notification Banner */}
        {notificationMessage && (
          <div className="fixed top-6 right-6 z-50 bg-[#0c0a09] text-white px-5 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-slideDown font-sans">
            <CheckmarkIcon className="w-4 h-4 text-emerald-400" />
            <span>{notificationMessage}</span>
          </div>
        )}

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#fdf8f7] font-sans">
          {/* Top Breadcrumb & Actions Bar */}
          <div className="bg-[#fdf8f7] px-6 lg:px-8 py-6 border-b border-[#e7e5e4] shrink-0">
            <div className="flex flex-col md:flex-row md:items-end justify-between w-full gap-4">
              <div>
                <nav aria-label="Breadcrumb" className="flex items-center text-[13px] text-[#5e5e5e] mb-2 gap-2 font-sans font-medium">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(null)}
                    className="hover:text-[#141010] transition-colors cursor-pointer"
                  >
                    Orders
                  </button>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
                  <span className="text-[#141010] font-semibold">
                    {order?.orderNumber || "Order Details"}
                  </span>
                </nav>
                <h1 className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight">
                  Order {order?.orderNumber || "Loading..."}
                </h1>
                <p className="text-[#5e5e5e] text-[14px] mt-1">
                  View transaction details, line items, customer info, and manage order actions.
                </p>
              </div>

              {/* Quick Action Buttons in Top Header */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrderId(null)}
                  className="h-10 px-5 border border-[#e7e5e4] rounded-full text-[#141010] hover:bg-[#f1edec] transition-colors font-medium text-sm bg-white cursor-pointer inline-flex items-center gap-2 shadow-2xs"
                >
                  <ArrowLeftIcon className="w-4 h-4 text-[#5e5e5e]" />
                  <span>Back to Orders</span>
                </button>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>{order?.orderStatusName || "Live Order Status"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Scrollable Workspace */}
          <main className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-[1600px] mx-auto space-y-6">
              {/* BEGIN: MetadataStrip */}
              <section className="bg-white border border-[#e7e5e4] rounded-xl p-4 lg:px-6 shadow-xs" data-purpose="order-metadata-strip">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-[#e7e5e4]">
                  <div className="pt-2 sm:pt-0 sm:pr-4">
                    <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">Order #</span>
                    <span className="text-xs font-semibold text-[#0c0a09]">{order?.orderNumber || "-"}</span>
                  </div>
                  <div className="pt-2 sm:pt-0 sm:px-4">
                    <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">Token #</span>
                    <span className="text-xs font-semibold text-[#0c0a09]">{order?.tokenNumber || "-"}</span>
                  </div>
                  <div className="pt-2 sm:pt-0 sm:px-4">
                    <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">Order Type</span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-[#f1edec] text-[#0c0a09]">
                      {order?.orderType || "DineIn"}
                    </span>
                  </div>
                  <div className="pt-2 sm:pt-0 sm:px-4">
                    <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">Order Status</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-600" /> {order?.orderStatusName || "Accepted"}
                    </span>
                  </div>
                  <div className="pt-2 sm:pt-0 sm:px-4">
                    <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">Date</span>
                    <span className="text-xs font-semibold text-[#0c0a09]">{formattedOrderDate}</span>
                  </div>
                  <div className="pt-2 sm:pt-0 sm:px-4">
                    <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">Time</span>
                    <span className="text-xs font-semibold text-[#0c0a09]">{formattedOrderTime}</span>
                  </div>
                  <div className="pt-2 sm:pt-0 sm:px-4">
                    <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">Source</span>
                    <span className="text-xs font-semibold text-[#0c0a09]">{order?.orderSource || "Prest Cashier"}</span>
                  </div>
                  <div className="pt-2 sm:pt-0 sm:pl-4">
                    <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">Table</span>
                    <span className="text-xs font-semibold text-[#0c0a09] truncate block" title={order?.table ? `Table ${order.table.number}` : "N/A"}>
                      {order?.table ? `Table ${order.table.number}` : "Counter / Takeaway"}
                    </span>
                  </div>
                </div>
              </section>
              {/* END: MetadataStrip */}

              {/* BEGIN: TwoColumnLayout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: 65% (8 Cols) */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Card 1: Customer & Address Details */}
                  <section className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-xs" data-purpose="customer-card">
                    <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3 mb-4">
                      <h2 className="text-[20px] font-semibold text-[#0c0a09] flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-[#7a716b]" />
                        Customer & Address Details
                      </h2>
                      <span className="text-[11px] uppercase font-semibold tracking-wider text-[#7a716b]">
                        {order?.customerName ? "Registered Patron" : "Guest Customer"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <span className="block text-[11px] font-semibold text-[#7a716b] tracking-wider uppercase">Customer Name</span>
                        <p className="text-sm font-semibold text-[#0c0a09] mt-0.5">{order?.customerName || "Walk-in Customer"}</p>
                        <p className="text-xs text-[#8c7662] mt-0.5">{order?.customerName ? "Patron Member" : "Direct Guest"}</p>
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold text-[#7a716b] tracking-wider uppercase">Contact Phone</span>
                        <p className="text-sm font-semibold text-[#0c0a09] mt-0.5">{order?.customerPhone || "+91 98200 12345"}</p>
                      </div>
                      <div>
                        <span className="block text-[11px] font-semibold text-[#7a716b] tracking-wider uppercase">Email Address</span>
                        <p className="text-sm text-[#0c0a09] mt-0.5">{order?.customerEmail || "customer@example.com"}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3.5 border-t border-[#e7e5e4] flex items-center justify-between bg-[#fdf8f7]/60 -mx-6 -mb-6 px-6 py-3 rounded-b-xl">
                      <div className="flex items-center gap-2 text-xs text-[#0c0a09]">
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-[#7a716b]">
                          {order?.orderType === "Delivery" ? "Delivery Address:" : "Dine-In Note:"}
                        </span>
                        <span className="font-medium">
                          {order?.deliveryAddress
                            ? `${order.deliveryAddress.addressLine1}, ${order.deliveryAddress.city || ""}`
                            : order?.table
                            ? `Table ${order.table.number} (Ground Floor)`
                            : "Standard Counter Pickup"}
                        </span>
                      </div>
                      <div className="text-xs text-[#7a716b]">
                        Assigned Captain: <span className="font-semibold text-[#0c0a09]">Johan Coder</span>
                      </div>
                    </div>
                  </section>

                  {/* Card 2: Ordered Items Details */}
                  <section className="bg-white rounded-xl border border-[#e7e5e4] shadow-xs overflow-hidden" data-purpose="items-table-card">
                    <div className="p-6 pb-4 border-b border-[#e7e5e4] flex items-center justify-between">
                      <div>
                        <h2 className="text-[20px] font-semibold text-[#0c0a09] flex items-center gap-2">
                          <DocumentTextIcon className="w-4 h-4 text-[#7a716b]" />
                          Ordered Items Details
                        </h2>
                        <p className="text-xs text-[#7a716b] mt-0.5">Manage line-items, modify selections, and adjust order quantities.</p>
                      </div>
                      <span className="text-xs font-semibold bg-[#f1edec] text-[#0c0a09] px-2.5 py-1 rounded">
                        {order?.items?.length || 0} Unique Items
                      </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse" id="order-items-table">
                        <thead>
                          <tr className="bg-[#faf8f5] border-b border-[#e7e5e4] text-[11px] font-semibold uppercase tracking-wider text-[#7a716b]">
                            <th className="py-3 px-6" scope="col">Items</th>
                            <th className="py-3 px-4 text-right" scope="col">Price</th>
                            <th className="py-3 px-4 text-center" scope="col">Qty</th>
                            <th className="py-3 px-6 text-right" scope="col">Sub Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e7e5e4] text-sm">
                          {order?.items && order.items.length > 0 ? (
                            order.items.map((item: any, idx: number) => (
                              <tr key={idx} className="hover:bg-[#fdfcf9] transition-colors">
                                <td className="py-3.5 px-6">
                                  <span className="font-semibold text-[#0c0a09] block">{item.itemName}</span>
                                  {item.customizations && item.customizations.length > 0 && (
                                    <span className="text-xs text-[#7a716b] italic block mt-0.5">
                                      {item.customizations
                                        .map((c: any) => `${c.optionName} ₹${(c.price / 100).toFixed(2)}`)
                                        .join(", ")}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right text-xs font-medium text-[#7a716b] align-top">
                                  ₹{item.display_item_price}
                                </td>
                                <td className="py-3.5 px-4 text-center align-top">
                                  <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs font-semibold text-[#0c0a09]">
                                    {item.quantity}
                                  </span>
                                </td>
                                <td className="py-3.5 px-6 text-right text-xs font-bold text-[#0c0a09] align-top">
                                  ₹{item.display_total_price}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-xs text-[#7a716b]">
                                No line items recorded for this order.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Financial Breakdown Footer Box */}
                    <div className="border-t border-[#e7e5e4] bg-[#faf8f5]/50 px-6 py-5">
                      <div className="flex flex-col items-end">
                        <div className="w-full max-w-xs space-y-2 text-xs">
                          <div className="flex justify-between items-center text-[#7a716b]">
                            <span className="font-medium">Sub Total</span>
                            <span className="font-semibold text-[#0c0a09]">₹{order?.display_sub_total || "0.00"}</span>
                          </div>

                          {order?.taxInfoSnapshot?.components && order.taxInfoSnapshot.components.length > 0 ? (
                            order.taxInfoSnapshot.components.map((c: any, i: number) => (
                              <div key={i} className="flex justify-between items-center text-[#7a716b]">
                                <span>{c.name} ({c.rate}%)</span>
                                <span className="font-semibold text-[#0c0a09]">
                                  +₹{(((order.subTotal || 0) * c.rate) / 10000).toFixed(2)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="flex justify-between items-center text-[#7a716b]">
                              <span>GST (Tax Total)</span>
                              <span className="font-semibold text-[#0c0a09]">₹{order?.display_tax_total || "0.00"}</span>
                            </div>
                          )}

                          {parseFloat(order?.display_discount_amount || "0") > 0 && (
                            <div className="flex justify-between items-center text-emerald-700">
                              <span className="font-medium">Discount Applied</span>
                              <span className="font-semibold">-₹{order?.display_discount_amount}</span>
                            </div>
                          )}

                          <div className="border-t border-[#e7e5e4] pt-2.5 mt-2.5 flex justify-between items-baseline">
                            <div className="flex flex-col">
                              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#7a716b]">Grand Total</span>
                              <span className="text-[10px] text-emerald-700 font-medium">Taxes &amp; levies included</span>
                            </div>
                            <span className="text-2xl font-bold text-[#0c0a09] tracking-tight">
                              ₹{order?.display_total_amount || "0.00"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Card 3: Payment Information (Transaction Ledger) */}
                  <section className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-xs" data-purpose="transaction-ledger">
                    <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3 mb-4">
                      <h2 className="text-[20px] font-semibold text-[#0c0a09] flex items-center gap-2">
                        <CreditCardIcon className="w-4 h-4 text-[#7a716b]" />
                        Payment Information
                      </h2>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                        isPaid
                          ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                          : "text-amber-800 bg-amber-50 border border-amber-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? "bg-emerald-600" : "bg-amber-600"}`} />
                        {isPaid ? "Fully Settled" : "Payment Due"}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[#7a716b] border-b border-[#e7e5e4] uppercase tracking-wider font-semibold">
                            <th className="pb-2">Payment Time</th>
                            <th className="pb-2">Mode</th>
                            <th className="pb-2">Type</th>
                            <th className="pb-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e7e5e4]">
                          {order?.payments && order.payments.length > 0 ? (
                            order.payments.map((p: any, idx: number) => {
                              const pTime = new Date(p.createdAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              });
                              const isCredit = p.paymentType === "Credit";

                              return (
                                <tr key={p._id || idx}>
                                  <td className="py-2.5 text-[#0c0a09] font-medium">{pTime}</td>
                                  <td className="py-2.5">
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                      p.paymentModeName === "UPI"
                                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                        : p.paymentModeName === "Card"
                                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                                        : "bg-gray-100 text-gray-800"
                                    }`}>
                                      {p.paymentModeName || "Cash"}
                                    </span>
                                  </td>
                                  <td className={`py-2.5 font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}>
                                    {p.paymentType}
                                  </td>
                                  <td className="py-2.5 text-right font-bold text-[#0c0a09]">
                                    {isCredit ? "" : "-"}₹{((p.amount || 0) / 100).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td className="py-2.5 text-[#0c0a09] font-medium">{formattedOrderTime}</td>
                              <td className="py-2.5">
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-semibold text-[#0c0a09]">{order?.paymentMode || "Cash"}</span>
                              </td>
                              <td className="py-2.5 text-emerald-700 font-semibold">Credit</td>
                              <td className="py-2.5 text-right font-bold text-[#0c0a09]">₹{order?.display_total_amount || "0.00"}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
                {/* END LEFT COLUMN */}

                {/* RIGHT COLUMN: 35% (4 Cols) */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Card 1: Billing & Tax Breakdown */}
                  <section className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-xs" data-purpose="billing-breakdown">
                    <h2 className="text-[20px] font-semibold text-[#0c0a09] border-b border-[#e7e5e4] pb-3 mb-4 flex items-center justify-between">
                      <span>Billing &amp; Tax Breakdown</span>
                      <span className="text-xs font-semibold text-[#7a716b]">INR (₹)</span>
                    </h2>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center text-[#7a716b]">
                        <span className="font-medium">Sub Total</span>
                        <span className="font-semibold text-[#0c0a09]">₹{order?.display_sub_total || "0.00"}</span>
                      </div>
                      <div className="flex justify-between items-center text-[#7a716b] text-xs">
                        <span>CGST (2.5%)</span>
                        <span className="font-semibold text-[#0c0a09]">
                          ₹{order?.subTotal ? ((order.subTotal * 0.025) / 100).toFixed(2) : "0.00"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[#7a716b] text-xs">
                        <span>SGST (2.5%)</span>
                        <span className="font-semibold text-[#0c0a09]">
                          ₹{order?.subTotal ? ((order.subTotal * 0.025) / 100).toFixed(2) : "0.00"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[#7a716b] text-xs">
                        <span>Delivery / Service Charge</span>
                        <span className="font-semibold text-[#0c0a09]">₹0.00</span>
                      </div>
                      {parseFloat(order?.display_discount_amount || "0") > 0 && (
                        <div className="flex justify-between items-center text-emerald-700 text-xs">
                          <span className="font-medium">Discount</span>
                          <span className="font-semibold">-₹{order?.display_discount_amount}</span>
                        </div>
                      )}
                      <div className="border-t-2 border-[#0c0a09] pt-3 mt-4 flex justify-between items-baseline">
                        <div>
                          <span className="block text-xs uppercase tracking-widest font-semibold text-[#7a716b]">Total Payable</span>
                          <span className="text-[11px] text-emerald-700 font-medium">Includes all municipal levies</span>
                        </div>
                        <span className="text-2xl font-bold text-[#0c0a09] tracking-tight">
                          ₹{order?.display_total_amount || "0.00"}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Card 2: Issue Refund Card */}
                  <section className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-xs" data-purpose="refund-widget">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[20px] font-semibold text-[#0c0a09]">Issue Refund</h3>
                      <span className="text-[10px] font-semibold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded">Eligible</span>
                    </div>
                    <p className="text-xs text-[#7a716b] mb-4">Refund partial amount or adjust discarded item values.</p>

                    {/* Debit Amount Display Display Banner */}
                    <div className="flex items-center justify-between bg-[#faf7f4] border border-[#e7e5e4] rounded-lg p-3 mb-4">
                      <span className="text-xs font-semibold text-[#7a716b]">Calculated Debit Amount</span>
                      <span className="text-base font-bold text-[#b91c1c] tracking-tight">
                        -₹{order?.display_total_amount || "0.00"}
                      </span>
                    </div>

                    {/* Button triggering payment refund drawer */}
                    <button
                      type="button"
                      onClick={() => {
                        setRefundAmountInput(order?.display_total_amount || "");
                        setDrawerTab("refund");
                      }}
                      style={{ backgroundColor: "#1f7d43", color: "#ffffff" }}
                      className="w-full py-2.5 px-4 bg-[#1f7d43] hover:bg-[#186636] !text-white text-white rounded-lg text-sm font-semibold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer hover:opacity-95"
                    >
                      <RefundIcon className="w-4 h-4 !text-white text-white" />
                      <span className="!text-white text-white font-semibold text-sm">Issue Refund</span>
                    </button>
                  </section>

                  {/* Card 3: Order Actions */}
                  <section className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-xs" data-purpose="order-actions-grid">
                    <h3 className="text-[20px] font-semibold text-[#0c0a09] mb-4">Order Actions</h3>
                    
                    {/* 2-Column Action Grid */}
                    <div className="grid grid-cols-2 gap-2.5 mb-5">
                      {/* Edit Order */}
                      <button
                        type="button"
                        onClick={() => {
                          const status = (order?.orderStatusName || "").trim().toLowerCase();
                          if (status === "delivered" || status === "cancelled" || status === "reject") {
                            showToast(`Cannot edit order: Order is already ${order?.orderStatusName || "completed"}.`);
                          } else {
                            showToast("Navigating to POS billing cart to edit line items...");
                          }
                        }}
                        style={{ backgroundColor: "#4b4642", color: "#ffffff" }}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#4b4642] hover:bg-[#383430] !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                      >
                        <EditIcon className="w-3.5 h-3.5 !text-white text-white" />
                        <span className="!text-white text-white font-semibold text-xs">Edit Order</span>
                      </button>

                      {/* Delete Order */}
                      <button
                        type="button"
                        onClick={() => setIsDeleteDialogOpen(true)}
                        style={{ backgroundColor: "#78716c", color: "#ffffff" }}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#78716c] hover:bg-[#57534e] !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                      >
                        <TrashIcon className="w-3.5 h-3.5 !text-white text-white" />
                        <span className="!text-white text-white font-semibold text-xs">Delete Order</span>
                      </button>

                      {/* Print Receipt */}
                      <button
                        type="button"
                        onClick={handlePrintReceipt}
                        style={{ backgroundColor: "#1c1917", color: "#ffffff" }}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1c1917] hover:bg-black !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                      >
                        <PrintIcon className="w-3.5 h-3.5 !text-white text-white" />
                        <span className="!text-white text-white font-semibold text-xs">Print Receipt</span>
                      </button>

                      {/* Download PDF */}
                      <button
                        type="button"
                        onClick={handleDownloadPDF}
                        style={{ backgroundColor: "#1c1917", color: "#ffffff" }}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1c1917] hover:bg-black !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                      >
                        <DownloadIcon className="w-3.5 h-3.5 !text-white text-white" />
                        <span className="!text-white text-white font-semibold text-xs">Download PDF</span>
                      </button>

                      {/* Add Payment */}
                      <button
                        type="button"
                        onClick={() => {
                          setTenderCashGiven(order?.display_total_amount || "");
                          setDrawerTab("pay");
                        }}
                        style={{ backgroundColor: "#292524", color: "#ffffff" }}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#292524] hover:bg-black !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                      >
                        <CreditCardIcon className="w-3.5 h-3.5 !text-white text-white" />
                        <span className="!text-white text-white font-semibold text-xs">Add Payment</span>
                      </button>

                      {/* Order Timeline */}
                      <button
                        type="button"
                        onClick={() => setDrawerTab("timeline")}
                        style={{ backgroundColor: "#292524", color: "#ffffff" }}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#292524] hover:bg-black !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                      >
                        <TimelineIcon className="w-3.5 h-3.5 !text-white text-white" />
                        <span className="!text-white text-white font-semibold text-xs">Order Timeline</span>
                      </button>
                    </div>

                    {/* Printer Status Widget */}
                    <div className="pt-3 border-t border-[#e7e5e4] flex items-center justify-between text-xs text-[#7a716b]">
                      <span className="flex items-center gap-1.5 font-medium">
                        <PrintIcon className="w-3.5 h-3.5" />
                        <span>Thermal Printer</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                        Connected ●
                      </span>
                    </div>
                  </section>
                </div>
                {/* END RIGHT COLUMN */}
              </div>
              {/* END: TwoColumnLayout */}
            </div>
          </main>

          {/* ========================================================================= */}
          {/* DEDICATED PRINTABLE RECEIPT TEMPLATE (FOR PRINT & PDF EXPORT)             */}
          {/* Matches official PREST / defx-pos Receipt format                          */}
          {/* ========================================================================= */}
          <style jsx global>{`
            @media print {
              /* Hide all normal UI elements, sidebars, headers, action buttons */
              body * {
                visibility: hidden !important;
              }
              /* Show ONLY the receipt container */
              #printable-order-receipt,
              #printable-order-receipt * {
                visibility: visible !important;
              }
              #printable-order-receipt {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 32px !important;
                background: #ffffff !important;
                color: #000000 !important;
                display: block !important;
                z-index: 999999 !important;
                box-shadow: none !important;
              }
              @page {
                size: A4;
                margin: 15mm;
              }
            }
          `}</style>

          <div id="printable-order-receipt" className="hidden print:block font-sans text-black bg-white p-8 max-w-3xl mx-auto">
            {/* Receipt Top Header */}
            <div className="flex justify-between items-start border-b border-gray-300 pb-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-black font-sans mb-1">Receipt</h1>
                <div className="text-xs space-y-1 text-gray-700">
                  <p><span className="font-semibold text-black">Receipt Number:</span> {order?.orderNumber || "ORD#00000"}</p>
                  <p><span className="font-semibold text-black">Date:</span> {formattedOrderDate} {formattedOrderTime} IST</p>
                </div>
              </div>
              <div className="text-right">
                <div className="w-10 h-10 rounded bg-black text-white font-serif font-bold text-xl flex items-center justify-center ml-auto">
                  P
                </div>
                <p className="text-xs font-semibold text-black mt-1 uppercase tracking-wider">{activeOrg?.name || "PREST POS"}</p>
              </div>
            </div>

            {/* Store & Customer Details Grid */}
            <div className="grid grid-cols-2 gap-8 text-xs text-gray-800 pb-4 border-b border-gray-200 mb-6">
              <div>
                <p className="font-bold text-black text-sm mb-1">{activeOrg?.name || "Store Location"}</p>
                <p className="text-gray-600 leading-relaxed mb-3">
                  {activeOrg?.address || "Main Street, Ground Floor, Commercial Arcade"}
                </p>
                <div className="space-y-0.5 text-[11px] text-gray-700">
                  <p><span className="font-medium">Legal Entity Name:</span> {activeOrg?.name || "Prest Retail Corp"}</p>
                  <p><span className="font-medium">GSTIN:</span> UNREGISTERED</p>
                  <p><span className="font-medium">FSSAI:</span> UNREGISTERED</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-black text-sm mb-1">{order?.customerName || "Walk-in Patron"}</p>
                <p className="text-gray-600 font-mono mb-1">{order?.customerPhone || "+91 98200 12345"}</p>
                {order?.customerEmail && <p className="text-gray-600 mb-1">{order.customerEmail}</p>}
                <p className="text-gray-700 mt-2">
                  <span className="font-semibold">Type:</span> {order?.orderType || "DineIn"} 
                  {order?.table ? ` • Table ${order.table.number}` : ""}
                </p>
                <p className="text-gray-700">
                  <span className="font-semibold">Payment Mode:</span> {order?.paymentMode || "Cash"}
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <table className="w-full text-left border-collapse text-xs mb-6">
              <thead>
                <tr className="border-b-2 border-gray-300 text-gray-700 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-2">Particulars</th>
                  <th className="py-2.5 px-2 text-right">Gross value</th>
                  <th className="py-2.5 px-2 text-right">Net value</th>
                  <th className="py-2.5 px-2 text-right">Taxes (₹)</th>
                  <th className="py-2.5 px-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {order?.items && order.items.length > 0 ? (
                  order.items.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-2 font-medium text-black">
                        {item.quantity} x {item.itemName}
                        {item.customizations && item.customizations.length > 0 && (
                          <span className="text-[10px] text-gray-500 block italic">
                            {item.customizations.map((c: any) => `${c.optionName}`).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-600 font-mono">₹{item.display_item_price}</td>
                      <td className="py-2.5 px-2 text-right text-gray-600 font-mono">₹{item.display_item_price}</td>
                      <td className="py-2.5 px-2 text-right text-gray-600 font-mono">
                        ₹{(
                          (parseFloat(item.display_total_price) * 0.05) || 0
                        ).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-black font-mono">₹{item.display_total_price}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-500">No items recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Summary Totals */}
            <div className="flex justify-end mb-8">
              <div className="w-64 space-y-1.5 text-xs text-gray-700">
                <div className="flex justify-between">
                  <span>Sub Total:</span>
                  <span className="font-semibold text-black font-mono">₹{order?.display_sub_total || "0.00"}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (Tax Total):</span>
                  <span className="font-semibold text-black font-mono">₹{order?.display_tax_total || "0.00"}</span>
                </div>
                {parseFloat(order?.display_discount_amount || "0") > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span className="font-semibold font-mono">-₹{order?.display_discount_amount}</span>
                  </div>
                )}
                <div className="border-t-2 border-black pt-2 mt-2 flex justify-between text-sm font-bold text-black">
                  <span>Total:</span>
                  <span className="text-base font-mono">₹{order?.display_total_amount || "0.00"}</span>
                </div>
              </div>
            </div>

            {/* Receipt Footer Message */}
            <div className="border-t border-gray-300 pt-4 text-center text-xs text-gray-600">
              <p className="font-medium">Thanks for your business. Please contact us if you have any questions.</p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* UNIFIED 3-IN-1 SLIDE-OVER DRAWER (PAY | TIMELINE | REFUND)                */}
        {/* ========================================================================= */}
        {drawerTab !== null && order && (
          <div
            aria-labelledby="slide-over-title"
            aria-modal="true"
            className="fixed inset-0 z-50 overflow-hidden font-sans flex justify-end"
            role="dialog"
          >
            {/* Backdrop Blur */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
              onClick={() => setDrawerTab(null)}
            />

            {/* Slide-over Drawer Body (440px width) */}
            <div className="relative z-10 w-screen max-w-[440px] bg-white border-l border-[#e7e5e4] shadow-2xl flex flex-col justify-between h-full transform transition-transform ease-in-out duration-300 animate-slideLeft">
              
              {/* Top Drawer Header with Stable Tab Switcher */}
              <div className="p-6 border-b border-[#e7e5e4] bg-white shrink-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-garamond text-2xl font-normal text-[#141010]" id="slide-over-title">
                      {drawerTab === "pay" && "Order Payment"}
                      {drawerTab === "timeline" && "Order Timeline"}
                      {drawerTab === "refund" && "Payment Refund"}
                    </h3>
                    <p className="text-xs text-[#7a716b] mt-0.5 font-sans font-medium">
                      {order.orderNumber} {order.tokenNumber ? `• Token ${order.tokenNumber}` : ""}
                    </p>
                  </div>
                  <button
                    aria-label="Close Drawer"
                    type="button"
                    onClick={() => setDrawerTab(null)}
                    className="text-[#7a716b] hover:text-[#141010] p-1.5 rounded-lg hover:bg-[#f4eee8] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Stable 3-Tab Segmented Control (Zero layout shifts when switching tabs) */}
                <div className="grid grid-cols-3 gap-1 bg-[#faf8f5] p-1 rounded-lg border border-[#e7e5e4]">
                  <button
                    type="button"
                    onClick={() => setDrawerTab("pay")}
                    className={`py-1.5 text-xs font-semibold rounded-md text-center transition-all cursor-pointer ${
                      drawerTab === "pay"
                        ? "bg-[#0c0a09] text-white shadow-xs"
                        : "text-[#7a716b] hover:text-black hover:bg-white/60"
                    }`}
                  >
                    Pay
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab("timeline")}
                    className={`py-1.5 text-xs font-semibold rounded-md text-center transition-all cursor-pointer ${
                      drawerTab === "timeline"
                        ? "bg-[#0c0a09] text-white shadow-xs"
                        : "text-[#7a716b] hover:text-black hover:bg-white/60"
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab("refund")}
                    className={`py-1.5 text-xs font-semibold rounded-md text-center transition-all cursor-pointer ${
                      drawerTab === "refund"
                        ? "bg-[#0c0a09] text-white shadow-xs"
                        : "text-[#7a716b] hover:text-black hover:bg-white/60"
                    }`}
                  >
                    Refund
                  </button>
                </div>
              </div>

              {/* Drawer Content Area */}
              <div className="flex-1 overflow-y-auto">
                {/* TAB 1: ORDER PAYMENT */}
                {drawerTab === "pay" && (
                  <div className="p-6 space-y-6">
                    {/* Total Payable Amount Banner */}
                    <div className="flex items-center justify-between border border-[#e7e5e4] rounded-xl p-4 bg-[#faf8f5]">
                      <div>
                        <span className="block text-xs font-semibold uppercase tracking-wider text-[#7a716b]">
                          Total payable amount
                        </span>
                        <span className="text-[11px] text-[#7a716b] font-sans">
                          Includes all applicable taxes
                        </span>
                      </div>
                      <span className="font-sans text-2xl font-bold text-[#141010] tracking-tight">
                        ₹{order.display_total_amount}
                      </span>
                    </div>

                    {/* Payment Type Selector */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a716b] mb-2.5">
                        Payment Type
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(["Cash", "UPI QR", "Card / POS", "Split"] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPaymentTenderMode(mode)}
                            className={`py-2 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                              paymentTenderMode === mode
                                ? "bg-[#0c0a09] text-white border-[#0c0a09] shadow-xs"
                                : "bg-white text-[#141010] border-[#e7e5e4] hover:bg-[#f4eee8]"
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Total Given Amount Input */}
                    <div className="space-y-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a716b] mb-2">
                          Total given amount
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-semibold text-[#7a716b]">
                            ₹
                          </span>
                          <input
                            className="w-full pl-8 pr-4 py-2.5 font-sans text-sm font-semibold text-[#141010] border border-[#e7e5e4] rounded-lg focus:border-black focus:ring-black focus:outline-none bg-white"
                            type="number"
                            step="any"
                            value={tenderCashGiven || order.display_total_amount}
                            onChange={(e) => setTenderCashGiven(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Quick Tender Shortcuts */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-[#7a716b]">
                            Quick Tender
                          </label>
                          <span className="text-[11px] text-[#7a716b]">Round shortcuts</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {(() => {
                            const totalNum = parseFloat(order.display_total_amount || "0");
                            const rounded1 = Math.ceil(totalNum);
                            const rounded2 = Math.ceil(totalNum / 10) * 10;
                            const rounded3 = Math.ceil(totalNum / 50) * 50;
                            const rounded4 = Math.ceil(totalNum / 100) * 100 || 1000;
                            const shortcuts = Array.from(new Set([rounded1, rounded2, rounded3, rounded4]));
                            while (shortcuts.length < 4) {
                              shortcuts.push((shortcuts[shortcuts.length - 1] || 100) + 100);
                            }
                            return shortcuts.slice(0, 4).map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setTenderCashGiven(amt.toString())}
                                className="py-2 text-xs font-medium font-sans bg-[#faf8f5] hover:bg-[#f4eee8] text-[#141010] border border-[#e7e5e4] rounded-md transition-colors text-center cursor-pointer"
                              >
                                ₹{amt.toLocaleString("en-IN")}
                              </button>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* Return Amount Banner */}
                      {(() => {
                        const givenNum = parseFloat(tenderCashGiven || order.display_total_amount || "0");
                        const totalNum = parseFloat(order.display_total_amount || "0");
                        const change = Math.max(0, givenNum - totalNum);
                        return (
                          <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                              Return amount
                            </span>
                            <span className="font-sans text-base font-bold text-emerald-700">
                              ₹{change.toFixed(2)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* TAB 2: ORDER TIMELINE */}
                {drawerTab === "timeline" && (
                  <div className="p-8">
                    {(() => {
                      // Retrieve all configured sequence processes from the store
                      const sequenceList = (() => {
                        if (dbProcesses && dbProcesses.length > 0) {
                          const seq = dbProcesses
                            .filter((p) => p.isSequence)
                            .sort((a, b) => a.position - b.position);
                          if (seq.length > 0) return seq;
                        }
                        return [
                          { _id: "p1", name: "Accepted", position: 1, processColor: "#262626" },
                          { _id: "p2", name: "Preparing", position: 2, processColor: "#EA9C1B" },
                          { _id: "p3", name: "Cooking", position: 3, processColor: "#EA9C1B" },
                          { _id: "p4", name: "Plating", position: 4, processColor: "#EA9C1B" },
                          { _id: "p5", name: "Ready to deliver", position: 5, processColor: "#FC8019" },
                          { _id: "p6", name: "Delivered", position: 6, processColor: "#219653" },
                        ];
                      })();

                      const currentStatusName = (order.orderStatusName || "Accepted").trim().toLowerCase();
                      const currentIdx = sequenceList.findIndex(
                        (p) => p.name.trim().toLowerCase() === currentStatusName
                      );
                      const activeIndex = currentIdx >= 0 ? currentIdx : 0;

                      return (
                        <div className="relative flex flex-col items-center">
                          {/* Main Background Vertical Connector Line */}
                          <div className="absolute top-0 bottom-3 w-1 bg-[#262626] rounded-full" />
                          
                          {/* Green Progress Overlay Line */}
                          {activeIndex > 0 && (
                            <div
                              className="absolute top-0 w-1 bg-[#219653] rounded-full transition-all duration-500"
                              style={{
                                height: `${Math.min(100, (activeIndex / (sequenceList.length - 1)) * 100)}%`,
                              }}
                            />
                          )}

                          {/* Dynamic Sequence Steps matching PREST and defx-pos-frontend */}
                          <div className="space-y-12 w-full relative z-10">
                            {sequenceList.map((step, idx) => {
                              const isCompleted = idx <= activeIndex;
                              const isCurrent = idx === activeIndex;

                              return (
                                <div key={step._id || idx} className="flex items-center justify-between w-full">
                                  {/* Left: Timestamp & Date for completed / active steps */}
                                  <div className="w-1/2 text-right pr-6">
                                    {isCompleted ? (
                                      <div>
                                        <span className="font-mono text-xs font-semibold text-[#141010] block">
                                          {formattedOrderTime}
                                        </span>
                                        <span className="text-[11px] text-[#7a716b] block">
                                          {formattedOrderDate}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="h-6" />
                                    )}
                                  </div>

                                  {/* Middle: Status Circle Node */}
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 border-white shadow-xs flex-shrink-0 transition-colors ${
                                      isCompleted
                                        ? "bg-[#219653] ring-2 ring-[#219653]/30"
                                        : "bg-[#262626]"
                                    }`}
                                  />

                                  {/* Right: Process Label */}
                                  <div className="w-1/2 pl-6">
                                    <span
                                      className={`text-sm block tracking-tight ${
                                        isCompleted
                                          ? "font-semibold text-[#141010]"
                                          : "font-medium text-[#262626]"
                                      }`}
                                    >
                                      {step.name}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 3: PAYMENT REFUND (MATCHING EXACT PREST DEFX-POS DESIGN) */}
                {drawerTab === "refund" && (
                  <div className="p-6 space-y-6 font-sans">
                    {/* Total Refund Amount Dual-Box Banner matching screenshot */}
                    <div className="flex border border-[#141010] rounded-md overflow-hidden bg-white shadow-2xs">
                      <div className="flex-1 py-3 px-4 text-sm font-semibold text-[#141010] flex items-center">
                        Total refund amount
                      </div>
                      <div className="bg-[#141010] text-white px-6 py-3 font-bold text-lg font-mono flex items-center justify-center tracking-tight">
                        ₹{order.display_total_amount || "0"}
                      </div>
                    </div>

                    {/* Payment Type Grid (Dynamically loaded from store payment modes) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#141010] mb-2 font-sans">
                        Payment type
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {((paymentModesList && paymentModesList.length > 0)
                          ? paymentModesList
                          : [
                              { _id: "m1", name: "Cash" },
                              { _id: "m2", name: "Credit Card" },
                              { _id: "m3", name: "Debit Card" },
                              { _id: "m4", name: "UPI" },
                              { _id: "m5", name: "Pay later" },
                              { _id: "m6", name: "Wallet" },
                            ]
                        ).map((pm: any) => {
                          const isSelected = (refundPaymentMode || "Cash").trim().toLowerCase() === pm.name.trim().toLowerCase();
                          return (
                            <button
                              key={pm._id || pm.name}
                              type="button"
                              onClick={() => setRefundPaymentMode(pm.name)}
                              className={`px-4 py-2 text-xs font-semibold rounded-md border text-center transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-[#141010] text-white border-[#141010] shadow-xs"
                                  : "bg-white text-[#141010] border border-[#141010]/80 hover:bg-[#f4eee8]"
                              }`}
                            >
                              {pm.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Refund Amount Input */}
                    <div>
                      <label className="block text-xs font-semibold text-[#141010] mb-1.5 font-sans">
                        Refund amount
                      </label>
                      <input
                        className="w-full px-3.5 py-2.5 font-sans text-sm font-semibold text-[#141010] border border-[#141010] rounded-md focus:border-black focus:ring-black focus:outline-none bg-white"
                        type="number"
                        step="any"
                        value={refundAmountInput || order.display_total_amount || "0.00"}
                        onChange={(e) => setRefundAmountInput(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Action Footers */}
              {drawerTab === "pay" && (
                <div className="p-6 border-t border-[#e7e5e4] bg-[#faf8f5] flex flex-col gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleSettlePayment}
                    className="w-full py-3 bg-[#0c0a09] hover:bg-black text-white text-sm font-semibold rounded-lg shadow-xs transition-colors text-center cursor-pointer"
                  >
                    Payment Received
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab(null)}
                    className="w-full py-2.5 bg-transparent hover:bg-white text-[#7a716b] hover:text-[#141010] text-xs font-medium rounded-lg transition-colors text-center cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {drawerTab === "timeline" && (
                <div className="p-6 border-t border-[#e7e5e4] bg-[#faf8f5] shrink-0">
                  <button
                    type="button"
                    onClick={() => setDrawerTab(null)}
                    className="w-full py-2.5 bg-[#0c0a09] text-white rounded-lg text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
                  >
                    Close Timeline
                  </button>
                </div>
              )}

              {drawerTab === "refund" && (
                <div className="p-6 border-t border-[#e7e5e4] bg-[#faf8f5] flex flex-col gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleIssueRefund}
                    className="w-full py-3 bg-[#1f7d43] hover:bg-[#186636] text-white text-sm font-semibold rounded-lg shadow-xs transition-colors text-center cursor-pointer"
                  >
                    Confirm Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab(null)}
                    className="w-full py-2.5 bg-transparent hover:bg-white text-[#7a716b] hover:text-[#141010] text-xs font-medium rounded-lg transition-colors text-center cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DELETE ORDER CONFIRMATION DIALOG (MATCHING PREST SCREENSHOT)              */}
        {/* ========================================================================= */}
        {isDeleteDialogOpen && order && (
          <div
            aria-labelledby="delete-dialog-title"
            aria-modal="true"
            className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 font-sans"
            role="dialog"
          >
            {/* Dark overlay backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
              onClick={() => setIsDeleteDialogOpen(false)}
            />

            {/* Modal Card matching screenshot */}
            <div className="relative bg-white rounded-lg max-w-md w-full p-6 shadow-2xl z-10 transform transition-all animate-scaleUp">
              <h3
                id="delete-dialog-title"
                className="text-lg font-bold text-[#141010] mb-2 font-sans"
              >
                Delete {order.orderNumber}?
              </h3>
              <p className="text-sm text-[#4b5563] mb-6 font-sans">
                Are you sure you want to delete this order?
              </p>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#e5e7eb] hover:bg-[#d1d5db] text-[#374151] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingOrder}
                  onClick={handleConfirmDeleteOrder}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#ef4444] hover:bg-[#dc2626] text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isDeletingOrder ? "Deleting..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </PosShell>
    );
  }

  // =========================================================================
  // DEFAULT VIEW RENDER: ORDERS LIST & TABLE (WHEN selectedOrderId IS NULL)
  // =========================================================================
  return (
    <PosShell title="Orders">
      {/* Toast Notification Banner */}
      {notificationMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0c0a09] text-white px-5 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-slideDown font-sans">
          <CheckmarkIcon className="w-4 h-4 text-emerald-400" />
          <span>{notificationMessage}</span>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6 font-sans">
        {/* BEGIN: PageTitleArea */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight">Orders</h1>
            <p className="text-[#5e5e5e] text-[14px] mt-1 font-normal">Manage store orders, filter by channels, and view billing status.</p>
          </div>
          {/* Metric summaries badge */}
          <div className="flex items-center gap-3">
            <div className="bg-[#fdf8f7] border border-[#e7e5e4] rounded-xl px-5 py-2.5 text-right shadow-2xs">
              <span className="block text-[11px] uppercase font-semibold tracking-wider text-[#5e5e5e]">
                {appliedPreset === "Today"
                  ? "Today's Gross Sales"
                  : appliedPreset === "Yesterday"
                  ? "Yesterday's Gross Sales"
                  : "Gross Sales"}
              </span>
              <span className="text-xl font-bold text-[#0c0a09]">{totalGrossSales}</span>
            </div>
          </div>
        </div>
        {/* END: PageTitleArea */}

        {/* BEGIN: FilterToolbar */}
        <div
          className="bg-white border border-[#e7e5e4] rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 font-sans"
          data-purpose="orders-toolbar"
        >
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Date Range Selector Dropdown */}
            <div className="relative" ref={dateDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  if (isDateDropdownOpen) {
                    setIsDateDropdownOpen(false);
                  } else {
                    handleOpenDateDropdown();
                  }
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-[#e7e5e4] rounded-lg text-xs font-medium text-[#0c0a09] hover:bg-[#fdf8f7] transition-colors focus:ring-1 focus:ring-[#0c0a09] cursor-pointer shadow-2xs"
              >
                <CalendarIcon className="w-4 h-4 text-[#5e5e5e]" />
                <span className="font-medium text-xs text-[#0c0a09]">
                  {formattedDateRangeText}
                </span>
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 text-[#5e5e5e] ml-1 transition-transform duration-150 ${
                    isDateDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isDateDropdownOpen && (
                <div className="absolute left-0 top-full mt-2.5 bg-white border border-[#d1d5db] rounded-lg shadow-2xl z-50 overflow-visible font-sans animate-fadeIn">
                  {/* Top pointer notch arrow */}
                  <div className="absolute left-8 -top-1.5 w-3 h-3 bg-white border-t border-l border-[#d1d5db] rotate-45 z-10" />

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
                                ? "bg-[#0085d4] text-white font-medium"
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
                        false
                      )}
                      {renderMonthCalendar(
                        new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1).getFullYear(),
                        new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1).getMonth(),
                        false,
                        true
                      )}
                    </div>
                  </div>

                  {/* Bottom Footer Bar */}
                  <div className="border-t border-[#e5e7eb] px-4 py-2.5 bg-white flex items-center justify-between">
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
                        className="px-5 py-1.5 text-xs font-semibold text-white bg-[#0c0a09] hover:bg-[#262626] rounded-md transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status Dropdown Filter */}
            <div className="relative" ref={statusDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsStatusDropdownOpen(!isStatusDropdownOpen);
                  setIsDateDropdownOpen(false);
                }}
                className="inline-flex items-center justify-between gap-2 min-w-[130px] px-3.5 py-2.5 bg-[#fdf8f7] border border-[#e7e5e4] rounded-lg text-xs font-medium text-[#0c0a09] hover:bg-[#f1edec] transition-colors cursor-pointer"
              >
                <span>
                  Status: <strong className="font-semibold text-[#0c0a09]">{activeStage === "All" ? "Any" : activeStage}</strong>
                </span>
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 text-[#5e5e5e] transition-transform duration-150 ${
                    isStatusDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isStatusDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-48 bg-white border border-[#e7e5e4] rounded-xl shadow-xl py-1.5 z-50 animate-fadeIn font-sans">
                  {pipelineStages.map((stage) => {
                    const isSelected = activeStage === stage.name;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => {
                          setActiveStage(stage.name);
                          setIsStatusDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-[#0c0a09] text-white font-semibold"
                            : "text-[#0c0a09] hover:bg-[#fdf8f7]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {stage.name !== "All" && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: stage.color || "#262626" }}
                            />
                          )}
                          <span>{stage.name === "All" ? "Any" : stage.name}</span>
                        </div>
                        {isSelected && <span className="text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Price Range Filter Inputs */}
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <input
                  className="w-24 px-3 py-2 text-xs font-medium bg-[#fdf8f7] border border-[#e7e5e4] rounded-lg placeholder-[#5e5e5e] text-[#0c0a09] focus:bg-white focus:outline-none focus:border-[#0c0a09]"
                  placeholder="Price from"
                  type="text"
                  value={priceFrom}
                  onChange={(e) => setPriceFrom(e.target.value)}
                />
              </div>
              <span className="text-[#5e5e5e] text-xs">-</span>
              <div className="relative">
                <input
                  className="w-24 px-3 py-2 text-xs font-medium bg-[#fdf8f7] border border-[#e7e5e4] rounded-lg placeholder-[#5e5e5e] text-[#0c0a09] focus:bg-white focus:outline-none focus:border-[#0c0a09]"
                  placeholder="Price to"
                  type="text"
                  value={priceTo}
                  onChange={(e) => setPriceTo(e.target.value)}
                />
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative flex-1 min-w-[280px]">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#5e5e5e]">
                <SearchIcon className="w-4 h-4" />
              </span>
              <input
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-[#fdf8f7] border border-[#e7e5e4] rounded-lg placeholder-[#5e5e5e] text-[#0c0a09] focus:bg-white focus:outline-none focus:border-[#0c0a09] transition-all"
                placeholder="Search Customer / Phone / Order / Token (e.g. #ORD-1082, T-04, Rahul)"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#0c0a09] bg-[#fdf8f7] border border-[#e7e5e4] hover:bg-[#f1edec] rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              <ExportIcon className="w-4 h-4 text-[#0c0a09]" />
              <span>Export</span>
            </button>
          </div>
        </div>
        {/* END: FilterToolbar */}

        {/* BEGIN: PipelineStatusPills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs select-none font-sans" data-purpose="status-pipeline">
          {pipelineStages.map((stage) => {
            const isActive = activeStage === stage.name;
            const count = statusCounts[stage.name] ?? 0;

            if (stage.name === "All") {
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveStage("All")}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold shadow-sm flex-shrink-0 cursor-pointer transition-all ${
                    isActive ? "bg-[#0c0a09] text-white" : "bg-white border border-[#e7e5e4] text-[#0c0a09] hover:bg-[#fdf8f7]"
                  }`}
                >
                  <span>All</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                      isActive ? "bg-white/20 text-white" : "bg-[#f1edec] text-[#5e5e5e]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveStage(stage.name)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-colors flex-shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-[#fdf8f7] border border-[#0c0a09] text-[#0c0a09] shadow-xs font-semibold"
                    : "bg-white border border-[#e7e5e4] hover:bg-[#fdf8f7] text-[#5e5e5e]"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: stage.color || "#262626" }}
                />
                <span>{stage.name}</span>
                <span className={`text-[11px] ${isActive ? "font-semibold text-[#0c0a09]" : "text-[#5e5e5e]"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
        {/* END: PipelineStatusPills */}

        {/* BEGIN: OrdersTableCard */}
        <section className="bg-white border border-[#e7e5e4] rounded-xl shadow-xs overflow-hidden font-sans" data-purpose="orders-table-container">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              {/* Table Header */}
              <thead>
                <tr className="border-b border-[#e7e5e4] bg-[#fdf8f7] text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                  <th className="py-3 px-5 font-semibold">Order Number</th>
                  <th className="py-3 px-5 font-semibold">Order Status</th>
                  <th className="py-3 px-5 font-semibold">Customer Name / Phone Number</th>
                  <th className="py-3 px-5 font-semibold">Order Type</th>
                  <th
                    className="py-3 px-5 font-semibold cursor-pointer hover:text-[#0c0a09]"
                    onClick={() => toggleSort("createdAt")}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>Ordered Date and Time</span>
                      <SortIcon className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th className="py-3 px-5 font-semibold">Payment Status</th>
                  <th
                    className="py-3 px-5 font-semibold text-right cursor-pointer hover:text-[#0c0a09]"
                    onClick={() => toggleSort("totalAmount")}
                  >
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <span>Order Price</span>
                      <SortIcon className="w-3.5 h-3.5" />
                    </div>
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-[#f0e8e2] text-xs">
                {displayedOrders.length > 0 ? (
                  displayedOrders.map((order) => {
                    const isPaid = order.paymentStatus === "Paid";
                    const isCod = (order.paymentMode || "").toLowerCase().includes("cash") && !isPaid;
                    const orderDateStr = new Date(order.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    });

                    // Format relative time
                    const diffMins = Math.max(1, Math.round((Date.now() - order.createdAt) / 60000));
                    const timeAgoText = diffMins < 60 ? `${diffMins} mins ago` : `${Math.round(diffMins / 60)}h ago`;

                    return (
                      <tr
                        key={order._id}
                        onClick={() => setSelectedOrderId(order._id)}
                        className="hover:bg-[#fdf8f7] transition-colors group cursor-pointer"
                      >
                        {/* 1. Order Number */}
                        <td className="py-4 px-5 text-[#0c0a09]">
                          <button
                            type="button"
                            className="text-[#0c0a09] group-hover:text-amber-800 font-semibold cursor-pointer text-left"
                          >
                            {order.orderNumber}
                          </button>
                          <span className="block text-[11px] text-[#5e5e5e] font-normal">
                            Token {order.tokenNumber}
                          </span>
                        </td>

                        {/* 2. Order Status */}
                        <td className="py-4 px-5">
                          {(() => {
                            const matchedStage = pipelineStages.find(
                              (st) => st.name.toLowerCase() === (order.orderStatusName || "").toLowerCase()
                            );
                            const dotColor =
                              matchedStage?.color ||
                              (order.orderStatusName === "Cancelled" || order.isRejected
                                ? "#e11d48"
                                : order.orderStatusName === "Completed" || order.isCompleted
                                ? "#219653"
                                : "#262626");
                            return (
                              <span className="inline-flex items-center gap-1.5 font-medium text-[#0c0a09]">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    order.orderStatusName === "In progress" ? "animate-pulse" : ""
                                  }`}
                                  style={{ backgroundColor: dotColor }}
                                />
                                {order.orderStatusName || "Accepted"}
                              </span>
                            );
                          })()}
                        </td>

                        {/* 3. Customer Name / Phone */}
                        <td className="py-4 px-5">
                          <div className="font-medium text-[#0c0a09]">
                            {order.customerName || <span className="italic text-[#5e5e5e]">Walk-in Customer</span>}
                          </div>
                          <div className="text-[12px] text-[#5e5e5e]">{order.customerPhone || "-"}</div>
                        </td>

                        {/* 4. Order Type */}
                        <td className="py-4 px-5">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f1edec] text-[#0c0a09] text-[11px] font-medium border border-[#e7e5e4]">
                            <span>{order.orderType}</span>
                            {order.table && (
                              <>
                                <span className="text-[#5e5e5e]">•</span>
                                <span className="font-semibold text-[#0c0a09]">Table {order.table.number}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* 5. Date & Time */}
                        <td className="py-4 px-5">
                          <div className="text-[#0c0a09] font-medium">{orderDateStr}</div>
                          <div className="text-[11px] text-[#5e5e5e]">{timeAgoText}</div>
                        </td>

                        {/* 6. Payment Status */}
                        <td className="py-4 px-5">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckmarkIcon className="w-3 h-3" />
                              ₹{order.display_total_amount} Paid
                            </span>
                          ) : isCod ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              ₹{order.display_total_amount} Unpaid (COD)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              ₹{order.display_total_amount} Unpaid
                            </span>
                          )}
                        </td>

                        {/* 7. Order Price */}
                        <td className="py-4 px-5 text-right font-bold text-sm text-[#0c0a09]">
                          ₹{order.display_total_amount}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#5e5e5e] text-xs">
                      No orders found matching the current search and filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* BEGIN: TableFooterPagination */}
          <div
            className="border-t border-[#e7e5e4] bg-[#fdf8f7]/50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 select-none font-sans"
            data-purpose="table-pagination"
          >
            <div className="text-xs text-[#5e5e5e]">
              Showing <strong className="text-[#0c0a09] font-semibold">{totalOrdersCount === 0 ? "0" : `${startOrderCount}–${endOrderCount}`}</strong> of{" "}
              <strong className="text-[#0c0a09] font-semibold">{totalOrdersCount}</strong> Orders
            </div>
            <div className="flex items-center gap-1.5">
              {/* Previous Button */}
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-medium text-[#5e5e5e] bg-white border border-[#e7e5e4] rounded-md hover:bg-[#fdf8f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous
              </button>

              {/* Dynamic Page Numbers */}
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                const isCurrent = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      isCurrent
                        ? "bg-[#0c0a09] text-white"
                        : "bg-white border border-[#e7e5e4] text-[#0c0a09] hover:bg-[#fdf8f7]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Next Button */}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-medium text-[#0c0a09] bg-white border border-[#e7e5e4] rounded-md hover:bg-[#fdf8f7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
          {/* END: TableFooterPagination */}
        </section>
        {/* END: OrdersTableCard */}
      </main>
    </PosShell>
  );
}
