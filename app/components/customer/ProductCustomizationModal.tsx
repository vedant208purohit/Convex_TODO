"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { CustomerMenuItem, CustomizationGroup, SelectedCustomization } from "./types";
import { VegFssaiBadge, NonVegFssaiBadge, PlusIcon, MinusIcon } from "./CustomerIcons";

interface ProductCustomizationModalProps {
  item: CustomerMenuItem;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    customizations: SelectedCustomization[],
    quantity: number,
    preferences?: string[]
  ) => void;
  currencySymbol?: string;
}

const DEFAULT_PREFERENCES = [
  "No Onion",
  "No Garlic",
  "Less Spicy",
  "Extra Spicy",
  "No Mayo",
  "Well Done",
];

export function ProductCustomizationModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
  currencySymbol = "₹",
}: ProductCustomizationModalProps) {
  const [mounted, setMounted] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const customizations: CustomizationGroup[] = useMemo(() => {
    return item.customizations || [];
  }, [item]);

  // Separate into AddOns/Option groups and Preparation groups
  const { optionGroups, prepGroups } = useMemo(() => {
    const optionList: CustomizationGroup[] = [];
    const prepList: CustomizationGroup[] = [];

    customizations.forEach((g) => {
      const type = (g.customization_type || "").toLowerCase();
      if (type.includes("prep")) {
        prepList.push(g);
      } else {
        optionList.push(g);
      }
    });

    return { optionGroups: optionList, prepGroups: prepList };
  }, [customizations]);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);

  // Initialize default selections when opened
  useEffect(() => {
    if (!isOpen) return;

    setImageError(false);
    const initialOptions: Record<string, string[]> = {};

    customizations.forEach((group) => {
      // If group is required single-select, select the first available option by default
      if (group.required && group.max_selected === 1 && group.customization_items?.length > 0) {
        const firstAvailable =
          group.customization_items.find((i) => i.is_available !== false) ||
          group.customization_items[0];
        if (firstAvailable) {
          initialOptions[group.id] = [firstAvailable.id];
        }
      } else {
        initialOptions[group.id] = [];
      }
    });

    setSelectedOptions(initialOptions);
    setSelectedPreferences([]);
    setQuantity(1);
  }, [isOpen, item.id, customizations]);

  // Prevent background body scroll when modal is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Option toggle handler
  const handleToggleOption = (
    groupId: string,
    optionId: string,
    maxSelected: number,
    required: boolean
  ) => {
    setSelectedOptions((prev) => {
      const current = prev[groupId] || [];
      const isCurrentlySelected = current.includes(optionId);

      if (maxSelected === 1) {
        // Single select (radio behavior)
        if (isCurrentlySelected) {
          return required ? prev : { ...prev, [groupId]: [] };
        }
        return { ...prev, [groupId]: [optionId] };
      } else {
        // Multi-select (checkbox behavior)
        if (isCurrentlySelected) {
          return {
            ...prev,
            [groupId]: current.filter((id) => id !== optionId),
          };
        } else {
          if (current.length < maxSelected) {
            return {
              ...prev,
              [groupId]: [...current, optionId],
            };
          }
          return prev;
        }
      }
    });
  };

  // Preference toggle handler
  const handleTogglePreference = (pref: string) => {
    setSelectedPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  // Price calculations
  let totalAddonsPrice = 0;
  const flatSelectedList: SelectedCustomization[] = [];

  customizations.forEach((group) => {
    const chosenIds = selectedOptions[group.id] || [];
    group.customization_items.forEach((opt) => {
      if (chosenIds.includes(opt.id)) {
        totalAddonsPrice += opt.price || 0;
        flatSelectedList.push({
          customizationId: group.id,
          customizationName: group.name,
          optionId: opt.id,
          optionName: opt.name,
          price: opt.price || 0,
        });
      }
    });
  });

  const unitTotal = item.price + totalAddonsPrice;
  const grandTotal = unitTotal * quantity;

  // Validation: Check that every required group has at least 1 selection
  const isComplete = customizations.every((group) => {
    if (!group.required) return true;
    const chosen = selectedOptions[group.id] || [];
    return chosen.length > 0;
  });

  const handleConfirm = () => {
    if (!isComplete) return;
    onAddToCart(flatSelectedList, quantity, selectedPreferences);
    onClose();
  };

  // Resolved base price formatting
  const formattedBasePrice = `${currencySymbol}${(item.price / 100).toFixed(2)}`;
  const formattedGrandTotal = `${currencySymbol}${(grandTotal / 100).toFixed(2)}`;

  // Product badge
  const badgeText = item.badge || (item.mark_as_bestseller ? "Bestseller" : undefined);

  // Resolved preferences list (from prepGroups if present, else fallback)
  const availablePreferences: string[] =
    prepGroups.length > 0
      ? prepGroups.flatMap((g) => g.customization_items.map((i) => i.name))
      : DEFAULT_PREFERENCES;

  const itemImg =
    item.item_image_url ||
    (item as any).imageUrl ||
    (typeof (item as any).image === "string" ? (item as any).image : undefined);

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-[440px] h-[82vh] h-[82dvh] max-h-[580px] rounded-3xl shadow-2xl flex flex-col min-h-0 overflow-hidden relative animate-in zoom-in-95 duration-200"
        style={{
          maxHeight: "min(580px, 82vh)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber Handle & Sheet Header */}
        <div className="pt-3 pb-2 px-4 border-b border-stone-100 flex flex-col items-center bg-[#faf8ff] flex-shrink-0">
          <div className="w-10 h-1 bg-stone-300 rounded-full mb-2" />
          <div className="w-full flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-widest text-[#464554] uppercase">
              CUSTOMISE DISH
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 rounded-full bg-stone-200/70 hover:bg-stone-300 text-stone-700 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 scrollbar-thin">
          {/* 1. Product Summary Card */}
          <div className="flex items-start gap-3 p-3 bg-[#f8f9ff] rounded-2xl border border-stone-200/60 min-w-0">
            {/* Product Image */}
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#eaedff] relative flex-shrink-0 border border-stone-200/70 shadow-2xs flex items-center justify-center">
              {itemImg && !imageError ? (
                <img
                  src={itemImg}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#4338ca] bg-[#eaedff] text-base font-bold">
                  <span>🍽️</span>
                </div>
              )}
            </div>

            {/* Product Metadata */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                {item.is_veg !== false ? <VegFssaiBadge /> : <NonVegFssaiBadge />}
                {badgeText && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#e3dfff] text-[#4338ca] leading-none uppercase tracking-wider">
                    {badgeText}
                  </span>
                )}
              </div>
              <h3 className="text-[14px] sm:text-[15px] font-bold text-[#131b2e] leading-snug truncate">
                {item.name}
              </h3>
              {item.description && (
                <p className="text-[11px] text-[#464554] line-clamp-1 mt-0.5">
                  {item.description}
                </p>
              )}
              <span className="text-xs font-bold text-[#4338ca] mt-1">
                Base Price: {formattedBasePrice}
              </span>
            </div>
          </div>

          {/* 2. Customization Option Groups */}
          {optionGroups.length === 0 && prepGroups.length === 0 ? (
            <div className="p-6 text-center bg-stone-50 rounded-2xl border border-stone-100">
              <p className="text-xs font-semibold text-stone-600">
                Standard recipe prepared fresh to table.
              </p>
            </div>
          ) : (
            optionGroups.map((group) => {
              const chosen = selectedOptions[group.id] || [];
              const isSingleSelect = group.max_selected === 1;

              return (
                <div key={group.id} className="space-y-2">
                  {/* Group Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#131b2e] tracking-tight uppercase">
                        {group.name}
                      </h4>
                      <p className="text-[11px] text-[#464554]">
                        {isSingleSelect
                          ? "Select 1 option"
                          : `Select up to ${group.max_selected} options`}
                      </p>
                    </div>

                    {group.required ? (
                      <span className="text-[10px] font-bold text-[#4338ca] bg-[#eaedff] px-2.5 py-0.5 rounded-full border border-[#4338ca]/20">
                        Required
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    )}
                  </div>

                  {/* Options List */}
                  <div className="space-y-2">
                    {group.customization_items.map((opt) => {
                      const isSelected = chosen.includes(opt.id);
                      const isOptionFree = !opt.price || opt.price === 0;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            handleToggleOption(
                              group.id,
                              opt.id,
                              group.max_selected || 1,
                              group.required
                            )
                          }
                          className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer min-w-0 gap-2 ${
                            isSelected
                              ? "border-2 border-[#4338ca] bg-[#eaedff]/30 shadow-xs"
                              : "border border-stone-200 hover:border-stone-300 bg-white"
                          }`}
                        >
                          {/* Left: Radio / Checkbox Indicator & Option Name */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {isSingleSelect ? (
                              <div
                                className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isSelected
                                    ? "border-[#4338ca]"
                                    : "border-stone-300 bg-white"
                                }`}
                              >
                                {isSelected && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-[#4338ca]" />
                                )}
                              </div>
                            ) : (
                              <div
                                className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isSelected
                                    ? "border-[#4338ca] bg-[#4338ca] text-white"
                                    : "border-stone-300 bg-white"
                                }`}
                              >
                                {isSelected && (
                                  <span className="text-[10px] font-bold">✓</span>
                                )}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-[#131b2e] block truncate">
                                {opt.name}
                              </span>
                              {opt.description && (
                                <span className="text-[10px] text-[#464554] block truncate">
                                  {opt.description}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: Price label */}
                          <span
                            className={`text-xs font-bold flex-shrink-0 ml-2 ${
                              isSelected ? "text-[#4338ca]" : "text-stone-700"
                            }`}
                          >
                            {isOptionFree
                              ? "Included"
                              : `+${currencySymbol}${(opt.price / 100).toFixed(0)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* 3. Chef Preparation Preferences */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#131b2e] tracking-tight uppercase">
                  CHEF PREP PREFERENCES
                </h4>
                <p className="text-[11px] text-[#464554]">
                  Tailor spice levels, toppings & ingredients
                </p>
              </div>
              <span className="text-[10px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                Optional
              </span>
            </div>

            {/* Flowing Pills */}
            <div className="flex flex-wrap gap-2 pt-0.5 pb-2">
              {availablePreferences.map((pref) => {
                const isSelected = selectedPreferences.includes(pref);
                return (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => handleTogglePreference(pref)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                      isSelected
                        ? "bg-[#4338ca] text-white border border-[#4338ca] shadow-xs"
                        : "bg-[#f0f2fe] text-[#131b2e] border border-stone-200/70 hover:bg-[#e2e7fc]"
                    }`}
                  >
                    {isSelected && <span className="text-[10px]">✓</span>}
                    <span>{pref}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Area */}
        <div className="p-3.5 sm:p-4 border-t border-stone-200/70 bg-[#faf8ff] flex items-center gap-3 flex-shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          {/* Quantity Stepper */}
          <div className="flex items-center bg-white border border-stone-200 rounded-xl px-2 py-1.5 shadow-xs h-11 flex-shrink-0">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-7 h-7 flex items-center justify-center text-[#4338ca] hover:bg-stone-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
            >
              <MinusIcon className="w-3.5 h-3.5" />
            </button>
            <span className="w-7 text-center text-xs font-bold text-[#131b2e]">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => Math.min(10, q + 1))}
              disabled={quantity >= 10}
              className="w-7 h-7 flex items-center justify-center text-[#4338ca] hover:bg-stone-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary CTA Button */}
          <button
            type="button"
            disabled={!isComplete}
            onClick={handleConfirm}
            className="flex-1 bg-[#4338ca] hover:bg-[#372abf] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none text-white h-11 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-between shadow-md cursor-pointer min-w-0"
          >
            <span className="truncate mr-1">{isComplete ? "Add to Cart" : "Select required"}</span>
            <span className="flex items-center gap-1 font-extrabold text-xs sm:text-sm flex-shrink-0">
              <span>{formattedGrandTotal}</span>
              <span className="text-xs">→</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
