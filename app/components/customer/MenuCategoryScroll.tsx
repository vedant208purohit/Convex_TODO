"use client";

import React from "react";
import { CustomerCategory } from "./types";
import { CategoryIcon } from "./CustomerIcons";

interface MenuCategoryScrollProps {
  categories: CustomerCategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onViewAllClick?: () => void;
}

export function MenuCategoryScroll({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onViewAllClick,
}: MenuCategoryScrollProps) {
  const totalItemCount = categories.reduce(
    (sum, c) => sum + (c.category.items?.length || 0),
    0
  );

  const handleViewAll = () => {
    onSelectCategory(null);
    if (onViewAllClick) {
      onViewAllClick();
    }
  };

  return (
    <section className="flex flex-col gap-2.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-4 bg-[#4338ca] rounded-full" />
          <h3 className="text-base font-bold text-[#131b2e] tracking-tight">
            Our Menu
          </h3>
        </div>
        <button
          type="button"
          onClick={handleViewAll}
          className={`text-xs font-semibold hover:underline cursor-pointer ${
            selectedCategoryId === null ? "text-[#4338ca] font-bold" : "text-[#4338ca]"
          }`}
        >
          View All ({totalItemCount})
        </button>
      </div>

      {/* Horizontally Scrollable Category Row */}
      <div className="flex items-start gap-2.5 overflow-x-auto pb-1.5 -mx-4 px-4 scrollbar-none">
        {categories.map((catObj) => {
          const cat = catObj.category;
          const isSelected = selectedCategoryId === cat.id;
          const itemCount = cat.items?.length || 0;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(isSelected ? null : cat.id)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group text-center focus:outline-none"
            >
              <div
                className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 overflow-hidden relative ${
                  isSelected
                    ? "bg-[#4338ca] text-white shadow-md scale-105 ring-2 ring-[#4338ca] ring-offset-1"
                    : "bg-[#eaedff] text-stone-700 hover:bg-[#dae2fd] group-hover:scale-105"
                }`}
              >
                {cat.imageUrl ? (
                  <div className="w-full h-full relative">
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#4338ca]/30 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
                      </div>
                    )}
                  </div>
                ) : (
                  <CategoryIcon
                    name={cat.name}
                    className={`w-6 h-6 ${isSelected ? "text-white" : "text-[#4338ca]"}`}
                  />
                )}
              </div>
              <span className={`text-xs font-semibold max-w-[72px] truncate leading-tight ${
                isSelected ? "text-[#4338ca] font-bold" : "text-[#131b2e]"
              }`}>
                {cat.name}
              </span>
              <span className="text-[10px] text-stone-500 -mt-1 font-medium">
                {itemCount} {itemCount === 1 ? "Item" : "Items"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
