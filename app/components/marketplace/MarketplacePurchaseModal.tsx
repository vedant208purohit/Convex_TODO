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
  const currentSimulatedBalance = modalState === "sufficient" ? Math.max(walletBalance, 8000) : 2000;
  const balanceAfterActivation = currentSimulatedBalance - appPrice;
  const shortfallAmount = Math.max(appPrice - currentSimulatedBalance, 3000);

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
      className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden relative transition-all duration-300 transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Segmented State Switcher & Header */}
        <div className="pt-6 px-6 pb-2 flex items-start justify-between">
          <div className="flex-1 pr-4">
            {/* Preview State Switcher */}
            <div className="inline-flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200 mb-4">
              <button
                type="button"
                onClick={() => setModalState("sufficient")}
                className={`py-1 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  modalState === "sufficient"
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                Sufficient Balance
              </button>

              <button
                type="button"
                onClick={() => setModalState("insufficient")}
                className={`py-1 px-3 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  modalState === "insufficient"
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                Insufficient Balance
              </button>
            </div>

            <h2 className="font-garamond text-2xl text-stone-900 font-semibold tracking-tight leading-snug">
              {modalState === "sufficient"
                ? `Activate ${app.title}`
                : "Wallet Balance Low"}
            </h2>

            <p className="text-xs text-stone-500 mt-1">
              Activate this feature using your Marketplace Wallet.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4">
          {isAlreadyPurchased ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-center gap-3">
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
          ) : modalState === "sufficient" ? (
            /* STATE 1: SUFFICIENT BALANCE */
            <div className="flex flex-col gap-3">
              {/* Financial Summary Card */}
              <div className="bg-[#faf2ee] rounded-2xl p-4 border border-stone-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">Feature Price</span>
                  <span className="font-semibold text-stone-900">
                    ₹{appPrice.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">Wallet Balance</span>
                  <span className="font-semibold text-emerald-600 font-mono">
                    ₹{currentSimulatedBalance.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="h-px bg-stone-200/80 my-0.5" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-700">Balance After Activation</span>
                  <span className="font-semibold text-stone-900 font-mono">
                    ₹{balanceAfterActivation.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Subtle Information Panel */}
              <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 flex items-center gap-2.5 leading-relaxed">
                <span className="material-symbols-outlined text-blue-600 text-[18px] shrink-0">
                  info
                </span>
                <span>
                  ₹{appPrice.toLocaleString("en-IN")} will be deducted from your Marketplace Wallet after you confirm.
                </span>
              </div>
            </div>
          ) : (
            /* STATE 2: INSUFFICIENT BALANCE */
            <div className="flex flex-col gap-3">
              {/* Warning Panel */}
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs flex items-start gap-2.5 leading-relaxed">
                <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">
                  warning
                </span>
                <div>
                  <span className="font-semibold block">Insufficient Wallet Balance</span>
                  Please add money to your wallet before activating this feature.
                </div>
              </div>

              {/* Financial Summary Card (Low Balance State) */}
              <div className="bg-[#faf2ee] rounded-2xl p-4 border border-stone-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">Feature Price</span>
                  <span className="font-semibold text-stone-900">
                    ₹{appPrice.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">Wallet Balance</span>
                  <span className="font-semibold text-stone-700 font-mono">
                    ₹{currentSimulatedBalance.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="h-px bg-stone-200/80 my-0.5" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-700">Shortfall</span>
                  <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-[11px] font-mono">
                    ₹{shortfallAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-6 py-4 bg-stone-50/80 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link
            href={`/marketplace/checkout?appId=${app.id}`}
            onClick={onClose}
            className="text-[11px] text-stone-500 hover:text-stone-900 underline flex items-center gap-1 order-2 sm:order-1"
          >
            <span>Open Full Order Verification & Audit</span>
            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
          </Link>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end order-1 sm:order-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-medium text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

          {isAlreadyPurchased ? (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-stone-900 text-white font-semibold text-xs hover:bg-stone-800 transition-all cursor-pointer"
            >
              Close
            </button>
          ) : modalState === "sufficient" ? (
            <button
              type="button"
              disabled={isActivating}
              onClick={handleConfirm}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#141010] text-white font-semibold text-xs hover:bg-black transition-all shadow-sm cursor-pointer disabled:opacity-75"
            >
              {isActivating ? (
                <>
                  <span className="material-symbols-outlined text-[15px] animate-spin">
                    progress_activity
                  </span>
                  <span>Activating...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Activate</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRecharge}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#141010] text-white font-semibold text-xs hover:bg-black transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_card</span>
              <span>Add ₹{shortfallAmount.toLocaleString("en-IN")} to Wallet</span>
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
