"use client";

import React from "react";
import { OrdersCatalogWidget } from "../AddWidgetDrawer";

export interface DrawerCardProps {
  widget: OrdersCatalogWidget;
  isPlaced: boolean;
  placement?: { gridRow: number; gridCol: number };
  onAdd: () => void;
  data?: any;
}

export const MENU_CATALOG_WIDGETS: OrdersCatalogWidget[] = [
  {
    id: "menu_top_selling",
    categoryTrack: "PMIX LEADERBOARD",
    title: "Top-Selling Products",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description:
      "Ranked list of highest volume dishes sold across dining room and online channels.",
    defaultWidth: 4,
  },
  {
    id: "menu_most_ordered_categories",
    categoryTrack: "CATEGORY SHARE",
    title: "Most Ordered Categories",
    type: "CHART",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description:
      "Bar chart comparing sales volume across appetizers, main course, breads, beverages, and desserts.",
    defaultWidth: 4,
  },
  {
    id: "menu_bestselling_items",
    categoryTrack: "POPULARITY INDEX",
    title: "Bestselling Menu Items",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description:
      "Compact table detailing units sold, revenue contribution percentage, and gross margins.",
    defaultWidth: 4,
  },
  {
    id: "menu_low_performing",
    categoryTrack: "LOW VELOCITY",
    title: "Low-Performing Products",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description:
      "Items with lowest sales conversion or order frequency during the selected timeframe.",
    defaultWidth: 4,
  },
  {
    id: "menu_product_availability",
    categoryTrack: "INVENTORY LINK",
    title: "Product Availability",
    type: "LIVE",
    typeBadgeBg: "bg-black text-white",
    description:
      "Real-time stock status of kitchen menu items with portion count countdowns.",
    defaultWidth: 4,
  },
  {
    id: "menu_out_of_stock_alerts",
    categoryTrack: "STOCKOUT GUARD",
    title: "Out-of-Stock Menu Items",
    type: "ALERT",
    typeBadgeBg: "bg-red-100 text-red-800",
    description:
      "Alert ledger of 86'd items disabled on POS terminals and online customer storefronts.",
    defaultWidth: 4,
  },
  {
    id: "menu_modifier_popularity",
    categoryTrack: "CUSTOMIZATION ANALYSIS",
    title: "Modifier Popularity",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description:
      "Ranked list of most frequently selected item add-ons, spice levels, and cooking notes.",
    defaultWidth: 4,
  },
  {
    id: "menu_performance_summary",
    categoryTrack: "MARGIN ARCHITECTURE",
    title: "Menu Performance Summary",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description:
      "Overall catalog gross margin, active item count, and beverage attach rate.",
    defaultWidth: 4,
  },
];

