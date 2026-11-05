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

export default function SurveysCatalogPage() {
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

  // Scoped on-demand telemetry queries for Surveys
  const surveysResponseCountsData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "surveys_response_counts" } : "skip"
  );

  const surveysAverageRatingData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "surveys_average_rating" } : "skip"
  );

  const surveysRecentFeedbackData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "surveys_recent_feedback" } : "skip"
  );

  const surveysSatisfactionTrendsData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "surveys_satisfaction_trends" } : "skip"
  );

  const surveysLowRatingAlertsData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "surveys_low_rating_alerts" } : "skip"
  );

  const surveysResponseRatesData = useQuery(
    api.dashboards.getWidgetData,
    queryArgs !== "skip" ? { ...queryArgs, widgetId: "surveys_response_rates" } : "skip"
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
      console.error("Failed to add survey widget to draft:", err);
    } finally {
      setIsAddingId(null);
    }
  };

  const widgetsList = [
    {
      id: "surveys_response_counts",
      title: "Survey Response Count",
      track: "Response Volume",
      badge: "KPI",
      desc: "Total completed guest feedback submissions and rating attempts in the active period.",
      width: 4,
    },
    {
      id: "surveys_average_rating",
      title: "Average Survey Rating",
      track: "Overall CSAT",
      badge: "KPI",
      desc: "Average star and numeric rating across food quality, service pacing, and ambiance.",
      width: 4,
    },
    {
      id: "surveys_recent_feedback",
      title: "Recent Feedback",
      track: "Live Feedback Feed",
      badge: "TABLE",
      desc: "Chronological stream of guest reviews, direct compliments, and specific server mentions.",
      width: 4,
    },
    {
      id: "surveys_satisfaction_trends",
      title: "Satisfaction Trend",
      track: "Temporal CSAT",
      badge: "CHART",
      desc: "Weekly and monthly rolling CSAT index trend tracking kitchen and floor service consistency.",
      width: 4,
    },
    {
      id: "surveys_low_rating_alerts",
      title: "Low-Rating Alerts",
      track: "Service Escalation",
      badge: "ALERT",
      desc: "Real-time alert list of responses with rating ≤ 2 stars requiring manager intervention.",
      width: 4,
    },
    {
      id: "surveys_response_rates",
      title: "Survey Response Rate",
      track: "Conversion Ratio",
      badge: "KPI",
      desc: "Percentage of dining guests completing feedback survey against total bills printed.",
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
  const respSummary = (surveysResponseCountsData as any)?.summary || {};
  const rateSummary = (surveysAverageRatingData as any)?.summary || {};
  const feedSummary = (surveysRecentFeedbackData as any)?.summary || {};
  const trendSummary = (surveysSatisfactionTrendsData as any)?.summary || {};
  const alertSummary = (surveysLowRatingAlertsData as any)?.summary || {};
  const convSummary = (surveysResponseRatesData as any)?.summary || {};

  return (
    <PosShell title="Surveys Catalog" subtitle="Operational Station Widgets">
      <div className="flex-1 flex flex-col bg-[#fbf8f5] min-h-screen text-stone-900 overflow-y-auto">
        {/* Sub-Header & Breadcrumb */}
        <div className="bg-[#f5eee9] border-b border-[#e7ddd5] px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Link href="/dashboard" className="hover:text-stone-900 transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-stone-900 font-medium">Surveys</span>
            </div>
            <h1 className="font-serif text-2xl text-stone-900 font-semibold tracking-tight">Surveys</h1>
            <p className="text-xs text-stone-500 max-w-2xl">
              Monitor post-meal digital receipt ratings, Net Promoter Score (NPS), staff hospitality mentions, and food quality feedback across every touchpoint.
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
                placeholder="Search Survey widgets..."
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
            {/* Card 1: Survey Response Count */}
            {filteredWidgets.some((w) => w.id === "surveys_response_counts") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Response Volume
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      KPI
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Survey Response Count</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Total completed guest feedback submissions and rating attempts in the active period.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] min-h-[110px] justify-center">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-3xl font-bold text-stone-900">
                          {respSummary.totalResponses || "0"}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">Responses</span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                        {respSummary.deltaPercent || "+0.0%"}
                      </span>
                    </div>

                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden flex">
                      {(respSummary.qrReceiptPercent ?? 0) + (respSummary.cfdPercent ?? 0) > 0 ? (
                        <>
                          <div className="bg-black h-full" style={{ width: `${respSummary.qrReceiptPercent ?? 0}%` }}></div>
                          <div className="bg-stone-400 h-full" style={{ width: `${respSummary.cfdPercent ?? 0}%` }}></div>
                        </>
                      ) : (
                        <div className="bg-stone-300 h-full w-full opacity-40"></div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                      <span>QR Receipt: {respSummary.qrReceiptPercent ?? 0}%</span>
                      <span>CFD Counter: {respSummary.cfdPercent ?? 0}%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("surveys_response_counts")
                      ? `SLOT: ROW ${placedWidgetMap.get("surveys_response_counts")?.gridRow} COL ${placedWidgetMap.get("surveys_response_counts")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("surveys_response_counts") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("surveys_response_counts", 4, 1)}
                      disabled={isAddingId === "surveys_response_counts"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "surveys_response_counts" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 2: Average Survey Rating */}
            {filteredWidgets.some((w) => w.id === "surveys_average_rating") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Overall CSAT
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      KPI
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Average Survey Rating</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Average star and numeric rating across food quality, service pacing, and ambiance.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] min-h-[110px] justify-center">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-3xl font-bold text-stone-900">
                          {rateSummary.avgScore || "0.00"}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">/ 5.0</span>
                      </div>
                      <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold text-xs">
                        <span className="material-symbols-outlined text-[14px] text-amber-600 fill-1">star</span>
                        <span>CSAT</span>
                      </div>
                    </div>

                    <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden flex">
                      {(rateSummary.positivePercent ?? 0) + (rateSummary.neutralPercent ?? 0) + (rateSummary.negativePercent ?? 0) > 0 ? (
                        <>
                          <div className="bg-emerald-600 h-full" style={{ width: `${rateSummary.positivePercent ?? 0}%` }}></div>
                          <div className="bg-amber-500 h-full" style={{ width: `${rateSummary.neutralPercent ?? 0}%` }}></div>
                          <div className="bg-rose-500 h-full" style={{ width: `${rateSummary.negativePercent ?? 0}%` }}></div>
                        </>
                      ) : (
                        <div className="bg-stone-300 h-full w-full opacity-40"></div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                      <span className="text-emerald-700 font-medium">Pos: {rateSummary.positivePercent ?? 0}%</span>
                      <span className="text-amber-700 font-medium">Neu: {rateSummary.neutralPercent ?? 0}%</span>
                      <span className="text-rose-700 font-medium">Neg: {rateSummary.negativePercent ?? 0}%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("surveys_average_rating")
                      ? `SLOT: ROW ${placedWidgetMap.get("surveys_average_rating")?.gridRow} COL ${placedWidgetMap.get("surveys_average_rating")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("surveys_average_rating") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("surveys_average_rating", 4, 1)}
                      disabled={isAddingId === "surveys_average_rating"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "surveys_average_rating" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 3: Recent Feedback */}
            {filteredWidgets.some((w) => w.id === "surveys_recent_feedback") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Live Feedback Feed
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      TABLE
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Recent Feedback</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Chronological stream of guest reviews, direct compliments, and specific server mentions.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-2.5 flex flex-col gap-1.5 border border-[#f3ede6] min-h-[110px] justify-center">
                    {(feedSummary.feedbackItems || []).length === 0 ? (
                      <div className="text-center py-3 text-xs text-stone-400">
                        No customer survey feedback logged yet
                      </div>
                    ) : (
                      (feedSummary.feedbackItems || []).slice(0, 2).map((item: any, idx: number) => (
                        <div key={idx} className="p-1.5 rounded bg-white border border-[#f0eae3] flex flex-col gap-0.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-amber-700">{item.score}</span>
                            <span className="text-stone-400 text-[10px]">{item.table} • {item.time}</span>
                          </div>
                          <p className="text-xs text-stone-800 line-clamp-1 italic font-serif">{item.quote}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("surveys_recent_feedback")
                      ? `SLOT: ROW ${placedWidgetMap.get("surveys_recent_feedback")?.gridRow} COL ${placedWidgetMap.get("surveys_recent_feedback")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("surveys_recent_feedback") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("surveys_recent_feedback", 4, 1)}
                      disabled={isAddingId === "surveys_recent_feedback"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "surveys_recent_feedback" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 4: Satisfaction Trend */}
            {filteredWidgets.some((w) => w.id === "surveys_satisfaction_trends") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Temporal CSAT
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      CHART
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Satisfaction Trend</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Weekly and monthly rolling CSAT index trend tracking kitchen and floor service consistency.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col justify-between border border-[#f3ede6] min-h-[110px]">
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span>7-Day Rolling Index</span>
                      <span className="text-emerald-700 font-bold">{trendSummary.slaTarget || "SLA: 4.5+"}</span>
                    </div>

                    {(trendSummary.chartPoints || []).length > 0 ? (
                      <>
                        <div className="w-full h-8 relative flex items-end my-1">
                          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 200 40">
                            <line className="text-stone-300" stroke="currentColor" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="200" y1="20" y2="20" />
                            {(() => {
                              const pts = (trendSummary.chartPoints || []).map((p: any, idx: number, arr: any[]) => {
                                const x = arr.length === 1 ? 100 : (idx / (arr.length - 1)) * 180 + 10;
                                const score = Math.max(1, Math.min(5, Number(p.value) || 3));
                                const y = 34 - ((score - 1) / 4) * 28;
                                return { x, y };
                              });
                              const pathD = pts.length === 1
                                ? `M 0,${pts[0].y} L 200,${pts[0].y}`
                                : `M ` + pts.map((p: any) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
                              return (
                                <>
                                  <path d={pathD} fill="none" stroke="currentColor" className="text-stone-900" strokeWidth="2" />
                                  {pts.map((p: any, i: number) => (
                                    <circle key={i} cx={p.x} cy={p.y} r="2.5" className="fill-stone-900" />
                                  ))}
                                </>
                              );
                            })()}
                          </svg>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-stone-400 border-t border-[#f0eae3] pt-1">
                          <span>{trendSummary.chartPoints[0]?.label || "Start"}</span>
                          <span className="font-bold text-stone-900">
                            {trendSummary.chartPoints[trendSummary.chartPoints.length - 1]?.label} ({trendSummary.currentRating || "--"}★)
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="h-8 flex items-center justify-center text-xs text-stone-400 italic">
                          No rating trend data in this period
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-stone-400 border-t border-[#f0eae3] pt-1">
                          <span>Goal: 4.5+</span>
                          <span>Awaiting Submissions</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("surveys_satisfaction_trends")
                      ? `SLOT: ROW ${placedWidgetMap.get("surveys_satisfaction_trends")?.gridRow} COL ${placedWidgetMap.get("surveys_satisfaction_trends")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("surveys_satisfaction_trends") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("surveys_satisfaction_trends", 4, 1)}
                      disabled={isAddingId === "surveys_satisfaction_trends"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "surveys_satisfaction_trends" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 5: Low-Rating Alerts */}
            {filteredWidgets.some((w) => w.id === "surveys_low_rating_alerts") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Service Escalation
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-rose-100 text-rose-800">
                      ALERT
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Low-Rating Alerts</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Real-time alert list of responses with rating ≤ 2 stars requiring manager intervention and callout.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col justify-center border border-[#f3ede6] min-h-[110px]">
                    {(alertSummary.alerts || []).length === 0 ? (
                      <div className="bg-emerald-50 border border-emerald-200/60 p-2.5 rounded-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-700 text-lg">verified</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-emerald-900">Sentiment Positive</span>
                          <span className="text-[10px] text-emerald-700">No critical ≤ 2★ reviews logged</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-rose-50 border border-rose-200/80 p-2.5 rounded-lg flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-rose-800 flex items-center gap-1 font-bold">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            {alertSummary.alerts[0]?.stars || "Review"}
                          </span>
                          <span className="text-[10px] text-stone-500">{alertSummary.alerts[0]?.bill || alertSummary.alerts[0]?.table || "Review"}</span>
                        </div>
                        <p className="text-xs text-stone-800 italic line-clamp-1">{alertSummary.alerts[0]?.quote || "Low rating received"}</p>
                        <div className="flex items-center justify-between pt-1 border-t border-rose-200/40 text-[10px]">
                          <span className="px-1.5 py-0.2 bg-rose-200 text-rose-900 rounded font-semibold">
                            {alertSummary.alerts[0]?.callback ? "Callback Requested" : "Review Logged"}
                          </span>
                          <span className="text-stone-500">{alertSummary.alerts[0]?.table || alertSummary.alerts[0]?.time || "Guest Feedback"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("surveys_low_rating_alerts")
                      ? `SLOT: ROW ${placedWidgetMap.get("surveys_low_rating_alerts")?.gridRow} COL ${placedWidgetMap.get("surveys_low_rating_alerts")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("surveys_low_rating_alerts") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("surveys_low_rating_alerts", 4, 1)}
                      disabled={isAddingId === "surveys_low_rating_alerts"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "surveys_low_rating_alerts" ? "Adding..." : "Add Widget"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Card 6: Survey Response Rate */}
            {filteredWidgets.some((w) => w.id === "surveys_response_rates") && (
              <div className="bg-white rounded-xl p-5 border border-[#eee7e1] flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-sans font-bold text-stone-400 tracking-widest uppercase">
                      Conversion Ratio
                    </span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider uppercase bg-[#ece6e0] text-stone-700">
                      KPI
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-lg text-stone-900 font-normal">Survey Response Rate</h3>
                    <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                      Percentage of dining guests completing feedback survey against total bills printed.
                    </p>
                  </div>

                  {/* Preview Box */}
                  <div className="bg-[#fcf8f5] rounded-lg p-3 flex flex-col gap-2 border border-[#f3ede6] min-h-[110px] justify-center">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-serif text-3xl font-bold text-stone-900">
                          {convSummary.conversionPercent || "0%"}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">Rate</span>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        convSummary.isOptimal
                          ? "text-emerald-700 bg-emerald-100/70"
                          : (convSummary.rawRate ?? 0) > 0
                          ? "text-amber-800 bg-amber-100/70"
                          : "text-stone-500 bg-stone-100"
                      }`}>
                        {convSummary.trendLabel || ((convSummary.rawRate ?? 0) > 0 ? "Building Pace" : "Awaiting Data")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-stone-100 text-[11px]">
                      <span className="text-stone-600 truncate">{convSummary.benchmark || "Benchmark: 15–20%"}</span>
                      <span className={`font-bold shrink-0 ${
                        convSummary.isOptimal
                          ? "text-emerald-700"
                          : (convSummary.rawRate ?? 0) > 0
                          ? "text-amber-700"
                          : "text-stone-400"
                      }`}>
                        {convSummary.isOptimal ? "Optimal" : (convSummary.rawRate ?? 0) > 0 ? "Pacing" : "No Data"}
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-500 pt-0.5">
                      <span>{convSummary.status || "Awaiting Submissions"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#f0eae3] flex items-center justify-between mt-3">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                    {placedWidgetMap.has("surveys_response_rates")
                      ? `SLOT: ROW ${placedWidgetMap.get("surveys_response_rates")?.gridRow} COL ${placedWidgetMap.get("surveys_response_rates")?.gridCol}`
                      : "LAYOUT: 1X1 SQUARE"}
                  </span>
                  {placedWidgetMap.has("surveys_response_rates") ? (
                    <button disabled className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eae2d9] text-stone-600 text-xs font-semibold rounded-full cursor-default">
                      <span>Added</span>
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddWidget("surveys_response_rates", 4, 1)}
                      disabled={isAddingId === "surveys_response_rates"}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-black hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-full transition-all"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      <span>{isAddingId === "surveys_response_rates" ? "Adding..." : "Add Widget"}</span>
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

