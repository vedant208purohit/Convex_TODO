"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PosShell } from "@/app/components/PosShell";

// ====================================================
// HELPER FUNCTIONS
// ====================================================

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

function getMinutesElapsed(createdTimestamp: number, submittedTimestamp: number): number {
  const diffMs = Math.max(0, submittedTimestamp - createdTimestamp);
  return Math.max(1, Math.round(diffMs / (60 * 1000)));
}

// Station icon helper
function getStationIcon(stationName: string): string {
  const lower = stationName.toLowerCase();
  if (lower.includes("tandoor") || lower.includes("grill")) return "outdoor_grill";
  if (lower.includes("bread") || lower.includes("bakery")) return "bakery_dining";
  if (lower.includes("curry") || lower.includes("gravy") || lower.includes("soup")) return "soup_kitchen";
  if (lower.includes("bar") || lower.includes("beverage") || lower.includes("cafe")) return "local_bar";
  return "restaurant";
}

// Item image fallback helper
function getItemIcon(categoryName: string, itemName: string): string {
  const lower = (itemName + " " + categoryName).toLowerCase();
  if (lower.includes("coffee") || lower.includes("tea") || lower.includes("drink") || lower.includes("beverage"))
    return "local_cafe";
  if (lower.includes("naan") || lower.includes("roti") || lower.includes("bread"))
    return "bakery_dining";
  if (lower.includes("dal") || lower.includes("soup") || lower.includes("curry"))
    return "soup_kitchen";
  return "restaurant";
}

// ====================================================
// MAIN COMPONENT
// ====================================================

