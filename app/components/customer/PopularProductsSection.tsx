"use client";

import React from "react";
import { CustomerMenuItem, CustomerOrganization } from "./types";
import { ProductCard } from "./ProductCard";

interface PopularProductsSectionProps {
  items: CustomerMenuItem[];
  organization?: CustomerOrganization;
  categoryTitle?: string;
  isFiltered?: boolean;
}

export function PopularProductsSection({
  items,
  organization,
  categoryTitle,
  isFiltered,
}: PopularProductsSectionProps) {
  const storeName = organization?.name || "our restaurant";
  const currencySymbol = organization?.defaultCurrencySymbol || "₹";

  const hasVeg = items.some((i) => i.is_veg !== false) || organization?.isVeg;

  const sectionTitle = categoryTitle || "Popular Right Now";
  const sectionSubtitle = categoryTitle
    ? `Showing items in ${categoryTitle}`
    : `Most ordered by guests at ${storeName} today`;

  return (
    <section className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[#131b2e] tracking-tight truncate">
            {sectionTitle}
          </h3>
          <p className="text-xs text-stone-500 truncate">{sectionSubtitle}</p>
        </div>

        {hasVeg && (
          <div className="flex items-center gap-1 bg-[#eaedff] px-2 py-1 rounded-full flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#005e3f]" />
            <span className="text-[10px] text-stone-600 font-semibold">
              Pure Veg Available
            </span>
          </div>
        )}
      </div>

      {/* Product List */}
      {items.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl text-center border border-stone-100 shadow-xs">
          <p className="text-sm font-semibold text-stone-700">No items found</p>
          <p className="text-xs text-stone-400 mt-1">
            Try searching for another dish or selecting a different category.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              currencySymbol={currencySymbol}
            />
          ))}
        </div>
      )}
    </section>
  );
}
