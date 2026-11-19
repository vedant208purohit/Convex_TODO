"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  WORKSTATION_CATALOG_WIDGETS,
  DrawerWorkstationOrderSummaryCard,
  DrawerWorkstationOrdersByWorkstationCard,
  DrawerWorkstationActiveTasksCard,
  DrawerWorkstationQueueCard,
  DrawerWorkstationPrepTimeCard,
  DrawerWorkstationDelayedOrdersCard,
  DrawerWorkstationPerformanceCard,
  DrawerWorkstationAvailabilityCard,
} from "./drawerCards/WorkstationDrawerCards";
import {
  CAPTAIN_CATALOG_WIDGETS,
  DrawerCaptainActiveOrdersCard,
  DrawerCaptainTableServiceStatusCard,
  DrawerCaptainAssignedTablesCard,
  DrawerCaptainServiceTimeCard,
  DrawerCaptainOrdersAwaitingServiceCard,
  DrawerCaptainPerformanceSummaryCard,
  DrawerCaptainOrderActivityCard,
} from "./drawerCards/CaptainDrawerCards";
import {
  MENU_CATALOG_WIDGETS,
  renderMenuDrawerCard,
} from "./drawerCards/MenuDrawerCards";
import {
  CASHIER_CATALOG_WIDGETS,
  renderCashierDrawerCard,
} from "./drawerCards/CashierDrawerCards";
import {
  QUEUE_CATALOG_WIDGETS,
  renderQueueDrawerCard,
} from "./drawerCards/QueueDrawerCards";
import {
  CUSTOMER_CATALOG_WIDGETS,
  renderCustomerDrawerCard,
} from "./drawerCards/CustomerDrawerCards";
import {
  SURVEY_CATALOG_WIDGETS,
  renderSurveyDrawerCard,
} from "./drawerCards/SurveyDrawerCards";
import {
  OVERVIEW_CATALOG_WIDGETS,
  renderOverviewDrawerCard,
} from "./drawerCards/OverviewDrawerCards";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  placedWidgetIds: Set<string>;
  placements?: Array<{
    widgetId: string;
    gridRow: number;
    gridCol: number;
    width: number;
  }>;
  onAddWidget: (widgetId: string, defaultWidth?: number) => void;
  dateRangePreset?:
    | "today"
    | "yesterday"
    | "last_7_days"
    | "last_30_days"
    | "this_month"
    | "last_month"
    | "custom"
    | string;
  fromTimestamp?: number;
  toTimestamp?: number;
  onResetDefaults?: () => void;
}

interface ModuleCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  tag?: string;
  description?: string;
}

const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    id: "Overview",
    name: "Overview",
    icon: "grid_view",
    count: 8,
    description:
      "High-level restaurant health, real-time sales trends, table turns, and guest metrics.",
  },
  {
    id: "Orders",
    name: "Orders",
    icon: "receipt_long",
    count: 6,
    description:
      "Monitor order volume, status, fulfilment, and orders that need attention. Curate the live station ledger to reflect kitchen and dining floor tempo.",
  },
  {
    id: "Workstation",
    name: "Workstation",
    icon: "desktop_windows",
    count: 8,
    description:
      "Terminal telemetry, hardware peripherals, offline queues, and local sync latency.",
  },
  {
    id: "KDS",
    name: "KDS (Kitchen)",
    icon: "soup_kitchen",
    count: 6,
    tag: "CONFIGURABLE STATIONS",
    description:
      "Kitchen display line tempo, cook times, prep station routing, and bottleneck alerts.",
  },
  {
    id: "Cashier",
    name: "Cashier",
    icon: "point_of_sale",
    count: 8,
    description:
      "Drawer cash reconciliation, tip distributions, payment method breakdowns, and refunds.",
  },
  {
    id: "Captain",
    name: "Captain",
    icon: "table_restaurant",
    count: 7,
    description:
      "Floor section occupancy, waiter assignment pacing, turnaround times, and table covers.",
  },
  {
    id: "Queue",
    name: "Queue",
    icon: "people_alt",
    count: 6,
    description:
      "Guest waitlist flow, estimated seat times, no-show latency, and queue abandonment.",
  },
  {
    id: "Menu",
    name: "Menu",
    icon: "restaurant_menu",
    count: 8,
    description:
      "Item popularity, 86'd inventory counts, modifier attachment, and margin analysis.",
  },
  {
    id: "Customers",
    name: "Customers",
    icon: "contacts",
    count: 6,
    description:
      "Guest loyalty tiers, average lifetime value, repeat frequency, and dining folios.",
  },
  {
    id: "Surveys",
    name: "Surveys",
    icon: "rate_review",
    count: 6,
    description:
      "Guest CSAT feedback, NPS score trajectory, table review streams, and service escalation alerts.",
  },
];

export interface OrdersCatalogWidget {
  id: string;
  altId?: string;
  altId2?: string;
  categoryTrack: string;
  title: string;
  type: string;
  typeBadgeBg: string;
  description: string;
  defaultWidth: number;
}

interface DrawerCardProps {
  widget: OrdersCatalogWidget;
  isPlaced: boolean;
  placement?: { gridRow: number; gridCol: number };
  onAdd: () => void;
  data?: any;
}

// 6 Curated Orders widgets with their telemetry IDs
const ORDERS_CATALOG_WIDGETS: OrdersCatalogWidget[] = [
  {
    id: "orders_total_volume",
    altId: "overview_total_orders",
    categoryTrack: "TICKET METRICS",
    title: "Total Orders",
    type: "KPI",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description: "Monitor the number of orders in the selected time range.",
    defaultWidth: 4,
  },
  {
    id: "orders_live_feed",
    altId: "orders_live_feed",
    categoryTrack: "DISPATCH STREAM",
    title: "Live Orders Feed",
    type: "LIVE",
    typeBadgeBg: "bg-[#fde9dc] text-[#9b4419]",
    description:
      "See incoming orders and their current status in real time without opening the full Orders screen.",
    defaultWidth: 6,
  },
  {
    id: "orders_by_status",
    altId: "orders_status_distribution",
    altId2: "overview_order_status_distribution",
    categoryTrack: "PARTITIONING",
    title: "Order Status Breakdown",
    type: "CHART",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description:
      "Understand the distribution of orders by status across Dine-In, Delivery, and Takeaway.",
    defaultWidth: 6,
  },
  {
    id: "orders_high_value",
    altId: "orders_high_value_ledger",
    categoryTrack: "HIGH VALUE TRANSACTIONS",
    title: "Top Orders by Value",
    type: "TABLE",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description:
      "Track highest-value dining folios and banquet orders in real time.",
    defaultWidth: 6,
  },
  {
    id: "orders_delayed_alerts",
    altId: "kds_delayed_orders_alert",
    categoryTrack: "SERVICE LATENCY",
    title: "Delayed Orders Alert",
    type: "ALERT",
    typeBadgeBg: "bg-[#fce8e6] text-[#b3261e]",
    description:
      "Identify orders that exceed configured service and preparation time thresholds.",
    defaultWidth: 6,
  },
  {
    id: "orders_volume_over_time",
    altId: "reports_hourly_velocity",
    categoryTrack: "TEMPO PACING",
    title: "Orders Over Time",
    type: "CHART",
    typeBadgeBg: "bg-[#ece6e0] text-stone-700",
    description:
      "Identify changes in order volume and dispatch pacing throughout service shifts.",
    defaultWidth: 6,
  },
];

// 6 Curated KDS widgets with their telemetry IDs
const KDS_CATALOG_WIDGETS: OrdersCatalogWidget[] = [
  {
    id: "kds_live_orders",
    altId: "kds_live_orders",
    categoryTrack: "STREAMING QUEUE",
    title: "Live Kitchen Orders",
    type: "LIVE",
    typeBadgeBg: "bg-black text-white",
    description:
      "Monitor active kitchen orders across all stations in real time.",
    defaultWidth: 6,
  },
  {
    id: "kds_pending_tickets",
    altId: "kds_pending_tickets",
    categoryTrack: "HOLD QUEUE",
    title: "Pending Kitchen Orders",
    type: "KPI",
    typeBadgeBg: "bg-[#eae1da] text-[#6a635e]",
    description:
      "See how many orders are waiting for kitchen processing and ticket fire.",
    defaultWidth: 4,
  },
  {
    id: "kds_station_queue",
    altId: "kds_station_queue",
    categoryTrack: "STATION FILTERED",
    title: "Specific KDS Station",
    type: "CONFIGURABLE",
    typeBadgeBg: "bg-[#e9e1dd] text-[#4d4541]",
    description:
      "Monitor a selected kitchen display station (e.g. Clay Oven, Grill, Beverage, Dessert).",
    defaultWidth: 4,
  },
  {
    id: "kds_status_breakdown",
    altId: "kds_status_breakdown",
    categoryTrack: "REAL-TIME SPLIT",
    title: "Kitchen Order Status Breakdown",
    type: "CHART",
    typeBadgeBg: "bg-[#eae1da] text-[#6a635e]",
    description:
      "Understand the kitchen's current workload across preparation stages.",
    defaultWidth: 6,
  },
  {
    id: "kds_avg_prep_time",
    altId: "kds_avg_prep_time",
    categoryTrack: "DAILY METRICS",
    title: "Average Kitchen Prep Time",
    type: "KPI",
    typeBadgeBg: "bg-[#eae1da] text-[#6a635e]",
    description:
      "Understand kitchen preparation performance against the 20-minute restaurant SLA.",
    defaultWidth: 4,
  },
  {
    id: "kds_delay_alerts",
    altId: "kds_delay_alerts",
    categoryTrack: "LIVE ESCALATION",
    title: "Kitchen Delay Alerts",
    type: "ALERT",
    typeBadgeBg: "bg-[#ffdad6] text-[#ba1a1a]",
    description:
      "Highlight kitchen orders that exceed the 20-minute preparation threshold.",
    defaultWidth: 6,
  },
];

