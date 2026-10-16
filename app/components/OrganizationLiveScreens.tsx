/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getTimezoneForCountry, formatStoreTime } from "../../lib/constants/countries";

type FilterType = "All orders" | "Takeaway orders" | "Dine-in orders";

interface OrganizationLiveScreensProps {
  standalone?: boolean;
  onBack?: () => void;
}

interface StepItem {
  id?: string;
  name: string;
  status: "done" | "active" | "upcoming";
  durationText: string;
  subText: string;
}

interface LiveOrderActivity {
  _id?: string;
  orderId?: string;
  processId?: string;
  processName?: string;
  status?: string;
  totalDuration?: number;
  completedAt?: number;
  createdAt?: number;
  [key: string]: unknown;
}

interface LiveOrderItem {
  _id?: string;
  name?: string;
  itemName?: string;
  quantity?: number;
  price?: number;
  status?: string;
  [key: string]: unknown;
}

interface LiveOrder {
  _id: string;
  orderNumber?: string;
  tokenNumber?: string | number;
  orderType?: string;
  orderStatusId?: string;
  orderStatusName?: string;
  isCompleted?: boolean;
  isRejected?: boolean;
  isPaid?: boolean;
  totalAmount?: number;
  createdAt?: number;
  updatedAt?: number;
  table?: { number?: string | number; [key: string]: unknown };
  tableNumber?: string | number;
  activities?: LiveOrderActivity[];
  orderItems?: LiveOrderItem[];
  items?: LiveOrderItem[];
  [key: string]: unknown;
}

