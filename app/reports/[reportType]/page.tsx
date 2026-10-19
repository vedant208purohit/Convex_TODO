"use client";

import React, { use, useState, useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useQuery } from "convex/react";
import { PosShell } from "../../components/PosShell";
import { api } from "../../../convex/_generated/api";
import {
  ReportHeader,
  DateRange,
  calculateDatePreset,
} from "../../components/reports/ReportHeader";
import { SalesReportView } from "../../components/reports/SalesReportView";
import { OrdersReportView } from "../../components/reports/OrdersReportView";
import { CustomerReportView } from "../../components/reports/CustomerReportView";
import { MenuReportView } from "../../components/reports/MenuReportView";
import { OperationalReportView } from "../../components/reports/OperationalReportView";
import { ZReportView } from "../../components/reports/ZReportView";

import {
  getCurrencyForCountry,
  getTimezoneForCountry,
} from "../../../lib/constants/countries";
import {
  generateDemoOrders,
  DEMO_CATEGORIES,
  DEMO_ITEMS,
  DEMO_TABLES,
  DEMO_LAYOUTS,
  DEMO_PROCESSES,
} from "../demoReportData";

interface SubReportPageProps {
  params: Promise<{ reportType: string }>;
}

const VALID_REPORT_TYPES = [
  "sales",
  "orders",
  "customer",
  "customers",
  "menu",
  "operational",
  "operations",
  "z-report",
  "zreport",
] as const;

