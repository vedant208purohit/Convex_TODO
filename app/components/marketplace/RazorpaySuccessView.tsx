"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PosShell } from "../PosShell";

export type RazorpayConnectionMethod = "oauth" | "api_keys";
export type RazorpayAccountMode = "live" | "test";

export interface RazorpayCapabilityItem {
  id: "account_connected" | "payments_enabled" | "transaction_sync" | "settlement_tracking";
  title: string;
  enabled: boolean;
  statusLabel?: string;
}

export interface RazorpayConnectionResult {
  merchantName?: string;
  merchantId?: string;
  accountMode?: RazorpayAccountMode;
  connectedAt?: string;
  connectionMethod?: RazorpayConnectionMethod;
  capabilities?: RazorpayCapabilityItem[];
  status?: "success" | "pending" | "failed";
}

interface RazorpaySuccessViewProps {
  embeddedInMarketplace?: boolean;
  connectionResult?: RazorpayConnectionResult;
  isLoading?: boolean;
  onGoToDashboard?: () => void;
  onReturnToMarketplace?: () => void;
}

const DEFAULT_CAPABILITIES: RazorpayCapabilityItem[] = [
  { id: "account_connected", title: "Account Connected", enabled: true },
  { id: "payments_enabled", title: "Payments Enabled", enabled: true },
  { id: "transaction_sync", title: "Transaction Sync Enabled", enabled: false, statusLabel: "Pending Activation" },
  { id: "settlement_tracking", title: "Settlement Tracking Enabled", enabled: false, statusLabel: "Requires Verification" },
];

