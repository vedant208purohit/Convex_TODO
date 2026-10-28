"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PosShell } from "@/app/components/PosShell";

// ====================================================
// TYPES & HELPER INTERFACES
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

// Helper to format timestamps consistently
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

// ====================================================
// MAIN COMPONENT
// ====================================================

function IndividualSurveyAnalyticsContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = params?.id as string | undefined;
  const surveyId = rawId as Id<"surveys"> | undefined;

  // Read initial date range from URL query parameters if returning from Comments
  const initialRange = (searchParams?.get("range") as DateRangeOption) || "30d";
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeOption>(
    ["7d", "30d", "90d", "all", "custom"].includes(initialRange) ? initialRange : "30d"
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Modal State for viewing all comments of a specific written question
  const [activeCommentQuestion, setActiveCommentQuestion] = useState<any | null>(null);
  const [commentsSearch, setCommentsSearch] = useState("");
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

  // Query survey analytics directly from Convex
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

  // CSV Export Handler
  const handleExportCsv = async () => {
    try {
      setIsExporting(true);

      if (!surveyResults) {
        throw new Error("No analytics data loaded to export.");
      }

      // Build CSV Headers
      const headers = [
        "Survey ID",
        "Survey Name",
        "Attempt ID",
        "Submission Timestamp",
        "Table Number",
        "Order Number",
        "Service Mode",
        "Question Position",
        "Question Type",
        "Question Text",
        "Answer Value",
      ];

      const rows: string[] = [];
      const surveyName = surveyResults.surveyName || "Survey";
      const surveyIdStr = surveyResults.surveyId;

      for (const q of surveyResults.questions) {
        if (q.type === "short" || q.type === "long") {
          const textRes = (q as any).responses || [];
          for (const item of textRes) {
            rows.push(
              [
                sanitizeForCsv(surveyIdStr),
                sanitizeForCsv(surveyName),
                sanitizeForCsv(item.attemptId),
                sanitizeForCsv(item.submittedAt ? formatDateTime(item.submittedAt) : ""),
                sanitizeForCsv(item.tableNumber || ""),
                sanitizeForCsv(item.orderNumber || ""),
                sanitizeForCsv(item.serviceMode || ""),
                sanitizeForCsv(q.position),
                sanitizeForCsv(q.type),
                sanitizeForCsv(q.questionText),
                sanitizeForCsv(item.answerText),
              ].join(",")
            );
          }
        } else if (q.type === "numeric") {
          const dist = (q as any).distribution || {};
          for (const [ratingVal, count] of Object.entries(dist)) {
            rows.push(
              [
                sanitizeForCsv(surveyIdStr),
                sanitizeForCsv(surveyName),
                sanitizeForCsv("AGGREGATE_COUNT"),
                sanitizeForCsv(displayDateLabel),
                sanitizeForCsv(""),
                sanitizeForCsv(""),
                sanitizeForCsv(""),
                sanitizeForCsv(q.position),
                sanitizeForCsv(q.type),
                sanitizeForCsv(q.questionText),
                sanitizeForCsv(`Score ${ratingVal}: ${count} votes`),
              ].join(",")
            );
          }
        } else if (q.type === "radio" || q.type === "checkbox" || q.type === "select") {
          const optCounts = (q as any).optionCounts || {};
          for (const [opt, count] of Object.entries(optCounts)) {
            rows.push(
              [
                sanitizeForCsv(surveyIdStr),
                sanitizeForCsv(surveyName),
                sanitizeForCsv("AGGREGATE_CHOICE"),
                sanitizeForCsv(displayDateLabel),
                sanitizeForCsv(""),
                sanitizeForCsv(""),
                sanitizeForCsv(""),
                sanitizeForCsv(q.position),
                sanitizeForCsv(q.type),
                sanitizeForCsv(q.questionText),
                sanitizeForCsv(`${opt}: ${count} selections`),
              ].join(",")
            );
          }
        }
      }

      if (rows.length === 0) {
        rows.push(
          [
            sanitizeForCsv(surveyIdStr),
            sanitizeForCsv(surveyName),
            sanitizeForCsv("NO_SUBMISSIONS"),
            sanitizeForCsv(displayDateLabel),
            sanitizeForCsv(""),
            sanitizeForCsv(""),
            sanitizeForCsv(""),
            sanitizeForCsv(""),
            sanitizeForCsv(""),
            sanitizeForCsv("No completed submissions found in selected date range"),
            sanitizeForCsv(""),
          ].join(",")
        );
      }

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeSurveySlug = surveyName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      link.setAttribute(
        "download",
        `${safeSurveySlug}-analytics-${dateRangeKey}-${new Date().toISOString().slice(0, 10)}.csv`
      );
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered comments for the active modal question
  const modalComments = useMemo(() => {
    if (!activeCommentQuestion) return [];
    const list = activeCommentQuestion.responses || [];
    if (!commentsSearch.trim()) return list;
    const query = commentsSearch.toLowerCase();
    return list.filter(
      (c: any) =>
        c.answerText?.toLowerCase().includes(query) ||
        c.tableNumber?.toLowerCase().includes(query) ||
        c.orderNumber?.toLowerCase().includes(query)
    );
  }, [activeCommentQuestion, commentsSearch]);

  // SKELETON LOADING STATE
  if (surveyResults === undefined) {
    return (
      <PosShell title="Surveys" subtitle="Individual Survey Analytics">
        <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 animate-pulse">
          <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-12">
            {/* Header skeleton */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="h-4 w-48 bg-stone-200 rounded" />
                <div className="h-8 w-80 bg-stone-300 rounded" />
                <div className="h-4 w-96 bg-stone-200 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-11 w-48 bg-stone-200 rounded-lg" />
                <div className="h-11 w-32 bg-stone-300 rounded-lg" />
              </div>
            </div>

            {/* Metric row skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-32 bg-white rounded-xl shadow-xs border border-[#E8E6E3]" />
              <div className="h-32 bg-white rounded-xl shadow-xs border border-[#E8E6E3]" />
            </div>

            {/* Questions skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-2 h-64 bg-white rounded-xl shadow-xs border border-[#E8E6E3]" />
              <div className="h-64 bg-white rounded-xl shadow-xs border border-[#E8E6E3]" />
              <div className="h-64 bg-white rounded-xl shadow-xs border border-[#E8E6E3]" />
              <div className="lg:col-span-2 h-64 bg-white rounded-xl shadow-xs border border-[#E8E6E3]" />
            </div>
          </div>
        </div>
      </PosShell>
    );
  }

  // ERROR / NOT FOUND STATE
  if (!surveyResults) {
    return (
      <PosShell title="Surveys" subtitle="Individual Survey Analytics">
        <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 flex items-center justify-center">
          <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-xs border border-[#E8E6E3]">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">error</span>
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">Survey Not Found</h2>
            <p className="text-sm text-[#5b5f64] mb-6">
              The survey you requested does not exist or you do not have permission to view its
              analytics.
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

  const overallAvg = surveyResults.overallRating?.average ?? 0;
  const overallMax = surveyResults.overallRating?.scaleMax ?? 5.0;

  return (
    <PosShell title="Surveys" subtitle="Individual Survey Analytics">
      <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 text-[#1A1A1A]">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
          {/* ==================================================== */}
          {/* TOP COMMAND & BREADCRUMB STRIP */}
          {/* ==================================================== */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2 text-[13px] text-[#5b5f64]">
                <Link
                  href="/surveys"
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#E9E8E7] transition-colors text-[#1A1A1A] font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  <span>Back to Surveys</span>
                </Link>
                <span className="text-[#C4C7C7]">/</span>
                <Link href="/surveys" className="hover:text-[#1A1A1A] transition-colors">
                  Surveys
                </Link>
                <span className="text-[#C4C7C7]">/</span>
                <span className="text-[#1A1A1A] font-medium truncate max-w-[200px] sm:max-w-xs">
                  {surveyResults.surveyName}
                </span>
                <span className="text-[#C4C7C7]">/</span>
                <span className="text-black font-semibold">Analytics</span>
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
                  {surveyResults.surveyName} — Analytics
                </h1>
                <p className="text-[14px] text-[#5b5f64] mt-1">
                  Customer ratings, choice distributions, and verified long-answer feedback for
                  Survey ID{" "}
                  <span className="font-mono font-semibold text-[#1A1A1A]">
                    #{surveyResults.surveyId.slice(-6).toUpperCase()}
                  </span>
                  .
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
                          <div>
                            <label className="text-[11px] font-medium text-[#5b5f64] block mb-1">
                              Start Date
                            </label>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="w-full h-8 px-2 bg-white border border-[#D6D3CD] rounded text-xs text-[#1A1A1A]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-[#5b5f64] block mb-1">
                              End Date
                            </label>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="w-full h-8 px-2 bg-white border border-[#D6D3CD] rounded text-xs text-[#1A1A1A]"
                            />
                          </div>
                          <button
                            onClick={() => setIsDatePickerOpen(false)}
                            className="mt-1 w-full h-8 bg-black hover:bg-stone-800 text-white rounded text-xs font-semibold"
                          >
                            Apply Custom Window
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Export CSV Button */}
                <button
                  onClick={handleExportCsv}
                  disabled={isExporting}
                  className="inline-flex items-center gap-2 h-11 px-4 bg-black text-white hover:bg-stone-800 rounded-lg shadow-xs transition-colors text-[13px] font-semibold cursor-pointer disabled:opacity-50"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isExporting ? "sync" : "download"}
                  </span>
                  <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SECTION 1: SUMMARY METRIC ROW */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Total Submitted Reviews */}
            <div className="bg-white rounded-xl p-6 shadow-xs border border-[#E8E6E3] flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[12px] uppercase tracking-wider font-bold text-[#5b5f64]">
                  Total Submitted Reviews
                </span>
                <div className="flex items-baseline gap-2.5 my-2">
                  <span className="text-[36px] lg:text-[40px] font-extrabold text-[#1A1A1A] leading-none">
                    {surveyResults.totalPublishedAttempts}
                  </span>
                  <span className="text-[11px] font-semibold text-[#137333] bg-[#E6F4EA] px-2.5 py-0.5 rounded-full">
                    {surveyResults.totalPublishedAttempts > 0 ? `${surveyResults.completionRate}% Complete` : "0% Complete"}
                  </span>
                </div>
                <p className="text-[12px] text-[#5b5f64] flex items-center gap-1.5 mt-1">
                  <span className="material-symbols-outlined text-[15px] text-[#137333]">
                    verified
                  </span>
                  <span>100% verified completion via Table QR &amp; Terminal POS</span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-[#1A1A1A]">
                <span className="material-symbols-outlined text-[24px]">fact_check</span>
              </div>
            </div>

            {/* Card 2: Average Overall Rating */}
            <div className="bg-white rounded-xl p-6 shadow-xs border border-[#E8E6E3] flex items-start justify-between">
              <div className="flex flex-col">
                <span className="text-[12px] uppercase tracking-wider font-bold text-[#5b5f64]">
                  Average Overall Rating
                </span>
                <div className="flex items-center gap-3 my-2">
                  <span className="text-[36px] lg:text-[40px] font-extrabold text-[#1A1A1A] leading-none">
                    {overallAvg > 0 ? overallAvg.toFixed(1) : "—"}
                  </span>
                  <span className="text-[#5b5f64] text-[16px] font-medium">
                    {overallAvg > 0 ? `/ ${overallMax.toFixed(1)}` : "(No ratings yet)"}
                  </span>

                  {/* Star Visualization */}
                  <div className="flex items-center text-black ml-1">
                    {[1, 2, 3, 4, 5].map((starIdx) => {
                      const starVal = (starIdx / 5) * overallMax;
                      const isFull = overallAvg > 0 && overallAvg >= starVal;
                      const isHalf =
                        overallAvg > 0 && !isFull && overallAvg >= starVal - (overallMax / 5) * 0.5;
                      return (
                        <span
                          key={starIdx}
                          className="material-symbols-outlined text-[20px]"
                          style={{ fontVariationSettings: isFull || isHalf ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          {isFull ? "star" : isHalf ? "star_half" : "star"}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[12px] text-[#5b5f64] truncate max-w-md mt-1">
                  {overallAvg > 0 && surveyResults.overallRating
                    ? `Calculated from numeric question: “${surveyResults.overallRating.questionText}”`
                    : "No ratings recorded yet for this survey."}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-[#1A1A1A]">
                <span
                  className="material-symbols-outlined text-[24px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  hotel_class
                </span>
              </div>
            </div>
          </div>

          {/* Zero Reviews Empty State Explanatory Banner */}
          {surveyResults.totalPublishedAttempts === 0 && (
            <div className="bg-white border border-[#E8E6E3] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-full bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-[#5b5f64] shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[22px]">pending_actions</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1A1A1A]">
                    Customer Feedback Awaiting Real Submissions
                  </h3>
                  <p className="text-xs text-[#5b5f64] mt-0.5 max-w-2xl">
                    Customer feedback will appear here after customers submit reviews through the POS review experience or by scanning order bill receipts.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Link
                  href={`/surveys/${surveyResults.surveyId}/questions`}
                  className="px-3.5 py-2 bg-[#FAF9F6] hover:bg-stone-100 text-[#1A1A1A] border border-[#E8E6E3] rounded-lg text-xs font-semibold transition-colors"
                >
                  Question Builder
                </Link>
                <Link
                  href="/orders"
                  className="px-3.5 py-2 bg-black hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  View Orders &amp; Receipts
                </Link>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* QUESTIONS FEED: RENDERS EVERY CONFIGURED QUESTION IN ORDER */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {surveyResults.questions.map((q: any) => {
              // --------------------------------------------------
              // 1. NUMERIC RATING QUESTION
              // --------------------------------------------------
              if (q.type === "numeric") {
                const scaleMin = q.validationRules?.greaterThanOrEqualTo ?? 1;
                const scaleMax = q.validationRules?.lessThanOrEqualTo ?? 5;
                const totalResponses = q.totalResponses ?? 0;
                const dist = q.distribution || {};
                const count5 = dist[5] || 0;
                const count4 = dist[4] || 0;
                const pctTop =
                  totalResponses > 0 ? Math.round(((count5 + count4) / totalResponses) * 100) : 0;

                const ratingBuckets: number[] = [];
                for (let v = scaleMax; v >= scaleMin; v--) {
                  ratingBuckets.push(v);
                }

                return (
                  <div
                    key={q.questionId}
                    className="lg:col-span-2 bg-white rounded-xl p-6 lg:p-7 shadow-xs border border-[#E8E6E3]"
                  >
                    {/* Question Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-5 border-b border-[#E8E6E3]">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E8E6E3] text-[#1A1A1A] text-[11px] font-bold">
                            Q{q.position} • NUMERIC SCALE {scaleMin}–{scaleMax}
                          </span>
                          <span className="text-[11px] text-[#5b5f64] font-medium">
                            {totalResponses} Total Responses
                          </span>
                          {q.ratingDisplayMode && (
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                              {q.ratingDisplayMode === "stars" ? "Star Mode" : "Numeric Mode"}
                            </span>
                          )}
                          {q.frequency === "per_order_item" && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              REPEATS PER DISH
                            </span>
                          )}
                        </div>
                        <h2 className="text-[17px] font-bold text-[#1A1A1A] mt-1.5">
                          {q.questionText}
                        </h2>
                      </div>

                      <div className="mt-3 md:mt-0 flex items-center gap-2 bg-[#FAF9F6] border border-[#E8E6E3] px-3 py-1.5 rounded-lg self-start md:self-auto">
                        <span className="text-xs text-[#5b5f64]">Benchmark:</span>
                        <span className="text-xs font-bold text-[#1A1A1A]">
                          {q.averageRating > 0
                            ? `${q.averageRating.toFixed(1)} / ${scaleMax.toFixed(1)} Average`
                            : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    {totalResponses > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                        {/* Big Score Box (Col 4) */}
                        <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-[#FAF9F6] rounded-xl text-center border border-[#E8E6E3]">
                          <span className="text-[11px] uppercase tracking-wider text-[#5b5f64] font-bold">
                            Weighted Average
                          </span>
                          <div className="text-[48px] leading-tight font-extrabold text-[#1A1A1A] my-1">
                            {q.averageRating > 0 ? q.averageRating.toFixed(2) : "0.00"}
                          </div>
                          <div className="flex items-center text-black mb-2">
                            {[1, 2, 3, 4, 5].map((starIdx) => {
                              const starVal = (starIdx / 5) * scaleMax;
                              const avg = q.averageRating;
                              const isFull = avg >= starVal;
                              const isHalf = !isFull && avg >= starVal - (scaleMax / 5) * 0.5;
                              return (
                                <span
                                  key={starIdx}
                                  className="material-symbols-outlined text-[24px]"
                                  style={{
                                    fontVariationSettings: isFull || isHalf ? "'FILL' 1" : "'FILL' 0",
                                  }}
                                >
                                  {isFull ? "star" : isHalf ? "star_half" : "star"}
                                </span>
                              );
                            })}
                          </div>
                          <p className="text-xs text-[#5b5f64]">
                            {pctTop}% of patrons scored 4 or 5 stars
                          </p>
                        </div>

                        {/* Horizontal Progress Bar Stack (Col 8) */}
                        <div className="lg:col-span-8 flex flex-col gap-3">
                          {ratingBuckets.map((ratingVal) => {
                            const count = dist[ratingVal] || 0;
                            const pct = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;

                            return (
                              <div key={ratingVal} className="flex items-center gap-4">
                                <div className="w-16 flex items-center gap-1 text-[13px] font-semibold text-[#1A1A1A] shrink-0">
                                  <span>{ratingVal}</span>
                                  <span
                                    className="material-symbols-outlined text-[16px] text-black"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                  >
                                    star
                                  </span>
                                </div>
                                <div className="flex-1 h-3.5 bg-[#FAF9F6] border border-[#E8E6E3] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      ratingVal >= 4
                                        ? "bg-black"
                                        : ratingVal === 3
                                          ? "bg-[#5b5f64]"
                                          : "bg-[#9E9C98]"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <div className="w-24 text-right shrink-0 flex items-center justify-end gap-1.5 text-[13px]">
                                  <span className="font-bold text-[#1A1A1A]">{count}</span>
                                  <span className="text-[#5b5f64] font-normal">({pct}%)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-[#5b5f64] bg-[#FAF9F6] rounded-xl border border-dashed border-[#D6D3CD]">
                        <span className="material-symbols-outlined text-[28px] text-[#9E9C98] mb-1">
                          pending_actions
                        </span>
                        <p className="text-xs font-semibold text-[#1A1A1A]">
                          Awaiting customer responses
                        </p>
                        <p className="text-[11px] text-[#5b5f64] mt-0.5">
                          Rating distribution and score benchmarks will appear once responses are
                          logged.
                        </p>
                      </div>
                    )}
                  </div>
                );
              }

              // --------------------------------------------------
              // 2. SINGLE CHOICE (radio) OR DROPDOWN (select)
              // --------------------------------------------------
              if (q.type === "radio" || q.type === "select") {
                const totalVotes = q.totalResponses ?? 0;
                const optCounts = q.optionCounts || {};
                const options = q.answerOptions && q.answerOptions.length > 0
                  ? q.answerOptions
                  : Object.keys(optCounts);

                return (
                  <div
                    key={q.questionId}
                    className="col-span-1 bg-white rounded-xl p-6 shadow-xs border border-[#E8E6E3] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E8E6E3] text-[#1A1A1A] text-[11px] font-bold uppercase">
                          Q{q.position} • {q.type === "select" ? "DROPDOWN" : "SINGLE CHOICE"}
                        </span>
                        <span className="text-[11px] text-[#5b5f64] font-medium">
                          {totalVotes} votes ({totalVotes > 0 ? "100%" : "0%"})
                        </span>
                      </div>
                      <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-4">
                        {q.questionText}
                      </h3>

                      {/* Options Breakdown */}
                      <div className="flex flex-col gap-3.5">
                        {options.length > 0 ? (
                          options.map((opt: string) => {
                            const count = optCounts[opt] || 0;
                            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

                            return (
                              <div key={opt}>
                                <div className="flex items-center justify-between text-[13px] mb-1.5">
                                  <span className="text-[#1A1A1A] font-medium">{opt}</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[#1A1A1A] font-bold">{count} votes</span>
                                    <span className="text-[#5b5f64]">({pct}%)</span>
                                  </div>
                                </div>
                                <div className="h-2.5 w-full bg-[#FAF9F6] border border-[#E8E6E3] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-black rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-4 text-center text-xs text-[#5b5f64]">
                            No preset options configured.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-3 border-t border-[#E8E6E3] flex items-center justify-between text-[#5b5f64] text-[12px]">
                      <span className="flex items-center gap-1 font-medium text-[#137333]">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>
                          {totalVotes > 0
                            ? "Single selection strictly validated"
                            : "Awaiting customer responses"}
                        </span>
                      </span>
                      <span>{options.length} options configured</span>
                    </div>
                  </div>
                );
              }

              // --------------------------------------------------
              // 3. MULTIPLE CHOICE (checkbox)
              // --------------------------------------------------
              if (q.type === "checkbox") {
                const totalRespondents = q.totalResponses ?? 0;
                const totalSelections = q.totalSelections ?? 0;
                const optCounts = q.optionCounts || {};
                const options = q.answerOptions && q.answerOptions.length > 0
                  ? q.answerOptions
                  : Object.keys(optCounts);
                const avgPerGuest =
                  totalRespondents > 0
                    ? (totalSelections / totalRespondents).toFixed(1)
                    : "0.0";

                return (
                  <div
                    key={q.questionId}
                    className="col-span-1 bg-white rounded-xl p-6 shadow-xs border border-[#E8E6E3] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E8E6E3] text-[#1A1A1A] text-[11px] font-bold uppercase">
                          Q{q.position} • MULTIPLE CHOICE
                        </span>
                        <span className="text-[11px] text-[#5b5f64] font-medium">
                          Multi-select • {totalRespondents} Diners
                        </span>
                      </div>
                      <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-4">
                        {q.questionText}
                      </h3>

                      {/* Multi-select Items */}
                      <div className="flex flex-col gap-3.5">
                        {options.length > 0 ? (
                          options.map((opt: string) => {
                            const count = optCounts[opt] || 0;
                            const pct =
                              totalRespondents > 0
                                ? Math.round((count / totalRespondents) * 100)
                                : 0;

                            return (
                              <div key={opt}>
                                <div className="flex items-center justify-between text-[13px] mb-1.5">
                                  <span className="text-[#1A1A1A] font-medium">{opt}</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[#1A1A1A] font-bold">
                                      {count} selections
                                    </span>
                                    <span className="text-[#5b5f64]">({pct}%)</span>
                                  </div>
                                </div>
                                <div className="h-2.5 w-full bg-[#FAF9F6] border border-[#E8E6E3] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-black rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-4 text-center text-xs text-[#5b5f64]">
                            No preset options configured.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-3 border-t border-[#E8E6E3] flex items-center justify-between text-[#5b5f64] text-[12px]">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">restaurant</span>
                        <span>
                          {totalRespondents > 0
                            ? `${totalSelections} cumulative item tags chosen`
                            : "Awaiting customer responses"}
                        </span>
                      </span>
                      <span>Average {avgPerGuest} categories / guest</span>
                    </div>
                  </div>
                );
              }

              // --------------------------------------------------
              // 4. OPEN-ENDED WRITTEN COMMENTS (short or long)
              // --------------------------------------------------
              if (q.type === "short" || q.type === "long") {
                const totalResponses = q.totalResponses ?? 0;
                const responses = q.responses || [];

                return (
                  <div
                    key={q.questionId}
                    className="lg:col-span-2 bg-white rounded-xl p-6 lg:p-7 shadow-xs border border-[#E8E6E3]"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-5 border-b border-[#E8E6E3]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E8E6E3] text-[#1A1A1A] text-[11px] font-bold uppercase">
                            Q{q.position} • OPEN-ENDED {q.type === "long" ? "LONG" : "SHORT"} ANSWER
                          </span>
                          <span className="text-[11px] text-[#5b5f64] font-medium">
                            {totalResponses} written comments logged (
                            {(q.responseRate || 0).toFixed(1)}% response rate)
                          </span>
                        </div>
                        <h2 className="text-[17px] font-bold text-[#1A1A1A] mt-1.5">
                          {q.questionText}
                        </h2>
                      </div>

                      <div className="mt-3 md:mt-0 flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#5b5f64] bg-[#FAF9F6] border border-[#E8E6E3] px-3 py-1.5 rounded-md">
                          Verified Guest Verbatims
                        </span>
                      </div>
                    </div>

                    {/* Stream Cards */}
                    {totalResponses > 0 ? (
                      <div className="flex flex-col gap-3">
                        {responses.slice(0, 4).map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-[#FAF9F6] border border-[#E8E6E3] p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#F5F3F3] transition-colors"
                          >
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5b5f64]">
                                <span className="font-bold text-[#1A1A1A] bg-white border border-[#E8E6E3] px-2 py-0.5 rounded">
                                  {item.tableNumber ||
                                    (item.orderNumber
                                      ? `Order #${item.orderNumber}`
                                      : "Verified Guest")}
                                </span>
                                <span>•</span>
                                <span className="font-medium">
                                  {item.serviceMode || "Dine In Service"}
                                </span>
                                <span>•</span>
                                <span>{formatDateTime(item.submittedAt)}</span>
                              </div>
                              <p className="text-[14px] text-[#1A1A1A] font-medium mt-1">
                                “{item.answerText}”
                              </p>
                            </div>

                            {/* Rating Badges */}
                            {item.ratingBadges && item.ratingBadges.length > 0 && (
                              <div className="flex items-center gap-2 shrink-0">
                                {item.ratingBadges.map((badge: any, bIdx: number) => (
                                  <div
                                    key={bIdx}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-[#E8E6E3] text-[#1A1A1A] text-xs font-medium"
                                  >
                                    <span className="text-[#5b5f64] font-normal">
                                      {badge.label}:
                                    </span>
                                    <span className="font-bold">{badge.score.toFixed(1)}</span>
                                    <span
                                      className="material-symbols-outlined text-[14px] text-black"
                                      style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                      star
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-[#5b5f64] bg-[#FAF9F6] rounded-xl border border-dashed border-[#D6D3CD]">
                        <span className="material-symbols-outlined text-[28px] text-[#9E9C98] mb-1">
                          chat_bubble_outline
                        </span>
                        <p className="text-xs font-semibold text-[#1A1A1A]">
                          Awaiting customer responses
                        </p>
                        <p className="text-[11px] text-[#5b5f64] mt-0.5">
                          No written feedback submitted for this question in the selected date
                          range.
                        </p>
                      </div>
                    )}

                    {/* Pagination Footer */}
                    {totalResponses > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between pt-5 mt-4 border-t border-[#E8E6E3] text-[#5b5f64] text-xs">
                        <span>
                          Showing{" "}
                          <strong className="text-[#1A1A1A]">
                            {Math.min(4, totalResponses)}
                          </strong>{" "}
                          of <strong className="text-[#1A1A1A]">{totalResponses}</strong> verified
                          customer comments
                        </span>

                        {totalResponses > 0 && (
                          <Link
                            href={`/surveys/${surveyId}/comments?range=${dateRangeKey}`}
                            className="mt-2 sm:mt-0 inline-flex items-center gap-1 text-[13px] font-bold text-black hover:text-stone-700 transition-colors cursor-pointer"
                          >
                            <span>View All {totalResponses} Comments</span>
                            <span className="material-symbols-outlined text-[18px]">
                              chevron_right
                            </span>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // --------------------------------------------------
              // 5. DATE OR OTHER SUPPORTED QUESTION TYPES
              // --------------------------------------------------
              return (
                <div
                  key={q.questionId}
                  className="lg:col-span-2 bg-white rounded-xl p-6 shadow-xs border border-[#E8E6E3]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E8E6E3] text-[#1A1A1A] text-[11px] font-bold uppercase">
                      Q{q.position} • {q.type.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-[#5b5f64] font-medium">
                      {q.totalResponses || 0} Total Responses
                    </span>
                  </div>
                  <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-3">{q.questionText}</h3>
                  <div className="p-4 bg-[#FAF9F6] rounded-lg text-xs text-[#5b5f64]">
                    {q.totalResponses > 0
                      ? `${q.totalResponses} submissions recorded for this field.`
                      : "Awaiting customer responses."}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ==================================================== */}
          {/* OPERATIONAL QUERY FOOTER NOTE */}
          {/* ==================================================== */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-1 py-2 text-[#5b5f64] text-[11px] gap-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5b5f64]" />
              <code className="font-mono text-[11px] text-[#5b5f64]">
                Backend Query: surveys.getResults(&#123; surveyId: &#39;
                {surveyResults.surveyId.slice(-8)}&#39;, range: &#39;{dateRangeKey}&#39; &#125;)
              </code>
            </div>
            <span className="text-[#5b5f64] font-medium">
              Auto-syncs reactive • Live Convex subscription
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* VIEW ALL COMMENTS MODAL / DRAWER */}
      {/* ==================================================== */}
      {activeCommentQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden border border-[#E8E6E3]">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E8E6E3] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#1A1A1A]">All Customer Feedback</h3>
                <p className="text-xs text-[#5b5f64] mt-0.5">
                  Q{activeCommentQuestion.position} • {activeCommentQuestion.questionText}
                </p>
              </div>
              <button
                onClick={() => setActiveCommentQuestion(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5b5f64] hover:bg-[#FAF9F6] hover:text-[#1A1A1A] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-[#E8E6E3] bg-[#FAF9F6]">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#9E9C98]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search comments, tables, or orders..."
                  value={commentsSearch}
                  onChange={(e) => setCommentsSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 bg-white border border-[#D6D3CD] rounded-lg text-xs text-[#1A1A1A] focus:outline-none focus:border-black"
                />
              </div>
            </div>

            {/* Modal Comments List */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              {modalComments.length > 0 ? (
                modalComments.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 bg-[#FAF9F6] border border-[#E8E6E3] rounded-xl flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-[#5b5f64]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1A1A1A] bg-white border border-[#E8E6E3] px-2 py-0.5 rounded">
                          {item.tableNumber ||
                            (item.orderNumber ? `Order #${item.orderNumber}` : "Verified Guest")}
                        </span>
                        <span>•</span>
                        <span>{item.serviceMode || "Dine In Service"}</span>
                        <span>•</span>
                        <span>{formatDateTime(item.submittedAt)}</span>
                      </div>

                      {item.ratingBadges && item.ratingBadges.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {item.ratingBadges.map((b: any, bIdx: number) => (
                            <span
                              key={bIdx}
                              className="px-2 py-0.5 bg-white border border-[#E8E6E3] rounded text-[11px] font-bold"
                            >
                              {b.label}: {b.score.toFixed(1)} ★
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-[#1A1A1A] font-medium mt-1">
                      “{item.answerText}”
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-[#5b5f64]">
                  <p className="text-sm">No comments match your search.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E8E6E3] bg-[#FAF9F6] flex items-center justify-between text-xs text-[#5b5f64]">
              <span>
                Showing {modalComments.length} of{" "}
                {(activeCommentQuestion.responses || []).length} total comments
              </span>
              <button
                onClick={() => setActiveCommentQuestion(null)}
                className="px-4 py-2 bg-black hover:bg-stone-800 text-white font-semibold rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PosShell>
  );
}

// Wrap in Suspense to support useSearchParams in Next.js App Router
export default function IndividualSurveyAnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <IndividualSurveyAnalyticsContent />
    </Suspense>
  );
}
