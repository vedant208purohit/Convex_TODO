"use client";

import React, { useState } from "react";
import {
  CustomerOrganization,
  CustomerTable,
  CustomerMenuItem,
  CartItem,
} from "./types";
import { useCustomerCart } from "./CustomerCartContext";
import {
  ArrowBackIcon,
  TableBarIcon,
  KitchenIcon,
  BoltIcon,
  SkilletIcon,
  EditNoteIcon,
  InfoIcon,
  TouchAppIcon,
  AddCircleIcon,
  ReceiptIcon,
  VerifiedCheckIcon,
  VegFssaiBadge,
  NonVegFssaiBadge,
  PlusIcon,
  MinusIcon,
  ArrowForwardIcon,
} from "./CustomerIcons";
import { ServiceModeSwitcher } from "./ServiceModeSwitcher";
import { ProductCustomizationModal } from "./ProductCustomizationModal";

interface CustomerCartViewProps {
  organization: CustomerOrganization;
  table: CustomerTable;
  rawMenu?: Array<any>;
  onBackToMenu: () => void;
  onProceedToPayment?: () => void;
}

export function CustomerCartView({
  organization,
  table,
  rawMenu,
  onBackToMenu,
  onProceedToPayment,
}: CustomerCartViewProps) {
  const {
    items,
    totalItemCount,
    customerPhone,
    setCustomerPhone,
    customerName,
    setCustomerName,
    kitchenInstructions,
    setKitchenInstructions,
    updateQuantity,
    updateItemCustomizations,
    billSummary,
    currencySymbol,
  } = useCustomerCart();

  // State for editing customizations on an existing cart item
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

  const storeName = organization?.name || "Skyz Bistro & Banquet";
  const tableNum = table?.tableNumber || "T12";

  // Helper to find full product details (including all customization groups) from raw menu
  const getProductDetails = (cartItem: CartItem): CustomerMenuItem => {
    if (rawMenu && rawMenu.length > 0) {
      for (const catObj of rawMenu) {
        const found = (catObj.category?.items || []).find(
          (ci: any) => ci.item?.id === cartItem.itemId
        );
        if (found) {
          return {
            id: found.item.id,
            name: found.item.name,
            price: found.item.price,
            display_price: found.item.display_price,
            description: found.item.description,
            published: found.item.published ?? true,
            is_available: found.item.is_available ?? true,
            is_veg: found.item.is_veg ?? true,
            customizations: found.customizations || [],
            item_image_url: found.item_image_url || cartItem.imageUrl,
          };
        }
      }
    }

    // Fallback: build minimal item from cartItem
    return {
      id: cartItem.itemId,
      name: cartItem.name,
      price: cartItem.price,
      display_price: (cartItem.price / 100).toFixed(2),
      published: true,
      is_available: true,
      is_veg: cartItem.isVeg,
      item_image_url: cartItem.imageUrl,
      customizations: cartItem.customizations
        ? [
            {
              id: "cust_edit",
              name: "Options & Add-ons",
              customization_type: "Add-Ons",
              required: false,
              max_selected: 5,
              position: 1,
              published: true,
              customization_items: cartItem.customizations.map((c, idx) => ({
                id: c.optionId,
                name: c.optionName,
                price: c.price,
                display_price: (c.price / 100).toFixed(2),
                is_available: true,
                position: idx + 1,
              })),
            },
          ]
        : [],
    };
  };

  // Helper to format customization summary text (e.g. "Medium Meal • +Extra Cheese • No Onion")
  const formatCustomizationSummary = (cartItem: CartItem): string => {
    const parts: string[] = [];

    if (cartItem.customizations && cartItem.customizations.length > 0) {
      cartItem.customizations.forEach((c) => {
        if (c.price > 0) {
          parts.push(`+${c.optionName}`);
        } else {
          parts.push(c.optionName);
        }
      });
    }

    if (cartItem.preferences && cartItem.preferences.length > 0) {
      cartItem.preferences.forEach((p) => {
        parts.push(p);
      });
    }

    return parts.join(" • ");
  };

  const handlePayClick = () => {
    if (onProceedToPayment) {
      onProceedToPayment();
    } else {
      alert(`Order for Table ${tableNum} placed successfully! Instant KOT sent to Kitchen Chef Station.`);
    }
  };

  return (
    <div className="flex flex-col w-full gap-3 pb-8 animate-in fade-in duration-200">
      {/* 1. Top Dine-In Context & Back Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            aria-label="Go back"
            onClick={onBackToMenu}
            className="w-9 h-9 rounded-full bg-[#eaedff] flex items-center justify-center text-[#131b2e] hover:bg-[#dae2fd] transition-colors flex-shrink-0 cursor-pointer shadow-2xs"
          >
            <ArrowBackIcon className="w-4.5 h-4.5" />
          </button>
          <div className="flex flex-col min-w-0">
            <h2 className="text-[16px] font-semibold text-[#131b2e] leading-tight">
              Your Cart
            </h2>
            <span className="text-[11px] font-semibold text-[#2a14b4] truncate mt-0.5">
              {storeName} • Table {tableNum}
            </span>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-[#005e3f] text-[#6ffbbe] text-[11px] font-semibold flex items-center gap-1 shadow-2xs flex-shrink-0">
          <TableBarIcon className="w-3.5 h-3.5 text-[#6ffbbe]" />
          <span>{tableNum} Active</span>
        </span>
      </div>

      {/* 2. Persistent 3-Way Service Selector (Shared Component) */}
      <ServiceModeSwitcher table={table} showContextLine={false} />

      {/* 3. Table Session Notice Card */}
      <div className="bg-[#f2f3ff] rounded-xl p-3 flex items-start gap-3 shadow-sm border border-[#e2e7ff]/80">
        <div className="w-8 h-8 rounded-lg bg-[#e2e7ff] flex items-center justify-center text-[#4338ca] flex-shrink-0">
          <KitchenIcon className="w-4.5 h-4.5 text-[#4338ca]" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-[#131b2e]">
              Serving to Table {tableNum}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#005e3f]" />
            <span className="text-[11px] text-[#005e3f] font-semibold">
              Instant KDS Push
            </span>
          </div>
          <p className="text-[11px] text-[#464554] leading-relaxed">
            Zero delivery or packaging charges. Dishes are routed immediately to kitchen display screens.
          </p>
        </div>
      </div>

      {/* 4. Cart Items Section */}
      {items.length === 0 ? (
        /* Empty Cart State */
        <div className="bg-white rounded-xl p-8 shadow-sm border border-[#eaedff] text-center flex flex-col items-center gap-3 my-2">
          <div className="w-16 h-16 rounded-2xl bg-[#eaedff] text-[#4338ca] flex items-center justify-center">
            <AddCircleIcon className="w-8 h-8 text-[#4338ca]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#131b2e]">
              Your Table Order is Empty
            </h3>
            <p className="text-xs text-[#464554] mt-1 max-w-xs mx-auto">
              Explore our menu and add your favorite dishes to the table order.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToMenu}
            className="mt-2 bg-[#4338ca] hover:bg-[#372abf] text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>Browse Menu & Add Dishes</span>
            <ArrowForwardIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Populated Cart List */
        <div className="flex flex-col gap-2.5">
          {/* Section Subheader */}
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-semibold text-[#464554] uppercase tracking-wider">
              TABLE ORDER ({totalItemCount} {totalItemCount === 1 ? "ITEM" : "ITEMS"})
            </span>
            <span className="text-xs text-[#005e3f] font-semibold flex items-center gap-0.5">
              <BoltIcon className="w-3.5 h-3.5 text-[#005e3f]" />
              <span>Live Prep</span>
            </span>
          </div>

          {/* Item Cards */}
          {items.map((cartItem) => {
            const summaryText = formatCustomizationSummary(cartItem);
            const formattedItemPrice = `${currencySymbol}${((cartItem.totalUnitPrice * cartItem.quantity) / 100).toFixed(2)}`;
            const hasCustomizations =
              (cartItem.customizations && cartItem.customizations.length > 0) ||
              (cartItem.preferences && cartItem.preferences.length > 0);

            return (
              <div
                key={cartItem.cartItemId}
                className="bg-white rounded-xl p-3.5 shadow-sm border border-[#eaedff]/80 flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    {/* Veg / Non-Veg Tag */}
                    <div className="mt-0.5 flex-shrink-0">
                      {cartItem.isVeg !== false ? <VegFssaiBadge /> : <NonVegFssaiBadge />}
                    </div>

                    {/* Details */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <h4 className="text-[14px] font-semibold text-[#131b2e] leading-snug truncate">
                        {cartItem.name}
                      </h4>

                      {summaryText && (
                        <span className="text-xs text-[#464554] line-clamp-2 mt-0.5">
                          {summaryText}
                        </span>
                      )}

                      {hasCustomizations && (
                        <button
                          type="button"
                          onClick={() => setEditingCartItem(cartItem)}
                          className="text-xs font-semibold text-[#4338ca] hover:underline pt-1 text-left cursor-pointer"
                        >
                          Edit options
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail Image */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#eaedff] border border-stone-200/50 shadow-2xs">
                    {cartItem.imageUrl ? (
                      <img
                        src={cartItem.imageUrl}
                        alt={cartItem.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-400 text-[10px] font-medium">
                        Dish
                      </div>
                    )}
                  </div>
                </div>

                {/* Price & Quantity Stepper */}
                <div className="flex items-center justify-between pt-1 border-t border-[#eaedff]/60">
                  <span className="text-[15px] font-bold text-[#131b2e]">
                    {formattedItemPrice}
                  </span>

                  {/* Stepper */}
                  <div className="flex items-center bg-[#f2f3ff] rounded-lg p-0.5 shadow-2xs border border-[#e2e7ff]">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => updateQuantity(cartItem.cartItemId, -1)}
                      className="w-8 h-8 rounded-md bg-white text-[#131b2e] flex items-center justify-center hover:bg-[#eaedff] active:scale-95 transition-all shadow-2xs cursor-pointer"
                    >
                      <MinusIcon className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-semibold text-[#131b2e]">
                      {cartItem.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => updateQuantity(cartItem.cartItemId, 1)}
                      className="w-8 h-8 rounded-md bg-[#4338ca] text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-2xs cursor-pointer"
                    >
                      <PlusIcon className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add More Food Button */}
          <button
            type="button"
            onClick={onBackToMenu}
            className="w-full py-2.5 px-4 rounded-xl bg-[#e2e7ff] text-[#2a14b4] hover:bg-[#dae2fd] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <AddCircleIcon className="w-4 h-4 text-[#2a14b4]" />
            <span>+ Add More Food to Order</span>
          </button>
        </div>
      )}

      {/* 5. Customer Details (Digital Invoice & Ticket) */}
      <div className="bg-white rounded-xl p-3.5 shadow-sm border border-[#eaedff]/80 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#131b2e]">
            Customer Details (Digital Invoice & Ticket)
          </span>
          <ReceiptIcon className="w-4.5 h-4.5 text-[#005e3f]" />
        </div>

        {/* Mobile Number */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#464554]">
            Mobile Number (For Table Invoice SMS)
          </label>
          <div className="flex items-center justify-between bg-[#eaedff] px-3.5 py-2 rounded-lg border border-indigo-100/30">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm">🇮🇳</span>
              <span className="text-xs font-medium text-[#131b2e]">+91</span>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="98765 43210"
                maxLength={10}
                className="bg-transparent text-xs font-medium text-[#131b2e] w-full outline-none placeholder-[#777586]"
              />
            </div>
            <span className="text-[11px] font-semibold text-[#005e3f] bg-white px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-2xs flex-shrink-0">
              <VerifiedCheckIcon className="w-3 h-3 text-[#005e3f]" />
              <span>Verified</span>
            </span>
          </div>
        </div>

        {/* Guest Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#464554]">
            Guest Name (Optional)
          </label>
          <div className="bg-[#eaedff] px-3.5 py-2 rounded-lg border border-indigo-100/30 flex items-center">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter name"
              className="bg-transparent text-xs font-medium text-[#131b2e] w-full outline-none placeholder-[#777586]"
            />
          </div>
        </div>
      </div>

      {/* 6. Kitchen Instructions */}
      <div className="bg-white rounded-xl p-3.5 shadow-sm border border-[#eaedff]/80 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <SkilletIcon className="w-4 h-4 text-[#2a14b4]" />
            <span className="text-xs font-semibold text-[#131b2e]">
              Kitchen Instructions
            </span>
          </div>
          <span className="text-[11px] text-[#005e3f] font-semibold flex items-center gap-0.5">
            <VerifiedCheckIcon className="w-3 h-3 text-[#005e3f]" />
            <span>Saved</span>
          </span>
        </div>

        <div className="bg-[#eaedff] px-3.5 py-2 rounded-lg border border-indigo-100/30 flex items-center gap-2">
          <EditNoteIcon className="w-4 h-4 text-[#464554] flex-shrink-0" />
          <input
            type="text"
            value={kitchenInstructions}
            onChange={(e) => setKitchenInstructions(e.target.value)}
            placeholder="Add specific cooking or serving request"
            className="bg-transparent text-xs text-[#131b2e] font-normal w-full outline-none placeholder-[#777586]"
          />
        </div>
      </div>

      {/* 7. Bill Details (Dine-in Breakdown) */}
      <div className="bg-white rounded-xl p-3.5 shadow-sm border border-[#eaedff]/80 flex flex-col gap-2.5">
        <div className="flex items-center justify-between pb-1 border-b border-[#eaedff]/60">
          <span className="text-xs font-semibold text-[#131b2e]">Bill Summary</span>
          <span className="text-[11px] font-medium text-[#464554]">
            Table {tableNum}
          </span>
        </div>

        <div className="flex flex-col gap-2 text-xs text-[#464554]">
          <div className="flex justify-between items-center">
            <span>Item Total</span>
            <span className="text-[#131b2e] font-medium">
              {billSummary.formattedItemTotal}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span>GST ({billSummary.gstRate}%)</span>
              <InfoIcon className="w-3.5 h-3.5 text-[#777586]" />
            </span>
            <span className="text-[#131b2e] font-medium">
              {billSummary.formattedGstAmount}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <span>Restaurant Service Tax ({billSummary.serviceTaxRate}%)</span>
              <InfoIcon className="w-3.5 h-3.5 text-[#777586]" />
            </span>
            <span className="text-[#131b2e] font-medium">
              {billSummary.formattedServiceTaxAmount}
            </span>
          </div>

          <div className="flex justify-between items-center text-[#005e3f] font-semibold">
            <span>Dine-In Cover & Table Service</span>
            <span>FREE</span>
          </div>
        </div>

        {/* Grand Total Row */}
        <div className="pt-2 mt-1 bg-[#e2e7ff]/40 -mx-3.5 -mb-3.5 px-3.5 py-2.5 rounded-b-xl flex items-center justify-between border-t border-[#e2e7ff]">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#131b2e]">Grand Total</span>
            <span className="text-[11px] text-[#464554]">
              All applicable taxes included
            </span>
          </div>
          <span className="text-[18px] font-bold text-[#2a14b4]">
            {billSummary.formattedGrandTotal}
          </span>
        </div>
      </div>

      {/* 8. Sticky Dine-In Payment & KOT Trigger Floating Container */}
      <div className="sticky bottom-2 inset-x-0 z-40 pt-1">
        <div className="bg-white p-2.5 rounded-2xl shadow-xl flex flex-col gap-1.5 border border-[#eaedff]">
          <button
            type="button"
            disabled={items.length === 0}
            onClick={handlePayClick}
            className="w-full py-3.5 px-4 rounded-xl bg-[#4338ca] hover:opacity-95 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-semibold flex items-center justify-between shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <TouchAppIcon className="w-4 h-4 text-white" />
              </span>
              <span>Pay for Dine In</span>
            </div>

            <div className="flex items-center gap-1.5 font-bold">
              <span>{billSummary.formattedGrandTotal}</span>
              <ArrowForwardIcon className="w-4 h-4" />
            </div>
          </button>

          <div className="flex items-center justify-center gap-1.5 px-2 py-0.5">
            <BoltIcon className="w-3.5 h-3.5 text-[#005e3f]" />
            <span className="text-[11px] text-[#464554] text-center font-normal">
              Instant KOT sent straight to kitchen chef station upon payment
            </span>
          </div>
        </div>
      </div>

      {/* Extra Bottom Clearance so full bill summary & Grand Total can scroll way past sticky elements */}
      <div className="h-28 w-full flex-shrink-0" aria-hidden="true" />

      {/* 9. Edit Options Modal for existing Cart Item */}
      {editingCartItem && (
        <ProductCustomizationModal
          item={getProductDetails(editingCartItem)}
          isOpen={!!editingCartItem}
          onClose={() => setEditingCartItem(null)}
          onAddToCart={(customizations, quantity, preferences) => {
            const product = getProductDetails(editingCartItem);
            updateItemCustomizations(
              editingCartItem.cartItemId,
              product,
              customizations,
              quantity,
              preferences
            );
            setEditingCartItem(null);
          }}
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
}
