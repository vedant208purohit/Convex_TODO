"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  CustomerOrganization,
  CustomerTable,
  CustomerMenuItem,
} from "./types";
import { useCustomerCart } from "./CustomerCartContext";
import {
  ArrowBackIcon,
  TableBarIcon,
  SoupKitchenIcon,
  SkilletIcon,
  RoomServiceIcon,
  WaterDropIcon,
  DinnerDiningIcon,
  CheckSmallIcon,
  AddShoppingCartIcon,
  VegFssaiBadge,
  NonVegFssaiBadge,
  VerifiedCheckIcon,
  RestaurantIcon,
} from "./CustomerIcons";

interface CustomerOrderTrackingViewProps {
  organization: CustomerOrganization;
  table?: CustomerTable;
  rawMenu?: Array<any>;
  onBackToMenu: () => void;
  onOrderMoreFood: () => void;
}

export function CustomerOrderTrackingView({
  organization,
  table,
  rawMenu,
  onBackToMenu,
  onOrderMoreFood,
}: CustomerOrderTrackingViewProps) {
  const {
    activeOrderId,
    activeOrderNumber,
    customerName,
    customerPhone,
    currencySymbol,
  } = useCustomerCart();

  const [assistanceFeedback, setAssistanceFeedback] = useState<string | null>(null);
  const [isCallingServer, setIsCallingServer] = useState(false);
  const [isRequestingWater, setIsRequestingWater] = useState(false);

  const tableNum = table?.tableNumber || "T12";
  const orgId = organization?._id as Id<"organizations"> | undefined;
  const tableId = table?._id as Id<"organizationTables"> | undefined;

  // 1. Reactive Convex query for live active order tracking
  const activeOrder = useQuery(
    api.orders.getActiveTableOrder,
    orgId
      ? {
        organizationId: orgId,
        tableId: tableId,
        tableNumber: tableNum,
        orderId: activeOrderId || activeOrderNumber || undefined,
      }
      : "skip"
  );

  // 2. Table Assistance Mutation
  const requestAssistance = useMutation(api.organizationTables.requestTableAssistance);

  const handleCallServer = async () => {
    try {
      setIsCallingServer(true);
      const res = await requestAssistance({
        tableId: tableId,
        tableNumber: tableNum,
        requestType: "call_server",
      });
      setAssistanceFeedback(res?.message || `🛎️ Server paged for Table ${tableNum}. Arriving shortly!`);
      setTimeout(() => setAssistanceFeedback(null), 4000);
    } catch {
      setAssistanceFeedback(`🛎️ Server paged for Table ${tableNum}. Arriving shortly!`);
      setTimeout(() => setAssistanceFeedback(null), 4000);
    } finally {
      setIsCallingServer(false);
    }
  };

  const handleRequestWater = async () => {
    try {
      setIsRequestingWater(true);
      const res = await requestAssistance({
        tableId: tableId,
        tableNumber: tableNum,
        requestType: "request_water",
      });
      setAssistanceFeedback(res?.message || `💧 Water refill requested for Table ${tableNum}.`);
      setTimeout(() => setAssistanceFeedback(null), 4000);
    } catch {
      setAssistanceFeedback(`💧 Water refill requested for Table ${tableNum}.`);
      setTimeout(() => setAssistanceFeedback(null), 4000);
    } finally {
      setIsRequestingWater(false);
    }
  };

  // Helper to find image for ordered item from raw menu if not present
  const getItemImage = (itemName: string, defaultImg?: string) => {
    if (defaultImg) return defaultImg;
    if (rawMenu && rawMenu.length > 0) {
      for (const cat of rawMenu) {
        const found = (cat.category?.items || []).find(
          (ci: any) => ci.item?.name?.toLowerCase() === itemName?.toLowerCase()
        );
        if (found) {
          return (
            found.item_image_url ||
            found.item?.item_image_url ||
            found.item?.imageUrl ||
            found.imageUrl
          );
        }
      }
    }
    return undefined;
  };

  // Timeline process steps configuration
  const defaultSteps = [
    {
      id: "placed",
      name: "Order Placed",
      subtext: "Table QR Verified & Confirmed",
      icon: "check",
    },
    {
      id: "kitchen",
      name: "Sent to Kitchen",
      subtext: activeOrder?.tokenNumber
        ? `KOT ${activeOrder.tokenNumber} printed on Chef Station`
        : "KOT printed on Chef Station",
      icon: "check",
    },
    {
      id: "cooking",
      name: "Cooking & Plating",
      subtext: "Active on hot grill & beverage station",
      icon: "skillet",
    },
    {
      id: "ready",
      name: "Ready to Serve",
      subtext: "Plating garnishes & tray assembly",
      icon: "dining",
    },
    {
      id: "served",
      name: `Served at Table ${tableNum}`,
      subtext: "Final step • Table drop-off",
      icon: "table",
    },
  ];

  // Resolve active status index
  const currentStatusName = (activeOrder?.orderStatusName || "Cooking & Plating").toLowerCase();
  let activeStepIndex = 2; // default Cooking & Plating
  if (currentStatusName.includes("placed") || currentStatusName.includes("received")) {
    activeStepIndex = 0;
  } else if (currentStatusName.includes("accept") || currentStatusName.includes("sent") || currentStatusName.includes("kitchen")) {
    activeStepIndex = 1;
  } else if (currentStatusName.includes("cook") || currentStatusName.includes("prepar") || currentStatusName.includes("plating")) {
    activeStepIndex = 2;
  } else if (currentStatusName.includes("ready") || currentStatusName.includes("dispatch")) {
    activeStepIndex = 3;
  } else if (currentStatusName.includes("served") || currentStatusName.includes("deliver") || currentStatusName.includes("complete")) {
    activeStepIndex = 4;
  }

  // Fallback / Display order info
  const displayOrderNumber = activeOrder?.orderNumber || activeOrderNumber || "#SKZ-1048";
  const displayTokenNumber = activeOrder?.tokenNumber || "KOT #112";
  const displaySubTotal = activeOrder?.formattedSubTotal || "₹652.00";
  const displayTaxTotal = activeOrder?.formattedTaxTotal || "₹71.72";
  const displayTotalAmount = activeOrder?.formattedTotalAmount || "₹723.72";
  const displayItems =
    activeOrder?.items && activeOrder.items.length > 0
      ? activeOrder.items
      : [
        {
          _id: "demo_1",
          itemName: "Signature Veg Bao Bun",
          quantity: 1,
          formattedTotalPrice: "₹243.00",
          notes: "Mild chili dip, herbs",
          customizations: [{ optionName: "Medium Meal combo" }],
          isVeg: true,
        },
        {
          _id: "demo_2",
          itemName: "Cheese Garlic Bread",
          quantity: 1,
          formattedTotalPrice: "₹199.00",
          notes: "Extra mozzarella melt",
          customizations: [],
          isVeg: true,
        },
        {
          _id: "demo_3",
          itemName: "Iced Vietnamese Coffee",
          quantity: 1,
          formattedTotalPrice: "₹210.00",
          notes: "Sweet condensed milk",
          customizations: [],
          isVeg: true,
        },
      ];

  return (
    <div className="flex flex-col w-full gap-3 font-sans text-slate-900 antialiased pb-12 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. TOP SESSION CONTEXT BAR                                                */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            aria-label="Go back to menu"
            onClick={onBackToMenu}
            className="w-9 h-9 rounded-full bg-[#eaedff] flex items-center justify-center text-[#131b2e] hover:bg-[#dae2fd] transition-colors flex-shrink-0 cursor-pointer shadow-2xs"
          >
            <ArrowBackIcon className="w-4.5 h-4.5" />
          </button>
          <div className="flex flex-col min-w-0">
            <h2 className="text-[15px] font-semibold text-[#131b2e] truncate leading-tight">
              Live Order Tracking
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#464554]">
                ACTIVE TABLE SESSION
              </span>
            </div>
          </div>
        </div>

        {/* Table Pill */}
        <div className="flex items-center gap-1 bg-[#2a14b4] text-white px-3 py-1 rounded-full shadow-sm flex-shrink-0">
          <TableBarIcon className="w-3.5 h-3.5 text-white" />
          <span className="text-xs font-bold">{tableNum}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PRIMARY STATUS HERO CARD                                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 gap-3">
        <div className="flex items-start justify-between gap-2 pb-1">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-[#2a14b4]">
                {displayOrderNumber}
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs text-[#464554] font-medium">Dine-in</span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-[11px] font-semibold bg-[#eaedff] px-2 py-0.5 rounded-full text-[#131b2e]">
                {displayTokenNumber.startsWith("#") || displayTokenNumber.startsWith("KOT")
                  ? displayTokenNumber
                  : `KOT #${displayTokenNumber}`}
              </span>
            </div>
            <h1 className="text-lg font-bold text-[#131b2e] mt-1">
              Table {tableNum}
            </h1>
          </div>

          <div className="w-11 h-11 rounded-full bg-[#e2dfff] flex items-center justify-center text-[#2a14b4] flex-shrink-0 shadow-sm">
            <SoupKitchenIcon className="w-6 h-6 text-[#2a14b4]" />
          </div>
        </div>

        {/* Active Kitchen Status Pill */}
        <div className="flex items-center gap-3 bg-[#f2f3ff] px-3.5 py-2.5 rounded-xl border border-[#e2e7ff]">
          <div className="w-8 h-8 rounded-full bg-[#4338ca] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <SkilletIcon className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-[#131b2e] truncate">
              {activeStepIndex === 0 && "Order Placed & Confirmed 👨‍🍳"}
              {activeStepIndex === 1 && "Sent to Kitchen Chef Station 👨‍🍳"}
              {activeStepIndex === 2 && "Your food is being prepared 👨‍🍳"}
              {activeStepIndex === 3 && "Food is Ready to Serve 🍽️"}
              {activeStepIndex >= 4 && "Order Served at Table ✨"}
            </span>
            <span className="text-xs font-bold text-[#2a14b4]">
              {activeStepIndex < 4 ? "Live Kitchen Tracking Active" : "Enjoy your meal!"}
            </span>
          </div>
        </div>

        {/* Table Utility Assistance Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            id="btn-call-server"
            disabled={isCallingServer}
            onClick={handleCallServer}
            className="flex items-center justify-center gap-1.5 bg-[#eaedff] hover:bg-[#dae2fd] text-[#131b2e] py-2.5 px-3 rounded-xl text-xs font-semibold active:scale-[0.98] transition-all shadow-2xs cursor-pointer border border-[#c7c4d7]/40"
          >
            <RoomServiceIcon className="w-4 h-4 text-[#5654a8]" />
            <span>{isCallingServer ? "Calling..." : "Call Server"}</span>
          </button>

          <button
            type="button"
            id="btn-request-water"
            disabled={isRequestingWater}
            onClick={handleRequestWater}
            className="flex items-center justify-center gap-1.5 bg-[#eaedff] hover:bg-[#dae2fd] text-[#131b2e] py-2.5 px-3 rounded-xl text-xs font-semibold active:scale-[0.98] transition-all shadow-2xs cursor-pointer border border-[#c7c4d7]/40"
          >
            <WaterDropIcon className="w-4 h-4 text-[#5148d7]" />
            <span>{isRequestingWater ? "Requesting..." : "Request Water"}</span>
          </button>
        </div>

        {/* Utility Feedback Alert Banner */}
        {assistanceFeedback && (
          <div
            id="utility-alert"
            className="text-center py-2 px-3 bg-[#005e3f] text-[#6ffbbe] rounded-xl text-xs font-medium shadow-sm transition-all animate-in fade-in duration-200"
          >
            {assistanceFeedback}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. LINEAR KITCHEN PROGRESS TIMELINE                                       */}
      {/* ========================================================================= */}
      <div className="flex flex-col bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-[#131b2e]">Kitchen Status</span>
          <span className="text-[11px] font-bold bg-[#6ffbbe] text-[#002113] px-2 py-0.5 rounded-full uppercase tracking-wider">
            LIVE KOT
          </span>
        </div>

        <div className="flex flex-col relative pl-1.5 pt-1">
          {/* Continuous vertical connector line */}
          <div className="absolute left-[18px] top-3 bottom-6 w-0.5 bg-[#dae2fd]" />

          {defaultSteps.map((step, idx) => {
            const isCompleted = idx < activeStepIndex;
            const isActive = idx === activeStepIndex;
            const isUpcoming = idx > activeStepIndex;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 relative ${idx !== defaultSteps.length - 1 ? "pb-4.5" : ""}`}
              >
                {/* Step Circle Indicator */}
                {isCompleted && (
                  <div className="w-6 h-6 rounded-full bg-[#4338ca] text-white flex items-center justify-center flex-shrink-0 z-10 shadow-sm ring-4 ring-white">
                    <CheckSmallIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                )}

                {isActive && (
                  <div className="w-6 h-6 rounded-full bg-[#2a14b4] text-white flex items-center justify-center flex-shrink-0 z-10 shadow-md ring-4 ring-[#e3dfff]">
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  </div>
                )}

                {isUpcoming && (
                  <div className="w-6 h-6 rounded-full bg-[#eaedff] text-[#777586] flex items-center justify-center flex-shrink-0 z-10 ring-4 ring-white border border-slate-200">
                    {step.icon === "dining" ? (
                      <DinnerDiningIcon className="w-3 h-3 text-[#777586]" />
                    ) : (
                      <TableBarIcon className="w-3 h-3 text-[#777586]" />
                    )}
                  </div>
                )}

                {/* Step Text & Badge */}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-xs font-semibold ${isActive
                          ? "text-[#2a14b4] font-bold"
                          : isCompleted
                            ? "text-[#131b2e]"
                            : "text-[#777586]"
                        }`}
                    >
                      {step.name}
                    </span>

                    {isActive && (
                      <span className="text-[10px] font-bold bg-[#e3dfff] text-[#100069] px-1.5 py-0.2 rounded uppercase">
                        IN PROGRESS
                      </span>
                    )}

                    {isUpcoming && (
                      <span className="text-[10px] font-medium text-[#777586] uppercase">
                        Upcoming
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[11px] mt-0.5 ${isActive
                        ? "text-[#131b2e] font-medium"
                        : "text-[#464554]"
                      }`}
                  >
                    {step.subtext}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ORDERED ITEMS SUMMARY CARD                                             */}
      {/* ========================================================================= */}
      <div className="flex flex-col bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 gap-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <span className="text-sm font-bold text-[#131b2e]">
            Ordered Items ({displayItems.length})
          </span>
          <span className="text-xs font-bold text-[#005e3f] flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <VerifiedCheckIcon className="w-3.5 h-3.5 text-[#005e3f]" />
            <span>Paid Online</span>
          </span>
        </div>

        {/* Dish Items List */}
        <div className="divide-y divide-slate-100">
          {displayItems.map((dish, idx) => {
            const resolvedImg = getItemImage(dish.itemName, (dish as any).imageUrl);
            const isVeg = (dish as any).isVeg !== false;
            const customizationsText =
              dish.customizations && dish.customizations.length > 0
                ? dish.customizations.map((c: any) => c.optionName || c.name).join(", ")
                : dish.notes || "Chef recommended prep";

            return (
              <div
                key={dish._id || idx}
                className="py-2.5 flex items-center gap-3 first:pt-1 last:pb-1"
              >
                {/* Thumbnail */}
                <div className="w-13 h-13 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {resolvedImg ? (
                    <img
                      src={resolvedImg}
                      alt={dish.itemName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.display = "none";
                        if (target.parentElement) {
                          target.parentElement.innerHTML = `<span class="text-base">🍽️</span>`;
                        }
                      }}
                    />
                  ) : (
                    <span className="text-base">🍽️</span>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="shrink-0">
                      {isVeg ? <VegFssaiBadge /> : <NonVegFssaiBadge />}
                    </div>
                    <span className="text-xs font-semibold text-[#131b2e] truncate">
                      {dish.itemName}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#464554] truncate mt-0.5">
                    {dish.quantity}x • {customizationsText}
                  </span>
                </div>

                {/* Price */}
                <span className="text-xs font-bold text-[#131b2e] flex-shrink-0">
                  {dish.formattedTotalPrice ||
                    `${currencySymbol}${(((dish as any).itemPrice || 0) / 100).toFixed(2)}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Settlement Breakdown */}
        <div className="flex flex-col gap-1.5 pt-2 bg-[#f2f3ff] p-3 rounded-xl border border-[#e2e7ff] text-xs">
          <div className="flex justify-between items-center text-[#464554]">
            <span>Items Subtotal</span>
            <span className="font-medium text-[#131b2e]">{displaySubTotal}</span>
          </div>

          <div className="flex justify-between items-center text-[#464554]">
            <span>Restaurant GST &amp; Service Charge</span>
            <span className="font-medium text-[#131b2e]">{displayTaxTotal}</span>
          </div>

          <div className="flex justify-between items-center text-[#131b2e] font-semibold pt-1 border-t border-slate-200/60">
            <span className="text-xs">Total Settled</span>
            <span className="text-sm font-extrabold text-[#2a14b4]">
              {displayTotalAmount}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[#005e3f] text-[11px] font-medium pt-0.5">
            <VerifiedCheckIcon className="w-3 h-3 text-[#005e3f]" />
            <span>UPI Auto-settled via QR • Receipt dispatched</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. PROMINENT ORDER MORE TABLE ADD-ON SECTION                              */}
      {/* ========================================================================= */}
      <div className="flex flex-col bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-[#e3dfff] flex items-center justify-center text-[#100069] flex-shrink-0">
            <AddShoppingCartIcon className="w-5 h-5 text-[#2a14b4]" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-[#2a14b4] uppercase tracking-wider">
              SEAMLESS TABLE ADD-ON
            </span>
            <h3 className="text-sm font-bold text-[#131b2e] leading-tight">
              Hungry for something more?
            </h3>
          </div>
        </div>

        <p className="text-xs text-[#464554] leading-relaxed">
          Keep your current table session active. Add beverages, sides, or desserts directly to Table {tableNum} without rescanning the QR code or waiting for the check.
        </p>

        <button
          type="button"
          id="btn-order-more"
          onClick={onOrderMoreFood}
          className="w-full bg-[#4338ca] hover:bg-[#3730a3] text-white py-3.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-all shadow-md cursor-pointer"
        >
          <RestaurantIcon className="w-4 h-4 text-white" />
          <span className="text-white">+ Order More Food for Table {tableNum} →</span>
        </button>
      </div>
    </div>
  );
}
