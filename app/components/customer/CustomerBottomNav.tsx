"use client";

import React from "react";
import { HomeMenuIcon, MenuBookIcon, ReceiptIcon } from "./CustomerIcons";

export type CustomerNavTab = "home" | "menu" | "orders";

interface CustomerBottomNavProps {
  activeTab: CustomerNavTab;
  onSelectTab: (tab: CustomerNavTab) => void;
  orderCount?: number;
}

export function CustomerBottomNav({
  activeTab,
  onSelectTab,
  orderCount = 0,
}: CustomerBottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-[#faf8ff]/85 backdrop-blur-xl border-t border-stone-200/50 shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
      <div className="max-w-[480px] mx-auto flex justify-around items-center h-16 px-4">
        {/* Home Tab */}
        <button
          type="button"
          onClick={() => onSelectTab("home")}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] transition-colors ${
            activeTab === "home"
              ? "text-[#4338ca] font-bold"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <HomeMenuIcon className="w-5 h-5" />
          <span className="text-[11px] font-medium">Home</span>
        </button>

        {/* Menu Tab */}
        <button
          type="button"
          onClick={() => onSelectTab("menu")}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] transition-colors ${
            activeTab === "menu"
              ? "text-[#4338ca] font-bold"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <MenuBookIcon className="w-5 h-5" />
          <span className="text-[11px] font-medium">Menu</span>
        </button>

        {/* Orders Tab */}
        <button
          type="button"
          onClick={() => onSelectTab("orders")}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] transition-colors relative ${
            activeTab === "orders"
              ? "text-[#4338ca] font-bold"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <div className="relative flex items-center justify-center">
            <ReceiptIcon className="w-5 h-5" />
            {orderCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-[#4338ca] ring-2 ring-white" />
            )}
          </div>
          <span className="text-[11px] font-medium">Orders</span>
        </button>
      </div>
    </nav>
  );
}
