"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  formatPriceWithSymbol,
  formatStoreDate,
  formatStoreTime,
  formatStoreDateTime,
  getCurrencyForCountry,
} from "../../../lib/constants/countries";
import { DateRange, ChevronRightIcon } from "./ReportHeader";
import { Toast, type ToastMessage } from "../Toast";
import { OrderDateRangePicker } from "../OrderDateRangePicker";
import { openReceiptPdfInNewTab } from "../../utils/generateReceiptPdf";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface OrdersReportViewProps {
  orders: any[];
  backendData?: any;
  loading?: boolean;
  currencySymbol?: string;
  countryCode?: string;
  timezone?: string;
  operationTiming?: any;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  activeOrg?: any;
}

export function OrdersReportView({
  orders = [],
  backendData,
  loading = false,
  currencySymbol: passedCurrencySymbol,
  countryCode = "IN",
  timezone = "Asia/Kolkata",
  operationTiming,
  selectedRange,
  onRangeChange,
  activeOrg,
}: OrdersReportViewProps) {
  const currencySymbol =
    passedCurrencySymbol ||
    activeOrg?.defaultCurrencySymbol ||
    getCurrencyForCountry(countryCode || "IN").symbol ||
    "₹";

  const effectiveCountry = activeOrg?.country || countryCode || "IN";
  const effectiveTimezone = activeOrg?.organizationTimeZone || timezone || "Asia/Kolkata";

  // Toast notifications
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string,
  ) => {
    setToast({ message, type, subtext });
  };

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected Order for Slide-over Drawer
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<any | null>(null);

  // 1. Dynamic Payment Modes from DB (Filtered to active/on modes only)
  const paymentModesFromDb = useQuery(
    api.paymentModes.list,
    activeOrg?._id ? { organizationId: activeOrg._id, activeOnly: true } : "skip"
  );

  // 2. Dynamic Order Processes from DB for Order Status options
  const orderProcessesFromDb = useQuery(
    api.organizationOrderProcesses.list,
    {}
  );

  // 3. Dynamic Staff / Captains from organizationUsers DB
  const organizationUsersFromDb = useQuery(
    api.organizationUsers.list,
    activeOrg?._id ? { organizationId: activeOrg._id } : "skip"
  );

  // 4. Query Taxation Engine (Store Settings, Tax Groups & Split Components)
  const storeTaxSettings = useQuery(
    api.taxation.getStoreTaxSettings,
    activeOrg?._id ? { organizationId: activeOrg._id } : "skip"
  );
  const taxGroups = useQuery(
    api.taxation.listTaxGroups,
    activeOrg?._id ? { organizationId: activeOrg._id } : "skip"
  );
  const taxComponents = useQuery(
    api.taxation.listTaxComponents,
    activeOrg?._id ? { organizationId: activeOrg._id } : "skip"
  );

  // Resolve default active tax group
  const defaultTaxGroup = useMemo(() => {
    if (!taxGroups || !Array.isArray(taxGroups) || taxGroups.length === 0) {
      return null;
    }
    if ((storeTaxSettings as any)?.defaultTaxGroupId) {
      const matched = taxGroups.find((g: any) => g._id === (storeTaxSettings as any).defaultTaxGroupId);
      if (matched) return matched;
    }
    return taxGroups.find((g: any) => g.isDefault) || taxGroups[0];
  }, [taxGroups, storeTaxSettings]);

  // Compute exclusive tax rate and dynamic tax label from organization settings
  const { exclusiveTaxRate, taxLabel, hasExclusiveTax } = useMemo(() => {
    if (!defaultTaxGroup) {
      return {
        exclusiveTaxRate: 0,
        taxLabel: "Tax",
        hasExclusiveTax: (storeTaxSettings as any)?.defaultTaxMode === "exclusive",
      };
    }

    const isExclusive = defaultTaxGroup.taxMode === "exclusive";
    let rate = 0;
    const compNames: string[] = [];

    if (taxComponents && Array.isArray(taxComponents)) {
      const compMap = new Map(taxComponents.map((c: any) => [c._id, c]));
      for (const compId of defaultTaxGroup.componentIds || []) {
        const comp = compMap.get(compId);
        if (comp) {
          if (isExclusive) {
            rate += comp.rate || 0;
          }
          if (comp.name) compNames.push(comp.name);
        }
      }
    }

    const label =
      defaultTaxGroup.name && !defaultTaxGroup.name.toLowerCase().includes("group")
        ? defaultTaxGroup.name
        : compNames.length > 0
          ? compNames.join(" + ")
          : "Tax";

    return {
      exclusiveTaxRate: rate,
      taxLabel: label,
      hasExclusiveTax: isExclusive,
    };
  }, [defaultTaxGroup, taxComponents, storeTaxSettings]);

  // Helper to resolve exclusive tax only (do NOT count inclusive tax)
  const getOrderExclusiveTax = (order: any): number => {
    if (!order) return 0;

    // 1. If taxInfoSnapshot exists:
    if (order.taxInfoSnapshot) {
      if (order.taxInfoSnapshot.tax_mode === "inclusive") {
        return 0;
      }
      if (order.taxInfoSnapshot.tax_mode === "exclusive") {
        const snapTax = parseFloat(order.taxInfoSnapshot.tax_amount || "0");
        if (!isNaN(snapTax) && snapTax > 0) {
          return Math.round(snapTax * 100);
        }
        return order.taxTotal || 0;
      }
    }

    // 2. Mathematical breakdown from order:
    // In checkout, totalAmount = subTotal + exclusiveTax - discount + delivery
    const subTotal = order.subTotal || 0;
    const totalAmount = order.totalAmount || 0;
    const discount = order.discountAmount || 0;
    const delivery = order.deliveryCharge || 0;

    if (totalAmount > 0 && subTotal > 0) {
      const derivedExclusive = totalAmount - subTotal + discount - delivery;
      if (derivedExclusive > 0) {
        return Math.round(derivedExclusive);
      }
      // If totalAmount <= subTotal, tax was inclusive or zero
      if (derivedExclusive <= 0 && (order.taxTotal || 0) > 0) {
        return 0;
      }
    }

    // 3. Fallback based on store taxation settings:
    if (
      defaultTaxGroup?.taxMode === "inclusive" ||
      (storeTaxSettings as any)?.defaultTaxMode === "inclusive" ||
      activeOrg?.inclusiveGst === true
    ) {
      return 0;
    }

    if (
      defaultTaxGroup?.taxMode === "exclusive" ||
      (storeTaxSettings as any)?.defaultTaxMode === "exclusive"
    ) {
      return order.taxTotal || 0;
    }

    return 0;
  };

  // Dynamic Channels based on activeOrg feature toggles (isDineIn, isTakeAway, isDelivery)
  const availableChannels = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    if (activeOrg?.isDineIn !== false) {
      list.push({ key: "dine", label: "Dine-In" });
    }
    if (activeOrg?.isTakeAway !== false) {
      list.push({ key: "takeaway", label: "Takeaway" });
    }
    if (Boolean(activeOrg?.isDelivery)) {
      list.push({ key: "delivery", label: "Delivery" });
    }
    return list;
  }, [activeOrg?.isDineIn, activeOrg?.isTakeAway, activeOrg?.isDelivery]);

  // Dynamic active payment modes
  const availablePaymentModes = useMemo(() => {
    if (paymentModesFromDb && Array.isArray(paymentModesFromDb)) {
      return paymentModesFromDb
        .filter((m: any) => m.active !== false && !m.deletedAt)
        .map((m: any) => m.name.trim());
    }
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.payments && Array.isArray(o.payments)) {
        o.payments.forEach((p: any) => {
          if (p.paymentModeName) set.add(p.paymentModeName.trim());
        });
      }
      if (o.paymentMode && typeof o.paymentMode === "string") {
        set.add(o.paymentMode.trim());
      }
    });
    return Array.from(set);
  }, [paymentModesFromDb, orders]);

  // Dynamic Order Processes for Status dropdown
  const availableOrderStatuses = useMemo(() => {
    if (orderProcessesFromDb && Array.isArray(orderProcessesFromDb)) {
      return orderProcessesFromDb
        .filter((proc: any) => !proc.deletedAt && proc.published !== false)
        .map((proc: any) => ({
          id: String(proc._id),
          name: proc.name,
        }));
    }
    const set = new Set<string>();
    orders.forEach((o) => {
      const s = o.orderStatusName || o.orderStatus || o.status;
      if (s && typeof s === "string" && s.trim()) set.add(s.trim());
    });
    return Array.from(set).map((name) => ({ id: name, name }));
  }, [orderProcessesFromDb, orders]);

  // Dynamic Staff / Captains from organization users
  const availableStaff = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    if (organizationUsersFromDb && Array.isArray(organizationUsersFromDb)) {
      organizationUsersFromDb
        .filter((u: any) => !u.deletedAt && u.status !== "inactive" && u.status !== "suspended")
        .forEach((u: any) => {
          const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.phone || u.email || "Staff";
          if (!seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            list.push({ id: u.userId || u._id, name });
          }
        });
    }

    orders.forEach((o) => {
      const name = (o.waiter?.name || o.waiterName || o.cashierName || "").trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push({ id: name, name });
      }
    });

    return list;
  }, [organizationUsersFromDb, orders]);

  // Order formatting helpers
  const getOrderChannel = (order: any): string => {
    const type = (order.orderType || "").toLowerCase();
    if (type.includes("dine")) return "Dine-In";
    if (type.includes("take") || type.includes("pickup")) return "Takeaway";
    if (type.includes("delivery")) return "Delivery";
    return order.orderType || "Dine-In";
  };

  const getOrderPaymentMode = (order: any): string => {
    if (!order) return "Pending";
    const { isPaid, isCancelled } = getOrderPaymentStatus(order);
    if (isCancelled) return "Cancelled";
    if (!isPaid) return "Pending";

    if (order.payments && Array.isArray(order.payments) && order.payments.length > 0) {
      const valid = order.payments.find((p: any) => p.paymentModeName);
      if (valid) return valid.paymentModeName;
    }
    if (order.paymentMode) return order.paymentMode;
    return "Cash";
  };

  // Cashier Payment Channel Icons (Matching exact SVGs from Cashier Screen)
  const renderPaymentModeIcon = (modeName: string, className = "w-3.5 h-3.5 shrink-0") => {
    const lower = (modeName || "").toLowerCase();

    // Cancelled / Void
    if (lower.includes("cancel") || lower.includes("void")) {
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      );
    }

    // Pending / Unpaid
    if (lower.includes("pending") || lower.includes("unpaid")) {
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    }

    // 1. UPI / QR / GPay / PhonePe / Paytm -> Exact Cashier QR Code Icon
    if (
      lower.includes("upi") ||
      lower.includes("qr") ||
      lower.includes("gpay") ||
      lower.includes("phonepe") ||
      lower.includes("paytm")
    ) {
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      );
    }

    // 2. Debit Card -> Exact Cashier Debit Card Divided Grid Icon
    if (lower.includes("debit")) {
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      );
    }

    // 3. Credit Card -> Exact Cashier Credit Card Magnetic Strip + Chip Icon
    if (lower.includes("credit") || lower.includes("card")) {
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      );
    }

    // 4. Split Payment -> Exact Cashier Opposing Arrows Icon
    if (lower.includes("split")) {
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      );
    }

    // 5. Cash / Default -> Exact Cashier Cash Register Drawer Icon
    return (
      <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  };

  const getOrderStatusInfo = (order: any) => {
    if (!order) return { name: "-", color: "#78716c", isAssigned: false };

    // Find in order processes
    const matchedProcess = orderProcessesFromDb?.find(
      (p: any) =>
        p._id === order.orderStatusId ||
        p.name?.trim().toLowerCase() === (order.orderStatusName || "").trim().toLowerCase()
    );

    const name =
      order.orderStatusName ||
      matchedProcess?.name ||
      order.orderStatus ||
      order.status ||
      (order.isRejected
        ? "Cancelled"
        : order.isCompleted
          ? "Completed"
          : "Accepted");

    const lower = name.toLowerCase();
    const dotColor =
      matchedProcess?.processColor ||
      (lower.includes("cancel") || order.isRejected
        ? "#e11d48"
        : lower.includes("complete") || order.isCompleted
          ? "#219653"
          : "#262626");

    return { name, color: dotColor, isAssigned: true };
  };

  const getOrderStatus = (order: any): string => {
    return getOrderStatusInfo(order).name;
  };

  const getOrderPaymentStatus = (order: any) => {
    if (!order) {
      return { isPaid: false, isPending: true, isCancelled: false, label: "Pending" };
    }

    const isCancelled =
      order.orderStatus === "Cancelled" ||
      order.status === "Cancelled" ||
      (order.orderStatusName || "").toLowerCase().includes("cancel") ||
      Boolean(order.isRejected);

    if (isCancelled) {
      return { isPaid: false, isPending: false, isCancelled: true, label: "Cancelled" };
    }

    const isPaid =
      order.paymentStatus === "Paid" ||
      order.isPaid === true ||
      (Array.isArray(order.payments) &&
        order.payments.length > 0 &&
        order.payments.some(
          (p: any) => p.status === "Success" || p.status === "Paid" || Boolean(p.paymentModeName)
        ));

    if (isPaid) {
      return { isPaid: true, isPending: false, isCancelled: false, label: "Paid" };
    }

    return { isPaid: false, isPending: true, isCancelled: false, label: "Pending" };
  };

  const getOrderTable = (order: any): string => {
    if (!order) return "-";
    const rawTable =
      order.tableName ||
      order.tableNumber ||
      order.table?.number ||
      order.table?.name;
    if (!rawTable) return "-";
    const str = String(rawTable).trim();
    if (
      !str ||
      str.toLowerCase() === "counter" ||
      str.toLowerCase() === "none" ||
      str === "-"
    ) {
      return "-";
    }
    return str.toLowerCase().startsWith("table") ? str : `Table ${str}`;
  };

  const getOrderStaff = (order: any): string => {
    if (!order) return "-";
    const name = (
      order.waiter?.name ||
      order.waiterName ||
      order.cashierName ||
      ""
    ).trim();
    if (!name || name.toLowerCase() === "floor staff") return "-";
    return name;
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Channel Filter (Dynamic)
      if (channelFilter !== "all") {
        const ch = getOrderChannel(order).toLowerCase();
        if (channelFilter === "dine" && !ch.includes("dine")) return false;
        if (channelFilter === "takeaway" && !ch.includes("take")) return false;
        if (channelFilter === "delivery" && !ch.includes("delivery")) return false;
      }

      // Payment Mode Filter (Dynamic)
      if (paymentModeFilter !== "all") {
        const pm = getOrderPaymentMode(order).toLowerCase();
        const filterLower = paymentModeFilter.toLowerCase().trim();
        const hasMatchingMode = pm.includes(filterLower) || filterLower.includes(pm);
        const hasMatchingInPayments =
          Array.isArray(order.payments) &&
          order.payments.some((p: any) => {
            const pName = (p.paymentModeName || p.name || "").toLowerCase().trim();
            return pName.includes(filterLower) || filterLower.includes(pName);
          });
        if (!hasMatchingMode && !hasMatchingInPayments) return false;
      }

      // Order Status Filter (Dynamic from Order Processes)
      if (orderStatusFilter !== "all") {
        const filterLower = orderStatusFilter.toLowerCase().trim();
        const st = getOrderStatus(order).toLowerCase().trim();
        const rawStatus = (order.orderStatusName || order.orderStatus || order.status || "").toLowerCase().trim();
        const rawId = order.orderStatusId ? String(order.orderStatusId) : "";
        const matches =
          st.includes(filterLower) ||
          filterLower.includes(st) ||
          rawStatus.includes(filterLower) ||
          filterLower.includes(rawStatus) ||
          rawId === orderStatusFilter;
        if (!matches) return false;
      }

      // Staff / Captain Filter (Dynamic from Organization Users)
      if (staffFilter !== "all") {
        const filterLower = staffFilter.toLowerCase().trim();
        const staff = getOrderStaff(order).toLowerCase().trim();
        const waiterId = (order.waiterUserId || "").toLowerCase().trim();
        const cashierId = (order.cashierUserId || "").toLowerCase().trim();
        const matches =
          staff.includes(filterLower) ||
          filterLower.includes(staff) ||
          waiterId === filterLower ||
          cashierId === filterLower;
        if (!matches) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (order.orderNumber || "").toLowerCase();
        const token = (order.tokenNumber || "").toLowerCase();
        const tbl = getOrderTable(order).toLowerCase();
        const custName = (order.customerName || "").toLowerCase();
        const custPhone = (order.customerPhone || "").toLowerCase();
        const items = Array.isArray(order.items)
          ? order.items.map((i: any) => (i.itemName || "").toLowerCase()).join(" ")
          : "";

        const matches =
          num.includes(q) ||
          token.includes(q) ||
          tbl.includes(q) ||
          custName.includes(q) ||
          custPhone.includes(q) ||
          items.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    orders,
    channelFilter,
    paymentModeFilter,
    orderStatusFilter,
    staffFilter,
    searchQuery,
  ]);

  // Aggregate Metrics (Only realized revenue from PAID orders is counted; cancelled and pending payments are strictly excluded from revenue)
  const metrics = useMemo(() => {
    let totalGrossPaise = 0;
    let totalExclusiveTaxPaise = 0;
    let totalNetPaise = 0;
    let dineInCount = 0;
    let takeawayCount = 0;
    let deliveryCount = 0;
    let paidOrdersCount = 0;
    let pendingPaymentCount = 0;
    let cancelledCount = 0;

    filteredOrders.forEach((o) => {
      const { isPaid, isPending, isCancelled } = getOrderPaymentStatus(o);

      if (isCancelled) {
        cancelledCount++;
      } else if (isPending) {
        pendingPaymentCount++;
      } else {
        paidOrdersCount++;
      }

      // ONLY count realized revenue from paid, non-cancelled orders!
      if (isPaid) {
        const gross = o.subTotal || o.totalGrossSales || o.grossAmount || 0;
        const exclusiveTax = getOrderExclusiveTax(o);
        const net = o.totalAmount || o.netAmount || gross + exclusiveTax;

        totalGrossPaise += gross;
        totalExclusiveTaxPaise += exclusiveTax;
        totalNetPaise += net;
      }

      const ch = getOrderChannel(o);
      if (ch === "Dine-In") dineInCount++;
      else if (ch === "Takeaway") takeawayCount++;
      else if (ch === "Delivery") deliveryCount++;
    });

    const totalOrders = filteredOrders.length;
    const aovPaise = paidOrdersCount > 0 ? Math.round(totalGrossPaise / paidOrdersCount) : 0;

    return {
      totalOrders,
      dineInCount,
      takeawayCount,
      deliveryCount,
      completedOrdersCount: paidOrdersCount,
      pendingPaymentCount,
      cancelledCount,
      grossRevenuePaise: totalGrossPaise,
      totalExclusiveTaxPaise,
      netRevenuePaise: totalNetPaise,
      aovPaise,
    };
  }, [filteredOrders, defaultTaxGroup, storeTaxSettings, activeOrg]);

  // Paginated Orders for Table
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSearchQuery("");
    setChannelFilter("all");
    setPaymentModeFilter("all");
    setOrderStatusFilter("all");
    setStaffFilter("all");
    setCurrentPage(1);
    showToast("Filters reset to default view", "info");
  };

  // CSV Export Handler
  const handleExportCsv = () => {
    if (filteredOrders.length === 0) {
      showToast("No order records to export", "warning");
      return;
    }

    const headers = [
      "Order Number",
      "Token Number",
      "Date Time",
      "Channel",
      "Table / Station",
      "Captain",
      "Payment Mode",
      "Status",
      "Gross",
      `Tax (${taxLabel} Exclusive)`,
      "Net Amount",
    ];

    const rows = filteredOrders.map((o) => {
      const gross = ((o.subTotal || 0) / 100).toFixed(2);
      const exclusiveTax = (getOrderExclusiveTax(o) / 100).toFixed(2);
      const net = ((o.totalAmount || 0) / 100).toFixed(2);
      const dateStr = formatStoreDateTime(o.createdAt, timezone) || "";

      return [
        `"${o.orderNumber || ""}"`,
        `"${o.tokenNumber || ""}"`,
        `"${dateStr}"`,
        `"${getOrderChannel(o)}"`,
        `"${getOrderTable(o)}"`,
        `"${getOrderStaff(o)}"`,
        `"${getOrderPaymentMode(o)}"`,
        `"${getOrderStatus(o)}"`,
        gross,
        exclusiveTax,
        net,
      ].join(",");
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `orders_report_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Orders report CSV exported successfully", "success");
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* EDITORIAL PAGE HEADER */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6">
        <div className="flex flex-col max-w-2xl space-y-1">
          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center text-[13px] text-[#5e5e5e] mb-2 gap-2 font-sans font-medium"
          >
            <Link
              href="/reports"
              className="hover:text-[#141010] transition-colors cursor-pointer"
            >
              Reports
            </Link>
            <ChevronRightIcon className="w-3.5 h-3.5 text-[#928c8a]" />
            <span className="text-[#141010] font-semibold">
              Order Report
            </span>
          </nav>
          {/* Title */}
          <h1
            className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Order Report
          </h1>
          <p className="text-[#5e5e5e] text-[14px] mt-1 font-normal leading-relaxed">
            View individual orders, payment details, and order-level sales ledger.
          </p>
        </div>

        {/* Right Controls: Global Range Selector, Print Statement, and CSV Export */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 self-start lg:self-end shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 px-3.5 sm:px-4 bg-white text-[#0c0a09] rounded-lg shadow-2xs border border-[#e7e5e4] flex items-center gap-1.5 hover:bg-[#f1edec] transition-all text-xs font-medium cursor-pointer"
            title="Print Order Statement"
          >
            <span className="material-symbols-outlined text-[17px] text-[#0c0a09]">
              print
            </span>
            <span>Print</span>
          </button>

          <button
            onClick={handleExportCsv}
            type="button"
            className="h-10 px-4 bg-white text-[#0c0a09] rounded-lg shadow-2xs border border-[#e7e5e4] flex items-center gap-2 hover:bg-[#f1edec] transition-all text-xs font-medium cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-[#0c0a09]">
              file_download
            </span>
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      {/* 4 SUMMARY METRIC CARDS ROW (Customer Style with QR Numbers - Total Discount Removed) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-sans">
        {/* Card 1: Total Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Total Orders
            </span>
            <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] shrink-0 border border-[#e7e5e4]">
              <span className="material-symbols-outlined text-[16px]">
                receipt_long
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {metrics.totalOrders}
                  </span>
                  <span className="text-xs text-[#5e5e5e] font-sans">
                    {metrics.totalOrders === 1 ? "Order" : "Orders"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  {metrics.dineInCount} Dine-In • {metrics.takeawayCount} Takeaway
                  {metrics.deliveryCount > 0 ? ` • ${metrics.deliveryCount} Delivery` : ""}
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="truncate">
              {metrics.completedOrdersCount} paid
              {metrics.pendingPaymentCount > 0 ? ` • ${metrics.pendingPaymentCount} pending` : ""}
              {metrics.cancelledCount > 0 ? ` • ${metrics.cancelledCount} cancelled` : ""}
            </span>
          </div>
        </div>

        {/* Card 2: Gross Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Gross Revenue
            </span>
            <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] shrink-0 border border-[#e7e5e4]">
              <span className="material-symbols-outlined text-[16px]">
                payments
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight tabular-nums truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {formatPriceWithSymbol(
                      metrics.grossRevenuePaise,
                      currencySymbol,
                      countryCode,
                      true,
                    )}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Sum of item pre-tax totals
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#78716c] shrink-0"></span>
            <span className="truncate">
              Avg Check:{" "}
              {formatPriceWithSymbol(
                metrics.aovPaise,
                currencySymbol,
                countryCode,
                true,
              )}
            </span>
          </div>
        </div>

        {/* Card 3: Total Tax (Exclusive Only from Organization Settings) */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Total {taxLabel}
            </span>
            <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] shrink-0 border border-[#e7e5e4]">
              <span className="material-symbols-outlined text-[16px]">
                account_balance
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight tabular-nums truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {formatPriceWithSymbol(
                      metrics.totalExclusiveTaxPaise,
                      currencySymbol,
                      countryCode,
                      true,
                    )}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  {hasExclusiveTax && exclusiveTaxRate > 0
                    ? `${exclusiveTaxRate}% exclusive tax rate`
                    : "Exclusive tax collections"}
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="truncate">Exclusive Tax (Store Settings)</span>
          </div>
        </div>

        {/* Card 4: Net Revenue (Highlight Card) */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
              Net Revenue
            </span>
            <span className="w-7 h-7 rounded-full bg-[#0c0a09] flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[16px]">
                verified
              </span>
            </span>
          </div>
          <div>
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-[#f1edec] rounded w-1/2"></div>
                <div className="h-4 bg-[#f1edec] rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight tabular-nums truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {formatPriceWithSymbol(
                      metrics.netRevenuePaise,
                      currencySymbol,
                      countryCode,
                      true,
                    )}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Final settled transaction volume
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0c0a09] shrink-0"></span>
            <span className="truncate">Gross + Exclusive Tax</span>
          </div>
        </div>
      </section>

      {/* GLOBAL FILTERS PANEL (Customer Style) */}
      <section className="bg-white rounded-xl p-4 sm:p-5 shadow-xs border border-[#e7e5e4] space-y-4 font-sans">
        {/* Row 1: Select Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] 2xl:grid-cols-5 gap-3">
          {/* 1. Date Period (Single Calendar with Filter, Matching Customer Report Style) */}
          <div className="space-y-1.5 min-w-0">
            <label className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold whitespace-nowrap">
              Date Period
            </label>
            {selectedRange && onRangeChange ? (
              <OrderDateRangePicker
                startDate={selectedRange.startDate}
                endDate={selectedRange.endDate}
                preset={selectedRange.preset}
                onChange={(newRange) => {
                  onRangeChange(newRange);
                  setCurrentPage(1);
                }}
                countryCode={effectiveCountry}
                timezone={effectiveTimezone}
                align="left"
                className="w-full whitespace-nowrap [&>button]:w-full [&>button]:justify-between [&>button]:bg-[#fdf8f7] [&>button]:hover:bg-white [&>button]:py-2 [&>button]:px-2.5 [&>button]:border-[#e7e5e4] [&>button]:h-[38px] [&>button]:shadow-none"
              />
            ) : null}
          </div>

          {/* 2. Channel Picker (Dynamically from activeOrg features: isDineIn, isTakeAway, isDelivery) */}
          <div className="space-y-1.5">
            <label className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
              Channel
            </label>
            <div className="relative">
              <select
                value={channelFilter}
                onChange={(e) => {
                  setChannelFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full appearance-none bg-[#fdf8f7] text-[#0c0a09] text-xs font-medium px-3.5 py-2.5 rounded-lg border border-[#e7e5e4] focus:outline-none focus:bg-white focus:border-[#0c0a09] transition-all cursor-pointer pr-8 h-[38px]"
              >
                <option value="all">All Channels</option>
                {availableChannels.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#5e5e5e] pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* 3. Payment Mode Picker (Dynamically from active payment modes) */}
          <div className="space-y-1.5">
            <label className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
              Payment Mode
            </label>
            <div className="relative">
              <select
                value={paymentModeFilter}
                onChange={(e) => {
                  setPaymentModeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full appearance-none bg-[#fdf8f7] text-[#0c0a09] text-xs font-medium px-3.5 py-2.5 rounded-lg border border-[#e7e5e4] focus:outline-none focus:bg-white focus:border-[#0c0a09] transition-all cursor-pointer pr-8 h-[38px]"
              >
                <option value="all">All Modes</option>
                {availablePaymentModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#5e5e5e] pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* 4. Order Status Picker (Dynamically from order processes) */}
          <div className="space-y-1.5">
            <label className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
              Order Status
            </label>
            <div className="relative">
              <select
                value={orderStatusFilter}
                onChange={(e) => {
                  setOrderStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full appearance-none bg-[#fdf8f7] text-[#0c0a09] text-xs font-medium px-3.5 py-2.5 rounded-lg border border-[#e7e5e4] focus:outline-none focus:bg-white focus:border-[#0c0a09] transition-all cursor-pointer pr-8 h-[38px]"
              >
                <option value="all">All Statuses</option>
                {availableOrderStatuses.map((st) => (
                  <option key={st.id} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#5e5e5e] pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* 5. Staff / Captain Picker (Dynamically from organization users) */}
          <div className="space-y-1.5">
            <label className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
              Staff / Captain
            </label>
            <div className="relative">
              <select
                value={staffFilter}
                onChange={(e) => {
                  setStaffFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full appearance-none bg-[#fdf8f7] text-[#0c0a09] text-xs font-medium px-3.5 py-2.5 rounded-lg border border-[#e7e5e4] focus:outline-none focus:bg-white focus:border-[#0c0a09] transition-all cursor-pointer pr-8 h-[38px]"
              >
                <option value="all">All Staff</option>
                {availableStaff.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#5e5e5e] pointer-events-none">
                expand_more
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Search, Quick Actions, Status Pill */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
          {/* Search Field */}
          <div className="relative flex-1 max-w-xl">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#5e5e5e]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Order #, Token, Table, Customer..."
              className="w-full pl-10 pr-4 py-2 bg-[#fdf8f7] text-[#0c0a09] rounded-lg text-xs placeholder:text-[#5e5e5e] focus:outline-none focus:bg-white focus:border-[#0c0a09] transition-all border border-[#e7e5e4]"
            />
          </div>

          {/* Actions & Feedback Pill */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4] text-xs font-medium transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
            <span className="px-3 py-1.5 rounded-lg bg-[#fdf8f7] border border-[#e7e5e4] text-[#5e5e5e] text-xs font-medium">
              Showing {filteredOrders.length} matching orders • {selectedRange?.preset || "Filtered"}
            </span>
          </div>
        </div>
      </section>

      {/* INDIVIDUAL ORDERS LEDGER TABLE (Customer Report Style) */}
      <section className="bg-white rounded-xl shadow-xs border border-[#e7e5e4] overflow-hidden flex flex-col font-sans">
        {/* Table Header Info Bar (Shift Current and sync pulse removed) */}
        <div className="px-5 py-3.5 bg-[#fdf8f7] flex items-center justify-between gap-2 border-b border-[#e7e5e4]">
          <span className="text-sm font-semibold text-[#0c0a09]">
            Transaction Journal
          </span>
        </div>

        {/* Table Canvas Scroll */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="border-b border-[#e7e5e4] bg-[#fdf8f7] text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[130px]">Order #</th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap min-w-[140px]">Date &amp; Time</th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap min-w-[100px]">Channel</th>
                <th className="py-3 px-3.5 font-semibold min-w-[190px]">Items Summary</th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap min-w-[125px]">Payment Mode</th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap min-w-[115px]">Status</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[85px]">Gross</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[85px]">{taxLabel.toUpperCase()}</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap min-w-[95px]">Net</th>
                <th className="py-3 px-4 font-semibold text-center whitespace-nowrap min-w-[100px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e8e2] text-xs">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={10} className="py-3 px-4">
                      <div className="animate-pulse space-y-2">
                        <div className="h-3.5 bg-[#f1edec] rounded w-1/4"></div>
                        <div className="h-3 bg-[#f1edec] rounded w-1/6"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-[#7f7570]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="material-symbols-outlined text-[44px] text-[#b4a9a4]">
                        receipt_long
                      </span>
                      <p className="font-semibold text-sm text-[#0c0a09]">
                        No Orders Found
                      </p>
                      <p className="text-xs text-[#5e5e5e] max-w-sm">
                        No transactions matched the selected date period and filtration criteria.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order: any) => {
                  const gross = order.subTotal || order.grossAmount || 0;
                  const exclusiveTax = getOrderExclusiveTax(order);
                  const net = order.totalAmount || order.netAmount || gross + exclusiveTax;

                  const channel = getOrderChannel(order);
                  const paymentMode = getOrderPaymentMode(order);
                  const status = getOrderStatus(order);
                  const tableLabel = getOrderTable(order);

                  // Items Summary preview string
                  const itemsList = Array.isArray(order.items) ? order.items : [];
                  const itemCount = itemsList.length;
                  const itemsPreview = itemsList
                    .slice(0, 3)
                    .map((it: any) => `${it.quantity || 1}x ${it.itemName || it.name}`)
                    .join(", ");

                  return (
                    <tr
                      key={order._id || order.id || order.orderNumber}
                      className="hover:bg-[#fdf8f7] transition-colors group"
                    >
                      {/* Order # */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-xs text-[#0c0a09]">
                          #{order.orderNumber || order.tokenNumber || "ORD"}
                        </div>
                        {tableLabel && tableLabel !== "-" && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-[#f1edec] text-[#5e5e5e] text-[11px] font-medium border border-[#e7e5e4]">
                            {tableLabel}
                          </span>
                        )}
                      </td>

                      {/* Date & Time (Matching filter date style) */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="text-xs font-medium text-[#0c0a09]">
                          {formatStoreDate(order.createdAt, effectiveCountry, effectiveTimezone) || "-"}
                        </div>
                        <div className="text-[11px] text-[#5e5e5e]">
                          {formatStoreTime(order.createdAt, effectiveTimezone, effectiveCountry) || ""}
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#f1edec] text-[#0c0a09] border border-[#e7e5e4] text-xs font-medium">
                          {channel}
                        </span>
                      </td>

                      {/* Items Summary */}
                      <td className="py-3 px-3.5 min-w-[190px] max-w-xs">
                        <span className="font-medium text-xs text-[#0c0a09] block">
                          {itemCount} {itemCount === 1 ? "item" : "items"}
                        </span>
                        {itemsPreview && (
                          <span className="text-[11px] text-[#5e5e5e] block truncate mt-0.5">
                            ({itemsPreview}
                            {itemCount > 3 ? "..." : ""})
                          </span>
                        )}
                      </td>

                      {/* Payment Mode */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {(() => {
                          const paymentStatusObj = getOrderPaymentStatus(order);
                          if (paymentStatusObj.isCancelled) {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0"></span>
                                <span>Cancelled</span>
                              </span>
                            );
                          }
                          if (paymentStatusObj.isPending) {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                                <span>Pending</span>
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1.5 text-[#0c0a09] text-xs font-medium">
                              <span className="text-[#5e5e5e]">
                                {renderPaymentModeIcon(paymentMode, "w-3.5 h-3.5 shrink-0")}
                              </span>
                              <span>{paymentMode}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Status (Matching actual orders screen table exactly) */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {(() => {
                          const statusInfo = getOrderStatusInfo(order);
                          return (
                            <span className="inline-flex items-center gap-1.5 font-medium text-xs text-[#0c0a09]">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  statusInfo.name === "In progress"
                                    ? "animate-pulse"
                                    : ""
                                }`}
                                style={{ backgroundColor: statusInfo.color }}
                              />
                              <span>{statusInfo.name}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Gross */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-right tabular-nums text-xs">
                        {(() => {
                          const { isPaid, isPending, isCancelled } = getOrderPaymentStatus(order);
                          if (isCancelled) {
                            return (
                              <span className="line-through text-[#a8a29e]">
                                {formatPriceWithSymbol(0, currencySymbol, effectiveCountry, true)}
                              </span>
                            );
                          }
                          if (isPending) {
                            return (
                              <div>
                                <span className="text-[#78716c] font-medium">
                                  {formatPriceWithSymbol(gross, currencySymbol, effectiveCountry, true)}
                                </span>
                                <span className="block text-[10px] text-amber-600 font-medium">
                                  Unpaid
                                </span>
                              </div>
                            );
                          }
                          return (
                            <span className="text-[#0c0a09] font-medium">
                              {formatPriceWithSymbol(gross, currencySymbol, effectiveCountry, true)}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Tax (Exclusive Only from Settings) */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-right tabular-nums text-xs">
                        {(() => {
                          const { isCancelled } = getOrderPaymentStatus(order);
                          if (isCancelled) {
                            return (
                              <span className="text-[#a8a29e]">
                                {formatPriceWithSymbol(0, currencySymbol, effectiveCountry, true)}
                              </span>
                            );
                          }
                          return (
                            <span className="text-[#5e5e5e] font-medium">
                              {formatPriceWithSymbol(exclusiveTax, currencySymbol, effectiveCountry, true)}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Net */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-right tabular-nums text-xs font-semibold">
                        {(() => {
                          const { isPaid, isPending, isCancelled } = getOrderPaymentStatus(order);
                          if (isCancelled) {
                            return (
                              <span className="line-through text-[#a8a29e]">
                                {formatPriceWithSymbol(0, currencySymbol, effectiveCountry, true)}
                              </span>
                            );
                          }
                          if (isPending) {
                            return (
                              <div>
                                <span className="text-amber-700">
                                  {formatPriceWithSymbol(net, currencySymbol, effectiveCountry, true)}
                                </span>
                                <span className="block text-[10px] text-amber-600 font-medium">
                                  Pending
                                </span>
                              </div>
                            );
                          }
                          return (
                            <span className="text-[#0c0a09]">
                              {formatPriceWithSymbol(net, currencySymbol, effectiveCountry, true)}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForDrawer(order)}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-[#0c0a09] text-white hover:bg-[#262626] transition-colors cursor-pointer shadow-2xs"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {filteredOrders.length > 0 && (
          <div className="px-5 py-3.5 bg-[#fdf8f7] border-t border-[#e7e5e4] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5e5e5e]">
            <div>
              Showing{" "}
              <strong className="text-[#0c0a09] font-semibold">
                {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredOrders.length)}
              </strong>{" "}
              of{" "}
              <strong className="text-[#0c0a09] font-semibold">
                {filteredOrders.length}
              </strong>{" "}
              orders
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-end">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-[#e7e5e4] bg-white hover:bg-[#f1edec] text-[#0c0a09] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                    currentPage === i + 1
                      ? "bg-[#0c0a09] text-white shadow-2xs"
                      : "bg-white border border-[#e7e5e4] text-[#0c0a09] hover:bg-[#f1edec]"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-[#e7e5e4] bg-white hover:bg-[#f1edec] text-[#0c0a09] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* INTERACTIVE ORDER DETAILS DRAWER SLIDE-OVER (Customer Style) */}
      {selectedOrderForDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden font-sans">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedOrderForDrawer(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <div className="w-screen max-w-full sm:max-w-xl bg-white shadow-2xl flex flex-col border-l border-[#e7e5e4]">
              {/* Drawer Header */}
              <div className="p-5 sm:p-6 bg-[#fdf8f7] border-b border-[#e7e5e4] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2
                      className="font-garamond text-2xl font-normal text-[#141010]"
                      style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                    >
                      Order Details — #{selectedOrderForDrawer.orderNumber || selectedOrderForDrawer.tokenNumber || "ORD"}
                    </h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
                      style={(() => {
                        const st = getOrderStatusInfo(selectedOrderForDrawer);
                        return {
                          backgroundColor: st.isAssigned ? `${st.color}15` : "#f1edec",
                          borderColor: st.isAssigned ? `${st.color}35` : "#e7e5e4",
                          color: st.isAssigned ? st.color : "#0c0a09",
                        };
                      })()}
                    >
                      {getOrderStatusInfo(selectedOrderForDrawer).name}
                    </span>
                  </div>
                  <p className="text-xs text-[#5e5e5e] mt-0.5">
                    Audited hospitality check &amp; tax reconciliation summary
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrderForDrawer(null)}
                  type="button"
                  className="w-8 h-8 rounded-full bg-[#f1edec] hover:bg-[#e7e5e4] flex items-center justify-center text-[#0c0a09] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Drawer Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                {/* Metadata Grid (2x2) */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4]">
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-[#5e5e5e] uppercase tracking-wider block font-semibold mb-0.5">
                      Timestamp
                    </span>
                    <span className="text-xs text-[#0c0a09] font-medium">
                      {formatStoreDate(selectedOrderForDrawer.createdAt, effectiveCountry, effectiveTimezone)}
                      {selectedOrderForDrawer.createdAt ? `, ${formatStoreTime(selectedOrderForDrawer.createdAt, effectiveTimezone, effectiveCountry)}` : " -"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-[#5e5e5e] uppercase tracking-wider block font-semibold mb-0.5">
                      Station / Table
                    </span>
                    <span className="text-xs text-[#0c0a09] font-medium">
                      {getOrderTable(selectedOrderForDrawer)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-[#5e5e5e] uppercase tracking-wider block font-semibold mb-0.5">
                      Service Captain
                    </span>
                    <span className="text-xs text-[#0c0a09] font-medium">
                      {getOrderStaff(selectedOrderForDrawer)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-[#5e5e5e] uppercase tracking-wider block font-semibold mb-0.5">
                      Lifecycle Status
                    </span>
                    {(() => {
                      const st = getOrderStatusInfo(selectedOrderForDrawer);
                      if (!st.isAssigned || st.name === "-") {
                        return <span className="text-xs text-[#0c0a09] font-medium">-</span>;
                      }
                      return (
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#0c0a09] font-medium">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              st.name.toLowerCase() === "in progress" ? "animate-pulse" : ""
                            }`}
                            style={{ backgroundColor: st.color }}
                          />
                          <span>{st.name}</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Itemized Ledger */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                      Ordered Items &amp; Notes
                    </span>
                    <span className="text-xs text-[#5e5e5e] font-medium">
                      {selectedOrderForDrawer.items?.length || 0} Articles
                    </span>
                  </div>

                  <div className="space-y-2">
                    {Array.isArray(selectedOrderForDrawer.items) &&
                    selectedOrderForDrawer.items.length > 0 ? (
                      selectedOrderForDrawer.items.map((it: any, index: number) => (
                        <div
                          key={it._id || it.id || index}
                          className="p-3 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] flex items-start justify-between"
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-[#0c0a09]">
                              {it.quantity || 1}x {it.itemName || it.name}
                            </div>
                            {(it.variantName || it.notes) && (
                              <div className="text-[11px] text-[#5e5e5e]">
                                {it.variantName && <span>{it.variantName} • </span>}
                                {it.notes && <span>{it.notes}</span>}
                              </div>
                            )}
                          </div>
                          <div className="text-xs font-medium text-[#0c0a09] tabular-nums">
                            {formatPriceWithSymbol(
                              it.totalPrice || it.itemPrice * (it.quantity || 1) || 0,
                              currencySymbol,
                              effectiveCountry,
                              true,
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] text-center text-xs text-[#5e5e5e]">
                        No item breakdown available for this order.
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Reconciliation Breakdown Card */}
                <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] space-y-2 text-xs">
                  <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold block mb-1">
                    Calculation Breakdown
                  </span>
                  <div className="space-y-1.5 text-[#0c0a09]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#5e5e5e]">Item Subtotal (Gross)</span>
                      <span className="tabular-nums font-medium">
                        {formatPriceWithSymbol(
                          selectedOrderForDrawer.subTotal || 0,
                          currencySymbol,
                          effectiveCountry,
                          true,
                        )}
                      </span>
                    </div>

                    {selectedOrderForDrawer.discountAmount > 0 && (
                      <div className="flex items-center justify-between text-[#5e5e5e]">
                        <span>Promo Discount</span>
                        <span className="tabular-nums font-medium text-emerald-700">
                          -{formatPriceWithSymbol(
                            selectedOrderForDrawer.discountAmount,
                            currencySymbol,
                            effectiveCountry,
                            true,
                          )}
                        </span>
                      </div>
                    )}

                    {/* Dynamic Exclusive Tax Components (from snapshot or taxation engine) */}
                    {(() => {
                      const snap = selectedOrderForDrawer.taxInfoSnapshot;
                      if (
                        snap?.tax_mode === "exclusive" &&
                        Array.isArray(snap.components) &&
                        snap.components.length > 0
                      ) {
                        return snap.components.map((c: any, i: number) => {
                          const compAmount = c.amount
                            ? Math.round(c.amount * 100)
                            : Math.round(
                                ((selectedOrderForDrawer.subTotal || 0) * (c.rate || 0)) / 100,
                              );
                          return (
                            <div key={i} className="flex items-center justify-between text-[#5e5e5e]">
                              <span>
                                {c.name} {c.rate ? `(${c.rate}%)` : ""}
                              </span>
                              <span className="tabular-nums font-medium">
                                +{formatPriceWithSymbol(
                                  compAmount,
                                  currencySymbol,
                                  effectiveCountry,
                                  true,
                                )}
                              </span>
                            </div>
                          );
                        });
                      }

                      const exclusiveTax = getOrderExclusiveTax(selectedOrderForDrawer);
                      if (exclusiveTax > 0) {
                        return (
                          <div className="flex items-center justify-between text-[#5e5e5e]">
                            <span>{taxLabel}</span>
                            <span className="tabular-nums font-medium">
                              +{formatPriceWithSymbol(
                                exclusiveTax,
                                currencySymbol,
                                effectiveCountry,
                                true,
                              )}
                            </span>
                          </div>
                        );
                      }

                      if (
                        snap?.tax_mode === "inclusive" ||
                        defaultTaxGroup?.taxMode === "inclusive" ||
                        (storeTaxSettings as any)?.defaultTaxMode === "inclusive"
                      ) {
                        return (
                          <div className="flex items-center justify-between text-[#5e5e5e]">
                            <span>{taxLabel}</span>
                            <span className="tabular-nums text-xs text-[#78716c] font-medium">
                              Inclusive (included in gross)
                            </span>
                          </div>
                        );
                      }

                      return null;
                    })()}

                    {/* Surcharges / Delivery only if > 0 */}
                    {((selectedOrderForDrawer.deliveryCharge || 0) > 0 ||
                      (selectedOrderForDrawer.packagingCharge || 0) > 0) && (
                      <div className="flex items-center justify-between text-[#5e5e5e]">
                        <span>Surcharges / Delivery</span>
                        <span className="tabular-nums font-medium">
                          +{formatPriceWithSymbol(
                            (selectedOrderForDrawer.deliveryCharge || 0) +
                              (selectedOrderForDrawer.packagingCharge || 0),
                            currencySymbol,
                            effectiveCountry,
                            true,
                          )}
                        </span>
                      </div>
                    )}

                    {(() => {
                      const { isPaid: drawerIsPaid, isPending: drawerIsPending, isCancelled: drawerIsCancelled } =
                        getOrderPaymentStatus(selectedOrderForDrawer);

                      if (drawerIsCancelled) {
                        return (
                          <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-xs text-rose-700">
                                Order Cancelled
                              </span>
                              <span className="block text-[11px] text-[#78716c]">
                                Voided / Not Collected
                              </span>
                            </div>
                            <span
                              className="font-garamond text-2xl font-medium text-[#a8a29e] line-through tabular-nums"
                              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                            >
                              {formatPriceWithSymbol(
                                0,
                                currencySymbol,
                                effectiveCountry,
                                true,
                              )}
                            </span>
                          </div>
                        );
                      }

                      if (drawerIsPending) {
                        return (
                          <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-xs text-amber-700">
                                Amount Due (Unpaid)
                              </span>
                              <span className="block text-[11px] text-amber-600">
                                Awaiting Payment Collection
                              </span>
                            </div>
                            <span
                              className="font-garamond text-2xl font-medium text-amber-700 tabular-nums"
                              style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                            >
                              {formatPriceWithSymbol(
                                selectedOrderForDrawer.totalAmount || 0,
                                currencySymbol,
                                effectiveCountry,
                                true,
                              )}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="pt-2 border-t border-[#e7e5e4] flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-xs text-[#0c0a09]">
                              Final Paid Amount
                            </span>
                            <span className="block text-[11px] text-[#5e5e5e]">
                              Total Tender Collected
                            </span>
                          </div>
                          <span
                            className="font-garamond text-2xl font-medium text-[#141010] tabular-nums"
                            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                          >
                            {formatPriceWithSymbol(
                              selectedOrderForDrawer.totalAmount || 0,
                              currencySymbol,
                              effectiveCountry,
                              true,
                            )}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Payment & Tender Reference */}
                <div className="p-4 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] space-y-1.5 text-xs">
                  <div className="text-[11px] font-semibold text-[#5e5e5e] uppercase tracking-wider mb-1">
                    Payment &amp; Tender Reference
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5e5e5e]">Payment Mode:</span>
                    <span className="font-medium text-[#0c0a09] inline-flex items-center gap-1.5">
                      {(() => {
                        const { isPaid: drawerIsPaid, isPending: drawerIsPending, isCancelled: drawerIsCancelled } =
                          getOrderPaymentStatus(selectedOrderForDrawer);

                        if (drawerIsCancelled) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                              Cancelled
                            </span>
                          );
                        }
                        if (drawerIsPending) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Pending
                            </span>
                          );
                        }
                        const mode = getOrderPaymentMode(selectedOrderForDrawer);
                        return (
                          <>
                            <span className="text-[#5e5e5e]">
                              {renderPaymentModeIcon(mode, "w-3.5 h-3.5 shrink-0")}
                            </span>
                            <span>{mode}</span>
                          </>
                        );
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5e5e5e]">Settled At:</span>
                    <span className="font-medium text-[#0c0a09]">
                      {(() => {
                        const { isPaid: drawerIsPaid, isCancelled: drawerIsCancelled } =
                          getOrderPaymentStatus(selectedOrderForDrawer);

                        if (drawerIsCancelled) return "- (Cancelled)";
                        if (!drawerIsPaid) return "- (Not Settled)";

                        const settledTs =
                          selectedOrderForDrawer.settledAt ||
                          (Array.isArray(selectedOrderForDrawer.payments) &&
                            selectedOrderForDrawer.payments[0]?.createdAt) ||
                          selectedOrderForDrawer.createdAt;

                        return `${formatStoreDate(settledTs, effectiveCountry, effectiveTimezone)}, ${formatStoreTime(settledTs, effectiveTimezone, effectiveCountry)}`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 sm:p-5 bg-[#fdf8f7] border-t border-[#e7e5e4] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForDrawer(null)}
                  className="px-4 py-2 rounded-lg bg-white border border-[#e7e5e4] text-[#0c0a09] hover:bg-[#f1edec] text-xs font-medium transition-colors cursor-pointer"
                >
                  Close Drawer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openReceiptPdfInNewTab({
                      order: selectedOrderForDrawer,
                      org: activeOrg,
                    });
                    showToast("Order slip opened in print tab", "success");
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0c0a09] text-white hover:bg-[#262626] text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    print
                  </span>
                  <span>Print Order Slip</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
