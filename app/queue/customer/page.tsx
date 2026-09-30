"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

// Helper Haversine formula for distance calculation in meters
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CustomerQueuePage() {
  const [activeTab, setActiveTab] = useState<"join" | "status" | "reserve">("join");

  // Form Inputs
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [partySize, setPartySize] = useState<number>(2);
  const [kidsSeat, setKidsSeat] = useState(false);
  const [disabledSeat, setDisabledSeat] = useState(false);
  const [barbequeSeat, setBarbequeSeat] = useState(false);
  const [notes, setNotes] = useState("");
  const [resDate, setResDate] = useState(getTodayDateString());
  const [resTime, setResTime] = useState("19:00");

  // Ticket & Geo-fence States
  const [createdTicketId, setCreatedTicketId] = useState<Id<"organizationQueues"> | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);
  const [geoDistance, setGeoDistance] = useState<number | null>(null);
  const [isOutsideGeoFence, setIsOutsideGeoFence] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Queries & Mutations
  const queueConfig = useQuery(api.organizationQueueConfigurations.get, {});
  const todayQueues = useQuery(api.organizationQueues.list, {
    reservationDate: getTodayDateString(),
  });
  const currentTicket = useQuery(
    api.organizationQueues.get,
    createdTicketId ? { id: createdTicketId } : "skip"
  );

  const createQueue = useMutation(api.organizationQueues.create);
  const updateQueue = useMutation(api.organizationQueues.update);

  // Check customer's current GPS location if geo-fencing is required by store
  useEffect(() => {
    if (queueConfig?.geoFence && typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setUserLat(lat);
          setUserLon(lon);

          if (queueConfig.geoFenceLatitude && queueConfig.geoFenceLongitude) {
            const dist = calculateHaversineDistance(
              lat,
              lon,
              queueConfig.geoFenceLatitude,
              queueConfig.geoFenceLongitude
            );
            setGeoDistance(dist);
            const radiusMeters = parseInt(queueConfig.geoFenceRadius || "500", 10);
            if (dist > radiusMeters) {
              setIsOutsideGeoFence(true);
            } else {
              setIsOutsideGeoFence(false);
            }
          }
        },
        (_err) => {
          setIsOutsideGeoFence(false);
        }
      );
    }
  }, [queueConfig]);

  // Compute live queue position (# parties ahead)
  const partiesAheadCount = useMemo(() => {
    if (!todayQueues || !createdTicketId || !currentTicket) return 0;
    const activeWaitlist = todayQueues.filter(
      (q) =>
        q.queueType === "waitlist" &&
        q.queueStatus !== "completed" &&
        q.queueStatus !== "cancelled_by_user" &&
        q.queueStatus !== "cancelled_by_admin"
    );
    const myIndex = activeWaitlist.findIndex((q) => q._id === createdTicketId);
    return myIndex > 0 ? myIndex : 0;
  }, [todayQueues, createdTicketId, currentTicket]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }

  // Handle Join Waitlist Submission
  async function handleJoinWaitlist(e: React.FormEvent) {
    e.preventDefault();

    if (isOutsideGeoFence) {
      showToast(
        `You must be within ${queueConfig?.geoFenceRadius || "500"}m of the store to join the waitlist.`
      );
      return;
    }

    try {
      const newQueue = await createQueue({
        queueType: "waitlist",
        totalGuests: partySize,
        kidsSeat,
        disabledSeat,
        barbequeSeat,
        reservationDate: getTodayDateString(),
        notes: `${customerName} (${customerPhone}) ${notes ? "- " + notes : ""}`.trim(),
      });

      setCreatedTicketId(newQueue._id);
      setActiveTab("status");
      showToast("You have successfully joined the live waitlist!");
    } catch (err: any) {
      showToast(`Failed to join queue: ${err.message}`);
    }
  }

  // Handle Advance Reservation Request Submission
  async function handleReserveTable(e: React.FormEvent) {
    e.preventDefault();

    try {
      let ts = Date.now();
      if (resTime) {
        const [h, m] = resTime.split(":").map(Number);
        const d = new Date(resDate);
        d.setHours(h || 19, m || 0, 0, 0);
        ts = d.getTime();
      }

      const newQueue = await createQueue({
        queueType: "reservation",
        totalGuests: partySize,
        kidsSeat,
        disabledSeat,
        barbequeSeat,
        reservationDate: resDate,
        reservationTime: ts,
        notes: `${customerName} (${customerPhone}) ${notes ? "- " + notes : ""}`.trim(),
      });

      setCreatedTicketId(newQueue._id);
      setActiveTab("status");
      showToast("Your reservation request has been submitted!");
    } catch (err: any) {
      showToast(`Failed to create reservation: ${err.message}`);
    }
  }

  // Handle Cancel Spot
  async function handleCancelSpot() {
    if (!createdTicketId) return;
    try {
      await updateQueue({
        id: createdTicketId,
        queueStatus: "cancelled_by_user",
        reason: "Customer cancelled via storefront mobile QR view",
      });
      showToast("Your spot in the queue has been cancelled.");
    } catch (err: any) {
      showToast(`Error cancelling spot: ${err.message}`);
    }
  }

  const currentStatusStr = (currentTicket?.queueStatus || "") as string;

  return (
    <div className="min-h-screen bg-[#faf2ee] text-[#1e1b19] font-sans flex flex-col items-center justify-start p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-[#e9e1dd] my-auto">
        {/* Header Branding */}
        <div className="bg-[#000000] text-white p-6 text-center space-y-1">
          <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-[11px] font-mono uppercase tracking-widest text-[#cbc5c3]">
            Live Customer Portal
          </div>
          <h1 className="text-2xl font-serif tracking-tight">Skyz Restaurant & Banquet</h1>
          <p className="text-xs text-[#cbc5c3]">Digital Queue & Reservation Desk</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#e9e1dd] bg-[#f4ece8]">
          <button
            type="button"
            onClick={() => setActiveTab("join")}
            className={`flex-1 py-3 text-xs font-semibold text-center transition-all ${
              activeTab === "join"
                ? "bg-white text-[#1e1b19] border-b-2 border-[#000000]"
                : "text-[#645d58] hover:text-[#1e1b19]"
            }`}
          >
            Join Waitlist
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("status")}
            className={`flex-1 py-3 text-xs font-semibold text-center transition-all ${
              activeTab === "status"
                ? "bg-white text-[#1e1b19] border-b-2 border-[#000000]"
                : "text-[#645d58] hover:text-[#1e1b19]"
            }`}
          >
            My Ticket {createdTicketId && "• Live"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reserve")}
            className={`flex-1 py-3 text-xs font-semibold text-center transition-all ${
              activeTab === "reserve"
                ? "bg-white text-[#1e1b19] border-b-2 border-[#000000]"
                : "text-[#645d58] hover:text-[#1e1b19]"
            }`}
          >
            Reserve Table
          </button>
        </div>

        {/* Geo-fence Distance Alert */}
        {isOutsideGeoFence && (
          <div className="p-4 bg-amber-50 text-amber-900 text-xs font-medium flex items-start gap-2 border-b border-amber-200">
            <span className="material-symbols-outlined text-[18px] text-amber-800 shrink-0">
              location_off
            </span>
            <div>
              <strong>Outside Geo-Fence Area:</strong> You are currently {geoDistance}m away. You must be within {queueConfig?.geoFenceRadius || "500"}m of the store to join the live waitlist.
            </div>
          </div>
        )}

        {/* TAB 1: JOIN WAITLIST FORM */}
        {activeTab === "join" && (
          <form onSubmit={handleJoinWaitlist} className="p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#1e1b19] block">
                Your Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Neel Raval"
                className="w-full bg-[#f4ece8] px-4 py-2 rounded-full text-sm focus:outline-none focus:bg-white border border-[#e9e1dd]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#1e1b19] block">
                Mobile Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 9825000000"
                className="w-full bg-[#f4ece8] px-4 py-2 rounded-full text-sm font-mono focus:outline-none focus:bg-white border border-[#e9e1dd]"
              />
            </div>

            {/* Party Size Stepper */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#1e1b19] block">
                Party Size (Total Guests)
              </label>
              <div className="flex items-center justify-between bg-[#f4ece8] p-2 rounded-full border border-[#e9e1dd]">
                <button
                  type="button"
                  onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                  className="w-8 h-8 rounded-full bg-white text-[#1e1b19] font-bold text-lg flex items-center justify-center shadow-xs"
                >
                  -
                </button>
                <span className="font-mono text-base font-bold text-[#1e1b19]">
                  {partySize} {partySize === 1 ? "Guest" : "Guests"}
                </span>
                <button
                  type="button"
                  onClick={() => setPartySize((p) => p + 1)}
                  className="w-8 h-8 rounded-full bg-white text-[#1e1b19] font-bold text-lg flex items-center justify-center shadow-xs"
                >
                  +
                </button>
              </div>
            </div>

            {/* Special Requests */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#1e1b19] block">
                Special Seating Options
              </label>
              <div className="space-y-2 bg-[#f4ece8] p-3 rounded-2xl text-xs border border-[#e9e1dd]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={kidsSeat}
                    onChange={(e) => setKidsSeat(e.target.checked)}
                    className="w-4 h-4 rounded accent-black"
                  />
                  <span>High Chair / Kids Seat Needed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={disabledSeat}
                    onChange={(e) => setDisabledSeat(e.target.checked)}
                    className="w-4 h-4 rounded accent-black"
                  />
                  <span>Wheelchair / Accessible Seating Needed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={barbequeSeat}
                    onChange={(e) => setBarbequeSeat(e.target.checked)}
                    className="w-4 h-4 rounded accent-black"
                  />
                  <span>Barbeque / Live Cooking Table Needed</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#1e1b19] block">
                Notes & Special Requests
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Highchair needed, window seat preferred..."
                className="w-full bg-[#f4ece8] p-3 rounded-2xl text-xs text-[#1e1b19] focus:outline-none focus:bg-white border border-[#e9e1dd]"
              />
            </div>

            <button
              type="submit"
              disabled={isOutsideGeoFence}
              className="w-full py-3 rounded-full bg-[#000000] text-white text-sm font-semibold shadow-lg hover:bg-neutral-800 disabled:opacity-50 transition-all"
            >
              Get Live Queue Ticket
            </button>
          </form>
        )}

        {/* TAB 2: LIVE TICKET STATUS TRACKER */}
        {activeTab === "status" && (
          <div className="p-6 space-y-6 text-center">
            {!currentTicket ? (
              <div className="py-12 space-y-4">
                <span className="material-symbols-outlined text-5xl text-[#645d58]">confirmation_number</span>
                <p className="text-sm text-[#645d58]">
                  No active queue ticket selected. Join the waitlist or create a reservation above.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("join")}
                  className="px-6 py-2 rounded-full bg-[#000000] text-white text-xs font-semibold"
                >
                  Join Waitlist Now
                </button>
              </div>
            ) : (
              <>
                {/* Ticket Card Display */}
                <div className="bg-[#fff8f5] p-6 rounded-3xl shadow-sm border border-[#e9e1dd] space-y-3 relative overflow-hidden">
                  <div className="text-xs font-mono text-[#645d58] uppercase tracking-wider">
                    {currentTicket.queueType === "waitlist" ? "Live Walk-in Ticket" : "Advance Reservation"}
                  </div>
                  <div className="text-5xl font-mono font-bold text-[#1e1b19] tracking-tight">
                    {currentTicket.queueNumber || "QN001"}
                  </div>

                  {currentStatusStr === "cancelled_by_user" || currentStatusStr === "cancelled_by_admin" ? (
                    <div className="inline-block px-4 py-1.5 rounded-full bg-rose-100 text-rose-900 text-xs font-bold uppercase tracking-wider">
                      Ticket Cancelled
                    </div>
                  ) : currentStatusStr === "completed" ? (
                    <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold uppercase tracking-wider">
                      Seated at Table! Enjoy Your Meal 🎉
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-[#e9e1dd]">
                        <div>
                          <span className="text-[11px] text-[#645d58] uppercase font-mono block">
                            Parties Ahead
                          </span>
                          <span className="text-2xl font-serif font-bold text-[#1e1b19]">
                            {partiesAheadCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-[#645d58] uppercase font-mono block">
                            Est. Wait Time
                          </span>
                          <span className="text-2xl font-serif font-bold text-[#1e1b19]">
                            ~{queueConfig?.defaultWaitTime || 15}m
                          </span>
                        </div>
                      </div>

                      {/* Progress Stepper */}
                      <div className="pt-2 flex items-center justify-between text-xs text-[#645d58]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-7 h-7 rounded-full bg-[#000000] text-white flex items-center justify-center font-bold text-xs">
                            1
                          </span>
                          <span className="font-semibold text-[#1e1b19]">Joined</span>
                        </div>
                        <div className="h-0.5 flex-1 bg-[#000000] mx-2" />
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                              currentStatusStr === "arrived" || currentStatusStr === "completed"
                                ? "bg-[#000000] text-white"
                                : "bg-[#eee7e3] text-[#645d58]"
                            }`}
                          >
                            2
                          </span>
                          <span>Called</span>
                        </div>
                        <div className="h-0.5 flex-1 bg-[#eee7e3] mx-2" />
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                              currentStatusStr === "completed"
                                ? "bg-emerald-600 text-white"
                                : "bg-[#eee7e3] text-[#645d58]"
                            }`}
                          >
                            3
                          </span>
                          <span>Seated</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {currentStatusStr !== "cancelled_by_user" &&
                  currentStatusStr !== "cancelled_by_admin" &&
                  currentStatusStr !== "completed" && (
                    <button
                      type="button"
                      onClick={handleCancelSpot}
                      className="px-6 py-2.5 rounded-full bg-rose-50 text-rose-900 border border-rose-200 text-xs font-semibold hover:bg-rose-100"
                    >
                      Cancel My Spot in Queue
                    </button>
                  )}
              </>
            )}
          </div>
        )}

        {/* TAB 3: ADVANCE TABLE RESERVATION FORM */}
        {activeTab === "reserve" && (
          <form onSubmit={handleReserveTable} className="p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#1e1b19] block">
                Your Full Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rahul R"
                className="w-full bg-[#f4ece8] px-4 py-2 rounded-full text-sm focus:outline-none focus:bg-white border border-[#e9e1dd]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#1e1b19] block">
                Mobile Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 9825000000"
                className="w-full bg-[#f4ece8] px-4 py-2 rounded-full text-sm font-mono focus:outline-none focus:bg-white border border-[#e9e1dd]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1e1b19] block">Date</label>
                <input
                  type="date"
                  required
                  value={resDate}
                  onChange={(e) => setResDate(e.target.value)}
                  className="w-full bg-[#f4ece8] px-4 py-1.5 rounded-full text-sm font-mono focus:outline-none focus:bg-white border border-[#e9e1dd]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1e1b19] block">Time Slot</label>
                <input
                  type="time"
                  required
                  value={resTime}
                  onChange={(e) => setResTime(e.target.value)}
                  className="w-full bg-[#f4ece8] px-4 py-1.5 rounded-full text-sm font-mono font-bold focus:outline-none focus:bg-white border border-[#e9e1dd]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#1e1b19] block">
                Party Size (Covers)
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={partySize}
                onChange={(e) => setPartySize(parseInt(e.target.value, 10) || 2)}
                className="w-full bg-[#f4ece8] px-4 py-2 rounded-full text-sm font-mono font-bold text-center border border-[#e9e1dd]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full bg-[#000000] text-white text-sm font-semibold shadow-lg hover:bg-neutral-800 transition-all"
            >
              Submit Table Reservation Request
            </button>
          </form>
        )}
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 z-50 pointer-events-none">
          <div className="bg-[#000000] text-white px-6 py-3 rounded-full shadow-2xl text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-emerald-400">
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
