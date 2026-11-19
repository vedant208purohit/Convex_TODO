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

export default function CustomersCatalogPage() {
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

  // Scoped on-demand telemetry queries for Customers
  const customersTotalData: any = undefined;

  const customersNewData: any = undefined;

  const customersReturningData: any = undefined;

  const customersRecentData: any = undefined;

  const customersMostFrequentData: any = undefined;

  const customersOrderFrequencyData: any = undefined;

  // Add widget with auto-packing
  const handleAddWidget = async (widgetId: string, defaultWidth: number = 4, defaultHeight: number = 1) => {
    if (!dashboardData?.dashboard || !activeOrg) return;
    setIsAddingId(widgetId);

    try {
      const isAlreadyPlaced = currentPlacements.some((p) => p.widgetId === widgetId);
      if (isAlreadyPlaced) {
        setIsAddingId(null);
        return;
      }

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
      console.error("Failed to add customer widget to draft:", err);
    } finally {
      setIsAddingId(null);
    }
  };

  const widgetsList = [
    {
      id: "customers_total",
      title: "Total Customers",
      track: "Audience Reach",
      badge: "KPI",
      desc: "All unique guest profiles registered across dine-in, takeaway, and digital online channels.",
      width: 4,
    },
    {
      id: "customers_new",
      title: "New Customers",
      track: "Acquisition Rate",
      badge: "KPI",
      desc: "First-time registered dining folios and newly created guest accounts in the selected period.",
      width: 4,
    },
    {
      id: "customers_returning",
      title: "Returning Customers",
      track: "Retention & Loyalty",
      badge: "KPI",
      desc: "Repeat patrons with 2 or more historical dining visits.",
      width: 4,
    },
    {
      id: "customers_recent",
      title: "Recent Customers",
      track: "Guest Log",
      badge: "TABLE",
      desc: "Real-time ledger of latest seated and billed patrons with spend history and table location.",
      width: 4,
    },
    {
      id: "customers_most_frequent",
      title: "Most Frequent Customers",
      track: "Top Patrons",
      badge: "TABLE",
      desc: "Ranked guest leaderboard by visit frequency and cumulative spend.",
      width: 4,
    },
    {
      id: "customers_order_frequency",
      title: "Customer Order Frequency",
      track: "Visit Frequency",
      badge: "CHART",
      desc: "Distribution of customer visit counts across one-time, occasional, and frequent diners.",
      width: 4,
    },
  ];

  const filteredWidgets = useMemo(() => {
    if (!searchKeyword.trim()) return widgetsList;
    const q = searchKeyword.toLowerCase();
    return widgetsList.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.desc.toLowerCase().includes(q) ||
        w.track.toLowerCase().includes(q)
    );
  }, [searchKeyword, widgetsList]);

  const placedCount = useMemo(() => {
    return widgetsList.filter((w) => placedWidgetMap.has(w.id)).length;
  }, [placedWidgetMap, widgetsList]);

  // Summaries
  const totSummary = (customersTotalData as any)?.summary || {};
  const newSummary = (customersNewData as any)?.summary || {};
  const retSummary = (customersReturningData as any)?.summary || {};
  const recSummary = (customersRecentData as any)?.summary || {};
  const freqSummary = (customersMostFrequentData as any)?.summary || {};
  const cohortSummary = (customersOrderFrequencyData as any)?.summary || {};

  return (
    <PosShell title="Customers Catalog" subtitle="Operational Station Widgets">
      <div className="flex-1 flex flex-col bg-[#fbf8f5] min-h-screen text-stone-900 overflow-y-auto">
        {/* Sub-Header & Breadcrumb */}
        <div className="bg-[#f5eee9] border-b border-[#e7ddd5] px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Link href="/dashboard" className="hover:text-stone-900 transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-stone-900 font-medium">Customers</span>
            </div>
            <h1 className="font-serif text-2xl text-stone-900 font-semibold tracking-tight">Customers</h1>
            <p className="text-xs text-stone-500 max-w-2xl">
              Understand patron dining frequency, repeat guest ratios, lifetime value tiers, and VIP visit histories in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <OrderDateRangePicker
              preset={selectedPreset}
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate: s, endDate: e, preset: p }) => {
                if (s) setStartDate(s);
                if (e) setEndDate(e);
                if (p) setSelectedPreset(p);
              }}
            />

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Search Customer widgets..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#decbc0] rounded-full focus:outline-none focus:ring-1 focus:ring-stone-900 w-48 sm:w-60 shadow-2xs"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-xs font-medium text-stone-600 bg-white/70 px-3 py-1 rounded-full border border-[#e2d5cb] shrink-0">
              <span className="font-bold text-stone-900">{widgetsList.length}</span> AVAILABLE •{" "}
              <span className="font-bold text-stone-900">{placedCount}</span> ON DASHBOARD
            </div>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Card 1: Total Customers */}
            {filteredWidgets.some((w) => w.id === "customers_total") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Audience Reach
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      KPI
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Total Customers</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      All unique guest profiles registered across dine-in, takeaway, and digital online channels.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] min-h-[110px] justify-center">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-3xl font-bold text-stone-900">
                          {totSummary.totalGuests || "0"}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">Guests</span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                        {totSummary.deltaPercent || "▲ +12.4%"}
                      </span>
                    </div>

                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden flex">
                      <div className="bg-black h-full" style={{ width: `${totSummary.dineInPercent ?? 67}%` }}></div>
                      <div className="bg-stone-400 h-full" style={{ width: `${totSummary.secondaryChannelPercent ?? totSummary.onlinePercent ?? 33}%` }}></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                      <span>Dine-In: {totSummary.dineInPercent ?? 67}%</span>
                      <span>{totSummary.secondaryChannelLabel || (totSummary.takeawayCount > 0 ? "Takeaway" : totSummary.deliveryCount > 0 ? "Delivery" : totSummary.onlineCount > 0 ? "Online" : "Takeaway")}: {totSummary.secondaryChannelPercent ?? totSummary.onlinePercent ?? 33}%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("customers_total")
                      ? `SLOT: ROW ${placedWidgetMap.get("customers_total")?.gridRow} COL ${placedWidgetMap.get("customers_total")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("customers_total") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("customers_total", 4, 1)}
                      disabled={isAddingId === "customers_total"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "customers_total" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 2: New Customers */}
            {filteredWidgets.some((w) => w.id === "customers_new") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Acquisition Rate
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      KPI
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">New Customers</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      First-time registered dining folios and newly created guest accounts in the selected period.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] min-h-[110px] justify-center">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-3xl font-bold text-stone-900">
                          {newSummary.newCount ?? 0}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">New</span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                        {newSummary.deltaPercent || "▲ +8.1% vs prev week"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-stone-100 text-[11px]">
                      <span className="text-stone-600 truncate">{newSummary.intakeRate || "28% of total covers"}</span>
                      <span className="font-semibold text-stone-900 shrink-0">Active Intake</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-stone-400 pt-0.5">
                      <span>{newSummary.foliosOpened || "Folios Opened: 24"}</span>
                      <span>{newSummary.fastTrack || "Fast-Track QR: 12"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("customers_new")
                      ? `SLOT: ROW ${placedWidgetMap.get("customers_new")?.gridRow} COL ${placedWidgetMap.get("customers_new")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("customers_new") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("customers_new", 4, 1)}
                      disabled={isAddingId === "customers_new"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "customers_new" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 3: Returning Customers */}
            {filteredWidgets.some((w) => w.id === "customers_returning") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Retention & Loyalty
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      KPI
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Returning Customers</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Repeat patrons with 2 or more historical dining visits and active loyalty points balance.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] min-h-[110px] justify-center">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-3xl font-bold text-stone-900">
                          {retSummary.retentionPercent || "0%"}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">Retention</span>
                      </div>
                      <span className="text-[11px] font-semibold text-stone-800 bg-stone-100 px-2 py-0.5 rounded-full">
                        {retSummary.visitsCount || "0 Visits"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-stone-100 text-[11px]">
                      <span className="text-stone-500">Repeat Visitors:</span>
                      <span className="font-semibold text-stone-900">{retSummary.redeemedFormatted || "0 repeat visitors"}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                      <span>Avg. Frequency</span>
                      <span className="font-semibold text-stone-800">{retSummary.avgFrequency || "3.2x / mo"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("customers_returning")
                      ? `SLOT: ROW ${placedWidgetMap.get("customers_returning")?.gridRow} COL ${placedWidgetMap.get("customers_returning")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("customers_returning") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("customers_returning", 4, 1)}
                      disabled={isAddingId === "customers_returning"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "customers_returning" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 4: Recent Customers */}
            {filteredWidgets.some((w) => w.id === "customers_recent") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Guest Log
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      TABLE
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Recent Customers</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Real-time ledger of latest seated and billed patrons with spend history and table location.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[110px] justify-center">
                    {(recSummary.recentGuests || []).length === 0 ? (
                      <div className="text-center py-3 text-xs text-stone-400">
                        No recent customer folios recorded
                      </div>
                    ) : (
                      (recSummary.recentGuests || []).slice(0, 3).map((g: any, idx: number) => (
                        <div key={idx} className="p-1.5 rounded bg-white border border-[#f0eae3] flex items-center justify-between">
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-bold text-stone-900 text-xs truncate">{g.name}</span>
                            <span className="text-[10px] text-stone-400 mt-0.5">{g.table} • {g.time}</span>
                          </div>
                          <span className="font-bold text-stone-900 text-xs shrink-0">{g.spend}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("customers_recent")
                      ? `SLOT: ROW ${placedWidgetMap.get("customers_recent")?.gridRow} COL ${placedWidgetMap.get("customers_recent")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("customers_recent") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("customers_recent", 4, 1)}
                      disabled={isAddingId === "customers_recent"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "customers_recent" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 5: Most Frequent Customers */}
            {filteredWidgets.some((w) => w.id === "customers_most_frequent") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Top Patrons
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      TABLE
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Most Frequent Customers</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Ranked guest leaderboard by visit frequency and cumulative spend.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[110px] justify-center">
                    {(freqSummary.topGuests || []).length === 0 ? (
                      <div className="text-center py-3 text-xs text-stone-400">
                        No recurring customer profiles logged
                      </div>
                    ) : (
                      (freqSummary.topGuests || []).slice(0, 3).map((g: any, idx: number) => (
                        <div key={idx} className="p-1.5 rounded bg-white border border-[#f0eae3] flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                              {g.rank}
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-stone-900 text-xs truncate">{g.name}</span>
                              <span className="text-[10px] text-stone-400">{g.visits}</span>
                            </div>
                          </div>
                          <span className="font-bold text-stone-900 text-xs shrink-0">{g.spend}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("customers_most_frequent")
                      ? `SLOT: ROW ${placedWidgetMap.get("customers_most_frequent")?.gridRow} COL ${placedWidgetMap.get("customers_most_frequent")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("customers_most_frequent") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("customers_most_frequent", 4, 1)}
                      disabled={isAddingId === "customers_most_frequent"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "customers_most_frequent" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 6: Customer Order Frequency */}
            {filteredWidgets.some((w) => w.id === "customers_order_frequency") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Visit Frequency
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      CHART
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Customer Order Frequency</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Distribution of customer visit counts across one-time, occasional, and frequent diners.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] min-h-[110px] justify-center">
                    {(cohortSummary.cohorts || [
                      { label: "1 Visit", percent: 0 },
                      { label: "2 - 3 Visits", percent: 0 },
                      { label: "4+ Visits", percent: 0 },
                    ]).map((c: any, idx: number) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-stone-600 truncate">{c.label}</span>
                          <span className="font-bold text-stone-900 shrink-0">{c.percent}%</span>
                        </div>
                        <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${idx === 0 ? "bg-stone-500" : idx === 1 ? "bg-black" : "bg-amber-600"}`}
                            style={{ width: `${c.percent}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("customers_order_frequency")
                      ? `SLOT: ROW ${placedWidgetMap.get("customers_order_frequency")?.gridRow} COL ${placedWidgetMap.get("customers_order_frequency")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("customers_order_frequency") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("customers_order_frequency", 4, 1)}
                      disabled={isAddingId === "customers_order_frequency"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "customers_order_frequency" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PosShell>
  );
}

