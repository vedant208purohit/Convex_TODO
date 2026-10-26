"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { PosShell } from "../components/PosShell";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type OrderTypeFilter = "all" | "dine-in" | "takeaway" | "delivery";

export default function WorkstationPage() {
  const router = useRouter();

  // 1. Organization Context
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  // 2. Active Tab & Filters
  const [activeFilter, setActiveFilter] = useState<OrderTypeFilter>("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // 3. Selected Order Drawer State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // 4. Live Clock Effect
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 5. Reactive Query to Authoritative Backend
  const workstationData = useQuery(
    api.workstation.listWorkstationOrders,
    activeOrg
      ? {
          organizationId: activeOrg._id,
          filter: activeFilter,
          viewMode: "active",
        }
      : "skip"
  );

  // 6. Lifecycle Mutation
  const advanceLifecycleMutation = useMutation(api.workstation.advanceOrderLifecycle);

  // Show Toast
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Sync selected order in drawer when background data updates
  useEffect(() => {
    if (selectedOrder && workstationData?.orders) {
      const refreshed = workstationData.orders.find((o) => o._id === selectedOrder._id);
      if (refreshed) {
        setSelectedOrder(refreshed);
      }
    }
  }, [workstationData?.orders, selectedOrder]);

  // Handle advancing an order
  const handleAdvanceOrder = async (e: React.MouseEvent | null, order: any) => {
    if (e) e.stopPropagation();
    if (actionInProgressId || !order.nextActionStatus) return;

    setActionInProgressId(order._id);
    try {
      const res = await advanceLifecycleMutation({
        orderId: order._id as Id<"orders">,
        targetStatus: order.nextActionStatus,
      });

      if (res?.success) {
        showToast(
          `Order ${order.orderNumber} advanced to ${res.newStatus || res.statusKey}`,
          "success"
        );
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to advance order status", "error");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Close filter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setIsFilterDropdownOpen(false);
    if (isFilterDropdownOpen) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [isFilterDropdownOpen]);

  const counts = workstationData?.counts || {
    all: 0,
    dineIn: 0,
    takeaway: 0,
    delivery: 0,
    completed: 0,
  };

  const getFilterLabel = () => {
    if (activeFilter === "dine-in") return `Dine In (${counts.dineIn})`;
    if (activeFilter === "takeaway") return `Takeaway (${counts.takeaway})`;
    if (activeFilter === "delivery") return `Delivery (${counts.delivery})`;
    return `All Orders (${counts.all})`;
  };

  const stationTitle = workstationData?.activeStation?.name || "Front Prep Counter #01";

  return (
    <PosShell
      title="Workstation"
      subtitle="Operational prep and dispatch queue. Review active tickets and advance orders in sequence."
    >
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-8 z-[9999] flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#141010] text-white shadow-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <span
            className={`w-2 h-2 rounded-full ${
              toast.type === "success" ? "bg-emerald-400" : "bg-red-400"
            }`}
          />
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto bg-[#fff8f5] flex flex-col">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 pb-16">
          {/* Operational Header Bar */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-serif text-[#1e1b19] tracking-tight">
                  Workstation
                </h1>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4ece8] text-[#1e1b19] text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="font-medium tracking-wide">{stationTitle}</span>
                </div>
                {currentTimeStr && (
                  <span className="text-xs font-mono text-[#7f7570] tracking-wider ml-1">
                    {currentTimeStr}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#7f7570] max-w-2xl">
                Operational prep and dispatch queue. Review active tickets and advance orders in sequence.
              </p>
            </div>

            {/* Filters & Actions */}
            <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
              {/* Filter Dropdown */}
              <div className="relative inline-block text-left">
                <button
                  id="filterMenuBtn"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterDropdownOpen((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white shadow-xs border border-[#e9e1dd] text-[#1e1b19] text-xs font-medium hover:bg-[#faf2ee] transition-all cursor-pointer"
                >
                  <span className="text-[#7f7570] font-normal">View as:</span>
                  <span>{getFilterLabel()}</span>
                  <svg
                    className="w-3.5 h-3.5 text-[#7f7570]"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {isFilterDropdownOpen && (
                  <div
                    className="absolute right-0 z-30 mt-1.5 w-48 origin-top-right rounded-2xl bg-white shadow-xl border border-[#e9e1dd] p-1.5 flex flex-col gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFilter("all");
                        setIsFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        activeFilter === "all"
                          ? "bg-[#faf2ee] text-[#0c0a09] font-semibold"
                          : "text-[#645d58] hover:bg-[#faf2ee]"
                      }`}
                    >
                      <span>All Orders</span>
                      <span className="font-mono text-[11px] text-[#7f7570]">
                        {counts.all}
                      </span>
                    </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilter("dine-in");
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      activeFilter === "dine-in"
                        ? "bg-[#faf2ee] text-[#0c0a09] font-semibold"
                        : "text-[#645d58] hover:bg-[#faf2ee]"
                    }`}
                  >
                    <span>Dine In</span>
                    <span className="font-mono text-[11px] text-[#7f7570]">{counts.dineIn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilter("takeaway");
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      activeFilter === "takeaway"
                        ? "bg-[#faf2ee] text-[#0c0a09] font-semibold"
                        : "text-[#645d58] hover:bg-[#faf2ee]"
                    }`}
                  >
                    <span>Takeaway</span>
                    <span className="font-mono text-[11px] text-[#7f7570]">{counts.takeaway}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilter("delivery");
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      activeFilter === "delivery"
                        ? "bg-[#faf2ee] text-[#0c0a09] font-semibold"
                        : "text-[#645d58] hover:bg-[#faf2ee]"
                    }`}
                  >
                    <span>Delivery</span>
                    <span className="font-mono text-[11px] text-[#7f7570]">{counts.delivery}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Refresh Queue Button */}
            <button
              type="button"
              onClick={() => {
                setIsRefreshing(true);
                setTimeout(() => setIsRefreshing(false), 500);
              }}
              title="Refresh Queue"
              className="w-8 h-8 rounded-full bg-white border border-[#e9e1dd] shadow-xs flex items-center justify-center text-[#1e1b19] hover:bg-[#faf2ee] active:scale-95 transition-all cursor-pointer"
            >
              <svg
                className={`w-4 h-4 transition-transform duration-500 ${
                  isRefreshing ? "rotate-180" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          </div>
        </div>

        {/* Operational Queue Table Container */}
        <div className="w-full flex flex-col rounded-2xl bg-white border border-[#e9e1dd] shadow-xs overflow-hidden">
          {/* Desktop Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-2 px-6 py-3.5 bg-[#faf2ee] border-b border-[#e9e1dd] text-[#7f7570] text-[11px] font-semibold uppercase tracking-wider">
            <div className="col-span-2">Order / Token</div>
            <div className="col-span-2">Destination</div>
            <div className="col-span-2">Customer</div>
            <div className="col-span-3">Items &amp; Specification</div>
            <div className="col-span-1">Ordered</div>
            <div className="col-span-2 text-right">Status &amp; Next Action</div>
          </div>

          {/* Loading State */}
          {!workstationData && (
            <div className="py-20 flex flex-col items-center justify-center text-[#7f7570] gap-3">
              <svg
                className="w-6 h-6 animate-spin text-[#0c0a09]"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span className="text-xs">Loading operational tickets...</span>
            </div>
          )}

          {/* Empty State */}
          {workstationData && workstationData.orders.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-full bg-[#faf2ee] flex items-center justify-center text-[#7f7570] mb-3">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-medium text-[#1e1b19]">No Orders in Queue</h3>
              <p className="text-xs text-[#7f7570] max-w-sm mt-1">
                All active workstation tickets have been prepared and delivered.
              </p>
            </div>
          )}

          {/* Orders Rows Stream */}
          {workstationData && workstationData.orders.length > 0 && (
            <div className="flex flex-col divide-y divide-[#f4ece8]">
              {workstationData.orders.map((order) => {
                const isItemActionPending = actionInProgressId === order._id;

                return (
                  <div
                    key={order._id}
                    onClick={() => setSelectedOrder(order)}
                    className="group grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-2 px-6 py-4 hover:bg-[#faf2ee]/70 transition-colors cursor-pointer"
                  >
                    {/* Order / Token */}
                    <div className="col-span-2 flex flex-row lg:flex-col justify-between lg:justify-center items-start gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${
                            order.isCompleted
                              ? "bg-[#645d58] text-white"
                              : "bg-[#0c0a09] text-white"
                          }`}
                        >
                          {order.tokenNumber ? `TK #${order.tokenNumber}` : "TK #0000"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[#1e1b19] hover:text-black transition-colors pt-0.5">
                        <span className="font-mono text-xs font-semibold">
                          {order.orderNumber}
                        </span>
                        <svg
                          className="w-3.5 h-3.5 text-[#7f7570]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M7 17l9.2-9.2M17 17V7H7" />
                        </svg>
                      </div>
                    </div>

                    {/* Destination */}
                    <div className="col-span-2 flex items-center">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#1e1b19] shrink-0">
                          {order.orderType === "DineIn" ? (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 10h18M5 10v10M19 10v10M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
                            </svg>
                          ) : order.orderType === "TakeAway" || order.orderType === "ScheduledPickup" ? (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                              <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="5.5" cy="17.5" r="3.5" />
                              <circle cx="18.5" cy="17.5" r="3.5" />
                              <path d="M15 6h-5l-3 6.5h11zM18.5 6a3 3 0 0 1 3 3v2M12 12.5V8" />
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-[#1e1b19] font-medium leading-tight">
                            {order.destinationTypeLabel}
                          </span>
                          <span className="text-[11px] text-[#7f7570] leading-tight">
                            {order.destinationDetails}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Customer */}
                    <div className="col-span-2 flex items-center">
                      <div className="flex flex-col">
                        <span className="text-xs text-[#1e1b19] font-medium">
                          {order.customerName}
                        </span>
                        <span className="text-[11px] text-[#7f7570] font-mono tracking-tight">
                          {order.customerPhone}
                        </span>
                      </div>
                    </div>

                    {/* Items & Station */}
                    <div className="col-span-3 flex flex-col justify-center gap-1">
                      <div className="flex flex-col gap-0.5 text-xs text-[#1e1b19]">
                        {order.items.slice(0, 3).map((item: any, idx: number) => (
                          <span key={item._id || idx} className="line-clamp-1">
                            <strong className="font-semibold text-black">
                              {item.qty}×
                            </strong>{" "}
                            {item.name}
                          </span>
                        ))}
                        {order.items.length > 3 && (
                          <span className="text-[10px] text-[#7f7570] italic">
                            +{order.items.length - 3} more items
                          </span>
                        )}
                      </div>
                      <div className="pt-0.5">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-[#f4ece8] text-[#7f7570] text-[10px] tracking-wider uppercase font-medium">
                          {order.primaryStationName}
                        </span>
                      </div>
                    </div>

                    {/* Time */}
                    <div className="col-span-1 flex items-center">
                      <div className="flex flex-col">
                        <span className="text-xs text-[#1e1b19] font-medium">
                          {order.formattedTime}
                        </span>
                        <span className="text-[11px] text-[#7f7570]">
                          {order.relativeAge}
                        </span>
                      </div>
                    </div>

                    {/* Status & Next Action Button */}
                    <div className="col-span-2 flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-1.5">
                      {/* Status Badge */}
                      <div>
                        {order.statusKey === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold tracking-wide">
                            <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {order.statusBadgeText}
                          </span>
                        ) : order.statusKey === "READY" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100/70 text-amber-900 text-xs font-semibold tracking-wide">
                            <span className="w-2 h-2 rounded-full bg-amber-700" />
                            {order.statusBadgeText}
                          </span>
                        ) : order.statusKey === "IN_PROGRESS" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold tracking-wide">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            IN PROGRESS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-stone-800 text-xs font-semibold tracking-wide">
                            <span className="w-2 h-2 rounded-full bg-stone-500" />
                            ACCEPTED
                          </span>
                        )}
                      </div>

                      {/* Action Button */}
                      {order.nextActionLabel && (
                        <div>
                          <button
                            type="button"
                            disabled={isItemActionPending}
                            onClick={(e) => handleAdvanceOrder(e, order)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide shadow-xs active:scale-95 transition-all cursor-pointer ${
                              order.statusKey === "READY"
                                ? "bg-amber-900 text-white hover:bg-amber-950"
                                : "bg-[#0c0a09] text-white hover:bg-neutral-800"
                            } ${isItemActionPending ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            {isItemActionPending ? "SAVING..." : order.nextActionLabel}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Operational Flow Reference Footnote */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-[#7f7570] text-xs px-2 gap-2">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-[#7f7570]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <span>Click any row to open the complete ticket specification, kitchen routing, and guest ledger.</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>ACCEPTED</span>
            <span>→</span>
            <span>IN PROGRESS</span>
            <span>→</span>
            <span>READY</span>
            <span>→</span>
            <span className="text-[#1e1b19] font-semibold">DELIVERED</span>
          </div>
        </div>
        </div>
      </div>

      {/* Slide-Over Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedOrder(null)}
            className="fixed inset-0 bg-neutral-950/30 backdrop-blur-[2px] transition-opacity duration-300"
          />

          {/* Drawer Panel */}
          <aside className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-white shadow-2xl z-50 transition-transform duration-300 ease-out flex flex-col justify-between overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 bg-[#faf2ee] border-b border-[#e9e1dd] flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#0c0a09] text-white text-xs font-semibold">
                    {selectedOrder.tokenNumber ? `TK #${selectedOrder.tokenNumber}` : "TK #0000"}
                  </span>
                  <span className="font-mono text-sm font-semibold text-[#1e1b19]">
                    {selectedOrder.orderNumber}
                  </span>
                </div>
                <h2 className="text-xl font-serif text-[#1e1b19] font-normal pt-1">
                  Order Folio Details
                </h2>
                <span className="text-xs text-[#7f7570]">
                  {selectedOrder.formattedTime} • {selectedOrder.relativeAge}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#1e1b19] hover:bg-[#e9e1dd] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {/* Routing & Station Status */}
              <div className="p-4 rounded-xl bg-[#faf2ee] border border-[#e9e1dd] flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#7f7570] font-semibold uppercase tracking-wider text-[10px]">
                    Hardware Routing
                  </span>
                  <span className="text-emerald-800 font-medium">
                    {stationTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#7f7570] font-semibold uppercase tracking-wider text-[10px]">
                    Station Category
                  </span>
                  <span className="text-[#1e1b19] font-medium">
                    {selectedOrder.primaryStationName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#7f7570] font-semibold uppercase tracking-wider text-[10px]">
                    Dining Destination
                  </span>
                  <span className="text-[#1e1b19] font-medium">
                    {selectedOrder.destinationTypeLabel} · {selectedOrder.destinationDetails}
                  </span>
                </div>
              </div>

              {/* Guest Profile */}
              <div className="flex flex-col gap-2">
                <span className="text-[#7f7570] font-semibold uppercase tracking-wider text-[10px]">
                  Customer Profile
                </span>
                <div className="flex items-center justify-between p-4 rounded-xl bg-[#faf2ee] border border-[#e9e1dd]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#0c0a09] text-white flex items-center justify-center text-sm font-semibold">
                      {selectedOrder.avatarInitial}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#1e1b19]">
                        {selectedOrder.customerName}
                      </span>
                      <span className="text-xs text-[#7f7570] font-mono">
                        {selectedOrder.customerPhone}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white border border-[#e9e1dd] text-[#1e1b19] text-[11px] font-medium">
                    Loyalty Tier I
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[#7f7570] font-semibold uppercase tracking-wider text-[10px]">
                    Kitchen Prep Items ({selectedOrder.items.length})
                  </span>
                  <span className="text-[10px] text-[#7f7570] font-mono">
                    Token #{selectedOrder.tokenNumber || "0000"}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {selectedOrder.items.map((item: any, idx: number) => (
                    <div
                      key={item._id || idx}
                      className="p-3 rounded-xl bg-[#faf2ee] border border-[#e9e1dd] flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-[#1e1b19]">
                          <span className="w-5 h-5 rounded-full bg-white border border-[#e9e1dd] font-semibold flex items-center justify-center font-mono text-[11px]">
                            {item.qty}
                          </span>
                          <span className="font-medium">{item.name}</span>
                          {item.isReady && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                              Ready
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-[#1e1b19] font-medium">
                          {item.price}
                        </span>
                      </div>
                      {item.spec && (
                        <span className="text-[11px] text-[#7f7570] pl-7 italic">
                          Note: {item.spec}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Chef Kitchen Note */}
              {selectedOrder.specialNotes ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/60 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-amber-900 text-xs font-semibold">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Chef Kitchen Note</span>
                  </div>
                  <p className="text-xs text-amber-950">
                    {selectedOrder.specialNotes}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/50 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-amber-900 text-xs font-semibold">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Chef Kitchen Note</span>
                  </div>
                  <p className="text-xs text-amber-950">
                    Serve hot directly upon dispatch. Ensure presentation meets brigade standards.
                  </p>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-6 bg-[#faf2ee] border-t border-[#e9e1dd] flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7f7570]">
                  Current Status
                </span>
                <span className="text-sm font-semibold text-[#1e1b19]">
                  {selectedOrder.statusBadgeText}
                </span>
              </div>

              {selectedOrder.nextActionLabel && (
                <button
                  type="button"
                  disabled={actionInProgressId === selectedOrder._id}
                  onClick={(e) => handleAdvanceOrder(e, selectedOrder)}
                  className={`px-6 py-2.5 rounded-full text-xs font-medium tracking-wide shadow-xs active:scale-95 transition-all cursor-pointer ${
                    selectedOrder.statusKey === "READY"
                      ? "bg-amber-900 text-white hover:bg-amber-950"
                      : "bg-[#0c0a09] text-white hover:bg-neutral-800"
                  } ${
                    actionInProgressId === selectedOrder._id
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {actionInProgressId === selectedOrder._id
                    ? "SAVING..."
                    : selectedOrder.nextActionLabel}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </PosShell>
  );
}
