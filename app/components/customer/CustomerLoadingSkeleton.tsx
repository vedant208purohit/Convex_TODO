"use client";

import React from "react";

export function CustomerLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col w-full max-w-[480px] mx-auto pt-20 pb-24 px-4 space-y-5 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-stone-200" />
          <div className="flex flex-col gap-1.5">
            <div className="w-20 h-2.5 bg-stone-200 rounded" />
            <div className="w-32 h-3.5 bg-stone-300 rounded" />
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-stone-200" />
      </div>

      {/* Table Context Skeleton */}
      <div className="w-full h-12 bg-stone-200/70 rounded-xl" />

      {/* Mode Switcher Skeleton */}
      <div className="w-full h-10 bg-stone-200/70 rounded-xl" />

      {/* Hero Banner Skeleton */}
      <div className="w-full h-44 bg-stone-200 rounded-2xl" />

      {/* Category Row Skeleton */}
      <div className="flex gap-2.5 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-stone-200" />
            <div className="w-12 h-2.5 bg-stone-200 rounded" />
          </div>
        ))}
      </div>

      {/* Product Cards Skeleton */}
      <div className="space-y-3 pt-2">
        <div className="w-36 h-4 bg-stone-300 rounded" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white p-3.5 rounded-2xl border border-stone-100 flex items-start justify-between gap-3"
          >
            <div className="flex-1 space-y-2">
              <div className="w-28 h-3.5 bg-stone-300 rounded" />
              <div className="w-44 h-2.5 bg-stone-200 rounded" />
              <div className="w-20 h-3.5 bg-stone-300 rounded pt-2" />
            </div>
            <div className="w-24 h-24 rounded-xl bg-stone-200 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
