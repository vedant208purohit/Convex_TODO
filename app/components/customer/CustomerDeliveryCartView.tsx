"use client";

import React, { useState } from "react";
import {
  CustomerOrganization,
  CustomerTable,
  CustomerMenuItem,
  CartItem,
  DeliveryAddress,
} from "./types";
import { useCustomerCart } from "./CustomerCartContext";
import { useRazorpayPayment } from "./useRazorpayPayment";
import {
  ArrowBackIcon,
  ShoppingBagIcon,
  PersonIcon,
  MopedIcon,
  TableBarIcon,
  VegFssaiBadge,
  NonVegFssaiBadge,
  PlusIcon,
  MinusIcon,
  HomeAddressIcon,
  OfficeAddressIcon,
  OtherAddressIcon,
  LocationPinIcon,
  VerifiedCheckIcon,
  ArrowForwardIcon,
} from "./CustomerIcons";
import { ProductCustomizationModal } from "./ProductCustomizationModal";

interface CustomerDeliveryCartViewProps {
  organization: CustomerOrganization;
  table?: CustomerTable;
  rawMenu?: Array<any>;
  onBackToMenu: () => void;
  onProceedToPayment?: () => void;
  onOpenDeliveryLocation?: () => void;
}

export function CustomerDeliveryCartView({
  organization,
  table,
  rawMenu,
  onBackToMenu,
  onProceedToPayment,
  onOpenDeliveryLocation,
}: CustomerDeliveryCartViewProps) {
  const {
    items,
    totalItemCount,
    serviceMode,
    setServiceMode,
    deliveryAddress,
    customerPhone,
    setCustomerPhone,
    customerName,
    setCustomerName,
    updateQuantity,
    updateItemCustomizations,
    setActiveOrderId,
    setActiveOrderNumber,
    clearCart,
    billSummary,
    currencySymbol,
  } = useCustomerCart();

  const { isProcessing, paymentFeedback, clearFeedback, initiatePayment } = useRazorpayPayment();

  // State for editing customizations on an existing cart item
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

  const storeName = organization?.name || "Skyz Bistro & Banquet";

  // Helper to find full product details (including all customization groups and resolved image URL) from raw menu
  const getProductDetails = (cartItem: CartItem): CustomerMenuItem => {
    if (rawMenu && rawMenu.length > 0) {
      for (const catObj of rawMenu) {
        const found = (catObj.category?.items || []).find(
          (ci: any) =>
            ci.item?.id === cartItem.itemId ||
            ci.item?._id === cartItem.itemId ||
            ci.category_item_id === cartItem.itemId ||
            ci.id === cartItem.itemId ||
            ci._id === cartItem.itemId
        );
        if (found) {
          const resolvedImg =
            found.item_image_url ||
            found.item?.item_image_url ||
            found.item?.imageUrl ||
            found.imageUrl ||
            (typeof found.item?.image === "string" ? found.item.image : undefined) ||
            cartItem.imageUrl;

          return {
            id: found.item.id || found.item._id,
            name: found.item.name,
            price: found.item.price,
            display_price: found.item.display_price || (found.item.price / 100).toFixed(2),
            description: found.item.description,
            published: found.item.published ?? true,
            is_available: found.item.is_available ?? true,
            is_veg: found.item.is_veg ?? true,
            customizations: found.customizations || found.item?.customizations || [],
            item_image_url: resolvedImg,
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

  // Helper to format customization summary text (e.g. "Medium Meal combo, +Extra Cheese, No Onion")
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
      parts.push(...cartItem.preferences);
    }

    return parts.join(", ");
  };

  const handlePrimaryCtaClick = () => {
    if (!deliveryAddress) {
      if (onOpenDeliveryLocation) {
        onOpenDeliveryLocation();
      }
      return;
    }

    if (items.length === 0 || isProcessing) return;

    initiatePayment({
      organization,
      table,
      serviceMode: "delivery",
      items,
      customerName,
      customerPhone,
      deliveryAddress,
      onSuccess: ({ orderId, orderNumber }) => {
        setActiveOrderId(orderId);
        setActiveOrderNumber(orderNumber);
        clearCart();
        if (onProceedToPayment) {
          onProceedToPayment();
        }
      },
      onFailure: (err) => {
        console.warn("Delivery payment failure:", err);
      },
      onDismiss: () => {
        console.log("Customer dismissed delivery payment");
      },
    });
  };

  const renderAddressTypeIcon = (type?: string) => {
    switch (type) {
      case "Home":
        return <HomeAddressIcon className="w-3.5 h-3.5 text-indigo-700" />;
      case "Office":
        return <OfficeAddressIcon className="w-3.5 h-3.5 text-indigo-700" />;
      default:
        return <OtherAddressIcon className="w-3.5 h-3.5 text-indigo-700" />;
    }
  };

  return (
    <div className="flex flex-col gap-4 font-sans text-slate-900 antialiased pb-10">
      {/* ========================================================================= */}
      {/* 1. HEADER & SERVICE MODE SELECTOR (Sticky top card)                       */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col gap-3">
        {/* Top bar with back, title & cart count badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              aria-label="Go back to menu"
              onClick={onBackToMenu}
              type="button"
              className="p-2 -ml-2 rounded-full hover:bg-slate-100 active:scale-95 transition text-slate-700 cursor-pointer"
            >
              <ArrowBackIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-bold leading-tight text-slate-900">
                Your Cart
              </h1>
              <p className="text-xs text-slate-500 truncate max-w-[200px]">
                {storeName} • Delivery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Cart item count pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-100">
              <ShoppingBagIcon className="w-3.5 h-3.5" />
              <span>
                {totalItemCount} {totalItemCount === 1 ? "item" : "items"}
              </span>
            </div>

            {/* User Profile Avatar */}
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200">
              <PersonIcon className="w-4 h-4 text-slate-600" />
            </div>
          </div>
        </div>

        {/* 3-Option Service Mode Switcher (Delivery Active) */}
        <div className="grid grid-cols-3 gap-2" data-purpose="service-selector">
          <button
            type="button"
            onClick={() => setServiceMode("delivery")}
            className="py-2 px-3 rounded-xl bg-[#4338ca] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <span>🛵</span>
            <span>Delivery</span>
          </button>
          <button
            type="button"
            onClick={() => setServiceMode("dine_in")}
            className="py-2 px-3 rounded-xl bg-white text-slate-600 border border-slate-200 font-medium text-xs hover:bg-slate-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>🪑</span>
            <span>Dine In</span>
          </button>
          <button
            type="button"
            onClick={() => setServiceMode("takeaway")}
            className="py-2 px-3 rounded-xl bg-white text-slate-600 border border-slate-200 font-medium text-xs hover:bg-slate-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>🛍️</span>
            <span>Take Away</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DOORSTEP DELIVERY SERVICE NOTICE BANNER                                */}
      {/* ========================================================================= */}
      <section
        className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-3.5 flex items-start gap-3 shadow-2xs"
        data-purpose="service-notice"
      >
        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 text-base shadow-sm">
          🛵
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-bold text-indigo-950 truncate">
            Doorstep Delivery • {storeName}
          </h2>
          <p className="text-xs text-indigo-700/90 mt-0.5 leading-relaxed">
            {deliveryAddress
              ? `Fast partner delivery to ${deliveryAddress.apartmentRoadArea || deliveryAddress.city || "your location"}. Tracking and dispatch will be initiated upon order placement.`
              : "Fast partner delivery. Add your delivery address below to calculate delivery fee and live ETA."}
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. ORDER ITEMS SECTION                                                    */}
      {/* ========================================================================= */}
      <section
        className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col gap-3"
        data-purpose="order-items-list"
      >
        {/* Section Subheader */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">
            Delivery Order ({totalItemCount} {totalItemCount === 1 ? "item" : "items"})
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            ⚡ Fresh Prep
          </span>
        </div>

        {items.length === 0 ? (
          /* Empty Cart State */
          <div className="py-8 text-center flex flex-col items-center gap-2.5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-inner">
              🛍️
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Your delivery cart is empty
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Explore our menu and add your favorite dishes for doorstep delivery.
              </p>
            </div>
            <button
              type="button"
              onClick={onBackToMenu}
              className="mt-2 bg-[#4338ca] hover:bg-[#3730a3] text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>+ Browse Menu & Add Dishes</span>
            </button>
          </div>
        ) : (
          /* Populated Items List */
          <div className="divide-y divide-slate-100">
            {items.map((cartItem) => {
              const productDetails = getProductDetails(cartItem);
              const resolvedItemImg =
                productDetails.item_image_url ||
                cartItem.imageUrl ||
                (productDetails as any).imageUrl;

              const summaryText = formatCustomizationSummary(cartItem);
              const formattedItemPrice = `${currencySymbol}${((cartItem.totalUnitPrice * cartItem.quantity) / 100).toFixed(2)}`;
              const hasCustomizations =
                (cartItem.customizations && cartItem.customizations.length > 0) ||
                (cartItem.preferences && cartItem.preferences.length > 0);

              return (
                <article
                  key={cartItem.cartItemId}
                  className="py-3 flex gap-3 items-start first:pt-0 last:pb-0"
                  data-purpose="cart-item"
                >
                  {/* Food Image */}
                  <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                    {resolvedItemImg ? (
                      <img
                        src={resolvedItemImg}
                        alt={cartItem.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLElement;
                          target.style.display = "none";
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `<span class="text-xl">🍽️</span>`;
                          }
                        }}
                      />
                    ) : (
                      <span className="text-xl">🍽️</span>
                    )}
                  </div>

                  {/* Item Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Veg / Non-Veg Indicator */}
                        <div className="shrink-0">
                          {cartItem.isVeg !== false ? (
                            <VegFssaiBadge />
                          ) : (
                            <NonVegFssaiBadge />
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          {cartItem.name}
                        </h3>
                      </div>
                    </div>

                    {summaryText && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {summaryText}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {formattedItemPrice}
                        </span>
                        {hasCustomizations && (
                          <button
                            type="button"
                            onClick={() => setEditingCartItem(cartItem)}
                            className="text-xs font-medium text-indigo-600 hover:underline cursor-pointer"
                          >
                            Edit options
                          </button>
                        )}
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 gap-3 shadow-2xs">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => updateQuantity(cartItem.cartItemId, -1)}
                          className="text-slate-500 hover:text-indigo-600 font-bold text-sm leading-none cursor-pointer"
                        >
                          −
                        </button>
                        <span className="text-xs font-semibold text-slate-800">
                          {cartItem.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => updateQuantity(cartItem.cartItemId, 1)}
                          className="text-slate-500 hover:text-indigo-600 font-bold text-sm leading-none cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Add More Food Action Button */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onBackToMenu}
            className="w-full py-2.5 px-4 rounded-xl border border-dashed border-indigo-300 text-indigo-700 font-semibold text-xs hover:bg-indigo-50/50 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <PlusIcon className="w-4 h-4 text-indigo-700" />
            <span>Add More Food to Order</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. CUSTOMER DETAILS SECTION                                               */}
      {/* ========================================================================= */}
      <section
        className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80"
        data-purpose="customer-details"
      >
        <div className="mb-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Customer Details (Digital Invoice & Live Tracking)
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-2.5">
          {/* Guest Name Display / Edit */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-slate-200/80 text-slate-600 flex items-center justify-center text-xs shrink-0">
                👤
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                  Guest Name
                </span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your name"
                  className="text-xs font-semibold text-slate-800 bg-transparent outline-none w-full border-0 p-0 focus:ring-0"
                />
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium shrink-0">
              Primary Contact
            </span>
          </div>

          {/* Mobile Number Display / Edit */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-slate-200/80 text-slate-600 flex items-center justify-center text-xs shrink-0">
                📱
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                  Mobile Number
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs font-semibold text-slate-600">+91</span>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="98765 43210"
                    maxLength={10}
                    className="text-xs font-semibold text-slate-800 bg-transparent outline-none w-full border-0 p-0 focus:ring-0"
                  />
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <VerifiedCheckIcon className="w-3 h-3 text-emerald-700" />
              <span>Verified</span>
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. DELIVERY ADDRESS SECTION (CRITICAL INTEGRATION)                         */}
      {/* ========================================================================= */}
      <section
        className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80"
        data-purpose="delivery-address-container"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Delivery Address
          </h2>
          {deliveryAddress ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
              ✓ Confirmed
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-100 text-amber-800 border border-amber-300">
              Required
            </span>
          )}
        </div>

        {!deliveryAddress ? (
          /* Case A: No Address Selected State Card */
          <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/40 rounded-2xl p-5 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2.5 shadow-inner">
              <LocationPinIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              No address selected
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-[260px] leading-relaxed">
              Add your delivery location on the map to see delivery availability, ETA, and fees.
            </p>
            <button
              type="button"
              onClick={onOpenDeliveryLocation}
              className="mt-4 px-4 py-2.5 rounded-xl bg-[#4338ca] text-white font-semibold text-xs shadow-md shadow-indigo-200 hover:bg-[#3730a3] active:scale-[0.98] transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>📍</span>
              <span>Select Delivery Address</span>
              <span className="font-bold">→</span>
            </button>
          </div>
        ) : (
          /* Case B: Address Confirmed State Card */
          <div className="bg-slate-50 rounded-xl p-3.5 border border-indigo-100/80 flex flex-col gap-2.5">
            {/* Top row: Type chip & Change address button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100/80 text-indigo-800 border border-indigo-200">
                  {renderAddressTypeIcon(deliveryAddress.addressType)}
                  <span>{deliveryAddress.addressType || "Home"}</span>
                </span>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {deliveryAddress.accuracyStatus || "High Accuracy"}
                </span>
              </div>

              <button
                type="button"
                onClick={onOpenDeliveryLocation}
                className="text-xs font-semibold text-[#4338ca] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Change Address</span>
                <ArrowForwardIcon className="w-3 h-3" />
              </button>
            </div>

            {/* Address Text */}
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-slate-900 leading-snug">
                {deliveryAddress.houseFlatBlock
                  ? `${deliveryAddress.houseFlatBlock}, `
                  : ""}
                {deliveryAddress.apartmentRoadArea}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                {deliveryAddress.formattedAddress ||
                  `${deliveryAddress.apartmentRoadArea}, ${deliveryAddress.city || "Ahmedabad"}`}
              </p>
            </div>

            {/* Optional Landmark & Instructions */}
            {deliveryAddress.landmark && (
              <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/60 flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">📍 Landmark:</span>
                <span className="font-semibold text-slate-800">
                  {deliveryAddress.landmark}
                </span>
              </div>
            )}

            {deliveryAddress.deliveryInstructions && (
              <div className="text-[11px] text-indigo-900 bg-indigo-50/60 p-2 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                <span className="text-indigo-500 font-medium">💬 Instructions:</span>
                <span className="font-medium">
                  {deliveryAddress.deliveryInstructions}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 6. BILL SUMMARY SECTION                                                   */}
      {/* ========================================================================= */}
      <section
        className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80"
        data-purpose="bill-summary"
      >
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
          Bill Summary
        </h2>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Item Total</span>
            <span className="font-medium text-slate-900">
              {billSummary.formattedItemTotal}
            </span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>GST ({billSummary.gstRate}%)</span>
            <span className="font-medium text-slate-900">
              {billSummary.formattedGstAmount}
            </span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Restaurant Service Tax ({billSummary.serviceTaxRate}%)</span>
            <span className="font-medium text-slate-900">
              {billSummary.formattedServiceTaxAmount}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-600">
            <span>Delivery Fee</span>
            {deliveryAddress ? (
              <span className="font-medium text-slate-900">
                Calculated at checkout (partner quote)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Select address (pending)
              </span>
            )}
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Estimated Delivery</span>
            <span className="text-slate-500 font-medium">
              {deliveryAddress ? "30 - 45 mins" : "—"}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
            <div>
              <span className="text-sm font-bold text-slate-900 block">
                Grand Total
              </span>
              <span className="text-[10px] text-slate-500">
                {deliveryAddress
                  ? "Taxes included • Delivery quote at dispatch"
                  : "Taxes included, delivery fee pending"}
              </span>
            </div>
            <span className="text-base font-extrabold text-[#4338ca]">
              {billSummary.formattedGrandTotal}
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. STICKY BOTTOM FOOTER CTA                                               */}
      {/* ========================================================================= */}
      <div className="sticky bottom-[72px] sm:bottom-[76px] inset-x-0 z-40 pt-1">
        {paymentFeedback && (
          <div
            className={`mb-2 p-3 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm transition-all ${
              paymentFeedback.type === "success"
                ? "bg-[#005e3f] text-[#6ffbbe]"
                : paymentFeedback.type === "info"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            <span>{paymentFeedback.message}</span>
            <button
              type="button"
              onClick={clearFeedback}
              className="text-xs font-bold px-1.5 py-0.5 opacity-80 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <div className="bg-white p-3 rounded-2xl shadow-xl flex flex-col gap-1.5 border border-slate-200">
          <button
            type="button"
            disabled={items.length === 0 || isProcessing}
            onClick={handlePrimaryCtaClick}
            className="w-full py-3 px-4 bg-[#4338ca] hover:bg-[#3730a3] text-white font-bold rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center gap-2 active:scale-[0.99] transition text-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {deliveryAddress ? (
              <>
                <span>🛵</span>
                <span>
                  {isProcessing
                    ? "Opening Razorpay..."
                    : `Proceed to Pay • ${billSummary.formattedGrandTotal}`}
                </span>
                <span className="font-bold">→</span>
              </>
            ) : (
              <>
                <span>📍</span>
                <span>Select Delivery Address to Continue</span>
                <span className="font-bold">→</span>
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-slate-500 font-medium">
            {deliveryAddress
              ? "Step 2 of 2: Confirm address & partner delivery rates"
              : "Step 1 of 2: Confirm address & partner delivery rates"}
          </p>
        </div>
      </div>

      {/* 8. Edit Customizations Modal */}
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
