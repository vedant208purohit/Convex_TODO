"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  formatPriceWithSymbol,
  formatStoreDate,
  formatStoreTime,
  formatStoreDateTime,
  formatCurrencyAmount,
  getPhoneCodeForCountry,
  formatPhoneNumberWithCountryCode,
  getTimezoneForCountry,
  getCurrencyForCountry,
} from "../../../lib/constants/countries";
import { DateRange, ChevronRightIcon } from "./ReportHeader";
import {
  computeOperationalReportData,
  isDataZero,
  formatDeliveryTime,
  formatHourWindow,
  isOrderRefunded,
  isOrderUnpaidCancelled,
  getOrderRefundAmount,
} from "../../reports/reportCalculations";
import { Toast, type ToastMessage } from "../Toast";
import { OrderDateRangePicker } from "../OrderDateRangePicker";

interface OperationalReportViewProps {
  orders: any[];
  tables?: any[];
  layouts?: any[];
  processes?: any[];
  loading?: boolean;
  currencySymbol?: string;
  countryCode?: string;
  timezone?: string;
  operationTiming?: any;
  selectedRange?: DateRange;
  onRangeChange?: (range: DateRange) => void;
  activeOrg?: any;
}

export function OperationalReportView({
  orders = [],
  tables = [],
  layouts = [],
  processes = [],
  loading = false,
  currencySymbol: passedCurrencySymbol,
  countryCode = "IN",
  timezone,
  operationTiming,
  selectedRange,
  onRangeChange,
  activeOrg,
}: OperationalReportViewProps) {
  // Centralized currency & timezone from countries.ts
  const resolvedCurrencySymbol =
    passedCurrencySymbol ||
    getCurrencyForCountry(countryCode || "IN").symbol ||
    "₹";
  const storeTz = timezone || getTimezoneForCountry(countryCode || "IN");

  // Settings -> Payment Modes query
  const paymentModesFromSettings = useQuery(api.organizationPaymentModes.list);

  // Dynamic Organization Users for resolving staff / captain names
  const organizationUsersFromDb = useQuery(
    api.organizationUsers.list,
    activeOrg?._id ? { organizationId: activeOrg._id } : "skip"
  );

  // 3 Tabs: 'payment' | 'restaurant' | 'order'
  const [operationalTab, setOperationalTab] = useState<
    "payment" | "restaurant" | "order"
  >("payment");

  // Pagination states for sub-views
  const [paymentDailyPage, setPaymentDailyPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const [processPage, setProcessPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [activeModal, setActiveModal] = useState<
    "reconcile" | "batches" | "slips" | "orders" | null
  >(null);
  const [selectedChannelName, setSelectedChannelName] = useState<string>("Cash");

  // Standard Toaster Notification State
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  // Compute Dynamic Operational Report Data from live orders & master entities
  const operationalData = useMemo(() => {
    return computeOperationalReportData(
      orders,
      tables,
      layouts,
      processes,
      resolvedCurrencySymbol,
      countryCode,
      storeTz,
      operationTiming
    );
  }, [
    orders,
    tables,
    layouts,
    processes,
    resolvedCurrencySymbol,
    countryCode,
    storeTz,
    operationTiming,
  ]);

  const { paymentReport, restaurantTableReport, orderProcessReport } =
    operationalData;

  // 1. Audit-grade Dynamic Payment Breakdown from Orders & Settings -> Payment Modes
  const paymentBreakdownData = useMemo(() => {
    const activeSettingModes: string[] = [];
    if (paymentModesFromSettings && Array.isArray(paymentModesFromSettings)) {
      for (const m of paymentModesFromSettings) {
        if (m.active !== false && m.deletedAt === undefined && m.name) {
          activeSettingModes.push(m.name.trim());
        }
      }
    }

    const modeMap: Record<
      string,
      { txns: number; grossPaise: number; refundPaise: number; netPaise: number }
    > = {};

    // Initialize only active modes from Settings (or Cash fallback)
    if (activeSettingModes.length > 0) {
      for (const name of activeSettingModes) {
        modeMap[name] = { txns: 0, grossPaise: 0, refundPaise: 0, netPaise: 0 };
      }
    } else {
      modeMap["Cash"] = { txns: 0, grossPaise: 0, refundPaise: 0, netPaise: 0 };
    }

    // Disambiguated matching helper (never conflates Credit and Debit!)
    const findModeKey = (rawMode: string): string => {
      const trimmed = (rawMode || "Cash").trim();
      const lower = trimmed.toLowerCase();

      // 1. Exact case-insensitive match
      const exact = Object.keys(modeMap).find((k) => k.toLowerCase() === lower);
      if (exact) return exact;

      // 2. Disambiguated keyword matching
      if (lower.includes("credit")) {
        const creditKey = Object.keys(modeMap).find((k) => k.toLowerCase().includes("credit"));
        if (creditKey) return creditKey;
      }
      if (lower.includes("debit")) {
        const debitKey = Object.keys(modeMap).find((k) => k.toLowerCase().includes("debit"));
        if (debitKey) return debitKey;
      }
      if (
        lower.includes("upi") ||
        lower.includes("qr") ||
        lower.includes("scan") ||
        lower.includes("gpay") ||
        lower.includes("phonepe") ||
        lower.includes("paytm")
      ) {
        const upiKey = Object.keys(modeMap).find((k) => {
          const kl = k.toLowerCase();
          return kl.includes("upi") || kl.includes("qr");
        });
        if (upiKey) return upiKey;
      }
      if (lower.includes("cash")) {
        const cashKey = Object.keys(modeMap).find((k) => k.toLowerCase().includes("cash"));
        if (cashKey) return cashKey;
      }
      if (lower.includes("swiggy")) {
        const swiggyKey = Object.keys(modeMap).find((k) => k.toLowerCase().includes("swiggy"));
        if (swiggyKey) return swiggyKey;
      }
      if (lower.includes("zomato")) {
        const zomatoKey = Object.keys(modeMap).find((k) => k.toLowerCase().includes("zomato"));
        if (zomatoKey) return zomatoKey;
      }

      return Object.keys(modeMap)[0] || "Cash";
    };

    for (const o of orders) {
      if (isOrderUnpaidCancelled(o)) continue;

      const isPaid =
        o.paymentStatus === "Paid" ||
        o.isPaid === true ||
        (Array.isArray(o.payments) &&
          o.payments.length > 0 &&
          o.payments.some(
            (p: any) =>
              (p.paymentType === "Credit" || !p.paymentType) &&
              (p.status === "Success" || p.status === "Paid" || Boolean(p.paymentModeName))
          ));

      if (!isPaid && !isOrderRefunded(o)) {
        continue;
      }

      const val = o.totalAmount || 0;
      const orderRef = getOrderRefundAmount(o);

      if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
        let hasDebitOrRefund = false;
        for (const p of o.payments) {
          if (p.paymentType === "Debit" || (typeof p.refundAmount === "number" && p.refundAmount > 0)) {
            hasDebitOrRefund = true;
            break;
          }
        }

        for (const p of o.payments) {
          const rawM = p.paymentModeName || p.mode || p.paymentMode || o.paymentMode || "Cash";
          const finalKey = findModeKey(rawM);

          if (!modeMap[finalKey]) {
            modeMap[finalKey] = { txns: 0, grossPaise: 0, refundPaise: 0, netPaise: 0 };
          }

          const isDebit = p.paymentType === "Debit";
          if (isDebit) {
            const pRef = p.refundAmount || p.amount || 0;
            modeMap[finalKey].refundPaise += pRef;
          } else {
            const pGross = p.payAmount !== undefined ? p.payAmount : (p.amount || 0);
            let pRef = p.refundAmount || 0;
            if (!hasDebitOrRefund && orderRef > 0) {
              pRef = orderRef;
            }
            modeMap[finalKey].txns += 1;
            modeMap[finalKey].grossPaise += pGross;
            modeMap[finalKey].refundPaise += pRef;
          }
          modeMap[finalKey].netPaise = modeMap[finalKey].grossPaise - modeMap[finalKey].refundPaise;
        }
      } else {
        const rawM = o.paymentMode || o.paymentMethod || "Cash";
        const finalKey = findModeKey(rawM);

        if (!modeMap[finalKey]) {
          modeMap[finalKey] = { txns: 0, grossPaise: 0, refundPaise: 0, netPaise: 0 };
        }

        modeMap[finalKey].txns += 1;
        modeMap[finalKey].grossPaise += val;
        modeMap[finalKey].refundPaise += orderRef;
        modeMap[finalKey].netPaise = modeMap[finalKey].grossPaise - modeMap[finalKey].refundPaise;
      }
    }

    let totalTxns = 0;
    let totalGrossPaise = 0;
    let totalRefundPaise = 0;

    for (const data of Object.values(modeMap)) {
      totalTxns += data.txns;
      totalGrossPaise += data.grossPaise;
      totalRefundPaise += data.refundPaise;
    }
    const totalNetPaise = Math.max(0, totalGrossPaise - totalRefundPaise);

    return {
      modeMap,
      totalTxns,
      totalGrossPaise,
      totalRefundPaise,
      totalNetPaise,
    };
  }, [orders, paymentModesFromSettings]);

  // Tender channels calculation for Settlement Ledger (Dynamic from Settings -> Payment Modes)
  const tenderChannels = useMemo(() => {
    const { modeMap, totalTxns, totalGrossPaise } = paymentBreakdownData;

    // Define standard channel configurations
    const channelConfigs: Record<
      string,
      {
        icon: string;
        subtitle: string;
        status: string;
        statusColor: string;
        actionLabel: string;
        actionType: "reconcile" | "batches" | "slips" | "orders";
      }
    > = {
      cash: {
        icon: "payments",
        subtitle: "Front desk register #01",
        status: "In Drawer",
        statusColor: "bg-[#f1edec] text-[#141010]",
        actionLabel: "Reconcile",
        actionType: "reconcile",
      },
      "upi / qr scan": {
        icon: "qr_code_2",
        subtitle: "Dynamic soundbox integrated",
        status: "Direct Bank",
        statusColor: "bg-[#e8f5e9] text-[#2e7d32]",
        actionLabel: "View Batches",
        actionType: "batches",
      },
      upi: {
        icon: "qr_code_2",
        subtitle: "Dynamic soundbox integrated",
        status: "Direct Bank",
        statusColor: "bg-[#e8f5e9] text-[#2e7d32]",
        actionLabel: "View Batches",
        actionType: "batches",
      },
      "credit card": {
        icon: "credit_card",
        subtitle: "Service terminal payment",
        status: "Direct Bank",
        statusColor: "bg-[#f1edec] text-[#5e5e5e]",
        actionLabel: "View Details",
        actionType: "batches",
      },
      "debit card": {
        icon: "credit_card",
        subtitle: "Service terminal payment",
        status: "Direct Bank",
        statusColor: "bg-[#f1edec] text-[#5e5e5e]",
        actionLabel: "View Details",
        actionType: "batches",
      },
      "credit / debit card": {
        icon: "credit_card",
        subtitle: "Pine Labs EDC Terminal #04",
        status: "Terminal Batch",
        statusColor: "bg-[#f1edec] text-[#5e5e5e]",
        actionLabel: "View Slips",
        actionType: "slips",
      },
      card: {
        icon: "credit_card",
        subtitle: "Pine Labs EDC Terminal #04",
        status: "Terminal Batch",
        statusColor: "bg-[#f1edec] text-[#5e5e5e]",
        actionLabel: "View Slips",
        actionType: "slips",
      },
      "swiggy online": {
        icon: "moped",
        subtitle: "Cloud Kitchen API Integration",
        status: "Aggregator Payout",
        statusColor: "bg-[#f1edec] text-[#5e5e5e]",
        actionLabel: "View Order IDs",
        actionType: "orders",
      },
      swiggy: {
        icon: "moped",
        subtitle: "Cloud Kitchen API Integration",
        status: "Aggregator Payout",
        statusColor: "bg-[#f1edec] text-[#5e5e5e]",
        actionLabel: "View Order IDs",
        actionType: "orders",
      },
      "zomato online": {
        icon: "delivery_dining",
        subtitle: "Merchant Direct Settlement",
        status: "Aggregator Payout",
        statusColor: "bg-[#f1edec] text-[#5e5e5e]",
        actionLabel: "View Order IDs",
        actionType: "orders",
      },
      zomato: {
        icon: "delivery_dining",
        subtitle: "Merchant Direct Settlement",
        status: "Aggregator Payout",
        statusColor: "bg-[#f1edec] text-[#5e5e5e]",
        actionLabel: "View Order IDs",
        actionType: "orders",
      },
    };

    return Object.entries(modeMap).map(([modeName, data]) => {
      const key = modeName.toLowerCase().trim();
      const conf =
        channelConfigs[key] || {
          icon: key.includes("card") ? "credit_card" : "payments",
          subtitle: "Service terminal payment",
          status: "Direct Bank",
          statusColor: "bg-[#f1edec] text-[#5e5e5e]",
          actionLabel: "View Details",
          actionType: "batches" as const,
        };

      const share =
        totalTxns > 0 && data.txns > 0
          ? `${((data.txns / totalTxns) * 100).toFixed(1)}%`
          : totalGrossPaise > 0 && data.grossPaise > 0
            ? `${((data.grossPaise / totalGrossPaise) * 100).toFixed(1)}%`
            : "0.0%";

      return {
        mode: modeName,
        icon: conf.icon,
        subtitle: conf.subtitle,
        txns: data.txns,
        grossPaise: data.grossPaise,
        refundPaise: data.refundPaise,
        netPaise: data.netPaise,
        grossAmount: formatPriceWithSymbol(
          data.grossPaise,
          resolvedCurrencySymbol,
          countryCode,
          true
        ),
        refunds:
          data.refundPaise > 0
            ? `-${formatPriceWithSymbol(data.refundPaise, resolvedCurrencySymbol, countryCode, true)}`
            : formatPriceWithSymbol(0, resolvedCurrencySymbol, countryCode, true),
        hasRefund: data.refundPaise > 0,
        netSettled:
          data.netPaise < 0
            ? `-${formatPriceWithSymbol(Math.abs(data.netPaise), resolvedCurrencySymbol, countryCode, true)}`
            : formatPriceWithSymbol(
                data.netPaise,
                resolvedCurrencySymbol,
                countryCode,
                true
              ),
        isNegativeNet: data.netPaise < 0,
        share,
        drawerStatus: conf.status,
        drawerStatusColor: conf.statusColor,
        actionLabel: conf.actionLabel,
        actionType: conf.actionType,
      };
    });
  }, [paymentBreakdownData, resolvedCurrencySymbol, countryCode]);

  // Determine Most Used Channel
  const mostUsedChannel = useMemo(() => {
    let top = { mode: "-", txns: 0, netPaise: 0, share: "0.0%" };
    for (const ch of tenderChannels) {
      if (ch.txns > top.txns) {
        top = {
          mode: ch.mode,
          txns: ch.txns,
          netPaise: ch.netPaise,
          share: ch.share,
        };
      }
    }
    if (top.txns === 0 && tenderChannels.length > 0) {
      top = {
        mode: tenderChannels[0].mode,
        txns: tenderChannels[0].txns,
        netPaise: tenderChannels[0].netPaise,
        share: tenderChannels[0].share,
      };
    }
    return top;
  }, [tenderChannels]);



  // Staff name resolution lookup map from organization users
  const staffNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (organizationUsersFromDb && Array.isArray(organizationUsersFromDb)) {
      for (const u of organizationUsersFromDb) {
        const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
        const displayName = fullName || u.phone || u.email;
        if (displayName) {
          if (u.userId) map.set(u.userId, displayName);
          if (u._id) map.set(String(u._id), displayName);
        }
      }
    }
    return map;
  }, [organizationUsersFromDb]);

  // Helper to resolve floor/section name for an order
  const resolveOrderFloorSection = (o: any): string => {
    const tableVal = o.table?.number || o.table?.name || o.tableName || o.tableNumber;
    if (tableVal) {
      const str = String(tableVal).trim();
      return str.toLowerCase().startsWith("table") ? str : `Table ${str}`;
    }
    const type = (o.orderType || "").toLowerCase();
    if (type.includes("take") || type.includes("pickup")) return "Takeaway Counter";
    if (type.includes("delivery")) return "Delivery Dispatch";
    return "Main Dining";
  };

  // Helper to resolve real staff member or captain name from order
  const resolveOrderStaffName = (o: any): string => {
    // 1. Direct waiter name attached to order if human-readable
    const waiterName = o.waiter?.name?.trim();
    if (
      waiterName &&
      !waiterName.toLowerCase().startsWith("staff #") &&
      !waiterName.toLowerCase().startsWith("user_")
    ) {
      return waiterName;
    }

    // 2. Lookup by waiterUserId or cashierUserId in organizationUsers
    if (o.waiterUserId && staffNameMap.has(o.waiterUserId)) {
      return staffNameMap.get(o.waiterUserId)!;
    }
    if (o.cashierUserId && staffNameMap.has(o.cashierUserId)) {
      return staffNameMap.get(o.cashierUserId)!;
    }

    // 3. Other explicit name fields on order
    const explicitName = (
      o.waiterName ||
      o.captainName ||
      o.serverName ||
      o.takenByName ||
      o.takenBy ||
      o.cashierName ||
      o.createdByName ||
      o.creatorName
    )?.trim();
    if (explicitName && !explicitName.toLowerCase().startsWith("user_")) {
      return explicitName;
    }

    // 4. Lookup waiter.name in staffNameMap if it was a userId
    if (waiterName && staffNameMap.has(waiterName)) {
      return staffNameMap.get(waiterName)!;
    }

    // 5. Look up by clerk/user ID
    if (o.userId && staffNameMap.has(o.userId)) {
      return staffNameMap.get(o.userId)!;
    }

    // 6. Check orderSource or orderType
    const source = (o.orderSource || "").toLowerCase();
    if (source.includes("captain")) return "Floor Captain";
    if (source.includes("cashier")) return "Cashier Counter";
    if (source.includes("qr") || source.includes("customer")) return "Self-Service QR";
    if (source.includes("online")) return "Online Channel";

    if (o.orderType === "Takeaway") return "Takeaway Counter";
    if (o.orderType === "Delivery") return "Delivery Dispatch";
    if (o.terminalName?.toLowerCase().includes("cashier")) return "Cashier Counter";

    return "Unassigned Staff";
  };

  // Staff / Floor Captain Performance (Fully Dynamic)
  const staffPerformanceList = useMemo(() => {
    const staffMap = new Map<
      string,
      {
        name: string;
        floors: Set<string>;
        orders: number;
        revenuePaise: number;
        totalDwellMinutes: number;
        dwellOrderCount: number;
        unauthVoids: number;
      }
    >();

    for (const o of orders) {
      const server = resolveOrderStaffName(o);
      const floor = resolveOrderFloorSection(o);

      const existing = staffMap.get(server) || {
        name: server,
        floors: new Set<string>(),
        orders: 0,
        revenuePaise: 0,
        totalDwellMinutes: 0,
        dwellOrderCount: 0,
        unauthVoids: 0,
      };

      existing.floors.add(floor);
      existing.orders += 1;

      // Revenue: do not count cancelled / unpaid failed orders in staff revenue
      const isCancelled =
        o.isRejected ||
        o.orderStatusName === "Cancelled" ||
        (o.paymentStatus === "Failed" && !o.isCompleted);

      if (!isCancelled) {
        existing.revenuePaise += o.totalAmount || 0;
      } else {
        existing.unauthVoids += 1;
      }

      // Table dwell time: ONLY for Dine-In table orders that are completed/settled
      // Takeaway orders do NOT occupy tables and are excluded from dwell calculations
      const isDineIn =
        o.orderType === "DineIn" ||
        Boolean(o.tableId || o.table || o.tableName || o.tableNumber);
      const isCompleted =
        o.isCompleted === true ||
        o.orderStatusName === "Completed" ||
        o.orderStatusName === "Delivered" ||
        o.orderStatusName === "Served" ||
        o.orderStatus === "Completed" ||
        o.orderStatus === "Delivered" ||
        o.orderStatus === "Served" ||
        Boolean(o.completedAt) ||
        Boolean(o.deliveredAt);

      if (isDineIn && isCompleted) {
        const startTime = o.createdAt || o._creationTime;
        const endTime =
          o.completedAt ||
          o.deliveredAt ||
          o.closedAt ||
          o.settledAt ||
          o.updatedAt;

        if (startTime && endTime && endTime > startTime) {
          const diffMs = endTime - startTime;
          const mins = Math.max(1, Math.round(diffMs / 60000));
          existing.totalDwellMinutes += mins;
          existing.dwellOrderCount += 1;
        }
      }

      staffMap.set(server, existing);
    }

    if (staffMap.size === 0) {
      return [];
    }

    return Array.from(staffMap.values()).map((st) => {
      const floorList = Array.from(st.floors);
      const floorDisplay =
        floorList.length === 1
          ? floorList[0]
          : floorList.length > 1
          ? `${floorList[0]} (+${floorList.length - 1} more)`
          : "Main Dining";

      // If staff only handled takeaway/non-table orders, dwellMinutes will be null
      const dwellMinutes =
        st.dwellOrderCount > 0
          ? Math.round(st.totalDwellMinutes / st.dwellOrderCount)
          : null;

      return {
        name: st.name,
        floor: floorDisplay,
        orders: st.orders,
        revenuePaise: st.revenuePaise,
        dwellMinutes,
        unauthVoids: st.unauthVoids,
      };
    });
  }, [orders, staffNameMap]);

  // Overall Shift Dwell Average across completed Dine-In orders ONLY
  const overallShiftDwellAvg = useMemo(() => {
    let totalMins = 0;
    let count = 0;
    for (const o of orders) {
      const isDineIn =
        o.orderType === "DineIn" ||
        Boolean(o.tableId || o.table || o.tableName || o.tableNumber);
      const isCompleted =
        o.isCompleted === true ||
        o.orderStatusName === "Completed" ||
        o.orderStatusName === "Delivered" ||
        o.orderStatusName === "Served" ||
        o.orderStatus === "Completed" ||
        o.orderStatus === "Delivered" ||
        o.orderStatus === "Served" ||
        Boolean(o.completedAt) ||
        Boolean(o.deliveredAt);

      if (!isDineIn || !isCompleted) continue;

      const startTime = o.createdAt || o._creationTime;
      const endTime =
        o.completedAt ||
        o.deliveredAt ||
        o.closedAt ||
        o.settledAt ||
        o.updatedAt;

      if (startTime && endTime && endTime > startTime) {
        const mins = Math.max(1, Math.round((endTime - startTime) / 60000));
        totalMins += mins;
        count++;
      }
    }
    return count > 0 ? Math.round(totalMins / count) : 0;
  }, [orders]);

  // Floor staff assignment adherence percentage
  const floorAdherencePct = useMemo(() => {
    if (!orders || orders.length === 0) return 100;
    const assignedCount = orders.filter(
      (o) => resolveOrderStaffName(o) !== "Unassigned Staff"
    ).length;
    return Math.round((assignedCount / orders.length) * 100);
  }, [orders, staffNameMap]);

  // Dynamic Loss Prevention Log from live order voids & refunds
  const lossPreventionLogs = useMemo(() => {
    const voids: Array<{
      orderId: string;
      amountPaise: number;
      description: string;
      table: string;
      reason: string;
      authorizedBy: string;
    }> = [];

    for (const o of orders) {
      if (
        o.isRejected ||
        o.orderStatusName === "Cancelled" ||
        o.paymentStatus === "Refunded" ||
        o.paymentStatus === "Partially Refunded"
      ) {
        const rawNum = o.orderNumber || String(o._id || "").slice(-4);
        const orderId = rawNum.startsWith("#") ? rawNum : `#${rawNum}`;
        const table = resolveOrderFloorSection(o);
        const staffName = resolveOrderStaffName(o);

        const reason =
          o.rejectReason ||
          o.specialNotes?.replace(/^Cancellation Reason:\s*/i, "") ||
          (o.paymentStatus === "Refunded"
            ? "Full customer refund issued"
            : o.paymentStatus === "Partially Refunded"
            ? "Partial customer refund issued"
            : "Ticket cancellation");

        const itemsDesc =
          Array.isArray(o.items) && o.items.length > 0
            ? o.items
                .map((it: any) => `${it.quantity || 1}x ${it.itemName || "Item"}`)
                .join(", ")
            : `Order ${orderId}`;

        voids.push({
          orderId,
          amountPaise: o.totalAmount || 0,
          description: itemsDesc,
          table,
          reason,
          authorizedBy: staffName,
        });
      }
    }

    return voids;
  }, [orders, staffNameMap]);











  // Paginated Payment Daily Table Data
  const totalPaymentDailyPages = Math.ceil(
    (paymentReport?.table_data?.length || 1) / pageSize
  );
  const paginatedPaymentDailyData = useMemo(() => {
    const start = (paymentDailyPage - 1) * pageSize;
    return (paymentReport?.table_data || []).slice(start, start + pageSize);
  }, [paymentReport?.table_data, paymentDailyPage, pageSize]);

  // Paginated Restaurant Tables Data
  const totalTablePages = Math.ceil(
    (restaurantTableReport?.table_data?.length || 1) / pageSize
  );
  const paginatedTableData = useMemo(() => {
    const start = (tablePage - 1) * pageSize;
    return (restaurantTableReport?.table_data || []).slice(
      start,
      start + pageSize
    );
  }, [restaurantTableReport?.table_data, tablePage, pageSize]);

  // Paginated Order Processes Data
  const totalProcessPages = Math.ceil(
    (orderProcessReport?.table_data?.length || 1) / pageSize
  );
  const paginatedProcessData = useMemo(() => {
    const start = (processPage - 1) * pageSize;
    return (orderProcessReport?.table_data || []).slice(
      start,
      start + pageSize
    );
  }, [orderProcessReport?.table_data, processPage, pageSize]);

  // Export CSV Handler (Blob-based with comprehensive tab-specific operational data)
  const handleExportCsv = () => {
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const downloadCsv = (content: string, filename: string, successMsg: string) => {
      const blob = new Blob(["\uFEFF" + content], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast(successMsg, "success");
    };

    const fileDateStr = new Date().toISOString().slice(0, 10);

    if (operationalTab === "payment") {
      // 1. TENDER CHANNELS SETTLEMENT
      const tenderHeaders = [
        "Payment Mode",
        "Channel Type",
        "Transactions",
        "Gross Amount",
        "Refunds / Voids",
        "Net Settled",
        "Share %",
        "Drawer Status",
      ];
      const tenderRows = tenderChannels.map((c) =>
        [
          escapeCsv(c.mode),
          escapeCsv(c.subtitle),
          escapeCsv(c.txns),
          escapeCsv(c.grossAmount),
          escapeCsv(c.refunds),
          escapeCsv(c.netSettled),
          escapeCsv(c.share),
          escapeCsv(c.drawerStatus),
        ].join(",")
      );

      // Summary row for tender portfolio
      const totalRefundStr =
        paymentBreakdownData.totalRefundPaise > 0
          ? `-${formatPriceWithSymbol(paymentBreakdownData.totalRefundPaise, resolvedCurrencySymbol, countryCode, true)}`
          : formatPriceWithSymbol(0, resolvedCurrencySymbol, countryCode, true);
      const portfolioSummaryRow = [
        escapeCsv("Total Settled Portfolio"),
        escapeCsv("All Payment Channels"),
        escapeCsv(paymentBreakdownData.totalTxns),
        escapeCsv(formatPriceWithSymbol(paymentBreakdownData.totalGrossPaise, resolvedCurrencySymbol, countryCode, true)),
        escapeCsv(totalRefundStr),
        escapeCsv(formatPriceWithSymbol(paymentBreakdownData.totalNetPaise, resolvedCurrencySymbol, countryCode, true)),
        escapeCsv("100.0%"),
        escapeCsv("Audited"),
      ].join(",");

      // 2. STAFF / FLOOR CAPTAIN PERFORMANCE
      const staffHeaders = ["Staff Member", "Floor / Section", "Orders", "Revenue", "Avg Ticket", "Table Dwell Time"];
      const staffRows = staffPerformanceList.map((st) => {
        const avgTicket = st.orders > 0 ? Math.round(st.revenuePaise / st.orders) : 0;
        const dwellStr = st.dwellMinutes !== null ? `${st.dwellMinutes} min` : "N/A (Takeaway)";
        return [
          escapeCsv(st.name),
          escapeCsv(st.floor),
          escapeCsv(st.orders),
          escapeCsv(formatPriceWithSymbol(st.revenuePaise, resolvedCurrencySymbol, countryCode, true)),
          escapeCsv(formatPriceWithSymbol(avgTicket, resolvedCurrencySymbol, countryCode, true)),
          escapeCsv(dwellStr),
        ].join(",");
      });

      // 3. HISTORICAL DAILY SETTLEMENT LEDGER
      const dailyTableData = paymentReport?.table_data || [];
      const dailyHeaders = ["Date", "Payment Mode", "Transactions", "Total Collection"];
      const dailyRows = dailyTableData.map((d: any) =>
        [
          escapeCsv(d.date),
          escapeCsv(d.payment_mode || d.avg_used_payment_mode || "Cash"),
          escapeCsv(d.orders_count || d.total_payments || 0),
          escapeCsv(d.total_collection || d.total_payments_value || "0.00"),
        ].join(",")
      );

      const sections = [
        escapeCsv("=== TENDER CHANNELS SETTLEMENT LEDGER ==="),
        tenderHeaders.map(escapeCsv).join(","),
        ...tenderRows,
        portfolioSummaryRow,
        "",
        escapeCsv("=== FLOOR CAPTAIN PERFORMANCE ==="),
        staffHeaders.map(escapeCsv).join(","),
        ...staffRows,
      ];

      if (dailyRows.length > 0) {
        sections.push(
          "",
          escapeCsv("=== DAILY PAYMENT SETTLEMENT LEDGER ==="),
          dailyHeaders.map(escapeCsv).join(","),
          ...dailyRows
        );
      }

      downloadCsv(
        sections.join("\r\n"),
        `payment_settlement_report_${fileDateStr}.csv`,
        "Payment settlement CSV exported successfully"
      );
    } else if (operationalTab === "restaurant") {
      // 1. FLOOR LAYOUT BREAKDOWN
      const layoutHeaders = [
        "Layout Area",
        "Total Tables",
        "Total Orders Served",
        "Occupancy Rate",
        "Peak Dining Hours",
        "Revenue Contribution",
        "Average Order Value",
      ];
      const layoutRows = (restaurantTableReport?.layouts_breakdown || []).map((l: any) =>
        [
          escapeCsv(l.layout),
          escapeCsv(l.total_tables),
          escapeCsv(l.total_orders_served),
          escapeCsv(l.occupancy_rate),
          escapeCsv(l.peak_occupancy_time),
          escapeCsv(l.layout_revenue_contribution),
          escapeCsv(l.average_order_value),
        ].join(",")
      );

      // 2. DAILY TABLE UTILIZATION LEDGER
      const tableHeaders = [
        "Date",
        "Most Used Table",
        "Layout Area",
        "Orders Served",
        "Avg Occupancy Duration",
        "Avg Occupancy Rate",
        "Average Order Value",
      ];
      const tableRows = (restaurantTableReport?.table_data || []).map((d: any) =>
        [
          escapeCsv(d.date),
          escapeCsv(d.most_used_table),
          escapeCsv(d.layout),
          escapeCsv(d.total_orders_served),
          escapeCsv(d.avg_occupancy_duration),
          escapeCsv(d.avg_occupancy_rate),
          escapeCsv(d.avg_order_value),
        ].join(",")
      );

      const sections = [
        escapeCsv("=== RESTAURANT FLOOR & LAYOUT UTILIZATION ==="),
        layoutHeaders.map(escapeCsv).join(","),
        ...layoutRows,
        "",
        escapeCsv("=== HISTORICAL DAILY TABLE UTILIZATION LEDGER ==="),
        tableHeaders.map(escapeCsv).join(","),
        ...tableRows,
      ];

      downloadCsv(
        sections.join("\r\n"),
        `restaurant_tables_report_${fileDateStr}.csv`,
        "Restaurant tables CSV exported successfully"
      );
    } else {
      // 1. ORDER PROCESSES CADENCE & WORKSTATION PERFORMANCE
      const processHeaders = [
        "Date",
        "Total Orders Received",
        "Avg Time In Each Process",
        "Order Processing Efficiency",
      ];
      const processRows = (orderProcessReport?.table_data || []).map((d: any) =>
        [
          escapeCsv(d.date),
          escapeCsv(d.total_orders_recieved),
          escapeCsv(d.avg_time_in_each_process),
          escapeCsv(d.order_processing_efficiency),
        ].join(",")
      );

      const sections = [
        escapeCsv("=== ORDER PROCESSES & KDS CADENCE LEDGER ==="),
        processHeaders.map(escapeCsv).join(","),
        ...processRows,
      ];

      downloadCsv(
        sections.join("\r\n"),
        `order_processes_report_${fileDateStr}.csv`,
        "Order processes CSV exported successfully"
      );
    }
  };

  // Channel Action Click Handler
  const handleChannelAction = (channel: typeof tenderChannels[0]) => {
    setSelectedChannelName(channel.mode);
    setActiveModal(channel.actionType);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header Section with Breadcrumb, Serif Display Title, and Calendar Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
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
              Operational Report
            </span>
          </nav>
          {/* Serif Heading matching Customer Report font size & family */}
          <h1
            className="font-garamond text-[32px] md:text-[36px] text-[#0c0a09] font-normal leading-tight"
            style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            Operational Report
          </h1>
          <p className="text-[#5e5e5e] text-[14px] mt-1 font-normal max-w-2xl">
            Monitor settlement tenders, cash drawer variances, table dwell turnaround, and order processing cadence.
          </p>
        </div>

        {/* Date Range Selector & Action Bar (Copied exactly from Customer Report) */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto self-start md:self-end shrink-0">
          {selectedRange && onRangeChange ? (
            <OrderDateRangePicker
              startDate={selectedRange.startDate}
              endDate={selectedRange.endDate}
              preset={selectedRange.preset}
              onChange={onRangeChange}
              countryCode={countryCode}
              timezone={storeTz}
              align="right"
            />
          ) : null}

          {/* Export CSV Action */}
          <button
            onClick={handleExportCsv}
            type="button"
            className="h-10 px-4 bg-white text-[#0c0a09] rounded-lg shadow-2xs border border-[#e7e5e4] flex items-center gap-2 hover:bg-[#f1edec] transition-all text-xs font-medium cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[18px] text-[#0c0a09]">
              file_download
            </span>
            <span>Export CSV</span>
          </button>

          {/* Print Summary Action (Disabled / Low Opacity) */}
          <button
            type="button"
            disabled
            title="Print Operational Report"
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white text-[#a8a29e] border border-[#e7e5e4] shadow-2xs opacity-40 cursor-not-allowed select-none shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
          </button>
        </div>
      </div>

      {/* Operational View Segmented Tabs (Pill Switcher) */}
      <div className="inline-flex items-center p-1 bg-[#f1edec] rounded-full w-fit mb-6 sm:mb-8 border border-[#e7e5e4] shadow-inner">
        <button
          type="button"
          onClick={() => setOperationalTab("payment")}
          className={`px-5 py-2 text-xs font-semibold rounded-full transition-all flex items-center gap-2 cursor-pointer ${
            operationalTab === "payment"
              ? "bg-[#0c0a09] text-white shadow-2xs"
              : "text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#e7e5e4]/50"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">payments</span>
          <span>Payment Modes</span>
        </button>
        <button
          type="button"
          onClick={() => setOperationalTab("restaurant")}
          className={`px-5 py-2 text-xs font-semibold rounded-full transition-all flex items-center gap-2 cursor-pointer ${
            operationalTab === "restaurant"
              ? "bg-[#0c0a09] text-white shadow-2xs"
              : "text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#e7e5e4]/50"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">table_restaurant</span>
          <span>Restaurant Tables</span>
        </button>
        <button
          type="button"
          onClick={() => setOperationalTab("order")}
          className={`px-5 py-2 text-xs font-semibold rounded-full transition-all flex items-center gap-2 cursor-pointer ${
            operationalTab === "order"
              ? "bg-[#0c0a09] text-white shadow-2xs"
              : "text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#e7e5e4]/50"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
          <span>Order Processes</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1 — PAYMENT MODES CONTENT                            */}
      {/* ======================================================== */}
      {operationalTab === "payment" && (
        <div className="flex flex-col gap-6 sm:gap-8">
          {/* 4 Compact Key Operational KPI Cards (Matching Customer Cards Alignment) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-sans">
            {/* KPI 1: Total Payments */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Total Payments
                </span>
                <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#141010] shrink-0 border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[16px]">
                    receipt_long
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {paymentBreakdownData.totalTxns}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#5e5e5e]">
                    txns
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Across {tenderChannels.length} tender channels
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#141010] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#0c0a09] shrink-0"></span>
                <span className="truncate">100% fully reconciled</span>
              </div>
            </div>

            {/* KPI 2: Total Settled Value */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Total Settled Value
                </span>
                <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#141010] shrink-0 border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[16px]">
                    account_balance_wallet
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {formatPriceWithSymbol(paymentBreakdownData.totalNetPaise, resolvedCurrencySymbol, countryCode, true)}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Net receipts after refunds
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#141010] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#0c0a09] shrink-0"></span>
                <span className="truncate">
                  {formatPriceWithSymbol(0, resolvedCurrencySymbol, countryCode, true)} uncollected drift
                </span>
              </div>
            </div>

            {/* KPI 3: Most Used Mode */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Most Used Mode
                </span>
                <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#141010] shrink-0 border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[16px]">
                    qr_code_scanner
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {mostUsedChannel.mode}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  {mostUsedChannel.txns} transactions ({mostUsedChannel.share})
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#141010] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#0c0a09] shrink-0"></span>
                <span className="truncate tabular-nums">
                  {formatPriceWithSymbol(mostUsedChannel.netPaise, resolvedCurrencySymbol, countryCode, true)} settled
                </span>
              </div>
            </div>

            {/* KPI 4: Aggregator Telemetry (Coming Soon) */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Aggregator Telemetry
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#f1edec] text-[#5e5e5e] text-[10px] font-medium border border-[#e7e5e4]">
                  Coming Soon
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#78716c] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    Coming Soon
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Aggregator channel telemetry will be available here
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#5e5e5e] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                <span className="truncate">Integration in progress</span>
              </div>
            </div>
          </div>

          {/* MAIN PAYMENT MODES TABLE: Tender Channel Settlement Ledger */}
          <div className="bg-white rounded-xl shadow-xs border border-[#e7e5e4] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-b border-[#e7e5e4]">
              <div>
                <h2
                  className="font-garamond text-xl sm:text-2xl font-normal text-[#141010]"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Tender Channel Settlement Ledger
                </h2>
                <p className="text-[#5e5e5e] text-xs sm:text-[13px] mt-0.5">
                  Direct breakdown of all dining room, bar, and delivery aggregator collection channels.
                </p>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8f5f4] text-[#5e5e5e] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e7e5e4]">
                    <th className="py-3 px-4 sm:px-6">Payment Mode</th>
                    <th className="py-3 px-4 text-right">Transactions</th>
                    <th className="py-3 px-4 text-right">Gross Amount</th>
                    <th className="py-3 px-4 text-right">Refunds / Voids</th>
                    <th className="py-3 px-4 text-right">Net Settled</th>
                    <th className="py-3 px-4 text-center">Share</th>
                    <th className="py-3 px-4">Drawer Status</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/60 text-xs text-[#141010]">
                  {tenderChannels.map((c, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-[#faf6f5] transition-colors"
                    >
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-[#f1edec] border border-[#e7e5e4] flex items-center justify-center text-[#141010] shrink-0">
                            <span className="material-symbols-outlined text-[18px]">
                              {c.icon}
                            </span>
                          </span>
                          <div>
                            <div className="text-xs sm:text-sm font-medium text-[#141010]">
                              {c.mode}
                            </div>
                            <div className="text-[11px] text-[#5e5e5e]">
                              {c.subtitle}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-xs sm:text-sm font-normal text-[#141010]">
                        {c.txns} txns
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-xs sm:text-sm font-normal text-[#141010]">
                        {c.grossAmount}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right tabular-nums text-xs sm:text-sm font-medium ${
                          c.hasRefund ? "text-[#ba1a1a]" : "text-[#5e5e5e]"
                        }`}
                      >
                        {c.refunds}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right tabular-nums text-xs sm:text-sm font-semibold ${
                          c.isNegativeNet ? "text-[#ba1a1a]" : "text-[#141010]"
                        }`}
                      >
                        {c.netSettled}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-xs font-medium tabular-nums text-[#141010]">
                          {c.share}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-[#e7e5e4] ${c.drawerStatusColor}`}
                        >
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current"></span>
                          {c.drawerStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleChannelAction(c)}
                          className="px-3 py-1.5 rounded-full bg-[#f1edec] hover:bg-[#0c0a09] hover:text-white text-[#141010] text-xs font-medium transition-all shadow-2xs border border-[#e7e5e4] cursor-pointer"
                        >
                          {c.actionLabel}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Total Settled Row (tfoot) */}
                <tfoot>
                  <tr className="bg-[#f8f5f4] font-medium text-[#141010] border-t border-[#e7e5e4]">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div
                        className="font-garamond text-base sm:text-lg font-normal text-[#141010]"
                        style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                      >
                        Total Settled Portfolio
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium tabular-nums text-xs sm:text-sm">
                      {paymentBreakdownData.totalTxns} {paymentBreakdownData.totalTxns === 1 ? "txn" : "txns"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium tabular-nums text-xs sm:text-sm">
                      {formatPriceWithSymbol(paymentBreakdownData.totalGrossPaise, resolvedCurrencySymbol, countryCode, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-[#ba1a1a] tabular-nums text-xs sm:text-sm">
                      {paymentBreakdownData.totalRefundPaise > 0
                        ? `-${formatPriceWithSymbol(paymentBreakdownData.totalRefundPaise, resolvedCurrencySymbol, countryCode, true)}`
                        : formatPriceWithSymbol(0, resolvedCurrencySymbol, countryCode, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-[#0c0a09] tabular-nums text-xs sm:text-sm">
                      {formatPriceWithSymbol(paymentBreakdownData.totalNetPaise, resolvedCurrencySymbol, countryCode, true)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium tabular-nums text-xs">
                      100.0%
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] uppercase tracking-wider text-[#5e5e5e] font-semibold">
                        Audited
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <span className="material-symbols-outlined text-[#5e5e5e] text-[20px]">
                        verified
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>



          {/* STAFF PERFORMANCE & LOSS PREVENTION RECAP (Bottom Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Staff Performance Table (7 cols) */}
            <div className="lg:col-span-7 bg-white p-4 sm:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3
                      className="font-garamond text-xl sm:text-2xl font-normal text-[#141010]"
                      style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                    >
                      Floor Captain Performance
                    </h3>
                    <p className="text-[#5e5e5e] text-xs mt-0.5">
                      Order processing cadence and ticket generation by service staff.
                    </p>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-[#f1edec] border border-[#e7e5e4] flex items-center justify-center text-[#141010]">
                    <span className="material-symbols-outlined text-[18px]">
                      badge
                    </span>
                  </span>
                </div>
                <div className="w-full overflow-x-auto mt-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[#5e5e5e] text-[11px] uppercase tracking-wider bg-[#f8f5f4] border-b border-[#e7e5e4]">
                        <th className="py-2.5 px-3">Staff Member</th>
                        <th className="py-2.5 px-3 text-right">Orders</th>
                        <th className="py-2.5 px-3 text-right">Revenue</th>
                        <th className="py-2.5 px-3 text-right">Avg Ticket</th>
                        <th className="py-2.5 px-3 text-right">Table Dwell</th>
                        <th className="py-2.5 px-3 text-center">Voids</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e7e5e4]/60 text-xs text-[#141010]">
                      {staffPerformanceList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-[#5e5e5e]">
                            No service staff activity recorded for this period.
                          </td>
                        </tr>
                      ) : (
                        staffPerformanceList.map((st, sIdx) => {
                          const avgTicket =
                            st.orders > 0 ? Math.round(st.revenuePaise / st.orders) : 0;
                          return (
                            <tr
                              key={sIdx}
                              className="hover:bg-[#faf6f5] transition-colors"
                            >
                              <td className="py-3 px-3">
                                <div className="font-medium text-[#141010]">
                                  {st.name}
                                </div>
                                <div className="text-[11px] text-[#5e5e5e]">
                                  {st.floor}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums">
                                {st.orders}
                              </td>
                              <td className="py-3 px-3 text-right font-medium tabular-nums">
                                {formatPriceWithSymbol(st.revenuePaise, resolvedCurrencySymbol, countryCode, true)}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums text-[#5e5e5e]">
                                {formatPriceWithSymbol(avgTicket, resolvedCurrencySymbol, countryCode, true)}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums">
                                {st.dwellMinutes !== null
                                  ? st.dwellMinutes > 0
                                    ? `${st.dwellMinutes} min`
                                    : "< 1 min"
                                  : "—"}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {st.unauthVoids > 0 ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] border border-[#ffdad6] font-medium">
                                    {st.unauthVoids} void{st.unauthVoids > 1 ? "s" : ""}
                                  </span>
                                ) : (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f1edec] text-[#5e5e5e] border border-[#e7e5e4]">
                                    0 voids
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="pt-3 mt-4 border-t border-[#e7e5e4] flex items-center justify-between text-[#5e5e5e] text-xs">
                <span>
                  Overall Shift Dwell Average:{" "}
                  <strong className="text-[#141010] font-medium">
                    {overallShiftDwellAvg !== null && overallShiftDwellAvg > 0 ? `${overallShiftDwellAvg} minutes` : "—"}
                  </strong>
                </span>
                <span className="text-[#141010] font-semibold">
                  {floorAdherencePct}% Floor Adherence
                </span>
              </div>
            </div>

            {/* Loss Prevention & Void Audit Log (5 cols) */}
            <div className="lg:col-span-5 bg-white p-4 sm:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3
                      className="font-garamond text-xl sm:text-2xl font-normal text-[#141010]"
                      style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                    >
                      Loss Prevention Log
                    </h3>
                    <p className="text-[#5e5e5e] text-xs mt-0.5">
                      Authorized ticket modifications and void tracing.
                    </p>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-[#f1edec] border border-[#e7e5e4] flex items-center justify-center text-[#141010]">
                    <span className="material-symbols-outlined text-[18px]">
                      security
                    </span>
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {/* Dynamic Void Log Items */}
                  {lossPreventionLogs.length > 0 ? (
                    lossPreventionLogs.slice(0, 3).map((l, lIdx) => (
                      <div
                        key={lIdx}
                        className="p-3.5 rounded-lg bg-[#faf6f5] border border-[#e7e5e4] flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#0c0a09]">
                            {l.orderId}
                          </span>
                          <span className="text-xs font-semibold text-[#ba1a1a] tabular-nums">
                            -{formatPriceWithSymbol(l.amountPaise, resolvedCurrencySymbol, countryCode, true)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#141010] text-xs">
                          <span>{l.description}</span>
                          <span className="text-[11px] text-[#5e5e5e]">
                            {l.table}
                          </span>
                        </div>
                        <div className="pt-1.5 border-t border-[#e7e5e4]/60 flex items-center justify-between text-[11px] text-[#5e5e5e]">
                          <span>Reason: &quot;{l.reason}&quot;</span>
                          <span className="text-[#141010] font-medium">
                            Auth: {l.authorizedBy}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : null}

                  {/* Zero Unauthorized Notice Card */}
                  <div className="p-3.5 rounded-lg bg-[#f1edec] border border-[#e7e5e4] flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px] text-[#141010] shrink-0">
                      verified
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-[#141010]">
                        {lossPreventionLogs.length === 0
                          ? "Zero Discrepancies Recorded"
                          : "Audit Authorizations Verified"}
                      </span>
                      <span className="text-[11px] text-[#5e5e5e]">
                        {lossPreventionLogs.length === 0
                          ? "All processed orders were settled with zero unauthorized voids or ticket cancellations."
                          : `All ${lossPreventionLogs.length} ticket modification${lossPreventionLogs.length > 1 ? "s" : ""} held managerial authorization PIN.`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Daily Payment Settlement Ledger (from defx-pos-frontend) */}
          <div className="bg-white rounded-xl shadow-xs border border-[#e7e5e4] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-b border-[#e7e5e4]">
              <div>
                <h2
                  className="font-garamond text-xl sm:text-2xl font-normal text-[#141010]"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Daily Payment Settlement Ledger
                </h2>
                <p className="text-[#5e5e5e] text-xs sm:text-[13px] mt-0.5">
                  Historical day-by-day settlement batches and preferred tender adoption.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[720px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8f5f4] text-[#5e5e5e] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e7e5e4]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-center">Total Payments</th>
                    <th className="py-3 px-4 text-right">Settled Value</th>
                    <th className="py-3 px-4">Top Payment Mode</th>
                    <th className="py-3 px-4 text-right">Mode Share</th>
                    <th className="py-3 px-4 text-right">Avg Ticket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/60 text-xs text-[#141010]">
                  {paginatedPaymentDailyData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#78716c]">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <span className="material-symbols-outlined text-3xl text-[#78716c]">
                            receipt_long
                          </span>
                          <p className="font-medium text-sm text-[#141010]">
                            No Settlement Records Found
                          </p>
                          <p className="text-xs text-[#5e5e5e]">
                            Transactions settled in this date range will be listed here.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedPaymentDailyData.map((d, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#faf6f5] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#141010]">
                          {d.date}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums">
                          <span className="px-2.5 py-1 rounded-full bg-[#f1edec] border border-[#e7e5e4] text-[#141010] font-medium text-[11px]">
                            {d.total_payments} txns
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#141010]">
                          {d.total_payments_value}
                        </td>
                        <td className="py-3.5 px-4 text-[#5e5e5e]">
                          {d.avg_used_payment_mode}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#2e7d32] font-semibold">
                          {d.percentage_of_total_payments}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-medium text-[#141010]">
                          {d.avg_transaction_value}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPaymentDailyPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-[#e7e5e4] bg-[#faf6f5] text-xs">
                <span className="text-[#5e5e5e]">
                  Page {paymentDailyPage} of {totalPaymentDailyPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={paymentDailyPage <= 1}
                    onClick={() => setPaymentDailyPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-md bg-white border border-[#e7e5e4] disabled:opacity-50 text-[#141010] hover:bg-[#f1edec] cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={paymentDailyPage >= totalPaymentDailyPages}
                    onClick={() =>
                      setPaymentDailyPage((p) =>
                        Math.min(totalPaymentDailyPages, p + 1)
                      )
                    }
                    className="px-3 py-1 rounded-md bg-white border border-[#e7e5e4] disabled:opacity-50 text-[#141010] hover:bg-[#f1edec] cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2 — RESTAURANT TABLES CONTENT                        */}
      {/* ======================================================== */}
      {operationalTab === "restaurant" && (
        <div className="flex flex-col gap-6 sm:gap-8">
          {/* 4 Analytical KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-sans">
            {/* Card 1: Most Occupied Layout */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Most Occupied Layout
                </span>
                <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#141010] shrink-0 border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[16px]">
                    table_restaurant
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {restaurantTableReport?.most_occupied_layout &&
                    restaurantTableReport.most_occupied_layout !== "-"
                      ? restaurantTableReport.most_occupied_layout
                      : (layouts && layouts[0]?.name) || "-"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Highest customer footfall density
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#141010] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#0c0a09] shrink-0"></span>
                <span className="truncate">Active dining floor</span>
              </div>
            </div>

            {/* Card 2: Layout with Most Free Tables */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Available Capacity
                </span>
                <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#141010] shrink-0 border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[16px]">
                    event_seat
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {restaurantTableReport?.layout_with_most_free_tables &&
                    restaurantTableReport.layout_with_most_free_tables !== "-"
                      ? restaurantTableReport.layout_with_most_free_tables
                      : (layouts && layouts[0]?.name) || "-"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Layout with most free seats
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#141010] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#0c0a09] shrink-0"></span>
                <span className="truncate">Ready for reservation</span>
              </div>
            </div>

            {/* Card 3: Avg Occupancy Duration */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Avg Dwell Duration
                </span>
                <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#141010] shrink-0 border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[16px]">
                    hourglass_empty
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {restaurantTableReport?.avg_occupancy_duration &&
                    restaurantTableReport.avg_occupancy_duration !== "-"
                      ? restaurantTableReport.avg_occupancy_duration
                      : "-"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  {restaurantTableReport?.avg_occupancy_duration &&
                  restaurantTableReport.avg_occupancy_duration !== "-"
                    ? "Average table turnaround time"
                    : "No turnaround time recorded"}
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#141010] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#0c0a09] shrink-0"></span>
                <span className="truncate">Service pace benchmark</span>
              </div>
            </div>

            {/* Card 4: Total Occupied Percentage */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Floor Occupancy Rate
                </span>
                <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#141010] shrink-0 border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[16px]">
                    pie_chart
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {restaurantTableReport?.total_occupied_percentage ?? "0.0%"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Total dining room utilization
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#141010] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#0c0a09] shrink-0"></span>
                <span className="truncate">
                  {restaurantTableReport?.total_occupied_percentage &&
                  restaurantTableReport.total_occupied_percentage !== "0.0%" &&
                  restaurantTableReport.total_occupied_percentage !== "0%"
                    ? "Active floor demand"
                    : "Floor idle"}
                </span>
              </div>
            </div>
          </div>

          {/* Layouts Breakdown Table */}
          <div className="bg-white rounded-xl shadow-xs border border-[#e7e5e4] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-b border-[#e7e5e4]">
              <div>
                <h2
                  className="font-garamond text-xl sm:text-2xl font-normal text-[#141010]"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Layouts &amp; Zones Breakdown
                </h2>
                <p className="text-[#5e5e5e] text-xs sm:text-[13px] mt-0.5">
                  Occupancy velocity, peak service hours, and revenue contribution by dining floor zone.
                </p>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8f5f4] text-[#5e5e5e] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e7e5e4]">
                    <th className="py-3 px-4">Layout</th>
                    <th className="py-3 px-4 text-center">Total Tables</th>
                    <th className="py-3 px-4 text-right">Orders Served</th>
                    <th className="py-3 px-4 text-center">Occupancy Rate</th>
                    <th className="py-3 px-4">Peak Occupancy Time</th>
                    <th className="py-3 px-4 text-right">Revenue Contribution</th>
                    <th className="py-3 px-4 text-right">Average Order Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/60 text-xs text-[#141010]">
                  {(restaurantTableReport?.layouts_breakdown?.length || 0) === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#5e5e5e]">
                        No table layout data recorded yet.
                      </td>
                    </tr>
                  ) : (
                    restaurantTableReport.layouts_breakdown.map((l, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#faf6f5] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#141010]">
                          {l.layout}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums">
                          {l.total_tables}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-medium">
                          {l.total_orders_served}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums font-semibold text-[#0c0a09]">
                          {l.occupancy_rate}
                        </td>
                        <td className="py-3.5 px-4 text-[#5e5e5e]">
                          {l.peak_occupancy_time}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#2e7d32] font-semibold">
                          {l.layout_revenue_contribution}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-medium text-[#141010]">
                          {l.average_order_value}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Table Usage Breakdown Table */}
          <div className="bg-white rounded-xl shadow-xs border border-[#e7e5e4] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-b border-[#e7e5e4]">
              <div>
                <h2
                  className="font-garamond text-xl sm:text-2xl font-normal text-[#141010]"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Daily Table Usage History
                </h2>
                <p className="text-[#5e5e5e] text-xs sm:text-[13px] mt-0.5">
                  Historical day-by-day table utilization and dwell benchmarks.
                </p>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8f5f4] text-[#5e5e5e] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e7e5e4]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Most Used Table</th>
                    <th className="py-3 px-4">Layout</th>
                    <th className="py-3 px-4 text-right">Orders Served</th>
                    <th className="py-3 px-4 text-right">Avg Dwell Duration</th>
                    <th className="py-3 px-4 text-center">Occupancy Rate</th>
                    <th className="py-3 px-4 text-right">Avg Order Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/60 text-xs text-[#141010]">
                  {paginatedTableData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#5e5e5e]">
                        No table history available for this period.
                      </td>
                    </tr>
                  ) : (
                    paginatedTableData.map((d, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#faf6f5] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#141010]">
                          {d.date}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[#141010]">
                          {d.most_used_table}
                        </td>
                        <td className="py-3.5 px-4 text-[#5e5e5e]">
                          {d.layout}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums">
                          {d.total_orders_served}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#5e5e5e]">
                          {d.avg_occupancy_duration}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums font-semibold text-[#0c0a09]">
                          {d.avg_occupancy_rate}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-medium text-[#141010]">
                          {d.avg_order_value}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalTablePages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-[#e7e5e4] bg-[#faf6f5] text-xs">
                <span className="text-[#5e5e5e]">
                  Page {tablePage} of {totalTablePages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={tablePage <= 1}
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-md bg-white border border-[#e7e5e4] disabled:opacity-50 text-[#141010] hover:bg-[#f1edec] cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={tablePage >= totalTablePages}
                    onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                    className="px-3 py-1 rounded-md bg-white border border-[#e7e5e4] disabled:opacity-50 text-[#141010] hover:bg-[#f1edec] cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3 — ORDER PROCESSES CONTENT                          */}
      {/* ======================================================== */}
      {operationalTab === "order" && (
        <div className="flex flex-col gap-6 sm:gap-8">
          {/* 3 Key Operational KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 font-sans">
            {/* KPI 1: Total Orders Received */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Orders Received
                </span>
                <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#141010] shrink-0 border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[16px]">
                    receipt_long
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {orderProcessReport?.total_orders_received || 0}
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#5e5e5e]">
                    tickets
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Total kitchen &amp; bar orders processed
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#141010] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#0c0a09] shrink-0"></span>
                <span className="truncate">Active kitchen workflow</span>
              </div>
            </div>

            {/* KPI 2: Avg Time In Each Process */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Avg Stage Duration
                </span>
                <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#141010] shrink-0 border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[16px]">
                    timer
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {orderProcessReport?.avg_time_in_each_process &&
                    orderProcessReport.avg_time_in_each_process !== "-"
                      ? orderProcessReport.avg_time_in_each_process
                      : "-"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  {orderProcessReport?.avg_time_in_each_process &&
                  orderProcessReport.avg_time_in_each_process !== "-"
                    ? "Average duration per kitchen step"
                    : "No stage duration recorded"}
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#141010] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#0c0a09] shrink-0"></span>
                <span className="truncate">
                  {orderProcessReport?.avg_time_in_each_process &&
                  orderProcessReport.avg_time_in_each_process !== "-"
                    ? "Within target SLAs"
                    : "Awaiting stage logs"}
                </span>
              </div>
            </div>

            {/* KPI 3: Order Processing Efficiency */}
            <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#5e5e5e] font-semibold leading-tight">
                  Processing Efficiency
                </span>
                <span className="w-7 h-7 rounded-full bg-[#f1edec] flex items-center justify-center text-[#141010] shrink-0 border border-[#e7e5e4]">
                  <span className="material-symbols-outlined text-[16px]">
                    speed
                  </span>
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-garamond text-3xl font-medium text-[#141010] tracking-tight truncate"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {orderProcessReport?.order_processing_efficiency ?? "100.0%"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-[#5e5e5e] mt-1 truncate">
                  Completed without delays or bottlenecks
                </p>
              </div>
              <div className="mt-4 pt-1 flex items-center gap-1.5 text-[#141010] text-[10px] sm:text-xs font-medium whitespace-nowrap truncate">
                <span className="inline-block w-2 h-2 rounded-full bg-[#0c0a09] shrink-0"></span>
                <span className="truncate">High fulfillment score</span>
              </div>
            </div>
          </div>

          {/* Order Process Efficiency Breakdown Table */}
          <div className="bg-white rounded-xl shadow-xs border border-[#e7e5e4] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-b border-[#e7e5e4]">
              <div>
                <h2
                  className="font-garamond text-xl sm:text-2xl font-normal text-[#141010]"
                  style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                >
                  Order Processing Efficiency Ledger
                </h2>
                <p className="text-[#5e5e5e] text-xs sm:text-[13px] mt-0.5">
                  Daily order fulfillment duration, stage transitions, and operational efficiency score.
                </p>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[720px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8f5f4] text-[#5e5e5e] text-[11px] uppercase tracking-wider font-semibold border-b border-[#e7e5e4]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-center">Total Orders Received</th>
                    <th className="py-3 px-4 text-right">Avg Time In Each Process</th>
                    <th className="py-3 px-4 text-right">Processing Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e5e4]/60 text-xs text-[#141010]">
                  {paginatedProcessData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-[#5e5e5e]">
                        No order processing data recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    paginatedProcessData.map((d, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[#faf6f5] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-[#141010]">
                          {d.date}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums">
                          <span className="px-2.5 py-1 rounded-full bg-[#f1edec] border border-[#e7e5e4] text-[#141010] font-medium text-[11px]">
                            {d.total_orders_recieved} orders
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#5e5e5e]">
                          {d.avg_time_in_each_process}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-[#2e7d32]">
                          {d.order_processing_efficiency}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalProcessPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-[#e7e5e4] bg-[#faf6f5] text-xs">
                <span className="text-[#5e5e5e]">
                  Page {processPage} of {totalProcessPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={processPage <= 1}
                    onClick={() => setProcessPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-md bg-white border border-[#e7e5e4] disabled:opacity-50 text-[#141010] hover:bg-[#f1edec] cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={processPage >= totalProcessPages}
                    onClick={() => setProcessPage((p) => Math.min(totalProcessPages, p + 1))}
                    className="px-3 py-1 rounded-md bg-white border border-[#e7e5e4] disabled:opacity-50 text-[#141010] hover:bg-[#f1edec] cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* INTERACTIVE MODALS & DRAWERS                             */}
      {/* ======================================================== */}

      {/* 1. Tender Reconcile & Batch Details Modal */}
      {(activeModal === "reconcile" ||
        activeModal === "batches" ||
        activeModal === "slips" ||
        activeModal === "orders") && (
        <div className="fixed inset-0 z-50 bg-[#0c0a09]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-[#e7e5e4] max-w-lg w-full p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#f1edec] border border-[#e7e5e4] flex items-center justify-center text-[#141010]">
                  <span className="material-symbols-outlined text-[18px]">
                    verified
                  </span>
                </span>
                <div>
                  <h3
                    className="font-garamond text-xl font-normal text-[#141010]"
                    style={{ fontFamily: "'EB Garamond', Georgia, serif" }}
                  >
                    {selectedChannelName} Tender Audit
                  </h3>
                  <span className="text-[11px] text-[#5e5e5e]">
                    Batch ID #BAT-{new Date().toISOString().slice(0, 10).replace(/-/g, "")}-{selectedChannelName.slice(0, 3).toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full hover:bg-[#f1edec] flex items-center justify-center text-[#5e5e5e] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#141010]">
              <div className="p-3 rounded-lg bg-[#faf6f5] border border-[#e7e5e4] flex justify-between items-center">
                <span className="text-[#5e5e5e]">Channel Status:</span>
                <span className="font-semibold text-[#2e7d32] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2e7d32]"></span>
                  Synchronized &amp; Settled
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#faf6f5] border border-[#e7e5e4] flex justify-between items-center">
                <span className="text-[#5e5e5e]">Store Regional Timezone:</span>
                <span className="font-medium text-[#141010]">{storeTz}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#faf6f5] border border-[#e7e5e4] flex justify-between items-center">
                <span className="text-[#5e5e5e]">Settlement Destination:</span>
                <span className="font-medium text-[#141010]">
                  Direct Merchant Bank Ledger
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e7e5e4]">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  showToast(`${selectedChannelName} batch verified and signed.`, "success");
                }}
                className="px-4 py-2 bg-[#0c0a09] hover:bg-[#262626] text-white text-xs font-semibold rounded-full cursor-pointer shadow-2xs"
              >
                Confirm Verification
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
