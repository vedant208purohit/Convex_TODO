"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MarketplaceApp } from "./types";

interface MarketplacePurchaseModalProps {
  isOpen: boolean;
  app: MarketplaceApp | null;
  walletBalance: number;
  isAlreadyPurchased: boolean;
  onClose: () => void;
  onConfirmPurchase: (app: MarketplaceApp) => void;
  onSimulateRecharge: (amount: number) => void;
}

export function MarketplacePurchaseModal({
  isOpen,
  app,
  walletBalance,
  isAlreadyPurchased,
  onClose,
  onConfirmPurchase,
  onSimulateRecharge,
}: MarketplacePurchaseModalProps) {
  // Toggle between 'sufficient' and 'insufficient' view states inside the modal
  const [modalState, setModalState] = useState<"sufficient" | "insufficient">(
    walletBalance >= 5000 ? "sufficient" : "insufficient"
  );
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModalState(walletBalance >= 5000 ? "sufficient" : "insufficient");
    }
  }, [walletBalance, isOpen]);

  if (!isOpen || !app) return null;

  const appPrice = app.priceAmount > 0 ? app.priceAmount : 5000;
  const isActualSufficient = walletBalance >= appPrice;
  const currentSimulatedBalance =
  modalState === "sufficient"
    ? (isActualSufficient ? walletBalance : Math.max(walletBalance, appPrice + 3000))
    : (walletBalance < appPrice ? walletBalance : 2000);
  const balanceAfterActivation = currentSimulatedBalance - appPrice;
  const shortfallAmount = Math.max(appPrice - walletBalance, 1000);

  const handleConfirm = () => {
    setIsActivating(true);
    setTimeout(() => {
      onConfirmPurchase(app);
      setIsActivating(false);
      onClose();
    }, 950);
  };

  const handleRecharge = () => {
    onSimulateRecharge(shortfallAmount);
    setModalState("sufficient");
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 xs:p-4 sm:p-6 transition-opacity duration-300 font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-[#e7e5e4] overflow-hidden relative transition-all duration-200 transform scale-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Segmented State Switcher & Header */}
        <div className="pt-4 sm:pt-6 px-4 sm:px-6 pb-2.5 sm:pb-3 flex items-start justify-between shrink-0 gap-3">
          <div className="flex-1 min-w-0">
            {/* Preview State Switcher - Responsive Grid on Mobile */}
            <div className="grid grid-cols-2 w-full sm:w-auto sm:inline-flex items-center bg-[#fdf8f7] p-1 rounded-xl border border-[#e7e5e4] mb-3 sm:mb-3.5 gap-1">
              <button
                type="button"
                onClick={() => setModalState("sufficient")}
                className={`py-1.5 px-2 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-lg transition-all cursor-pointer text-center truncate ${modalState === "sufficient"
                    ? "bg-white text-[#0c0a09] shadow-xs border border-[#e7e5e4]"
                    : "text-[#5e5e5e] hover:text-[#0c0a09]"
                  }`}
              >
                Sufficient Balance
              </button>

              <button
                type="button"
                onClick={() => setModalState("insufficient")}
                className={`py-1.5 px-2 sm:px-3 text-[11px] sm:text-xs font-medium rounded-lg transition-all cursor-pointer text-center truncate ${modalState === "insufficient"
                    ? "bg-white text-[#0c0a09] shadow-xs border border-[#e7e5e4]"
                    : "text-[#5e5e5e] hover:text-[#0c0a09]"
                  }`}
              >
                Insufficient Balance
              </button>
            </div>

            {/* Stable Height Title Wrapper to Prevent Layout Shift */}
            <div className="min-h-[2rem] sm:min-h-[2.5rem] flex flex-col justify-center">
              <h2 className="font-garamond text-xl sm:text-2xl text-[#0c0a09] font-bold tracking-tight leading-snug break-words">
                {modalState === "sufficient"
                  ? `Activate ${app.title}`
                  : "Wallet Balance Low"}
              </h2>
            </div>

            <p className="font-sans text-xs sm:text-sm text-[#5e5e5e] mt-1 leading-relaxed">
              Activate this feature using your Marketplace Wallet.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#5e5e5e] hover:text-[#0c0a09] hover:bg-[#f1edec] transition-colors cursor-pointer shrink-0 mt-0.5"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body - Fixed Slot Ordering to Eliminate Jumping */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 sm:gap-3.5">
          {isAlreadyPurchased ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs sm:text-sm text-emerald-900 flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0">
                check_circle
              </span>
              <div>
                <span className="font-semibold block">Already Activated</span>
                <span>
                  {app.title} is already active on your store register. You can configure it from the app settings.
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* SLOT 1: Financial Summary Card (Exact Identical 3-Row Height in Both States) */}
              <div className="bg-[#fdf8f7] rounded-2xl p-4 sm:p-5 border border-[#e7e5e4] flex flex-col gap-2.5 sm:gap-3">
                <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                  <span className="text-[#5e5e5e] font-medium min-w-0">Feature Price</span>
                  <span className="font-semibold text-[#0c0a09] font-mono shrink-0 text-right">
                    ₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                  <span className="text-[#5e5e5e] font-medium min-w-0">Wallet Balance</span>
                  <span
                    className={`font-semibold font-mono shrink-0 text-right ${modalState === "sufficient" ? "text-emerald-600" : "text-[#0c0a09]"
                      }`}
                  >
                    ₹{currentSimulatedBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="h-px bg-[#e7e5e4] my-0.5" />

                <div className="flex items-center justify-between text-xs sm:text-sm gap-2 min-h-[28px]">
                  <span className="font-semibold text-[#0c0a09] min-w-0">
                    {modalState === "sufficient" ? "Balance After Activation" : "Shortfall"}
                  </span>
                  {modalState === "sufficient" ? (
                    <span className="font-bold text-[#0c0a09] font-mono shrink-0 text-right text-sm sm:text-base">
                      ₹{balanceAfterActivation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200 text-xs sm:text-sm font-mono shrink-0 text-right">
                      ₹{shortfallAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>

              {/* SLOT 2: Notice / Alert Banner (Exact Identical Height in Both States) */}
              {modalState === "sufficient" ? (
                <div className="bg-blue-50/80 border border-blue-200/70 rounded-xl p-3 sm:p-3.5 text-xs text-blue-900 flex items-center gap-2.5 leading-relaxed min-h-[58px]">
                  <span className="material-symbols-outlined text-blue-600 text-[18px] shrink-0">
                    info
                  </span>
                  <span className="text-[11px] sm:text-xs">
                    ₹{appPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })} will be deducted from your Marketplace Wallet after you confirm.
                  </span>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 sm:p-3.5 text-xs flex items-center gap-2.5 leading-relaxed min-h-[58px]">
                  <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0">
                    warning
                  </span>
                  <div className="text-[11px] sm:text-xs min-w-0">
                    <span className="font-semibold block leading-tight">Insufficient Wallet Balance</span>
                    <span className="text-[10.5px] sm:text-[11px] text-amber-800">
                      Please add money to your wallet before activating this feature.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Actions Footer - Fully Responsive for Mobile, iPhone, Fold, iPad, Mac, Windows */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#faf8f5] border-t border-[#e7e5e4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <Link
            href={`/marketplace/checkout?appId=${app.slug || app.id}`}
            onClick={onClose}
            className="text-[11px] sm:text-xs text-[#5e5e5e] hover:text-[#0c0a09] underline flex items-center justify-center sm:justify-start gap-1 order-2 sm:order-1 text-center transition-colors font-medium"
          >
            <span>Open Full Order Verification & Audit</span>
            <span className="material-symbols-outlined text-[13px] sm:text-[14px]">open_in_new</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto order-1 sm:order-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial py-2.5 px-3.5 sm:px-4 rounded-xl border border-[#e7e5e4] text-[#0c0a09] hover:bg-[#f1edec] font-semibold text-xs sm:text-sm transition-colors cursor-pointer text-center shrink-0"
            >
              Cancel
            </button>

            {isAlreadyPurchased ? (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial py-2.5 px-4 sm:px-5 rounded-xl bg-[#0c0a09] text-white font-semibold text-xs sm:text-sm hover:bg-[#262626] transition-all cursor-pointer text-center"
              >
                Close
              </button>
            ) : modalState === "sufficient" ? (
              <button
                type="button"
                disabled={isActivating}
                onClick={handleConfirm}
                className="flex-2 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-[#0c0a09] text-white font-semibold text-xs sm:text-sm hover:bg-[#262626] transition-all shadow-xs cursor-pointer disabled:opacity-75 text-center shrink-0"
              >
                {isActivating ? (
                  <>
                    <span className="material-symbols-outlined text-[15px] animate-spin">
                      progress_activity
                    </span>
                    <span className="truncate">Activating...</span>
                  </>
                ) : (
                  <>
                    <span className="truncate">Confirm & Activate</span>
                    <span className="material-symbols-outlined text-[15px] shrink-0">arrow_forward</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRecharge}
                className="flex-2 sm:flex-initial flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-[#0c0a09] text-white font-semibold text-xs sm:text-sm hover:bg-[#262626] transition-all shadow-xs cursor-pointer text-center shrink-0"
              >
                <span className="material-symbols-outlined text-[15px] sm:text-[16px] shrink-0">add_card</span>
                <span className="truncate">
                  Add ₹{shortfallAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} to Wallet
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
