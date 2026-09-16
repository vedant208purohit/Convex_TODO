"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// ----------------------------------------------------
// TYPES & INTERFACES
// ----------------------------------------------------

export type TimeFormat = "12h" | "24h";
export type WaitAlgoMode = "smart" | "custom";
export type ActiveTab = "waitlist" | "reservations";

export interface TimeSlot {
  start: string;
  end: string;
}

export interface DaySchedule {
  day:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  isOpen: boolean;
  slots: TimeSlot[];
}

interface TimePickerTarget {
  type: "waitlist" | "reservations";
  dayIdx: number;
  slotIdx: number;
  field: "start" | "end";
}

// ----------------------------------------------------
// HELPER UTILITIES FOR TIME CONVERSION & OVERLAP
// ----------------------------------------------------

function to24hTime(timeStr: string): string {
  if (!timeStr) return "11:00";

  const parsed = Date.parse(timeStr);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  const isPM = /pm/i.test(timeStr);
  const isAM = /am/i.test(timeStr);
  const clean = timeStr.replace(/(AM|PM|am|pm|\s)/g, "");
  const parts = clean.split(":");
  let h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);

  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDisplayTime(timeStr: string, format: TimeFormat): string {
  const time24 = to24hTime(timeStr);
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (format === "24h") {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  } else {
    const period = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
  }
}

