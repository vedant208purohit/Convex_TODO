"use client";

import React from "react";
import { CustomerOrganization } from "./types";
import { RestaurantIcon, SearchIcon, PersonIcon } from "./CustomerIcons";

interface CustomerHeaderProps {
  organization?: CustomerOrganization;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeOrderCount?: number;
}

export function CustomerHeader({
  organization,
  isSearchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  activeOrderCount = 0,
}: CustomerHeaderProps) {
  const storeName = organization?.name || "Prest Bistro & Banquet";
  const logoUrl = organization?.logoUrl;

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#faf8ff]/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-stone-200/40">
      <div className="px-4 py-2.5 max-w-[480px] mx-auto w-full flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          {/* Brand & Store Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#4338ca] flex items-center justify-center flex-shrink-0 shadow-xs overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to icon on broken image
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <RestaurantIcon className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-[10px] font-bold text-[#4338ca] tracking-wider uppercase truncate leading-none">
                PREST • ORDER
              </span>
              <h1 className="text-[15px] text-[#131b2e] font-bold truncate leading-tight mt-0.5">
                {storeName}
              </h1>
            </div>
          </div>

          {/* Right Actions: Search & Profile / Order Indicator */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              aria-label="Search menu"
              onClick={onToggleSearch}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                isSearchOpen ? "bg-[#eaedff] text-[#4338ca]" : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <SearchIcon className="w-4.5 h-4.5" />
            </button>

            <div className="relative flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-[#4338ca] flex items-center justify-center text-white shadow-xs">
                <PersonIcon className="w-4 h-4 text-white" />
              </div>
              {activeOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#005e3f] text-[#6ffbbe] text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs border border-white">
                  {activeOrderCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expandable Search Input */}
        {isSearchOpen && (
          <div className="w-full pb-1 transition-all">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search dishes, drinks, desserts..."
                autoFocus
                className="w-full bg-white border border-[#4338ca]/30 rounded-xl px-3.5 py-2 text-xs text-[#131b2e] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#4338ca]/30 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 text-stone-400 hover:text-stone-600 text-xs font-bold px-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
