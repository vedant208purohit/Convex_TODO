"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Toast, type ToastMessage } from "./Toast";

// ==========================================
// UTILITY HELPERS & COLOR PRESETS
// ==========================================

const DEFAULT_PRIMARY = "#418244";
const DEFAULT_SECONDARY = "#E52A2A";
const DEFAULT_BG = "#FBF8F5";
const DEFAULT_CARD = "#FFFFFF";
const DEFAULT_TEXT = "#1E1B19";
const DEFAULT_MUTED = "#6E6661";

function isValidHex(hex: string): boolean {
  return /^#([A-Fa-f0-9]{6})$/.test(hex.trim());
}

const PRESET_PALETTES: Record<string, { label: string; sub: string; primary: string; secondary: string; bg: string; card: string; text: string }> = {
  bistro: {
    label: "Classic Bistro",
    sub: "Forest & Crimson",
    primary: "#418244",
    secondary: "#E52A2A",
    bg: "#FBF8F5",
    card: "#FFFFFF",
    text: "#1E1B19",
  },
  fresh: {
    label: "Fresh Botanica",
    sub: "Sage & Terracotta",
    primary: "#2D6A4F",
    secondary: "#D97736",
    bg: "#F4F9F4",
    card: "#FFFFFF",
    text: "#1E1B19",
  },
  warm: {
    label: "Warm Heritage",
    sub: "Amber & Rust",
    primary: "#B45309",
    secondary: "#991B1B",
    bg: "#FDFBF7",
    card: "#FFFFFF",
    text: "#1E1B19",
  },
  minimal: {
    label: "Atelier Minimal",
    sub: "Ink & Pearl",
    primary: "#18181B",
    secondary: "#71717A",
    bg: "#FFFFFF",
    card: "#F4F4F5",
    text: "#09090B",
  },
  luxe: {
    label: "Nocturne Gold",
    sub: "OLED & Gilded",
    primary: "#D4AF37",
    secondary: "#E5A93B",
    bg: "#121212",
    card: "#1C1917",
    text: "#F5F5F4",
  },
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export function OrganizationOnlineStore() {
  const organizations = useQuery(api.organizations.list);
  const org = organizations?.[0] ?? null;
  const isLoading = organizations === undefined;

  const updateOrg = useMutation(api.organizations.update);

  // Main navigation segment tabs
  const [activeTab, setActiveTab] = useState<"themes" | "inspector" | "colors" | "availability" | "payments">("themes");

  // Form & Store State
  const [onlineStore, setOnlineStore] = useState<boolean>(true);
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState<string>(DEFAULT_SECONDARY);
  const [canvasBg, setCanvasBg] = useState<string>(DEFAULT_BG);
  const [cardBg, setCardBg] = useState<string>(DEFAULT_CARD);
  const [headingInk, setHeadingInk] = useState<string>(DEFAULT_TEXT);
  const [mutedInk, setMutedInk] = useState<string>(DEFAULT_MUTED);
  const [selectedPreset, setSelectedPreset] = useState<string>("bistro");

  // Theme Inspector state
  const [deviceMode, setDeviceMode] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [journeyStep, setJourneyStep] = useState<"home" | "mode" | "modifiers" | "cart" | "table">("home");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | "veg" | "nonveg">("all");
  const [modifierPortion, setModifierPortion] = useState<"regular" | "large">("regular");
  const [modifierSpice, setModifierSpice] = useState<"mild" | "medium" | "hot">("medium");
  const [extraChutney, setExtraChutney] = useState<boolean>(true);
  const [extraSalad, setExtraSalad] = useState<boolean>(false);

  // Interaction feedback
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncSpinning, setSyncSpinning] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Sync state when organization data loads
  useEffect(() => {
    if (!org) return;
    setOnlineStore(org.onlineStore ?? true);
    if (org.primaryColor && isValidHex(org.primaryColor)) {
      setPrimaryColor(org.primaryColor);
    }
    if (org.secondaryColor && isValidHex(org.secondaryColor)) {
      setSecondaryColor(org.secondaryColor);
    }
  }, [org]);

  // Public URL
  const storeSlug = org?.slug || "spicegarden";
  const publicStoreUrl = `https://${storeSlug}.get-prest.com`;

  const isDirty = useMemo(() => {
    if (!org) return false;
    const initialOnlineStore = org.onlineStore ?? true;
    const initialPrimary = org.primaryColor || DEFAULT_PRIMARY;
    const initialSecondary = org.secondaryColor || DEFAULT_SECONDARY;
    return (
      onlineStore !== initialOnlineStore ||
      primaryColor.toUpperCase() !== initialPrimary.toUpperCase() ||
      secondaryColor.toUpperCase() !== initialSecondary.toUpperCase()
    );
  }, [org, onlineStore, primaryColor, secondaryColor]);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "success",
    subtext?: string,
  ) => {
    setToast({ message, type, subtext });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicStoreUrl);
      setCopied(true);
      showToast("Storefront URL copied to clipboard!", "success", publicStoreUrl);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      showToast("Failed to copy link", "error", "Please check clipboard permissions.");
    }
  };

  const handleSave = async () => {
    if (!org?._id) {
      showToast("Organization record not found", "error", "Please configure an organization profile first.");
      return;
    }
    if (!isValidHex(primaryColor)) {
      showToast("Invalid primary color", "error", "Please provide a valid 6-character hex code (e.g. #418244)");
      return;
    }
    if (!isValidHex(secondaryColor)) {
      showToast("Invalid secondary color", "error", "Please provide a valid 6-character hex code (e.g. #E52A2A)");
      return;
    }

    setIsSaving(true);
    try {
      await updateOrg({
        id: org._id,
        onlineStore,
        primaryColor: primaryColor.trim().toUpperCase(),
        secondaryColor: secondaryColor.trim().toUpperCase(),
        theme: "theme1",
      });
      showToast("Store configuration saved successfully!", "success", "Live storefront branding updated in real-time.");
    } catch (err: any) {
      const rawMsg = err?.message || "";
      const cleaned = rawMsg
        .replace(/\[CONVEX[^\]]*\]/gi, "")
        .replace(/ServerError:\s*/gi, "")
        .replace(/Uncaught Error:\s*/gi, "")
        .trim();
      showToast("Failed to save configuration", "error", cleaned || "Please check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePresetSelect = (presetKey: string) => {
    const p = PRESET_PALETTES[presetKey];
    if (!p) return;
    setSelectedPreset(presetKey);
    setPrimaryColor(p.primary);
    setSecondaryColor(p.secondary);
    setCanvasBg(p.bg);
    setCardBg(p.card);
    setHeadingInk(p.text);
  };

  const triggerSyncAnimation = () => {
    setSyncSpinning(true);
    setTimeout(() => {
      setSyncSpinning(false);
      showToast("Storefront synchronized", "success", "All changes are live and in sync.");
    }, 600);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-6 space-y-6 animate-pulse bg-[#fff8f5] rounded-xl">
        <div className="h-14 bg-[#eee7e3] rounded-xl w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-96 bg-[#eee7e3] rounded-2xl" />
          <div className="h-96 bg-[#eee7e3] rounded-2xl" />
          <div className="h-96 bg-[#eee7e3] rounded-2xl" />
          <div className="h-96 bg-[#eee7e3] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 max-w-full overflow-x-hidden bg-transparent text-[#1e1b19] font-sans">
      {/* Standard Menu Notification Toast */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Offline Confirmation Modal */}
      {showOfflineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[#ffffff] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-[#e9e1dd] animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px]">pause_circle</span>
            </div>
            <h3 className="text-lg font-bold text-[#1e1b19]">Pause Online Ordering?</h3>
            <p className="text-sm text-[#645d58] mt-2 leading-relaxed">
              When paused, customers opening your storefront URL will see an &ldquo;Ordering Currently Unavailable&rdquo; message. Active table QR ordering and cart checkouts will be temporarily disabled.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowOfflineModal(false)}
                className="px-4 py-2 rounded-full border border-[#cfc4c5] text-[#1e1b19] font-semibold text-xs hover:bg-[#faf2ee] transition cursor-pointer"
              >
                Keep Store Online
              </button>
              <button
                type="button"
                onClick={() => {
                  setOnlineStore(false);
                  setShowOfflineModal(false);
                  showToast("Storefront is now paused (offline)", "info", "Customers cannot place new online orders.");
                }}
                className="px-4 py-2 rounded-full bg-[#ba1a1a] text-white font-semibold text-xs hover:bg-red-700 transition shadow-sm cursor-pointer"
              >
                Yes, Pause Storefront
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TOP LEVEL STICKY CONTEXT BAR                             */}
      {/* ======================================================== */}
      {/* TOP LEVEL COMPACT STICKY CONTEXT BAR                     */}
      {/* ======================================================== */}
      <div className="pb-3 border-b border-[#e7e5e4] flex flex-col gap-2 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Title + Status + Tight Subtitle */}
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-serif text-[#1e1b19] font-normal tracking-tight whitespace-nowrap">
                Online Store
              </h1>
              {onlineStore ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e8f5e9] text-[#1b5e20] text-xs font-semibold whitespace-nowrap shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[#1b5e20] animate-pulse" />
                  Store Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold whitespace-nowrap shrink-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Store Offline
                </span>
              )}
            </div>
            <p className="text-xs text-[#645d58] mt-0.5 leading-relaxed max-w-2xl">
              Manage your public restaurant store, ordering options, and storefront appearance.
            </p>
          </div>

          {/* Right: Unified Action Toolbar (Compact Pill + Sync + Save) */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 self-start lg:self-center">
            {/* Domain Pill: Compact on small screens / laptops, full URL only on 2xl */}
            <div
              className="inline-flex items-center gap-1.5 bg-[#f4ece8] px-3 py-1.5 rounded-full border border-[#cfc4c5]/40 text-xs shrink-0 max-w-full"
              title={publicStoreUrl}
            >
              <span className="material-symbols-outlined text-[15px] text-[#645d58] shrink-0">link</span>
              <span className="text-[#1e1b19] select-all font-medium whitespace-nowrap">
                <span className="hidden 2xl:inline font-mono">{storeSlug}.get-prest.com</span>
                <span className="2xl:hidden font-medium">Live Store</span>
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="hover:text-black text-[#645d58] transition-colors flex items-center p-0.5 cursor-pointer shrink-0"
                title="Copy Storefront URL"
              >
                <span className="material-symbols-outlined text-[15px]">{copied ? "done" : "content_copy"}</span>
              </button>
              <span className="w-px h-3 bg-[#cfc4c5] shrink-0" />
              <a
                href={publicStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1e1b19] font-semibold flex items-center gap-0.5 group shrink-0 hover:text-black transition-colors"
                title="Open Storefront in New Tab"
              >
                <span className="group-hover:underline">Open</span>
                <span className="material-symbols-outlined text-[13px] leading-none select-none" style={{ textDecoration: "none" }}>arrow_outward</span>
              </a>
            </div>

            {/* Sync Button */}
            <button
              type="button"
              onClick={triggerSyncAnimation}
              className={`p-1.5 rounded-full bg-[#ffffff] text-[#645d58] hover:text-[#1e1b19] hover:bg-[#faf2ee] transition-all flex items-center justify-center shadow-xs border border-[#e9e1dd] cursor-pointer shrink-0 ${
                syncSpinning ? "rotate-180 duration-500" : ""
              }`}
              title="Sync Storefront State"
            >
              <span className="material-symbols-outlined text-[17px]">sync</span>
            </button>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap ${
                isDirty
                  ? "bg-[#000000] text-white hover:bg-[#33302d] cursor-pointer"
                  : "bg-[#e9e1dd] text-[#645d58] cursor-not-allowed opacity-80"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">cloud_done</span>
              <span>
                {isSaving ? (
                  "Saving..."
                ) : (
                  <>
                    <span className="hidden 2xl:inline">Save Store Configuration</span>
                    <span className="2xl:hidden">Save Changes</span>
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* CONTENT CONTAINER                                        */}
      {/* ======================================================== */}
      <div className="flex-1 overflow-y-auto pt-2 sm:pt-2.5 pr-1">
        {/* ===================================================== */}
        {/* VIEW 1: THEMES GALLERY (Default)                      */}
        {/* ===================================================== */}
        {activeTab === "themes" && (
          <div className="space-y-6">
            {/* Section 1 Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#645d58] block">
                  Digital Dining Room
                </span>
                <h2 className="text-2xl font-serif text-[#1e1b19] font-normal">Customer-Facing Themes</h2>
                <p className="text-xs text-[#645d58] mt-1 max-w-3xl leading-relaxed">
                  These themes dictate the exact responsive web app layout seen by guests ordering via table QR code or public web link. All previews are rendered inside realistic mobile smartphone frames with synchronized mock data.
                </p>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[#645d58] text-xs bg-[#f4ece8] px-3 py-1.5 rounded-full shrink-0 whitespace-nowrap font-medium self-start lg:self-auto border border-[#e9e1dd]/70 shadow-xs">
                <span className="material-symbols-outlined text-[16px] text-[#645d58] shrink-0">view_carousel</span>
                <span>
                  <span className="hidden xl:inline">1 Production Layout (3 Coming Soon)</span>
                  <span className="hidden sm:inline xl:hidden">1 Active (3 Coming Soon)</span>
                  <span className="sm:hidden">1 Active (3 Soon)</span>
                </span>
              </div>
            </div>

            {/* Themes Grid (4 Themes) */}
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6 pt-2">
              {/* THEME 1: Classic Bistro (ACTIVE) */}
              <div className="flex flex-col bg-[#faf2ee] rounded-2xl p-4 sm:p-5 shadow-xs border border-[#e9e1dd] transition-all hover:shadow-md min-w-0 overflow-hidden">
                <div className="flex items-start sm:items-center justify-between mb-3 gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-serif text-[#1e1b19] font-bold">Classic Bistro</span>
                    <span className="text-[11px] text-[#645d58]">Single-column sticky index</span>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#000000] text-white text-[11px] font-semibold">
                    <span className="material-symbols-outlined text-[13px] text-[#4caf50]">check_circle</span>
                    Active
                  </span>
                </div>

                {/* Smartphone Shell Frame */}
                <div className="mx-auto my-2 w-[252px] max-w-full h-[470px] bg-[#1b1b1b] rounded-[2.5rem] p-2 shadow-xl flex flex-col relative select-none shrink-0">
                  <div className="w-full h-full bg-[#fdfaf7] rounded-[2rem] overflow-hidden flex flex-col relative text-[11px] text-[#1e1b19]">
                    {/* Dynamic Island Notch */}
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-full z-30 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#202020] ml-6" />
                    </div>

                    {/* Status Header */}
                    <div className="pt-3 px-3.5 pb-1 flex justify-between items-center text-[9px] font-semibold text-[#1e1b19]/70 z-20">
                      <span>9:41</span>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">signal_cellular_alt</span>
                        <span className="material-symbols-outlined text-[10px]">wifi</span>
                        <span className="material-symbols-outlined text-[10px]">battery_full</span>
                      </div>
                    </div>

                    {/* Storefront App Header */}
                    <div className="px-3 py-1.5 bg-[#fdfaf7] flex items-center justify-between border-b border-[#e9e1dd] z-10">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-6 h-6 rounded-full text-white flex items-center justify-center text-[11px] font-serif font-bold shadow-xs"
                          style={{ backgroundColor: primaryColor }}
                        >
                          S
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="font-bold text-[10px] text-[#1e1b19]">Spice Garden</span>
                          <span className="text-[8px] text-[#645d58]">Table 04 • Dine-In</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[#1e1b19]">
                        <span className="material-symbols-outlined text-[14px]">search</span>
                        <div className="relative">
                          <span className="material-symbols-outlined text-[14px]">shopping_bag</span>
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#ba1a1a] text-white rounded-full text-[7px] flex items-center justify-center font-bold">
                            3
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Service Mode Segment */}
                    <div className="px-2.5 py-1.5 bg-[#f4ece8] flex gap-1 text-[8px] font-semibold">
                      <span className="flex-1 py-1 rounded text-white text-center" style={{ backgroundColor: primaryColor }}>
                        🛵 Delivery
                      </span>
                      <span className="flex-1 py-1 rounded bg-[#e9e1dd] text-[#645d58] text-center">🥡 Takeaway</span>
                      <span className="flex-1 py-1 rounded bg-[#e9e1dd] text-[#645d58] text-center">🍽️ Dine-In</span>
                    </div>

                    {/* Scrollable App Body */}
                    <div className="flex-1 overflow-hidden p-2.5 space-y-2">
                      {/* Promo banner */}
                      <div
                        className="text-white rounded-lg p-2 flex items-center justify-between shadow-xs"
                        style={{ backgroundColor: secondaryColor }}
                      >
                        <div>
                          <div className="text-[9px] font-bold tracking-wide">FLAT 20% OFF</div>
                          <div className="text-[7px] opacity-80">Use code SPICE20 above ₹499</div>
                        </div>
                        <span className="material-symbols-outlined text-[16px]">local_activity</span>
                      </div>

                      {/* Category tabs */}
                      <div className="flex gap-1 overflow-hidden text-[8px] py-0.5">
                        <span className="px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: primaryColor }}>
                          All
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#f4ece8] text-[#1e1b19] font-medium whitespace-nowrap">
                          ⭐ Bestsellers
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#f4ece8] text-[#645d58] font-medium">Starters</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#f4ece8] text-[#645d58] font-medium">Mains</span>
                      </div>

                      {/* Food Item Card 1 */}
                      <div className="bg-white p-1.5 rounded-lg flex gap-2 items-center shadow-xs">
                        <img
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuB6GWwH4TIwytwaMdyxGKL_7BgHqzGLhZlV-WoTT_z7q4-K94Qe4bKZfyI8VqykcgRgwVIH9ipFFWGjD4AVPVLubfTWCs4NypZPDmXmLxyQa35S7GeUAjTmHi0cOJBOEVAEqjXtQ369JA2kPuziUPsOHRh_7kt45oCjSSpU6b_qqs2sJysM3kQBrmIDIcboOiHALAmxg8wD-nYTTPBaSl4eiV_QGiOs6DNW9POIlgZZx-AUdvlyWlM3"
                          alt="Tandoori Paneer Tikka"
                          className="w-12 h-12 rounded object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#2e7d32] border border-[#2e7d32]" />
                            <span className="font-bold text-[9px] truncate">Tandoori Paneer Tikka</span>
                          </div>
                          <span className="text-[8px] text-[#645d58]">6 pcs charcoal smoked</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-bold text-[10px]">₹280</span>
                            <button
                              type="button"
                              className="text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-xs"
                              style={{ backgroundColor: primaryColor }}
                            >
                              + ADD
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Food Item Card 2 */}
                      <div className="bg-white p-1.5 rounded-lg flex gap-2 items-center shadow-xs">
                        <img
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBdLu8iTNdEn_ui-szYiSNA0qz4wbvMEDuH1_s6QZH_gCNmfp1vSGtFFBISdTgnweUaLTXShn0EXW2MnPbvaSXsrSlzjigAf9HnMoFyzQ04Vu3ct0NUORQPwm6pwD0KxBtcyfgAWnC3h4t8ES6PXufCANsrDR_L5MLZjdgT_7Kpl4GcAIpfT1c-7yxTfeTbUEKQG1Nqpesz11q9ab2er2zAwRdoM5dhMyRIu0VaWDozMp0VaJJJ0g13"
                          alt="Murgh Makhani"
                          className="w-12 h-12 rounded object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#c62828] border border-[#c62828]" />
                            <span className="font-bold text-[9px] truncate">Murgh Makhani</span>
                          </div>
                          <span className="text-[8px] text-[#645d58]">Rich cashew gravy</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-bold text-[10px]">₹360</span>
                            <div className="inline-flex items-center gap-1 bg-[#f4ece8] px-1.5 py-0.5 rounded text-[8px] font-bold">
                              <span>-</span>
                              <span>1</span>
                              <span>+</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sticky Cart Pill Footer */}
                    <div className="p-2 bg-gradient-to-t from-[#fdfaf7] to-transparent">
                      <div
                        className="text-white px-2.5 py-1.5 rounded-full flex items-center justify-between text-[9px] font-bold shadow-md cursor-pointer"
                        style={{ backgroundColor: primaryColor }}
                        onClick={() => setActiveTab("inspector")}
                      >
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[11px]">shopping_bag</span>
                          <span>3 Items • ₹940</span>
                        </div>
                        <span className="text-[8px] font-semibold flex items-center">View Cart →</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description & Button Stack */}
                <div className="mt-2 flex flex-col justify-between flex-1 gap-3">
                  <p className="text-xs text-[#645d58] leading-relaxed">
                    High-conversion single column with sticky food category tabs, prominent veg/non-veg tags, and bottom sticky checkout summary.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("inspector")}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#1e1b19] hover:bg-black text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs group"
                    >
                      <span className="material-symbols-outlined text-[16px] text-white/80 group-hover:text-white transition-colors">tune</span>
                      <span>Customize &amp; Preview</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* THEME 2: Express Flow (Coming Soon) */}
              <div className="flex flex-col bg-[#faf2ee] rounded-2xl p-4 sm:p-5 shadow-xs border border-[#e9e1dd] opacity-90 hover:opacity-100 transition-all min-w-0 overflow-hidden">
                <div className="flex items-start sm:items-center justify-between mb-3 gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-serif text-[#1e1b19] font-bold">Express Flow</span>
                    <span className="text-[11px] text-[#645d58]">QSR multi-card rapid POS</span>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e9e1dd] text-[#645d58] text-[11px] font-semibold">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    Coming Soon
                  </span>
                </div>

                {/* Smartphone Shell Frame */}
                <div className="mx-auto my-2 w-[252px] max-w-full h-[470px] bg-[#1b1b1b] rounded-[2.5rem] p-2 shadow-xl flex flex-col relative select-none shrink-0">
                  <div className="w-full h-full bg-[#ffffff] rounded-[2rem] overflow-hidden flex flex-col relative text-[11px] text-[#1e1b19]">
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-full z-30" />
                    <div className="pt-3 px-3.5 pb-1 flex justify-between items-center text-[9px] font-semibold text-white bg-[#1b5e20] z-20">
                      <span>9:41</span>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">wifi</span>
                        <span className="material-symbols-outlined text-[10px]">battery_full</span>
                      </div>
                    </div>

                    <div className="bg-[#1b5e20] text-white p-2.5 pt-1 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase">EXPRESS PIZZA &amp; CO</div>
                        <div className="text-[8px] opacity-80">Ready in 12 mins</div>
                      </div>
                      <div className="bg-white/20 p-1 rounded-full">
                        <span className="material-symbols-outlined text-[14px]">bolt</span>
                      </div>
                    </div>

                    <div className="flex border-b border-[#e9e1dd] text-[8px] font-bold text-center">
                      <span className="flex-1 py-1.5 bg-[#e9e1dd] text-[#1e1b19] border-b-2 border-[#1b5e20]">Dine-In Table</span>
                      <span className="flex-1 py-1.5 text-[#645d58]">Counter Pickup</span>
                    </div>

                    <div className="p-2 space-y-2 flex-1 overflow-hidden">
                      <div className="flex items-center justify-between text-[8px] font-bold uppercase text-[#645d58]">
                        <span>Fast Reorder</span>
                        <span className="text-[#1b5e20]">Token #84</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-[#faf2ee] rounded-lg p-1.5 flex flex-col">
                          <img
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDmJ4w63h4sU2R3hdibwslNYfw-QX0kloMu-IPXntQDVnNIDaslz1FlYGKjuA6-AhpzN9L9iCdcaxel5CoW5h51ZPzLADRWsMIL2bIcJaKzn53Sg8jJxl6B2gpWShglRqi0msiwnM6G6yAHw-bGQ-6i_Wxceja0POvy1TQCV8o6URrpu5m9rpsCWH9F4lhmx4e-driuOAIjCigCrGDhA5prT_GPJXd0OFm7ZC9cfHE5ADQG60Xt9Z1j"
                            alt="Margherita Pizza"
                            className="w-full h-14 rounded object-cover"
                          />
                          <span className="font-bold text-[9px] mt-1 truncate">Margherita Pizza</span>
                          <span className="text-[8px] text-[#645d58]">Regular 7&quot;</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-bold text-[9px]">₹100</span>
                            <button type="button" className="bg-[#1b5e20] text-white rounded text-[8px] px-1.5 py-0.5 font-bold">+</button>
                          </div>
                        </div>
                        <div className="bg-[#faf2ee] rounded-lg p-1.5 flex flex-col">
                          <img
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAfV5EfiN5CSQHhEzrf0OgsZy_LnTY-pVgBK9BPrR-8fPmw4vgcFT-BQ8E92mUMpYvjOPDI_8kq2UjrhsqX8cG3cXDNoj3z9LXGFyLbXTJvj8ztmzV1Vfty1ZmrdLNFgL0XX-vNklu8G7NlU0vG1q2lIXr2Rq2HZBCW_a0K7HOCZXJ7ZwOls5954XUY00zkgMUN5Gs8A1qzcSKPxXjDMHE_01DxmJTwBSNZQ3dn_qpg1TaYikCd34e-"
                            alt="Macaroni Pizza"
                            className="w-full h-14 rounded object-cover"
                          />
                          <span className="font-bold text-[9px] mt-1 truncate">Macaroni Pizza</span>
                          <span className="text-[8px] text-[#645d58]">Cheesy Crust</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-bold text-[9px]">₹150</span>
                            <button type="button" className="bg-[#1b5e20] text-white rounded text-[8px] px-1.5 py-0.5 font-bold">+</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 bg-white">
                      <button type="button" className="w-full py-1.5 rounded-lg bg-[#1b5e20] text-white font-bold text-[9px] flex items-center justify-between px-3">
                        <span>₹291.00 • 2 Items</span>
                        <span>Pay with UPI →</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-col justify-between flex-1 gap-3">
                  <p className="text-xs text-[#645d58]">
                    QSR high-speed ordering flow with multi-tier checkout, rapid combo selections, and instant mobile UPI.
                  </p>
                  <button type="button" disabled className="w-full py-2.5 rounded-xl bg-[#e9e1dd] text-[#645d58] text-xs font-semibold cursor-not-allowed">
                    Coming Soon
                  </button>
                </div>
              </div>

              {/* THEME 3: Modern Minimalist (Coming Soon) */}
              <div className="flex flex-col bg-[#faf2ee] rounded-2xl p-4 sm:p-5 shadow-xs border border-[#e9e1dd] opacity-90 hover:opacity-100 transition-all min-w-0 overflow-hidden">
                <div className="flex items-start sm:items-center justify-between mb-3 gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-serif text-[#1e1b19] font-bold">Modern Minimalist</span>
                    <span className="text-[11px] text-[#645d58]">Editorial fine-dining folio</span>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e9e1dd] text-[#645d58] text-[11px] font-semibold">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    Coming Soon
                  </span>
                </div>

                {/* Smartphone Shell Frame */}
                <div className="mx-auto my-2 w-[252px] max-w-full h-[470px] bg-[#1b1b1b] rounded-[2.5rem] p-2 shadow-xl flex flex-col relative select-none shrink-0">
                  <div className="w-full h-full bg-[#f6f2ec] rounded-[2rem] overflow-hidden flex flex-col relative text-[11px] text-[#1e1b19]">
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-full z-30" />
                    <div className="pt-3 px-3.5 pb-1 flex justify-between items-center text-[9px] font-serif text-[#4a3f35] z-20">
                      <span>19:30</span>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">wifi</span>
                        <span className="material-symbols-outlined text-[10px]">battery_full</span>
                      </div>
                    </div>

                    <div className="px-3 py-2 text-center border-b border-[#e5ded4]">
                      <span className="font-serif italic text-[12px] tracking-widest text-[#2c221e] uppercase">L’Atelier Bistro</span>
                      <span className="block text-[7px] tracking-wider text-[#857367]">CHEF’S SEVEN-COURSE DEGUSTATION</span>
                    </div>

                    <div className="flex-1 overflow-hidden p-3 space-y-2.5">
                      <div className="text-center py-0.5">
                        <span className="font-serif text-[10px] italic text-[#6e5d50]">— Autumn Pairing 2025 —</span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-baseline font-serif text-[10px] text-[#2c221e]">
                          <span className="font-normal italic">I. Heirloom Beetroot Tartare</span>
                          <span>₹420</span>
                        </div>
                        <p className="text-[7.5px] text-[#7d6f65] leading-tight">Smoked goat curd, fermented blackberry pearls, buckwheat wafer.</p>
                        <span className="text-[7px] text-[#916b55] font-serif italic">Paired with: Pinot Noir ’21</span>
                      </div>
                      <div className="w-8 h-px bg-[#d9cfc3] mx-auto" />
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-baseline font-serif text-[10px] text-[#2c221e]">
                          <span className="font-normal italic">II. Black Truffle Agnolotti</span>
                          <span>₹680</span>
                        </div>
                        <p className="text-[7.5px] text-[#7d6f65] leading-tight">Parmigiano foam, shaved autumn truffles, brown butter glaze.</p>
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#ede7df] border-t border-[#dfd7cc] text-center">
                      <button type="button" className="w-full py-1.5 rounded-full bg-[#2c221e] text-[#f6f2ec] font-serif text-[9px] tracking-wider uppercase">
                        Order Tasting Folio
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-col justify-between flex-1 gap-3">
                  <p className="text-xs text-[#645d58]">
                    Editorial layout tailored to fine-dining tasting menus, bespoke beverage pairings, and intimate course sequencing.
                  </p>
                  <button type="button" disabled className="w-full py-2.5 rounded-xl bg-[#e9e1dd] text-[#645d58] text-xs font-semibold cursor-not-allowed">
                    Coming Soon
                  </button>
                </div>
              </div>

              {/* THEME 4: Obsidian Lounge (Coming Soon) */}
              <div className="flex flex-col bg-[#faf2ee] rounded-2xl p-4 sm:p-5 shadow-xs border border-[#e9e1dd] opacity-90 hover:opacity-100 transition-all min-w-0 overflow-hidden">
                <div className="flex items-start sm:items-center justify-between mb-3 gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-base font-serif text-[#1e1b19] font-bold">Obsidian Lounge</span>
                    <span className="text-[11px] text-[#645d58]">OLED dark cocktail lounge</span>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#121212] text-neutral-400 text-[11px] font-semibold border border-neutral-800">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    Coming Soon
                  </span>
                </div>

                {/* Smartphone Shell Frame */}
                <div className="mx-auto my-2 w-[252px] max-w-full h-[470px] bg-[#1b1b1b] rounded-[2.5rem] p-2 shadow-xl flex flex-col relative select-none shrink-0">
                  <div className="w-full h-full bg-[#0f0f10] rounded-[2rem] overflow-hidden flex flex-col relative text-[11px] text-[#e6e1e5]">
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-full z-30" />
                    <div className="pt-3 px-3.5 pb-1 flex justify-between items-center text-[9px] font-semibold text-neutral-400 z-20">
                      <span>23:14</span>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">wifi</span>
                        <span className="material-symbols-outlined text-[10px]">battery_full</span>
                      </div>
                    </div>

                    <div className="px-3 py-1.5 flex items-center justify-between border-b border-neutral-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse" />
                        <span className="font-bold text-[10px] uppercase text-white">THE VAULT</span>
                      </div>
                      <span className="text-[8px] bg-[#1e1e24] text-[#ffb74d] px-1.5 py-0.5 rounded">Table #B2 • QR</span>
                    </div>

                    <div className="px-2.5 py-1 bg-gradient-to-r from-[#2c1338] to-[#121212] flex items-center justify-between text-[7.5px] border-b border-neutral-800">
                      <span className="text-[#f48fb1]">LIVE SET: DJ KRONIC (HOUSE)</span>
                      <span className="text-neutral-400">NOW</span>
                    </div>

                    <div className="p-2.5 flex-1 overflow-hidden space-y-2">
                      <div className="bg-[#19191d] p-1.5 rounded-lg flex items-center gap-2 border border-neutral-800">
                        <img
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuD4EbFij4Zd5ecwokRZgQSDSeH71xqzGxv28jQiorCntF7pZ8eokz8zZoNrDrl0E9hsDEI0ST2LXM_hf0LInGcxfO4rGmEgbLipvHN9Yx7F50VA1wls0RmdlJOeAFxV5ZJDkERi0oN4Ri1VqgccjS6UQPSHb8sUx1kGLFg1iyLjviXLhsj2onblP_vb3G22gDBsgWjzIm9RHBbzSzTEyLyfTvuW4yKXcZVyN1QNi3QgstFdJuv9WWcX"
                          alt="Smoked Mezcalita"
                          className="w-11 h-11 rounded object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-[9px] text-white truncate">Smoked Mezcalita</span>
                            <span className="text-[9px] font-bold text-[#ffb74d]">₹550</span>
                          </div>
                          <span className="text-[7.5px] text-neutral-400 block mt-0.5">Agave, chili salt, charred lime</span>
                        </div>
                      </div>
                      <div className="bg-[#19191d] p-1.5 rounded-lg flex items-center gap-2 border border-neutral-800">
                        <img
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9zjTO1tO_10HD-TWLO3RRlOp8pqY_A6eOSxJXensUoHipMgD6PqNXiD-xrvVR_RUJvp26RC7xeO8qctD2JbRtOd-LWoHS1y_AdiSmM1uL-A_UphGFXmapP_9QYY16sRCm5Vo56yYGrK5g8N5mykypmGbgcwF__MBEE3_brb5VrdmnBVysFkuJZs1ab1dEtuvmg-mdWdW45M91PiACAeLwGfldXG_fz7evFu3wKKMZSrjKMfaX6wNL"
                          alt="Crimson Velvet"
                          className="w-11 h-11 rounded object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-[9px] text-white truncate">Crimson Velvet</span>
                            <span className="text-[9px] font-bold text-[#ffb74d]">₹620</span>
                          </div>
                          <span className="text-[7.5px] text-neutral-400 block mt-0.5">London dry gin, hibiscus</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 bg-[#121214] border-t border-neutral-800">
                      <div className="flex items-center justify-between text-[8px] bg-[#1e1e24] px-2 py-1.5 rounded-lg text-white">
                        <span>Split Table Tab</span>
                        <span className="font-bold text-[#ffb74d]">₹1,170 →</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-col justify-between flex-1 gap-3">
                  <p className="text-xs text-[#645d58]">
                    High-contrast dark palette crafted for cocktail bars, gastropubs, and late-night dining with reduced ambient glare.
                  </p>
                  <button type="button" disabled className="w-full py-2.5 rounded-xl bg-[#e9e1dd] text-[#645d58] text-xs font-semibold cursor-not-allowed">
                    Coming Soon
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Storefront Engine Matrix */}
            <div className="space-y-4 pt-4 border-t border-[#e9e1dd]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#645d58] block">
                  Synchronized Parameters
                </span>
                <h3 className="text-lg font-serif text-[#1e1b19] font-normal">Storefront Engine Matrix</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
                {/* Card 1: Store Availability */}
                <div className="bg-[#faf2ee] rounded-2xl p-4 flex flex-col justify-between shadow-xs border border-[#e9e1dd]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="material-symbols-outlined text-[#645d58] text-[20px]">store</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onlineStore) setShowOfflineModal(true);
                          else setOnlineStore(true);
                        }}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition ${
                          onlineStore ? "bg-[#e8f5e9] text-[#1b5e20]" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {onlineStore ? "Enabled" : "Paused"}
                      </button>
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-[#1e1b19]">Store Availability</div>
                      <div className="text-xs text-[#645d58] mt-0.5">
                        Status: {onlineStore ? "Accepting live orders" : "Storefront Paused"}
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#e9e1dd]/60 flex items-center gap-1.5 text-[11px] text-[#645d58]">
                    <span className={`w-2 h-2 rounded-full ${onlineStore ? "bg-[#1b5e20] animate-pulse" : "bg-amber-500"}`} />
                    <span>Realtime Sync Active</span>
                  </div>
                </div>

                {/* Card 2: Service Modes */}
                <div className="bg-[#faf2ee] rounded-2xl p-4 flex flex-col justify-between shadow-xs border border-[#e9e1dd]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="material-symbols-outlined text-[#645d58] text-[20px]">moped</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#f4ece8] text-[#1e1b19] text-xs font-semibold">3 Active</span>
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-[#1e1b19]">Service Modes</div>
                      <div className="text-[11px] text-[#645d58] mt-0.5 space-y-0.5">
                        <div>🛵 Delivery (Avg. 35 mins)</div>
                        <div>🥡 Takeaway (Avg. 20 mins)</div>
                        <div>🍽️ Table QR (18 Tables Live)</div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#e9e1dd]/60">
                    <button
                      type="button"
                      onClick={() => setActiveTab("availability")}
                      className="text-xs text-black font-semibold flex items-center gap-1 group cursor-pointer"
                    >
                      <span className="group-hover:underline">Configure Geofence Radius</span>
                      <span className="material-symbols-outlined text-[14px] leading-none transition-transform group-hover:translate-x-0.5 select-none" style={{ textDecoration: "none" }}>
                        chevron_right
                      </span>
                    </button>
                  </div>
                </div>

                {/* Card 3: Brand Palette */}
                <div className="bg-[#faf2ee] rounded-2xl p-4 flex flex-col justify-between shadow-xs border border-[#e9e1dd]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="material-symbols-outlined text-[#645d58] text-[20px]">palette</span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full shadow-xs border border-white" style={{ backgroundColor: primaryColor }} title={`Primary ${primaryColor}`} />
                        <span className="w-3.5 h-3.5 rounded-full shadow-xs border border-white" style={{ backgroundColor: secondaryColor }} title={`Secondary ${secondaryColor}`} />
                        <span className="w-3.5 h-3.5 rounded-full shadow-xs border border-[#cfc4c5]" style={{ backgroundColor: canvasBg }} title="Canvas" />
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-[#1e1b19]">Brand Palette &amp; Assets</div>
                      <div className="text-[11px] text-[#645d58] mt-0.5 font-mono">
                        Primary: {primaryColor}<br />
                        Secondary: {secondaryColor}
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#e9e1dd]/60">
                    <button
                      type="button"
                      onClick={() => setActiveTab("colors")}
                      className="text-xs text-black font-semibold flex items-center gap-1 group cursor-pointer"
                    >
                      <span className="group-hover:underline">Edit Hex &amp; Studio</span>
                      <span className="material-symbols-outlined text-[14px] leading-none transition-transform group-hover:translate-x-0.5 select-none" style={{ textDecoration: "none" }}>
                        chevron_right
                      </span>
                    </button>
                  </div>
                </div>

                {/* Card 4: Payment Rules */}
                <div className="bg-[#faf2ee] rounded-2xl p-4 flex flex-col justify-between shadow-xs border border-[#e9e1dd]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="material-symbols-outlined text-[#645d58] text-[20px]">payments</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#f4ece8] text-[#1e1b19] text-xs font-semibold">Ready</span>
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-[#1e1b19]">Payment Routing</div>
                      <div className="text-[11px] text-[#645d58] mt-0.5 space-y-0.5">
                        <div>UPI &amp; Card Gateway (Active)</div>
                        <div>Cash on Delivery (Enabled)</div>
                        <div>Pay at Cashier POS (Active)</div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#e9e1dd]/60">
                    <button
                      type="button"
                      onClick={() => setActiveTab("payments")}
                      className="text-xs text-black font-semibold flex items-center gap-1 group cursor-pointer"
                    >
                      <span className="group-hover:underline">Payment Gateway Keys</span>
                      <span className="material-symbols-outlined text-[14px] leading-none transition-transform group-hover:translate-x-0.5 select-none" style={{ textDecoration: "none" }}>
                        chevron_right
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Persistence Guarantee Notice */}
              <div className="p-4 bg-[#f4ece8] rounded-2xl flex items-start gap-3 border border-[#e9e1dd]">
                <span className="material-symbols-outlined text-[#645d58] text-[22px] mt-0.5">verified_user</span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#1e1b19]">Data Isolation &amp; Storefront State Persistence</span>
                  <p className="text-xs text-[#645d58] mt-0.5 leading-relaxed">
                    Theme changes update only the public storefront layout template. All menu items, modifier groups, customer orders, and tax configurations remain 100% intact.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* VIEW 1B: DEEP INTERACTIVE SIMULATOR (From Snippet 2)  */}
        {/* ===================================================== */}
        {activeTab === "inspector" && (
          <div className="flex flex-col w-full pb-8">
            {/* Top Breadcrumb & Status Bar (matching project design) */}
            <div className="pb-3 border-b border-[#e7e5e4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <nav
                  aria-label="Breadcrumb"
                  className="flex items-center text-[13px] text-[#5e5e5e] mb-1 gap-2 font-sans font-medium"
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab("themes")}
                    className="hover:text-[#141010] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>Themes</span>
                  </button>
                  <span className="text-[#928c8a]">&gt;</span>
                  <span className="text-[#141010] font-semibold">
                    Classic Bistro
                  </span>
                </nav>
                <h2 className="font-serif text-2xl text-[#0c0a09] font-normal leading-tight">
                  Classic Bistro Preview
                </h2>
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e8f5e9] text-[#1b5e20] text-xs font-semibold shadow-2xs whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-[#2e7d32]" />
                  LIVE ON STOREFRONT
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("themes")}
                  className="px-3.5 py-1.5 rounded-full border border-[#cfc4c5] text-[#1e1b19] font-semibold text-xs hover:bg-[#faf2ee] transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                  <span>Back to Themes</span>
                </button>
              </div>
            </div>

            {/* Split Canvas: Phone Preview Stage + Inspector Drawer */}
            <div className="pt-6 flex flex-col 2xl:flex-row items-center 2xl:items-start justify-center gap-6 2xl:gap-8 max-w-full">
              {/* Phone Staging Container */}
              <div className="w-full 2xl:flex-1 flex flex-col items-center justify-center min-w-0 max-w-full">
                <div className="w-full py-4 sm:py-6 px-2 sm:px-4 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-[#eee7e3]/60 to-[#f4ece8]/40 border border-[#e9e1dd] max-w-full overflow-hidden">
                  {/* Centered Device Switcher Toolbar directly above the screen */}
                  <div className="mb-4 sm:mb-6 flex items-center justify-center max-w-full w-full">
                    <div className="inline-flex items-center gap-1 bg-white p-1 rounded-full shadow-xs border border-[#e7e5e4] max-w-full overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => setDeviceMode("mobile")}
                        className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs cursor-pointer whitespace-nowrap ${
                          deviceMode === "mobile"
                            ? "bg-[#000000] text-white"
                            : "text-[#645d58] hover:text-[#1e1b19] hover:bg-[#faf2ee]"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">smartphone</span>
                        <span>Mobile <span className="opacity-70 text-[11px]">(390px)</span></span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeviceMode("tablet")}
                        className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          deviceMode === "tablet"
                            ? "bg-[#000000] text-white"
                            : "text-[#645d58] hover:text-[#1e1b19] hover:bg-[#faf2ee]"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">tablet</span>
                        <span>Tablet <span className="opacity-70 text-[11px]">(640px)</span></span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeviceMode("desktop")}
                        className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          deviceMode === "desktop"
                            ? "bg-[#000000] text-white"
                            : "text-[#645d58] hover:text-[#1e1b19] hover:bg-[#faf2ee]"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">desktop_windows</span>
                        <span>Desktop <span className="opacity-70 text-[11px]">(820px)</span></span>
                      </button>
                    </div>
                  </div>

                  {/* Physical Chassis */}
                  <div
                    className="relative transition-all duration-300 bg-[#1a1918] p-2 sm:p-2.5 shadow-[0_25px_60px_-15px_rgba(30,27,25,0.35)] flex flex-col max-w-full"
                    style={{
                      width: deviceMode === "mobile" ? "min(100%, 390px)" : deviceMode === "tablet" ? "min(100%, 640px)" : "min(100%, 820px)",
                      height: deviceMode === "mobile" ? "844px" : deviceMode === "tablet" ? "820px" : "780px",
                      maxHeight: "calc(100vh - 180px)",
                      minHeight: "560px",
                      borderRadius: deviceMode === "mobile" ? "48px" : "32px",
                    }}
                  >
                    <div className="w-full h-full bg-[#0a0a0a] rounded-[38px] sm:rounded-[42px] overflow-hidden flex flex-col relative shadow-inner">
                      {/* iOS Status Bar */}
                      <div className="h-11 w-full bg-[#fff8f5] flex items-center justify-between px-6 pt-1 select-none z-30 shrink-0">
                        <span className="text-[12px] font-semibold text-[#1e1b19]">9:41</span>
                        <div className="w-24 h-5 bg-black rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-[#1b1b1b] mr-auto ml-2" />
                          <div className="w-2.5 h-2.5 rounded-full bg-[#0d1b2a] mr-2" />
                        </div>
                        <div className="flex items-center gap-1.5 text-[#1e1b19]">
                          <span className="material-symbols-outlined text-[14px]">signal_cellular_4_bar</span>
                          <span className="material-symbols-outlined text-[14px]">wifi</span>
                          <span className="material-symbols-outlined text-[16px]">battery_full</span>
                        </div>
                      </div>

                      {/* Scrollable Customer Viewport Screen */}
                      <div className="flex-1 w-full overflow-y-auto bg-[#fff8f5] flex flex-col relative text-[11px] text-[#1e1b19]">
                        {/* STEP 1: STORE HOME & MENU */}
                        {journeyStep === "home" && (
                          <div className="flex flex-col w-full pb-24">
                            {/* Brand Header */}
                            <div className="px-4 pt-3 pb-3 bg-[#fff8f5] flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-12 h-12 rounded-full text-white flex items-center justify-center font-serif text-lg font-bold shadow-md"
                                    style={{ backgroundColor: primaryColor }}
                                  >
                                    SG
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1">
                                      <h1 className="font-serif text-base text-[#1e1b19] font-bold">Spice Garden Bistro</h1>
                                      <span className="material-symbols-outlined text-[16px] text-[#2e7d32]">verified</span>
                                    </div>
                                    <span className="text-[11px] text-[#645d58] truncate">📍 12, Linking Road, Bandra West</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end">
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1b5e20] text-white text-[11px] font-bold">
                                    <span>4.8</span>
                                    <span className="material-symbols-outlined text-[12px]">star</span>
                                  </div>
                                  <span className="text-[10px] text-[#645d58] mt-0.5">1,240 reviews</span>
                                </div>
                              </div>

                              {/* Service Mode Selector Pill */}
                              <div className="mt-1 p-2 rounded-xl bg-[#f4ece8] flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="material-symbols-outlined text-[18px] text-[#1e1b19]">moped</span>
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] uppercase font-bold text-[#1e1b19]">Delivery</span>
                                      <span className="text-[10px] text-[#645d58]">• 25-35 min</span>
                                    </div>
                                    <span className="text-[10px] text-[#645d58] truncate">Deliver to Flat 402, Sea Green Apts</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setJourneyStep("mode")}
                                  className="px-2.5 py-1 rounded-full bg-[#e9e1dd] text-[#1e1b19] text-[10px] font-bold hover:bg-[#eee7e3] shrink-0"
                                >
                                  Change
                                </button>
                              </div>
                            </div>

                            {/* Search bar */}
                            <div className="px-4 py-1 sticky top-0 bg-[#fff8f5]/95 backdrop-blur-md z-20">
                              <div className="flex items-center gap-2 bg-[#f4ece8] px-3 py-1.5 rounded-full shadow-inner">
                                <span className="material-symbols-outlined text-[16px] text-[#645d58]">search</span>
                                <input
                                  className="bg-transparent border-none outline-none text-[11px] text-[#1e1b19] placeholder:text-[#645d58] w-full"
                                  placeholder="Search dishes, drinks, chef specials..."
                                  readOnly
                                  type="text"
                                />
                              </div>
                            </div>

                            {/* Dietary Filters */}
                            <div className="px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                              <button
                                type="button"
                                onClick={() => setDietaryFilter(dietaryFilter === "veg" ? "all" : "veg")}
                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold transition-all shadow-xs shrink-0 ${
                                  dietaryFilter === "veg" ? "bg-[#1b5e20] text-white" : "bg-[#f4ece8] text-[#1e1b19]"
                                }`}
                              >
                                <span className="w-2 h-2 rounded-xs bg-[#4caf50]" />
                                <span>Veg Only</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDietaryFilter(dietaryFilter === "nonveg" ? "all" : "nonveg")}
                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold transition-all shrink-0 ${
                                  dietaryFilter === "nonveg" ? "bg-[#ba1a1a] text-white" : "bg-[#f4ece8] text-[#1e1b19]"
                                }`}
                              >
                                <span className="w-2 h-2 rounded-xs bg-[#e53935]" />
                                <span>Non-Veg</span>
                              </button>
                              <span className="px-3 py-1 rounded-full bg-[#f4ece8] text-[#1e1b19] text-[10px] font-medium shrink-0">
                                🌶️ Chef&apos;s Spicy
                              </span>
                              <span className="px-3 py-1 rounded-full bg-[#f4ece8] text-[#1e1b19] text-[10px] font-medium shrink-0">
                                ⭐ Best Rated
                              </span>
                            </div>

                            {/* Promotional Hero Banner */}
                            <div className="px-4 pt-2 pb-1">
                              <div
                                className="rounded-2xl p-3 text-white flex items-center justify-between shadow-md relative overflow-hidden"
                                style={{ backgroundColor: secondaryColor }}
                              >
                                <div className="flex flex-col z-10 max-w-[210px]">
                                  <span className="text-[9px] tracking-widest uppercase bg-white text-black px-2 py-0.5 rounded-full self-start font-bold">
                                    LIMITED OFFER
                                  </span>
                                  <span className="font-serif text-lg font-bold mt-1 text-white">Flat 20% OFF</span>
                                  <span className="text-[10px] text-white/90">
                                    Above ₹499 with coupon <strong className="font-mono">FESTIVE20</strong>
                                  </span>
                                </div>
                                <div className="w-18 h-18 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden z-10">
                                  <img
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBirsqA_mBjsf40G_b_4b4S6IjrKJMjJ7UZrcghE5nUOqqRq6j915EFTgWe4d-j-unVGlvcCAXlMXRqBY5ojUZWS_yFXO8a9MDtK61WhvFUJ7c8Ok1y5Z02e7QuZ5y2XHO8WME3sFlJEbGedSNhLTKB0vKgOF8zP0QHNgcd8N1MFfLdtX9WOb1XHGr8klWBIw-vnxW-UWqbae1-ZNyKRlQ9Fhwa-IsM2YkqF5ofXBqkBjCkUdWpEAqh"
                                    alt="Kebab Platter"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Menu Items List */}
                            <div className="px-4 pt-3 flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <h2 className="font-serif text-sm font-bold text-[#1e1b19]">Bestsellers &amp; Chef Specials</h2>
                                <span className="text-[10px] text-[#645d58]">3 items</span>
                              </div>

                              {/* Item 1 */}
                              {(dietaryFilter === "all" || dietaryFilter === "veg") && (
                                <div className="p-3 rounded-xl bg-white flex gap-3 items-center justify-between shadow-xs border border-[#e9e1dd]">
                                  <div className="flex-1 flex flex-col pr-2">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="w-2.5 h-2.5 rounded-xs bg-[#4caf50]" />
                                      <span className="text-[9px] text-[#645d58] uppercase font-semibold">Bestseller</span>
                                    </div>
                                    <h3 className="text-xs font-bold text-[#1e1b19]">Tandoori Paneer Tikka</h3>
                                    <p className="text-[10px] text-[#645d58] line-clamp-2 mt-0.5">
                                      Charcoal-grilled cottage cheese cubes infused with aromatic tandoori masala.
                                    </p>
                                    <span className="text-xs font-bold text-[#1e1b19] mt-1 font-mono">₹280.00</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-1 shrink-0">
                                    <div className="w-18 h-18 rounded-lg overflow-hidden bg-[#f4ece8]">
                                      <img
                                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAghnIAI6cfkdGyjWj-3Yex1onxdIhzJzJbeEHSG1fwPzHf9eGIPb9Q_uD6mCTbigAU9EvBbGFF_6EHSlMjsJUw_05Uo1t4zjZpkO0ZJ6XahPPzFaE3r-gFzPnzgia1rfzBBLop1oLJx0L1MRg0-9hxCmY_6_pKyZzl1Mopseyew0YCf5CuMLQduA0AY6B_PkawraG9IRnC2qaXBuORXBSS6_VyqKvr7GCeXwvx8Prm_bB5UJB44qFP"
                                        alt="Paneer Tikka"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setJourneyStep("modifiers")}
                                      className="w-18 py-1 rounded-full text-white text-[10px] font-bold shadow-xs cursor-pointer"
                                      style={{ backgroundColor: primaryColor }}
                                    >
                                      + ADD
                                    </button>
                                    <span className="text-[8px] text-[#645d58]">Customizable</span>
                                  </div>
                                </div>
                              )}

                              {/* Item 2 */}
                              {(dietaryFilter === "all" || dietaryFilter === "nonveg") && (
                                <div className="p-3 rounded-xl bg-white flex gap-3 items-center justify-between shadow-xs border border-[#e9e1dd]">
                                  <div className="flex-1 flex flex-col pr-2">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="w-2.5 h-2.5 rounded-xs bg-[#e53935]" />
                                      <span className="text-[9px] text-[#645d58] uppercase font-semibold">Chef Signature</span>
                                    </div>
                                    <h3 className="text-xs font-bold text-[#1e1b19]">Butter Chicken Masala</h3>
                                    <p className="text-[10px] text-[#645d58] line-clamp-2 mt-0.5">
                                      Slow-simmered tender chicken pieces in velvety spiced tomato and cashew butter gravy.
                                    </p>
                                    <span className="text-xs font-bold text-[#1e1b19] mt-1 font-mono">₹420.00</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-1 shrink-0">
                                    <div className="w-18 h-18 rounded-lg overflow-hidden bg-[#f4ece8]">
                                      <img
                                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKY9ZKMKGUUo-qPwcZelzZlcBIe0DNOUz2wTcPJIs_b2FNTOdjjHI0hXZHjxjurg_icHy903dIBk5hnpMezJthle_uB0OI_bpW21D0sfPXlU1SBKAaQj43ovcTB1FQVGHdFXP29ElBzqIqm-v6yMb3CJ--tKFV-zKIxPfvXpF7uJfrdq-MqG84ocEp_flq3bj8riHdKDgfSkrONg2A_a4p9jrVOwYmnKU0SV3UqeZGC3lkk8_TwrSL"
                                        alt="Butter Chicken"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div
                                      className="w-18 py-0.5 px-1.5 rounded-full text-white flex items-center justify-between text-[10px] font-bold shadow-xs"
                                      style={{ backgroundColor: primaryColor }}
                                    >
                                      <button type="button" className="text-white hover:opacity-75">-</button>
                                      <span>1</span>
                                      <button type="button" className="text-white hover:opacity-75">+</button>
                                    </div>
                                    <span className="text-[8px] text-[#645d58]">In Cart</span>
                                  </div>
                                </div>
                              )}

                              {/* Item 3 */}
                              {(dietaryFilter === "all" || dietaryFilter === "veg") && (
                                <div className="p-3 rounded-xl bg-white flex gap-3 items-center justify-between shadow-xs border border-[#e9e1dd]">
                                  <div className="flex-1 flex flex-col pr-2">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="w-2.5 h-2.5 rounded-xs bg-[#4caf50]" />
                                      <span className="text-[9px] text-[#645d58] uppercase font-semibold">Tandoor</span>
                                    </div>
                                    <h3 className="text-xs font-bold text-[#1e1b19]">Garlic Butter Naan (2 pcs)</h3>
                                    <p className="text-[10px] text-[#645d58] line-clamp-2 mt-0.5">
                                      Traditional tandoor-baked leavened bread brushed with fresh garlic herb butter.
                                    </p>
                                    <span className="text-xs font-bold text-[#1e1b19] mt-1 font-mono">₹120.00</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-1 shrink-0">
                                    <div className="w-18 h-18 rounded-lg overflow-hidden bg-[#f4ece8]">
                                      <img
                                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxKXFtTSib6FNbtW4EqAWYix99kftKgywWoDk2xECSwY6O9bl9W-A5eGkGoR5CfdEZw0LD97yBVQ8WzBwEHTJAiu5ReM0NliF2GbAR54742uA645C9yOwIGk6_MhQ1YK3hcQdaJ1_GFPHx-F3FumenDvwLUhgTPjk4rCfVkKf2MlAakLA0ljRrKzbhv1jNU6z8tgoIQcckCPiNbYoUga4dJazBZb3rmeyZhtGCWXymb3iPlTVZ10wG"
                                        alt="Garlic Naan"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div
                                      className="w-18 py-0.5 px-1.5 rounded-full text-white flex items-center justify-between text-[10px] font-bold shadow-xs"
                                      style={{ backgroundColor: primaryColor }}
                                    >
                                      <button type="button" className="text-white hover:opacity-75">-</button>
                                      <span>2</span>
                                      <button type="button" className="text-white hover:opacity-75">+</button>
                                    </div>
                                    <span className="text-[8px] text-[#645d58]">In Cart</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* STEP 2: SERVICE MODE SELECTION */}
                        {journeyStep === "mode" && (
                          <div className="flex flex-col w-full p-4 pb-24">
                            <div className="flex items-center justify-between mb-2">
                              <h2 className="font-serif text-base font-bold text-[#1e1b19]">Choose Order Mode</h2>
                              <button
                                type="button"
                                onClick={() => setJourneyStep("home")}
                                className="p-1 rounded-full hover:bg-[#f4ece8] text-[#645d58]"
                              >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            </div>
                            <p className="text-[11px] text-[#645d58] mb-4">
                              Select how you would like to enjoy your meal from Spice Garden Bistro.
                            </p>

                            <div className="flex flex-col gap-3">
                              {/* Mode 1: Delivery */}
                              <div className="p-3.5 rounded-xl bg-white border-2 border-[#1e1b19] flex items-center gap-3 shadow-xs cursor-pointer">
                                <div className="w-9 h-9 rounded-full bg-[#1e1b19] text-white flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-[18px]">moped</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-[#1e1b19]">Doorstep Delivery</span>
                                    <span className="material-symbols-outlined text-[#2e7d32] text-[18px]">radio_button_checked</span>
                                  </div>
                                  <span className="text-[10px] text-[#645d58]">25-35 mins • Live GPS tracking</span>
                                </div>
                              </div>

                              {/* Mode 2: Takeaway */}
                              <div className="p-3.5 rounded-xl bg-white border border-[#e9e1dd] hover:bg-[#f4ece8] flex items-center gap-3 transition-colors cursor-pointer">
                                <div className="w-9 h-9 rounded-full bg-[#f4ece8] text-[#1e1b19] flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-[#1e1b19]">Curbside Takeaway</span>
                                    <span className="material-symbols-outlined text-[#645d58] text-[18px]">radio_button_unchecked</span>
                                  </div>
                                  <span className="text-[10px] text-[#645d58]">Ready in 15-20 min • Zero packing charges</span>
                                </div>
                              </div>

                              {/* Mode 3: Dine-In Table */}
                              <div className="p-3.5 rounded-xl bg-white border border-[#e9e1dd] hover:bg-[#f4ece8] flex items-center gap-3 transition-colors cursor-pointer">
                                <div className="w-9 h-9 rounded-full bg-[#f4ece8] text-[#1e1b19] flex items-center justify-center shrink-0">
                                  <span className="material-symbols-outlined text-[18px]">restaurant</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-[#1e1b19]">Dine-In at Bistro</span>
                                    <span className="material-symbols-outlined text-[#645d58] text-[18px]">radio_button_unchecked</span>
                                  </div>
                                  <span className="text-[10px] text-[#645d58]">Table T-04 linked • Pay at table</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setJourneyStep("home")}
                              className="mt-6 w-full py-2.5 rounded-full text-white font-bold text-xs shadow-md"
                              style={{ backgroundColor: primaryColor }}
                            >
                              Confirm Delivery Mode
                            </button>
                          </div>
                        )}

                        {/* STEP 3: MODIFIERS MODAL */}
                        {journeyStep === "modifiers" && (
                          <div className="flex flex-col w-full p-4 pb-24">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-xs bg-[#4caf50]" />
                                <h2 className="font-serif text-sm font-bold text-[#1e1b19]">Customize Paneer Tikka</h2>
                              </div>
                              <button
                                type="button"
                                onClick={() => setJourneyStep("home")}
                                className="p-1 rounded-full hover:bg-[#f4ece8] text-[#645d58]"
                              >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                            </div>

                            {/* Portion Size */}
                            <div className="mb-3.5">
                              <span className="text-[10px] uppercase font-bold text-[#1e1b19] tracking-wider block mb-1.5">
                                Choose Portion Size (Required)
                              </span>
                              <div className="space-y-1.5">
                                <div
                                  onClick={() => setModifierPortion("regular")}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer ${
                                    modifierPortion === "regular" ? "border-black bg-white shadow-xs" : "border-[#e9e1dd] bg-[#faf2ee]"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] text-[#2e7d32]">
                                      {modifierPortion === "regular" ? "radio_button_checked" : "radio_button_unchecked"}
                                    </span>
                                    <span className="text-xs font-medium">Regular (6 pieces)</span>
                                  </div>
                                  <span className="font-mono text-xs font-bold">₹280.00</span>
                                </div>
                                <div
                                  onClick={() => setModifierPortion("large")}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer ${
                                    modifierPortion === "large" ? "border-black bg-white shadow-xs" : "border-[#e9e1dd] bg-[#faf2ee]"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] text-[#645d58]">
                                      {modifierPortion === "large" ? "radio_button_checked" : "radio_button_unchecked"}
                                    </span>
                                    <span className="text-xs font-medium">Large Sharing (10 pieces)</span>
                                  </div>
                                  <span className="font-mono text-xs text-[#645d58]">+ ₹140.00</span>
                                </div>
                              </div>
                            </div>

                            {/* Spice Level */}
                            <div className="mb-3.5">
                              <span className="text-[10px] uppercase font-bold text-[#1e1b19] tracking-wider block mb-1.5">
                                Spice Level (Required)
                              </span>
                              <div className="grid grid-cols-3 gap-2">
                                {(["mild", "medium", "hot"] as const).map((lvl) => (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => setModifierSpice(lvl)}
                                    className={`py-2 rounded-xl text-center text-[10px] font-bold transition shadow-xs ${
                                      modifierSpice === lvl ? "bg-[#1e1b19] text-white" : "bg-[#f4ece8] text-[#1e1b19]"
                                    }`}
                                  >
                                    {lvl === "mild" ? "Mild 🟢" : lvl === "medium" ? "Medium 🌶️" : "Bistro Hot 🔥"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Accompaniments */}
                            <div className="mb-4">
                              <span className="text-[10px] uppercase font-bold text-[#1e1b19] tracking-wider block mb-1.5">
                                Add Accompaniments (Optional)
                              </span>
                              <div className="space-y-1.5">
                                <div
                                  onClick={() => setExtraChutney(!extraChutney)}
                                  className="p-2.5 rounded-xl bg-white border border-[#e9e1dd] flex items-center justify-between cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-[#2e7d32]">
                                      {extraChutney ? "check_box" : "check_box_outline_blank"}
                                    </span>
                                    <span className="text-[11px]">Extra Mint Chutney Dip (50ml)</span>
                                  </div>
                                  <span className="font-mono text-xs">+ ₹25.00</span>
                                </div>
                                <div
                                  onClick={() => setExtraSalad(!extraSalad)}
                                  className="p-2.5 rounded-xl bg-white border border-[#e9e1dd] flex items-center justify-between cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-[#645d58]">
                                      {extraSalad ? "check_box" : "check_box_outline_blank"}
                                    </span>
                                    <span className="text-[11px]">Lachha Masala Onion Salad</span>
                                  </div>
                                  <span className="font-mono text-xs">+ ₹35.00</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setJourneyStep("cart");
                                showToast("Paneer Tikka customized and added to Cart!");
                              }}
                              className="w-full py-2.5 rounded-full text-white font-bold text-xs shadow-md flex items-center justify-between px-4"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <span>Add Item to Order</span>
                              <span className="font-mono">
                                ₹{modifierPortion === "regular" ? (280 + (extraChutney ? 25 : 0) + (extraSalad ? 35 : 0)) : (420 + (extraChutney ? 25 : 0) + (extraSalad ? 35 : 0))}.00
                              </span>
                            </button>
                          </div>
                        )}

                        {/* STEP 4: CART & BILL SUMMARY */}
                        {journeyStep === "cart" && (
                          <div className="flex flex-col w-full p-4 pb-24">
                            <div className="flex items-center justify-between mb-3">
                              <h2 className="font-serif text-base font-bold text-[#1e1b19]">Your Order Summary</h2>
                              <span className="px-2 py-0.5 rounded-full bg-[#f4ece8] text-[10px] font-bold text-[#645d58]">3 Items</span>
                            </div>

                            {/* Items list */}
                            <div className="space-y-2 mb-4">
                              <div className="p-2.5 rounded-xl bg-white border border-[#e9e1dd] flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs text-[#1e1b19]">1 × Butter Chicken Masala</span>
                                  <span className="text-[10px] text-[#645d58]">Boneless Makhani Gravy</span>
                                </div>
                                <span className="font-mono text-xs font-bold">₹420.00</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white border border-[#e9e1dd] flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs text-[#1e1b19]">2 × Garlic Butter Naan</span>
                                  <span className="text-[10px] text-[#645d58]">Fresh Clay Tandoori</span>
                                </div>
                                <span className="font-mono text-xs font-bold">₹240.00</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white border border-[#e9e1dd] flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs text-[#1e1b19]">1 × Tandoori Paneer Tikka</span>
                                  <span className="text-[10px] text-[#645d58]">Medium Spice + Extra Chutney</span>
                                </div>
                                <span className="font-mono text-xs font-bold">₹305.00</span>
                              </div>
                            </div>

                            {/* Bill Details Breakdown */}
                            <div className="p-3.5 rounded-xl bg-[#f4ece8] mb-4 space-y-1.5 text-xs text-[#1e1b19] border border-[#e9e1dd]">
                              <span className="text-[10px] uppercase font-bold text-[#645d58] tracking-wider block mb-1">
                                Bill Breakdown
                              </span>
                              <div className="flex justify-between">
                                <span className="text-[#645d58]">Item Total</span>
                                <span className="font-mono">₹965.00</span>
                              </div>
                              <div className="flex justify-between text-[#2e7d32] font-semibold">
                                <span>Discount (FESTIVE20)</span>
                                <span className="font-mono">- ₹193.00</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#645d58]">GST &amp; Restaurant Tax (5%)</span>
                                <span className="font-mono">₹38.60</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#645d58]">Delivery Fee</span>
                                <span className="font-mono">₹25.00</span>
                              </div>
                              <div className="pt-2 border-t border-[#cfc4c5]/60 flex justify-between text-sm font-bold text-[#1e1b19]">
                                <span>To Pay</span>
                                <span className="font-mono text-[#1b5e20]">₹835.60</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => showToast("Validated: Proceeding to UPI & Gateway routing!")}
                              className="w-full py-2.5 rounded-full text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <span>Proceed to Payment</span>
                              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </button>
                          </div>
                        )}

                        {/* STEP 5: TABLE QR DINE-IN */}
                        {journeyStep === "table" && (
                          <div className="flex flex-col w-full p-4 pb-24 items-center text-center">
                            <div className="w-14 h-14 rounded-full bg-[#f4ece8] text-[#1e1b19] flex items-center justify-center mb-2 shadow-inner">
                              <span className="material-symbols-outlined text-[28px]">table_restaurant</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-[#2e7d32] tracking-wider">
                              Connected Session
                            </span>
                            <h2 className="font-serif text-base font-bold text-[#1e1b19] mt-0.5">Table T-04 (Bistro Patio)</h2>
                            <p className="text-[10px] text-[#645d58] mt-1 max-w-[260px]">
                              Orders placed here route straight to Station KDS 1 without cashier intervention.
                            </p>

                            <div className="w-full mt-4 p-3 rounded-xl bg-white border border-[#e9e1dd] text-left">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-[#1e1b19]">Current Running Bill</span>
                                <span className="px-2 py-0.5 rounded-full bg-[#e8f5e9] text-[#1b5e20] text-[9px] font-bold">
                                  KITCHEN PREPARING
                                </span>
                              </div>
                              <div className="space-y-1 text-[11px] text-[#645d58]">
                                <div className="flex justify-between">
                                  <span>1 × Masala Lemon Soda</span>
                                  <span className="font-mono text-[#1e1b19]">₹95.00</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>1 × Crispy Corn Chaat</span>
                                  <span className="font-mono text-[#1e1b19]">₹180.00</span>
                                </div>
                              </div>
                              <div className="pt-2 mt-2 border-t border-[#e9e1dd] flex justify-between text-xs font-bold text-[#1e1b19]">
                                <span>Table Subtotal:</span>
                                <span className="font-mono">₹275.00</span>
                              </div>
                            </div>

                            <div className="w-full flex gap-2 mt-4">
                              <button
                                type="button"
                                onClick={() => setJourneyStep("home")}
                                className="flex-1 py-2 rounded-full text-white text-xs font-semibold shadow-xs"
                                style={{ backgroundColor: primaryColor }}
                              >
                                + Add More Items
                              </button>
                              <button
                                type="button"
                                onClick={() => showToast("Waiter summoned for Table T-04")}
                                className="px-4 py-2 rounded-full bg-[#f4ece8] text-[#1e1b19] text-xs font-semibold hover:bg-[#eee7e3]"
                              >
                                Call Waiter
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Sticky Bottom Cart Bar (visible on Home) */}
                        {journeyStep === "home" && (
                          <div
                            onClick={() => setJourneyStep("cart")}
                            className="absolute bottom-3 left-3 right-3 p-2 rounded-full text-white shadow-xl flex items-center justify-between z-30 cursor-pointer"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <div className="flex items-center gap-2 pl-2">
                              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px]">
                                3
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold">3 Items • ₹820.00</span>
                                <span className="text-[8px] text-white/80">Plus taxes &amp; fees</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-bold bg-white text-black px-3 py-1 rounded-full">
                              <span>View Cart</span>
                              <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Home Indicator */}
                      <div className="h-5 w-full bg-[#fff8f5] flex items-center justify-center pb-1 z-30 shrink-0">
                        <div className="w-32 h-1 bg-black/20 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right-Hand Inspector Drawer */}
              <div className="w-full 2xl:w-88 grid grid-cols-1 md:grid-cols-2 2xl:flex 2xl:flex-col gap-4 shrink-0">
                {/* Theme Architecture Card */}
                <div className="bg-[#faf2ee] p-4 rounded-2xl shadow-xs border border-[#e9e1dd]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-[#645d58] tracking-wider">
                      Theme Architecture
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#f4ece8] text-[#1e1b19] font-mono text-[10px]">SPA v1.2</span>
                  </div>
                  <h3 className="text-base font-serif font-bold text-[#1e1b19]">Classic Bistro (Theme 1)</h3>
                  <p className="text-xs text-[#645d58] mt-1 leading-relaxed">
                    Single-column infinite scroll optimized for touch dining terminals and mobile ordering.
                  </p>
                  <div className="mt-3 pt-3 border-t border-[#e9e1dd] space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#645d58]">Accent Primary:</span>
                      <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold">
                        <span className="w-3 h-3 rounded-full inline-block shadow-xs" style={{ backgroundColor: primaryColor }} />
                        {primaryColor}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#645d58]">Typography Pair:</span>
                      <span className="font-mono text-[11px] text-[#1e1b19]">EB Garamond + Inter</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#645d58]">Layout Engine:</span>
                      <span className="font-mono text-[11px] text-[#1e1b19]">Sticky Categories + Cart HUD</span>
                    </div>
                  </div>
                </div>

                {/* Scenario Simulations */}
                <div className="bg-[#faf2ee] p-4 rounded-2xl shadow-xs border border-[#e9e1dd]">
                  <span className="text-[10px] uppercase font-bold text-[#645d58] tracking-wider block mb-2">
                    Customer State Testing
                  </span>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setJourneyStep("modifiers")}
                      className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-[#f4ece8] transition-colors flex items-center justify-between text-xs font-semibold text-[#1e1b19] border border-[#e9e1dd]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-[#645d58]">tune</span>
                        <span>Trigger Modifier Modal Preview</span>
                      </span>
                      <span className="material-symbols-outlined text-[14px] text-[#645d58]">chevron_right</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setJourneyStep("table")}
                      className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-[#f4ece8] transition-colors flex items-center justify-between text-xs font-semibold text-[#1e1b19] border border-[#e9e1dd]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-[#645d58]">qr_code_2</span>
                        <span>Simulate Table QR Dine-In (T-04)</span>
                      </span>
                      <span className="material-symbols-outlined text-[14px] text-[#645d58]">chevron_right</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast("Validated: Scheduled Delivery verified against Kitchen Hours (11am - 11pm)")}
                      className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-[#f4ece8] transition-colors flex items-center justify-between text-xs font-semibold text-[#1e1b19] border border-[#e9e1dd]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-[#645d58]">schedule</span>
                        <span>Test Scheduled Delivery Validation</span>
                      </span>
                      <span className="material-symbols-outlined text-[14px] text-[#645d58]">chevron_right</span>
                    </button>
                  </div>
                </div>

                {/* Assurance Card */}
                <div className="bg-[#f4ece8] p-4 rounded-2xl shadow-xs border border-[#e9e1dd]">
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[20px] text-[#2e7d32] shrink-0 mt-0.5">verified_user</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#1e1b19]">Non-Destructive Live Assurance</span>
                      <p className="text-[11px] text-[#645d58] mt-1 leading-relaxed">
                        Theme switching updates only public storefront views. Kitchen tickets, live orders, and ledgers remain strictly untouched.
                      </p>
                    </div>
                  </div>
                </div>

                {/* QR Code Quick Card */}
                <div className="bg-[#faf2ee] p-4 rounded-2xl shadow-xs border border-[#e9e1dd] flex items-center gap-3">
                  <div className="w-14 h-14 bg-white p-1 rounded-xl flex items-center justify-center shrink-0 shadow-xs border border-[#e9e1dd]">
                    <svg className="w-full h-full text-black" fill="currentColor" viewBox="0 0 100 100">
                      <rect x="0" y="0" width="30" height="30" fill="currentColor" />
                      <rect x="5" y="5" width="20" height="20" fill="white" />
                      <rect x="10" y="10" width="10" height="10" fill="currentColor" />
                      <rect x="70" y="0" width="30" height="30" fill="currentColor" />
                      <rect x="75" y="5" width="20" height="20" fill="white" />
                      <rect x="80" y="10" width="10" height="10" fill="currentColor" />
                      <rect x="0" y="70" width="30" height="30" fill="currentColor" />
                      <rect x="5" y="75" width="20" height="20" fill="white" />
                      <rect x="10" y="80" width="10" height="10" fill="currentColor" />
                      <rect x="40" y="10" width="10" height="20" fill="currentColor" />
                      <rect x="40" y="40" width="20" height="20" fill="currentColor" />
                      <rect x="70" y="45" width="25" height="10" fill="currentColor" />
                      <rect x="70" y="65" width="10" height="25" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#1e1b19] uppercase">Scan on Physical Device</span>
                    <p className="text-[10px] text-[#645d58]">Open camera on your smartphone to test real cart responsiveness.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* VIEW 2: STOREFRONT COLOR STUDIO (From Snippet 3)      */}
        {/* ===================================================== */}
        {activeTab === "colors" && (
          <div className="pt-1 pb-4 px-1 sm:px-2 grid grid-cols-1 xl:grid-cols-12 gap-5 max-w-full overflow-hidden">
            <div className="xl:col-span-12 flex items-center justify-between pb-2 border-b border-[#e7e5e4] flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("themes")}
                  className="text-xs font-semibold text-[#645d58] hover:text-[#1e1b19] hover:underline transition-colors cursor-pointer"
                  title="Return to Themes Gallery"
                >
                  Themes
                </button>
                <span className="text-[#cfc4c5] text-xs select-none">/</span>
                <span className="text-xs font-serif font-bold text-[#1e1b19]">
                  Storefront Color Studio
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[#2e7d32] text-xs font-semibold bg-[#e8f5e9] px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-[#2e7d32] animate-pulse" />
                <span>Reactive Realtime Preview</span>
              </div>
            </div>
            {/* Left Column: Controls & Palette Workspace (7 cols) */}
            <div className="xl:col-span-7 space-y-6 min-w-0">
              {/* Section A: Curated Brand Presets */}
              <section className="bg-[#faf2ee] p-4 sm:p-5 rounded-2xl shadow-xs border border-[#e9e1dd]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-serif text-[#1e1b19] font-bold">Curated Brand Presets</h2>
                    <p className="text-xs text-[#645d58]">Apply a coordinated luxury culinary theme or tune individual tokens.</p>
                  </div>
                  <span className="px-2.5 py-1 bg-[#e9e1dd] text-[#645d58] rounded-full text-xs font-semibold shrink-0">
                    5 Presets Ready
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5 sm:gap-3 pt-1">
                  {Object.entries(PRESET_PALETTES).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePresetSelect(key)}
                      className={`text-left p-3 rounded-xl transition-all flex flex-col justify-between cursor-pointer border flex-1 min-w-[130px] sm:min-w-[135px] ${
                        selectedPreset === key
                          ? "bg-white border-2 border-black shadow-xs"
                          : "bg-[#f4ece8] border-transparent hover:bg-white hover:border-[#e9e1dd]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1">
                          <span className="w-3.5 h-3.5 rounded-full shadow-xs shrink-0" style={{ backgroundColor: p.primary }} />
                          <span className="w-3.5 h-3.5 rounded-full shadow-xs shrink-0" style={{ backgroundColor: p.secondary }} />
                          <span className="w-3.5 h-3.5 rounded-full shadow-xs shrink-0 border border-black/10" style={{ backgroundColor: p.bg }} />
                        </div>
                        {selectedPreset === key ? (
                          <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[11px] leading-none">check</span>
                          </span>
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0 opacity-30" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1e1b19] leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                          {p.label}
                        </div>
                        <div className="text-[10px] text-[#645d58] mt-0.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                          {p.sub}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Section B: Global Brand Tokens */}
              <section className="bg-[#faf2ee] p-4 sm:p-5 rounded-2xl shadow-xs border border-[#e9e1dd] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-serif text-[#1e1b19] font-bold">Global Brand Tokens</h2>
                    <p className="text-xs text-[#645d58]">Core values inherited across public menu cards, buttons, badges, and headers.</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#2e7d32] text-xs font-semibold shrink-0">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>Contrast Protected</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Token 1: Primary Accent */}
                  <div className="p-3.5 bg-white rounded-xl shadow-xs border border-[#e9e1dd] flex flex-col justify-between gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] text-[#645d58] uppercase font-bold tracking-wider block">Token 01</span>
                        <span className="text-xs font-bold text-[#1e1b19]">Primary Accent</span>
                        <p className="text-[11px] text-[#645d58]">Main CTA pills, active category, drawer triggers</p>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-white text-[10px] font-bold shadow-xs shrink-0"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Sample CTA
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="relative flex items-center flex-1 min-w-0 bg-[#f4ece8] rounded-full px-2.5 sm:px-3 py-1.5 border border-[#cfc4c5]/40">
                        <span className="text-[#645d58] text-xs font-mono mr-1 shrink-0">#</span>
                        <input
                          className="hex-token-input w-full min-w-0 bg-transparent font-mono text-xs text-[#1e1b19] uppercase outline-none font-bold"
                          style={{ backgroundColor: "transparent", background: "none", border: "none", outline: "none", boxShadow: "none" }}
                          maxLength={6}
                          type="text"
                          value={primaryColor.replace("#", "")}
                          onChange={(e) => {
                            const val = "#" + e.target.value.replace(/[^0-9A-Fa-f]/g, "");
                            setPrimaryColor(val);
                          }}
                        />
                      </div>
                      <label className="cursor-pointer relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden shadow-xs shrink-0 border border-black/10">
                        <input
                          type="color"
                          value={isValidHex(primaryColor) ? primaryColor : "#418244"}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0"
                        />
                        <div className="w-full h-full" style={{ backgroundColor: primaryColor }} />
                      </label>
                      <button
                        type="button"
                        onClick={() => setPrimaryColor(DEFAULT_PRIMARY)}
                        className="p-1 text-[#645d58] hover:text-[#1e1b19] shrink-0"
                        title="Reset token"
                      >
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                      </button>
                    </div>
                  </div>

                  {/* Token 2: Secondary Accent */}
                  <div className="p-3.5 bg-white rounded-xl shadow-xs border border-[#e9e1dd] flex flex-col justify-between gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] text-[#645d58] uppercase font-bold tracking-wider block">Token 02</span>
                        <span className="text-xs font-bold text-[#1e1b19]">Secondary Accent</span>
                        <p className="text-[11px] text-[#645d58]">Festive discounts, special tags &amp; urgent alerts</p>
                      </div>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold shadow-xs shrink-0"
                        style={{ backgroundColor: secondaryColor }}
                      >
                        20% OFF
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="relative flex items-center flex-1 min-w-0 bg-[#f4ece8] rounded-full px-2.5 sm:px-3 py-1.5 border border-[#cfc4c5]/40">
                        <span className="text-[#645d58] text-xs font-mono mr-1 shrink-0">#</span>
                        <input
                          className="hex-token-input w-full min-w-0 bg-transparent font-mono text-xs text-[#1e1b19] uppercase outline-none font-bold"
                          style={{ backgroundColor: "transparent", background: "none", border: "none", outline: "none", boxShadow: "none" }}
                          maxLength={6}
                          type="text"
                          value={secondaryColor.replace("#", "")}
                          onChange={(e) => {
                            const val = "#" + e.target.value.replace(/[^0-9A-Fa-f]/g, "");
                            setSecondaryColor(val);
                          }}
                        />
                      </div>
                      <label className="cursor-pointer relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden shadow-xs shrink-0 border border-black/10">
                        <input
                          type="color"
                          value={isValidHex(secondaryColor) ? secondaryColor : "#E52A2A"}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0"
                        />
                        <div className="w-full h-full" style={{ backgroundColor: secondaryColor }} />
                      </label>
                      <button
                        type="button"
                        onClick={() => setSecondaryColor(DEFAULT_SECONDARY)}
                        className="p-1 text-[#645d58] hover:text-[#1e1b19] shrink-0"
                        title="Reset token"
                      >
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                      </button>
                    </div>
                  </div>

                  {/* Token 3: Canvas Background */}
                  <div className="p-3.5 bg-white rounded-xl shadow-xs border border-[#e9e1dd] flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-[#645d58] uppercase font-bold tracking-wider block">Token 03</span>
                      <span className="text-xs font-bold text-[#1e1b19]">Canvas Background</span>
                      <p className="text-[11px] text-[#645d58]">Store backdrop, body canvas, and drawer underlays</p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="relative flex items-center flex-1 min-w-0 bg-[#f4ece8] rounded-full px-2.5 sm:px-3 py-1.5 border border-[#cfc4c5]/40">
                        <span className="text-[#645d58] text-xs font-mono mr-1 shrink-0">#</span>
                        <input
                          className="hex-token-input w-full min-w-0 bg-transparent font-mono text-xs text-[#1e1b19] uppercase outline-none font-bold"
                          style={{ backgroundColor: "transparent", background: "none", border: "none", outline: "none", boxShadow: "none" }}
                          maxLength={6}
                          type="text"
                          value={canvasBg.replace("#", "")}
                          onChange={(e) => setCanvasBg("#" + e.target.value.replace(/[^0-9A-Fa-f]/g, ""))}
                        />
                      </div>
                      <label className="cursor-pointer relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden shadow-xs shrink-0 border-2 border-[#cfc4c5] hover:border-black transition-colors">
                        <input
                          type="color"
                          value={isValidHex(canvasBg) ? canvasBg : DEFAULT_BG}
                          onChange={(e) => setCanvasBg(e.target.value)}
                          className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0"
                        />
                        <div className="w-full h-full" style={{ backgroundColor: canvasBg }} />
                      </label>
                      <button
                        type="button"
                        onClick={() => setCanvasBg(DEFAULT_BG)}
                        className="p-1 text-[#645d58] hover:text-[#1e1b19] shrink-0 cursor-pointer"
                        title="Reset canvas background"
                      >
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                      </button>
                    </div>
                  </div>

                  {/* Token 4: Surface Card Background */}
                  <div className="p-3.5 bg-white rounded-xl shadow-xs border border-[#e9e1dd] flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-[#645d58] uppercase font-bold tracking-wider block">Token 04</span>
                      <span className="text-xs font-bold text-[#1e1b19]">Surface / Card Background</span>
                      <p className="text-[11px] text-[#645d58]">Dish tiles, bottom drawer, category strip</p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="relative flex items-center flex-1 min-w-0 bg-[#f4ece8] rounded-full px-2.5 sm:px-3 py-1.5 border border-[#cfc4c5]/40">
                        <span className="text-[#645d58] text-xs font-mono mr-1 shrink-0">#</span>
                        <input
                          className="hex-token-input w-full min-w-0 bg-transparent font-mono text-xs text-[#1e1b19] uppercase outline-none font-bold"
                          style={{ backgroundColor: "transparent", background: "none", border: "none", outline: "none", boxShadow: "none" }}
                          maxLength={6}
                          type="text"
                          value={cardBg.replace("#", "")}
                          onChange={(e) => setCardBg("#" + e.target.value.replace(/[^0-9A-Fa-f]/g, ""))}
                        />
                      </div>
                      <label className="cursor-pointer relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden shadow-xs shrink-0 border-2 border-[#cfc4c5] hover:border-black transition-colors">
                        <input
                          type="color"
                          value={isValidHex(cardBg) ? cardBg : DEFAULT_CARD}
                          onChange={(e) => setCardBg(e.target.value)}
                          className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0"
                        />
                        <div className="w-full h-full" style={{ backgroundColor: cardBg }} />
                      </label>
                      <button
                        type="button"
                        onClick={() => setCardBg(DEFAULT_CARD)}
                        className="p-1 text-[#645d58] hover:text-[#1e1b19] shrink-0 cursor-pointer"
                        title="Reset surface card background"
                      >
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section C: Buttons & Interactive States */}
              <section className="bg-[#faf2ee] p-4 sm:p-5 rounded-2xl shadow-xs border border-[#e9e1dd]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-serif text-[#1e1b19] font-bold">Buttons &amp; Interactive States</h2>
                    <p className="text-xs text-[#645d58]">Live rendering of CTA pills, hover feedback, active press, and inventory states.</p>
                  </div>
                  <span className="px-2.5 py-1 bg-[#e9e1dd] text-[#645d58] rounded-full text-xs font-semibold shrink-0 hidden sm:inline-block">
                    4 States
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3">
                  {/* State 1: Normal */}
                  <div className="p-3.5 bg-white rounded-xl flex flex-col justify-between gap-3 border border-[#e9e1dd] shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#1e1b19] tracking-tight whitespace-nowrap">
                          Normal State
                        </span>
                        <span className="text-[10px] text-[#645d58] mt-0.5 line-clamp-1">
                          Default storefront CTA
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#1e1b19] font-medium bg-[#f4ece8] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                        100%
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        className="w-full py-2 px-3 rounded-full text-xs font-semibold text-white shadow-xs transition cursor-default whitespace-nowrap"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Add Item
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[#f4ece8] flex items-center justify-between text-[10px] text-[#645d58]">
                      <span>Trigger: Rest</span>
                      <span className="text-[#2e7d32] font-semibold">Active</span>
                    </div>
                  </div>

                  {/* State 2: Hover / Focus */}
                  <div className="p-3.5 bg-white rounded-xl flex flex-col justify-between gap-3 border border-[#e9e1dd] shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#1e1b19] tracking-tight whitespace-nowrap">
                          Hover State
                        </span>
                        <span className="text-[10px] text-[#645d58] mt-0.5 line-clamp-1">
                          Pointer &amp; touch focus
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#1e1b19] font-medium bg-[#f4ece8] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                        -12%
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        className="w-full py-2 px-3 rounded-full text-xs font-semibold text-white shadow-md brightness-90 transition cursor-default whitespace-nowrap"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Add Item
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[#f4ece8] flex items-center justify-between text-[10px] text-[#645d58]">
                      <span>Trigger: Hover</span>
                      <span className="text-[#2e7d32] font-semibold">Active</span>
                    </div>
                  </div>

                  {/* State 3: Pressed */}
                  <div className="p-3.5 bg-white rounded-xl flex flex-col justify-between gap-3 border border-[#e9e1dd] shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#1e1b19] tracking-tight whitespace-nowrap">
                          Pressed State
                        </span>
                        <span className="text-[10px] text-[#645d58] mt-0.5 line-clamp-1">
                          Tap confirmation
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#1e1b19] font-medium bg-[#f4ece8] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                        -24%
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        className="w-full py-2 px-3 rounded-full text-xs font-semibold text-white shadow-inner brightness-75 transition cursor-default whitespace-nowrap"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Added ✓
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[#f4ece8] flex items-center justify-between text-[10px] text-[#645d58]">
                      <span>Trigger: Press</span>
                      <span className="text-[#2e7d32] font-semibold">Active</span>
                    </div>
                  </div>

                  {/* State 4: Sold Out */}
                  <div className="p-3.5 bg-white rounded-xl flex flex-col justify-between gap-3 border border-[#e9e1dd] shadow-2xs hover:shadow-xs transition-shadow">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#1e1b19] tracking-tight whitespace-nowrap">
                          Sold Out
                        </span>
                        <span className="text-[10px] text-[#645d58] mt-0.5 line-clamp-1">
                          Out of stock items
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#ba1a1a] font-medium bg-red-50 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                        0 Stock
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 px-3 rounded-full text-xs font-semibold text-[#645d58] bg-[#e9e1dd] cursor-not-allowed select-none whitespace-nowrap"
                      >
                        Unavailable
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[#f4ece8] flex items-center justify-between text-[10px] text-[#645d58]">
                      <span>Trigger: Lock</span>
                      <span className="text-[#ba1a1a] font-semibold">Disabled</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Action Bar */}
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-[#e9e1dd] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[#1e1b19]">
                  <span className="material-symbols-outlined text-[18px] text-amber-600">info</span>
                  <span>{isDirty ? "Unsaved draft palette changes ready." : "Palette in sync with live storefront."}</span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (org) {
                        setPrimaryColor(org.primaryColor || DEFAULT_PRIMARY);
                        setSecondaryColor(org.secondaryColor || DEFAULT_SECONDARY);
                        setCanvasBg(DEFAULT_BG);
                        setCardBg(DEFAULT_CARD);
                        setHeadingInk(DEFAULT_TEXT);
                        showToast("Colors reverted to current store configuration");
                      }
                    }}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold text-[#645d58] hover:text-[#1e1b19]"
                  >
                    Revert
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || !isDirty}
                    className={`px-5 py-2 rounded-full text-xs font-bold transition shadow-sm ${
                      isDirty
                        ? "bg-[#000000] text-white hover:bg-[#33302d] cursor-pointer"
                        : "bg-[#e9e1dd] text-[#645d58] cursor-not-allowed"
                    }`}
                  >
                    {isSaving ? "Saving..." : "Update Storefront"}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Smartphone Storefront Simulator (5 cols) */}
            <div className="xl:col-span-5 flex flex-col items-center min-w-0 max-w-full w-full">
              <div className="sticky top-4 w-full max-w-[350px] flex flex-col items-center min-w-0">
                <div className="w-full flex items-center justify-between px-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-[#1e1b19]">Live Color Emulation</span>
                  </div>
                  <span className="text-[10px] text-[#645d58] font-mono">iPhone 15 Pro • Reactive</span>
                </div>

                {/* Phone Shell */}
                <div className="w-full rounded-[40px] p-2.5 sm:p-3 bg-[#1e1b19] shadow-2xl relative border border-white/10 min-w-0 max-w-full">
                  <div
                    className="w-full h-[580px] sm:h-[620px] rounded-[32px] overflow-hidden flex flex-col justify-between relative transition-colors duration-300 min-w-0"
                    style={{ backgroundColor: canvasBg, color: headingInk }}
                  >
                    {/* Notch & Bar */}
                    <div className="pt-3 px-5 pb-1 flex items-center justify-between shrink-0 z-20">
                      <span className="text-[11px] font-semibold font-mono">9:41</span>
                      <div className="w-20 h-4 bg-black rounded-full" />
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="material-symbols-outlined text-[13px]">wifi</span>
                        <span className="material-symbols-outlined text-[13px]">battery_full</span>
                      </div>
                    </div>

                    {/* Scrollable Live Menu */}
                    <div className="flex-1 overflow-y-auto px-3.5 pb-18 space-y-2.5">
                      {/* Header */}
                      <div className="pt-1 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1">
                            <h3 className="font-serif text-sm font-bold">{org?.name || "Spice Garden Bistro"}</h3>
                            <span className="material-symbols-outlined text-[15px]" style={{ color: primaryColor }}>verified</span>
                          </div>
                          <p className="text-[10px] opacity-70">North Indian • Fine Dining</p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[9px]">
                            <span className="font-bold">⭐ 4.8</span>
                            <span>•</span>
                            <span>25-35 mins</span>
                            <span>•</span>
                            <span className="text-[#16a34a] font-bold">Open</span>
                          </div>
                        </div>
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center font-serif text-white font-bold shadow-xs"
                          style={{ backgroundColor: primaryColor }}
                        >
                          SG
                        </div>
                      </div>

                      {/* Delivery Segment */}
                      <div className="p-0.5 rounded-full bg-black/5 flex text-[10px] font-medium">
                        <button
                          type="button"
                          className="flex-1 py-1 rounded-full text-white text-center font-bold"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Delivery (Free)
                        </button>
                        <button type="button" className="flex-1 py-1 rounded-full text-center opacity-70">
                          Takeaway (15m)
                        </button>
                      </div>

                      {/* Promo Ribbon */}
                      <div
                        className="p-2 rounded-xl text-white flex items-center justify-between shadow-xs transition-colors duration-200"
                        style={{ backgroundColor: secondaryColor }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[15px]">celebration</span>
                          <div>
                            <span className="text-[8px] uppercase font-bold tracking-wider block">Festive Treat</span>
                            <span className="text-[10px] font-medium">FLAT 20% OFF ABOVE ₹499</span>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-black/20 text-[9px] font-mono font-bold">SPICE20</span>
                      </div>

                      {/* Category Pills */}
                      <div className="flex items-center gap-1 overflow-x-hidden pt-0.5 text-[10px]">
                        <span className="px-2.5 py-0.5 rounded-full text-white font-bold shadow-xs" style={{ backgroundColor: primaryColor }}>
                          Bestsellers
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full shadow-xs" style={{ backgroundColor: cardBg }}>
                          Clay Tandoor
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full shadow-xs" style={{ backgroundColor: cardBg }}>
                          Curries
                        </span>
                      </div>

                      {/* Dish Card 1 */}
                      <div className="p-2.5 rounded-xl shadow-xs flex gap-2.5 items-center border border-black/5" style={{ backgroundColor: cardBg }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="w-2 h-2 rounded-xs bg-[#16a34a]" />
                            <span className="text-[8px] font-bold text-[#16a34a] uppercase">Bestseller</span>
                          </div>
                          <h4 className="text-[11px] font-bold truncate">Tandoori Paneer Tikka</h4>
                          <p className="text-[9px] opacity-70 line-clamp-1">Charred cottage cheese with mint chutney.</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="font-mono text-[10px] font-bold">₹280.00</span>
                            <button
                              type="button"
                              className="px-2.5 py-0.5 rounded-full text-white text-[9px] font-bold shadow-xs"
                              style={{ backgroundColor: primaryColor }}
                            >
                              + ADD
                            </button>
                          </div>
                        </div>
                        <img
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDE19hgNrrzC0V98GuuFYCwexSU-TufGCWZIpyLAFSq4P4jWtprbDYMsKgP4hkmW5qNTbiISA0XDU9satmVydDwEKu3Gi4BNgjr4rUGKWZMgmU99G0pIIWITrbJIkl81oQu3xzSwBCWJbJPNaN7LXtYbNctHloGbS1LxvWjoMS26qNQ63sZv4rVLz87UViAvs0mSeeyZxgmwShf7j755wP2pI7y_cwSX8Fi-czIm7aAxF_5aHL3VHl8"
                          alt="Paneer"
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                        />
                      </div>

                      {/* Dish Card 2 */}
                      <div className="p-2.5 rounded-xl shadow-xs flex gap-2.5 items-center border border-black/5" style={{ backgroundColor: cardBg }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="w-2 h-2 rounded-xs bg-[#dc2626]" />
                            <span className="text-[8px] font-bold text-amber-600 uppercase">Chef Special</span>
                          </div>
                          <h4 className="text-[11px] font-bold truncate">Royal Butter Chicken</h4>
                          <p className="text-[9px] opacity-70 line-clamp-1">Velvety makhani sauce with fenugreek.</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="font-mono text-[10px] font-bold">₹390.00</span>
                            <button
                              type="button"
                              className="px-2.5 py-0.5 rounded-full text-white text-[9px] font-bold shadow-xs"
                              style={{ backgroundColor: primaryColor }}
                            >
                              + ADD
                            </button>
                          </div>
                        </div>
                        <img
                          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBdW4hx0szucsJPBUEv-Wum6gEvI0xXjBABBkUXymeoy-A88VlJP_q8hKR0W9-U2aMB44kNbiC9kDFbzn0QM1evtJLOQnhu8CjNX-IoBfucdSGHkJdjmIu7zeACZ9GlxOUu87kHeRnwSoMgP-rwpgy_5vk6ece0JhY1-SEaKdWg3XteaTVZ4pnMw8Y3VJZDRMRX4pMiVG-0hoR6--ChLHGey3oDguRGWihHCTC6ETxy2t6QlhtdbS05"
                          alt="Butter Chicken"
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                        />
                      </div>
                    </div>

                    {/* Bottom Cart Bar */}
                    <div
                      className="absolute bottom-2.5 left-2.5 right-2.5 p-2 rounded-full text-white flex items-center justify-between shadow-xl z-30 transition-colors"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <div className="flex items-center gap-1.5 pl-2">
                        <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold">2</span>
                        <span className="text-[10px] font-bold">₹670.00</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-white text-black text-[10px] font-bold flex items-center gap-0.5">
                        <span>View Cart</span>
                        <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* CSS Variable Mapping */}
                <div className="w-full mt-4 p-3.5 bg-[#faf2ee] rounded-xl text-xs space-y-1.5 border border-[#e9e1dd]">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#645d58] uppercase">
                    <span>Active CSS Mappings</span>
                    <span className="text-[9px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">Scoped Isolated</span>
                  </div>
                  <div className="font-mono text-[10px] space-y-1 bg-white p-2.5 rounded-lg border border-[#e9e1dd]">
                    <div className="flex justify-between">
                      <span className="text-[#645d58]">--store-primary:</span>
                      <span className="font-bold">{primaryColor.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#645d58]">--store-secondary:</span>
                      <span className="font-bold">{secondaryColor.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#645d58]">--store-bg:</span>
                      <span className="font-bold">{canvasBg.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* VIEW 3: STORE AVAILABILITY & SERVICE MODES            */}
        {/* ===================================================== */}
        {activeTab === "availability" && (
          <div className="pt-1 pb-4 px-1 sm:px-2 space-y-3.5 max-w-4xl">
            <div className="flex items-center gap-2 pb-2 border-b border-[#e7e5e4]">
              <button
                type="button"
                onClick={() => setActiveTab("themes")}
                className="text-xs font-semibold text-[#645d58] hover:text-[#1e1b19] hover:underline transition-colors cursor-pointer"
                title="Return to Themes Gallery"
              >
                Themes
              </button>
              <span className="text-[#cfc4c5] text-xs select-none">/</span>
              <span className="text-xs font-serif font-bold text-[#1e1b19]">
                Store Availability &amp; Service Modes
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#645d58] block">
                Operation Channels
              </span>
              <h2 className="text-xl sm:text-2xl font-serif text-[#1e1b19] font-normal">Store Availability &amp; Service Modes</h2>
              <p className="text-xs text-[#645d58] mt-0.5 leading-relaxed">
                Control customer access to your digital storefront, set operating hours, and manage live ordering channels.
              </p>
            </div>

            {/* Master Online Toggle Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#e9e1dd] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1e1b19]">Public Storefront Master Switch</h3>
                  {onlineStore ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#e8f5e9] text-[#1b5e20] text-xs font-semibold">
                      Live
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                      Paused
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#645d58] mt-1 max-w-xl">
                  {onlineStore
                    ? "Your online store is actively receiving orders at " + storeSlug + ".get-prest.com"
                    : "Your storefront is currently offline. Customers will see a polite paused message."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onlineStore) setShowOfflineModal(true);
                  else {
                    setOnlineStore(true);
                    showToast("Storefront is now online", "success", "Your store is live and accepting customer orders.");
                  }
                }}
                className={`w-full sm:w-auto px-5 py-2 rounded-full font-bold text-xs transition shadow-xs cursor-pointer ${
                  onlineStore
                    ? "bg-[#ba1a1a] text-white hover:bg-red-700"
                    : "bg-[#1b5e20] text-white hover:bg-green-800"
                }`}
              >
                {onlineStore ? "Pause Storefront" : "Turn Store Online"}
              </button>
            </div>

            {/* 3 Service Modes Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Delivery */}
              <div className="p-5 rounded-2xl bg-[#faf2ee] border border-[#e9e1dd] flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[20px] text-[#1e1b19]">moped</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#e8f5e9] text-[#1b5e20] text-xs font-bold">Active</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#1e1b19]">Doorstep Delivery</h4>
                  <p className="text-xs text-[#645d58] mt-1">Average delivery time: 35 minutes. Geofence radius: 7.5 km.</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#e9e1dd] text-[11px] text-[#645d58] font-mono">
                  Min Order: ₹200 • Base Fee: ₹25
                </div>
              </div>

              {/* Takeaway */}
              <div className="p-5 rounded-2xl bg-[#faf2ee] border border-[#e9e1dd] flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[20px] text-[#1e1b19]">shopping_bag</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#e8f5e9] text-[#1b5e20] text-xs font-bold">Active</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#1e1b19]">Curbside Takeaway</h4>
                  <p className="text-xs text-[#645d58] mt-1">Ready in 15-20 minutes. Free packing. SMS pickup notifications enabled.</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#e9e1dd] text-[11px] text-[#645d58] font-mono">
                  Zero Delivery Charge
                </div>
              </div>

              {/* Table QR */}
              <div className="p-5 rounded-2xl bg-[#faf2ee] border border-[#e9e1dd] flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[20px] text-[#1e1b19]">restaurant</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#e8f5e9] text-[#1b5e20] text-xs font-bold">Active</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#1e1b19]">Dine-In Table QR</h4>
                  <p className="text-xs text-[#645d58] mt-1">18 tables connected. Direct kitchen ticket firing to station KDS 1.</p>
                </div>
                <div className="mt-4 pt-3 border-t border-[#e9e1dd] text-[11px] text-[#645d58] font-mono">
                  Waiter Paging: Enabled
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* VIEW 4: CHANNEL PAYMENT MATRIX                        */}
        {/* ===================================================== */}
        {activeTab === "payments" && (
          <div className="pt-1 pb-4 px-1 sm:px-2 space-y-3.5 max-w-4xl">
            <div className="flex items-center gap-2 pb-2 border-b border-[#e7e5e4]">
              <button
                type="button"
                onClick={() => setActiveTab("themes")}
                className="text-xs font-semibold text-[#645d58] hover:text-[#1e1b19] hover:underline transition-colors cursor-pointer"
                title="Return to Themes Gallery"
              >
                Themes
              </button>
              <span className="text-[#cfc4c5] text-xs select-none">/</span>
              <span className="text-xs font-serif font-bold text-[#1e1b19]">
                Channel Payment Matrix
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#645d58] block">
                Financial Gateways
              </span>
              <h2 className="text-xl sm:text-2xl font-serif text-[#1e1b19] font-normal">Channel Payment Matrix</h2>
              <p className="text-xs text-[#645d58] mt-0.5 leading-relaxed">
                Rules governing which payment methods are accepted across public delivery, takeaway, and QR table dine-in.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#e9e1dd] shadow-xs overflow-x-auto">
              <table className="w-full min-w-[580px] text-left text-xs">
                <thead className="bg-[#faf2ee] border-b border-[#e9e1dd] text-[#645d58] font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">UPI &amp; Razorpay</th>
                    <th className="py-3 px-4">Credit / Debit Cards</th>
                    <th className="py-3 px-4">Cash on Delivery</th>
                    <th className="py-3 px-4">Pay at Cashier POS</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9e1dd]">
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#1e1b19] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">moped</span>
                      <span>Delivery</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#2e7d32] font-semibold">✓ Enabled</td>
                    <td className="py-3.5 px-4 text-[#2e7d32] font-semibold">✓ Enabled</td>
                    <td className="py-3.5 px-4 text-[#2e7d32] font-semibold">✓ Enabled</td>
                    <td className="py-3.5 px-4 text-[#645d58]">— N/A</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-full bg-[#e8f5e9] text-[#1b5e20] font-bold text-[10px]">Active</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#1e1b19] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                      <span>Curbside Takeaway</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#2e7d32] font-semibold">✓ Enabled</td>
                    <td className="py-3.5 px-4 text-[#2e7d32] font-semibold">✓ Enabled</td>
                    <td className="py-3.5 px-4 text-[#645d58]">— N/A</td>
                    <td className="py-3.5 px-4 text-[#2e7d32] font-semibold">✓ Pay on Pickup</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-full bg-[#e8f5e9] text-[#1b5e20] font-bold text-[10px]">Active</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 font-bold text-[#1e1b19] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">restaurant</span>
                      <span>Table QR Dine-In</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#2e7d32] font-semibold">✓ Scan &amp; Pay</td>
                    <td className="py-3.5 px-4 text-[#2e7d32] font-semibold">✓ Table Link</td>
                    <td className="py-3.5 px-4 text-[#645d58]">— N/A</td>
                    <td className="py-3.5 px-4 text-[#2e7d32] font-semibold">✓ Pay at Register</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-full bg-[#e8f5e9] text-[#1b5e20] font-bold text-[10px]">Active</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
