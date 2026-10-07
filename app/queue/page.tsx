"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PosShell } from "../components/PosShell";

// Helper date formatter: YYYY-MM-DD
function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Display date string: DD/MM/YYYY
function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return dateStr;
}

// Format time from timestamp ms to HH:MM AM/PM
function formatTimestampTime(ts?: number): string {
  if (!ts) return "--:--";
  const date = new Date(ts);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

// Calculate elapsed wait time in minutes
function getElapsedMinutes(ts?: number): number {
  if (!ts) return 0;
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  return Math.floor(diff / 60000);
}

// Live ticking stopwatch component for waitlist entries
function LiveWaitlistStopwatch({ createdAt }: { createdAt?: number }) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!createdAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[#645d58] bg-[#f4ece8] px-2.5 py-1 rounded-full font-semibold text-xs font-mono border border-[#e9e1dd]">
        00m 00s
      </span>
    );
  }

  const diffMs = Math.max(0, now - createdAt);
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const paddedMins = String(minutes).padStart(2, "0");
  const paddedSecs = String(seconds).padStart(2, "0");

  return (
    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold text-xs font-mono border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
      {paddedMins}m {paddedSecs}s
    </span>
  );
}

// Helper to extract short ticket number e.g. "30-09-2026.QN001" -> "QN001"
function formatShortTicketNumber(qNum?: string): string {
  if (!qNum) return "QN001";
  if (qNum.includes(".")) {
    const parts = qNum.split(".");
    return parts[parts.length - 1];
  }
  return qNum;
}

// Helper to extract clean customer name and phone/id
function parseCustomerInfo(notes?: string, userId?: string): { name: string; subtitle: string } {
  let name = "Guest";
  let subtitle = "";

  if (notes) {
    const firstPart = notes.split("-")[0].trim();
    const match = firstPart.match(/^([^(]+)(?:\(([^)]+)\))?/);
    if (match) {
      name = match[1].trim();
      if (match[2]) {
        subtitle = match[2].trim();
      }
    } else {
      name = firstPart;
    }
  }

  if (!subtitle && userId) {
    if (userId.startsWith("user_")) {
      subtitle = "";
    } else {
      subtitle = userId;
    }
  }

  return { name: name || "Guest", subtitle };
}