export function RazorpaySuccessView({
  embeddedInMarketplace = false,
  connectionResult,
  isLoading = false,
  onGoToDashboard,
  onReturnToMarketplace,
}: RazorpaySuccessViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse connection details from props or URL query if provided
  const methodParam = searchParams?.get("method") as RazorpayConnectionMethod | null;
  const modeParam = searchParams?.get("mode") as RazorpayAccountMode | null;
  const merchantNameParam = searchParams?.get("name");
  const merchantIdParam = searchParams?.get("mid");

  const effectiveResult: RazorpayConnectionResult = {
    merchantName: connectionResult?.merchantName || merchantNameParam || "PREST Restaurant",
    merchantId: connectionResult?.merchantId || merchantIdParam || "MID_LIVE_PRST",
    accountMode: connectionResult?.accountMode || modeParam || "live",
    connectedAt: connectionResult?.connectedAt || new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    connectionMethod: connectionResult?.connectionMethod || methodParam || "oauth",
    capabilities: connectionResult?.capabilities || DEFAULT_CAPABILITIES,
  };

  // Restrained monochrome confetti state
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; size: number; duration: number }>>([]);

  useEffect(() => {
    // Respect user's motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // Generate 24 small monochrome particles
    const newParticles = Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      left: Math.random() * 95,
      delay: Math.random() * 0.8,
      size: Math.random() * 4 + 3,
      duration: Math.random() * 2 + 2,
    }));
    setParticles(newParticles);

    // Clean up particles after animation completes
    const timer = setTimeout(() => {
      setParticles([]);
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  const handleDashboard = () => {
    if (onGoToDashboard) {
      onGoToDashboard();
    } else {
      router.push("/marketplace/razorpay/dashboard");
    }
  };

  const handleMarketplace = () => {
    if (onReturnToMarketplace) {
      onReturnToMarketplace();
    } else {
      router.push("/marketplace");
    }
  };

  const isOAuth = effectiveResult.connectionMethod === "oauth";

  const content = (
    <div className="relative w-full flex-1 flex flex-col items-center justify-start py-6 sm:py-10 px-4 min-h-full">
      {/* Restrained Monochrome Celebration Particles */}
      {particles.length > 0 && (
        <div
          data-testid="monochrome-confetti-container"
          className="absolute inset-0 pointer-events-none overflow-hidden z-20"
          aria-hidden="true"
        >
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full bg-[#0c0a09]/30 dark:bg-stone-400/40 animate-fall"
              style={{
                left: `${p.left}%`,
                top: "-10px",
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main Success Card (~560px desktop width, compact vertical hierarchy) */}
      <div className="relative z-10 max-w-[560px] w-full bg-white rounded-2xl shadow-sm border border-[#e7e5e4] overflow-hidden my-auto">
        {/* Top Hero Section (Subtle neutral background with clean animated checkmark) */}
        <div className="relative h-32 sm:h-36 bg-[#f5f5f4] border-b border-[#e7e5e4] flex items-center justify-center">
          <div
            data-testid="success-hero-checkmark"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white border border-[#e7e5e4] flex items-center justify-center shadow-md animate-scale-in"
          >
            <span
              className="material-symbols-outlined text-[#0c0a09] text-[36px] sm:text-[44px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-7 space-y-5">
          {/* Title & Subtitle */}
          <div className="text-center space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0c0a09] tracking-tight">
              Razorpay Connected Successfully
            </h1>
            <p className="text-xs sm:text-sm text-[#78716c] max-w-md mx-auto leading-relaxed">
              Your merchant account is now successfully integrated with PREST.
            </p>
          </div>

          {/* Data-Driven Merchant Details Grid */}
          <div
            data-testid="merchant-details-grid"
            className="grid grid-cols-2 gap-3.5 sm:gap-5 p-4 sm:p-5 bg-[#fafaf9] rounded-xl border border-[#e7e5e4]"
          >
            <div>
              <p className="text-[10px] sm:text-[11px] text-[#78716c] uppercase font-semibold tracking-wider mb-0.5">
                Merchant Name
              </p>
              <p className="text-xs sm:text-sm font-bold text-[#0c0a09] truncate">
                {isLoading ? "Loading..." : effectiveResult.merchantName || "—"}
              </p>
            </div>

            <div>
              <p className="text-[10px] sm:text-[11px] text-[#78716c] uppercase font-semibold tracking-wider mb-0.5">
                Merchant ID
              </p>
              <p className="text-xs sm:text-sm font-mono font-bold text-[#0c0a09] truncate">
                {isLoading ? "Loading..." : effectiveResult.merchantId || "—"}
              </p>
            </div>

            <div>
              <p className="text-[10px] sm:text-[11px] text-[#78716c] uppercase font-semibold tracking-wider mb-0.5">
                Account Type
              </p>
              <div className="flex items-center gap-1.5 pt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    effectiveResult.accountMode === "live" ? "bg-emerald-600" : "bg-amber-500"
                  }`}
                />
                <span className="text-xs sm:text-sm font-bold text-[#0c0a09] capitalize">
                  {isLoading ? "—" : effectiveResult.accountMode || "Live"}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[10px] sm:text-[11px] text-[#78716c] uppercase font-semibold tracking-wider mb-0.5">
                Connected Since
              </p>
              <p className="text-xs sm:text-sm font-bold text-[#0c0a09] truncate">
                {isLoading ? "—" : effectiveResult.connectedAt || "Today"}
              </p>
            </div>
          </div>

          {/* Next Steps Enabled Section (Data-Driven Capabilities Checklist) */}
          <div className="space-y-3">
            <h2 className="text-xs sm:text-sm font-bold text-[#0c0a09] uppercase tracking-wider">
              Next Steps Enabled
            </h2>
            <div className="space-y-2">
              {(effectiveResult.capabilities || DEFAULT_CAPABILITIES).map((cap) => (
                <div
                  key={cap.id}
                  data-testid={`capability-row-${cap.id}`}
                  className="flex items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 ${
                        cap.enabled
                          ? "bg-[#0c0a09] text-white"
                          : "bg-[#e7e5e4] text-[#78716c]"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[11px] sm:text-[13px] font-bold">
                        {cap.enabled ? "check" : "remove"}
                      </span>
                    </div>
                    <span
                      className={`font-medium ${
                        cap.enabled ? "text-[#0c0a09]" : "text-[#78716c]"
                      }`}
                    >
                      {cap.title}
                    </span>
                  </div>

                  {cap.statusLabel && (
                    <span className="text-[9px] sm:text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full border border-[#e7e5e4] text-[#78716c] bg-[#fafaf9]">
                      {cap.statusLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#e7e5e4] flex flex-col sm:flex-row gap-3">
            <Link
              href="/marketplace/razorpay/dashboard"
              onClick={onGoToDashboard}
              data-testid="btn-go-to-dashboard"
              className="flex-1 py-3 px-5 bg-[#0c0a09] hover:bg-[#27272a] active:scale-[0.98] text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer text-center"
            >
              Go To Dashboard
            </Link>
            <Link
              href="/marketplace"
              onClick={onReturnToMarketplace}
              data-testid="btn-return-to-marketplace"
              className="flex-1 py-3 px-5 bg-white hover:bg-[#fafaf9] border border-[#e7e5e4] hover:border-[#0c0a09] active:bg-[#f5f5f4] text-[#0c0a09] font-semibold text-xs sm:text-sm rounded-xl transition-all cursor-pointer text-center"
            >
              Return To Marketplace
            </Link>
          </div>
        </div>
      </div>

      {/* Trust Indicator */}
      <div className="mt-5 mb-8 flex items-center justify-center gap-2 text-xs text-[#78716c] opacity-80">
        <span
          className="material-symbols-outlined text-[18px] text-[#0c0a09]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          verified_user
        </span>
        <span data-testid="trust-indicator-text">
          {isOAuth
            ? "Secure Integration via Razorpay OAuth 2.0"
            : "Secure Integration via Razorpay API Keys"}
        </span>
      </div>
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell title="Marketplace" subtitle="Connection Success">
      {content}
    </PosShell>
  );
}

