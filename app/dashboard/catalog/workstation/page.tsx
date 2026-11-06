"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PosShell } from "../../../components/PosShell";
import { OrderDateRangePicker, getPresetDateRange } from "../../../components/OrderDateRangePicker";
import { formatStoreDate } from "../../../../lib/constants/countries";

function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export default function WorkstationCatalogPage() {
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

  // Scoped on-demand telemetry queries for Workstation
  const orderSummaryData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "workstation_order_summary" } : "skip"
  );

  const ordersByWorkstationData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "workstation_orders_by_workstation" } : "skip"
  );

  const activeTasksData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "workstation_active_tasks" } : "skip"
  );

  const queueData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "workstation_queue" } : "skip"
  );

  const prepTimeData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "workstation_prep_time" } : "skip"
  );

  const delayedOrdersData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "workstation_delayed_orders" } : "skip"
  );

  const performanceData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "workstation_performance" } : "skip"
  );

  const availabilityData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "workstation_availability" } : "skip"
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

  // 8 Curated Workstation Widgets list
  const workstationWidgets = [
    {
      id: "workstation_order_summary",
      title: "Workstation Order Summary",
      track: "LANE SUMMARY",
      badge: "KPI",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Aggregated order totals and volume currently distributed across all station registers.",
      layout: "1X1 SQUARE",
      width: 4,
      data: orderSummaryData,
    },
    {
      id: "workstation_orders_by_workstation",
      title: "Orders by Workstation",
      track: "DISTRIBUTION",
      badge: "CHART",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Comparative order volume processed across individual physical counter terminals.",
      layout: "1X1 SQUARE",
      width: 4,
      data: ordersByWorkstationData,
    },
    {
      id: "workstation_active_tasks",
      title: "Active Workstation Tasks",
      track: "DISPATCH QUEUE",
      badge: "LIVE",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Real-time queue of print jobs, kitchen slips, and dispatch triggers assigned to this station.",
      layout: "1X1 SQUARE",
      width: 4,
      data: activeTasksData,
    },
    {
      id: "workstation_queue",
      title: "Workstation Queue",
      track: "BUFFER DEPTH",
      badge: "KPI",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Current volume of orders in buffer awaiting workstation processing.",
      layout: "1X1 SQUARE",
      width: 4,
      data: queueData,
    },
    {
      id: "workstation_prep_time",
      title: "Preparation Time by Workstation",
      track: "EFFICIENCY AUDIT",
      badge: "CHART",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Average ticket turnaround times by station against defined service target SLA.",
      layout: "1X1 SQUARE",
      width: 4,
      data: prepTimeData,
    },
    {
      id: "workstation_delayed_orders",
      title: "Delayed Workstation Orders",
      track: "BOTTLENECK DETECTION",
      badge: "ALERT",
      badgeBg: "bg-error-container text-on-error-container",
      description: "Live alerts for orders exceeding maximum buffer thresholds at any active workstation.",
      layout: "1X1 SQUARE",
      width: 4,
      data: delayedOrdersData,
    },
    {
      id: "workstation_performance",
      title: "Workstation Performance",
      track: "THROUGHPUT RATIO",
      badge: "CHART",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Comparative processing throughput and load balance across all operational registers.",
      layout: "1X1 SQUARE",
      width: 4,
      data: performanceData,
    },
    {
      id: "workstation_availability",
      title: "Workstation Availability",
      track: "SYSTEM HEALTH",
      badge: "LIVE",
      badgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Real-time online status, LAN ping latency, and paper roll sensors for all terminals.",
      layout: "1X1 SQUARE",
      width: 4,
      data: availabilityData,
    },
  ];

  const filteredWidgets = useMemo(() => {
    if (!searchKeyword.trim()) return workstationWidgets;
    const kw = searchKeyword.toLowerCase();
    return workstationWidgets.filter(
      (w) =>
        w.title.toLowerCase().includes(kw) ||
        w.description.toLowerCase().includes(kw) ||
        w.track.toLowerCase().includes(kw)
    );
  }, [searchKeyword, workstationWidgets]);

  const placedCount = workstationWidgets.filter((w) => placedWidgetMap.has(w.id)).length;

  return (
    <PosShell title="Executive Workstation" subtitle="Telemetry Catalog · Workstation Terminal Ledger">
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
                    8 Widgets Available • {placedCount} on Dashboard
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
                  <span className="material-symbols-outlined text-[32px] text-primary">desktop_windows</span>
                </div>
                <div className="flex flex-col gap-space-xs">
                  <div className="flex items-center gap-space-sm">
                    <span className="bg-surface-container-highest text-on-surface font-label-sm text-label-sm px-space-sm py-0.5 rounded-full font-semibold uppercase tracking-wider">
                      STATION CONFIG
                    </span>
                    <span className="text-outline text-label-sm">•</span>
                    <span className="text-secondary text-label-sm font-label-sm">Hardware & Terminal Hub</span>
                  </div>
                  <h1 className="font-display-lg text-display-lg text-on-surface leading-tight font-normal">
                    Workstation
                  </h1>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Configure physical terminal ledgers, printer spool status, and operational peripheral hardware.
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
                    placeholder="Filter Workstation widgets..."
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

            {/* 8 Widgets Grid (3-columns on desktop) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
              {filteredWidgets.map((widget) => {
                const isPlaced = placedWidgetMap.has(widget.id);
                const slot = placedWidgetMap.get(widget.id);

                return (
                  <div
                    key={widget.id}
                    className="bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col justify-between gap-space-md shadow-xs hover:shadow-md transition-all"
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
                      {widget.id === "workstation_order_summary" && (() => {
                        const lanes = widget.data?.summary?.lanes && widget.data.summary.lanes.length > 0
                          ? widget.data.summary.lanes
                          : [{ name: "Main", count: Number(widget.data?.kpi?.value ?? 0) }];
                        return (
                          <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-sm my-space-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-label-sm text-label-sm text-outline uppercase font-semibold">
                                Active Lane Volume
                              </span>
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                            </div>
                            <div
                              className={`grid gap-space-xs text-center py-space-xs ${
                                lanes.length === 1
                                  ? "grid-cols-1"
                                  : lanes.length === 2
                                  ? "grid-cols-2"
                                  : "grid-cols-3"
                              }`}
                            >
                              {lanes.map((lane: any, idx: number) => (
                                <div key={idx} className="bg-surface-container-lowest p-space-xs rounded-DEFAULT flex flex-col">
                                  <span className="font-label-sm text-label-sm text-outline truncate">{lane.name}</span>
                                  <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                                    {lane.count}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between bg-surface-container-high px-space-sm py-space-xs rounded-full">
                              <span className="font-body-sm text-body-sm text-on-surface">Total Spool Pool</span>
                              <span className="font-label-md text-label-md text-on-surface font-semibold">
                                {widget.data?.kpi?.value ?? 0} Active Tasks
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {widget.id === "workstation_orders_by_workstation" && (
                        <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-sm my-space-xs">
                          <div className="flex justify-between items-center text-outline font-label-sm text-label-sm uppercase">
                            <span>Workstation</span>
                            <span>Tkts</span>
                          </div>
                          <div className="flex flex-col gap-space-xs">
                            {widget.data?.summary?.stationBreakdown && widget.data.summary.stationBreakdown.length > 0 ? (
                              widget.data.summary.stationBreakdown.slice(0, 3).map((st: any, idx: number) => (
                                <div key={idx} className="flex flex-col gap-0.5">
                                  <div className="flex justify-between text-on-surface font-body-sm text-body-sm">
                                    <span>{st.name}</span>
                                    <span className="font-medium">{st.count}</span>
                                  </div>
                                  <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${idx === 0 ? "bg-primary" : "bg-secondary"}`}
                                      style={{ width: `${Math.max(4, st.pct)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-4 text-center text-secondary text-xs font-label-sm">
                                0 Orders processed across workstations
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {widget.id === "workstation_active_tasks" && (
                        <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-xs my-space-xs">
                          {widget.data?.summary?.activeTasksList && widget.data.summary.activeTasksList.length > 0 ? (
                            widget.data.summary.activeTasksList.slice(0, 2).map((t: any, idx: number) => (
                              <div
                                key={idx}
                                className="bg-surface-container-lowest p-space-xs px-space-sm rounded-DEFAULT flex items-center justify-between"
                              >
                                <div className="flex items-center gap-space-xs">
                                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                                  <div className="flex flex-col">
                                    <span className="font-label-md text-label-md text-on-surface font-medium">
                                      {t.taskNo} {t.title}
                                    </span>
                                    <span className="font-label-sm text-label-sm text-outline">
                                      {t.station} • {t.elapsed}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-label-sm text-label-sm bg-surface-container px-space-xs py-0.5 rounded text-on-surface">
                                  {t.status}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="py-4 text-center text-secondary text-xs font-label-sm">
                              0 active tasks in dispatch queue
                            </div>
                          )}
                        </div>
                      )}

                      {widget.id === "workstation_queue" && (() => {
                        const depth = widget.data?.kpi?.value ?? (widget.data?.summary?.bufferDepth ?? 0);
                        return (
                          <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-sm my-space-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-display-sm text-display-sm text-on-surface font-normal">
                                {depth}
                              </span>
                              <span className="bg-surface-container-highest font-label-sm text-label-sm px-space-sm py-0.5 rounded-full text-secondary font-semibold">
                                {widget.data?.summary?.spoolStatus ?? (depth > 0 ? "Nominal Spool" : "Queue Idle")}
                              </span>
                            </div>
                            <div className="space-y-space-xs text-body-sm pt-space-xs border-t border-surface-container-high/60">
                              <div className="flex justify-between">
                                <span className="text-secondary">Buffer Depth</span>
                                <span className="font-semibold text-on-surface">
                                  {depth} Orders
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-secondary">Oldest Waiting Task</span>
                                <span className="font-semibold text-on-surface">
                                  {widget.data?.summary?.oldestWaiting ?? "--"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {widget.id === "workstation_prep_time" && (() => {
                        const prepBars = widget.data?.summary?.stationBars && widget.data.summary.stationBars.length > 0
                          ? widget.data.summary.stationBars
                          : [{ name: "Main", prep: widget.data?.summary?.displayValue ? `${widget.data.summary.displayValue}m` : "--" }];
                        return (
                          <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-sm my-space-xs">
                            <div className="flex items-baseline justify-between">
                              <span className="font-display-sm text-display-sm text-on-surface font-normal">
                                {widget.data?.summary?.displayValue ?? "--"}
                              </span>
                              <span className="font-label-sm text-label-sm text-secondary">
                                Target: {widget.data?.summary?.slaGoal ?? "< 20.0m"}
                              </span>
                            </div>
                            <div className="flex items-end justify-around h-12 pt-2 px-4 border-b border-surface-container-high">
                              {prepBars.map((sb: any, idx: number) => (
                                <div key={idx} className="flex flex-col items-center gap-1">
                                  <div className={`w-5 rounded-t-sm h-8 ${idx === 0 ? "bg-primary" : idx === 1 ? "bg-secondary" : "bg-surface-container-highest"}`}></div>
                                  <span className="text-[10px] text-outline truncate max-w-[70px]">{sb.name}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between items-center text-xs text-outline font-label-sm">
                              <span>Efficiency Delta:</span>
                              <span className="font-semibold text-on-surface">{widget.data?.summary?.deltaText ?? "Within SLA"}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {widget.id === "workstation_delayed_orders" && (
                        <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-xs my-space-xs">
                          <div className="bg-error-container/40 border border-error-container p-space-xs px-space-sm rounded-DEFAULT flex items-center gap-2">
                            <span className="material-symbols-outlined text-error text-[18px]">warning</span>
                            <span className="font-label-md text-label-md text-on-error-container font-semibold">
                              {widget.data?.alert?.count ?? 0} Tickets Exceeding Target SLA
                            </span>
                          </div>
                          <div className="text-body-sm text-secondary pt-1">
                            {widget.data?.alert?.message ?? "All stations running within standard 15-minute SLA."}
                          </div>
                        </div>
                      )}

                      {widget.id === "workstation_performance" && (
                        <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-xs my-space-xs">
                          <div className="flex flex-col gap-1.5">
                            {widget.data?.summary?.performances && widget.data.summary.performances.length > 0 ? (
                              widget.data.summary.performances.slice(0, 3).map((p: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-body-sm text-on-surface">
                                  <span className="truncate max-w-[120px]">{p.name}</span>
                                  <div className="flex items-center gap-space-sm w-36 justify-end">
                                    <div className="w-20 bg-surface-container-highest rounded-full h-1.5">
                                      <div
                                        className={`h-full rounded-full ${idx === 0 ? "bg-primary" : "bg-secondary"}`}
                                        style={{ width: `${Math.max(5, p.pct)}%` }}
                                      ></div>
                                    </div>
                                    <span className="font-medium text-right text-label-sm w-7">{p.pct}%</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-4 text-center text-secondary text-xs font-label-sm">
                                0 Dishes completed across stations
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {widget.id === "workstation_availability" && (
                        <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-xs my-space-xs">
                          {widget.data?.summary?.terminalsList && widget.data.summary.terminalsList.length > 0 ? (
                            widget.data.summary.terminalsList.slice(0, 3).map((term: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between bg-surface-container-lowest p-space-xs px-space-sm rounded-DEFAULT"
                              >
                                <div className="flex items-center gap-space-xs">
                                  <span className={`w-2 h-2 rounded-full ${term.status === "Online" ? "bg-primary" : "bg-error"}`}></span>
                                  <span className="font-label-sm text-label-sm text-on-surface font-medium">{term.name}</span>
                                </div>
                                <span className="font-label-sm text-label-sm text-outline">
                                  {term.status} • {term.latency}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="py-4 text-center text-secondary text-xs font-label-sm">
                              No configured physical terminals found
                            </div>
                          )}
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

            {/* Bottom Contextual Banner */}
            <div className="bg-surface-container rounded-DEFAULT p-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-md shadow-xs mt-space-md">
              <div className="flex items-center gap-space-md">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px] text-on-surface">info</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Configured workstation telemetry syncs directly with terminal local cache and receipt printers.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-space-xs font-label-md text-label-md text-on-surface hover:text-outline transition-colors underline whitespace-nowrap"
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