export function AddWidgetDrawer({
  isOpen,
  onClose,
  organizationId,
  placedWidgetIds,
  placements = [],
  onAddWidget,
  dateRangePreset,
  fromTimestamp,
  toTimestamp,
  onResetDefaults,
}: Props) {
  // Default directly to Overview so user sees the 8 curated overview widgets right away
  const [selectedCategory, setSelectedCategory] = useState<string>("Overview");
  const [searchQuery, setSearchQuery] = useState("");

  // Whenever the drawer opens, reset category selection to Overview and clear search
  useEffect(() => {
    if (isOpen) {
      setSelectedCategory("Overview");
      setSearchQuery("");
    }
  }, [isOpen]);

  // Query general catalog for other categories (only when open)
  const catalogQuery = useQuery(
    api.dashboards.listAvailableWidgets,
    organizationId && isOpen
      ? {
          organizationId,
          category: selectedCategory === "All" ? undefined : selectedCategory,
        }
      : "skip",
  );
  const otherWidgets = useMemo(() => catalogQuery || [], [catalogQuery]);

  // Static preview maps for drawer catalog cards (Zero Live Database Queries)
  const emptyDataMap = useMemo(() => new Map<string, any>(), []);
  const menuDataMap = emptyDataMap;
  const cashierDataMap = emptyDataMap;
  const queueDataMap = emptyDataMap;
  const customerDataMap = emptyDataMap;
  const surveyDataMap = emptyDataMap;
  const overviewDataMap = emptyDataMap;

  // Static preview definitions for drawer cards
  const totalOrdersData = undefined;
  const liveOrdersData = undefined;
  const statusDistributionData = undefined;
  const highValueOrdersData = undefined;
  const delayedOrdersData = undefined;
  const ordersOverTimeData = undefined;
  const kdsLiveOrdersData = undefined;
  const kdsPendingTicketsData = undefined;
  const kdsStationQueueData = undefined;
  const kdsStatusBreakdownData = undefined;
  const kdsAvgPrepTimeData = undefined;
  const kdsDelayAlertsData = undefined;
  const wsOrderSummaryData = undefined;
  const wsOrdersByWsData = undefined;
  const wsActiveTasksData = undefined;
  const wsQueueData = undefined;
  const wsPrepTimeData = undefined;
  const wsDelayedOrdersData = undefined;
  const wsPerformanceData = undefined;
  const wsAvailabilityData = undefined;
  const capActiveOrdersData = undefined;
  const capTableServiceStatusData = undefined;
  const capAssignedTablesData = undefined;
  const capServiceTimeData = undefined;
  const capOrdersAwaitingServiceData = undefined;
  const capPerformanceSummaryData = undefined;
  const capOrderActivityData = undefined;
  const menuTopSellingData = undefined;
  const menuCategoriesData = undefined;
  const menuBestsellingData = undefined;
  const menuLowPerformingData = undefined;
  const menuAvailabilityData = undefined;
  const menuStockoutAlertsData = undefined;
  const menuModifierData = undefined;
  const menuPerformanceData = undefined;
  const cashierShiftSummaryData = undefined;
  const cashierTotalTxnsData = undefined;
  const cashierCashSalesData = undefined;
  const cashierDigitalSalesData = undefined;
  const cashierPaymentBreakdownData = undefined;
  const cashierRefundSummaryData = undefined;
  const cashierTxnHistoryData = undefined;
  const cashierOpenSessionsData = undefined;
  const queueLengthData = undefined;
  const queueWaitingCustomersData = undefined;
  const queueAvgWaitTimeData = undefined;
  const queueRecentCalloutsData = undefined;
  const queueStatusBreakdownData = undefined;
  const queueWaitTimeAlertsData = undefined;
  const customersTotalData = undefined;
  const customersNewData = undefined;
  const customersReturningData = undefined;
  const customersRecentData = undefined;
  const customersMostFrequentData = undefined;
  const customersOrderFrequencyData = undefined;
  const surveysResponseCountsData = undefined;
  const surveysAverageRatingData = undefined;
  const surveysRecentFeedbackData = undefined;
  const surveysSatisfactionTrendsData = undefined;
  const surveysLowRatingAlertsData = undefined;
  const surveysResponseRatesData = undefined;
  const ovNetRevenueData = undefined;
  const ovTotalOrdersData = undefined;
  const ovAovData = undefined;
  const ovActiveOrdersData = undefined;
  const ovPendingOrdersData = undefined;
  const ovSalesTrendsData = undefined;
  const ovOrderStatusData = undefined;
  const ovBusinessSummaryData = undefined;

  // Placements map for slot coordinate lookup
  const placedMap = useMemo(() => {
    const map = new Map<string, { gridRow: number; gridCol: number }>();
    for (const p of placements) {
      map.set(p.widgetId, { gridRow: p.gridRow, gridCol: p.gridCol });
    }
    return map;
  }, [placements]);

  // Filter 8 Overview widgets by search
  const filteredOverviewWidgets = useMemo(() => {
    if (!searchQuery.trim()) return OVERVIEW_CATALOG_WIDGETS;
    const q = searchQuery.toLowerCase();
    return OVERVIEW_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter 6 Orders widgets by search
  const filteredOrdersWidgets = useMemo(() => {
    if (!searchQuery.trim()) return ORDERS_CATALOG_WIDGETS;
    const q = searchQuery.toLowerCase();
    return ORDERS_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter 6 KDS widgets by search
  const filteredKdsWidgets = useMemo(() => {
    if (!searchQuery.trim()) return KDS_CATALOG_WIDGETS;
    const q = searchQuery.toLowerCase();
    return KDS_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter 8 Workstation widgets by search
  const filteredWorkstationWidgets = useMemo(() => {
    if (!searchQuery.trim()) return WORKSTATION_CATALOG_WIDGETS;
    const q = searchQuery.toLowerCase();
    return WORKSTATION_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter 7 Captain widgets by search
  const filteredCaptainWidgets = useMemo(() => {
    if (!searchQuery.trim()) return CAPTAIN_CATALOG_WIDGETS;
    const q = searchQuery.toLowerCase();
    return CAPTAIN_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter 8 Menu widgets by search
  const filteredMenuWidgets = useMemo(() => {
    if (!searchQuery.trim()) return MENU_CATALOG_WIDGETS;
    const q = searchQuery.toLowerCase();
    return MENU_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter 8 Cashier widgets by search
  const filteredCashierWidgets = useMemo(() => {
    if (!searchQuery.trim()) return CASHIER_CATALOG_WIDGETS;
    const q = searchQuery.toLowerCase();
    return CASHIER_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter 6 Queue widgets by search
  const filteredQueueWidgets = useMemo(() => {
    if (!searchQuery.trim()) return QUEUE_CATALOG_WIDGETS;
    const q = searchQuery.toLowerCase();
    return QUEUE_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter 6 Customer widgets by search
  const filteredCustomerWidgets = useMemo(() => {
    if (!searchQuery.trim()) return CUSTOMER_CATALOG_WIDGETS;
    const q = searchQuery.toLowerCase();
    return CUSTOMER_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter 6 Survey widgets by search
  const filteredSurveyWidgets = useMemo(() => {
    if (!searchQuery.trim()) return SURVEY_CATALOG_WIDGETS;
    const q = searchQuery.toLowerCase();
    return SURVEY_CATALOG_WIDGETS.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.categoryTrack.toLowerCase().includes(q) ||
        w.type.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter other module widgets
  const filteredOtherWidgets = useMemo(() => {
    if (!searchQuery.trim()) return otherWidgets;
    const q = searchQuery.toLowerCase();
    return otherWidgets.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q),
    );
  }, [otherWidgets, searchQuery]);

  const overviewPlacedCount = useMemo(() => {
    let count = 0;
    for (const w of OVERVIEW_CATALOG_WIDGETS) {
      if (placedWidgetIds.has(w.id)) count++;
    }
    return count;
  }, [placedWidgetIds]);

  const ordersPlacedCount = useMemo(() => {
    let count = 0;
    for (const w of ORDERS_CATALOG_WIDGETS) {
      if (
        placedWidgetIds.has(w.id) ||
        (w.altId && placedWidgetIds.has(w.altId)) ||
        (w.altId2 && placedWidgetIds.has(w.altId2))
      ) {
        count++;
      }
    }
    return count;
  }, [placedWidgetIds]);

  const kdsPlacedCount = useMemo(() => {
    let count = 0;
    for (const w of KDS_CATALOG_WIDGETS) {
      if (
        placedWidgetIds.has(w.id) ||
        (w.altId && placedWidgetIds.has(w.altId))
      ) {
        count++;
      }
    }
    return count;
  }, [placedWidgetIds]);

  const workstationPlacedCount = useMemo(() => {
    let count = 0;
    for (const w of WORKSTATION_CATALOG_WIDGETS) {
      if (placedWidgetIds.has(w.id)) count++;
    }
    return count;
  }, [placedWidgetIds]);

  const captainPlacedCount = useMemo(() => {
    let count = 0;
    for (const w of CAPTAIN_CATALOG_WIDGETS) {
      if (placedWidgetIds.has(w.id)) count++;
    }
    return count;
  }, [placedWidgetIds]);

  const menuPlacedCount = useMemo(() => {
    let count = 0;
    for (const w of MENU_CATALOG_WIDGETS) {
      if (placedWidgetIds.has(w.id)) count++;
    }
    return count;
  }, [placedWidgetIds]);

  const cashierPlacedCount = useMemo(() => {
    let count = 0;
    for (const w of CASHIER_CATALOG_WIDGETS) {
      if (placedWidgetIds.has(w.id)) count++;
    }
    return count;
  }, [placedWidgetIds]);

  const queuePlacedCount = useMemo(() => {
    let count = 0;
    for (const w of QUEUE_CATALOG_WIDGETS) {
      if (placedWidgetIds.has(w.id)) count++;
    }
    return count;
  }, [placedWidgetIds]);

  const customerPlacedCount = useMemo(() => {
    let count = 0;
    for (const w of CUSTOMER_CATALOG_WIDGETS) {
      if (placedWidgetIds.has(w.id)) count++;
    }
    return count;
  }, [placedWidgetIds]);

  const surveyPlacedCount = useMemo(() => {
    let count = 0;
    for (const w of SURVEY_CATALOG_WIDGETS) {
      if (placedWidgetIds.has(w.id)) count++;
    }
    return count;
  }, [placedWidgetIds]);

  const otherPlacedCount = useMemo(() => {
    return otherWidgets.filter((w) => placedWidgetIds.has(w.widgetId)).length;
  }, [otherWidgets, placedWidgetIds]);

  const currentModule = useMemo(() => {
    return (
      MODULE_CATEGORIES.find((m) => m.id === selectedCategory) || {
        id: selectedCategory,
        name: selectedCategory,
        icon: "widgets",
        count: otherWidgets.length,
        description: "Configure widgets for this operational station.",
      }
    );
  }, [selectedCategory, otherWidgets]);

  // Track whether the main PosShell sidebar is collapsed
  const [isMainSidebarCollapsed, setIsMainSidebarCollapsed] = useState(false);

  React.useEffect(() => {
    const updateSidebarState = () => {
      if (typeof window !== "undefined") {
        setIsMainSidebarCollapsed(
          localStorage.getItem("pos_main_sidebar_collapsed") === "true",
        );
      }
    };
    updateSidebarState();
    window.addEventListener("storage", updateSidebarState);
    const interval = setInterval(updateSidebarState, 500);
    return () => {
      window.removeEventListener("storage", updateSidebarState);
      clearInterval(interval);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop covering content area after the main sidebar */}
      <div
        onClick={onClose}
        className={`fixed inset-0 ${
          isMainSidebarCollapsed ? "lg:left-20" : "lg:left-64"
        } bg-stone-900/30 backdrop-blur-[1px] z-40 transition-all duration-300`}
      />

      {/* Slide-Over Drawer Container placed directly after the main sidebar */}
      <aside
        className={`fixed top-0 bottom-0 right-0 ${
          isMainSidebarCollapsed ? "lg:left-20" : "lg:left-64"
        } left-0 bg-[#fbf9f6] shadow-2xl z-40 flex flex-col overflow-hidden transition-all duration-300 animate-in slide-in-from-right`}
      >
        {/* Main Body: Two-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* ========================================================= */}
          {/* LEFT SIDEBAR: MODULES LIST (Compact w-52)                */}
          {/* ========================================================= */}
          <div className="w-52 bg-[#f8f5f1] border-r border-[#ece5de] flex flex-col shrink-0 overflow-y-auto py-5 select-none">
            <div className="px-4 pb-2.5">
              <span className="text-[11px] font-sans font-bold text-stone-400 tracking-wider uppercase">
                MODULES
              </span>
            </div>

            <nav className="flex flex-col">
              {MODULE_CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category.id;

                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setSearchQuery("");
                    }}
                    className={`w-full flex flex-col px-4 py-2 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#eae3da] text-stone-900 font-semibold"
                        : "text-stone-700 hover:bg-[#f1ebe3] hover:text-stone-900"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`material-symbols-outlined text-[18px] ${
                            isSelected ? "text-stone-900" : "text-stone-500"
                          }`}
                        >
                          {category.icon}
                        </span>
                        <span className="text-xs font-medium leading-none">
                          {category.name}
                        </span>
                      </div>

                      {/* Pill Badge */}
                      {isSelected ? (
                        <span className="bg-black text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {category.count}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400 font-normal">
                          {category.count}
                        </span>
                      )}
                    </div>

                    {/* Tag badge for KDS (Kitchen) */}
                    {category.tag && (
                      <div className="mt-1 pl-7">
                        <span className="bg-[#fde8dc] text-[#9c4419] text-[8.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider inline-block">
                          {category.tag}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </nav>

            {onResetDefaults && (
              <div className="mt-auto p-4 border-t border-[#ece5de]">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to reset your dashboard layout to default? Any custom widget arrangements will be replaced."
                      )
                    ) {
                      onResetDefaults();
                      onClose();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-stone-500 hover:text-stone-900 hover:bg-[#ece5de] rounded-lg transition-colors cursor-pointer"
                  title="Reset to factory default widgets layout"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    restart_alt
                  </span>
                  <span>Reset to Defaults</span>
                </button>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* RIGHT PANE: DEDICATED WIDGETS CANVAS                      */}
          {/* ========================================================= */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#fbf9f6]">
            {/* Header */}
            <header className="px-6 sm:px-8 pt-5 pb-3.5 bg-[#fbf9f6] flex flex-col gap-3 shrink-0 border-b border-[#eee7e0]">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#eee7e0] flex items-center justify-center text-stone-800 shadow-xs">
                      <span className="material-symbols-outlined text-[20px]">
                        {currentModule.icon}
                      </span>
                    </div>
                    <h1 className="font-serif text-2xl sm:text-3xl font-normal text-stone-900 tracking-tight">
                      {currentModule.name}
                    </h1>
                  </div>
                  <p className="font-sans text-xs sm:text-sm text-stone-500 max-w-2xl mt-0.5 leading-relaxed">
                    {currentModule.description}
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#f0eae3] hover:bg-[#e4ddd5] text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                  title="Close Drawer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    close
                  </span>
                </button>
              </div>

              {/* Search Bar & Available Pill */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-[17px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search within ${currentModule.name} widgets...`}
                    className="w-full bg-[#f0eae3] pl-9 pr-4 py-1.5 rounded-full text-stone-800 placeholder:text-stone-400 text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-stone-300 transition-all"
                  />
                </div>

                <div className="inline-flex items-center gap-2 bg-[#f0eae3] px-3 py-1 rounded-full self-start sm:self-auto shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-900" />
                  <span className="text-[10.5px] font-bold text-stone-800 uppercase tracking-wider">
                    {selectedCategory === "Overview"
                      ? "8 WIDGETS AVAILABLE"
                      : selectedCategory === "Orders"
                        ? "6 WIDGETS AVAILABLE"
                        : selectedCategory === "KDS"
                          ? "6 WIDGETS AVAILABLE"
                          : selectedCategory === "Workstation"
                            ? "8 WIDGETS AVAILABLE"
                            : selectedCategory === "Captain"
                              ? "7 WIDGETS AVAILABLE"
                              : selectedCategory === "Menu"
                                ? "8 WIDGETS AVAILABLE"
                                : selectedCategory === "Cashier"
                                  ? "8 WIDGETS AVAILABLE"
                                  : selectedCategory === "Queue"
                                    ? "6 WIDGETS AVAILABLE"
                                    : selectedCategory === "Customers"
                                      ? "6 WIDGETS AVAILABLE"
                                      : selectedCategory === "Surveys"
                                        ? "6 WIDGETS AVAILABLE"
                                        : `${otherWidgets.length} WIDGETS AVAILABLE`}
                  </span>
                  <span className="text-stone-400 text-xs">•</span>
                  <span className="text-[10.5px] font-medium text-stone-600">
                    {selectedCategory === "Overview"
                      ? overviewPlacedCount
                      : selectedCategory === "Orders"
                        ? ordersPlacedCount
                        : selectedCategory === "KDS"
                          ? kdsPlacedCount
                          : selectedCategory === "Workstation"
                            ? workstationPlacedCount
                            : selectedCategory === "Captain"
                              ? captainPlacedCount
                              : selectedCategory === "Menu"
                                ? menuPlacedCount
                                : selectedCategory === "Cashier"
                                  ? cashierPlacedCount
                                  : selectedCategory === "Queue"
                                    ? queuePlacedCount
                                    : selectedCategory === "Customers"
                                      ? customerPlacedCount
                                      : selectedCategory === "Surveys"
                                        ? surveyPlacedCount
                                        : otherPlacedCount}{" "}
                    on Dashboard
                  </span>
                </div>
              </div>
            </header>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
              {selectedCategory === "Overview" ? (
                /* ========================================================= */
                /* 8 PREST OVERVIEW WIDGETS (Matches User Design Exact)      */
                /* ========================================================= */
                filteredOverviewWidgets.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                      search_off
                    </span>
                    <p className="text-stone-600 font-medium">
                      No Overview widgets match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-stone-800 underline hover:text-black font-semibold cursor-pointer"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOverviewWidgets.map((w) =>
                      renderOverviewDrawerCard(
                        w,
                        placedWidgetIds.has(w.id),
                        placedMap.get(w.id),
                        () => onAddWidget(w.id, w.defaultWidth),
                        overviewDataMap.get(w.id),
                      ),
                    )}
                  </div>
                )
              ) : selectedCategory === "Orders" ? (
                /* ========================================================= */
                /* 6 PREST ORDERS WIDGETS (Matches User Design Exact)        */
                /* ========================================================= */
                filteredOrdersWidgets.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                      search_off
                    </span>
                    <p className="text-stone-600 font-medium">
                      No Orders widgets match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-stone-800 underline hover:text-black font-semibold"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Card 1: Total Orders */}
                    {filteredOrdersWidgets.some(
                      (w) => w.id === "orders_total_volume",
                    ) && (
                      <DrawerTotalOrdersCard
                        widget={ORDERS_CATALOG_WIDGETS[0]}
                        isPlaced={
                          placedWidgetIds.has("orders_total_volume") ||
                          placedWidgetIds.has("overview_total_orders")
                        }
                        placement={
                          placedMap.get("orders_total_volume") ||
                          placedMap.get("overview_total_orders")
                        }
                        onAdd={() => onAddWidget("orders_total_volume", 4)}
                        data={totalOrdersData}
                      />
                    )}

                    {/* Card 2: Live Orders Feed */}
                    {filteredOrdersWidgets.some(
                      (w) => w.id === "orders_live_feed",
                    ) && (
                      <DrawerLiveFeedCard
                        widget={ORDERS_CATALOG_WIDGETS[1]}
                        isPlaced={placedWidgetIds.has("orders_live_feed")}
                        placement={placedMap.get("orders_live_feed")}
                        onAdd={() => onAddWidget("orders_live_feed", 6)}
                        data={liveOrdersData}
                      />
                    )}

                    {/* Card 3: Order Status Breakdown */}
                    {filteredOrdersWidgets.some(
                      (w) => w.id === "orders_by_status",
                    ) && (
                      <DrawerStatusBreakdownCard
                        widget={ORDERS_CATALOG_WIDGETS[2]}
                        isPlaced={
                          placedWidgetIds.has("orders_by_status") ||
                          placedWidgetIds.has("orders_status_distribution") ||
                          placedWidgetIds.has(
                            "overview_order_status_distribution",
                          )
                        }
                        placement={
                          placedMap.get("orders_by_status") ||
                          placedMap.get("orders_status_distribution") ||
                          placedMap.get("overview_order_status_distribution")
                        }
                        onAdd={() => onAddWidget("orders_by_status", 6)}
                        data={statusDistributionData}
                      />
                    )}

                    {/* Card 4: Top Orders by Value */}
                    {filteredOrdersWidgets.some(
                      (w) => w.id === "orders_high_value",
                    ) && (
                      <DrawerHighValueCard
                        widget={ORDERS_CATALOG_WIDGETS[3]}
                        isPlaced={
                          placedWidgetIds.has("orders_high_value") ||
                          placedWidgetIds.has("orders_high_value_ledger")
                        }
                        placement={
                          placedMap.get("orders_high_value") ||
                          placedMap.get("orders_high_value_ledger")
                        }
                        onAdd={() => onAddWidget("orders_high_value", 6)}
                        data={highValueOrdersData}
                      />
                    )}

                    {/* Card 5: Delayed Orders Alert */}
                    {filteredOrdersWidgets.some(
                      (w) => w.id === "orders_delayed_alerts",
                    ) && (
                      <DrawerDelayedOrdersCard
                        widget={ORDERS_CATALOG_WIDGETS[4]}
                        isPlaced={
                          placedWidgetIds.has("orders_delayed_alerts") ||
                          placedWidgetIds.has("kds_delayed_orders_alert")
                        }
                        placement={
                          placedMap.get("orders_delayed_alerts") ||
                          placedMap.get("kds_delayed_orders_alert")
                        }
                        onAdd={() => onAddWidget("orders_delayed_alerts", 6)}
                        data={delayedOrdersData}
                      />
                    )}

                    {/* Card 6: Orders Over Time */}
                    {filteredOrdersWidgets.some(
                      (w) => w.id === "orders_volume_over_time",
                    ) && (
                      <DrawerVolumeOverTimeCard
                        widget={ORDERS_CATALOG_WIDGETS[5]}
                        isPlaced={
                          placedWidgetIds.has("orders_volume_over_time") ||
                          placedWidgetIds.has("reports_hourly_velocity")
                        }
                        placement={
                          placedMap.get("orders_volume_over_time") ||
                          placedMap.get("reports_hourly_velocity")
                        }
                        onAdd={() => onAddWidget("orders_volume_over_time", 6)}
                        data={ordersOverTimeData}
                      />
                    )}
                  </div>
                )
              ) : selectedCategory === "KDS" ? (
                /* ========================================================= */
                /* 6 PREST KDS WIDGETS (Matches User Design Exact)           */
                /* ========================================================= */
                filteredKdsWidgets.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                      search_off
                    </span>
                    <p className="text-stone-600 font-medium">
                      No KDS widgets match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-stone-800 underline hover:text-black font-semibold"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Card 1: Live Kitchen Orders */}
                    {filteredKdsWidgets.some(
                      (w) => w.id === "kds_live_orders",
                    ) && (
                      <DrawerKdsLiveOrdersCard
                        widget={KDS_CATALOG_WIDGETS[0]}
                        isPlaced={placedWidgetIds.has("kds_live_orders")}
                        placement={placedMap.get("kds_live_orders")}
                        onAdd={() => onAddWidget("kds_live_orders", 6)}
                        data={kdsLiveOrdersData}
                      />
                    )}

                    {/* Card 2: Pending Kitchen Orders */}
                    {filteredKdsWidgets.some(
                      (w) => w.id === "kds_pending_tickets",
                    ) && (
                      <DrawerKdsPendingTicketsCard
                        widget={KDS_CATALOG_WIDGETS[1]}
                        isPlaced={placedWidgetIds.has("kds_pending_tickets")}
                        placement={placedMap.get("kds_pending_tickets")}
                        onAdd={() => onAddWidget("kds_pending_tickets", 4)}
                        data={kdsPendingTicketsData}
                      />
                    )}

                    {/* Card 3: Specific KDS Station */}
                    {filteredKdsWidgets.some(
                      (w) => w.id === "kds_station_queue",
                    ) && (
                      <DrawerKdsStationQueueCard
                        widget={KDS_CATALOG_WIDGETS[2]}
                        isPlaced={placedWidgetIds.has("kds_station_queue")}
                        placement={placedMap.get("kds_station_queue")}
                        onAdd={() => onAddWidget("kds_station_queue", 4)}
                        data={kdsStationQueueData}
                      />
                    )}

                    {/* Card 4: Kitchen Order Status Breakdown */}
                    {filteredKdsWidgets.some(
                      (w) => w.id === "kds_status_breakdown",
                    ) && (
                      <DrawerKdsStatusBreakdownCard
                        widget={KDS_CATALOG_WIDGETS[3]}
                        isPlaced={placedWidgetIds.has("kds_status_breakdown")}
                        placement={placedMap.get("kds_status_breakdown")}
                        onAdd={() => onAddWidget("kds_status_breakdown", 6)}
                        data={kdsStatusBreakdownData}
                      />
                    )}

                    {/* Card 5: Average Kitchen Prep Time */}
                    {filteredKdsWidgets.some(
                      (w) => w.id === "kds_avg_prep_time",
                    ) && (
                      <DrawerKdsAvgPrepTimeCard
                        widget={KDS_CATALOG_WIDGETS[4]}
                        isPlaced={placedWidgetIds.has("kds_avg_prep_time")}
                        placement={placedMap.get("kds_avg_prep_time")}
                        onAdd={() => onAddWidget("kds_avg_prep_time", 4)}
                        data={kdsAvgPrepTimeData}
                      />
                    )}

                    {/* Card 6: Kitchen Delay Alerts */}
                    {filteredKdsWidgets.some(
                      (w) => w.id === "kds_delay_alerts",
                    ) && (
                      <DrawerKdsDelayAlertsCard
                        widget={KDS_CATALOG_WIDGETS[5]}
                        isPlaced={placedWidgetIds.has("kds_delay_alerts")}
                        placement={placedMap.get("kds_delay_alerts")}
                        onAdd={() => onAddWidget("kds_delay_alerts", 6)}
                        data={kdsDelayAlertsData}
                      />
                    )}
                  </div>
                )
              ) : selectedCategory === "Workstation" ? (
                /* ========================================================= */
                /* 8 PREST WORKSTATION WIDGETS                               */
                /* ========================================================= */
                filteredWorkstationWidgets.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                      search_off
                    </span>
                    <p className="text-stone-600 font-medium">
                      No Workstation widgets match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-stone-800 underline hover:text-black font-semibold"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Card 1: Order Summary */}
                    {filteredWorkstationWidgets.some(
                      (w) => w.id === "workstation_order_summary",
                    ) && (
                      <DrawerWorkstationOrderSummaryCard
                        widget={WORKSTATION_CATALOG_WIDGETS[0]}
                        isPlaced={placedWidgetIds.has(
                          "workstation_order_summary",
                        )}
                        placement={placedMap.get("workstation_order_summary")}
                        onAdd={() =>
                          onAddWidget("workstation_order_summary", 4)
                        }
                        data={wsOrderSummaryData}
                      />
                    )}
                    {/* Card 2: Orders by Workstation */}
                    {filteredWorkstationWidgets.some(
                      (w) => w.id === "workstation_orders_by_workstation",
                    ) && (
                      <DrawerWorkstationOrdersByWorkstationCard
                        widget={WORKSTATION_CATALOG_WIDGETS[1]}
                        isPlaced={placedWidgetIds.has(
                          "workstation_orders_by_workstation",
                        )}
                        placement={placedMap.get(
                          "workstation_orders_by_workstation",
                        )}
                        onAdd={() =>
                          onAddWidget("workstation_orders_by_workstation", 4)
                        }
                        data={wsOrdersByWsData}
                      />
                    )}
                    {/* Card 3: Active Tasks */}
                    {filteredWorkstationWidgets.some(
                      (w) => w.id === "workstation_active_tasks",
                    ) && (
                      <DrawerWorkstationActiveTasksCard
                        widget={WORKSTATION_CATALOG_WIDGETS[2]}
                        isPlaced={placedWidgetIds.has(
                          "workstation_active_tasks",
                        )}
                        placement={placedMap.get("workstation_active_tasks")}
                        onAdd={() => onAddWidget("workstation_active_tasks", 4)}
                        data={wsActiveTasksData}
                      />
                    )}
                    {/* Card 4: Workstation Queue */}
                    {filteredWorkstationWidgets.some(
                      (w) => w.id === "workstation_queue",
                    ) && (
                      <DrawerWorkstationQueueCard
                        widget={WORKSTATION_CATALOG_WIDGETS[3]}
                        isPlaced={placedWidgetIds.has("workstation_queue")}
                        placement={placedMap.get("workstation_queue")}
                        onAdd={() => onAddWidget("workstation_queue", 4)}
                        data={wsQueueData}
                      />
                    )}
                    {/* Card 5: Preparation Time */}
                    {filteredWorkstationWidgets.some(
                      (w) => w.id === "workstation_prep_time",
                    ) && (
                      <DrawerWorkstationPrepTimeCard
                        widget={WORKSTATION_CATALOG_WIDGETS[4]}
                        isPlaced={placedWidgetIds.has("workstation_prep_time")}
                        placement={placedMap.get("workstation_prep_time")}
                        onAdd={() => onAddWidget("workstation_prep_time", 4)}
                        data={wsPrepTimeData}
                      />
                    )}
                    {/* Card 6: Delayed Orders */}
                    {filteredWorkstationWidgets.some(
                      (w) => w.id === "workstation_delayed_orders",
                    ) && (
                      <DrawerWorkstationDelayedOrdersCard
                        widget={WORKSTATION_CATALOG_WIDGETS[5]}
                        isPlaced={placedWidgetIds.has(
                          "workstation_delayed_orders",
                        )}
                        placement={placedMap.get("workstation_delayed_orders")}
                        onAdd={() =>
                          onAddWidget("workstation_delayed_orders", 4)
                        }
                        data={wsDelayedOrdersData}
                      />
                    )}
                    {/* Card 7: Workstation Performance */}
                    {filteredWorkstationWidgets.some(
                      (w) => w.id === "workstation_performance",
                    ) && (
                      <DrawerWorkstationPerformanceCard
                        widget={WORKSTATION_CATALOG_WIDGETS[6]}
                        isPlaced={placedWidgetIds.has(
                          "workstation_performance",
                        )}
                        placement={placedMap.get("workstation_performance")}
                        onAdd={() => onAddWidget("workstation_performance", 4)}
                        data={wsPerformanceData}
                      />
                    )}
                    {/* Card 8: Workstation Availability */}
                    {filteredWorkstationWidgets.some(
                      (w) => w.id === "workstation_availability",
                    ) && (
                      <DrawerWorkstationAvailabilityCard
                        widget={WORKSTATION_CATALOG_WIDGETS[7]}
                        isPlaced={placedWidgetIds.has(
                          "workstation_availability",
                        )}
                        placement={placedMap.get("workstation_availability")}
                        onAdd={() => onAddWidget("workstation_availability", 4)}
                        data={wsAvailabilityData}
                      />
                    )}
                  </div>
                )
              ) : selectedCategory === "Captain" ? (
                /* ========================================================= */
                /* 7 PREST CAPTAIN WIDGETS                                   */
                /* ========================================================= */
                filteredCaptainWidgets.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                      search_off
                    </span>
                    <p className="text-stone-600 font-medium">
                      No Captain widgets match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-stone-800 underline hover:text-black font-semibold"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Card 1: Active Orders by Captain */}
                    {filteredCaptainWidgets.some(
                      (w) => w.id === "captain_active_orders",
                    ) && (
                      <DrawerCaptainActiveOrdersCard
                        widget={CAPTAIN_CATALOG_WIDGETS[0]}
                        isPlaced={placedWidgetIds.has("captain_active_orders")}
                        placement={placedMap.get("captain_active_orders")}
                        onAdd={() => onAddWidget("captain_active_orders", 4)}
                        data={capActiveOrdersData}
                      />
                    )}
                    {/* Card 2: Table Service Status */}
                    {filteredCaptainWidgets.some(
                      (w) => w.id === "captain_table_service_status",
                    ) && (
                      <DrawerCaptainTableServiceStatusCard
                        widget={CAPTAIN_CATALOG_WIDGETS[1]}
                        isPlaced={placedWidgetIds.has(
                          "captain_table_service_status",
                        )}
                        placement={placedMap.get(
                          "captain_table_service_status",
                        )}
                        onAdd={() =>
                          onAddWidget("captain_table_service_status", 4)
                        }
                        data={capTableServiceStatusData}
                      />
                    )}
                    {/* Card 3: Assigned Tables */}
                    {filteredCaptainWidgets.some(
                      (w) => w.id === "captain_assigned_tables",
                    ) && (
                      <DrawerCaptainAssignedTablesCard
                        widget={CAPTAIN_CATALOG_WIDGETS[2]}
                        isPlaced={placedWidgetIds.has(
                          "captain_assigned_tables",
                        )}
                        placement={placedMap.get("captain_assigned_tables")}
                        onAdd={() => onAddWidget("captain_assigned_tables", 4)}
                        data={capAssignedTablesData}
                      />
                    )}
                    {/* Card 4: Service Time */}
                    {filteredCaptainWidgets.some(
                      (w) => w.id === "captain_service_time",
                    ) && (
                      <DrawerCaptainServiceTimeCard
                        widget={CAPTAIN_CATALOG_WIDGETS[3]}
                        isPlaced={placedWidgetIds.has("captain_service_time")}
                        placement={placedMap.get("captain_service_time")}
                        onAdd={() => onAddWidget("captain_service_time", 4)}
                        data={capServiceTimeData}
                      />
                    )}
                    {/* Card 5: Orders Awaiting Service */}
                    {filteredCaptainWidgets.some(
                      (w) => w.id === "captain_orders_awaiting_service",
                    ) && (
                      <DrawerCaptainOrdersAwaitingServiceCard
                        widget={CAPTAIN_CATALOG_WIDGETS[4]}
                        isPlaced={placedWidgetIds.has(
                          "captain_orders_awaiting_service",
                        )}
                        placement={placedMap.get(
                          "captain_orders_awaiting_service",
                        )}
                        onAdd={() =>
                          onAddWidget("captain_orders_awaiting_service", 4)
                        }
                        data={capOrdersAwaitingServiceData}
                      />
                    )}
                    {/* Card 6: Captain Performance Summary */}
                    {filteredCaptainWidgets.some(
                      (w) => w.id === "captain_performance_summary",
                    ) && (
                      <DrawerCaptainPerformanceSummaryCard
                        widget={CAPTAIN_CATALOG_WIDGETS[5]}
                        isPlaced={placedWidgetIds.has(
                          "captain_performance_summary",
                        )}
                        placement={placedMap.get("captain_performance_summary")}
                        onAdd={() =>
                          onAddWidget("captain_performance_summary", 4)
                        }
                        data={capPerformanceSummaryData}
                      />
                    )}
                    {/* Card 7: Captain Order Activity */}
                    {filteredCaptainWidgets.some(
                      (w) => w.id === "captain_order_activity",
                    ) && (
                      <DrawerCaptainOrderActivityCard
                        widget={CAPTAIN_CATALOG_WIDGETS[6]}
                        isPlaced={placedWidgetIds.has("captain_order_activity")}
                        placement={placedMap.get("captain_order_activity")}
                        onAdd={() => onAddWidget("captain_order_activity", 12)}
                        data={capOrderActivityData}
                      />
                    )}
                  </div>
                )
              ) : selectedCategory === "Menu" ? (
                /* ========================================================= */
                /* 8 PREST MENU WIDGETS                                      */
                /* ========================================================= */
                filteredMenuWidgets.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                      search_off
                    </span>
                    <p className="text-stone-600 font-medium">
                      No Menu widgets match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-stone-800 underline hover:text-black font-semibold"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMenuWidgets.map((w) =>
                      renderMenuDrawerCard(
                        w,
                        placedWidgetIds.has(w.id),
                        placedMap.get(w.id),
                        () => onAddWidget(w.id, w.defaultWidth),
                        menuDataMap.get(w.id),
                      ),
                    )}
                  </div>
                )
              ) : selectedCategory === "Cashier" ? (
                /* ========================================================= */
                /* 8 PREST CASHIER WIDGETS                                   */
                /* ========================================================= */
                filteredCashierWidgets.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                      search_off
                    </span>
                    <p className="text-stone-600 font-medium">
                      No Cashier widgets match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-stone-800 underline hover:text-black font-semibold"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCashierWidgets.map((w) =>
                      renderCashierDrawerCard(
                        w,
                        placedWidgetIds.has(w.id),
                        placedMap.get(w.id),
                        () => onAddWidget(w.id, w.defaultWidth),
                        cashierDataMap.get(w.id),
                      ),
                    )}
                  </div>
                )
              ) : selectedCategory === "Queue" ? (
                /* ========================================================= */
                /* 6 PREST QUEUE WIDGETS (Matches User Design Exact)         */
                /* ========================================================= */
                filteredQueueWidgets.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                      search_off
                    </span>
                    <p className="text-stone-600 font-medium">
                      No Queue widgets match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-stone-800 underline hover:text-black font-semibold"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredQueueWidgets.map((w) =>
                      renderQueueDrawerCard({
                        widget: w,
                        isPlaced: placedWidgetIds.has(w.id),
                        placement: placedMap.get(w.id),
                        onAdd: () => onAddWidget(w.id, w.defaultWidth),
                        data: queueDataMap.get(w.id),
                      }),
                    )}
                  </div>
                )
              ) : selectedCategory === "Customers" ? (
                /* ========================================================= */
                /* 6 PREST CUSTOMER WIDGETS (Matches User Design Exact)      */
                /* ========================================================= */
                filteredCustomerWidgets.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                      search_off
                    </span>
                    <p className="text-stone-600 font-medium">
                      No Customer widgets match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-stone-800 underline hover:text-black font-semibold"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCustomerWidgets.map((w) =>
                      renderCustomerDrawerCard({
                        widget: w,
                        isPlaced: placedWidgetIds.has(w.id),
                        placement: placedMap.get(w.id),
                        onAdd: () => onAddWidget(w.id, w.defaultWidth),
                        data: customerDataMap.get(w.id),
                      }),
                    )}
                  </div>
                )
              ) : selectedCategory === "Surveys" ? (
                /* ========================================================= */
                /* 6 PREST SURVEY WIDGETS (Matches User Design Exact)        */
                /* ========================================================= */
                filteredSurveyWidgets.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                      search_off
                    </span>
                    <p className="text-stone-600 font-medium">
                      No Survey widgets match &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearchQuery("")}
                      className="mt-3 text-xs text-stone-800 underline hover:text-black font-semibold"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSurveyWidgets.map((w) =>
                      renderSurveyDrawerCard({
                        widget: w,
                        isPlaced: placedWidgetIds.has(w.id),
                        placement: placedMap.get(w.id),
                        onAdd: () => onAddWidget(w.id, w.defaultWidth),
                        data: surveyDataMap.get(w.id),
                      }),
                    )}
                  </div>
                )
              ) : /* ========================================================= */
              /* OTHER MODULES VIEW (Overview, KDS, Cashier, etc.)         */
              /* ========================================================= */
              filteredOtherWidgets.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-4xl text-stone-400 mb-2">
                    inventory_2
                  </span>
                  <p className="text-stone-600 font-medium">
                    No widgets available for &ldquo;{currentModule.name}&rdquo;
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOtherWidgets.map((widget) => {
                    const isPlaced = placedWidgetIds.has(widget.widgetId);
                    const defaultW = widget.defaultDimensions?.width || 4;
                    const placement = placedMap.get(widget.widgetId);

                    return (
                      <article
                        key={widget.widgetId}
                        className="bg-white rounded-xl p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                                {widget.subcategory || widget.category}
                              </span>
                              <h3 className="font-serif text-lg text-stone-900 font-normal mt-0.5">
                                {widget.name}
                              </h3>
                            </div>
                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                              {widget.widgetType}
                            </span>
                          </div>

                          <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
                            {widget.description}
                          </p>

                          <div className="bg-[#fcf8f5] rounded-lg p-3 flex items-center justify-between border border-[#f3ede6]">
                            <div className="flex items-center gap-2 text-stone-700">
                              <span className="material-symbols-outlined text-[17px] text-stone-500">
                                {currentModule.icon}
                              </span>
                              <span className="text-xs font-medium">
                                Default: {defaultW} Cols
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-400 font-mono">
                              Live Telemetry
                            </span>
                          </div>
                        </div>

                        <div className="pt-4 flex items-center justify-between">
                          <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
                            {isPlaced && placement
                              ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
                              : `SIZE: ${defaultW} COLS`}
                          </span>
                          {isPlaced ? (
                            <button
                              disabled
                              className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3.5 py-1.5 rounded-full cursor-default shadow-xs"
                            >
                              <span>Added</span>
                              <span className="material-symbols-outlined text-[15px]">
                                check
                              </span>
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                onAddWidget(widget.widgetId, defaultW)
                              }
                              className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                add
                              </span>
                              <span>Add Widget</span>
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drawer Sticky Footer */}
            <footer className="px-6 sm:px-8 py-3.5 bg-[#fbf9f6] flex items-center justify-between shrink-0 shadow-sm border-t border-[#eee7e0]">
              <div className="flex items-center gap-3">
                <span className="text-xs sm:text-sm text-stone-600">
                  Showing{" "}
                  <strong className="text-stone-900 font-semibold">
                    {selectedCategory === "Overview"
                      ? filteredOverviewWidgets.length
                      : selectedCategory === "Orders"
                        ? filteredOrdersWidgets.length
                        : selectedCategory === "KDS"
                          ? filteredKdsWidgets.length
                          : selectedCategory === "Workstation"
                            ? filteredWorkstationWidgets.length
                            : selectedCategory === "Captain"
                              ? filteredCaptainWidgets.length
                              : selectedCategory === "Menu"
                                ? filteredMenuWidgets.length
                                : selectedCategory === "Cashier"
                                  ? filteredCashierWidgets.length
                                  : selectedCategory === "Queue"
                                    ? filteredQueueWidgets.length
                                    : selectedCategory === "Customers"
                                      ? filteredCustomerWidgets.length
                                      : selectedCategory === "Surveys"
                                        ? filteredSurveyWidgets.length
                                        : filteredOtherWidgets.length}{" "}
                    widgets
                  </strong>
                </span>
                <span className="text-stone-400">·</span>
                <span className="text-xs text-stone-500">
                  {selectedCategory === "Overview"
                    ? overviewPlacedCount
                    : selectedCategory === "Orders"
                      ? ordersPlacedCount
                      : selectedCategory === "KDS"
                        ? kdsPlacedCount
                        : selectedCategory === "Workstation"
                          ? workstationPlacedCount
                          : selectedCategory === "Captain"
                            ? captainPlacedCount
                            : selectedCategory === "Menu"
                              ? menuPlacedCount
                              : selectedCategory === "Cashier"
                                ? cashierPlacedCount
                                : selectedCategory === "Queue"
                                  ? queuePlacedCount
                                  : selectedCategory === "Customers"
                                    ? customerPlacedCount
                                    : selectedCategory === "Surveys"
                                      ? surveyPlacedCount
                                      : otherPlacedCount}{" "}
                  placed on current dashboard view
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  onClick={onClose}
                  className="bg-black hover:bg-stone-800 text-white px-5 py-1.5 rounded-full text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    check
                  </span>
                  <span>Done Adding</span>
                </button>
              </div>
            </footer>
          </div>
        </div>
      </aside>
    </>
  );
}

// ==========================================
// DRAWER CARD COMPONENTS FOR 6 ORDERS WIDGETS
// ==========================================

function formatCleanDelta(delta?: string): string {
  if (!delta) return "+0.0%";
  const match = delta.match(/^[+-]?\d+(?:\.\d+)?%/);
  if (match) return match[0];
  return delta.replace(/\s*vs\s+.*$/i, "").trim();
}

function DrawerTotalOrdersCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const count =
    data?.kpi?.value !== undefined && data.kpi.value !== null
      ? data.kpi.value
      : 0;
  const delta =
    data?.kpi?.deltaLabel ||
    (data?.kpi?.deltaPercent !== undefined
      ? `${data.kpi.deltaPercent >= 0 ? "+" : ""}${data.kpi.deltaPercent}%`
      : "+0.0%");
  const cleanDelta = formatCleanDelta(delta);
  const dineInCount =
    data?.summary?.dineIn ??
    data?.kpi?.secondaryMetrics?.find((m: any) =>
      String(m.label || "").toLowerCase().includes("dine"),
    )?.value ??
    0;
  const digitalCount =
    data?.summary?.digital ??
    (Number(
      data?.kpi?.secondaryMetrics?.find((m: any) =>
        String(m.label || "").toLowerCase().includes("takeaway"),
      )?.value || 0,
    ) +
      Number(
        data?.kpi?.secondaryMetrics?.find((m: any) =>
          String(m.label || "").toLowerCase().includes("delivery"),
        )?.value || 0,
      ));

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        {/* Visual Inset Preview */}
        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2.5 border border-[#f3ede6]">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-serif text-2xl sm:text-3xl text-stone-900 font-normal tracking-tight">
                {count}
              </span>
              <span className="text-xs font-sans text-stone-500 font-normal">
                Tkts
              </span>
            </div>
            <div className="inline-flex items-center gap-1 bg-[#ede6df] px-2 py-0.5 rounded-full text-[11px] font-semibold text-stone-800 shrink-0 whitespace-nowrap">
              <span className="material-symbols-outlined text-[13px]">
                trending_up
              </span>
              <span>{cleanDelta}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <span className="bg-white px-2.5 py-1 rounded text-[11px] font-medium text-stone-700 shadow-xs border border-stone-100 whitespace-nowrap shrink-0">
              {dineInCount} Dine-In
            </span>
            <span className="text-stone-300 text-xs">/</span>
            <span className="bg-white px-2.5 py-1 rounded text-[11px] font-medium text-stone-700 shadow-xs border border-stone-100 whitespace-nowrap shrink-0">
              {digitalCount} Digital
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DrawerLiveFeedCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const feedItems =
    data?.liveFeed?.items && data.liveFeed.items.length > 0
      ? data.liveFeed.items.slice(0, 3)
      : data?.table?.rows && data.table.rows.length > 0
        ? data.table.rows.slice(0, 3).map((r: any) => ({
            id: r.id || r._id,
            title:
              r.orderNumber ||
              r.orderNum ||
              r.ticket ||
              (r.id ? `#ORD-${String(r.id).slice(-4)}` : "#ORD-001"),
            subtitle: r.label || r.customer || "Dine-In",
            badge: { text: r.status || "Live" },
            timeAgo: r.time || r.elapsed || "now",
          }))
        : [];

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        {/* Visual Inset Preview */}
        {feedItems.length === 0 ? (
          <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col items-center justify-center min-h-[96px] text-center border border-[#f3ede6]">
            <span className="material-symbols-outlined text-stone-400 text-xl mb-1">
              receipt_long
            </span>
            <span className="text-xs font-medium text-stone-700">
              No incoming orders in this timeframe
            </span>
            <span className="text-[10px] text-stone-400">
              Live order feed updates dynamically
            </span>
          </div>
        ) : (
          <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-2 border border-[#f3ede6]">
            {feedItems.map((item: any, idx: number) => {
              const badgeBg =
                item.badge?.text === "Transit"
                  ? "bg-[#e8ded6] text-stone-800"
                  : "bg-[#eee8e2] text-stone-800";

              return (
                <div
                  key={item.id || idx}
                  className="bg-white rounded-md px-2.5 py-1.5 flex items-center justify-between border border-stone-100 shadow-xs gap-1.5 min-w-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-900 shrink-0" />
                    <span className="text-[11px] font-bold text-stone-900 truncate max-w-[110px] sm:max-w-[130px] shrink-0">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-stone-500 truncate min-w-0">
                      {item.subtitle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${badgeBg}`}
                    >
                      {item.badge?.text || "Cooking"}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono shrink-0 whitespace-nowrap">
                      {item.timeAgo || "now"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DrawerStatusBreakdownCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const chartItems: Array<{ label: string; value: number; color?: string }> =
    data?.chart?.data || [];
  const total = Number(
    data?.chart?.totalValue ??
    data?.kpi?.value ??
    chartItems.reduce((sum, item) => sum + Number(item.value || 0), 0)
  ) || 0;

  const defaultPalette = [
    "#262626", // Accepted
    "#EA9C1B", // In progress
    "#FC8019", // Ready to deliver
    "#219653", // Delivered
    "#7c604f", // Created
    "#8b5cf6", // Modify
    "#ef4444", // Reject
  ];

  // Dynamic segments for SVG Donut
  let cumulative = 0;
  const segments =
    total > 0
      ? chartItems
          .filter((d) => Number(d.value) > 0)
          .map((d, idx) => {
            const pct = Math.round((Number(d.value) / total) * 100);
            const offset = cumulative;
            cumulative += pct;
            return {
              label: d.label,
              value: Number(d.value),
              color: d.color || defaultPalette[idx % defaultPalette.length],
              pct,
              offset,
            };
          })
      : [];

  const displayItems =
    chartItems.length > 0
      ? [
          ...chartItems.filter((d) => Number(d.value) > 0),
          ...chartItems.filter((d) => Number(d.value) === 0),
        ].slice(0, 4)
      : [
          { label: "Accepted", value: 0, color: "#262626" },
          { label: "In progress", value: 0, color: "#EA9C1B" },
          { label: "Ready to deliver", value: 0, color: "#FC8019" },
          { label: "Delivered", value: 0, color: "#219653" },
        ];

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        {/* Visual Inset Preview: Dynamic Donut Chart with Process Legend from Settings */}
        <div className="bg-[#fcf8f5] rounded-lg p-2.5 sm:p-3 flex items-center justify-between gap-2.5 border border-[#f3ede6]">
          {/* Donut Chart: 72x72 */}
          <div className="relative w-[72px] h-[72px] shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              {/* Background ring */}
              <circle
                cx="18"
                cy="18"
                fill="none"
                r="14"
                pathLength="100"
                stroke="#f0ece6"
                strokeWidth="4.5"
              />
              {total > 0 &&
                segments.map((s, idx) => (
                  <circle
                    key={idx}
                    cx="18"
                    cy="18"
                    fill="none"
                    r="14"
                    pathLength="100"
                    stroke={s.color}
                    strokeDasharray={`${s.pct} 100`}
                    strokeDashoffset={-s.offset}
                    strokeWidth="4.5"
                  />
                ))}
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="font-serif text-base text-stone-900 font-normal leading-none">
                {total}
              </span>
              <span className="text-[8px] font-sans text-stone-400 uppercase tracking-wider mt-0.5">
                TOTAL
              </span>
            </div>
          </div>

          {/* Legend list */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {displayItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-[11px] gap-1"
              >
                <span className="flex items-center gap-1.5 text-stone-700 truncate">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        item.color || defaultPalette[idx % defaultPalette.length],
                    }}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="font-semibold text-stone-900 font-mono shrink-0 whitespace-nowrap ml-1">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DrawerHighValueCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const rows =
    data?.table?.rows && data.table.rows.length > 0
      ? data.table.rows.slice(0, 3)
      : [];

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        {/* Visual Inset Preview */}
        {rows.length === 0 ? (
          <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col items-center justify-center min-h-[96px] text-center border border-[#f3ede6]">
            <span className="material-symbols-outlined text-stone-400 text-xl mb-1">
              payments
            </span>
            <span className="text-xs font-medium text-stone-700">
              No high-value orders in this timeframe
            </span>
            <span className="text-[10px] text-stone-400">
              Orders exceeding ₹1,000 appear here
            </span>
          </div>
        ) : (
          <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-2 border border-[#f3ede6]">
            {rows.map((row: any, idx: number) => (
              <div
                key={idx}
                className="bg-white rounded-md p-2 flex flex-col gap-1 border border-stone-100 shadow-xs min-w-0"
              >
                {/* Line 1: Order # on left, Amount on right - Never Collide */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[11px] font-bold text-stone-900 truncate">
                    {row.orderNumber ||
                      row.orderNum ||
                      row.ticket ||
                      `#ORD-${String(row.id || "").slice(-4)}`}
                  </span>
                  <span className="text-[11px] font-bold text-stone-900 font-mono shrink-0 whitespace-nowrap">
                    {row.amount || "₹0.00"}
                  </span>
                </div>
                {/* Line 2: Patron / Channel on left, Status badge on right */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[10px] text-stone-500 truncate">
                    {row.label || row.customer || "Dine-In"}
                  </span>
                  <span
                    className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${row.statusBg || "bg-[#eee8e2] text-stone-800"}`}
                  >
                    {row.status || "Paid"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DrawerDelayedOrdersCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const delayedCount = data?.alert?.count ?? data?.table?.rows?.length ?? 0;
  const delayedOrder =
    data?.alert?.delayedOrders?.[0] ||
    data?.table?.rows?.[0] ||
    data?.alert?.items?.[0];

  const hasDelayedOrders = delayedCount > 0 && Boolean(delayedOrder && (delayedOrder.orderNumber || delayedOrder.orderNum || delayedOrder.ticket));

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        {/* Visual Inset Preview */}
        <div className="bg-[#fcf8f5] rounded-lg p-2.5 border border-[#f3ede6]">
          {!hasDelayedOrders ? (
            <div className="bg-[#f0f9f1] border border-[#cbe8cf] rounded-md p-2.5 flex flex-col items-center justify-center gap-1 text-center">
              <span className="material-symbols-outlined text-[#256334] text-xl">
                check_circle
              </span>
              <span className="text-xs font-bold text-[#256334]">
                All Orders Within SLA Target
              </span>
              <span className="text-[10px] text-stone-500">
                0 delayed kitchen or dispatch orders
              </span>
            </div>
          ) : (
            <div className="bg-[#fff4f2] border border-[#fed7d2] rounded-md p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-[#b3261e] min-w-0">
                  <span className="material-symbols-outlined text-[15px] shrink-0">
                    warning
                  </span>
                  <span className="text-xs font-bold truncate">
                    Order Exceeding Target
                  </span>
                </div>
                <span className="bg-white/90 text-[#b3261e] text-[9.5px] font-bold px-1.5 py-0.5 rounded-full border border-[#fec5bd] shrink-0 whitespace-nowrap">
                  {delayedOrder?.delay || "+15m Over"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs font-semibold text-stone-900">
                  {delayedOrder?.orderNumber || delayedOrder?.orderNum || delayedOrder?.ticket || "Delayed Ticket"} •{" "}
                  {delayedOrder?.label || "Kitchen Pass"}
                </span>
                <span className="text-[10.5px] text-stone-500 font-mono">
                  {delayedOrder?.elapsed || "delayed"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10.5px] text-stone-600 pt-0.5">
                <span className="material-symbols-outlined text-[13px] shrink-0">
                  soup_kitchen
                </span>
                <span className="truncate">
                  {delayedOrder?.note ||
                    "Kitchen station SLA threshold exceeded"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DrawerVolumeOverTimeCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const chartData = data?.chart?.data || [];
  const maxVal = Math.max(
    ...chartData.map((d: any) => Number(d.value) || 0),
    0,
  );
  let selectedItems = chartData;
  if (chartData.length > 0) {
    const activeIndices = chartData
      .map((d: any, idx: number) => (Number(d.value) > 0 ? idx : -1))
      .filter((idx: number) => idx !== -1);

    if (activeIndices.length > 0) {
      const firstActive = Math.min(...activeIndices);
      const lastActive = Math.max(...activeIndices);
      let startIdx = Math.max(0, firstActive - 1);
      let endIdx = Math.min(chartData.length, lastActive + 2);
      if (endIdx - startIdx < 7) {
        const needed = 7 - (endIdx - startIdx);
        startIdx = Math.max(0, startIdx - Math.ceil(needed / 2));
        endIdx = Math.min(chartData.length, startIdx + 7);
        startIdx = Math.max(0, endIdx - 7);
      }
      selectedItems = chartData.slice(startIdx, endIdx);
    } else {
      // Default to daytime service window (9a to 5p)
      selectedItems = chartData.slice(0, 9);
    }
  }

  const hours =
    selectedItems.length > 0
      ? selectedItems.map((d: any) => {
          const val = Number(d.value) || 0;
          const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
          return {
            label: d.label,
            height: `${Math.max(pct, val > 0 ? 15 : 0)}%`,
            isPeak: val === maxVal && maxVal > 0,
            value: val,
          };
        })
      : [
          { label: "10a", height: "0%", isPeak: false, value: 0 },
          { label: "12p", height: "0%", isPeak: false, value: 0 },
          { label: "2p", height: "0%", isPeak: false, value: 0 },
          { label: "4p", height: "0%", isPeak: false, value: 0 },
          { label: "6p", height: "0%", isPeak: false, value: 0 },
          { label: "8p", height: "0%", isPeak: false, value: 0 },
          { label: "10p", height: "0%", isPeak: false, value: 0 },
        ];

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        {/* Visual Inset Preview: Bar Histogram */}
        <div className="bg-[#fcf8f5] rounded-lg p-2.5 sm:p-3 flex flex-col justify-between border border-[#f3ede6] overflow-hidden">
          <div className="flex items-end justify-between h-18 px-0.5 gap-1 w-full overflow-hidden">
            {hours.map((h: any, i: number) => {
              const cleanLabel = String(h.label || "").replace(/^0/, "");
              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 flex-1 min-w-0 h-full justify-end group/bar overflow-hidden"
                >
                  <div
                    className={`w-full rounded-t-sm transition-all ${
                      h.isPeak
                        ? "bg-stone-900"
                        : "bg-[#ded6ce] group-hover/bar:bg-stone-900"
                    }`}
                    style={{ height: h.height }}
                  />
                  <span
                    className={`text-[8px] sm:text-[9px] font-sans truncate text-center w-full block ${
                      h.isPeak ? "text-stone-900 font-bold" : "text-stone-400"
                    }`}
                    title={cleanLabel}
                  >
                    {cleanLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-stone-600 pt-2 border-t border-stone-200/50 mt-1 gap-1">
            <span className="text-[11px] truncate">Service Velocity</span>
            <span className="font-semibold text-stone-900 text-xs shrink-0 whitespace-nowrap">
              {maxVal > 0 ? `${maxVal} ${maxVal === 1 ? "tkt" : "tkts"}/peak` : "0 tkts/hr"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "SIZE: 1×1 SQUARE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

// ==========================================
// DRAWER CARD COMPONENTS FOR 6 KDS WIDGETS
// ==========================================

function DrawerKdsLiveOrdersCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const summary = data?.summary || {};
  const capacityPercent =
    typeof summary.capacityPercent === "number" ? summary.capacityPercent : 0;
  const inPrepCount =
    typeof summary.inPrepCount === "number"
      ? summary.inPrepCount
      : data?.kpi?.value || 0;
  const atPassCount =
    typeof summary.atPassCount === "number" ? summary.atPassCount : 0;

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2.5 border border-[#f3ede6]">
          <div className="flex items-center justify-between text-stone-900">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-600">
              Workstation Traffic
            </span>
            <span className="text-xs font-semibold">
              {capacityPercent > 0
                ? `${capacityPercent}% Capacity`
                : "Normal Pace"}
            </span>
          </div>

          <div className="w-full h-1.5 bg-[#eae2d9] rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-900 rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(4, Math.min(100, capacityPercent))}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-white p-2 rounded-lg flex flex-col border border-stone-100">
              <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                In Prep
              </span>
              <span className="font-serif text-xl text-stone-900 mt-0.5 font-normal">
                {String(inPrepCount).padStart(2, "0")}
              </span>
              <span className="text-[10.5px] text-stone-400">
                Active tickets
              </span>
            </div>
            <div className="bg-white p-2 rounded-lg flex flex-col border border-stone-100">
              <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                At Pass
              </span>
              <span className="font-serif text-xl text-stone-900 mt-0.5 font-normal">
                {String(atPassCount).padStart(2, "0")}
              </span>
              <span className="text-[10.5px] text-stone-400">
                Ready to serve
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "LAYOUT: 2×2 SLATE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DrawerKdsPendingTicketsCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const summary = data?.summary || {};
  const pendingCount =
    typeof summary.pendingCount === "number"
      ? summary.pendingCount
      : data?.kpi?.value || 0;
  const oldestElapsed = summary.oldestElapsed || "--";
  const attentionRequired = summary.statusTag === "Attention";

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col justify-between gap-3 border border-[#f3ede6]">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-serif text-3xl sm:text-4xl text-stone-900 font-normal leading-none">
                {pendingCount}
              </span>
              <p className="text-[10.5px] uppercase tracking-wider font-semibold text-stone-500 mt-1">
                Tickets Pending Fire
              </p>
            </div>
            <div
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${attentionRequired ? "bg-[#fed7aa] text-[#9a3412]" : "bg-white text-stone-600 border border-stone-200"}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${attentionRequired ? "bg-[#ea580c]" : "bg-stone-900"}`}
              />
              {attentionRequired ? "Attention" : "Optimal"}
            </div>
          </div>

          <div className="bg-white p-2 rounded-lg flex items-center justify-between border border-stone-100">
            <div className="flex items-center gap-1.5 text-stone-600">
              <span className="material-symbols-outlined text-[16px] text-stone-400">
                history
              </span>
              <span className="text-xs">Oldest in buffer</span>
            </div>
            <span className="text-xs font-semibold text-stone-900">
              {oldestElapsed}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "LAYOUT: 1×2 MINI"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DrawerKdsStationQueueCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const summary = data?.summary || {};
  const stationName = summary.stationName || "Tandoor & Clay Oven";
  const stationTag = summary.stationTag || "Stn 02";
  const stationTickets =
    typeof summary.ticketsCount === "number"
      ? summary.ticketsCount
      : data?.kpi?.value || 0;
  const stationAvgPrep = summary.avgPrepText || "--";
  const stationLoadPercent =
    typeof summary.loadPercent === "number" ? summary.loadPercent : 0;

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6]">
          <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-full border border-stone-100">
            <span className="text-xs font-semibold text-stone-900 truncate">
              {stationName}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f0eae3] text-stone-600">
              {stationTag}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
            <div className="bg-white p-1.5 rounded-lg border border-stone-100">
              <span className="text-[10px] text-stone-400 block font-medium">
                Tickets
              </span>
              <span className="font-serif text-lg text-stone-900">
                {String(stationTickets).padStart(2, "0")}
              </span>
            </div>
            <div className="bg-white p-1.5 rounded-lg border border-stone-100">
              <span className="text-[10px] text-stone-400 block font-medium">
                Avg Prep
              </span>
              <span className="font-serif text-lg text-stone-900">
                {stationAvgPrep}
              </span>
            </div>
            <div className="bg-white p-1.5 rounded-lg border border-stone-100">
              <span className="text-[10px] text-stone-400 block font-medium">
                Load
              </span>
              <span className="font-serif text-lg text-stone-900">
                {stationLoadPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "CONFIG REQUIRED"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">
              settings
            </span>
            <span>Configure & Add</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DrawerKdsStatusBreakdownCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const summary = data?.summary || {};
  const bAccepted =
    typeof summary.accepted === "number"
      ? summary.accepted
      : typeof summary.held === "number"
        ? summary.held
        : 0;
  const bInPrep = typeof summary.inPrep === "number" ? summary.inPrep : 0;
  const bReady = typeof summary.ready === "number" ? summary.ready : 0;
  const bOverdue = typeof summary.overdue === "number" ? summary.overdue : 0;
  const bTotal =
    typeof summary.total === "number"
      ? summary.total
      : bAccepted + bInPrep + bReady + bOverdue;

  const donutAccepted = bTotal > 0 ? (bAccepted / bTotal) * 88 : 0;
  const donutInPrep = bTotal > 0 ? (bInPrep / bTotal) * 88 : 0;
  const donutReady = bTotal > 0 ? (bReady / bTotal) * 88 : 0;
  const donutOverdue = bTotal > 0 ? (bOverdue / bTotal) * 88 : 0;

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex items-center justify-between gap-3 border border-[#f3ede6]">
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle
                className="stroke-[#eae2d9]"
                cx="18"
                cy="18"
                fill="none"
                r="14"
                strokeWidth="3.5"
              />
              {bTotal > 0 ? (
                <>
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
                  <circle
                    className="stroke-amber-600"
                    cx="18"
                    cy="18"
                    fill="none"
                    r="14"
                    strokeDasharray={`${donutInPrep} 88`}
                    strokeDashoffset={`-${donutAccepted}`}
                    strokeWidth="3.5"
                  />
                  <circle
                    className="stroke-emerald-600"
                    cx="18"
                    cy="18"
                    fill="none"
                    r="14"
                    strokeDasharray={`${donutReady} 88`}
                    strokeDashoffset={`-${donutAccepted + donutInPrep}`}
                    strokeWidth="3.5"
                  />
                  <circle
                    className="stroke-red-600"
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
              <span className="font-serif text-lg text-stone-900 font-normal leading-none">
                {bTotal}
              </span>
              <span className="text-[8px] uppercase font-bold text-stone-400">
                Total
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1 w-full text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-stone-600">
                <span className="w-2 h-2 rounded-full bg-stone-900" />
                Accepted
              </span>
              <span className="font-semibold text-stone-900">{bAccepted}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-stone-600">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                In Prep
              </span>
              <span className="font-semibold text-stone-900">{bInPrep}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-stone-600">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Ready
              </span>
              <span className="font-semibold text-stone-900">{bReady}</span>
            </div>
            <div className="flex items-center justify-between text-red-600 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600" />
                Overdue
              </span>
              <span className="font-semibold">{bOverdue}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "LAYOUT: 2×2 SLATE"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DrawerKdsAvgPrepTimeCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const summary = data?.summary || {};
  const avgPrepMins =
    typeof summary.avgPrepMins === "number"
      ? summary.avgPrepMins
      : typeof data?.kpi?.value === "number"
        ? data.kpi.value
        : 0;
  const deltaText =
    summary.deltaText ||
    (avgPrepMins > 0
      ? avgPrepMins <= 20
        ? `${(20 - avgPrepMins).toFixed(1)}m faster`
        : `${(avgPrepMins - 20).toFixed(1)}m over SLA`
      : "Within SLA");
  const stationBars = summary.stationBars || [
    {
      name: "Grill",
      prep: avgPrepMins > 0 ? `${(avgPrepMins * 0.8).toFixed(1)}m` : "--",
    },
    {
      name: "Clay Oven",
      prep: avgPrepMins > 0 ? `${(avgPrepMins * 1.05).toFixed(1)}m` : "--",
    },
    {
      name: "Pantry",
      prep: avgPrepMins > 0 ? `${(avgPrepMins * 0.4).toFixed(1)}m` : "--",
    },
  ];

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2.5 border border-[#f3ede6]">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-3xl text-stone-900 font-normal">
                {avgPrepMins > 0 ? avgPrepMins : "--"}
              </span>
              <span className="font-serif text-sm text-stone-500">mins</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-800 bg-[#ede6df] px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[13px]">
                trending_down
              </span>
              <span>{deltaText}</span>
            </div>
          </div>

          <div className="bg-white px-2.5 py-1.5 rounded-lg flex items-center justify-between text-stone-600 border border-stone-100 text-xs">
            <span className="uppercase tracking-wider text-[10px] text-stone-400 font-semibold">
              Service SLA Goal
            </span>
            <span className="font-semibold text-stone-900">&lt; 20.0 min</span>
          </div>

          <div className="flex flex-col gap-1 pt-0.5">
            <div className="flex items-center justify-between text-[10.5px] text-stone-500">
              {stationBars.map((bar: any, idx: number) => (
                <span key={idx}>
                  {bar.name}: {bar.prep}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="h-1 bg-stone-900 rounded-full" />
              <div className="h-1 bg-stone-400 rounded-full" />
              <div className="h-1 bg-[#eae2d9] rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "LAYOUT: 1×2 MINI"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}

function DrawerKdsDelayAlertsCard({
  widget,
  isPlaced,
  placement,
  onAdd,
  data,
}: DrawerCardProps) {
  const alertCount = data?.alert?.count ?? data?.alert?.alertCount ?? 0;
  const delayedItems = data?.alert?.delayedItems || [];
  const primaryDelayed = delayedItems.length > 0 ? delayedItems[0] : null;

  return (
    <article className="bg-white rounded-xl p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow duration-300 border border-[#eee7e1] relative group overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
              {widget.categoryTrack}
            </span>
            <h3 className="font-serif text-xl sm:text-[22px] text-stone-900 font-normal mt-0.5 leading-snug">
              {widget.title}
            </h3>
          </div>
          <span
            className={`text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${widget.typeBadgeBg}`}
          >
            {widget.type}
          </span>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed min-h-[32px]">
          {widget.description}
        </p>

        {alertCount > 0 && primaryDelayed ? (
          <div className="bg-[#fce8e6] rounded-lg p-3 flex flex-col justify-between gap-2.5 border border-[#fad2cf]">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-stone-900">
                    {primaryDelayed.orderNumber || "#ORD-1038"}
                  </span>
                  <span className="text-[11px] text-stone-500">
                    • {primaryDelayed.label || "Table T-04"}
                  </span>
                </div>
                <p className="text-xs text-stone-700 font-medium mt-0.5">
                  {primaryDelayed.station || "Kitchen Line Delay"}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#b3261e] text-white text-[9.5px] font-semibold uppercase tracking-wider">
                Expedite
              </span>
            </div>

            <div className="bg-white/80 p-2 rounded flex items-center justify-between text-xs">
              <span className="text-red-700 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  warning
                </span>
                {primaryDelayed.elapsedMinutes || 22}m elapsed
              </span>
              <span className="text-stone-500">
                +{Math.max(1, (primaryDelayed.elapsedMinutes || 22) - 20)}m past
                SLA
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-[#fcf8f5] rounded-lg p-3 flex items-center justify-between gap-2.5 border border-[#f3ede6]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">
                  check_circle
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-stone-900">
                  0 Delayed Orders
                </span>
                <span className="text-[11px] text-stone-500">
                  All stations within 20m SLA
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#f0eae3] text-stone-600 text-[10px] font-medium shrink-0">
              Optimal
            </span>
          </div>
        )}
      </div>

      <div className="pt-4 flex items-center justify-between">
        <span className="text-[10.5px] font-sans font-medium text-stone-400 uppercase tracking-wider">
          {isPlaced && placement
            ? `SLOT: ROW ${placement.gridRow + 1} COL ${placement.gridCol + 1}`
            : "LAYOUT: 2×1 STRIP"}
        </span>
        {isPlaced ? (
          <button
            disabled
            className="inline-flex items-center gap-1.5 bg-[#eee8e2] text-stone-700 font-medium text-xs px-3 py-1.5 rounded-full cursor-default shadow-xs"
          >
            <span>Added</span>
            <span className="material-symbols-outlined text-[15px]">check</span>
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 bg-black hover:bg-stone-800 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            <span>Add Widget</span>
          </button>
        )}
      </div>
    </article>
  );
}
