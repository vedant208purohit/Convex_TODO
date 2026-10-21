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

import {
  getCurrencyForCountry,
  getTimezoneForCountry,
} from "../../../lib/constants/countries";


interface SubReportPageProps {
  params: Promise<{ reportType: string }>;
}

const VALID_REPORT_TYPES = [
  "sales",
  "orders",
  "order",
  "customer",
  "customers",
  "menu",
  "operational",
  "operations",
] as const;

export default function SubReportPage({ params }: SubReportPageProps) {
  const resolvedParams = use(params);
  const rawReportType = resolvedParams.reportType?.toLowerCase() || "";

  if (!VALID_REPORT_TYPES.includes(rawReportType as any)) {
    notFound();
  }

  // Normalize aliases
  let normalizedType = rawReportType;
  if (normalizedType === "order") normalizedType = "orders";
  if (normalizedType === "customers") normalizedType = "customer";
  if (normalizedType === "operations") normalizedType = "operational";

  // Capitalize for titles (e.g. 'sales' -> 'Sales')
  const capitalizedTitle =
    normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);

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

  const countryCode = activeOrg?.country || "IN";
  const currencySymbol =
    activeOrg?.defaultCurrencySymbol ||
    getCurrencyForCountry(countryCode).symbol;

  const timezone =
    activeOrg?.organizationTimeZone ||
    getTimezoneForCountry(countryCode);

  // 1. Query Orders matching selected date range
  const startMs = selectedRange.startDate.getTime();
  const endMs = selectedRange.endDate.getTime();

  // 1. High-Performance Convex Backend Report Queries
  const salesReportBackend = useQuery(
    api.reports.getSalesReport,
    activeOrg
      ? {
          organizationId: activeOrg._id,
          fromTimestamp: startMs,
          toTimestamp: endMs,
        }
      : "skip"
  );

  const ordersReportBackend = useQuery(
    api.reports.getOrdersReport,
    activeOrg
      ? {
          organizationId: activeOrg._id,
          fromTimestamp: startMs,
          toTimestamp: endMs,
        }
      : "skip"
  );

  const menuReportBackend = useQuery(
    api.reports.getMenuReport,
    activeOrg
      ? {
          organizationId: activeOrg._id,
          fromTimestamp: startMs,
          toTimestamp: endMs,
        }
      : "skip"
  );

  const customerReportBackend = useQuery(
    api.reports.getCustomerReport,
    activeOrg
      ? {
          organizationId: activeOrg._id,
          fromTimestamp: startMs,
          toTimestamp: endMs,
        }
      : "skip"
  );

  const operationalReportBackend = useQuery(
    api.reports.getOperationalReport,
    activeOrg
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
  const effectiveOrders = useMemo(() => {
    return ordersResponse?.orders || [];
  }, [ordersResponse]);

  // Resolved Menu Categories & Items
  const allCategories = useMemo(() => {
    if (menuData && Array.isArray(menuData) && menuData.length > 0) {
      return menuData.map((m: any) => m.category || m);
    }
    return [];
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
    return [];
  }, [menuData]);

  // Resolved Tables, Layouts, Processes
  const tables = useMemo(() => {
    if (tablesData && tablesData.length > 0) return tablesData;
    return [];
  }, [tablesData]);

  const layouts = useMemo(() => {
    if (layoutsData && layoutsData.length > 0) return layoutsData;
    return [];
  }, [layoutsData]);

  const processes = useMemo(() => {
    if (processesData && processesData.length > 0) return processesData;
    return [];
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
    return keys;
  }, [priorOrdersResponse]);

  const isOrdersLoading = ordersResponse === undefined && effectiveOrders.length === 0;
  const isReportsLoading = isOrdersLoading;

  return (
    <PosShell title="Reports" subtitle={`${capitalizedTitle} Report`}>
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#f5f5f5] px-6 lg:px-8 py-6">
        <div className="w-full space-y-4 sm:space-y-6">

          {/* Sub-Report Views */}
          {normalizedType === "sales" ? (
            <SalesReportView
              orders={effectiveOrders}
              backendData={salesReportBackend}
              loading={isOrdersLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              operationTiming={activeOrg?.operationTiming}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : normalizedType === "menu" ? (
            <MenuReportView
              orders={effectiveOrders}
              backendData={menuReportBackend}
              allItems={allItems}
              allCategories={allCategories}
              loading={isReportsLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              operationTiming={activeOrg?.operationTiming}
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
              operationTiming={activeOrg?.operationTiming}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : normalizedType === "customer" ? (
            <CustomerReportView
              orders={effectiveOrders}
              backendData={customerReportBackend}
              priorCustomerKeys={priorCustomerKeys}
              loading={isOrdersLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              operationTiming={activeOrg?.operationTiming}
              startDateMs={startMs}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : normalizedType === "orders" ? (
            <OrdersReportView
              orders={effectiveOrders}
              backendData={ordersReportBackend}
              loading={isOrdersLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              operationTiming={activeOrg?.operationTiming}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
              activeOrg={activeOrg}
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
