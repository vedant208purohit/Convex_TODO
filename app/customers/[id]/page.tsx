"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { PosShell } from "../../components/PosShell";
import { api } from "../../../convex/_generated/api";
import { Id, Doc } from "../../../convex/_generated/dataModel";

import { EditCustomerModal } from "../../components/customers/EditCustomerModal";
import { DeleteCustomerModal } from "../../components/customers/DeleteCustomerModal";
import {
  AddressDrawer,
  FallbackAddressItem,
} from "../../components/customers/AddressDrawer";

import {
  formatPhoneNumberWithCountryCode,
  formatCurrencyAmount,
  formatStoreDateTime,
  formatStoreDate,
  getCurrencyForCountry,
  getPhoneCodeForCountry,
  getTimezoneForCountry,
} from "../../../lib/constants/countries";

function StarRatingDisplay({ score, max = 5 }: { score: number; max?: number }) {
  const rounded = Math.round(score);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const isFilled = i < rounded;
        return (
          <svg
            key={i}
            className={`w-3.5 h-3.5 ${
              isFilled ? "text-amber-400 fill-amber-400" : "text-stone-300 fill-stone-100"
            }`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        );
      })}
    </div>
  );
}

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const idParam = (params.id as string) || "";
  const decodedIdParam = decodeURIComponent(idParam);

  const isOrdCust = decodedIdParam.startsWith("ordcust_");
  const isNameCust = decodedIdParam.startsWith("name_");
  const isEmailCust = decodedIdParam.startsWith("email_");
  const isPhonePrefix = decodedIdParam.startsWith("phone_");

  // Pure phone format: ONLY digits, spaces, hyphens, parentheses, and optional leading +
  const isPurePhoneFormat =
    !isOrdCust &&
    !isNameCust &&
    !isEmailCust &&
    !isPhonePrefix &&
    /^\+?[\d\s\-()]{7,20}$/.test(decodedIdParam.trim()) &&
    !/[a-zA-Z]/.test(decodedIdParam);

  const isExplicitPhone = isPhonePrefix || isPurePhoneFormat;

  const rawPhoneString = isPhonePrefix
    ? decodedIdParam.slice(6)
    : isPurePhoneFormat
      ? decodedIdParam
      : "";

  const phoneDigitsOnly = rawPhoneString.replace(/\D/g, "");
  const normalizedPhoneDigits =
    phoneDigitsOnly.length > 10 && phoneDigitsOnly.startsWith("91")
      ? phoneDigitsOnly.slice(2)
      : phoneDigitsOnly;

  const phoneParam = isExplicitPhone ? normalizedPhoneDigits : "";

  // Convex ID: table ID from Convex (alphanumeric, length >= 10, not any prefix or pure phone)
  const isConvexId =
    !isOrdCust &&
    !isNameCust &&
    !isEmailCust &&
    !isExplicitPhone &&
    decodedIdParam.length >= 10;

  const customerId = isConvexId ? (decodedIdParam as Id<"customers">) : null;

  // 1. Query Active Organization
  const organizations = useQuery(api.organizations.list);
  const activeOrg =
    organizations && organizations.length > 0 ? organizations[0] : null;

  const currencySymbol =
    activeOrg?.defaultCurrencySymbol ||
    (activeOrg?.country
      ? getCurrencyForCountry(activeOrg.country).symbol
      : "₹");
  const storeTimezone =
    activeOrg?.organizationTimeZone ||
    (activeOrg?.country
      ? getTimezoneForCountry(activeOrg.country)
      : "Asia/Kolkata");
  const storePhoneCode = activeOrg?.country
    ? getPhoneCodeForCountry(activeOrg.country)
    : "+91";

  // 2. Query Customer Document by ID or by Phone
  const customerById = useQuery(
    api.customers.getCustomer,
    customerId ? { id: customerId } : "skip",
  );

  const customerByPhone = useQuery(
    api.customers.getCustomerByPhone,
    phoneParam ? { phone: phoneParam } : "skip",
  );

  const customerDoc = customerById || customerByPhone;
  const resolvedCustomerId = customerDoc?._id || customerId;

  // 3. Query Customer Addresses
  const customerAddresses = useQuery(
    api.userAddresses.getCustomerAddresses,
    resolvedCustomerId ? { customerId: resolvedCustomerId } : "skip",
  );

  // 4. Query All Store Orders to aggregate orders for this customer
  const storeOrdersResponse = useQuery(
    api.orders.listOrders,
    activeOrg ? { organizationId: activeOrg._id, pageSize: 500 } : "skip",
  );

  // 4b. Query Store Order Processes from DB for live Status name & colors
  const dbProcesses = useQuery(api.organizationOrderProcesses.list, {
    published: true,
  });

  // Filter orders belonging to this customer
  const customerOrdersList = useMemo(() => {
    const allOrders = storeOrdersResponse?.orders || [];
    if (allOrders.length === 0) return [];

    // If route is ordcust_<orderId>, locate the target order from allOrders to resolve customer identity
    const targetOrder = isOrdCust
      ? allOrders.find((o) => o._id === decodedIdParam.slice(8))
      : null;

    const targetCustomerId =
      resolvedCustomerId || targetOrder?.customerId || null;

    // Collect candidate identifiers from customerDoc, route params, targetOrder, AND any orders already linked to targetCustomerId
    const targetPhoneDigitsSet = new Set<string>();
    const targetEmailSet = new Set<string>();
    const targetNameSet = new Set<string>();

    const addPhone = (p?: string | null) => {
      if (!p) return;
      const digits = p.replace(/\D/g, "");
      const clean = digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
      if (clean && clean.length >= 7) {
        targetPhoneDigitsSet.add(clean);
      }
    };

    const addEmail = (e?: string | null) => {
      if (!e) return;
      const clean = e.trim().toLowerCase();
      if (clean && clean.includes("@") && !clean.includes("example.com")) {
        targetEmailSet.add(clean);
      }
    };

    const addName = (n?: string | null) => {
      if (!n) return;
      const clean = n.trim().toLowerCase();
      if (clean && clean !== "guest customer" && clean !== "guest") {
        targetNameSet.add(clean);
      }
    };

    // Add identifiers from customer document & route params
    addPhone(customerDoc?.phone);
    if (isExplicitPhone && phoneParam) addPhone(phoneParam);
    addPhone(targetOrder?.customerPhone);

    addEmail(customerDoc?.email);
    addEmail(targetOrder?.customerEmail);
    if (decodedIdParam.startsWith("email_")) addEmail(decodedIdParam.slice(6));

    addName(`${customerDoc?.firstName || ""} ${customerDoc?.lastName || ""}`);
    addName(targetOrder?.customerName);
    if (decodedIdParam.startsWith("name_")) addName(decodedIdParam.slice(5).replace(/_/g, " "));

    // Also extract identifiers from any orders explicitly linked to targetCustomerId or matching initial phone/email/name
    for (const ord of allOrders) {
      const isLinkedToCustId = targetCustomerId && ord.customerId === targetCustomerId;

      let isPhoneMatch = false;
      if (ord.customerPhone) {
        const ordDigits = ord.customerPhone.replace(/\D/g, "");
        const cleanOrdDigits = ordDigits.length > 10 && ordDigits.startsWith("91") ? ordDigits.slice(2) : ordDigits;
        if (cleanOrdDigits) {
          for (const tp of Array.from(targetPhoneDigitsSet)) {
            if (cleanOrdDigits === tp || cleanOrdDigits.endsWith(tp) || tp.endsWith(cleanOrdDigits)) {
              isPhoneMatch = true;
              break;
            }
          }
        }
      }

      const isEmailMatch = !!ord.customerEmail && targetEmailSet.has(ord.customerEmail.trim().toLowerCase());
      const isNameMatch = !!ord.customerName && targetNameSet.has(ord.customerName.trim().toLowerCase());

      if (isLinkedToCustId || isPhoneMatch || isEmailMatch || isNameMatch) {
        addPhone(ord.customerPhone);
        addEmail(ord.customerEmail);
        addName(ord.customerName);
      }
    }

    return allOrders.filter((ord) => {
      // Direct customerId match
      if (targetCustomerId && ord.customerId === targetCustomerId) {
        return true;
      }
      if (ord.customerId === decodedIdParam) {
        return true;
      }
      // Match by order ID if key is ordcust_<orderId>
      if (isOrdCust && ord._id === decodedIdParam.slice(8)) {
        return true;
      }
      // Phone number match against target phone set
      if (ord.customerPhone) {
        const ordPhoneDigits = ord.customerPhone.replace(/\D/g, "");
        const cleanOrdDigits = ordPhoneDigits.length > 10 && ordPhoneDigits.startsWith("91") ? ordPhoneDigits.slice(2) : ordPhoneDigits;
        if (cleanOrdDigits) {
          for (const targetPhone of targetPhoneDigitsSet) {
            if (
              cleanOrdDigits === targetPhone ||
              cleanOrdDigits.endsWith(targetPhone) ||
              targetPhone.endsWith(cleanOrdDigits)
            ) {
              return true;
            }
          }
        }
      }
      // Email match against target email set
      if (ord.customerEmail && targetEmailSet.has(ord.customerEmail.trim().toLowerCase())) {
        return true;
      }
      // Name match against target name set
      if (ord.customerName && targetNameSet.has(ord.customerName.trim().toLowerCase())) {
        return true;
      }

      return false;
    });
  }, [
    storeOrdersResponse,
    customerDoc,
    resolvedCustomerId,
    phoneParam,
    isExplicitPhone,
    decodedIdParam,
    isOrdCust,
  ]);

  // 5. Query Organization Queues to show Queue Activity for this customer
  const allQueuesResponse = useQuery(api.organizationQueues.list, {});

  const customerQueueList = useMemo(() => {
    if (!allQueuesResponse || !Array.isArray(allQueuesResponse)) return [];

    const targetPhone = (
      customerDoc?.phone ||
      (isExplicitPhone ? phoneParam : "") ||
      ""
    ).replace(/\D/g, "");
    const targetUserId = resolvedCustomerId ? String(resolvedCustomerId) : "";

    return allQueuesResponse.filter((q) => {
      // Direct userId match
      if (targetUserId && q.userId === targetUserId) return true;
      if (isExplicitPhone && phoneParam && q.userId === phoneParam) return true;
      if (targetPhone && q.userId === targetPhone) return true;

      // Phone match inside userId or notes
      if (targetPhone && targetPhone.length >= 7) {
        if (q.userId) {
          const uDigits = q.userId.replace(/\D/g, "");
          if (
            uDigits &&
            (uDigits.endsWith(targetPhone) || targetPhone.endsWith(uDigits))
          ) {
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
  }, [
    allQueuesResponse,
    customerDoc,
    resolvedCustomerId,
    phoneParam,
    isExplicitPhone,
  ]);

  // UI Tab & Filter States
  const [activeTab, setActiveTab] = useState<"orders" | "surveys" | "queue">(
    "orders",
  );
  const [orderSearch, setOrderSearch] = useState("");
  const [surveySearch, setSurveySearch] = useState("");
  const [isAddressDrawerOpen, setIsAddressDrawerOpen] = useState(false);
  // Pagination state for Orders tab
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10; // rows per page
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // 6. Query Survey Attempts & Customer Ratings
  const customerOrderIds = useMemo(() => {
    return customerOrdersList.map((o) => o._id);
  }, [customerOrdersList]);

  const customerPhoneQueryArg =
    customerDoc?.phone || (isExplicitPhone ? phoneParam : undefined);
  const customerIdQueryArg = resolvedCustomerId
    ? String(resolvedCustomerId)
    : undefined;

  const shouldQuerySurveys = Boolean(
    customerIdQueryArg ||
      customerPhoneQueryArg ||
      customerOrderIds.length > 0
  );

  const customerSurveysRaw = useQuery(
    api.surveyAttempts.listByCustomer,
    shouldQuerySurveys
      ? {
          customerId: customerIdQueryArg,
          customerPhone: customerPhoneQueryArg,
          orderIds: customerOrderIds.length > 0 ? customerOrderIds : undefined,
        }
      : "skip"
  );

  const customerSurveysList = useMemo(() => {
    return (customerSurveysRaw as any[]) || [];
  }, [customerSurveysRaw]);

  const filteredSurveys = useMemo(() => {
    if (!surveySearch.trim()) return customerSurveysList;
    const q = surveySearch.toLowerCase().trim();
    return customerSurveysList.filter((s: any) => {
      const matchSurveyName = s.surveyName?.toLowerCase().includes(q);
      const matchOrderNumber = s.orderNumber?.toLowerCase().includes(q);
      const matchComment = s.overallComment?.toLowerCase().includes(q);
      const matchDishes = s.dishRatings?.some((d: any) =>
        d.dishName?.toLowerCase().includes(q)
      );
      return matchSurveyName || matchOrderNumber || matchComment || matchDishes;
    });
  }, [customerSurveysList, surveySearch]);

  const customerSurveysSummary = useMemo(() => {
    const list = customerSurveysList;
    const totalSurveys = list.length;
    const ratedSurveys = list.filter(
      (s: any) => s.overallRating !== null && s.overallRating !== undefined
    );
    const avgScore =
      ratedSurveys.length > 0
        ? ratedSurveys.reduce(
            (sum: number, s: any) => sum + s.overallRating,
            0
          ) / ratedSurveys.length
        : null;

    let totalDishesRated = 0;
    let positiveRatingsCount = 0;
    let totalRatingsCount = 0;
    let latestFeedbackText: string | null = null;
    const ratingDistribution: Record<number, number> = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    for (const s of list) {
      if (s.dishRatings && Array.isArray(s.dishRatings)) {
        totalDishesRated += s.dishRatings.length;
      }
      if (s.overallRating) {
        totalRatingsCount++;
        const rounded = Math.min(
          5,
          Math.max(1, Math.round(s.overallRating))
        );
        ratingDistribution[rounded] = (ratingDistribution[rounded] || 0) + 1;
        if (s.overallRating >= 4) positiveRatingsCount++;
      }
      if (!latestFeedbackText && s.overallComment && s.overallComment.trim()) {
        latestFeedbackText = s.overallComment.trim();
      }
    }

    const positivePercentage =
      totalRatingsCount > 0
        ? Math.round((positiveRatingsCount / totalRatingsCount) * 100)
        : null;

    return {
      totalSurveys,
      totalRatingsCount,
      averageRating: avgScore,
      ratingDistribution,
      totalDishesRated,
      positivePercentage,
      latestFeedbackText,
    };
  }, [customerSurveysList]);

  // Display fields
  const fullName = customerDoc
    ? `${customerDoc.firstName || ""} ${customerDoc.lastName || ""}`.trim()
    : "";

  const firstOrderWithName = customerOrdersList.find(
    (o) =>
      o.customerName &&
      o.customerName.trim() !== "" &&
      o.customerName.trim() !== "Guest Customer",
  );
  const firstOrderWithPhone = customerOrdersList.find(
    (o) => o.customerPhone && o.customerPhone.trim() !== "",
  );
  const firstOrderWithEmail = customerOrdersList.find(
    (o) => o.customerEmail && o.customerEmail.trim() !== "",
  );

  const nameFromParam = decodedIdParam.startsWith("name_")
    ? decodedIdParam
        .slice(5)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase())
    : "";

  const displayName =
    fullName ||
    firstOrderWithName?.customerName?.trim() ||
    nameFromParam ||
    "Guest Customer";

  const rawPhone =
    customerDoc?.phone ||
    phoneParam ||
    firstOrderWithPhone?.customerPhone ||
    "";
  const formattedPhone = rawPhone
    ? formatPhoneNumberWithCountryCode(
        rawPhone,
        customerDoc?.countryCode || storePhoneCode,
      )
    : "—";

  const emailDisplay =
    customerDoc?.email || firstOrderWithEmail?.customerEmail?.trim() || "";

  const initials = (() => {
    const clean = displayName.replace(/[^a-zA-Z\s]/g, "").trim();
    if (!clean) return "GC";
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2)
      return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0].toUpperCase();
  })();

  // Filter Orders in Orders Tab search
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return customerOrdersList;
    const term = orderSearch.toLowerCase().trim();
    return customerOrdersList.filter((o) => {
      const orderNum = (o.orderNumber || o._id || "").toLowerCase();
      const type = (o.orderType || "").toLowerCase();
      const itemsNames = o.items && Array.isArray(o.items)
        ? o.items.map((i: any) => i.itemName || "").join(" ").toLowerCase()
        : "";
      const itemsSummary = (o.itemsSummary || "").toLowerCase();
      return (
        orderNum.includes(term) ||
        type.includes(term) ||
        itemsNames.includes(term) ||
        itemsSummary.includes(term)
      );
    });
  }, [customerOrdersList, orderSearch]);

  // Paginated slice of filtered orders
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage]);

  // Total pages for pagination UI
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  // Real Calculated Metrics
  const totalSpend = useMemo(() => {
    return customerOrdersList.reduce(
      (acc, o) => acc + (o.totalAmount || 0) / 100,
      0,
    );
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
            ]
              .filter(Boolean)
              .join(", "),
          });
        }
      }
    }
    return list;
  }, [customerOrdersList]);

  // Total unique address count (combined saved userAddresses + historical order addresses)
  const addressCount = useMemo(() => {
    const dbAddresses = customerAddresses || [];
    const seen = new Set(
      dbAddresses.map(
        (a) =>
          `${(a.addressLine1 || "").toLowerCase().trim().replace(/\s+/g, " ")}_${(a.city || "").toLowerCase().trim()}`,
      ),
    );

    let count = dbAddresses.length;
    for (const fb of orderAddresses) {
      const key = `${(fb.addressLine1 || "").toLowerCase().trim().replace(/\s+/g, " ")}_${(fb.city || "").toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        count++;
      }
    }
    return count;
  }, [customerAddresses, orderAddresses]);

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
  const averageOrderValue =
    totalOrdersCount > 0 ? totalSpend / totalOrdersCount : 0;
  const retentionVal =
    totalOrdersCount > 1
      ? Math.min(100, Number(((totalOrdersCount / 12) * 100).toFixed(2)))
      : 0;

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
        <div className="flex-1 p-8 bg-[#fff8f5] flex items-center justify-center  text-stone-500">
          Loading customer profile...
        </div>
      </PosShell>
    );
  }

  return (
    <PosShell title={`Customer - ${displayName}`}>
      <div className="flex-1 overflow-y-auto bg-[#fff8f5] p-3.5 sm:p-6 lg:p-8">
        <div className="w-full flex flex-col gap-4 sm:gap-6">
          {/* Breadcrumb & Back Action */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => router.push("/customers")}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer shrink-0"
            >
              <span>←</span>
              <span>Back to Customers</span>
            </button>
            <div className="flex items-center gap-1.5 text-xs text-stone-500 min-w-0">
              <span
                onClick={() => router.push("/customers")}
                className="cursor-pointer hover:underline shrink-0"
              >
                Customers
              </span>
              <span>›</span>
              <span className="text-stone-900 font-semibold truncate max-w-[170px] xs:max-w-[220px] sm:max-w-xs md:max-w-none">
                {displayName}
                {formattedPhone !== "—" ? ` (${formattedPhone})` : ""}
              </span>
            </div>
          </div>

          {/* Guest Profile Header Badge */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-stone-900 flex items-center justify-center font-serif text-lg sm:text-2xl shrink-0">
                {initials}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl text-stone-900 leading-tight">
                    {displayName}
                  </h1>
                  <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-stone-900 text-white text-[9px] sm:text-[10px] uppercase font-semibold tracking-wider shrink-0">
                    {totalOrdersCount >= 5 ? "VIP REGULAR" : "STANDARD GUEST"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-stone-500 text-xs font-medium mt-0.5">
                  {formattedPhone !== "—" && (
                    <span className="inline-flex items-center gap-1 text-stone-900 shrink-0">
                      <span className="text-emerald-600 text-sm">✓</span>
                      <span>{formattedPhone}</span>
                    </span>
                  )}
                  {emailDisplay && (
                    <>
                      {formattedPhone !== "—" && <span className="text-stone-300">•</span>}
                      <span className="text-stone-600 truncate max-w-[180px] sm:max-w-xs">{emailDisplay}</span>
                    </>
                  )}
                  {formattedPhone !== "—" && <span className="text-stone-300">•</span>}
                  <span className="text-stone-600 shrink-0">Prefers {topOrderType}</span>
                </div>
              </div>
            </div>

            {/* Header Right Action: View Addresses Drawer */}
            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setIsAddressDrawerOpen(true)}
                className="w-full md:w-auto justify-center inline-flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-stone-800 text-xs font-semibold hover:bg-stone-200 transition-colors cursor-pointer"
              >
                <span>📍</span>
                <span>View addresses ({addressCount} saved)</span>
              </button>
            </div>
          </div>

          {/* Profile Summary Metrics Grid (Responsive 2 cols on mobile/fold, 3 on tablet, 6 on desktop) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Total Spend
              </span>
              <span className="font-serif text-lg sm:text-xl font-medium text-stone-900 mt-1">
                {currencySymbol}
                {formatCurrencyAmount(totalSpend, activeOrg?.country)}
              </span>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Total Orders
              </span>
              <span className="font-serif text-lg sm:text-xl font-medium text-stone-900 mt-1">
                {totalOrdersCount}
              </span>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Average Value
              </span>
              <span className="font-serif text-lg sm:text-xl font-medium text-stone-900 mt-1">
                {currencySymbol}
                {formatCurrencyAmount(averageOrderValue, activeOrg?.country)}
              </span>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Surveys Done
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-serif text-lg sm:text-xl font-medium text-stone-900">
                  {customerSurveysSummary.totalSurveys}
                </span>
                {customerSurveysSummary.averageRating !== null ? (
                  <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] sm:text-[11px] font-bold">
                    <span className="text-amber-500">★</span>
                    <span>{customerSurveysSummary.averageRating.toFixed(1)}</span>
                  </span>
                ) : (
                  <span className="px-1.5 sm:px-2 py-0.5 rounded bg-stone-100 text-stone-500 text-[8px] sm:text-[9px] uppercase font-semibold tracking-wider">
                    {customerSurveysSummary.totalSurveys > 0 ? "Rated" : "Pending"}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Order Type
              </span>
              <span className="font-serif text-lg sm:text-xl font-medium text-stone-900 mt-1 truncate">
                {topOrderType}
              </span>
            </div>

            <div className="bg-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Retention
              </span>
              <span className="font-serif text-lg sm:text-xl font-medium text-stone-900 mt-1">
                {retentionVal > 0 ? `${retentionVal}%` : "—"}
              </span>
            </div>
          </div>

          {/* Customer Information Card */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
              <h2 className="font-serif text-base sm:text-lg text-stone-900">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-5 pt-1">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Full Name
                </span>
                <span className="text-xs sm:text-sm text-stone-900 font-medium mt-1 truncate">
                  {displayName}
                </span>
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Email Address
                </span>
                <span className="text-xs sm:text-sm text-stone-900 font-medium mt-1 break-words truncate">
                  {emailDisplay || "—"}
                </span>
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Phone
                </span>
                <span className="text-xs sm:text-sm text-stone-900 font-medium mt-1 break-words truncate">
                  {formattedPhone}
                </span>
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  First Visited
                </span>
                <span className="text-xs sm:text-sm text-stone-900 mt-1">
                  {formatStoreDate(
                    earliestVisitDate,
                    activeOrg?.country,
                    storeTimezone,
                  )}
                </span>
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Customer Since
                </span>
                <span className="text-xs sm:text-sm text-stone-900 mt-1">
                  {formatStoreDate(
                    earliestVisitDate,
                    activeOrg?.country,
                    storeTimezone,
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Section with Tabs */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            {/* Tabs Header */}
            <div className="flex items-center gap-3 sm:gap-6 px-4 sm:px-6 pt-3 sm:pt-4 bg-[#faf2ee]/50 border-b border-stone-200 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className={`pb-3 sm:pb-3.5 font-medium text-xs sm:text-sm transition-all flex items-center gap-2 border-b-2 cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === "orders"
                    ? "border-stone-900 text-stone-900 font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>Orders</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${
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
                className={`pb-3 sm:pb-3.5 font-medium text-xs sm:text-sm transition-all flex items-center gap-2 border-b-2 cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === "surveys"
                    ? "border-stone-900 text-stone-900 font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>Surveys</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                    activeTab === "surveys"
                      ? "bg-stone-900 text-white"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {customerSurveysSummary.totalSurveys}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`pb-3 sm:pb-3.5 font-medium text-xs sm:text-sm transition-all flex items-center gap-2 border-b-2 cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === "queue"
                    ? "border-stone-900 text-stone-900 font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <span>Queue Activity</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                  Coming Soon
                </span>
              </button>
            </div>

            {/* Tab 1: Orders */}
            {activeTab === "orders" && (
              <div className="p-3.5 sm:p-6 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
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
                  <div className="text-xs text-stone-500">
                    Showing {filteredOrders.length} orders
                  </div>
                </div>

                <div className="overflow-x-auto border border-stone-200 rounded-xl">
                  <table className="w-full min-w-[620px] text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#faf2ee] text-stone-600 text-[11px] font-semibold uppercase tracking-wider border-b border-stone-200">
                        <th className="py-3 px-4 font-semibold">Order ID</th>
                        <th className="py-3 px-4 font-semibold">Date & Time</th>
                        <th className="py-3 px-4 font-semibold">Order Type</th>
                        <th className="py-3 px-4 font-semibold">
                          Items Summary
                        </th>
                        <th className="py-3 px-4 font-semibold">Amount</th>
                        <th className="py-3 px-4 font-semibold text-right">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-stone-800">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-stone-400 "
                          >
                            No orders found for this customer.
                          </td>
                        </tr>
                      ) : (
                        paginatedOrders.map((ord) => (
                          <tr
                            key={ord._id}
                            className="hover:bg-[#faf2ee]/40 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-semibold text-stone-900 text-sm">
                              {ord.orderNumber || (ord._id ? `#${ord._id.slice(-4).toUpperCase()}` : "—")}
                            </td>
                            <td className="py-3.5 px-4 text-stone-600">
                              {formatStoreDateTime(
                                ord.createdAt,
                                activeOrg?.country,
                                storeTimezone,
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {ord.orderType === "ScheduledDelivery" ||
                              ord.orderType === "ScheduledPickup" ||
                              (ord as any).scheduledDeliveryDate ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 font-semibold border border-amber-200 text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  {ord.orderType === "ScheduledDelivery"
                                    ? "Scheduled Delivery"
                                    : ord.orderType === "ScheduledPickup"
                                    ? "Scheduled Pickup"
                                    : ord.orderType}
                                  {((ord as any).scheduledDeliveryDate || (ord as any).scheduledDeliveryTime) && (
                                    <span className="text-[10px] text-amber-700 font-normal">
                                      ({(ord as any).scheduledDeliveryDate || ""} {(ord as any).scheduledDeliveryTime || ""})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-stone-100 text-stone-800 font-medium border border-stone-200">
                                  {ord.orderType || "Dine In"}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 max-w-xs truncate text-stone-700" title={
                                ord.items && Array.isArray(ord.items) && ord.items.length > 0
                                  ? ord.items.map((i: any) => `${i.quantity}x ${i.itemName}`).join(", ")
                                  : ord.itemsSummary || undefined
                              }>
                              {ord.items && Array.isArray(ord.items) && ord.items.length > 0
                                ? ord.items.map((i: any) => `${i.quantity}x ${i.itemName}`).join(", ")
                                : ord.itemsSummary || "—"}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-stone-900 text-sm">
                              {currencySymbol}
                              {formatCurrencyAmount(
                                (ord.totalAmount || 0) / 100,
                                activeOrg?.country,
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {(() => {
                                const statusName =
                                  ord.orderStatusName ||
                                  (ord.isCompleted
                                    ? "Completed"
                                    : ord.isRejected
                                      ? "Cancelled"
                                      : "Accepted");

                                const matchedProcess = dbProcesses?.find(
                                  (p) =>
                                    p._id === ord.orderStatusId ||
                                    (p.name || "").trim().toLowerCase() ===
                                      (statusName || "").trim().toLowerCase(),
                                );

                                const dotColor =
                                  matchedProcess?.processColor ||
                                  (statusName === "Cancelled" ||
                                  statusName === "Cancelled / Refunded" ||
                                  ord.isRejected
                                    ? "#e11d48"
                                    : statusName === "Completed" ||
                                      statusName === "Delivered" ||
                                      ord.isCompleted
                                      ? "#219653"
                                      : statusName === "Ready to deliver" ||
                                        statusName === "Ready to Serve"
                                        ? "#FC8019"
                                        : statusName === "In progress" ||
                                          statusName === "Cooking & Plating"
                                          ? "#EA9C1B"
                                          : "#262626");

                                return (
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
                                    style={{
                                      backgroundColor: `${dotColor}12`,
                                      borderColor: `${dotColor}35`,
                                      color: dotColor,
                                    }}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        statusName === "In progress" ? "animate-pulse" : ""
                                      }`}
                                      style={{ backgroundColor: dotColor }}
                                    />
                                    <span>{statusName}</span>
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination Footer */}
                {filteredOrders.length > pageSize && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 bg-[#faf2ee]/40 border-t border-stone-200 text-xs text-stone-600">
                    <span className="text-center sm:text-left">
                      Showing{' '}
                      <span className="font-semibold text-stone-900">
                        {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredOrders.length)}
                      </span>{' '}
                      of{' '}
                      <span className="font-semibold text-stone-900">{filteredOrders.length}</span>{' '}
                      orders
                    </span>
                    <div className="flex items-center flex-wrap justify-center gap-1 text-xs font-medium">
                      <button
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 sm:px-3 py-1 rounded-full bg-white text-stone-600 hover:text-stone-900 border border-stone-200 disabled:opacity-40 cursor-pointer"
                      >
                        Previous
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-full font-semibold flex items-center justify-center cursor-pointer ${
                            currentPage === p
                              ? 'bg-stone-900 text-white'
                              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="px-2.5 sm:px-3 py-1 rounded-full bg-white text-stone-600 hover:text-stone-900 border border-stone-200 disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Surveys & Customer Feedback */}
            {activeTab === "surveys" && (
              <div className="p-3.5 sm:p-6 flex flex-col gap-5">
                {/* 1. Overall Survey Summary Panel */}
                <div className="bg-linear-to-br from-[#faf7f5] to-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
                  {/* Left: Overall Score & Visual Rating */}
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    <div className="flex flex-col">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500">
                        Overall Guest Rating
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">
                          {customerSurveysSummary.averageRating !== null
                            ? customerSurveysSummary.averageRating.toFixed(1)
                            : "—"}
                        </span>
                        <span className="text-xs text-stone-500 font-medium">
                          / 5.0
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <StarRatingDisplay
                          score={customerSurveysSummary.averageRating ?? 0}
                        />
                      </div>
                      <span className="text-[11px] text-stone-500 mt-1">
                        {customerSurveysSummary.totalRatingsCount > 0
                          ? `Based on ${customerSurveysSummary.totalRatingsCount} verified rating${
                              customerSurveysSummary.totalRatingsCount > 1 ? "s" : ""
                            }`
                          : "No star ratings submitted yet"}
                      </span>
                    </div>

                    <div className="h-16 w-px bg-stone-200 hidden sm:block" />

                    {/* Sentiment & Status Pill */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500">
                        Guest Sentiment
                      </span>
                      {customerSurveysSummary.averageRating !== null ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>
                            {customerSurveysSummary.averageRating >= 4.5
                              ? "Outstanding Experience"
                              : customerSurveysSummary.averageRating >= 3.8
                              ? "Very Positive Dining"
                              : customerSurveysSummary.averageRating >= 3.0
                              ? "Satisfactory / Average"
                              : "Needs Attention / Follow-up"}
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                          <span>Awaiting First Review</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Key Summary Statistics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-stone-200">
                    <div className="bg-white p-3 rounded-xl border border-stone-200 flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        Surveys Taken
                      </span>
                      <span className="font-serif text-lg font-bold text-stone-900 mt-0.5">
                        {customerSurveysSummary.totalSurveys}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-stone-200 flex flex-col">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        Dishes Evaluated
                      </span>
                      <span className="font-serif text-lg font-bold text-stone-900 mt-0.5">
                        {customerSurveysSummary.totalDishesRated}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-stone-200 flex flex-col col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        Positive Ratio
                      </span>
                      <span className="font-serif text-lg font-bold text-stone-900 mt-0.5">
                        {customerSurveysSummary.positivePercentage !== null
                          ? `${customerSurveysSummary.positivePercentage}%`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Latest Quote / Voice of Customer (if any verbatim was left) */}
                {customerSurveysSummary.latestFeedbackText && (
                  <div className="bg-amber-50/60 rounded-xl p-3.5 sm:p-4 border border-amber-200/80 flex items-start gap-3">
                    <span className="text-xl leading-none text-amber-600 shrink-0 select-none">
                      “
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800">
                        Latest Guest Feedback
                      </span>
                      <p className="text-xs sm:text-sm text-stone-800 italic mt-0.5 leading-relaxed">
                        {customerSurveysSummary.latestFeedbackText}
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. Survey History Search & List */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
                  <div className="relative w-full sm:w-80">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={surveySearch}
                      onChange={(e) => setSurveySearch(e.target.value)}
                      placeholder="Search surveys by name, order, dish or comment..."
                      className="w-full bg-[#faf2ee] text-stone-900 text-xs pl-10 pr-4 py-2 rounded-full border border-stone-200 focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div className="text-xs text-stone-500">
                    Showing {filteredSurveys.length} of{" "}
                    {customerSurveysList.length} survey responses
                  </div>
                </div>

                {/* Survey Cards Feed */}
                {filteredSurveys.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {filteredSurveys.map((survey: any) => {
                      return (
                        <div
                          key={survey.attemptId}
                          className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs flex flex-col gap-4 hover:border-stone-300 transition-colors"
                        >
                          {/* Card Header */}
                          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-stone-100">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-serif text-base sm:text-lg font-bold text-stone-900">
                                  {survey.surveyName || "Guest Dining Feedback"}
                                </h4>
                                {survey.flaggedForMeeting && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <span>🚨</span>
                                    <span>Flagged for Meeting</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-stone-500 mt-0.5">
                                Submitted{" "}
                                {formatStoreDateTime(
                                  survey.submittedAt || survey.attemptedDate,
                                  activeOrg?.country,
                                  storeTimezone
                                )}
                              </span>
                            </div>

                            {/* Order Context Tag & Link */}
                            {survey.orderId && (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#faf2ee] text-stone-800 border border-stone-200">
                                  <span>Order #{survey.orderNumber || "—"}</span>
                                  {survey.orderType && (
                                    <>
                                      <span className="text-stone-300">•</span>
                                      <span>{survey.orderType}</span>
                                    </>
                                  )}
                                  {survey.tableNumber && (
                                    <>
                                      <span className="text-stone-300">•</span>
                                      <span>Table {survey.tableNumber}</span>
                                    </>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    router.push(
                                      `/orders/${survey.orderId}/review`
                                    )
                                  }
                                  className="text-xs font-semibold text-stone-700 hover:text-stone-900 underline underline-offset-4 cursor-pointer hidden sm:inline-block"
                                >
                                  View Order Audit →
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Overall Star Rating Banner (if given) */}
                          {survey.overallRating !== null &&
                            survey.overallRating !== undefined && (
                              <div className="bg-[#faf2ee]/70 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                                    Overall Experience:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <StarRatingDisplay
                                      score={survey.overallRating}
                                    />
                                    <span className="text-sm font-bold text-stone-900">
                                      {survey.overallRating} / 5
                                    </span>
                                  </div>
                                </div>
                                <span className="text-xs text-stone-500 font-medium">
                                  {survey.overallRating === 5
                                    ? "Outstanding ⭐⭐⭐⭐⭐"
                                    : survey.overallRating >= 4
                                    ? "Very Good"
                                    : survey.overallRating >= 3
                                    ? "Average"
                                    : "Below Expectation"}
                                </span>
                              </div>
                            )}

                          {/* Dishes Evaluated Grid */}
                          {survey.dishRatings &&
                            survey.dishRatings.length > 0 && (
                              <div className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                                  Dishes Evaluated ({survey.dishRatings.length})
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                  {survey.dishRatings.map(
                                    (dish: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="bg-stone-50 rounded-xl p-2.5 border border-stone-200/80 flex flex-col justify-between"
                                      >
                                        <div className="flex items-start justify-between gap-1.5">
                                          <span className="text-xs font-semibold text-stone-900 truncate">
                                            {dish.dishName}
                                          </span>
                                          {dish.rating && (
                                            <div className="flex items-center text-amber-500 shrink-0 text-xs font-bold">
                                              <span>★</span>
                                              <span className="text-stone-800 ml-0.5">
                                                {dish.rating}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        {dish.comment ? (
                                          <p className="text-[11px] text-stone-600 italic mt-1.5 leading-snug">
                                            “{dish.comment}”
                                          </p>
                                        ) : (
                                          <span className="text-[10px] text-stone-400 mt-1">
                                            No written critique
                                          </span>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Specific Questionnaire Answers */}
                          {survey.questionnaireResponses &&
                            survey.questionnaireResponses.filter(
                              (q: any) =>
                                q.questionType !== "numeric" ||
                                (!q.orderItemId && !q.orderItemName)
                            ).length > 0 && (
                              <div className="flex flex-col gap-2 pt-1 border-t border-stone-100">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                                  Survey Inquiries &amp; Answers
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {survey.questionnaireResponses
                                    .filter(
                                      (q: any) =>
                                        q.questionType !== "numeric" ||
                                        (!q.orderItemId && !q.orderItemName)
                                    )
                                    .map((resp: any, qIdx: number) => (
                                      <div
                                        key={qIdx}
                                        className="bg-[#faf7f5] rounded-xl p-3 border border-stone-200/60 flex flex-col justify-between"
                                      >
                                        <span className="text-xs font-medium text-stone-700">
                                          {resp.questionText}
                                        </span>
                                        <div className="mt-1.5">
                                          {resp.selectedOptions &&
                                          resp.selectedOptions.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                              {resp.selectedOptions.map(
                                                (
                                                  opt: string,
                                                  optIdx: number
                                                ) => (
                                                  <span
                                                    key={optIdx}
                                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-stone-900 text-white"
                                                  >
                                                    {opt}
                                                  </span>
                                                )
                                              )}
                                            </div>
                                          ) : resp.answerText ? (
                                            <span className="text-xs text-stone-900 font-medium">
                                              {resp.answerText}
                                            </span>
                                          ) : resp.numericValue ? (
                                            <span className="text-xs text-stone-900 font-bold">
                                              {resp.numericValue} / 5
                                            </span>
                                          ) : (
                                            <span className="text-xs text-stone-400 italic">
                                              No answer provided
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                          {/* Customer General Feedback Verbatim */}
                          {survey.overallComment && (
                            <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-200/60 flex flex-col">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                General Written Feedback
                              </span>
                              <p className="text-xs text-stone-800 italic mt-1 leading-relaxed">
                                “{survey.overallComment}”
                              </p>
                            </div>
                          )}

                          {/* Mobile link to order review */}
                          {survey.orderId && (
                            <div className="pt-1 flex sm:hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/orders/${survey.orderId}/review`
                                  )
                                }
                                className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold"
                              >
                                View Order Review Details →
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : customerSurveysList.length > 0 ? (
                  /* Empty state for search query with no matches */
                  <div className="p-8 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-2xl">🔍</span>
                    <span className="text-sm font-semibold text-stone-800">
                      No matching survey responses
                    </span>
                    <p className="text-xs text-stone-500">
                      Try adjusting your search terms
                    </p>
                    <button
                      type="button"
                      onClick={() => setSurveySearch("")}
                      className="mt-1 text-xs font-bold text-stone-900 underline"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  /* Empty state when customer has not taken any surveys yet */
                  <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-2xl shadow-xs">
                      📋
                    </div>
                    <h3 className="font-serif text-xl font-normal text-stone-900 mt-1">
                      No Survey Responses Yet
                    </h3>
                    <p className="text-xs text-stone-500 max-w-md leading-relaxed">
                      This customer has not submitted any dining reviews or survey responses yet. When they complete a post-dining feedback survey from their order receipt or digital bill, their overall ratings, dish critiques, and survey responses will appear here.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Queue Activity (Coming Soon) */}
            {activeTab === "queue" && (
              <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-2xl shadow-xs">
                  👥
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#fffbeb] text-[#b45309] border border-[#fde68a]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                  Coming Soon
                </div>
                <h3 className="font-serif text-xl font-normal text-stone-900 mt-1">
                  Queue Activity
                </h3>
                <p className="text-xs text-stone-500 max-w-md leading-relaxed">
                  Customer waitlist and queue activity tracking features are currently in development and will be available soon.
                </p>
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
