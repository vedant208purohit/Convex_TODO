"use client";

import React from "react";
import { CustomerTable } from "./types";
import { KitchenIcon } from "./CustomerIcons";

interface KitchenInfoBannerProps {
  table?: CustomerTable;
}

export function KitchenInfoBanner({ table }: KitchenInfoBannerProps) {
  const tableNum = table?.tableNumber || "T12";

  return (
    <section className="p-3.5 rounded-2xl bg-[#eaedff] flex items-center gap-3.5 border border-indigo-100/60 shadow-xs">
      <div className="w-10 h-10 rounded-xl bg-[#e3dfff] flex items-center justify-center text-[#2a14b4] flex-shrink-0">
        <KitchenIcon className="w-5 h-5 text-[#2a14b4]" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-[#131b2e]">
          Kitchen Queue: Fast (12–15 mins)
        </span>
        <span className="text-[11px] text-stone-500 leading-snug">
          Direct thermal receipt print at Chef's Station Table {tableNum}.
        </span>
      </div>
    </section>
  );
}
