"use client";

import { ReactNode, useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PosShell } from "../components/PosShell";
import { OrganizationSettings } from "../components/OrganizationSettings";
import { OrderProcessesView } from "../components/order-processes/OrderProcessesView";
import { OrganizationEmployees } from "../components/OrganizationEmployees";
import { OrganizationFeatures } from "../components/OrganizationFeatures";
import { OrganizationWaiters } from "../components/OrganizationWaiters";
import { OrganizationPaymentModes } from "../components/OrganizationPaymentModes";
import { OrganizationTablesSettings } from "../components/OrganizationTablesSettings";
import { OrganizationQueueSettings } from "../components/OrganizationQueueSettings";
import { OrganizationDigitalStore } from "../components/OrganizationDigitalStore";
import { OrganizationBranding } from "../components/OrganizationBranding";
import { OrganizationPrinters } from "../components/OrganizationPrinters";
import { OrganizationQrManagement } from "../components/OrganizationQrManagement";

// ==========================================
// PIXEL-PERFECT SETTINGS SVG ICONS
// ==========================================

function PrinterIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  );
}

function QueueIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PaymentIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function OrganizationIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  );
}

function FeaturesIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" />
    </svg>
  );
}

function StaffIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function WaiterIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function OrderProcessesIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function TablesIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function QrCodesIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <rect width="5" height="5" x="3" y="3" rx="1" />
      <rect width="5" height="5" x="16" y="3" rx="1" />
      <rect width="5" height="5" x="3" y="16" rx="1" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <path d="M21 21v.01" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <path d="M3 12h.01" />
      <path d="M12 3h.01" />
      <path d="M12 16v.01" />
      <path d="M16 12h1" />
      <path d="M21 12v.01" />
      <path d="M12 21v-1" />
    </svg>
  );
}

function LiveScreensIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

function DigitalStoreIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <rect width="18" height="12" x="3" y="4" rx="2" />
      <line x1="2" x2="22" y1="20" y2="20" />
      <line x1="12" x2="12" y1="16" y2="20" />
    </svg>
  );
}

function BrandingIcon({ className = "w-4 h-4" }: { className?: string }) {
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
      <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  );
}

type SettingsTab =
  | "organization"
  | "printers"
  | "features"
  | "staff"
  | "waiters"
  | "orderProcesses"
  | "payment"
  | "tables"
  | "liveScreens"
  | "queue"
  | "digitalStore"
  | "branding";

interface SettingsNavOption {
  id: SettingsTab;
  label: string;
  icon: ReactNode;
}

