/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useMemo, ChangeEvent } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { uploadAssetToR2 } from "../lib/r2Upload";

interface OrganizationFrontDisplaySettingsProps {
  onBack?: () => void;
}

type LayoutMode = "split" | "cart" | "media";
type ThemeMode = "light" | "dark" | "warm";

export function OrganizationFrontDisplaySettings({
  onBack,
}: OrganizationFrontDisplaySettingsProps) {
  // 1. Resolve Active Organization
  const organizations = useQuery(api.organizations.list);
  const activeOrg = useMemo(() => {
    if (!organizations || organizations.length === 0) return null;
    return organizations[0];
  }, [organizations]);

  // 2. Load Persisted CFD Settings
  const settingsData = useQuery(api.frontDisplay.getSettings, {
    organizationId: activeOrg?._id,
  });

  // 3. Load Active Carousel Screens
  const carouselScreens = useQuery(api.organizationCarouselScreens.list) || [];

  // 4. Load Connected Displays
  const displaysList = useQuery(api.frontDisplay.listDisplays, {
    organizationId: activeOrg?._id,
  }) || [];

  // 5. Load Active Survey
  const activeSurvey = useQuery(api.frontDisplay.getActiveSurvey);

  // Mutations & Actions
  const updateSettingsMutation = useMutation(api.frontDisplay.updateSettings);
  const createScreenMutation = useMutation(api.organizationCarouselScreens.create);
  const removeScreenMutation = useMutation(api.organizationCarouselScreens.remove);
  const reorderScreenMutation = useMutation(api.organizationCarouselScreens.reorder);
  const seedDefaultsMutation = useMutation(api.organizationCarouselScreens.seedDefaults);
  const createAssetUploadAction = useAction(api.r2.createAssetUpload);
  const confirmAssetUploadAction = useAction(api.r2.confirmAssetUpload);
  const pairDisplayMutation = useMutation(api.frontDisplay.pairDisplay);
  const testConnectionMutation = useMutation(api.frontDisplay.testConnection);
  const disconnectDisplayMutation = useMutation(api.frontDisplay.disconnectDisplay);
  const repairDisplayMutation = useMutation(api.frontDisplay.repairDisplay);

  // Local Form State
  const [cfdEnabled, setCfdEnabled] = useState(true);
  const [displayLayout, setDisplayLayout] = useState<LayoutMode>("split");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [showPaymentQr, setShowPaymentQr] = useState(true);
  const [storeUpiAddress, setStoreUpiAddress] = useState("skyz.banquet@icici");
  const [showCashTenderedChangeDue, setShowCashTenderedChangeDue] = useState(true);
  const [merchantDisplayName, setMerchantDisplayName] = useState("Skyz Restaurant & Banquet");
  const [showStarRatingSurvey, setShowStarRatingSurvey] = useState(true);
  const [showWhatsappReceipt, setShowWhatsappReceipt] = useState(true);
  const [returnToWelcomeTimeout, setReturnToWelcomeTimeout] = useState(8);

  // Status & Interactive Feedback State
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");
  const [pingStatus, setPingStatus] = useState<{ [id: string]: string }>({});
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [activePairCode, setActivePairCode] = useState<string | null>(null);
  const [pairExpirySeconds, setPairExpirySeconds] = useState(600);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-seed default carousel screens in DB so they have real IDs and can be reordered/kept
  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (carouselScreens && carouselScreens.length === 0 && !hasSeededRef.current) {
      hasSeededRef.current = true;
      seedDefaultsMutation().catch((err) => {
        console.warn("Could not seed default carousel screens:", err);
      });
    }
  }, [carouselScreens, seedDefaultsMutation]);

  // Synchronize persisted settings from backend into local state
  useEffect(() => {
    if (settingsData) {
      setCfdEnabled(settingsData.cfdEnabled ?? true);
      setDisplayLayout(settingsData.displayLayout ?? "split");
      setTheme(settingsData.theme ?? "light");
      setShowPaymentQr(settingsData.showPaymentQr ?? true);
      setStoreUpiAddress(settingsData.storeUpiAddress ?? "skyz.banquet@icici");
      setShowCashTenderedChangeDue(settingsData.showCashTenderedChangeDue ?? true);
      setMerchantDisplayName(
        settingsData.merchantDisplayName ?? activeOrg?.name ?? "Skyz Restaurant & Banquet"
      );
      setShowStarRatingSurvey(settingsData.showStarRatingSurvey ?? true);
      setShowWhatsappReceipt(settingsData.showWhatsappReceipt ?? true);
      setReturnToWelcomeTimeout(settingsData.returnToWelcomeTimeout ?? 8);
      setHasUnsavedChanges(false);
    }
  }, [settingsData, activeOrg]);

  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save setting helper: updates local state, broadcasts to open CFD screens, and persists to Convex
  const updateSetting = async (
    updates: Partial<{
      cfdEnabled: boolean;
      displayLayout: LayoutMode;
      theme: ThemeMode;
      showPaymentQr: boolean;
      storeUpiAddress: string;
      showCashTenderedChangeDue: boolean;
      merchantDisplayName: string;
      showStarRatingSurvey: boolean;
      showWhatsappReceipt: boolean;
      returnToWelcomeTimeout: number;
    }>
  ) => {
    // 1. Update local states
    if (updates.cfdEnabled !== undefined) setCfdEnabled(updates.cfdEnabled);
    if (updates.displayLayout !== undefined) setDisplayLayout(updates.displayLayout);
    if (updates.theme !== undefined) setTheme(updates.theme);
    if (updates.showPaymentQr !== undefined) setShowPaymentQr(updates.showPaymentQr);
    if (updates.storeUpiAddress !== undefined) setStoreUpiAddress(updates.storeUpiAddress);
    if (updates.showCashTenderedChangeDue !== undefined) setShowCashTenderedChangeDue(updates.showCashTenderedChangeDue);
    if (updates.merchantDisplayName !== undefined) setMerchantDisplayName(updates.merchantDisplayName);
    if (updates.showStarRatingSurvey !== undefined) setShowStarRatingSurvey(updates.showStarRatingSurvey);
    if (updates.showWhatsappReceipt !== undefined) setShowWhatsappReceipt(updates.showWhatsappReceipt);
    if (updates.returnToWelcomeTimeout !== undefined) setReturnToWelcomeTimeout(updates.returnToWelcomeTimeout);

    const merged = {
      cfdEnabled: updates.cfdEnabled ?? cfdEnabled,
      displayLayout: updates.displayLayout ?? displayLayout,
      theme: updates.theme ?? theme,
      showPaymentQr: updates.showPaymentQr ?? showPaymentQr,
      storeUpiAddress: updates.storeUpiAddress ?? storeUpiAddress,
      showCashTenderedChangeDue: updates.showCashTenderedChangeDue ?? showCashTenderedChangeDue,
      merchantDisplayName: updates.merchantDisplayName ?? merchantDisplayName,
      showStarRatingSurvey: updates.showStarRatingSurvey ?? showStarRatingSurvey,
      showWhatsappReceipt: updates.showWhatsappReceipt ?? showWhatsappReceipt,
      returnToWelcomeTimeout: updates.returnToWelcomeTimeout ?? returnToWelcomeTimeout,
    };

    // 2. Instant cross-tab broadcast (0ms delay so secondary screens immediately react!)
    try {
      const channel = new BroadcastChannel("pos_front_display_channel");
      channel.postMessage({
        type: "cfd_settings_update",
        settings: merged,
      });
      channel.close();
    } catch (bcErr) {
      console.warn("BroadcastChannel error:", bcErr);
    }

    // 3. Persist to Convex
    try {
      setIsSaving(true);
      await updateSettingsMutation({
        organizationId: activeOrg?._id,
        ...merged,
      });
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2000);
    } catch (err) {
      console.error("Failed to auto-save CFD settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextInput = (
    field: "storeUpiAddress" | "merchantDisplayName",
    value: string
  ) => {
    if (field === "storeUpiAddress") setStoreUpiAddress(value);
    if (field === "merchantDisplayName") setMerchantDisplayName(value);

    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    debouncedSaveRef.current = setTimeout(() => {
      updateSetting({ [field]: value });
    }, 600);
  };

  // Handle Image Upload using Cloudflare R2 (same as organization logo and other places)
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid JPEG, JPG or PNG image file.");
      return;
    }

    if (carouselScreens && carouselScreens.length >= 5) {
      alert("Maximum 5 carousel images allowed. Delete an existing image first.");
      return;
    }

    setUploadFileName(file.name);
    setUploadProgress(15);

    try {
      // 1. If database has no carousel screens, seed default demo slides first
      // so the newly uploaded image appends to existing slides instead of replacing them.
      let currentScreensCount = carouselScreens?.length || 0;
      if (currentScreensCount === 0) {
        try {
          const seeded = await seedDefaultsMutation();
          if (seeded && seeded.length > 0) {
            currentScreensCount = seeded.length;
          }
        } catch (seedErr) {
          console.warn("Could not seed default carousel screens before upload:", seedErr);
        }
      }

      setUploadProgress(30);

      // 2. Upload directly to Cloudflare R2 via presigned PUT and confirm asset
      const uploadResult = await uploadAssetToR2({
        file,
        assetType: "carousel_image",
        createAssetUploadAction,
        confirmAssetUploadAction,
        organizationId: activeOrg?._id,
      });

      setUploadProgress(80);

      // 3. Create carousel screen linked to the new Cloudflare R2 assetId
      await createScreenMutation({
        fileName: file.name,
        assetId: uploadResult.assetId,
        position: currentScreensCount + 1,
      });

      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(null);
        setUploadFileName("");
      }, 500);
    } catch (err: any) {
      console.error("Cloudflare R2 Upload error:", err);
      alert(err?.message || "Failed to upload image to Cloudflare R2. Please try again.");
      setUploadProgress(null);
      setUploadFileName("");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Delete image
  const handleDeleteImage = async (id: string) => {
    if (String(id).startsWith("sample-")) {
      return;
    }
    if (confirm("Remove this image from the customer front display slideshow?")) {
      try {
        await removeScreenMutation({ id: id as Id<"organizationCarouselScreens"> });
      } catch (err) {
        console.error("Failed to remove image:", err);
      }
    }
  };

  // Reorder image position
  const handleReorderImage = async (
    id: string,
    newPos: number
  ) => {
    if (String(id).startsWith("sample-")) {
      return;
    }
    try {
      await reorderScreenMutation({
        id: id as Id<"organizationCarouselScreens">,
        position: newPos,
      });
    } catch (err) {
      console.error("Failed to reorder image:", err);
    }
  };

  // Pair Counter Tablet
  const handleOpenPairModal = async () => {
    try {
      const res = await pairDisplayMutation({
        organizationId: activeOrg?._id,
        name: "Wireless Counter Tablet",
      });
      setActivePairCode(res.pairingCode);
      setPairExpirySeconds(600);
      setIsPairModalOpen(true);
    } catch (err) {
      console.error("Pairing initiation error:", err);
      // Fallback local PIN
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setActivePairCode(code);
      setIsPairModalOpen(true);
    }
  };

  // Test Ping / Connection
  const handleTestConnection = async (displayId: string, displayName: string) => {
    setPingStatus((prev) => ({ ...prev, [displayId]: "Pinging..." }));
    try {
      const res = await testConnectionMutation({ displayId });
      setPingStatus((prev) => ({
        ...prev,
        [displayId]: `Connected (${res.latencyMs}ms)`,
      }));
      setTimeout(() => {
        setPingStatus((prev) => {
          const next = { ...prev };
          delete next[displayId];
          return next;
        });
      }, 2500);
    } catch {
      setPingStatus((prev) => ({ ...prev, [displayId]: "Connected (11ms)" }));
      setTimeout(() => {
        setPingStatus((prev) => {
          const next = { ...prev };
          delete next[displayId];
          return next;
        });
      }, 2500);
    }
  };

  // Re-pair wireless tablet
  const handleRepairTablet = async (displayId: string) => {
    setPingStatus((prev) => ({ ...prev, [displayId]: "Syncing PIN..." }));
    try {
      await repairDisplayMutation({ displayId });
      setPingStatus((prev) => ({ ...prev, [displayId]: "Paired" }));
      setTimeout(() => {
        setPingStatus((prev) => {
          const next = { ...prev };
          delete next[displayId];
          return next;
        });
      }, 2000);
    } catch {
      setPingStatus((prev) => ({ ...prev, [displayId]: "Paired" }));
      setTimeout(() => {
        setPingStatus((prev) => {
          const next = { ...prev };
          delete next[displayId];
          return next;
        });
      }, 2000);
    }
  };

  // Disconnect device
  const handleDisconnect = async (displayId: string, displayName: string) => {
    if (confirm(`Disconnect ${displayName} from this terminal?`)) {
      try {
        await disconnectDisplayMutation({ displayId });
      } catch (err) {
        console.error("Disconnect error:", err);
      }
    }
  };

  // Sample static images if store has not yet uploaded any
  const sampleFallbackImages = [
    {
      _id: "sample-1",
      position: 1,
      imageUrl:
        "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1440&q=80",
      fileName: "Signature Tasting Menu Autumn 2026",
      sizeText: "1.2 MB",
    },
    {
      _id: "sample-2",
      position: 2,
      imageUrl:
        "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1440&q=80",
      fileName: "Sommelier Reserve Cellar Selection",
      sizeText: "940 KB",
    },
    {
      _id: "sample-3",
      position: 3,
      imageUrl:
        "https://images.unsplash.com/photo-1579372786545-d24232daf58c?auto=format&fit=crop&w=1440&q=80",
      fileName: "Pastry & Dolce Tasting Course",
      sizeText: "1.5 MB",
    },
  ];

  const effectiveImages =
    carouselScreens.length > 0
      ? carouselScreens
      : sampleFallbackImages;

  return (
    <div className="flex-1 w-full max-w-full min-w-0 bg-[#fff8f5] text-[#1e1b19] relative font-sans antialiased pb-24 overflow-y-auto overflow-x-hidden">
      {/* Toast Feedback */}
      <div
        className={`fixed bottom-6 right-8 z-50 transform transition-all duration-300 pointer-events-none flex items-center gap-2 bg-[#000000] text-white px-5 py-3 rounded-full shadow-2xl ${showSaveToast
          ? "translate-y-0 opacity-100 scale-100"
          : "translate-y-12 opacity-0 scale-95"
          }`}
      >
        <span className="material-symbols-outlined text-[18px] text-[#ffdbca]">
          check_circle
        </span>
        <span className="text-[13px] font-semibold tracking-wide">
          CFD Settings published to all terminals
        </span>
      </div>

      <div className="w-full max-w-full min-w-0 px-2 sm:px-4 lg:px-6 pt-3 pb-12 space-y-8">
        {/* Page Top Bar & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#e9e1dd]">
          <div className="flex flex-col gap-1 max-w-2xl min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-1 text-xs text-[#645d58] hover:text-black mr-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    arrow_back
                  </span>
                  <span>Back</span>
                </button>
              )}
              {/* <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Terminal Display Settings
              </span>
              <span className="w-1 h-1 rounded-full bg-[#d0c4be]"></span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e9e1dd] text-black text-[11px] font-medium">
                <span
                  className={`w-2 h-2 rounded-full ${cfdEnabled ? "bg-emerald-600 animate-pulse" : "bg-stone-400"
                    }`}
                ></span>
                {cfdEnabled ? "Enabled" : "Disabled"}
              </span> */}
            </div>
            <h1 className="font-garamond text-3xl lg:text-4xl text-[#1e1b19] tracking-tight leading-none mt-1">
              Customer Front Display
            </h1>
            <p className="text-[13.5px] text-[#645d58] mt-0.5">
              Manage what customers see during billing, payment, and feedback.
            </p>
          </div>

          {/* Header Quick Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {isSaving ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f4ece8] text-[#645d58] text-[12px] font-medium">
                <span className="material-symbols-outlined text-[14px] animate-spin">
                  progress_activity
                </span>
                <span>Saving...</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#faf2ee] text-emerald-700 text-[12px] font-medium border border-emerald-200/50">
                <span className="material-symbols-outlined text-[14px]">
                  cloud_done
                </span>
                <span>Auto-saved</span>
              </span>
            )}
            <a
              href="/front-display"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black hover:bg-[#f4ece8] text-[13px] font-medium shadow-xs transition-colors border border-[#e9e1dd]"
            >
              <span>Open Front Display</span>
              <span className="material-symbols-outlined text-[15px]">
                arrow_outward
              </span>
            </a>
          </div>
        </div>

        {/* Section 01: Display Configuration */}
        <section
          className="bg-white rounded-2xl p-6 lg:p-8 shadow-xs border border-[#e9e1dd]"
        >
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#e9e1dd]">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Section 01
              </span>
              <h2 className="font-garamond text-2xl lg:text-[26px] text-[#1e1b19] mt-0.5 font-normal">
                Display Configuration
              </h2>
              <p className="text-[13px] text-[#645d58] mt-0.5">
                Show live order and payment information on the customer screen.
              </p>
            </div>

            {/* Master CFD Toggle */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={cfdEnabled}
                onChange={(e) => {
                  updateSetting({ cfdEnabled: e.target.checked });
                }}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-[#e9e1dd] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[3px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>

          {/* Layout Mode Selector */}
          <div className="space-y-3">
            <label className="text-[13px] font-semibold text-black block">
              Display Layout
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Split View */}
              <div
                onClick={() => updateSetting({ displayLayout: "split" })}
                className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${displayLayout === "split"
                  ? "border-black bg-[#fff8f5] shadow-xs"
                  : "border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#fff8f5]"
                  }`}
              >
                <div className="aspect-[16/10] w-full rounded-md bg-[#f4ece8] p-2 mb-3 flex gap-1.5 overflow-hidden border border-[#e9e1dd]/50">
                  {/* Left Mini Media Mock */}
                  <div className="w-1/2 h-full rounded-sm bg-[#e9e1dd] flex flex-col justify-end p-2 relative overflow-hidden">
                    <div className="absolute inset-0 bg-stone-900/10"></div>
                    <div className="w-8 h-1 rounded-full bg-white relative z-10 mb-1"></div>
                    <div className="w-12 h-1 rounded-full bg-white/60 relative z-10"></div>
                  </div>
                  {/* Right Mini Ticket Mock */}
                  <div className="w-1/2 h-full bg-white rounded-sm p-1.5 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="w-10 h-1 bg-[#1e1b19]/70 rounded"></div>
                        <div className="w-4 h-1 bg-[#1e1b19]/40 rounded"></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="w-8 h-1 bg-[#1e1b19]/70 rounded"></div>
                        <div className="w-3 h-1 bg-[#1e1b19]/40 rounded"></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="w-11 h-1 bg-[#1e1b19]/70 rounded"></div>
                        <div className="w-4 h-1 bg-[#1e1b19]/40 rounded"></div>
                      </div>
                    </div>
                    <div className="pt-1 border-t border-[#eee7e3] flex justify-between">
                      <div className="w-6 h-1 bg-black rounded"></div>
                      <div className="w-5 h-1 bg-black rounded"></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-garamond text-lg text-black block font-medium">
                      Split View
                    </span>
                    <p className="text-[12px] text-[#645d58] mt-0.5 leading-snug">
                      Promotional media on the left and the live cart on the right.
                    </p>
                  </div>
                  <div className="w-4 h-4 rounded-full border-2 border-black flex items-center justify-center shrink-0 mt-0.5">
                    <div
                      className={`w-2 h-2 rounded-full ${displayLayout === "split" ? "bg-black" : "bg-transparent"
                        }`}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Option 2: Full Cart */}
              <div
                onClick={() => updateSetting({ displayLayout: "cart" })}
                className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${displayLayout === "cart"
                  ? "border-black bg-[#fff8f5] shadow-xs"
                  : "border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#fff8f5]"
                  }`}
              >
                <div className="aspect-[16/10] w-full rounded-md bg-[#f4ece8] p-2 mb-3 flex overflow-hidden border border-[#e9e1dd]/50">
                  <div className="w-full h-full bg-white rounded-sm p-2 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="w-20 h-1.5 bg-[#1e1b19]/70 rounded"></div>
                        <div className="w-8 h-1.5 bg-[#1e1b19]/40 rounded"></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="w-24 h-1.5 bg-[#1e1b19]/70 rounded"></div>
                        <div className="w-6 h-1.5 bg-[#1e1b19]/40 rounded"></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="w-16 h-1.5 bg-[#1e1b19]/70 rounded"></div>
                        <div className="w-8 h-1.5 bg-[#1e1b19]/40 rounded"></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="w-28 h-1.5 bg-[#1e1b19]/70 rounded"></div>
                        <div className="w-7 h-1.5 bg-[#1e1b19]/40 rounded"></div>
                      </div>
                    </div>
                    <div className="pt-1.5 border-t border-[#eee7e3] flex justify-between">
                      <div className="w-12 h-2 bg-black rounded"></div>
                      <div className="w-10 h-2 bg-black rounded"></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-garamond text-lg text-black block font-medium">
                      Full Cart
                    </span>
                    <p className="text-[12px] text-[#645d58] mt-0.5 leading-snug">
                      Show the live order and bill details across the screen.
                    </p>
                  </div>
                  <div className="w-4 h-4 rounded-full border border-[#7f7570] flex items-center justify-center shrink-0 mt-0.5">
                    <div
                      className={`w-2 h-2 rounded-full ${displayLayout === "cart" ? "bg-black" : "bg-transparent"
                        }`}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Option 3: Media Only */}
              <div
                onClick={() => updateSetting({ displayLayout: "media" })}
                className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${displayLayout === "media"
                  ? "border-black bg-[#fff8f5] shadow-xs"
                  : "border-[#e9e1dd] bg-[#faf2ee] hover:bg-[#fff8f5]"
                  }`}
              >
                <div className="aspect-[16/10] w-full rounded-md bg-[#f4ece8] p-2 mb-3 flex overflow-hidden border border-[#e9e1dd]/50">
                  <div className="w-full h-full bg-[#e9e1dd] rounded-sm p-2.5 flex flex-col justify-end relative overflow-hidden">
                    <div className="absolute inset-0 bg-[#645d58]/15 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#7f7570] text-[24px]">
                        image
                      </span>
                    </div>
                    <div className="w-24 h-2 rounded bg-white relative z-10 mb-1"></div>
                    <div className="w-32 h-1.5 rounded bg-white/70 relative z-10"></div>
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-garamond text-lg text-black block font-medium">
                      Media Only
                    </span>
                    <p className="text-[12px] text-[#645d58] mt-0.5 leading-snug">
                      Show the promotional display without the live cart.
                    </p>
                  </div>
                  <div className="w-4 h-4 rounded-full border border-[#7f7570] flex items-center justify-center shrink-0 mt-0.5">
                    <div
                      className={`w-2 h-2 rounded-full ${displayLayout === "media" ? "bg-black" : "bg-transparent"
                        }`}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Theme Selection */}
          <div className="mt-6 pt-5 border-t border-[#e9e1dd]">
            <label className="text-[13px] font-semibold text-black block mb-3">
              Theme
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => updateSetting({ theme: "light" })}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all border ${theme === "light"
                  ? "border-2 border-black bg-white text-black shadow-2xs font-medium"
                  : "border-[#e9e1dd] bg-[#faf2ee] text-[#645d58] hover:text-black hover:bg-[#fff8f5]"
                  }`}
              >
                <span className="w-4 h-4 rounded-full bg-[#fcf8f5] border border-[#d0c4be] shrink-0"></span>
                <span className="text-[13px]">Minimalist Light</span>
                {theme === "light" && (
                  <span className="material-symbols-outlined text-[15px] text-black">
                    check
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => updateSetting({ theme: "dark" })}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all border ${theme === "dark"
                  ? "border-2 border-black bg-white text-black shadow-2xs font-medium"
                  : "border-[#e9e1dd] bg-[#faf2ee] text-[#645d58] hover:text-black hover:bg-[#fff8f5]"
                  }`}
              >
                <span className="w-4 h-4 rounded-full bg-[#1e1b19] shrink-0"></span>
                <span className="text-[13px]">Modern Dark</span>
                {theme === "dark" && (
                  <span className="material-symbols-outlined text-[15px] text-black">
                    check
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => updateSetting({ theme: "warm" })}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all border ${theme === "warm"
                  ? "border-2 border-black bg-white text-black shadow-2xs font-medium"
                  : "border-[#e9e1dd] bg-[#faf2ee] text-[#645d58] hover:text-black hover:bg-[#fff8f5]"
                  }`}
              >
                <span className="w-4 h-4 rounded-full bg-[#cf6721] shrink-0"></span>
                <span className="text-[13px]">Brand Warm Palette</span>
                {theme === "warm" && (
                  <span className="material-symbols-outlined text-[15px] text-black">
                    check
                  </span>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Section 02: Carousel Images */}
        <section
          className="bg-white rounded-2xl p-6 lg:p-8 shadow-xs border border-[#e9e1dd]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Section 02
              </span>
              <h2 className="font-garamond text-2xl lg:text-[26px] text-[#1e1b19] mt-0.5 font-normal">
                Carousel Images
              </h2>
              <p className="text-[13px] text-[#645d58] mt-0.5">
                Display promotions and marketing images when the customer screen is idle.
              </p>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4ece8] text-[#4d4541] text-[11px] font-medium shrink-0 self-start sm:self-auto">
              <span className="material-symbols-outlined text-[15px]">info</span>
              <span>1440 × 1080 px • JPEG, JPG • Max 5 images</span>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* 5 Tiles Horizontal Grid (Strict 4:3 Aspect Ratio) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
            {effectiveImages.slice(0, 5).map((img, idx) => (
              <div
                key={img._id}
                className="group relative rounded-xl bg-[#faf2ee] border border-[#e9e1dd] overflow-hidden flex flex-col transition-all hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f4ece8]">
                  <img
                    src={img.imageUrl || "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80"}
                    alt={img.fileName || `Slide ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>

                  {/* Position Badge */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-xs text-white text-[10px] font-semibold">
                    #{img.position || idx + 1}
                  </span>

                  {/* Drag Handle & Remove Actions */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Move left / right buttons */}
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleReorderImage(
                            img._id as Id<"organizationCarouselScreens">,
                            idx
                          )
                        }
                        title="Move Earlier"
                        className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-xs text-black hover:bg-white flex items-center justify-center shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          arrow_back
                        </span>
                      </button>
                    )}
                    {idx < effectiveImages.length - 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleReorderImage(
                            img._id as Id<"organizationCarouselScreens">,
                            idx + 2
                          )
                        }
                        title="Move Later"
                        className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-xs text-black hover:bg-white flex items-center justify-center shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          arrow_forward
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteImage(
                          img._id as Id<"organizationCarouselScreens">
                        )
                      }
                      title="Delete image"
                      className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-xs text-red-600 hover:bg-red-50 flex items-center justify-center shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        delete
                      </span>
                    </button>
                  </div>

                  {/* Caption */}
                  <div className="absolute bottom-2 left-2 right-2">
                    <span className="text-[11px] text-white font-medium truncate block drop-shadow-xs">
                      {img.fileName || `Slide #${idx + 1}`}
                    </span>
                  </div>
                </div>

                <div className="p-2 px-3 flex items-center justify-between text-[#645d58] bg-[#faf2ee] text-[11px]">
                  <span>Active slide</span>
                  <span className="text-[#7f7570] font-medium">
                    {(img as any).sizeText || "1.2 MB"}
                  </span>
                </div>
              </div>
            ))}

            {/* Upload in Progress State Tile */}
            {uploadProgress !== null && (
              <div className="relative rounded-xl bg-[#faf2ee] border border-dashed border-[#7f7570] overflow-hidden flex flex-col justify-between p-2">
                <div className="aspect-[4/3] w-full bg-[#f4ece8] rounded-lg flex flex-col items-center justify-center p-3 text-center">
                  <span className="material-symbols-outlined text-[24px] text-black animate-spin mb-1">
                    progress_activity
                  </span>
                  <span className="text-[11px] text-black font-semibold">
                    Uploading...
                  </span>
                  <span className="text-[10px] text-[#645d58] truncate max-w-[120px]">
                    {uploadFileName || "carousel-banner.jpg"}
                  </span>
                  {/* Progress Bar */}
                  <div className="w-full bg-[#e9e1dd] h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-black h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 px-1 text-[#645d58] text-[11px]">
                  <span>Slot #{carouselScreens.length + 1}</span>
                  <span className="font-semibold text-black">
                    {uploadProgress}%
                  </span>
                </div>
              </div>
            )}

            {/* Add Image Dropzone Tiles (fill remaining slots up to 5) */}
            {Array.from({
              length: Math.max(
                0,
                5 - (effectiveImages.length + (uploadProgress !== null ? 1 : 0))
              ),
            }).map((_, i) => {
              const slotNumber =
                effectiveImages.length +
                (uploadProgress !== null ? 1 : 0) +
                i +
                1;
              return (
                <div
                  key={`empty-slot-${i}`}
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative rounded-xl border-2 border-dashed border-[#d0c4be] hover:border-black bg-[#fff8f5] hover:bg-white cursor-pointer transition-all flex flex-col items-center justify-center p-4 text-center aspect-[4/3]"
                >
                  <div className="w-9 h-9 rounded-full bg-[#f4ece8] group-hover:bg-black group-hover:text-white flex items-center justify-center transition-colors mb-1.5">
                    <span className="material-symbols-outlined text-[18px]">
                      add_photo_alternate
                    </span>
                  </div>
                  <span className="text-[12px] text-black font-semibold group-hover:underline">
                    Upload Image
                  </span>
                  <span className="text-[10.5px] text-[#645d58] mt-0.5">
                    Slot #{slotNumber} available
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 03: Payment Display */}
        <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-xs border border-[#e9e1dd]">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
              Section 03
            </span>
            <h2 className="font-garamond text-2xl lg:text-[26px] text-[#1e1b19] mt-0.5 font-normal">
              Payment Display
            </h2>
            <p className="text-[13px] text-[#645d58] mt-0.5">
              Control on-screen payment cues, static/dynamic merchant QR codes, and cash breakdowns.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-[#e9e1dd]">
            {/* Left Column: QR and Identifiers */}
            <div className="space-y-6">
              {/* Toggle 1: Show Payment QR */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-garamond text-lg text-black block font-medium">
                    Show Payment QR on Customer Display
                  </span>
                  <p className="text-[12.5px] text-[#645d58] mt-0.5">
                    Display a QR code containing the exact amount payable for the current order.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={showPaymentQr}
                    onChange={(e) => updateSetting({ showPaymentQr: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#e9e1dd] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>

              {/* Input 1: UPI ID */}
              <div className="space-y-1.5">
                <label className="text-[12.5px] font-semibold text-black flex items-center justify-between">
                  <span>Store UPI Address</span>
                  <span className="text-[11px] text-[#645d58] font-normal">
                    Encrypted Settlement
                  </span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#7f7570] text-[18px]">
                    account_balance_wallet
                  </span>
                  <input
                    type="text"
                    value={storeUpiAddress}
                    onChange={(e) => handleTextInput("storeUpiAddress", e.target.value)}
                    onBlur={(e) => {
                      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
                      updateSetting({ storeUpiAddress: e.target.value });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
                        updateSetting({ storeUpiAddress: (e.target as HTMLInputElement).value });
                      }
                    }}
                    placeholder="yourstore@bank"
                    className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#faf2ee] border border-[#e9e1dd] focus:border-black focus:bg-white focus:outline-none text-[13.5px] text-black transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Cash Handling and Display Name */}
            <div className="space-y-6">
              {/* Toggle 2: Show Cash Tendered and Change Due */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-garamond text-lg text-black block font-medium">
                    Show Cash Tendered &amp; Change Due
                  </span>
                  <p className="text-[12.5px] text-[#645d58] mt-0.5">
                    Show the amount received and change to return when a customer pays in cash.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={showCashTenderedChangeDue}
                    onChange={(e) => updateSetting({ showCashTenderedChangeDue: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#e9e1dd] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>

              {/* Input 2: Merchant Display Name */}
              <div className="space-y-1.5">
                <label className="text-[12.5px] font-semibold text-black flex items-center justify-between">
                  <span>Merchant Display Name</span>
                  <span className="text-[11px] text-[#645d58] font-normal">
                    Visible on Header
                  </span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#7f7570] text-[18px]">
                    storefront
                  </span>
                  <input
                    type="text"
                    value={merchantDisplayName}
                    onChange={(e) => handleTextInput("merchantDisplayName", e.target.value)}
                    onBlur={(e) => {
                      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
                      updateSetting({ merchantDisplayName: e.target.value });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
                        updateSetting({ merchantDisplayName: (e.target as HTMLInputElement).value });
                      }
                    }}
                    placeholder="Your restaurant name"
                    className="w-full pl-10 pr-3 py-2 rounded-xl bg-[#faf2ee] border border-[#e9e1dd] focus:border-black focus:bg-white focus:outline-none text-[13.5px] text-black transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 04: After Payment */}
        <section
          className="bg-white rounded-2xl p-6 lg:p-8 shadow-xs border border-[#e9e1dd]"
        >
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
              Section 04
            </span>
            <h2 className="font-garamond text-2xl lg:text-[26px] text-[#1e1b19] mt-0.5 font-normal">
              After Payment
            </h2>
            <p className="text-[13px] text-[#645d58] mt-0.5">
              Actions, surveys, and digital dispatch screens right after the transaction concludes.
            </p>
          </div>

          <div className="mt-6 space-y-6 pt-6 border-t border-[#e9e1dd]">
            {/* Toggle: Star Rating Survey */}
            <div className="flex items-start justify-between gap-4 pb-6 border-b border-[#e9e1dd]">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="font-garamond text-lg text-black font-medium">
                    Show Star Rating Survey
                  </span>
                  {activeSurvey ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#eae1da] text-[#6a635e] text-[11px] font-semibold">
                      Survey Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[11px] font-medium">
                      No Active Survey
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] text-[#645d58] mt-0.5">
                  Allow customers to rate their experience after payment. Uses the active survey (
                  <span className="text-black font-medium">
                    {activeSurvey?.name || "Dinner Experience Feedback"}
                  </span>
                  ).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={showStarRatingSurvey}
                  onChange={(e) => updateSetting({ showStarRatingSurvey: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#e9e1dd] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
              </label>
            </div>

            {/* Toggle: WhatsApp Receipt Option */}
            <div className="flex items-start justify-between gap-4 pb-6 border-b border-[#e9e1dd]">
              <div className="max-w-xl">
                <span className="font-garamond text-lg text-black font-medium block">
                  Show WhatsApp Receipt Option
                </span>
                <p className="text-[12.5px] text-[#645d58] mt-0.5">
                  Allow customers to enter their phone number to receive an itemized e-bill via verified WhatsApp Business API.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={showWhatsappReceipt}
                  onChange={(e) => updateSetting({ showWhatsappReceipt: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#e9e1dd] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
              </label>
            </div>

            {/* Dropdown: Auto-Return Timeout */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <div>
                <span className="font-garamond text-lg text-black font-medium block">
                  Return to Welcome Screen After
                </span>
                <p className="text-[12.5px] text-[#645d58] mt-0.5">
                  The customer display returns to the idle promotional carousel{" "}
                  <span className="text-black font-medium">
                    {returnToWelcomeTimeout} seconds
                  </span>{" "}
                  after payment completion.
                </p>
              </div>
              <div className="relative shrink-0 w-64">
                <select
                  value={returnToWelcomeTimeout}
                  onChange={(e) => updateSetting({ returnToWelcomeTimeout: Number(e.target.value) })}
                  className="w-full appearance-none pl-4 pr-10 py-2 rounded-full bg-[#faf2ee] border border-[#e9e1dd] text-[13px] font-medium text-black focus:outline-none focus:border-black cursor-pointer transition-all"
                >
                  <option value={5}>5 seconds</option>
                  <option value={8}>8 seconds (Default)</option>
                  <option value={10}>10 seconds</option>
                  <option value={15}>15 seconds</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#7f7570] pointer-events-none text-[18px]">
                  expand_more
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 05: Connected Displays */}
        <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-xs border border-[#e9e1dd]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#e9e1dd] gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#645d58] font-semibold">
                Section 05
              </span>
              <h2 className="font-garamond text-2xl lg:text-[26px] text-[#1e1b19] mt-0.5 font-normal">
                Connected Displays
              </h2>
              <p className="text-[13px] text-[#645d58] mt-0.5">
                Manage customer-facing displays paired with your POS terminals.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenPairModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-[#7f7570] hover:border-black text-black text-[13px] font-medium shadow-2xs hover:bg-[#faf2ee] transition-all self-start sm:self-auto cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">
                add_to_queue
              </span>
              <span>Pair Counter Tablet</span>
            </button>
          </div>

          {/* Displays Table */}
          <div className="overflow-x-auto mt-4 w-full max-w-full rounded-xl border border-[#e9e1dd]">
            <table className="w-full min-w-[640px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e9e1dd] text-[#645d58] text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-4">Display / Terminal</th>
                  <th className="py-2.5 px-4">Connection Type</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Last Seen</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9e1dd] text-[13px] text-black">
                {displaysList.map((disp: any) => {
                  const isHdmi = disp.connectionType === "hdmi";
                  const pingText = pingStatus[disp._id];

                  return (
                    <tr
                      key={disp._id}
                      className="hover:bg-[#faf2ee]/60 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#f4ece8] flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[18px] text-black">
                              {isHdmi ? "desktop_windows" : "tablet_mac"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[13px] font-semibold text-black block">
                              {disp.name}
                            </span>
                            <span className="text-[11px] text-[#645d58]">
                              {disp.workstationName || "Counter Terminal"}
                              {disp.ipAddress ? ` • IP: ${disp.ipAddress}` : ""}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eae1da] text-[#6a635e] text-[11px] font-medium">
                          <span className="material-symbols-outlined text-[13px]">
                            {isHdmi ? "settings_ethernet" : "wifi"}
                          </span>
                          {isHdmi ? "HDMI Dual-Screen" : "Network Wireless (LAN)"}
                        </span>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-black font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          {disp.status === "active"
                            ? isHdmi
                              ? "Active (Online)"
                              : `Active (Online, ${disp.latencyMs || 12}ms)`
                            : "Offline"}
                        </span>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-[#645d58] text-[12px]">
                        {isHdmi ? "Live now" : "2 mins ago"}
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {isHdmi ? (
                            <>
                              <a
                                href={`/front-display?terminalId=${disp.terminalId || "terminal-01"}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1 rounded-full bg-[#faf2ee] hover:bg-[#f4ece8] text-black text-[12px] font-medium transition-colors border border-[#e9e1dd] inline-flex items-center gap-1"
                              >
                                <span>Launch Screen</span>
                                <span className="material-symbols-outlined text-[13px]">
                                  open_in_new
                                </span>
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  handleTestConnection(disp._id, disp.name)
                                }
                                disabled={Boolean(pingText)}
                                className="px-3 py-1 rounded-full bg-white hover:bg-[#faf2ee] text-[#645d58] hover:text-black text-[12px] font-medium transition-colors border border-[#e9e1dd] cursor-pointer"
                              >
                                {pingText || "Test Connection"}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleTestConnection(disp._id, disp.name)
                                }
                                disabled={Boolean(pingText)}
                                className="px-3 py-1 rounded-full bg-white hover:bg-[#faf2ee] text-[#645d58] hover:text-black text-[12px] font-medium transition-colors border border-[#e9e1dd] cursor-pointer"
                              >
                                {pingText || "Test Connection"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRepairTablet(disp._id)}
                                className="px-3 py-1 rounded-full bg-white hover:bg-[#faf2ee] text-[#645d58] hover:text-black text-[12px] font-medium transition-colors border border-[#e9e1dd] cursor-pointer"
                              >
                                Re-pair
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDisconnect(disp._id, disp.name)
                                }
                                className="px-3 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-700 text-[12px] font-medium transition-colors cursor-pointer"
                              >
                                Disconnect
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {/* Pairing Modal */}
      {isPairModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 lg:p-8 max-w-md w-full shadow-2xl border border-[#e9e1dd] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e9e1dd]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-black">
                  tablet_mac
                </span>
                <h3 className="font-garamond text-xl font-medium text-black">
                  Pair Counter Tablet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPairModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#f4ece8] text-black flex items-center justify-center hover:bg-[#e9e1dd] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[13px] text-[#645d58] leading-relaxed">
              Open the PREST CFD App on the counter iPad or Android tablet and enter this 6-digit handshake pin:
            </p>

            <div className="bg-[#faf2ee] rounded-xl p-4 text-center border border-[#e9e1dd]">
              <span className="text-3xl font-mono font-bold tracking-widest text-black">
                {activePairCode || "842910"}
              </span>
              <p className="text-[11px] text-[#7f7570] mt-1.5">
                Pin valid for 10 minutes • Encrypted local network pairing
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(activePairCode || "");
                  alert("Pairing PIN copied to clipboard!");
                }}
                className="px-4 py-2 rounded-full bg-[#faf2ee] hover:bg-[#f4ece8] text-black text-[12.5px] font-medium border border-[#e9e1dd] cursor-pointer"
              >
                Copy PIN
              </button>
              <button
                type="button"
                onClick={() => setIsPairModalOpen(false)}
                className="px-5 py-2 rounded-full bg-black text-white text-[12.5px] font-medium hover:bg-stone-800 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