export function OrganizationLiveScreens({
  standalone = false,
  onBack,
}: OrganizationLiveScreensProps) {
  const router = useRouter();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [liveTimestamp, setLiveTimestamp] = useState(0);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // 1. Resolve Active Organization (matches old project localStorage scoping before fallback)
  const organizations = useQuery(api.organizations.list);
  const activeOrg = useMemo(() => {
    if (!organizations || organizations.length === 0) return null;
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlOrgId = urlParams.get("orgId") || urlParams.get("organizationId");
      const storedOrgId =
        urlOrgId ||
        localStorage.getItem("organization_id") ||
        localStorage.getItem("active_organization_id") ||
        localStorage.getItem("pos_active_org_id");

      if (storedOrgId) {
        const match = organizations.find(
          (o) => o && (o._id === storedOrgId || (o as any).legacyId === storedOrgId)
        );
        if (match) return match;
      }
    }
    return organizations[0];
  }, [organizations]);

  // Resolve Store Timezone using countries.ts configuration and active organization settings
  const targetTimezone = useMemo(() => {
    if (activeOrg?.organizationTimeZone && activeOrg.organizationTimeZone.trim()) {
      return activeOrg.organizationTimeZone.trim();
    }
    if (activeOrg?.country && activeOrg.country.trim()) {
      return getTimezoneForCountry(activeOrg.country.trim());
    }
    return getTimezoneForCountry("India");
  }, [activeOrg]);

  // 1-second live clock ticker (HH:MM:SS in store/country timezone) & live elapsed duration updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTimestamp(now.getTime());

      try {
        const formatter = new Intl.DateTimeFormat("en-GB", {
          timeZone: targetTimezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        });
        const parts = formatter.formatToParts(now);
        const hours = parts.find((p) => p.type === "hour")?.value ?? String(now.getHours()).padStart(2, "0");
        const minutes = parts.find((p) => p.type === "minute")?.value ?? String(now.getMinutes()).padStart(2, "0");
        const seconds = parts.find((p) => p.type === "second")?.value ?? String(now.getSeconds()).padStart(2, "0");
        setCurrentTime(`${hours}:${minutes}:${seconds}`);
      } catch {
        // Safe fallback to client local time if timezone is invalid or unsupported
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        setCurrentTime(`${hours}:${minutes}:${seconds}`);
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [targetTimezone]);

  // 2. Query Configured Order Processes (Dynamic stages from store configuration)
  const orderProcesses = useQuery(
    api.organizationOrderProcesses.list,
    activeOrg ? { published: true } : "skip"
  );

  const sequenceProcesses = useMemo(() => {
    if (!orderProcesses) return [];
    return orderProcesses
      .filter((p) => p.published && p.isSequence !== false)
      .sort((a, b) => a.position - b.position);
  }, [orderProcesses]);

  // Last configured sequence step (e.g. "Delivered")
  const lastProcess = useMemo(() => {
    if (sequenceProcesses.length === 0) return null;
    return sequenceProcesses[sequenceProcesses.length - 1];
  }, [sequenceProcesses]);

  // 3. Query Live Orders Stream (Reactive primary subscription)
  const liveOrdersData = useQuery(
    api.orders.listLiveOrders,
    activeOrg ? { organizationId: activeOrg._id } : "skip"
  );

  // 4. Query Cashier / Recent Orders (Safe boundary to capture Takeaway orders without historical pollution)
  const allOrdersData = useQuery(
    api.orders.listOrders,
    activeOrg ? { organizationId: activeOrg._id, pageSize: 50 } : "skip"
  );

  // 5. Genuine Order Completion Determination:
  // - Genuinely completed/delivered orders disappear immediately (no 60-second delay)
  // - Pending and In-Progress orders remain visible indefinitely until actually completed
  // - Payment completion (e.g. paid TakeAway checkout) is NOT treated as fulfillment completion
  // - Cancelled/rejected orders are excluded immediately
  const isOrderCompleted = useCallback(
    (order: LiveOrder): boolean => {
      // 1. Immediate exclusion for cancelled or rejected orders
      if (
        order.isRejected ||
        (order.orderStatusName || "").trim().toLowerCase() === "cancelled" ||
        (order.orderStatusName || "").trim().toLowerCase() === "rejected"
      ) {
        return true;
      }

      const activities = Array.isArray(order.activities) ? order.activities : [];

      // 2. Check activities: has the order recorded an activity for the last configured process?
      const finalActivity = lastProcess
        ? activities.find(
            (a: LiveOrderActivity) =>
              (a.processId && a.processId === lastProcess._id) ||
              (a.processName &&
                a.processName.trim().toLowerCase() ===
                  lastProcess.name.trim().toLowerCase())
          )
        : null;

      // 3. Check status: has the order reached the last configured process or explicit terminal stage?
      const isAtFinalStage =
        Boolean(finalActivity) ||
        (lastProcess &&
          (order.orderStatusId === lastProcess._id ||
            (order.orderStatusName || "").trim().toLowerCase() ===
              lastProcess.name.trim().toLowerCase())) ||
        (order.orderStatusName || "").trim().toLowerCase() === "delivered" ||
        (order.orderStatusName || "").trim().toLowerCase() === "completed";

      if (isAtFinalStage) {
        // Disappear immediately without delay once genuinely completed
        return true;
      }

      // 4. Dine-In order completion:
      // For Dine-In, isCompleted === true ONLY happens when checkout/settlement is completed via completeOrder
      const type = (order.orderType || "").toLowerCase();
      const isDineIn =
        type === "dinein" ||
        type === "dine_in" ||
        type === "dine in";

      if (isDineIn && order.isCompleted) {
        return true;
      }

      // Pending and in-progress orders (including paid TakeAway/Delivery in preparation) remain visible!
      return false;
    },
    [lastProcess]
  );

  // 6. Merge Live and Recent In-Progress Orders (No historical pollution, pending orders preserved)
  const mergedOrders = useMemo(() => {
    const liveList = Array.isArray(liveOrdersData) ? liveOrdersData : [];
    const allList = Array.isArray(allOrdersData?.orders)
      ? allOrdersData.orders
      : [];

    const orderMap = new Map<string, LiveOrder>();

    // Add all legitimate uncompleted active orders from live stream
    for (const ord of liveList) {
      if (ord && ord._id) {
        if (!isOrderCompleted(ord as LiveOrder)) {
          orderMap.set(String(ord._id), ord as LiveOrder);
        }
      }
    }

    // Incorporate active/pending orders from allOrdersData (e.g. Takeaway checkout orders)
    for (const ord of allList) {
      if (!ord || !ord._id) continue;
      const ordId = String(ord._id);

      // Already present with full enriched activity details from listLiveOrders
      if (orderMap.has(ordId)) continue;

      // Exclude genuinely completed, delivered, cancelled, or rejected orders
      if (isOrderCompleted(ord as LiveOrder)) {
        continue;
      }

      // Actively in-progress or pending order (e.g. paid TakeAway order in preparation)
      orderMap.set(ordId, ord as LiveOrder);
    }

    const combined = Array.from(orderMap.values());
    return combined.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [liveOrdersData, allOrdersData, isOrderCompleted]);

  const isLoading = activeOrg
    ? liveOrdersData === undefined || allOrdersData === undefined || orderProcesses === undefined
    : organizations === undefined;

  const [selectedFilter, setSelectedFilter] = useState<FilterType>("All orders");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Filtered orders list (All / Takeaway / Dine-In)
  const filteredOrders = useMemo(() => {
    return mergedOrders.filter((order) => {
      if (isOrderCompleted(order)) return false;

      const type = (order.orderType || "").toLowerCase();
      if (selectedFilter === "Dine-in orders") {
        return (
          type === "dinein" ||
          type === "dine_in" ||
          type === "dine in"
        );
      }
      if (selectedFilter === "Takeaway orders") {
        return (
          type === "takeaway" ||
          type === "take_away" ||
          type === "take away" ||
          type === "scheduledpickup" ||
          type === "scheduled_pickup" ||
          type === "scheduled pickup" ||
          type === "delivery" ||
          type === "scheduleddelivery" ||
          type === "scheduled_delivery"
        );
      }
      return true;
    });
  }, [mergedOrders, selectedFilter, isOrderCompleted]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/settings");
    }
  };

  const formatDuration = (durSec?: number): string => {
    if (durSec === undefined || durSec === null || isNaN(durSec) || durSec <= 0) return "--:--";
    const hh = Math.floor(durSec / 3600);
    const mm = Math.floor((durSec % 3600) / 60);
    const ss = Math.floor(durSec % 60);
    if (hh > 0) {
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    }
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const getRealOrderElapsed = (order: LiveOrder): string => {
    const start = order.updatedAt || order.createdAt || (liveTimestamp || 0);
    const elapsedSec = liveTimestamp > 0 ? Math.max(0, Math.floor((liveTimestamp - start) / 1000)) : 0;
    const hh = Math.floor(elapsedSec / 3600);
    const mm = Math.floor((elapsedSec % 3600) / 60);
    const ss = elapsedSec % 60;
    if (hh > 0) {
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    }
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  // Dynamic Pipeline Resolution (Derived entirely from store sequenceProcesses)
  const resolveOrderSteps = useCallback(
    (order: LiveOrder) => {
      const isTakeaway =
        (order.orderType || "").toLowerCase().includes("takeaway") ||
        (order.orderType || "").toLowerCase().includes("take_away") ||
        (order.orderType || "").toLowerCase().includes("delivery") ||
        (order.orderType || "").toLowerCase().includes("pickup");

      const isDineIn = (order.orderType || "").toLowerCase().includes("dine");
      const tableNumber = order.table?.number || order.tableNumber;
      const activities: LiveOrderActivity[] = Array.isArray(order.activities)
        ? (order.activities as LiveOrderActivity[])
        : [];

      // Fallback default processes if sequenceProcesses is not yet loaded
      const processesToUse =
        sequenceProcesses.length > 0
          ? sequenceProcesses
          : [
              { _id: "p1", name: "Accepted", position: 1 },
              { _id: "p2", name: "In progress", position: 2 },
              { _id: "p3", name: "Ready to deliver", position: 3 },
              { _id: "p4", name: "Delivered", position: 4 },
            ];

      const currentStatusName = (order.orderStatusName || "").trim().toLowerCase();
      const currentStatusId = order.orderStatusId;

      // 1. Try matching by exact process name first
      let currentProcessIndex = processesToUse.findIndex(
        (p) => p.name.trim().toLowerCase() === currentStatusName
      );

      // 2. If name doesn't match directly, try by orderStatusId
      if (currentProcessIndex === -1 && currentStatusId) {
        currentProcessIndex = processesToUse.findIndex(
          (p) => p._id === currentStatusId
        );
      }

      // 3. Keyword-based matching fallback
      if (currentProcessIndex === -1) {
        if (currentStatusName.includes("deliver") || currentStatusName.includes("complet")) {
          currentProcessIndex = processesToUse.length - 1;
        } else if (currentStatusName.includes("ready")) {
          const readyIdx = processesToUse.findIndex((p) =>
            p.name.toLowerCase().includes("ready")
          );
          currentProcessIndex = readyIdx !== -1 ? readyIdx : processesToUse.length - 2;
        } else if (
          currentStatusName.includes("progress") ||
          currentStatusName.includes("cook") ||
          currentStatusName.includes("kitchen") ||
          currentStatusName.includes("prepar")
        ) {
          const progressIdx = processesToUse.findIndex(
            (p) =>
              p.name.toLowerCase().includes("progress") ||
              p.name.toLowerCase().includes("cook")
          );
          currentProcessIndex = progressIdx !== -1 ? progressIdx : 1;
        } else {
          currentProcessIndex = 0;
        }
      }

      let hasFoundActive = false;
      const steps: StepItem[] = processesToUse.map((proc, idx) => {
        const matchActivity = activities.find(
          (a: LiveOrderActivity) =>
            (a.processId && a.processId === proc._id) ||
            (a.processName &&
              a.processName.trim().toLowerCase() === proc.name.trim().toLowerCase())
        );

        const isDone =
          idx < currentProcessIndex ||
          Boolean(matchActivity?.completedAt) ||
          (typeof matchActivity?.totalDuration === "number" &&
            matchActivity.totalDuration > 0 &&
            idx < processesToUse.length - 1);

        let isActive = false;
        if (!isDone && !hasFoundActive) {
          isActive = true;
          hasFoundActive = true;
        }

        const status: "done" | "active" | "upcoming" = isDone
          ? "done"
          : isActive
          ? "active"
          : "upcoming";

        let durationText = "--:--";
        if (typeof matchActivity?.totalDuration === "number" && matchActivity.totalDuration > 0) {
          durationText = formatDuration(matchActivity.totalDuration);
        }

        let subText = "Upcoming";
        if (status === "done") {
          subText = "Completed";
        } else if (status === "active") {
          subText = proc.name.toLowerCase().includes("ready")
            ? isTakeaway
              ? "Ready for Pickup"
              : "Plated & Ready"
            : "In Preparation";
        }

        return {
          id: proc._id,
          name: proc.name,
          status,
          durationText,
          subText,
        };
      });

      const isReady = steps.some(
        (s) => s.status === "active" && s.name.toLowerCase().includes("ready")
      );

      return {
        isReady,
        steps,
        isDineIn,
        isTakeaway,
        tableNumber,
      };
    },
    [sequenceProcesses]
  );

  // Ready Orders for Top Callout Banner (show all orders currently in Ready state)
  const readyOrders = useMemo(() => {
    if (filteredOrders.length === 0) return [];
    const list: Array<{
      order: LiveOrder;
      tokenDisplay: string | number;
      orderNumber: string;
      tableLabel: string;
    }> = [];
    for (let i = 0; i < filteredOrders.length; i++) {
      const ord = filteredOrders[i];
      const resolved = resolveOrderSteps(ord);
      if (resolved.isReady) {
        list.push({
          order: ord,
          tokenDisplay: ord.tokenNumber || "#",
          orderNumber: ord.orderNumber || "",
          tableLabel: resolved.tableNumber
            ? `Table ${resolved.tableNumber}`
            : "Pickup Counter",
        });
      }
    }
    return list;
  }, [filteredOrders, resolveOrderSteps]);


  const containerClasses = standalone
    ? "h-[100dvh] max-h-[100dvh] w-full bg-[#fff8f5] text-[#1e1b19] flex flex-col relative select-none overflow-hidden selection:bg-[#eae1da] selection:text-[#1f1b17]"
    : "fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] w-full bg-[#fff8f5] text-[#1e1b19] flex flex-col relative select-none overflow-hidden selection:bg-[#eae1da] selection:text-[#1f1b17]";

  return (
    <div className={containerClasses}>
      {/* Visual Animation Keyframes */}
      <style>{`
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45), 0 4px 16px rgba(16, 185, 129, 0.15);
          }
          50% {
            box-shadow: 0 0 0 7px rgba(16, 185, 129, 0), 0 6px 24px rgba(16, 185, 129, 0.28);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0), 0 4px 16px rgba(16, 185, 129, 0.15);
          }
        }

        @keyframes banner-glow {
          0%, 100% {
            box-shadow: 0 4px 20px -2px rgba(16, 185, 129, 0.35);
            border-color: #10b981;
          }
          50% {
            box-shadow: 0 2px 10px -2px rgba(16, 185, 129, 0.15);
            border-color: #6ee7b7;
          }
        }

        .ready-card-pulse {
          animation: pulse-ring 2.2s infinite ease-in-out;
        }

        .ready-banner-pulse {
          animation: banner-glow 2s infinite ease-in-out;
        }

        /* Hide scrollbars on mobile swipe containers while preserving touch scroll */
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* TOP HEADER */}
      <header className="flex-shrink-0 sticky top-0 left-0 right-0 z-30 bg-[#fff8f5]/95 backdrop-blur-md border-b border-[#e7e5e4] shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
        <div className="h-14 sm:h-16 w-full px-2.5 xs:px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-1.5 sm:gap-4">
          {/* Left: Navigation brand / title */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={handleBack}
              title="Return to Settings"
              className="flex items-center gap-1.5 sm:gap-2 text-[#1e1b19] hover:text-black transition-colors cursor-pointer group min-w-0"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px] text-[#645d58] group-hover:text-black transition-colors shrink-0">
                arrow_back
              </span>
              <span className="font-serif text-sm sm:text-base md:text-xl tracking-tight font-bold text-[#141010] truncate leading-tight">
                {activeOrg?.name ? `${activeOrg.name} Live orders` : "Live orders"}
              </span>
            </button>

            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                LIVE STREAM
              </span>
            </div>
          </div>

          {/* Right: Telemetry, View Filter & Fullscreen */}
          <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-3 shrink-0">
            {/* Live Clock */}
            <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-[#1e1b19] tabular-nums bg-[#faf2ee] px-2 sm:px-3 py-1 rounded-full border border-[#e7e5e4] shrink-0">
              <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-[#645d58]">
                schedule
              </span>
              <span className="font-semibold text-[#141010]">{currentTime || "00:00:00"}</span>
            </div>

            {/* Total Orders Count */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4ece8] border border-[#e7e5e4] shrink-0">
              <span className="text-xs text-[#4d4541] font-medium">Total:</span>
              <span className="text-xs font-bold text-[#141010]">{filteredOrders.length}</span>
            </div>

            {/* Filter Dropdown */}
            <div className="relative shrink-0" ref={filterDropdownRef}>
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full bg-[#f4ece8] hover:bg-[#eae1da] border border-[#e7e5e4] text-[11px] sm:text-xs font-medium text-[#1e1b19] transition cursor-pointer whitespace-nowrap"
                title="Filter order view"
              >
                <span className="material-symbols-outlined text-[14px] sm:text-[15px] text-[#645d58]">
                  sort
                </span>
                <span className="hidden sm:inline">
                  View: <strong className="text-[#141010] font-semibold">{selectedFilter}</strong>
                </span>
                <span className="sm:hidden font-semibold text-[#141010]">
                  {selectedFilter === "All orders" ? "All" : selectedFilter === "Takeaway orders" ? "Takeaway" : "Dine-in"}
                </span>
                <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-[#645d58]">
                  {isFilterDropdownOpen ? "expand_less" : "expand_more"}
                </span>
              </button>

              {isFilterDropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 sm:w-48 rounded-xl bg-white border border-[#e7e5e4] shadow-lg py-1 z-50 text-xs">
                  {(["All orders", "Takeaway orders", "Dine-in orders"] as FilterType[]).map(
                    (filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => {
                          setSelectedFilter(filter);
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 font-medium flex items-center justify-between transition cursor-pointer ${
                          selectedFilter === filter
                            ? "bg-[#faf2ee] text-[#141010] font-semibold"
                            : "text-[#4d4541] hover:bg-stone-50"
                        }`}
                      >
                        <span>{filter}</span>
                        {selectedFilter === filter && (
                          <span className="material-symbols-outlined text-[15px] text-emerald-600">
                            check
                          </span>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              className="flex items-center justify-center gap-1 sm:gap-1.5 w-7 h-7 sm:w-auto px-0 sm:px-3 py-1 rounded-full bg-[#f4ece8] hover:bg-[#eae1da] border border-[#e7e5e4] text-xs font-medium text-[#1e1b19] transition cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px] text-[#645d58]">
                {isFullscreen ? "fullscreen_exit" : "fullscreen"}
              </span>
              <span className="hidden sm:inline">
                {isFullscreen ? "Exit fullscreen" : "View fullscreen"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto min-h-0 max-w-[1920px] w-full mx-auto p-2.5 xs:p-3 sm:p-5 lg:p-8 flex flex-col gap-3.5 sm:gap-6 relative z-10 scrollbar-thin">
        {/* TOP CALLOUT: ORDER READY NOTIFICATION (ALL READY ORDERS) */}
        {readyOrders.length > 0 && (
          <>
            {/* 1. Mobile & Narrow Fold Phones (< sm): Horizontal Swipeable Strip */}
            <div className="w-full flex flex-col gap-1.5 sm:hidden">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                  </span>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
                    Ready to Deliver ({readyOrders.length})
                  </span>
                </div>
                {readyOrders.length > 1 && (
                  <span className="text-[10px] text-emerald-700/80 font-medium">Swipe cards ➔</span>
                )}
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1.5 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
                {readyOrders.map((ro) => (
                  <div
                    key={ro.order._id || ro.orderNumber}
                    className="ready-banner-pulse min-w-[250px] max-w-[290px] shrink-0 snap-start rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-md p-2.5 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur-sm shrink-0 flex items-center justify-center font-serif font-black text-base">
                        {ro.tokenDisplay}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold uppercase tracking-widest text-[9px] text-emerald-200 truncate">
                          Ready to Deliver
                        </span>
                        <span className="font-serif font-bold text-xs truncate">
                          Order {ro.orderNumber}
                        </span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-white/20 font-bold uppercase tracking-wide px-2 py-0.5 text-[10px] shrink-0 whitespace-nowrap">
                      <span className="material-symbols-outlined text-[13px]">room_service</span>
                      <span>{ro.tableLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Tablet, Laptop, PC, Mac (>= sm): Responsive Grid */}
            <div
              className={`hidden sm:grid ${
                readyOrders.length <= 1
                  ? "grid-cols-1"
                  : readyOrders.length === 2
                  ? "grid-cols-2"
                  : readyOrders.length === 3
                  ? "grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              } gap-2.5 lg:gap-3 w-full`}
            >
              {readyOrders.map((ro) => {
                const count = readyOrders.length;
                const isFourCol = count === 4 || count >= 7;
                const isThreeCol = count === 3 || count === 5 || count === 6;

                return (
                  <div
                    key={ro.order._id || ro.orderNumber}
                    className={`ready-banner-pulse w-full rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg flex items-center justify-between transition-all ${
                      count === 1
                        ? "p-4 sm:p-5 gap-4"
                        : isFourCol
                        ? "p-2.5 sm:p-3 gap-2"
                        : isThreeCol
                        ? "p-3 sm:p-3.5 gap-2.5 sm:gap-3"
                        : "p-3.5 sm:p-4 gap-3 sm:gap-4"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div
                        className={`rounded-xl bg-white/15 backdrop-blur-sm flex-shrink-0 flex items-center justify-center font-serif font-black ${
                          count === 1
                            ? "w-12 h-12 text-2xl"
                            : isFourCol
                            ? "w-9 h-9 sm:w-10 sm:h-10 text-base sm:text-lg"
                            : "w-10 h-10 sm:w-11 sm:h-11 text-lg sm:text-xl"
                        }`}
                      >
                        {ro.tokenDisplay}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span
                          className={`font-extrabold uppercase tracking-widest text-emerald-200 whitespace-nowrap ${
                            isFourCol ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-[11px]"
                          }`}
                        >
                          Ready to Deliver
                        </span>
                        <span
                          className={`font-serif font-bold whitespace-nowrap truncate ${
                            count === 1
                              ? "text-lg sm:text-xl"
                              : isFourCol
                              ? "text-xs sm:text-sm"
                              : "text-sm sm:text-base"
                          }`}
                        >
                          Order {ro.orderNumber}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full bg-white/20 font-bold uppercase tracking-wide flex-shrink-0 whitespace-nowrap ${
                        isFourCol
                          ? "px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px]"
                          : "px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined ${
                          isFourCol ? "text-[14px]" : "text-[15px] sm:text-[16px]"
                        }`}
                      >
                        room_service
                      </span>
                      <span>{ro.tableLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ORDER CARDS STACK */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[260px] sm:min-h-[360px] gap-3 text-[#645d58] bg-white rounded-xl sm:rounded-2xl border border-[#e7e5e4] p-6 sm:p-8 shadow-xs">
            <div className="w-8 h-8 border-3 border-stone-200 border-t-[#141010] rounded-full animate-spin" />
            <p className="text-xs sm:text-sm font-medium font-sans">Loading live orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[260px] sm:min-h-[360px] gap-3 p-6 sm:p-8 text-center text-[#645d58] bg-white rounded-xl sm:rounded-2xl border border-[#e7e5e4] shadow-xs">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#faf2ee] flex items-center justify-center text-[#645d58]">
              <span className="material-symbols-outlined text-[28px] sm:text-[32px]">no_food</span>
            </div>
            <p className="text-base sm:text-lg font-semibold text-[#1e1b19]">
              No live orders available
            </p>
            <p className="text-xs sm:text-sm text-[#645d58] max-w-md">
              Orders created at the cashier counter or via digital ordering will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 sm:gap-3.5 w-full select-none">
            {filteredOrders.map((order, orderIdx) => {
              const {
                isReady,
                steps,
                isDineIn,
                isTakeaway,
                tableNumber,
              } = resolveOrderSteps(order);

              const isNewest = orderIdx === 0;
              const tokenDisplay = order.tokenNumber || "#";
              const orderNumDisplay = order.orderNumber || "";
              const elapsedDisplay = getRealOrderElapsed(order);

              const cardClass = isReady
                ? "ready-card-pulse w-full rounded-xl sm:rounded-2xl border-2 border-emerald-500 p-3 xs:p-3.5 sm:p-4 lg:p-5 bg-gradient-to-r from-emerald-50/90 via-emerald-100/30 to-emerald-50/70 transition-all relative overflow-hidden"
                : isNewest
                ? "w-full bg-white rounded-xl sm:rounded-2xl border-2 border-stone-300 p-3 xs:p-3.5 sm:p-4 lg:p-5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow relative overflow-hidden"
                : "w-full bg-white rounded-xl sm:rounded-2xl border border-[#e7e5e4] p-3 xs:p-3.5 sm:p-4 lg:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow relative overflow-hidden";

              const orderBadge = isTakeaway ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-orange-50/70 border border-orange-200 text-orange-950 shadow-2xs shrink-0">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-orange-800">
                    shopping_bag
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-orange-950 whitespace-nowrap">
                      {order.orderType === "Delivery" ? "Delivery" : "Take Away"}
                    </span>
                  </div>
                </div>
              ) : isDineIn ? (
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl shrink-0 ${
                    isReady
                      ? "bg-emerald-200/90 border border-emerald-400 text-emerald-950 shadow-xs"
                      : "bg-[#f4ece8] border border-[#e7e5e4] shadow-2xs"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[16px] sm:text-[18px] ${
                      isReady ? "text-emerald-900" : "text-[#141010]"
                    }`}
                  >
                    table_restaurant
                  </span>
                  <div className="flex flex-col">
                    <span
                      className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
                        isReady ? "font-black text-emerald-950" : "text-[#141010]"
                      }`}
                    >
                      Dine In
                    </span>
                    {tableNumber && (
                      <span
                        className={`text-[9px] sm:text-[10px] whitespace-nowrap ${
                          isReady ? "text-emerald-900 font-bold" : "text-[#4d4541] font-medium"
                        }`}
                      >
                        Table {tableNumber}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#f4ece8] border border-[#e7e5e4] shadow-2xs shrink-0">
                  <span className="text-[10px] sm:text-xs font-bold text-[#141010] uppercase whitespace-nowrap">
                    {order.orderType || "Order"}
                  </span>
                </div>
              );

              return (
                <article key={order._id || `order-${orderIdx}`} className={cardClass}>
                  {/* Newest Order Ribbon */}
                  {isNewest && !isReady && (
                    <div className="absolute top-0 right-0">
                      <span className="bg-[#141010] text-white text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 sm:px-3 py-0.5 sm:py-1 rounded-bl-lg sm:rounded-bl-xl shadow-xs">
                        Newest
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col xl:flex-row xl:items-center gap-2.5 sm:gap-4 xl:gap-6 justify-between">
                    {/* TOP ROW FOR SCREENS < XL (Token & Order Number + Order Type Badge) */}
                    <div className="flex items-center justify-between gap-2.5 w-full xl:w-auto shrink-0">
                      {/* LEFT: Token & Order Number */}
                      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-serif text-lg sm:text-xl md:text-2xl font-bold shadow-xs shrink-0 ${
                            isReady
                              ? "bg-emerald-600 text-white"
                              : isNewest
                              ? "bg-amber-100/70 text-amber-900 border border-amber-200"
                              : "bg-[#f4ece8] text-[#141010] border border-[#e7e5e4]"
                          }`}
                        >
                          {tokenDisplay}
                        </div>
                        <div className="min-w-0">
                          <div className="font-serif text-base sm:text-xl lg:text-2xl font-extrabold tracking-tight leading-snug text-[#141010] truncate">
                            {orderNumDisplay}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] text-[#645d58] font-medium mt-0.5">
                            {order.createdAt ? (
                              <>
                                <span className="whitespace-nowrap">
                                  Time:{" "}
                                  <span className="font-bold text-[#141010]">
                                    {formatStoreTime(order.createdAt, targetTimezone, activeOrg?.country)}
                                  </span>
                                </span>
                                <span className="text-stone-300">•</span>
                              </>
                            ) : null}
                            <span className="whitespace-nowrap">
                              Elapsed:{" "}
                              <span className="font-bold text-[#141010] tabular-nums">
                                {elapsedDisplay}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Order Type Badge: On < xl screens, aligns to the right in the top row */}
                      <div className="flex xl:hidden items-center justify-end shrink-0">
                        {orderBadge}
                      </div>
                    </div>

                    {/* CENTER: DYNAMIC STEPPER PIPELINE */}
                    <div className="w-full xl:flex-1 overflow-x-auto py-1 scrollbar-none">
                      <div className="flex items-center justify-start min-w-max w-full">
                        {steps.map((step, sIdx) => {
                          const isFirst = sIdx === 0;
                          const hasDuration = step.durationText && step.durationText !== "--:--";

                          return (
                            <Fragment key={step.id || `step-${sIdx}`}>
                              {/* Connector between steps */}
                              {!isFirst && (
                                <div className="flex-1 flex flex-col items-center justify-center px-1 sm:px-2 min-w-[28px] xs:min-w-[36px] sm:min-w-[44px] max-w-[100px]">
                                  {hasDuration ? (
                                    <span className="text-[9px] sm:text-[10px] font-semibold text-[#645d58] bg-[#f4ece8] px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full border border-[#e7e5e4] tabular-nums mb-1 whitespace-nowrap shadow-2xs">
                                      {step.durationText}
                                    </span>
                                  ) : (
                                    <div className="h-3.5 sm:h-4" />
                                  )}
                                  <div
                                    className={`w-full h-1 rounded-full ${
                                      step.status === "done"
                                        ? "bg-emerald-500"
                                        : "bg-stone-200"
                                    }`}
                                  />
                                </div>
                              )}

                              {/* Step Node */}
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                                {step.status === "done" ? (
                                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-2 sm:ring-4 ring-emerald-50 flex-shrink-0">
                                    <span className="material-symbols-outlined text-[15px] sm:text-[18px]">
                                      check
                                    </span>
                                  </div>
                                ) : step.status === "active" ? (
                                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-md ring-2 sm:ring-4 ring-amber-200 animate-pulse flex-shrink-0">
                                    <span className="material-symbols-outlined text-[15px] sm:text-[18px]">
                                      hourglass_top
                                    </span>
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#f4ece8] border-2 border-stone-300 text-[#645d58] flex items-center justify-center font-medium text-xs flex-shrink-0">
                                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-stone-300" />
                                  </div>
                                )}

                                <div className="flex flex-col flex-shrink-0">
                                  <div className="flex items-center gap-1 sm:gap-1.5">
                                    <span
                                      className={`text-[11px] sm:text-xs leading-tight whitespace-nowrap ${
                                        step.status === "active"
                                          ? "font-extrabold text-amber-950 uppercase"
                                          : step.status === "done"
                                          ? "font-bold text-emerald-900"
                                          : "font-medium text-[#645d58]"
                                      }`}
                                    >
                                      {step.name}
                                    </span>
                                    {step.status === "active" && (
                                      <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ring-1 ring-amber-300 whitespace-nowrap flex-shrink-0">
                                        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white animate-ping" />
                                        <span className="tabular-nums">{elapsedDisplay}</span> LIVE
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`text-[9px] sm:text-[10px] whitespace-nowrap leading-tight ${
                                      step.status === "active"
                                        ? "text-amber-800 font-extrabold uppercase tracking-wide"
                                        : step.status === "done"
                                        ? "text-emerald-700 font-medium"
                                        : "text-[#645d58]/70"
                                    }`}
                                  >
                                    {step.subText}
                                  </span>
                                </div>
                              </div>
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Order Type Badge: On xl+ big screens, displayed at the end of the row */}
                    <div className="hidden xl:flex items-center justify-end min-w-[140px] shrink-0">
                      {orderBadge}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* FIXED BOTTOM FOOTER: VISUAL LEGEND */}
      <footer className="flex-shrink-0 z-30 w-full bg-[#fff8f5] border-t border-[#e7e5e4] shadow-[0_-1px_6px_rgba(0,0,0,0.02)]">
        {/* Mobile View (< sm): Compact Single Row */}
        <div className="sm:hidden px-3 py-2 flex items-center justify-between gap-2 text-[10px] text-[#4d4541] overflow-x-auto scrollbar-none whitespace-nowrap">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="font-bold text-[#141010] uppercase tracking-wider text-[9px]">Legend:</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>Done</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Active</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-emerald-300" />
              <span className="text-emerald-900 font-bold">Ready</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-stone-300 bg-[#f4ece8]" />
              <span className="text-[#645d58]">Upcoming</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-emerald-800 shrink-0 font-medium text-[9px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Stream</span>
          </div>
        </div>

        {/* Tablet, Laptop, PC, Mac View (>= sm): Full Legend Bar */}
        <div className="hidden sm:flex max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 items-center justify-between gap-4 text-xs text-[#4d4541]">
          {/* Status Legend */}
          <div className="flex flex-wrap items-center gap-4 lg:gap-5">
            <span className="font-semibold text-[#141010] uppercase tracking-wider text-[11px]">
              Visual Legend:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span className="text-[#1e1b19] font-medium">Completed Stage</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-[#1e1b19] font-medium">Active Stage (Live Timer)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300" />
              <span className="text-emerald-900 font-bold">Ready to Deliver Alert</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-stone-300 bg-[#f4ece8]" />
              <span className="text-[#645d58] font-medium">Upcoming Stage</span>
            </div>
          </div>

          {/* Telemetry Note */}
          <div className="flex items-center gap-1.5 text-[#645d58] text-[11px] tracking-wide shrink-0">
            <span className="material-symbols-outlined text-[15px]">sync</span>
            <span>Real-time subscription active</span>
          </div>
        </div>
      </footer>

      {/* CENTER BACKGROUND WATERMARK (Matches old React LiveScreens.jsx: Line 330) */}
      {activeOrg?.logoUrl && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "300px",
            height: "300px",
            filter: "grayscale(75%) opacity(4%)",
            backgroundImage: `url(${activeOrg.logoUrl})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: "contain",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}
    </div>
  );
}
