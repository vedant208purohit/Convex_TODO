"use client";

import { useEffect, useState, useMemo, useRef, ChangeEvent } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Toast, type ToastMessage, type ToastType } from "./Toast";

type TabType = "details" | "timings" | "taxation" | "country";

interface TimeSlot {
  start_time: string;
  end_time: string;
}

interface DaySchedule {
  is_open: boolean;
  is_open_all_day?: boolean;
  hours: TimeSlot[];
}

type WeeklySchedule = Record<string, DaySchedule>;

interface TaxComponentRow {
  id: string;
  compId?: Id<"taxComponents">;
  name: string;
  code: string;
  rate: string;
}

interface OrgFormData {
  name: string;
  legalEntityName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  zipCode: string;
  state: string;
  country: string;
  organizationTimeZone: string;
  defaultCurrency: string;
  defaultCurrencySymbol: string;
  email: string;
  phoneCountryCode: string;
  phoneNumber: string;
  fax: string;
  logoUrl: string;
  logoStorageId: string;
  logoAssetId?: string;
  schedule: WeeklySchedule;
  isGst: boolean;
  inclusiveGst: boolean;
  gstNumber: string;
  gstDocumentStorageId?: string;
  gstDocumentAssetId?: string;
  isFssai: boolean;
  fssaiRegistrationNumber: string;
  expiryDate: string;
  fssaiDocumentStorageId?: string;
  fssaiDocumentAssetId?: string;
}

import {
  COUNTRIES_MASTER,
  getStatesForCountry,
  getCurrencyForCountry,
  getTimezoneForCountry,
  getTimezonesForCountry,
  getPhoneCodeForCountry,
  TIMEZONE_OPTIONS,
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  PHONE_CODE_OPTIONS,
} from "@/lib/constants/countries";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function EditPencilIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function parseTimeToDayMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const clean = timeStr.trim();
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const isPM = match12[3].toUpperCase() === "PM";
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return h * 60 + m;
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return d.getHours() * 60 + d.getMinutes();
  }
  return 0;
}

function checkScheduleOverlapFrontend(schedule: any): string | null {
  if (!schedule || typeof schedule !== "object") return null;

  for (const day of Object.keys(schedule)) {
    const dayData = schedule[day];
    if (!dayData || !dayData.is_open || !Array.isArray(dayData.hours) || dayData.hours.length <= 1) {
      continue;
    }

    const parsedSlots: Array<{ start: number; end: number; slotIdx: number }> = [];

    for (let idx = 0; idx < dayData.hours.length; idx++) {
      const h = dayData.hours[idx];
      if (!h || !h.start_time || !h.end_time) continue;

      const s = parseTimeToDayMinutes(h.start_time);
      const e = parseTimeToDayMinutes(h.end_time);

      if (e <= s) {
        return `${day}: Slot ${idx + 1} end time (${h.end_time}) must be after start time (${h.start_time}).`;
      }

      parsedSlots.push({ start: s, end: e, slotIdx: idx });
    }

    parsedSlots.sort((a, b) => a.start - b.start);

    for (let i = 0; i < parsedSlots.length - 1; i++) {
      if (parsedSlots[i + 1].start < parsedSlots[i].end) {
        return `${day}: Slot ${parsedSlots[i + 1].slotIdx + 1} overlaps with Slot ${parsedSlots[i].slotIdx + 1}. Please adjust slot times to prevent clashing operational intervals.`;
      }
    }
  }

  return null;
}

function defaultSchedule(): WeeklySchedule {
  const schedule: WeeklySchedule = {};
  DAYS.forEach((day) => {
    schedule[day] = {
      is_open: true,
      is_open_all_day: false,
      hours: [{ start_time: "11:00", end_time: "23:59" }],
    };
  });
  return schedule;
}

function formatTime12h(time24: string): string {
  if (!time24) return "—";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const hDisplay = h < 10 ? `0${h}` : `${h}`;
  return `${hDisplay}:${m} ${ampm}`;
}

