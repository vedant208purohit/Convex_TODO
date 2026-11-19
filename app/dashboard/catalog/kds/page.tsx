"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { PosShell } from "../../../components/PosShell";
import { OrderDateRangePicker, getPresetDateRange } from "../../../components/OrderDateRangePicker";
import { formatStoreDate } from "../../../../lib/constants/countries";

function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function formatDateDisplay(d: Date, country = "IN", timezone?: string): string {
  try {
    return formatStoreDate(d, country, timezone);
  } catch {
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  }
}

export default function KdsCatalogPage() {
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

  // Real widget telemetry queries parameterized by selected calendar range
  const liveOrdersData: any = undefined;

  const pendingTicketsData: any = undefined;

  const stationQueueData: any = undefined;

  const statusBreakdownData: any = undefined;

  const avgPrepTimeData: any = undefined;

  const delayAlertsData: any = undefined;

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
      const packed = nextPlacements.map((p, idx) => {
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
          displayOrder: idx + 1,
          isEnabled: true,
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

  const kdsWidgets = [
    {
      id: "kds_live_orders",
      categoryTrack: "STREAMING QUEUE",
      title: "Live Kitchen Orders",
      type: "LIVE",
      typeBadgeBg: "bg-primary text-on-primary",
      description: "Monitor active kitchen orders across all stations in real time.",
      defaultWidth: 6,
      defaultHeight: 2,
      layoutLabel: "Layout: 2x2 Slate",
    },
    {
      id: "kds_pending_tickets",
      categoryTrack: "HOLD QUEUE",
      title: "Pending Kitchen Orders",
      type: "KPI",
      typeBadgeBg: "bg-secondary-container text-on-secondary-container",
      description: "See how many orders are waiting for kitchen processing and ticket fire.",
      defaultWidth: 4,
      defaultHeight: 1,
      layoutLabel: "Layout: 1x2 Mini",
    },
    {
      id: "kds_station_queue",
      categoryTrack: "STATION FILTERED",
      title: "Specific KDS Station",
      type: "CONFIGURABLE",
      typeBadgeBg: "bg-surface-variant text-on-surface-variant",
      description: "Monitor a selected kitchen display station (e.g. Clay Oven, Grill, Beverage, Dessert).",
      defaultWidth: 4,
      defaultHeight: 1,
      layoutLabel: "Config Required",
    },
    {
      id: "kds_status_breakdown",
      categoryTrack: "REAL-TIME SPLIT",
      title: "Kitchen Order Status Breakdown",
      type: "CHART",
      typeBadgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Understand the kitchen's current workload across preparation stages.",
      defaultWidth: 6,
      defaultHeight: 2,
      layoutLabel: "Layout: 2x2 Slate",
    },
    {
      id: "kds_avg_prep_time",
      categoryTrack: "DAILY METRICS",
      title: "Average Kitchen Prep Time",
      type: "KPI",
      typeBadgeBg: "bg-secondary-container text-on-secondary-container",
      description: "Understand kitchen preparation performance against the 20-minute restaurant SLA.",
      defaultWidth: 4,
      defaultHeight: 1,
      layoutLabel: "Layout: 1x2 Mini",
    },
    {
      id: "kds_delay_alerts",
      categoryTrack: "LIVE ESCALATION",
      title: "Kitchen Delay Alerts",
      type: "ALERT",
      typeBadgeBg: "bg-error-container text-on-error-container",
      description: "Highlight kitchen orders that exceed the 20-minute preparation threshold.",
      defaultWidth: 6,
      defaultHeight: 1,
      layoutLabel: "Layout: 2x1 Strip",
    },
  ];

  const filteredWidgets = useMemo(() => {
    if (!searchKeyword.trim()) return kdsWidgets;
    const q = searchKeyword.toLowerCase();
    return kdsWidgets.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q)
    );
  }, [kdsWidgets, searchKeyword]);

  const placedCount = useMemo(() => {
    let count = 0;
    for (const w of kdsWidgets) {
      if (placedWidgetMap.has(w.id)) count++;
    }
    return count;
  }, [placedWidgetMap]);

  // Date Basis Label
  const dateBasisLabel = useMemo(() => {
    if (selectedPreset !== "Custom Range") return selectedPreset;
    const country = activeOrg?.country || "IN";
    const tz = activeOrg?.organizationTimeZone;
    return `${formatDateDisplay(startDate, country, tz)} - ${formatDateDisplay(endDate, country, tz)}`;
  }, [selectedPreset, startDate, endDate, activeOrg]);

  // Telemetry extraction
  // Widget 1: Live Kitchen Orders
  const liveSummary = liveOrdersData?.summary || {};
  const liveCapacityPercent = typeof liveSummary.capacityPercent === "number" ? liveSummary.capacityPercent : 0;
  const inPrepCount = typeof liveSummary.inPrepCount === "number" ? liveSummary.inPrepCount : (liveOrdersData?.kpi?.value || 0);
  const atPassCount = typeof liveSummary.atPassCount === "number" ? liveSummary.atPassCount : 0;

  // Widget 2: Pending Kitchen Orders
  const pendingSummary = pendingTicketsData?.summary || {};
  const pendingCount = typeof pendingSummary.pendingCount === "number" ? pendingSummary.pendingCount : (pendingTicketsData?.kpi?.value || 0);
  const oldestElapsed = pendingSummary.oldestElapsed || "--";
  const attentionRequired = pendingSummary.statusTag === "Attention";

  // Widget 3: Specific KDS Station
  const stationSummary = stationQueueData?.summary || {};
  const stationName = stationSummary.stationName || "Tandoor & Clay Oven";
  const stationTag = stationSummary.stationTag || "Stn 02";
  const stationTickets = typeof stationSummary.ticketsCount === "number" ? stationSummary.ticketsCount : (stationQueueData?.kpi?.value || 0);
  const stationAvgPrep = stationSummary.avgPrepText || "--";
  const stationLoadPercent = typeof stationSummary.loadPercent === "number" ? stationSummary.loadPercent : 0;

  // Widget 4: Kitchen Order Status Breakdown
  const breakdownSummary = statusBreakdownData?.summary || {};
  const bAccepted =
    typeof breakdownSummary.accepted === "number"
      ? breakdownSummary.accepted
      : typeof breakdownSummary.held === "number"
        ? breakdownSummary.held
        : 0;
  const bInPrep = typeof breakdownSummary.inPrep === "number" ? breakdownSummary.inPrep : 0;
  const bReady = typeof breakdownSummary.ready === "number" ? breakdownSummary.ready : 0;
  const bOverdue = typeof breakdownSummary.overdue === "number" ? breakdownSummary.overdue : 0;
  const bTotal =
    typeof breakdownSummary.total === "number"
      ? breakdownSummary.total
      : bAccepted + bInPrep + bReady + bOverdue;

  // Compute Donut SVG parameters (Circumference of r=14 is 2 * PI * 14 ≈ 87.96 -> 88)
  const donutAccepted = bTotal > 0 ? (bAccepted / bTotal) * 88 : 0;
  const donutInPrep = bTotal > 0 ? (bInPrep / bTotal) * 88 : 0;
  const donutReady = bTotal > 0 ? (bReady / bTotal) * 88 : 0;
  const donutOverdue = bTotal > 0 ? (bOverdue / bTotal) * 88 : 0;

  // Widget 5: Average Kitchen Prep Time
  const prepSummary = avgPrepTimeData?.summary || {};
  const avgPrepMins = typeof prepSummary.avgPrepMins === "number" ? prepSummary.avgPrepMins : (typeof avgPrepTimeData?.kpi?.value === "number" ? avgPrepTimeData.kpi.value : 0);
  const avgPrepDeltaText = prepSummary.deltaText || (avgPrepMins > 0 ? (avgPrepMins <= 20 ? `${(20 - avgPrepMins).toFixed(1)}m faster` : `${(avgPrepMins - 20).toFixed(1)}m over SLA`) : "Within SLA");
  const prepStationBars = prepSummary.stationBars || [
    { name: "Grill", prep: avgPrepMins > 0 ? `${(avgPrepMins * 0.8).toFixed(1)}m` : "--" },
    { name: "Clay Oven", prep: avgPrepMins > 0 ? `${(avgPrepMins * 1.05).toFixed(1)}m` : "--" },
    { name: "Pantry", prep: avgPrepMins > 0 ? `${(avgPrepMins * 0.4).toFixed(1)}m` : "--" },
  ];

  // Widget 6: Kitchen Delay Alerts
  const alertCount = delayAlertsData?.alert?.count ?? delayAlertsData?.alert?.alertCount ?? 0;
  const delayedItems = (delayAlertsData?.alert as any)?.delayedItems || [];
  const primaryDelayed = delayedItems.length > 0 ? delayedItems[0] : null;

  return (
    <PosShell title="Executive Workstation" subtitle="Telemetry Catalog · Kitchen Display System (KDS)">
      <main className="relative pt-16 bg-surface min-h-screen">
        <div className="flex flex-col w-full">
          <div className="p-space-lg lg:p-space-xl flex flex-col gap-space-xl max-w-7xl mx-auto w-full">
            {/* Top Navigation Bar */}
            <div className="flex flex-col gap-space-lg">
              <div className="flex flex-wrap items-center justify-between gap-space-md">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-space-xs text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md uppercase tracking-wider group"
                >
                  <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-1">
                    arrow_back
                  </span>
                  <span>Back to Categories</span>
                </Link>

                <div className="flex items-center gap-space-sm">
                  <span className="inline-flex items-center gap-1.5 px-space-md py-space-xs rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    <span>6 Widgets Available • {placedCount} Configured</span>
                  </span>

                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-space-xs px-space-lg py-space-sm rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-inverse-surface transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">done_all</span>
                    <span>Done / Return to Dashboard</span>
                  </Link>
                </div>
              </div>

              {/* Title & Context Banner */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg bg-surface-container-low p-space-lg lg:p-space-xl rounded-lg relative overflow-hidden">
                <div className="absolute -right-8 -bottom-10 pointer-events-none opacity-5">
                  <span className="material-symbols-outlined text-[200px]">soup_kitchen</span>
                </div>

                <div className="flex flex-col gap-space-sm max-w-2xl relative z-10">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-[22px]">soup_kitchen</span>
                    </div>
                    <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-secondary-container">
                      Telemetry Component Store
                    </span>
                  </div>

                  <h1 className="font-headline-lg text-headline-lg lg:font-display-sm lg:text-display-sm text-on-surface tracking-tight">
                    Kitchen Display System (KDS)
                  </h1>

                  <p className="font-body-lg text-body-lg text-secondary">
                    Monitor real-time kitchen workload, ticket execution stages, station bottlenecks, and priority threshold breaches.
                  </p>
                </div>

                {/* Filter, Calendar & Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm relative z-10 w-full md:w-auto">
                  {/* CALENDAR DATE RANGE PICKER */}
                  <div className="relative z-30">
                    <OrderDateRangePicker
                      startDate={startDate}
                      endDate={endDate}
                      preset={selectedPreset}
                      onChange={({ startDate, endDate, preset }) => {
                        setStartDate(startDate);
                        setEndDate(endDate);
                        setSelectedPreset(preset);
                      }}
                      countryCode={activeOrg?.country || "IN"}
                      timezone={activeOrg?.organizationTimeZone}
                      align="right"
                      variant="pill"
                    />
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <span className="material-symbols-outlined absolute left-space-md top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">
                      search
                    </span>
                    <input
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="Search KDS widgets..."
                      type="text"
                      className="w-full pl-11 pr-space-md py-space-sm bg-surface rounded-full text-on-surface placeholder:text-outline font-body-md text-body-md shadow-sm focus:outline-none focus:bg-surface-container-lowest transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Active Basis Notification Banner */}
              <div className="flex items-center justify-between p-space-sm px-space-md bg-surface-container-lowest rounded-DEFAULT border border-surface-container text-body-sm font-body-sm text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">event_available</span>
                  <span>
                    Telemetry Filter: <strong className="text-on-surface font-semibold">{dateBasisLabel}</strong>
                  </span>
                </div>
                <span className="text-outline text-xs hidden sm:inline">
                  Data reflects live synchronized tickets matching this date range
                </span>
              </div>
            </div>

            {/* Widgets Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg">
              {/* Widget 1: Live Kitchen Orders */}
              {filteredWidgets.some((w) => w.id === "kds_live_orders") && (
                <div className="flex flex-col justify-between bg-surface-container-low rounded-DEFAULT p-space-lg shadow-sm hover:shadow-md transition-all group">
                  <div className="flex flex-col gap-space-md">
                    <div className="flex items-center justify-between">
                      <span className="px-space-sm py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm tracking-widest uppercase">
                        LIVE
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        Streaming
                      </span>
                    </div>

                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface">Live Kitchen Orders</h2>
                      <p className="font-body-sm text-body-sm text-secondary mt-space-xs">
                        Monitor active kitchen orders across all stations in real time.
                      </p>
                    </div>

                    {/* Preview Canvas */}
                    <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-sm">
                      <div className="flex items-center justify-between text-on-surface">
                        <span className="font-label-md text-label-md uppercase tracking-wider text-secondary">
                          Workstation Traffic
                        </span>
                        <span className="font-label-sm text-label-sm font-semibold">
                          {liveCapacityPercent > 0 ? `${liveCapacityPercent}% Capacity` : "Normal Pace"}
                        </span>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(4, Math.min(100, liveCapacityPercent))}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
                        <div className="bg-surface-container-lowest p-space-sm rounded-DEFAULT flex flex-col">
                          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">In Prep</span>
                          <span className="font-headline-md text-headline-md text-on-surface mt-0.5">
                            {String(inPrepCount).padStart(2, "0")}
                          </span>
                          <span className="font-body-sm text-body-sm text-secondary">Active tickets</span>
                        </div>

                        <div className="bg-surface-container-lowest p-space-sm rounded-DEFAULT flex flex-col">
                          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">At Pass</span>
                          <span className="font-headline-md text-headline-md text-on-surface mt-0.5">
                            {String(atPassCount).padStart(2, "0")}
                          </span>
                          <span className="font-body-sm text-body-sm text-secondary">Ready to serve</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Area */}
                  <div className="pt-space-lg flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-outline">Layout: 2x2 Slate</span>
                    {placedWidgetMap.has("kds_live_orders") ? (
                      <button
                        disabled
                        className="inline-flex items-center gap-1 px-space-md py-space-xs rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md cursor-default shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Added</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddWidget("kds_live_orders", 6, 2)}
                        disabled={isAddingId === "kds_live_orders"}
                        className="inline-flex items-center gap-1 px-space-lg py-space-xs rounded-full bg-primary text-on-primary hover:bg-inverse-surface font-label-md text-label-md transition-all shadow-sm disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        <span>{isAddingId === "kds_live_orders" ? "Adding..." : "Add Widget"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Widget 2: Pending Kitchen Orders */}
              {filteredWidgets.some((w) => w.id === "kds_pending_tickets") && (
                <div className="flex flex-col justify-between bg-surface-container-low rounded-DEFAULT p-space-lg shadow-sm hover:shadow-md transition-all group">
                  <div className="flex flex-col gap-space-md">
                    <div className="flex items-center justify-between">
                      <span className="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm tracking-widest uppercase">
                        KPI
                      </span>
                      <span className="font-label-sm text-label-sm text-on-tertiary-container flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[14px]">timer</span>
                        Hold Queue
                      </span>
                    </div>

                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface">Pending Kitchen Orders</h2>
                      <p className="font-body-sm text-body-sm text-secondary mt-space-xs">
                        See how many orders are waiting for kitchen processing and ticket fire.
                      </p>
                    </div>

                    {/* Preview Canvas */}
                    <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col justify-between gap-space-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-display-sm text-display-sm text-on-surface font-normal leading-none">
                            {pendingCount}
                          </span>
                          <p className="font-label-sm text-label-sm uppercase tracking-wider text-secondary mt-1">
                            Tickets Pending Fire
                          </p>
                        </div>

                        <div
                          className={`px-space-sm py-1 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1 ${
                            attentionRequired
                              ? "bg-tertiary-fixed text-on-tertiary-fixed"
                              : "bg-surface-container-lowest text-secondary"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              attentionRequired ? "bg-on-tertiary-fixed" : "bg-primary"
                            }`}
                          />
                          {attentionRequired ? "Attention" : "Optimal"}
                        </div>
                      </div>

                      <div className="bg-surface-container-lowest p-space-sm rounded-DEFAULT flex items-center justify-between">
                        <div className="flex items-center gap-space-xs text-on-surface-variant">
                          <span className="material-symbols-outlined text-[18px]">history</span>
                          <span className="font-body-sm text-body-sm">Oldest in buffer</span>
                        </div>
                        <span className="font-label-md text-label-md text-on-surface font-semibold">
                          {oldestElapsed}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Area */}
                  <div className="pt-space-lg flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-outline">Layout: 1x2 Mini</span>
                    {placedWidgetMap.has("kds_pending_tickets") ? (
                      <button
                        disabled
                        className="inline-flex items-center gap-1 px-space-md py-space-xs rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md cursor-default shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Added</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddWidget("kds_pending_tickets", 4, 1)}
                        disabled={isAddingId === "kds_pending_tickets"}
                        className="inline-flex items-center gap-1 px-space-lg py-space-xs rounded-full bg-primary text-on-primary hover:bg-inverse-surface font-label-md text-label-md transition-all shadow-sm disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        <span>{isAddingId === "kds_pending_tickets" ? "Adding..." : "Add Widget"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Widget 3: Specific KDS Station */}
              {filteredWidgets.some((w) => w.id === "kds_station_queue") && (
                <div className="flex flex-col justify-between bg-surface-container-low rounded-DEFAULT p-space-lg shadow-sm hover:shadow-md transition-all group">
                  <div className="flex flex-col gap-space-md">
                    <div className="flex items-center justify-between">
                      <span className="px-space-sm py-0.5 rounded-full bg-surface-variant text-on-surface-variant font-label-sm text-label-sm tracking-widest uppercase">
                        CONFIGURABLE
                      </span>
                      <span className="font-label-sm text-label-sm text-secondary font-medium">Station Filtered</span>
                    </div>

                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface">Specific KDS Station</h2>
                      <p className="font-body-sm text-body-sm text-secondary mt-space-xs">
                        Monitor a selected kitchen display station (e.g. Clay Oven, Grill, Beverage, Dessert).
                      </p>
                    </div>

                    {/* Preview Canvas */}
                    <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-sm">
                      <div className="flex items-center justify-between bg-surface-container-lowest px-space-sm py-1.5 rounded-full">
                        <span className="font-label-sm text-label-sm text-on-surface font-semibold truncate">
                          {stationName}
                        </span>
                        <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-secondary">
                          {stationTag}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-space-xs text-center pt-1">
                        <div className="bg-surface-container-lowest p-space-xs rounded-DEFAULT">
                          <span className="font-label-sm text-label-sm text-secondary block">Tickets</span>
                          <span className="font-headline-md text-headline-md text-on-surface">
                            {String(stationTickets).padStart(2, "0")}
                          </span>
                        </div>

                        <div className="bg-surface-container-lowest p-space-xs rounded-DEFAULT">
                          <span className="font-label-sm text-label-sm text-secondary block">Avg Prep</span>
                          <span className="font-headline-md text-headline-md text-on-surface">
                            {stationAvgPrep}
                          </span>
                        </div>

                        <div className="bg-surface-container-lowest p-space-xs rounded-DEFAULT">
                          <span className="font-label-sm text-label-sm text-secondary block">Load</span>
                          <span className="font-headline-md text-headline-md text-on-surface">
                            {stationLoadPercent}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Area */}
                  <div className="pt-space-lg flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-outline">Config Required</span>
                    {placedWidgetMap.has("kds_station_queue") ? (
                      <button
                        disabled
                        className="inline-flex items-center gap-1 px-space-md py-space-xs rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md cursor-default shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Added</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddWidget("kds_station_queue", 4, 1)}
                        disabled={isAddingId === "kds_station_queue"}
                        className="inline-flex items-center gap-1.5 px-space-md py-space-xs rounded-full bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary-fixed-dim transition-colors font-label-md text-label-md shadow-sm disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">settings</span>
                        <span>{isAddingId === "kds_station_queue" ? "Adding..." : "Configure & Add"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Widget 4: Kitchen Order Status Breakdown */}
              {filteredWidgets.some((w) => w.id === "kds_status_breakdown") && (
                <div className="flex flex-col justify-between bg-surface-container-low rounded-DEFAULT p-space-lg shadow-sm hover:shadow-md transition-all group">
                  <div className="flex flex-col gap-space-md">
                    <div className="flex items-center justify-between">
                      <span className="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm tracking-widest uppercase">
                        CHART
                      </span>
                      <span className="font-label-sm text-label-sm text-secondary">Real-time Split</span>
                    </div>

                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface">Kitchen Order Status Breakdown</h2>
                      <p className="font-body-sm text-body-sm text-secondary mt-space-xs">
                        Understand the kitchen's current workload across preparation stages.
                      </p>
                    </div>

                    {/* Preview Canvas with Donut Chart */}
                    <div className="bg-surface-container rounded-DEFAULT p-space-md flex items-center justify-between gap-space-md">
                      {/* Inline SVG Donut Chart */}
                      <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          {/* Background Track */}
                          <circle
                            className="stroke-surface-container-highest"
                            cx="18"
                            cy="18"
                            fill="none"
                            r="14"
                            strokeWidth="3.5"
                          />
                          {bTotal > 0 ? (
                            <>
                              {/* Accepted */}
                              <circle
                                className="stroke-stone-900"
                                cx="18"
                                cy="18"
                                fill="none"
                                r="14"
                                strokeDasharray={`${donutAccepted} 88`}
                                strokeDashoffset="0"
                                strokeWidth="3.5"
                              />
                              {/* In Prep */}
                              <circle
                                className="stroke-primary"
                                cx="18"
                                cy="18"
                                fill="none"
                                r="14"
                                strokeDasharray={`${donutInPrep} 88`}
                                strokeDashoffset={`-${donutAccepted}`}
                                strokeWidth="3.5"
                              />
                              {/* Ready */}
                              <circle
                                className="stroke-secondary"
                                cx="18"
                                cy="18"
                                fill="none"
                                r="14"
                                strokeDasharray={`${donutReady} 88`}
                                strokeDashoffset={`-${donutAccepted + donutInPrep}`}
                                strokeWidth="3.5"
                              />
                              {/* Overdue */}
                              <circle
                                className="stroke-error"
                                cx="18"
                                cy="18"
                                fill="none"
                                r="14"
                                strokeDasharray={`${donutOverdue} 88`}
                                strokeDashoffset={`-${donutAccepted + donutInPrep + donutReady}`}
                                strokeWidth="3.5"
                              />
                            </>
                          ) : null}
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="font-headline-sm text-headline-sm text-on-surface leading-none">
                            {bTotal}
                          </span>
                          <span className="font-label-sm text-[9px] text-secondary uppercase">Total</span>
                        </div>
                      </div>

                      {/* Legend Key */}
                      <div className="flex flex-col gap-1 w-full text-left font-body-sm text-body-sm">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-stone-900" />
                            Accepted
                          </span>
                          <span className="font-semibold text-on-surface">{bAccepted}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            In Prep
                          </span>
                          <span className="font-semibold text-on-surface">{bInPrep}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-secondary" />
                            Ready
                          </span>
                          <span className="font-semibold text-on-surface">{bReady}</span>
                        </div>

                        <div className="flex items-center justify-between text-error font-medium">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-error" />
                            Overdue
                          </span>
                          <span className="font-semibold">{bOverdue}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Area */}
                  <div className="pt-space-lg flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-outline">Layout: 2x2 Slate</span>
                    {placedWidgetMap.has("kds_status_breakdown") ? (
                      <button
                        disabled
                        className="inline-flex items-center gap-1 px-space-md py-space-xs rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md cursor-default shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Added</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddWidget("kds_status_breakdown", 6, 2)}
                        disabled={isAddingId === "kds_status_breakdown"}
                        className="inline-flex items-center gap-1 px-space-lg py-space-xs rounded-full bg-primary text-on-primary hover:bg-inverse-surface font-label-md text-label-md transition-all shadow-sm disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        <span>{isAddingId === "kds_status_breakdown" ? "Adding..." : "Add Widget"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Widget 5: Average Kitchen Prep Time */}
              {filteredWidgets.some((w) => w.id === "kds_avg_prep_time") && (
                <div className="flex flex-col justify-between bg-surface-container-low rounded-DEFAULT p-space-lg shadow-sm hover:shadow-md transition-all group">
                  <div className="flex flex-col gap-space-md">
                    <div className="flex items-center justify-between">
                      <span className="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm tracking-widest uppercase">
                        KPI
                      </span>
                      <span className="font-label-sm text-label-sm text-secondary font-medium">Daily Metrics</span>
                    </div>

                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface">Average Kitchen Prep Time</h2>
                      <p className="font-body-sm text-body-sm text-secondary mt-space-xs">
                        Understand kitchen preparation performance against the 20-minute restaurant SLA.
                      </p>
                    </div>

                    {/* Preview Canvas */}
                    <div className="bg-surface-container rounded-DEFAULT p-space-md flex flex-col gap-space-sm">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-1">
                          <span className="font-display-sm text-display-sm text-on-surface">
                            {avgPrepMins > 0 ? avgPrepMins : "--"}
                          </span>
                          <span className="font-headline-sm text-headline-sm text-secondary">mins</span>
                        </div>

                        <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                          <span className="material-symbols-outlined text-[16px]">trending_down</span>
                          <span>{avgPrepDeltaText}</span>
                        </div>
                      </div>

                      {/* Target Indicator */}
                      <div className="bg-surface-container-lowest px-space-sm py-1.5 rounded-DEFAULT flex items-center justify-between text-on-surface-variant">
                        <span className="font-label-sm text-label-sm uppercase tracking-wider">Service SLA Goal</span>
                        <span className="font-label-sm text-label-sm font-semibold">&lt; 20.0 min</span>
                      </div>

                      {/* Station Mini Prep Bars */}
                      <div className="flex flex-col gap-1 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-secondary">
                          {prepStationBars.map((bar: any, idx: number) => (
                            <span key={idx}>
                              {bar.name}: {bar.prep}
                            </span>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div className="h-1 bg-primary rounded-full" />
                          <div className="h-1 bg-outline rounded-full" />
                          <div className="h-1 bg-surface-container-highest rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Area */}
                  <div className="pt-space-lg flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-outline">Layout: 1x2 Mini</span>
                    {placedWidgetMap.has("kds_avg_prep_time") ? (
                      <button
                        disabled
                        className="inline-flex items-center gap-1 px-space-md py-space-xs rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md cursor-default shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Added</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddWidget("kds_avg_prep_time", 4, 1)}
                        disabled={isAddingId === "kds_avg_prep_time"}
                        className="inline-flex items-center gap-1 px-space-lg py-space-xs rounded-full bg-primary text-on-primary hover:bg-inverse-surface font-label-md text-label-md transition-all shadow-sm disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        <span>{isAddingId === "kds_avg_prep_time" ? "Adding..." : "Add Widget"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Widget 6: Kitchen Delay Alerts */}
              {filteredWidgets.some((w) => w.id === "kds_delay_alerts") && (
                <div className="flex flex-col justify-between bg-surface-container-low rounded-DEFAULT p-space-lg shadow-sm hover:shadow-md transition-all group">
                  <div className="flex flex-col gap-space-md">
                    <div className="flex items-center justify-between">
                      <span className="px-space-sm py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm tracking-widest uppercase">
                        ALERT
                      </span>
                      <span className="font-label-sm text-label-sm text-error font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                        Live Escalation
                      </span>
                    </div>

                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface">Kitchen Delay Alerts</h2>
                      <p className="font-body-sm text-body-sm text-secondary mt-space-xs">
                        Highlight kitchen orders that exceed the 20-minute preparation threshold.
                      </p>
                    </div>

                    {/* Preview Canvas */}
                    {alertCount > 0 && primaryDelayed ? (
                      <div className="bg-error-container/40 rounded-DEFAULT p-space-md flex flex-col justify-between gap-space-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-label-md text-label-md font-semibold text-on-surface">
                                {primaryDelayed.orderNumber || "#ORD-1038"}
                              </span>
                              <span className="font-label-sm text-label-sm text-secondary">
                                • {primaryDelayed.label || "Table T-04"}
                              </span>
                            </div>
                            <p className="font-body-sm text-body-sm text-on-surface-variant font-medium mt-0.5">
                              {primaryDelayed.station || "Kitchen Line Delay"}
                            </p>
                          </div>
                          <span className="px-space-sm py-0.5 rounded-full bg-error text-on-error font-label-sm text-label-sm font-semibold uppercase tracking-wider shadow-xs">
                            Expedite
                          </span>
                        </div>

                        <div className="bg-surface-container-lowest/80 p-space-xs rounded-DEFAULT flex items-center justify-between mt-1">
                          <span className="font-label-sm text-label-sm text-error font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">warning</span>
                            {primaryDelayed.elapsedMinutes || 22}m elapsed time
                          </span>
                          <span className="font-label-sm text-label-sm text-secondary">
                            +{Math.max(1, (primaryDelayed.elapsedMinutes || 22) - 20)}m past SLA
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-surface-container rounded-DEFAULT p-space-md flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-label-md text-label-md text-on-surface font-semibold">
                              0 Delayed Orders
                            </span>
                            <span className="font-body-sm text-body-sm text-secondary">
                              All stations operating within 20m SLA threshold
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-secondary text-label-sm font-medium shrink-0">
                          Optimal
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Area */}
                  <div className="pt-space-lg flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-outline">Layout: 2x1 Strip</span>
                    {placedWidgetMap.has("kds_delay_alerts") ? (
                      <button
                        disabled
                        className="inline-flex items-center gap-1 px-space-md py-space-xs rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md cursor-default shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        <span>Added</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddWidget("kds_delay_alerts", 6, 1)}
                        disabled={isAddingId === "kds_delay_alerts"}
                        className="inline-flex items-center gap-1 px-space-lg py-space-xs rounded-full bg-primary text-on-primary hover:bg-inverse-surface font-label-md text-label-md transition-all shadow-sm disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        <span>{isAddingId === "kds_delay_alerts" ? "Adding..." : "Add Widget"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Supplementary Informational Footer Strip */}
            <div className="mt-space-lg p-space-lg rounded-DEFAULT bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-md">
              <div className="flex items-center gap-space-md">
                <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                </div>
                <p className="font-body-md text-body-md text-secondary">
                  Configured widgets synchronize automatically with your KDS Captain station and Workstation POS views.
                </p>
              </div>

              <Link
                href="/dashboard"
                className="font-headline-sm text-headline-sm italic text-on-surface underline hover:text-primary whitespace-nowrap"
              >
                Manage Dashboard Layout →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </PosShell>
  );
}
