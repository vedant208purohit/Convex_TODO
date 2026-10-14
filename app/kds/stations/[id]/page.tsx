"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { PosShell } from "../../../components/PosShell";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface StationViewportProps {
  params: Promise<{ id: string }>;
}

export default function StationViewportPage({ params }: StationViewportProps) {
  const resolvedParams = use(params);
  const stationId = resolvedParams.id as Id<"stations">;
  const router = useRouter();

  // 1. Organization Context
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  // 2. Fetch Station Details
  const station = useQuery(
    api.stations.get,
    stationId ? { id: stationId } : "skip"
  );

  // 3. Fetch Real-Time Orders Routed to this Station
  const stationOrdersData = useQuery(
    api.stations.getStationOrders,
    stationId && activeOrg ? { organizationId: activeOrg._id, stationId } : "skip"
  );

  return (
    <PosShell title="KDS" subtitle={station?.name || "Station Viewport"}>
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#fff8f5] flex flex-col p-6 lg:p-8 space-y-6">
        {/* Top Navigation & Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e9e1dd]">
          <div className="flex items-center gap-3">
            <Link
              href="/kds"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#f4ece8] text-xs font-semibold text-[#1e1b19] hover:bg-[#eae1da] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              <span>Back to Dashboard</span>
            </Link>

            <div className="h-4 w-px bg-[#d0c4be]/60" />

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-xl font-garamond font-semibold text-[#1e1b19] uppercase tracking-tight">
                {station ? station.name : "Station Viewport"}
              </h1>
              {station?.isMain && (
                <span className="px-2 py-0.5 rounded-full bg-[#000000] text-white text-[10px] font-semibold uppercase tracking-wider">
                  Expo Pass
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <span className="text-xs uppercase tracking-wider text-[#7f7570] font-medium">
              Live Queue:
            </span>
            <span className="px-3 py-1 rounded-full bg-[#000000] text-white text-xs font-bold tabular-nums">
              {stationOrdersData?.activeOrdersCount ?? 0} active tickets
            </span>
          </div>
        </div>

        {/* Loading State */}
        {stationOrdersData === undefined && (
          <div className="p-12 text-center text-sm text-[#7f7570] animate-pulse">
            Loading station tickets...
          </div>
        )}

        {/* Station Tickets Content */}
        {stationOrdersData !== undefined && (
          <div>
            {stationOrdersData.orders.length === 0 ? (
              <div className="rounded-3xl border border-[#d0c4be]/40 bg-[#ffffff] p-12 text-center max-w-lg mx-auto shadow-xs space-y-3 mt-8">
                <div className="w-12 h-12 rounded-full bg-[#f4ece8] text-[#1e1b19] flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-garamond font-semibold text-[#1e1b19]">
                  No active orders for {station?.name}
                </h2>
                <p className="text-xs text-[#645d58]">
                  Kitchen tickets containing items mapped to this workstation will appear here in real time.
                </p>
                <div className="pt-2">
                  <Link
                    href="/kds"
                    className="inline-flex items-center px-4 py-2 rounded-full bg-[#000000] text-white text-xs font-semibold hover:bg-[#1d1b1a] transition-colors"
                  >
                    Return to Station Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {stationOrdersData.orders.map((ticket: any) => (
                  <div
                    key={ticket.order._id}
                    className="rounded-2xl border border-[#d0c4be]/40 bg-[#ffffff] p-5 shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-[#1e1b19]">
                          #{ticket.order.orderNumber || "ORD"}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#f4ece8] text-[#1e1b19]">
                          {ticket.order.orderType}
                        </span>
                      </div>

                      {ticket.order.tableNumber && (
                        <div className="text-xs font-medium text-[#645d58]">
                          Table: {ticket.order.tableNumber}
                        </div>
                      )}

                      <div className="border-t border-[#f4ece8] pt-2 space-y-1.5">
                        {ticket.orderItems.map((item: any) => (
                          <div key={item._id} className="flex items-start justify-between text-xs">
                            <span className="font-medium text-[#1e1b19]">
                              {item.quantity}x {item.itemName}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                item.isReady
                                  ? "bg-emerald-100 text-emerald-800 font-medium"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {item.isReady ? "Ready" : "Prep"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#f4ece8] text-[11px] text-[#7f7570] flex justify-between items-center">
                      <span>Status: {ticket.order.orderStatusName || "Active"}</span>
                      {ticket.allStationItemsReady && (
                        <span className="text-emerald-700 font-semibold">All Items Ready</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PosShell>
  );
}
