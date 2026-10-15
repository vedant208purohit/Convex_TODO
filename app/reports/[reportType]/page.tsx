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
  "customer",
  "menu",
  "operational",
] as const;

export default function SubReportPage({ params }: SubReportPageProps) {
  const resolvedParams = use(params);
  const rawReportType = resolvedParams.reportType?.toLowerCase() || "";

  if (!VALID_REPORT_TYPES.includes(rawReportType as any)) {
    notFound();
  }

  const reportType = rawReportType as (typeof VALID_REPORT_TYPES)[number];

  // Capitalize for titles (e.g. 'sales' -> 'Sales')
  const capitalizedTitle =
    reportType.charAt(0).toUpperCase() + reportType.slice(1);

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

  const orders = useMemo(() => {
    return ordersResponse?.orders || [];
  }, [ordersResponse]);

  const isOrdersLoading = ordersResponse === undefined;

  // Only load orders for reports - no unnecessary extra API calls
  const isReportsLoading = isOrdersLoading;

  return (
    <PosShell title="Reports" subtitle={`${capitalizedTitle} Report`}>
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#fff8f5] px-6 lg:px-10 py-8">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Sub-Report Views */}
          {reportType === "sales" ? (
            <SalesReportView
              orders={orders}
              loading={isOrdersLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : reportType === "menu" ? (
            <MenuReportView
              orders={orders}
              loading={isReportsLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : reportType === "operational" ? (
            <OperationalReportView
              orders={orders}
              loading={isReportsLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : reportType === "customer" ? (
            <CustomerReportView
              orders={orders}
              loading={isOrdersLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              startDateMs={startMs}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
            />
          ) : reportType === "orders" ? (
            <OrdersReportView
              orders={orders}
              loading={isOrdersLoading}
              currencySymbol={currencySymbol}
              countryCode={countryCode}
              timezone={timezone}
              selectedRange={selectedRange}
              onRangeChange={setSelectedRange}
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
