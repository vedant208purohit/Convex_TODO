"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// ==========================================
// PIXEL-PERFECT SWITCH / TOGGLE COMPONENT
// ==========================================

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

function Switch({ checked, onChange, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0c0a09] focus:ring-offset-2 ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      } ${checked ? "bg-[#0c0a09]" : "bg-gray-200"}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Small Switch variant for inner cards
function SmallSwitch({ checked, onChange, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0c0a09] focus:ring-offset-2 ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      } ${checked ? "bg-[#0c0a09]" : "bg-gray-200"}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ==========================================
// ICONS
// ==========================================

function StorefrontIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2" />
    </svg>
  );
}

function RestaurantIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2v20" />
      <path d="M18 2h-4v6a2 2 0 0 0 2 2h2" />
      <path d="M6 2v20" />
      <path d="M6 2h4v6a2 2 0 0 1-2 2H6" />
    </svg>
  );
}

function MallIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function MopedIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="2.5" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <path d="M15 6h5v3l-2.5 3" />
      <path d="M9 18h6" />
      <path d="M13 11h-4l-3 4" />
    </svg>
  );
}

function CalendarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function StoreIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CashierIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronUpIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function BoltIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function WarningIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function VerifiedIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SyncIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6" />
      <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function EditIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

type TabType = "general" | "serviceModes" | "cashier";

