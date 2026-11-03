"use client";

import React from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface WidgetProps {
  organizationId: Id<"organizations">;
  widgetId: string;
  width: number;
  dateRangePreset?: any;
  fromTimestamp?: number;
  toTimestamp?: number;
  dateLabel?: string;
}

// 1. Top-Selling Products
export function MenuTopSellingWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const topItems = (widgetData as any)?.summary?.topItems || widgetData?.table?.rows?.slice(0, 3) || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">PMIX LEADERBOARD</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Top-Selling Products
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[120px] justify-center">
        {topItems.length > 0 ? (
          topItems.map((item: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between text-on-surface font-body-sm text-body-sm pb-1.5 bg-surface-container-highest/30 px-space-xs rounded-sm"
            >
              <div className="flex items-center gap-space-xs min-w-0">
                <span className="font-label-sm text-label-sm text-primary font-bold">
                  {item.rank || idx + 1}.
                </span>
                <span className="truncate font-medium">{item.name}</span>
              </div>
              <div className="flex items-center gap-space-sm shrink-0">
                <span className="text-outline text-[11px]">{item.qty} orders</span>
                <span className="font-semibold text-on-surface">{item.revenue}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <span className="material-symbols-outlined text-[24px] text-outline">restaurant</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              No items sold in selected period
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Catalog PMIX</span>
        <span>Live Sync</span>
      </div>
    </div>
  );
}

// 2. Most Ordered Categories
export function MenuMostOrderedCategoriesWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const categories = (widgetData as any)?.summary?.categories || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              CHART
            </span>
            <span className="font-label-sm text-[11px] text-secondary">CATEGORY SHARE</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Most Ordered Categories
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[120px] justify-center">
        {categories.length > 0 ? (
          categories.map((c: any, idx: number) => (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex justify-between font-label-sm text-label-sm">
                <span className="text-on-surface font-medium truncate">{c.name}</span>
                <span className="text-outline shrink-0">{c.percent}% • {c.revenue}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    idx === 0 ? "bg-primary" : idx === 1 ? "bg-secondary" : idx === 2 ? "bg-outline" : "bg-secondary-fixed-dim"
                  }`}
                  style={{ width: `${Math.max(5, c.percent)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <span className="material-symbols-outlined text-[24px] text-outline">category</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              No category orders recorded
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Demand Partition</span>
        <span>Real-time</span>
      </div>
    </div>
  );
}

// 3. Bestselling Menu Items
export function MenuBestsellingItemsWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const bestsellingRows = (widgetData as any)?.summary?.bestsellingRows || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">POPULARITY INDEX</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Bestselling Menu Items
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[120px] justify-center">
        <div className="grid grid-cols-12 font-label-sm text-label-sm text-outline pb-1">
          <span className="col-span-5 uppercase">Item</span>
          <span className="col-span-2 text-center uppercase">Qty</span>
          <span className="col-span-2 text-right uppercase">Rev%</span>
          <span className="col-span-3 text-right uppercase">Margin</span>
        </div>
        {bestsellingRows.length > 0 ? (
          bestsellingRows.slice(0, 3).map((row: any, idx: number) => (
            <div
              key={idx}
              className="grid grid-cols-12 items-center font-body-sm text-body-sm py-1 bg-surface-container-lowest/60 px-space-xs rounded-sm"
            >
              <span className="col-span-5 font-medium truncate">{row.item}</span>
              <span className="col-span-2 text-center text-outline">{row.qty}</span>
              <span className="col-span-2 text-right">{row.revPercent}</span>
              <span className="col-span-3 text-right font-semibold text-primary">{row.margin}</span>
            </div>
          ))
        ) : (
          <div className="py-2 text-center font-body-sm text-body-sm text-on-surface-variant">
            No sales recorded in period
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Margin &amp; Volume Index</span>
        <span>Synchronized</span>
      </div>
    </div>
  );
}

// 4. Low-Performing Products
export function MenuLowPerformingWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const lowItems = (widgetData as any)?.summary?.lowItems || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">LOW VELOCITY</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Low-Performing Products
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[120px] justify-center">
        {lowItems.length > 0 ? (
          lowItems.map((item: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between text-on-surface font-body-sm text-body-sm bg-surface-container-highest/20 p-space-xs rounded-sm"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{item.name}</span>
                <span className="font-label-sm text-label-sm text-outline">
                  {item.qty} orders • {item.revenue}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold shrink-0 ${
                  idx === 0
                    ? "bg-secondary-container text-on-secondary-container"
                    : idx === 1
                    ? "bg-error-container text-on-error-container"
                    : "text-secondary"
                }`}
              >
                {item.badge}
              </span>
            </div>
          ))
        ) : (
          <div className="py-2 text-center font-body-sm text-body-sm text-on-surface-variant">
            No low volume alerts
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Velocity Guard</span>
        <span>Real-time</span>
      </div>
    </div>
  );
}

// 5. Product Availability
export function MenuProductAvailabilityWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const availabilityList = (widgetData as any)?.summary?.availabilityList || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest font-label-sm text-label-sm text-primary font-semibold text-[10px] tracking-widest uppercase">
              LIVE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">INVENTORY LINK</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Product Availability
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[120px] justify-center">
        {availabilityList.length > 0 ? (
          availabilityList.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between font-body-sm text-body-sm">
              <span className="font-medium truncate">{item.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`w-2 h-2 rounded-full ${
                    item.isWarning ? "bg-on-tertiary-container animate-pulse" : "bg-primary"
                  }`}
                />
                <span
                  className={`font-label-sm text-label-sm font-semibold ${
                    item.isWarning ? "text-on-tertiary-container" : "text-on-surface"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-2 text-center font-body-sm text-body-sm text-on-surface-variant">
            No dishes configured in catalog
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Portion Countdown</span>
        <span>Active Sync</span>
      </div>
    </div>
  );
}

// 6. Out-of-Stock Menu Items
export function MenuOutOfStockAlertsWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const stockoutList = (widgetData as any)?.summary?.stockoutList || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              ALERT
            </span>
            <span className="font-label-sm text-[11px] text-secondary">STOCKOUT GUARD</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Out-of-Stock Menu Items
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-error-container/40 rounded-DEFAULT p-space-sm flex flex-col gap-space-xs my-auto min-h-[120px] justify-center">
        {stockoutList.length > 0 ? (
          stockoutList.map((item: any, idx: number) => (
            <div key={idx} className="flex items-start gap-space-xs font-body-sm text-body-sm text-on-error-container pb-1">
              <span className="material-symbols-outlined text-[16px] text-error shrink-0 mt-0.5">
                warning
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold truncate">{item.name}</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{item.reason}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant py-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">check_circle</span>
            <span>All menu items currently in stock</span>
          </div>
        )}
        <div className="mt-1 pt-1 flex items-center justify-between font-label-sm text-[11px] text-on-error-container border-t border-error-container/60">
          <span>Auto-disabled on POS &amp; Web</span>
          <span className="material-symbols-outlined text-[12px]">lock</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>86&apos;d Ledger</span>
        <span>Guard Active</span>
      </div>
    </div>
  );
}

// 7. Modifier Popularity
export function MenuModifierPopularityWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const modifierRows = (widgetData as any)?.summary?.modifierRows || [];

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              TABLE
            </span>
            <span className="font-label-sm text-[11px] text-secondary">CUSTOMIZATION ANALYSIS</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Modifier Popularity
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm flex flex-col gap-space-sm my-auto min-h-[120px] justify-center">
        {modifierRows.length > 0 ? (
          modifierRows.map((mod: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between font-body-sm text-body-sm bg-surface-container-highest/30 px-space-xs py-1 rounded-sm"
            >
              <div className="flex items-center gap-space-xs truncate">
                <span className="material-symbols-outlined text-[16px] text-outline">tune</span>
                <span className="font-medium truncate">{mod.name}</span>
              </div>
              <div className="flex items-center gap-space-sm shrink-0">
                <span className="font-semibold text-on-surface">{mod.hits} hits</span>
                <span className="font-label-sm text-label-sm text-primary">{mod.priceAddon}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-2 text-center font-body-sm text-body-sm text-on-surface-variant">
            No modifier hits recorded
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Option Frequency</span>
        <span>Telemetry</span>
      </div>
    </div>
  );
}

// 8. Menu Performance Summary
export function MenuPerformanceSummaryWidget({
  organizationId,
  widgetId,
  dateRangePreset = "today",
  fromTimestamp,
  toTimestamp,
  dateLabel,
}: WidgetProps) {
  const widgetData = useQuery(api.dashboards.getWidgetData, {
    organizationId,
    widgetId,
    dateRangePreset,
    fromTimestamp,
    toTimestamp,
  });

  const summary = (widgetData as any)?.summary || {};

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="flex items-start justify-between mb-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] tracking-widest uppercase font-semibold">
              KPI
            </span>
            <span className="font-label-sm text-[11px] text-secondary">MARGIN ARCHITECTURE</span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
            Menu Performance Summary
          </h3>
        </div>
        <span className="font-label-sm text-label-sm px-2 py-0.5 bg-surface-container rounded-full text-on-surface font-semibold shrink-0">
          {dateLabel || "Today"}
        </span>
      </div>

      <div className="bg-surface-container rounded-DEFAULT p-space-sm grid grid-cols-3 gap-space-xs my-auto min-h-[120px] items-center">
        <div className="flex flex-col p-space-xs rounded-sm bg-surface-container-lowest/60 text-center">
          <span className="font-label-sm text-label-sm text-outline uppercase">Margin</span>
          <span className="font-headline-md text-headline-md text-on-surface font-semibold mt-1">
            {summary.marginPercent || "67.2%"}
          </span>
          <span className="font-label-sm text-label-sm text-secondary mt-0.5">
            {summary.marginDelta || "+1.8% vs LW"}
          </span>
        </div>
        <div className="flex flex-col p-space-xs rounded-sm bg-surface-container-lowest/60 text-center">
          <span className="font-label-sm text-label-sm text-outline uppercase">Active</span>
          <span className="font-headline-md text-headline-md text-on-surface font-semibold mt-1">
            {summary.activeRatio || "0/0"}
          </span>
          <span className="font-label-sm text-label-sm text-error mt-0.5">
            {summary.inactiveCount || "0 Inactive"}
          </span>
        </div>
        <div className="flex flex-col p-space-xs rounded-sm bg-surface-container-lowest/60 text-center">
          <span className="font-label-sm text-label-sm text-outline uppercase">Attach</span>
          <span className="font-headline-md text-headline-md text-on-surface font-semibold mt-1">
            {summary.attachRate || "42.8%"}
          </span>
          <span className="font-label-sm text-label-sm text-secondary mt-0.5">
            {summary.attachCategory || "Beverages"}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-outline text-[11px] pt-space-xs border-t border-outline-variant/10">
        <span>Portfolio Health</span>
        <span>Synchronized</span>
      </div>
    </div>
  );
}

