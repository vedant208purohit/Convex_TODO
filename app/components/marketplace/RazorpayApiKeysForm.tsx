"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { RazorpayIcon } from "./MarketplaceCard";
import { Toast, type ToastMessage } from "../Toast";

interface RazorpayApiKeysFormProps {
  embeddedInMarketplace?: boolean;
  onBack?: () => void;
  onVerify?: (credentials: { keyId: string; keySecret: string }) => Promise<void> | void;
}

const QUICK_GUIDE_STEPS = [
  {
    step: 1,
    title: "Login to Razorpay",
    description: "Access your dashboard at razorpay.com with your merchant credentials.",
  },
  {
    step: 2,
    title: "Open Settings",
    description: "Navigate to the 'Settings' section from the left sidebar navigation.",
  },
  {
    step: 3,
    title: "Generate API Keys",
    description: "Click on the 'API Keys' tab and select 'Generate Key' (Live Mode).",
  },
  {
    step: 4,
    title: "Copy Keys",
    description: "Ensure you copy both the Key ID and the Secret. The secret is only shown once.",
  },
  {
    step: 5,
    title: "Paste Here",
    description: "Paste the credentials into the form and click verify.",
  },
];

export function RazorpayApiKeysForm({
  embeddedInMarketplace = false,
  onBack,
  onVerify,
}: RazorpayApiKeysFormProps) {
  const router = useRouter();

  // Form State
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Validation State
  const [keyIdError, setKeyIdError] = useState<string | null>(null);
  const [keySecretError, setKeySecretError] = useState<string | null>(null);

  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/marketplace?flow=razorpay-connect");
    }
  };

  const handleSupportChat = () => {
    showToast("Connecting to PREST merchant support...", "info");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Required field validation
    const cleanKeyId = keyId.trim().replace(/^['"]|['"]$/g, "");
    const cleanKeySecret = keySecret.trim().replace(/^['"]|['"]$/g, "");

    let hasError = false;
    if (!cleanKeyId) {
      setKeyIdError("Key ID is required");
      hasError = true;
    } else {
      setKeyIdError(null);
    }

    if (!cleanKeySecret) {
      setKeySecretError("Key Secret is required");
      hasError = true;
    } else {
      setKeySecretError(null);
    }

    if (hasError) return;

    setIsSubmitting(true);

    try {
      if (onVerify) {
        await onVerify({ keyId: cleanKeyId, keySecret: cleanKeySecret });
      } else {
        const res = await fetch("/api/payments/razorpay/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key_id: cleanKeyId,
            key_secret: cleanKeySecret,
            ...(webhookSecret.trim() ? { webhook_secret: webhookSecret.trim() } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to verify and connect Razorpay API keys.");
        }

        showToast("Razorpay Connected Successfully! Initial synchronization in progress.", "success");

        const queryParams = new URLSearchParams({
          method: "api_keys",
          mode: data.accountMode || "live",
          name: data.merchantName || "",
          mid: data.merchantId || cleanKeyId,
        });

        router.push(`/marketplace/razorpay/success?${queryParams.toString()}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification request failed";
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 md:p-8 lg:p-10 max-w-[1280px] mx-auto">
      {/* 1. Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs sm:text-sm text-[#78716c] mb-6 flex-wrap"
      >
        <button
          type="button"
          onClick={() => router.push("/marketplace")}
          className="hover:text-[#0c0a09] transition-colors cursor-pointer"
        >
          Marketplace
        </button>
        <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
        <button
          type="button"
          onClick={() => router.push("/marketplace")}
          className="hover:text-[#0c0a09] transition-colors cursor-pointer"
        >
          Payment Providers
        </button>
        <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
        <button
          type="button"
          onClick={handleBack}
          className="hover:text-[#0c0a09] transition-colors cursor-pointer"
        >
          Razorpay Setup
        </button>
        <span className="material-symbols-outlined text-[16px] text-[#a8a29e]">chevron_right</span>
        <span className="text-[#0c0a09] font-bold">API Keys</span>
      </nav>

      {/* 2. Main Two-Column Layout (Desktop: 7 / 5; Mobile: stacked) */}
      <div className="grid grid-cols-12 gap-6 lg:gap-10 items-start">
        {/* LEFT COLUMN: Heading, Info Card, Form, Security Row */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          {/* Page Heading & Subtitle */}
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#0c0a09] tracking-tight">
              Connect Using API Keys
            </h1>
            <p className="text-sm sm:text-base text-[#78716c]">
              Securely link your Razorpay environment to enable Defx automation.
            </p>
          </div>

          {/* Seamless Integration Information Card */}
          <div
            data-testid="seamless-integration-card"
            className="p-4 sm:p-5 bg-[#fafaf9] rounded-xl flex items-start gap-3.5 border border-[#e7e5e4] shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0c0a09] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">info</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-[#0c0a09]">Seamless Integration</h4>
              <p className="text-xs sm:text-sm text-[#78716c] leading-relaxed">
                Already using Razorpay? Paste your API credentials and Defx will verify the
                connection automatically using high-grade encryption.
              </p>
            </div>
          </div>

          {/* API Credentials Form Card */}
          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 sm:p-8 rounded-2xl border border-[#e7e5e4] space-y-6 shadow-xs"
          >
            <div className="space-y-5">
              {/* Field 1: Key ID */}
              <div className="space-y-1.5">
                <label
                  htmlFor="key-id"
                  className="text-xs font-semibold text-[#0c0a09] uppercase tracking-wider block"
                >
                  Key ID
                </label>
                <input
                  id="key-id"
                  name="keyId"
                  type="text"
                  value={keyId}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  onChange={(e) => {
                    setKeyId(e.target.value);
                    if (keyIdError) setKeyIdError(null);
                  }}
                  placeholder="rzp_live_xxxxxxxxxxxxxx"
                  className={`w-full px-4 py-3 bg-[#fafaf9] rounded-xl border text-sm font-mono text-[#0c0a09] placeholder:text-[#a8a29e] transition-all focus:bg-white focus:outline-hidden focus:border-[#0c0a09] focus:ring-2 focus:ring-[#0c0a09]/10 ${
                    keyIdError ? "border-rose-500" : "border-[#e7e5e4]"
                  }`}
                />
                <div className="flex items-center justify-between text-[10px] text-[#78716c] uppercase tracking-wider">
                  <span>Example: rzp_live_k82Hs91mNb0</span>
                </div>
                {keyIdError && (
                  <p className="text-xs text-rose-600 font-medium">{keyIdError}</p>
                )}
              </div>

              {/* Field 2: Key Secret */}
              <div className="space-y-1.5">
                <label
                  htmlFor="key-secret"
                  className="text-xs font-semibold text-[#0c0a09] uppercase tracking-wider block"
                >
                  Key Secret
                </label>
                <div className="relative">
                  <input
                    id="key-secret"
                    name="keySecret"
                    type={showSecret ? "text" : "password"}
                    value={keySecret}
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck="false"
                    onChange={(e) => {
                      setKeySecret(e.target.value);
                      if (keySecretError) setKeySecretError(null);
                    }}
                    placeholder="••••••••••••••••"
                    className={`w-full px-4 py-3 pr-11 bg-[#fafaf9] rounded-xl border text-sm font-mono text-[#0c0a09] placeholder:text-[#a8a29e] transition-all focus:bg-white focus:outline-hidden focus:border-[#0c0a09] focus:ring-2 focus:ring-[#0c0a09]/10 ${
                      keySecretError ? "border-rose-500" : "border-[#e7e5e4]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#78716c] hover:text-[#0c0a09] p-1 cursor-pointer transition-colors text-[20px]"
                    aria-label={showSecret ? "Hide secret" : "Show secret"}
                  >
                    {showSecret ? "visibility_off" : "visibility"}
                  </button>
                </div>
                {keySecretError && (
                  <p className="text-xs text-rose-600 font-medium">{keySecretError}</p>
                )}
              </div>

              {/* Field 3: Webhook Secret (Optional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="webhook-secret"
                    className="text-xs font-semibold text-[#0c0a09] uppercase tracking-wider block"
                  >
                    Webhook Secret (Optional)
                  </label>
                  <span className="text-[10px] text-[#78716c]">Auto-generated if left blank</span>
                </div>
                <input
                  id="webhook-secret"
                  name="webhookSecret"
                  type="text"
                  value={webhookSecret}
                  autoComplete="off"
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="whsec_xxxxxxxxxxxxxxxx (leave blank to auto-generate)"
                  className="w-full px-4 py-3 bg-[#fafaf9] rounded-xl border border-[#e7e5e4] text-sm font-mono text-[#0c0a09] placeholder:text-[#a8a29e] transition-all focus:bg-white focus:outline-hidden focus:border-[#0c0a09] focus:ring-2 focus:ring-[#0c0a09]/10"
                />
              </div>
            </div>

            {/* Actions: Primary Verify & Secondary Back */}
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="btn-verify-connect"
                className="px-6 py-3 bg-[#0c0a09] hover:bg-[#27272a] active:scale-[0.98] disabled:opacity-70 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 min-w-[160px]"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">
                      progress_activity
                    </span>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify & Connect</span>
                )}
              </button>
              <button
                type="button"
                onClick={handleBack}
                data-testid="btn-back"
                className="px-5 py-3 bg-transparent hover:bg-[#f5f5f4] text-[#78716c] hover:text-[#0c0a09] font-semibold text-sm rounded-xl transition-all cursor-pointer"
              >
                Back
              </button>
            </div>
          </form>

          {/* Security Row with AES-256 and Razorpay logo */}
          <div className="pt-4 flex items-center justify-between text-[#78716c] border-t border-[#e7e5e4]/60">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-[#0c0a09] text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                security
              </span>
              <span className="text-xs sm:text-sm font-medium text-[#78716c]">
                Bank-grade AES-256 Encryption
              </span>
            </div>
            <div className="flex items-center gap-1.5 opacity-60 grayscale hover:grayscale-0 transition-all">
              <RazorpayIcon className="w-5 h-5 text-[#0c0a09]" />
              <span className="text-xs font-semibold text-[#0c0a09] tracking-tight">Razorpay</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Quick Guide & Support Assistance Card */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* Quick Guide Card */}
          <div
            data-testid="quick-guide-card"
            className="p-6 sm:p-7 bg-[#fafaf9] rounded-2xl border border-[#e7e5e4] space-y-6 shadow-2xs"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#0c0a09] text-[22px]">
                auto_stories
              </span>
              <h3 className="text-base sm:text-lg font-bold text-[#0c0a09]">Quick Guide</h3>
            </div>

            {/* 5-Step Vertical Timeline */}
            <div className="space-y-4">
              {QUICK_GUIDE_STEPS.map((item, index) => {
                const isLast = index === QUICK_GUIDE_STEPS.length - 1;
                return (
                  <div key={item.step} className="flex gap-3.5 group">
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full bg-[#0c0a09] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                        {item.step}
                      </div>
                      {!isLast && <div className="w-px h-full bg-[#e7e5e4] my-1" />}
                    </div>
                    <div className={`${!isLast ? "pb-4" : ""}`}>
                      <h5 className="text-xs sm:text-sm font-bold text-[#0c0a09] mb-1">
                        {item.title}
                      </h5>
                      <p className="text-xs text-[#78716c] leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Support Assistance Card */}
          <div
            data-testid="support-assistance-card"
            className="p-4 sm:p-5 bg-white rounded-xl border border-dashed border-[#e7e5e4] flex items-center justify-between gap-4 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#78716c] text-[24px]">
                support_agent
              </span>
              <div>
                <p className="text-xs sm:text-sm font-bold text-[#0c0a09]">Need assistance?</p>
                <p className="text-[11px] text-[#78716c]">Our support team is online 24/7</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSupportChat}
              className="text-xs font-bold text-[#0c0a09] hover:underline cursor-pointer shrink-0"
            >
              Chat Now
            </button>
          </div>
        </div>
      </div>

      {/* 3. Footer Decoration */}
      <footer className="mt-12 pt-6 border-t border-[#e7e5e4] flex flex-col sm:flex-row items-center justify-between gap-3 text-[#78716c] text-[11px]">
        <p className="uppercase tracking-wider">
          © 2024 DEFX INFRASTRUCTURE • PRIVACY • TERMS
        </p>
        <div className="flex items-center gap-4 text-[#a8a29e]">
          <span className="material-symbols-outlined text-[16px]">shield</span>
          <span className="material-symbols-outlined text-[16px]">lock</span>
          <span className="material-symbols-outlined text-[16px]">verified_user</span>
        </div>
      </footer>

      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell title="Marketplace" subtitle="API Keys Setup">
      {content}
    </PosShell>
  );
}

