"use client";

import React, { ReactNode } from "react";

interface ComingSoonOverlayProps {
  /** Title for the coming soon banner (default: "Coming Soon") */
  title?: string;
  /** Description message */
  description?: string;
  /** Whether the feature lock is active (default: true). Easily toggle to false when ready to resume! */
  locked?: boolean;
  /** The existing completed page content to render underneath */
  children: ReactNode;
}

export function ComingSoonOverlay({
  title = "Coming Soon",
  description,
  locked = true,
  children,
}: ComingSoonOverlayProps) {
  if (!locked) {
    return <>{children}</>;
  }

  return (
    <div className="relative w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden select-none">
      {/* 1. Underlying Completed Work (Visually Dimmed & 100% Non-Interactive) */}
      <div
        className="w-full h-full min-h-0 flex-1 flex flex-col pointer-events-none opacity-35 filter blur-[1.5px] overflow-hidden grayscale-[20%]"
        aria-hidden="true"
        tabIndex={-1}
      >
        {children}
      </div>

      {/* 2. Top Full-Width Glassmorphism Overlay (Blocks all clicks, inputs & interactions) */}
      <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-white/45 backdrop-blur-[3px] pointer-events-auto">
        <div className="bg-white/95 rounded-2xl p-7 md:p-8 max-w-md w-full shadow-2xl border border-[#e7e5e4] text-center space-y-3.5 transform transition-all animate-in zoom-in-95 duration-200 font-sans">
          {/* Lock Icon Badge */}
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#faf8f7] border border-[#e7e5e4] flex items-center justify-center text-[#141010] shadow-2xs">
            <svg
              className="w-6 h-6 text-[#141010]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f5f5f4] border border-[#e7e5e4] text-[11px] font-semibold text-[#44403c] tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Coming Soon
          </div>

          {/* Prominent Title */}
          <h2 className="font-garamond text-3xl font-normal text-[#141010] tracking-tight leading-none">
            {title}
          </h2>

          {/* Description (Only rendered if explicitly provided) */}
          {description && (
            <p className="font-sans text-xs text-[#5e5e5e] leading-relaxed max-w-xs mx-auto">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
