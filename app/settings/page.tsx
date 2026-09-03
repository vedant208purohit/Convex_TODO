"use client";

import { useState, ReactNode } from "react";
import { PosShell } from "../components/PosShell";
import { OrganizationSettings } from "../components/OrganizationSettings";
import { OrganizationPrinters } from "../components/OrganizationPrinters";
import { OrderProcessesView } from "../components/order-processes/OrderProcessesView";

function OrganizationIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function PrinterIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}

function FeaturesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" />
    </svg>
  );
}

function StaffIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function WaiterIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function OrderProcessesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function TablesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function QrCodesIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
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
  | "tables"
  | "qrCodes"
  | "liveScreens";

interface SettingsNavOption {
  id: SettingsTab;
  label: string;
  icon: ReactNode;
}

const SETTINGS_TABS: SettingsNavOption[] = [
  { id: "organization", label: "Organization", icon: <OrganizationIcon className="w-4 h-4" /> },
  { id: "printers", label: "Printers", icon: <PrinterIcon className="w-4 h-4" /> },
  { id: "features", label: "Features", icon: <FeaturesIcon className="w-4 h-4" /> },
  { id: "staff", label: "Employees", icon: <StaffIcon className="w-4 h-4" /> },
  { id: "waiters", label: "Waiters", icon: <WaiterIcon className="w-4 h-4" /> },
  { id: "orderProcesses", label: "Order Processes", icon: <OrderProcessesIcon className="w-4 h-4" /> },
  { id: "tables", label: "Tables & Layouts", icon: <TablesIcon className="w-4 h-4" /> },
  { id: "qrCodes", label: "QR Codes", icon: <QrCodesIcon className="w-4 h-4" /> },
  { id: "liveScreens", label: "Live Screens", icon: <LiveScreensIcon className="w-4 h-4" /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("organization");

  return (
    <PosShell title="Settings" subtitle="Management Portal">
      <div className="flex flex-col flex-1 min-w-0">
        {/* Workspace Context Header */}
        <div className="bg-[#fdf8f7] px-6 lg:px-8 py-6 border-b border-[#e7e5e4] shrink-0">
          <div className="flex items-end justify-between w-full">
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#5e5e5e] mb-1">
                Workspace
              </p>
              <h1 className="font-garamond text-[32px] text-[#141010] font-normal leading-tight">
                Settings
              </h1>
            </div>
          </div>
        </div>

        {/* Settings Two-Panel Layout */}
        <div className="flex-1 flex flex-col lg:flex-row w-full p-6 lg:p-8 gap-6 min-h-[calc(100vh-190px)]">
          {/* Left Panel: Settings Navigation */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] overflow-hidden min-h-[500px]">
            <div className="p-4 border-b border-[#e7e5e4] bg-[#fdf8f7] shrink-0">
              <h2 className="font-sans text-[16px] font-semibold text-[#141010]">
                Settings Menu
              </h2>
            </div>

            <nav className="flex-1 py-2 divide-y divide-[#e7e5e4]/50 overflow-y-auto">
              {SETTINGS_TABS.map((tab) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-left text-[14px] font-medium transition-colors cursor-pointer select-none ${
                      isSelected
                        ? "bg-[#fafafa] text-[#141010] font-bold border-l-4 border-l-[#0c0a09]"
                        : "text-[#5e5e5e] hover:bg-white hover:text-[#141010] border-l-4 border-l-transparent"
                    }`}
                  >
                    <span className="w-5 flex items-center justify-center text-[#5e5e5e]">
                      {tab.icon}
                    </span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Panel: Settings Content Area */}
          <div className="flex-1 min-w-0 bg-[#fdf8f7] rounded-xl border border-[#e7e5e4] p-6 lg:p-8 overflow-y-auto">
            {activeTab === "organization" && <OrganizationSettings />}
            {activeTab === "printers" && <OrganizationPrinters />}
            {activeTab === "orderProcesses" && <OrderProcessesView />}
            {activeTab !== "organization" && activeTab !== "printers" && activeTab !== "orderProcesses" && (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center text-[#141010] bg-[#f1edec] rounded-full border border-[#e7e5e4]">
                  {SETTINGS_TABS.find((t) => t.id === activeTab)?.icon}
                </div>
                <h3 className="font-garamond text-2xl text-[#141010]">
                  {SETTINGS_TABS.find((t) => t.id === activeTab)?.label}
                </h3>
                <p className="text-sm text-[#5e5e5e] mt-1">
                  Manage configuration and preferences for {SETTINGS_TABS.find((t) => t.id === activeTab)?.label.toLowerCase()}.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PosShell>
  );
}
