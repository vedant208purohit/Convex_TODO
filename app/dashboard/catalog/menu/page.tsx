"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PosShell } from "../../../components/PosShell";
import { OrderDateRangePicker } from "../../../components/OrderDateRangePicker";

function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export default function MenuCatalogPage() {
  const router = useRouter();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isAddingId, setIsAddingId] = useState<string | null>(null);

  // Date Range state for Calendar & telemetry basis
  const [selectedPreset, setSelectedPreset] = useState<string>("Today");
  const [startDate, setStartDate] = useState<Date>(() => getStartOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => getEndOfDay(new Date()));

  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  const dashboardData = useQuery(
    api.dashboards.getDashboard,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );

  const draftData = useQuery(
    api.dashboards.getDraft,
    dashboardData?.dashboard ? { dashboardId: dashboardData.dashboard._id } : "skip"
  );

  const createOrUpdateDraftMutation = useMutation(api.dashboards.createOrUpdateDraft);

  // Map user preset string to Convex DateRangePreset
  const dateRangePresetArg = useMemo(() => {
    switch (selectedPreset) {
      case "Today":
        return "today";
      case "Yesterday":
        return "yesterday";
      case "Last 7 Days":
        return "last_7_days";
      case "Last 30 Days":
        return "last_30_days";
      case "This Month":
        return "this_month";
      case "Last Month":
        return "last_month";
      default:
        return "custom";
    }
  }, [selectedPreset]);

  // Active placements
  const currentPlacements = useMemo(() => {
    if (draftData?.placements && draftData.placements.length > 0) {
      return draftData.placements;
    }
    if (dashboardData?.placements && dashboardData.placements.length > 0) {
      return dashboardData.placements;
    }
    return [];
  }, [draftData?.placements, dashboardData?.placements]);

  const placedWidgetMap = useMemo(() => {
    const map = new Map<string, { gridRow: number; gridCol: number; width: number }>();
    for (const p of currentPlacements) {
      map.set(p.widgetId, { gridRow: p.gridRow, gridCol: p.gridCol, width: p.width });
    }
    return map;
  }, [currentPlacements]);

  // Common query args based on calendar selection
  const queryArgs = useMemo(() => {
    if (!activeOrg) return "skip";
    return {
      organizationId: activeOrg._id,
      dateRangePreset: dateRangePresetArg as any,
      fromTimestamp: startDate.getTime(),
      toTimestamp: endDate.getTime(),
    };
  }, [activeOrg, dateRangePresetArg, startDate, endDate]);

  // Scoped on-demand telemetry queries for Menu
  const topSellingData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "menu_top_selling" } : "skip"
  );

  const categoriesData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "menu_most_ordered_categories" } : "skip"
  );

  const bestsellingData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "menu_bestselling_items" } : "skip"
  );

  const lowPerformingData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "menu_low_performing" } : "skip"
  );

  const availabilityData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "menu_product_availability" } : "skip"
  );

  const stockoutAlertsData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "menu_out_of_stock_alerts" } : "skip"
  );

  const modifierData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "menu_modifier_popularity" } : "skip"
  );

  const performanceData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "menu_performance_summary" } : "skip"
  );

  // Handle Add Widget directly to current dashboard draft
  const handleAddWidget = async (widgetId: string, defaultWidth = 4, defaultHeight = 1) => {
    if (!activeOrg || !dashboardData?.dashboard || placedWidgetMap.has(widgetId)) return;
    setIsAddingId(widgetId);

    try {
      const nextPlacements = [
        ...currentPlacements,
        {
          widgetId,
          gridRow: 0,
          gridCol: 0,
          width: defaultWidth,
          height: defaultHeight,
          displayOrder: currentPlacements.length + 1,
          isEnabled: true,
        },
      ];

      // Auto-pack 12-column grid
      let currentRow = 0;
      let currentCol = 0;
      const packed = nextPlacements.map((p) => {
        const width = Math.min(12, Math.max(1, p.width || 4));
        const height = Math.max(1, p.height || 1);

        if (currentCol + width > 12) {
          currentRow += 1;
          currentCol = 0;
        }

        const assignedCol = currentCol;
        const assignedRow = currentRow;

        currentCol += width;
        if (currentCol >= 12) {
          currentRow += 1;
          currentCol = 0;
        }

        return {
          widgetId: p.widgetId,
          gridRow: assignedRow,
          gridCol: assignedCol,
          width,
          height,
          displayOrder: p.displayOrder,
          isEnabled: p.isEnabled ?? true,
        };
      });

      await createOrUpdateDraftMutation({
        dashboardId: dashboardData.dashboard._id,
        baseRevision: dashboardData.dashboard.revision ?? 1,
        placements: packed,
      });
    } catch (err) {
      console.error("Failed to add widget to draft:", err);
    } finally {
      setIsAddingId(null);
    }
  };

  // Filter cards by search keyword
  const widgetsList = [
    {
      id: "menu_top_selling",
      title: "Top-Selling Products",
      track: "PMIX LEADERBOARD",
      badge: "TABLE",
      desc: "Ranked list of highest volume dishes sold across dining room and online channels.",
      width: 4,
    },
    {
      id: "menu_most_ordered_categories",
      title: "Most Ordered Categories",
      track: "CATEGORY SHARE",
      badge: "CHART",
      desc: "Bar chart comparing sales volume across appetizers, main course, breads, beverages, and desserts.",
      width: 4,
    },
    {
      id: "menu_bestselling_items",
      title: "Bestselling Menu Items",
      track: "POPULARITY INDEX",
      badge: "TABLE",
      desc: "Compact table detailing units sold, revenue contribution percentage, and gross margins.",
      width: 4,
    },
    {
      id: "menu_low_performing",
      title: "Low-Performing Products",
      track: "LOW VELOCITY",
      badge: "TABLE",
      desc: "Items with lowest sales conversion or order frequency during the selected timeframe.",
      width: 4,
    },
    {
      id: "menu_product_availability",
      title: "Product Availability",
      track: "INVENTORY LINK",
      badge: "LIVE",
      desc: "Real-time stock status of kitchen menu items based on recipe ingredient inventory.",
      width: 4,
    },
    {
      id: "menu_out_of_stock_alerts",
      title: "Out-of-Stock Menu Items",
      track: "STOCKOUT GUARD",
      badge: "ALERT",
      desc: "Alert ledger of 86'd items disabled on POS terminals and online customer storefronts.",
      width: 4,
    },
    {
      id: "menu_modifier_popularity",
      title: "Modifier Popularity",
      track: "CUSTOMIZATION ANALYSIS",
      badge: "TABLE",
      desc: "Ranked list of most frequently selected item add-ons, spice levels, and cooking notes.",
      width: 4,
    },
    {
      id: "menu_performance_summary",
      title: "Menu Performance Summary",
      track: "MARGIN ARCHITECTURE",
      badge: "KPI",
      desc: "Overall catalog gross margin, active item count, and beverage attach rate.",
      width: 4,
    },
  ];

  const filteredWidgets = widgetsList.filter((w) =>
    w.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    w.desc.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    w.track.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  const activeCount = widgetsList.filter((w) => placedWidgetMap.has(w.id)).length;

  return (
    <PosShell
      title="Menu & Product Catalog"
      subtitle="Telemetry Catalog · Menu Velocity, Margins & 86 Alerts"
    >
      <div className="flex flex-col w-full min-h-screen bg-surface">
        {/* Top Action & Navigation Sub-Bar */}
        <section className="px-space-xl py-space-md bg-surface-container-low/70 flex flex-wrap items-center justify-between gap-space-md border-b border-outline-variant/30">
          <div className="flex items-center gap-space-md">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-space-xs font-label-md text-label-md text-secondary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>BACK TO DASHBOARD</span>
            </Link>
            <span className="inline-flex items-center gap-1.5 px-space-md py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface-variant font-medium">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              8 Widgets Available • {activeCount} Configured
            </span>
          </div>
          <div className="flex items-center gap-space-sm">
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-space-xs bg-primary text-on-primary font-label-md text-label-md px-space-lg py-space-sm rounded-full shadow-sm hover:opacity-90 active:scale-95 transition-all"
            >
              <span>Done / Return to Dashboard</span>
              <span className="material-symbols-outlined text-[16px]">check</span>
            </button>
          </div>
        </section>

        {/* Category Banner Header */}
        <header className="px-space-xl pt-space-xl pb-space-lg">
          <div className="p-space-lg rounded-DEFAULT bg-surface-container flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg shadow-sm border border-outline-variant/20">
            <div className="flex items-start md:items-center gap-space-md">
              <div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[28px]">restaurant_menu</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-semibold">
                  Catalog Velocity, Dish Margins &amp; 86 Item Guards
                </span>
                <h1 className="font-display-sm text-display-sm text-on-surface leading-none mt-1">
                  Menu
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-2xl">
                  Analyze item velocity rankings, dish category demand share, high-margin item pacing, and ingredient availability.
                </p>
              </div>
            </div>

            {/* Search & Meta Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm w-full lg:w-auto">
              <div className="relative flex-1 sm:w-64">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">
                  search
                </span>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Search Menu widgets..."
                  className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest font-body-sm text-body-sm text-on-surface placeholder:text-outline rounded-full outline-none focus:bg-surface-container-low transition-colors shadow-sm border border-outline-variant/30"
                />
              </div>

              {/* Order Date Range Picker */}
              <div className="shrink-0">
                <OrderDateRangePicker
                  preset={selectedPreset}
                  startDate={startDate}
                  endDate={endDate}
                  onChange={({ startDate: s, endDate: e, preset: p }) => {
                    setSelectedPreset(p);
                    setStartDate(s);
                    setEndDate(e);
                  }}
                />
              </div>

              <div className="px-space-md py-2 rounded-full bg-surface-container-high/60 text-center sm:text-right shrink-0">
                <span className="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase font-semibold">
                  8 WIDGETS • {activeCount} ACTIVE
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* 3-Column Widget Cards Grid */}
        <main className="px-space-xl pb-space-xl flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {/* Card 1: Top-Selling Products */}
            {filteredWidgets.some((w) => w.id === "menu_top_selling") && (
              <article className="flex flex-col justify-between p-space-lg rounded-DEFAULT bg-surface-container-low shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div>
                  <div className="flex items-center justify-between gap-space-sm mb-space-sm">
                    <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">
                      PMIX LEADERBOARD
                    </span>
                    <span className="px-space-sm py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant font-semibold">
                      TABLE
                    </span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Top-Selling Products
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Ranked list of highest volume dishes sold across dining room and online channels.
                  </p>

                  {/* Rich Telemetry Preview */}
                  <div className="mt-space-md p-space-md rounded-DEFAULT bg-surface-container flex flex-col gap-space-sm min-h-[120px] justify-center">
                    {topSellingData?.summary?.topItems && topSellingData.summary.topItems.length > 0 ? (
                      topSellingData.summary.topItems.map((item: any, idx: number) => (
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
                </div>

                <div className="flex items-center justify-between mt-space-lg pt-space-sm border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("menu_top_selling") ? (
                    <button className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">done</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("menu_top_selling", 4, 1)}
                      disabled={isAddingId === "menu_top_selling"}
                      className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all"
                    >
                      <span>+ Add Widget</span>
                    </button>
                  )}
                </div>
              </article>
            )}

            {/* Card 2: Most Ordered Categories */}
            {filteredWidgets.some((w) => w.id === "menu_most_ordered_categories") && (
              <article className="flex flex-col justify-between p-space-lg rounded-DEFAULT bg-surface-container-low shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div>
                  <div className="flex items-center justify-between gap-space-sm mb-space-sm">
                    <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">
                      CATEGORY SHARE
                    </span>
                    <span className="px-space-sm py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant font-semibold">
                      CHART
                    </span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Most Ordered Categories
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Bar chart comparing sales volume across appetizers, main course, breads, beverages, and desserts.
                  </p>

                  {/* Rich Preview Section (Horizontal Progress Bars) */}
                  <div className="mt-space-md p-space-md rounded-DEFAULT bg-surface-container flex flex-col gap-space-sm min-h-[120px] justify-center">
                    {categoriesData?.summary?.categories && categoriesData.summary.categories.length > 0 ? (
                      categoriesData.summary.categories.map((c: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex justify-between font-label-sm text-label-sm">
                            <span className="text-on-surface font-medium truncate">{c.name}</span>
                            <span className="text-outline shrink-0">{c.percent}% • {c.revenue}</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
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
                </div>

                <div className="flex items-center justify-between mt-space-lg pt-space-sm border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("menu_most_ordered_categories") ? (
                    <button className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">done</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("menu_most_ordered_categories", 4, 1)}
                      disabled={isAddingId === "menu_most_ordered_categories"}
                      className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all"
                    >
                      <span>+ Add Widget</span>
                    </button>
                  )}
                </div>
              </article>
            )}

            {/* Card 3: Bestselling Menu Items */}
            {filteredWidgets.some((w) => w.id === "menu_bestselling_items") && (
              <article className="flex flex-col justify-between p-space-lg rounded-DEFAULT bg-surface-container-low shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div>
                  <div className="flex items-center justify-between gap-space-sm mb-space-sm">
                    <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">
                      POPULARITY INDEX
                    </span>
                    <span className="px-space-sm py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant font-semibold">
                      TABLE
                    </span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Bestselling Menu Items
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Compact table detailing units sold, revenue contribution percentage, and gross margins.
                  </p>

                  {/* Rich Preview Section (Table Style) */}
                  <div className="mt-space-md p-space-md rounded-DEFAULT bg-surface-container flex flex-col gap-space-xs min-h-[120px] justify-center">
                    <div className="grid grid-cols-12 font-label-sm text-label-sm text-outline pb-1">
                      <span className="col-span-5 uppercase">Item</span>
                      <span className="col-span-2 text-center uppercase">Qty</span>
                      <span className="col-span-2 text-right uppercase">Rev%</span>
                      <span className="col-span-3 text-right uppercase">Margin</span>
                    </div>
                    {bestsellingData?.summary?.bestsellingRows && bestsellingData.summary.bestsellingRows.length > 0 ? (
                      bestsellingData.summary.bestsellingRows.slice(0, 3).map((row: any, idx: number) => (
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
                </div>

                <div className="flex items-center justify-between mt-space-lg pt-space-sm border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("menu_bestselling_items") ? (
                    <button className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">done</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("menu_bestselling_items", 4, 1)}
                      disabled={isAddingId === "menu_bestselling_items"}
                      className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all"
                    >
                      <span>+ Add Widget</span>
                    </button>
                  )}
                </div>
              </article>
            )}

            {/* Card 4: Low-Performing Products */}
            {filteredWidgets.some((w) => w.id === "menu_low_performing") && (
              <article className="flex flex-col justify-between p-space-lg rounded-DEFAULT bg-surface-container-low shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div>
                  <div className="flex items-center justify-between gap-space-sm mb-space-sm">
                    <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">
                      LOW VELOCITY
                    </span>
                    <span className="px-space-sm py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant font-semibold">
                      TABLE
                    </span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Low-Performing Products
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Items with lowest sales conversion or order frequency during the selected timeframe.
                  </p>

                  {/* Rich Preview Section */}
                  <div className="mt-space-md p-space-md rounded-DEFAULT bg-surface-container flex flex-col gap-space-sm min-h-[120px] justify-center">
                    {lowPerformingData?.summary?.lowItems && lowPerformingData.summary.lowItems.length > 0 ? (
                      lowPerformingData.summary.lowItems.map((item: any, idx: number) => (
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
                </div>

                <div className="flex items-center justify-between mt-space-lg pt-space-sm border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("menu_low_performing") ? (
                    <button className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">done</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("menu_low_performing", 4, 1)}
                      disabled={isAddingId === "menu_low_performing"}
                      className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all"
                    >
                      <span>+ Add Widget</span>
                    </button>
                  )}
                </div>
              </article>
            )}

            {/* Card 5: Product Availability */}
            {filteredWidgets.some((w) => w.id === "menu_product_availability") && (
              <article className="flex flex-col justify-between p-space-lg rounded-DEFAULT bg-surface-container-low shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div>
                  <div className="flex items-center justify-between gap-space-sm mb-space-sm">
                    <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">
                      INVENTORY LINK
                    </span>
                    <span className="px-space-sm py-0.5 rounded-full bg-surface-container-highest font-label-sm text-label-sm text-primary font-semibold">
                      LIVE
                    </span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Product Availability
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Real-time stock status of kitchen menu items based on recipe ingredient inventory.
                  </p>

                  {/* Rich Preview Section */}
                  <div className="mt-space-md p-space-md rounded-DEFAULT bg-surface-container flex flex-col gap-space-sm min-h-[120px] justify-center">
                    {availabilityData?.summary?.availabilityList && availabilityData.summary.availabilityList.length > 0 ? (
                      availabilityData.summary.availabilityList.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between font-body-sm text-body-sm">
                          <span className="font-medium truncate">{item.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                item.status === "Out of Stock" || item.status === "Unavailable"
                                  ? "bg-red-500"
                                  : item.status === "Low Stock" || item.isWarning
                                  ? "bg-amber-500 animate-pulse"
                                  : "bg-emerald-600"
                              }`}
                            />
                            <span
                              className={`font-label-sm text-label-sm font-semibold ${
                                item.status === "Out of Stock" || item.status === "Unavailable"
                                  ? "text-red-700"
                                  : item.status === "Low Stock" || item.isWarning
                                  ? "text-amber-700"
                                  : "text-emerald-700"
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
                </div>

                <div className="flex items-center justify-between mt-space-lg pt-space-sm border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("menu_product_availability") ? (
                    <button className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">done</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("menu_product_availability", 4, 1)}
                      disabled={isAddingId === "menu_product_availability"}
                      className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all"
                    >
                      <span>+ Add Widget</span>
                    </button>
                  )}
                </div>
              </article>
            )}

            {/* Card 6: Out-of-Stock Menu Items */}
            {filteredWidgets.some((w) => w.id === "menu_out_of_stock_alerts") && (
              <article className="flex flex-col justify-between p-space-lg rounded-DEFAULT bg-surface-container-low shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div>
                  <div className="flex items-center justify-between gap-space-sm mb-space-sm">
                    <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">
                      STOCKOUT GUARD
                    </span>
                    <span className="px-space-sm py-0.5 rounded-full bg-error-container font-label-sm text-label-sm text-on-error-container font-semibold">
                      ALERT
                    </span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Out-of-Stock Menu Items
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Alert ledger of 86'd items disabled on POS terminals and online customer storefronts.
                  </p>

                  {/* Rich Rose Alert Card Preview */}
                  <div
                    className={`mt-space-md p-space-md rounded-DEFAULT flex flex-col gap-space-xs min-h-[120px] justify-center ${
                      stockoutAlertsData?.summary?.stockoutList && stockoutAlertsData.summary.stockoutList.length > 0
                        ? "bg-error-container/40"
                        : "bg-surface-container"
                    }`}
                  >
                    {stockoutAlertsData?.summary?.stockoutList && stockoutAlertsData.summary.stockoutList.length > 0 ? (
                      stockoutAlertsData.summary.stockoutList.map((item: any, idx: number) => (
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
                        <span>All menu items currently active &amp; in stock</span>
                      </div>
                    )}
                    <div
                      className={`mt-1 pt-1.5 flex items-center justify-between font-label-sm text-label-sm border-t ${
                        stockoutAlertsData?.summary?.stockoutList && stockoutAlertsData.summary.stockoutList.length > 0
                          ? "text-on-error-container border-error-container/60"
                          : "text-outline border-outline-variant/10"
                      }`}
                    >
                      <span className="font-medium tracking-wide">Auto-disabled on POS &amp; Web Store</span>
                      <span className="material-symbols-outlined text-[14px]">lock</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-space-lg pt-space-sm border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("menu_out_of_stock_alerts") ? (
                    <button className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">done</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("menu_out_of_stock_alerts", 4, 1)}
                      disabled={isAddingId === "menu_out_of_stock_alerts"}
                      className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all"
                    >
                      <span>+ Add Widget</span>
                    </button>
                  )}
                </div>
              </article>
            )}

            {/* Card 7: Modifier Popularity */}
            {filteredWidgets.some((w) => w.id === "menu_modifier_popularity") && (
              <article className="flex flex-col justify-between p-space-lg rounded-DEFAULT bg-surface-container-low shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div>
                  <div className="flex items-center justify-between gap-space-sm mb-space-sm">
                    <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">
                      CUSTOMIZATION ANALYSIS
                    </span>
                    <span className="px-space-sm py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant font-semibold">
                      TABLE
                    </span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Modifier Popularity
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Ranked list of most frequently selected item add-ons, spice levels, and cooking notes.
                  </p>

                  {/* Rich Preview Section */}
                  <div className="mt-space-md p-space-md rounded-DEFAULT bg-surface-container flex flex-col gap-space-sm min-h-[120px] justify-center">
                    {modifierData?.summary?.modifierRows && modifierData.summary.modifierRows.length > 0 ? (
                      modifierData.summary.modifierRows.map((mod: any, idx: number) => (
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
                </div>

                <div className="flex items-center justify-between mt-space-lg pt-space-sm border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("menu_modifier_popularity") ? (
                    <button className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">done</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("menu_modifier_popularity", 4, 1)}
                      disabled={isAddingId === "menu_modifier_popularity"}
                      className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all"
                    >
                      <span>+ Add Widget</span>
                    </button>
                  )}
                </div>
              </article>
            )}

            {/* Card 8: Menu Performance Summary */}
            {filteredWidgets.some((w) => w.id === "menu_performance_summary") && (
              <article className="flex flex-col justify-between p-space-lg rounded-DEFAULT bg-surface-container-low shadow-sm hover:shadow-md transition-shadow border border-outline-variant/20">
                <div>
                  <div className="flex items-center justify-between gap-space-sm mb-space-sm">
                    <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wider">
                      MARGIN ARCHITECTURE
                    </span>
                    <span className="px-space-sm py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant font-semibold">
                      KPI
                    </span>
                  </div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Menu Performance Summary
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Overall catalog gross margin, active item count, and beverage attach rate.
                  </p>

                  {/* Rich Preview Section (Multi-Metric) */}
                  <div className="mt-space-md p-space-md rounded-DEFAULT bg-surface-container grid grid-cols-3 gap-space-xs min-h-[120px] items-center">
                    <div className="flex flex-col p-space-xs rounded-sm bg-surface-container-lowest/60 text-center">
                      <span className="font-label-sm text-label-sm text-outline uppercase">Margin</span>
                      <span className="font-headline-md text-headline-md text-on-surface font-semibold mt-1">
                        {performanceData?.summary?.marginPercent || "67.2%"}
                      </span>
                      <span className="font-label-sm text-label-sm text-secondary mt-0.5">
                        {performanceData?.summary?.marginDelta || "+1.8% vs LW"}
                      </span>
                    </div>
                    <div className="flex flex-col p-space-xs rounded-sm bg-surface-container-lowest/60 text-center">
                      <span className="font-label-sm text-label-sm text-outline uppercase">Active</span>
                      <span className="font-headline-md text-headline-md text-on-surface font-semibold mt-1">
                        {performanceData?.summary?.activeRatio || "0/0"}
                      </span>
                      <span className="font-label-sm text-label-sm text-error mt-0.5">
                        {performanceData?.summary?.inactiveCount || "0 Inactive"}
                      </span>
                    </div>
                    <div className="flex flex-col p-space-xs rounded-sm bg-surface-container-lowest/60 text-center">
                      <span className="font-label-sm text-label-sm text-outline uppercase">Attach</span>
                      <span className="font-headline-md text-headline-md text-on-surface font-semibold mt-1">
                        {performanceData?.summary?.attachRate || "42.8%"}
                      </span>
                      <span className="font-label-sm text-label-sm text-secondary mt-0.5">
                        {performanceData?.summary?.attachCategory || "Beverages"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-space-lg pt-space-sm border-t border-outline-variant/20">
                  <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                    LAYOUT: 1X1 SQUARE
                  </span>
                  {placedWidgetMap.has("menu_performance_summary") ? (
                    <button className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[16px]">done</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("menu_performance_summary", 4, 1)}
                      disabled={isAddingId === "menu_performance_summary"}
                      className="inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-primary text-on-primary font-label-md text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all"
                    >
                      <span>+ Add Widget</span>
                    </button>
                  )}
                </div>
              </article>
            )}
          </div>
        </main>

        {/* Bottom Info & Navigation Bar */}
        <footer className="px-space-xl pb-space-xl">
          <div className="p-space-md rounded-DEFAULT bg-surface-container flex flex-col sm:flex-row items-center justify-between gap-space-md shadow-sm border border-outline-variant/20">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[20px] text-secondary">info</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Menu widgets reflect real-time POS orders and synchronize instantly with digital QR menus.
              </span>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-space-xs font-label-md text-label-md text-primary font-semibold hover:underline shrink-0"
            >
              <span>Manage Dashboard Layout</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </footer>
      </div>
    </PosShell>
  );
}
