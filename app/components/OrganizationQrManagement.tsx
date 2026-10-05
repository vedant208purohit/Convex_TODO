"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DynamicQrCode } from "./DynamicQrCode";
import { TableQrAnalyticsDetail } from "./TableQrAnalyticsDetail";
import { QrPerformanceDashboard } from "./QrPerformanceDashboard";

// ==========================================
// PIXEL-PERFECT SVG ICONS (PREST THEME)
// ==========================================

function QrCodeIcon({
  className = "w-5 h-5",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M7 7h.01M18 7h.01M7 18h.01" />
    </svg>
  );
}

function PlusIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SearchIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronDownIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function GridViewIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListViewIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function TableRestaurantIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 2v20M18 2a4 4 0 0 0-4 4v4h4" />
      <path d="M6 2v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" />
      <path d="M8 11v11" />
    </svg>
  );
}

function DeckIcon({
  className = "w-5 h-5",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12h18" />
      <path d="M12 2v10" />
      <path d="m5 12 7-10 7 10" />
      <path d="m8 12-3 8" />
      <path d="m16 12 3 8" />
    </svg>
  );
}

function MoreHorizIcon({
  className = "w-5 h-5",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function CopyIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function TrashIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function PrintIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  );
}

function StatsIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function PowerIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

function CheckCircleIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function BlockIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

function CloseIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TakeawayIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function DeliveryIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.24-4.05A1 1 0 0 0 18 8h-3v10" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

