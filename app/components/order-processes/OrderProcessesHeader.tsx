"use client";

import React from "react";

interface OrderProcessesHeaderProps {
  processCount: number;
  onAddProcess: () => void;
}

export function OrderProcessesHeader({
  processCount,
  onAddProcess,
}: OrderProcessesHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#e7e5e4] gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="font-garamond text-2xl lg:text-3xl text-[#141010] font-normal leading-tight">
            Order Processes
          </h2>
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-[#f0efed] border border-[#e7e5e4] text-[11px] font-semibold text-[#141010] rounded-full uppercase tracking-wider font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-[#141010]" />
            {processCount} {processCount === 1 ? "process" : "processes"}
          </span>
        </div>
        <p className="text-xs lg:text-sm text-[#78716c] mt-1 font-sans">
          Define and manage workflow stages to track orders from acceptance to completion.
        </p>
      </div>

      <button
        type="button"
        onClick={onAddProcess}
        style={{ backgroundColor: "#141010", color: "#ffffff" }}
        className="flex h-10 items-center gap-2 rounded-full !bg-[#141010] hover:!bg-[#292524] px-5 text-sm font-medium !text-[#ffffff] shadow-sm transition active:scale-[0.98] cursor-pointer shrink-0 font-sans"
      >
        <svg
          className="w-4 h-4 !text-white stroke-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M12 4v16m8-8H4" />
        </svg>
        <span style={{ color: "#ffffff" }} className="!text-[#ffffff] font-medium font-sans">
          Add order process
        </span>
      </button>
    </div>
  );
}
