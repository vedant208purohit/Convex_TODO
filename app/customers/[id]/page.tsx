"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { PosShell } from "../../components/PosShell";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";

import { EditCustomerModal } from "../../components/customers/EditCustomerModal";
import { DeleteCustomerModal } from "../../components/customers/DeleteCustomerModal";
import { AddressDrawer } from "../../components/customers/AddressDrawer";

import {
  formatPhoneNumberWithCountryCode,
  formatCurrencyAmount,
  formatStoreDateTime,
  formatStoreDate,
  getCurrencyForCountry,
  getPhoneCodeForCountry,
  getTimezoneForCountry,
} from "../../../lib/constants/countries";

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const idParam = (params.id as string) || "";
  const decodedIdParam = decodeURIComponent(idParam);

  // Extract raw digits from idParam if present
  const rawDigits = decodedIdParam.replace(/\D/g, "");
  const normalizedPhoneDigits = rawDigits.length > 10 && rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits;

  const isOrdCust = decodedIdParam.startsWith("ordcust_");
  const isNameCust = decodedIdParam.startsWith("name_");
  const isExplicitPhone =
    decodedIdParam.startsWith("phone_") ||
    (normalizedPhoneDigits.length >= 7 && normalizedPhoneDigits.length <= 15 && !isOrdCust && !isNameCust);

  const isConvexId = !isExplicitPhone && !isOrdCust && !isNameCust && decodedIdParam.length >= 20;

  const customerId = isConvexId ? (decodedIdParam as Id<"customers">) : null;
  const phoneParam = isExplicitPhone ? normalizedPhoneDigits : "";

  // 1. Query Active Organization
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  const currencySymbol =
    activeOrg?.defaultCurrencySymbol ||
    (activeOrg?.country ? getCurrencyForCountry(activeOrg.country).symbol : "₹");
  const storeTimezone =
    activeOrg?.organizationTimeZone ||
    (activeOrg?.country ? getTimezoneForCountry(activeOrg.country) : "Asia/Kolkata");
  const storePhoneCode = activeOrg?.country ? getPhoneCodeForCountry(activeOrg.country) : "+91";

  // 2. Query Customer Document by ID or by Phone
  const customerById = useQuery(
    api.customers.getCustomer,
    customerId ? { id: customerId } : "skip"
  );

  const customerByPhone = useQuery(
    api.customers.getCustomerByPhone,
    phoneParam ? { phone: phoneParam } : "skip"
  );

  const customerDoc = customerById || customerByPhone;
  const resolvedCustomerId = customerDoc?._id || customerId;

  // 3. Query Customer Addresses
  const customerAddresses = useQuery(
    api.userAddresses.getCustomerAddresses,
    resolvedCustomerId ? { customerId: resolvedCustomerId } : "skip"
  );

  // 4. Query All Store Orders to aggregate orders for this customer
  const storeOrdersResponse = useQuery(
    api.orders.listOrders,
    activeOrg ? { organizationId: activeOrg._id, pageSize: 500 } : "skip"
  );

  // Filter orders belonging to this customer
  const customerOrdersList = useMemo(() => {
    const allOrders = storeOrdersResponse?.orders || [];
    if (allOrders.length === 0) return [];

    const targetPhoneDigits = (customerDoc?.phone || phoneParam || rawDigits || "").replace(/\D/g, "");
    const cleanTargetDigits = targetPhoneDigits.length > 10 && targetPhoneDigits.startsWith("91") ? targetPhoneDigits.slice(2) : targetPhoneDigits;

    const targetName = (
      `${customerDoc?.firstName || ""} ${customerDoc?.lastName || ""}`.trim() ||
      (decodedIdParam.startsWith("name_") ? decodedIdParam.slice(5).replace(/_/g, " ") : "")
    ).trim().toLowerCase();

    return allOrders.filter((ord) => {
      // Direct customerId match
      if (resolvedCustomerId && ord.customerId === resolvedCustomerId) {
        return true;
      }
      // Match by order ID if key is ordcust_<orderId>
      if (isOrdCust && ord._id === decodedIdParam.slice(8)) {
        return true;
      }
      // Phone number match
      if (cleanTargetDigits && cleanTargetDigits.length >= 7 && ord.customerPhone) {
        const ordPhoneDigits = ord.customerPhone.replace(/\D/g, "");
        if (ordPhoneDigits && (ordPhoneDigits.endsWith(cleanTargetDigits) || cleanTargetDigits.endsWith(ordPhoneDigits))) {
          return true;
        }
      }
      // Name match
      if (targetName && targetName !== "guest customer" && ord.customerName) {
        if (ord.customerName.toLowerCase().trim() === targetName) {
          return true;
        }
      }

      if (ord.customerId === decodedIdParam) return true;

      return false;
    });
  }, [storeOrdersResponse, customerDoc, resolvedCustomerId, phoneParam, rawDigits, decodedIdParam, isOrdCust]);

  // 5. Query Organization Queues to show Queue Activity for this customer
  const allQueuesResponse = useQuery(api.organizationQueues.list, {});

  const customerQueueList = useMemo(() => {
    if (!allQueuesResponse || !Array.isArray(allQueuesResponse)) return [];

    const targetPhone = (customerDoc?.phone || phoneParam || rawDigits || "").replace(/\D/g, "");
    const targetUserId = resolvedCustomerId ? String(resolvedCustomerId) : "";

    return allQueuesResponse.filter((q) => {
      // Direct userId match
      if (targetUserId && q.userId === targetUserId) return true;
      if (phoneParam && q.userId === phoneParam) return true;
      if (rawDigits && q.userId === rawDigits) return true;

      // Phone match inside userId or notes
      if (targetPhone && targetPhone.length >= 7) {
        if (q.userId) {
          const uDigits = q.userId.replace(/\D/g, "");
          if (uDigits && (uDigits.endsWith(targetPhone) || targetPhone.endsWith(uDigits))) {
            return true;
          }
        }
        if (q.notes) {
          const notesDigits = q.notes.replace(/\D/g, "");
          if (notesDigits && notesDigits.includes(targetPhone)) {
            return true;
          }
        }
      }

      return false;
    });
  }, [allQueuesResponse, customerDoc, resolvedCustomerId, phoneParam, rawDigits]);

  // UI Tab & Filter States
  const [activeTab, setActiveTab] = useState<"orders" | "surveys" | "queue">("orders");
  const [orderSearch, setOrderSearch] = useState("");
  const [isAddressDrawerOpen, setIsAddressDrawerOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Display fields
  const fullName = customerDoc
    ? `${customerDoc.firstName || ""} ${customerDoc.lastName || ""}`.trim()
    : "";

  const firstOrderWithName = customerOrdersList.find(
    (o) => o.customerName && o.customerName.trim() !== "" && o.customerName.trim() !== "Guest Customer"
  );
  const firstOrderWithPhone = customerOrdersList.find(
    (o) => o.customerPhone && o.customerPhone.trim() !== ""
  );
  const firstOrderWithEmail = customerOrdersList.find(
    (o) => o.customerEmail && o.customerEmail.trim() !== ""
  );

  const nameFromParam = decodedIdParam.startsWith("name_")
    ? decodedIdParam.slice(5).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : "";

  const displayName =
    fullName ||
    firstOrderWithName?.customerName?.trim() ||
    nameFromParam ||
    "Guest Customer";

  const rawPhone = customerDoc?.phone || phoneParam || firstOrderWithPhone?.customerPhone || "";
  const formattedPhone = rawPhone
    ? formatPhoneNumberWithCountryCode(rawPhone, customerDoc?.countryCode || storePhoneCode)
    : "—";

  const emailDisplay = customerDoc?.email || firstOrderWithEmail?.customerEmail?.trim() || "";

  const initials = (() => {
    const clean = displayName.replace(/[^a-zA-Z\s]/g, "").trim();
    if (!clean) return "GC";
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0].toUpperCase();
  })();

  // Filter Orders in Orders Tab search
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return customerOrdersList;
    const term = orderSearch.toLowerCase().trim();
    return customerOrdersList.filter((o) => {
      const orderNum = (o._id || "").toLowerCase();
      const type = (o.orderType || "").toLowerCase();
      const items = (o.itemsSummary || "").toLowerCase();
      return orderNum.includes(term) || type.includes(term) || items.includes(term);
    });
  }, [customerOrdersList, orderSearch]);

  // Real Calculated Metrics
  const totalSpend = useMemo(() => {
    return customerOrdersList.reduce((acc, o) => acc + (o.totalAmount || 0) / 100, 0);
  }, [customerOrdersList]);

  // Extract delivery addresses from past orders as fallbacks
  const orderAddresses = useMemo(() => {
    const list: Array<{
      _id: string;
      addressLine1: string;
      addressLine2?: string;
      landmark?: string;
      city: string;
      zipCode: string;
      addressType?: string;
      isDefault?: boolean;
      completeAddress?: string;
    }> = [];

    const seen = new Set<string>();

    for (const ord of customerOrdersList) {
      if (ord.deliveryAddress && ord.deliveryAddress.addressLine1) {
        const addr = ord.deliveryAddress;
        const key = `${(addr.addressLine1 || "").toLowerCase().trim()}_${(addr.city || "").toLowerCase().trim()}_${(addr.zipCode || "").trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({
            _id: `ord_addr_${ord._id}`,
            addressLine1: addr.addressLine1,
            addressLine2: addr.addressLine2,
            landmark: addr.landmark,
            city: addr.city || "Ahmedabad",
            zipCode: addr.zipCode || "380001",
            addressType: addr.addressType || "Home",
            isDefault: list.length === 0,
            completeAddress: [
              addr.addressLine1,
              addr.addressLine2,
              addr.landmark ? `Near ${addr.landmark}` : undefined,
              addr.city,
              addr.zipCode,
            ].filter(Boolean).join(", "),
          });
        }
      }
    }
    return list;
  }, [customerOrdersList]);

  const dbAddressCount = customerAddresses ? customerAddresses.length : 0;
  const addressCount = Math.max(dbAddressCount, orderAddresses.length);

  // Most frequent order type
  const topOrderType = useMemo(() => {
    if (customerOrdersList.length === 0) return "Dine In";
    const counts: Record<string, number> = {};
    for (const o of customerOrdersList) {
      const type = o.orderType || "Dine In";
      counts[type] = (counts[type] || 0) + 1;
    }
    let max = 0;
    let top = "Dine In";
    for (const [t, cnt] of Object.entries(counts)) {
      if (cnt > max) {
        max = cnt;
        top = t;
      }
    }
    return top;
  }, [customerOrdersList]);

  // Earliest visit date
  const earliestVisitDate = useMemo(() => {
    if (customerDoc?.createdAt) return customerDoc.createdAt;
    if (customerOrdersList.length > 0) {
      return Math.min(...customerOrdersList.map((o) => o.createdAt));
    }
    return Date.now();
  }, [customerDoc, customerOrdersList]);

  const totalOrdersCount = customerOrdersList.length;
  const averageOrderValue = totalOrdersCount > 0 ? totalSpend / totalOrdersCount : 0;
  const retentionVal = totalOrdersCount > 1 ? Math.min(100, Number(((totalOrdersCount / 12) * 100).toFixed(2))) : 0;

  const isCustomerLoading = customerId
    ? customerById === undefined
    : phoneParam
    ? customerByPhone === undefined
    : false;
  const isOrdersLoading = storeOrdersResponse === undefined;
  const isLoading = isCustomerLoading || isOrdersLoading;

  if (isLoading) {
    return (
      <PosShell title="Customer Profile">
        <div className="flex-1 p-8 bg-[#fff8f5] flex items-center justify-center font-mono text-stone-500">
          Loading customer profile...
        </div>
      </PosShell>
    );
  }

  return (
    <PosShell title={`Customer - ${displayName}`}>
      <div className="flex-1 overflow-y-auto bg-[#fff8f5] p-6 lg:p-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Breadcrumb & Back Action */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/customers")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <span>←</span>
              <span>Back to Customers</span>
            </button>
            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <span
                onClick={() => router.push("/customers")}
                className="cursor-pointer hover:underline"
              >
                Customers
              </span>
              <span>›</span>
              <span className="text-stone-900 font-semibold">
                {displayName}{formattedPhone !== "—" ? ` (${formattedPhone})` : ""}
              </span>
            </div>
          </div>

          {/* Guest Profile Header Badge (New Order button removed per user request) */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-stone-900 flex items-center justify-center font-serif text-2xl shrink-0">
                {initials}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-serif text-2xl lg:text-3xl text-stone-900 leading-none">
                    {displayName}
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-stone-900 text-white font-mono text-[10px] uppercase font-bold tracking-wider">
                    {totalOrdersCount >= 5 ? "VIP REGULAR" : "STANDARD GUEST"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-stone-500 text-xs font-medium mt-1">
                  {formattedPhone !== "—" && (
                    <span className="inline-flex items-center gap-1 text-stone-900">
                      <span className="text-emerald-600 text-sm">✓</span>
                      <span className="font-mono">{formattedPhone}</span>
                    </span>
                  )}
                  {emailDisplay && (
                    <>
                      {formattedPhone !== "—" && <span>•</span>}
                      <span className="font-mono text-stone-600">{emailDisplay}</span>
                    </>
                  )}
                  {formattedPhone !== "—" && <span>•</span>}
                  <span className="text-stone-600">Prefers {topOrderType}</span>
                </div>
              </div>
            </div>

            {/* Header Right Action: View Addresses Drawer (New Order button removed as requested) */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddressDrawerOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-stone-800 text-xs font-semibold hover:bg-stone-200 transition-colors cursor-pointer"
              >
                <span>📍</span>
                <span>View addresses ({addressCount} saved)</span>
              </button>
            </div>
          </div>

          {/* Profile Summary Metrics Grid (6 clean horizontal modules) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                Total Spend
              </span>
              <span className="font-serif text-xl font-medium text-stone-900 mt-1">
                {currencySymbol}{formatCurrencyAmount(totalSpend, activeOrg?.country)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                Total Orders
              </span>
              <span className="font-serif text-xl font-medium text-stone-900 mt-1">
                {totalOrdersCount}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                Average Value
              </span>
              <span className="font-serif text-xl font-medium text-stone-900 mt-1">
                {currencySymbol}{formatCurrencyAmount(averageOrderValue, activeOrg?.country)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                Surveys Done
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-serif text-xl font-medium text-stone-400">
                  0
                </span>
                <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-500 font-mono text-[9px] uppercase font-bold tracking-wider">
                  Pending
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                Order Type
              </span>
              <span className="font-serif text-xl font-medium text-stone-900 mt-1">
                {topOrderType}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                Retention
              </span>
              <span className="font-serif text-xl font-medium text-stone-900 mt-1">
                {retentionVal > 0 ? `${retentionVal}%` : "—"}
              </span>
            </div>
          </div>

          {/* Customer Information Card */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="font-serif text-lg text-stone-900">
                Customer Information
              </h2>
              {customerDoc && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs font-semibold text-stone-700 hover:text-stone-900 underline underline-offset-4 cursor-pointer"
                  >
                    Edit Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="text-xs font-semibold text-red-600 hover:text-red-800 underline underline-offset-4 cursor-pointer"
                  >
                    Delete Customer
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-1">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  Full Name
                </span>
                <span className="text-sm text-stone-900 font-medium mt-1">
                  {displayName}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  Email Address
                </span>
                <span className="text-sm text-stone-900 font-mono mt-1">
                  {emailDisplay || "—"}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  Phone
                </span>
                <span className="text-sm text-stone-900 font-mono mt-1">
                  {formattedPhone}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  First Visited
                </span>
                <span className="text-sm text-stone-900 mt-1">
                  {formatStoreDate(earliestVisitDate, activeOrg?.country, storeTimezone)}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  Customer Since
                </span>
                <span className="text-sm text-stone-900 mt-1">
                  {formatStoreDate(earliestVisitDate, activeOrg?.country, storeTimezone)}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Section with Tabs */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            {/* Tabs Header */}
            <div className="flex items-center gap-6 px-6 pt-4 bg-[#faf2ee]/50 border-b border-stone-200">
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className={`pb-3.5 font-medium text-sm transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                  activeTab === "orders"
                    ? "border-stone-900 text-stone-900 font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>Orders</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                    activeTab === "orders"
                      ? "bg-stone-900 text-white"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {totalOrdersCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("surveys")}
                className={`pb-3.5 font-medium text-sm transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                  activeTab === "surveys"
                    ? "border-stone-900 text-stone-900 font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>Surveys</span>
                <span className="px-2 py-0.5 rounded-full font-mono text-[9px] uppercase font-bold tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  Pending / Disabled
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`pb-3.5 font-medium text-sm transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                  activeTab === "queue"
                    ? "border-stone-900 text-stone-900 font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>Queue Activity</span>
                <span className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-stone-200 text-stone-700">
                  {customerQueueList.length}
                </span>
              </button>
            </div>

            {/* Tab 1: Orders */}
            {activeTab === "orders" && (
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Search by order ID or type..."
                      className="w-full bg-[#faf2ee] text-stone-900 text-xs pl-10 pr-4 py-2 rounded-full border border-stone-200 focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div className="text-xs text-stone-500 font-mono">
                    Showing {filteredOrders.length} orders
                  </div>
                </div>

                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#faf2ee] text-stone-600 font-mono text-[10px] uppercase tracking-wider border-b border-stone-200">
                        <th className="py-3 px-4 font-semibold">Order ID</th>
                        <th className="py-3 px-4 font-semibold">Date & Time</th>
                        <th className="py-3 px-4 font-semibold">Order Type</th>
                        <th className="py-3 px-4 font-semibold">Items Summary</th>
                        <th className="py-3 px-4 font-semibold">Amount</th>
                        <th className="py-3 px-4 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-800">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-stone-400 font-mono">
                            No orders found for this customer.
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((ord) => (
                          <tr
                            key={ord._id}
                            className="hover:bg-[#faf2ee]/40 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-mono font-semibold text-stone-900">
                              #ORD-{(ord._id || "").slice(-4).toUpperCase()}
                            </td>
                            <td className="py-3.5 px-4 text-stone-600">
                              {formatStoreDateTime(ord.createdAt, activeOrg?.country, storeTimezone)}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-800 font-medium border border-stone-200">
                                {ord.orderType || "Dine In"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 max-w-xs truncate text-stone-700">
                              {ord.itemsSummary || "Dine In Order Items"}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-semibold text-stone-900">
                              {currencySymbol}{formatCurrencyAmount((ord.totalAmount || 0) / 100, activeOrg?.country)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-mono text-[10px] font-bold border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                {ord.paymentStatus === "Paid" ? "Completed" : ord.paymentStatus || "Completed"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Surveys (Disabled / Pending per user instruction) */}
            {activeTab === "surveys" && (
              <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-xl font-bold">
                  📋
                </div>
                <h3 className="font-serif text-lg text-stone-900">
                  Customer Surveys Disabled / Pending
                </h3>
                <p className="text-xs text-stone-500 max-w-md leading-relaxed">
                  Survey feedback responses for this customer profile are currently disabled / pending as configured. No survey records are attached.
                </p>
              </div>
            )}

            {/* Tab 3: Queue Activity */}
            {activeTab === "queue" && (
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg text-stone-900">
                    Waitlist & Table Reservations
                  </h3>
                  <div className="text-xs text-stone-500 font-mono">
                    Showing {customerQueueList.length} queue records
                  </div>
                </div>

                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#faf2ee] text-stone-600 font-mono text-[10px] uppercase tracking-wider border-b border-stone-200">
                        <th className="py-3 px-4 font-semibold">Queue / Ticket No</th>
                        <th className="py-3 px-4 font-semibold">Type</th>
                        <th className="py-3 px-4 font-semibold">Date & Time</th>
                        <th className="py-3 px-4 font-semibold">Party & Amenities</th>
                        <th className="py-3 px-4 font-semibold">Table</th>
                        <th className="py-3 px-4 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-800">
                      {customerQueueList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-stone-400 font-mono">
                            No active waitlist or reservation history found for this guest.
                          </td>
                        </tr>
                      ) : (
                        customerQueueList.map((q) => (
                          <tr key={q._id} className="hover:bg-[#faf2ee]/40 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-semibold text-stone-900">
                              {q.queueNumber || `#QN-${(q._id || "").slice(-4).toUpperCase()}`}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-800 font-medium border border-stone-200 capitalize">
                                {q.queueType === "waitlist"
                                  ? "Waitlist"
                                  : q.queueType === "reservation"
                                  ? "Reservation"
                                  : q.queueType}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-stone-600">
                              {formatStoreDateTime(q.reservationTime || q.createdAt, activeOrg?.country, storeTimezone)}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-stone-900">
                                  {q.totalGuests || 1} {q.totalGuests === 1 ? "Guest" : "Guests"}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {q.kidsSeat && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[9px] font-medium border border-amber-200">
                                      👶 Kids
                                    </span>
                                  )}
                                  {q.disabledSeat && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-[9px] font-medium border border-blue-200">
                                      ♿ Accessible
                                    </span>
                                  )}
                                  {q.barbequeSeat && (
                                    <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 text-[9px] font-medium border border-orange-200">
                                      🍖 Barbeque
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-stone-800">
                              {q.table?.tableNumber ? `Table ${q.table.tableNumber}` : "—"}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] font-bold border ${
                                  q.queueStatus === "arrived" || q.queueStatus === "completed"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : q.queueStatus === "booked"
                                    ? "bg-blue-50 text-blue-800 border-blue-200"
                                    : q.queueStatus === "pending"
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-stone-100 text-stone-600 border-stone-200"
                                }`}
                              >
                                {q.queueStatus?.replace(/_/g, " ").toUpperCase() || "PENDING"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Book Drawer */}
      <AddressDrawer
        isOpen={isAddressDrawerOpen}
        customerId={resolvedCustomerId}
        customerName={displayName}
        customerPhone={formattedPhone}
        fallbackAddresses={orderAddresses}
        onClose={() => setIsAddressDrawerOpen(false)}
      />

      {/* Action Modals */}
      {customerDoc && (
        <>
          <EditCustomerModal
            isOpen={isEditModalOpen}
            customer={customerDoc}
            onClose={() => setIsEditModalOpen(false)}
          />

          <DeleteCustomerModal
            isOpen={isDeleteModalOpen}
            customer={customerDoc}
            onClose={() => setIsDeleteModalOpen(false)}
            onSuccess={() => router.push("/customers")}
          />
        </>
      )}
    </PosShell>
  );
}