export default function SubReportPage({ params }: SubReportPageProps) {
  const resolvedParams = use(params);
  const rawReportType = resolvedParams.reportType?.toLowerCase() || "";

  if (!VALID_REPORT_TYPES.includes(rawReportType as any)) {
    notFound();
  }

  // Normalize aliases
  let normalizedType = rawReportType;
  if (normalizedType === "customers") normalizedType = "customer";
  if (normalizedType === "operations") normalizedType = "operational";
  if (normalizedType === "zreport") normalizedType = "z-report";

  // Capitalize for titles (e.g. 'sales' -> 'Sales', 'z-report' -> 'Z-Report')
  const capitalizedTitle =
    normalizedType === "z-report"
      ? "Z-Report / Shift Close"
      : normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);

  // Default Date Range: Today (matching legacy default behavior)
  const initialPreset = calculateDatePreset("Today");
  const [selectedRange, setSelectedRange] = useState<DateRange>({
    startDate: initialPreset.start,
    endDate: initialPreset.end,
    preset: "Today",
  });

  // Query Organization
  const organizations = useQuery(api.organizations.list);
  const activeOrg =
    organizations && organizations.length > 0 ? organizations[0] : null;

  const currencySymbol =
    activeOrg?.defaultCurrencySymbol ||
    (activeOrg?.country
      ? getCurrencyForCountry(activeOrg.country).symbol
      : "₹");

  const countryCode = activeOrg?.country || "IN";
  const timezone =
    activeOrg?.organizationTimeZone ||
    getTimezoneForCountry(countryCode);

  // 1. Query Orders matching selected date range
  const startMs = selectedRange.startDate.getTime();
  const endMs = selectedRange.endDate.getTime();

  // Testing mode toggle: default to false so real backend data is used
  const [forceDemoMode, setForceDemoMode] = useState<boolean>(false);

  // 1. High-Performance Convex Backend Report Queries
  const salesReportBackend = useQuery(
    api.reports.getSalesReport,
    activeOrg && !forceDemoMode
      ? {
          organizationId: activeOrg._id,
          fromTimestamp: startMs,
          toTimestamp: endMs,
        }
      : "skip"
  );

  const ordersReportBackend = useQuery(
    api.reports.getOrdersReport,
    activeOrg && !forceDemoMode
      ? {
          organizationId: activeOrg._id,
          fromTimestamp: startMs,
          toTimestamp: endMs,
        }
      : "skip"
  );

  const menuReportBackend = useQuery(
    api.reports.getMenuReport,
    activeOrg && !forceDemoMode
      ? {
          organizationId: activeOrg._id,
          fromTimestamp: startMs,
          toTimestamp: endMs,
        }
      : "skip"
  );

  const customerReportBackend = useQuery(
    api.reports.getCustomerReport,
    activeOrg && !forceDemoMode
      ? {
          organizationId: activeOrg._id,
          fromTimestamp: startMs,
          toTimestamp: endMs,
        }
      : "skip"
  );

  const operationalReportBackend = useQuery(
    api.reports.getOperationalReport,
    activeOrg && !forceDemoMode
      ? {
          organizationId: activeOrg._id,
          fromTimestamp: startMs,
          toTimestamp: endMs,
        }
      : "skip"
  );

  const zReportBackend = useQuery(
    api.reports.getZReportShiftSummary,
    activeOrg && !forceDemoMode
      ? {
          organizationId: activeOrg._id,
          fromTimestamp: startMs,
          toTimestamp: endMs,
        }
      : "skip"
  );

  const ordersResponse = useQuery(
    api.orders.listOrders,
    activeOrg
      ? {
          organizationId: activeOrg._id,
          startDate: startMs,
          endDate: endMs,
          pageSize: 1000,
        }
      : "skip",
  );

  // 2. Query Menu Data
  const menuData = useQuery(
    api.menu.getOrganizationMenu,
    activeOrg ? { organizationId: activeOrg._id, allMenus: true } : "skip",
  );

  // 3. Query Tables, Layouts, and Order Processes
  const tablesData = useQuery(api.organizationTables.list, activeOrg ? {} : "skip");
  const layoutsData = useQuery(api.organizationLayouts.list, activeOrg ? {} : "skip");
  const processesData = useQuery(api.organizationOrderProcesses.list, activeOrg ? {} : "skip");

  // 4. Query Prior Orders for Customer Retention Tracking
  const priorOrdersResponse = useQuery(
    api.orders.listOrders,
    activeOrg
      ? {
          organizationId: activeOrg._id,
          endDate: startMs - 1,
          pageSize: 2000,
        }
      : "skip",
  );

  // Real orders from database
  const realOrders = useMemo(() => {
    return ordersResponse?.orders || [];
  }, [ordersResponse]);

  // Demo orders generated specifically for the selected date range
  const demoOrders = useMemo(() => {
    return generateDemoOrders(selectedRange.startDate, selectedRange.endDate);
  }, [selectedRange.startDate, selectedRange.endDate]);

  const effectiveOrders = useMemo(() => {
    if (!forceDemoMode && realOrders.length > 0) {
      return realOrders;
    }
    // If real orders are 0 and demo mode is active, return demo orders
    if (forceDemoMode) return demoOrders;
    // Otherwise return real orders (even if empty, to reflect live state)
    return realOrders;
  }, [forceDemoMode, realOrders, demoOrders]);

  const isUsingDemo = forceDemoMode;

  // Resolved Menu Categories & Items
  const allCategories = useMemo(() => {
    if (menuData && Array.isArray(menuData) && menuData.length > 0) {
      return menuData.map((m: any) => m.category || m);
    }
    return DEMO_CATEGORIES;
  }, [menuData]);

  const allItems = useMemo(() => {
    if (menuData && Array.isArray(menuData) && menuData.length > 0) {
      const itemsList: any[] = [];
      for (const m of menuData) {
        const cat = (m as any).category || m;
        if (cat && cat.items && Array.isArray(cat.items)) {
          for (const ci of cat.items) {
            const it = ci.item || ci;
            if (it) itemsList.push({ ...it, categoryName: cat.name });
          }
        }
      }
      if (itemsList.length > 0) return itemsList;
    }
    return DEMO_ITEMS;
  }, [menuData]);

  // Resolved Tables, Layouts, Processes
  const tables = useMemo(() => {
    if (tablesData && tablesData.length > 0) return tablesData;
    return DEMO_TABLES;
  }, [tablesData]);

  const layouts = useMemo(() => {
    if (layoutsData && layoutsData.length > 0) return layoutsData;
    return DEMO_LAYOUTS;
  }, [layoutsData]);

  const processes = useMemo(() => {
    if (processesData && processesData.length > 0) return processesData;
    return DEMO_PROCESSES;
  }, [processesData]);

  // Resolved Prior Customer Keys for Repeat Patron Classification
  const priorCustomerKeys = useMemo(() => {
    const keys = new Set<string>();
    if (priorOrdersResponse?.orders) {
      priorOrdersResponse.orders.forEach((o: any) => {
        const k =
          o.customerId ||
          (o.customerPhone ? o.customerPhone.trim() : null) ||
          (o.customerName ? o.customerName.trim().toLowerCase() : null);
        if (k) keys.add(k);
      });
    }
    // Seed sample customer keys for demo data retention calculations
    keys.add("cust_1");
    keys.add("cust_2");
    keys.add("cust_3");
    keys.add("+91 98765 43210");
    keys.add("+91 98234 56789");
    return keys;
  }, [priorOrdersResponse]);

  const isOrdersLoading = ordersResponse === undefined && realOrders.length === 0;
  const isReportsLoading = isOrdersLoading;

  return (
    <PosShell title="Reports" subtitle={`${capitalizedTitle} Report`}>
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#fff8f5] px-3.5 sm:px-6 lg:px-10 py-4 sm:py-8">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

          {/* Testing Mode Banner & Toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 bg-white px-3.5 sm:px-4 py-2.5 rounded-xl border border-[#e9e1dd] shadow-xs text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#1b873f] shrink-0"></span>
              <span className="font-semibold text-[#1e1b19]">
                {isUsingDemo ? "Testing Demo Data Active" : "Live Store Data Active"}
              </span>
              <span className="text-[#d0c4be]">•</span>
              <span className="text-[#645d58]">
                {effectiveOrders.length} orders loaded for {selectedRange.preset || "Range"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setForceDemoMode(!forceDemoMode)}
              className="px-3 py-1 rounded-full text-[11px] font-semibold border border-[#e9e1dd] bg-[#faf2ee] text-[#1e1b19] hover:bg-[#e9e1dd] transition-colors self-end sm:self-auto cursor-pointer"
            >
              {forceDemoMode ? "Switch to Live Store Data" : "Preview Sample Demo Data"}
            </button>
          </div>

          {/* Sub-Report Views */}
          {normalizedType === "sales" ? (
            <SalesReportView
              orders={effectiveOrders}
              backendData={forceDemoMode ? undefined : salesReportBackend}
              loading={isOrdersLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : normalizedType === "menu" ? (
            <MenuReportView
              orders={effectiveOrders}
              backendData={forceDemoMode ? undefined : menuReportBackend}
              allItems={allItems}
              allCategories={allCategories}
              loading={isReportsLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : normalizedType === "operational" ? (
            <OperationalReportView
              orders={effectiveOrders}
              tables={tables}
              layouts={layouts}
              processes={processes}
              loading={isReportsLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : normalizedType === "customer" ? (
            <CustomerReportView
              orders={effectiveOrders}
              backendData={forceDemoMode ? undefined : customerReportBackend}
              priorCustomerKeys={priorCustomerKeys}
              loading={isOrdersLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              startDateMs={startMs}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : normalizedType === "orders" ? (
            <OrdersReportView
              orders={effectiveOrders}
              backendData={forceDemoMode ? undefined : ordersReportBackend}
              loading={isOrdersLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : normalizedType === "z-report" ? (
            <ZReportView
              orders={effectiveOrders}
              loading={isOrdersLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
              orgName={activeOrg?.name || "Skyz Restaurant & Banquet"}
              branchName={activeOrg?.city || "Main Floor"}
            />
          ) : (
            <ReportHeader
              title={`${capitalizedTitle} report`}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          )}
        </div>
      </div>
    </PosShell>
  );
}
