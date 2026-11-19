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

export default function OrdersCatalogPage() {
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
  const totalOrdersData: any = undefined;

  const liveOrdersData: any = undefined;

  const statusDistributionData: any = undefined;

  const highValueOrdersData: any = undefined;

  const delayedOrdersData: any = undefined;

  const ordersOverTimeData: any = undefined;

  // Handle Add Widget directly to current dashboard draft
  const handleAddWidget = async (widgetId: string, defaultWidth = 4) => {
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
          height: 1,
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
          configuration: (p as any).configuration,
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

  // 6 Predefined Orders widgets
  const catalogWidgets = [
    {
      id: "orders_total_volume",
      altId: "overview_total_orders",
      categoryTrack: "TICKET METRICS",
      title: "Total Orders",
      type: "KPI",
      typeClass: "bg-surface-container-high text-on-surface",
      description: "Monitor the number of orders in the selected time range.",
      defaultWidth: 4,
    },
    {
      id: "orders_live_feed",
      altId: "orders_live_feed",
      categoryTrack: "DISPATCH STREAM",
      title: "Live Orders Feed",
      type: "LIVE",
      typeClass: "bg-tertiary-fixed text-on-tertiary-fixed",
      description: "See incoming orders and their current status in real time without opening the full Orders screen.",
      defaultWidth: 6,
    },
    {
      id: "orders_by_status",
      altId: "orders_status_distribution",
      categoryTrack: "PARTITIONING",
      title: "Order Status Breakdown",
      type: "CHART",
      typeClass: "bg-secondary-fixed text-on-secondary-fixed",
      description: "Understand the distribution of orders by status across Dine-In, Delivery, and Takeaway.",
      defaultWidth: 6,
    },
    {
      id: "orders_high_value",
      altId: "orders_high_value_ledger",
      categoryTrack: "HIGH VALUE TRANSACTIONS",
      title: "Top Orders by Value",
      type: "TABLE",
      typeClass: "bg-surface-container text-on-surface",
      description: "Track highest-value dining folios and banquet orders in real time.",
      defaultWidth: 6,
    },
    {
      id: "orders_delayed_alerts",
      altId: "kds_delayed_orders_alert",
      categoryTrack: "SERVICE LATENCY",
      title: "Delayed Orders Alert",
      type: "ALERT",
      typeClass: "bg-error-container text-on-error-container",
      description: "Identify orders that exceed configured service and preparation time thresholds.",
      defaultWidth: 6,
    },
    {
      id: "orders_volume_over_time",
      altId: "reports_hourly_velocity",
      categoryTrack: "TEMPO PACING",
      title: "Orders Over Time",
      type: "CHART",
      typeClass: "bg-secondary-fixed text-on-secondary-fixed",
      description: "Identify changes in order volume and dispatch pacing throughout service shifts.",
      defaultWidth: 6,
    },
  ];

  // Filter widgets by search query
  const filteredWidgets = useMemo(() => {
    if (!searchKeyword.trim()) return catalogWidgets;
    const q = searchKeyword.toLowerCase();
    return catalogWidgets.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q)
    );
  }, [searchKeyword]);

  const placedCount = useMemo(() => {
    let count = 0;
    for (const w of catalogWidgets) {
      if (placedWidgetMap.has(w.id) || placedWidgetMap.has(w.altId)) count++;
    }
    return count;
  }, [placedWidgetMap]);

  // Formatted date label for displaying the basis of data
  const dateBasisLabel = useMemo(() => {
    const country = activeOrg?.country || "IN";
    const tz = activeOrg?.organizationTimeZone;
    if (selectedPreset === "Custom Range") {
      return `${formatDateDisplay(startDate, country, tz)} - ${formatDateDisplay(endDate, country, tz)}`;
    }
    if (selectedPreset === "Today") {
      return `Today (${formatDateDisplay(startDate, country, tz)})`;
    }
    if (selectedPreset === "Yesterday") {
      return `Yesterday (${formatDateDisplay(startDate, country, tz)})`;
    }
    return `${selectedPreset} (${formatDateDisplay(startDate, country, tz)} - ${formatDateDisplay(endDate, country, tz)})`;
  }, [selectedPreset, startDate, endDate, activeOrg]);

  return (
    <PosShell title="Executive Workstation" subtitle="Telemetry Catalog · Orders">
      <div className="flex flex-col w-full bg-surface min-h-screen">
        <div className="p-space-lg lg:p-space-xl flex flex-col gap-space-lg max-w-[1440px] mx-auto w-full">
          {/* Editorial Navigation & Header Context */}
          <header className="flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-space-xs text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md uppercase tracking-wider group cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-1">
                  arrow_back
                </span>
                <span>Back to Categories</span>
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-space-sm bg-primary text-on-primary font-label-md text-label-md px-space-lg py-space-sm rounded-full shadow-sm hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <span>Done / Return to Dashboard</span>
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
              </Link>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md pt-space-xs">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-sm">
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-surface">
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  </div>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface font-normal tracking-tight">
                    Orders
                  </h1>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                  Monitor order volume, status, fulfilment, and orders that need attention. Select a
                  date range to calibrate live telemetry or review historical shifts.
                </p>
              </div>

              {/* Action Toolbar: Calendar Picker & Search */}
              <div className="flex flex-wrap items-center gap-space-sm">
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
                <div className="relative min-w-[220px]">
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Search Orders widgets..."
                    className="w-full bg-surface-container-low pl-10 pr-4 py-space-sm rounded-full text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest shadow-sm transition-all"
                  />
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                    search
                  </span>
                </div>

                <div className="inline-flex items-center gap-space-xs bg-surface-container-high px-space-md py-space-sm rounded-full shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="font-label-sm text-label-sm text-on-surface uppercase tracking-wider">
                    {placedCount} / 6 Placed
                  </span>
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
          </header>

          {/* Widgets Catalog Mosaic Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-lg">
            {/* Widget 1: Total Orders */}
            {filteredWidgets.some((w) => w.id === "orders_total_volume") && (
              <TotalOrdersCatalogCard
                widget={catalogWidgets[0]}
                placement={placedWidgetMap.get("orders_total_volume") || placedWidgetMap.get("overview_total_orders")}
                onAdd={handleAddWidget}
                isAdding={isAddingId === "orders_total_volume"}
                data={totalOrdersData}
                dateLabel={selectedPreset}
              />
            )}

            {/* Widget 2: Live Orders Feed */}
            {filteredWidgets.some((w) => w.id === "orders_live_feed") && (
              <LiveFeedCatalogCard
                widget={catalogWidgets[1]}
                placement={placedWidgetMap.get("orders_live_feed")}
                onAdd={handleAddWidget}
                isAdding={isAddingId === "orders_live_feed"}
                data={liveOrdersData}
                dateLabel={selectedPreset}
              />
            )}

            {/* Widget 3: Order Status Breakdown */}
            {filteredWidgets.some((w) => w.id === "orders_by_status") && (
              <StatusBreakdownCatalogCard
                widget={catalogWidgets[2]}
                placement={placedWidgetMap.get("orders_by_status") || placedWidgetMap.get("orders_status_distribution")}
                onAdd={handleAddWidget}
                isAdding={isAddingId === "orders_by_status"}
                data={statusDistributionData}
                dateLabel={selectedPreset}
              />
            )}

            {/* Widget 4: Top Orders by Value */}
            {filteredWidgets.some((w) => w.id === "orders_high_value") && (
              <HighValueCatalogCard
                widget={catalogWidgets[3]}
                placement={placedWidgetMap.get("orders_high_value") || placedWidgetMap.get("orders_high_value_ledger")}
                onAdd={handleAddWidget}
                isAdding={isAddingId === "orders_high_value"}
                data={highValueOrdersData}
                dateLabel={selectedPreset}
              />
            )}

            {/* Widget 5: Delayed Orders Alert */}
            {filteredWidgets.some((w) => w.id === "orders_delayed_alerts") && (
              <DelayedOrdersCatalogCard
                widget={catalogWidgets[4]}
                placement={placedWidgetMap.get("orders_delayed_alerts") || placedWidgetMap.get("kds_delayed_orders_alert")}
                onAdd={handleAddWidget}
                isAdding={isAddingId === "orders_delayed_alerts"}
                data={delayedOrdersData}
                dateLabel={selectedPreset}
              />
            )}

            {/* Widget 6: Orders Over Time */}
            {filteredWidgets.some((w) => w.id === "orders_volume_over_time") && (
              <VolumeOverTimeCatalogCard
                widget={catalogWidgets[5]}
                placement={placedWidgetMap.get("orders_volume_over_time") || placedWidgetMap.get("reports_hourly_velocity")}
                onAdd={handleAddWidget}
                isAdding={isAddingId === "orders_volume_over_time"}
                data={ordersOverTimeData}
                dateLabel={selectedPreset}
              />
            )}
          </div>

          {/* Editorial Footer Callout */}
          <section className="mt-space-md p-space-lg rounded-DEFAULT bg-surface-container-low flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface">
                <span className="material-symbols-outlined text-[20px]">tune</span>
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-normal">
                  Customizing Layout Arrangement
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Widgets added to the main workstation will immediately reflect live kitchen
                  transactions with real-time socket refresh.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-space-sm self-end md:self-auto">
              <Link
                href="/dashboard"
                className="font-label-md text-label-md text-on-surface px-space-md py-space-sm hover:underline cursor-pointer"
              >
                View Active Canvas
              </Link>
              <Link
                href="/dashboard"
                className="font-label-md text-label-md bg-primary text-on-primary px-space-lg py-space-sm rounded-full shadow-sm hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Done
              </Link>
            </div>
          </section>
        </div>
      </div>
    </PosShell>
  );
}

