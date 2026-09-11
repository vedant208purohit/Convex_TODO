"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { PosShell } from "../../components/PosShell";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import EditOrderDrawer from "../../components/orders/EditOrderDrawer";
import { openReceiptPdfInNewTab } from "../../utils/generateReceiptPdf";
import { generateDefxReceiptPlainString } from "../../utils/defxReceiptFormatter";

// ==========================================
// PIXEL-PERFECT SVG ICONS (PREST THEME)
// ==========================================

function ChevronRightIcon({
  className = "w-3.5 h-3.5",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CheckmarkIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        clipRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        fillRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M6 18L18 6M6 6l12 12"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function PrintIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <polyline
        points="6 9 6 2 18 2 18 9"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="6"
        y="14"
        width="12"
        height="8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowLeftIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentTextIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CreditCardIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefundIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        d="M16 15v-1a4 4 0 00-4-4H4m0 0l3-3m-3 3l3 3m5 4v1a3 3 0 003 3h6a3 3 0 003-3V7a3 3 0 00-3-3h-6a3 3 0 00-3 3v1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TimelineIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatDateDisplay(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function OrderDetailsDynamicPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = (params?.id as string) || "";

  // Query Organization
  const organizations = useQuery(api.organizations.list);
  const activeOrg =
    organizations && organizations.length > 0 ? organizations[0] : null;

  // Query Real Store Order Processes from DB
  const dbProcesses = useQuery(api.organizationOrderProcesses.list, {
    published: true,
  });

  // Query Real Store Payment Modes from DB
  const paymentModesList = useQuery(
    api.paymentModes.list,
    activeOrg ? { organizationId: activeOrg._id } : {},
  );

  // Query Order Details
  const order = useQuery(
    api.orders.getOrderDetails,
    orderId ? { id: orderId } : "skip",
  );

  // Mutations
  const addPaymentMutation = useMutation(api.orders.addOrderPayment);
  const cancelOrderMutation = useMutation(api.orders.cancelOrder);

  // Drawer and Modal States
  const [drawerTab, setDrawerTab] = useState<
    "pay" | "timeline" | "refund" | null
  >(null);
  const [paymentTenderMode, setPaymentTenderMode] = useState<
    "Cash" | "UPI QR" | "Card / POS" | "Split"
  >("Cash");
  const [tenderCashGiven, setTenderCashGiven] = useState("");
  const [refundPaymentMode, setRefundPaymentMode] = useState<string>("Cash");
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);

  // Notification Toast
  const [notificationMessage, setNotificationMessage] = useState<string | null>(
    null,
  );

  const showToast = (msg: string) => {
    setNotificationMessage(msg);
    setTimeout(() => {
      setNotificationMessage(null);
    }, 4000);
  };

  // Payment Settlement Handler
  const handleSettlePayment = async () => {
    if (!orderId || !order) return;
    try {
      const amountPaise = order.totalAmount;
      const selectedMode = paymentModesList?.find(
        (m) => m.name.toLowerCase() === paymentTenderMode.toLowerCase(),
      );
      await addPaymentMutation({
        orderId: order._id,
        paymentModeId: selectedMode?._id,
        paymentModeName: selectedMode?.name || paymentTenderMode,
        paymentType: "Credit",
        amount: amountPaise,
        transactionReference: `POS-PAY-${Date.now().toString().slice(-6)}`,
      });
      setDrawerTab(null);
      setTenderCashGiven("");
      showToast(
        `Payment of ₹${order.display_total_amount} via ${paymentTenderMode} recorded successfully.`,
      );
    } catch (err: any) {
      showToast(err.message || "Failed to record payment");
    }
  };

  // Refund Submission Handler
  const handleIssueRefund = async () => {
    if (!orderId || !order) return;
    const amountVal = parseFloat(
      refundAmountInput || order.display_total_amount || "0",
    );
    if (isNaN(amountVal) || amountVal <= 0) {
      showToast("Please enter a valid refund amount");
      return;
    }
    try {
      const selectedMode = paymentModesList?.find(
        (m) => m.name.toLowerCase() === refundPaymentMode.toLowerCase(),
      );
      await addPaymentMutation({
        orderId: order._id,
        paymentModeId: selectedMode?._id,
        paymentModeName: selectedMode?.name || refundPaymentMode,
        paymentType: "Debit",
        amount: Math.round(amountVal * 100),
        transactionReference: `REFUND-${Date.now().toString().slice(-6)}`,
      });
      setDrawerTab(null);
      setRefundAmountInput("");
      showToast(
        `Refund of ₹${amountVal.toFixed(2)} processed successfully via ${refundPaymentMode}.`,
      );
    } catch (err: any) {
      showToast(err.message || "Failed to process refund");
    }
  };

  // Confirm Delete Order
  const handleConfirmDeleteOrder = async () => {
    if (!orderId || !order) return;
    try {
      setIsDeletingOrder(true);
      await cancelOrderMutation({
        orderId: order._id,
        reason: "Deleted by admin from Order Details",
      });
      setIsDeleteDialogOpen(false);
      showToast(`Order ${order.orderNumber} deleted successfully.`);
      setTimeout(() => {
        router.push("/orders");
      }, 600);
    } catch (err: any) {
      showToast(err.message || "Failed to delete order");
    } finally {
      setIsDeletingOrder(false);
    }
  };

  // Print Thermal Receipt
  const handlePrintReceipt = () => {
    showToast("Opening print dialogue for thermal receipt...");
    if (typeof window !== "undefined") {
      const origTitle = document.title;
      document.title = "";
      window.print();
      setTimeout(() => {
        document.title = origTitle;
      }, 1000);
    }
  };

  // Download PDF Receipt (Opens real PDF in native Chrome/Edge PDF viewer)
  const handleDownloadPDF = () => {
    if (!order) return;
    showToast("Opening order receipt PDF in viewer...");
    openReceiptPdfInNewTab({
      order,
      org: activeOrg,
    });
  };

  // Loading State
  if (order === undefined) {
    return (
      <PosShell title="Loading Order...">
        <div className="flex-1 flex items-center justify-center bg-[#fdf8f7]">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-[#141010]">
              Loading Order Details...
            </p>
            <p className="text-xs text-[#7a716b]">
              Fetching latest transaction ledger and status.
            </p>
          </div>
        </div>
      </PosShell>
    );
  }

  // Not Found State
  if (order === null) {
    return (
      <PosShell title="Order Not Found">
        <div className="flex-1 flex items-center justify-center bg-[#fdf8f7] p-8">
          <div className="bg-white border border-[#e7e5e4] rounded-2xl p-8 max-w-md text-center shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <CloseIcon className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#0c0a09]">
              Order Not Found
            </h2>
            <p className="text-xs text-[#7a716b]">
              The requested order ID could not be found in the system or has
              been permanently removed.
            </p>
            <Link
              href="/orders"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0c0a09] text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>Return to Orders List</span>
            </Link>
          </div>
        </div>
      </PosShell>
    );
  }

  const orderCreatedDate = order?.createdAt
    ? new Date(order.createdAt)
    : new Date();
  const formattedOrderDate = formatDateDisplay(orderCreatedDate);
  const formattedOrderTime = orderCreatedDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const isPaid = order?.paymentStatus === "Paid";

  return (
    <PosShell title={`Order ${order.orderNumber}`}>
      {/* Toast Notification Banner */}
      {notificationMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0c0a09] text-white px-5 py-3 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-slideDown font-sans">
          <CheckmarkIcon className="w-4 h-4 text-emerald-400" />
          <span>{notificationMessage}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#fdf8f7] font-sans">
        {/* Top Breadcrumb & Actions Bar */}
        <div className="bg-[#fdf8f7] px-6 lg:px-8 py-6 border-b border-[#e7e5e4] shrink-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between w-full gap-4">
            <div>
              <nav
                aria-label="Breadcrumb"
                className="flex items-center text-[13px] text-[#5e5e5e] mb-2 gap-2 font-sans font-medium"
              >
                <Link
                  href="/orders"
                  className="hover:text-[#141010] transition-colors cursor-pointer"
                >
                  Orders
                </Link>
                <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
                <span className="text-[#141010] font-semibold">
                  {order.orderNumber}
                </span>
              </nav>
              <h1 className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight">
                Order {order.orderNumber}
              </h1>
              <p className="text-[#5e5e5e] text-[14px] mt-1">
                View transaction details, line items, customer info, and manage
                order actions.
              </p>
            </div>

            {/* Quick Action Buttons in Top Header */}
            <div className="flex items-center gap-3">
              <Link
                href="/orders"
                className="h-10 px-5 border border-[#e7e5e4] rounded-full text-[#141010] hover:bg-[#f1edec] transition-colors font-medium text-sm bg-white cursor-pointer inline-flex items-center gap-2 shadow-2xs"
              >
                <ArrowLeftIcon className="w-4 h-4 text-[#5e5e5e]" />
                <span>Back to Orders</span>
              </Link>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>{order.orderStatusName || "Live Order Status"}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {/* BEGIN: MetadataStrip */}
            <section
              className="bg-white border border-[#e7e5e4] rounded-xl p-4 lg:px-6 shadow-xs"
              data-purpose="order-metadata-strip"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-[#e7e5e4]">
                <div className="pt-2 sm:pt-0 sm:pr-4">
                  <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">
                    Order #
                  </span>
                  <span className="text-xs font-semibold text-[#0c0a09]">
                    {order.orderNumber || "-"}
                  </span>
                </div>
                <div className="pt-2 sm:pt-0 sm:px-4">
                  <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">
                    Token #
                  </span>
                  <span className="text-xs font-semibold text-[#0c0a09]">
                    {order.tokenNumber || "-"}
                  </span>
                </div>
                <div className="pt-2 sm:pt-0 sm:px-4">
                  <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">
                    Order Type
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-[#f1edec] text-[#0c0a09]">
                    {order.orderType || "DineIn"}
                  </span>
                </div>
                <div className="pt-2 sm:pt-0 sm:px-4">
                  <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">
                    Order Status
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />{" "}
                    {order.orderStatusName || "Accepted"}
                  </span>
                </div>
                <div className="pt-2 sm:pt-0 sm:px-4">
                  <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">
                    Date
                  </span>
                  <span className="text-xs font-semibold text-[#0c0a09]">
                    {formattedOrderDate}
                  </span>
                </div>
                <div className="pt-2 sm:pt-0 sm:px-4">
                  <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">
                    Time
                  </span>
                  <span className="text-xs font-semibold text-[#0c0a09]">
                    {formattedOrderTime}
                  </span>
                </div>
                <div className="pt-2 sm:pt-0 sm:px-4">
                  <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">
                    Source
                  </span>
                  <span className="text-xs font-semibold text-[#0c0a09]">
                    {order.orderSource || "Prest Cashier"}
                  </span>
                </div>
                <div className="pt-2 sm:pt-0 sm:pl-4">
                  <span className="block text-[11px] font-semibold tracking-wider uppercase text-[#7a716b] mb-0.5">
                    Table
                  </span>
                  <span
                    className="text-xs font-semibold text-[#0c0a09] truncate block"
                    title={order.table ? `Table ${order.table.number}` : "N/A"}
                  >
                    {order.table
                      ? `Table ${order.table.number}`
                      : "Counter / Takeaway"}
                  </span>
                </div>
              </div>
            </section>
            {/* END: MetadataStrip */}

            {/* BEGIN: TwoColumnLayout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: 65% (8 Cols) */}
              <div className="lg:col-span-8 space-y-6">
                {/* Card 1: Customer & Address Details */}
                <section
                  className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-xs"
                  data-purpose="customer-card"
                >
                  <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3 mb-4">
                    <h2 className="text-[20px] font-semibold text-[#0c0a09] flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-[#7a716b]" />
                      Customer & Address Details
                    </h2>
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-[#7a716b]">
                      {order.customerName
                        ? "Registered Patron"
                        : "Guest Customer"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <span className="block text-[11px] font-semibold text-[#7a716b] tracking-wider uppercase">
                        Customer Name
                      </span>
                      <p className="text-sm font-semibold text-[#0c0a09] mt-0.5">
                        {order.customerName || "Walk-in Customer"}
                      </p>
                      <p className="text-xs text-[#8c7662] mt-0.5">
                        {order.customerName ? "Patron Member" : "Direct Guest"}
                      </p>
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold text-[#7a716b] tracking-wider uppercase">
                        Contact Phone
                      </span>
                      <p className="text-sm font-semibold text-[#0c0a09] mt-0.5">
                        {order.customerPhone || "+91 98200 12345"}
                      </p>
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold text-[#7a716b] tracking-wider uppercase">
                        Email Address
                      </span>
                      <p className="text-sm text-[#0c0a09] mt-0.5">
                        {order.customerEmail || "customer@example.com"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3.5 border-t border-[#e7e5e4] flex items-center justify-between bg-[#fdf8f7]/60 -mx-6 -mb-6 px-6 py-3 rounded-b-xl">
                    <div className="flex items-center gap-2 text-xs text-[#0c0a09]">
                      <span className="font-semibold uppercase tracking-wider text-[10px] text-[#7a716b]">
                        {order.orderType === "Delivery"
                          ? "Delivery Address:"
                          : "Dine-In Note:"}
                      </span>
                      <span className="font-medium">
                        {order.deliveryAddress
                          ? `${order.deliveryAddress.addressLine1}, ${order.deliveryAddress.city || ""}`
                          : order.table
                            ? `Table ${order.table.number} (Ground Floor)`
                            : "Standard Counter Pickup"}
                      </span>
                    </div>
                    <div className="text-xs text-[#7a716b]">
                      Assigned Captain:{" "}
                      <span className="font-semibold text-[#0c0a09]">
                        Johan Coder
                      </span>
                    </div>
                  </div>
                </section>

                {/* Card 2: Ordered Items Details */}
                <section
                  className="bg-white rounded-xl border border-[#e7e5e4] shadow-xs overflow-hidden"
                  data-purpose="items-table-card"
                >
                  <div className="p-6 pb-4 border-b border-[#e7e5e4] flex items-center justify-between">
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#0c0a09] flex items-center gap-2">
                        <DocumentTextIcon className="w-4 h-4 text-[#7a716b]" />
                        Ordered Items Details
                      </h2>
                      <p className="text-xs text-[#7a716b] mt-0.5">
                        Manage line-items, modify selections, and adjust order
                        quantities.
                      </p>
                    </div>
                    <span className="text-xs font-semibold bg-[#f1edec] text-[#0c0a09] px-2.5 py-1 rounded">
                      {order.items?.length || 0} Unique Items
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table
                      className="w-full text-left border-collapse"
                      id="order-items-table"
                    >
                      <thead>
                        <tr className="bg-[#faf8f5] border-b border-[#e7e5e4] text-[11px] font-semibold uppercase tracking-wider text-[#7a716b]">
                          <th className="py-3 px-6" scope="col">
                            Items
                          </th>
                          <th className="py-3 px-4 text-right" scope="col">
                            Price
                          </th>
                          <th className="py-3 px-4 text-center" scope="col">
                            Qty
                          </th>
                          <th className="py-3 px-6 text-right" scope="col">
                            Sub Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e7e5e4] text-sm">
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item: any, idx: number) => (
                            <tr
                              key={idx}
                              className="hover:bg-[#fdfcf9] transition-colors"
                            >
                              <td className="py-3.5 px-6">
                                <span className="font-semibold text-[#0c0a09] block">
                                  {item.itemName}
                                </span>
                                {item.customizations &&
                                  item.customizations.length > 0 && (
                                    <span className="text-xs text-[#7a716b] italic block mt-0.5">
                                      {item.customizations
                                        .map(
                                          (c: any) =>
                                            `${c.optionName} ₹${(c.price / 100).toFixed(2)}`,
                                        )
                                        .join(", ")}
                                    </span>
                                  )}
                              </td>
                              <td className="py-3.5 px-4 text-right text-xs font-medium text-[#7a716b] align-top">
                                ₹{item.display_item_price}
                              </td>
                              <td className="py-3.5 px-4 text-center align-top">
                                <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs font-semibold text-[#0c0a09]">
                                  {item.quantity}
                                </span>
                              </td>
                              <td className="py-3.5 px-6 text-right text-xs font-bold text-[#0c0a09] align-top">
                                ₹{item.display_total_price}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-6 text-center text-xs text-[#7a716b]"
                            >
                              No line items recorded for this order.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Financial Breakdown Footer Box */}
                  <div className="border-t border-[#e7e5e4] bg-[#faf8f5]/50 px-6 py-5">
                    <div className="flex flex-col items-end">
                      <div className="w-full max-w-xs space-y-2 text-xs">
                        <div className="flex justify-between items-center text-[#7a716b]">
                          <span className="font-medium">Sub Total</span>
                          <span className="font-semibold text-[#0c0a09]">
                            ₹{order.display_sub_total || "0.00"}
                          </span>
                        </div>

                        {order.taxInfoSnapshot?.components &&
                        order.taxInfoSnapshot.components.length > 0 ? (
                          order.taxInfoSnapshot.components.map(
                            (c: any, i: number) => (
                              <div
                                key={i}
                                className="flex justify-between items-center text-[#7a716b]"
                              >
                                <span>
                                  {c.name} ({c.rate}%)
                                </span>
                                <span className="font-semibold text-[#0c0a09]">
                                  +₹
                                  {(
                                    ((order.subTotal || 0) * c.rate) /
                                    10000
                                  ).toFixed(2)}
                                </span>
                              </div>
                            ),
                          )
                        ) : (
                          <div className="flex justify-between items-center text-[#7a716b]">
                            <span>GST (Tax Total)</span>
                            <span className="font-semibold text-[#0c0a09]">
                              ₹{order.display_tax_total || "0.00"}
                            </span>
                          </div>
                        )}

                        {parseFloat(order.display_discount_amount || "0") >
                          0 && (
                          <div className="flex justify-between items-center text-emerald-700">
                            <span className="font-medium">
                              Discount Applied
                            </span>
                            <span className="font-semibold">
                              -₹{order.display_discount_amount}
                            </span>
                          </div>
                        )}

                        <div className="border-t border-[#e7e5e4] pt-2.5 mt-2.5 flex justify-between items-baseline">
                          <div className="flex flex-col">
                            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#7a716b]">
                              Grand Total
                            </span>
                            <span className="text-[10px] text-emerald-700 font-medium">
                              Taxes &amp; levies included
                            </span>
                          </div>
                          <span className="text-2xl font-bold text-[#0c0a09] tracking-tight">
                            ₹{order.display_total_amount || "0.00"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Card 3: Payment Information (Transaction Ledger) */}
                <section
                  className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-xs"
                  data-purpose="transaction-ledger"
                >
                  <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3 mb-4">
                    <h2 className="text-[20px] font-semibold text-[#0c0a09] flex items-center gap-2">
                      <CreditCardIcon className="w-4 h-4 text-[#7a716b]" />
                      Payment Information
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                        isPaid
                          ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                          : "text-amber-800 bg-amber-50 border border-amber-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isPaid ? "bg-emerald-600" : "bg-amber-600"}`}
                      />
                      {isPaid ? "Fully Settled" : "Payment Due"}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[#7a716b] border-b border-[#e7e5e4] uppercase tracking-wider font-semibold">
                          <th className="pb-2">Payment Time</th>
                          <th className="pb-2">Mode</th>
                          <th className="pb-2">Type</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e7e5e4]">
                        {order.payments && order.payments.length > 0 ? (
                          order.payments.map((p: any, idx: number) => {
                            const pDate = new Date(p.createdAt);
                            const pDateStr = formatDateDisplay(pDate);
                            const pTimeStr = pDate.toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            });
                            const isCredit = p.paymentType === "Credit";

                            return (
                              <tr key={p._id || idx}>
                                <td className="py-2.5 text-[#0c0a09] font-medium font-sans">
                                  {pDateStr} {pTimeStr}
                                </td>
                                <td className="py-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                      p.paymentModeName === "UPI"
                                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                        : p.paymentModeName === "Card"
                                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                                          : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {p.paymentModeName || "Cash"}
                                  </span>
                                </td>
                                <td
                                  className={`py-2.5 font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}
                                >
                                  {p.paymentType}
                                </td>
                                <td className="py-2.5 text-right font-bold text-[#0c0a09]">
                                  {isCredit ? "" : "-"}₹
                                  {((p.amount || 0) / 100).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td className="py-2.5 text-[#0c0a09] font-medium font-sans">
                              {formattedOrderDate} {formattedOrderTime}
                            </td>
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-semibold text-[#0c0a09]">
                                {order.paymentMode || "Cash"}
                              </span>
                            </td>
                            <td className="py-2.5 text-emerald-700 font-semibold">
                              Credit
                            </td>
                            <td className="py-2.5 text-right font-bold text-[#0c0a09]">
                              ₹{order.display_total_amount || "0.00"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
              {/* END LEFT COLUMN */}

              {/* RIGHT COLUMN: 35% (4 Cols) */}
              <div className="lg:col-span-4 space-y-6">
                {/* Card 1: Billing & Tax Breakdown */}
                <section
                  className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-xs"
                  data-purpose="billing-breakdown"
                >
                  <h2 className="text-[20px] font-semibold text-[#0c0a09] border-b border-[#e7e5e4] pb-3 mb-4 flex items-center justify-between">
                    <span>Billing &amp; Tax Breakdown</span>
                    <span className="text-xs font-semibold text-[#7a716b]">
                      INR (₹)
                    </span>
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center text-[#7a716b]">
                      <span className="font-medium">Sub Total</span>
                      <span className="font-semibold text-[#0c0a09]">
                        ₹{order.display_sub_total || "0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#7a716b] text-xs">
                      <span>CGST (2.5%)</span>
                      <span className="font-semibold text-[#0c0a09]">
                        ₹
                        {order.subTotal
                          ? ((order.subTotal * 0.025) / 100).toFixed(2)
                          : "0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#7a716b] text-xs">
                      <span>SGST (2.5%)</span>
                      <span className="font-semibold text-[#0c0a09]">
                        ₹
                        {order.subTotal
                          ? ((order.subTotal * 0.025) / 100).toFixed(2)
                          : "0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#7a716b] text-xs">
                      <span>Delivery / Service Charge</span>
                      <span className="font-semibold text-[#0c0a09]">
                        ₹0.00
                      </span>
                    </div>
                    {parseFloat(order.display_discount_amount || "0") > 0 && (
                      <div className="flex justify-between items-center text-emerald-700 text-xs">
                        <span className="font-medium">Discount</span>
                        <span className="font-semibold">
                          -₹{order.display_discount_amount}
                        </span>
                      </div>
                    )}
                    <div className="border-t-2 border-[#0c0a09] pt-3 mt-4 flex justify-between items-baseline">
                      <div>
                        <span className="block text-xs uppercase tracking-widest font-semibold text-[#7a716b]">
                          Total Payable
                        </span>
                        <span className="text-[11px] text-emerald-700 font-medium">
                          Includes all municipal levies
                        </span>
                      </div>
                      <span className="text-2xl font-bold text-[#0c0a09] tracking-tight">
                        ₹{order.display_total_amount || "0.00"}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Card 2: Issue Refund Card */}
                <section
                  className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-xs"
                  data-purpose="refund-widget"
                >
                  <h3 className="text-[20px] font-semibold text-[#0c0a09] mb-4">
                    Issue Refund
                  </h3>

                  {/* Debit Amount Display Box matching screenshot */}
                  <div className="flex border border-[#141010] rounded-lg overflow-hidden bg-white mb-4 shadow-2xs">
                    <div className="flex-1 py-3 px-4 text-sm font-semibold text-[#141010] flex items-center">
                      Debit Amount
                    </div>
                    <div className="bg-[#141010] text-white px-5 py-3 font-bold text-base font-mono flex items-center justify-center tracking-tight">
                      -₹
                      {order.display_debit_amount &&
                      parseFloat(order.display_debit_amount) > 0
                        ? parseFloat(order.display_debit_amount) % 1 === 0
                          ? parseInt(order.display_debit_amount)
                          : order.display_debit_amount
                        : "0"}
                    </div>
                  </div>

                  {/* Button triggering payment refund drawer */}
                  <button
                    type="button"
                    onClick={() => {
                      const remainingRefundable = Math.max(
                        0,
                        parseFloat(
                          order.display_net_paid ||
                            order.display_total_amount ||
                            "0",
                        ),
                      );
                      setRefundAmountInput(
                        remainingRefundable > 0
                          ? remainingRefundable.toString()
                          : order.display_total_amount,
                      );
                      setDrawerTab("refund");
                    }}
                    style={{ backgroundColor: "#1f7d43", color: "#ffffff" }}
                    className="w-full py-3 px-4 bg-[#1f7d43] hover:bg-[#186636] !text-white text-white rounded-lg text-sm font-semibold tracking-wide transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer hover:opacity-95"
                  >
                    <span className="!text-white text-white font-semibold text-sm">
                      Issue Refund
                    </span>
                  </button>
                </section>

                {/* Card 3: Order Actions */}
                <section
                  className="bg-white rounded-xl border border-[#e7e5e4] p-6 shadow-xs"
                  data-purpose="order-actions-grid"
                >
                  <h3 className="text-[20px] font-semibold text-[#0c0a09] mb-4">
                    Order Actions
                  </h3>

                  {/* 2-Column Action Grid */}
                  <div className="grid grid-cols-2 gap-2.5 mb-5">
                    {/* Edit Order */}
                    <button
                      type="button"
                      onClick={() => setIsEditOrderOpen(true)}
                      style={{ backgroundColor: "#1c1917", color: "#ffffff" }}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1c1917] hover:bg-black !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                    >
                      <EditIcon className="w-3.5 h-3.5 !text-white text-white" />
                      <span className="!text-white text-white font-semibold text-xs">
                        Edit Order
                      </span>
                    </button>

                    {/* Delete Order */}
                    <button
                      type="button"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      style={{ backgroundColor: "#1c1917", color: "#ffffff" }}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1c1917] hover:bg-black !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                    >
                      <TrashIcon className="w-3.5 h-3.5 !text-white text-white" />
                      <span className="!text-white text-white font-semibold text-xs">
                        Delete Order
                      </span>
                    </button>

                    {/* Print Receipt */}
                    <button
                      type="button"
                      onClick={handlePrintReceipt}
                      style={{ backgroundColor: "#1c1917", color: "#ffffff" }}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1c1917] hover:bg-black !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                    >
                      <PrintIcon className="w-3.5 h-3.5 !text-white text-white" />
                      <span className="!text-white text-white font-semibold text-xs">
                        Print Receipt
                      </span>
                    </button>

                    {/* Download PDF */}
                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      style={{ backgroundColor: "#1c1917", color: "#ffffff" }}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1c1917] hover:bg-black !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                    >
                      <DownloadIcon className="w-3.5 h-3.5 !text-white text-white" />
                      <span className="!text-white text-white font-semibold text-xs">
                        Download PDF
                      </span>
                    </button>

                    {/* Add Payment */}
                    <button
                      type="button"
                      onClick={() => {
                        setTenderCashGiven(order.display_total_amount || "");
                        setDrawerTab("pay");
                      }}
                      style={{ backgroundColor: "#1c1917", color: "#ffffff" }}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1c1917] hover:bg-black !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                    >
                      <CreditCardIcon className="w-3.5 h-3.5 !text-white text-white" />
                      <span className="!text-white text-white font-semibold text-xs">
                        Add Payment
                      </span>
                    </button>

                    {/* Order Timeline */}
                    <button
                      type="button"
                      onClick={() => setDrawerTab("timeline")}
                      style={{ backgroundColor: "#1c1917", color: "#ffffff" }}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#1c1917] hover:bg-black !text-white text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs hover:opacity-95"
                    >
                      <TimelineIcon className="w-3.5 h-3.5 !text-white text-white" />
                      <span className="!text-white text-white font-semibold text-xs">
                        Order Timeline
                      </span>
                    </button>
                  </div>

                  {/* Printer Status Widget */}
                  <div className="pt-3 border-t border-[#e7e5e4] flex items-center justify-between text-xs text-[#7a716b]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <PrintIcon className="w-3.5 h-3.5" />
                      <span>Thermal Printer</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                      Connected ●
                    </span>
                  </div>
                </section>
              </div>
              {/* END RIGHT COLUMN */}
            </div>
            {/* END: TwoColumnLayout */}
          </div>
        </main>

        {/* ========================================================================= */}
        {/* DEDICATED PRINTABLE RECEIPT TEMPLATE (FOR 80MM / 58MM THERMAL PRINTERS) */}
        {/* ========================================================================= */}
        <style jsx global>{`
          @page {
            size: 80mm auto;
            margin: 0mm !important;
          }
          @media print {
            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            body * {
              visibility: hidden !important;
            }
            #printable-order-receipt,
            #printable-order-receipt * {
              visibility: visible !important;
            }
            #printable-order-receipt {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              display: block !important;
              font-family:
                "Courier New",
                Courier,
                monospace !important;
              font-size: 11px !important;
              font-weight: 500 !important;
              line-height: 1.25 !important;
              white-space: pre !important;
              letter-spacing: 0 !important;
              word-break: normal !important;
              z-index: 999999 !important;
              box-shadow: none !important;
            }
          }
        `}</style>

        <div
          id="printable-order-receipt"
          className="hidden print:block font-mono text-black bg-white"
        >
          <pre className="font-mono text-black bg-white m-0 p-0 text-[11px] leading-[1.25] whitespace-pre font-medium">
            {generateDefxReceiptPlainString(order, activeOrg, 48)}
          </pre>
        </div>
      </div>

        {/* ========================================================================= */}
        {/* UNIFIED 3-IN-1 SLIDE-OVER DRAWER (PAY | TIMELINE | REFUND)                */}
        {/* ========================================================================= */}
        {drawerTab && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
              onClick={() => setDrawerTab(null)}
            />

            {/* Slide-out Panel */}
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl z-10 flex flex-col overflow-hidden animate-slideLeft font-sans">
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#e7e5e4] bg-[#fdf8f7]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#141010] font-sans">
                      {drawerTab === "pay" && "Payment Settlement"}
                      {drawerTab === "timeline" && "Order Timeline"}
                      {drawerTab === "refund" && "Payment Refund"}
                    </h3>
                    <p className="text-xs text-[#7a716b] mt-0.5 font-sans font-medium">
                      {order.orderNumber}{" "}
                      {order.tokenNumber ? `• Token ${order.tokenNumber}` : ""}
                    </p>
                  </div>
                  <button
                    aria-label="Close Drawer"
                    type="button"
                    onClick={() => setDrawerTab(null)}
                    className="text-[#7a716b] hover:text-[#141010] p-1.5 rounded-lg hover:bg-[#f4eee8] transition-colors cursor-pointer"
                  >
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Stable 3-Tab Segmented Control (Zero layout shifts when switching tabs) */}
                <div className="grid grid-cols-3 gap-1 bg-[#faf8f5] p-1 rounded-lg border border-[#e7e5e4]">
                  <button
                    type="button"
                    onClick={() => setDrawerTab("pay")}
                    className={`py-1.5 text-xs font-semibold rounded-md text-center transition-all cursor-pointer ${
                      drawerTab === "pay"
                        ? "bg-[#0c0a09] text-white shadow-xs"
                        : "text-[#7a716b] hover:text-black hover:bg-white/60"
                    }`}
                  >
                    Pay
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab("timeline")}
                    className={`py-1.5 text-xs font-semibold rounded-md text-center transition-all cursor-pointer ${
                      drawerTab === "timeline"
                        ? "bg-[#0c0a09] text-white shadow-xs"
                        : "text-[#7a716b] hover:text-black hover:bg-white/60"
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab("refund")}
                    className={`py-1.5 text-xs font-semibold rounded-md text-center transition-all cursor-pointer ${
                      drawerTab === "refund"
                        ? "bg-[#0c0a09] text-white shadow-xs"
                        : "text-[#7a716b] hover:text-black hover:bg-white/60"
                    }`}
                  >
                    Refund
                  </button>
                </div>
              </div>

              {/* Drawer Content Area */}
              <div className="flex-1 overflow-y-auto">
                {/* TAB 1: ORDER PAYMENT */}
                {drawerTab === "pay" && (
                  <div className="p-6 space-y-6">
                    {/* Total Payable Amount Banner */}
                    <div className="flex items-center justify-between border border-[#e7e5e4] rounded-xl p-4 bg-[#faf8f5]">
                      <div>
                        <span className="block text-xs font-semibold uppercase tracking-wider text-[#7a716b]">
                          Total payable amount
                        </span>
                        <span className="text-[11px] text-[#7a716b] font-sans">
                          Includes all applicable taxes
                        </span>
                      </div>
                      <span className="font-sans text-2xl font-bold text-[#141010] tracking-tight">
                        ₹{order.display_total_amount}
                      </span>
                    </div>

                    {/* Payment Type Selector */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a716b] mb-2.5">
                        Payment Type
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(
                          ["Cash", "UPI QR", "Card / POS", "Split"] as const
                        ).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPaymentTenderMode(mode)}
                            className={`py-2 text-xs font-semibold rounded-lg border text-center transition-colors cursor-pointer ${
                              paymentTenderMode === mode
                                ? "bg-[#0c0a09] text-white border-[#0c0a09] shadow-xs"
                                : "bg-white text-[#141010] border-[#e7e5e4] hover:bg-[#f4eee8]"
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Total Given Amount Input */}
                    <div className="space-y-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#7a716b] mb-2">
                          Total given amount
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-semibold text-[#7a716b]">
                            ₹
                          </span>
                          <input
                            className="w-full pl-8 pr-4 py-2.5 font-sans text-sm font-semibold text-[#141010] border border-[#e7e5e4] rounded-lg focus:border-black focus:ring-black focus:outline-none bg-white"
                            type="number"
                            step="any"
                            value={
                              tenderCashGiven || order.display_total_amount
                            }
                            onChange={(e) => setTenderCashGiven(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Quick Tender Shortcuts */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-[#7a716b]">
                            Quick Tender
                          </label>
                          <span className="text-[11px] text-[#7a716b]">
                            Round shortcuts
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {(() => {
                            const totalNum = parseFloat(
                              order.display_total_amount || "0",
                            );
                            const rounded1 = Math.ceil(totalNum);
                            const rounded2 = Math.ceil(totalNum / 10) * 10;
                            const rounded3 = Math.ceil(totalNum / 50) * 50;
                            const rounded4 =
                              Math.ceil(totalNum / 100) * 100 || 1000;
                            const shortcuts = Array.from(
                              new Set([rounded1, rounded2, rounded3, rounded4]),
                            );
                            while (shortcuts.length < 4) {
                              shortcuts.push(
                                (shortcuts[shortcuts.length - 1] || 100) + 100,
                              );
                            }
                            return shortcuts.slice(0, 4).map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() =>
                                  setTenderCashGiven(amt.toString())
                                }
                                className="py-2 text-xs font-medium font-sans bg-[#faf8f5] hover:bg-[#f4eee8] text-[#141010] border border-[#e7e5e4] rounded-md transition-colors text-center cursor-pointer"
                              >
                                ₹{amt.toLocaleString("en-IN")}
                              </button>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* Return Amount Banner */}
                      {(() => {
                        const givenNum = parseFloat(
                          tenderCashGiven || order.display_total_amount || "0",
                        );
                        const totalNum = parseFloat(
                          order.display_total_amount || "0",
                        );
                        const change = Math.max(0, givenNum - totalNum);
                        return (
                          <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                              Return amount
                            </span>
                            <span className="font-sans text-base font-bold text-emerald-700">
                              ₹{change.toFixed(2)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* TAB 2: ORDER TIMELINE */}
                {drawerTab === "timeline" && (
                  <div className="p-8">
                    {(() => {
                      const sequenceList = (() => {
                        if (dbProcesses && dbProcesses.length > 0) {
                          const seq = dbProcesses
                            .filter((p) => p.isSequence)
                            .sort((a, b) => a.position - b.position);
                          if (seq.length > 0) return seq;
                        }
                        return [
                          {
                            _id: "p1",
                            name: "Accepted",
                            position: 1,
                            processColor: "#262626",
                          },
                          {
                            _id: "p2",
                            name: "Preparing",
                            position: 2,
                            processColor: "#EA9C1B",
                          },
                          {
                            _id: "p3",
                            name: "Cooking",
                            position: 3,
                            processColor: "#EA9C1B",
                          },
                          {
                            _id: "p4",
                            name: "Plating",
                            position: 4,
                            processColor: "#EA9C1B",
                          },
                          {
                            _id: "p5",
                            name: "Ready to deliver",
                            position: 5,
                            processColor: "#FC8019",
                          },
                          {
                            _id: "p6",
                            name: "Delivered",
                            position: 6,
                            processColor: "#219653",
                          },
                        ];
                      })();

                      const currentStatusName = (
                        order.orderStatusName || "Accepted"
                      )
                        .trim()
                        .toLowerCase();
                      const currentIdx = sequenceList.findIndex(
                        (p) =>
                          p.name.trim().toLowerCase() === currentStatusName,
                      );
                      const activeIndex = currentIdx >= 0 ? currentIdx : 0;

                      return (
                        <div className="relative flex flex-col items-center">
                          {/* Main Background Vertical Connector Line */}
                          <div className="absolute top-0 bottom-3 w-1 bg-[#262626] rounded-full" />

                          {/* Green Progress Overlay Line */}
                          {activeIndex > 0 && (
                            <div
                              className="absolute top-0 w-1 bg-[#219653] rounded-full transition-all duration-500"
                              style={{
                                height: `${Math.min(100, (activeIndex / (sequenceList.length - 1)) * 100)}%`,
                              }}
                            />
                          )}

                          {/* Dynamic Sequence Steps matching PREST and defx-pos-frontend */}
                          <div className="space-y-12 w-full relative z-10">
                            {sequenceList.map((step, idx) => {
                              const isCompleted = idx <= activeIndex;

                              return (
                                <div
                                  key={step._id || idx}
                                  className="flex items-center justify-between w-full"
                                >
                                  {/* Left: Timestamp & Date for completed / active steps */}
                                  <div className="w-1/2 text-right pr-6">
                                    {isCompleted ? (
                                      <div>
                                        <span className="font-mono text-xs font-semibold text-[#141010] block">
                                          {formattedOrderTime}
                                        </span>
                                        <span className="text-[11px] text-[#7a716b] block">
                                          {formattedOrderDate}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="h-6" />
                                    )}
                                  </div>

                                  {/* Middle: Status Circle Node */}
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 border-white shadow-xs flex-shrink-0 transition-colors ${
                                      isCompleted
                                        ? "bg-[#219653] ring-2 ring-[#219653]/30"
                                        : "bg-[#262626]"
                                    }`}
                                  />

                                  {/* Right: Process Label */}
                                  <div className="w-1/2 pl-6">
                                    <span
                                      className={`text-sm block tracking-tight ${
                                        isCompleted
                                          ? "font-semibold text-[#141010]"
                                          : "font-medium text-[#262626]"
                                      }`}
                                    >
                                      {step.name}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* TAB 3: PAYMENT REFUND */}
                {drawerTab === "refund" && (
                  <div className="p-6 space-y-6 font-sans">
                    {/* Total Refund Amount Dual-Box Banner matching screenshot */}
                    <div className="flex border border-[#141010] rounded-md overflow-hidden bg-white shadow-2xs">
                      <div className="flex-1 py-3 px-4 text-sm font-semibold text-[#141010] flex items-center">
                        Total refund amount
                      </div>
                      <div className="bg-[#141010] text-white px-6 py-3 font-bold text-lg font-mono flex items-center justify-center tracking-tight">
                        ₹{order.display_total_amount || "0"}
                      </div>
                    </div>

                    {/* Payment Type Grid */}
                    <div>
                      <label className="block text-xs font-semibold text-[#141010] mb-2 font-sans">
                        Payment type
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(paymentModesList && paymentModesList.length > 0
                          ? paymentModesList
                          : [
                              { _id: "m1", name: "Cash" },
                              { _id: "m2", name: "Credit Card" },
                              { _id: "m3", name: "Debit Card" },
                              { _id: "m4", name: "UPI" },
                              { _id: "m5", name: "Pay later" },
                              { _id: "m6", name: "Wallet" },
                            ]
                        ).map((pm: any) => {
                          const isSelected =
                            (refundPaymentMode || "Cash")
                              .trim()
                              .toLowerCase() === pm.name.trim().toLowerCase();
                          return (
                            <button
                              key={pm._id || pm.name}
                              type="button"
                              onClick={() => setRefundPaymentMode(pm.name)}
                              className={`px-4 py-2 text-xs font-semibold rounded border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-[#141010] text-white border-[#141010] shadow-xs"
                                  : "bg-white text-[#141010] border-[#d6d3d1] hover:bg-[#f5f5f4]"
                              }`}
                            >
                              {pm.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Refund Amount Input with Currency Prefix */}
                    <div>
                      <label className="block text-xs font-semibold text-[#141010] mb-2 font-sans">
                        Refund Amount
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-semibold text-[#141010]">
                          ₹
                        </span>
                        <input
                          className="w-full pl-8 pr-4 py-2.5 font-sans text-sm font-semibold text-[#141010] border border-[#d6d3d1] rounded-md focus:border-[#141010] focus:ring-1 focus:ring-[#141010] focus:outline-none bg-white"
                          type="number"
                          step="any"
                          value={
                            refundAmountInput || order.display_total_amount
                          }
                          onChange={(e) => setRefundAmountInput(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Sticky Footer with Primary Action */}
              <div className="p-6 border-t border-[#e7e5e4] bg-[#fdf8f7] space-y-3">
                {drawerTab === "pay" && (
                  <button
                    type="button"
                    onClick={handleSettlePayment}
                    className="w-full py-3.5 bg-[#0c0a09] hover:bg-neutral-800 text-white font-sans font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Record Payment (₹{order.display_total_amount})</span>
                  </button>
                )}

                {drawerTab === "timeline" && (
                  <button
                    type="button"
                    onClick={() => setDrawerTab(null)}
                    className="w-full py-3 bg-[#0c0a09] hover:bg-neutral-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Close Timeline
                  </button>
                )}

                {drawerTab === "refund" && (
                  <button
                    type="button"
                    onClick={handleIssueRefund}
                    style={{ backgroundColor: "#1f7d43", color: "#ffffff" }}
                    className="w-full py-3.5 bg-[#1f7d43] hover:bg-[#186636] !text-white text-white font-sans font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 hover:opacity-95"
                  >
                    <RefundIcon className="w-4 h-4 !text-white text-white" />
                    <span className="!text-white text-white font-bold text-sm">
                      Submit Refund (₹
                      {refundAmountInput || order.display_total_amount})
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DELETE ORDER CONFIRMATION DIALOG (MATCHING PREST SCREENSHOT)              */}
        {/* ========================================================================= */}
        {isDeleteDialogOpen && (
          <div
            aria-labelledby="delete-dialog-title"
            aria-modal="true"
            className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 font-sans"
            role="dialog"
          >
            {/* Dark overlay backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
              onClick={() => !isDeletingOrder && setIsDeleteDialogOpen(false)}
            />

            {/* Modal Card matching screenshot */}
            <div className="relative bg-white rounded-lg max-w-md w-full p-6 shadow-2xl z-10 transform transition-all animate-scaleUp">
              <h3
                id="delete-dialog-title"
                className="text-lg font-bold text-[#141010] mb-2 font-sans"
              >
                Delete {order.orderNumber}?
              </h3>
              <p className="text-sm text-[#4b5563] mb-6 font-sans">
                Are you sure you want to delete this order?
              </p>

              {/* Action Buttons */}
              <div className="flex justify-end items-center gap-3">
                <button
                  type="button"
                  disabled={isDeletingOrder}
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#e5e7eb] hover:bg-[#d1d5db] text-[#374151] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingOrder}
                  onClick={handleConfirmDeleteOrder}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#ef4444] hover:bg-[#dc2626] text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isDeletingOrder ? "Deleting..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ========================================================================= */}
        {/* EDIT ORDER SLIDE-OVER DRAWER (PARITY WITH DEFX-POS-FRONTEND)             */}
        {/* ========================================================================= */}
        <EditOrderDrawer
          isOpen={isEditOrderOpen}
          onClose={() => setIsEditOrderOpen(false)}
          order={order}
          onSuccess={(msg) => showToast(msg)}
        />
    </PosShell>
  );
}
