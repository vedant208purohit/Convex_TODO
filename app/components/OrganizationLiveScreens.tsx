"use client";

import { ComingSoonOverlay } from "./ComingSoonOverlay";

export function OrganizationLiveScreens() {
  return (
    <ComingSoonOverlay
      title="Live Screens & Customer Displays"
      description="Real-time order status displays, Kitchen Display System (KDS) mirrors, and customer-facing checkout screens will be available soon."
    >
      <div className="flex-1 flex flex-col gap-6 p-2 select-none">
        <div className="flex items-center justify-between pb-4 border-b border-[#e7e5e4]">
          <div>
            <h2 className="font-garamond text-2xl font-normal text-[#141010]">
              Live Screens & Display System
            </h2>
            <p className="text-xs text-[#5e5e5e] mt-0.5 font-sans">
              Configure customer order status monitors, kitchen displays, and token screens.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-[#e7e5e4] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-semibold text-[#141010]">
                Customer Order Status Screen
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-200">
                Disabled
              </span>
            </div>
            <p className="text-xs text-[#5e5e5e] leading-relaxed font-sans">
              Display live order preparation and pickup status tokens for customer waiting areas.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#e7e5e4] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-sans text-xs font-semibold text-[#141010]">
                Customer Facing Secondary Display
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-200">
                Disabled
              </span>
            </div>
            <p className="text-xs text-[#5e5e5e] leading-relaxed font-sans">
              Show order items, subtotal, and QR payment codes on cash counter secondary monitors.
            </p>
          </div>
        </div>
      </div>
    </ComingSoonOverlay>
  );
}
