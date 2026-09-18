"use client";

import React, { useState } from "react";
import { CustomerMenuItem } from "./types";
import { useCustomerCart } from "./CustomerCartContext";
import { VegFssaiBadge, NonVegFssaiBadge, PlusIcon, MinusIcon } from "./CustomerIcons";
import { ProductCustomizationModal } from "./ProductCustomizationModal";

interface ProductCardProps {
  item: CustomerMenuItem;
  currencySymbol?: string;
}

export function ProductCard({ item, currencySymbol = "₹" }: ProductCardProps) {
  const { addItem, updateQuantity, getItemQuantity, getCartItemByItemId } = useCustomerCart();
  const [isCustomizing, setIsCustomizing] = useState(false);

  const cartQuantity = getItemQuantity(item.id);
  const cartItem = getCartItemByItemId(item.id);

  const hasCustomizations = item.customizations && item.customizations.length > 0;

  // Resolve display price
  const formattedPrice = `${currencySymbol}${(item.price / 100).toFixed(2)}`;
  const formattedOriginalPrice = item.original_price
    ? `${currencySymbol}${(item.original_price / 100).toFixed(0)}`
    : undefined;

  // Resolve badge
  const badgeText = item.badge || (item.mark_as_bestseller ? "Bestseller" : undefined);
  let badgeStyle = "bg-[#e3dfff]/60 text-[#4338ca]";
  if (badgeText === "Chef Recommended") {
    badgeStyle = "bg-[#6ffbbe]/30 text-[#005e3f]";
  } else if (badgeText === "Barista Choice") {
    badgeStyle = "bg-[#e2dfff]/60 text-[#5654a8]";
  }

  const handleAddClick = () => {
    if (hasCustomizations) {
      setIsCustomizing(true);
    } else {
      addItem(item, [], 1);
    }
  };

  const handleStepperChange = (delta: number) => {
    if (cartItem) {
      updateQuantity(cartItem.cartItemId, delta);
    } else {
      handleAddClick();
    }
  };

  return (
    <>
      <article className="bg-white p-3.5 rounded-2xl shadow-xs border border-stone-100/70 flex items-start gap-3.5 transition-all hover:shadow-sm">
        {/* Left Column: Details */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* FSSAI Icon & Badge */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {item.is_veg !== false ? <VegFssaiBadge /> : <NonVegFssaiBadge />}
            {badgeText && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded leading-none ${badgeStyle}`}>
                {badgeText}
              </span>
            )}
          </div>

          {/* Product Name */}
          <h4 className="text-[14px] font-semibold text-[#131b2e] leading-snug truncate">
            {item.name}
          </h4>

          {/* Portion / Metadata */}
          {item.serving_size && (
            <span className="text-[11px] text-stone-500 mt-0.5">
              {item.serving_size}
            </span>
          )}

          {/* Description */}
          {item.description && (
            <p className="text-xs text-stone-500 line-clamp-2 mt-1 leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Price & Discount */}
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-[#131b2e]">
              {formattedPrice}
            </span>
            {formattedOriginalPrice && (
              <span className="text-xs text-stone-400 line-through">
                {formattedOriginalPrice}
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Image & Interactive CTA */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          {/* Image Container */}
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#eaedff] relative flex-shrink-0 shadow-2xs">
            {item.item_image_url ? (
              <img
                src={item.item_image_url}
                alt={item.name}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300 bg-stone-100">
                <span className="text-xs text-stone-400">Fresh Dish</span>
              </div>
            )}

            {/* Serving Badge on Image if applicable */}
            {item.serving && (
              <div className="absolute top-1 right-1 bg-white/90 backdrop-blur-xs px-1.5 py-0.2 rounded text-[#131b2e] text-[10px] font-bold shadow-xs">
                {item.serving} Pcs
              </div>
            )}
          </div>

          {/* Action: ADD button vs Active Stepper */}
          {cartQuantity === 0 ? (
            <button
              type="button"
              onClick={handleAddClick}
              className="w-24 h-8 bg-[#4338ca] hover:bg-[#372abf] active:scale-95 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 shadow-xs"
            >
              <span>ADD</span>
              <PlusIcon className="w-3 h-3" />
            </button>
          ) : (
            <div className="w-24 h-8 bg-white border border-stone-200 rounded-lg shadow-xs flex items-center justify-between px-1">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => handleStepperChange(-1)}
                className="w-6 h-6 rounded flex items-center justify-center text-[#4338ca] hover:bg-[#eaedff] font-bold text-base transition-colors"
              >
                <MinusIcon className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-bold text-[#131b2e]">
                {cartQuantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => handleStepperChange(1)}
                className="w-6 h-6 rounded flex items-center justify-center text-[#4338ca] hover:bg-[#eaedff] font-bold text-base transition-colors"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Label below button */}
          {cartQuantity > 0 ? (
            <span className="text-[10px] font-semibold text-[#4338ca] -mt-1">
              In Table Order
            </span>
          ) : hasCustomizations ? (
            <button
              type="button"
              onClick={() => setIsCustomizing(true)}
              className="text-[10px] text-stone-500 hover:text-[#4338ca] -mt-1 text-center cursor-pointer underline decoration-dotted"
            >
              Customizable
            </button>
          ) : null}
        </div>
      </article>

      {/* Customization Modal */}
      {hasCustomizations && (
        <ProductCustomizationModal
          item={item}
          isOpen={isCustomizing}
          onClose={() => setIsCustomizing(false)}
          onAddToCart={(customizations, quantity) => {
            addItem(item, customizations, quantity);
          }}
          currencySymbol={currencySymbol}
        />
      )}
    </>
  );
}
