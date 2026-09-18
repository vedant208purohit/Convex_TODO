"use client";

import React from "react";
import { useCustomerCart } from "./CustomerCartContext";
import { CustomerTable } from "./types";
import { ShoppingCartIcon, ArrowForwardIcon } from "./CustomerIcons";

interface StickyCartBarProps {
  table?: CustomerTable;
  onViewCart?: () => void;
}

export function StickyCartBar({ table, onViewCart }: StickyCartBarProps) {
  const { totalItemCount, formattedTotal } = useCustomerCart();

  if (totalItemCount === 0) {
    return null;
  }

  const tableNum = table?.tableNumber || "T12";

  return (
    <div className="sticky bottom-[72px] sm:bottom-[76px] z-40 w-full mt-auto mb-2 animate-slide-up">
      <div className="bg-[#4338ca] text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 border border-indigo-400/30 backdrop-blur-xs">
        {/* Left: Cart details */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <ShoppingCartIcon className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 leading-none mb-1">
              <span className="text-xs font-bold">
                {totalItemCount} {totalItemCount === 1 ? "Item" : "Items"}
              </span>
              <span className="opacity-60 text-xs">•</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-semibold text-white">
                Table {tableNum}
              </span>
            </div>
            <span className="text-sm font-bold leading-tight">
              {formattedTotal}
            </span>
          </div>
        </div>

        {/* Right: View Cart action */}
        <button
          type="button"
          onClick={onViewCart}
          className="bg-white text-[#4338ca] hover:bg-stone-50 active:scale-95 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs flex-shrink-0"
        >
          <span>View Cart</span>
          <ArrowForwardIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
