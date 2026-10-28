"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MarketplaceCategory, MarketplaceSortOption, MarketplaceTab } from "./types";

interface MarketplaceHeaderProps {
  walletBalance: number;
  activeScenario?: "A" | "B";
  activeTab: MarketplaceTab;
  activeCategory: MarketplaceCategory;
  searchQuery: string;
  sortOption: MarketplaceSortOption;
  onScenarioChange?: (scenario: "A" | "B") => void;
  onTabChange: (tab: MarketplaceTab) => void;
  onCategoryChange: (category: MarketplaceCategory) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: MarketplaceSortOption) => void;
  onAddMoneyClick: () => void;
}

const CATEGORIES: { label: string; value: MarketplaceCategory }[] = [
  { label: "All Apps (12)", value: "all" },
  { label: "Payments", value: "Payments" },
  { label: "Communication", value: "Communication" },
  { label: "Delivery & Shipping", value: "Delivery & Shipping" },
  { label: "Analytics", value: "Analytics" },
  { label: "Operations", value: "Operations" },
  { label: "Marketing", value: "Marketing" },
  { label: "Loyalty & Rewards", value: "Loyalty & Rewards" },
];

const SORT_OPTIONS: { label: string; value: MarketplaceSortOption }[] = [
  { label: "Recommended", value: "recommended" },
  { label: "A – Z", value: "a-z" },
  { label: "Recently Added", value: "recently-added" },
  { label: "Price: Low to High", value: "price-low-high" },
];