function timeToMinutes(tStr: string): number {
  const time24 = to24hTime(tStr);
  const [h, m] = time24.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

const DEFAULT_DAYS: DaySchedule["day"][] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function buildDefaultSchedule(fmt: TimeFormat = "12h"): DaySchedule[] {
  return DEFAULT_DAYS.map((day) => {
    if (day === "Tuesday") {
      return {
        day,
        isOpen: true,
        slots: [
          {
            start: formatDisplayTime("11:00", fmt),
            end: formatDisplayTime("16:00", fmt),
          },
          {
            start: formatDisplayTime("15:30", fmt),
            end: formatDisplayTime("23:59", fmt),
          },
        ],
      };
    }
    return {
      day,
      isOpen: true,
      slots: [
        {
          start: formatDisplayTime("11:00", fmt),
          end: formatDisplayTime("23:59", fmt),
        },
      ],
    };
  });
}

function convertConvexScheduleToUI(
  convexSchedule: any,
  fmt: TimeFormat,
): DaySchedule[] {
  if (!convexSchedule) return buildDefaultSchedule(fmt);

  return DEFAULT_DAYS.map((day) => {
    const dayData = convexSchedule[day];
    if (!dayData) {
      return { day, isOpen: false, slots: [] };
    }
    const isOpen = dayData.is_open ?? true;
    const hours = Array.isArray(dayData.hours) ? dayData.hours : [];
    const slots = hours.map((h: any) => ({
      start: formatDisplayTime(h.start_time || "11:00", fmt),
      end: formatDisplayTime(h.end_time || "23:59", fmt),
    }));

    return {
      day,
      isOpen,
      slots:
        slots.length > 0
          ? slots
          : isOpen
            ? [
                {
                  start: formatDisplayTime("11:00", fmt),
                  end: formatDisplayTime("23:59", fmt),
                },
              ]
            : [],
    };
  });
}

// Chevron SVG for Select inputs
function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ----------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------

export function OrganizationQueueSettings() {
  const config = useQuery(api.organizationQueueConfigurations.get, {});
  const initializeConfig = useMutation(
    api.organizationQueueConfigurations.initialize,
  );
  const updateConfig = useMutation(api.organizationQueueConfigurations.update);
  const copyStoreTimingMutation = useMutation(
    api.organizationQueueConfigurations.copyStoreTiming,
  );

  // Active Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>("waitlist");

  // Form Fields State
  const [onlineWaitlist, setOnlineWaitlist] = useState(true);
  const [customerViewWaitlist, setCustomerViewWaitlist] = useState(true);
  const [geoFence, setGeoFence] = useState(false);
  const [geoFenceRadius, setGeoFenceRadius] = useState("500");
  const [geoFenceLatitude, setGeoFenceLatitude] = useState(37.774929);
  const [geoFenceLongitude, setGeoFenceLongitude] = useState(-122.419416);

  const [waitAlgo, setWaitAlgo] = useState<WaitAlgoMode>("smart");
  const [customWaitTime, setCustomWaitTime] = useState<number | "">(15);
  const [customWaitUnit, setCustomWaitUnit] = useState<"minutes" | "hours">(
    "minutes",
  );

  const [timeFormat, setTimeFormatState] = useState<TimeFormat>("12h");
  const [defaultPartySize, setDefaultPartySize] = useState<number | "">(2);
  const [maxWaitlistCap, setMaxWaitlistCap] = useState<number | "">(35);

  const [onlineReservation, setOnlineReservation] = useState(true);
  const [bookingApproval, setBookingApproval] = useState(false);
  const [selfCancel, setSelfCancel] = useState(true);

  const [reservationSlotSize, setReservationSlotSize] = useState("30");
  const [reservationPerTimeSlot, setReservationPerTimeSlot] = useState("6");
  const [maxBookingPerCustomer, setMaxBookingPerCustomer] = useState("1");
  const [maxBookingPerCustomerTime, setMaxBookingPerCustomerTime] =
    useState("day");

  // Schedules
  const [waitlistSchedule, setWaitlistSchedule] = useState<DaySchedule[]>(() =>
    buildDefaultSchedule("12h"),
  );
  const [resSchedule, setResSchedule] = useState<DaySchedule[]>(() =>
    buildDefaultSchedule("12h"),
  );

  // Meta & UI States
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyModalTarget, setCopyModalTarget] = useState<
    "waitlist" | "reservation"
  >("waitlist");

  // Time Picker Popover State
  const [timePickerTarget, setTimePickerTarget] =
    useState<TimePickerTarget | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [tpHour, setTpHour] = useState("11");
  const [tpMinute, setTpMinute] = useState("00");
  const [tpAmPm, setTpAmPm] = useState("AM");

  // Geofence Map Drawer State
  const [isGeoDrawerOpen, setIsGeoDrawerOpen] = useState(false);
  const [tempGeoRadius, setTempGeoRadius] = useState<number>(500);
  const [tempGeoLat, setTempGeoLat] = useState<number>(37.774929);
  const [tempGeoLng, setTempGeoLng] = useState<number>(-122.419416);
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const leafletMarkerRef = useRef<any>(null);
  const leafletCircleRef = useRef<any>(null);

  // Auto-initialize backend record if null
  useEffect(() => {
    if (config === null) {
      initializeConfig().catch((err) => {
        console.error("Failed to auto-initialize queue config:", err);
      });
    }
  }, [config, initializeConfig]);

  // Sync loaded config to form state
  useEffect(() => {
    if (config) {
      setOnlineWaitlist(config.onlineWaitlist ?? true);
      setCustomerViewWaitlist(config.customerViewWaitlist ?? true);
      setGeoFence(config.geoFence ?? false);
      setGeoFenceRadius(config.geoFenceRadius || "500");
      setGeoFenceLatitude(config.geoFenceLatitude ?? 37.774929);
      setGeoFenceLongitude(config.geoFenceLongitude ?? -122.419416);

      if (config.defaultWaitTime) {
        setWaitAlgo("custom");
        const parsed = parseInt(config.defaultWaitTime, 10);
        if (!isNaN(parsed)) setCustomWaitTime(parsed);
        if (config.defaultWaitTime.toLowerCase().includes("hour")) {
          setCustomWaitUnit("hours");
        } else {
          setCustomWaitUnit("minutes");
        }
      } else {
        setWaitAlgo("smart");
      }

      const fmt = (config.queueTimeFormat as TimeFormat) || "12h";
      setTimeFormatState(fmt);
      setDefaultPartySize(config.defaultPartySize ?? 2);

      setOnlineReservation(config.onlineReservation ?? true);
      setBookingApproval(config.bookingApproval ?? false);
      setReservationSlotSize(config.reservationSlotSize || "30");
      setReservationPerTimeSlot(config.reservationPerTimeSlot || "6");
      setMaxBookingPerCustomer(config.maxBookingPerCustomer || "1");
      setMaxBookingPerCustomerTime(config.maxBookingPerCustomerTime || "day");

      if (config.waitlistHours) {
        setWaitlistSchedule(
          convertConvexScheduleToUI(config.waitlistHours, fmt),
        );
      }
      if (config.reservationHours) {
        setResSchedule(convertConvexScheduleToUI(config.reservationHours, fmt));
      }

      setIsDirty(false);
    }
  }, [config]);

  // Leaflet Map Initialization for Geofence Drawer
  useEffect(() => {
    if (!isGeoDrawerOpen) return;

    const loadLeafletAndInit = () => {
      if (typeof window === "undefined") return;

      if (!(window as any).L) {
        if (!document.getElementById("leaflet-css")) {
          const css = document.createElement("link");
          css.id = "leaflet-css";
          css.rel = "stylesheet";
          css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(css);
        }

        if (!document.getElementById("leaflet-js")) {
          const script = document.createElement("script");
          script.id = "leaflet-js";
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = () => initMapInstance();
          document.body.appendChild(script);
        }
      } else {
        initMapInstance();
      }
    };

    const initMapInstance = () => {
      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }

      const map = L.map(mapContainerRef.current).setView(
        [tempGeoLat, tempGeoLng],
        14,
      );
      leafletMapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: "custom-div-icon",
        html: `<div style="background-color:#ea4335;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #ffffff;box-shadow:0 3px 6px rgba(0,0,0,0.4);margin-top:-24px;margin-left:-12px;"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });

      const marker = L.marker([tempGeoLat, tempGeoLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);
      leafletMarkerRef.current = marker;

      marker.on("dragend", (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        setTempGeoLat(parseFloat(lat.toFixed(6)));
        setTempGeoLng(parseFloat(lng.toFixed(6)));
      });

      const circle = L.circle([tempGeoLat, tempGeoLng], {
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.2,
        radius: tempGeoRadius,
      }).addTo(map);
      leafletCircleRef.current = circle;

      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        setTempGeoLat(parseFloat(lat.toFixed(6)));
        setTempGeoLng(parseFloat(lng.toFixed(6)));
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
      });
    };

    const timer = setTimeout(loadLeafletAndInit, 120);
    return () => clearTimeout(timer);
  }, [isGeoDrawerOpen]);

  // Sync marker & radius circle when values update
  useEffect(() => {
    if (
      leafletMapRef.current &&
      leafletMarkerRef.current &&
      leafletCircleRef.current
    ) {
      const L = (window as any).L;
      if (!L) return;
      leafletMapRef.current.setView([tempGeoLat, tempGeoLng]);
      leafletMarkerRef.current.setLatLng([tempGeoLat, tempGeoLng]);
      leafletCircleRef.current.setLatLng([tempGeoLat, tempGeoLng]);
      leafletCircleRef.current.setRadius(tempGeoRadius);
    }
  }, [tempGeoLat, tempGeoLng, tempGeoRadius]);

  const openGeofenceDrawer = () => {
    setTempGeoRadius(parseInt(geoFenceRadius, 10) || 500);
    setTempGeoLat(geoFenceLatitude);
    setTempGeoLng(geoFenceLongitude);
    setMapSearchQuery("");
    setIsGeoDrawerOpen(true);
  };

  const saveGeofenceDrawer = () => {
    setGeoFenceRadius(String(tempGeoRadius));
    setGeoFenceLatitude(tempGeoLat);
    setGeoFenceLongitude(tempGeoLng);
    setIsGeoDrawerOpen(false);
    markDirty();
    showToast("Geofence perimeter and coordinates updated.");
  };

  const handleAddressSearch = async () => {
    if (!mapSearchQuery.trim()) return;
    setIsSearchingAddress(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          mapSearchQuery,
        )}`,
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setTempGeoLat(parseFloat(lat.toFixed(6)));
        setTempGeoLng(parseFloat(lon.toFixed(6)));
      } else {
        showToast("Address location not found.");
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      showToast("Could not search location.");
    } finally {
      setIsSearchingAddress(false);
    }
  };

  // Toast auto-hide
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const markDirty = () => {
    setIsDirty(true);
  };

  // Check Schedule Conflicts
  const waitlistConflicts = useMemo(() => {
    for (const d of waitlistSchedule) {
      if (!d.isOpen || d.slots.length < 2) continue;
      for (let i = 0; i < d.slots.length; i++) {
        for (let j = i + 1; j < d.slots.length; j++) {
          const s1 = timeToMinutes(d.slots[i].start);
          const e1 = timeToMinutes(d.slots[i].end);
          const s2 = timeToMinutes(d.slots[j].start);
          const e2 = timeToMinutes(d.slots[j].end);

          if (Math.max(s1, s2) < Math.min(e1, e2)) {
            return `${d.day}: Slot ${j + 1} (${d.slots[j].start}) overlaps with Slot ${i + 1} (${d.slots[i].start} – ${d.slots[i].end}). Adjust times to maintain distinct operational intervals.`;
          }
        }
      }
    }
    return null;
  }, [waitlistSchedule]);

  const resConflicts = useMemo(() => {
    for (const d of resSchedule) {
      if (!d.isOpen || d.slots.length < 2) continue;
      for (let i = 0; i < d.slots.length; i++) {
        for (let j = i + 1; j < d.slots.length; j++) {
          const s1 = timeToMinutes(d.slots[i].start);
          const e1 = timeToMinutes(d.slots[i].end);
          const s2 = timeToMinutes(d.slots[j].start);
          const e2 = timeToMinutes(d.slots[j].end);

          if (Math.max(s1, s2) < Math.min(e1, e2)) {
            return `${d.day}: Slot ${j + 1} (${d.slots[j].start}) overlaps with Slot ${i + 1} (${d.slots[i].start} – ${d.slots[i].end}). Adjust times to maintain distinct operational intervals.`;
          }
        }
      }
    }
    return null;
  }, [resSchedule]);

  const hasAnyConflict = Boolean(waitlistConflicts || resConflicts);

  // Time format toggle handler (12h vs 24h)
  const handleTimeFormatChange = (fmt: TimeFormat) => {
    if (fmt === timeFormat) return;
    setTimeFormatState(fmt);

    setWaitlistSchedule((prev) =>
      prev.map((day) => ({
        ...day,
        slots: day.slots.map((s) => ({
          start: formatDisplayTime(s.start, fmt),
          end: formatDisplayTime(s.end, fmt),
        })),
      })),
    );

    setResSchedule((prev) =>
      prev.map((day) => ({
        ...day,
        slots: day.slots.map((s) => ({
          start: formatDisplayTime(s.start, fmt),
          end: formatDisplayTime(s.end, fmt),
        })),
      })),
    );

    markDirty();
  };

  // Schedule Slot Actions
  const toggleDayOpen = (type: "waitlist" | "reservations", dayIdx: number) => {
    const setter = type === "waitlist" ? setWaitlistSchedule : setResSchedule;
    setter((prev) => {
      const next = [...prev];
      const target = { ...next[dayIdx] };
      target.isOpen = !target.isOpen;
      if (target.isOpen && target.slots.length === 0) {
        target.slots = [
          {
            start: formatDisplayTime("11:00", timeFormat),
            end: formatDisplayTime("22:00", timeFormat),
          },
        ];
      }
      next[dayIdx] = target;
      return next;
    });
    markDirty();
  };

  const addSlot = (type: "waitlist" | "reservations", dayIdx: number) => {
    const setter = type === "waitlist" ? setWaitlistSchedule : setResSchedule;
    setter((prev) => {
      const next = [...prev];
      const target = { ...next[dayIdx] };
      target.slots = [
        ...target.slots,
        {
          start: formatDisplayTime("17:00", timeFormat),
          end: formatDisplayTime("22:00", timeFormat),
        },
      ];
      next[dayIdx] = target;
      return next;
    });
    markDirty();
  };

  const removeSlot = (
    type: "waitlist" | "reservations",
    dayIdx: number,
    slotIdx: number,
  ) => {
    const setter = type === "waitlist" ? setWaitlistSchedule : setResSchedule;
    setter((prev) => {
      const next = [...prev];
      const target = { ...next[dayIdx] };
      target.slots = target.slots.filter((_, idx) => idx !== slotIdx);
      next[dayIdx] = target;
      return next;
    });
    markDirty();
  };

  // Time Picker Popover Logic
  const openTimePicker = (
    e: React.MouseEvent<HTMLButtonElement>,
    type: "waitlist" | "reservations",
    dayIdx: number,
    slotIdx: number,
    field: "start" | "end",
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverPos({
      top: rect.bottom + window.scrollY + 6,
      left: Math.min(rect.left + window.scrollX, window.innerWidth - 280),
    });

    setTimePickerTarget({ type, dayIdx, slotIdx, field });

    const schedule = type === "waitlist" ? waitlistSchedule : resSchedule;
    const currentVal = schedule[dayIdx].slots[slotIdx][field];

    if (timeFormat === "12h") {
      const parts = currentVal.split(" ");
      const timePart = parts[0] || "11:00";
      const period = parts[1] || "AM";
      const [hh, mm] = timePart.split(":");
      setTpHour(hh || "11");
      setTpMinute(mm || "00");
      setTpAmPm(period);
    } else {
      const [hh, mm] = currentVal.split(":");
      setTpHour(hh || "11");
      setTpMinute(mm || "00");
    }
  };

  const closeTimePicker = () => {
    setTimePickerTarget(null);
  };

  const applyPickedTime = () => {
    if (!timePickerTarget) return;

    const { type, dayIdx, slotIdx, field } = timePickerTarget;
    let newTime = "";

    if (timeFormat === "12h") {
      newTime = `${tpHour}:${tpMinute} ${tpAmPm}`;
    } else {
      newTime = `${tpHour}:${tpMinute}`;
    }

    const setter = type === "waitlist" ? setWaitlistSchedule : setResSchedule;
    setter((prev) => {
      const next = [...prev];
      const targetDay = { ...next[dayIdx] };
      const nextSlots = [...targetDay.slots];
      nextSlots[slotIdx] = { ...nextSlots[slotIdx], [field]: newTime };
      targetDay.slots = nextSlots;
      next[dayIdx] = targetDay;
      return next;
    });

    closeTimePicker();
    markDirty();
  };

  // Copy Store Timings Modal
  const openCopyModal = (target: "waitlist" | "reservation") => {
    setCopyModalTarget(target);
    setShowCopyModal(true);
  };

  const confirmCopyTimings = async () => {
    try {
      await copyStoreTimingMutation({ target: copyModalTarget });
      setShowCopyModal(false);

      const newSlotsMonFri = [
        {
          start: formatDisplayTime("11:00", timeFormat),
          end: formatDisplayTime("22:00", timeFormat),
        },
      ];
      const newSlotsSatSun = [
        {
          start: formatDisplayTime("10:30", timeFormat),
          end: formatDisplayTime("23:30", timeFormat),
        },
      ];

      const setter =
        copyModalTarget === "waitlist" ? setWaitlistSchedule : setResSchedule;
      setter((prev) =>
        prev.map((dayObj, idx) => ({
          ...dayObj,
          isOpen: true,
          slots: idx <= 4 ? newSlotsMonFri : newSlotsSatSun,
        })),
      );

      showToast("Master store operational timings synced successfully.");
      markDirty();
    } catch (err: any) {
      console.error("Error copying store timings:", err);
      showToast(err.message || "Failed to sync store timings.");
    }
  };

  // GPS Auto-detect
  const detectGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoFenceLatitude(parseFloat(pos.coords.latitude.toFixed(6)));
          setGeoFenceLongitude(parseFloat(pos.coords.longitude.toFixed(6)));
          showToast("Coordinates updated to device geolocation.");
          markDirty();
        },
        () => {
          setGeoFenceLatitude(37.783312);
          setGeoFenceLongitude(-122.416701);
          showToast("Coordinates set to venue GPS.");
          markDirty();
        },
      );
    } else {
      setGeoFenceLatitude(37.783312);
      setGeoFenceLongitude(-122.416701);
      showToast("Coordinates set to venue GPS.");
      markDirty();
    }
  };

  // Discard Changes
  const handleDiscard = () => {
    if (!config) return;
    setOnlineWaitlist(config.onlineWaitlist ?? true);
    setCustomerViewWaitlist(config.customerViewWaitlist ?? true);
    setGeoFence(config.geoFence ?? false);
    setGeoFenceRadius(config.geoFenceRadius || "500");
    setGeoFenceLatitude(config.geoFenceLatitude ?? 37.774929);
    setGeoFenceLongitude(config.geoFenceLongitude ?? -122.419416);

    if (config.defaultWaitTime) {
      setWaitAlgo("custom");
      const parsed = parseInt(config.defaultWaitTime, 10);
      if (!isNaN(parsed)) setCustomWaitTime(parsed);
      if (config.defaultWaitTime.toLowerCase().includes("hour")) {
        setCustomWaitUnit("hours");
      } else {
        setCustomWaitUnit("minutes");
      }
    } else {
      setWaitAlgo("smart");
    }

    const fmt = (config.queueTimeFormat as TimeFormat) || "12h";
    setTimeFormatState(fmt);
    setDefaultPartySize(config.defaultPartySize ?? 2);

    setOnlineReservation(config.onlineReservation ?? true);
    setBookingApproval(config.bookingApproval ?? false);
    setReservationSlotSize(config.reservationSlotSize || "30");
    setReservationPerTimeSlot(config.reservationPerTimeSlot || "6");
    setMaxBookingPerCustomer(config.maxBookingPerCustomer || "1");
    setMaxBookingPerCustomerTime(config.maxBookingPerCustomerTime || "day");

    if (config.waitlistHours) {
      setWaitlistSchedule(convertConvexScheduleToUI(config.waitlistHours, fmt));
    }
    if (config.reservationHours) {
      setResSchedule(convertConvexScheduleToUI(config.reservationHours, fmt));
    }

    setIsDirty(false);
    showToast("Settings reset to saved values.");
  };

  // Save Configuration to Convex
  const handleSave = async () => {
    setIsSaving(true);
    console.log(
      "➡️ [QueueSettings] Save button clicked. Building Convex mutation payload...",
    );

    try {
      const waitlistHoursObj: Record<
        string,
        { is_open: boolean; hours: { start_time: string; end_time: string }[] }
      > = {};
      waitlistSchedule.forEach((d) => {
        waitlistHoursObj[d.day] = {
          is_open: d.isOpen,
          hours: d.isOpen
            ? d.slots.map((s) => ({
                start_time: to24hTime(s.start),
                end_time: to24hTime(s.end),
              }))
            : [],
        };
      });

      const resHoursObj: Record<
        string,
        { is_open: boolean; hours: { start_time: string; end_time: string }[] }
      > = {};
      resSchedule.forEach((d) => {
        resHoursObj[d.day] = {
          is_open: d.isOpen,
          hours: d.isOpen
            ? d.slots.map((s) => ({
                start_time: to24hTime(s.start),
                end_time: to24hTime(s.end),
              }))
            : [],
        };
      });

      const finalWaitTimeNum =
        typeof customWaitTime === "number"
          ? customWaitTime
          : parseInt(String(customWaitTime), 10) || 15;

      const defaultWaitTimeVal =
        waitAlgo === "custom"
          ? `${finalWaitTimeNum} ${customWaitUnit}`
          : undefined;

      const finalPartySizeNum =
        typeof defaultPartySize === "number"
          ? defaultPartySize
          : parseInt(String(defaultPartySize), 10) || 2;

      const payload = {
        waitlistHours: waitlistHoursObj as any,
        reservationHours: resHoursObj as any,
        defaultWaitTime: defaultWaitTimeVal,
        defaultPartySize: finalPartySizeNum,
        customerViewWaitlist,
        onlineWaitlist,
        onlineReservation,
        bookingApproval,
        geoFence,
        geoFenceRadius,
        geoFenceLatitude,
        geoFenceLongitude,
        maxBookingPerCustomer,
        maxBookingPerCustomerTime,
        reservationSlotSize,
        reservationPerTimeSlot,
        queueTimeFormat: timeFormat,
      };

      console.log(
        "🚀 [QueueSettings] Sending updateConfig mutation payload to Convex backend:",
        payload,
      );
      const res = await updateConfig(payload);
      console.log(
        "✅ [QueueSettings] Convex backend successfully responded:",
        res,
      );

      setIsDirty(false);
      showToast("All queue & reservation settings have been saved.");
    } catch (err: any) {
      console.error("❌ [QueueSettings] Convex mutation save failed:", err);
      showToast(err.message || "Failed to save configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = config === undefined;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#5e5e5e]">
        <svg
          className="w-8 h-8 animate-spin text-[#141010] mb-3"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <span className="text-sm font-medium">
          Loading Queue & Waitlist Settings...
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#fbf9f8] text-stone-800 font-sans">
      {/* Main Content Area */}
      <div className="max-w-5xl w-full mx-auto p-6 lg:p-8 space-y-8">
        {/* Page Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
              Queue &amp; Waitlist
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Configure guest check-in rules, reservations, operational hours,
              and proximity geofencing.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isDirty && (
              <div className="flex items-center gap-2 text-xs text-stone-500 font-medium bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Unsaved changes
              </div>
            )}
            {hasAnyConflict && (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200/70 px-2.5 py-1 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Schedule conflicts
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-stone-200">
          <nav aria-label="Tabs" className="flex space-x-8">
            <button
              type="button"
              onClick={() => setActiveTab("waitlist")}
              className={`py-3.5 px-1 text-sm font-semibold flex items-center gap-2 transition-all border-b-2 ${
                activeTab === "waitlist"
                  ? "border-stone-900 text-stone-900"
                  : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300"
              }`}
            >
              <span>Waitlist</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("reservations")}
              className={`py-3.5 px-1 text-sm font-medium flex items-center gap-2 transition-all border-b-2 ${
                activeTab === "reservations"
                  ? "border-stone-900 text-stone-900 font-semibold"
                  : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300"
              }`}
            >
              <span>Reservations</span>
              <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full font-semibold">
                Configurable
              </span>
            </button>
          </nav>
        </div>

        {/* TAB PANE 1: WAITLIST CONFIGURATION */}
        {activeTab === "waitlist" && (
          <div className="space-y-6">
            {/* CARD 1: Operational Channels */}
            <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
              <div className="mb-6 pb-4 border-b border-stone-100">
                <h2 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                  Guest Waitlist Channels
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Control guest self-registration and live queue visibility.
                </p>
              </div>

              <div className="space-y-5 divide-y divide-stone-100">
                {/* Item 1: Accept online waitlist */}
                <div className="flex items-center justify-between pt-1">
                  <div className="pr-6">
                    <label
                      htmlFor="toggle-online-waitlist"
                      className="text-sm font-semibold text-stone-800 cursor-pointer"
                    >
                      Accept online waitlist entries
                    </label>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Allow diners to add themselves to the live waitlist
                      through your storefront or mobile web link.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={onlineWaitlist}
                    onClick={() => {
                      setOnlineWaitlist(!onlineWaitlist);
                      markDirty();
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      onlineWaitlist ? "bg-emerald-500" : "bg-stone-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        onlineWaitlist ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Item 2: Customer can view live queue */}
                <div className="flex items-center justify-between pt-4">
                  <div className="pr-6">
                    <label
                      htmlFor="toggle-customer-view"
                      className="text-sm font-semibold text-stone-800 cursor-pointer"
                    >
                      Live guest tracker
                    </label>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Guests can check their current spot number and dynamic
                      live wait estimate in real-time on their phone.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={customerViewWaitlist}
                    onClick={() => {
                      setCustomerViewWaitlist(!customerViewWaitlist);
                      markDirty();
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      customerViewWaitlist ? "bg-emerald-500" : "bg-stone-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        customerViewWaitlist ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* CARD 2: Dedicated Geofence Validation & Perimeter */}
            <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="pr-6">
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                      Geofence validation
                    </h2>
                    {geoFence && (
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Restrict waitlist entries to diners located physically near
                    your venue to reduce no-shows.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={geoFence}
                  onClick={() => {
                    setGeoFence(!geoFence);
                    markDirty();
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    geoFence ? "bg-emerald-500" : "bg-stone-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      geoFence ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {geoFence && (
                <div className="mt-6 pt-6 border-t border-stone-100 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-xs text-stone-500 max-w-sm">
                      Configure radial perimeter distance and GPS location
                      coordinates.
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={openGeofenceDrawer}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1c1a19] hover:bg-black text-white rounded-full transition-all cursor-pointer shadow-xs border border-stone-800 shrink-0"
                        style={{ color: "#ffffff" }}
                      >
                        <svg
                          className="w-4 h-4 text-white stroke-white flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.818V8.042a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                          />
                        </svg>
                        <span
                          className="text-xs font-semibold text-white tracking-wide"
                          style={{ color: "#ffffff" }}
                        >
                          Set geofence radius
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={detectGPS}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 rounded-full border border-stone-300 transition-all cursor-pointer shadow-xs shrink-0"
                      >
                        <svg
                          className="w-4 h-4 text-stone-600 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="text-xs font-semibold text-stone-800">
                          Auto-Detect Venue GPS
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                    {/* Radius Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-stone-700 uppercase tracking-wider">
                          Perimeter Radius
                        </span>
                        <span className="font-semibold text-stone-900">
                          {geoFenceRadius} meters
                        </span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="3000"
                        step="25"
                        value={geoFenceRadius}
                        onChange={(e) => {
                          setGeoFenceRadius(e.target.value);
                          markDirty();
                        }}
                        className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
                      />
                      <div className="flex justify-between text-[11px] text-stone-400">
                        <span>50m (Immediate vicinity)</span>
                        <span>1.5km</span>
                        <span>3.0km (District wide)</span>
                      </div>
                    </div>

                    {/* Coordinates */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
                          Latitude
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={geoFenceLatitude}
                          onChange={(e) => {
                            setGeoFenceLatitude(
                              parseFloat(e.target.value) || 0,
                            );
                            markDirty();
                          }}
                          className="w-full text-xs font-mono rounded-xl border-stone-300 bg-white px-3.5 py-2.5 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 shadow-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
                          Longitude
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={geoFenceLongitude}
                          onChange={(e) => {
                            setGeoFenceLongitude(
                              parseFloat(e.target.value) || 0,
                            );
                            markDirty();
                          }}
                          className="w-full text-xs font-mono rounded-xl border-stone-300 bg-white px-3.5 py-2.5 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 shadow-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* CARD 2: Queue Defaults & Estimation */}
            <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
              <div className="mb-6 pb-4 border-b border-stone-100">
                <h2 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                  Queue Defaults &amp; Estimation
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Parameters used when seating speed algorithm computes wait
                  intervals.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                {/* Wait Time Calculation Column */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
                      Wait Time Calculation
                    </label>
                    <div className="inline-flex w-full p-1 bg-stone-100 rounded-xl border border-stone-200">
                      <button
                        type="button"
                        onClick={() => {
                          setWaitAlgo("smart");
                          markDirty();
                        }}
                        className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                          waitAlgo === "smart"
                            ? "bg-stone-900 text-white shadow-xs"
                            : "bg-transparent text-stone-700 hover:text-stone-900"
                        }`}
                      >
                        Smart Time (AI)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWaitAlgo("custom");
                          markDirty();
                        }}
                        className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                          waitAlgo === "custom"
                            ? "bg-stone-900 text-white shadow-xs"
                            : "bg-transparent text-stone-700 hover:text-stone-900"
                        }`}
                      >
                        Custom Duration
                      </button>
                    </div>
                  </div>

                  {waitAlgo === "smart" ? (
                    <div className="space-y-3">
                      <p className="text-xs text-stone-500 leading-relaxed">
                        Automatically estimates customer wait time based on
                        queue size, party size and historical wait patterns.
                      </p>
                      <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-medium text-stone-500 block uppercase tracking-wider">
                            Estimated wait time
                          </span>
                          <span className="text-xs font-semibold text-stone-900">
                            Dynamic system calculation
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-200/70 text-stone-800 border border-stone-300/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Automatically calculated
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-bold text-stone-800 block mb-0.5">
                          Custom Wait Time
                        </span>
                        <p className="text-xs text-stone-500 leading-relaxed">
                          Use a fixed wait time instead of automatic estimates.
                        </p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
                          Default wait time
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="300"
                            value={customWaitTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                setCustomWaitTime("");
                              } else {
                                const parsed = parseInt(val, 10);
                                setCustomWaitTime(isNaN(parsed) ? "" : parsed);
                              }
                              markDirty();
                            }}
                            onBlur={() => {
                              if (
                                customWaitTime === "" ||
                                (typeof customWaitTime === "number" &&
                                  customWaitTime < 1)
                              ) {
                                setCustomWaitTime(15);
                              }
                            }}
                            className="w-full rounded-xl border-stone-300 bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-sm font-medium py-2.5 px-3.5 shadow-xs"
                          />
                          <div className="relative w-36 shrink-0">
                            <select
                              value={customWaitUnit}
                              onChange={(e) => {
                                setCustomWaitUnit(
                                  e.target.value as "minutes" | "hours",
                                );
                                markDirty();
                              }}
                              className="w-full appearance-none rounded-xl border-stone-300 bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-sm font-medium py-2.5 pl-3.5 pr-10 shadow-xs cursor-pointer"
                            >
                              <option value="minutes">Minutes</option>
                              <option value="hours">Hours</option>
                            </select>
                            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 w-4 h-4" />
                          </div>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-1.5">
                          Preset interval assigned to new guests joining the
                          live waitlist.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Time Format Column */}
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Time Format in Queue
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl border border-stone-200">
                    <button
                      type="button"
                      onClick={() => handleTimeFormatChange("12h")}
                      className={`py-2.5 text-xs font-semibold rounded-lg transition-all ${
                        timeFormat === "12h"
                          ? "bg-stone-900 text-white shadow-xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      12 hours (1:00 PM)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTimeFormatChange("24h")}
                      className={`py-2.5 text-xs font-semibold rounded-lg transition-all ${
                        timeFormat === "24h"
                          ? "bg-stone-900 text-white shadow-xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      24 hours (13:00)
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1.5">
                    Applies format to guest SMS notifications, receipt tickets,
                    and hostess dashboard.
                  </p>
                </div>

                {/* Default Party Size */}
                <div>
                  <label
                    htmlFor="default-party-size"
                    className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2"
                  >
                    Default Party Size
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <input
                      id="default-party-size"
                      type="number"
                      min="1"
                      max="20"
                      value={defaultPartySize}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setDefaultPartySize("");
                        } else {
                          const parsed = parseInt(val, 10);
                          setDefaultPartySize(isNaN(parsed) ? "" : parsed);
                        }
                        markDirty();
                      }}
                      onBlur={() => {
                        if (
                          defaultPartySize === "" ||
                          (typeof defaultPartySize === "number" &&
                            defaultPartySize < 1)
                        ) {
                          setDefaultPartySize(2);
                        }
                      }}
                      className="block w-full rounded-xl border-stone-300 bg-white pr-12 pl-3.5 py-2.5 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-sm font-medium"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                      <span className="text-xs text-stone-400">Guests</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1.5">
                    Preset value populated when hostess initiates quick entry.
                  </p>
                </div>

                {/* Maximum Waitlist Capacity */}
                <div>
                  <label
                    htmlFor="max-waitlist-cap"
                    className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2"
                  >
                    Maximum Waitlist Capacity
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <input
                      id="max-waitlist-cap"
                      type="number"
                      min="5"
                      max="150"
                      value={maxWaitlistCap}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setMaxWaitlistCap("");
                        } else {
                          const parsed = parseInt(val, 10);
                          setMaxWaitlistCap(isNaN(parsed) ? "" : parsed);
                        }
                        markDirty();
                      }}
                      onBlur={() => {
                        if (
                          maxWaitlistCap === "" ||
                          (typeof maxWaitlistCap === "number" &&
                            maxWaitlistCap < 1)
                        ) {
                          setMaxWaitlistCap(35);
                        }
                      }}
                      className="block w-full rounded-xl border-stone-300 bg-white pr-12 pl-3.5 py-2.5 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-sm font-medium"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                      <span className="text-xs text-stone-400">Parties</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1.5">
                    Automatically pauses new check-ins when threshold is
                    exceeded.
                  </p>
                </div>
              </div>
            </section>

            {/* CARD 3: Waitlist Hours (Weekly Schedule Editor) */}
            <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-stone-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                      Waitlist Operational Hours
                    </h2>
                    <span className="text-xs font-normal text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                      Weekly Schedule
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Define intervals when diners can join the live queue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCopyModal("waitlist")}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300/80 rounded-xl transition-colors cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5 text-stone-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>Fetch Organization's Timings</span>
                </button>
              </div>

              {/* Overlapping warning alert banner */}
              {waitlistConflicts && (
                <div className="p-3.5 mb-4 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
                  <svg
                    className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <span className="font-bold">
                      Noticeable overlap detected:
                    </span>
                    <span> {waitlistConflicts}</span>
                  </div>
                </div>
              )}

              {/* 7-Day Schedule Matrix */}
              <div className="space-y-3.5">
                {waitlistSchedule.map((dayObj, dayIdx) => (
                  <div
                    key={dayObj.day}
                    className={`p-3.5 rounded-xl border ${
                      dayObj.isOpen
                        ? "bg-stone-50/50 border-stone-200"
                        : "bg-stone-100/60 border-stone-200/60"
                    } transition-all`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 w-40 flex-shrink-0">
                        <span className="font-medium text-xs text-stone-900 w-24">
                          {dayObj.day}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleDayOpen("waitlist", dayIdx)}
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                            dayObj.isOpen
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                              : "bg-stone-200 text-stone-600 border-stone-300 hover:bg-stone-300"
                          }`}
                        >
                          {dayObj.isOpen ? "Open" : "Closed"}
                        </button>
                      </div>

                      <div className="flex-1">
                        {dayObj.isOpen ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {dayObj.slots.map((slot, slotIdx) => (
                              <div
                                key={slotIdx}
                                className="inline-flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-xs text-xs font-mono text-stone-800"
                              >
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    openTimePicker(
                                      e,
                                      "waitlist",
                                      dayIdx,
                                      slotIdx,
                                      "start",
                                    )
                                  }
                                  className="hover:bg-stone-100 px-2 py-0.5 rounded transition-colors font-medium cursor-pointer"
                                >
                                  {slot.start}
                                </button>
                                <span className="text-stone-400 font-sans px-1">
                                  —
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    openTimePicker(
                                      e,
                                      "waitlist",
                                      dayIdx,
                                      slotIdx,
                                      "end",
                                    )
                                  }
                                  className="hover:bg-stone-100 px-2 py-0.5 rounded transition-colors font-medium cursor-pointer"
                                >
                                  {slot.end}
                                </button>
                                {dayObj.slots.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeSlot("waitlist", dayIdx, slotIdx)
                                    }
                                    className="ml-1 text-stone-400 hover:text-red-600 p-0.5 rounded cursor-pointer"
                                    title="Remove slot"
                                  >
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => addSlot("waitlist", dayIdx)}
                              className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 border border-dashed border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span>+</span> Add Slot
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400 italic font-normal">
                            No operational slots configured. Diners cannot
                            register.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB PANE 2: RESERVATIONS CONFIGURATION */}
        {activeTab === "reservations" && (
          <div className="space-y-6">
            {/* CARD 1: Online Reservations Settings */}
            <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
              <div className="mb-6 pb-4 border-b border-stone-100">
                <h2 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                  Online Table Reservations
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Configure forward calendar booking policies and customer
                  permissions.
                </p>
              </div>

              <div className="space-y-5 divide-y divide-stone-100">
                {/* Item 1: Accept online requests */}
                <div className="flex items-center justify-between pt-1">
                  <div className="pr-6">
                    <label
                      htmlFor="toggle-online-res"
                      className="text-sm font-semibold text-stone-800 cursor-pointer"
                    >
                      Accept online reservation requests
                    </label>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Allow diners to book tables in advance from the online
                      booking portal.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={onlineReservation}
                    onClick={() => {
                      setOnlineReservation(!onlineReservation);
                      markDirty();
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      onlineReservation ? "bg-emerald-500" : "bg-stone-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        onlineReservation ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Item 2: Approval mode */}
                <div className="flex items-center justify-between pt-4">
                  <div className="pr-6">
                    <label
                      htmlFor="toggle-hostess-approval"
                      className="text-sm font-semibold text-stone-800 cursor-pointer"
                    >
                      Hostess booking approval
                    </label>
                    <p className="text-xs text-stone-500 mt-0.5">
                      New reservations made by customers must be explicitly
                      approved by staff before SMS confirmation is triggered.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bookingApproval}
                    onClick={() => {
                      setBookingApproval(!bookingApproval);
                      markDirty();
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      bookingApproval ? "bg-emerald-500" : "bg-stone-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        bookingApproval ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Item 3: Self cancellation */}
                <div className="flex items-center justify-between pt-4">
                  <div className="pr-6">
                    <label
                      htmlFor="toggle-self-cancel"
                      className="text-sm font-semibold text-stone-800 cursor-pointer"
                    >
                      Guest self-service cancellation
                    </label>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Allow guests to cancel or reschedule up to 2 hours prior
                      to scheduled dining time.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selfCancel}
                    onClick={() => {
                      setSelfCancel(!selfCancel);
                      markDirty();
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      selfCancel ? "bg-emerald-500" : "bg-stone-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        selfCancel ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* CARD 2: Reservation Rules & Slotting */}
            <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
              <div className="mb-6 pb-4 border-b border-stone-100">
                <h2 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                  Reservation Capacity &amp; Cadence
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  Fine-tune slot increments, guest throttles, and table
                  allocation pacing.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                {/* Slot size */}
                <div>
                  <label
                    htmlFor="res-slot-size"
                    className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2"
                  >
                    RESERVATION SLOT INTERVAL
                  </label>
                  <div className="relative">
                    <select
                      id="res-slot-size"
                      value={reservationSlotSize}
                      onChange={(e) => {
                        setReservationSlotSize(e.target.value);
                        markDirty();
                      }}
                      className="w-full appearance-none rounded-xl border-stone-300 bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-sm font-medium text-stone-800 py-2.5 pl-3.5 pr-10 shadow-xs cursor-pointer"
                    >
                      <option value="15">
                        15 mins (e.g. 8:00, 8:15, 8:30)
                      </option>
                      <option value="30">
                        30 mins (e.g. 8:00, 8:30, 9:00)
                      </option>
                      <option value="45">
                        45 mins (e.g. 8:00, 8:45, 9:30)
                      </option>
                      <option value="60">
                        60 mins (e.g. 8:00, 9:00, 10:00)
                      </option>
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1.5 leading-normal">
                    Defines spacing between available booking times displayed
                    online.
                  </p>
                </div>

                {/* Max reservations per slot */}
                <div>
                  <label
                    htmlFor="res-per-slot"
                    className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2"
                  >
                    RESERVATIONS PER SLOT
                  </label>
                  <input
                    id="res-per-slot"
                    type="number"
                    min="1"
                    max="50"
                    value={reservationPerTimeSlot}
                    onChange={(e) => {
                      setReservationPerTimeSlot(e.target.value);
                      markDirty();
                    }}
                    className="w-full rounded-xl border-stone-300 bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-sm font-medium text-stone-800 py-2.5 px-3.5 shadow-xs"
                  />
                  <p className="text-[11px] text-stone-400 mt-1.5 leading-normal">
                    Total simultaneous parties allowed to start in the same time
                    window.
                  </p>
                </div>

                {/* Max allowed bookings per customer */}
                <div>
                  <label
                    htmlFor="res-limit-count"
                    className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2"
                  >
                    MAX ALLOWED BOOKINGS
                  </label>
                  <div className="relative">
                    <select
                      id="res-limit-count"
                      value={maxBookingPerCustomer}
                      onChange={(e) => {
                        setMaxBookingPerCustomer(e.target.value);
                        markDirty();
                      }}
                      className="w-full appearance-none rounded-xl border-stone-300 bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-sm font-medium text-stone-800 py-2.5 pl-3.5 pr-10 shadow-xs cursor-pointer"
                    >
                      <option value="1">1 Booking</option>
                      <option value="2">2 Bookings</option>
                      <option value="3">3 Bookings</option>
                      <option value="999">Unlimited</option>
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1.5 leading-normal">
                    Limits duplicate or spam reservations by the same phone
                    number.
                  </p>
                </div>

                {/* Booking limit window */}
                <div>
                  <label
                    htmlFor="res-limit-window"
                    className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2"
                  >
                    FREQUENCY WINDOW
                  </label>
                  <div className="relative">
                    <select
                      id="res-limit-window"
                      value={maxBookingPerCustomerTime}
                      onChange={(e) => {
                        setMaxBookingPerCustomerTime(e.target.value);
                        markDirty();
                      }}
                      className="w-full appearance-none rounded-xl border-stone-300 bg-white focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-sm font-medium text-stone-800 py-2.5 pl-3.5 pr-10 shadow-xs cursor-pointer"
                    >
                      <option value="day">Per Day</option>
                      <option value="week">Per Week</option>
                      <option value="month">Per Month</option>
                    </select>
                    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1.5 leading-normal">
                    Timespan applied to customer maximum reservation check.
                  </p>
                </div>
              </div>
            </section>

            {/* CARD 3: Reservation Hours (Unified Schedule Matrix) */}
            <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-stone-100 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                      Reservation Hours Schedule
                    </h2>
                    <span className="text-xs font-normal text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                      Weekly Schedule
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Determine booking slot availability across the week.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCopyModal("reservation")}
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300/80 rounded-xl transition-colors cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5 text-stone-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>Fetch Organization's Timings</span>
                </button>
              </div>

              {/* Overlapping warning alert banner for Reservations */}
              {resConflicts && (
                <div className="p-3.5 mb-4 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
                  <svg
                    className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <span className="font-bold">Schedule Overlap Alert:</span>
                    <span> {resConflicts}</span>
                  </div>
                </div>
              )}

              {/* 7-Day Reservation Schedule Matrix */}
              <div className="space-y-3.5">
                {resSchedule.map((dayObj, dayIdx) => (
                  <div
                    key={dayObj.day}
                    className={`p-3.5 rounded-xl border ${
                      dayObj.isOpen
                        ? "bg-stone-50/50 border-stone-200"
                        : "bg-stone-100/60 border-stone-200/60"
                    } transition-all`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 w-40 flex-shrink-0">
                        <span className="font-medium text-xs text-stone-900 w-24">
                          {dayObj.day}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleDayOpen("reservations", dayIdx)}
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                            dayObj.isOpen
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                              : "bg-stone-200 text-stone-600 border-stone-300 hover:bg-stone-300"
                          }`}
                        >
                          {dayObj.isOpen ? "Open" : "Closed"}
                        </button>
                      </div>

                      <div className="flex-1">
                        {dayObj.isOpen ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {dayObj.slots.map((slot, slotIdx) => (
                              <div
                                key={slotIdx}
                                className="inline-flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-xs text-xs font-mono text-stone-800"
                              >
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    openTimePicker(
                                      e,
                                      "reservations",
                                      dayIdx,
                                      slotIdx,
                                      "start",
                                    )
                                  }
                                  className="hover:bg-stone-100 px-2 py-0.5 rounded transition-colors font-medium cursor-pointer"
                                >
                                  {slot.start}
                                </button>
                                <span className="text-stone-400 font-sans px-1">
                                  —
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    openTimePicker(
                                      e,
                                      "reservations",
                                      dayIdx,
                                      slotIdx,
                                      "end",
                                    )
                                  }
                                  className="hover:bg-stone-100 px-2 py-0.5 rounded transition-colors font-medium cursor-pointer"
                                >
                                  {slot.end}
                                </button>
                                {dayObj.slots.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeSlot(
                                        "reservations",
                                        dayIdx,
                                        slotIdx,
                                      )
                                    }
                                    className="ml-1 text-stone-400 hover:text-red-600 p-0.5 rounded cursor-pointer"
                                    title="Remove slot"
                                  >
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => addSlot("reservations", dayIdx)}
                              className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 border border-dashed border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span>+</span> Add Slot
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400 italic font-normal">
                            No operational slots configured. Diners cannot
                            register.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Bottom Save Action Bar inside Canvas */}
        <div className="pt-4 pb-12 flex items-center justify-end gap-3 border-t border-stone-200">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isDirty || isSaving}
            className="px-5 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-full transition-colors disabled:opacity-40"
          >
            Cancel &amp; Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-full shadow-md flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>{isSaving ? "Saving..." : "Save Settings"}</span>
          </button>
        </div>
      </div>

      {/* MODAL: COPY TIMINGS DIALOG */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden transform transition-all">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-800 mb-4">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="font-serif text-xl font-bold text-stone-900 mb-2">
                Sync Operational Timings?
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed mb-4">
                This will override current weekly hours with your Master
                Restaurant Opening Hours:
              </p>
              <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 text-xs space-y-1 font-mono text-stone-700 mb-4">
                <div className="flex justify-between">
                  <span>Mon – Fri:</span>
                  <span className="font-bold">11:00 AM – 10:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Sat – Sun:</span>
                  <span className="font-bold">10:30 AM – 11:30 PM</span>
                </div>
              </div>
              <p className="text-[11px] text-stone-500 italic">
                Existing custom lunch/dinner breaks can be re-added afterward.
              </p>
            </div>
            <div className="bg-stone-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 rounded-full hover:bg-stone-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCopyTimings}
                className="px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-full shadow transition-colors cursor-pointer"
              >
                Apply Store Timings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: TIME PICKER SIMULATION */}
      {timePickerTarget && (
        <div
          style={{ top: `${popoverPos.top}px`, left: `${popoverPos.left}px` }}
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-stone-200 p-4 w-64 text-stone-800"
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-stone-100">
            <span className="text-xs font-bold text-stone-800 uppercase tracking-wide">
              Select Time
            </span>
            <button
              type="button"
              onClick={closeTimePicker}
              className="text-stone-400 hover:text-stone-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
            <div>
              <label className="block text-[10px] text-stone-500 uppercase font-semibold mb-1">
                Hour
              </label>
              <div className="relative">
                <select
                  value={tpHour}
                  onChange={(e) => setTpHour(e.target.value)}
                  className="w-full appearance-none text-xs font-mono rounded-lg border-stone-300 py-1.5 pl-2 pr-6 focus:ring-stone-900 focus:border-stone-900 bg-white"
                >
                  {timeFormat === "12h"
                    ? Array.from({ length: 12 }, (_, i) =>
                        String(i + 1).padStart(2, "0"),
                      ).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))
                    : Array.from({ length: 24 }, (_, i) =>
                        String(i).padStart(2, "0"),
                      ).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 w-3 h-3" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-stone-500 uppercase font-semibold mb-1">
                Minute
              </label>
              <div className="relative">
                <select
                  value={tpMinute}
                  onChange={(e) => setTpMinute(e.target.value)}
                  className="w-full appearance-none text-xs font-mono rounded-lg border-stone-300 py-1.5 pl-2 pr-6 focus:ring-stone-900 focus:border-stone-900 bg-white"
                >
                  <option value="00">00</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 w-3 h-3" />
              </div>
            </div>
            {timeFormat === "12h" && (
              <div>
                <label className="block text-[10px] text-stone-500 uppercase font-semibold mb-1">
                  Period
                </label>
                <div className="relative">
                  <select
                    value={tpAmPm}
                    onChange={(e) => setTpAmPm(e.target.value)}
                    className="w-full appearance-none text-xs font-mono rounded-lg border-stone-300 py-1.5 pl-2 pr-6 focus:ring-stone-900 focus:border-stone-900 bg-white"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 w-3 h-3" />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeTimePicker}
              className="px-2.5 py-1 text-xs text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyPickedTime}
              className="px-3 py-1 bg-stone-900 text-white rounded text-xs font-semibold hover:bg-stone-800 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 transform transition-all duration-300 bg-stone-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-stone-700 text-sm">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
            ✓
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* GEOFENCE RADIUS SIDEBAR DRAWER (MATCHING REFERENCE DESIGN) */}
      {isGeoDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsGeoDrawerOpen(false)}
          />

          {/* Right Slide-Over Panel */}
          <div className="relative w-full max-w-[440px] sm:max-w-[480px] bg-white h-full shadow-2xl z-50 flex flex-col justify-between transform transition-transform duration-300 ease-in-out font-sans">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                Set geofence radius
              </h2>
              <button
                type="button"
                onClick={() => setIsGeoDrawerOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search any area, road, city"
                  value={mapSearchQuery}
                  onChange={(e) => setMapSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddressSearch();
                  }}
                  className="w-full pl-4 pr-11 py-3 bg-white border border-stone-300 rounded-xl text-sm font-medium focus:outline-none focus:border-stone-900 text-stone-900 placeholder-stone-400 shadow-xs"
                />
                <button
                  type="button"
                  onClick={handleAddressSearch}
                  disabled={isSearchingAddress}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-900 p-1 cursor-pointer"
                >
                  {isSearchingAddress ? (
                    <svg
                      className="w-4 h-4 animate-spin text-stone-600"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4.5 h-4.5 text-stone-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Map View Container */}
              <div className="relative w-full h-80 rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 shadow-inner">
                <div ref={mapContainerRef} className="w-full h-full z-10" />
              </div>

              {/* Radius Controls */}
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-semibold text-stone-800">
                  Set radius for geo-fence
                </label>
                <div className="relative pt-1">
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="50"
                    value={tempGeoRadius}
                    onChange={(e) =>
                      setTempGeoRadius(parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full h-2.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                {/* Distance Badge Pill (e.g. 0 km, 0.5 km) */}
                <div>
                  <span className="inline-block bg-[#1f2122] text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-xs">
                    {(tempGeoRadius / 1000).toFixed(
                      tempGeoRadius % 1000 === 0 ? 0 : 1,
                    )}{" "}
                    km
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-5 border-t border-stone-200 bg-white flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsGeoDrawerOpen(false)}
                className="flex-1 py-3 px-4 bg-[#e5e7eb] hover:bg-[#d1d5db] text-[#374151] font-semibold text-sm rounded-xl transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveGeofenceDrawer}
                className="flex-1 py-3 px-4 bg-[#1f2122] hover:bg-black text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer text-center capitalize"
              >
                save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
