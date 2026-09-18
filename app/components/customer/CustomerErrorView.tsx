"use client";

import React from "react";
import { CustomerOrganization } from "./types";
import { RestaurantIcon } from "./CustomerIcons";

interface CustomerErrorViewProps {
  title?: string;
  message?: string;
  organization?: CustomerOrganization;
  onRetry?: () => void;
}

export function CustomerErrorView({
  title = "Table QR Not Available",
  message = "This table QR code is no longer active or could not be found. Please ask a member of staff for assistance.",
  organization,
  onRetry,
}: CustomerErrorViewProps) {
  const storeName = organization?.name || "our restaurant";

  return (
    <div className="min-h-screen bg-[#faf8ff] flex flex-col justify-center items-center p-6 text-[#131b2e]">
      <div className="w-full max-w-[420px] bg-white rounded-3xl p-7 shadow-lg border border-stone-100 flex flex-col items-center text-center">
        {/* Brand/Store Icon */}
        <div className="w-14 h-14 rounded-2xl bg-[#eaedff] text-[#4338ca] flex items-center justify-center mb-5 shadow-xs">
          <RestaurantIcon className="w-7 h-7 text-[#4338ca]" />
        </div>

        <span className="text-[11px] font-bold text-[#4338ca] tracking-wider uppercase mb-1">
          {storeName}
        </span>

        <h2 className="text-lg font-bold text-[#131b2e] leading-snug">
          {title}
        </h2>

        <p className="text-xs text-stone-500 mt-2 leading-relaxed">
          {message}
        </p>

        <div className="mt-6 flex flex-col w-full gap-2.5">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="w-full bg-[#4338ca] hover:bg-[#372abf] text-white py-2.5 px-4 rounded-xl text-xs font-bold transition shadow-xs"
            >
              Try Again
            </button>
          )}

          <div className="p-3 rounded-xl bg-[#eaedff]/60 border border-indigo-100 text-[11px] text-stone-600">
            Need help? Please call our floor captain or restaurant server.
          </div>
        </div>
      </div>
    </div>
  );
}