// 1. Top Selling
export function DrawerMenuTopSellingCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const topItems =
    data?.summary?.topItems || data?.table?.rows?.slice(0, 3) || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[95px] justify-center">
          {topItems.length > 0 ? (
            topItems.slice(0, 3).map((item: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-0.5 border-b border-[#f3ede6] last:border-b-0"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-stone-800">
                    {item.rank || idx + 1}.
                  </span>
                  <span className="truncate font-medium text-stone-800">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-stone-400">
                    {item.qty} sold
                  </span>
                  <span className="font-semibold text-stone-900">
                    {item.revenue}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-stone-400">
              No items sold in selected period
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 2. Most Ordered Categories
export function DrawerMenuMostOrderedCategoriesCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const categories = data?.summary?.categories || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[95px] justify-center">
          {categories.length > 0 ? (
            categories.slice(0, 3).map((c: any, idx: number) => (
              <div key={idx} className="flex flex-col gap-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="font-medium text-stone-800 truncate">
                    {c.name}
                  </span>
                  <span className="text-stone-400">
                    {c.percent}% • {c.revenue}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className="bg-stone-800 h-full rounded-full"
                    style={{ width: `${Math.max(5, c.percent)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-stone-400">
              No category sales recorded
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 3. Bestselling Menu Items
export function DrawerMenuBestsellingItemsCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const rows = data?.summary?.bestsellingRows || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center">
          <div className="grid grid-cols-12 text-[10px] font-bold text-stone-400 pb-0.5">
            <span className="col-span-5 uppercase">Item</span>
            <span className="col-span-2 text-center uppercase">Qty</span>
            <span className="col-span-2 text-right uppercase">Rev%</span>
            <span className="col-span-3 text-right uppercase">Margin</span>
          </div>
          {rows.length > 0 ? (
            rows.slice(0, 3).map((r: any, idx: number) => (
              <div
                key={idx}
                className="grid grid-cols-12 items-center text-xs py-0.5 bg-white px-1 rounded border border-[#f0eae3]"
              >
                <span className="col-span-5 font-medium text-stone-800 truncate">
                  {r.item}
                </span>
                <span className="col-span-2 text-center text-stone-500">
                  {r.qty}
                </span>
                <span className="col-span-2 text-right text-stone-700">
                  {r.revPercent}
                </span>
                <span className="col-span-3 text-right font-bold text-stone-900">
                  {r.margin}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-stone-400">
              No item sales recorded
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 4. Low-Performing Products
export function DrawerMenuLowPerformingCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const lowItems = data?.summary?.lowItems || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center">
          {lowItems.length > 0 ? (
            lowItems.slice(0, 3).map((item: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-0.5 border-b border-[#f3ede6] last:border-b-0"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-stone-800 truncate">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {item.qty} orders • {item.revenue}
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                  {item.badge}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-stone-400">
              No low velocity items
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 5. Product Availability
export function DrawerMenuProductAvailabilityCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const availabilityList = data?.summary?.availabilityList || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center">
          {availabilityList.length > 0 ? (
            availabilityList.slice(0, 3).map((item: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-0.5"
              >
                <span className="font-medium text-stone-800 truncate">
                  {item.name}
                </span>
                <span
                  className={`text-[10px] font-bold ${item.isWarning ? "text-amber-700" : "text-stone-700"}`}
                >
                  {item.status}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-stone-400">
              No items configured in catalog
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 6. Out-of-Stock Menu Items
export function DrawerMenuOutOfStockAlertsCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const stockoutList = data?.summary?.stockoutList || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-red-50/60 rounded-lg p-2.5 flex flex-col gap-1 border border-red-100 min-h-[95px] justify-center">
          {stockoutList.length > 0 ? (
            stockoutList.slice(0, 2).map((item: any, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-1.5 text-xs text-red-900"
              >
                <span className="material-symbols-outlined text-[14px] text-red-600 shrink-0 mt-0.5">
                  warning
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold truncate">{item.name}</span>
                  <span className="text-[10px] text-stone-500">
                    {item.reason}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-800 py-1">
              <span className="material-symbols-outlined text-[14px] text-emerald-600">
                check_circle
              </span>
              <span>All catalog items in stock</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 7. Modifier Popularity
export function DrawerMenuModifierPopularityCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const mods = data?.summary?.modifierRows || [];

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1 border border-[#f3ede6] min-h-[95px] justify-center">
          {mods.length > 0 ? (
            mods.slice(0, 3).map((mod: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-0.5"
              >
                <span className="font-medium text-stone-800 truncate">
                  {mod.name}
                </span>
                <span className="text-[10px] font-bold text-stone-900">
                  {mod.hits} hits
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-2 text-xs text-stone-400">
              No modifier hits recorded
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// 8. Menu Performance Summary
export function DrawerMenuPerformanceSummaryCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const summary = data?.summary || {};

  return (
    <article className="bg-white rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1]">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>
        <p className="text-xs text-stone-500 min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-2 grid grid-cols-3 gap-1 border border-[#f3ede6] min-h-[95px] items-center text-center">
          <div className="bg-white p-1 rounded border border-[#f0eae3]">
            <span className="text-[9px] font-bold text-stone-400 block uppercase">
              Margin
            </span>
            <span className="text-xs font-bold text-stone-900">
              {summary.marginPercent || "67.2%"}
            </span>
          </div>
          <div className="bg-white p-1 rounded border border-[#f0eae3]">
            <span className="text-[9px] font-bold text-stone-400 block uppercase">
              Active
            </span>
            <span className="text-xs font-bold text-stone-900">
              {summary.activeRatio || "0/0"}
            </span>
          </div>
          <div className="bg-white p-1 rounded border border-[#f0eae3]">
            <span className="text-[9px] font-bold text-stone-400 block uppercase">
              Attach
            </span>
            <span className="text-xs font-bold text-stone-900">
              {summary.attachRate || "42.8%"}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#f0eae3] flex items-center justify-between mt-3">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow} COL ${placement.gridCol}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[14px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function renderMenuDrawerCard(
  widget: OrdersCatalogWidget,
  isPlaced: boolean,
  placement: { gridRow: number; gridCol: number } | undefined,
  onAdd: () => void,
  data: any,
) {
  const props: DrawerCardProps = { widget, isPlaced, placement, onAdd, data };

  switch (widget.id) {
    case "menu_top_selling":
      return <DrawerMenuTopSellingCard key={widget.id} {...props} />;
    case "menu_most_ordered_categories":
      return <DrawerMenuMostOrderedCategoriesCard key={widget.id} {...props} />;
    case "menu_bestselling_items":
      return <DrawerMenuBestsellingItemsCard key={widget.id} {...props} />;
    case "menu_low_performing":
      return <DrawerMenuLowPerformingCard key={widget.id} {...props} />;
    case "menu_product_availability":
      return <DrawerMenuProductAvailabilityCard key={widget.id} {...props} />;
    case "menu_out_of_stock_alerts":
      return <DrawerMenuOutOfStockAlertsCard key={widget.id} {...props} />;
    case "menu_modifier_popularity":
      return <DrawerMenuModifierPopularityCard key={widget.id} {...props} />;
    case "menu_performance_summary":
      return <DrawerMenuPerformanceSummaryCard key={widget.id} {...props} />;
    default:
      return null;
  }
}
