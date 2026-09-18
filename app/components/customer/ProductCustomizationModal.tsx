"use client";

import React, { useState } from "react";
import { CustomerMenuItem, CustomizationGroup, SelectedCustomization } from "./types";
import { VegFssaiBadge, NonVegFssaiBadge, PlusIcon, MinusIcon } from "./CustomerIcons";

interface ProductCustomizationModalProps {
  item: CustomerMenuItem;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (customizations: SelectedCustomization[], quantity: number) => void;
  currencySymbol?: string;
}

export function ProductCustomizationModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
  currencySymbol = "₹",
}: ProductCustomizationModalProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);

  if (!isOpen) return null;

  const customizations: CustomizationGroup[] = item.customizations || [];

  const handleToggleOption = (
    groupId: string,
    groupName: string,
    optionId: string,
    maxSelected: number
  ) => {
    setSelectedOptions((prev) => {
      const current = prev[groupId] || [];
      if (current.includes(optionId)) {
        return {
          ...prev,
          [groupId]: current.filter((id) => id !== optionId),
        };
      } else {
        if (maxSelected === 1) {
          return {
            ...prev,
            [groupId]: [optionId],
          };
        } else if (current.length < maxSelected) {
          return {
            ...prev,
            [groupId]: [...current, optionId],
          };
        }
        return prev;
      }
    });
  };

  // Calculate total price including selected options
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

  // Validation: check required groups
  const isComplete = customizations.every((group) => {
    if (!group.required) return true;
    const chosen = selectedOptions[group.id] || [];
    return chosen.length > 0;
  });

  const handleConfirm = () => {
    if (!isComplete) return;
    onAddToCart(flatSelectedList, quantity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in">
      <div
        className="bg-white w-full max-w-[480px] max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-100 flex items-start justify-between gap-3 bg-[#faf8ff]">
          <div className="flex items-start gap-2.5 min-w-0">
            {item.is_veg !== false ? <VegFssaiBadge /> : <NonVegFssaiBadge />}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#131b2e] leading-snug">
                {item.name}
              </h3>
              <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                {item.description || "Customize your order selection"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-sm transition"
          >
            ✕
          </button>
        </div>

        {/* Customization Groups Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {customizations.length === 0 ? (
            <p className="text-xs text-stone-500 py-4 text-center">
              No special options needed for this item.
            </p>
          ) : (
            customizations.map((group) => {
              const chosen = selectedOptions[group.id] || [];
              return (
                <div key={group.id} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#131b2e] uppercase tracking-wider">
                        {group.name}
                      </h4>
                      <span className="text-[10px] text-stone-500">
                        {group.max_selected === 1 ? "Select 1 option" : `Select up to ${group.max_selected}`}
                      </span>
                    </div>
                    {group.required ? (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400">Optional</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {group.customization_items.map((opt) => {
                      const isSelected = chosen.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            handleToggleOption(group.id, group.name, opt.id, group.max_selected || 1)
                          }
                          className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all ${
                            isSelected
                              ? "border-[#4338ca] bg-[#eaedff] shadow-xs"
                              : "border-stone-200 hover:border-stone-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded-${group.max_selected === 1 ? "full" : "md"} border flex items-center justify-center ${
                                isSelected
                                  ? "border-[#4338ca] bg-[#4338ca] text-white"
                                  : "border-stone-300 bg-white"
                              }`}
                            >
                              {isSelected && (
                                <span className="text-[10px] font-bold">✓</span>
                              )}
                            </div>
                            <span className="text-xs font-medium text-[#131b2e]">
                              {opt.name}
                            </span>
                          </div>

                          <span className="text-xs font-semibold text-stone-700">
                            {opt.price > 0
                              ? `+${currencySymbol}${(opt.price / 100).toFixed(2)}`
                              : "Free"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Quantity Stepper & Add Action */}
        <div className="p-4 border-t border-stone-100 bg-[#faf8ff] flex items-center justify-between gap-4">
          <div className="flex items-center bg-white border border-stone-200 rounded-xl px-2 py-1 shadow-xs">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-7 h-7 flex items-center justify-center text-[#4338ca] hover:bg-stone-100 rounded-lg disabled:opacity-40"
            >
              <MinusIcon className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center text-xs font-bold text-[#131b2e]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-7 h-7 flex items-center justify-center text-[#4338ca] hover:bg-stone-100 rounded-lg"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            disabled={!isComplete}
            onClick={handleConfirm}
            className="flex-1 bg-[#4338ca] hover:bg-[#372abf] disabled:opacity-50 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-between shadow-md"
          >
            <span>Add to Order</span>
            <span>{currencySymbol}{(grandTotal / 100).toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