export function MarketplaceHeader({
  walletBalance,
  activeScenario,
  activeTab,
  activeCategory,
  searchQuery,
  sortOption,
  onScenarioChange,
  onTabChange,
  onCategoryChange,
  onSearchChange,
  onSortChange,
  onAddMoneyClick,
}: MarketplaceHeaderProps) {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const mobileSortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideDesktop = sortDropdownRef.current?.contains(target);
      const insideMobile = mobileSortDropdownRef.current?.contains(target);
      if (!insideDesktop && !insideMobile) {
        setIsSortOpen(false);
      }
    }
    if (isSortOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSortOpen]);

  const selectedSortLabel =
    SORT_OPTIONS.find((opt) => opt.value === sortOption)?.label || "Recommended";

  const formattedBalance = `₹${walletBalance.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div className="flex flex-col gap-3 sm:gap-3.5 w-full">
      {/* Main Title Section with Wallet Card */}
      <section className="flex flex-col gap-1.5 font-sans">
        <div className="flex items-center gap-1.5 text-[#5e5e5e] text-[11px] sm:text-xs font-medium">
          <span className="hover:text-[#0c0a09] transition-colors">Marketplace</span>
          <span className="material-symbols-outlined text-[13px] sm:text-[14px]">chevron_right</span>
          <span className="text-[#0c0a09] font-semibold truncate">
            {activeTab === "installed"
              ? "Installed Products"
              : activeTab === "purchases"
              ? "Subscriptions & Purchases"
              : activeTab === "wallet"
              ? "Wallet"
              : "Explore Products"}
          </span>
        </div>

        {/* Title & Wallet on Same Horizontal Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <h1 className="font-garamond text-[28px] sm:text-[32px] md:text-[36px] text-[#0c0a09] tracking-tight font-normal leading-tight">
            {activeTab === "installed"
              ? "Installed Products"
              : activeTab === "purchases"
              ? "Subscriptions & Purchases"
              : "Marketplace"}
          </h1>

          {/* Real-Time Wallet Balance + Add Money Action */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Link
              href="/marketplace/wallet"
              className="flex items-center gap-2 sm:gap-2.5 px-3 py-2 bg-[#fdf8f7] hover:bg-[#f1edec] transition-all rounded-xl border border-[#e7e5e4] cursor-pointer text-left group flex-1 sm:flex-initial min-w-0 shadow-2xs"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white flex items-center justify-center text-[#0c0a09] shadow-2xs border border-[#e7e5e4] group-hover:scale-105 transition-transform shrink-0">
                <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-[#7A4B00]">
                  account_balance_wallet
                </span>
              </div>
              <div className="flex flex-col text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      walletBalance >= 5000 ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-[9px] uppercase tracking-wider text-[#5e5e5e] font-bold leading-none truncate">
                    {walletBalance >= 5000 ? "Wallet Active" : "Balance Low"}
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-bold text-[#0c0a09] tracking-tight leading-none font-sans pt-0.5 truncate">
                  {formattedBalance}
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={onAddMoneyClick}
              className="flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-lg bg-[#0c0a09] hover:bg-[#262626] text-white text-xs font-semibold tracking-wide transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">add</span>
              <span className="whitespace-nowrap">Add Money</span>
            </button>
          </div>
        </div>

        <p className="text-[#5e5e5e] text-xs sm:text-[14px] max-w-2xl leading-relaxed mt-0.5 font-normal">
          {activeTab === "installed"
            ? "Manage, configure credentials, and inspect operational telemetry for apps actively integrated with your POS register."
            : activeTab === "purchases"
            ? "Review your active software licenses, recurring add-on subscriptions, and billing invoices."
            : "Everything your restaurant needs, all in one place. Integrate seamless payment gateways, conversational automations, and operational intelligence."}
        </p>
      </section>

      {/* 3. Navigation & Filter Bar Section */}
      <section className="pt-1 font-sans">
        {/* Search Field, Category Pills & Sort Dropdown */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
          {/* Top row on mobile / Left on Desktop: Search & Sort on small screens */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            {/* Live Search Field */}
            <div className="relative flex items-center flex-1 lg:w-64 xl:w-72 shrink-0">
              <span className="material-symbols-outlined absolute left-3 sm:left-3.5 text-[#5e5e5e] text-[18px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={
                  activeTab === "installed"
                    ? "Search installed apps..."
                    : activeTab === "purchases"
                    ? "Search subscriptions..."
                    : "Search apps, integrations..."
                }
                className="w-full h-9 sm:h-10 pl-9 sm:pl-10 pr-8 bg-[#fdf8f7] text-[#0c0a09] placeholder-[#5e5e5e] text-xs rounded-lg border border-[#e7e5e4] shadow-2xs outline-none focus:bg-white focus:border-[#0c0a09] focus:ring-1 focus:ring-[#0c0a09] transition-all font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 w-5 h-5 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 text-xs cursor-pointer transition-colors"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Mobile / Tablet Sort Dropdown button (placed beside search on screens < lg) */}
            <div className="relative shrink-0 lg:hidden" ref={mobileSortDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSortOpen((prev) => !prev)}
                className="h-9 sm:h-10 inline-flex items-center gap-1.5 px-2.5 sm:px-3 bg-white hover:bg-[#fdf8f7] border border-[#e7e5e4] rounded-lg text-xs font-medium text-[#0c0a09] transition-all shadow-2xs cursor-pointer focus:outline-none"
              >
                <span className="material-symbols-outlined text-[16px] text-[#5e5e5e]">
                  swap_vert
                </span>
                <span className="font-semibold text-[#0c0a09] hidden xs:inline max-w-[85px] sm:max-w-[110px] truncate text-left">
                  {selectedSortLabel}
                </span>
                <span
                  className={`material-symbols-outlined text-[15px] text-[#5e5e5e] transition-transform duration-200 ${
                    isSortOpen ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {isSortOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-[#e7e5e4] rounded-xl shadow-xl py-1.5 z-50 animate-fadeIn font-sans">
                  {SORT_OPTIONS.map((opt) => {
                    const isSelected = sortOption === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onSortChange(opt.value);
                          setIsSortOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-[#0c0a09] text-white font-semibold"
                            : "text-[#0c0a09] hover:bg-[#fdf8f7]"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <span className="text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Category Horizontal Scrolling Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto flex-1 min-w-0 py-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.value;
              const displayLabel =
                cat.value === "all"
                  ? activeTab === "installed"
                    ? "All Installed"
                    : activeTab === "purchases"
                    ? "All Subscriptions"
                    : "All Apps"
                  : cat.label;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => onCategoryChange(cat.value)}
                  className={`h-8 sm:h-9 lg:h-10 px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs whitespace-nowrap transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                    isActive
                      ? "bg-[#0c0a09] text-white font-semibold shadow-xs"
                      : "bg-[#fdf8f7] text-[#5e5e5e] hover:bg-[#f1edec] hover:text-[#0c0a09] border border-[#e7e5e4]"
                  }`}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>

          {/* Desktop Sort Dropdown (hidden on < lg) */}
          <div className="relative shrink-0 hidden lg:block" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen((prev) => !prev)}
              className="h-9 sm:h-10 inline-flex items-center gap-2 px-3.5 bg-white hover:bg-[#fdf8f7] border border-[#e7e5e4] rounded-lg text-xs font-medium text-[#0c0a09] transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
            >
              <span className="text-[10px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                Sort by:
              </span>
              <span className="font-semibold text-[#0c0a09]">
                {selectedSortLabel}
              </span>
              <span
                className={`material-symbols-outlined text-[16px] text-[#5e5e5e] transition-transform duration-200 ${
                  isSortOpen ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>

            {isSortOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-[#e7e5e4] rounded-xl shadow-xl py-1.5 z-50 animate-fadeIn font-sans">
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = sortOption === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onSortChange(opt.value);
                        setIsSortOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-[#0c0a09] text-white font-semibold"
                          : "text-[#0c0a09] hover:bg-[#fdf8f7]"
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <span className="text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
