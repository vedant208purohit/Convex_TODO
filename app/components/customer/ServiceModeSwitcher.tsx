"use client";

import React, { useState } from "react";
import { CustomerTable, CustomerOrganization, CustomerServiceMode } from "./types";
import { useCustomerCart } from "./CustomerCartContext";
import { MopedIcon, TableBarIcon, ShoppingBagIcon, VerifiedCheckIcon } from "./CustomerIcons";

interface ServiceModeSwitcherProps {
  table?: CustomerTable;
  organization?: CustomerOrganization;
  showContextLine?: boolean;
  onOpenDeliveryLocation?: () => void;
}

export function ServiceModeSwitcher({
  table,
  organization,
  showContextLine = true,
  onOpenDeliveryLocation,
}: ServiceModeSwitcherProps) {
  const { serviceMode, setServiceMode, deliveryAddress } = useCustomerCart();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const tableNum = table?.tableNumber || "T12";

  const handleSelectMode = (mode: CustomerServiceMode) => {
    setServiceMode(mode);
    if (mode === "delivery") {
      if (onOpenDeliveryLocation) {
        onOpenDeliveryLocation();
      } else {
        setToastMessage("Delivery mode selected — please confirm delivery address");
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else if (mode === "takeaway") {
      setToastMessage("Table QR session active — kitchen will package order for takeaway");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const isDelivery = serviceMode === "delivery";
  const isDineIn = serviceMode === "dine_in";
  const isTakeaway = serviceMode === "takeaway";

  const displayAddress = deliveryAddress
    ? `${deliveryAddress.houseFlatBlock ? deliveryAddress.houseFlatBlock + ", " : ""}${deliveryAddress.apartmentRoadArea}`
    : "Select delivery address";

  return (
    <section className="flex flex-col gap-1.5 w-full">
      {/* 3-Option Switcher */}
      <div className="flex p-1 bg-[#eaedff] rounded-full w-full shadow-2xs">
        {/* Delivery Button */}
        <button
          type="button"
          onClick={() => handleSelectMode("delivery")}
          className={`flex-1 py-1.5 px-1 rounded-full text-xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
            isDelivery
              ? "bg-[#4338ca] text-white shadow-sm font-semibold"
              : "text-[#464554] hover:text-[#131b2e] font-medium"
          }`}
        >
          <MopedIcon className={`w-3.5 h-3.5 ${isDelivery ? "text-white" : "text-[#464554]"}`} />
          <span className={isDelivery ? "text-white" : "text-[#464554]"}>
            Delivery
          </span>
        </button>

        {/* Dine In Button */}
        <button
          type="button"
          onClick={() => handleSelectMode("dine_in")}
          className={`flex-1 py-1.5 px-1 rounded-full text-xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
            isDineIn
              ? "bg-[#4338ca] text-white shadow-sm font-semibold"
              : "text-[#464554] hover:text-[#131b2e] font-medium"
          }`}
        >
          <TableBarIcon className={`w-3.5 h-3.5 ${isDineIn ? "text-white" : "text-[#464554]"}`} />
          <span className={isDineIn ? "text-white" : "text-[#464554]"}>
            Dine In
          </span>
        </button>

        {/* Take Away Button */}
        <button
          type="button"
          onClick={() => handleSelectMode("takeaway")}
          className={`flex-1 py-1.5 px-1 rounded-full text-xs transition-all flex items-center justify-center gap-1 cursor-pointer ${
            isTakeaway
              ? "bg-[#4338ca] text-white shadow-sm font-semibold"
              : "text-[#464554] hover:text-[#131b2e] font-medium"
          }`}
        >
          <ShoppingBagIcon className={`w-3.5 h-3.5 ${isTakeaway ? "text-white" : "text-[#464554]"}`} />
          <span className={isTakeaway ? "text-white" : "text-[#464554]"}>
            Take Away
          </span>
        </button>
      </div>

      {/* Delivery Address Bar (When delivery mode is active) */}
      {isDelivery && (
        <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-xl px-3 py-2 flex items-center justify-between transition-all">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold text-[#4338ca] tracking-wider">
                Delivering To ({deliveryAddress?.addressType || "Home"})
              </div>
              <p className="text-xs font-semibold text-slate-800 truncate">
                {displayAddress}
              </p>
            </div>
          </div>
          {onOpenDeliveryLocation && (
            <button
              type="button"
              onClick={onOpenDeliveryLocation}
              className="text-xs font-bold text-[#4338ca] hover:text-[#3730a3] underline ml-2 flex-shrink-0 cursor-pointer"
            >
              {deliveryAddress ? "Change" : "Select"}
            </button>
          )}
        </div>
      )}

      {/* Contextual Status Line */}
      {showContextLine && !isDelivery && (
        <div className="flex items-center justify-center gap-1.5 text-[#464554] pt-0.5">
          <VerifiedCheckIcon className="w-3.5 h-3.5 text-[#005e3f]" />
          <span className="text-[11px] font-medium">
            {isDineIn && `Dine In: Table ${tableNum} • Direct Kitchen Dispatch`}
            {isTakeaway && `Take Away: Packed for Table ${tableNum}`}
          </span>
        </div>
      )}

      {toastMessage && (
        <div className="text-[11px] text-center text-[#4338ca] bg-[#eaedff]/90 border border-indigo-200/50 px-2 py-1 rounded-lg animate-fade-in">
          {toastMessage}
        </div>
      )}
    </section>
  );
}
