"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PosShell } from "@/app/components/PosShell";
import {
  formatCurrencyAmount,
  formatStoreDateTime,
} from "@/lib/constants/countries";

export default function OrderReceiptPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id as string | undefined;
  const orderId = rawId as Id<"orders"> | undefined;

  // 1. Fetch Order Details with line items, table, and active survey info
  const orderDetails = useQuery(
    api.orders.getOrderDetails,
    orderId ? { id: orderId } : "skip"
  );

  // 2. Fetch Organizations & Printers configuration
  const orgs = useQuery(api.organizations.list, {});
  const activeOrg = orgs && orgs.length > 0 ? orgs[0] : null;

  const printers = useQuery(api.organizationPrinters.list, {});
  const activeSurvey = useQuery(api.surveys.getActive, {});

  // 3. Mutations for survey attempt binding and QR toggle setting
  const getOrCreateAttempt = useMutation(api.surveyAttempts.getOrCreateForOrder);
  const updateOrg = useMutation(api.organizations.update);

  // Local state for attempt info
  const [attemptInfo, setAttemptInfo] = useState<{
    attemptId: string;
    surveyQrUrl: string;
    published?: boolean;
  } | null>(null);

  // Standalone QR code setting (synced with activeOrg)
  const [includeReviewQr, setIncludeReviewQr] = useState<boolean>(true);

  // Interactive UI Modal States
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Simulator Star Rating & Likes
  const [simOverallRating, setSimOverallRating] = useState<number>(5);
  const [simLikedItems, setSimLikedItems] = useState<Record<string, string>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Canonical public base URL for customer pos-user app
  const posUserBaseUrl = useMemo(() => {
    if (process.env.NEXT_PUBLIC_POS_USER_BASE_URL) {
      return process.env.NEXT_PUBLIC_POS_USER_BASE_URL.replace(/\/$/, "");
    }
    if (process.env.NEXT_PUBLIC_FRONT_END_URL) {
      return process.env.NEXT_PUBLIC_FRONT_END_URL.replace(/\/$/, "");
    }
    if (typeof window !== "undefined") {
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return "http://localhost:3002";
      }
    }
    return "https://dev-pos-user.get-prest.com";
  }, []);

  // Sync QR preference toggle from activeOrg
  useEffect(() => {
    if (activeOrg) {
      setIncludeReviewQr(activeOrg.showQrCode ?? true);
    }
  }, [activeOrg]);

  // Ensure an order-bound survey attempt exists whenever an active survey is present
  useEffect(() => {
    if (orderId && activeSurvey && !attemptInfo) {
      getOrCreateAttempt({
        orderId,
        publicBaseUrl: posUserBaseUrl,
      })
        .then((res) => {
          if (res) {
            setAttemptInfo({
              attemptId: res.attemptId,
              surveyQrUrl: res.surveyQrUrl,
              published: res.published,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to generate order survey attempt:", err);
        });
    }
  }, [orderId, activeSurvey, attemptInfo, getOrCreateAttempt, posUserBaseUrl]);

  // Standalone QR toggle handler with backend persistence
  const handleToggleQr = async (val: boolean) => {
    setIncludeReviewQr(val);
    if (activeOrg) {
      try {
        await updateOrg({ id: activeOrg._id, showQrCode: val });
        showToast(val ? "Order Review QR enabled on receipts." : "Order Review QR disabled.");
      } catch (err) {
        console.error("Failed to update QR setting:", err);
        showToast("Failed to persist QR setting.");
      }
    }
  };

  // Resolved values
  const order = orderDetails;
  const items = orderDetails?.items || [];
  const table = orderDetails?.table;

  // Derive cashier printer
  const cashierPrinter = useMemo(() => {
    if (!printers || printers.length === 0) return null;
    return (
      printers.find((p) => p.printerUseFor === "Cashier") ||
      printers[0]
    );
  }, [printers]);

  // QR destination URL targeting pos-user customer application
  const feedbackUrl = useMemo(() => {
    let url = "";
    if (attemptInfo?.surveyQrUrl) {
      if (attemptInfo.surveyQrUrl.startsWith("http")) {
        url = attemptInfo.surveyQrUrl;
      } else {
        url = `${posUserBaseUrl}${attemptInfo.surveyQrUrl.startsWith("/") ? "" : "/"}${attemptInfo.surveyQrUrl}`;
      }
    } else if (attemptInfo?.attemptId) {
      url = `${posUserBaseUrl}/attempts/${attemptInfo.attemptId}`;
    }
    if (!url) return "";

    // Always ensure the store slug is attached for authoritative store resolution in dev & production
    const slug = activeOrg?.slug;
    if (slug && !url.includes("store=") && !url.includes("slug=")) {
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}store=${encodeURIComponent(slug)}`;
    }
    return url;
  }, [attemptInfo, posUserBaseUrl, activeOrg?.slug]);

  const shortFeedbackDisplay = useMemo(() => {
    if (!feedbackUrl) return "prest.dine/review";
    try {
      const u = new URL(feedbackUrl);
      return `${u.host}${u.pathname}`;
    } catch {
      return feedbackUrl.replace(/^https?:\/\//, "");
    }
  }, [feedbackUrl]);

  // Export SVG handler
  const handleExportSvg = () => {
    const svgElem = document.getElementById("order-feedback-qr-svg");
    if (!svgElem) {
      showToast("No QR code element found to export.");
      return;
    }
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElem);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `order_${order?.orderNumber || "preview"}_review_qr.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    showToast("QR Code SVG exported successfully.");
  };

  // Loading Skeleton
  if (orderDetails === undefined) {
    return (
      <PosShell title="Orders" subtitle="Bill & Receipt Preview">
        <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 animate-pulse">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            <div className="h-8 w-64 bg-stone-200 rounded" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 h-[700px] bg-white rounded-2xl border border-[#E8E6E3]" />
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="h-64 bg-white rounded-2xl border border-[#E8E6E3]" />
                <div className="h-64 bg-white rounded-2xl border border-[#E8E6E3]" />
              </div>
            </div>
          </div>
        </div>
      </PosShell>
    );
  }

  // Not Found State
  if (!order) {
    return (
      <PosShell title="Orders" subtitle="Bill & Receipt Preview">
        <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-[#E8E6E3] shadow-xs">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[28px]">receipt_long</span>
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A]">Order Not Found</h2>
            <p className="text-sm text-[#5b5f64] mt-2 mb-6">
              The order receipt you requested does not exist or you do not have permission to view it.
            </p>
            <button
              onClick={() => router.push("/orders")}
              className="px-4 py-2.5 bg-black hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Back to Orders List
            </button>
          </div>
        </div>
      </PosShell>
    );
  }

  // Derived financial computations
  const currencySymbol = activeOrg?.defaultCurrencySymbol || activeOrg?.defaultCurrency || "₹";
  const subTotalNum = (order.subTotal || 0) / 100;
  const taxTotalNum = (order.taxTotal || 0) / 100;
  const grandTotalNum = (order.totalAmount || 0) / 100;
  const cgst = (taxTotalNum / 2).toFixed(2);
  const sgst = (taxTotalNum / 2).toFixed(2);

  const cashierName = (order as any).cashierUser?.name || order.cashierUserId || null;
  const formattedDateTimeStr = formatStoreDateTime(order.createdAt);
  const tableDisplay = table?.number
    ? `Table ${table.number}`
    : (table as any)?.name || (order.orderType === "DineIn" ? "Dine-In" : order.orderType || "Order");

  return (
    <PosShell title="Orders" subtitle="Bill & Receipt Preview">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-black text-white px-4 py-3 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="material-symbols-outlined text-[18px] text-emerald-400">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-6 lg:p-8 text-[#1A1A1A]">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 pb-16">
          {/* ==================================================== */}
          {/* TOP BREADCRUMB & ACTION TOOLBAR */}
          {/* ==================================================== */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <nav className="flex items-center gap-2 text-xs text-[#5b5f64]">
                <Link href="/orders" className="hover:text-black transition-colors font-medium">
                  Orders
                </Link>
                <span className="text-[#C4C7C7]">/</span>
                <Link href={`/orders/${order._id}`} className="hover:text-black transition-colors font-medium">
                  Order #{order.orderNumber}
                </Link>
                <span className="text-[#C4C7C7]">/</span>
                <span className="text-black font-semibold">Bill &amp; Receipt Preview</span>
              </nav>

              <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                <h1 className="text-2xl lg:text-[28px] font-extrabold text-[#1A1A1A] tracking-tight">
                  Order #{order.orderNumber} — Receipt &amp; Summary
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                  order.paymentStatus === "Paid"
                    ? "bg-[#E6F4EA] text-[#137333]"
                    : "bg-[#FAF9F6] border border-[#E8E6E3] text-[#5b5f64]"
                }`}>
                  {order.paymentStatus === "Paid" ? "Paid & Settled" : order.paymentStatus || "Open"}
                </span>
              </div>

              <p className="text-xs text-[#5b5f64]">
                {tableDisplay} • {order.orderType} • Closed {formattedDateTimeStr}
              </p>
            </div>

            {/* Quick Action Bar */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Reprint Thermal Slip */}
              <button
                type="button"
                onClick={() => window.print()}
                className="h-10 px-4 bg-black hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Reprint Thermal Slip</span>
              </button>

              {/* Customer Review Details */}
              <Link
                href={`/orders/${order._id}/review`}
                className="h-10 px-4 bg-white hover:bg-[#FAF9F6] text-[#1A1A1A] border border-[#E8E6E3] rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-[#5b5f64]">rate_review</span>
                <span>Review Details</span>
              </Link>

              {/* Order Details */}
              <Link
                href={`/orders/${order._id}`}
                className="h-10 px-4 bg-white hover:bg-[#FAF9F6] text-[#1A1A1A] border border-[#E8E6E3] rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-[#5b5f64]">visibility</span>
                <span>Order Details</span>
              </Link>

              {/* Close Preview */}
              <button
                type="button"
                onClick={() => router.push(`/orders/${order._id}`)}
                className="h-10 w-10 flex items-center justify-center bg-white hover:bg-[#FAF9F6] text-[#5b5f64] hover:text-[#1A1A1A] border border-[#E8E6E3] rounded-lg transition-colors cursor-pointer"
                title="Close Preview"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          {/* ==================================================== */}
          {/* MAIN TWO-COLUMN BENTO LAYOUT */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* -------------------------------------------------- */}
            {/* LEFT COLUMN: 80MM POS THERMAL RECEIPT DISPLAY */}
            {/* -------------------------------------------------- */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="w-full max-w-[430px] relative">
                {/* Thermal Receipt Paper Effect */}
                <div
                  id="printable-thermal-slip"
                  className="bg-white rounded-2xl shadow-md border border-[#E8E6E3] p-6 sm:p-7 text-[#1A1A1A] text-xs relative overflow-hidden transition-all duration-200"
                >
                  {/* Top Notch Decor */}
                  <div className="flex justify-between items-center pb-3 mb-2 border-b border-dashed border-[#E8E6E3]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-black"></span>
                      <span className="text-[10px] tracking-widest uppercase text-[#5b5f64] font-bold">
                        PREST KITCHEN &amp; REGISTER
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-[#5b5f64]">80MM SLIP</span>
                  </div>

                  {/* Brand Header */}
                  <div className="text-center flex flex-col items-center gap-1 pt-1">
                    <span className="text-base font-bold tracking-tight uppercase text-black">
                      {activeOrg?.name || "PREST DINING & BISTRO"}
                    </span>
                    <span className="text-[11px] text-[#5b5f64]">
                      {activeOrg?.addressLine1 || "104 Gourmet Boulevard, Metro City"}
                      {activeOrg?.city ? `, ${activeOrg.city}` : ""}
                    </span>
                    <span className="text-[10px] text-[#5b5f64]">
                      GSTIN: {activeOrg?.gstNumber || "27AABCP1234F1Z9"} • Tel: {activeOrg?.phone || "+91 95210-20647"}
                    </span>
                  </div>

                  {/* Perforation Line */}
                  <div className="my-4 border-t border-[#E8E6E3]"></div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-[#5b5f64] mb-3">
                    <div className="flex justify-between">
                      <span>Bill No:</span>
                      <span className="font-bold text-[#1A1A1A]">#{order.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Table:</span>
                      <span className="font-bold text-[#1A1A1A]">{tableDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Order Ref:</span>
                      <span className="font-bold text-[#1A1A1A]">#{order.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Covers:</span>
                      <span className="font-bold text-[#1A1A1A]">
                        {order.membersOnTable ? `${order.membersOnTable} Guests` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span className="font-bold text-[#1A1A1A]">{formattedDateTimeStr}</span>
                    </div>
                    {cashierName && (
                      <div className="flex justify-between">
                        <span>Cashier:</span>
                        <span className="font-bold text-[#1A1A1A]">{cashierName}</span>
                      </div>
                    )}
                  </div>

                  {/* Items Table Header */}
                  <div className="bg-[#FAF9F6] px-2.5 py-1.5 rounded flex justify-between text-[11px] uppercase font-bold text-[#5b5f64] tracking-wider mt-2">
                    <span className="w-1/2">Item Description</span>
                    <span className="w-12 text-center">Qty</span>
                    <span className="w-16 text-right">Price</span>
                    <span className="w-20 text-right">Total</span>
                  </div>

                  {/* Order Line Items */}
                  <div className="flex flex-col py-1 text-xs">
                    {items.map((it, idx) => (
                      <div
                        key={it._id || idx}
                        className="flex justify-between items-center py-2 px-2.5 hover:bg-[#FAF9F6] transition-colors rounded"
                      >
                        <div className="w-1/2 flex flex-col">
                          <span className="font-semibold text-[#1A1A1A]">{it.itemName}</span>
                          <span className="text-[10px] text-[#5b5f64]">
                            {it.prepPreferences && it.prepPreferences.length > 0
                              ? it.prepPreferences.map((p: any) => p.name).join(", ")
                              : "Chef Special"}
                          </span>
                        </div>
                        <span className="w-12 text-center text-[#1A1A1A] font-medium">{it.quantity}</span>
                        <span className="w-16 text-right text-[#5b5f64]">
                          {currencySymbol}{((it.itemPrice || 0) / 100).toFixed(2)}
                        </span>
                        <span className="w-20 text-right font-bold text-[#1A1A1A]">
                          {currencySymbol}{((it.totalPrice || 0) / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="my-2 border-t border-[#E8E6E3]"></div>

                  {/* Financial Breakdown */}
                  <div className="flex flex-col gap-1 py-1 text-xs">
                    <div className="flex justify-between text-[#5b5f64]">
                      <span>Subtotal ({items.length} items)</span>
                      <span className="text-[#1A1A1A] font-semibold">{currencySymbol}{subTotalNum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[#5b5f64]">
                      <span>CGST @ 2.5%</span>
                      <span className="text-[#1A1A1A]">{currencySymbol}{cgst}</span>
                    </div>
                    <div className="flex justify-between text-[#5b5f64]">
                      <span>SGST @ 2.5%</span>
                      <span className="text-[#1A1A1A]">{currencySymbol}{sgst}</span>
                    </div>

                    {/* Grand Total Bar */}
                    <div className="mt-2 p-3 bg-[#FAF9F6] border border-[#E8E6E3] rounded-xl flex justify-between items-baseline">
                      <span className="text-xs font-bold uppercase tracking-tight text-black">
                        Grand Total
                      </span>
                      <span className="text-lg font-extrabold text-black">
                        {currencySymbol}{grandTotalNum.toFixed(2)}
                      </span>
                    </div>

                    {/* Payment Status Tag */}
                    <div className="flex items-center justify-between text-[11px] text-[#5b5f64] px-1 mt-1.5">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-black">
                          {order.paymentMode === "Cash" ? "payments" : "credit_card"}
                        </span>
                        <span>Paid via {order.paymentMode || order.paymentStatus || "Settled"}</span>
                      </span>
                      {order.paymentStatus && (
                        <span className="font-mono text-[#1A1A1A] font-semibold">{order.paymentStatus}</span>
                      )}
                    </div>
                  </div>

                  {/* ================================================== */}
                  {/* DEDICATED REVIEW & SURVEY QR SECTION */}
                  {/* ================================================== */}
                  {includeReviewQr && (
                    <div
                      id="receipt-feedback-card"
                      className="mt-5 pt-4 rounded-xl bg-[#FAF9F6] border border-[#E8E6E3] p-5 flex flex-col items-center text-center"
                    >
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E8E6E3] shadow-2xs mb-2">
                        <span className="material-symbols-outlined text-[15px] text-black">stars</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-black">
                          Order Feedback
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-black tracking-tight">
                        How was your experience?
                      </h3>
                      <p className="text-[11px] text-[#5b5f64] max-w-xs mt-1 leading-relaxed">
                        Scan to rate your food items &amp; share kitchen feedback for Order #{order.orderNumber}.
                      </p>

                      {/* Precision Scalable QR Code Graphic */}
                      <div
                        id="receipt-feedback-qr-box"
                        className="my-3 p-3 bg-white rounded-xl border border-[#E8E6E3] shadow-2xs flex flex-col items-center"
                      >
                        {feedbackUrl ? (
                          <QRCodeSVG
                            id="order-feedback-qr-svg"
                            value={feedbackUrl}
                            size={124}
                            level="M"
                            marginSize={0}
                            fgColor="#000000"
                            bgColor="#ffffff"
                          />
                        ) : (
                          <div className="w-32 h-32 flex items-center justify-center bg-stone-100 rounded text-[11px] text-stone-500">
                            Awaiting Survey
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center justify-center gap-0.5 text-xs font-bold text-black w-full max-w-full px-2 text-center mt-1">
                        <span className="text-[#5b5f64] font-normal text-[11px]">Or review at:</span>
                        <a
                          href={feedbackUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tracking-tight underline underline-offset-2 hover:text-stone-700 break-all text-[11px] leading-tight text-center max-w-full"
                        >
                          {shortFeedbackDisplay}
                        </a>
                      </div>

                      {attemptInfo?.attemptId && (
                        <p className="text-[10px] text-[#5b5f64] mt-1">
                          Session Ref: <span className="font-mono font-semibold text-[#1A1A1A]">{attemptInfo.attemptId.slice(-8)}</span> • 1-Click Verification
                        </p>
                      )}
                    </div>
                  )}

                  {/* Bottom Receipt Footer */}
                  <div id="receipt-footer" className="text-center mt-5 pt-2 text-[#5b5f64] text-[11px]">
                    <p className="font-semibold text-black">Thank you for dining with PREST!</p>
                    <p className="mt-0.5 text-[10px]">Please retain this bill for invoice &amp; loyalty credits.</p>
                    <div className="mt-3 flex justify-center items-center gap-1.5 text-[9px] text-[#747878] tracking-widest uppercase">
                      <span>Terminal #01</span> • <span>Shift AM</span> • <span>POS Build 4.12</span>
                    </div>
                  </div>
                </div>

                {/* Print Action Status Bar */}
                <div className="mt-3 flex items-center justify-between px-2 text-[#5b5f64] text-xs">
                  <span>Width: 80mm Standard Roll</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>{cashierPrinter?.printerType || "Epson"} TM-T88VI Ready</span>
                  </span>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------- */}
            {/* RIGHT COLUMN: CONFIGURATION & VERIFICATION HUB */}
            {/* -------------------------------------------------- */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Card 1: Review QR Binding & Security */}
              <div className="bg-white rounded-2xl p-6 border border-[#E8E6E3] shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-black">
                      <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-black">Review QR Binding</h2>
                      <p className="text-[11px] text-[#5b5f64]">Anti-tamper customer feedback linkage</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                    activeSurvey
                      ? "bg-[#E6F4EA] text-[#137333]"
                      : "bg-[#FAF9F6] text-[#5b5f64] border border-[#E8E6E3]"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${activeSurvey ? "bg-[#137333]" : "bg-[#747878]"}`}></span>
                    <span>{activeSurvey ? "Ready to Scan" : "No Active Survey"}</span>
                  </span>
                </div>

                {/* Binding Data Spec */}
                <div className="flex flex-col gap-2 rounded-xl bg-[#FAF9F6] border border-[#E8E6E3] p-4 text-xs">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#5b5f64]">Order Binding</span>
                    <span className="font-mono text-black font-bold">ORD-{order.orderNumber}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#5b5f64]">Target Destination</span>
                    {feedbackUrl ? (
                      <a
                        href={feedbackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-black font-medium hover:underline flex items-center gap-1 truncate max-w-[220px]"
                      >
                        <span className="truncate">{shortFeedbackDisplay}</span>
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      </a>
                    ) : (
                      <span className="text-stone-400">Unavailable</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#5b5f64]">Signature Payload</span>
                    <span className="font-mono text-black">
                      sig={attemptInfo?.attemptId ? attemptInfo.attemptId.slice(-10) : "9f8a32b9c7"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#5b5f64]">Survey Schema</span>
                    <span className="text-black font-semibold">
                      {activeSurvey?.name || "Bistro Multi-Item + Star Rating"}
                    </span>
                  </div>
                </div>

                {/* Architecture Callout */}
                <div className="flex items-start gap-3 p-3.5 bg-[#FAF9F6] border border-[#E8E6E3] rounded-xl text-[#5b5f64] text-xs leading-relaxed">
                  <span className="material-symbols-outlined text-[20px] text-black shrink-0 mt-0.5">
                    verified_user
                  </span>
                  <p>
                    <strong className="font-bold text-black">Order-Bound Integrity:</strong> Generates a single-use review session mapped directly to Table {table?.number || "14"}&apos;s ordered dishes. Prevents malicious public reviews or duplicate survey submissions.
                  </p>
                </div>

                {/* Interaction Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsSimulatorOpen(true)}
                    className="flex-1 h-10 px-4 bg-black hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">phone_iphone</span>
                    <span>Simulate Customer View</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSvg}
                    disabled={!feedbackUrl}
                    className="h-10 px-4 bg-white hover:bg-[#FAF9F6] disabled:opacity-40 text-black border border-[#E8E6E3] rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px] text-[#5b5f64]">download</span>
                    <span>Export SVG</span>
                  </button>
                </div>
              </div>

              {/* Standalone Control: Include Order Review QR Code */}
              <div className="bg-white rounded-2xl p-6 border border-[#E8E6E3] shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF9F6] border border-[#E8E6E3] flex items-center justify-center text-black">
                    <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-black">Include Order Review QR Code</span>
                    <span className="text-[11px] text-[#5b5f64]">Prints dynamic customer feedback QR on receipts</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeReviewQr}
                    onChange={(e) => handleToggleQr(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>

              {/* Card 3: Item-Level Survey Questions Ready */}
              <div className="bg-white rounded-2xl p-6 border border-[#E8E6E3] shadow-xs flex flex-col gap-3">
                <h3 className="text-sm font-bold text-black">Item-Level Survey Questions Ready</h3>
                <p className="text-xs text-[#5b5f64]">Customer scanning will evaluate:</p>

                <div className="flex flex-wrap gap-2 mt-1">
                  {items.map((it, idx) => {
                    const icons = ["restaurant", "bakery_dining", "soup_kitchen", "local_cafe"];
                    const criteria = ["Taste & Temp", "Crispness", "Authenticity", "Sweetness"];
                    const iconName = icons[idx % icons.length];
                    const criterion = criteria[idx % criteria.length];

                    return (
                      <span
                        key={it._id || idx}
                        className="px-3 py-1.5 rounded-lg bg-[#FAF9F6] border border-[#E8E6E3] text-xs font-semibold text-black flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[15px] text-[#5b5f64]">
                          {iconName}
                        </span>
                        <span>{it.itemName} ({criterion})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* INTERACTIVE MOBILE REVIEW SCREEN SIMULATOR MODAL */}
      {/* ==================================================== */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col border border-[#E8E6E3] animate-in fade-in zoom-in-95 duration-150">
            {/* Mobile Notch Header */}
            <div className="bg-black px-4 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-400">verified</span>
                <span className="text-xs font-bold tracking-wide uppercase">PREST GUEST REVIEW</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulatorOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Mobile Body */}
            <div className="p-5 flex flex-col gap-4 bg-[#FAF9F6] max-h-[80vh] overflow-y-auto">
              <div className="text-center">
                <span className="text-[11px] font-bold text-[#5b5f64] uppercase tracking-widest">
                  {tableDisplay} • {order.orderType}
                </span>
                <h4 className="text-base font-extrabold text-black mt-0.5">Order #{order.orderNumber} Rating</h4>
                <p className="text-xs text-[#5b5f64] mt-0.5">Please rate each dish to help Chef refine service.</p>
              </div>

              {/* Star Rating Overall */}
              <div className="p-4 bg-white rounded-xl border border-[#E8E6E3] shadow-2xs text-center flex flex-col items-center">
                <span className="text-xs text-[#5b5f64] font-medium mb-1.5">Overall Bistro Experience</span>
                <div className="flex items-center gap-1 text-black">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSimOverallRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <span
                        className="material-symbols-outlined text-[26px]"
                        style={{ fontVariationSettings: simOverallRating >= star ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        star
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulated Item Checklist */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold text-[#5b5f64] uppercase tracking-wider">
                  Ordered Dishes
                </span>
                {items.map((it, idx) => {
                  const currentFeedback = simLikedItems[it._id || idx];
                  return (
                    <div
                      key={it._id || idx}
                      className="bg-white p-3 rounded-xl border border-[#E8E6E3] shadow-2xs flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-black">{it.itemName}</span>
                        <span className="text-[10px] text-[#5b5f64]">
                          Qty: {it.quantity} • Served {formattedDateTimeStr.split(",")[1] || "20:30"}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSimLikedItems((prev) => ({
                              ...prev,
                              [it._id || idx]: currentFeedback === "like" ? "" : "like",
                            }))
                          }
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors cursor-pointer ${
                            currentFeedback === "like"
                              ? "bg-black text-white"
                              : "bg-[#FAF9F6] border border-[#E8E6E3] hover:bg-stone-100"
                          }`}
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSimLikedItems((prev) => ({
                              ...prev,
                              [it._id || idx]: currentFeedback === "love" ? "" : "love",
                            }))
                          }
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors cursor-pointer ${
                            currentFeedback === "love"
                              ? "bg-black text-white"
                              : "bg-[#FAF9F6] border border-[#E8E6E3] hover:bg-stone-100"
                          }`}
                        >
                          ❤️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSimulatorOpen(false);
                  showToast("Simulation completed. In simulator mode, no live records or analytics are affected.");
                }}
                className="h-11 w-full bg-black hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs mt-1"
              >
                Submit Anonymous Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* DEDICATED PRINTABLE THERMAL RECEIPT STYLES */}
      {/* ==================================================== */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          html, body, #__next, main, div {
            overflow: visible !important;
            height: auto !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-thermal-slip,
          #printable-thermal-slip * {
            visibility: visible !important;
          }
          #printable-thermal-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 3mm 4mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          #receipt-feedback-card {
            margin-top: 3mm !important;
            padding: 2.5mm 2mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          #receipt-feedback-qr-box {
            margin: 2mm 0 !important;
            padding: 1.5mm !important;
          }
          #receipt-feedback-qr-box svg,
          #order-feedback-qr-svg {
            width: 90px !important;
            height: 90px !important;
          }
          #receipt-footer {
            margin-top: 2.5mm !important;
            padding-top: 1mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          #printable-thermal-slip a {
            text-decoration: underline !important;
            color: #000000 !important;
          }
          #printable-thermal-slip svg {
            display: block !important;
            margin: 0 auto !important;
          }
        }
      `}</style>
    </PosShell>
  );
}
