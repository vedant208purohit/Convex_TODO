"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PosShell } from "@/app/components/PosShell";

// ====================================================
// TYPES & INTERFACES
// ====================================================

type DateRangeOption = "7d" | "30d" | "90d" | "all" | "custom";

interface DateRangeConfig {
  key: DateRangeOption;
  label: string;
  sublabel: string;
}

const DATE_RANGE_OPTIONS: DateRangeConfig[] = [
  { key: "7d", label: "Last 7 Days", sublabel: "Past 7 days of activity" },
  { key: "30d", label: "Last 30 Days", sublabel: "Standard monthly window" },
  { key: "90d", label: "Last 90 Days", sublabel: "Quarterly review cycle" },
  { key: "all", label: "All Time", sublabel: "Complete survey history" },
  { key: "custom", label: "Custom Range", sublabel: "Pick specific date window" },
];

export interface EnrichedComment {
  id: string;
  attemptId: string;
  questionId: string;
  questionText: string;
  questionPosition: number;
  answerText: string;
  submittedAt: number;
  tableNumber?: string;
  orderNumber?: string;
  serviceMode?: string;
  ratingBadges: Array<{ label: string; score: number }>;
}

// Helpers to format timestamps consistently
function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

// Formula injection protection for CSV export
function sanitizeForCsv(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '""';
  let str = String(value);
  // Protect against spreadsheet formula injection (=, +, -, @, tab, CR)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Escape double quotes by doubling them
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

// Helper to extract table number digits for circle badge
function extractTableBadgeNumber(tableNumber?: string): string {
  if (!tableNumber) return "";
  const match = tableNumber.match(/\d+/);
  return match ? match[0] : tableNumber.slice(0, 3);
}

// ====================================================
// VIEW ALL COMMENTS CONTENT COMPONENT
// ====================================================

function SurveyCommentsContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = params?.id as string | undefined;
  const surveyId = rawId as Id<"surveys"> | undefined;

  // Read initial date range from search params if present
  const initialRange = (searchParams?.get("range") as DateRangeOption) || "30d";
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeOption>(
    ["7d", "30d", "90d", "all", "custom"].includes(initialRange) ? initialRange : "30d"
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Search, Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [previewEmptyState, setPreviewEmptyState] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Compute timestamp boundaries
  const { fromDate, toDate, displayDateLabel } = useMemo(() => {
    const now = Date.now();
    let from: number | undefined;
    let to: number | undefined = now;
    let label = "Last 30 Days";

    if (dateRangeKey === "7d") {
      from = now - 7 * 24 * 60 * 60 * 1000;
      label = `Last 7 Days: ${formatDate(from)} – ${formatDate(now)}`;
    } else if (dateRangeKey === "30d") {
      from = now - 30 * 24 * 60 * 60 * 1000;
      label = `Last 30 Days: ${formatDate(from)} – ${formatDate(now)}`;
    } else if (dateRangeKey === "90d") {
      from = now - 90 * 24 * 60 * 60 * 1000;
      label = `Last 90 Days: ${formatDate(from)} – ${formatDate(now)}`;
    } else if (dateRangeKey === "all") {
      from = undefined;
      to = undefined;
      label = "All Time: All Submissions";
    } else if (dateRangeKey === "custom") {
      const parsedStart = customStartDate ? new Date(customStartDate).getTime() : undefined;
      const parsedEnd = customEndDate
        ? new Date(customEndDate).setHours(23, 59, 59, 999)
        : undefined;
      from = parsedStart;
      to = parsedEnd;
      const startStr = parsedStart ? formatDate(parsedStart) : "Beginning";
      const endStr = parsedEnd ? formatDate(parsedEnd) : "Now";
      label = `Custom Range: ${startStr} – ${endStr}`;
    }

    return { fromDate: from, toDate: to, displayDateLabel: label };
  }, [dateRangeKey, customStartDate, customEndDate]);

  // Query survey results directly from Convex
  const surveyResults = useQuery(
    api.surveys.getResults,
    surveyId
      ? {
          surveyId,
          fromDate,
          toDate,
        }
      : "skip"
  );

  // Extract all written questions
  const writtenQuestions = useMemo(() => {
    if (!surveyResults?.questions) return [];
    return surveyResults.questions.filter(
      (q) => q.type === "short" || q.type === "long" || (q as any).responses !== undefined
    );
  }, [surveyResults]);

  // Extract and enrich all comments from the results
  const allComments: EnrichedComment[] = useMemo(() => {
    if (!surveyResults?.questions) return [];
    const list: EnrichedComment[] = [];

    for (const q of surveyResults.questions) {
      if (q.type === "short" || q.type === "long" || (q as any).responses) {
        const responses = (q as any).responses || [];
        for (let i = 0; i < responses.length; i++) {
          const r = responses[i];
          if (r.answerText && r.answerText.trim().length > 0) {
            list.push({
              id: `${q.questionId}_${r.attemptId}_${i}`,
              attemptId: r.attemptId,
              questionId: q.questionId,
              questionText: q.questionText,
              questionPosition: q.position ?? 1,
              answerText: r.answerText,
              submittedAt: r.submittedAt,
              tableNumber: r.tableNumber,
              orderNumber: r.orderNumber,
              serviceMode: r.serviceMode,
              ratingBadges: r.ratingBadges || [],
            });
          }
        }
      }
    }

    // Sort newest first
    return list.sort((a, b) => b.submittedAt - a.submittedAt);
  }, [surveyResults]);

  // Filter comments by search query and question selection
  const filteredComments = useMemo(() => {
    return allComments.filter((c) => {
      // Question filter
      if (selectedQuestionId !== "all" && c.questionId !== selectedQuestionId) {
        return false;
      }

      // Text search
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      return (
        c.answerText.toLowerCase().includes(query) ||
        c.questionText.toLowerCase().includes(query) ||
        (c.tableNumber && c.tableNumber.toLowerCase().includes(query)) ||
        (c.orderNumber && c.orderNumber.toLowerCase().includes(query)) ||
        (c.serviceMode && c.serviceMode.toLowerCase().includes(query))
      );
    });
  }, [allComments, selectedQuestionId, searchQuery]);

  // Calculate pagination
  const totalFiltered = filteredComments.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedComments = filteredComments.slice(startIndex, startIndex + pageSize);

  // Derive Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalWritten = allComments.length;
    const totalPublished = surveyResults?.totalPublishedAttempts ?? 0;

    // Unique attempts that provided comments
    const uniqueCommentAttempts = new Set(allComments.map((c) => c.attemptId)).size;

    // Response rate based on verified completed submissions
    const commentResponseRate =
      totalPublished > 0
        ? Number(((uniqueCommentAttempts / totalPublished) * 100).toFixed(1))
        : 0;

    // Average overall rating for the comments' associated submissions
    const overallScores: number[] = [];
    const seenAttempts = new Set<string>();
    for (const c of allComments) {
      if (!seenAttempts.has(c.attemptId)) {
        seenAttempts.add(c.attemptId);
        const overallBadge = c.ratingBadges.find((b) => b.label.toLowerCase() === "overall");
        if (overallBadge && typeof overallBadge.score === "number") {
          overallScores.push(overallBadge.score);
        }
      }
    }

    const avgOverallRating =
      overallScores.length > 0
        ? (overallScores.reduce((sum, val) => sum + val, 0) / overallScores.length).toFixed(1)
        : surveyResults?.overallRating
          ? surveyResults.overallRating.average.toFixed(1)
          : null;

    return {
      totalWritten,
      totalPublished,
      commentResponseRate,
      uniqueCommentAttempts,
      avgOverallRating,
      ratingCount: overallScores.length,
    };
  }, [allComments, surveyResults]);

  // CSV Export Handler: Exports ALL filtered comments matching current criteria
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      if (!surveyResults) {
        throw new Error("No comments data loaded to export.");
      }

      if (filteredComments.length === 0) {
        alert("No matching comments to export for the current filters.");
        return;
      }

      const headers = [
        "Survey ID",
        "Survey Name",
        "Attempt ID",
        "Submission Date/Time",
        "Table Number",
        "Order Number",
        "Service Mode",
        "Question Position",
        "Question Text",
        "Associated Ratings",
        "Customer Comment",
      ];

      const rows: string[] = [];
      const surveyName = surveyResults.surveyName || "Survey";
      const surveyIdStr = surveyResults.surveyId;

      for (const c of filteredComments) {
        const ratingStr = c.ratingBadges
          .map((b) => `${b.label}: ${b.score.toFixed(1)} ★`)
          .join(" | ");

        rows.push(
          [
            sanitizeForCsv(surveyIdStr),
            sanitizeForCsv(surveyName),
            sanitizeForCsv(c.attemptId),
            sanitizeForCsv(formatDateTime(c.submittedAt)),
            sanitizeForCsv(c.tableNumber || ""),
            sanitizeForCsv(c.orderNumber || ""),
            sanitizeForCsv(c.serviceMode || ""),
            sanitizeForCsv(c.questionPosition),
            sanitizeForCsv(c.questionText),
            sanitizeForCsv(ratingStr),
            sanitizeForCsv(c.answerText),
          ].join(",")
        );
      }

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const sanitizedName = surveyName.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
      link.href = url;
      link.setAttribute("download", `${sanitizedName}_comments_${dateRangeKey}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export failed:", err);
      alert(err.message || "Failed to export comments CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  // SKELETON LOADING STATE
  if (surveyResults === undefined) {
    return (
      <PosShell title="Surveys" subtitle="Guest Suggestions & Comments">
        <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 animate-pulse">
          <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="h-4 w-56 bg-stone-200 rounded" />
                <div className="h-8 w-80 bg-stone-300 rounded" />
                <div className="h-4 w-96 bg-stone-200 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-11 w-48 bg-stone-200 rounded-lg" />
                <div className="h-11 w-32 bg-stone-300 rounded-lg" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="h-28 bg-white rounded-xl border border-[#E8E6E3]" />
              <div className="h-28 bg-white rounded-xl border border-[#E8E6E3]" />
              <div className="h-28 bg-white rounded-xl border border-[#E8E6E3]" />
              <div className="h-28 bg-white rounded-xl border border-[#E8E6E3]" />
            </div>

            <div className="h-96 bg-white rounded-xl border border-[#E8E6E3]" />
          </div>
        </div>
      </PosShell>
    );
  }

  // ERROR / NOT FOUND STATE
  if (!surveyResults) {
    return (
      <PosShell title="Surveys" subtitle="Guest Suggestions & Comments">
        <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 flex items-center justify-center">
          <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-xs border border-[#E8E6E3]">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">error</span>
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">Survey Not Found</h2>
            <p className="text-sm text-[#5b5f64] mb-6">
              The survey comments you requested do not exist or you do not have permission to view
              them.
            </p>
            <button
              onClick={() => router.push("/surveys")}
              className="px-4 py-2.5 bg-black hover:bg-stone-800 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Back to Surveys Dashboard
            </button>
          </div>
        </div>
      </PosShell>
    );
  }

  return (
    <PosShell title="Surveys" subtitle="Guest Suggestions & Comments">
      <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 text-[#1A1A1A]">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
          {/* ==================================================== */}
          {/* TOP COMMAND & BREADCRUMB STRIP */}
          {/* ==================================================== */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2 text-[13px] text-[#5b5f64] flex-wrap">
                <Link
                  href={`/surveys/${surveyId}/analytics?range=${dateRangeKey}`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#E9E8E7] transition-colors text-[#1A1A1A] font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  <span>Back to Analytics</span>
                </Link>
                <span className="text-[#C4C7C7]">/</span>
                <Link href="/surveys" className="hover:text-[#1A1A1A] transition-colors">
                  Surveys
                </Link>
                <span className="text-[#C4C7C7]">/</span>
                <Link
                  href={`/surveys/${surveyId}/analytics?range=${dateRangeKey}`}
                  className="hover:text-[#1A1A1A] transition-colors font-medium truncate max-w-[200px] sm:max-w-xs"
                >
                  {surveyResults.surveyName}
                </Link>
                <span className="text-[#C4C7C7]">/</span>
                <Link
                  href={`/surveys/${surveyId}/analytics?range=${dateRangeKey}`}
                  className="hover:text-[#1A1A1A] transition-colors font-medium"
                >
                  Analytics
                </Link>
                <span className="text-[#C4C7C7]">/</span>
                <span className="text-black font-semibold">All Comments</span>
              </div>

              {/* Survey Live Status Badge */}
              {surveyResults.active ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F4EA] text-[#137333] text-[13px] font-semibold shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#137333] animate-pulse" />
                  <span className="tracking-wide uppercase text-[11px]">SURVEY LIVE & ACTIVE</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5F3F3] text-[#5B5F64] text-[13px] font-medium shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#747878]" />
                  <span className="tracking-wide uppercase text-[11px]">DRAFT / INACTIVE</span>
                </div>
              )}
            </div>

            {/* Main Title & Action Bar */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
              <div>
                <h1 className="text-[28px] lg:text-[32px] leading-tight font-extrabold text-[#1A1A1A] tracking-tight">
                  Guest Suggestions & Comments
                </h1>
                <p className="text-[14px] text-[#5b5f64] mt-1">
                  Verbatim feedback, table attributions, and service ratings for{" "}
                  <strong className="text-[#1A1A1A] font-semibold">{surveyResults.surveyName}</strong>{" "}
                  <span className="font-mono text-xs text-[#5b5f64] ml-1">
                    (#{surveyResults.surveyId.slice(-6).toUpperCase()})
                  </span>
                </p>
              </div>

              {/* Action Group: Date Range Dropdown + Export CSV */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Date Filter Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsDatePickerOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 h-11 px-4 bg-white text-[#1A1A1A] border border-[#E8E6E3] rounded-lg shadow-xs hover:bg-[#FAF9F6] transition-colors text-[13px] font-medium cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#5b5f64]">
                      calendar_today
                    </span>
                    <span>{displayDateLabel}</span>
                    <span className="material-symbols-outlined text-[16px] text-[#5b5f64]">
                      arrow_drop_down
                    </span>
                  </button>

                  {/* Dropdown Menu */}
                  {isDatePickerOpen && (
                    <div className="absolute right-0 top-12 z-50 w-72 bg-white rounded-xl shadow-lg border border-[#E8E6E3] p-2 flex flex-col gap-1">
                      {DATE_RANGE_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setDateRangeKey(opt.key);
                            setCurrentPage(1);
                            if (opt.key !== "custom") {
                              setIsDatePickerOpen(false);
                            }
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-left flex flex-col transition-colors cursor-pointer ${
                            dateRangeKey === opt.key
                              ? "bg-black text-white"
                              : "hover:bg-[#FAF9F6] text-[#1A1A1A]"
                          }`}
                        >
                          <span className="text-[13px] font-semibold">{opt.label}</span>
                          <span
                            className={`text-[11px] ${
                              dateRangeKey === opt.key ? "text-stone-300" : "text-[#5b5f64]"
                            }`}
                          >
                            {opt.sublabel}
                          </span>
                        </button>
                      ))}

                      {/* Custom Range Inputs */}
                      {dateRangeKey === "custom" && (
                        <div className="p-3 border-t border-[#E8E6E3] mt-1 flex flex-col gap-2 bg-[#FAF9F6] rounded-lg">
                          <label className="text-[11px] font-semibold text-[#5b5f64] uppercase tracking-wider">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full h-8 px-2 bg-white border border-[#D6D3CD] rounded text-xs text-[#1A1A1A]"
                          />
                          <label className="text-[11px] font-semibold text-[#5b5f64] uppercase tracking-wider mt-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full h-8 px-2 bg-white border border-[#D6D3CD] rounded text-xs text-[#1A1A1A]"
                          />
                          <button
                            type="button"
                            onClick={() => setIsDatePickerOpen(false)}
                            className="mt-2 w-full py-1.5 bg-black text-white text-xs font-semibold rounded hover:bg-stone-800 transition-colors cursor-pointer"
                          >
                            Apply Custom Dates
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Export CSV Button */}
                <button
                  onClick={handleExportCsv}
                  disabled={isExporting || allComments.length === 0}
                  className="inline-flex items-center gap-2 h-11 px-4 bg-black hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-lg shadow-xs transition-colors text-[13px] font-semibold cursor-pointer disabled:cursor-not-allowed"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isExporting ? "hourglass_top" : "download"}
                  </span>
                  <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SECTION 1: SUMMARY METRIC CARDS */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Written Comments */}
            <div className="bg-white p-5 rounded-xl border border-[#E8E6E3] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#5b5f64]">
                  Total Comments
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-[#1A1A1A]">
                  <span className="material-symbols-outlined text-[18px]">rate_review</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] font-bold text-[#1A1A1A] leading-none">
                    {summaryMetrics.totalWritten}
                  </span>
                  <span className="text-xs text-[#5b5f64]">written entries</span>
                </div>
                <p className="text-xs text-[#5b5f64] mt-1.5">
                  Across {summaryMetrics.uniqueCommentAttempts} unique dining attempts
                </p>
              </div>
            </div>

            {/* Card 2: Total Completed Submissions */}
            <div className="bg-white p-5 rounded-xl border border-[#E8E6E3] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#5b5f64]">
                  Completed Submissions
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-[#1A1A1A]">
                  <span className="material-symbols-outlined text-[18px]">fact_check</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] font-bold text-[#1A1A1A] leading-none">
                    {summaryMetrics.totalPublished}
                  </span>
                  <span className="text-xs text-[#5b5f64]">verified attempts</span>
                </div>
                <p className="text-xs text-[#5b5f64] mt-1.5">
                  100% completion in selected date range
                </p>
              </div>
            </div>

            {/* Card 3: Written-Comment Response Rate */}
            <div className="bg-white p-5 rounded-xl border border-[#E8E6E3] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#5b5f64]">
                  Comment Response Rate
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-[#1A1A1A]">
                  <span className="material-symbols-outlined text-[18px]">query_stats</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[28px] font-bold text-[#1A1A1A] leading-none">
                    {summaryMetrics.commentResponseRate}%
                  </span>
                  <span className="text-xs text-[#5b5f64]">of submissions</span>
                </div>
                <p className="text-xs text-[#5b5f64] mt-1.5">
                  Guests sharing optional text notes
                </p>
              </div>
            </div>

            {/* Card 4: Mean Experience Score */}
            <div className="bg-white p-5 rounded-xl border border-[#E8E6E3] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#5b5f64]">
                  Mean Experience Score
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-[#1A1A1A]">
                  <span
                    className="material-symbols-outlined text-[18px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                </div>
              </div>
              <div className="mt-3">
                {summaryMetrics.avgOverallRating ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[28px] font-bold text-[#1A1A1A] leading-none">
                        {summaryMetrics.avgOverallRating}
                      </span>
                      <span className="text-xs text-[#5b5f64]">/ 5.0</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-black">
                      <span
                        className="material-symbols-outlined text-[15px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                      <span className="text-xs text-[#5b5f64]">
                        {summaryMetrics.ratingCount > 0
                          ? `From ${summaryMetrics.ratingCount} associated ratings`
                          : "Calculated from survey ratings"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[24px] font-bold text-[#5b5f64] leading-none">—</span>
                      <span className="text-xs text-[#5b5f64]">Unavailable</span>
                    </div>
                    <p className="text-xs text-[#5b5f64] mt-1.5">No numeric ratings recorded</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SECTION 2: COMMENTS LIST & CONTROLS CONTAINER */}
          {/* ==================================================== */}
          <div className="bg-white rounded-xl border border-[#E8E6E3] shadow-xs overflow-hidden">
            {/* Header with Title, Empty Preview Toggle, and Search */}
            <div className="p-5 lg:p-6 border-b border-[#E8E6E3] flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#1A1A1A]">
                      Guest Suggestions &amp; Comments
                    </h2>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FAF9F6] text-[#5b5f64] border border-[#E8E6E3]">
                      {allComments.length} Written
                    </span>
                  </div>
                  <p className="text-xs text-[#5b5f64] mt-0.5">
                    Verbatim responses to open-ended feedback and dining suggestions
                  </p>
                </div>

                {/* Controls: Preview Empty State Toggle & Count */}
                <div className="flex items-center gap-3">
                  <button
                    id="toggleEmptyStateBtn"
                    onClick={() => setPreviewEmptyState((prev) => !prev)}
                    className="text-xs text-[#5b5f64] hover:text-[#1A1A1A] transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {previewEmptyState ? "toggle_on" : "toggle_off"}
                    </span>
                    <span>{previewEmptyState ? "Show Populated List" : "Preview Empty State"}</span>
                  </button>
                  <span className="text-[#C4C7C7] hidden sm:inline">•</span>
                  <span className="text-xs text-[#5b5f64] font-medium">
                    Showing {paginatedComments.length} of {totalFiltered} comments
                  </span>
                </div>
              </div>

              {/* Search & Question Filter Row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#9E9C98]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search comments, table number, order, or service mode..."
                    className="w-full h-10 pl-9 pr-8 bg-[#FAF9F6] border border-[#D6D3CD] rounded-lg text-xs text-[#1A1A1A] placeholder:text-[#9E9C98] focus:outline-none focus:border-black transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-[#9E9C98] hover:text-[#1A1A1A] cursor-pointer"
                      title="Clear search"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>

                {/* Question Filter Dropdown (if multiple questions exist) */}
                {writtenQuestions.length > 1 && (
                  <div className="relative sm:w-64">
                    <select
                      value={selectedQuestionId}
                      onChange={(e) => {
                        setSelectedQuestionId(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full h-10 px-3 bg-[#FAF9F6] border border-[#D6D3CD] rounded-lg text-xs text-[#1A1A1A] focus:outline-none focus:border-black transition-colors appearance-none pr-8 cursor-pointer font-medium"
                    >
                      <option value="all">All Feedback Questions</option>
                      {writtenQuestions.map((q) => (
                        <option key={q.questionId} value={q.questionId}>
                          Q{q.position} • {q.questionText}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-[18px] text-[#5b5f64] pointer-events-none">
                      expand_more
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Comments List or Empty States */}
            <div className="p-5 lg:p-6">
              {/* Preview Empty State or Zero Comments in Database */}
              {previewEmptyState || allComments.length === 0 ? (
                <div
                  id="emptyStateContainer"
                  className="py-16 flex flex-col items-center justify-center text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-[#5b5f64] mb-3">
                    <span className="material-symbols-outlined text-[28px]">chat_bubble_outline</span>
                  </div>
                  <h3 className="text-base font-bold text-[#1A1A1A]">No Written Comments Yet</h3>
                  <p className="text-xs text-[#5b5f64] mt-1 max-w-md leading-relaxed">
                    No guest has submitted text feedback for the selected date window. Quantitative
                    ratings and choice responses are still captured in Survey Analytics.
                  </p>
                  <Link
                    href={`/surveys/${surveyId}/analytics?range=${dateRangeKey}`}
                    className="mt-4 px-4 py-2 bg-black hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    Return to Analytics
                  </Link>
                </div>
              ) : filteredComments.length === 0 ? (
                /* Search Filter Yielded Zero Results */
                <div className="py-14 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-[#5b5f64] mb-3">
                    <span className="material-symbols-outlined text-[24px]">search_off</span>
                  </div>
                  <h3 className="text-sm font-bold text-[#1A1A1A]">No Comments Match Your Search</h3>
                  <p className="text-xs text-[#5b5f64] mt-1 max-w-sm">
                    No verbatim feedback matched &ldquo;{searchQuery}&rdquo;. Try another keyword or
                    clear your filters.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedQuestionId("all");
                    }}
                    className="mt-4 px-3.5 py-1.5 bg-[#FAF9F6] hover:bg-[#E9E8E7] text-[#1A1A1A] border border-[#E8E6E3] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Clear Search Filters
                  </button>
                </div>
              ) : (
                /* Populated Comments Stream */
                <div id="commentsContainer" className="flex flex-col gap-3">
                  {paginatedComments.map((comment) => {
                    const badgeNum = extractTableBadgeNumber(comment.tableNumber);

                    return (
                      <div
                        key={comment.id}
                        className="p-4 sm:p-5 rounded-xl bg-white hover:bg-[#FAF9F6] border border-[#E8E6E3] transition-colors flex flex-col gap-2.5 shadow-2xs"
                      >
                        {/* Header: Table, Service Mode, Date */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Table Circle Badge */}
                            {comment.tableNumber ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                                  {badgeNum || "T"}
                                </span>
                                <span className="text-xs font-bold text-[#1A1A1A]">
                                  {comment.tableNumber}
                                </span>
                              </div>
                            ) : comment.orderNumber ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-6 h-6 rounded-full bg-[#FAF9F6] border border-[#E8E6E3] text-[#1A1A1A] flex items-center justify-center font-bold text-[11px] shrink-0">
                                  #
                                </span>
                                <span className="text-xs font-bold text-[#1A1A1A]">
                                  Order #{comment.orderNumber}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="w-6 h-6 rounded-full bg-[#FAF9F6] border border-[#E8E6E3] text-[#5b5f64] flex items-center justify-center text-[13px] shrink-0">
                                  <span className="material-symbols-outlined text-[14px]">person</span>
                                </span>
                                <span className="text-xs font-semibold text-[#5b5f64]">
                                  Verified Guest
                                </span>
                              </div>
                            )}

                            <span className="text-[#C4C7C7]">•</span>
                            <span className="text-xs text-[#5b5f64] font-medium">
                              {comment.serviceMode || "Dining Service"}
                            </span>

                            {/* Question pill if multiple questions */}
                            {writtenQuestions.length > 1 && (
                              <>
                                <span className="text-[#C4C7C7]">•</span>
                                <span className="text-[11px] font-semibold text-[#5b5f64] bg-[#FAF9F6] border border-[#E8E6E3] px-2 py-0.5 rounded">
                                  Q{comment.questionPosition}: {comment.questionText}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Timestamp */}
                          <span className="text-xs text-[#5b5f64] font-medium shrink-0">
                            {formatDateTime(comment.submittedAt)}
                          </span>
                        </div>

                        {/* Verbatim Feedback Text */}
                        <p className="text-[14px] text-[#1A1A1A] italic leading-relaxed break-words font-medium">
                          &ldquo;{comment.answerText}&rdquo;
                        </p>

                        {/* Rating Badges associated with this attempt */}
                        {comment.ratingBadges.length > 0 && (
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            {comment.ratingBadges.map((badge, bIdx) => (
                              <span
                                key={bIdx}
                                className="text-[11px] font-semibold text-[#1A1A1A] bg-[#FAF9F6] border border-[#E8E6E3] px-2 py-0.5 rounded shadow-2xs"
                              >
                                {badge.label}: {badge.score.toFixed(1)} ★
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ==================================================== */}
              {/* PAGINATION BAR */}
              {/* ==================================================== */}
              {!previewEmptyState && totalFiltered > 0 && (
                <div
                  id="commentsFooter"
                  className="mt-6 pt-4 border-t border-[#E8E6E3] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5b5f64]"
                >
                  <div className="flex items-center gap-3">
                    <span>
                      Showing{" "}
                      <strong className="text-[#1A1A1A] font-semibold">
                        {startIndex + 1}–{Math.min(startIndex + pageSize, totalFiltered)}
                      </strong>{" "}
                      of <strong className="text-[#1A1A1A] font-semibold">{totalFiltered}</strong>{" "}
                      comments
                    </span>

                    {/* Page Size Selector */}
                    <div className="flex items-center gap-1.5 ml-2">
                      <span>Per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="bg-[#FAF9F6] border border-[#D6D3CD] rounded px-1.5 py-0.5 text-xs text-[#1A1A1A] focus:outline-none"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safeCurrentPage === 1}
                        className="p-1.5 rounded-lg border border-[#E8E6E3] bg-[#FAF9F6] hover:bg-[#E9E8E7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Previous page"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                      </button>

                      {Array.from({ length: totalPages }).map((_, idx) => {
                        const pageNum = idx + 1;
                        // Show first, last, and pages around current
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= safeCurrentPage - 1 && pageNum <= safeCurrentPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                safeCurrentPage === pageNum
                                  ? "bg-black text-white"
                                  : "bg-[#FAF9F6] border border-[#E8E6E3] text-[#1A1A1A] hover:bg-[#E9E8E7]"
                              }`}
                              type="button"
                            >
                              {pageNum}
                            </button>
                          );
                        }
                        if (pageNum === safeCurrentPage - 2 || pageNum === safeCurrentPage + 2) {
                          return (
                            <span key={pageNum} className="px-1 text-[#9E9C98]">
                              …
                            </span>
                          );
                        }
                        return null;
                      })}

                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safeCurrentPage === totalPages}
                        className="p-1.5 rounded-lg border border-[#E8E6E3] bg-[#FAF9F6] hover:bg-[#E9E8E7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Next page"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PosShell>
  );
}

// Wrap in Suspense to support useSearchParams in Next.js App Router
export default function SurveyCommentsPage() {
  return (
    <Suspense fallback={null}>
      <SurveyCommentsContent />
    </Suspense>
  );
}
