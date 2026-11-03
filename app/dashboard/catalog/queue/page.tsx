"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PosShell } from "../../../components/PosShell";
import { OrderDateRangePicker } from "../../../components/OrderDateRangePicker";

function getStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getEndOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export default function QueueCatalogPage() {
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

  // Map user preset string to Convex DateRangePreset
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

  // Active placements
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

  // Common query args based on calendar selection
  const queryArgs = useMemo(() => {
    if (!activeOrg) return "skip";
    return {
      organizationId: activeOrg._id,
      dateRangePreset: dateRangePresetArg as any,
      fromTimestamp: startDate.getTime(),
      toTimestamp: endDate.getTime(),
    };
  }, [activeOrg, dateRangePresetArg, startDate, endDate]);

  // Scoped on-demand telemetry queries for Queue
  const queueLengthData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "queue_length" } : "skip"
  );

  const queueWaitingCustomersData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "queue_waiting_customers" } : "skip"
  );

  const queueAvgWaitTimeData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "queue_avg_wait_time" } : "skip"
  );

  const queueRecentCalloutsData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "queue_recent_callouts" } : "skip"
  );

  const queueStatusBreakdownData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "queue_status_breakdown" } : "skip"
  );

  const queueWaitTimeAlertsData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "queue_wait_time_alerts" } : "skip"
  );

  // Add widget with auto-packing
  const handleAddWidget = async (widgetId: string, defaultWidth: number = 4, defaultHeight: number = 1) => {
    if (!dashboardData?.dashboard || !activeOrg) return;
    setIsAddingId(widgetId);

    try {
      const isAlreadyPlaced = currentPlacements.some((p) => p.widgetId === widgetId);
      if (isAlreadyPlaced) {
        setIsAddingId(null);
        return;
      }

      const nextPlacements = [
        ...currentPlacements,
        {
          widgetId,
          gridRow: 0,
          gridCol: 0,
          width: defaultWidth,
          height: defaultHeight,
          displayOrder: currentPlacements.length + 1,
          isEnabled: true,
        },
      ];

      // Auto-pack 12-column grid
      let currentRow = 0;
      let currentCol = 0;
      const packed = nextPlacements.map((p) => {
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
          displayOrder: p.displayOrder,
          isEnabled: p.isEnabled ?? true,
        };
      });

      await createOrUpdateDraftMutation({
        dashboardId: dashboardData.dashboard._id,
        baseRevision: dashboardData.dashboard.revision ?? 1,
        placements: packed,
      });
    } catch (err) {
      console.error("Failed to add queue widget to draft:", err);
    } finally {
      setIsAddingId(null);
    }
  };

  const widgetsList = [
    {
      id: "queue_length",
      title: "Current Queue Length",
      track: "Lobby Volume",
      badge: "KPI",
      desc: "Total parties and seated heads waiting for an available table at the host stand.",
      width: 4,
    },
    {
      id: "queue_waiting_customers",
      title: "Waiting Customers",
      track: "Waitlist Stream",
      badge: "LIVE",
      desc: "Live chronological waitlist ledger showing ticket tokens, party sizes, and elapsed wait times.",
      width: 4,
    },
    {
      id: "queue_avg_wait_time",
      title: "Average Waiting Time",
      track: "Wait Metric",
      badge: "KPI",
      desc: "Mean turnaround time from guest check-in at host stand to table seating.",
      width: 4,
    },
    {
      id: "queue_recent_callouts",
      title: "Recently Called Customers",
      track: "Callout Log",
      badge: "TABLE",
      desc: "Chronological audit log of customer tickets called, seated, or marked as no-show.",
      width: 4,
    },
    {
      id: "queue_status_breakdown",
      title: "Queue Status Breakdown",
      track: "Party Mix",
      badge: "CHART",
      desc: "Real-time mix of waiting party sizes to optimize dining room turnover and table allocation.",
      width: 4,
    },
    {
      id: "queue_wait_time_alerts",
      title: "Queue Waiting Time Alerts",
      track: "Bottleneck Alert",
      badge: "ALERT",
      desc: "Proactive bottleneck alert notifications when queue wait times breach the 20-minute SLA threshold.",
      width: 4,
    },
  ];

  const filteredWidgets = useMemo(() => {
    if (!searchKeyword.trim()) return widgetsList;
    const q = searchKeyword.toLowerCase();
    return widgetsList.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.desc.toLowerCase().includes(q) ||
        w.track.toLowerCase().includes(q)
    );
  }, [searchKeyword, widgetsList]);

  const placedCount = useMemo(() => {
    return widgetsList.filter((w) => placedWidgetMap.has(w.id)).length;
  }, [placedWidgetMap, widgetsList]);

  // Summaries
  const lenSummary = (queueLengthData as any)?.summary || {};
  const waitSummary = (queueWaitingCustomersData as any)?.summary || {};
  const avgSummary = (queueAvgWaitTimeData as any)?.summary || {};
  const callSummary = (queueRecentCalloutsData as any)?.summary || {};
  const mixSummary = (queueStatusBreakdownData as any)?.summary || {};
  const alertSummary = (queueWaitTimeAlertsData as any)?.summary || {};

  return (
    <PosShell title="Queue Catalog" subtitle="Operational Station Widgets">
      <div className="flex-1 flex flex-col bg-[#fbf8f5] min-h-screen text-stone-900 overflow-y-auto">
        {/* Sub-Header & Breadcrumb */}
        <div className="bg-[#f5eee9] border-b border-[#e7ddd5] px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Link href="/dashboard" className="hover:text-stone-900 transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-stone-900 font-medium">Queue</span>
            </div>
            <h1 className="font-serif text-2xl text-stone-900 font-semibold tracking-tight">Queue</h1>
            <p className="text-xs text-stone-500 max-w-2xl">
              Monitor walk-in wait times, guest queue party sizes, SMS callouts, table readiness notifications, and lobby congestion in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <OrderDateRangePicker
              preset={selectedPreset}
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate: s, endDate: e, preset: p }) => {
                if (s) setStartDate(s);
                if (e) setEndDate(e);
                if (p) setSelectedPreset(p);
              }}
            />

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="Search Queue widgets..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#decbc0] rounded-full focus:outline-none focus:ring-1 focus:ring-stone-900 w-48 sm:w-60 shadow-2xs"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-xs font-medium text-stone-600 bg-white/70 px-3 py-1 rounded-full border border-[#e2d5cb] shrink-0">
              <span className="font-bold text-stone-900">{widgetsList.length}</span> AVAILABLE •{" "}
              <span className="font-bold text-stone-900">{placedCount}</span> ON DASHBOARD
            </div>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Card 1: Current Queue Length */}
            {filteredWidgets.some((w) => w.id === "queue_length") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Lobby Volume
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      KPI
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Current Queue Length</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Total parties and seated heads waiting for an available table at the host stand.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] min-h-[110px] justify-center">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-3xl font-bold text-stone-900">
                          {lenSummary.partiesCount || "00"}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">Parties</span>
                      </div>
                      <div className="flex items-center gap-1 text-stone-800 text-xs bg-stone-100 px-2.5 py-1 rounded-full font-medium">
                        <span className="material-symbols-outlined text-[15px]">groups</span>
                        <span>{lenSummary.guestsCount ?? 0} Guests</span>
                      </div>
                    </div>

                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden flex">
                      <div className="bg-black h-full w-[65%]"></div>
                      <div className="bg-stone-400 h-full w-[35%]"></div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                      <span>Indoor: {lenSummary.indoorCount || "00"}</span>
                      <span>Outdoor: {lenSummary.outdoorCount || "00"}</span>
                      <span className="font-semibold text-stone-900">{lenSummary.statusTag || "Nominal Flow"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("queue_length")
                      ? `SLOT: ROW ${placedWidgetMap.get("queue_length")?.gridRow} COL ${placedWidgetMap.get("queue_length")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("queue_length") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("queue_length", 4, 1)}
                      disabled={isAddingId === "queue_length"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "queue_length" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 2: Waiting Customers */}
            {filteredWidgets.some((w) => w.id === "queue_waiting_customers") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Waitlist Stream
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-black text-white flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                      <span>LIVE</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Waiting Customers</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Live chronological waitlist ledger showing ticket tokens, party sizes, and elapsed wait times.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[110px] justify-center">
                    {(waitSummary.waitingList || []).length === 0 ? (
                      <div className="text-center py-3 text-xs text-stone-400">
                        No parties currently waiting in queue
                      </div>
                    ) : (
                      (waitSummary.waitingList || []).slice(0, 3).map((w: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-1 px-2 rounded bg-white border border-[#f0eae3]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-stone-900 text-xs">{w.ticket}</span>
                            <span className="text-stone-700 truncate text-xs">{w.name} ({w.pax})</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-stone-400 text-xs">{w.waitMins}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${w.status === "Paged" ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-700"}`}>
                              {w.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("queue_waiting_customers")
                      ? `SLOT: ROW ${placedWidgetMap.get("queue_waiting_customers")?.gridRow} COL ${placedWidgetMap.get("queue_waiting_customers")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("queue_waiting_customers") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("queue_waiting_customers", 4, 1)}
                      disabled={isAddingId === "queue_waiting_customers"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "queue_waiting_customers" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 3: Average Waiting Time */}
            {filteredWidgets.some((w) => w.id === "queue_avg_wait_time") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Wait Metric
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      KPI
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Average Waiting Time</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Mean turnaround time from guest check-in at host stand to table seating.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] min-h-[110px] justify-center">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-3xl font-bold text-stone-900">
                          {avgSummary.avgWaitMins || "0.0"}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">mins</span>
                      </div>
                      <span className="text-[11px] font-semibold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-full">
                        {avgSummary.deltaText || "Within Target SLA"}
                      </span>
                    </div>

                    <div className="w-full h-6 pt-1">
                      <svg className="w-full h-full overflow-visible stroke-stone-900" fill="none" viewBox="0 0 100 20">
                        <path d="M0 16 Q 25 20, 50 8 T 100 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5 border-t border-[#f0eae3]">
                      <span>Quoted: {avgSummary.quotedTime || "15–20m"}</span>
                      <span className="font-semibold text-stone-900">{avgSummary.target || "Target < 20m"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("queue_avg_wait_time")
                      ? `SLOT: ROW ${placedWidgetMap.get("queue_avg_wait_time")?.gridRow} COL ${placedWidgetMap.get("queue_avg_wait_time")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("queue_avg_wait_time") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("queue_avg_wait_time", 4, 1)}
                      disabled={isAddingId === "queue_avg_wait_time"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "queue_avg_wait_time" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 4: Recently Called Customers */}
            {filteredWidgets.some((w) => w.id === "queue_recent_callouts") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Callout Log
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      TABLE
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Recently Called Customers</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Chronological audit log of customer tickets called, seated, or marked as no-show.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[110px] justify-center">
                    {(callSummary.calledList || []).length === 0 ? (
                      <div className="text-center py-3 text-xs text-stone-400">
                        No recently called guest parties
                      </div>
                    ) : (
                      (callSummary.calledList || []).slice(0, 3).map((c: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-1 px-2 rounded bg-white border border-[#f0eae3]">
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="text-xs font-bold text-stone-900 truncate">
                              {c.ticket} • {c.name} ({c.pax})
                            </span>
                            <span className={`text-[10px] font-medium ${c.statusColor}`}>{c.status}</span>
                          </div>
                          <span className="text-[11px] text-stone-400 shrink-0">{c.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("queue_recent_callouts")
                      ? `SLOT: ROW ${placedWidgetMap.get("queue_recent_callouts")?.gridRow} COL ${placedWidgetMap.get("queue_recent_callouts")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("queue_recent_callouts") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("queue_recent_callouts", 4, 1)}
                      disabled={isAddingId === "queue_recent_callouts"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "queue_recent_callouts" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 5: Queue Status Breakdown */}
            {filteredWidgets.some((w) => w.id === "queue_status_breakdown") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Party Mix
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      CHART
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Queue Status Breakdown</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Real-time mix of waiting party sizes to optimize dining room turnover and table allocation.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex items-center justify-between border border-[#f3ede6] min-h-[110px]">
                    <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <circle className="text-stone-200 stroke-current" cx="18" cy="18" fill="none" r="14" strokeWidth="4" />
                        <circle className="text-black stroke-current" cx="18" cy="18" fill="none" r="14" strokeDasharray={`${mixSummary.couplesPercent ?? 42}, 100`} strokeDashoffset="0" strokeWidth="4" />
                        <circle className="text-stone-500 stroke-current" cx="18" cy="18" fill="none" r="14" strokeDasharray={`${mixSummary.familiesPercent ?? 40}, 100`} strokeDashoffset={`-${mixSummary.couplesPercent ?? 42}`} strokeWidth="4" />
                        <circle className="text-amber-600 stroke-current" cx="18" cy="18" fill="none" r="14" strokeDasharray={`${mixSummary.largePercent ?? 18}, 100`} strokeDashoffset={`-${(mixSummary.couplesPercent ?? 42) + (mixSummary.familiesPercent ?? 40)}`} strokeWidth="4" />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="font-bold text-sm leading-none">{mixSummary.totalPax ?? 0}</span>
                        <span className="text-[8px] text-stone-400 leading-none">Pax</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 text-[11px] flex-1 pl-3">
                      <div className="flex justify-between">
                        <span className="text-stone-600">Couples (2p)</span>
                        <span className="font-bold text-stone-900">{mixSummary.couplesPercent ?? 42}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Families (4-6p)</span>
                        <span className="font-bold text-stone-900">{mixSummary.familiesPercent ?? 40}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Large (7p+)</span>
                        <span className="font-bold text-stone-900">{mixSummary.largePercent ?? 18}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("queue_status_breakdown")
                      ? `SLOT: ROW ${placedWidgetMap.get("queue_status_breakdown")?.gridRow} COL ${placedWidgetMap.get("queue_status_breakdown")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("queue_status_breakdown") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("queue_status_breakdown", 4, 1)}
                      disabled={isAddingId === "queue_status_breakdown"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "queue_status_breakdown" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 6: Queue Waiting Time Alerts */}
            {filteredWidgets.some((w) => w.id === "queue_wait_time_alerts") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Bottleneck Alert
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-rose-100 text-rose-800">
                      ALERT
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Queue Waiting Time Alerts</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Proactive bottleneck alert notifications when queue wait times breach the 20-minute SLA threshold.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col justify-center border border-[#f3ede6] min-h-[110px]">
                    {(alertSummary.breachingParties || []).length === 0 ? (
                      <div className="bg-emerald-50 border border-emerald-200/60 p-2.5 rounded-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-700 text-lg">check_circle</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-emerald-900">Wait Times Within SLA</span>
                          <span className="text-[10px] text-emerald-700">All guests seated under 20 mins</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-rose-50 border border-rose-200/80 p-2.5 rounded-lg flex flex-col gap-1.5">
                        <div className="flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-rose-600 text-base mt-0.5">warning</span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-rose-800 uppercase">
                              Exceeding SLA ({alertSummary.breachingParties[0]?.elapsedMins}m elapsed)
                            </span>
                            <span className="text-xs font-bold text-stone-900 truncate">
                              {alertSummary.breachingParties[0]?.ticket} ({alertSummary.breachingParties[0]?.name})
                            </span>
                            <span className="text-[10px] text-rose-700">Target &lt; 20m</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-stone-500 pt-1 border-t border-rose-200/40 font-medium">
                          Suggested: {alertSummary.breachingParties[0]?.suggestedTable || "Seat Table T-12"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("queue_wait_time_alerts")
                      ? `SLOT: ROW ${placedWidgetMap.get("queue_wait_time_alerts")?.gridRow} COL ${placedWidgetMap.get("queue_wait_time_alerts")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("queue_wait_time_alerts") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("queue_wait_time_alerts", 4, 1)}
                      disabled={isAddingId === "queue_wait_time_alerts"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "queue_wait_time_alerts" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PosShell>
  );
}

