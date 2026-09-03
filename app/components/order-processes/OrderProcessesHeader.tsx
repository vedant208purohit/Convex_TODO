"use client";

import React, { useState } from "react";

interface OrderProcessesHeaderProps {
  processCount: number;
  onAddProcess: () => void;
}

export function OrderProcessesHeader({
  processCount,
  onAddProcess,
}: OrderProcessesHeaderProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-5">
      <div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[12px] font-semibold text-[#4e4543] tracking-[0.96px] uppercase font-sans">
            PREST POS / SETTINGS
          </span>
          <span className="w-1 h-1 rounded-full bg-[#7f7572]" />
          <span className="text-[12px] font-semibold text-[#141010] tracking-[0.96px] uppercase font-sans">
            ORDER PROCESSES
          </span>
        </div>

        {/* Title + Count Pill + Info Icon */}
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="font-serif text-[48px] text-[#141010] font-light leading-[1.08] tracking-[-0.96px]">
            Order Processes
          </h1>

          {/* Process Count Badge */}
          <div className="bg-[#f0efed] px-3.5 py-1 rounded-full flex items-center gap-2 border border-[#e7e5e4]">
            <span className="w-2 h-2 rounded-full bg-[#141010]" />
            <span className="text-[12px] font-semibold text-[#141010] tracking-[0.96px] uppercase font-sans">
              {processCount} {processCount === 1 ? "process" : "processes"}
            </span>
          </div>

          {/* Info Tooltip */}
          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            tabIndex={0}
            role="button"
            aria-label="Order processes info"
          >
            <svg
              className="w-5 h-5 text-[#4e4543] hover:text-[#141010] transition-colors cursor-pointer"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>

            {showTooltip && (
              <div
                role="tooltip"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#141010] text-[#ffffff] text-[13px] leading-snug rounded-xl shadow-xl z-50 text-center font-normal pointer-events-none"
              >
                Order processes define the workflow stages used to track orders
                from acceptance to completion.
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#141010]" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Order Process Button */}
      <button
        type="button"
        onClick={onAddProcess}
        className="!bg-[#141010] hover:!bg-[#292524] !text-[#ffffff] h-10 px-6 rounded-full text-[15px] font-medium flex items-center gap-2 transition-all shadow-sm cursor-pointer shrink-0 active:scale-[0.98]"
      >
        <svg
          className="w-[18px] h-[18px] text-[#ffffff] stroke-[#ffffff]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        <span className="text-[#ffffff] font-medium font-sans">Add order process</span>
      </button>
    </div>
  );
}
