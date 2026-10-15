"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface KdsTerminalViewProps {
  stationId: Id<"stations">;
  organizationId?: Id<"organizations">;
  onBack?: () => void;
}

type OrderTypeFilter = "all" | "dine-in" | "takeaway" | "delivery";

export function KdsTerminalView({
  stationId,
  organizationId,
  onBack,
}: KdsTerminalViewProps) {
  // 1. Reactive Convex Queries
  const station = useQuery(
    api.stations.get,
    stationId ? { id: stationId } : "skip"
  );

  const stationOrdersData = useQuery(
    api.stations.getStationOrders,
    stationId ? { stationId, organizationId } : "skip"
  );

  // Active Store Order Processes from Settings -> Order Statuses
  const dbProcesses = useQuery(api.organizationOrderProcesses.list, {
    published: true,
  });

  // 2. Mutations
  const startPreparingMutation = useMutation(api.stations.startPreparingStationTicket);
  const toggleItemReadyMutation = useMutation(api.stations.toggleStationOrderItemReady);
  const markReadyMutation = useMutation(api.stations.markStationTicketReady);
  const advanceProcessMutation = useMutation(api.stations.advanceStationTicketProcess);
  const completeOrderMutation = useMutation(api.orders.completeOrder);

  // 3. UI State
  const [activeFilter, setActiveFilter] = useState<OrderTypeFilter>("all");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; icon: string } | null>(null);

  // Audio Context reference for chime
  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 4. Live Clock & Elapsed Timer Tick (1-second interval)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setCurrentTimeStr(`${h}:${m}:${s}`);
      setNowTimestamp(now.getTime());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 5. Audio Alert Synthesizer (Zero-asset Web Audio API chime)
  const playChime = useCallback(() => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Pleasant high kitchen chime (D5 587.33Hz -> A5 880Hz)
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.setValueAtTime(880.0, now + 0.12);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.5);
    } catch {
      // Audio playback blocked or unavailable in headless environment
    }
  }, [audioEnabled]);

  // Trigger chime when a new ticket enters the station
  useEffect(() => {
    if (!stationOrdersData?.orders) return;

    const currentOrderIds = new Set(stationOrdersData.orders.map((t) => t.order._id));
    if (seenOrderIdsRef.current.size > 0) {
      let hasNewOrder = false;
      for (const id of currentOrderIds) {
        if (!seenOrderIdsRef.current.has(id)) {
          hasNewOrder = true;
          break;
        }
      }
      if (hasNewOrder) {
        playChime();
      }
    }
    seenOrderIdsRef.current = currentOrderIds;
  }, [stationOrdersData?.orders, playChime]);

  // Toast helper
  const showToast = (message: string, icon = "check_circle") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, icon });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  // Toggle audio
  const handleToggleAudio = () => {
    setAudioEnabled((prev) => {
      const next = !prev;
      showToast(
        next ? "Kitchen Audio Alerts Enabled" : "Kitchen Audio Alerts Muted",
        next ? "volume_up" : "volume_off"
      );
      return next;
    });
  };

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const currencySymbol = stationOrdersData?.currencySymbol || "₹";

  // Compute active sequential order processes from Settings -> Order Statuses
  const activeProcesses = useMemo(() => {
    if (dbProcesses && dbProcesses.length > 0) {
      const seq = dbProcesses
        .filter((p) => p.published && (p.isSequence ?? true))
        .sort((a, b) => a.position - b.position);
      if (seq.length > 0) return seq;
    }
    // Standard default sequential statuses matching Settings -> Order Statuses
    return [
      {
        _id: "default_accepted" as Id<"organizationOrderProcesses">,
        name: "Accepted",
        position: 1,
        processColor: "#78716c",
        isSequence: true,
        published: true,
      },
      {
        _id: "default_inprogress" as Id<"organizationOrderProcesses">,
        name: "In progress",
        position: 2,
        processColor: "#f59e0b",
        isSequence: true,
        published: true,
      },
      {
        _id: "default_ready" as Id<"organizationOrderProcesses">,
        name: "Ready to deliver",
        position: 3,
        processColor: "#10b981",
        isSequence: true,
        published: true,
      },
    ];
  }, [dbProcesses]);

  // 6. Partition Tickets into the Active Process Columns
  const rawOrders = stationOrdersData?.orders || [];

  // Filter Helper (Matching orderType: Dine-In, Takeaway, Delivery)
  const matchesFilter = useCallback(
    (ticket: (typeof rawOrders)[0]) => {
      if (activeFilter === "all") return true;

      const rawType = (ticket.order.orderType || "").toLowerCase();
      if (activeFilter === "dine-in") {
        return rawType.includes("dine");
      }
      if (activeFilter === "takeaway") {
        return rawType.includes("take") || rawType.includes("pickup");
      }
      if (activeFilter === "delivery") {
        return rawType.includes("delivery");
      }
      return true;
    },
    [activeFilter]
  );

  // Group tickets into active process columns dynamically
  const ticketsByProcess = useMemo(() => {
    const map = new Map<string, typeof rawOrders>();
    for (const p of activeProcesses) {
      map.set(String(p._id), []);
    }

    const firstProcId = String(activeProcesses[0]?._id);
    const readyProc =
      activeProcesses.find((p) => p.name.toLowerCase().includes("ready")) ||
      (activeProcesses.length >= 3 ? activeProcesses[2] : activeProcesses[activeProcesses.length - 1]);
    const readyProcId = readyProc ? String(readyProc._id) : firstProcId;

    const inProgressProc =
      activeProcesses.find(
        (p) =>
          p.position === 2 ||
          p.name.toLowerCase().includes("progress") ||
          p.name.toLowerCase().includes("prepar")
      ) || activeProcesses[1] || activeProcesses[0];
    const inProgressProcId = inProgressProc ? String(inProgressProc._id) : firstProcId;

    for (const ticket of rawOrders) {
      if (ticket.order.isRejected || ticket.order.isCompleted) continue;

      let targetId: string | undefined;

      // 1. Exact status ID match
      if (ticket.order.orderStatusId && map.has(String(ticket.order.orderStatusId))) {
        targetId = String(ticket.order.orderStatusId);
      } else if (ticket.order.orderStatusName) {
        // 2. Exact name match
        const found = activeProcesses.find(
          (p) => p.name.trim().toLowerCase() === (ticket.order.orderStatusName || "").trim().toLowerCase()
        );
        if (found) targetId = String(found._id);
      }

      // 3. Fallback based on station item readiness and flags
      if (!targetId) {
        if (ticket.allStationItemsReady || ticket.order.isStationReady) {
          targetId = readyProcId;
        } else if (ticket.order.isStationInProgress) {
          targetId = inProgressProcId;
        } else {
          targetId = firstProcId;
        }
      }

      const list = map.get(targetId) || [];
      if (matchesFilter(ticket)) {
        list.push(ticket);
      }
      map.set(targetId, list);
    }

    return map;
  }, [activeProcesses, rawOrders, matchesFilter]);

  // Backward-compatible column accessors for vitest suites & legacy references
  const filteredAccepted = useMemo(() => {
    const firstProcId = String(activeProcesses[0]?._id);
    return ticketsByProcess.get(firstProcId) || [];
  }, [ticketsByProcess, activeProcesses]);

  const filteredInProgress = useMemo(() => {
    const inProg =
      activeProcesses.find(
        (p) =>
          p.position === 2 ||
          p.name.toLowerCase().includes("progress") ||
          p.name.toLowerCase().includes("prepar")
      ) || activeProcesses[1];
    return inProg ? ticketsByProcess.get(String(inProg._id)) || [] : [];
  }, [ticketsByProcess, activeProcesses]);

  const filteredReady = useMemo(() => {
    const readyProc =
      activeProcesses.find((p) => p.name.toLowerCase().includes("ready")) ||
      (activeProcesses.length >= 3 ? activeProcesses[2] : activeProcesses[activeProcesses.length - 1]);
    return readyProc ? ticketsByProcess.get(String(readyProc._id)) || [] : [];
  }, [ticketsByProcess, activeProcesses]);

  // Counts for filter pills across all active tickets for this station
  const filterCounts = useMemo(() => {
    let dineIn = 0;
    let takeaway = 0;
    let delivery = 0;

    for (const t of rawOrders) {
      if (t.order.isRejected || t.order.isCompleted) continue;
      const type = (t.order.orderType || "").toLowerCase();
      if (type.includes("dine")) dineIn++;
      else if (type.includes("take") || type.includes("pickup")) takeaway++;
      else if (type.includes("delivery")) delivery++;
    }

    return {
      all: rawOrders.filter((t) => !t.order.isRejected && !t.order.isCompleted).length,
      dineIn,
      takeaway,
      delivery,
    };
  }, [rawOrders]);

  // 8. Action Handlers
  const handleStartPreparing = async (orderId: Id<"orders">, tokenNumber: string) => {
    if (actionInProgressId) return;
    setActionInProgressId(orderId);
    try {
      await startPreparingMutation({ stationId, orderId });
      showToast(`TOKEN #${tokenNumber} moved to In Progress`, "skillet");
    } catch (err: any) {
      console.error("Failed to start preparing ticket:", err);
      showToast(err.message || "Failed to start ticket", "error");
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleToggleItem = async (
    orderItemId: Id<"orderItems">,
    currentReady: boolean
  ) => {
    try {
      await toggleItemReadyMutation({
        stationId,
        orderItemId,
        isReady: !currentReady,
      });
    } catch (err: any) {
      console.error("Failed to toggle item ready:", err);
      showToast(err.message || "Failed to update item", "error");
    }
  };

  const handleMarkTicketReady = async (orderId: Id<"orders">, tokenNumber: string) => {
    if (actionInProgressId) return;
    setActionInProgressId(orderId);
    try {
      const res = await markReadyMutation({ stationId, orderId });
      showToast(
        res.allOrderItemsReady
          ? `TOKEN #${tokenNumber} Ready for Service (Whole Order Complete)`
          : `TOKEN #${tokenNumber} Station Items Ready`,
        "check_circle"
      );
    } catch (err: any) {
      console.error("Failed to mark ticket ready:", err);
      showToast(err.message || "Failed to mark ready", "error");
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleAdvanceProcess = async (
    orderId: Id<"orders">,
    targetProcessId: Id<"organizationOrderProcesses">,
    targetProcessName: string,
    tokenNumber: string
  ) => {
    if (actionInProgressId) return;
    setActionInProgressId(orderId);
    try {
      if (String(targetProcessId).startsWith("default_")) {
        if (targetProcessName.toLowerCase().includes("ready")) {
          await markReadyMutation({ stationId, orderId });
        } else {
          await startPreparingMutation({ stationId, orderId });
        }
      } else {
        await advanceProcessMutation({
          stationId,
          orderId,
          targetProcessId,
        });
      }
      showToast(`TOKEN #${tokenNumber} moved to ${targetProcessName}`, "check_circle");
    } catch (err: any) {
      console.error("Failed to advance ticket process:", err);
      showToast(err.message || "Failed to advance ticket", "error");
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleCompleteTicket = async (orderId: Id<"orders">, tokenNumber: string) => {
    if (actionInProgressId) return;
    setActionInProgressId(orderId);
    try {
      await completeOrderMutation({ orderId });
      showToast(`TOKEN #${tokenNumber} Completed`, "done_all");
    } catch (err: any) {
      console.error("Failed to complete order:", err);
      showToast(err.message || "Failed to complete order", "error");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Elapsed timer formatting & threshold classes
  const getElapsedDisplay = (createdAt: number) => {
    const diffSec = Math.max(0, Math.floor((nowTimestamp - createdAt) / 1000));
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    let colorClass = "bg-emerald-50 text-emerald-800 border-emerald-200/80";
    if (m >= 15) {
      colorClass = "bg-red-50 text-red-800 border-red-200/80";
    } else if (m >= 10) {
      colorClass = "bg-amber-50 text-amber-800 border-amber-200/80";
    }

    return { timeStr, colorClass, isOverdue: m >= 15 };
  };

  // Ready time formatting helper (HH:MM)
  const formatReadyTime = (readyAtTimestamp?: number) => {
    if (!readyAtTimestamp) return "Ready";
    const d = new Date(readyAtTimestamp);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `Ready ${h}:${m}`;
  };

  // Loading state
  if (station === undefined || stationOrdersData === undefined) {
    return (
      <div className="min-h-screen bg-[#f7f6f4] text-[#1c1917] flex flex-col antialiased">
        <header className="bg-white border-b border-[#e7e5e4] px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[22px] font-extrabold tracking-tight text-[#1c1917]">PREST KDS</span>
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
              Terminal
            </span>
          </div>
          <div className="h-8 w-24 bg-stone-100 rounded-full animate-pulse" />
        </header>
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-3 border-stone-300 border-t-black rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-stone-500">Connecting to station terminal...</p>
          </div>
        </div>
      </div>
    );
  }

  // Station missing or inactive
  if (!station) {
    return (
      <div className="min-h-screen bg-[#f7f6f4] text-[#1c1917] flex flex-col antialiased p-6">
        <div className="max-w-md mx-auto my-auto bg-white p-8 rounded-3xl border border-[#e7e5e4] text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#1c1917]">Station Inactive or Not Found</h2>
          <p className="text-xs text-stone-600">
            This kitchen workstation could not be loaded or has been decommissioned.
          </p>
          <div className="pt-2">
            <Link
              href="/kds"
              className="inline-flex px-5 py-2.5 rounded-full bg-black text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
            >
              Back to Station Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f7f6f4] text-[#1c1917] min-h-screen flex flex-col antialiased selection:bg-stone-200">
      {/* ============================================================== */}
      {/* 1. CLEAN MINIMAL HEADER                                        */}
      {/* ============================================================== */}
      <header className="bg-white border-b border-[#e7e5e4] sticky top-0 z-40 px-6 py-3.5 shadow-xs">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between flex-wrap gap-4">
          {/* Left: Logo & Station Title */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-1 -ml-1 text-stone-500 hover:text-black rounded-lg transition-colors cursor-pointer"
                  title="Back to Station Dashboard"
                  aria-label="Back to dashboard"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                </button>
              ) : (
                <Link
                  href="/kds"
                  className="p-1 -ml-1 text-stone-500 hover:text-black rounded-lg transition-colors cursor-pointer"
                  title="Back to Station Dashboard"
                  aria-label="Back to dashboard"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                </Link>
              )}
              <span className="text-[22px] font-extrabold tracking-tight text-[#1c1917]">PREST KDS</span>
              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                Terminal
              </span>
            </div>

            <div className="h-5 w-px bg-stone-300" />

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-base font-semibold text-[#1c1917]">
                Station: {station.name}
              </span>
              {station.isMain && (
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 text-[10px] uppercase font-bold tracking-wider">
                  Expo Pass
                </span>
              )}
            </div>
          </div>

          {/* Right: Real-time Clock, Audio, Fullscreen */}
          <div className="flex items-center gap-3">
            {/* Live Clock */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-100 border border-stone-200 font-mono text-sm font-semibold text-[#1c1917]">
              <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
              </svg>
              <span id="live-clock">{currentTimeStr || "12:00:00"}</span>
            </div>

            {/* Audio Toggle */}
            <button
              id="audio-toggle-btn"
              type="button"
              onClick={handleToggleAudio}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200/80 border border-stone-200 text-xs font-semibold uppercase tracking-wider text-[#1c1917] transition-colors focus:outline-none cursor-pointer"
            >
              {audioEnabled ? (
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-4.5l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              )}
              <span>Audio: {audioEnabled ? "ON" : "OFF"}</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="p-2 rounded-full bg-stone-100 hover:bg-stone-200/80 border border-stone-200 text-stone-600 hover:text-black transition-colors cursor-pointer"
              title="Toggle Fullscreen"
              aria-label="Toggle fullscreen"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. FILTER BAR                                                  */}
      {/* ============================================================== */}
      <section className="px-6 pt-5 pb-2">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-[#1c1917] text-white shadow-xs"
                  : "bg-white hover:bg-stone-100 text-[#1c1917] border border-[#e7e5e4]"
              }`}
            >
              All Orders{" "}
              <span className={`ml-1 ${activeFilter === "all" ? "opacity-80" : "text-stone-500 font-normal"}`}>
                ({filterCounts.all})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("dine-in")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                activeFilter === "dine-in"
                  ? "bg-[#1c1917] text-white shadow-xs"
                  : "bg-white hover:bg-stone-100 text-[#1c1917] border border-[#e7e5e4]"
              }`}
            >
              Dine-In{" "}
              <span className={`ml-1 ${activeFilter === "dine-in" ? "opacity-80" : "text-stone-500 font-normal"}`}>
                ({filterCounts.dineIn})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("takeaway")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                activeFilter === "takeaway"
                  ? "bg-[#1c1917] text-white shadow-xs"
                  : "bg-white hover:bg-stone-100 text-[#1c1917] border border-[#e7e5e4]"
              }`}
            >
              Takeaway{" "}
              <span className={`ml-1 ${activeFilter === "takeaway" ? "opacity-80" : "text-stone-500 font-normal"}`}>
                ({filterCounts.takeaway})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("delivery")}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                activeFilter === "delivery"
                  ? "bg-[#1c1917] text-white shadow-xs"
                  : "bg-white hover:bg-stone-100 text-[#1c1917] border border-[#e7e5e4]"
              }`}
            >
              Delivery{" "}
              <span className={`ml-1 ${activeFilter === "delivery" ? "opacity-80" : "text-stone-500 font-normal"}`}>
                ({filterCounts.delivery})
              </span>
            </button>
          </div>

          <div className="text-xs text-stone-500 font-medium hidden sm:block">
            Touch cards or checkmarks to update items in real time
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. DYNAMIC OPERATIONAL COLUMNS SYNCED WITH SETTINGS -> ORDER STATUSES */}
      {/* ============================================================== */}
      <main className="flex-1 px-6 py-4 max-w-[1920px] w-full mx-auto">
        <div
          className={`grid gap-6 items-start ${
            activeProcesses.length === 1
              ? "grid-cols-1"
              : activeProcesses.length === 2
                ? "grid-cols-1 lg:grid-cols-2"
                : activeProcesses.length === 3
                  ? "grid-cols-1 lg:grid-cols-3"
                  : activeProcesses.length === 4
                    ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 overflow-x-auto pb-4"
          }`}
        >
          {activeProcesses.map((proc, colIndex) => {
            const isFirstCol = colIndex === 0;
            const isLastCol = colIndex === activeProcesses.length - 1;
            const nextProcess = activeProcesses[colIndex + 1];
            const colTickets = ticketsByProcess.get(String(proc._id)) || [];

            const isReadyColumn =
              proc.name.toLowerCase().includes("ready") ||
              (!nextProcess && colIndex > 0);

            // Stable test IDs
            const countId =
              colIndex === 0
                ? "count-accepted"
                : colIndex === 1
                  ? "count-in-progress"
                  : colIndex === 2
                    ? "count-ready"
                    : `count-proc-${proc._id}`;

            const listId =
              colIndex === 0
                ? "col-accepted-list"
                : colIndex === 1
                  ? "col-inprogress-list"
                  : colIndex === 2
                    ? "col-ready-list"
                    : `col-proc-${proc._id}-list`;

            const dotColor =
              proc.processColor ||
              (isFirstCol
                ? "#78716c"
                : isReadyColumn
                  ? "#10b981"
                  : "#f59e0b");

            return (
              <section key={String(proc._id)} className="flex flex-col gap-4 min-w-[320px]">
                {/* Column Header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-white rounded-xl border border-[#e7e5e4] shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <h2 className="text-base font-bold uppercase tracking-wider text-[#1c1917]">
                      {proc.name}
                    </h2>
                  </div>
                  <span
                    id={countId}
                    data-testid={countId}
                    className="px-2.5 py-0.5 rounded-full bg-stone-100 text-xs font-bold text-[#1c1917]"
                  >
                    {colTickets.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex flex-col gap-4" id={listId}>
                  {colTickets.length === 0 ? (
                    <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-stone-300 text-stone-500">
                      <div className="w-10 h-10 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center mb-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-[#1c1917]">No tickets in {proc.name}</p>
                      <p className="text-xs mt-0.5">Tickets will appear here when active</p>
                    </div>
                  ) : (
                    colTickets.map((ticket) => {
                      const elapsed = getElapsedDisplay(ticket.order.createdAt);
                      const orderType = (ticket.order.orderType || "").toLowerCase();
                      const isDineIn = orderType.includes("dine");
                      const isTakeaway = orderType.includes("take") || orderType.includes("pickup");
                      const isDelivery = orderType.includes("delivery");

                      const completedItemsCount = ticket.orderItems.filter((i) => i.isReady).length;
                      const totalItemsCount = ticket.orderItems.length;
                      const allDone = totalItemsCount > 0 && completedItemsCount === totalItemsCount;
                      const readyTimeLabel = formatReadyTime(ticket.order.readyAt);

                      return (
                        <article
                          key={ticket.order._id}
                          className="ticket-card bg-white rounded-2xl border border-[#e7e5e4] p-5 shadow-xs flex flex-col justify-between gap-5 transition-all hover:border-stone-400"
                        >
                          <div className="space-y-4">
                            {/* Top Row: Token & Timer */}
                            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3.5">
                              <div>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-[20px] font-bold text-[#1c1917] tracking-tight">
                                    TOKEN #{ticket.order.tokenNumber || "—"}
                                  </span>
                                  <span className="text-xs font-semibold text-stone-500">
                                    #ORD-{ticket.order.orderNumber || ticket.order._id.slice(-4).toUpperCase()}
                                  </span>
                                </div>

                                {/* Service Details Box */}
                                <div className="mt-3 p-2.5 rounded-xl bg-stone-100/90 border border-stone-200 flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-white border border-stone-200 flex items-center justify-center shrink-0 text-[#1c1917] shadow-xs">
                                    {isDineIn && (
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M5 10v9M19 10v9M9 10v9M15 10v9M2 6h20" />
                                      </svg>
                                    )}
                                    {isTakeaway && (
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2zM3 6h18M16 10a4 4 0 0 1-8 0" />
                                      </svg>
                                    )}
                                    {isDelivery && (
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <circle cx="18.5" cy="17.5" r="2.5" />
                                        <circle cx="5.5" cy="17.5" r="2.5" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 6h-3a1 1 0 0 0-1 1v5h6M8 17h6m4-5-2-4h-3" />
                                      </svg>
                                    )}
                                  </div>
                                  <div>
                                    <div className="text-[13px] font-bold text-[#1c1917] uppercase tracking-wide leading-tight">
                                      {isDineIn ? "DINE-IN" : isTakeaway ? "TAKEAWAY" : "DELIVERY"}
                                    </div>
                                    <div className="text-xs text-stone-600 font-medium mt-0.5">
                                      {isDineIn && (
                                        <span>
                                          Table {ticket.order.tableNumber || "—"} •{" "}
                                          {ticket.order.membersOnTable || 2} Guests
                                        </span>
                                      )}
                                      {isTakeaway && (
                                        <span>
                                          {ticket.order.customerName
                                            ? `Pickup • ${ticket.order.customerName}`
                                            : "Front Counter Box"}
                                        </span>
                                      )}
                                      {isDelivery && (
                                        <span>
                                          {ticket.order.customerName || "Courier Waiting"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Timer / Ready Badge */}
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <div
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-mono text-xs font-bold shrink-0 ${elapsed.colorClass}`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  <span>{elapsed.timeStr}</span>
                                </div>

                                {isReadyColumn && (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-semibold shrink-0">
                                    <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                    </svg>
                                    <span>{readyTimeLabel}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Special Notes (if present) */}
                            {ticket.order.specialNotes && (
                              <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70 text-amber-900 text-xs font-medium flex items-start gap-2">
                                <svg className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>Note: {ticket.order.specialNotes}</span>
                              </div>
                            )}

                            {/* Items List */}
                            <div className="space-y-2">
                              {ticket.orderItems.map((item) => {
                                const isDone = item.isReady;

                                if (isFirstCol || isReadyColumn) {
                                  return (
                                    <div
                                      key={item._id}
                                      className={`p-3 rounded-xl border ${
                                        isReadyColumn
                                          ? "bg-stone-50 border-stone-200/50"
                                          : "bg-stone-50 rounded-xl border-stone-200/60"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          {isReadyColumn && (
                                            <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                              </svg>
                                            </div>
                                          )}
                                          <span className="text-[15px] font-semibold text-[#1c1917]">
                                            {item.quantity} × {item.itemName}
                                          </span>
                                        </div>
                                        {item.itemPrice !== undefined && item.itemPrice > 0 && (
                                          <span className="text-xs font-semibold text-stone-500 tabular-nums shrink-0">
                                            {currencySymbol}
                                            {((item.itemPrice || 0) / 100).toFixed(2)}
                                          </span>
                                        )}
                                      </div>

                                      {/* Customizations / Preferences */}
                                      {((item.customizations && item.customizations.length > 0) ||
                                        (item.prepPreferences && item.prepPreferences.length > 0)) && (
                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                          {item.customizations?.map((c, i) => (
                                            <span
                                              key={i}
                                              className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 text-[11px] font-medium"
                                            >
                                              {c.optionName}
                                            </span>
                                          ))}
                                          {item.prepPreferences?.map((p, i) => (
                                            <span
                                              key={`p-${i}`}
                                              className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 text-[11px] font-medium"
                                            >
                                              {p.name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                // Intermediate / Preparation Column: Interactive Checkbox
                                return (
                                  <div
                                    key={item._id}
                                    onClick={() => handleToggleItem(item._id, item.isReady)}
                                    className={`item-row flex items-start gap-3 p-3 rounded-xl border select-none transition-colors cursor-pointer ${
                                      isDone
                                        ? "bg-stone-50 border-stone-200/70"
                                        : "bg-white hover:bg-stone-50 border-stone-200/70"
                                    }`}
                                  >
                                    <div
                                      className={`checkbox-indicator w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                        isDone
                                          ? "bg-emerald-600 text-white"
                                          : "border-2 border-stone-300 bg-white"
                                      }`}
                                    >
                                      {isDone && (
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                        </svg>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <div
                                          className={`item-text text-[15px] font-semibold transition-colors ${
                                            isDone ? "line-through text-stone-500" : "text-[#1c1917]"
                                          }`}
                                        >
                                          {item.quantity} × {item.itemName}
                                        </div>
                                        {item.itemPrice !== undefined && item.itemPrice > 0 && (
                                          <span className="text-xs font-semibold text-stone-500 tabular-nums shrink-0">
                                            {currencySymbol}
                                            {((item.itemPrice || 0) / 100).toFixed(2)}
                                          </span>
                                        )}
                                      </div>

                                      {/* Customizations / Preferences */}
                                      {((item.customizations && item.customizations.length > 0) ||
                                        (item.prepPreferences && item.prepPreferences.length > 0)) && (
                                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                          {item.customizations?.map((c, i) => (
                                            <span
                                              key={i}
                                              className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 text-[11px] font-medium"
                                            >
                                              {c.optionName}
                                            </span>
                                          ))}
                                          {item.prepPreferences?.map((p, i) => (
                                            <span
                                              key={`p-${i}`}
                                              className="px-2 py-0.5 rounded-md bg-stone-200 text-stone-800 text-[11px] font-medium"
                                            >
                                              {p.name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Dynamic Action Buttons */}
                          {isFirstCol && nextProcess && (
                            <button
                              type="button"
                              onClick={() =>
                                handleAdvanceProcess(
                                  ticket.order._id,
                                  nextProcess._id,
                                  nextProcess.name,
                                  ticket.order.tokenNumber
                                )
                              }
                              disabled={actionInProgressId === ticket.order._id}
                              className="w-full py-3 px-4 rounded-full bg-[#1c1917] hover:bg-stone-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-[0.98] cursor-pointer disabled:opacity-50"
                            >
                              {actionInProgressId === ticket.order._id ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <span>
                                    {nextProcess.name.toLowerCase().includes("progress") ||
                                    nextProcess.name.toLowerCase().includes("prepar")
                                      ? "Start Preparing"
                                      : `Start ${nextProcess.name}`}
                                  </span>
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                  </svg>
                                </>
                              )}
                            </button>
                          )}

                          {!isFirstCol && !isReadyColumn && (
                            <button
                              type="button"
                              onClick={() => {
                                if (nextProcess) {
                                  handleAdvanceProcess(
                                    ticket.order._id,
                                    nextProcess._id,
                                    nextProcess.name,
                                    ticket.order.tokenNumber
                                  );
                                } else {
                                  handleMarkTicketReady(ticket.order._id, ticket.order.tokenNumber);
                                }
                              }}
                              disabled={!allDone || actionInProgressId === ticket.order._id}
                              className={`w-full py-3 px-4 rounded-full font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                                allDone
                                  ? "bg-[#1c1917] hover:bg-stone-800 text-white shadow-xs active:scale-[0.98] cursor-pointer"
                                  : "bg-stone-100 text-stone-400 cursor-not-allowed"
                              }`}
                            >
                              {actionInProgressId === ticket.order._id ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : allDone ? (
                                <>
                                  <span>
                                    {nextProcess ? `Move to ${nextProcess.name}` : "Mark Ready"}
                                  </span>
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                  </svg>
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                  </svg>
                                  <span>
                                    {completedItemsCount} of {totalItemsCount} Items Completed
                                  </span>
                                </>
                              )}
                            </button>
                          )}

                          {isReadyColumn && (
                            <div className="space-y-2">
                              <div className="py-2.5 px-4 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>
                                  {proc.name.toLowerCase().includes("deliver")
                                    ? "Order Delivered"
                                    : proc.name.toLowerCase().includes("served")
                                      ? "Order Served"
                                      : "Ready for Service"}
                                </span>
                              </div>
                              {nextProcess ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAdvanceProcess(
                                      ticket.order._id,
                                      nextProcess._id,
                                      nextProcess.name,
                                      ticket.order.tokenNumber
                                    )
                                  }
                                  disabled={actionInProgressId === ticket.order._id}
                                  className="w-full py-2.5 px-4 rounded-full bg-[#1c1917] hover:bg-stone-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                                >
                                  <span>Move to {nextProcess.name}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCompleteTicket(ticket.order._id, ticket.order.tokenNumber)
                                  }
                                  disabled={actionInProgressId === ticket.order._id}
                                  className="w-full py-2.5 px-4 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                                >
                                  <span>Complete Order</span>
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* ============================================================== */}
      {/* Toast Notification                                             */}
      {/* ============================================================== */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 transform transition-all duration-300 ease-out translate-y-0 opacity-100">
          <div className="px-4 py-2.5 rounded-full bg-[#1c1917] text-white text-xs font-semibold tracking-wide flex items-center gap-2 shadow-xl border border-stone-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
