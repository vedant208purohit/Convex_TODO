"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  formatStoreDate,
  getTimezoneForCountry,
} from "../../lib/constants/countries";

export interface OrderDateRangePickerProps {
  startDate: Date;
  endDate: Date;
  preset?: string;
  onChange: (range: { startDate: Date; endDate: Date; preset: string }) => void;
  countryCode?: string;
  timezone?: string;
  variant?: "default" | "pill";
  align?: "left" | "right";
  className?: string;
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

function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function getPresetDateRange(preset: string): { start: Date; end: Date } {
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
    const end = new Date(
      today.getFullYear(),
      today.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );
    return { start, end };
  }
  return { start: today, end: getEndOfDay(now) };
}

export function OrderDateRangePicker({
  startDate,
  endDate,
  preset = "Today",
  onChange,
  countryCode = "IN",
  timezone,
  variant = "default",
  align = "right",
  className = "",
}: OrderDateRangePickerProps) {
  const storeTz = timezone || getTimezoneForCountry(countryCode);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Draft states while popover is open
  const [draftPreset, setDraftPreset] = useState<string>(preset);
  const [draftStartDate, setDraftStartDate] = useState<Date>(startDate);
  const [draftEndDate, setDraftEndDate] = useState<Date>(endDate);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    return new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  });

  // Sync internal state when props change externally
  useEffect(() => {
    setDraftPreset(preset);
    setDraftStartDate(startDate);
    setDraftEndDate(endDate);
    setViewMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
  }, [startDate, endDate, preset]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleOpenDropdown = () => {
    setDraftPreset(preset);
    setDraftStartDate(new Date(startDate));
    setDraftEndDate(new Date(endDate));
    setViewMonth(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
    setIsOpen(!isOpen);
  };

  const handlePresetClick = (p: string) => {
    setDraftPreset(p);
    if (p !== "Custom Range") {
      const { start, end } = getPresetDateRange(p);
      setDraftStartDate(start);
      setDraftEndDate(end);
      setViewMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    }
  };

  const handleNavigateMonth = (direction: -1 | 1) => {
    setViewMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1),
    );
  };

  const handleDateCellClick = (clickedDate: Date) => {
    const normClicked = getStartOfDay(clickedDate);
    const normStart = getStartOfDay(draftStartDate);
    const normEnd = getStartOfDay(draftEndDate);

    if (normStart.getTime() === normEnd.getTime()) {
      if (normClicked.getTime() < normStart.getTime()) {
        setDraftStartDate(normClicked);
        setDraftEndDate(getEndOfDay(normStart));
      } else {
        setDraftEndDate(getEndOfDay(normClicked));
      }
    } else {
      setDraftStartDate(normClicked);
      setDraftEndDate(getEndOfDay(normClicked));
    }
    setDraftPreset("Custom Range");
  };

  const handleApply = () => {
    onChange({
      startDate: getStartOfDay(draftStartDate),
      endDate: getEndOfDay(draftEndDate),
      preset: draftPreset,
    });
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  // Country-wise formatted dates using countries.ts
  const formattedButtonText = useMemo(() => {
    const startStr = formatStoreDate(startDate, countryCode, storeTz);
    const endStr = formatStoreDate(endDate, countryCode, storeTz);
    return `${startStr} - ${endStr}`;
  }, [startDate, endDate, countryCode, storeTz]);

  const formattedDraftText = useMemo(() => {
    const startStr = formatStoreDate(draftStartDate, countryCode, storeTz);
    const endStr = formatStoreDate(draftEndDate, countryCode, storeTz);
    return `${startStr} - ${endStr}`;
  }, [draftStartDate, draftEndDate, countryCode, storeTz]);

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

    // Next month leading days to complete grid
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
            let textClass = cell.isCurrentMonth
              ? "text-[#0c0a09]"
              : "text-[#b0a8a0]";

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
                  isToday && !isSelectedStart && !isSelectedEnd
                    ? "border border-[#0c0a09] font-bold"
                    : ""
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

  const nextViewMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    1,
  );

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      {variant === "pill" ? (
        <button
          type="button"
          onClick={handleOpenDropdown}
          className="h-10 px-4 bg-white text-[#1e1b19] rounded-full shadow-xs border border-[#e9e1dd] flex items-center gap-2 hover:bg-[#faf2ee] transition-all cursor-pointer font-medium text-xs"
        >
          <svg
            className="w-4 h-4 text-[#5e5e5e] shrink-0"
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
          <span className="font-semibold text-xs text-[#0c0a09] tracking-tight whitespace-nowrap">
            {formattedButtonText}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-[#5e5e5e] transition-transform duration-150 shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
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
      ) : (
        <button
          type="button"
          onClick={handleOpenDropdown}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-[#e7e5e4] rounded-lg text-xs font-medium text-[#0c0a09] hover:bg-[#fdf8f7] transition-colors focus:ring-1 focus:ring-[#0c0a09] cursor-pointer shadow-2xs whitespace-nowrap"
        >
          <svg
            className="w-4 h-4 text-[#5e5e5e] shrink-0"
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
          <span className="font-medium text-xs text-[#0c0a09] tracking-tight whitespace-nowrap">
            {formattedButtonText}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-[#5e5e5e] ml-1 transition-transform duration-150 shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
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
      )}

      {/* Date Range Popover */}
      {isOpen && (
        <div
          className={`absolute ${
            align === "right"
              ? "right-0 sm:right-0"
              : "left-0 sm:left-0"
          } top-full mt-2.5 bg-white border border-[#d1d5db] rounded-lg shadow-2xl z-50 overflow-visible font-sans`}
          style={{ maxWidth: "calc(100vw - 2rem)" }}
        >
          {/* Top pointer notch arrow */}
          <div
            className={`absolute ${
              align === "right" ? "right-8" : "left-8"
            } -top-1.5 w-3 h-3 bg-white border-t border-l border-[#d1d5db] rotate-45 z-10`}
          />

          {/* Main section: Presets list + Dual calendar */}
          <div className="flex flex-col sm:flex-row overflow-x-auto">
            {/* Left Sidebar Presets */}
            <div className="w-full sm:w-36 border-b sm:border-b-0 sm:border-r border-[#e5e7eb] py-2 flex flex-row sm:flex-col bg-white shrink-0 overflow-x-auto sm:overflow-visible">
              {DATE_RANGE_OPTIONS.map((p) => {
                const isSelected = draftPreset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePresetClick(p)}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? "bg-[#0085d4] text-white font-medium"
                        : "text-stone-800 hover:bg-stone-100 font-normal"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Right Dual Calendar side-by-side */}
            <div className="p-4 flex flex-col md:flex-row gap-6 bg-white shrink-0">
              {renderMonthCalendar(
                viewMonth.getFullYear(),
                viewMonth.getMonth(),
                true,
                false,
              )}
              {renderMonthCalendar(
                nextViewMonth.getFullYear(),
                nextViewMonth.getMonth(),
                false,
                true,
              )}
            </div>
          </div>

          {/* Bottom Footer Bar */}
          <div className="border-t border-[#e5e7eb] px-4 py-2.5 bg-white flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="text-xs font-medium text-stone-700 tracking-tight">
              {formattedDraftText}
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-1.5 text-xs font-semibold text-white bg-[#0c0a09] hover:bg-[#262626] rounded-md transition-colors cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