// ==========================================
// INDIVIDUAL MOSAIC WIDGET CARDS (REAL DATA)
// ==========================================

function TotalOrdersCatalogCard({ widget, placement, onAdd, isAdding, data, dateLabel }: any) {
  const isPlaced = !!placement;
  const isLoading = data === undefined;

  const count = data?.kpi?.value ?? 0;
  const delta = data?.kpi?.deltaLabel || "+0.0% vs prior";
  const isPositive = (data?.kpi?.deltaPercent ?? 0) >= 0;

  const dineInCount = data?.summary?.dineIn ?? (data?.kpi?.secondaryMetrics?.find((m: any) => m.label === "Dine-In")?.value ?? 0);
  const digitalCount = data?.summary?.digital ?? ((data?.summary?.takeaway || 0) + (data?.summary?.delivery || 0));

  return (
    <article className="bg-surface-container-lowest rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-300 relative group overflow-hidden">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm tracking-widest text-outline uppercase font-semibold">
              {widget.categoryTrack}
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-normal">
              {widget.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-label-sm text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-secondary font-medium">
              {dateLabel}
            </span>
            <span className={`font-label-sm text-label-sm px-space-sm py-0.5 rounded-full ${widget.typeClass} font-semibold tracking-wide`}>
              {widget.type}
            </span>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {widget.description}
        </p>

        {/* Visual Inset Preview */}
        <div className="bg-surface-container-low rounded-DEFAULT p-space-md flex flex-col gap-space-sm mt-space-xs">
          {isLoading ? (
            <div className="h-20 flex items-center justify-center">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="font-display-sm text-display-sm text-on-surface font-normal tracking-tight">
                  {count} <span className="font-headline-sm text-headline-sm text-outline">Tkts</span>
                </span>
                <div className="inline-flex items-center gap-0.5 bg-surface-container px-2 py-0.5 rounded-full">
                  <span className={`material-symbols-outlined text-[14px] ${isPositive ? "text-primary" : "text-error"}`}>
                    {isPositive ? "trending_up" : "trending_down"}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface font-semibold">{delta}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm pt-space-xs">
                <span className="bg-surface-container-lowest px-2 py-1 rounded-DEFAULT shadow-sm font-label-sm text-label-sm">
                  {dineInCount} Dine-In
                </span>
                <span className="text-outline">/</span>
                <span className="bg-surface-container-lowest px-2 py-1 rounded-DEFAULT shadow-sm font-label-sm text-label-sm">
                  {digitalCount} Digital
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pt-space-lg flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
          {isPlaced ? `Slot: Row ${placement.gridRow + 1} Col ${placement.gridCol + 1}` : "Size: 4 Cols"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-surface-container-high text-on-surface font-label-md text-label-md px-space-md py-1.5 rounded-full cursor-default opacity-90 shadow-sm"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[16px]">check</span>
          </button>
        ) : (
          <button
            onClick={() => onAdd(widget.id, widget.defaultWidth)}
            disabled={isAdding}
            className="inline-flex items-center gap-1 bg-primary text-on-primary hover:bg-neutral-800 transition-colors font-label-md text-label-md px-space-md py-1.5 rounded-full shadow-sm cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{isAdding ? "Adding..." : "Add Widget"}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function LiveFeedCatalogCard({ widget, placement, onAdd, isAdding, data, dateLabel }: any) {
  const isPlaced = !!placement;
  const isLoading = data === undefined;
  const feedItems = data?.liveFeed?.items || [];

  return (
    <article className="bg-surface-container-lowest rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-300 relative group overflow-hidden">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm tracking-widest text-outline uppercase font-semibold">
              {widget.categoryTrack}
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-normal">
              {widget.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-label-sm text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-secondary font-medium">
              {dateLabel}
            </span>
            <span className={`font-label-sm text-label-sm px-space-sm py-0.5 rounded-full ${widget.typeClass} font-semibold tracking-wide`}>
              {widget.type}
            </span>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {widget.description}
        </p>

        {/* Visual Inset Preview */}
        <div className="bg-surface-container-low rounded-DEFAULT p-space-sm flex flex-col gap-1.5 mt-space-xs min-h-[110px] justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : feedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-5 text-center px-2">
              <span className="material-symbols-outlined text-outline text-[22px] mb-1">inbox</span>
              <span className="font-label-sm text-label-sm text-on-surface">No recent orders in this period</span>
              <span className="font-body-xs text-xs text-secondary mt-0.5">Tickets placed at POS will show here in real time.</span>
            </div>
          ) : (
            feedItems.slice(0, 3).map((item: any, idx: number) => {
              const dotColor = idx === 0 ? "bg-primary animate-pulse" : idx === 1 ? "bg-secondary" : "bg-outline";
              const badgeBg = item.badge?.text === "Completed" ? "bg-surface-container text-on-surface" : "bg-secondary-container text-on-secondary-container";

              return (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between p-2 rounded-DEFAULT bg-surface-container-lowest shadow-sm"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className="font-label-md text-label-md text-on-surface shrink-0">{item.title}</span>
                    <span className="font-body-sm text-body-sm text-outline truncate">{item.subtitle}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full ${badgeBg}`}>
                      {item.badge?.text || "Active"}
                    </span>
                    <span className="font-body-sm text-body-sm text-outline">{item.timeAgo || "now"}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-space-lg flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
          {isPlaced ? `Slot: Row ${placement.gridRow + 1} Col ${placement.gridCol + 1}` : "Size: 6 Cols"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-surface-container-high text-on-surface font-label-md text-label-md px-space-md py-1.5 rounded-full cursor-default opacity-90 shadow-sm"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[16px]">check</span>
          </button>
        ) : (
          <button
            onClick={() => onAdd(widget.id, widget.defaultWidth)}
            disabled={isAdding}
            className="inline-flex items-center gap-1 bg-primary text-on-primary hover:bg-neutral-800 transition-colors font-label-md text-label-md px-space-md py-1.5 rounded-full shadow-sm cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{isAdding ? "Adding..." : "Add Widget"}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function StatusBreakdownCatalogCard({ widget, placement, onAdd, isAdding, data, dateLabel }: any) {
  const isPlaced = !!placement;
  const isLoading = data === undefined;

  const chartSeries = data?.chart?.data || [];
  const total = chartSeries.reduce((acc: number, item: any) => acc + (item.value || 0), 0);

  const completed = chartSeries.find((s: any) => s.label.includes("Completed"))?.value || 0;
  const inKitchen = chartSeries.find((s: any) => s.label.includes("Prep") || s.label.includes("Kitchen"))?.value || 0;
  const ready = chartSeries.find((s: any) => s.label.includes("Ready"))?.value || 0;
  const pending = chartSeries.find((s: any) => s.label.includes("Pending") || s.label.includes("Unpaid"))?.value || 0;
  const cancelled = chartSeries.find((s: any) => s.label.includes("Cancelled"))?.value || 0;

  // Compute percentage stroke segments
  const completedPct = total > 0 ? (completed / total) * 100 : 0;
  const readyPct = total > 0 ? (ready / total) * 100 : 0;
  const inKitchenPct = total > 0 ? (inKitchen / total) * 100 : 0;
  const pendingPct = total > 0 ? (pending / total) * 100 : 0;

  return (
    <article className="bg-surface-container-lowest rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-300 relative group overflow-hidden">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm tracking-widest text-outline uppercase font-semibold">
              {widget.categoryTrack}
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-normal">
              {widget.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-label-sm text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-secondary font-medium">
              {dateLabel}
            </span>
            <span className={`font-label-sm text-label-sm px-space-sm py-0.5 rounded-full ${widget.typeClass} font-semibold tracking-wide`}>
              {widget.type}
            </span>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {widget.description}
        </p>

        {/* Visual Inset Preview: SVG Donut */}
        <div className="bg-surface-container-low rounded-DEFAULT p-space-md flex items-center justify-between gap-space-md mt-space-xs min-h-[140px]">
          {isLoading ? (
            <div className="w-full flex items-center justify-center py-8">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : total === 0 ? (
            <div className="w-full flex flex-col items-center justify-center py-4 text-center">
              <div className="w-16 h-16 rounded-full border-4 border-surface-container flex items-center justify-center mb-1">
                <span className="font-label-md font-semibold text-outline">0</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface">No orders to partition</span>
              <span className="text-xs text-secondary">All status counts are zero for {dateLabel}.</span>
            </div>
          ) : (
            <>
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="none" r="14" stroke="#eee7e3" strokeWidth="4" />
                  {completedPct > 0 && (
                    <circle
                      cx="18"
                      cy="18"
                      fill="none"
                      r="14"
                      stroke="#1e1b19"
                      strokeDasharray={`${completedPct} 100`}
                      strokeDashoffset="0"
                      strokeWidth="4"
                    />
                  )}
                  {readyPct > 0 && (
                    <circle
                      cx="18"
                      cy="18"
                      fill="none"
                      r="14"
                      stroke="#645d58"
                      strokeDasharray={`${readyPct} 100`}
                      strokeDashoffset={`-${completedPct}`}
                      strokeWidth="4"
                    />
                  )}
                  {inKitchenPct > 0 && (
                    <circle
                      cx="18"
                      cy="18"
                      fill="none"
                      r="14"
                      stroke="#ae7758"
                      strokeDasharray={`${inKitchenPct} 100`}
                      strokeDashoffset={`-${completedPct + readyPct}`}
                      strokeWidth="4"
                    />
                  )}
                  {pendingPct > 0 && (
                    <circle
                      cx="18"
                      cy="18"
                      fill="none"
                      r="14"
                      stroke="#cfc4c5"
                      strokeDasharray={`${pendingPct} 100`}
                      strokeDashoffset={`-${completedPct + readyPct + inKitchenPct}`}
                      strokeWidth="4"
                    />
                  )}
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="font-headline-sm text-headline-sm text-on-surface font-normal">{total}</span>
                  <span className="font-label-sm text-label-sm text-outline -mt-1 uppercase">Total</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 w-full text-on-surface">
                <div className="flex items-center justify-between text-body-sm font-body-sm">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-neutral-900" />Completed</span>
                  <span className="font-label-sm text-label-sm font-semibold">{completed}</span>
                </div>
                <div className="flex items-center justify-between text-body-sm font-body-sm">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary" />Ready at Pass</span>
                  <span className="font-label-sm text-label-sm font-semibold">{ready}</span>
                </div>
                <div className="flex items-center justify-between text-body-sm font-body-sm">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-on-tertiary-container" />In-Prep</span>
                  <span className="font-label-sm text-label-sm font-semibold">{inKitchen}</span>
                </div>
                <div className="flex items-center justify-between text-body-sm font-body-sm">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-outline-variant" />Pending</span>
                  <span className="font-label-sm text-label-sm font-semibold">{pending}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pt-space-lg flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
          {isPlaced ? `Slot: Row ${placement.gridRow + 1} Col ${placement.gridCol + 1}` : "Size: 6 Cols"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-surface-container-high text-on-surface font-label-md text-label-md px-space-md py-1.5 rounded-full cursor-default opacity-90 shadow-sm"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[16px]">check</span>
          </button>
        ) : (
          <button
            onClick={() => onAdd(widget.id, widget.defaultWidth)}
            disabled={isAdding}
            className="inline-flex items-center gap-1 bg-primary text-on-primary hover:bg-neutral-800 transition-colors font-label-md text-label-md px-space-md py-1.5 rounded-full shadow-sm cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{isAdding ? "Adding..." : "Add Widget"}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function HighValueCatalogCard({ widget, placement, onAdd, isAdding, data, dateLabel }: any) {
  const isPlaced = !!placement;
  const isLoading = data === undefined;
  const rows = data?.table?.rows || [];

  return (
    <article className="bg-surface-container-lowest rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-300 relative group overflow-hidden">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm tracking-widest text-outline uppercase font-semibold">
              {widget.categoryTrack}
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-normal">
              {widget.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-label-sm text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-secondary font-medium">
              {dateLabel}
            </span>
            <span className={`font-label-sm text-label-sm px-space-sm py-0.5 rounded-full ${widget.typeClass} font-semibold tracking-wide`}>
              {widget.type}
            </span>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {widget.description}
        </p>

        {/* Visual Inset Preview: Data Ledger */}
        <div className="bg-surface-container-low rounded-DEFAULT p-space-sm flex flex-col gap-1.5 mt-space-xs min-h-[110px] justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-5 text-center px-2">
              <span className="material-symbols-outlined text-outline text-[22px] mb-1">payments</span>
              <span className="font-label-sm text-label-sm text-on-surface">No high-value tickets found</span>
              <span className="font-body-xs text-xs text-secondary mt-0.5">Tickets exceeding ₹2,000 will be ranked here.</span>
            </div>
          ) : (
            rows.slice(0, 3).map((row: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-DEFAULT bg-surface-container-lowest shadow-sm"
              >
                <div className="flex flex-col truncate">
                  <span className="font-label-md text-label-md text-on-surface">{row.orderNumber}</span>
                  <span className="font-body-sm text-body-sm text-outline truncate">{row.label || row.customer}</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">{row.amount}</span>
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container text-on-surface">
                    {row.paymentStatus || row.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-space-lg flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
          {isPlaced ? `Slot: Row ${placement.gridRow + 1} Col ${placement.gridCol + 1}` : "Size: 6 Cols"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-surface-container-high text-on-surface font-label-md text-label-md px-space-md py-1.5 rounded-full cursor-default opacity-90 shadow-sm"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[16px]">check</span>
          </button>
        ) : (
          <button
            onClick={() => onAdd(widget.id, widget.defaultWidth)}
            disabled={isAdding}
            className="inline-flex items-center gap-1 bg-primary text-on-primary hover:bg-neutral-800 transition-colors font-label-md text-label-md px-space-md py-1.5 rounded-full shadow-sm cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{isAdding ? "Adding..." : "Add Widget"}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DelayedOrdersCatalogCard({ widget, placement, onAdd, isAdding, data, dateLabel }: any) {
  const isPlaced = !!placement;
  const isLoading = data === undefined;
  const alert = data?.alert;
  const delayedCount = alert?.count ?? 0;
  const delayedOrders = alert?.delayedOrders || [];

  return (
    <article className="bg-surface-container-lowest rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-300 relative group overflow-hidden">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm tracking-widest text-outline uppercase font-semibold">
              {widget.categoryTrack}
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-normal">
              {widget.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-label-sm text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-secondary font-medium">
              {dateLabel}
            </span>
            <span className={`font-label-sm text-label-sm px-space-sm py-0.5 rounded-full ${widget.typeClass} font-semibold tracking-wide`}>
              {widget.type}
            </span>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {widget.description}
        </p>

        {/* Visual Inset Preview */}
        <div className="bg-surface-container-low rounded-DEFAULT p-space-md flex flex-col gap-space-xs mt-space-xs min-h-[110px] justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : delayedCount === 0 ? (
            <div className="bg-surface-container-lowest rounded-DEFAULT p-space-md flex flex-col gap-space-xs text-on-surface border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span className="font-label-md text-label-md font-semibold">Tickets Running on Schedule</span>
                </div>
                <span className="font-label-sm text-label-sm bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  SLA Optimal
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary pt-0.5">
                0 orders exceeding preparation latency threshold for {dateLabel}.
              </p>
            </div>
          ) : (
            <div className="bg-error-container rounded-DEFAULT p-space-md flex flex-col gap-space-xs text-on-error-container">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  <span className="font-label-md text-label-md font-semibold">
                    {delayedCount} Order{delayedCount > 1 ? "s" : ""} Exceeding SLA
                  </span>
                </div>
                <span className="font-label-sm text-label-sm bg-surface-container-lowest/80 text-error px-2 py-0.5 rounded-full font-bold">
                  Attention Required
                </span>
              </div>
              {delayedOrders.length > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="font-body-md text-body-md font-medium truncate">
                    {delayedOrders[0].orderNumber} • {delayedOrders[0].label}
                  </span>
                  <span className="font-label-sm text-label-sm shrink-0">
                    {delayedOrders[0].elapsedMinutes}m elapsed
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 text-body-sm font-body-sm opacity-80 pt-0.5">
                <span className="material-symbols-outlined text-[14px]">soup_kitchen</span>
                <span>{alert?.message || "Kitchen station turnaround latency detected."}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-space-lg flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
          {isPlaced ? `Slot: Row ${placement.gridRow + 1} Col ${placement.gridCol + 1}` : "Size: 6 Cols"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-surface-container-high text-on-surface font-label-md text-label-md px-space-md py-1.5 rounded-full cursor-default opacity-90 shadow-sm"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[16px]">check</span>
          </button>
        ) : (
          <button
            onClick={() => onAdd(widget.id, widget.defaultWidth)}
            disabled={isAdding}
            className="inline-flex items-center gap-1 bg-primary text-on-primary hover:bg-neutral-800 transition-colors font-label-md text-label-md px-space-md py-1.5 rounded-full shadow-sm cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{isAdding ? "Adding..." : "Add Widget"}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function VolumeOverTimeCatalogCard({ widget, placement, onAdd, isAdding, data, dateLabel }: any) {
  const isPlaced = !!placement;
  const isLoading = data === undefined;

  const chartData: Array<{ label: string; value: number }> = data?.chart?.data || [];
  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const peakLabel = data?.chart?.peakLabel || "N/A";
  const totalVolume = data?.chart?.totalValue || 0;

  return (
    <article className="bg-surface-container-lowest rounded-DEFAULT p-space-lg flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-300 relative group overflow-hidden">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm tracking-widest text-outline uppercase font-semibold">
              {widget.categoryTrack}
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface font-normal">
              {widget.title}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-label-sm text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-secondary font-medium">
              {dateLabel}
            </span>
            <span className={`font-label-sm text-label-sm px-space-sm py-0.5 rounded-full ${widget.typeClass} font-semibold tracking-wide`}>
              {widget.type}
            </span>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {widget.description}
        </p>

        {/* Visual Inset Preview: Bar Histogram */}
        <div className="bg-surface-container-low rounded-DEFAULT p-space-md flex flex-col gap-space-xs mt-space-xs min-h-[140px] justify-between">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between h-20 pt-2 px-1 gap-1">
                {chartData.slice(0, 10).map((h, i) => {
                  const barHeightPct = totalVolume > 0 && h.value > 0 ? Math.max(15, Math.round((h.value / maxVal) * 100)) : 8;
                  const isPeak = totalVolume > 0 && h.value === maxVal && maxVal > 0;

                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1 h-full justify-end group/bar">
                      <div
                        style={{ height: `${barHeightPct}%` }}
                        className={`w-full ${
                          isPeak ? "bg-primary" : "bg-surface-container-highest group-hover/bar:bg-primary"
                        } rounded-t-sm transition-all duration-300`}
                        title={`${h.label}: ${h.value} orders`}
                      />
                      <span
                        className={`font-label-sm text-[10px] ${
                          isPeak ? "text-on-surface font-bold" : "text-outline"
                        }`}
                      >
                        {h.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant pt-1 px-1 border-t border-surface-container/60">
                <span>Total: {totalVolume} orders</span>
                <span className="font-label-sm text-label-sm font-semibold text-on-surface">
                  Peak: {peakLabel}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pt-space-lg flex items-center justify-between">
        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
          {isPlaced ? `Slot: Row ${placement.gridRow + 1} Col ${placement.gridCol + 1}` : "Size: 6 Cols"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-surface-container-high text-on-surface font-label-md text-label-md px-space-md py-1.5 rounded-full cursor-default opacity-90 shadow-sm"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[16px]">check</span>
          </button>
        ) : (
          <button
            onClick={() => onAdd(widget.id, widget.defaultWidth)}
            disabled={isAdding}
            className="inline-flex items-center gap-1 bg-primary text-on-primary hover:bg-neutral-800 transition-colors font-label-md text-label-md px-space-md py-1.5 rounded-full shadow-sm cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{isAdding ? "Adding..." : "Add Widget"}</span>
          </button>
        )}
      </div>
    </article>
  );
}
