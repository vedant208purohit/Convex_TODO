"use client";

import React, { useRef, useState, useEffect } from "react";
import { isDataZero } from "../../reports/reportCalculations";

interface ReportElementCardProps {
  heading: string;
  currentSales?: string | number | null;
  loading?: boolean;
}

export function ReportElementCard({
  heading,
  currentSales,
  loading = false,
}: ReportElementCardProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (textRef.current) {
      setIsOverflowing(
        textRef.current.scrollWidth > textRef.current.clientWidth,
      );
    }
  }, [currentSales]);

  const displayValue = isDataZero(currentSales);

  return (
    <div className="flex-1 min-w-[200px] rounded-2xl border border-[#eadfd6] bg-[#fbf7f4] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-[#d9ccc2]">
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-3.5 w-1/2 rounded bg-[#e8ded6]" />
          <div className="h-7 w-3/4 rounded bg-[#e8ded6]" />
        </div>
      ) : (
        <>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#78716c] truncate">
            {heading}
          </div>
          <div
            ref={textRef}
            title={isOverflowing ? String(displayValue) : undefined}
            className="mt-3 truncate text-2xl font-bold tracking-tight text-[#141010]"
          >
            {displayValue}
          </div>
        </>
      )}
    </div>
  );
}
