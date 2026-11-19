"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PosShell } from "../../../components/PosShell";
import { OrderDateRangePicker } from "../../../components/OrderDateRangePicker";
import { formatStoreDate } from "../../../../lib/constants/countries";
import {
  OVERVIEW_CATALOG_WIDGETS,
  DrawerOverviewNetSalesCard,
  DrawerOverviewTotalOrdersCard,
  DrawerOverviewAovCard,
  DrawerOverviewActiveOrdersCard,
  DrawerOverviewPendingOrdersCard,
  DrawerOverviewSalesTrendsCard,
  DrawerOverviewOrderStatusSummaryCard,
  DrawerOverviewBusinessSummaryCard,
} from "../../../components/dashboard/drawerCards/OverviewDrawerCards";

function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export default function OverviewCatalogPage() {
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

  const queryArgs = useMemo(() => {
    if (!activeOrg) return "skip";
    return {
      organizationId: activeOrg._id,
      dateRangePreset: dateRangePresetArg as any,
      fromTimestamp: startDate.getTime(),
      toTimestamp: endDate.getTime(),
    };
  }, [activeOrg, dateRangePresetArg, startDate, endDate]);

  // Telemetry queries for the 8 overview widgets
  const netRevenueData: any = undefined;
  const totalOrdersData: any = undefined;
  const aovData: any = undefined;
  const activeOrdersData: any = undefined;
  const pendingOrdersData: any = undefined;
  const salesTrendsData: any = undefined;
  const orderStatusData: any = undefined;
  const businessSummaryData: any = undefined;

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
          height: defaultWidth >= 6 ? 2 : 1,
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

  const filteredWidgets = useMemo(() => {
    if (!searchKeyword.trim()) return OVERVIEW_CATALOG_WIDGETS;
    const q = searchKeyword.toLowerCase();
    return OVERVIEW_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q)
    );
  }, [searchKeyword]);

  const placedCount = useMemo(() => {
    let count = 0;
    for (const w of OVERVIEW_CATALOG_WIDGETS) {
      if (placedWidgetMap.has(w.id)) count++;
    }
    return count;
  }, [placedWidgetMap]);

  return (
    <PosShell title="Overview Widgets Catalog" subtitle="Executive Telemetry Store">
      <div className="flex flex-col w-full min-h-screen bg-surface">
        <div className="px-space-lg py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto w-full">
          {/* Top Utility & Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-space-md">
            <Link
              href="/dashboard"
              className="group flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-1">
                arrow_back
              </span>
              <span className="tracking-wider uppercase">BACK TO DASHBOARD</span>
            </Link>

            <div className="flex items-center gap-space-md flex-wrap">
              <div className="flex items-center gap-space-xs bg-surface-container px-space-md py-space-xs rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="font-label-sm text-label-sm text-on-surface font-semibold tracking-wide uppercase">
                  8 Widgets Available
                </span>
                <span className="font-label-sm text-label-sm text-outline">•</span>
                <span className="font-label-sm text-label-sm text-secondary font-medium">
                  {placedCount} Configured
                </span>
              </div>

              {/* Date Filter */}
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
                variant="pill"
                align="right"
              />

              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-space-xs bg-primary text-on-primary hover:bg-inverse-surface px-space-lg py-space-sm rounded-full font-label-md text-label-md font-semibold transition-colors shadow-sm cursor-pointer"
              >
                <span>Done / Return to Dashboard</span>
                <span className="material-symbols-outlined text-[16px]">check</span>
              </button>
            </div>
          </div>

          {/* Category Header Banner (Designer Design Exact) */}
          <div className="bg-surface-container-low rounded-DEFAULT p-space-lg flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg shadow-sm border border-surface-container">
            <div className="flex items-start sm:items-center gap-space-lg">
              <div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[28px]">explore</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs mb-space-xs">
                  <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-semibold">
                    EXECUTIVE TELEMETRY STORE
                  </span>
                  <span className="font-label-sm text-label-sm text-outline">•</span>
                  <span className="font-label-sm text-label-sm text-secondary">LIVE FEED</span>
                </div>
                <h1 className="font-display-sm text-display-sm text-on-surface font-normal tracking-tight">
                  Overview
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-0.5">
                  High-level operational health, revenue velocity, order throughput, and blended restaurant performance metrics.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm shrink-0">
              <div className="relative min-w-[280px]">
                <span className="material-symbols-outlined text-outline text-[18px] absolute left-space-md top-1/2 -translate-y-1/2">
                  search
                </span>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Search Overview widgets... (Ctrl+K)"
                  className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md pl-9 pr-space-md py-space-sm rounded-full outline-none focus:bg-surface-container-lowest shadow-sm placeholder:text-outline border border-surface-container/60"
                />
              </div>
              <div className="bg-surface-container-high px-space-md py-space-sm rounded-full flex items-center justify-center whitespace-nowrap">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                  8 WIDGETS • {placedCount} ON DASHBOARD
                </span>
              </div>
            </div>
          </div>

          {/* Widgets Catalog Grid: 8 Predefined Overview Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-lg">
            {filteredWidgets.map((w) => {
              const isPlaced = placedWidgetMap.has(w.id);
              const placement = placedWidgetMap.get(w.id);
              const onAdd = () => handleAddWidget(w.id, w.defaultWidth);

              switch (w.id) {
                case "overview_net_revenue":
                  return <DrawerOverviewNetSalesCard key={w.id} widget={w} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={netRevenueData} />;
                case "overview_total_orders":
                  return <DrawerOverviewTotalOrdersCard key={w.id} widget={w} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={totalOrdersData} />;
                case "overview_average_order_value":
                  return <DrawerOverviewAovCard key={w.id} widget={w} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={aovData} />;
                case "overview_active_orders":
                  return <DrawerOverviewActiveOrdersCard key={w.id} widget={w} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={activeOrdersData} />;
                case "overview_pending_orders":
                  return <DrawerOverviewPendingOrdersCard key={w.id} widget={w} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={pendingOrdersData} />;
                case "overview_sales_trends":
                  return <DrawerOverviewSalesTrendsCard key={w.id} widget={w} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={salesTrendsData} />;
                case "overview_order_status_distribution":
                  return <DrawerOverviewOrderStatusSummaryCard key={w.id} widget={w} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={orderStatusData} />;
                case "overview_business_summary":
                  return <DrawerOverviewBusinessSummaryCard key={w.id} widget={w} isPlaced={isPlaced} placement={placement} onAdd={onAdd} data={businessSummaryData} />;
                default:
                  return null;
              }
            })}
          </div>

          {/* Bottom Editorial Banner */}
          <div className="bg-secondary-container rounded-DEFAULT p-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-md text-center sm:text-left mt-space-sm shadow-sm border border-secondary-container">
            <div className="flex items-center gap-space-md">
              <span className="material-symbols-outlined text-on-secondary-container text-[24px] hidden sm:block shrink-0">
                sync
              </span>
              <p className="font-body-md text-body-md text-on-secondary-container font-medium">
                Configured overview widgets synchronize with your Executive Command Center and live mobile alerts.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 font-label-md text-label-md text-primary font-semibold hover:underline shrink-0"
            >
              <span>Manage Dashboard Layout</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </PosShell>
  );
}

