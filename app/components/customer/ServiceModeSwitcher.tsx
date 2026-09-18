"use client";

import React, { useState } from "react";
import { CustomerTable, CustomerOrganization } from "./types";
import { MopedIcon, TableBarIcon, ShoppingBagIcon, VerifiedCheckIcon } from "./CustomerIcons";

interface ServiceModeSwitcherProps {
  table?: CustomerTable;
  organization?: CustomerOrganization;
}

export function ServiceModeSwitcher({ table, organization }: ServiceModeSwitcherProps) {
  const [selectedMode, setSelectedMode] = useState<"Delivery" | "Dine In" | "Take Away">("Dine In");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const tableNum = table?.tableNumber || "T12";

  const handleSelectMode = (mode: "Delivery" | "Dine In" | "Take Away") => {
    setSelectedMode(mode);
    if (mode === "Delivery") {
      setToastMessage("Table QR session active — items will be prepared for Dine In Table " + tableNum);
      setTimeout(() => setToastMessage(null), 3000);
    } else if (mode === "Take Away") {
      setToastMessage("Table QR session active — notify staff if you wish to pack your order");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <section className="flex flex-col gap-1.5">
      {/* 3-Option Switcher */}
      <div className="flex p-1 bg-[#eaedff] rounded-xl w-full">
        <button
          type="button"
          onClick={() => handleSelectMode("Delivery")}
          className={`flex-1 py-1.5 px-1 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 font-medium ${
            selectedMode === "Delivery"
              ? "bg-[#4338ca] text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          <MopedIcon className="w-4 h-4" />
          <span>Delivery</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectMode("Dine In")}
          className={`flex-1 py-1.5 px-1 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 font-medium ${
            selectedMode === "Dine In"
              ? "bg-[#4338ca] text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          <TableBarIcon className="w-4 h-4" />
          <span>Dine In</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectMode("Take Away")}
          className={`flex-1 py-1.5 px-1 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 font-medium ${
            selectedMode === "Take Away"
              ? "bg-[#4338ca] text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          <ShoppingBagIcon className="w-4 h-4" />
          <span>Take Away</span>
        </button>
      </div>

      {/* Contextual Status Line */}
      <div className="flex items-center justify-center gap-1.5 text-stone-600">
        <VerifiedCheckIcon className="w-3.5 h-3.5 text-[#005e3f]" />
        <span className="text-[11px] font-medium">
          Dine In: Table {tableNum} • Direct Kitchen Dispatch
        </span>
      </div>

      {toastMessage && (
        <div className="text-[11px] text-center text-[#4338ca] bg-[#eaedff]/70 px-2 py-1 rounded-md animate-fade-in">
          {toastMessage}
        </div>
      )}
    </section>
  );
}