export function OrganizationFeatures() {
  const [activeTab, setActiveTab] = useState<TabType>("general");

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // ------------------------------------------
  // CONVEX HOOKS
  // ------------------------------------------

  // 1. Store Organization Record Query & Mutation
  const organizations = useQuery(api.organizations.list);
  const org = organizations?.[0] ?? null;
  const isOrgLoading = organizations === undefined;
  const updateOrg = useMutation(api.organizations.update);

  // 2. Store Feature Flags Query & Mutations
  const featuresList = useQuery(api.organizationFeatures.list, {});
  const isFeaturesLoading = featuresList === undefined;
  const toggleFeature = useMutation(api.organizationFeatures.toggle);
  const initializeDefaults = useMutation(api.organizationFeatures.initializeDefaults);

  // 3. Schedule Pickups Query & Mutations
  const scheduleConfig = useQuery(api.organizationSchedulePickups.get, {});
  const updateScheduleConfig = useMutation(api.organizationSchedulePickups.update);

  // Auto-initialize feature flag defaults if none exist
  useEffect(() => {
    if (featuresList !== undefined && featuresList.length === 0 && org?._id) {
      initializeDefaults({ organizationId: org._id }).catch((err) => {
        console.error("Failed to initialize feature defaults:", err);
      });
    }
  }, [featuresList, org?._id, initializeDefaults]);

  // Count active modes (Dine in, Takeaway, Delivery, Scheduled Delivery, Scheduled Pickup)
  const activeModesCount = [
    org?.isDineIn,
    org?.isTakeAway,
    org?.isDelivery,
    org?.scheduledDelivery,
    org?.scheduledPickup,
  ].filter(Boolean).length;

  // Count active cashier flags
  const cashierKeys = [
    "show_table_tab_in_cashier",
    "show_member_number_on_cashier_card",
    "show_table_on_cashier_card",
    "show_waiter_on_cashier_card",
    "skip_payment_on_cashier_card",
    "skip_phone_number_required",
  ];
  const activeCashierFlagsCount = cashierKeys.filter((key) => {
    return featuresList?.find((f) => f.featureKey === key)?.active ?? false;
  }).length;

  // Helper function to get feature flag by key
  const getFeatureFlag = (key: string) => {
    return featuresList?.find((f) => f.featureKey === key)?.active ?? false;
  };

  // Helper handler for feature flag toggle
  const handleFeatureToggle = async (featureKey: string, currentActive: boolean) => {
    try {
      await toggleFeature({
        organizationId: org?._id,
        featureKey,
        active: !currentActive,
      });
      showToast(`Feature flag updated successfully.`);
    } catch (err: any) {
      showToast(err.message || "Failed to update feature flag", "error");
    }
  };

  // Helper handler for org capability toggle
  const handleOrgToggle = async (key: string, currentValue: boolean, extraPayload: Record<string, any> = {}) => {
    if (!org?._id) return;
    try {
      await updateOrg({
        id: org._id,
        [key]: !currentValue,
        ...extraPayload,
      });
      showToast(`Setting updated successfully.`);
    } catch (err: any) {
      showToast(err.message || "Failed to update setting", "error");
    }
  };

  // Channel toggle guard ensuring at least one main service mode remains enabled
  const handleChannelToggle = async (key: "isDineIn" | "isTakeAway" | "isDelivery", currentValue: boolean) => {
    if (!org?._id) return;
    if (currentValue) {
      const dineIn = key === "isDineIn" ? false : Boolean(org.isDineIn);
      const takeaway = key === "isTakeAway" ? false : Boolean(org.isTakeAway);
      const delivery = key === "isDelivery" ? false : Boolean(org.isDelivery);

      if (!dineIn && !takeaway && !delivery) {
        showToast("At least one service mode (Dine-in, Takeaway, or Delivery) must remain enabled.", "error");
        return;
      }
    }

    try {
      await updateOrg({
        id: org._id,
        [key]: !currentValue,
      });
      showToast("Service mode updated successfully.");
    } catch (err: any) {
      showToast(err.message || "Failed to update service mode", "error");
    }
  };

  // Generic Billing Type Toggle with minimum 1 payment mode guard per service mode
  const handleBillingTypeToggle = async (targetKey: string, oppositeKey: string) => {
    if (!org?._id) return;
    const currentTarget = Boolean((org as any)[targetKey]);
    const currentOpposite = Boolean((org as any)[oppositeKey]);

    if (currentTarget && !currentOpposite) {
      showToast("At least one payment mode must remain enabled.", "error");
      return;
    }

    try {
      await updateOrg({
        id: org._id,
        [targetKey]: !currentTarget,
      });
      showToast("Payment mode updated successfully.");
    } catch (err: any) {
      showToast(err.message || "Failed to update payment mode", "error");
    }
  };

  // ------------------------------------------
  // RENDER STATES
  // ------------------------------------------

  if (isOrgLoading || isFeaturesLoading) {
    return (
      <div className="py-16 text-center">
        <div className="w-8 h-8 mx-auto border-2 border-[#141010] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-[#5e5e5e]">Loading Features Settings...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`p-4 mb-4 rounded-xl border text-sm font-medium transition-all shrink-0 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Fixed / Sticky Top Header (Title + Subtitle + Pill + Sub-tabs) */}
      <div className="shrink-0 space-y-4 bg-[#fdf8f7] pb-3 border-b border-[#e7e5e4]">
        {/* Page Header Title Section & Metric Pill */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-semibold text-[#5e5e5e] tracking-widest uppercase font-sans">
              SETTINGS / FEATURES
            </span>
            <h1 className="text-[30px] leading-tight text-[#141010] font-normal mt-1" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
              Features
            </h1>
            <p className="text-sm text-[#5e5e5e] mt-1">
              Configure operational feature flags and POS terminal preferences.
            </p>
          </div>

          {/* Dynamic Metric Pill depending on active tab */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-[#e7e5e4] rounded-full shadow-sm text-xs font-medium text-[#141010]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {activeTab === "cashier" ? (
              <span>{activeCashierFlagsCount} of 6 Flags Active</span>
            ) : activeTab === "serviceModes" ? (
              <span>{activeModesCount} of 5 Modes Active</span>
            ) : (
              <span>Store Features Active</span>
            )}
          </div>
        </div>

        {/* Horizontal Header Tabs */}
        <div className="flex items-center gap-8 text-sm font-medium pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`pb-2.5 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "general"
                ? "text-[#141010] border-b-2 border-[#0c0a09] font-semibold"
                : "text-[#5e5e5e] hover:text-[#141010]"
            }`}
          >
            <span>General</span>
            {activeTab === "general" && <span className="w-1.5 h-1.5 rounded-full bg-[#0c0a09]" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("serviceModes")}
            className={`pb-2.5 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "serviceModes"
                ? "text-[#141010] border-b-2 border-[#0c0a09] font-semibold"
                : "text-[#5e5e5e] hover:text-[#141010]"
            }`}
          >
            <span>Service Modes</span>
            {activeTab === "serviceModes" && <span className="w-1.5 h-1.5 rounded-full bg-[#0c0a09]" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cashier")}
            className={`pb-2.5 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "cashier"
                ? "text-[#141010] border-b-2 border-[#0c0a09] font-semibold"
                : "text-[#5e5e5e] hover:text-[#141010]"
            }`}
          >
            <span>Cashier</span>
            {activeTab === "cashier" && <span className="w-1.5 h-1.5 rounded-full bg-[#0c0a09]" />}
          </button>
        </div>
      </div>

      {/* Scrollable Bottom Area (Content below sub-tabs) */}
      <div className="flex-1 overflow-y-auto pt-4 space-y-6 pr-1">
        {activeTab === "general" && (
          <GeneralSection
            org={org}
            getFeatureFlag={getFeatureFlag}
            handleOrgToggle={handleOrgToggle}
            handleFeatureToggle={handleFeatureToggle}
          />
        )}
        {activeTab === "serviceModes" && (
          <ServiceModesSection
            org={org}
            updateOrg={updateOrg}
            scheduleConfig={scheduleConfig}
            updateScheduleConfig={updateScheduleConfig}
            handleOrgToggle={handleOrgToggle}
            handleChannelToggle={handleChannelToggle}
            handleBillingTypeToggle={handleBillingTypeToggle}
            showToast={showToast}
          />
        )}
        {activeTab === "cashier" && (
          <CashierSection
            getFeatureFlag={getFeatureFlag}
            handleFeatureToggle={handleFeatureToggle}
          />
        )}

        {/* Sync Status Footer Banner */}
        <div className="mt-8 pt-4 border-t border-[#e7e5e4] flex items-center justify-between text-xs text-[#8a7e75] font-sans pb-4">
          <span className="flex items-center gap-1.5">
            <VerifiedIcon className="w-4 h-4 text-emerald-600" />
            <span>Synced with PREST Convex reactive cluster (Node #01)</span>
          </span>
          <span>Mahendra Suthar (Admin Access)</span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 1. GENERAL SECTION
// ==========================================

interface GeneralSectionProps {
  org: any;
  getFeatureFlag: (key: string) => boolean;
  handleOrgToggle: (key: string, currentValue: boolean) => void;
  handleFeatureToggle: (key: string, currentActive: boolean) => void;
}

function GeneralSection({ org, getFeatureFlag, handleOrgToggle, handleFeatureToggle }: GeneralSectionProps) {
  const isVeg = org?.isVeg ?? false;
  const autoAccept = getFeatureFlag("auto_accept");

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#e7e5e4] rounded-lg shadow-sm overflow-hidden transition-all">
        {/* Card Header */}
        <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between border-b border-[#e7e5e4] bg-[#fdf8f7]/95 backdrop-blur-sm">
          <div className="flex items-center gap-3.5">
            <StorefrontIcon className="w-5 h-5 text-[#141010]" />
            <div>
              <h3 className="text-lg font-medium text-[#141010] leading-snug" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
                General Store Preferences
              </h3>
              <p className="text-xs text-[#5e5e5e] mt-0.5">
                Configure core culinary rules and baseline operating parameters for this outlet
              </p>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-4 bg-white">
          {/* Setting 1: Pure Vegetarian Restaurant */}
          <div className="p-4 bg-white border border-[#e7e5e4] rounded-md flex items-start justify-between hover:bg-neutral-50/40 transition-colors">
            <div className="pr-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-[#141010]">Pure Vegetarian Restaurant</h4>
                <span className="px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider rounded bg-[#f1edec] text-[#5e5e5e]">
                  Menu Taxonomy
                </span>
              </div>
              <p className="text-xs text-[#5e5e5e] mt-1 leading-relaxed max-w-2xl">
                Does this restaurant serve only vegetarian food? Toggle this setting to define your restaurant as vegetarian-only. Green vegetarian tags will be enforced across all menu items and POS terminals automatically.
              </p>
            </div>
            <Switch checked={isVeg} onChange={() => handleOrgToggle("isVeg", isVeg)} />
          </div>

          {/* Setting 2: Auto-accept Orders */}
          <div className="p-4 bg-white border border-[#e7e5e4] rounded-md flex items-start justify-between hover:bg-neutral-50/40 transition-colors">
            <div className="pr-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-[#141010]">Auto-accept orders?</h4>
                <span className="px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider rounded bg-[#0c0a09] text-white">
                  Order Workflow Automation
                </span>
              </div>
              <p className="text-xs text-[#5e5e5e] mt-1 leading-relaxed max-w-2xl">
                Enable this setting to automatically accept all incoming orders and dispatch Kitchen Order Tickets (KOT) directly to station displays. Disable it if you prefer to review and accept orders manually at the terminal.
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-[#141010] font-medium">
                <BoltIcon className="w-4 h-4 text-[#0c0a09]" />
                <span>Active trigger: Web QR, Mobile Aggregators, and Table Side self-service</span>
              </div>
            </div>
            <Switch checked={autoAccept} onChange={() => handleFeatureToggle("auto_accept", autoAccept)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. SERVICE MODES SECTION
// ==========================================

interface ServiceModesProps {
  org: any;
  updateOrg: any;
  scheduleConfig: any;
  updateScheduleConfig: any;
  handleOrgToggle: (key: string, currentValue: boolean, extra?: any) => void;
  handleChannelToggle: (key: "isDineIn" | "isTakeAway" | "isDelivery", currentValue: boolean) => void;
  handleBillingTypeToggle: (targetKey: string, oppositeKey: string) => void;
  showToast: (text: string, type?: "success" | "error") => void;
}

function ServiceModesSection({
  org,
  updateOrg,
  scheduleConfig,
  updateScheduleConfig,
  handleOrgToggle,
  handleChannelToggle,
  handleBillingTypeToggle,
  showToast,
}: ServiceModesProps) {
  // Accordion open states
  const [openDineIn, setOpenDineIn] = useState(true);
  const [openTakeaway, setOpenTakeaway] = useState(true);
  const [openDelivery, setOpenDelivery] = useState(true);
  const [openSchedDelivery, setOpenSchedDelivery] = useState(true);
  const [openSchedPickup, setOpenSchedPickup] = useState(true);

  // Porter Lag Time state
  const [lagTime, setLagTime] = useState<string>(String(org?.porterLagTime ?? 0));

  useEffect(() => {
    setLagTime(String(org?.porterLagTime ?? 0));
  }, [org?.porterLagTime]);

  const handlePorterLagTimeBlur = async () => {
    const num = parseInt(lagTime, 10);
    const validLagTime = isNaN(num) ? 0 : num;
    if (validLagTime !== (org?.porterLagTime ?? 0)) {
      try {
        await updateOrg({
          id: org._id,
          porterLagTime: validLagTime,
        });
        showToast("Lag time updated successfully.");
      } catch (err: any) {
        showToast(err.message || "Failed to update lag time", "error");
      }
    }
  };

  // Schedule Delivery Form States
  const schedDeliveryOrderTimeLimit = scheduleConfig?.advanceScheduleDeliveryOrderTimeLimit ?? "24";
  const [schedDeliveryLimitVal, setSchedDeliveryLimitVal] = useState<number>(scheduleConfig?.advanceDeliveryLimit ?? 1);
  const [schedDeliveryLimitType, setSchedDeliveryLimitType] = useState<string>(scheduleConfig?.advanceDeliveryLimitType ?? "Months");
  const [schedDeliverySlotSize, setSchedDeliverySlotSize] = useState<string>(scheduleConfig?.deliveryTimeSlotSize ?? "15 mins");

  // Schedule Pickup Form States
  const schedPickupOrderTimeLimit = scheduleConfig?.advanceOrderTimeLimit ?? "24";
  const [schedPickupLimitVal, setSchedPickupLimitVal] = useState<number>(scheduleConfig?.advancePickupLimit ?? 1);
  const [schedPickupLimitType, setSchedPickupLimitType] = useState<string>(scheduleConfig?.advancePickupLimitType ?? "Months");
  const [schedPickupSlotSize, setSchedPickupSlotSize] = useState<string>(scheduleConfig?.pickupTimeSlotSize ?? "15 mins");
  const [pickupAddressMode, setPickupAddressMode] = useState<"org" | "custom">("custom");

  const [pickupAddrLine1, setPickupAddrLine1] = useState(scheduleConfig?.pickupAddressLine1 ?? "34, Shreeji Nagar, Bhatkuwa road mumbai");
  const [pickupAddrLine2, setPickupAddrLine2] = useState(scheduleConfig?.pickupAddressLine2 ?? "Opposite Central Park");
  const [pickupCity, setPickupCity] = useState(scheduleConfig?.city ?? "Mumbai");
  const [pickupZipcode, setPickupZipcode] = useState(scheduleConfig?.zipcode ?? "400001");
  const [pickupState, setPickupState] = useState(scheduleConfig?.state ?? "Maharashtra");
  const [pickupCountry, setPickupCountry] = useState(scheduleConfig?.country ?? "India");

  useEffect(() => {
    if (scheduleConfig) {
      if (scheduleConfig.advanceDeliveryLimit !== undefined) setSchedDeliveryLimitVal(scheduleConfig.advanceDeliveryLimit);
      if (scheduleConfig.advanceDeliveryLimitType !== undefined) setSchedDeliveryLimitType(scheduleConfig.advanceDeliveryLimitType);
      if (scheduleConfig.deliveryTimeSlotSize !== undefined) setSchedDeliverySlotSize(scheduleConfig.deliveryTimeSlotSize);

      if (scheduleConfig.advancePickupLimit !== undefined) setSchedPickupLimitVal(scheduleConfig.advancePickupLimit);
      if (scheduleConfig.advancePickupLimitType !== undefined) setSchedPickupLimitType(scheduleConfig.advancePickupLimitType);
      if (scheduleConfig.pickupTimeSlotSize !== undefined) setSchedPickupSlotSize(scheduleConfig.pickupTimeSlotSize);

      if (scheduleConfig.pickupAddressLine1) setPickupAddrLine1(scheduleConfig.pickupAddressLine1);
      if (scheduleConfig.pickupAddressLine2) setPickupAddrLine2(scheduleConfig.pickupAddressLine2);
      if (scheduleConfig.city) setPickupCity(scheduleConfig.city);
      if (scheduleConfig.zipcode) setPickupZipcode(scheduleConfig.zipcode);
      if (scheduleConfig.state) setPickupState(scheduleConfig.state);
      if (scheduleConfig.country) setPickupCountry(scheduleConfig.country);
    }
  }, [scheduleConfig]);

  // Handle Save Scheduled Delivery Config
  const handleSaveSchedDelivery = async () => {
    try {
      await updateScheduleConfig({
        advanceScheduleDeliveryOrderTimeLimit: schedDeliveryOrderTimeLimit,
        advanceDeliveryLimit: Number(schedDeliveryLimitVal),
        advanceDeliveryLimitType: schedDeliveryLimitType,
        deliveryTimeSlotSize: schedDeliverySlotSize,
      });
      showToast("Scheduled delivery settings saved successfully.");
    } catch (err: any) {
      showToast(err.message || "Failed to save scheduled delivery config", "error");
    }
  };

  // Handle Save Scheduled Pickup Config
  const handleSaveSchedPickup = async () => {
    try {
      await updateScheduleConfig({
        advanceOrderTimeLimit: schedPickupOrderTimeLimit,
        advancePickupLimit: Number(schedPickupLimitVal),
        advancePickupLimitType: schedPickupLimitType,
        pickupTimeSlotSize: schedPickupSlotSize,
        pickupAddressLine1: pickupAddrLine1,
        pickupAddressLine2: pickupAddrLine2,
        city: pickupCity,
        zipcode: pickupZipcode,
        state: pickupState,
        country: pickupCountry,
      });
      showToast("Scheduled pickup settings saved successfully.");
    } catch (err: any) {
      showToast(err.message || "Failed to save scheduled pickup config", "error");
    }
  };

  // Fetch Organization Operational Timings Handler
  const handleFetchOrgTimings = async (type: "delivery" | "pickup") => {
    if (!org?.operationTiming) {
      showToast("No store operation timings found to fetch.", "error");
      return;
    }
    try {
      if (type === "delivery") {
        await updateScheduleConfig({
          deliveryTimings: org.operationTiming,
        });
        showToast("Fetched store operational timings for Delivery.");
      } else {
        await updateScheduleConfig({
          pickupTimings: org.operationTiming,
        });
        showToast("Fetched store operational timings for Pickup.");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to fetch operational timings", "error");
    }
  };

  // Use Organization Address Handler
  const handleUseOrgAddress = () => {
    setPickupAddressMode("org");
    if (org) {
      if (org.addressLine1) setPickupAddrLine1(org.addressLine1);
      if (org.addressLine2) setPickupAddrLine2(org.addressLine2);
      if (org.city) setPickupCity(org.city);
      if (org.zipCode) setPickupZipcode(org.zipCode);
      if (org.state) setPickupState(org.state);
      if (org.country) setPickupCountry(org.country);
      showToast("Populated address from store organization profile.");
    }
  };

  return (
    <div className="space-y-4">
      {/* -------------------------------------- */}
      {/* 1. DINE IN ACCORDION */}
      {/* -------------------------------------- */}
      <div className="bg-white border border-[#e7e5e4] rounded-lg shadow-sm overflow-hidden transition-all">
        <div
          onClick={() => setOpenDineIn((prev) => !prev)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50/60 transition-colors select-none"
        >
          <div className="flex items-center gap-3.5">
            <RestaurantIcon className="w-5 h-5 text-[#141010]" />
            <div>
              <h3 className="text-lg font-medium text-[#141010] leading-snug" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
                Dine in
              </h3>
              <p className="text-xs text-[#5e5e5e] mt-0.5">
                Table seating, guest cover counts, and floor-plan order management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Switch
              checked={org?.isDineIn ?? false}
              onChange={() => handleChannelToggle("isDineIn", org?.isDineIn ?? false)}
            />
            <button type="button" className="text-[#5e5e5e] hover:text-[#141010] transition-colors">
              {openDineIn ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {openDineIn && (
          <div className="px-6 pb-6 pt-2 border-t border-[#e7e5e4]/60 bg-[#fdf8f7]/50 space-y-4">
            <p className="text-xs italic text-[#5e5e5e]">
              Note: Turn on the billing types according to your needs. (Turn on any one)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Prepaid Card */}
              <div className="p-4 bg-white border border-[#e7e5e4] rounded-md flex items-start justify-between">
                <div className="pr-3">
                  <h4 className="text-sm font-semibold text-[#141010]">Prepaid</h4>
                  <p className="text-xs text-[#5e5e5e] mt-1 leading-relaxed">
                    Prepaid means customers pay for their order upfront before receiving the service or meal.
                  </p>
                </div>
                <SmallSwitch
                  checked={org?.dineinPrepaid ?? false}
                  disabled={!(org?.isDineIn ?? false)}
                  onChange={() => handleBillingTypeToggle("dineinPrepaid", "dineinPospaid")}
                />
              </div>

              {/* Postpaid Card */}
              <div className="p-4 bg-white border border-[#e7e5e4] rounded-md flex items-start justify-between">
                <div className="pr-3">
                  <h4 className="text-sm font-semibold text-[#141010]">Postpaid</h4>
                  <p className="text-xs text-[#5e5e5e] mt-1 leading-relaxed">
                    Postpaid allows them to pay after they have finished dining or received their service.
                  </p>
                </div>
                <SmallSwitch
                  checked={org?.dineinPospaid ?? false}
                  disabled={!(org?.isDineIn ?? false)}
                  onChange={() => handleBillingTypeToggle("dineinPospaid", "dineinPrepaid")}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------- */}
      {/* 2. TAKEAWAY ACCORDION */}
      {/* -------------------------------------- */}
      <div className="bg-white border border-[#e7e5e4] rounded-lg shadow-sm overflow-hidden transition-all">
        <div
          onClick={() => setOpenTakeaway((prev) => !prev)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50/60 transition-colors select-none"
        >
          <div className="flex items-center gap-3.5">
            <MallIcon className="w-5 h-5 text-[#141010]" />
            <div>
              <h3 className="text-lg font-medium text-[#141010] leading-snug" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
                Takeaway
              </h3>
              <p className="text-xs text-[#5e5e5e] mt-0.5">
                Counter takeaway, express pickup tokens, and packaging buffers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Switch
              checked={org?.isTakeAway ?? false}
              onChange={() => handleChannelToggle("isTakeAway", org?.isTakeAway ?? false)}
            />
            <button type="button" className="text-[#5e5e5e] hover:text-[#141010] transition-colors">
              {openTakeaway ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {openTakeaway && (
          <div className="px-6 pb-6 pt-2 border-t border-[#e7e5e4]/60 bg-[#fdf8f7]/50 space-y-4">
            <p className="text-xs italic text-[#5e5e5e]">
              Note: Turn on the billing types according to your needs.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Online Payment Card */}
              <div className="p-4 bg-white border border-[#e7e5e4] rounded-md flex items-start justify-between">
                <div className="pr-3">
                  <h4 className="text-sm font-semibold text-[#141010]">Online payment</h4>
                  <p className="text-xs text-[#5e5e5e] mt-1 leading-relaxed">
                    Customers pay for their takeaway order online or in advance before arriving at the restaurant to collect it.
                  </p>
                </div>
                <SmallSwitch
                  checked={org?.takeAwayOnlinePayment ?? false}
                  disabled={!(org?.isTakeAway ?? false)}
                  onChange={() => handleBillingTypeToggle("takeAwayOnlinePayment", "takeAwayCashPayment")}
                />
              </div>

              {/* Cash Payment Card */}
              <div className="p-4 bg-white border border-[#e7e5e4] rounded-md flex items-start justify-between">
                <div className="pr-3">
                  <h4 className="text-sm font-semibold text-[#141010]">Cash payment</h4>
                  <p className="text-xs text-[#5e5e5e] mt-1 leading-relaxed">
                    Customers place their takeaway order and pay at the restaurant when they come to pick it up.
                  </p>
                </div>
                <SmallSwitch
                  checked={org?.takeAwayCashPayment ?? false}
                  disabled={!(org?.isTakeAway ?? false)}
                  onChange={() => handleBillingTypeToggle("takeAwayCashPayment", "takeAwayOnlinePayment")}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------- */}
      {/* 3. DELIVERY ACCORDION */}
      {/* -------------------------------------- */}
      <div className="bg-white border border-[#e7e5e4] rounded-lg shadow-sm overflow-hidden transition-all">
        <div
          onClick={() => setOpenDelivery((prev) => !prev)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50/60 transition-colors select-none"
        >
          <div className="flex items-center gap-3.5">
            <MopedIcon className="w-5 h-5 text-[#141010]" />
            <div>
              <h3 className="text-lg font-medium text-[#141010] leading-snug" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
                Delivery
              </h3>
              <p className="text-xs text-[#5e5e5e] mt-0.5">
                Direct door-to-door fulfillment and third-party aggregator routing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Switch
              checked={org?.isDelivery ?? false}
              onChange={() => handleChannelToggle("isDelivery", org?.isDelivery ?? false)}
            />
            <button type="button" className="text-[#5e5e5e] hover:text-[#141010] transition-colors">
              {openDelivery ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {openDelivery && (
          <div className="px-6 pb-6 pt-2 border-t border-[#e7e5e4]/60 bg-[#fdf8f7]/50 space-y-4">
            <p className="text-xs italic text-[#5e5e5e]">
              Note: Turn on the payment options according to your operational needs.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Online Payment Card */}
              <div className="p-4 bg-white border border-[#e7e5e4] rounded-md flex items-start justify-between">
                <div className="pr-2">
                  <h4 className="text-sm font-semibold text-[#141010]">Online payment</h4>
                  <p className="text-xs text-[#5e5e5e] mt-1 leading-relaxed">
                    Customers pay immediately through digital methods when placing the order.
                  </p>
                </div>
                <SmallSwitch
                  checked={org?.deliveryOnlinePayment ?? false}
                  disabled={!(org?.isDelivery ?? false)}
                  onChange={() => handleBillingTypeToggle("deliveryOnlinePayment", "deliveryCashOnDelivery")}
                />
              </div>

              {/* Cash on Delivery Card */}
              <div className="p-4 bg-white border border-[#e7e5e4] rounded-md flex items-start justify-between">
                <div className="pr-2">
                  <h4 className="text-sm font-semibold text-[#141010]">Cash on delivery</h4>
                  <p className="text-xs text-[#5e5e5e] mt-1 leading-relaxed">
                    Customers can choose to pay in cash when the order is delivered to them.
                  </p>
                </div>
                <SmallSwitch
                  checked={org?.deliveryCashOnDelivery ?? false}
                  disabled={!(org?.isDelivery ?? false)}
                  onChange={() => handleBillingTypeToggle("deliveryCashOnDelivery", "deliveryOnlinePayment")}
                />
              </div>

              {/* Use Delivery Aggregator Card */}
              <div className="p-4 bg-white border border-[#e7e5e4] rounded-md flex items-start justify-between">
                <div className="pr-2">
                  <h4 className="text-sm font-semibold text-[#141010]">Use Delivery aggregator</h4>
                  <p className="text-xs text-[#5e5e5e] mt-1 leading-relaxed">
                    Manage and streamline your delivery process by integrating with delivery aggregators.
                  </p>
                </div>
                <SmallSwitch
                  checked={org?.deliveryAggregator ?? false}
                  disabled={!(org?.isDelivery ?? false)}
                  onChange={() => handleOrgToggle("deliveryAggregator", org?.deliveryAggregator ?? false)}
                />
              </div>
            </div>

            {/* Aggregator Details Panel if Active */}
            {org?.deliveryAggregator && (
              <div className="pt-3 border-t border-[#e7e5e4] space-y-3 bg-white p-4 rounded-md border border-[#e7e5e4]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (org?.deliverPartner !== "porter") {
                        try {
                          await updateOrg({ id: org._id, deliverPartner: "porter" });
                          showToast("Delivery partner set to Porter.");
                        } catch (err: any) {
                          showToast(err.message || "Failed to update delivery partner", "error");
                        }
                      }
                    }}
                    className={`px-4 py-2 rounded-md border text-xs font-bold transition-all ${
                      org?.deliverPartner === "porter"
                        ? "border-[#0c0a09] bg-[#0c0a09] text-white"
                        : "border-[#e7e5e4] text-[#141010] bg-white hover:bg-neutral-50"
                    }`}
                  >
                    Porter
                  </button>

                  <div className="px-4 py-2 rounded-md border border-[#e7e5e4] text-xs font-medium text-[#8a7e75] bg-neutral-50 opacity-50 cursor-not-allowed">
                    Zomato
                  </div>

                  <div className="px-4 py-2 rounded-md border border-[#e7e5e4] text-xs font-medium text-[#8a7e75] bg-neutral-50 opacity-50 cursor-not-allowed">
                    Swiggy
                  </div>
                </div>

                <div className="space-y-1 max-w-xs">
                  <label className="text-xs font-semibold text-[#141010]">
                    Restaurant Lag time (in minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={lagTime}
                    onChange={(e) => setLagTime(e.target.value)}
                    onBlur={handlePorterLagTimeBlur}
                    placeholder="Enter lag time"
                    className="w-full px-3 py-1.5 text-xs rounded-md border border-[#e7e5e4] focus:outline-none focus:ring-1 focus:ring-[#0c0a09]"
                  />
                  <p className="text-[11px] text-[#5e5e5e] pt-0.5 leading-relaxed">
                    Lag time is the preparation time your restaurant needs before the delivery partner arrives.
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-md border border-amber-200/80 text-amber-900">
                  <WarningIcon className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    Using Porter Delivery Service will disable the Cash on Delivery option for delivery orders. Similarly, enabling Cash on Delivery will not allow the use of Porter Delivery Service. Please choose carefully to ensure seamless operations.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* -------------------------------------- */}
      {/* 4. SCHEDULED DELIVERY ACCORDION (FORM) */}
      {/* -------------------------------------- */}
      <div className="bg-white border border-[#e7e5e4] rounded-lg shadow-sm overflow-hidden transition-all">
        <div
          onClick={() => setOpenSchedDelivery((prev) => !prev)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50/60 transition-colors select-none"
        >
          <div className="flex items-center gap-3.5">
            <CalendarIcon className="w-5 h-5 text-[#141010]" />
            <div>
              <h3 className="text-lg font-medium text-[#141010] leading-snug" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
                Scheduled delivery
              </h3>
              <p className="text-xs text-[#5e5e5e] mt-0.5">
                Pre-order intake limits, operating delivery slots, and timing buffers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Switch
              checked={org?.scheduledDelivery ?? false}
              onChange={() => handleOrgToggle("scheduledDelivery", org?.scheduledDelivery ?? false, {
                scheduledDeliveryOnlinePayment: !(org?.scheduledDelivery ?? false) ? true : org?.scheduledDeliveryOnlinePayment,
              })}
            />
            <button type="button" className="text-[#5e5e5e] hover:text-[#141010] transition-colors">
              {openSchedDelivery ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {openSchedDelivery && (
          <div className="px-6 pb-6 pt-5 border-t border-[#e7e5e4]/60 bg-[#fdf8f7]/40 space-y-6">
            {/* 1. Advance Order Time Limit */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#141010] uppercase tracking-wider font-sans">
                Advance order time limit
              </label>
              <p className="text-xs text-[#5e5e5e]">Set how far in advance customers can place delivery orders.</p>
              <div className="flex items-center gap-2 pt-1">
                {["12", "24", "48", "72"].map((hrs) => {
                  const isSelected = schedDeliveryOrderTimeLimit === hrs;
                  return (
                    <button
                      key={hrs}
                      type="button"
                      onClick={async () => {
                        try {
                          await updateScheduleConfig({ advanceScheduleDeliveryOrderTimeLimit: hrs });
                          showToast("Updated advance delivery order time limit.");
                        } catch (err: any) {
                          showToast(err.message, "error");
                        }
                      }}
                      className={`px-4 py-2 border rounded text-xs font-medium transition-colors ${
                        isSelected
                          ? "border-[#0c0a09] bg-[#0c0a09] text-white shadow-sm"
                          : "border-[#e7e5e4] bg-white text-[#141010] hover:border-[#5e5e5e]"
                      }`}
                    >
                      {hrs}hrs
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#8a7e75] italic">
                Example: Restricting orders to be placed at least 24 hours before the desired delivery time.
              </p>
            </div>

            {/* 2. Advance Pickup Limit */}
            <div className="space-y-2 max-w-md">
              <label className="block text-xs font-semibold text-[#141010] uppercase tracking-wider font-sans">
                Advance pickup limit <span className="text-rose-500">*</span>
              </label>
              <p className="text-xs text-[#5e5e5e]">Control how early customers can book a delivery order.</p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min="1"
                  value={schedDeliveryLimitVal}
                  onChange={(e) => setSchedDeliveryLimitVal(Number(e.target.value))}
                  className="w-24 px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
                />
                <select
                  value={schedDeliveryLimitType}
                  onChange={(e) => setSchedDeliveryLimitType(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
                >
                  <option value="Months">Months</option>
                  <option value="Days">Days</option>
                  <option value="Weeks">Weeks</option>
                </select>
              </div>
              <p className="text-[11px] text-[#8a7e75] italic">
                Example: you can set the limit to 7 days or 1 month, enabling customers to conveniently plan their delivery within this timeframe.
              </p>
            </div>

            {/* 3. Delivery Timings & Fetch Trigger */}
            <div className="space-y-2">
              <div className="flex items-center justify-between max-w-lg">
                <label className="text-xs font-semibold text-[#141010] uppercase tracking-wider font-sans flex items-center gap-1.5">
                  <span>Delivery timings</span>
                  <EditIcon className="w-4 h-4 text-[#5e5e5e]" />
                </label>
              </div>
              <p className="text-xs text-[#5e5e5e]">Set specific delivery timings.</p>

              <div className="flex items-center gap-4 pt-1 max-w-lg">
                <div className="px-3.5 py-2 rounded border border-[#e7e5e4] bg-white text-xs text-[#141010] font-mono">
                  Operational window: 09:00 AM – 10:30 PM
                </div>
                <button
                  type="button"
                  onClick={() => handleFetchOrgTimings("delivery")}
                  className="px-4 py-2 border border-[#e7e5e4] bg-white hover:bg-neutral-50 rounded text-xs font-medium text-[#141010] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <SyncIcon className="w-4 h-4 text-[#141010]" />
                  <span>Fetch Organization's operational timings</span>
                </button>
              </div>
            </div>

            {/* 4. Delivery Time Slot Size */}
            <div className="space-y-2 max-w-md">
              <label className="block text-xs font-semibold text-[#141010] uppercase tracking-wider font-sans">
                Delivery time slot size
              </label>
              <p className="text-xs text-[#5e5e5e]">e.g. 30 mins slots will show open slots at 8:00, 8:30, 9:00 etc.</p>
              <select
                value={schedDeliverySlotSize}
                onChange={(e) => setSchedDeliverySlotSize(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
              >
                <option value="15 mins">15 mins</option>
                <option value="30 mins">30 mins</option>
                <option value="45 mins">45 mins</option>
                <option value="60 mins">60 mins</option>
              </select>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveSchedDelivery}
                className="px-5 py-2 bg-[#0c0a09] text-white rounded text-xs font-medium hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------- */}
      {/* 5. SCHEDULED PICKUP ACCORDION (FORM) */}
      {/* -------------------------------------- */}
      <div className="bg-white border border-[#e7e5e4] rounded-lg shadow-sm overflow-hidden transition-all">
        <div
          onClick={() => setOpenSchedPickup((prev) => !prev)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50/60 transition-colors select-none"
        >
          <div className="flex items-center gap-3.5">
            <StoreIcon className="w-5 h-5 text-[#141010]" />
            <div>
              <h3 className="text-lg font-medium text-[#141010] leading-snug" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
                Scheduled pickup
              </h3>
              <p className="text-xs text-[#5e5e5e] mt-0.5">
                Pre-set window slots, custom curbside counter address, and packing buffers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Switch
              checked={org?.scheduledPickup ?? false}
              onChange={() => handleOrgToggle("scheduledPickup", org?.scheduledPickup ?? false, {
                scheduledPickupOnlinePayment: !(org?.scheduledPickup ?? false) ? true : org?.scheduledPickupOnlinePayment,
              })}
            />
            <button type="button" className="text-[#5e5e5e] hover:text-[#141010] transition-colors">
              {openSchedPickup ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {openSchedPickup && (
          <div className="px-6 pb-6 pt-5 border-t border-[#e7e5e4]/60 bg-[#fdf8f7]/40 space-y-6">
            {/* 1. Advance Order Time Limit */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#141010] uppercase tracking-wider font-sans">
                Advance order time limit
              </label>
              <p className="text-xs text-[#5e5e5e]">Set how far in advance customers can place pickup orders.</p>
              <div className="flex items-center gap-2 pt-1">
                {["12", "24", "48", "72"].map((hrs) => {
                  const isSelected = schedPickupOrderTimeLimit === hrs;
                  return (
                    <button
                      key={hrs}
                      type="button"
                      onClick={async () => {
                        try {
                          await updateScheduleConfig({ advanceOrderTimeLimit: hrs });
                          showToast("Updated advance pickup order time limit.");
                        } catch (err: any) {
                          showToast(err.message, "error");
                        }
                      }}
                      className={`px-4 py-2 border rounded text-xs font-medium transition-colors ${
                        isSelected
                          ? "border-[#0c0a09] bg-[#0c0a09] text-white shadow-sm"
                          : "border-[#e7e5e4] bg-white text-[#141010] hover:border-[#5e5e5e]"
                      }`}
                    >
                      {hrs}hrs
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#8a7e75] italic">
                Example: Restricting orders to be placed at least 24 hours before the desired pickup time.
              </p>
            </div>

            {/* 2. Advance Pickup Limit */}
            <div className="space-y-2 max-w-md">
              <label className="block text-xs font-semibold text-[#141010] uppercase tracking-wider font-sans">
                Advance pickup limit <span className="text-rose-500">*</span>
              </label>
              <p className="text-xs text-[#5e5e5e]">Control how early customers can book a pickup order.</p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min="1"
                  value={schedPickupLimitVal}
                  onChange={(e) => setSchedPickupLimitVal(Number(e.target.value))}
                  className="w-24 px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
                />
                <select
                  value={schedPickupLimitType}
                  onChange={(e) => setSchedPickupLimitType(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
                >
                  <option value="Months">Months</option>
                  <option value="Days">Days</option>
                  <option value="Weeks">Weeks</option>
                </select>
              </div>
              <p className="text-[11px] text-[#8a7e75] italic">
                Example: you can set the limit to 7 days or 1 month, enabling customers to conveniently plan their pickups within this timeframe.
              </p>
            </div>

            {/* 3. Pickups Timings */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#141010] uppercase tracking-wider font-sans flex items-center gap-1.5">
                <span>Pickups timings</span>
                <EditIcon className="w-4 h-4 text-[#5e5e5e]" />
              </label>
              <p className="text-xs text-[#5e5e5e]">Set specific pickups timings.</p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => handleFetchOrgTimings("pickup")}
                  className="px-4 py-2 border border-[#e7e5e4] bg-white hover:bg-neutral-50 rounded text-xs font-medium text-[#141010] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <SyncIcon className="w-4 h-4 text-[#141010]" />
                  <span>Fetch Organization's operational timings</span>
                </button>
              </div>
            </div>

            {/* 4. Pickup Time Slot Size */}
            <div className="space-y-2 max-w-md">
              <label className="block text-xs font-semibold text-[#141010] uppercase tracking-wider font-sans">
                Pickup time slot size
              </label>
              <p className="text-xs text-[#5e5e5e]">e.g. 30 mins slots will show open slots at 8:00, 8:30, 9:00 etc.</p>
              <select
                value={schedPickupSlotSize}
                onChange={(e) => setSchedPickupSlotSize(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
              >
                <option value="15 mins">15 mins</option>
                <option value="30 mins">30 mins</option>
                <option value="45 mins">45 mins</option>
                <option value="60 mins">60 mins</option>
              </select>
            </div>

            {/* 5. Pickup Address Section */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-semibold text-[#141010] uppercase tracking-wider font-sans">
                Pickup address
              </label>
              <p className="text-xs text-[#5e5e5e]">Provide the exact address where customers can collect their orders.</p>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleUseOrgAddress}
                  className={`px-4 py-2 border text-xs font-medium rounded transition-colors cursor-pointer ${
                    pickupAddressMode === "org"
                      ? "border-[#0c0a09] bg-[#0c0a09] text-white shadow-sm"
                      : "border-[#e7e5e4] bg-white text-[#141010] hover:bg-neutral-50"
                  }`}
                >
                  Use organization address
                </button>
                <button
                  type="button"
                  onClick={() => setPickupAddressMode("custom")}
                  className={`px-4 py-2 border text-xs font-medium rounded transition-colors cursor-pointer ${
                    pickupAddressMode === "custom"
                      ? "border-[#0c0a09] bg-[#0c0a09] text-white shadow-sm"
                      : "border-[#e7e5e4] bg-white text-[#141010] hover:bg-neutral-50"
                  }`}
                >
                  Add custom address
                </button>
              </div>

              <div className="pt-3 max-w-xl space-y-3.5 bg-white p-5 border border-[#e7e5e4] rounded-md">
                <div>
                  <label className="block text-xs font-medium text-[#5e5e5e] mb-1 font-sans">
                    Address Line 1 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pickupAddrLine1}
                    onChange={(e) => setPickupAddrLine1(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5e5e5e] mb-1 font-sans">
                    Address Line 2 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pickupAddrLine2}
                    onChange={(e) => setPickupAddrLine2(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5e5e5e] mb-1 font-sans">City</label>
                    <input
                      type="text"
                      value={pickupCity}
                      onChange={(e) => setPickupCity(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5e5e5e] mb-1 font-sans">Zip code</label>
                    <input
                      type="text"
                      value={pickupZipcode}
                      onChange={(e) => setPickupZipcode(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#5e5e5e] mb-1 font-sans">State</label>
                    <input
                      type="text"
                      value={pickupState}
                      onChange={(e) => setPickupState(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5e5e5e] mb-1 font-sans">Country</label>
                    <input
                      type="text"
                      value={pickupCountry}
                      onChange={(e) => setPickupCountry(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#e7e5e4] rounded text-[#141010] focus:outline-none focus:border-[#0c0a09]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveSchedPickup}
                className="px-5 py-2 bg-[#0c0a09] text-white rounded text-xs font-medium hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 3. CASHIER SECTION
// ==========================================

interface CashierSectionProps {
  getFeatureFlag: (key: string) => boolean;
  handleFeatureToggle: (key: string, currentActive: boolean) => void;
}

const CASHIER_FEATURES_CONFIG = [
  {
    key: "show_table_tab_in_cashier",
    title: "Show table tab in Cashier",
    description: "Enable this feature to display restaurant tables on the cashier screen. Turn it off to hide table views from the cashier interface.",
  },
  {
    key: "show_member_number_on_cashier_card",
    title: "Member count input",
    description: "Turn this on to record and track the number of guests for each table through the cashier screen.",
  },
  {
    key: "show_table_on_cashier_card",
    title: "Include tables on cashier card",
    description: "Add table details to the cashier card for improved management and convenience.",
  },
  {
    key: "show_waiter_on_cashier_card",
    title: "Waiter details on cashier card",
    description: "Add waiter information to the cashier card for better order tracking.",
  },
  {
    key: "skip_payment_on_cashier_card",
    title: "Cashier skip payment",
    description: "Enable a feature to skip payments in cashier card for quicker order handling and post-paid settlement.",
  },
  {
    key: "skip_phone_number_required",
    title: "Phone number not required",
    description: "Allow cashiers to proceed without entering a customer's phone number.",
  },
];

function CashierSection({ getFeatureFlag, handleFeatureToggle }: CashierSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFeatures = CASHIER_FEATURES_CONFIG.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(q) ||
      item.key.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#e7e5e4] rounded-lg shadow-sm overflow-hidden">
        {/* Card Header & Search Bar */}
        <div className="sticky top-0 z-10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e7e5e4] bg-[#fdf8f7]/95 backdrop-blur-sm">
          <div className="max-w-xl">
            <h3 className="font-display-md text-xl font-medium text-[#141010] leading-snug" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
              POS Terminal Customization
            </h3>
            <p className="text-xs text-[#5e5e5e] mt-0.5">
              Control operational fields, required inputs, and visual ticket cards visible at the cashier terminal.
            </p>
          </div>
          {/* Search Bar Input */}
          <div className="relative min-w-[240px] sm:w-72">
            <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5e5e5e]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cashier features..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-[#e7e5e4] rounded-md text-xs text-[#141010] placeholder:text-[#5e5e5e] focus:outline-none focus:border-[#0c0a09] transition-colors"
            />
          </div>
        </div>

        {/* Feature Rows */}
        <div className="divide-y divide-[#e7e5e4]/60">
          {filteredFeatures.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#5e5e5e]">
              No cashier features matching "{searchQuery}"
            </div>
          ) : (
            filteredFeatures.map((item) => {
              const active = getFeatureFlag(item.key);
              return (
                <div
                  key={item.key}
                  className="p-5 hover:bg-neutral-50/50 transition-colors flex items-start justify-between gap-6"
                >
                  <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="text-sm font-semibold text-[#141010] font-sans">{item.title}</span>
                      <span className="px-2 py-0.5 bg-[#f1edec] text-[#5e5e5e] rounded text-[10px] tracking-wider font-mono">
                        {item.key}
                      </span>
                    </div>
                    <p className="text-xs text-[#5e5e5e] leading-relaxed max-w-2xl">{item.description}</p>
                  </div>
                  <Switch checked={active} onChange={() => handleFeatureToggle(item.key, active)} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