export default function QueueDashboardPage() {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<
    "waitlist" | "reservations" | "table-view" | "completed" | "cancelled"
  >("waitlist");
  const [reservationFilter, setReservationFilter] = useState<"all" | "pending" | "booked">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [isEmptyState, setIsEmptyState] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drawer / Modal States
  const [isAddWaitlistOpen, setIsAddWaitlistOpen] = useState(false);
  const [isAddReservationOpen, setIsAddReservationOpen] = useState(false);
  const [isChangeStatusOpen, setIsChangeStatusOpen] = useState(false);
  const [statusSubTab, setStatusSubTab] = useState<"assign" | "late" | "cancel">("assign");
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Active Selected Item States for Drawers/Modals
  const [activeQueueItem, setActiveQueueItem] = useState<any | null>(null);
  const [selectedAssignTableId, setSelectedAssignTableId] = useState<Id<"organizationTables"> | null>(null);
  const [dispatchLayoutId, setDispatchLayoutId] = useState<string>("all");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [customNotifyMessage, setCustomNotifyMessage] = useState(
    "Your table is ready at Skyz Restaurant & Banquet! Please come to reception so the host can seat your party."
  );

  // Form Inputs for Add Walk-in Waitlist
  const [waitlistPhone, setWaitlistPhone] = useState("");
  const [waitlistFirstName, setWaitlistFirstName] = useState("");
  const [waitlistLastName, setWaitlistLastName] = useState("");
  const [waitlistGuests, setWaitlistGuests] = useState<number>(4);
  const [waitlistKidsSeat, setWaitlistKidsSeat] = useState(false);
  const [waitlistDisabledSeat, setWaitlistDisabledSeat] = useState(false);
  const [waitlistBarbequeSeat, setWaitlistBarbequeSeat] = useState(false);
  const [waitlistLayoutId, setWaitlistLayoutId] = useState<Id<"organizationLayouts"> | "">("");
  const [waitlistEstTime, setWaitlistEstTime] = useState<number>(20);
  const [waitlistNotes, setWaitlistNotes] = useState("");

  // Form Inputs for Add Advance Reservation
  const [resPhone, setResPhone] = useState("");
  const [resFirstName, setResFirstName] = useState("");
  const [resLastName, setResLastName] = useState("");
  const [resDate, setResDate] = useState(getTodayDateString());
  const [resTimeStr, setResTimeStr] = useState("18:20");
  const [resGuests, setResGuests] = useState<number>(2);
  const [resKidsSeat, setResKidsSeat] = useState(false);
  const [resDisabledSeat, setResDisabledSeat] = useState(false);
  const [resBarbequeSeat, setResBarbequeSeat] = useState(false);
  const [resNotes, setResNotes] = useState("");
  const [resLayoutId, setResLayoutId] = useState<Id<"organizationLayouts"> | "">("");

  // Drawer Form Inputs for Running Late / Cancel Reason
  const [latePresetMins, setLatePresetMins] = useState<number>(10);
  const [customLateMins, setCustomLateMins] = useState("");
  const [cancelReason, setCancelReason] = useState("Change of plans");
  const [cancelNotes, setCancelNotes] = useState("");

  // Table View Floor Sub-Tab
  const [selectedFloorLayoutId, setSelectedFloorLayoutId] = useState<string>("all");

  // ----------------------------------------------------
  // CONVEX REAL-TIME QUERIES & MUTATIONS
  // ----------------------------------------------------
  const queueList = useQuery(api.organizationQueues.list, {
    reservationDate: selectedDate,
  });
  const queueConfig = useQuery(api.organizationQueueConfigurations.get, {});
  const layoutList = useQuery(api.organizationLayouts.list, {});
  const tableList = useQuery(api.organizationTables.list, {});

  const auditQueueData = useQuery(
    api.organizationQueues.get,
    activeQueueItem?._id ? { id: activeQueueItem._id } : "skip"
  );

  const createQueue = useMutation(api.organizationQueues.create);
  const updateQueue = useMutation(api.organizationQueues.update);
  const assignTableQueue = useMutation(api.organizationQueues.assignTable);
  const removeQueue = useMutation(api.organizationQueues.remove);
  const updateConfig = useMutation(api.organizationQueueConfigurations.update);

  // Set default wait time from config when available
  useEffect(() => {
    if (queueConfig?.defaultWaitTime) {
      const parsed = parseInt(queueConfig.defaultWaitTime, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setWaitlistEstTime(parsed);
      }
    }
  }, [queueConfig]);

  // Toast Helper
  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }

  // Filtered Queues by Search Query
  const filteredQueues = useMemo(() => {
    if (!queueList) return [];
    if (!searchQuery.trim()) return queueList;
    const term = searchQuery.toLowerCase();
    return queueList.filter((item) => {
      const qNum = (item.queueNumber || "").toLowerCase();
      const notes = (item.notes || "").toLowerCase();
      const phone = (item.userId || "").toLowerCase();
      return qNum.includes(term) || notes.includes(term) || phone.includes(term);
    });
  }, [queueList, searchQuery]);

  // Selected table helper for seating dispatch
  const selectedAssignTable = useMemo(() => {
    if (!selectedAssignTableId || !tableList) return null;
    return tableList.find((t) => t._id === selectedAssignTableId) || null;
  }, [selectedAssignTableId, tableList]);

  // Categorized Queue Lists
  const waitlistItems = useMemo(() => {
    return filteredQueues.filter(
      (q) =>
        q.queueType === "waitlist" &&
        q.queueStatus !== "completed" &&
        q.queueStatus !== "cancelled_by_admin" &&
        q.queueStatus !== "cancelled_by_user" &&
        q.queueStatus !== "rejected"
    );
  }, [filteredQueues]);

  const reservationItems = useMemo(() => {
    return filteredQueues.filter(
      (q) =>
        q.queueType === "reservation" &&
        q.queueStatus !== "completed" &&
        q.queueStatus !== "cancelled_by_admin" &&
        q.queueStatus !== "cancelled_by_user" &&
        q.queueStatus !== "rejected"
    );
  }, [filteredQueues]);

  const pendingReservationCount = useMemo(() => {
    return reservationItems.filter((q) => q.queueStatus === "pending").length;
  }, [reservationItems]);

  const bookedReservationCount = useMemo(() => {
    return reservationItems.filter((q) => q.queueStatus !== "pending").length;
  }, [reservationItems]);

  const displayedReservationItems = useMemo(() => {
    if (reservationFilter === "pending") {
      return reservationItems.filter((q) => q.queueStatus === "pending");
    }
    if (reservationFilter === "booked") {
      return reservationItems.filter((q) => q.queueStatus !== "pending");
    }
    return reservationItems;
  }, [reservationItems, reservationFilter]);

  const completedItems = useMemo(() => {
    return filteredQueues.filter((q) => q.queueStatus === "completed");
  }, [filteredQueues]);

  const cancelledItems = useMemo(() => {
    return filteredQueues.filter(
      (q) =>
        q.queueStatus === "cancelled_by_admin" ||
        q.queueStatus === "cancelled_by_user" ||
        q.queueStatus === "rejected"
    );
  }, [filteredQueues]);

  // KPI Calculations
  const inWaitlistCount = waitlistItems.length;
  const totalWaitingGuests = waitlistItems.reduce(
    (sum, item) => sum + (item.totalGuests || 0),
    0
  );
  const totalTablesCount = tableList ? tableList.length : 16;
  const occupiedTablesCount = tableList
    ? tableList.filter((t) => t.currentOrderId || t.isBlock).length
    : 14;
  const activeTablesPercentage = totalTablesCount
    ? Math.round((occupiedTablesCount / totalTablesCount) * 100)
    : 84;
  const upcomingBookingsCount = reservationItems.length;
  const nextBookingTimeStr = reservationItems.length > 0
    ? formatTimestampTime(reservationItems[0].reservationTime)
    : "None Today";

  // Intake status toggle
  const isIntakeOn = queueConfig?.onlineWaitlist ?? true;

  async function handleToggleIntake() {
    try {
      await updateConfig({
        onlineWaitlist: !isIntakeOn,
      });
      showToast(
        !isIntakeOn ? "Waitlist intake is now live" : "Waitlist intake paused for walk-ins"
      );
    } catch (err: any) {
      showToast(`Error updating intake: ${err.message}`);
    }
  }

  // Primary Action Button Handler
  function handleMainPrimaryCTA() {
    if (activeTab === "reservations") {
      setIsAddReservationOpen(true);
    } else {
      setIsAddWaitlistOpen(true);
    }
  }

  // Open Call Modal
  function handleOpenCallModal(name: string, phone: string) {
    setContactName(name);
    setContactPhone(phone);
    setIsCallModalOpen(true);
  }

  // Open Notify SMS Modal
  function handleOpenNotifyModal(name: string, phone: string) {
    setContactName(name);
    setContactPhone(phone);
    setIsNotifyModalOpen(true);
  }

  // Open Status Dispatch Drawer
  function handleOpenStatusDrawer(
    queueItem: any,
    defaultSubTab: "assign" | "late" | "cancel" = "assign"
  ) {
    setActiveQueueItem(queueItem);
    setStatusSubTab(defaultSubTab);
    setSelectedAssignTableId(queueItem.tableId || null);
    setDispatchLayoutId(queueItem.layoutId || "all");
    setLatePresetMins(10);
    setCustomLateMins("");
    setIsChangeStatusOpen(true);
  }

  // Open Audit Modal
  function handleOpenAuditModal(queueItem: any) {
    setActiveQueueItem(queueItem);
    setIsAuditModalOpen(true);
  }

  // Submit Add to Waitlist Form
  async function handleSubmitWaitlistForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      const fullName = `${waitlistFirstName} ${waitlistLastName}`.trim() || "Walk-in Guest";
      await createQueue({
        queueType: "waitlist",
        totalGuests: waitlistGuests,
        kidsSeat: waitlistKidsSeat,
        disabledSeat: waitlistDisabledSeat,
        barbequeSeat: waitlistBarbequeSeat,
        reservationDate: selectedDate,
        notes: `${fullName} (${waitlistPhone}) ${waitlistNotes ? "- " + waitlistNotes : ""}`.trim(),
        layoutId: waitlistLayoutId ? (waitlistLayoutId as Id<"organizationLayouts">) : undefined,
      });
      setIsAddWaitlistOpen(false);
      showToast("Guest added to waitlist sequence!");
      setWaitlistPhone("");
      setWaitlistFirstName("");
      setWaitlistLastName("");
      setWaitlistNotes("");
    } catch (err: any) {
      showToast(`Failed to add to waitlist: ${err.message}`);
    }
  }

  // Submit Add Reservation Form
  async function handleSubmitReservationForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      const fullName = `${resFirstName} ${resLastName}`.trim() || "Reservation Guest";
      let ts = Date.now();
      if (resTimeStr) {
        const [h, m] = resTimeStr.split(":").map(Number);
        const d = new Date(resDate);
        d.setHours(h || 18, m || 0, 0, 0);
        ts = d.getTime();
      }

      await createQueue({
        queueType: "reservation",
        totalGuests: resGuests,
        kidsSeat: resKidsSeat,
        disabledSeat: resDisabledSeat,
        barbequeSeat: resBarbequeSeat,
        reservationDate: resDate,
        reservationTime: ts,
        notes: `${fullName} (${resPhone}) ${resNotes ? "- " + resNotes : ""}`.trim(),
        layoutId: resLayoutId ? (resLayoutId as Id<"organizationLayouts">) : undefined,
      });
      setIsAddReservationOpen(false);
      showToast("Table reservation created successfully!");
      setResPhone("");
      setResFirstName("");
      setResLastName("");
      setResNotes("");
    } catch (err: any) {
      showToast(`Failed to add reservation: ${err.message}`);
    }
  }

  // Execute Status Drawer Action
  async function handleExecuteStatusAction() {
    if (!activeQueueItem) return;

    try {
      if (statusSubTab === "assign") {
        if (selectedAssignTableId) {
          await assignTableQueue({
            id: activeQueueItem._id,
            tableId: selectedAssignTableId,
          });
          await updateQueue({
            id: activeQueueItem._id,
            queueStatus: "completed",
          });
          showToast(`Guest seated at Table!`);
        } else {
          await updateQueue({
            id: activeQueueItem._id,
            queueStatus: "arrived",
          });
          showToast(`Ticket status updated to Arrived!`);
        }
      } else if (statusSubTab === "late") {
        const effectiveMins = customLateMins ? (parseInt(customLateMins, 10) || latePresetMins) : latePresetMins;
        await updateQueue({
          id: activeQueueItem._id,
          queueStatus: "running_late",
          reason: `Guest running late (${effectiveMins} mins grace period applied)`,
        });
        showToast(`Running late grace period applied (${effectiveMins}m)`);
      } else if (statusSubTab === "cancel") {
        await updateQueue({
          id: activeQueueItem._id,
          queueStatus: "cancelled_by_admin",
          reason: cancelReason + (cancelNotes ? `: ${cancelNotes}` : ""),
        });
        showToast(`Booking cancelled and recorded.`);
      }
      setIsChangeStatusOpen(false);
      setActiveQueueItem(null);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  }

  // Handle Booking Approval for Pending Reservations
  async function handleApprovePendingReservation(queueId: Id<"organizationQueues">) {
    try {
      await updateQueue({
        id: queueId,
        queueStatus: "booked",
      });
      showToast("Reservation approved & booked!");
    } catch (err: any) {
      showToast(`Failed to approve reservation: ${err.message}`);
    }
  }

  // Handle Booking Rejection for Pending Reservations
  async function handleRejectPendingReservation(queueId: Id<"organizationQueues">) {
    try {
      await updateQueue({
        id: queueId,
        queueStatus: "rejected",
        reason: "Reservation request rejected by host",
      });
      showToast("Reservation request rejected.");
    } catch (err: any) {
      showToast(`Failed to reject reservation: ${err.message}`);
    }
  }

  // Handle Direct Table Seating from Floor Plan
  async function handleSeatNextOnTable(tableId: Id<"organizationTables">) {
    if (waitlistItems.length > 0) {
      const nextGuest = waitlistItems[0];
      try {
        await assignTableQueue({
          id: nextGuest._id,
          tableId,
        });
        await updateQueue({
          id: nextGuest._id,
          queueStatus: "completed",
        });
        showToast(`${nextGuest.queueNumber || "Guest"} seated at selected table!`);
      } catch (err: any) {
        showToast(`Failed to seat guest: ${err.message}`);
      }
    } else {
      showToast("No active walk-in guests waiting in queue.");
    }
  }

  const tabSubtitles: Record<string, string> = {
    waitlist: "Manage guests waiting for a table in live sequence.",
    reservations: "Manage today's and upcoming table bookings.",
    "table-view": "See which tables are available or in use across active zones.",
    completed: "View guests who have finished their visit and vacated.",
    cancelled: "View cancelled or missed customer bookings.",
  };

  return (
    <PosShell title="Queue & Host Folio" subtitle="Service Floor • Host Stand">
        <div className="flex-1 min-h-0 flex flex-col bg-[#fff8f5] text-[#1e1b19] overflow-y-scroll [scrollbar-gutter:stable]">
          {/* Operational Header Section */}
        <div className="px-8 pt-6 pb-4 bg-[#fff8f5] flex flex-col gap-4 border-b border-[#eee7e3]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-[#645d58] uppercase tracking-widest font-mono">
                  Service Floor • Host Stand
                </span>
                <span className="w-1 h-1 rounded-full bg-[#7f7570]" />
                <span className="text-xs text-[#4d4541] font-medium">Station #02</span>
              </div>
              <h1 className="text-3xl font-serif text-[#1e1b19] tracking-tight">Queue & Host Folio</h1>
            </div>

            {/* Right Operational Controls */}
            <div className="flex items-center flex-wrap gap-3">
              {/* Search Input */}
              <div className="relative min-w-[240px] md:min-w-[280px] shrink-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#645d58] text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search queue no, phone, notes..."
                  className="w-full bg-white text-[#1e1b19] text-sm pl-10 pr-4 py-1.5 rounded-full shadow-xs border border-[#e9e1dd] focus:outline-none focus:bg-[#faf2ee] transition-all"
                />
              </div>

              {/* Date Pill Picker */}
              <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full shadow-xs border border-[#e9e1dd] text-sm text-[#1e1b19] shrink-0">
                <span className="material-symbols-outlined text-[18px] text-[#645d58]">
                  calendar_today
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="font-mono text-xs font-medium focus:outline-none bg-transparent"
                />
              </div>

              {/* Availability Intake Toggle */}
              <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full shadow-xs border border-[#e9e1dd] shrink-0 min-w-[170px]">
                <span className="text-xs text-[#645d58] whitespace-nowrap">Waitlist Intake</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isIntakeOn}
                  onClick={handleToggleIntake}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                    isIntakeOn ? "bg-emerald-600" : "bg-stone-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      isIntakeOn ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span
                  className={`text-xs font-semibold w-7 inline-flex items-center justify-center ${
                    isIntakeOn ? "text-emerald-800" : "text-[#645d58]"
                  }`}
                >
                  {isIntakeOn ? "ON" : "OFF"}
                </span>
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleMainPrimaryCTA}
                className="flex items-center justify-center gap-1.5 min-w-[190px] px-5 py-2 rounded-full bg-[#000000] text-white text-sm font-medium shadow-md hover:bg-neutral-800 active:scale-[0.98] transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span className="whitespace-nowrap">
                  {activeTab === "reservations" ? "Add a reservation" : "Add to waitlist"}
                </span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs & Helper Description */}
          <div className="flex flex-col gap-1 pt-1">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => {
                  setActiveTab("waitlist");
                  if (isEmptyState) setIsEmptyState(false);
                }}
                className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === "waitlist"
                    ? "bg-[#000000] text-white shadow-xs"
                    : "text-[#4d4541] hover:bg-[#eee7e3] hover:text-[#1e1b19]"
                }`}
              >
                Waitlist{" "}
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-mono ${
                    activeTab === "waitlist"
                      ? "bg-neutral-800 text-white"
                      : "bg-[#e9e1dd] text-[#1e1b19]"
                  }`}
                >
                  {waitlistItems.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("reservations");
                  if (isEmptyState) setIsEmptyState(false);
                }}
                className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === "reservations"
                    ? "bg-[#000000] text-white shadow-xs"
                    : "text-[#4d4541] hover:bg-[#eee7e3] hover:text-[#1e1b19]"
                }`}
              >
                Reservations{" "}
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-mono ${
                    activeTab === "reservations"
                      ? "bg-neutral-800 text-white"
                      : "bg-[#e9e1dd] text-[#1e1b19]"
                  }`}
                >
                  {reservationItems.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("table-view");
                  if (isEmptyState) setIsEmptyState(false);
                }}
                className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === "table-view"
                    ? "bg-[#000000] text-white shadow-xs"
                    : "text-[#4d4541] hover:bg-[#eee7e3] hover:text-[#1e1b19]"
                }`}
              >
                Table View
              </button>

              <button
                onClick={() => {
                  setActiveTab("completed");
                  if (isEmptyState) setIsEmptyState(false);
                }}
                className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === "completed"
                    ? "bg-[#000000] text-white shadow-xs"
                    : "text-[#4d4541] hover:bg-[#eee7e3] hover:text-[#1e1b19]"
                }`}
              >
                Completed{" "}
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-mono ${
                    activeTab === "completed"
                      ? "bg-neutral-800 text-white"
                      : "bg-[#e9e1dd] text-[#1e1b19]"
                  }`}
                >
                  {completedItems.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("cancelled");
                  if (isEmptyState) setIsEmptyState(false);
                }}
                className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === "cancelled"
                    ? "bg-[#000000] text-white shadow-xs"
                    : "text-[#4d4541] hover:bg-[#eee7e3] hover:text-[#1e1b19]"
                }`}
              >
                Cancelled{" "}
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-mono ${
                    activeTab === "cancelled"
                      ? "bg-neutral-800 text-white"
                      : "bg-[#e9e1dd] text-[#1e1b19]"
                  }`}
                >
                  {cancelledItems.length}
                </span>
              </button>
            </div>
            <p className="text-sm text-[#645d58] italic font-serif min-h-[20px]">
              {tabSubtitles[activeTab] || ""}
            </p>
          </div>
        </div>

        {/* Main Viewports Container */}
        <div className="p-8 flex flex-col gap-6">
          {/* KPI Pulse Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-[#e9e1dd] flex flex-col justify-between">
              <span className="text-xs text-[#645d58] uppercase tracking-wider font-semibold">
                In Waitlist
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-serif text-[#1e1b19]">
                  {inWaitlistCount}
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {totalWaitingGuests} Guests
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-xs border border-[#e9e1dd] flex flex-col justify-between">
              <span className="text-xs text-[#645d58] uppercase tracking-wider font-semibold">
                Active Tables
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-serif text-[#1e1b19]">
                  {activeTablesPercentage}
                  <span className="text-sm font-sans text-[#645d58]">%</span>
                </span>
                <span className="text-xs font-semibold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                  {occupiedTablesCount} / {totalTablesCount} Seated
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-xs border border-[#e9e1dd] flex flex-col justify-between">
              <span className="text-xs text-[#645d58] uppercase tracking-wider font-semibold">
                Upcoming Bookings
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-serif text-[#1e1b19]">
                  {upcomingBookingsCount}
                </span>
                <span className="text-xs font-semibold text-[#645d58] bg-[#f4ece8] px-2.5 py-0.5 rounded-full">
                  Next @ {nextBookingTimeStr}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-xs border border-[#e9e1dd] flex flex-col justify-between">
              <span className="text-xs text-[#645d58] uppercase tracking-wider font-semibold">
                Estimated Pace
              </span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-3xl font-serif text-[#1e1b19]">
                  {queueConfig?.defaultWaitTime || "15"}
                  <span className="text-sm font-sans text-[#645d58]">m</span>
                </span>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Normal Flow
                </span>
              </div>
            </div>
          </div>

          {/* EMPTY STATE CONTAINER */}
          {isEmptyState && (
            <div className="flex flex-col items-center justify-center py-16 px-6 bg-white rounded-2xl shadow-xs border border-[#e9e1dd] text-center">
              <div className="w-20 h-20 rounded-full bg-[#eee7e3] flex items-center justify-center text-[#645d58] mb-4">
                <span className="material-symbols-outlined text-4xl">inbox</span>
              </div>
              <h3 className="text-2xl font-serif text-[#1e1b19] mb-2">No active queue entries</h3>
              <p className="text-sm text-[#645d58] max-w-md mb-6">
                The floor waitlist is currently clear. Add a walk-in guest or check scheduled reservations.
              </p>
              <button
                type="button"
                onClick={() => setIsAddWaitlistOpen(true)}
                className="px-6 py-2.5 rounded-full bg-[#000000] text-white text-sm font-medium shadow-md hover:bg-neutral-800 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add Walk-in to Waitlist</span>
              </button>
            </div>
          )}

          {!isEmptyState && (
            <>
              {/* TAB 1: WAITLIST VIEW */}
              {activeTab === "waitlist" && (
                <div className="flex flex-col gap-4">
                  <div className="bg-white rounded-2xl shadow-xs border border-[#e9e1dd] overflow-hidden">
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#eee7e3] text-[#645d58] text-xs uppercase tracking-wider font-mono">
                            <th className="py-3 px-3 font-semibold">Queue No</th>
                            <th className="py-3 px-3 font-semibold">Customer</th>
                            <th className="py-3 px-3 font-semibold">Guests</th>
                            <th className="py-3 px-3 font-semibold">Booking Time</th>
                            <th className="py-3 px-3 font-semibold">Est Time</th>
                            <th className="py-3 px-3 font-semibold">Wait Time</th>
                            <th className="py-3 px-3 font-semibold">Layout Preference</th>
                            <th className="py-3 px-3 font-semibold">Special Requests</th>
                            <th className="py-3 px-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eee7e3] text-sm text-[#1e1b19]">
                          {waitlistItems.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-12 text-center text-[#645d58] italic font-serif">
                                No active walk-in guests in the waitlist sequence.
                              </td>
                            </tr>
                          ) : (
                            waitlistItems.map((item) => {
                              const elapsedMins = getElapsedMinutes(item.createdAt);
                              const layoutName = item.layout?.name || "Indoor-DineIn";
                              const ticketCode = formatShortTicketNumber(item.queueNumber);
                              const customer = parseCustomerInfo(item.notes, item.userId);
                              return (
                                <tr key={item._id} className="hover:bg-[#faf2ee]/60 transition-colors">
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#000000] text-white font-mono text-xs font-bold tracking-wider shadow-xs">
                                      {ticketCode}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="flex flex-col max-w-[170px]">
                                      <span className="font-medium text-[#1e1b19] truncate" title={customer.name}>
                                        {customer.name}
                                      </span>
                                      {customer.subtitle && (
                                        <span className="font-mono text-xs text-[#645d58] truncate" title={customer.subtitle}>
                                          {customer.subtitle}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5 font-medium">
                                      <span className="material-symbols-outlined text-[18px] text-[#645d58]">
                                        group
                                      </span>
                                      <span>{item.totalGuests || 2} guests</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <div className="flex flex-col font-mono text-xs">
                                      <span className="text-[#1e1b19] font-medium">
                                        {formatTimestampTime(item.createdAt)}
                                      </span>
                                      <span className="text-[#645d58] text-[11px]">
                                        {formatDisplayDate(item.reservationDate)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <div className="flex flex-col">
                                      <span className="font-medium font-mono text-[#1e1b19]">
                                        {formatTimestampTime((item.createdAt || Date.now()) + (queueConfig?.defaultWaitTime ? parseInt(queueConfig.defaultWaitTime, 10)*60000 : 1200000))}
                                      </span>
                                      <span className="text-[#645d58] text-xs">
                                        ({queueConfig?.defaultWaitTime || 20} mins)
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <LiveWaitlistStopwatch createdAt={item.createdAt} />
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f4ece8] text-[#4d4541] font-medium text-xs">
                                      {layoutName}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-1.5">
                                      {item.kidsSeat && (
                                        <span
                                          className="p-1 rounded-full bg-[#f4ece8] text-[#4d4541] flex items-center justify-center"
                                          title="Kids Seat / Highchair"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">
                                            child_friendly
                                          </span>
                                        </span>
                                      )}
                                      {item.disabledSeat && (
                                        <span
                                          className="p-1 rounded-full bg-[#f4ece8] text-[#4d4541] flex items-center justify-center"
                                          title="Wheelchair / Accessible"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">
                                            accessible
                                          </span>
                                        </span>
                                      )}
                                      {item.barbequeSeat && (
                                        <span
                                          className="p-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 flex items-center justify-center"
                                          title="Barbeque Grill Table"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">
                                            outdoor_grill
                                          </span>
                                        </span>
                                      )}
                                      {!item.kidsSeat && !item.disabledSeat && !item.barbequeSeat && (
                                        <span className="text-xs text-[#645d58] italic">None</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap text-right">
                                    <div className="inline-flex items-center gap-1 justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenCallModal(
                                            item.notes ? customer.name : "Guest",
                                            item.userId || "+91 9825000000"
                                          )
                                        }
                                        className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f4ece8] hover:bg-[#e9e1dd] text-[#1e1b19] transition-colors"
                                        title="Call Customer"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">call</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenNotifyModal(
                                            item.notes ? customer.name : "Guest",
                                            item.userId || "+91 9825000000"
                                          )
                                        }
                                        className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f4ece8] hover:bg-[#e9e1dd] text-[#1e1b19] transition-colors"
                                        title="Notify SMS"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">chat</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenStatusDrawer(item, "assign")}
                                        className="px-3 py-1 rounded-full bg-[#000000] text-white text-xs font-medium hover:bg-neutral-800 transition-colors flex items-center gap-1 shadow-xs"
                                        title="Assign Table & Seat"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">
                                          check_circle
                                        </span>
                                        <span>Seat</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAuditModal(item)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#645d58] hover:text-[#1e1b19] transition-colors"
                                        title="View Audit Timeline"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">history</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: RESERVATIONS VIEW */}
              {activeTab === "reservations" && (
                <div className="flex flex-col gap-4">
                  {/* Pending Requests Alert Banner */}
                  {pendingReservationCount > 0 && (
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-200 text-purple-900 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[20px]">mark_email_unread</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-purple-950">
                            {pendingReservationCount} Pending Reservation Request{pendingReservationCount > 1 ? "s" : ""}
                          </h4>
                          <p className="text-xs text-purple-800">
                            Customer table booking requests requiring hostess review and approval.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReservationFilter("pending")}
                        className="px-4 py-1.5 rounded-full bg-purple-900 text-white text-xs font-semibold hover:bg-purple-950 transition-colors shrink-0 shadow-xs"
                      >
                        View Pending ({pendingReservationCount})
                      </button>
                    </div>
                  )}

                  {/* Sub-Filters */}
                  <div className="flex items-center justify-between bg-white p-2.5 px-4 rounded-2xl shadow-xs border border-[#e9e1dd]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReservationFilter("all")}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          reservationFilter === "all"
                            ? "bg-[#000000] text-white"
                            : "bg-[#f4ece8] text-[#4d4541] hover:bg-[#e9e1dd]"
                        }`}
                      >
                        All Reservations ({reservationItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setReservationFilter("pending")}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                          reservationFilter === "pending"
                            ? "bg-purple-900 text-white"
                            : "bg-purple-50 text-purple-900 hover:bg-purple-100"
                        }`}
                      >
                        <span>Pending Approval</span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-950 text-[10px] font-mono font-bold">
                          {pendingReservationCount}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReservationFilter("booked")}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          reservationFilter === "booked"
                            ? "bg-[#000000] text-white"
                            : "bg-[#f4ece8] text-[#4d4541] hover:bg-[#e9e1dd]"
                        }`}
                      >
                        Approved / Booked ({bookedReservationCount})
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-xs border border-[#e9e1dd] overflow-hidden">
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#eee7e3] text-[#645d58] text-xs uppercase tracking-wider font-mono">
                            <th className="py-3 px-3 font-semibold">Reservation No</th>
                            <th className="py-3 px-3 font-semibold">Customer</th>
                            <th className="py-3 px-3 font-semibold">Guests</th>
                            <th className="py-3 px-3 font-semibold">Booking Date</th>
                            <th className="py-3 px-3 font-semibold">Reservation Time</th>
                            <th className="py-3 px-3 font-semibold">Layout Preference</th>
                            <th className="py-3 px-3 font-semibold">Special Requests</th>
                            <th className="py-3 px-3 font-semibold">Status</th>
                            <th className="py-3 px-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eee7e3] text-sm text-[#1e1b19]">
                          {displayedReservationItems.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-12 text-center text-[#645d58] italic font-serif">
                                {reservationFilter === "pending"
                                  ? "No pending reservation requests awaiting approval."
                                  : `No table reservations scheduled for ${formatDisplayDate(selectedDate)}.`}
                              </td>
                            </tr>
                          ) : (
                            displayedReservationItems.map((item) => {
                              const layoutName = item.layout?.name || "Indoor-DineIn";
                              const isPending = item.queueStatus === "pending";
                              const ticketCode = formatShortTicketNumber(item.queueNumber);
                              const customer = parseCustomerInfo(item.notes, item.userId);
                              return (
                                <tr key={item._id} className="hover:bg-[#faf2ee]/60 transition-colors">
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#000000] text-white font-mono text-xs font-bold tracking-wider shadow-xs">
                                      {ticketCode}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3">
                                    <div className="flex flex-col max-w-[170px]">
                                      <span className="font-medium text-[#1e1b19] truncate" title={customer.name}>
                                        {customer.name}
                                      </span>
                                      {customer.subtitle && (
                                        <span className="font-mono text-xs text-[#645d58] truncate" title={customer.subtitle}>
                                          {customer.subtitle}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5 font-medium">
                                      <span className="material-symbols-outlined text-[18px] text-[#645d58]">
                                        group
                                      </span>
                                      <span>{item.totalGuests || 2} guests</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap font-mono text-xs">
                                    <div className="flex flex-col">
                                      <span className="text-[#1e1b19] font-medium">
                                        {formatDisplayDate(item.reservationDate)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <span className="font-mono font-bold text-[#1e1b19] text-base">
                                      {formatTimestampTime(item.reservationTime)}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f4ece8] text-[#4d4541] font-medium text-xs">
                                      {layoutName}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="flex items-center gap-1.5">
                                      {item.kidsSeat && (
                                        <span className="p-1 rounded-full bg-[#f4ece8] text-[#4d4541]" title="Kids Seat">
                                          <span className="material-symbols-outlined text-[16px]">child_friendly</span>
                                        </span>
                                      )}
                                      {item.disabledSeat && (
                                        <span className="p-1 rounded-full bg-[#f4ece8] text-[#4d4541]" title="Wheelchair">
                                          <span className="material-symbols-outlined text-[16px]">accessible</span>
                                        </span>
                                      )}
                                      {item.barbequeSeat && (
                                        <span className="p-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200" title="BBQ Grill">
                                          <span className="material-symbols-outlined text-[16px]">outdoor_grill</span>
                                        </span>
                                      )}
                                      {!item.kidsSeat && !item.disabledSeat && !item.barbequeSeat && (
                                        <span className="text-xs text-[#645d58] italic">None</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    {isPending ? (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-900 text-xs font-semibold uppercase tracking-wider">
                                        Approval Pending
                                      </span>
                                    ) : item.queueStatus === "running_late" ? (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold uppercase tracking-wider">
                                        Running Late
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-semibold uppercase tracking-wider">
                                        Booked
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap text-right">
                                    <div className="inline-flex items-center gap-1 justify-end">
                                      {isPending ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleApprovePendingReservation(item._id)}
                                            className="px-3 py-1 rounded-full bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 flex items-center gap-1 shadow-xs"
                                            title="Approve Reservation"
                                          >
                                            <span className="material-symbols-outlined text-[16px]">check</span>
                                            <span>Approve</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRejectPendingReservation(item._id)}
                                            className="px-3 py-1 rounded-full bg-rose-700 text-white text-xs font-medium hover:bg-rose-800 flex items-center gap-1 shadow-xs"
                                            title="Reject Reservation"
                                          >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                            <span>Reject</span>
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenStatusDrawer(item, "assign")}
                                          className="px-3 py-1 rounded-full bg-[#000000] text-white text-xs font-medium hover:bg-neutral-800 flex items-center gap-1 shadow-xs"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                          <span>Seat</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenCallModal(
                                            item.notes ? item.notes.split("-")[0] : "Guest",
                                            item.userId || "+91 9825000000"
                                          )
                                        }
                                        className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f4ece8] hover:bg-[#e9e1dd] text-[#1e1b19]"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">call</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenNotifyModal(
                                            item.notes ? item.notes.split("-")[0] : "Guest",
                                            item.userId || "+91 9825000000"
                                          )
                                        }
                                        className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f4ece8] hover:bg-[#e9e1dd] text-[#1e1b19]"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">chat</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenStatusDrawer(item, "cancel")}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#645d58] hover:text-rose-700"
                                        title="Cancel Booking"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TABLE VIEW (FLOOR MAP GRID) */}
              {activeTab === "table-view" && (
                <div className="flex flex-col gap-6">
                  {/* Floor Sub-Navigation */}
                  <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-3 px-5 rounded-2xl shadow-xs border border-[#e9e1dd]">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setSelectedFloorLayoutId("all")}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          selectedFloorLayoutId === "all"
                            ? "bg-[#000000] text-white"
                            : "bg-[#f4ece8] text-[#4d4541] hover:bg-[#e9e1dd]"
                        }`}
                      >
                        All Zones
                      </button>
                      {layoutList?.map((layout) => (
                        <button
                          key={layout._id}
                          type="button"
                          onClick={() => setSelectedFloorLayoutId(layout._id)}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            selectedFloorLayoutId === layout._id
                              ? "bg-[#000000] text-white"
                              : "bg-[#f4ece8] text-[#4d4541] hover:bg-[#e9e1dd]"
                          }`}
                        >
                          {layout.name}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs font-mono text-[#645d58]">
                      Total Floor Capacity:{" "}
                      <span className="font-bold text-[#1e1b19]">
                        {tableList?.reduce((s, t) => s + (t.seatingCapacity || 0), 0) || 32} seats
                      </span>
                    </div>
                  </div>

                  {/* Floor Plan Grid Canvas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(!tableList || tableList.length === 0) ? (
                      <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#e9e1dd] flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs text-[#645d58] uppercase font-mono">TABLE 5</span>
                            <h3 className="text-2xl font-serif text-[#1e1b19]">T-05</h3>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-semibold">
                            Available
                          </span>
                        </div>
                        <div className="py-4 space-y-2 text-xs text-[#645d58]">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px]">chair</span> Cap: 4
                            </span>
                            <span className="text-emerald-700 font-medium">Ready for Seating</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSeatNextOnTable("dummy" as any)}
                          className="w-full py-1.5 rounded-full bg-[#000000] text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
                        >
                          Seat Next Guest
                        </button>
                      </div>
                    ) : (
                      tableList
                        .filter(
                          (t) =>
                            selectedFloorLayoutId === "all" || t.layoutId === selectedFloorLayoutId
                        )
                        .map((table) => {
                          const isOccupied = Boolean(table.currentOrderId);
                          const isBlocked = Boolean(table.isBlock);
                          const borderTopClass = isBlocked
                            ? "bg-rose-500"
                            : isOccupied
                            ? "bg-sky-500"
                            : "bg-emerald-500";

                          return (
                            <div
                              key={table._id}
                              className="bg-white rounded-2xl p-6 shadow-xs border border-[#e9e1dd] flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow"
                            >
                              <div className={`absolute top-0 left-0 right-0 h-1.5 ${borderTopClass}`} />
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="text-xs text-[#645d58] uppercase font-mono tracking-wider">
                                    TBL #{table.tableNumber}
                                  </span>
                                  <h3 className="text-2xl font-serif text-[#1e1b19] leading-tight">
                                    T-{table.tableNumber}
                                  </h3>
                                </div>
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    isBlocked
                                      ? "bg-rose-100 text-rose-900"
                                      : isOccupied
                                      ? "bg-sky-100 text-sky-900"
                                      : "bg-emerald-100 text-emerald-900"
                                  }`}
                                >
                                  {isBlocked ? "Blocked / VIP" : isOccupied ? "Seated / In Use" : "Available"}
                                </span>
                              </div>

                              <div className="py-4 space-y-2">
                                <div className="flex items-center justify-between text-xs text-[#645d58]">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">chair</span> Capacity:{" "}
                                    {table.seatingCapacity}
                                  </span>
                                  {isOccupied ? (
                                    <span className="text-sky-900 font-medium">Occupied</span>
                                  ) : isBlocked ? (
                                    <span className="text-rose-800 font-medium">VIP Holding</span>
                                  ) : (
                                    <span className="text-emerald-700 font-medium">Ready</span>
                                  )}
                                </div>
                              </div>

                              <div className="pt-2">
                                {!isOccupied && !isBlocked ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSeatNextOnTable(table._id)}
                                    className="w-full py-1.5 rounded-full bg-[#000000] text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
                                  >
                                    Seat Next Guest
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      showToast(`Table ${table.tableNumber} is currently occupied`)
                                    }
                                    className="w-full py-1.5 rounded-full bg-[#f4ece8] text-[#1e1b19] text-xs font-medium hover:bg-[#e9e1dd] transition-colors"
                                  >
                                    View Table Details
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* Color Legend Bar */}
                  <div className="bg-white rounded-2xl p-4 shadow-xs border border-[#e9e1dd] flex items-center justify-center flex-wrap gap-6 text-xs text-[#1e1b19] font-medium">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-sky-500" />
                      <span>Seated / In Use</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500" />
                      <span>Time over 2hrs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500" />
                      <span>Blocked / Reserved</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: COMPLETED VIEW */}
              {activeTab === "completed" && (
                <div className="bg-white rounded-2xl shadow-xs border border-[#e9e1dd] overflow-hidden">
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#eee7e3] text-[#645d58] text-xs uppercase tracking-wider font-mono">
                          <th className="py-3 px-3 font-semibold">Booking No</th>
                          <th className="py-3 px-3 font-semibold">Customer</th>
                          <th className="py-3 px-3 font-semibold">Type</th>
                          <th className="py-3 px-3 font-semibold">Created Time</th>
                          <th className="py-3 px-3 font-semibold">Completed Time</th>
                          <th className="py-3 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eee7e3] text-sm text-[#1e1b19]">
                        {completedItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-[#645d58] italic font-serif">
                              No completed visits recorded today.
                            </td>
                          </tr>
                        ) : (
                          completedItems.map((item) => {
                            const ticketCode = formatShortTicketNumber(item.queueNumber);
                            const customer = parseCustomerInfo(item.notes, item.userId);
                            return (
                              <tr key={item._id} className="hover:bg-[#faf2ee]/60 transition-colors">
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#000000] text-white font-mono text-xs font-bold tracking-wider shadow-xs">
                                    {ticketCode}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex flex-col max-w-[170px]">
                                    <span className="font-medium text-[#1e1b19] truncate" title={customer.name}>
                                      {customer.name}
                                    </span>
                                    {customer.subtitle && (
                                      <span className="font-mono text-xs text-[#645d58] truncate" title={customer.subtitle}>
                                        {customer.subtitle}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#f4ece8] text-[#1e1b19] text-xs font-medium capitalize">
                                    {item.queueType}
                                  </span>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap font-mono text-xs text-[#645d58]">
                                  {formatTimestampTime(item.createdAt)}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap font-mono text-xs font-medium text-emerald-800">
                                  {formatTimestampTime(item.completionTime || item.updatedAt)}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAuditModal(item)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f4ece8] hover:bg-[#e9e1dd] text-[#1e1b19] ml-auto"
                                    title="View Timeline Audit"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">history</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: CANCELLED VIEW */}
              {activeTab === "cancelled" && (
                <div className="bg-white rounded-2xl shadow-xs border border-[#e9e1dd] overflow-hidden">
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#eee7e3] text-[#645d58] text-xs uppercase tracking-wider font-mono">
                          <th className="py-3 px-3 font-semibold">Booking No</th>
                          <th className="py-3 px-3 font-semibold">Customer</th>
                          <th className="py-3 px-3 font-semibold">Type</th>
                          <th className="py-3 px-3 font-semibold">Created Time</th>
                          <th className="py-3 px-3 font-semibold">Cancellation Time</th>
                          <th className="py-3 px-3 font-semibold">Reason</th>
                          <th className="py-3 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eee7e3] text-sm text-[#1e1b19]">
                        {cancelledItems.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-[#645d58] italic font-serif">
                              No cancelled bookings recorded.
                            </td>
                          </tr>
                        ) : (
                          cancelledItems.map((item) => {
                            const ticketCode = formatShortTicketNumber(item.queueNumber);
                            const customer = parseCustomerInfo(item.notes, item.userId);
                            return (
                              <tr key={item._id} className="hover:bg-[#faf2ee]/60 transition-colors">
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#000000] text-white font-mono text-xs font-bold tracking-wider shadow-xs">
                                    {ticketCode}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex flex-col max-w-[170px]">
                                    <span className="font-medium text-[#1e1b19] truncate" title={customer.name}>
                                      {customer.name}
                                    </span>
                                    {customer.subtitle && (
                                      <span className="font-mono text-xs text-[#645d58] truncate" title={customer.subtitle}>
                                        {customer.subtitle}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#f4ece8] text-[#1e1b19] text-xs font-medium capitalize">
                                    {item.queueType}
                                  </span>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap font-mono text-xs text-[#645d58]">
                                  {formatTimestampTime(item.createdAt)}
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap font-mono text-xs text-rose-800 font-medium">
                                  {formatTimestampTime(item.cancellationTime || item.updatedAt)}
                                </td>
                                <td className="py-3 px-3">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-900 font-medium text-xs border border-rose-200">
                                    {item.reason || "Change of plans"}
                                  </span>
                                </td>
                                <td className="py-3 px-3 whitespace-nowrap text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAuditModal(item)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center bg-[#f4ece8] hover:bg-[#e9e1dd] text-[#1e1b19] ml-auto"
                                    title="Audit Log"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">info</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* SLIDE-OVER DRAWER 1: ADD TO WAITLIST */}
        {isAddWaitlistOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div
              className="absolute inset-0 bg-stone-900/50 transition-opacity"
              onClick={() => setIsAddWaitlistOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
                {/* Header */}
                <div className="p-6 bg-[#eee7e3] flex items-center justify-between border-b border-[#e9e1dd]">
                  <div>
                    <span className="text-xs text-[#645d58] uppercase font-mono tracking-wider">
                      NEW WALK-IN ENTRY
                    </span>
                    <h2 className="text-2xl font-serif text-[#1e1b19]">Add to waitlist</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddWaitlistOpen(false)}
                    className="w-9 h-9 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#645d58] hover:text-[#1e1b19]"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmitWaitlistForm} className="p-6 overflow-y-auto flex-1 space-y-5">
                  {/* Phone */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1e1b19] block">
                      Mobile Number <span className="text-rose-600">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-[#f4ece8] px-3 py-1.5 rounded-full font-mono text-xs font-semibold shrink-0">
                        <span>🇮🇳</span>
                        <span>+91</span>
                      </div>
                      <input
                        type="tel"
                        required
                        value={waitlistPhone}
                        onChange={(e) => setWaitlistPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        inputMode="numeric"
                        placeholder="Enter phone number"
                        className="flex-1 bg-[#eee7e3] px-4 py-1.5 rounded-full text-sm font-mono focus:outline-none focus:bg-white border border-[#e9e1dd]"
                      />
                    </div>
                  </div>

                  {/* Names */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1e1b19] block">
                        First Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={waitlistFirstName}
                        onChange={(e) => setWaitlistFirstName(e.target.value)}
                        className="w-full bg-[#eee7e3] px-4 py-1.5 rounded-full text-sm focus:outline-none focus:bg-white border border-[#e9e1dd]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1e1b19] block">Last Name</label>
                      <input
                        type="text"
                        value={waitlistLastName}
                        onChange={(e) => setWaitlistLastName(e.target.value)}
                        className="w-full bg-[#eee7e3] px-4 py-1.5 rounded-full text-sm focus:outline-none focus:bg-white border border-[#e9e1dd]"
                      />
                    </div>
                  </div>

                  {/* Party Size Selector */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#1e1b19]">
                        Total Guests <span className="text-rose-600">*</span>
                      </label>
                      <span className="font-mono text-xs font-bold text-[#1e1b19]">
                        {waitlistGuests} Guests
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 4, 5, 6, 7, 8, "8+"].map((num) => {
                        const val = typeof num === "number" ? num : 8;
                        const isSelected = waitlistGuests === val;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setWaitlistGuests(val)}
                            className={`w-9 h-9 rounded-full text-xs font-mono font-medium transition-colors ${
                              isSelected
                                ? "bg-[#000000] text-white shadow-xs"
                                : "bg-[#f4ece8] text-[#1e1b19] hover:bg-[#e9e1dd]"
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Special Seating Requests */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1e1b19] block">
                      Special Seating Requests
                    </label>
                    <div className="space-y-2.5 bg-[#f5efe8] p-4 rounded-2xl text-xs">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={waitlistKidsSeat}
                          onChange={(e) => setWaitlistKidsSeat(e.target.checked)}
                          className="w-4 h-4 rounded accent-black"
                        />
                        <span className="flex items-center gap-1.5 font-medium text-[#1e1b19]">
                          <span className="material-symbols-outlined text-[16px]">child_friendly</span>
                          Kids Seat (Highchair)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={waitlistDisabledSeat}
                          onChange={(e) => setWaitlistDisabledSeat(e.target.checked)}
                          className="w-4 h-4 rounded accent-black"
                        />
                        <span className="flex items-center gap-1.5 font-medium text-[#1e1b19]">
                          <span className="material-symbols-outlined text-[16px]">accessible</span>
                          Disabled / Accessible Seat
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={waitlistBarbequeSeat}
                          onChange={(e) => setWaitlistBarbequeSeat(e.target.checked)}
                          className="w-4 h-4 rounded accent-black"
                        />
                        <span className="flex items-center gap-1.5 font-medium text-[#1e1b19]">
                          <span className="material-symbols-outlined text-[16px]">outdoor_grill</span>
                          Barbeque Grill Table
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Layout Preference */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1e1b19] block">
                      Layout Preference
                    </label>
                    <div className="relative">
                      <select
                        value={waitlistLayoutId}
                        onChange={(e) => setWaitlistLayoutId(e.target.value as any)}
                        className="w-full appearance-none bg-[#f4ece8] pl-4 pr-10 py-2 rounded-full text-sm font-medium text-[#1e1b19] focus:outline-none focus:bg-white border border-[#e9e1dd] cursor-pointer shadow-xs"
                      >
                        <option value="">Indoor-DineIn</option>
                        {layoutList?.map((l) => (
                          <option key={l._id} value={l._id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#645d58] pointer-events-none">
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Estimated Wait Time (mins) */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1e1b19] block">
                      Estimated Wait Time (mins)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWaitlistEstTime((prev) => Math.max(5, prev - 5))}
                        className="w-10 h-10 rounded-full bg-[#f4ece8] text-xs font-mono font-bold text-[#1e1b19] hover:bg-[#e9e1dd] transition-colors flex items-center justify-center shrink-0"
                      >
                        -5
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={waitlistEstTime}
                        onChange={(e) => setWaitlistEstTime(parseInt(e.target.value, 10) || 0)}
                        className="flex-1 bg-[#f4ece8] py-2 rounded-full text-center font-mono text-base font-bold text-[#1e1b19] focus:outline-none focus:bg-white border border-[#e9e1dd]"
                      />
                      <button
                        type="button"
                        onClick={() => setWaitlistEstTime((prev) => prev + 5)}
                        className="w-10 h-10 rounded-full bg-[#f4ece8] text-xs font-mono font-bold text-[#1e1b19] hover:bg-[#e9e1dd] transition-colors flex items-center justify-center shrink-0"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1e1b19] block">
                      Notes & Dietary Requirements
                    </label>
                    <textarea
                      rows={2}
                      value={waitlistNotes}
                      onChange={(e) => setWaitlistNotes(e.target.value)}
                      placeholder="Anniversary table, window preferred, nut allergy..."
                      className="w-full bg-[#f4ece8] p-3 rounded-2xl text-xs text-[#1e1b19] focus:outline-none focus:bg-white border border-[#e9e1dd]"
                    />
                  </div>

                  {/* Drawer Footer Actions */}
                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#eee7e3]">
                    <button
                      type="button"
                      onClick={() => setIsAddWaitlistOpen(false)}
                      className="px-6 py-2 rounded-full bg-[#e9e1dd] text-[#1e1b19] text-sm font-medium hover:bg-[#eee7e3]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-full bg-[#000000] text-white text-sm font-medium shadow-md hover:bg-neutral-800"
                    >
                      Add to waitlist
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE-OVER DRAWER 2: ADD RESERVATION */}
        {isAddReservationOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div
              className="absolute inset-0 bg-stone-900/50 transition-opacity"
              onClick={() => setIsAddReservationOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
                <div className="p-6 bg-[#eee7e3] flex items-center justify-between border-b border-[#e9e1dd]">
                  <div>
                    <span className="text-xs text-[#645d58] uppercase font-mono tracking-wider">
                      CALENDAR BOOKING
                    </span>
                    <h2 className="text-2xl font-serif text-[#1e1b19]">Add a reservation</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddReservationOpen(false)}
                    className="w-9 h-9 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#645d58] hover:text-[#1e1b19]"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <form onSubmit={handleSubmitReservationForm} className="p-6 overflow-y-auto flex-1 space-y-5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1e1b19] block">
                      Mobile Number <span className="text-rose-600">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-[#f4ece8] px-3 py-1.5 rounded-full font-mono text-xs font-semibold shrink-0">
                        <span>🇮🇳</span>
                        <span>+91</span>
                      </div>
                      <input
                        type="tel"
                        required
                        value={resPhone}
                        onChange={(e) => setResPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        inputMode="numeric"
                        placeholder="Enter phone number"
                        className="flex-1 bg-[#eee7e3] px-4 py-1.5 rounded-full text-sm font-mono focus:outline-none focus:bg-white border border-[#e9e1dd]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1e1b19] block">
                        First Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={resFirstName}
                        onChange={(e) => setResFirstName(e.target.value)}
                        className="w-full bg-[#eee7e3] px-4 py-1.5 rounded-full text-sm focus:outline-none focus:bg-white border border-[#e9e1dd]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1e1b19] block">Last Name</label>
                      <input
                        type="text"
                        value={resLastName}
                        onChange={(e) => setResLastName(e.target.value)}
                        className="w-full bg-[#eee7e3] px-4 py-1.5 rounded-full text-sm focus:outline-none focus:bg-white border border-[#e9e1dd]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1e1b19] block">Reservation Date</label>
                      <input
                        type="date"
                        required
                        value={resDate}
                        onChange={(e) => setResDate(e.target.value)}
                        className="w-full bg-[#eee7e3] px-4 py-1.5 rounded-full text-sm font-mono focus:outline-none focus:bg-white border border-[#e9e1dd]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1e1b19] block">Time</label>
                      <input
                        type="time"
                        required
                        value={resTimeStr}
                        onChange={(e) => setResTimeStr(e.target.value)}
                        className="w-full bg-[#eee7e3] px-4 py-1.5 rounded-full text-sm font-mono font-bold focus:outline-none focus:bg-white border border-[#e9e1dd]"
                      />
                    </div>
                  </div>

                  {/* Party Size Selector */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#1e1b19]">
                        Total Guests <span className="text-rose-600">*</span>
                      </label>
                      <span className="font-mono text-xs font-bold text-[#1e1b19]">
                        {resGuests} Guests
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 2, 3, 4, 5, 6, 7, 8, "8+"].map((num) => {
                        const val = typeof num === "number" ? num : 8;
                        const isSelected = resGuests === val;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setResGuests(val)}
                            className={`w-9 h-9 rounded-full text-xs font-mono font-medium transition-colors ${
                              isSelected
                                ? "bg-[#000000] text-white shadow-xs"
                                : "bg-[#f4ece8] text-[#1e1b19] hover:bg-[#e9e1dd]"
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Special Requests */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1e1b19] block">Special Requests</label>
                    <div className="space-y-2 bg-[#eee7e3] p-4 rounded-2xl text-xs">
                      <label className="flex items-center gap-2 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resKidsSeat}
                          onChange={(e) => setResKidsSeat(e.target.checked)}
                          className="w-4 h-4 rounded accent-black"
                        />
                        <span>Kids Seat / Highchair</span>
                      </label>
                      <label className="flex items-center gap-2 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resDisabledSeat}
                          onChange={(e) => setResDisabledSeat(e.target.checked)}
                          className="w-4 h-4 rounded accent-black"
                        />
                        <span>Disabled / Accessible</span>
                      </label>
                      <label className="flex items-center gap-2 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resBarbequeSeat}
                          onChange={(e) => setResBarbequeSeat(e.target.checked)}
                          className="w-4 h-4 rounded accent-black"
                        />
                        <span>Barbeque / Live Grill Table</span>
                      </label>
                    </div>
                  </div>

                  {/* Layout Preference */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1e1b19] block">
                      Layout Preference
                    </label>
                    <div className="relative">
                      <select
                        value={resLayoutId}
                        onChange={(e) => setResLayoutId(e.target.value as any)}
                        className="w-full appearance-none bg-[#f4ece8] pl-4 pr-10 py-2 rounded-full text-sm font-medium text-[#1e1b19] focus:outline-none focus:bg-white border border-[#e9e1dd] cursor-pointer shadow-xs"
                      >
                        <option value="">Indoor-DineIn</option>
                        {layoutList?.map((l) => (
                          <option key={l._id} value={l._id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#645d58] pointer-events-none">
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Notes & Special Requests */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#1e1b19] block">
                      Notes & Dietary Requirements
                    </label>
                    <textarea
                      rows={2}
                      value={resNotes}
                      onChange={(e) => setResNotes(e.target.value)}
                      placeholder="Anniversary table, window preferred, nut allergy..."
                      className="w-full bg-[#f4ece8] p-3 rounded-2xl text-xs text-[#1e1b19] focus:outline-none focus:bg-white border border-[#e9e1dd]"
                    />
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#eee7e3]">
                    <button
                      type="button"
                      onClick={() => setIsAddReservationOpen(false)}
                      className="px-5 py-2 rounded-full bg-[#e9e1dd] text-[#1e1b19] text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-full bg-[#000000] text-white text-sm font-medium shadow-md hover:bg-neutral-800"
                    >
                      Add reservation
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE-OVER DRAWER 3: STATUS & DISPATCH */}
        {isChangeStatusOpen && activeQueueItem && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div
              className="absolute inset-0 bg-stone-900/50 transition-opacity"
              onClick={() => setIsChangeStatusOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col justify-between">
                {/* Header Card */}
                <div className="p-6 bg-[#eee7e3] shadow-xs space-y-3 border-b border-[#e9e1dd]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#645d58] uppercase font-mono tracking-wider">
                      SEATING & STATUS DISPATCH
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsChangeStatusOpen(false)}
                      className="w-8 h-8 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#645d58] hover:text-[#1e1b19]"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-white shadow-xs flex items-center justify-between border border-[#e9e1dd]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#000000] text-white font-mono text-xs font-bold">
                          {formatShortTicketNumber(activeQueueItem.queueNumber)}
                        </span>
                        <h3 className="text-lg font-serif text-[#1e1b19] font-semibold">
                          {parseCustomerInfo(activeQueueItem.notes, activeQueueItem.userId).name}
                        </h3>
                      </div>
                      <span className="text-xs text-[#645d58] flex items-center gap-1.5 mt-1">
                        <span className="material-symbols-outlined text-[14px]">table_restaurant</span>
                        Layout: {layoutList?.find((l) => l._id === activeQueueItem.layoutId)?.name || activeQueueItem.layout?.name || "Indoor-DineIn"} ({activeQueueItem.totalGuests || 2} Guests)
                      </span>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-mono font-bold">
                      Ready
                    </span>
                  </div>

                  {/* Sub Tabs */}
                  <div className="flex items-center gap-1 bg-[#f4ece8] p-1 rounded-full border border-[#e9e1dd]">
                    <button
                      type="button"
                      onClick={() => setStatusSubTab("assign")}
                      className={`flex-1 py-1.5 rounded-full text-center text-xs font-semibold transition-all ${
                        statusSubTab === "assign"
                          ? "bg-white text-[#1e1b19] shadow-xs"
                          : "text-[#645d58] hover:text-[#1e1b19]"
                      }`}
                    >
                      Assign Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusSubTab("late")}
                      className={`flex-1 py-1.5 rounded-full text-center text-xs font-semibold transition-all ${
                        statusSubTab === "late"
                          ? "bg-white text-[#1e1b19] shadow-xs"
                          : "text-[#645d58] hover:text-[#1e1b19]"
                      }`}
                    >
                      Running Late
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusSubTab("cancel")}
                      className={`flex-1 py-1.5 rounded-full text-center text-xs font-semibold transition-all ${
                        statusSubTab === "cancel"
                          ? "bg-white text-[#1e1b19] shadow-xs"
                          : "text-[#645d58] hover:text-[#1e1b19]"
                      }`}
                    >
                      Cancel Booking
                    </button>
                  </div>
                </div>

                {/* Sub Tab Content 1: Assign Table */}
                {statusSubTab === "assign" && (
                  <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {/* Target Layout Selection Dropdown */}
                    <div className="flex items-center justify-between pb-1">
                      <h3 className="text-sm font-semibold text-[#1e1b19]">Select Target Layout</h3>
                      <div className="relative">
                        <select
                          value={dispatchLayoutId}
                          onChange={(e) => setDispatchLayoutId(e.target.value)}
                          className="appearance-none bg-[#f4ece8] pl-4 pr-9 py-1.5 rounded-full text-xs font-semibold text-[#1e1b19] border border-[#e9e1dd] focus:outline-none focus:bg-white cursor-pointer shadow-xs"
                        >
                          <option value="all">All Layouts</option>
                          <option value="Indoor-DineIn">Indoor-DineIn</option>
                          <option value="Terrace Lounge">Terrace Lounge</option>
                          {layoutList?.map((l) => (
                            <option key={l._id} value={l._id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#645d58] pointer-events-none">
                          expand_more
                        </span>
                      </div>
                    </div>

                    <span className="text-xs text-[#645d58] uppercase font-mono tracking-wider block">
                      AVAILABLE SEATING OPTIONS
                    </span>
                    <div className="space-y-3">
                      {tableList
                        ?.filter((t) => !t.currentOrderId && !t.isBlock)
                        ?.filter((t) => {
                          if (dispatchLayoutId === "all" || !dispatchLayoutId) return true;
                          if (t.layoutId === dispatchLayoutId) return true;
                          const layoutName = layoutList?.find((l) => l._id === t.layoutId)?.name;
                          if (layoutName === dispatchLayoutId) return true;
                          return false;
                        })
                        .map((table) => {
                          const isSelected = selectedAssignTableId === table._id;
                          return (
                            <div
                              key={table._id}
                              onClick={() => setSelectedAssignTableId(table._id)}
                              className={`p-4 rounded-2xl bg-[#eee7e3] shadow-xs cursor-pointer transition-all flex items-center justify-between ${
                                isSelected ? "border-2 border-[#000000]" : "hover:bg-[#f4ece8]"
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white flex flex-col items-center justify-center font-mono font-bold text-[#1e1b19] shadow-xs">
                                  <span className="text-[9px] text-[#645d58] font-normal">TBL</span>
                                  <span>{table.tableNumber}</span>
                                </div>
                                <div>
                                  <h4 className="text-base font-serif text-[#1e1b19]">
                                    Table {table.tableNumber}
                                  </h4>
                                  <div className="flex items-center gap-2 text-xs text-[#645d58] mt-0.5">
                                    <span>Cap: {table.seatingCapacity}</span>
                                    <span>•</span>
                                    <span className="text-emerald-700 font-medium">Available</span>
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold ${
                                  isSelected
                                    ? "bg-[#000000] text-white"
                                    : "bg-[#e9e1dd] text-[#1e1b19]"
                                }`}
                              >
                                {isSelected ? "Selected" : "Select"}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Sub Tab Content 2: Running Late */}
                {statusSubTab === "late" && (
                  <div className="p-6 overflow-y-auto flex-1 space-y-5">
                    <div className="p-4 rounded-2xl bg-[#fdf8f3] text-[#7c3a00] border border-[#f3e3d3] space-y-1">
                      <span className="font-semibold text-sm flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px]">schedule</span> Extend
                        Waitlist Grace Period
                      </span>
                      <p className="text-xs text-[#8c4810]">
                        Pushes the estimated seating time back and alerts floor captains to hold turn.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[#1e1b19] block">
                        Quick Delay Preset
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[10, 20, 30].map((mins) => {
                          const isSelected = !customLateMins && latePresetMins === mins;
                          return (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => {
                                setLatePresetMins(mins);
                                setCustomLateMins("");
                              }}
                              className={`py-2.5 rounded-full font-mono text-xs font-semibold transition-all ${
                                isSelected
                                  ? "bg-[#000000] text-white shadow-xs"
                                  : "bg-[#f4ece8] text-[#1e1b19] hover:bg-[#e9e1dd]"
                              }`}
                            >
                              {mins} mins
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1e1b19] block">
                        Custom Delay (mins)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={customLateMins}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setCustomLateMins(val);
                        }}
                        placeholder="More than 30 minutes (e.g. 45)"
                        className="w-full bg-[#f4ece8] px-4 py-2.5 rounded-full text-xs font-mono text-[#1e1b19] placeholder:text-[#99908a] focus:outline-none focus:bg-white border border-[#e9e1dd] shadow-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Sub Tab Content 3: Cancel Booking */}
                {statusSubTab === "cancel" && (
                  <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div className="p-4 rounded-2xl bg-rose-50 text-rose-900 border border-rose-200 space-y-1">
                      <span className="font-semibold text-sm flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px]">warning</span> Cancel
                        Reservation / Queue Ticket
                      </span>
                      <p className="text-xs">This will release the ticket and log the reason in the audit log.</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1e1b19] block">
                        Cancellation Reason
                      </label>
                      <div className="relative">
                        <select
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full appearance-none bg-[#f4ece8] pl-4 pr-10 py-2 rounded-full text-xs font-semibold text-[#1e1b19] border border-[#e9e1dd] focus:outline-none focus:bg-white cursor-pointer shadow-xs"
                        >
                          <option>Change of plans</option>
                          <option>Customer no-show</option>
                          <option>Wait time too long</option>
                          <option>Other</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#645d58] pointer-events-none">
                          expand_more
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1e1b19] block">Internal Notes</label>
                      <textarea
                        rows={3}
                        value={cancelNotes}
                        onChange={(e) => setCancelNotes(e.target.value)}
                        placeholder="Guest called, flight delayed..."
                        className="w-full bg-[#eee7e3] p-3 rounded-2xl text-xs text-[#1e1b19] focus:outline-none border border-[#e9e1dd]"
                      />
                    </div>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="p-6 bg-[#eee7e3] flex items-center justify-end border-t border-[#e9e1dd]">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsChangeStatusOpen(false)}
                      className="px-5 py-2 rounded-full bg-[#e9e1dd] text-[#1e1b19] text-xs font-semibold hover:bg-[#e4dad4]"
                    >
                      Cancel
                    </button>
                    {statusSubTab === "late" ? (
                      <button
                        type="button"
                        onClick={handleExecuteStatusAction}
                        className="px-6 py-2 rounded-full bg-[#8c3d00] text-white text-sm font-semibold shadow-md hover:bg-[#723200] flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">schedule</span>
                        <span>Confirm Delay</span>
                      </button>
                    ) : statusSubTab === "cancel" ? (
                      <button
                        type="button"
                        onClick={handleExecuteStatusAction}
                        className="px-6 py-2 rounded-full bg-rose-700 text-white text-sm font-semibold shadow-md hover:bg-rose-800 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">cancel</span>
                        <span>Confirm Cancellation</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleExecuteStatusAction}
                        className="px-6 py-2 rounded-full bg-[#000000] text-white text-sm font-semibold shadow-md hover:bg-neutral-800 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">restaurant</span>
                        <span>
                          {selectedAssignTable ? `Serve at Table ${selectedAssignTable.tableNumber}` : "Confirm Action"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: NOTIFY SMS */}
        {isNotifyModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 text-center">
              <div
                className="fixed inset-0 bg-stone-900/50 transition-opacity"
                onClick={() => setIsNotifyModalOpen(false)}
              />
              <div className="relative z-10 inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all my-8 align-middle max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f4ece8] flex items-center justify-center text-[#000000]">
                      <span className="material-symbols-outlined text-[20px]">sms</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-serif font-semibold text-[#1e1b19]">Notify Customer</h3>
                      <span className="text-xs text-[#645d58] font-mono">
                        {contactName} ({contactPhone})
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotifyModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-[#eee7e3] flex items-center justify-center text-[#645d58]"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#1e1b19] block">Message Content</label>
                  <textarea
                    rows={4}
                    value={customNotifyMessage}
                    onChange={(e) => setCustomNotifyMessage(e.target.value)}
                    className="w-full bg-[#eee7e3] p-3 rounded-2xl text-sm text-[#1e1b19] focus:outline-none border border-[#e9e1dd]"
                  />
                  <span className="text-xs text-[#645d58] text-right block">
                    Character Count: {customNotifyMessage.length} / 160
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNotifyModalOpen(false)}
                    className="px-5 py-2 rounded-full bg-[#e9e1dd] text-[#1e1b19] text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotifyModalOpen(false);
                      showToast(`SMS dispatched to ${contactName}!`);
                    }}
                    className="px-6 py-2 rounded-full bg-[#000000] text-white text-sm font-medium shadow-md hover:bg-neutral-800 flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>Send SMS Message</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CALL CUSTOMER */}
        {isCallModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 text-center">
              <div
                className="fixed inset-0 bg-stone-900/50 transition-opacity"
                onClick={() => setIsCallModalOpen(false)}
              />
              <div className="relative z-10 inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all my-8 align-middle max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">phone_in_talk</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-serif font-semibold text-[#1e1b19]">Initiate Guest Call</h3>
                      <span className="text-xs text-[#645d58]">{contactName}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCallModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-[#eee7e3] flex items-center justify-center text-[#645d58]"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <div className="p-4 bg-[#eee7e3] rounded-2xl flex items-center justify-between border border-[#e9e1dd]">
                  <div>
                    <span className="text-[10px] text-[#645d58] uppercase font-mono">DIAL NUMBER</span>
                    <div className="font-mono text-base font-bold text-[#1e1b19]">{contactPhone}</div>
                  </div>
                  <span className="material-symbols-outlined text-emerald-700">verified</span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCallModalOpen(false)}
                    className="px-5 py-2 rounded-full bg-[#e9e1dd] text-[#1e1b19] text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCallModalOpen(false);
                      showToast(`Calling ${contactName} at ${contactPhone}...`);
                    }}
                    className="px-6 py-2 rounded-full bg-emerald-800 text-white text-sm font-medium shadow-md hover:bg-emerald-900 flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">call</span>
                    <span>Make Call</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: QUEUE AUDIT TIMELINE LOG */}
        {isAuditModalOpen && activeQueueItem && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 text-center">
              <div
                className="fixed inset-0 bg-stone-900/50 transition-opacity"
                onClick={() => setIsAuditModalOpen(false)}
              />
              <div className="relative z-10 inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all my-8 align-middle max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#e9e1dd] pb-3">
                  <div>
                    <h3 className="text-lg font-serif font-semibold text-[#1e1b19]">Queue Audit History</h3>
                    <span className="text-xs text-[#645d58] font-mono">
                      Ticket {activeQueueItem.queueNumber || "QN001"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAuditModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-[#eee7e3] flex items-center justify-center text-[#645d58]"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {auditQueueData?.activities && auditQueueData.activities.length > 0 ? (
                    auditQueueData.activities.map((act: any) => (
                      <div key={act._id} className="p-3 bg-[#eee7e3] rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between font-semibold text-[#1e1b19]">
                          <span className="capitalize">{act.activityType.replace(/_/g, " ")}</span>
                          <span className="font-mono text-[11px] text-[#645d58]">
                            {formatTimestampTime(act.createdAt)}
                          </span>
                        </div>
                        {act.reason && <p className="text-[#645d58] font-mono">{act.reason}</p>}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-[#eee7e3] rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-[#1e1b19]">
                        <span>Ticket Created</span>
                        <span className="font-mono text-[11px] text-[#645d58]">
                          {formatTimestampTime(activeQueueItem.createdAt)}
                        </span>
                      </div>
                      <p className="text-[#645d58]">Status: {activeQueueItem.queueStatus}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAuditModalOpen(false)}
                    className="px-5 py-1.5 rounded-full bg-[#000000] text-white text-xs font-medium"
                  >
                    Close Log
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TOAST NOTIFICATION CONTAINER */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
            <div className="bg-[#000000] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 text-sm font-medium animate-bounce">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">
                check_circle
              </span>
              <span>{toastMessage}</span>
            </div>
          </div>
        )}
      </div>
    </PosShell>
  );
}
