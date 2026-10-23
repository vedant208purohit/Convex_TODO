"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset: string;
}

interface ReportHeaderProps {
  title: string;
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
}

export const PRESET_OPTIONS = [
  "Today",
  "Yesterday",
  "Last 7 Days",
  "Last 30 Days",
  "This Month",
  "Last Month",
  "Custom Range",
] as const;

export function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function calculateDatePreset(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const today = getStartOfDay(now);

  if (preset === "Today") {
    return { start: today, end: getEndOfDay(now) };
  }
  if (preset === "Yesterday") {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    return { start: y, end: getEndOfDay(y) };
  }
  if (preset === "Last 7 Days") {
    const past = new Date(today);
    past.setDate(today.getDate() - 6);
    return { start: past, end: getEndOfDay(now) };
  }
  if (preset === "Last 30 Days") {
    const past = new Date(today);
    past.setDate(today.getDate() - 29);
    return { start: past, end: getEndOfDay(now) };
  }
  if (preset === "This Month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start, end: getEndOfDay(now) };
  }
  if (preset === "Last Month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }
  return { start: today, end: getEndOfDay(now) };
}

export function formatShortDate(d: Date): string {
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function ChevronRightIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

export function ReportHeader({
  title,
  selectedRange,
  onRangeChange,
}: ReportHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Custom range input states (formatted as YYYY-MM-DD for native HTML date input)
  const toInputDate = (d: Date) => {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [customStart, setCustomStart] = useState<string>(toInputDate(selectedRange.startDate));
  const [customEnd, setCustomEnd] = useState<string>(toInputDate(selectedRange.endDate));

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPreset = (preset: string) => {
    if (preset === "Custom Range") {
      onRangeChange({
        ...selectedRange,
        preset: "Custom Range",
      });
      return;
    }
    const { start, end } = calculateDatePreset(preset);
    onRangeChange({
      startDate: start,
      endDate: end,
      preset,
    });
    setIsDropdownOpen(false);
  };

  const handleApplyCustom = () => {
    if (!customStart || !customEnd) return;
    const [sy, sm, sd] = customStart.split("-").map(Number);
    const [ey, em, ed] = customEnd.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);

    onRangeChange({
      startDate: start,
      endDate: end,
      preset: "Custom Range",
    });
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex flex-col gap-4 pb-6 border-b border-[#eadfd6]">
      {/* Breadcrumb Navigation */}
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
        <span className="text-[#141010] font-semibold">{title}</span>
      </nav>

      {/* Title & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#141010]">
            {title}
          </h1>
        </div>

        {/* Date Range Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#eadfd6] bg-white text-xs font-semibold text-[#141010] shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-[#141010] transition cursor-pointer"
          >
            <svg
              className="w-4 h-4 text-[#78716c]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            <span>
              {formatShortDate(selectedRange.startDate)} - {formatShortDate(selectedRange.endDate)}
            </span>
            <span className="text-[#78716c] font-normal">
              ({selectedRange.preset})
            </span>
            <svg
              className={`w-3.5 h-3.5 text-[#78716c] transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M19 9l-7 7-7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>

          {/* Date Picker Popover Menu */}
          {isDropdownOpen && (
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white border border-[#eadfd6] rounded-2xl shadow-xl p-3 z-50 flex flex-col gap-2">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#78716c] border-b border-[#f1edec]">
                Select Date Range
              </div>
              <div className="flex flex-col gap-0.5">
                {PRESET_OPTIONS.map((preset) => {
                  const isSelected = selectedRange.preset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-[#141010] text-white font-semibold"
                          : "text-[#141010] hover:bg-[#fbf7f4]"
                      }`}
                    >
                      <span>{preset}</span>
                      {isSelected && <span>✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Custom Range Date Pickers (if Custom Range active) */}
              {selectedRange.preset === "Custom Range" && (
                <div className="mt-2 pt-2 border-t border-[#f1edec] flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-[#78716c] uppercase">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:border-[#141010]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-[#78716c] uppercase">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-[#e7e5e4] rounded-lg focus:outline-none focus:border-[#141010]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    className="w-full mt-1 px-3 py-2 text-xs font-semibold text-white bg-[#141010] hover:bg-[#262626] rounded-lg transition cursor-pointer"
                  >
                    Apply Range
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