export function OrganizationSettings() {
  const organizations = useQuery(api.organizations.list);
  const org = organizations?.[0] ?? null;
  const isLoading = organizations === undefined;

  const updateOrg = useMutation(api.organizations.update);
  const createAssetUpload = useAction(api.r2.createAssetUpload);
  const confirmAssetUpload = useAction(api.r2.confirmAssetUpload);

  // Storage & R2 URL Resolution Query (R2 First, Convex Storage Fallback)
  const logoStorageUrl = useQuery(
    api.organizations.getStorageUrl,
    org?.logoAssetId || org?.logoStorageId
      ? {
          assetId: org.logoAssetId as Id<"organization_assets"> | undefined,
          storageId: org.logoStorageId as Id<"_storage"> | undefined,
          organizationId: org._id,
        }
      : "skip"
  );

  // Real Tax Groups & Components Queries and Mutations from Convex DB
  const dbTaxGroups = useQuery(
    api.taxation.listTaxGroups,
    org?._id ? { organizationId: org._id } : "skip"
  );
  const dbTaxComponents = useQuery(
    api.taxation.listTaxComponents,
    org?._id ? { organizationId: org._id } : "skip"
  );

  const createTaxGroupMutation = useMutation(api.taxation.createTaxGroup);
  const updateTaxGroupMutation = useMutation(api.taxation.updateTaxGroup);
  const createTaxComponentMutation = useMutation(api.taxation.createTaxComponent);
  const updateTaxComponentMutation = useMutation(api.taxation.updateTaxComponent);
  const removeTaxGroupMutation = useMutation(api.taxation.removeTaxGroup);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fssaiFileInputRef = useRef<HTMLInputElement>(null);
  const gstFileInputRef = useRef<HTMLInputElement>(null);
  const taxGroupNameInputRef = useRef<HTMLInputElement>(null);
  const taxCompInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const taxDrawerScrollRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<TabType>("details");

  // Timings Drawer State with Smooth 300ms Slide Transition
  const [isTimingsDrawerOpen, setIsTimingsDrawerOpen] = useState(false);
  const [isTimingsDrawerVisible, setIsTimingsDrawerVisible] = useState(false);

  // Add / Edit Tax Group Drawer State with Smooth 300ms Slide Transition
  const [isTaxGroupDrawerOpen, setIsTaxGroupDrawerOpen] = useState(false);
  const [isTaxGroupDrawerVisible, setIsTaxGroupDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add");
  const [editingGroupId, setEditingGroupId] = useState<Id<"taxGroups"> | null>(null);
  const [taxGroupName, setTaxGroupName] = useState("");
  const [taxGroupMode, setTaxGroupMode] = useState<"Inclusive" | "Exclusive">("Exclusive");
  const [taxComponents, setTaxComponents] = useState<TaxComponentRow[]>([
    { id: "1", name: "", code: "", rate: "" },
  ]);
  const [taxGroupPendingErrors, setTaxGroupPendingErrors] = useState<string[]>([]);
  const [taxGroupPendingFields, setTaxGroupPendingFields] = useState<Record<string, boolean>>({});

  // Popover States for Timings Edit
  const [activeCopyMenu, setActiveCopyMenu] = useState<string | null>(null);
  const [activeDotMenu, setActiveDotMenu] = useState<string | null>(null);
  const [copySelections, setCopySelections] = useState<Record<string, boolean>>({});

  // Baseline state loaded from Convex DB
  const [initialData, setInitialData] = useState<OrgFormData | null>(null);

  // Form State
  const [formData, setFormData] = useState<OrgFormData>({
    name: "",
    legalEntityName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    zipCode: "",
    state: "",
    country: "India",
    organizationTimeZone: "Asia/Kolkata",
    defaultCurrency: "INR",
    defaultCurrencySymbol: "₹",
    email: "",
    phoneCountryCode: "+91",
    phoneNumber: "",
    fax: "",
    logoUrl: "",
    logoStorageId: "",
    logoAssetId: "",
    schedule: defaultSchedule(),
    isGst: false,
    inclusiveGst: false,
    gstNumber: "",
    gstDocumentStorageId: "",
    gstDocumentAssetId: "",
    isFssai: false,
    fssaiRegistrationNumber: "",
    expiryDate: "",
    fssaiDocumentStorageId: "",
    fssaiDocumentAssetId: "",
  });

  // Resolved document storage URLs from R2 / Convex Storage (R2-first fallback)
  const fssaiDocStorageUrl = useQuery(
    api.organizations.getStorageUrl,
    formData.fssaiDocumentAssetId || formData.fssaiDocumentStorageId
      ? {
          assetId: (formData.fssaiDocumentAssetId as Id<"organization_assets">) || undefined,
          storageId: (formData.fssaiDocumentStorageId as Id<"_storage">) || undefined,
          organizationId: org?._id,
        }
      : "skip"
  );

  const gstDocStorageUrl = useQuery(
    api.organizations.getStorageUrl,
    formData.gstDocumentAssetId || formData.gstDocumentStorageId
      ? {
          assetId: (formData.gstDocumentAssetId as Id<"organization_assets">) || undefined,
          storageId: (formData.gstDocumentStorageId as Id<"_storage">) || undefined,
          organizationId: org?._id,
        }
      : "skip"
  );

  // Action / Feedback States
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFssaiDoc, setIsUploadingFssaiDoc] = useState(false);
  const [isUploadingGstDoc, setIsUploadingGstDoc] = useState(false);

  // Standard Notification Toast State (matching Menu page)
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (message: string, type: ToastType = "success", subtext?: string) => {
    setToast({ message, type, subtext });
  };
  const setSuccessMessage = (msg: string | null) => {
    if (msg) showToast(msg, "success");
    else setToast(null);
  };
  const setErrorMessage = (msg: string | null) => {
    if (msg) showToast(msg, "error");
    else setToast(null);
  };

  // Load Convex DB document into initialData & formData
  useEffect(() => {
    if (!org) return;

    let code = org.country ? getPhoneCodeForCountry(org.country) : "+91";
    let num = (org.phone || "").trim();
    if (num.startsWith("+")) {
      const match = PHONE_CODE_OPTIONS.find((opt) => num.startsWith(opt.code));
      if (match) {
        code = match.code;
        num = num.slice(match.code.length).trim();
      }
    }

    const loadedSchedule = defaultSchedule();
    if (org.operationTiming && typeof org.operationTiming === "object") {
      Object.keys(org.operationTiming).forEach((dayKey) => {
        const normalizedDay = DAYS.find((d) => d.toLowerCase() === dayKey.toLowerCase());
        if (normalizedDay) {
          const val = org.operationTiming[dayKey];
          if (val && typeof val === "object") {
            loadedSchedule[normalizedDay] = {
              is_open: val.is_open ?? val.active ?? true,
              is_open_all_day: val.is_open_all_day ?? false,
              hours: Array.isArray(val.hours)
                ? val.hours
                : [{ start_time: val.open || "11:00", end_time: val.close || "23:59" }],
            };
          }
        }
      });
    }

    let expDateStr = "";
    if (org.expiryDate) {
      const d = new Date(org.expiryDate);
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        expDateStr = `${y}-${m}-${day}`;
      }
    }

    const loaded: OrgFormData = {
      name: org.name || "",
      legalEntityName: org.legalEntityName || "",
      addressLine1: org.addressLine1 || "",
      addressLine2: org.addressLine2 || "",
      city: org.city || "",
      zipCode: org.zipCode || "",
      state: org.state || "",
      country: org.country || "India",
      organizationTimeZone: org.organizationTimeZone || "Asia/Kolkata",
      defaultCurrency: org.defaultCurrency || (org.country ? getCurrencyForCountry(org.country).code : "USD"),
      defaultCurrencySymbol: org.defaultCurrencySymbol || (org.country ? getCurrencyForCountry(org.country).symbol : "$"),
      email: org.email || "",
      phoneCountryCode: code,
      phoneNumber: num,
      fax: org.fax || "",
      logoUrl: (org as any).logoUrl || "",
      logoStorageId: (org as any).logoStorageId || "",
      logoAssetId: (org as any).logoAssetId || "",
      schedule: loadedSchedule,
      isGst: org.isGst ?? false,
      inclusiveGst: org.inclusiveGst ?? false,
      gstNumber: org.gstNumber || "",
      gstDocumentStorageId: (org as any).gstDocumentStorageId || "",
      gstDocumentAssetId: (org as any).gstDocumentAssetId || "",
      isFssai: org.isFssai ?? false,
      fssaiRegistrationNumber: org.fssaiRegistrationNumber || "",
      expiryDate: expDateStr,
      fssaiDocumentStorageId: (org as any).fssaiDocumentStorageId || "",
      fssaiDocumentAssetId: (org as any).fssaiDocumentAssetId || "",
    };

    setInitialData(loaded);
    setFormData(loaded);
  }, [org]);

  // Compute resolved display logo URL (either direct logoUrl, R2 signed URL or generated storage URL)
  const displayLogoUrl = useMemo(() => {
    if (formData.logoUrl === "" && formData.logoStorageId === "" && !formData.logoAssetId) {
      return "";
    }
    return formData.logoUrl || logoStorageUrl || "";
  }, [formData.logoUrl, formData.logoStorageId, formData.logoAssetId, logoStorageUrl]);

  // Map Convex DB Tax Components for display lookup
  const taxComponentMap = useMemo(() => {
    const map = new Map<string, { compId: Id<"taxComponents">; name: string; code?: string; rate: number }>();
    if (dbTaxComponents) {
      dbTaxComponents.forEach((comp) => {
        map.set(comp._id, { compId: comp._id, name: comp.name, code: comp.code, rate: comp.rate });
      });
    }
    return map;
  }, [dbTaxComponents]);

  // Total Tax Rate calculation for Tax Group drawer
  const totalTaxRate = useMemo(() => {
    return taxComponents.reduce((sum, comp) => {
      const val = parseFloat(comp.rate);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [taxComponents]);

  // Determine if form has changes (isDirty)
  const isDirty = useMemo(() => {
    if (!initialData) return false;
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, initialData]);

  const updateField = <K extends keyof OrgFormData>(field: K, value: OrgFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (initialData) {
      setFormData(initialData);
    }
  };

  // Timings Drawer Smooth Open & Close Handlers
  const handleOpenTimingsDrawer = () => {
    setIsTimingsDrawerOpen(true);
    setTimeout(() => setIsTimingsDrawerVisible(true), 20);
  };

  const handleCloseTimingsDrawer = () => {
    setIsTimingsDrawerVisible(false);
    setTimeout(() => setIsTimingsDrawerOpen(false), 300);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".copy-popover-container") && !target.closest(".dot-popover-container")) {
        setActiveCopyMenu(null);
        setActiveDotMenu(null);
      }
    };
    if (activeCopyMenu || activeDotMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeCopyMenu, activeDotMenu]);

  const handleCopyDaySchedule = (sourceDay: string) => {
    setActiveCopyMenu(sourceDay);
    setActiveDotMenu(null);
    const initialSelections: Record<string, boolean> = {};
    DAYS.forEach((d) => {
      initialSelections[d] = false;
    });
    setCopySelections(initialSelections);
  };

  const handleApplyCopy = (sourceDay: string) => {
    const source = formData.schedule[sourceDay];
    if (!source) return;

    const updatedSchedule = { ...formData.schedule };
    let copiedCount = 0;
    DAYS.forEach((day) => {
      if (copySelections[day] && day !== sourceDay) {
        updatedSchedule[day] = {
          is_open: source.is_open,
          is_open_all_day: source.is_open_all_day,
          hours: source.hours.map((h) => ({ ...h })),
        };
        copiedCount++;
      }
    });

    if (copiedCount > 0) {
      updateField("schedule", updatedSchedule);
      setSuccessMessage(`Copied ${sourceDay}'s timings to ${copiedCount} day(s).`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
    setActiveCopyMenu(null);
  };

  const handleToggleDotMenu = (day: string) => {
    setActiveDotMenu(activeDotMenu === day ? null : day);
    setActiveCopyMenu(null);
  };

  const handleDayStatusChange = (day: string, status: "open_all" | "open_part" | "closed") => {
    const current = formData.schedule[day] || { is_open: true, is_open_all_day: false, hours: [] };
    const newConfig = { ...current };

    if (status === "open_all") {
      newConfig.is_open = true;
      newConfig.is_open_all_day = true;
    } else if (status === "open_part") {
      newConfig.is_open = true;
      newConfig.is_open_all_day = false;
      if (newConfig.hours.length === 0) {
        newConfig.hours = [{ start_time: "11:00", end_time: "23:59" }];
      }
    } else {
      newConfig.is_open = false;
    }

    updateField("schedule", { ...formData.schedule, [day]: newConfig });
    setActiveDotMenu(null);
  };

  const handleAddTimeSlot = (day: string) => {
    const current = formData.schedule[day] || { is_open: true, is_open_all_day: false, hours: [] };
    const newHours = [...current.hours, { start_time: "11:00", end_time: "23:59" }];
    updateField("schedule", {
      ...formData.schedule,
      [day]: { ...current, hours: newHours, is_open: true, is_open_all_day: false },
    });
    setActiveDotMenu(null);
  };

  // Tax Group Drawer Smooth Open & Close Handlers
  const handleOpenAddTaxGroup = () => {
    setDrawerMode("add");
    setEditingGroupId(null);
    setTaxGroupName("");
    setTaxGroupMode(formData.inclusiveGst ? "Inclusive" : "Exclusive");
    setTaxComponents([{ id: "1", name: "", code: "", rate: "" }]);
    setTaxGroupPendingErrors([]);
    setTaxGroupPendingFields({});
    setIsTaxGroupDrawerOpen(true);
    setTimeout(() => setIsTaxGroupDrawerVisible(true), 20);
  };

  const handleOpenEditTaxGroup = (
    name: string,
    comps: { compId?: Id<"taxComponents">; name: string; code: string; rate: string }[],
    groupId?: Id<"taxGroups">
  ) => {
    setDrawerMode("edit");
    setEditingGroupId(groupId ?? null);
    setTaxGroupName(name);
    setTaxGroupMode(formData.inclusiveGst ? "Inclusive" : "Exclusive");
    setTaxComponents(
      comps.map((c, i) => ({
        id: c.compId ? c.compId : (i + 1).toString(),
        compId: c.compId,
        name: c.name,
        code: c.code,
        rate: c.rate,
      }))
    );
    setTaxGroupPendingErrors([]);
    setTaxGroupPendingFields({});
    setIsTaxGroupDrawerOpen(true);
    setTimeout(() => setIsTaxGroupDrawerVisible(true), 20);
  };

  const handleDeleteTaxGroup = async (groupId?: Id<"taxGroups">, groupName?: string) => {
    if (groupId) {
      try {
        await removeTaxGroupMutation({ id: groupId });
        setSuccessMessage(`Tax group "${groupName || ''}" deleted successfully.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to delete tax group.");
        setTimeout(() => setErrorMessage(null), 4000);
      }
    }
  };

  const handleCloseTaxGroupDrawer = () => {
    setTaxGroupPendingErrors([]);
    setTaxGroupPendingFields({});
    setIsTaxGroupDrawerVisible(false);
    setTimeout(() => setIsTaxGroupDrawerOpen(false), 300);
  };

  // Add component row to Tax Group drawer
  const handleAddComponentRow = () => {
    setTaxComponents((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", code: "", rate: "" },
    ]);
  };

  // Remove component row from Tax Group drawer
  const handleRemoveComponentRow = (id: string) => {
    if (taxComponents.length === 1) return;
    delete taxCompInputRefs.current[`comp_name_${id}`];
    delete taxCompInputRefs.current[`comp_code_${id}`];
    delete taxCompInputRefs.current[`comp_rate_${id}`];
    setTaxGroupPendingFields((prev) => {
      const copy = { ...prev };
      delete copy[`comp_name_${id}`];
      delete copy[`comp_code_${id}`];
      delete copy[`comp_rate_${id}`];
      return copy;
    });
    setTaxComponents((prev) => prev.filter((c) => c.id !== id));
  };

  // Update component row field
  const handleUpdateComponentRow = (id: string, field: keyof TaxComponentRow, value: string) => {
    setTaxComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
    const key =
      field === "name"
        ? `comp_name_${id}`
        : field === "code"
        ? `comp_code_${id}`
        : field === "rate"
        ? `comp_rate_${id}`
        : null;
    if (key && taxGroupPendingFields[key]) {
      setTaxGroupPendingFields((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      setTaxGroupPendingErrors((prev) =>
        prev.filter((msg) =>
          !msg.toLowerCase().includes(field === "name" ? "component" : field === "code" ? "code" : "rate")
        )
      );
    }
  };

  // Save Tax Group directly into Convex Database (`taxComponents` and `taxGroups` tables)
  const handleSaveTaxGroup = async () => {
    const errors: string[] = [];
    const pending: Record<string, boolean> = {};

    if (!taxGroupName.trim()) {
      errors.push("Tax Group Name is required.");
      pending["taxGroupName"] = true;
    }

    if (taxComponents.length === 0) {
      errors.push("At least one Tax Component is required.");
    } else {
      taxComponents.forEach((comp, idx) => {
        const rowNum = idx + 1;
        if (!comp.name.trim()) {
          errors.push(`Tax Component #${rowNum} Name is required.`);
          pending[`comp_name_${comp.id}`] = true;
        }
        if (!comp.code.trim()) {
          errors.push(`Tax Component #${rowNum} Code is required.`);
          pending[`comp_code_${comp.id}`] = true;
        }
        if (comp.rate === "" || isNaN(parseFloat(comp.rate)) || parseFloat(comp.rate) < 0) {
          errors.push(`Tax Component #${rowNum} Rate must be a valid non-negative number.`);
          pending[`comp_rate_${comp.id}`] = true;
        }
      });
    }

    if (errors.length > 0) {
      setTaxGroupPendingErrors(errors);
      setTaxGroupPendingFields(pending);

      setTimeout(() => {
        if (pending["taxGroupName"] && taxGroupNameInputRef.current) {
          taxGroupNameInputRef.current.focus();
          taxGroupNameInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          const firstCompId = taxComponents.find(
            (c) => pending[`comp_name_${c.id}`] || pending[`comp_code_${c.id}`] || pending[`comp_rate_${c.id}`]
          )?.id;
          if (firstCompId) {
            const targetKey = pending[`comp_name_${firstCompId}`]
              ? `comp_name_${firstCompId}`
              : pending[`comp_code_${firstCompId}`]
              ? `comp_code_${firstCompId}`
              : `comp_rate_${firstCompId}`;
            const el = taxCompInputRefs.current[targetKey];
            if (el) {
              el.focus();
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        }
      }, 50);
      return;
    }

    setTaxGroupPendingErrors([]);
    setTaxGroupPendingFields({});

    if (!org?._id) {
      setErrorMessage("No organization context found.");
      return;
    }

    setIsSaving(true);
    try {
      const finalCompIds: Id<"taxComponents">[] = [];

      for (const comp of taxComponents) {
        if (comp.name.trim() && comp.rate !== "") {
          const rateVal = parseFloat(comp.rate);
          const numericRate = isNaN(rateVal) ? 0 : rateVal;

          if (comp.compId) {
            // Update existing tax component in Convex DB
            await updateTaxComponentMutation({
              id: comp.compId,
              name: comp.name.trim(),
              rate: numericRate,
              code: comp.code.trim() || undefined,
            });
            finalCompIds.push(comp.compId);
          } else {
            // Create new tax component in Convex DB
            const newCompId = await createTaxComponentMutation({
              organizationId: org._id,
              name: comp.name.trim(),
              rate: numericRate,
              code: comp.code.trim() || undefined,
            });
            finalCompIds.push(newCompId);
          }
        }
      }

      if (drawerMode === "edit" && editingGroupId) {
        // Update existing tax group in Convex DB
        await updateTaxGroupMutation({
          id: editingGroupId,
          name: taxGroupName.trim(),
          taxMode: taxGroupMode === "Inclusive" ? "inclusive" : "exclusive",
          componentIds: finalCompIds,
        });
        setSuccessMessage(`Tax Group "${taxGroupName.trim()}" (${totalTaxRate.toFixed(1)}%) updated successfully.`);
      } else {
        // Create new tax group in Convex DB
        await createTaxGroupMutation({
          organizationId: org._id,
          name: taxGroupName.trim(),
          taxMode: taxGroupMode === "Inclusive" ? "inclusive" : "exclusive",
          componentIds: finalCompIds,
        });

        const actionText = drawerMode === "add" ? "created" : "updated";
        setSuccessMessage(`Tax Group "${taxGroupName.trim()}" (${totalTaxRate.toFixed(1)}%) ${actionText} successfully.`);
      }

      handleCloseTaxGroupDrawer();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to save Tax Group.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!org?._id) {
      setErrorMessage("Organization not found. Please refresh the page.");
      return;
    }

    setErrorMessage(null);
    setIsUploadingLogo(true);

    try {
      // 1. Create asset upload in R2 (inserts pending record in organization_assets)
      const uploadResult = await createAssetUpload({
        assetType: "logo",
        fileName: file.name,
        contentType: file.type || "image/png",
        fileSize: file.size,
        organizationId: org._id,
      });

      // 2. Direct HTTP PUT to Cloudflare R2 presigned URL
      const putResult = await fetch(uploadResult.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/png" },
        body: file,
      });

      if (!putResult.ok) {
        throw new Error(`Failed to upload logo binary to R2 (Status: ${putResult.status})`);
      }

      // 3. Confirm asset upload in organization_assets (marks status = "uploaded")
      await confirmAssetUpload({
        assetId: uploadResult.assetId,
      });

      // 4. Link logoAssetId to organization record in Convex DB
      await updateOrg({
        id: org._id,
        logoAssetId: uploadResult.assetId,
      });

      // 5. Update local preview and state
      const localPreviewUrl = URL.createObjectURL(file);
      setFormData((prev) => ({
        ...prev,
        logoAssetId: uploadResult.assetId,
        logoUrl: localPreviewUrl,
      }));

      setSuccessMessage("Organization logo uploaded and saved successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to upload organization logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (org?._id) {
      try {
        await updateOrg({
          id: org._id,
          logoUrl: "",
          logoStorageId: "",
          logoAssetId: "",
        });
        setFormData((prev) => ({
          ...prev,
          logoUrl: "",
          logoStorageId: "",
          logoAssetId: "",
        }));
        setSuccessMessage("Organization logo removed successfully.");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to remove organization logo.");
      }
    }
  };

  const handleFssaiDocumentUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setErrorMessage("Invalid file format. Only JPG, JPEG, PNG and PDF files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File size exceeds 10MB limit.");
      return;
    }

    if (!org?._id) {
      setErrorMessage("Organization not found. Please refresh the page.");
      return;
    }

    setErrorMessage(null);
    setIsUploadingFssaiDoc(true);

    try {
      // 1. Create asset upload in R2 (inserts pending record in organization_assets)
      const uploadResult = await createAssetUpload({
        assetType: "document",
        fileName: file.name,
        contentType: file.type || "application/pdf",
        fileSize: file.size,
        organizationId: org._id,
      });

      // 2. Direct HTTP PUT to Cloudflare R2 presigned URL
      const putResult = await fetch(uploadResult.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });

      if (!putResult.ok) {
        throw new Error(`Failed to upload FSSAI document binary to R2 (Status: ${putResult.status})`);
      }

      // 3. Confirm asset upload in organization_assets (marks status = "uploaded")
      await confirmAssetUpload({
        assetId: uploadResult.assetId,
      });

      // 4. Link fssaiDocumentAssetId to organization record in Convex DB
      await updateOrg({
        id: org._id,
        fssaiDocumentAssetId: uploadResult.assetId,
      });

      // 5. Update local state
      setFormData((prev) => ({
        ...prev,
        fssaiDocumentAssetId: uploadResult.assetId,
      }));
      setSuccessMessage("FSSAI document uploaded successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to upload FSSAI document.");
    } finally {
      setIsUploadingFssaiDoc(false);
    }
  };

  const handleGstDocumentUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setErrorMessage("Invalid file format. Only JPG, JPEG, PNG and PDF files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File size exceeds 10MB limit.");
      return;
    }

    if (!org?._id) {
      setErrorMessage("Organization not found. Please refresh the page.");
      return;
    }

    setErrorMessage(null);
    setIsUploadingGstDoc(true);

    try {
      // 1. Create asset upload in R2 (inserts pending record in organization_assets)
      const uploadResult = await createAssetUpload({
        assetType: "document",
        fileName: file.name,
        contentType: file.type || "application/pdf",
        fileSize: file.size,
        organizationId: org._id,
      });

      // 2. Direct HTTP PUT to Cloudflare R2 presigned URL
      const putResult = await fetch(uploadResult.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });

      if (!putResult.ok) {
        throw new Error(`Failed to upload GST document binary to R2 (Status: ${putResult.status})`);
      }

      // 3. Confirm asset upload in organization_assets (marks status = "uploaded")
      await confirmAssetUpload({
        assetId: uploadResult.assetId,
      });

      // 4. Link gstDocumentAssetId to organization record in Convex DB
      await updateOrg({
        id: org._id,
        gstDocumentAssetId: uploadResult.assetId,
      });

      // 5. Update local state
      setFormData((prev) => ({
        ...prev,
        gstDocumentAssetId: uploadResult.assetId,
      }));
      setSuccessMessage("GST document uploaded successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to upload GST document.");
    } finally {
      setIsUploadingGstDoc(false);
    }
  };

  const handleRemoveFssaiDocument = async () => {
    setFormData((prev) => ({ ...prev, fssaiDocumentStorageId: "", fssaiDocumentAssetId: "" }));
    if (fssaiFileInputRef.current) fssaiFileInputRef.current.value = "";

    if (org?._id) {
      try {
        await updateOrg({
          id: org._id,
          fssaiDocumentUrl: "",
          fssaiDocumentAssetId: "",
          fssaiDocumentStorageId: "",
        });
        setSuccessMessage("FSSAI document removed successfully.");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to remove FSSAI document.");
      }
    }
  };

  const handleRemoveGstDocument = async () => {
    setFormData((prev) => ({ ...prev, gstDocumentStorageId: "", gstDocumentAssetId: "" }));
    if (gstFileInputRef.current) gstFileInputRef.current.value = "";

    if (org?._id) {
      try {
        await updateOrg({
          id: org._id,
          gstDocumentUrl: "",
          gstDocumentAssetId: "",
          gstDocumentStorageId: "",
        });
        setSuccessMessage("GST document removed successfully.");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to remove GST document.");
      }
    }
  };

  const handleSave = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!org?._id) {
      setErrorMessage("No organization context found.");
      return;
    }

    if (!formData.name.trim()) {
      setErrorMessage("Organization Name is required.");
      return;
    }

    const scheduleConflict = checkScheduleOverlapFrontend(formData.schedule);
    if (scheduleConflict) {
      setErrorMessage(`Schedule Conflict: ${scheduleConflict}`);
      return;
    }

    setIsSaving(true);

    try {
      const fullPhone = formData.phoneNumber.trim()
        ? `${formData.phoneCountryCode}${formData.phoneNumber.trim().replace(/\D/g, "")}`
        : undefined;

      const currMatch = CURRENCY_OPTIONS.find((c) => c.currency === formData.defaultCurrency);
      const symbol = currMatch?.symbol || formData.defaultCurrencySymbol;

      let parsedExpiryDate: number | undefined = undefined;
      if (formData.isFssai && formData.expiryDate) {
        const parts = formData.expiryDate.split("-").map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          parsedExpiryDate = Date.UTC(parts[0], parts[1] - 1, parts[2]);
        }
      }

      const updatePayload: Record<string, any> = {
        id: org._id,
        name: formData.name.trim(),
        operationTiming: formData.schedule,
        isGst: formData.isGst,
        inclusiveGst: formData.inclusiveGst,
        separateGst: !formData.inclusiveGst,
        gstNumber: formData.isGst && formData.gstNumber.trim() ? formData.gstNumber.trim() : undefined,
        isFssai: formData.isFssai,
        fssaiRegistrationNumber: formData.isFssai && formData.fssaiRegistrationNumber.trim() ? formData.fssaiRegistrationNumber.trim() : undefined,
        expiryDate: formData.isFssai ? parsedExpiryDate : undefined,
      };

      if (formData.isGst) {
        if (formData.gstDocumentAssetId && formData.gstDocumentAssetId.trim()) {
          updatePayload.gstDocumentAssetId = formData.gstDocumentAssetId.trim();
        } else if (formData.gstDocumentStorageId && formData.gstDocumentStorageId.trim()) {
          updatePayload.gstDocumentStorageId = formData.gstDocumentStorageId.trim();
        } else if ((org as any)?.gstDocumentAssetId || (org as any)?.gstDocumentStorageId || (org as any)?.gstDocumentUrl) {
          updatePayload.gstDocumentUrl = "";
          updatePayload.gstDocumentAssetId = "";
          updatePayload.gstDocumentStorageId = "";
        }
      } else if ((org as any)?.gstDocumentAssetId || (org as any)?.gstDocumentStorageId || (org as any)?.gstDocumentUrl) {
        updatePayload.gstDocumentUrl = "";
        updatePayload.gstDocumentAssetId = "";
        updatePayload.gstDocumentStorageId = "";
      }

      if (formData.isFssai) {
        if (formData.fssaiDocumentAssetId && formData.fssaiDocumentAssetId.trim()) {
          updatePayload.fssaiDocumentAssetId = formData.fssaiDocumentAssetId.trim();
        } else if (formData.fssaiDocumentStorageId && formData.fssaiDocumentStorageId.trim()) {
          updatePayload.fssaiDocumentStorageId = formData.fssaiDocumentStorageId.trim();
        } else if ((org as any)?.fssaiDocumentAssetId || (org as any)?.fssaiDocumentStorageId || (org as any)?.fssaiDocumentUrl) {
          updatePayload.fssaiDocumentUrl = "";
          updatePayload.fssaiDocumentAssetId = "";
          updatePayload.fssaiDocumentStorageId = "";
        }
      } else if ((org as any)?.fssaiDocumentAssetId || (org as any)?.fssaiDocumentStorageId || (org as any)?.fssaiDocumentUrl) {
        updatePayload.fssaiDocumentUrl = "";
        updatePayload.fssaiDocumentAssetId = "";
        updatePayload.fssaiDocumentStorageId = "";
      }

      if (formData.legalEntityName.trim()) updatePayload.legalEntityName = formData.legalEntityName.trim();
      if (formData.addressLine1.trim()) updatePayload.addressLine1 = formData.addressLine1.trim();
      if (formData.addressLine2.trim()) updatePayload.addressLine2 = formData.addressLine2.trim();
      if (formData.city.trim()) updatePayload.city = formData.city.trim();
      if (formData.zipCode.trim()) updatePayload.zipCode = formData.zipCode.trim();
      if (formData.state.trim()) updatePayload.state = formData.state.trim();
      if (formData.country) updatePayload.country = formData.country;
      if (formData.organizationTimeZone) updatePayload.organizationTimeZone = formData.organizationTimeZone;
      if (formData.defaultCurrency) updatePayload.defaultCurrency = formData.defaultCurrency;
      if (symbol) updatePayload.defaultCurrencySymbol = symbol;
      if (formData.email.trim()) updatePayload.email = formData.email.trim();
      updatePayload.phone = fullPhone || "";
      if (formData.fax.trim()) updatePayload.fax = formData.fax.trim();
      if (formData.logoAssetId) {
        updatePayload.logoAssetId = formData.logoAssetId;
      } else if (formData.logoStorageId) {
        updatePayload.logoStorageId = formData.logoStorageId;
      } else if (formData.logoUrl) {
        updatePayload.logoUrl = formData.logoUrl;
      } else {
        updatePayload.logoUrl = "";
      }

      await updateOrg(updatePayload as any);

      setSuccessMessage("Organization settings updated successfully!");
      if (isTimingsDrawerOpen) handleCloseTimingsDrawer();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update organization settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#6f655e]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#191513] border-t-transparent"></div>
          <span className="text-sm font-medium">Loading organization details...</span>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="rounded-3xl border border-[#eadfd6] bg-white p-10 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-[#1f1a17]">No Organization Found</h2>
        <p className="mt-2 text-sm text-[#6f655e]">
          Please initialize or select an organization to view settings.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans">
      {/* Sticky / Fixed Top Header (Title + Subtitle + Sub-Nav Tabs) */}
      <div className="shrink-0 space-y-2 bg-[#fdf8f7] pb-1 border-b border-[#e7e5e4]">
        <h1 className="font-garamond text-[30px] font-normal tracking-tight text-[#141010] leading-none">
          {activeTab === "timings"
            ? "Operational Timings"
            : activeTab === "taxation"
            ? "Taxation"
            : activeTab === "country"
            ? "Country Requirements"
            : "Restaurant Details"}
        </h1>
        <p className="font-sans text-sm text-[#5e5e5e] mt-1.5 leading-normal">
          {activeTab === "timings"
            ? "Set your restaurant's opening hours for each day."
            : activeTab === "taxation"
            ? "Manage the taxes applied to your restaurant orders. Configure tax groups and their component rates below."
            : activeTab === "country"
            ? "Add the registration details required for your restaurant."
            : "Add your restaurant's basic information, location and contact details."}
        </p>

        {/* Sub-Navigation Tabs */}
        <nav className="mt-2.5 flex font-sans">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`pb-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "details"
                ? "border-b-2 border-[#141010] text-[#141010]"
                : "border-b-2 border-transparent text-[#5e5e5e] hover:text-[#141010]"
            }`}
          >
            Restaurant Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("timings")}
            className={`ml-6 pb-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "timings"
                ? "border-b-2 border-[#141010] text-[#141010]"
                : "border-b-2 border-transparent text-[#5e5e5e] hover:text-[#141010]"
            }`}
          >
            Operational Timings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("taxation")}
            className={`ml-6 pb-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "taxation"
                ? "border-b-2 border-[#141010] text-[#141010]"
                : "border-b-2 border-transparent text-[#5e5e5e] hover:text-[#141010]"
            }`}
          >
            Taxation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("country")}
            className={`ml-6 pb-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "country"
                ? "border-b-2 border-[#141010] text-[#141010]"
                : "border-b-2 border-transparent text-[#5e5e5e] hover:text-[#141010]"
            }`}
          >
            Country Requirements
          </button>
        </nav>
      </div>

      {/* Scrollable Form & Content Area */}
      <div className="flex-1 overflow-y-auto pt-3 space-y-4 pr-1 pb-2">


      {/* TAB 1: RESTAURANT DETAILS */}
      {activeTab === "details" && (
        <div className="space-y-4">

          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-base font-medium text-[#1f1a17]">Basic Information</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
              <div className="md:col-span-4">
                <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-[#eadfd6] bg-white p-6 text-center shadow-sm">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#d1c4c1] bg-[#fdf8f7] transition hover:bg-[#f3eeea]"
                  >
                    {isUploadingLogo ? (
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#191513] border-t-transparent" />
                    ) : displayLogoUrl ? (
                      <img src={displayLogoUrl} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-3xl text-[#8a7e75]">🏪</span>
                    )}
                  </div>
                  <p className="mt-4 text-sm font-medium text-[#1f1a17]">Organization Logo</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#eadfd6] bg-[#fcf8f6] px-2.5 py-1 text-xs font-medium text-[#1f1a17] transition hover:border-[#1f1a17] hover:bg-[#f3eeea] cursor-pointer"
                    >
                      <EditPencilIcon className="w-3.5 h-3.5 text-[#5e5e5e]" />
                      <span>{displayLogoUrl ? "Change" : "Edit"}</span>
                    </button>
                    {displayLogoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-100 cursor-pointer"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-[#eadfd6] bg-white p-6 shadow-sm md:col-span-8">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Enter organization name"
                    className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                    Legal Entity Name
                  </label>
                  <input
                    type="text"
                    value={formData.legalEntityName || ""}
                    onChange={(e) => updateField("legalEntityName", e.target.value)}
                    placeholder="Enter legal entity name"
                    className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Location */}
          <div className="rounded-2xl border border-[#eadfd6] bg-white p-6 shadow-sm">
            <h3 className="text-base font-medium text-[#1f1a17]">Location</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                  Address Line 1*
                </label>
                <input
                  type="text"
                  value={formData.addressLine1 || ""}
                  onChange={(e) => updateField("addressLine1", e.target.value)}
                  placeholder="Enter address line 1"
                  className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={formData.addressLine2 || ""}
                  onChange={(e) => updateField("addressLine2", e.target.value)}
                  placeholder="Suite, floor, etc."
                  className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: City & Region Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[#eadfd6] bg-white p-6 shadow-sm">
              <h3 className="text-base font-medium text-[#1f1a17]">City & Region</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                    City*
                  </label>
                  <input
                    type="text"
                    value={formData.city || ""}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="e.g. London / Ahmedabad / New York"
                    className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                    Zipcode*
                  </label>
                  <input
                    type="text"
                    value={formData.zipCode || ""}
                    onChange={(e) => updateField("zipCode", e.target.value)}
                    placeholder="110001"
                    className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                    State*
                  </label>
                  {(() => {
                    const countryStates = getStatesForCountry(formData.country);
                    if (countryStates && countryStates.length > 0) {
                      return (
                        <select
                          value={formData.state || ""}
                          onChange={(e) => updateField("state", e.target.value)}
                          className="appearance-none mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 pr-10 text-sm text-[#1f1a17] transition focus:border-[#1f1a17] focus:outline-none font-medium cursor-pointer"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236f655e' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: "right 1rem center",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "1.5em 1.5em",
                          }}
                        >
                          <option value="">Select state / province</option>
                          {countryStates.map((s) => (
                            <option key={s.code} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <input
                        type="text"
                        value={formData.state || ""}
                        onChange={(e) => updateField("state", e.target.value)}
                        placeholder="State / Province"
                        className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none"
                      />
                    );
                  })()}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                      Country*
                    </label>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#8a7e75] bg-[#eae4df] px-2 py-0.5 rounded-md">
                      Read-only
                    </span>
                  </div>
                  <select
                    value={formData.country || "India"}
                    disabled
                    style={{
                      backgroundColor: "#f5efeb",
                      color: "#6f655e",
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238a7e75' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: "right 1rem center",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: "1.5em 1.5em"
                    }}
                    className="appearance-none mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#f5efeb] px-4 py-3 pr-10 text-sm text-[#6f655e] cursor-not-allowed opacity-90 font-medium select-none"
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#eadfd6] bg-white p-6 shadow-sm">
              <h3 className="text-base font-medium text-[#1f1a17]">Regional Settings</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                    Timezone
                  </label>
                  {(() => {
                    const countryTimezones = getTimezonesForCountry(formData.country);
                    const options = countryTimezones.length > 0 ? countryTimezones : TIMEZONE_OPTIONS;
                    return (
                      <select
                        value={formData.organizationTimeZone || (options[0]?.value ?? "Asia/Kolkata")}
                        onChange={(e) => updateField("organizationTimeZone", e.target.value)}
                        className="appearance-none mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 pr-10 text-sm text-[#1f1a17] transition focus:border-[#1f1a17] focus:outline-none font-medium cursor-pointer"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236f655e' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: "right 1rem center",
                          backgroundRepeat: "no-repeat",
                          backgroundSize: "1.5em 1.5em"
                        }}
                      >
                        {options.map((tz) => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                      Currency
                    </label>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#8a7e75] bg-[#eae4df] px-2 py-0.5 rounded-md">
                      Read-only
                    </span>
                  </div>
                  <select
                    value={formData.defaultCurrency}
                    disabled
                    style={{
                      backgroundColor: "#f5efeb",
                      color: "#6f655e",
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238a7e75' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: "right 1rem center",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: "1.5em 1.5em"
                    }}
                    className="appearance-none mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#f5efeb] px-4 py-3 pr-10 text-sm text-[#6f655e] cursor-not-allowed opacity-90 font-medium select-none"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.currency} value={c.currency}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Contact Information */}
          <div className="rounded-2xl border border-[#eadfd6] bg-white p-6 shadow-sm">
            <h3 className="text-base font-medium text-[#1f1a17]">Contact Information</h3>
            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="contact@restaurant.com"
                  className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none"
                />
              </div>

              <div className="lg:col-span-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                  Phone Number
                </label>
                <div className="mt-2 flex rounded-xl border border-[#eadfd6] bg-[#fdf8f7] overflow-hidden focus-within:border-[#1f1a17]">
                  <select
                    value={formData.phoneCountryCode}
                    onChange={(e) => updateField("phoneCountryCode", e.target.value)}
                    className="appearance-none border-r border-[#eadfd6] bg-transparent px-3 py-3 pr-8 text-sm text-[#1f1a17] focus:outline-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236f655e' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: "right 0.25rem center",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: "1.25em 1.25em"
                    }}
                  >
                    {PHONE_CODE_OPTIONS.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={formData.phoneNumber || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                      updateField("phoneNumber", val);
                    }}
                    placeholder="9876543210"
                    maxLength={10}
                    className="flex-1 bg-transparent px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                  Fax Number
                </label>
                <input
                  type="number"
                  value={formData.fax || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 15);
                    updateField("fax", val);
                  }}
                  placeholder="Optional"
                  maxLength={15}
                  className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-[#fdf8f7] px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OPERATIONAL TIMINGS */}
      {activeTab === "timings" && (
        <div className="space-y-6">
          <div className="overflow-x-auto rounded-2xl border border-[#eadfd6] bg-white shadow-sm">
            <table className="w-full text-left border-collapse font-sans">
              <thead className="sticky top-0 z-20 bg-[#fcf8f6] shadow-xs">
                <tr className="border-b border-[#eadfd6] bg-[#fcf8f6]">
                  <th className="py-3.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] w-1/4 bg-[#fcf8f6]">
                    Day
                  </th>
                  <th className="py-3.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] w-1/5 bg-[#fcf8f6]">
                    Status
                  </th>
                  <th className="py-3.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] w-2/5 bg-[#fcf8f6]">
                    Opening Hours
                  </th>
                  <th className="py-3.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] text-right w-1/6 bg-[#fcf8f6]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eadfd6]">
                  {/* Render Convex DB Tax Groups */}
                  {dbTaxGroups && dbTaxGroups.length > 0 ? (
                    dbTaxGroups.map((group) => {
                      const comps = group.componentIds
                        .map((id) => taxComponentMap.get(id))
                        .filter((c): c is { compId: Id<"taxComponents">; name: string; code?: string; rate: number } => Boolean(c));
                      const totalRate = comps.reduce((s, c) => s + (c?.rate || 0), 0);

                      return (
                        <tr key={group._id} className="transition hover:bg-[#fdfbf9]">
                          <td className="py-3.5 px-5 text-[13px] font-medium text-[#1f1a17]">
                            {group.name} {group.isDefault ? "(Default)" : ""}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex flex-wrap items-center gap-2">
                              {comps.map((c, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-lg bg-[#f1edec] border border-[#e2dad8] px-2.5 py-1 text-xs font-medium text-[#1f1a17]"
                                >
                                  {c?.name} {c?.rate}%
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-[13px] font-medium text-[#1f1a17]">{totalRate.toFixed(1)}%</td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenEditTaxGroup(
                                    group.name,
                                    comps.map((c) => ({
                                      compId: c.compId,
                                      name: c?.name || "",
                                      code: c?.code || "",
                                      rate: (c?.rate || 0).toString(),
                                    })),
                                    group._id
                                  )
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#eadfd6] bg-[#fcf8f6] text-[#5e5e5e] transition hover:border-[#1f1a17] hover:bg-[#f3eeea] hover:text-[#141010] cursor-pointer"
                                title="Edit Tax Group"
                              >
                                <EditPencilIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTaxGroup(group._id, group.name)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:border-red-300 hover:bg-red-100 hover:text-red-700 cursor-pointer"
                                title="Delete Tax Group"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-[#8c827a]">
                        No taxes configured for this store. Click &quot;+ Add Tax Group&quot; to configure taxation.
                      </td>
                    </tr>
                  )}
                </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT TIMINGS SIDE DRAWER OVERLAY WITH SMOOTH 300ms SLIDE TRANSITION */}
      {isTimingsDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop with fade duration */}
          <div
            onClick={handleCloseTimingsDrawer}
            className={`fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
              isTimingsDrawerVisible ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Right Side Drawer Panel with 300ms slide duration */}
          <aside
            className={`fixed inset-y-0 right-0 z-50 flex max-w-full pl-10 transform transition-transform duration-300 ease-in-out ${
              isTimingsDrawerVisible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="w-screen max-w-md bg-white border-l border-[#eadfd6] shadow-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#eadfd6]">
                <h2 className="text-xl font-semibold text-[#1f1a17] font-sans">Edit timings</h2>
                <button
                  type="button"
                  onClick={handleCloseTimingsDrawer}
                  className="rounded-full p-2 text-[#8a7e75] hover:text-[#1f1a17] hover:bg-[#f3eeea] transition"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {DAYS.map((day) => {
                  const dayConfig = formData.schedule[day] || {
                    is_open: true,
                    is_open_all_day: false,
                    hours: [{ start_time: "11:00", end_time: "23:59" }],
                  };
                  const slot = dayConfig.hours?.[0] || { start_time: "11:00", end_time: "23:59" };

                  return (
                    <div
                      key={day}
                      className="rounded-2xl border border-[#eadfd6] bg-[#fdf8f7] p-5 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between relative">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              updateField("schedule", {
                                ...formData.schedule,
                                [day]: { ...dayConfig, is_open: !dayConfig.is_open },
                              });
                            }}
                            className={`h-6 w-11 rounded-full p-1 transition-colors ${
                              dayConfig.is_open ? "bg-[#1f1a17]" : "bg-[#e7e5e4]"
                            }`}
                          >
                            <div
                              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                                dayConfig.is_open ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span className="text-sm font-semibold text-[#1f1a17] font-sans">{day}</span>
                        </div>

                        <div className="flex items-center gap-1.5 relative copy-popover-container dot-popover-container">
                          <button
                            type="button"
                            onClick={() => activeCopyMenu === day ? setActiveCopyMenu(null) : handleCopyDaySchedule(day)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6f655e] hover:bg-[#f3eeea] hover:text-[#1f1a17] transition"
                            title={`Copy ${day}'s timings`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                          
                          {activeCopyMenu === day && (
                            <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-[#eadfd6] bg-white shadow-xl py-2">
                              <div className="px-4 py-2.5 border-b border-[#eadfd6]">
                                <span className="text-sm font-medium text-[#1f1a17]">Copy time to</span>
                              </div>
                              <div className="py-1">
                                <label className="flex items-center justify-between px-4 py-2 hover:bg-[#fdf8f7] cursor-pointer">
                                  <span className="text-sm font-medium text-[#1f1a17]">Select all</span>
                                  <input
                                    type="checkbox"
                                    checked={DAYS.every(d => d === day || copySelections[d])}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      const newSelections = { ...copySelections };
                                      DAYS.forEach(d => { if (d !== day) newSelections[d] = checked; });
                                      setCopySelections(newSelections);
                                    }}
                                    className="h-4 w-4 rounded border-[#d1c4c1] text-[#191513] focus:ring-[#191513] accent-[#0c0a09]"
                                  />
                                </label>
                                <div className="my-1 border-b border-[#eadfd6]" />
                                {DAYS.map(d => {
                                  const isSource = d === day;
                                  return (
                                    <label key={d} className={`flex items-center justify-between px-4 py-2 hover:bg-[#fdf8f7] ${isSource ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}>
                                      <span className={`text-sm ${isSource ? 'font-medium text-[#1f1a17]' : 'text-[#1f1a17]'}`}>{d}</span>
                                      <input
                                        type="checkbox"
                                        disabled={isSource}
                                        checked={isSource ? true : (copySelections[d] || false)}
                                        onChange={(e) => setCopySelections({ ...copySelections, [d]: e.target.checked })}
                                        className={`h-4 w-4 rounded border-[#d1c4c1] text-[#191513] focus:ring-[#191513] ${isSource ? 'accent-[#8a7e75] cursor-not-allowed' : ''}`}
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                              <div className="px-3 pt-2 pb-1 border-t border-[#eadfd6] mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleApplyCopy(day)}
                                  className="w-full rounded-lg bg-[#191513] py-2 text-sm font-medium text-white transition hover:bg-[#2e2824] shadow-sm"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          )}

                          <button 
                            type="button" 
                            onClick={() => handleToggleDotMenu(day)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6f655e] hover:bg-[#f3eeea] hover:text-[#1f1a17] transition"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                            </svg>
                          </button>

                          {activeDotMenu === day && (
                            <div className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-[#eadfd6] bg-white shadow-xl py-2">
                              <div className="px-2 space-y-1">
                                <label className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#fdf8f7] cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`status-${day}`}
                                    checked={dayConfig.is_open && !dayConfig.is_open_all_day}
                                    onChange={() => handleDayStatusChange(day, "open_part")}
                                    className="h-4 w-4 border-[#d1c4c1] text-[#191513] focus:ring-[#191513]"
                                  />
                                  <span className="text-sm font-medium text-[#1f1a17]">Open part day</span>
                                </label>
                                <label className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#fdf8f7] cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`status-${day}`}
                                    checked={dayConfig.is_open && dayConfig.is_open_all_day}
                                    onChange={() => handleDayStatusChange(day, "open_all")}
                                    className="h-4 w-4 border-[#d1c4c1] text-[#191513] focus:ring-[#191513]"
                                  />
                                  <span className="text-sm font-medium text-[#1f1a17]">Open all day</span>
                                </label>
                                <label className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#fdf8f7] cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`status-${day}`}
                                    checked={!dayConfig.is_open}
                                    onChange={() => handleDayStatusChange(day, "closed")}
                                    className="h-4 w-4 border-[#d1c4c1] text-[#191513] focus:ring-[#191513]"
                                  />
                                  <span className="text-sm font-medium text-[#1f1a17]">Closed all day</span>
                                </label>
                                <div className="my-1 border-t border-[#eadfd6]"></div>
                                <button
                                  type="button"
                                  onClick={() => handleAddTimeSlot(day)}
                                  className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-[#1f1a17] hover:bg-[#fdf8f7] transition"
                                >
                                  Add time slot
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {dayConfig.is_open ? (
                        dayConfig.is_open_all_day ? (
                          <div className="rounded-xl border border-dashed border-[#d1c4c1] p-3 text-center text-xs italic text-[#1e6b37] bg-[#eaf4ed] font-medium">
                            Store Open 24 Hours on {day}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {/* Header labels above time inputs */}
                            <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[#6f655e]">
                              <span className="flex-1">Start date</span>
                              <span className="w-3 shrink-0 text-center"></span>
                              <span className="flex-1">End date</span>
                            </div>

                            {dayConfig.hours.map((slot, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="flex-1 min-w-0 flex items-center justify-between rounded-xl border border-[#eadfd6] bg-white px-2.5 py-2 shadow-sm focus-within:border-[#1f1a17]">
                                  <input
                                    type="time"
                                    value={slot.start_time || "11:00"}
                                    onChange={(e) => {
                                      const newHours = [...dayConfig.hours];
                                      newHours[idx] = { ...slot, start_time: e.target.value };
                                      updateField("schedule", {
                                        ...formData.schedule,
                                        [day]: { ...dayConfig, hours: newHours },
                                      });
                                    }}
                                    className="w-full bg-transparent text-xs sm:text-sm text-[#1f1a17] font-medium focus:outline-none cursor-pointer"
                                  />
                                </div>

                                <span className="text-xs text-[#8a7e75] font-medium shrink-0">—</span>

                                <div className="flex-1 min-w-0 flex items-center justify-between rounded-xl border border-[#eadfd6] bg-white px-2.5 py-2 shadow-sm focus-within:border-[#1f1a17]">
                                  <input
                                    type="time"
                                    value={slot.end_time || "23:59"}
                                    onChange={(e) => {
                                      const newHours = [...dayConfig.hours];
                                      newHours[idx] = { ...slot, end_time: e.target.value };
                                      updateField("schedule", {
                                        ...formData.schedule,
                                        [day]: { ...dayConfig, hours: newHours },
                                      });
                                    }}
                                    className="w-full bg-transparent text-xs sm:text-sm text-[#1f1a17] font-medium focus:outline-none cursor-pointer"
                                  />
                                </div>

                                {dayConfig.hours.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newHours = dayConfig.hours.filter((_, i) => i !== idx);
                                      updateField("schedule", {
                                        ...formData.schedule,
                                        [day]: { ...dayConfig, hours: newHours },
                                      });
                                    }}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#8a7e75] hover:bg-red-50 hover:text-red-600 transition"
                                    title="Remove time slot"
                                  >
                                    ✕
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#d1c4c1] p-3 text-center text-xs italic text-[#8a7e75]">
                          Store Closed on {day}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#eadfd6] bg-[#fdf8f7]">
                <button
                  type="button"
                  onClick={handleCloseTimingsDrawer}
                  className="h-10 rounded-full border border-[#eadfd6] bg-white px-6 text-sm font-medium text-[#1f1a17] transition hover:bg-[#f3eeea]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className="flex h-10 items-center justify-center rounded-full bg-[#191513] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#2e2824] disabled:opacity-40"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* TAB 3: TAXATION */}
      {activeTab === "taxation" && (
        <div className="space-y-4">
          {/* Configured Taxes Card Table */}
          <div className="overflow-hidden rounded-2xl border border-[#eadfd6] bg-white shadow-sm space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-[#1f1a17]">Configured Taxes</h3>
              <button
                type="button"
                onClick={handleOpenAddTaxGroup}
                className="flex h-9 items-center gap-2 rounded-full bg-[#191513] px-4 text-xs font-medium text-white shadow-xs transition hover:bg-[#2e2824] cursor-pointer"
              >
                <span>+</span>
                <span>Add Tax Group</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#eadfd6]">
              <table className="w-full text-left border-collapse font-sans">
                <thead className="sticky top-0 z-20 bg-[#fcf8f6] shadow-xs">
                  <tr className="border-b border-[#eadfd6] bg-[#fcf8f6]">
                    <th className="py-3.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] w-1/4 bg-[#fcf8f6]">
                      TAX NAME
                    </th>
                    <th className="py-3.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] w-2/5 bg-[#fcf8f6]">
                      TAX COMPONENTS
                    </th>
                    <th className="py-3.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] w-1/6 bg-[#fcf8f6]">
                      TOTAL RATE
                    </th>
                    {/* Temporarily disabled MODE column header
                    <th className="py-3.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] w-1/6 bg-[#fcf8f6]">
                      MODE
                    </th>
                    */}
                    <th className="py-3.5 px-5 text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] text-right w-1/12 bg-[#fcf8f6]">
                      ACTION
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eadfd6]">
                  {/* Render Convex DB Tax Groups */}
                  {dbTaxGroups && dbTaxGroups.length > 0 ? (
                    dbTaxGroups.map((group) => {
                      const comps = group.componentIds
                        .map((id) => taxComponentMap.get(id))
                        .filter((c): c is { compId: Id<"taxComponents">; name: string; code?: string; rate: number } => Boolean(c));
                      const totalRate = comps.reduce((s, c) => s + (c?.rate || 0), 0);

                      return (
                        <tr key={group._id} className="transition hover:bg-[#fdfbf9]">
                          <td className="py-3.5 px-5 text-[13px] font-medium text-[#1f1a17]">
                            {group.name} {group.isDefault ? "(Default)" : ""}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex flex-wrap items-center gap-2">
                              {comps.map((c, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-lg bg-[#f1edec] border border-[#e2dad8] px-2.5 py-1 text-xs font-medium text-[#1f1a17]"
                                >
                                  {c?.name} {c?.rate}%
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-[13px] font-medium text-[#1f1a17]">{totalRate.toFixed(1)}%</td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenEditTaxGroup(
                                    group.name,
                                    comps.map((c) => ({
                                      compId: c.compId,
                                      name: c?.name || "",
                                      code: c?.code || "",
                                      rate: (c?.rate || 0).toString(),
                                    })),
                                    group._id
                                  )
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#eadfd6] bg-[#fcf8f6] text-[#5e5e5e] transition hover:border-[#1f1a17] hover:bg-[#f3eeea] hover:text-[#141010] cursor-pointer"
                                title="Edit Tax Group"
                              >
                                <EditPencilIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTaxGroup(group._id, group.name)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:border-red-300 hover:bg-red-100 hover:text-red-700 cursor-pointer"
                                title="Delete Tax Group"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-sm text-[#8c827a]">
                        No taxes configured for this store. Click &quot;+ Add Tax Group&quot; to configure taxation.
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT TAX GROUP SIDE DRAWER OVERLAY WITH SMOOTH 300ms SLIDE TRANSITION */}
      {isTaxGroupDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop with fade duration */}
          <div
            onClick={handleCloseTaxGroupDrawer}
            className={`fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 z-40 ${
              isTaxGroupDrawerVisible ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Right Side Drawer Panel with 300ms slide duration */}
          <aside
            className={`fixed inset-y-0 right-0 z-50 w-full md:w-[540px] bg-white border-l border-[#eadfd6] shadow-2xl flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${
              isTaxGroupDrawerVisible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#eadfd6] bg-[#fcf8f6]">
              <h2 className="text-xl font-semibold text-[#1f1a17] font-sans">
                {drawerMode === "add" ? "Add Tax Group" : "Edit Tax Group"}
              </h2>
              <button
                type="button"
                onClick={handleCloseTaxGroupDrawer}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-[#d1c4c1] text-[#8a7e75] transition hover:bg-[#f3eeea] hover:text-[#1f1a17]"
              >
                ✕
              </button>
            </div>

            {/* Drawer Content (Scrollable) */}
            <div ref={taxDrawerScrollRef} className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* Action Required Banner for Tax Group Drawer */}
              {taxGroupPendingErrors.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm animate-shake mb-4">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">⚠️</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-rose-900">
                        Action Required ({taxGroupPendingErrors.length} pending field{taxGroupPendingErrors.length > 1 ? "s" : ""})
                      </h4>
                      <p className="mt-1 text-xs text-rose-700">
                        Please fill in all required fields before saving:
                      </p>
                      <ul className="mt-2 list-inside list-disc text-xs font-medium text-rose-800 space-y-1">
                        {taxGroupPendingErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 1: Tax Group Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6f655e]">DETAILS</h3>
                
                <div>
                  <label className="block text-sm font-medium text-[#1f1a17]">
                    Tax Group Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    ref={taxGroupNameInputRef}
                    type="text"
                    value={taxGroupName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTaxGroupName(val);
                      if (taxGroupPendingFields["taxGroupName"]) {
                        setTaxGroupPendingFields((prev) => {
                          const copy = { ...prev };
                          delete copy["taxGroupName"];
                          return copy;
                        });
                        setTaxGroupPendingErrors((prev) =>
                          prev.filter((msg) => !msg.toLowerCase().includes("group name"))
                        );
                      }
                    }}
                    placeholder="e.g. GST"
                    style={{ backgroundColor: taxGroupPendingFields["taxGroupName"] ? "#fff5f5" : "#fdf8f7", color: "#1f1a17" }}
                    className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm focus:outline-none transition-all ${
                      taxGroupPendingFields["taxGroupName"]
                        ? "border-rose-500 bg-rose-50/30 ring-2 ring-rose-200 animate-pulse text-[#1f1a17]"
                        : "border-[#eadfd6] bg-[#fdf8f7] text-[#1f1a17] focus:border-[#1f1a17]"
                    }`}
                  />
                  {taxGroupPendingFields["taxGroupName"] && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600">
                      ⚠️ Tax Group Name is required.
                    </p>
                  )}
                </div>
              </div>

              <hr className="border-[#eadfd6]" />

              {/* Section 2: Tax Components */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-[#1f1a17] font-sans">Tax Components</h3>
                  <p className="mt-1 text-xs text-[#6f655e]">
                    Add the individual tax components that make up this tax group.
                  </p>
                </div>

                {/* Component Rows */}
                {taxComponents.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex gap-3 items-start rounded-xl border border-[#eadfd6] bg-[#fbf7f5] p-4"
                  >
                    <div className="flex-1 space-y-1">
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6f655e]">
                        Component Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          taxCompInputRefs.current[`comp_name_${comp.id}`] = el;
                        }}
                        type="text"
                        value={comp.name}
                        onChange={(e) => handleUpdateComponentRow(comp.id, "name", e.target.value)}
                        placeholder="Central GST"
                        style={{ backgroundColor: taxGroupPendingFields[`comp_name_${comp.id}`] ? "#fff5f5" : "#ffffff", color: "#1f1a17" }}
                        className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none transition-all ${
                          taxGroupPendingFields[`comp_name_${comp.id}`]
                            ? "border-rose-500 bg-rose-50/30 ring-2 ring-rose-200 animate-pulse text-[#1f1a17]"
                            : "border-[#eadfd6] bg-white text-[#1f1a17] focus:border-[#1f1a17]"
                        }`}
                      />
                      {taxGroupPendingFields[`comp_name_${comp.id}`] && (
                        <p className="mt-1 text-[10px] font-medium text-rose-600">
                          ⚠️ Component name required.
                        </p>
                      )}
                    </div>

                    <div className="w-1/4 space-y-1">
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6f655e]">
                        Code <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          taxCompInputRefs.current[`comp_code_${comp.id}`] = el;
                        }}
                        type="text"
                        value={comp.code}
                        onChange={(e) => handleUpdateComponentRow(comp.id, "code", e.target.value.toUpperCase())}
                        placeholder="CGST"
                        style={{ backgroundColor: taxGroupPendingFields[`comp_code_${comp.id}`] ? "#fff5f5" : "#ffffff", color: "#1f1a17" }}
                        className={`w-full rounded-lg border px-3 py-2 text-xs uppercase focus:outline-none transition-all ${
                          taxGroupPendingFields[`comp_code_${comp.id}`]
                            ? "border-rose-500 bg-rose-50/30 ring-2 ring-rose-200 animate-pulse text-[#1f1a17]"
                            : "border-[#eadfd6] bg-white text-[#1f1a17] focus:border-[#1f1a17]"
                        }`}
                      />
                      {taxGroupPendingFields[`comp_code_${comp.id}`] && (
                        <p className="mt-1 text-[10px] font-medium text-rose-600">
                          ⚠️ Code required.
                        </p>
                      )}
                    </div>

                    <div className="w-1/4 space-y-1">
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6f655e]">
                        Rate (%) <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          taxCompInputRefs.current[`comp_rate_${comp.id}`] = el;
                        }}
                        type="number"
                        step="0.1"
                        value={comp.rate}
                        onChange={(e) => handleUpdateComponentRow(comp.id, "rate", e.target.value)}
                        placeholder="2.5"
                        style={{ backgroundColor: taxGroupPendingFields[`comp_rate_${comp.id}`] ? "#fff5f5" : "#ffffff", color: "#1f1a17" }}
                        className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none text-right transition-all ${
                          taxGroupPendingFields[`comp_rate_${comp.id}`]
                            ? "border-rose-500 bg-rose-50/30 ring-2 ring-rose-200 animate-pulse text-[#1f1a17]"
                            : "border-[#eadfd6] bg-white text-[#1f1a17] focus:border-[#1f1a17]"
                        }`}
                      />
                      {taxGroupPendingFields[`comp_rate_${comp.id}`] && (
                        <p className="mt-1 text-[10px] font-medium text-rose-600 text-right">
                          ⚠️ Rate required.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveComponentRow(comp.id)}
                      className="flex h-9 w-9 items-center justify-center rounded border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 transition mt-5 shrink-0 cursor-pointer"
                      title="Remove component"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddComponentRow}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1f1a17] hover:text-[#8c4a3b] transition"
                >
                  <span>+</span>
                  <span>Add Component</span>
                </button>
              </div>

              <hr className="border-[#eadfd6]" />

              {/* Section 3: Tax Breakdown (Summary) */}
              <div className="space-y-3">
                <div className="rounded-xl border border-[#eadfd6] bg-[#f5f1ee] p-5 space-y-3">
                  <h4 className="text-sm font-medium text-[#1f1a17]">Tax Breakdown</h4>

                  {taxComponents.filter((c) => c.name.trim() || c.rate).length > 0 ? (
                    <div className="space-y-2">
                      {taxComponents
                        .filter((c) => c.name.trim() || c.rate)
                        .map((c) => (
                          <div key={c.id} className="flex items-center justify-between text-xs text-[#6f655e]">
                            <span>
                              {c.name || "Component"} {c.code ? `(${c.code})` : ""}
                            </span>
                            <span className="font-medium text-[#1f1a17]">{c.rate || 0}%</span>
                          </div>
                        ))}

                      <div className="h-px bg-[#eadfd6] w-full my-2"></div>

                      <div className="flex items-center justify-between text-sm font-medium text-[#1f1a17]">
                        <span>Total Tax Rate</span>
                        <span className="font-semibold">{totalTaxRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2 space-y-1">
                      <p className="text-xs font-medium text-[#6f655e]">No components added</p>
                      <p className="text-xs text-[#8a7e75]">
                        Total Tax Rate: <span className="font-semibold text-[#1f1a17]">0%</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-[#eadfd6] bg-[#fcf8f6]">
              <button
                type="button"
                onClick={handleCloseTaxGroupDrawer}
                className="h-10 rounded-full border border-dashed border-[#d1c4c1] bg-white px-6 text-xs font-medium text-[#1f1a17] transition hover:bg-[#f3eeea]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTaxGroup}
                disabled={isSaving}
                className="flex h-10 items-center justify-center rounded-full bg-[#191513] px-6 text-xs font-medium text-white shadow-sm transition hover:bg-[#2e2824] disabled:opacity-40"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* TAB 4: COUNTRY REQUIREMENTS */}
      {activeTab === "country" && (
        <div className="space-y-6">

          {/* Card 1: FSSAI Registration */}
          <div className="overflow-hidden rounded-2xl border border-[#eadfd6] bg-white shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 md:p-8 border-b border-[#eadfd6]">
              <div>
                <h3 className="text-lg font-medium text-[#1f1a17]">FSSAI Registration</h3>
                <p className="mt-1 text-xs text-[#6f655e]">
                  Add your FSSAI registration details if applicable.
                </p>
              </div>

              <div className="mt-4 sm:mt-0 flex items-center gap-3">
                <span className="text-xs font-medium text-[#1f1a17]">Do you have an FSSAI number?</span>
                <button
                  type="button"
                  onClick={() => updateField("isFssai", !formData.isFssai)}
                  className={`h-6 w-11 rounded-full p-1 transition-colors ${
                    formData.isFssai ? "bg-[#1f1a17]" : "bg-[#e7e5e4]"
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white transition-transform ${
                      formData.isFssai ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Expandable FSSAI Content */}
            {formData.isFssai && (
              <div className="p-6 md:p-8 bg-[#fdf8f7] space-y-6">
                <div>
                  <input
                    type="file"
                    ref={fssaiFileInputRef}
                    onChange={handleFssaiDocumentUpload}
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                  />
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e] mb-2">
                    Upload your FSSAI document
                  </label>
                  <div
                    onClick={() => fssaiFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d1c4c1] bg-white p-8 text-center transition hover:bg-[#fcf8f6] cursor-pointer relative"
                  >
                    {isUploadingFssaiDoc ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#191513] border-t-transparent"></div>
                        <span className="text-sm font-medium text-[#1f1a17]">Uploading FSSAI document...</span>
                      </div>
                    ) : (formData.fssaiDocumentAssetId || formData.fssaiDocumentStorageId) ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl">
                          ✓
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-[#1f1a17]">FSSAI Document Uploaded</p>
                          {fssaiDocStorageUrl && (
                            <a
                              href={fssaiDocStorageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-amber-700 hover:underline font-medium inline-block mt-1"
                            >
                              View Uploaded Document ↗
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fssaiFileInputRef.current?.click();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#eadfd6] bg-[#fcf8f6] px-2.5 py-1 text-xs font-medium text-[#1f1a17] transition hover:border-[#1f1a17] hover:bg-[#f3eeea] cursor-pointer"
                          >
                            <EditPencilIcon className="w-3.5 h-3.5 text-[#5e5e5e]" />
                            <span>Change File</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFssaiDocument();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-100 cursor-pointer"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3eeea] text-[#1f1a17] text-xl mb-3">
                          ☁️
                        </div>
                        <p className="text-sm font-medium text-[#1f1a17]">Click to upload or drag and drop</p>
                        <p className="mt-1 text-xs text-[#8a7e75]">JPG, JPEG, PNG and PDF files are allowed</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                      FSSAI Number
                    </label>
                    <input
                      type="text"
                      value={formData.fssaiRegistrationNumber || ""}
                      onChange={(e) => updateField("fssaiRegistrationNumber", e.target.value)}
                      placeholder="e.g. 10012011000123"
                      className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={formData.expiryDate || ""}
                      onChange={(e) => updateField("expiryDate", e.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: GST Registration */}
          <div className="overflow-hidden rounded-2xl border border-[#eadfd6] bg-white shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 md:p-8 border-b border-[#eadfd6]">
              <div>
                <h3 className="text-lg font-medium text-[#1f1a17]">GST Registration</h3>
                <p className="mt-1 text-xs text-[#6f655e]">
                  Add your GST registration details if applicable.
                </p>
              </div>

              <div className="mt-4 sm:mt-0 flex items-center gap-3">
                <span className="text-xs font-medium text-[#1f1a17]">Do you have a GST number?</span>
                <button
                  type="button"
                  onClick={() => updateField("isGst", !formData.isGst)}
                  className={`h-6 w-11 rounded-full p-1 transition-colors ${
                    formData.isGst ? "bg-[#1f1a17]" : "bg-[#e7e5e4]"
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white transition-transform ${
                      formData.isGst ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Expandable GST Content */}
            {formData.isGst && (
              <div className="p-6 md:p-8 bg-[#fdf8f7] space-y-6">
                <div>
                  <input
                    type="file"
                    ref={gstFileInputRef}
                    onChange={handleGstDocumentUpload}
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                  />
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e] mb-2">
                    Upload your GST document
                  </label>
                  <div
                    onClick={() => gstFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d1c4c1] bg-white p-8 text-center transition hover:bg-[#fcf8f6] cursor-pointer relative"
                  >
                    {isUploadingGstDoc ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#191513] border-t-transparent"></div>
                        <span className="text-sm font-medium text-[#1f1a17]">Uploading GST document...</span>
                      </div>
                    ) : (formData.gstDocumentAssetId || formData.gstDocumentStorageId) ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl">
                          ✓
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-[#1f1a17]">GST Document Uploaded</p>
                          {gstDocStorageUrl && (
                            <a
                              href={gstDocStorageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-amber-700 hover:underline font-medium inline-block mt-1"
                            >
                              View Uploaded Document ↗
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              gstFileInputRef.current?.click();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#eadfd6] bg-[#fcf8f6] px-2.5 py-1 text-xs font-medium text-[#1f1a17] transition hover:border-[#1f1a17] hover:bg-[#f3eeea] cursor-pointer"
                          >
                            <EditPencilIcon className="w-3.5 h-3.5 text-[#5e5e5e]" />
                            <span>Change File</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveGstDocument();
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-100 cursor-pointer"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3eeea] text-[#1f1a17] text-xl mb-3">
                          📤
                        </div>
                        <p className="text-sm font-medium text-[#1f1a17]">Click to upload or drag and drop</p>
                        <p className="mt-1 text-xs text-[#8a7e75]">JPG, JPEG, PNG and PDF files are allowed</p>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6f655e]">
                    GST Number
                  </label>
                  <input
                    type="text"
                    value={formData.gstNumber || ""}
                    onChange={(e) => updateField("gstNumber", e.target.value)}
                    placeholder="E.G. 22AAAAA0000A1Z5"
                    className="mt-2 w-full max-w-md rounded-xl border border-[#eadfd6] bg-white px-4 py-3 text-sm text-[#1f1a17] placeholder-[#8a7e75] transition focus:border-[#1f1a17] focus:outline-none uppercase"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      </div>

      {/* FOOTER ACTIONS BAR (Fixed at bottom; Hidden on Operational Timings & Taxation since drawers handle actions) */}
      {activeTab !== "timings" && activeTab !== "taxation" && (
        <div className="shrink-0 flex items-center justify-end gap-2.5 border-t border-[#e7e5e4] bg-[#fdf8f7] pt-2 pb-0 z-20">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-8 rounded-full border border-[#e7e5e4] bg-white px-4 text-xs font-semibold text-[#141010] transition hover:bg-[#f1edec] active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex h-8 items-center justify-center rounded-full bg-[#0c0a09] px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Saving...</span>
              </div>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      )}

      {/* Standard Floating Toast Notification Component (Matching Menu Page) */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