export default function OrderCustomerReviewPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string | undefined;

  // Real-time reactive query for review details
  const reviewDetails = useQuery(
    api.surveyAttempts.getOrderReviewDetails,
    orderId ? { orderId: orderId as Id<"orders"> } : "skip"
  );

  // Local interaction states
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // LOADING STATE
  if (reviewDetails === undefined) {
    return (
      <PosShell title="Orders" subtitle="Customer Review Details">
        <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 animate-pulse">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            <div className="h-8 w-72 bg-stone-200 rounded" />
            <div className="h-28 bg-white rounded-xl shadow-xs border border-[#E8E6E3]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-white rounded-xl shadow-xs border border-[#E8E6E3]" />
              ))}
            </div>
            <div className="h-64 bg-white rounded-xl shadow-xs border border-[#E8E6E3]" />
          </div>
        </div>
      </PosShell>
    );
  }

  // NOT FOUND STATE
  if (!reviewDetails) {
    return (
      <PosShell title="Orders" subtitle="Customer Review Details">
        <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 flex items-center justify-center">
          <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-xs border border-[#E8E6E3]">
            <div className="w-16 h-16 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px]">receipt_long</span>
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">Order Not Found</h2>
            <p className="text-sm text-[#5b5f64] mb-6">
              The order you requested does not exist or you do not have permission to view its reviews.
            </p>
            <Link
              href="/orders"
              className="inline-flex items-center px-4 py-2.5 bg-black hover:bg-stone-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              Back to Orders
            </Link>
          </div>
        </div>
      </PosShell>
    );
  }

  const { order, review, items, benchmarks, hasReview } = reviewDetails;

  const formattedTotal = (order.totalAmount / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const minutesPostCheckout =
    review?.submittedAt && order.createdAt
      ? getMinutesElapsed(order.createdAt, review.submittedAt)
      : null;

  return (
    <PosShell title="Orders" subtitle="Customer Review Details">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-black text-white px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="material-symbols-outlined text-[18px] text-emerald-400">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 text-[#1A1A1A]">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-12">
          {/* ==================================================== */}
          {/* TOP CONTEXT NAVIGATION & ACTION ROW */}
          {/* ==================================================== */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs text-[#5b5f64] font-medium">
              <Link href="/orders" className="hover:text-black transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                <span>Orders</span>
              </Link>
              <span className="text-[#C4C7C7]">/</span>
              <Link href={`/orders/${order._id}`} className="hover:text-black font-semibold text-[#1A1A1A]">
                Order #{order.orderNumber}
              </Link>
              <span className="text-[#C4C7C7]">/</span>
              <span className="text-[#5b5f64]">Customer Review Details</span>
            </nav>

            {/* Action Bar */}
            <div className="flex items-center flex-wrap gap-2.5">
              <Link
                href={`/orders/${order._id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[#E8E6E3] text-[#1A1A1A] hover:bg-[#FAF9F6] transition-colors text-xs font-semibold shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px] text-[#5b5f64]">arrow_back</span>
                <span>Back to Orders</span>
              </Link>

              <Link
                href={`/orders/${order._id}/receipt`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[#E8E6E3] text-[#1A1A1A] hover:bg-[#FAF9F6] transition-colors text-xs font-semibold shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px] text-[#5b5f64]">receipt</span>
                <span>View Bill Receipt</span>
              </Link>
            </div>
          </div>

          {/* ==================================================== */}
          {/* EMPTY STATE BANNER (WHEN NO REVIEW YET) */}
          {/* ==================================================== */}
          {!hasReview && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-600 text-[24px]">qr_code_scanner</span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Awaiting Customer Feedback
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Customer feedback will appear here after customers submit reviews through the POS review experience or by scanning the bill receipt QR code.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/orders/${order._id}/receipt`}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  View Receipt QR
                </Link>
                {order.attemptId && (
                  <Link
                    href={`/attempts/${order.attemptId}`}
                    target="_blank"
                    className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Simulate Review
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* MAIN ORDER IDENTITY HEADER */}
          {/* ==================================================== */}
          <div className="bg-white rounded-xl p-6 shadow-xs border border-[#E8E6E3] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">
                  Order #{order.orderNumber}
                </h1>
                <span className="text-[#C4C7C7] text-lg font-bold">•</span>
                <span className="text-base font-semibold text-[#5b5f64]">
                  Customer Review &amp; Item Ratings
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {hasReview ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E6F4EA] text-[#137333] text-[11px] font-semibold">
                    <span className="material-symbols-outlined text-[14px]">language</span>
                    <span>{review?.source || "Submitted via Customer Website"}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-100 text-[#5b5f64] text-[11px] font-semibold">
                    <span className="material-symbols-outlined text-[14px]">hourglass_empty</span>
                    <span>Awaiting Submission</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FAF9F6] border border-[#E8E6E3] text-[#1A1A1A] text-[11px] font-medium">
                  <span className="material-symbols-outlined text-[14px] text-[#5b5f64]">table_restaurant</span>
                  <span>{order.tableNumber ? `Table ${order.tableNumber}` : order.orderType || "Order"}</span>
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FAF9F6] text-[#5b5f64] text-[11px]">
                  <span className="material-symbols-outlined text-[14px]">fingerprint</span>
                  <span>Review ID: {review?.reviewId || "Pending Verification"}</span>
                </span>
              </div>
            </div>

            {/* Status & Payment Block */}
            <div className="flex items-center gap-4 bg-[#FAF9F6] border border-[#E8E6E3] px-4 py-2.5 rounded-lg self-start md:self-auto">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[#5b5f64] tracking-wider">
                  Kitchen Status
                </span>
                <span className="text-xs font-semibold text-[#1A1A1A] flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#137333]" />
                  <span>{order.orderStatusName}</span>
                </span>
              </div>
              <div className="w-px h-8 bg-[#E8E6E3]" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[#5b5f64] tracking-wider">
                  Payment Mode
                </span>
                <span className="text-xs font-semibold text-[#1A1A1A] mt-0.5">
                  {order.paymentMode}
                </span>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SUMMARY METRIC GRID (4 CARDS) */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: Overall Order Score */}
            <div className="bg-white p-5 rounded-xl shadow-xs border border-[#E8E6E3] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#5b5f64]">
                  Overall Order Score
                </span>
                <span className="p-1.5 rounded-lg bg-[#FAF9F6] text-[#1A1A1A] border border-[#E8E6E3]">
                  <span className="material-symbols-outlined text-[18px]">star</span>
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[#1A1A1A] tracking-tight">
                    {hasReview && review?.overallScore ? review.overallScore.toFixed(1) : "—"}
                  </span>
                  <span className="text-xs text-[#5b5f64]">
                    {hasReview ? `/ ${review?.maxScore.toFixed(1)}` : "(No ratings yet)"}
                  </span>
                  {hasReview && (
                    <div className="flex items-center text-[#B06000] ml-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span
                          key={s}
                          className="material-symbols-outlined text-[18px]"
                          style={{
                            fontVariationSettings:
                              s <= Math.round(review?.overallScore || 0)
                                ? "'FILL' 1"
                                : "'FILL' 0",
                          }}
                        >
                          star
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className={`text-[11px] font-semibold mt-1 ${hasReview ? "text-[#137333]" : "text-[#5b5f64]"}`}>
                  {hasReview ? review?.overallRatingLabel : "Awaiting customer score"}
                </p>
              </div>
            </div>

            {/* Card 2: Items Rated */}
            <div className="bg-white p-5 rounded-xl shadow-xs border border-[#E8E6E3] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#5b5f64]">
                  Items Rated
                </span>
                <span className="p-1.5 rounded-lg bg-[#FAF9F6] text-[#1A1A1A] border border-[#E8E6E3]">
                  <span className="material-symbols-outlined text-[18px]">inventory</span>
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#1A1A1A]">
                    {hasReview
                      ? `${review?.itemsRatedCount} of ${review?.totalItemsCount} Items`
                      : `0 of ${items.length} Items`}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-black h-full rounded-full transition-all duration-500"
                      style={{
                        width:
                          hasReview && review?.totalItemsCount
                            ? `${Math.round((review.itemsRatedCount / review.totalItemsCount) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-[#1A1A1A] shrink-0">
                    {hasReview && review?.totalItemsCount
                      ? `${Math.round((review.itemsRatedCount / review.totalItemsCount) * 100)}%`
                      : "0%"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Order Total & Server */}
            <div className="bg-white p-5 rounded-xl shadow-xs border border-[#E8E6E3] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#5b5f64]">
                  Order Total &amp; Server
                </span>
                <span className="p-1.5 rounded-lg bg-[#FAF9F6] text-[#1A1A1A] border border-[#E8E6E3]">
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#1A1A1A]">
                    ₹{formattedTotal}
                  </span>
                  <span className="text-xs text-[#5b5f64]">
                    • T-{order.tableNumber}
                  </span>
                </div>
                <p className="text-[11px] text-[#5b5f64] mt-1">
                  Server: {order.serverName} • Shift AM
                </p>
              </div>
            </div>

            {/* Card 4: Submission Time */}
            <div className="bg-white p-5 rounded-xl shadow-xs border border-[#E8E6E3] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#5b5f64]">
                  Submission Time
                </span>
                <span className="p-1.5 rounded-lg bg-[#FAF9F6] text-[#1A1A1A] border border-[#E8E6E3]">
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                </span>
              </div>
              <div className="mt-3">
                {hasReview && review?.submittedAt ? (
                  <>
                    <span className="text-base font-semibold text-[#1A1A1A] block leading-tight">
                      {formatDate(review.submittedAt)}
                    </span>
                    <span className="text-[11px] text-[#5b5f64] block mt-0.5">
                      {formatTime(review.submittedAt)}
                      {minutesPostCheckout !== null && ` (${minutesPostCheckout}m post-checkout)`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-base font-semibold text-[#5b5f64] block leading-tight">
                      Pending
                    </span>
                    <span className="text-[11px] text-[#5b5f64] block mt-0.5">
                      Awaiting patron review scan
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SPLIT LAYOUT: OVERALL FEEDBACK (7) + 30-DAY BENCHMARK (5) */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Customer's Overall Feedback (Left 7 Cols) */}
            <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-xs border border-[#E8E6E3] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E3]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-black text-[20px]">format_quote</span>
                    <h2 className="text-lg font-bold text-[#1A1A1A]">Customer&apos;s Overall Feedback</h2>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider text-[#5b5f64] font-semibold">
                    Verbatim Response
                  </span>
                </div>

                <div className="py-5">
                  {hasReview && review?.customerVerbatim ? (
                    <blockquote className="text-base text-[#1A1A1A] italic leading-relaxed">
                      &ldquo;{review.customerVerbatim}&rdquo;
                    </blockquote>
                  ) : (
                    <div className="py-6 text-center text-[#5b5f64]">
                      <span className="material-symbols-outlined text-[32px] text-[#9E9C98] mb-1">
                        rate_review
                      </span>
                      <p className="text-sm font-semibold text-[#1A1A1A]">
                        No customer feedback received yet
                      </p>
                      <p className="text-xs text-[#5b5f64] mt-0.5">
                        Customer feedback will appear here after customers submit reviews through the POS review experience.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Extracted Sentiment Tags */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E8E6E3]">
                <span className="text-xs text-[#5b5f64] mr-1">Extracted Sentiment Tags:</span>
                {hasReview && review?.sentimentTags && review.sentimentTags.length > 0 ? (
                  review.sentimentTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full bg-[#FAF9F6] border border-[#E8E6E3] text-[#1A1A1A] text-xs font-semibold flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
                      <span>{tag}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#5b5f64] italic">
                    {hasReview ? "No specific tags detected" : "Pending customer input"}
                  </span>
                )}
              </div>
            </div>

            {/* Dish 30-Day Benchmark Analytics (Right 5 Cols) */}
            <div className="lg:col-span-5 bg-white p-6 rounded-xl shadow-xs border border-[#E8E6E3] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E6E3]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-black text-[20px]">analytics</span>
                    <h2 className="text-lg font-bold text-[#1A1A1A]">30-Day Item Benchmark</h2>
                  </div>
                  <span className="text-xs text-[#5b5f64]">PREST Kitchen Pulse</span>
                </div>

                <p className="text-xs text-[#5b5f64] mt-2 mb-4">
                  Comparison between ratings from this bill vs. 30-day kitchen trailing averages.
                </p>

                {benchmarks.length > 0 ? (
                  <div className="space-y-4">
                    {benchmarks.map((bm, idx) => {
                      const colors = ["bg-black", "bg-stone-600", "bg-[#B06000]", "bg-black"];
                      const barColor = colors[idx % colors.length];

                      return (
                        <div key={bm.itemName}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-[#1A1A1A]">{bm.itemName}</span>
                            <span className="text-[#5b5f64]">
                              This bill:{" "}
                              <strong className="text-black font-semibold">
                                {bm.thisBillScore !== null ? bm.thisBillScore.toFixed(1) : "—"}
                              </strong>{" "}
                              / Avg:{" "}
                              <strong>
                                {bm.avgScore30d > 0 ? bm.avgScore30d.toFixed(1) : "—"}
                              </strong>{" "}
                              {bm.orderCount30d > 0 && `(${bm.orderCount30d} ord)`}
                            </span>
                          </div>
                          <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden flex">
                            <div
                              className={`h-full ${barColor} transition-all duration-500`}
                              style={{ width: `${bm.percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-[#5b5f64] bg-[#FAF9F6] rounded-lg border border-dashed border-[#D6D3CD]">
                    <span className="material-symbols-outlined text-[24px] text-stone-400 mb-1">
                      query_stats
                    </span>
                    <p className="font-semibold text-stone-700">Insufficient data</p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      30-day trailing averages will compute as reviews accumulate.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-2 text-right">
                <span className="text-[11px] text-[#5b5f64]">
                  Updated real-time with shift closure sync
                </span>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SECTION 2: CORE ITEM-LEVEL RATINGS BREAKDOWN TABLE */}
          {/* ==================================================== */}
          <div className="bg-white rounded-xl shadow-xs p-6 border border-[#E8E6E3]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#E8E6E3]">
              <div>
                <h2 className="text-xl font-bold text-[#1A1A1A] tracking-tight">
                  Item-Level Food Ratings Breakdown
                </h2>
                <p className="text-xs text-[#5b5f64] mt-0.5">
                  Individual line-item critiques recorded through patron digital bill settlement.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1 rounded-full bg-[#FAF9F6] border border-[#E8E6E3] text-[#1A1A1A] font-semibold">
                  {items.length} Unique Items Evaluated
                </span>
              </div>
            </div>

            {/* Table of Item Ratings */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E8E6E3] bg-[#FAF9F6] text-xs text-[#5b5f64]">
                    <th className="py-3 px-4 font-semibold">Item &amp; Category</th>
                    <th className="py-3 px-4 font-semibold">Kitchen Station</th>
                    <th className="py-3 px-4 font-semibold">Customer Score</th>
                    <th className="py-3 px-4 font-semibold">Customer Critique &amp; Verbatim Note</th>
                    <th className="py-3 px-4 font-semibold">Operational Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E6E3] text-xs">
                  {items.map((it) => {
                    const iconName = getItemIcon(it.categoryName, it.itemName);
                    const stationIcon = getStationIcon(it.stationName);

                    // Operational status styling
                    let badgeClass = "bg-[#FAF9F6] text-[#5b5f64] border border-[#E8E6E3]";
                    let statusIcon = "tune";
                    if (it.operationalStatus === "Highly Commended") {
                      badgeClass = "bg-[#E6F4EA] text-[#137333]";
                      statusIcon = "check_circle";
                    } else if (it.operationalStatus === "Actionable (Service timing)") {
                      badgeClass = "bg-[#FEF7E0] text-[#B06000]";
                      statusIcon = "timer";
                    } else if (it.operationalStatus === "Recipe Calibration Note") {
                      badgeClass = "bg-[#FAF9F6] text-[#1A1A1A] border border-[#E8E6E3]";
                      statusIcon = "edit_note";
                    }

                    return (
                      <tr key={it._id} className="hover:bg-[#FAF9F6]/50 transition-colors">
                        {/* Item & Category */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center shrink-0 text-[#1A1A1A]">
                              <span className="material-symbols-outlined text-[22px]">{iconName}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-[#1A1A1A]">{it.itemName}</span>
                              <span className="text-[11px] text-[#5b5f64]">
                                Qty: {it.quantity} • {it.categoryName}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Kitchen Station */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 font-medium text-[#1A1A1A]">
                            <span className="material-symbols-outlined text-[16px] text-[#5b5f64]">
                              {stationIcon}
                            </span>
                            <span>{it.stationName}</span>
                          </span>
                        </td>

                        {/* Customer Score */}
                        <td className="py-4 px-4">
                          {it.customerScore !== null ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-[#1A1A1A]">
                                {it.customerScore} / 5
                              </span>
                              <div className="flex items-center text-[#B06000]">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <span
                                    key={s}
                                    className="material-symbols-outlined text-[15px]"
                                    style={{
                                      fontVariationSettings:
                                        s <= (it.customerScore || 0)
                                          ? "'FILL' 1"
                                          : "'FILL' 0",
                                    }}
                                  >
                                    star
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-stone-400 font-semibold">— / 5</span>
                          )}
                        </td>

                        {/* Customer Critique */}
                        <td className="py-4 px-4 max-w-xs">
                          {it.customerCritique ? (
                            <p className="font-medium text-[#1A1A1A]">
                              &ldquo;{it.customerCritique}&rdquo;
                            </p>
                          ) : (
                            <p className="text-stone-400 italic">No item rating submitted yet</p>
                          )}
                        </td>

                        {/* Operational Status */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${badgeClass}`}
                          >
                            <span className="material-symbols-outlined text-[13px]">{statusIcon}</span>
                            <span>{it.operationalStatus}</span>
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              showToast(
                                `Station dispatch logged: Note sent to ${it.stationName} for ${it.itemName}`
                              )
                            }
                            className="p-1.5 rounded-lg hover:bg-stone-100 text-[#5b5f64] hover:text-black transition-colors cursor-pointer"
                            title={`Action for ${it.stationName}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {it.operationalStatus === "Highly Commended"
                                ? "thumb_up"
                                : it.operationalStatus === "Actionable (Service timing)"
                                  ? "notification_add"
                                  : "edit_note"}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PosShell>
  );
}
