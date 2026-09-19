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
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#e7e5e4]">
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-[11px] uppercase tracking-widest text-[#5e5e5e] font-medium font-sans mb-1.5">
          <span>SETTINGS</span>
          <span className="text-[#b8b3b0]">/</span>
          <span className="text-[#0c0a09] font-semibold">ORDER STATUS</span>
        </nav>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-garamond text-[30px] md:text-[32px] font-normal tracking-tight text-[#141010] leading-tight">
            Order Status
          </h1>
          <div className="bg-[#f0efed] px-3 py-1 rounded-full flex items-center gap-2 border border-[#e7e5e4]">
            <span className="w-2 h-2 rounded-full bg-[#141010]" />
            <span className="text-[11px] font-semibold text-[#141010] tracking-wider uppercase font-sans">
              {processCount} {processCount === 1 ? "status" : "statuses"}
            </span>
          </div>
        </div>
        <p className="font-sans text-sm text-[#5e5e5e] mt-1 leading-normal">
          Set the steps an order follows from receiving the order to completing it.
        </p>
      </div>

      {/* Add Order Status Button */}
      <button
        type="button"
        onClick={onAddProcess}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0c0a09] text-white text-xs md:text-sm font-semibold hover:bg-neutral-800 active:scale-[0.98] transition-all shadow-sm cursor-pointer border border-[#0c0a09] shrink-0"
      >
        <svg
          className="w-4 h-4 text-white stroke-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="text-white font-semibold font-sans">Add Order Status</span>
      </button>
    </div>
  );
}
