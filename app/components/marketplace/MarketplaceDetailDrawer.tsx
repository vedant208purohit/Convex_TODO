"use client";

import Link from "next/link";
import { MarketplaceApp } from "./types";

interface MarketplaceDetailDrawerProps {
  isOpen: boolean;
  app: MarketplaceApp | null;
  walletBalance: number;
  isPurchased?: boolean;
  onClose: () => void;
  onActionClick: (app: MarketplaceApp) => void;
}

export function MarketplaceDetailDrawer({
  isOpen,
  app,
  walletBalance,
  isPurchased = false,
  onClose,
  onActionClick,
}: MarketplaceDetailDrawerProps) {
  if (!isOpen || !app) return null;

  const appPrice = app.priceAmount > 0 ? app.priceAmount : 5000;
  const isWhatsApp = app.slug === "prest-whatsapp-automation";

  return (
    <>
      {/* Backdrop Scrim */}
      <div
        className="fixed inset-0 top-16 bg-black/40 backdrop-blur-xs transition-opacity duration-300 z-40 cursor-pointer"
        onClick={onClose}
      />

      {/* Slide-Over Drawer Container */}
      <div className="fixed top-16 right-0 bottom-0 w-full sm:w-[460px] md:w-[480px] max-w-[100vw] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out translate-x-0 overflow-hidden border-l border-[#e7e5e4]">
        {/* Drawer Fixed Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 bg-[#faf8f5] border-b border-[#e7e5e4] shrink-0">
          <div className="flex items-center gap-2 text-[#0c0a09]">
            <span className="material-symbols-outlined text-[18px]">app_registration</span>
            <span className="text-xs uppercase tracking-wider font-bold text-[#0c0a09]">
              App Details
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white hover:bg-[#f1edec] text-[#5e5e5e] transition-colors cursor-pointer border border-[#e7e5e4]"
            title="Close details"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-5 sm:gap-6">
          {/* App Header Profile Block */}
          <div className="flex flex-col gap-3.5 sm:gap-4">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Luxury Icon Container */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl sm:rounded-2xl bg-[#fdf8f7] p-1 shrink-0 flex items-center justify-center shadow-md border border-[#e7e5e4]">
                <div className="w-full h-full rounded-lg sm:rounded-xl bg-[#0c0a09] flex items-center justify-center overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#0c0a09] via-stone-850 to-stone-700" />
                  {isWhatsApp ? (
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.56 20.16 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.13 7.42C8.94 7.42 8.63 7.49 8.37 7.77C8.11 8.05 7.37 8.74 7.37 10.15C7.37 11.56 8.4 12.92 8.54 13.11C8.68 13.3 10.52 16.14 13.38 17.38C14.06 17.67 14.59 17.85 15.01 17.98C15.69 18.2 16.32 18.17 16.81 18.1C17.36 18.02 18.49 17.41 18.73 16.74C18.96 16.07 18.96 15.5 18.89 15.38C18.82 15.26 18.63 15.19 18.35 15.05C18.07 14.91 16.71 14.24 16.46 14.15C16.2 14.06 16.02 14.01 15.83 14.29C15.65 14.57 15.12 15.19 14.96 15.38C14.8 15.57 14.64 15.59 14.36 15.45C14.08 15.31 13.18 15.02 12.11 14.07C11.28 13.33 10.72 12.41 10.56 12.13C10.4 11.85 10.54 11.7 10.68 11.56C10.81 11.43 10.97 11.22 11.11 11.06C11.25 10.9 11.3 10.78 11.39 10.6C11.48 10.41 11.43 10.25 11.36 10.11C11.3 9.97 10.74 8.6 10.51 8.04C10.28 7.5 10.05 7.57 9.88 7.56L9.35 7.55C9.17 7.55 9.13 7.42 9.13 7.42Z" />
                    </svg>
                  ) : (
                    <span className="material-symbols-outlined text-[26px] sm:text-[30px] md:text-[36px] text-white relative z-10">
                      {app.iconName}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold tracking-wide flex items-center gap-1.5 ${isPurchased
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-[#fdf8f7] text-[#0c0a09] border border-[#e7e5e4]"
                      }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isPurchased ? "bg-emerald-500" : "bg-[#0c0a09]"
                        }`}
                    />
                    {isPurchased ? "Installed" : "Paid • Purchase Required"}
                  </span>
                </div>

                <h1 className="font-garamond text-xl sm:text-2xl font-bold text-[#0c0a09] tracking-tight leading-snug break-words">
                  {app.title}
                </h1>

                <p className="text-xs text-[#5e5e5e] flex items-center gap-1.5 mt-1">
                  <span className="material-symbols-outlined text-[15px] text-emerald-600">
                    verified
                  </span>
                  <span>PREST Official Partner • RetainDine Inc.</span>
                </p>
              </div>
            </div>

            {/* Metadata Bar */}
            <div className="flex items-center gap-2 sm:gap-3 text-[#5e5e5e] text-[11px] sm:text-xs py-1 border-y border-[#e7e5e4] flex-wrap">
              <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-[#fdf8f7] text-[#0c0a09] border border-[#e7e5e4] font-medium">
                {app.category}
              </span>
              <span>•</span>
              <span>{app.version || "v2.8.4 Enterprise"}</span>
              <span>•</span>
              <span className="flex items-center text-[#0c0a09] font-semibold gap-1">
                <span className="material-symbols-outlined text-[14px] text-amber-500">
                  star
                </span>
                {app.rating || "4.9/5"}
              </span>
            </div>

            {/* Overview Description */}
            <p className="text-sm text-[#5e5e5e] leading-relaxed">
              {app.description}
            </p>
          </div>

          {/* Section 1: Practical Features */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-garamond text-lg font-bold text-[#0c0a09]">
                Practical Features
              </h2>
              <span className="text-xs text-[#5e5e5e]">4 Production Workflows</span>
            </div>

            <div className="flex flex-col gap-2.5">
              {(app.practicalFeatures || []).map((feat, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#fdf8f7] flex items-start gap-3 transition-all hover:bg-[#f5edea] border border-[#e7e5e4]"
                >
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs text-[#0c0a09] border border-[#e7e5e4]">
                    <span className="material-symbols-outlined text-[18px]">
                      {feat.icon}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-[#0c0a09]">
                      {feat.title}
                    </span>
                    <p className="text-xs text-[#5e5e5e] mt-0.5 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Setup Prerequisites & Requirements */}
          <div className="flex flex-col gap-3">
            <h2 className="font-garamond text-lg font-bold text-[#0c0a09]">
              Setup Prerequisites & Requirements
            </h2>

            <div className="p-4 rounded-2xl bg-[#fdf8f7] flex flex-col gap-3 border border-[#e7e5e4] text-[#0c0a09]">
              {(app.prerequisites || []).map((prereq, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5">
                    {prereq.icon}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#0c0a09]">{prereq.title}</span>
                    <span className="text-[#5e5e5e] text-[11px] mt-0.5">{prereq.detail}</span>
                  </div>
                </div>
              ))}

              <div className="flex items-start gap-2.5 text-xs pt-1 border-t border-[#e7e5e4]">
                <span className="material-symbols-outlined text-[18px] text-[#5e5e5e] shrink-0 mt-0.5">
                  security
                </span>
                <div className="flex flex-col">
                  <span className="font-semibold text-[#0c0a09]">Permissions Requested</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(app.permissions || ["Order Read-Only", "Guest Phone", "Outbound Webhooks"]).map(
                      (perm, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-white text-[#0c0a09] text-[10px] font-medium border border-[#e7e5e4]"
                        >
                          {perm}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Pricing & Terms */}
          <div className="flex flex-col gap-3 mb-2">
            <h2 className="font-garamond text-lg font-bold text-[#0c0a09]">
              Pricing & Terms
            </h2>

            <div className="p-4 rounded-2xl bg-[#fdf8f7] flex flex-col gap-2.5 border border-[#e7e5e4] text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#5e5e5e]">License Type</span>
                <span className="font-semibold text-[#0c0a09]">
                  {app.terms?.licenseType || "One-time Lifetime Organization License"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e5e5e]">Demo Price Rate</span>
                <span className="font-bold text-[#0c0a09]">
                  ₹{appPrice.toLocaleString("en-IN")} INR
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e5e5e]">Platform Surcharge</span>
                <span className="font-semibold text-[#0c0a09]">
                  {app.terms?.platformSurcharge || "₹0.00 (Zero Wallet Convenience Fee)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e5e5e]">Taxes & Statutory Levies</span>
                <span className="font-semibold text-[#0c0a09]">
                  {app.terms?.taxes || "Included in Demo Rate"}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white text-[#5e5e5e] text-[11px] mt-1.5 flex items-center gap-2 border border-[#e7e5e4]">
                <span className="material-symbols-outlined text-[16px] text-[#5e5e5e] shrink-0">
                  info
                </span>
                <span>
                  Purchasing debits directly from your PREST Marketplace balance with instantaneous unlock.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="shrink-0 bg-[#faf8f5] px-4 sm:px-6 py-3.5 sm:py-4 border-t border-[#e7e5e4] shadow-lg flex flex-col gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#5e5e5e] uppercase tracking-wider font-semibold">
                Total Payable
              </span>
              <span className="font-mono text-lg sm:text-xl font-bold text-[#0c0a09] tracking-tight">
                ₹{appPrice.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white text-[#0c0a09] border border-[#e7e5e4] text-xs">
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">account_balance_wallet</span>
              <span className="text-[10px] sm:text-[11px]">
                Wallet: <strong className="font-mono">₹{walletBalance.toLocaleString("en-IN")}</strong>
              </span>
              <span
                className={`w-2 h-2 rounded-full ml-0.5 shrink-0 ${walletBalance >= appPrice ? "bg-emerald-500" : "bg-amber-500"
                  }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onActionClick(app);
              }}
              className="flex-1 py-2.5 px-3 sm:px-5 rounded-lg bg-[#0c0a09] text-white hover:bg-[#262626] font-semibold text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-all shadow-md cursor-pointer group"
            >
              <span className="truncate">{isPurchased ? "Open Setup" : `Purchase for ₹${appPrice.toLocaleString("en-IN")}`}</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform shrink-0">
                arrow_forward
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-3.5 sm:px-4 rounded-lg bg-white hover:bg-[#f1edec] text-[#0c0a09] font-medium text-xs transition-colors cursor-pointer border border-[#e7e5e4] shrink-0"
            >
              Cancel
            </button>
          </div>

          {!isPurchased && (
            <Link
              href={`/marketplace/checkout?appId=${app.slug || app.id}`}
              onClick={onClose}
              className="text-center text-[10.5px] sm:text-[11px] text-[#5e5e5e] hover:text-[#0c0a09] underline pt-0.5 truncate"
            >
              Open Full Order Verification & Audit Flow (Ref #WA-88219)
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