const SETTINGS_TABS: SettingsNavOption[] = [
  {
    id: "organization",
    label: "Organization",
    icon: <OrganizationIcon className="w-4 h-4" />,
  },
  {
    id: "queue",
    label: "Queue & Waitlist",
    icon: <QueueIcon className="w-4 h-4" />,
  },
  {
    id: "printers",
    label: "Printers",
    icon: <PrinterIcon className="w-4 h-4" />,
  },
  {
    id: "features",
    label: "Features",
    icon: <FeaturesIcon className="w-4 h-4" />,
  },
  { id: "staff", label: "Employees", icon: <StaffIcon className="w-4 h-4" /> },
  { id: "waiters", label: "Waiters", icon: <WaiterIcon className="w-4 h-4" /> },
  {
    id: "orderProcesses",
    label: "Order Status",
    icon: <OrderProcessesIcon className="w-4 h-4" />,
  },
  {
    id: "payment",
    label: "Payment",
    icon: <PaymentIcon className="w-4 h-4" />,
  },
  {
    id: "tables",
    label: "Tables & Layouts",
    icon: <TablesIcon className="w-4 h-4" />,
  },
  {
    id: "liveScreens",
    label: "Live Screens",
    icon: <LiveScreensIcon className="w-4 h-4" />,
  },
  {
    id: "digitalStore",
    label: "Digital Store",
    icon: <DigitalStoreIcon className="w-4 h-4" />,
  },
  {
    id: "branding",
    label: "Branding",
    icon: <BrandingIcon className="w-4 h-4" />,
  },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read active tab from URL param, default to "organization"
  const rawTab = searchParams.get("tab");
  const validTabIds = SETTINGS_TABS.map((t) => t.id as string);
  const activeTab: SettingsTab =
    rawTab && validTabIds.includes(rawTab) ? (rawTab as SettingsTab) : "organization";

  // Update URL when tab changes
  const setActiveTab = useCallback(
    (tab: SettingsTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`/settings?${params.toString()}`);
    },
    [router, searchParams],
  );

  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pos_settings_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleSettingsSidebar = () => {
    setIsSettingsCollapsed((prev: boolean) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("pos_settings_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  // If user navigates directly to ?tab=qrCodes, send them to the dedicated full-width /qr-codes page
  useEffect(() => {
    if (rawTab === "qrCodes") {
      router.replace("/qr-codes");
    }
  }, [rawTab, router]);

  return (
    <PosShell title="Settings" subtitle="Management Portal">
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Workspace Context Header */}
        <div className="bg-[#fdf8f7] px-6 lg:px-8 py-5 border-b border-[#e7e5e4] shrink-0">
          <div className="flex items-end justify-between w-full">
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] mb-1">
                Workspace
              </p>
              <h1 className="font-garamond text-[30px] text-[#141010] font-normal leading-tight">
                Settings
              </h1>
            </div>
          </div>
        </div>

        {/* Settings Two-Panel Layout */}
        <div className="flex-1 flex flex-col lg:flex-row w-full p-5 lg:p-7 gap-5 min-h-0 overflow-hidden">
          {/* Left Panel: Settings Navigation */}
          <div
            className={`shrink-0 flex flex-col bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] overflow-hidden h-full transition-all duration-300 ease-in-out ${
              isSettingsCollapsed ? "w-full lg:w-20" : "w-full lg:w-48 xl:w-56"
            }`}
          >
            <div className="p-3.5 border-b border-[#e7e5e4] bg-[#fdf8f7] shrink-0 flex items-center justify-between">
              {!isSettingsCollapsed && (
                <h2 className="font-sans text-[15px] font-semibold text-[#141010]">
                  Settings Menu
                </h2>
              )}
              <button
                type="button"
                onClick={toggleSettingsSidebar}
                className={`p-1.5 rounded-lg bg-[#f1edec] hover:bg-[#e7e5e4] text-[#141010] transition cursor-pointer ${
                  isSettingsCollapsed ? "mx-auto" : ""
                }`}
                title={isSettingsCollapsed ? "Expand Settings Menu" : "Collapse Settings Menu"}
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isSettingsCollapsed ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 py-1.5 divide-y divide-[#e7e5e4]/50 overflow-y-auto">
              {SETTINGS_TABS.map((tab) => {
                const isSelected = activeTab === tab.id;
                if (isSettingsCollapsed) {
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      title={tab.label}
                      className={`w-12 h-12 mx-auto my-1 flex items-center justify-center rounded-xl transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-[#0c0a09] text-white shadow-xs"
                          : "text-[#5e5e5e] hover:bg-white hover:text-[#141010]"
                      }`}
                    >
                      <span className="w-5 h-5 flex items-center justify-center shrink-0">
                        {tab.icon}
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] lg:text-[14px] font-medium transition-colors cursor-pointer select-none whitespace-nowrap ${
                      isSelected
                        ? "bg-[#fafafa] text-[#141010] font-bold border-l-4 border-l-[#0c0a09]"
                        : "text-[#5e5e5e] hover:bg-white hover:text-[#141010] border-l-4 border-l-transparent"
                    }`}
                  >
                    <span className="w-4 flex items-center justify-center text-[#5e5e5e] shrink-0">
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Panel: Settings Content Area */}
          <div className="flex-1 min-w-0 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] p-4 lg:p-6 flex flex-col h-full min-h-0 overflow-y-auto">
            {activeTab === "organization" && <OrganizationSettings />}
            {activeTab === "queue" && <OrganizationQueueSettings />}
            {/* {activeTab === "printers" && <OrganizationPrinters />} */}
            {activeTab === "features" && <OrganizationFeatures />}
            {activeTab === "staff" && <OrganizationEmployees />}
            {activeTab === "waiters" && <OrganizationWaiters />}
            {activeTab === "orderProcesses" && <OrderProcessesView />}
            {activeTab === "payment" && <OrganizationPaymentModes />}
            {activeTab === "tables" && <OrganizationTablesSettings />}
            {activeTab === "digitalStore" && <OrganizationDigitalStore />}
            {activeTab === "branding" && <OrganizationBranding />}
            {activeTab !== "organization" &&
              activeTab !== "queue" &&
              // activeTab !== "printers" &&
              activeTab !== "features" &&
              activeTab !== "orderProcesses" &&
              activeTab !== "staff" &&
              activeTab !== "waiters" &&
              activeTab !== "payment" &&
              activeTab !== "tables" &&
              activeTab !== "digitalStore" &&
              activeTab !== "branding" && (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center text-[#141010] bg-[#f1edec] rounded-full border border-[#e7e5e4]">
                    {SETTINGS_TABS.find((t) => t.id === activeTab)?.icon}
                  </div>
                  <h3 className="font-garamond text-2xl text-[#141010]">
                    {SETTINGS_TABS.find((t) => t.id === activeTab)?.label}
                  </h3>
                  <p className="text-sm text-[#5e5e5e] mt-1">
                    Manage configuration and preferences for{" "}
                    {SETTINGS_TABS.find(
                      (t) => t.id === activeTab,
                    )?.label.toLowerCase()}
                    .
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>
    </PosShell>
  );
}

// Wrap in Suspense so useSearchParams() doesn't break SSR in Next.js App Router
export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
