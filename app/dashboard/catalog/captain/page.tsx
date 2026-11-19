"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PosShell } from "../../../components/PosShell";
import { OrderDateRangePicker } from "../../../components/OrderDateRangePicker";
import { formatPriceWithSymbol } from "@/lib/constants/countries";

function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export default function CaptainCatalogPage() {
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

  // Scoped on-demand telemetry queries for Captain
  const activeOrdersData: any = undefined;

  const tableServiceStatusData: any = undefined;

  const assignedTablesData: any = undefined;

  const serviceTimeData: any = undefined;

  const ordersAwaitingServiceData: any = undefined;

  const performanceSummaryData: any = undefined;

  const orderActivityData: any = undefined;

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

  // 7 Curated Captain Widgets list
  const captainWidgets = [
    {
      id: "captain_active_orders",
      title: "Active Orders by Captain",
      track: "FLOOR ASSIGNMENT",
      badge: "TABLE",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Real-time ticket count and active covers assigned to each floor captain.",
      layout: "1X1 SQUARE",
      width: 4,
      isWide: false,
      data: activeOrdersData,
    },
    {
      id: "captain_table_service_status",
      title: "Table Service Status",
      track: "SERVICE PACING",
      badge: "LIVE",
      badgeBg: "bg-error-container text-on-error-container",
      description: "Real-time course stages across active tables under captain supervision.",
      layout: "1X1 SQUARE",
      width: 4,
      isWide: false,
      data: tableServiceStatusData,
    },
    {
      id: "captain_assigned_tables",
      title: "Assigned Tables",
      track: "ROSTER ALLOCATION",
      badge: "TABLE",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Section assignments and active table distribution per captain shift.",
      layout: "1X1 SQUARE",
      width: 4,
      isWide: false,
      data: assignedTablesData,
    },
    {
      id: "captain_service_time",
      title: "Service Time",
      track: "ATTENDANT TEMPO",
      badge: "KPI",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Average duration elapsed between guest seating, order taking, and bill presentation.",
      layout: "1X1 SQUARE",
      width: 4,
      isWide: false,
      data: serviceTimeData,
    },
    {
      id: "captain_orders_awaiting_service",
      title: "Orders Awaiting Service",
      track: "CALL BELL QUEUE",
      badge: "ALERT",
      badgeBg: "bg-error-container text-on-error-container",
      description: "Food ready at kitchen pass waiting for server pickup and table delivery.",
      layout: "1X1 SQUARE",
      width: 4,
      isWide: false,
      data: ordersAwaitingServiceData,
    },
    {
      id: "captain_performance_summary",
      title: "Captain Performance Summary",
      track: "CAPTAIN METRICS",
      badge: "CHART",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Comparative sales volume, tip pool allocation, and cover turn efficiency across servers.",
      layout: "1X1 SQUARE",
      width: 4,
      isWide: false,
      data: performanceSummaryData,
    },
    {
      id: "captain_order_activity",
      title: "Captain Order Activity",
      track: "AUDIT TRAIL",
      badge: "TABLE",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Chronological audit trail of line items added, course fires, and discount requests by captains.",
      layout: "2X1 STRIP",
      width: 12,
      isWide: true,
      data: orderActivityData,
    },
  ];

  const filteredWidgets = useMemo(() => {
    if (!searchKeyword.trim()) return captainWidgets;
    const kw = searchKeyword.toLowerCase();
    return captainWidgets.filter(
      (w) =>
        w.title.toLowerCase().includes(kw) ||
        w.description.toLowerCase().includes(kw) ||
        w.track.toLowerCase().includes(kw)
    );
  }, [searchKeyword, captainWidgets]);

  const placedCount = captainWidgets.filter((w) => placedWidgetMap.has(w.id)).length;

  return (
    <PosShell title="Floor Captain Station" subtitle="Telemetry Catalog · Captain & Service Pacing">
      <main className="relative bg-surface min-h-screen pb-16">
        <div className="flex flex-col w-full">
          <div className="max-w-[1440px] w-full mx-auto px-margin py-space-lg flex flex-col gap-space-lg">
            {/* Top Sub-Navigation & Quick Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-space-md">
              <div className="flex items-center gap-space-md">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-space-xs font-label-md text-label-md text-on-surface hover:text-outline transition-colors uppercase tracking-wider"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>Back to Categories</span>
                </Link>
              </div>
              <div className="flex items-center gap-space-md">
                <div className="flex items-center gap-space-xs bg-surface-container px-space-md py-space-xs rounded-full shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span className="font-label-sm text-label-sm text-on-surface tracking-wide">
                    7 Widgets Available • {placedCount} on Dashboard
                  </span>
                </div>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-space-xs bg-primary text-on-primary font-label-md text-label-md px-space-lg py-space-xs rounded-full shadow-xs hover:opacity-90 transition-opacity"
                >
                  <span>Done / Return to Dashboard</span>
                  <span className="material-symbols-outlined text-[16px]">check</span>
                </Link>
              </div>
            </div>

            {/* Category Banner Header */}
            <div className="bg-surface-container-low rounded-lg p-space-xl flex flex-col md:flex-row md:items-center justify-between gap-space-lg shadow-xs">
              <div className="flex items-start gap-space-lg max-w-2xl">
                <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[32px] text-primary">table_restaurant</span>
                </div>
                <div className="flex flex-col gap-space-xs">
                  <div className="flex items-center gap-space-sm">
                    <span className="bg-surface-container-highest text-on-surface font-label-sm text-label-sm px-space-sm py-0.5 rounded-full font-semibold uppercase tracking-wider">
                      FLOOR OPERATIONS
                    </span>
                    <span className="text-outline text-label-sm">•</span>
                    <span className="text-secondary text-label-sm font-label-sm">Dining Floor & Table Service</span>
                  </div>
                  <h1 className="font-display-lg text-display-lg text-on-surface leading-tight font-normal">
                    Captain
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Monitor tableside attendant metrics, guest wait intervals, and service floor allocations.
                  </p>
                </div>
              </div>

              {/* Controls: Search & Date Range Picker */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative min-w-[240px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Filter Captain widgets..."
                    className="w-full pl-9 pr-4 py-2 bg-surface rounded-full text-xs border border-outline-variant text-on-surface placeholder:text-outline focus:outline-hidden focus:border-primary transition-colors"
                  />
                  {searchKeyword && (
                    <button
                      onClick={() => setSearchKeyword("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="shrink-0">
                  <OrderDateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    preset={selectedPreset}
                    onChange={(range) => {
                      setStartDate(range.startDate);
                      setEndDate(range.endDate);
                      setSelectedPreset(range.preset);
                    }}
                    variant="pill"
                    align="right"
                  />
                </div>
              </div>
            </div>

            {/* Widgets Grid: 3-cols for standard widgets, full span for wide strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
              {filteredWidgets.map((widget) => {
                const isPlaced = placedWidgetMap.has(widget.id);
                const slot = placedWidgetMap.get(widget.id);

                return (
                  <div
                    key={widget.id}
                    className={`bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col justify-between gap-space-md shadow-xs hover:shadow-md transition-all ${
                      widget.isWide ? "md:col-span-2 lg:col-span-3" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-space-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
                          {widget.track}
                        </span>
                        <span className={`${widget.badgeBg} font-label-sm text-label-sm px-space-sm py-0.5 rounded-full font-semibold`}>
                          {widget.badge}
                        </span>
                      </div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-normal">
                        {widget.title}
                      </h2>
                      <p className="font-body-sm text-body-sm text-on-surface-variant min-h-[36px]">
                        {widget.description}
                      </p>

                      {/* Live Telemetry Preview Box matching mockup */}
                      {widget.id === "captain_active_orders" && (
                        <div className="mt-space-md p-space-sm bg-surface-container rounded-DEFAULT flex flex-col gap-space-xs">
                          {widget.data?.summary?.captains && widget.data.summary.captains.length > 0 ? (
                            widget.data.summary.captains.map((c: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded-DEFAULT bg-surface-container-lowest shadow-2xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-label-md text-label-md w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface">
                                    {c.rank}
                                  </span>
                                  <div>
                                    <div className="font-label-md text-label-md text-on-surface font-semibold">
                                      {c.name} <span className="text-outline font-normal">({c.zone})</span>
                                    </div>
                                    <div className="font-body-sm text-body-sm text-secondary">
                                      {c.tablesCount} Tables • {c.covers} Covers
                                    </div>
                                  </div>
                                </div>
                                <span className="font-label-md text-label-md text-on-surface font-semibold">
                                  {c.amountFormatted ||
                                    formatPriceWithSymbol(
                                      c.amount,
                                      activeOrdersData?.currencySymbol || activeOrg?.defaultCurrencySymbol || "₹",
                                      activeOrdersData?.country || activeOrg?.country,
                                      true,
                                    )}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="py-4 text-center text-secondary text-xs font-label-sm">
                              0 active seated tables assigned to captains
                            </div>
                          )}
                        </div>
                      )}

                      {widget.id === "captain_table_service_status" && (
                        <div className="mt-space-md p-space-sm bg-surface-container rounded-DEFAULT flex flex-wrap gap-space-xs">
                          {widget.data?.summary?.tableCards && widget.data.summary.tableCards.length > 0 ? (
                            widget.data.summary.tableCards.slice(0, 4).map((tc: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex-1 min-w-[110px] p-2 bg-surface-container-lowest rounded-DEFAULT shadow-2xs flex flex-col gap-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-label-md text-label-md font-semibold text-on-surface">
                                    {tc.tableNumber}
                                  </span>
                                  <span className="font-label-sm text-label-sm text-outline">{tc.seating}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="font-body-sm text-body-sm text-secondary">{tc.stage}</span>
                                  {tc.elapsed && (
                                    <span className="font-label-sm text-label-sm text-primary font-medium">
                                      {tc.elapsed}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="w-full py-4 text-center text-secondary text-xs font-label-sm">
                              No active table service sessions
                            </div>
                          )}
                        </div>
                      )}

                      {widget.id === "captain_assigned_tables" && (
                        <div className="mt-space-md p-space-sm bg-surface-container rounded-DEFAULT flex flex-col gap-space-xs">
                          {widget.data?.summary?.rosters && widget.data.summary.rosters.length > 0 ? (
                            widget.data.summary.rosters.map((r: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-2 rounded-DEFAULT bg-surface-container-lowest shadow-2xs flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-label-md text-label-md font-semibold text-on-surface">
                                    {r.name}
                                  </span>
                                  <div className="font-body-sm text-body-sm text-secondary">{r.section}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-label-md text-label-md font-semibold text-primary">
                                    {r.activeCount} Active
                                  </div>
                                  <div className="font-label-sm text-label-sm text-outline">{r.activePct} load</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-4 text-center text-secondary text-xs font-label-sm">
                              0 tables allocated to active shift
                            </div>
                          )}
                        </div>
                      )}

                      {widget.id === "captain_service_time" && (
                        <div className="mt-space-md p-space-sm bg-surface-container rounded-DEFAULT flex flex-col gap-space-xs">
                          <div className="flex items-baseline justify-between">
                            <span className="font-display-sm text-display-sm text-on-surface font-normal">
                              {widget.data?.summary?.avgTurnMins ?? "--"}
                            </span>
                            <span className="font-label-sm text-label-sm text-secondary">
                              Benchmark: 42.0m
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-outline font-label-sm pt-2 border-t border-surface-container-high">
                            <span>Turn Variance:</span>
                            <span className="font-semibold text-on-surface">
                              {widget.data?.summary?.deltaBenchmark ?? "--"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-outline font-label-sm">
                            <span>Fastest Floor:</span>
                            <span className="font-semibold text-on-surface">
                              {widget.data?.summary?.fastestSection ?? "--"}
                            </span>
                          </div>
                        </div>
                      )}

                      {widget.id === "captain_orders_awaiting_service" && (
                        <div className="mt-space-md p-space-sm bg-surface-container rounded-DEFAULT flex flex-col gap-space-xs">
                          <div className="bg-error-container/40 border border-error-container p-space-xs px-space-sm rounded-DEFAULT flex items-center gap-2">
                            <span className="material-symbols-outlined text-error text-[18px]">notifications_active</span>
                            <span className="font-label-md text-label-md text-on-error-container font-semibold">
                              {widget.data?.summary?.countAtPass ?? 0} Orders Awaiting Runner Pickup
                            </span>
                          </div>
                          <div className="text-body-sm text-secondary pt-1">
                            {widget.data?.summary?.ordersAtPass && widget.data.summary.ordersAtPass.length > 0
                              ? widget.data.summary.ordersAtPass.map((it: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-xs py-0.5">
                                    <span className="font-medium text-on-surface">{it.table} ({it.item})</span>
                                    <span className="text-error font-medium">{it.readyAgo}</span>
                                  </div>
                                ))
                              : "No food waiting at kitchen pass."}
                          </div>
                        </div>
                      )}

                      {widget.id === "captain_performance_summary" && (
                        <div className="mt-space-md p-space-sm bg-surface-container rounded-DEFAULT flex flex-col gap-space-xs">
                          {widget.data?.summary?.captains && widget.data.summary.captains.length > 0 ? (
                            widget.data.summary.captains.map((c: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-2 rounded-DEFAULT bg-surface-container-lowest shadow-2xs flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-label-md text-label-md font-semibold text-on-surface">
                                    {c.name}
                                  </span>
                                  <div className="font-body-sm text-body-sm text-secondary">{c.rank}</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-label-md text-label-md font-semibold text-on-surface">
                                    {c.sales}
                                  </div>
                                  <div className="font-label-sm text-label-sm text-primary">{c.turnRate}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-4 text-center text-secondary text-xs font-label-sm">
                              0 covers served in this period
                            </div>
                          )}
                        </div>
                      )}

                      {widget.id === "captain_order_activity" && (
                        <div className="mt-space-md bg-surface-container rounded-DEFAULT overflow-hidden">
                          <div className="grid grid-cols-12 px-space-md py-2 bg-surface-container-high font-label-sm text-label-sm text-secondary font-semibold uppercase">
                            <span className="col-span-2">Time</span>
                            <span className="col-span-3">Captain</span>
                            <span className="col-span-5">Action Event</span>
                            <span className="col-span-2 text-right">Table</span>
                          </div>
                          <div className="divide-y divide-surface-container/50">
                            {widget.data?.summary?.auditEvents && widget.data.summary.auditEvents.length > 0 ? (
                              widget.data.summary.auditEvents.slice(0, 3).map((ev: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="grid grid-cols-12 px-space-md py-2.5 items-center font-body-sm text-body-sm bg-surface-container-lowest"
                                >
                                  <span className="col-span-2 text-outline font-label-md text-label-md">
                                    {ev.time}
                                  </span>
                                  <span className="col-span-3 font-semibold text-on-surface">{ev.captain}</span>
                                  <span className="col-span-5 text-on-surface flex items-center gap-1.5 truncate">
                                    <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                                    <span className="truncate">{ev.action}</span>
                                  </span>
                                  <span className="col-span-2 text-right font-semibold text-on-surface">
                                    {ev.table}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="py-4 text-center text-secondary text-xs font-label-sm bg-surface-container-lowest">
                                No tableside activity recorded in this timeframe
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Layout & Add/Added button */}
                    <div className="flex items-center justify-between pt-space-xs border-t border-surface-container-high/40">
                      <span className="font-label-sm text-label-sm text-outline uppercase">
                        Layout: {widget.layout}
                      </span>
                      {isPlaced ? (
                        <div className="bg-surface-container-high text-on-surface font-label-md text-label-md px-space-md py-space-xs rounded-full flex items-center gap-space-xs cursor-default">
                          <span>Added</span>
                          <span className="material-symbols-outlined text-[14px]">check</span>
                          {slot && (
                            <span className="text-[10px] text-outline ml-1">
                              (R{slot.gridRow + 1}:C{slot.gridCol + 1})
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddWidget(widget.id, widget.width, 1)}
                          disabled={isAddingId === widget.id}
                          className="bg-primary text-on-primary hover:opacity-90 transition-opacity font-label-md text-label-md px-space-md py-space-xs rounded-full flex items-center gap-space-xs cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {isAddingId === widget.id ? (
                            <>
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              <span>Adding...</span>
                            </>
                          ) : (
                            <>
                              <span>+ Add Widget</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Contextual Status / Info Bar */}
            <div className="mt-space-md p-space-md bg-surface-container-lowest rounded-DEFAULT flex flex-col sm:flex-row items-center justify-between gap-space-md shadow-xs">
              <div className="flex items-center gap-space-sm text-secondary font-body-sm text-body-sm">
                <span className="material-symbols-outlined text-outline text-[20px]">info</span>
                <span>
                  Captain telemetry synchronizes in real time with handheld tableside ordering tablets and the kitchen display system (KDS).
                </span>
              </div>
              <Link
                href="/dashboard"
                className="font-label-md text-label-md text-on-surface hover:text-primary flex items-center gap-1 uppercase tracking-wider font-semibold whitespace-nowrap"
              >
                <span>Manage Dashboard Layout</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </PosShell>
  );
}
