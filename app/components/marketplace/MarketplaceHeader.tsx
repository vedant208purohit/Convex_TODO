"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MarketplaceCategory, MarketplaceSortOption, MarketplaceTab } from "./types";

interface MarketplaceHeaderProps {
  walletBalance: number;
  activeScenario: "A" | "B";
  activeTab: MarketplaceTab;
  activeCategory: MarketplaceCategory;
  searchQuery: string;
  sortOption: MarketplaceSortOption;
  onScenarioChange: (scenario: "A" | "B") => void;
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
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
    <div className="flex flex-col gap-3.5 w-full">
      {/* 1. Prototype Scenario Testing Switcher Bar */}
      <div className="w-full bg-[#ede7e4]/70 px-3.5 py-1.5 rounded-xl flex flex-wrap items-center justify-between gap-2.5 border border-[#d0c4be]/40">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#141010] text-white text-[10px] font-bold">
            !
          </span>
          <span className="text-xs font-semibold text-stone-900 tracking-wider uppercase">
            Testing Switcher:
          </span>
          <span className="text-xs text-stone-600 hidden sm:inline">
            Toggle checkout flow conditions on WhatsApp Automation
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onScenarioChange("A")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeScenario === "A"
                ? "bg-[#141010] text-white shadow-sm"
                : "bg-white/80 hover:bg-white text-stone-700 border border-stone-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeScenario === "A" ? "bg-emerald-400" : "bg-stone-400"
              }`}
            />
            <span>Sufficient Balance (₹8,000)</span>
          </button>

          <button
            type="button"
            onClick={() => onScenarioChange("B")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeScenario === "B"
                ? "bg-[#141010] text-white shadow-sm"
                : "bg-white/80 hover:bg-white text-stone-700 border border-stone-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeScenario === "B" ? "bg-amber-400" : "bg-stone-400"
              }`}
            />
            <span>Low Balance (₹2,000)</span>
          </button>
        </div>
      </div>

      {/* 2. Main Title Section with Wallet Card */}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-stone-500 text-xs font-medium">
          <span className="hover:text-stone-900 transition-colors">Marketplace</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-stone-900 font-semibold">
            {activeTab === "installed"
              ? "Installed Products"
              : activeTab === "categories"
              ? "Categories"
              : activeTab === "purchases"
              ? "Subscriptions & Purchases"
              : activeTab === "wallet"
              ? "Wallet"
              : "Explore Products"}
          </span>
        </div>

        {/* Title & Wallet on Same Horizontal Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="font-garamond text-3xl sm:text-4xl text-stone-900 tracking-tight font-normal leading-tight">
            Marketplace
          </h1>

          {/* Real-Time Wallet Balance + Add Money Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/marketplace/wallet"
              className="flex items-center gap-2.5 px-3 py-1.5 bg-[#FAF6F1] hover:bg-[#F3ECE4] transition-all rounded-xl border border-[#E8E2D8] cursor-pointer text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-stone-800 shadow-2xs border border-stone-200/70 group-hover:scale-105 transition-transform shrink-0">
                <span className="material-symbols-outlined text-[18px] text-[#7A4B00]">
                  account_balance_wallet
                </span>
              </div>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      walletBalance >= 5000 ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <span className="text-[9px] uppercase tracking-wider text-stone-500 font-bold leading-none">
                    {walletBalance >= 5000 ? "Wallet Active" : "Balance Low"}
                  </span>
                </div>
                <span className="text-sm font-bold text-stone-900 tracking-tight leading-none font-sans pt-0.5">
                  {formattedBalance}
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={onAddMoneyClick}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#141010] hover:bg-black text-white text-xs font-semibold tracking-wide transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0 self-stretch"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span className="whitespace-nowrap">Add Money</span>
            </button>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
          Everything your restaurant needs, all in one place. Integrate seamless payment
          gateways, conversational automations, and operational intelligence.
        </p>
      </section>

      {/* 3. Navigation & Filter Bar Section */}
      <section className="pt-1">
        {/* Search Field, Category Pills & Sort Dropdown */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Live Search Field */}
          <div className="relative flex items-center w-full lg:w-72 shrink-0">
            <span className="material-symbols-outlined absolute left-3.5 text-stone-400 text-[18px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search apps, integrations..."
              className="w-full h-9 sm:h-10 pl-10 pr-8 bg-white text-stone-900 placeholder:text-stone-400 text-xs rounded-xl border border-[#e7e5e4] shadow-2xs outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 transition-all font-sans"
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

          {/* Category Horizontal Scrolling Pills */}
          <div className="flex items-center gap-2 overflow-x-auto flex-1 py-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => onCategoryChange(cat.value)}
                  className={`h-9 sm:h-10 px-3.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer flex items-center justify-center ${
                    isActive
                      ? "bg-[#141010] text-white font-semibold shadow-xs"
                      : "bg-[#faf2ee] text-stone-600 hover:bg-[#ede7e4] border border-stone-200/50"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Custom Project-Styled Sort Dropdown */}
          <div className="relative shrink-0 self-end lg:self-auto" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen((prev) => !prev)}
              className="h-9 sm:h-10 inline-flex items-center gap-2 px-3.5 bg-white hover:bg-[#faf2ee] border border-[#e7e5e4] rounded-xl text-xs font-medium text-stone-900 transition-all shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#141010]"
            >
              <span className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                Sort by:
              </span>
              <span className="font-semibold text-stone-900">
                {selectedSortLabel}
              </span>
              <span
                className={`material-symbols-outlined text-[16px] text-stone-500 transition-transform duration-200 ${
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
                          : "text-stone-800 hover:bg-[#faf2ee]"
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
