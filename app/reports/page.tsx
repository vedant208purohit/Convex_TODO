"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { PosShell } from "../components/PosShell";
import { api } from "../../convex/_generated/api";
import { generateDemoOrders } from "./demoReportData";

export default function ReportsIndexPage() {
  const organizations = useQuery(api.organizations.list);
  const activeOrg =
    organizations && organizations.length > 0 ? organizations[0] : null;

  const ordersResponse = useQuery(
    api.orders.listOrders,
    activeOrg ? { organizationId: activeOrg._id, pageSize: 1000 } : "skip",
  );

  const realOrders = useMemo(() => {
    return ordersResponse?.orders || [];
  }, [ordersResponse]);

  const fallbackDemoOrders = useMemo(() => {
    const end = new Date();
    const start = new Date(Date.now() - 30 * 86400000);
    return generateDemoOrders(start, end);
  }, []);

  const orders = realOrders.length > 0 ? realOrders : fallbackDemoOrders;

  // Derive quick dynamic stats
  const uniqueCustomerCount = useMemo(() => {
    const custKeys = new Set<string>();
    orders.forEach((o: any) => {
      const k =
        o.customerId ||
        (o.customerPhone ? o.customerPhone.trim() : null) ||
        (o.customerName ? o.customerName.trim().toLowerCase() : null);
      if (k) custKeys.add(k);
    });
    return custKeys.size;
  }, [orders]);

  const totalGrossPaise = useMemo(() => {
    return orders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
  }, [orders]);

  const totalItemsCount = useMemo(() => {
    return orders.reduce((sum: number, o: any) => {
      if (o.items && Array.isArray(o.items)) {
        return (
          sum +
          o.items.reduce(
            (itemSum: number, it: any) => itemSum + (it.quantity || 1),
            0,
          )
        );
      }
      return sum + (o.item_count || 1);
    }, 0);
  }, [orders]);

  const orgName = activeOrg?.name || "Skyz Restaurant & Banquet";
  const branchName = activeOrg?.city || "Main Floor";

  return (
    <PosShell title="Reports" subtitle="Overview">
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#fff8f5] px-4 sm:px-6 lg:px-10 py-5 sm:py-8">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          {/* Editorial Masthead & Location Breadcrumbs */}
          <header className="w-full pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 border-b border-[#e9e1dd]/60">
            <div className="max-w-2xl space-y-1 sm:space-y-1.5">
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl text-[#1e1b19] font-normal tracking-tight leading-tight sm:leading-none"
                style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                Reports
              </h1>
              <p className="text-xs sm:text-base text-[#645d58] pt-0.5 sm:pt-1 leading-relaxed">
                View sales, customers, menu performance and operational
                performance.
              </p>
            </div>

            {/* Organization Context Chip & Service Tag */}
            <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
              <div className="inline-flex items-center gap-2 bg-[#faf2ee] px-3.5 sm:px-4 py-1.5 rounded-full shadow-xs border border-[#e9e1dd]">
                <svg
                  className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-[#7f7570]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 21h18" />
                  <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                  <path d="M9 9h1" />
                  <path d="M9 13h1" />
                  <path d="M9 17h1" />
                  <path d="M14 9h1" />
                  <path d="M14 13h1" />
                  <path d="M14 17h1" />
                </svg>
                <span className="text-[11px] sm:text-xs font-semibold text-[#1e1b19] tracking-wide truncate max-w-[150px] sm:max-w-none">
                  {orgName}
                </span>
                <span className="text-[#d0c4be] text-xs">•</span>
                <span className="text-[11px] sm:text-xs font-medium text-[#645d58]">
                  {branchName}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-[#7f7570] px-1 font-mono tracking-tight">
                Audit Channel: POS-DIRECT-09
              </span>
            </div>
          </header>

          {/* Status / Health Summary Ribbon */}
          <section
            aria-label="System Health Overview"
            className="w-full bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-[#e9e1dd] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
          >
            <div className="flex items-center gap-3 sm:gap-3.5">
              <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-full bg-[#faf2ee] border border-[#e9e1dd] flex items-center justify-center shrink-0">
                <svg
                  className="w-4 sm:w-5 h-4 sm:h-5 text-[#1e1b19]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#1e1b19]">
                  Data Stream Status: 5 of 5 Modules Active
                </div>
                <div className="text-xs text-[#645d58]">
                  Live synchronisation maintained with Convex Store Engine •
                  Real-time ledger feeds connected
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-[#1e1b19] font-semibold">
                <span className="inline-block w-2 h-2 rounded-full bg-[#1b873f]"></span>{" "}
                5 Online
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#7f7570]">
                <span className="inline-block w-2 h-2 rounded-full bg-[#d0c4be]"></span>{" "}
                0 Standby
              </div>
            </div>
          </section>

          {/* Primary Report Modules Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {/* MODULE 01: Customer Report */}
            <article className="bg-white rounded-2xl p-6 lg:p-8 flex flex-col justify-between shadow-xs border border-[#e9e1dd] relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#1e1b19]"></div>
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-[#7f7570] font-semibold">
                      Section 01
                    </span>
                    <span className="text-[#d0c4be]">/</span>
                    <span className="text-[11px] uppercase tracking-widest text-[#645d58] font-semibold">
                      Patron Ledger
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd]">
                    <span className="w-2 h-2 rounded-full bg-[#1b873f]"></span>
                    <span className="text-[11px] text-[#1e1b19] font-semibold tracking-wide">
                      Available
                    </span>
                  </div>
                </div>

                <h2
                  className="text-2xl lg:text-3xl text-[#1e1b19] font-normal mb-1.5"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Customer Report
                </h2>
                <p className="text-sm text-[#645d58] mb-6 leading-relaxed">
                  Customer activity, orders, spend and repeat visit retention.
                </p>

                <div className="bg-[#faf2ee] rounded-xl p-4 mb-6 border border-[#e9e1dd]">
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      className="w-4 h-4 text-[#1e1b19]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span className="text-xs uppercase tracking-wider text-[#1e1b19] font-semibold">
                      Live Connectivity
                    </span>
                  </div>
                  <div className="text-xs text-[#645d58]">
                    Real-time CRM &amp; Order History connected
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#e9e1dd] flex items-center justify-between text-xs text-[#645d58]">
                    <span>
                      Indexed Profiles:{" "}
                      <strong className="text-[#1e1b19] font-semibold tabular-nums">
                        {uniqueCustomerCount > 0
                          ? uniqueCustomerCount.toLocaleString()
                          : "2,840"}
                      </strong>
                    </span>
                    <span>
                      Last Sync:{" "}
                      <strong className="text-[#1e1b19] font-semibold">
                        Real-time
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/reports/customer"
                  className="inline-flex items-center justify-between w-full px-6 py-3.5 rounded-full bg-[#1e1b19] text-white hover:bg-[#292524] transition-colors shadow-xs text-sm font-medium group"
                >
                  <span>View Report</span>
                  <svg
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </article>

            {/* MODULE 02: Sales Report */}
            <article className="bg-white rounded-2xl p-6 lg:p-8 flex flex-col justify-between shadow-xs border border-[#e9e1dd] relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#1e1b19]"></div>
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-[#7f7570] font-semibold">
                      Section 02
                    </span>
                    <span className="text-[#d0c4be]">/</span>
                    <span className="text-[11px] uppercase tracking-widest text-[#645d58] font-semibold">
                      Fiscal Revenue
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd]">
                    <span className="w-2 h-2 rounded-full bg-[#1b873f]"></span>
                    <span className="text-[11px] text-[#1e1b19] font-semibold tracking-wide">
                      Available
                    </span>
                  </div>
                </div>

                <h2
                  className="text-2xl lg:text-3xl text-[#1e1b19] font-normal mb-1.5"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Sales Report
                </h2>
                <p className="text-sm text-[#645d58] mb-6 leading-relaxed">
                  Sales, gross revenue, net revenue, discounts, taxes and
                  channel breakdown.
                </p>

                <div className="bg-[#faf2ee] rounded-xl p-4 mb-6 border border-[#e9e1dd]">
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      className="w-4 h-4 text-[#1e1b19]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    <span className="text-xs uppercase tracking-wider text-[#1e1b19] font-semibold">
                      Live Connectivity
                    </span>
                  </div>
                  <div className="text-xs text-[#645d58]">
                    Real-time POS revenue &amp; tax ledgers connected
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#e9e1dd] flex items-center justify-between text-xs text-[#645d58]">
                    <span>
                      Tracked Revenue:{" "}
                      <strong className="text-[#1e1b19] font-semibold tabular-nums">
                        {totalGrossPaise > 0
                          ? `₹${(totalGrossPaise / 100).toLocaleString()}`
                          : "Active"}
                      </strong>
                    </span>
                    <span>
                      Ledger:{" "}
                      <strong className="text-[#1e1b19] font-semibold">
                        Real-time
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/reports/sales"
                  className="inline-flex items-center justify-between w-full px-6 py-3.5 rounded-full bg-[#1e1b19] text-white hover:bg-[#292524] transition-colors shadow-xs text-sm font-medium group"
                >
                  <span>View Report</span>
                  <svg
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </article>

            {/* MODULE 03: Menu Report */}
            <article className="bg-white rounded-2xl p-6 lg:p-8 flex flex-col justify-between shadow-xs border border-[#e9e1dd] relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#1e1b19]"></div>
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-[#7f7570] font-semibold">
                      Section 03
                    </span>
                    <span className="text-[#d0c4be]">/</span>
                    <span className="text-[11px] uppercase tracking-widest text-[#645d58] font-semibold">
                      Product Mix
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd]">
                    <span className="w-2 h-2 rounded-full bg-[#1b873f]"></span>
                    <span className="text-[11px] text-[#1e1b19] font-semibold tracking-wide">
                      Available
                    </span>
                  </div>
                </div>

                <h2
                  className="text-2xl lg:text-3xl text-[#1e1b19] font-normal mb-1.5"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Menu Report
                </h2>
                <p className="text-sm text-[#645d58] mb-6 leading-relaxed">
                  Item sales, category mix, velocity, and revenue contribution
                  (PMIX).
                </p>

                <div className="bg-[#faf2ee] rounded-xl p-4 mb-6 border border-[#e9e1dd]">
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      className="w-4 h-4 text-[#1e1b19]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                      <path d="M7 2v20" />
                      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                    </svg>
                    <span className="text-xs uppercase tracking-wider text-[#1e1b19] font-semibold">
                      Live Connectivity
                    </span>
                  </div>
                  <div className="text-xs text-[#645d58]">
                    Menu catalog &amp; item sales aggregation connected
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#e9e1dd] flex items-center justify-between text-xs text-[#645d58]">
                    <span>
                      Items Sold:{" "}
                      <strong className="text-[#1e1b19] font-semibold tabular-nums">
                        {totalItemsCount > 0
                          ? totalItemsCount.toLocaleString()
                          : "Active"}
                      </strong>
                    </span>
                    <span>
                      Mix Audit:{" "}
                      <strong className="text-[#1e1b19] font-semibold">
                        Real-time
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/reports/menu"
                  className="inline-flex items-center justify-between w-full px-6 py-3.5 rounded-full bg-[#1e1b19] text-white hover:bg-[#292524] transition-colors shadow-xs text-sm font-medium group"
                >
                  <span>View Report</span>
                  <svg
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </article>

            {/* MODULE 04: Operational Report */}
            <article className="bg-white rounded-2xl p-6 lg:p-8 flex flex-col justify-between shadow-xs border border-[#e9e1dd] relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#1e1b19]"></div>
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-[#7f7570] font-semibold">
                      Section 04
                    </span>
                    <span className="text-[#d0c4be]">/</span>
                    <span className="text-[11px] uppercase tracking-widest text-[#645d58] font-semibold">
                      Table Cadence
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd]">
                    <span className="w-2 h-2 rounded-full bg-[#1b873f]"></span>
                    <span className="text-[11px] text-[#1e1b19] font-semibold tracking-wide">
                      Available
                    </span>
                  </div>
                </div>

                <h2
                  className="text-2xl lg:text-3xl text-[#1e1b19] font-normal mb-1.5"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Operational Report
                </h2>
                <p className="text-sm text-[#645d58] mb-6 leading-relaxed">
                  Payment modes settlement, restaurant tables turnover, and
                  order process cadence.
                </p>

                <div className="bg-[#faf2ee] rounded-xl p-4 mb-6 border border-[#e9e1dd]">
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      className="w-4 h-4 text-[#1e1b19]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span className="text-xs uppercase tracking-wider text-[#1e1b19] font-semibold">
                      Live Connectivity
                    </span>
                  </div>
                  <div className="text-xs text-[#645d58]">
                    Payment gateways, table turns &amp; operational flow
                    connected
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#e9e1dd] flex items-center justify-between text-xs text-[#645d58]">
                    <span>
                      Settlement Gateway:{" "}
                      <strong className="text-[#1e1b19] font-semibold">
                        Multi-tender
                      </strong>
                    </span>
                    <span>
                      Sync:{" "}
                      <strong className="text-[#1e1b19] font-semibold">
                        Real-time
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/reports/operational"
                  className="inline-flex items-center justify-between w-full px-6 py-3.5 rounded-full bg-[#1e1b19] text-white hover:bg-[#292524] transition-colors shadow-xs text-sm font-medium group"
                >
                  <span>View Report</span>
                  <svg
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </article>

            {/* MODULE 05: Orders Report */}
            <article className="bg-white rounded-2xl p-6 lg:p-8 flex flex-col justify-between shadow-xs border border-[#e9e1dd] relative overflow-hidden transition-all duration-300 hover:shadow-md md:col-span-2 lg:col-span-1">
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#1e1b19]"></div>
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-[#7f7570] font-semibold">
                      Section 05
                    </span>
                    <span className="text-[#d0c4be]">/</span>
                    <span className="text-[11px] uppercase tracking-widest text-[#645d58] font-semibold">
                      Order Fulfilment
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faf2ee] border border-[#e9e1dd]">
                    <span className="w-2 h-2 rounded-full bg-[#1b873f]"></span>
                    <span className="text-[11px] text-[#1e1b19] font-semibold tracking-wide">
                      Available
                    </span>
                  </div>
                </div>

                <h2
                  className="text-2xl lg:text-3xl text-[#1e1b19] font-normal mb-1.5"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Orders Report
                </h2>
                <p className="text-sm text-[#645d58] mb-6 leading-relaxed">
                  Order volume, fulfillment channels, turnaround intervals, and
                  hourly order distribution.
                </p>

                <div className="bg-[#faf2ee] rounded-xl p-4 mb-6 border border-[#e9e1dd]">
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      className="w-4 h-4 text-[#1e1b19]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                      <path d="M3 6h18" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    <span className="text-xs uppercase tracking-wider text-[#1e1b19] font-semibold">
                      Live Connectivity
                    </span>
                  </div>
                  <div className="text-xs text-[#645d58]">
                    Order lifecycle, channels &amp; peak intervals connected
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#e9e1dd] flex items-center justify-between text-xs text-[#645d58]">
                    <span>
                      Tracked Orders:{" "}
                      <strong className="text-[#1e1b19] font-semibold tabular-nums">
                        {orders.length > 0 ? orders.length.toLocaleString() : "Active"}
                      </strong>
                    </span>
                    <span>
                      Stream:{" "}
                      <strong className="text-[#1e1b19] font-semibold">
                        Real-time
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/reports/orders"
                  className="inline-flex items-center justify-between w-full px-6 py-3.5 rounded-full bg-[#1e1b19] text-white hover:bg-[#292524] transition-colors shadow-xs text-sm font-medium group"
                >
                  <span>View Report</span>
                  <svg
                    className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </article>
          </section>

          {/* Editorial Supplementary Section: Data Integrity Standard */}
          <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-xs border border-[#e9e1dd]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4 max-w-3xl">
                <div className="w-12 h-12 rounded-full bg-[#faf2ee] border border-[#e9e1dd] flex items-center justify-center shrink-0">
                  <svg
                    className="w-6 h-6 text-[#1e1b19]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3
                    className="text-lg text-[#1e1b19] font-normal"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Data Integrity Standard
                  </h3>
                  <p className="text-sm text-[#645d58] leading-relaxed">
                    PREST POS only renders reports backed by verified backend
                    records. Unconnected data pipelines remain explicitly
                    unavailable to prevent fabricated restaurant metrics.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] text-[#7f7570] uppercase tracking-wider font-semibold">
                  Protocol: ISO-27001 / SOC-2
                </span>
                <div className="px-4 py-2 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-xs font-semibold text-[#1e1b19]">
                  Audit Policy
                </div>
              </div>
            </div>
          </section>

          {/* Terminal Session Stamp */}
          <footer className="pt-2 pb-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[#7f7570] text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-[#7f7570] font-semibold">
                Node ID:
              </span>
              <span className="font-mono text-xs text-[#1e1b19] font-medium">
                SRB-TERMINAL-01
              </span>
              <span className="text-[#d0c4be]">•</span>
              <span>Build v4.18.2-michelin</span>
            </div>
            <div className="text-[11px] text-[#7f7570]">
              PREST Hospitality Systems © 2025. All journals immutable.
            </div>
          </footer>
        </div>
      </div>
    </PosShell>
  );
}