function ScheduleIcon({
  className = "w-4 h-4",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

interface TableItem {
  id: string;
  name: string;
  seats: number;
  placement?: string;
  status: "Active" | "Inactive" | "Pending QR";
  isGenerated: boolean;
  qrId?: string;
  qrUrl?: string;
  qrType?: string;
  scansToday?: number;
  avgDwellMinutes?: number;
}

export function OrganizationQrManagement() {
  // Query organizations & real Convex tables & QR data
  const organizations = useQuery(api.organizations.list);
  const activeOrg =
    organizations && organizations.length > 0 ? organizations[0] : null;

  // Real convex table list
  const realTables = useQuery(api.organizationTables.list, {});

  // Dynamic list of unique real placements from database
  const availablePlacements = useMemo(() => {
    if (!realTables || realTables.length === 0) return [];
    const set = new Set<string>();
    realTables.forEach((t) => {
      if (t.placement && t.placement.trim()) {
        set.add(t.placement.trim());
      }
    });
    return Array.from(set);
  }, [realTables]);

  // Real created QR codes from database
  const convexQrCodes = useQuery(api.organizationQrCodes.list, {});

  // Real convex QR analytics list
  const convexQrData = useQuery(
    api.organizationQrAnalytics.listPaginated,
    activeOrg ? { outletId: activeOrg._id } : "skip",
  );

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const todayPerformance = useQuery(
    api.organizationQrAnalytics.getOverallPerformance,
    activeOrg ? { outletId: activeOrg._id, from: todayStr, to: todayStr } : "skip",
  );

  const todayTrafficSessions = todayPerformance?.summary?.sessions ?? 0;

  const enableMutation = useMutation(api.organizationQrCodes.enable);
  const disableMutation = useMutation(api.organizationQrCodes.disable);
  const softDeleteMutation = useMutation(api.organizationQrCodes.remove);
  const createSingleMutation = useMutation(api.organizationQrCodes.create);
  const createBatchMutation = useMutation(api.organizationQrCodes.createBatch);
  const recordScanMutation = useMutation(
    api.organizationQrCustomerJourney.recordScan,
  );

  // State variables
  const [activeMainTab, setActiveMainTab] = useState<"fleet" | "performance">(
    "fleet",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [viewingAnalyticsTableId, setViewingAnalyticsTableId] = useState<
    string | null
  >(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTableIdInModal, setSelectedTableIdInModal] =
    useState<string>("");
  const [selectedQrTypeInModal, setSelectedQrTypeInModal] = useState<
    "DineIn" | "TakeAway" | "Delivery" | "Queue"
  >("DineIn");
  const [newTableName, setNewTableName] = useState("");
  const [newCapacity, setNewCapacity] = useState(4);
  const [newPlacement, setNewPlacement] = useState("");
  const [viewingQrModalTable, setViewingQrModalTable] =
    useState<TableItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Direct customer storefront base URL
  const storeSlug = activeOrg?.slug || "balwant-new";
  const customerBaseUrl =
    process.env.NEXT_PUBLIC_DIGITAL_STORE_BASE_URL ||
    "https://dev-pos-user.get-prest.com/store";

  // Organization Feature Flags
  const orgIsDineIn = activeOrg?.isDineIn !== false;
  const orgIsTakeAway = activeOrg?.isTakeAway !== false;
  const orgIsDelivery = activeOrg?.isDelivery !== false;
  const orgScheduledPickup = activeOrg?.scheduledPickup !== false;

  // Helper to format table name without prepending static TABLE string
  const formatTableName = (raw: string) => {
    if (!raw || !raw.trim()) return "Table";
    return raw.trim();
  };

  // Helper to format QR URLs with dynamic store slug
  const buildDynamicCustomerQrUrl = useCallback(
    (
      rawUrl: string | undefined,
      qrId: string,
      qrType: string,
      displayName?: string,
      tableId?: string,
    ): string => {
      if (!qrId) return "";
      const base = customerBaseUrl.split("?")[0];
      const params = new URLSearchParams();

      // Always set store parameter dynamically using active storeSlug
      if (storeSlug) {
        params.set("store", storeSlug);
      }

      // Preserve any additional existing query params from DB URL
      if (rawUrl && rawUrl.includes("?")) {
        const existingSearch = rawUrl.substring(rawUrl.indexOf("?"));
        const existingParams = new URLSearchParams(existingSearch);
        existingParams.forEach((val, key) => {
          if (key !== "store") {
            params.set(key, val);
          }
        });
      }

      // Ensure required core parameters
      params.set("qr_id", qrId);
      params.set("type", qrType);
      if (displayName && !params.has("qr_name")) {
        params.set("qr_name", displayName);
      }
      if (tableId && !params.has("table_id")) {
        params.set("table_id", tableId);
      }

      return `${base}?${params.toString()}`;
    },
    [customerBaseUrl, storeSlug],
  );

  // Convert real database tables AND standalone channel QRs into TableItem list
  const tablesList: TableItem[] = useMemo(() => {
    const list: TableItem[] = [];

    // 1. Map Dine-In Tables
    if (realTables && realTables.length > 0) {
      realTables.forEach((t) => {
        const rawNum = t.tableNumber;
        const displayName = formatTableName(rawNum);

        const matchingQr: any =
          convexQrCodes?.find(
            (q) =>
              q.tableId === t._id ||
              (q.name &&
                q.name.toLowerCase().includes(displayName.toLowerCase())),
          ) || convexQrData?.items?.find((r: any) => r.table?.id === t._id);

        const isGenerated = Boolean(matchingQr);
        const qrDocId = (matchingQr?._id || matchingQr?.qrId || "") as string;
        const qrTypeVal = matchingQr?.qrType || "DineIn";
        const rawMatchingUrl = matchingQr?.qrUrl || "";
        const qrUrl =
          isGenerated && qrDocId
            ? buildDynamicCustomerQrUrl(
                rawMatchingUrl,
                qrDocId,
                qrTypeVal,
                displayName,
                t._id,
              )
            : undefined;

        list.push({
          id: t._id,
          name: displayName,
          seats: t.seatingCapacity || 4,
          placement: t.placement || undefined,
          status: isGenerated
            ? matchingQr?.status === "INACTIVE" || t.isBlock
              ? "Inactive"
              : "Active"
            : ("Pending QR" as const),
          isGenerated,
          qrId: qrDocId || undefined,
          qrUrl: qrUrl || undefined,
          qrType: qrTypeVal,
          scansToday: matchingQr?.counter ?? matchingQr?.scanCount ?? 0,
          avgDwellMinutes: 0,
        });
      });
    }

    // 2. Map Standalone Non-Table QR Codes (Takeaway, Delivery, Schedule Pickup / Queue)
    if (convexQrCodes && convexQrCodes.length > 0) {
      convexQrCodes.forEach((q: any) => {
        if (!q.tableId && q.deletedAt === undefined) {
          const qrTypeVal = q.qrType || "TakeAway";
          const isInactive = q.status === "INACTIVE";
          const rawQUrl = q.qrUrl || "";
          const qrUrl = buildDynamicCustomerQrUrl(
            rawQUrl,
            q._id,
            qrTypeVal,
            q.displayName || q.name,
          );

          list.push({
            id: q._id,
            name: q.displayName || q.name || `${qrTypeVal} QR`,
            seats: 0,
            placement:
              qrTypeVal === "TakeAway"
                ? "Counter Pickup"
                : qrTypeVal === "Delivery"
                  ? "Dispatch Sticker"
                  : "Scheduled Pickup",
            status: isInactive ? "Inactive" : "Active",
            isGenerated: true,
            qrId: q._id,
            qrUrl,
            qrType: qrTypeVal,
            scansToday: q.counter ?? q.scanCount ?? 0,
            avgDwellMinutes: 0,
          });
        }
      });
    }

    return list;
  }, [realTables, convexQrCodes, convexQrData, buildDynamicCustomerQrUrl]);

  // Selected table for inspector drawer
  const selectedTable = useMemo(() => {
    if (!tablesList || tablesList.length === 0) return null;
    return tablesList.find((t) => t.id === selectedTableId) || tablesList[0];
  }, [tablesList, selectedTableId]);

  // Selected table for full analytics view (Strictly gated to generated & active endpoints)
  const analyticsTable = useMemo(() => {
    if (!viewingAnalyticsTableId) return null;
    const found = tablesList.find((t) => t.id === viewingAnalyticsTableId);
    if (!found) return null;
    if (!found.isGenerated || !found.qrId || found.status !== "Active") {
      return null;
    }
    return found;
  }, [tablesList, viewingAnalyticsTableId]);

  // Filtered tables based on search, status, and qrType
  const filteredTables = useMemo(() => {
    return tablesList.filter((table) => {
      const matchesSearch =
        table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (table.placement &&
          table.placement.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && table.status === "Active") ||
        (statusFilter === "inactive" && table.status === "Inactive") ||
        (statusFilter === "pending" && table.status === "Pending QR");

      const matchesType =
        typeFilter === "all" ||
        (table.qrType &&
          table.qrType.toLowerCase() === typeFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [tablesList, searchQuery, statusFilter, typeFilter]);

  // Counts
  const activeCount = useMemo(
    () => tablesList.filter((t) => t.status === "Active").length,
    [tablesList],
  );
  const inactiveCount = useMemo(
    () => tablesList.filter((t) => t.status === "Inactive").length,
    [tablesList],
  );
  const pendingCount = useMemo(
    () => tablesList.filter((t) => t.status === "Pending QR").length,
    [tablesList],
  );
  const dineInCount = useMemo(
    () =>
      tablesList.filter((t) => !t.qrType || t.qrType.toLowerCase() === "dinein")
        .length,
    [tablesList],
  );
  const takeAwayCount = useMemo(
    () =>
      tablesList.filter(
        (t) => t.qrType && t.qrType.toLowerCase() === "takeaway",
      ).length,
    [tablesList],
  );
  const deliveryCount = useMemo(
    () =>
      tablesList.filter(
        (t) => t.qrType && t.qrType.toLowerCase() === "delivery",
      ).length,
    [tablesList],
  );
  const schedulePickupCount = useMemo(
    () =>
      tablesList.filter(
        (t) =>
          t.qrType &&
          (t.qrType.toLowerCase() === "queue" ||
            t.qrType.toLowerCase() === "schedulepickup"),
      ).length,
    [tablesList],
  );
  const totalScansToday = useMemo(
    () => tablesList.reduce((acc, t) => acc + (t.scansToday || 0), 0),
    [tablesList],
  );

  // Tables eligible for new QR creation in modal (unassigned / pending QR tables + currently selected)
  const pendingTablesForModal = useMemo(() => {
    if (!tablesList || tablesList.length === 0) return [];
    return tablesList.filter(
      (t) => !t.isGenerated || t.id === selectedTableIdInModal,
    );
  }, [tablesList, selectedTableIdInModal]);

  // Check if selected QR channel type in modal already has an active generated QR
  const isTypeAlreadyExists = useMemo(() => {
    if (selectedQrTypeInModal === "TakeAway" && takeAwayCount >= 1) return true;
    if (selectedQrTypeInModal === "Delivery" && deliveryCount >= 1) return true;
    if (selectedQrTypeInModal === "Queue" && schedulePickupCount >= 1) return true;
    return false;
  }, [selectedQrTypeInModal, takeAwayCount, deliveryCount, schedulePickupCount]);

  // Action handlers
  const handleToggleStatus = async (table: TableItem) => {
    const newStatus = table.status === "Active" ? "Inactive" : "Active";

    if (table.qrId && activeOrg) {
      try {
        if (newStatus === "Active") {
          await enableMutation({ id: table.qrId as any });
        } else {
          await disableMutation({ id: table.qrId as any });
        }
      } catch (err) {
        console.error("Convex mutation error:", err);
      }
    }

    showToast(
      `${table.name} QR code ${newStatus === "Active" ? "activated" : "disabled"} successfully.`,
    );
  };

  const handleDeleteQr = async (table: TableItem) => {
    if (!table.qrId) {
      showToast(`No active QR code assigned to ${table.name}.`);
      return;
    }
    try {
      await softDeleteMutation({ id: table.qrId as any });
      showToast(
        `QR Code unlinked & deleted for ${table.name}. Table status reset to Pending QR.`,
      );
    } catch (err: any) {
      showToast(`Error unlinking QR: ${err?.message || "Failed"}`);
    }
  };

  const handleSimulateScan = async (table: TableItem) => {
    if (!table.qrId) {
      showToast(`Table ${table.name} needs a QR code generated first.`);
      return;
    }
    try {
      await recordScanMutation({ qrId: table.qrId as any });
      showToast(
        `Scan event recorded in Convex organizationQrScans for ${table.name}!`,
      );
    } catch (err: any) {
      console.error("Scan mutation error:", err);
      showToast(`Scan logged for ${table.name}`);
    }
  };

  const handleCopyUrl = (url?: string) => {
    if (!url) {
      showToast("Please generate QR code first to get direct URL link.");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    showToast("QR direct link copied to clipboard!");
  };

  const handleOpenGenerateModalForTable = (tableId?: string) => {
    if (tableId) {
      setSelectedTableIdInModal(tableId);
      const targetTable = realTables?.find((t) => t._id === tableId);
      if (targetTable) {
        setNewTableName(formatTableName(targetTable.tableNumber));
        setNewCapacity(targetTable.seatingCapacity || 4);
        setNewPlacement(targetTable.placement || "");
      }
    }
    setIsModalOpen(true);
  };

  const handleDownloadQr = (table?: TableItem | null) => {
    const target = table || selectedTable;
    if (!target) {
      showToast("Please select a valid table QR.");
      return;
    }

    if (target.qrUrl) {
      if (typeof window !== "undefined") {
        window.open(target.qrUrl, "_blank");
      }
    }

    const svgElement =
      document.querySelector("#qr-modal-display svg") ||
      document.querySelector("#qr-inspector-display svg") ||
      document.querySelector("svg");
    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = svgUrl;
      downloadLink.download = `${target.name.replace(/\s+/g, "_")}_QR.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(svgUrl);
      showToast(
        `Opened QR route in new tab & downloaded vector SVG for ${target.name}!`,
      );
    } else if (target.qrUrl) {
      showToast(`Opened digital route for ${target.name} in new tab!`);
    } else {
      window.print();
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDineIn = selectedQrTypeInModal === "DineIn";
    const targetTableObj = isDineIn
      ? realTables?.find((t) => t._id === selectedTableIdInModal)
      : null;

    let defaultFallbackName = "Store QR";
    if (selectedQrTypeInModal === "TakeAway")
      defaultFallbackName = "Takeaway Counter";
    if (selectedQrTypeInModal === "Delivery")
      defaultFallbackName = "Delivery Bag";

    const nameStr =
      newTableName.trim() ||
      (targetTableObj
        ? formatTableName(targetTableObj.tableNumber)
        : defaultFallbackName);

    if (activeOrg) {
      try {
        await createSingleMutation({
          name: nameStr.toLowerCase().endsWith("qr")
            ? nameStr
            : `${nameStr} QR`,
          displayName: nameStr,
          qrType: selectedQrTypeInModal,
          tableId:
            isDineIn && selectedTableIdInModal
              ? selectedTableIdInModal
              : undefined,
          tableNumber: isDineIn ? nameStr : undefined,
          organizationId: activeOrg._id,
        });
        showToast(
          `${nameStr} (${selectedQrTypeInModal}) QR generated and saved to Convex database.`,
        );
      } catch (err: any) {
        console.error("Failed to create QR in Convex:", err);
        showToast(`Error creating QR: ${err?.message || "Failed"}`);
      }
    }

    setIsModalOpen(false);
    setSelectedTableIdInModal("");
    setNewTableName("");
  };

  // Render full table QR analytics detail view if active
  if (analyticsTable) {
    return (
      <TableQrAnalyticsDetail
        table={analyticsTable}
        storeSlug={storeSlug}
        onBack={() => setViewingAnalyticsTableId(null)}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="w-full bg-transparent text-[#1c1b1b] font-sans pb-12">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className="fixed top-20 right-6 z-50 bg-[#141010] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 transition-all animate-bounce"
          style={{ backgroundColor: "#141010", color: "#ffffff" }}
        >
          <CheckCircleIcon
            className="w-5 h-5 text-emerald-400"
            style={{ color: "#34d399", stroke: "#34d399" }}
          />
          <span className="font-semibold text-sm" style={{ color: "#ffffff" }}>
            {toastMessage}
          </span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex flex-col flex-1 space-y-4 w-full">
        {/* Top Header */}
        <div className="border-b border-[#e7e5e4] pb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-garamond text-2xl lg:text-3xl font-normal text-[#141010] leading-tight">
              QR Management
            </h1>
            <p className="text-xs text-[#78716c] mt-1">
              Manage table QRs, channel routing, dynamic digital menus and scan
              analytics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Top View Selector Tabs: QR Fleet vs QR Performance */}
            <div className="flex items-center gap-1 bg-[#fdf8f7] p-1 rounded-xl border border-[#e7e5e4]">
              <button
                type="button"
                onClick={() => setActiveMainTab("fleet")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeMainTab === "fleet"
                    ? "bg-[#141010] text-white shadow-xs"
                    : "text-[#5e5e5e] hover:text-[#141010]"
                }`}
                style={
                  activeMainTab === "fleet"
                    ? { backgroundColor: "#141010", color: "#ffffff" }
                    : undefined
                }
              >
                QR Fleet & Management
              </button>
              <button
                type="button"
                onClick={() => setActiveMainTab("performance")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeMainTab === "performance"
                    ? "bg-[#141010] text-white shadow-xs"
                    : "text-[#5e5e5e] hover:text-[#141010]"
                }`}
                style={
                  activeMainTab === "performance"
                    ? { backgroundColor: "#141010", color: "#ffffff" }
                    : undefined
                }
              >
                <StatsIcon className="w-3.5 h-3.5" />
                <span>QR Performance</span>
              </button>
            </div>

            {activeMainTab === "fleet" && (
              <button
                type="button"
                onClick={() => handleOpenGenerateModalForTable()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#141010] hover:bg-[#2d2622] text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
                style={{ backgroundColor: "#141010", color: "#ffffff" }}
              >
                <PlusIcon
                  className="w-4 h-4 text-white"
                  style={{ color: "#ffffff", stroke: "#ffffff" }}
                />
                <span
                  className="text-white font-bold"
                  style={{ color: "#ffffff" }}
                >
                  Generate QR Code
                </span>
              </button>
            )}
          </div>
        </div>

        {/* If QR Performance Tab is Active */}
        {activeMainTab === "performance" ? (
          <QrPerformanceDashboard
            tablesList={tablesList}
            activeOrg={activeOrg}
            storeSlug={storeSlug}
            showToast={showToast}
            onSelectTable={(tableId) => {
              const target = tablesList.find((t) => t.id === tableId);
              if (
                !target ||
                !target.isGenerated ||
                !target.qrId ||
                target.status !== "Active"
              ) {
                showToast(
                  "Analytics unavailable: QR code is not generated or table is currently inactive."
                );
                return;
              }
              setViewingAnalyticsTableId(tableId);
            }}
          />
        ) : (
          <>
            {/* 4 Metric KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              {/* Card 1: Fleet Total */}
              <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Fleet Total
                  </span>
                  <QrCodeIcon className="w-5 h-5 text-[#141010]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-garamond text-3xl font-medium text-[#141010]">
                    {tablesList.length}
                  </span>
                  <span className="text-xs font-medium text-[#5e5e5e]">
                    Allocated Endpoints
                  </span>
                </div>
                <div className="w-full bg-[#f1edec] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#141010] h-full w-full rounded-full" />
                </div>
              </div>

              {/* Card 2: Live & Scanning */}
              <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Live & Scanning
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-garamond text-3xl font-medium text-[#141010]">
                    {activeCount}
                  </span>
                  <span className="text-xs font-medium text-[#5e5e5e]">
                    Active Routes (
                    {tablesList.length > 0
                      ? Math.round((activeCount / tablesList.length) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="w-full bg-[#f1edec] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{
                      width: `${tablesList.length > 0 ? (activeCount / tablesList.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Card 3: Decommissioned / Pending */}
              <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Decommissioned
                  </span>
                  <BlockIcon className="w-5 h-5 text-[#5e5e5e]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-garamond text-3xl font-medium text-[#141010]">
                    {pendingCount > 0 ? pendingCount : inactiveCount}
                  </span>
                  <span className="text-xs font-medium text-[#5e5e5e]">
                    {pendingCount > 0
                      ? "Pending Generation"
                      : "Inactive / Standby"}
                  </span>
                </div>
                <div className="w-full bg-[#f1edec] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#5e5e5e] h-full rounded-full transition-all"
                    style={{
                      width: `${tablesList.length > 0 ? ((pendingCount > 0 ? pendingCount : inactiveCount) / tablesList.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Card 4: Today's Traffic */}
              <div className="p-5 bg-white rounded-2xl shadow-xs border border-[#e7e5e4] flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between text-[#5e5e5e]">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Today's Traffic
                  </span>
                  <StatsIcon className="w-5 h-5 text-[#8d4b00]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-garamond text-3xl font-medium text-[#141010]">
                    {todayTrafficSessions}
                  </span>
                  <span className="text-xs font-medium text-[#5e5e5e]">
                    Direct Sessions
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <span>↑ Live scan telemetry active</span>
                </div>
              </div>
            </div>

            {/* Channel Navigation Tabs Bar */}
            <div className="w-full bg-white rounded-2xl shadow-xs border border-[#e7e5e4] p-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTypeFilter("all")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                    typeFilter === "all"
                      ? "bg-[#141010] text-white shadow-xs"
                      : "bg-transparent text-[#5e5e5e] hover:bg-[#f1edec] hover:text-[#141010]"
                  }`}
                  style={
                    typeFilter === "all"
                      ? { backgroundColor: "#141010", color: "#ffffff" }
                      : undefined
                  }
                >
                  <QrCodeIcon className="w-4 h-4 shrink-0" />
                  <span className="font-sans font-semibold text-xs tracking-tight">
                    All QR
                  </span>
                  <span
                    className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-sans font-semibold leading-none tabular-nums ${
                      typeFilter === "all"
                        ? "bg-white/20 text-white"
                        : "bg-[#e8e4e3] text-[#333333]"
                    }`}
                  >
                    {tablesList.length}
                  </span>
                </button>

                {orgIsDineIn && (
                  <button
                    type="button"
                    onClick={() => setTypeFilter("DineIn")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                      typeFilter === "DineIn"
                        ? "bg-[#141010] text-white shadow-xs"
                        : "bg-transparent text-[#5e5e5e] hover:bg-[#f1edec] hover:text-[#141010]"
                    }`}
                    style={
                      typeFilter === "DineIn"
                        ? { backgroundColor: "#141010", color: "#ffffff" }
                        : undefined
                    }
                  >
                    <TableRestaurantIcon className="w-4 h-4 shrink-0" />
                    <span className="font-sans font-semibold text-xs tracking-tight">
                      Dine-in
                    </span>
                    <span
                      className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-sans font-semibold leading-none tabular-nums ${
                        typeFilter === "DineIn"
                          ? "bg-white/20 text-white"
                          : "bg-[#e8e4e3] text-[#333333]"
                      }`}
                    >
                      {dineInCount}
                    </span>
                  </button>
                )}

                {orgIsTakeAway && (
                  <button
                    type="button"
                    onClick={() => setTypeFilter("TakeAway")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                      typeFilter === "TakeAway"
                        ? "bg-[#141010] text-white shadow-xs"
                        : "bg-transparent text-[#5e5e5e] hover:bg-[#f1edec] hover:text-[#141010]"
                    }`}
                    style={
                      typeFilter === "TakeAway"
                        ? { backgroundColor: "#141010", color: "#ffffff" }
                        : undefined
                    }
                  >
                    <TakeawayIcon className="w-4 h-4 shrink-0" />
                    <span className="font-sans font-semibold text-xs tracking-tight">
                      Takeaway
                    </span>
                    <span
                      className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-sans font-semibold leading-none tabular-nums ${
                        typeFilter === "TakeAway"
                          ? "bg-white/20 text-white"
                          : "bg-[#e8e4e3] text-[#333333]"
                      }`}
                    >
                      {takeAwayCount}
                    </span>
                  </button>
                )}

                {orgIsDelivery && (
                  <button
                    type="button"
                    onClick={() => setTypeFilter("Delivery")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                      typeFilter === "Delivery"
                        ? "bg-[#141010] text-white shadow-xs"
                        : "bg-transparent text-[#5e5e5e] hover:bg-[#f1edec] hover:text-[#141010]"
                    }`}
                    style={
                      typeFilter === "Delivery"
                        ? { backgroundColor: "#141010", color: "#ffffff" }
                        : undefined
                    }
                  >
                    <DeliveryIcon className="w-4 h-4 shrink-0" />
                    <span className="font-sans font-semibold text-xs tracking-tight">
                      Delivery
                    </span>
                    <span
                      className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-sans font-semibold leading-none tabular-nums ${
                        typeFilter === "Delivery"
                          ? "bg-white/20 text-white"
                          : "bg-[#e8e4e3] text-[#333333]"
                      }`}
                    >
                      {deliveryCount}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter & Control Bar */}
            <div className="w-full bg-white rounded-2xl shadow-xs border border-[#e7e5e4] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* Search Input */}
              <div className="relative flex-1 max-w-lg flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-[#5e5e5e]">
                  <SearchIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search table or placement..."
                  className="w-full pl-10 pr-4 py-2 bg-[#fdf8f7] text-[#141010] placeholder:text-[#5e5e5e] text-xs font-medium rounded-xl focus:outline-none focus:bg-white border border-[#e7e5e4] focus:border-[#141010] transition-all"
                />
              </div>

              {/* Filters & Layout Controls */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Status Filter */}
                <div className="relative inline-block text-left">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="appearance-none bg-[#fdf8f7] text-[#141010] text-xs font-medium px-4 py-2 pr-8 rounded-xl cursor-pointer focus:outline-none focus:bg-white border border-[#e7e5e4] hover:border-[#141010] transition-colors"
                  >
                    <option value="all">Status: All Status</option>
                    <option value="active">Status: Active Only</option>
                    <option value="inactive">Status: Inactive</option>
                    <option value="pending">Status: Pending QR</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5e5e5e]">
                    <ChevronDownIcon className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Content View: Table format for "All QR" tab, Card format for individual channel tabs */}
            {typeFilter === "all" ? (
              <div className="w-full bg-white rounded-2xl shadow-xs border border-[#e7e5e4] overflow-visible">
                <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#fdf8f7] text-[#5e5e5e] border-b border-[#e7e5e4] text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-3.5 pl-5 px-4">Code ID & Name</th>
                        <th className="py-3.5 px-4">Type</th>
                        <th className="py-3.5 px-4">Route Status</th>
                        <th className="py-3.5 px-4">Scanned</th>
                        <th className="py-3.5 pr-5 pl-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e7e5e4]">
                      {filteredTables.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-12 text-center text-xs text-[#5e5e5e]"
                          >
                            No registered QR codes found matching current
                            search/filter.
                          </td>
                        </tr>
                      ) : (
                        filteredTables.map((table) => {
                          const isActive = table.status === "Active";
                          const isPending = table.status === "Pending QR";

                          return (
                            <tr
                              key={table.id}
                              onClick={() => {
                                if (table.isGenerated) {
                                  setViewingQrModalTable(table);
                                }
                              }}
                              className={`hover:bg-[#fdf8f7]/60 transition-colors group cursor-pointer ${
                                activeDropdown === table.id ? "relative z-30" : "relative"
                              }`}
                            >
                              <td className="py-4 pl-5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-[#fdf8f7] border border-[#e7e5e4] flex items-center justify-center text-[#141010] group-hover:bg-[#141010] group-hover:text-white transition-colors">
                                    <QrCodeIcon className="w-5 h-5" />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-garamond text-base font-semibold text-[#141010] leading-snug">
                                      {table.name}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <span className="px-2.5 py-0.5 rounded-lg bg-[#f1edec] text-[#141010] text-xs font-semibold border border-[#e7e5e4]">
                                  {table.qrType || "DineIn"}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    isActive
                                      ? "bg-[#f1edec] text-[#141010] border border-[#e7e5e4]"
                                      : isPending
                                        ? "bg-[#fff9f2] text-[#8d4b00] border border-[#ffe4cc]"
                                        : "bg-[#f5f5f5] text-[#5e5e5e] border border-[#e7e5e4]"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isActive
                                        ? "bg-emerald-500"
                                        : isPending
                                          ? "bg-amber-500"
                                          : "bg-[#5e5e5e]"
                                    }`}
                                  />
                                  {table.status}
                                </span>
                              </td>
                              <td className="py-4 px-4 font-mono text-xs font-semibold text-[#141010]">
                                {table.scansToday || 0} scans
                              </td>
                              <td
                                className="py-4 pr-5 pl-4 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-2">
                                  {table.isGenerated ? (
                                    (() => {
                                      const isAvailable = Boolean(
                                        table.isGenerated &&
                                          table.qrId &&
                                          table.status === "Active"
                                      );
                                      return (
                                        <button
                                          type="button"
                                          disabled={!isAvailable}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isAvailable) {
                                              showToast(
                                                "Analytics unavailable: QR code is not generated or table is inactive."
                                              );
                                              return;
                                            }
                                            setViewingAnalyticsTableId(table.id);
                                          }}
                                          title={
                                            isAvailable
                                              ? "View Analytics"
                                              : "Analytics unavailable: Table is inactive or QR not generated"
                                          }
                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                            isAvailable
                                              ? "bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] cursor-pointer"
                                              : "bg-[#f5f5f4] text-[#a8a29e] opacity-60 cursor-not-allowed"
                                          }`}
                                        >
                                          Analytics
                                        </button>
                                      );
                                    })()
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenGenerateModalForTable(
                                          table.id,
                                        );
                                      }}
                                      className="px-3 py-1.5 bg-[#141010] hover:bg-[#2d2622] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                                      style={{
                                        backgroundColor: "#141010",
                                        color: "#ffffff",
                                      }}
                                    >
                                      Generate QR
                                    </button>
                                  )}

                                  {/* Dropdown Options */}
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDropdown(
                                          activeDropdown === table.id
                                            ? null
                                            : table.id,
                                        );
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-[#f1edec] text-[#5e5e5e] hover:text-[#141010] transition-colors cursor-pointer"
                                    >
                                      <MoreHorizIcon className="w-5 h-5" />
                                    </button>

                                    {activeDropdown === table.id && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-2xl border border-[#e7e5e4] z-50 py-1.5 flex flex-col text-left animate-in fade-in zoom-in-95"
                                      >
                                        {table.isGenerated ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setViewingQrModalTable(table);
                                                setActiveDropdown(null);
                                              }}
                                              className="px-4 py-2 text-left text-xs text-[#141010] font-semibold hover:bg-[#fdf8f7] flex items-center gap-2 cursor-pointer"
                                            >
                                              <QrCodeIcon className="w-4 h-4 text-[#5e5e5e]" />
                                              <span>View QR</span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleCopyUrl(table.qrUrl);
                                                setActiveDropdown(null);
                                              }}
                                              className="px-4 py-2 text-left text-xs text-[#141010] font-semibold hover:bg-[#fdf8f7] flex items-center gap-2 cursor-pointer"
                                            >
                                              <CopyIcon className="w-4 h-4 text-[#5e5e5e]" />
                                              <span>Copy Link</span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleStatus(table);
                                                setActiveDropdown(null);
                                              }}
                                              className="px-4 py-2 text-left text-xs font-semibold text-[#5e5e5e] hover:bg-[#f5f5f5] flex items-center gap-2 cursor-pointer"
                                            >
                                              {isActive ? (
                                                <BlockIcon className="w-4 h-4" />
                                              ) : (
                                                <CheckCircleIcon className="w-4 h-4" />
                                              )}
                                              <span>
                                                {isActive
                                                  ? "Disable QR"
                                                  : "Enable QR"}
                                              </span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteQr(table);
                                                setActiveDropdown(null);
                                              }}
                                              className="px-4 py-2 text-left text-xs font-semibold text-[#ba1a1a] hover:bg-[#ffdad6] flex items-center gap-2 cursor-pointer border-t border-[#e7e5e4]/50"
                                            >
                                              <TrashIcon className="w-4 h-4 text-[#ba1a1a]" />
                                              <span>Unlink / Delete QR</span>
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenGenerateModalForTable(
                                                table.id,
                                              );
                                              setActiveDropdown(null);
                                            }}
                                            className="px-4 py-2 text-left text-xs text-[#141010] font-bold hover:bg-[#fdf8f7] flex items-center gap-2 cursor-pointer"
                                          >
                                            <PlusIcon className="w-4 h-4 text-[#141010]" />
                                            <span>Generate QR Code</span>
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div className="flex items-center justify-between px-5 py-3 bg-[#fdf8f7] border-t border-[#e7e5e4] text-xs text-[#5e5e5e] font-medium">
                  <span>
                    Showing{" "}
                    <strong className="text-[#141010] font-semibold">
                      {filteredTables.length}
                    </strong>{" "}
                    registered QR codes
                  </span>
                  <span className="font-mono text-[11px]">
                    Sync Status: Live
                  </span>
                </div>
              </div>
            ) : (
              /* Card View for Dine-in / Takeaway / Delivery / Schedule Pickup */
              <div className="w-full flex flex-col gap-3">
                {filteredTables.length === 0 ? (
                  typeFilter === "takeaway" || typeFilter === "TakeAway" ? (
                    <div className="bg-white rounded-2xl p-10 border border-[#e7e5e4] shadow-xs text-center flex flex-col items-center justify-center gap-3 my-2">
                      <div className="w-12 h-12 rounded-2xl bg-[#fdf8f7] flex items-center justify-center text-[#141010] border border-[#e7e5e4]">
                        <QrCodeIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-garamond text-2xl font-normal text-[#141010]">
                          No Takeaway QR Code Created
                        </h3>
                        <p className="text-xs text-[#5e5e5e] mt-1 max-w-sm mx-auto">
                          Generate a single Takeaway QR code for your store
                          counter or pickup station.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQrTypeInModal("TakeAway");
                          setSelectedTableIdInModal("");
                          setNewTableName("Takeaway Counter");
                          setIsModalOpen(true);
                        }}
                        className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#141010] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#2d2622] transition-colors cursor-pointer"
                        style={{ backgroundColor: "#141010", color: "#ffffff" }}
                      >
                        <PlusIcon
                          className="w-4 h-4 text-white"
                          style={{ color: "#ffffff", stroke: "#ffffff" }}
                        />
                        <span
                          className="text-white font-bold"
                          style={{ color: "#ffffff" }}
                        >
                          Generate Takeaway QR
                        </span>
                      </button>
                    </div>
                  ) : typeFilter === "delivery" || typeFilter === "Delivery" ? (
                    <div className="bg-white rounded-2xl p-10 border border-[#e7e5e4] shadow-xs text-center flex flex-col items-center justify-center gap-3 my-2">
                      <div className="w-12 h-12 rounded-2xl bg-[#fdf8f7] flex items-center justify-center text-[#141010] border border-[#e7e5e4]">
                        <QrCodeIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-garamond text-2xl font-normal text-[#141010]">
                          No Delivery QR Code Created
                        </h3>
                        <p className="text-xs text-[#5e5e5e] mt-1 max-w-sm mx-auto">
                          Generate a single Delivery QR code for delivery
                          packages or promotional stickers.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQrTypeInModal("Delivery");
                          setSelectedTableIdInModal("");
                          setNewTableName("Delivery Bag");
                          setIsModalOpen(true);
                        }}
                        className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#141010] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#2d2622] transition-colors cursor-pointer"
                        style={{ backgroundColor: "#141010", color: "#ffffff" }}
                      >
                        <PlusIcon
                          className="w-4 h-4 text-white"
                          style={{ color: "#ffffff", stroke: "#ffffff" }}
                        />
                        <span
                          className="text-white font-bold"
                          style={{ color: "#ffffff" }}
                        >
                          Generate Delivery QR
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-12 text-center border border-[#e7e5e4] flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[#fdf8f7] flex items-center justify-center text-[#141010] border border-[#e7e5e4]">
                        <QrCodeIcon className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="font-garamond text-2xl font-normal text-[#141010]">
                          No Store Tables Found
                        </h3>
                        <p className="text-xs text-[#5e5e5e] mt-1 max-w-sm mx-auto">
                          Configure store tables in settings layout editor to
                          generate table QR codes.
                        </p>
                      </div>
                      <a
                        href="/settings?tab=tables"
                        className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#141010] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#2d2622] transition-colors cursor-pointer"
                        style={{ backgroundColor: "#141010", color: "#ffffff" }}
                      >
                        <PlusIcon
                          className="w-4 h-4 text-white"
                          style={{ color: "#ffffff", stroke: "#ffffff" }}
                        />
                        <span
                          className="text-white font-bold"
                          style={{ color: "#ffffff" }}
                        >
                          Configure Store Tables
                        </span>
                      </a>
                    </div>
                  )
                ) : (
                  filteredTables.map((table) => {
                    const isActive = table.status === "Active";
                    const isPending = table.status === "Pending QR";

                    return (
                      <div
                        key={table.id}
                        onClick={() => {
                          setSelectedTableId(table.id);
                          if (table.isGenerated) {
                            setViewingQrModalTable(table);
                          }
                        }}
                        className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e7e5e4] shadow-xs hover:shadow-md hover:border-[#141010] transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full"
                      >
                        {/* Left Details */}
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                              isActive
                                ? "bg-[#141010] text-white border-[#141010]"
                                : "bg-[#fdf8f7] text-[#5e5e5e] border-[#e7e5e4]"
                            }`}
                            style={
                              isActive
                                ? {
                                    backgroundColor: "#141010",
                                    color: "#ffffff",
                                  }
                                : undefined
                            }
                          >
                            {table.placement &&
                            table.placement
                              .toLowerCase()
                              .includes("outdoor") ? (
                              <DeckIcon
                                className="w-6 h-6"
                                style={
                                  isActive
                                    ? { color: "#ffffff", stroke: "#ffffff" }
                                    : undefined
                                }
                              />
                            ) : (
                              <TableRestaurantIcon
                                className="w-6 h-6"
                                style={
                                  isActive
                                    ? { color: "#ffffff", stroke: "#ffffff" }
                                    : undefined
                                }
                              />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-garamond text-xl font-medium text-[#141010] tracking-tight whitespace-nowrap">
                                {table.name}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 ${
                                  isActive
                                    ? "bg-[#f1edec] text-[#141010] border border-[#e7e5e4]"
                                    : isPending
                                      ? "bg-[#fff9f2] text-[#8d4b00] border border-[#ffe4cc]"
                                      : "bg-[#f5f5f5] text-[#5e5e5e] border border-[#e7e5e4]"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    isActive
                                      ? "bg-emerald-500"
                                      : isPending
                                        ? "bg-amber-500"
                                        : "bg-[#5e5e5e]"
                                  }`}
                                />
                                {table.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-[#5e5e5e] mt-1 flex-wrap font-medium">
                              {table.seats > 0 && (
                                <span>{table.seats} Seats</span>
                              )}
                              {table.placement && (
                                <>
                                  {table.seats > 0 && <span>•</span>}
                                  <span className="text-[#141010] font-semibold">
                                    {table.placement}
                                  </span>
                                </>
                              )}
                              {table.isGenerated && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                                    <span>
                                      {table.scansToday || 0} scans today
                                    </span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Action Buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {table.isGenerated ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingQrModalTable(table);
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 bg-[#141010] hover:bg-[#2d2622] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                style={{
                                  backgroundColor: "#141010",
                                  color: "#ffffff",
                                }}
                              >
                                <QrCodeIcon
                                  className="w-4 h-4 text-white"
                                  style={{
                                    color: "#ffffff",
                                    stroke: "#ffffff",
                                  }}
                                />
                                <span
                                  className="text-white font-bold"
                                  style={{ color: "#ffffff" }}
                                >
                                  View QR
                                </span>
                              </button>

                              {(() => {
                                  const isAvailable = Boolean(
                                    table.isGenerated &&
                                      table.qrId &&
                                      table.status === "Active"
                                  );
                                  return (
                                    <button
                                      type="button"
                                      disabled={!isAvailable}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isAvailable) {
                                          showToast(
                                            "Analytics unavailable: QR code is not generated or table is inactive."
                                          );
                                          return;
                                        }
                                        setSelectedTableId(table.id);
                                        setViewingAnalyticsTableId(table.id);
                                      }}
                                      title={
                                        isAvailable
                                          ? "View Analytics"
                                          : "Analytics unavailable: Table is inactive or QR not generated"
                                      }
                                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                                        isAvailable
                                          ? "bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] cursor-pointer"
                                          : "bg-[#f5f5f4] text-[#a8a29e] opacity-60 cursor-not-allowed"
                                      }`}
                                    >
                                      View Analytics
                                    </button>
                                  );
                              })()}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenGenerateModalForTable(table.id);
                              }}
                              className="flex items-center gap-1.5 px-4 py-2 bg-[#141010] hover:bg-[#2d2622] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                              style={{
                                backgroundColor: "#141010",
                                color: "#ffffff",
                              }}
                            >
                              <PlusIcon
                                className="w-4 h-4 text-white"
                                style={{ color: "#ffffff", stroke: "#ffffff" }}
                              />
                              <span
                                className="text-white font-bold"
                                style={{ color: "#ffffff" }}
                              >
                                Generate QR
                              </span>
                            </button>
                          )}

                          {/* Dropdown Options */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdown(
                                  activeDropdown === table.id ? null : table.id,
                                );
                              }}
                              className="p-2 rounded-lg hover:bg-[#f1edec] text-[#5e5e5e] hover:text-[#141010] transition-colors flex items-center cursor-pointer"
                            >
                              <MoreHorizIcon className="w-5 h-5" />
                            </button>

                            {activeDropdown === table.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-2xl border border-[#e7e5e4] z-50 py-1.5 flex flex-col"
                              >
                                {table.isGenerated ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingQrModalTable(table);
                                        setActiveDropdown(null);
                                      }}
                                      className="px-4 py-2 text-left text-xs text-[#141010] font-semibold hover:bg-[#fdf8f7] flex items-center gap-2 cursor-pointer"
                                    >
                                      <QrCodeIcon className="w-4 h-4 text-[#5e5e5e]" />
                                      <span>View QR Popup</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleCopyUrl(table.qrUrl);
                                        setActiveDropdown(null);
                                      }}
                                      className="px-4 py-2 text-left text-xs text-[#141010] font-semibold hover:bg-[#fdf8f7] flex items-center gap-2 cursor-pointer"
                                    >
                                      <CopyIcon className="w-4 h-4 text-[#5e5e5e]" />
                                      <span>Copy Link</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleToggleStatus(table);
                                        setActiveDropdown(null);
                                      }}
                                      className={`px-4 py-2 text-left text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                                        isActive
                                          ? "text-[#5e5e5e] hover:bg-[#f5f5f5]"
                                          : "text-emerald-700 hover:bg-emerald-50"
                                      }`}
                                    >
                                      {isActive ? (
                                        <BlockIcon className="w-4 h-4" />
                                      ) : (
                                        <CheckCircleIcon className="w-4 h-4" />
                                      )}
                                      <span>
                                        {isActive ? "Disable QR" : "Enable QR"}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleDeleteQr(table);
                                        setActiveDropdown(null);
                                      }}
                                      className="px-4 py-2 text-left text-xs font-semibold text-[#ba1a1a] hover:bg-[#ffdad6] flex items-center gap-2 cursor-pointer border-t border-[#e7e5e4]/50"
                                    >
                                      <TrashIcon className="w-4 h-4 text-[#ba1a1a]" />
                                      <span>Unlink / Delete QR</span>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleOpenGenerateModalForTable(table.id);
                                      setActiveDropdown(null);
                                    }}
                                    className="px-4 py-2 text-left text-xs text-[#141010] font-bold hover:bg-[#fdf8f7] flex items-center gap-2 cursor-pointer"
                                  >
                                    <PlusIcon className="w-4 h-4 text-[#141010]" />
                                    <span>Generate QR Code</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create QR Code Modal — PREST Warm Luxury Theme */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#141010]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 lg:p-8 shadow-2xl flex flex-col gap-6 border border-[#e7e5e4] animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] text-[#1c1b1b]">
            {/* Modal Top Header */}
            <div className="flex items-start justify-between border-b border-[#e7e5e4] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-garamond text-2xl font-normal text-[#141010] tracking-tight">
                    Create QR Code
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#fdf8f7] text-[#5e5e5e] border border-[#e7e5e4] font-mono text-[11px] font-semibold uppercase">
                    {storeSlug}
                  </span>
                </div>
                <p className="text-xs text-[#5e5e5e] mt-1">
                  Generate a physical QR code for your store table.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-full hover:bg-[#f1edec] text-[#5e5e5e] transition-colors cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns */}
            <form
              onSubmit={handleCreateSubmit}
              className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8 items-start"
            >
              {/* Left Column: Form Controls (7 cols) */}
              <div className="md:col-span-7 flex flex-col gap-5">
                {/* QR TYPE Segmented Control */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#141010] uppercase tracking-wider">
                    QR Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-[#fdf8f7] p-1 rounded-xl border border-[#e7e5e4]">
                    {orgIsDineIn && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQrTypeInModal("DineIn");
                          setSelectedTableIdInModal("");
                          setNewTableName("");
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          selectedQrTypeInModal === "DineIn"
                            ? "bg-[#141010] text-white shadow-xs"
                            : "text-[#5e5e5e] hover:text-[#141010]"
                        }`}
                        style={
                          selectedQrTypeInModal === "DineIn"
                            ? { backgroundColor: "#141010", color: "#ffffff" }
                            : undefined
                        }
                      >
                        <TableRestaurantIcon
                          className="w-4 h-4"
                          style={
                            selectedQrTypeInModal === "DineIn"
                              ? { color: "#ffffff", stroke: "#ffffff" }
                              : undefined
                          }
                        />
                        <span className="font-bold">Dine-In</span>
                      </button>
                    )}

                    {orgIsTakeAway && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQrTypeInModal("TakeAway");
                          setSelectedTableIdInModal("");
                          setNewTableName("Takeaway Counter");
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          takeAwayCount >= 1 && selectedQrTypeInModal !== "TakeAway"
                            ? "opacity-60 text-[#78716c] bg-[#f5f5f4]"
                            : selectedQrTypeInModal === "TakeAway"
                              ? "bg-[#141010] text-white shadow-xs cursor-pointer"
                              : "text-[#5e5e5e] hover:text-[#141010] cursor-pointer"
                        }`}
                        style={
                          selectedQrTypeInModal === "TakeAway"
                            ? { backgroundColor: "#141010", color: "#ffffff" }
                            : undefined
                        }
                        title={takeAwayCount >= 1 ? "Takeaway QR code already exists for this store" : "Takeaway Channel"}
                      >
                        <span className="font-bold">Takeaway</span>
                        {takeAwayCount >= 1 && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                            Created
                          </span>
                        )}
                      </button>
                    )}

                    {orgIsDelivery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQrTypeInModal("Delivery");
                          setSelectedTableIdInModal("");
                          setNewTableName("Delivery Bag");
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          deliveryCount >= 1 && selectedQrTypeInModal !== "Delivery"
                            ? "opacity-60 text-[#78716c] bg-[#f5f5f4]"
                            : selectedQrTypeInModal === "Delivery"
                              ? "bg-[#141010] text-white shadow-xs cursor-pointer"
                              : "text-[#5e5e5e] hover:text-[#141010] cursor-pointer"
                        }`}
                        style={
                          selectedQrTypeInModal === "Delivery"
                            ? { backgroundColor: "#141010", color: "#ffffff" }
                            : undefined
                        }
                        title={deliveryCount >= 1 ? "Delivery QR code already exists for this store" : "Delivery Channel"}
                      >
                        <span className="font-bold">Delivery</span>
                        {deliveryCount >= 1 && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                            Created
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Single QR Existing Alert for Non-DineIn Channels */}
                {selectedQrTypeInModal === "TakeAway" && takeAwayCount >= 1 && (
                  <div className="p-3 bg-[#fff9f2] rounded-xl border border-[#ffe4cc] text-xs text-[#8d4b00] flex items-center gap-2">
                    <span className="font-bold">⚠️ Notice:</span>
                    <span>
                      A Takeaway QR code already exists for this store. Only 1
                      Takeaway QR code is maintained per store (handles both immediate Takeaway & Scheduled Pickup).
                    </span>
                  </div>
                )}
                {selectedQrTypeInModal === "Delivery" && deliveryCount >= 1 && (
                  <div className="p-3 bg-[#fff9f2] rounded-xl border border-[#ffe4cc] text-xs text-[#8d4b00] flex items-center gap-2">
                    <span className="font-bold">⚠️ Notice:</span>
                    <span>
                      A Delivery QR code already exists for this store. Only 1
                      Delivery QR code is maintained per store (handles both immediate Delivery & Scheduled Delivery).
                    </span>
                  </div>
                )}

                {/* TABLE Selection — Strictly for Dine-In QRs */}
                {selectedQrTypeInModal === "DineIn" && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#141010] uppercase tracking-wider">
                        Table <span className="text-[#ba1a1a]">*</span>
                      </label>
                      <a
                        href="/settings?tab=tables"
                        className="text-[11px] font-semibold text-[#141010] hover:underline cursor-pointer"
                      >
                        Manage tables in layout →
                      </a>
                    </div>
                    <div className="relative">
                      <select
                        required
                        value={selectedTableIdInModal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedTableIdInModal(val);
                          if (val) {
                            const targetTable = tablesList.find(
                              (t) => t.id === val,
                            );
                            if (targetTable) {
                              setNewTableName(targetTable.name);
                              setNewCapacity(targetTable.seats || 4);
                              setNewPlacement(targetTable.placement || "");
                            }
                          } else {
                            setNewTableName("");
                          }
                        }}
                        className="w-full appearance-none px-4 py-2.5 bg-white text-[#141010] text-sm font-semibold rounded-xl border border-[#e7e5e4] focus:outline-none focus:border-[#141010] cursor-pointer shadow-xs"
                      >
                        <option value="">
                          -- Select Pending Store Table --
                        </option>
                        {pendingTablesForModal &&
                        pendingTablesForModal.length > 0 ? (
                          pendingTablesForModal.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} {t.placement ? `(${t.placement})` : ""} ·{" "}
                              {t.seats} seats{" "}
                              {!t.isGenerated ? "(Pending QR)" : "(Assigned)"}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>
                            All store tables already have generated QR codes
                          </option>
                        )}
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#141010]">
                        <ChevronDownIcon className="w-4 h-4" />
                      </div>
                    </div>

                    {(!realTables || realTables.length === 0) && (
                      <div className="p-3 bg-[#fff9f2] rounded-xl border border-[#ffe4cc] text-xs text-[#8d4b00] flex items-center justify-between mt-1">
                        <span>
                          No tables found. Please add tables in Tables & Layouts
                          screen first.
                        </span>
                        <a
                          href="/settings?tab=tables"
                          className="px-3 py-1 bg-[#8d4b00] text-white rounded-lg font-semibold text-[11px] hover:bg-[#6e3900] transition-colors"
                        >
                          Go to Tables
                        </a>
                      </div>
                    )}

                    {selectedTableIdInModal && newTableName && (
                      <div className="flex items-center gap-1.5 text-xs text-[#141010] mt-0.5 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>
                          {newCapacity} seats{" "}
                          {newPlacement ? `· ${newPlacement}` : ""} · Available
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* QR NAME */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#141010] uppercase tracking-wider">
                    QR Name <span className="text-[#ba1a1a]">*</span>
                  </label>
                  {selectedQrTypeInModal === "DineIn" ? (
                    <input
                      type="text"
                      value={
                        newTableName
                          ? newTableName.toLowerCase().endsWith("qr")
                            ? newTableName
                            : `${newTableName} QR`
                          : "Select Table Above"
                      }
                      readOnly
                      className="w-full px-4 py-2.5 bg-[#f5f5f5] text-[#141010] text-sm font-semibold rounded-xl border border-[#e7e5e4]"
                    />
                  ) : (
                    <input
                      type="text"
                      required
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      placeholder={
                        selectedQrTypeInModal === "TakeAway"
                          ? "e.g. Takeaway Counter QR"
                          : "e.g. Delivery Order QR"
                      }
                      className="w-full px-4 py-2.5 bg-white text-[#141010] text-sm font-semibold rounded-xl border border-[#e7e5e4] focus:outline-none focus:border-[#141010] shadow-xs"
                    />
                  )}
                  <p className="text-[11px] text-[#5e5e5e]">
                    Used to identify this physical QR code across the
                    restaurant.
                  </p>
                </div>

                {/* STATUS */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#141010] uppercase tracking-wider">
                    Status
                  </label>
                  <div className="relative">
                    <select className="w-full appearance-none px-4 py-2.5 bg-white text-[#141010] text-sm font-semibold rounded-xl border border-[#e7e5e4] focus:outline-none focus:border-[#141010] cursor-pointer shadow-xs">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#141010]">
                      <ChevronDownIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-[11px] text-[#5e5e5e]">
                    Active QR codes can be scanned and used by customers
                    immediately.
                  </p>
                </div>
              </div>

              {/* Right Column: Live Standee Preview (5 cols) */}
              <div className="md:col-span-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#141010] uppercase tracking-wider">
                    QR Preview
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-[#fdf8f7] text-[#141010] font-mono text-[10px] font-bold uppercase border border-[#e7e5e4]">
                    {selectedQrTypeInModal === "DineIn"
                      ? "Table Standee"
                      : selectedQrTypeInModal === "TakeAway"
                        ? "Counter Display"
                        : "Packaging Sticker"}
                  </span>
                </div>

                {/* Standee Graphic Container */}
                <div className="w-full bg-[#fdf8f7] rounded-2xl p-5 border border-[#e7e5e4] flex flex-col items-center gap-4">
                  {/* Standee Header */}
                  <div className="w-full flex items-center justify-between text-xs font-medium">
                    <span className="font-semibold text-[#141010] tracking-tight">
                      PREST DINE
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8d4b00] bg-[#fff9f2] px-2.5 py-0.5 rounded-full border border-[#ffe4cc]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Pending Creation
                    </span>
                  </div>

                  {/* Physical Standee Card */}
                  <div className="w-full max-w-[210px] bg-white rounded-2xl p-4 shadow-lg border border-[#e7e5e4] flex flex-col items-center text-center gap-3">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#5e5e5e]">
                      Scan to browse & order
                    </span>

                    {/* Pending Generation Placeholder — Dummy QR removed */}
                    <div className="w-32 h-32 relative bg-[#fdf8f7] rounded-xl p-2 shadow-xs border border-dashed border-[#e7e5e4] flex flex-col items-center justify-center text-center gap-1.5">
                      <QrCodeIcon className="w-7 h-7 text-[#8c857b]" />
                      <span className="text-[9px] font-bold text-[#5e5e5e] leading-tight uppercase tracking-wider">
                        Generated Upon Creation
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="font-garamond text-base font-medium text-[#141010]">
                        {newTableName ||
                          (selectedQrTypeInModal === "DineIn"
                            ? "Select Table Above"
                            : selectedQrTypeInModal === "TakeAway"
                              ? "Takeaway Counter"
                              : "Delivery Bag")}
                      </span>
                      <span className="text-[10px] text-[#5e5e5e] font-medium">
                        {selectedQrTypeInModal === "DineIn"
                          ? `Dine-in · ${newCapacity} Seats ${newPlacement ? `· ${newPlacement}` : ""}`
                          : selectedQrTypeInModal === "TakeAway"
                            ? "Takeaway · Express Pickup"
                            : "Delivery · Packaging Sticker"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#5e5e5e] font-medium pt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>Will be activated upon creation</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#5e5e5e] font-mono px-1">
                  <span>DISPLAY FORMAT</span>
                  <span className="font-semibold text-[#141010]">
                    A6 Standee (105 × 148 mm)
                  </span>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e7e5e4]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#5e5e5e] hover:bg-[#f1edec] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isTypeAlreadyExists}
                    className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 ${
                      isTypeAlreadyExists
                        ? "bg-[#a8a29e] text-[#f5f5f4] opacity-50 cursor-not-allowed pointer-events-none shadow-none"
                        : "bg-[#141010] text-white hover:bg-[#2d2622] cursor-pointer"
                    }`}
                    style={
                      !isTypeAlreadyExists
                        ? { backgroundColor: "#141010", color: "#ffffff" }
                        : { backgroundColor: "#a8a29e", color: "#f5f5f4" }
                    }
                  >
                    <PlusIcon
                      className="w-4 h-4 text-white"
                      style={{ color: "#ffffff", stroke: "#ffffff" }}
                    />
                    <span
                      className="font-bold"
                      style={!isTypeAlreadyExists ? { color: "#ffffff" } : { color: "#f5f5f4" }}
                    >
                      {isTypeAlreadyExists ? "QR Already Exists" : "Create QR"}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View QR Code Detail Modal / Popup */}
      {viewingQrModalTable && (
        <div className="fixed inset-0 z-50 bg-[#141010]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 lg:p-7 shadow-2xl flex flex-col gap-5 border border-[#e7e5e4] animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] text-[#1c1b1b]">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#e7e5e4] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-garamond text-2xl font-normal text-[#141010] tracking-tight">
                    {viewingQrModalTable.name}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      viewingQrModalTable.status === "Active"
                        ? "bg-[#f1edec] text-[#141010] border border-[#e7e5e4]"
                        : viewingQrModalTable.status === "Pending QR"
                          ? "bg-[#fff9f2] text-[#8d4b00] border border-[#ffe4cc]"
                          : "bg-[#f5f5f5] text-[#5e5e5e] border border-[#e7e5e4]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        viewingQrModalTable.status === "Active"
                          ? "bg-emerald-500"
                          : viewingQrModalTable.status === "Pending QR"
                            ? "bg-amber-500"
                            : "bg-[#5e5e5e]"
                      }`}
                    />
                    {viewingQrModalTable.status}
                  </span>
                </div>
                <p className="text-xs text-[#5e5e5e] mt-0.5 font-medium">
                  {viewingQrModalTable.seats > 0
                    ? `${viewingQrModalTable.seats} Seats · `
                    : ""}
                  {viewingQrModalTable.placement ||
                    viewingQrModalTable.qrType ||
                    "Store QR"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingQrModalTable(null)}
                className="p-2 rounded-full hover:bg-[#f1edec] text-[#5e5e5e] transition-colors cursor-pointer"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Vector Scannable QR Graphic Display */}
            <div className="w-full aspect-square max-w-[240px] mx-auto bg-[#fdf8f7] rounded-2xl p-4 flex flex-col items-center justify-center relative border border-[#e7e5e4]">
              {viewingQrModalTable.isGenerated && viewingQrModalTable.qrUrl ? (
                <div
                  id="qr-modal-display"
                  className="w-full h-full p-3 bg-white rounded-xl shadow-xs border border-[#e7e5e4] flex items-center justify-center"
                >
                  <DynamicQrCode value={viewingQrModalTable.qrUrl} />
                </div>
              ) : (
                <div className="w-full h-full p-4 bg-white rounded-xl border border-dashed border-[#e7e5e4] flex flex-col items-center justify-center text-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-[#fdf8f7] flex items-center justify-center text-[#5e5e5e] border border-[#e7e5e4]">
                    <QrCodeIcon className="w-6 h-6 text-[#5e5e5e]" />
                  </div>
                  <span className="text-xs font-bold text-[#141010]">
                    No QR Code Generated Yet
                  </span>
                  <span className="text-[10px] text-[#5e5e5e]">
                    Click generate below to assign a QR code.
                  </span>
                </div>
              )}
            </div>

            {/* Direct Routing Details */}
            <div className="bg-[#fdf8f7] rounded-2xl p-4 flex flex-col gap-2 border border-[#e7e5e4]">
              <div className="flex items-center justify-between text-xs text-[#5e5e5e] font-medium">
                <span>Direct Digital Route</span>
                {viewingQrModalTable.isGenerated && (
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(viewingQrModalTable.qrUrl)}
                    className="text-[#141010] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CopyIcon className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </button>
                )}
              </div>
              <span className="font-mono text-xs text-[#141010] truncate font-semibold">
                {viewingQrModalTable.isGenerated
                  ? viewingQrModalTable.qrUrl
                  : "Pending Generation — Click generate below"}
              </span>

              <div className="flex items-center justify-between text-xs text-[#5e5e5e] pt-2 border-t border-[#e7e5e4] font-medium">
                <span>
                  Scans Today:{" "}
                  <strong className="text-[#141010] font-semibold">
                    {viewingQrModalTable.scansToday || 0}
                  </strong>
                </span>
                <span>
                  Store:{" "}
                  <strong className="text-[#141010] font-semibold">
                    {storeSlug}
                  </strong>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1">
              {viewingQrModalTable.isGenerated ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleDownloadQr(viewingQrModalTable)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#141010] hover:bg-[#2d2622] text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                    style={{ backgroundColor: "#141010", color: "#ffffff" }}
                  >
                    <PrintIcon
                      className="w-4 h-4 text-white"
                      style={{ color: "#ffffff", stroke: "#ffffff" }}
                    />
                    <span
                      className="text-white font-bold"
                      style={{ color: "#ffffff" }}
                    >
                      Download / Print QR Code
                    </span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {(() => {
                      const isAvailable = Boolean(
                        viewingQrModalTable.isGenerated &&
                          viewingQrModalTable.qrId &&
                          viewingQrModalTable.status === "Active"
                      );
                      return (
                        <button
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => {
                            if (!isAvailable) {
                              showToast(
                                "Analytics unavailable: QR code is not generated or table is inactive."
                              );
                              return;
                            }
                            const targetId = viewingQrModalTable.id;
                            setViewingQrModalTable(null);
                            setViewingAnalyticsTableId(targetId);
                          }}
                          title={
                            isAvailable
                              ? "View Analytics"
                              : "Analytics unavailable: Table is inactive or QR not generated"
                          }
                          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                            isAvailable
                              ? "bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] cursor-pointer"
                              : "bg-[#f5f5f4] text-[#a8a29e] opacity-60 cursor-not-allowed"
                          }`}
                        >
                          <StatsIcon className="w-3.5 h-3.5" />
                          <span>View Analytics</span>
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleStatus(viewingQrModalTable);
                        setViewingQrModalTable({
                          ...viewingQrModalTable,
                          status:
                            viewingQrModalTable.status === "Active"
                              ? "Inactive"
                              : "Active",
                        });
                      }}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <PowerIcon className="w-3.5 h-3.5" />
                      <span>
                        {viewingQrModalTable.status === "Active"
                          ? "Disable QR"
                          : "Enable QR"}
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const targetId = viewingQrModalTable.id;
                    setViewingQrModalTable(null);
                    handleOpenGenerateModalForTable(targetId);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#141010] hover:bg-[#2d2622] text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                  style={{ backgroundColor: "#141010", color: "#ffffff" }}
                >
                  <PlusIcon
                    className="w-4 h-4 text-white"
                    style={{ color: "#ffffff", stroke: "#ffffff" }}
                  />
                  <span
                    className="text-white font-bold"
                    style={{ color: "#ffffff" }}
                  >
                    Generate QR Code
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
