"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PosShell } from "../PosShell";
import { Toast, type ToastMessage } from "../Toast";

interface StripeApiKeysFormProps {
  embeddedInMarketplace?: boolean;
  onBack?: () => void;
  onVerify?: (credentials: { publishableKey: string; secretKey: string }) => Promise<void> | void;
}

export function StripeApiKeysForm({
  embeddedInMarketplace = false,
  onBack,
  onVerify,
}: StripeApiKeysFormProps) {
  const router = useRouter();

  // Form State
  const [publishableKey, setPublishableKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Validation State
  const [publishableKeyError, setPublishableKeyError] = useState<string | null>(null);
  const [secretKeyError, setSecretKeyError] = useState<string | null>(null);

  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    subtext?: string
  ) => {
    setToast({ message, type, subtext });
  };

  const isTestMode =
    publishableKey.trim().startsWith("pk_test_") || secretKey.trim().startsWith("sk_test_");

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/marketplace/stripe/connect");
    }
  };

  const handleTestConnection = async () => {
    const cleanPk = publishableKey.trim().replace(/^['"]|['"]$/g, "");
    const cleanSk = secretKey.trim().replace(/^['"]|['"]$/g, "");

    let hasError = false;
    if (!cleanPk) {
      setPublishableKeyError("Publishable key is required");
      hasError = true;
    } else if (!cleanPk.startsWith("pk_live_") && !cleanPk.startsWith("pk_test_")) {
      setPublishableKeyError("Publishable key must begin with pk_live_ or pk_test_");
      hasError = true;
    } else {
      setPublishableKeyError(null);
    }

    if (!cleanSk) {
      setSecretKeyError("Secret key is required");
      hasError = true;
    } else if (
      !cleanSk.startsWith("sk_live_") &&
      !cleanSk.startsWith("sk_test_") &&
      !cleanSk.startsWith("rk_live_") &&
      !cleanSk.startsWith("rk_test_")
    ) {
      setSecretKeyError("Secret key must begin with sk_live_, sk_test_, rk_live_, or rk_test_");
      hasError = true;
    } else {
      setSecretKeyError(null);
    }

    if (hasError) return;

    setIsTesting(true);
    try {
      const mode = isTestMode ? "Test Sandbox" : "Live Production";
      showToast("Testing connection...", "info", `Validating format against ${mode}`);
      await new Promise((r) => setTimeout(r, 600));
      showToast("Credentials format valid", "success", `Verified syntactic parity for ${mode}`);
    } catch {
      showToast("Test connection failed", "error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPk = publishableKey.trim().replace(/^['"]|['"]$/g, "");
    const cleanSk = secretKey.trim().replace(/^['"]|['"]$/g, "");

    let hasError = false;
    if (!cleanPk) {
      setPublishableKeyError("Publishable key is required");
      hasError = true;
    } else if (!cleanPk.startsWith("pk_live_") && !cleanPk.startsWith("pk_test_")) {
      setPublishableKeyError("Publishable key must begin with pk_live_ or pk_test_");
      hasError = true;
    } else {
      setPublishableKeyError(null);
    }

    if (!cleanSk) {
      setSecretKeyError("Secret key is required");
      hasError = true;
    } else if (
      !cleanSk.startsWith("sk_live_") &&
      !cleanSk.startsWith("sk_test_") &&
      !cleanSk.startsWith("rk_live_") &&
      !cleanSk.startsWith("rk_test_")
    ) {
      setSecretKeyError("Secret key must begin with sk_live_, sk_test_, rk_live_, or rk_test_");
      hasError = true;
    } else {
      setSecretKeyError(null);
    }

    if (hasError) return;

    setIsSubmitting(true);
    try {
      if (onVerify) {
        await onVerify({ publishableKey: cleanPk, secretKey: cleanSk });
      } else {
        const res = await fetch("/api/payments/stripe/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publishableKey: cleanPk,
            secretKey: cleanSk,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to verify and save Stripe credentials.");
        }

        showToast("Stripe Connected Successfully!", "success", `${data.accountMode?.toUpperCase()} mode active`);
        setTimeout(() => {
          if (embeddedInMarketplace) {
            router.push("/marketplace?flow=stripe-dashboard");
          } else {
            router.push("/marketplace/stripe/dashboard");
          }
        }, 800);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to connect Stripe account.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <div className="w-full flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 max-w-5xl mx-auto font-sans">
      <div className="w-full grid grid-cols-1 md:grid-cols-12 overflow-hidden rounded-xl border border-[#e8dfd8] shadow-sm bg-white">
        {/* Main Form Panel: Left Side (Col 1-7) */}
        <div className="md:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-white border-b md:border-b-0 md:border-r border-[#eee5df]">
          <div>
            {/* Header badge & title */}
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f4ece8] text-[#524b45] text-xs font-medium tracking-wide uppercase mb-3">
                <span className="material-symbols-outlined text-[15px]">lock</span>
                <span>Payment Gateway Setup</span>
              </div>
              <h1 className="font-garamond text-2xl sm:text-3xl text-[#1e1b19] font-normal tracking-tight mb-2">
                Connect Your Stripe Account
              </h1>
              <p className="text-sm text-[#66605a] leading-relaxed max-w-lg">
                Enter your Stripe account credentials so Prest can securely connect to your payment gateway.
              </p>
            </div>

            {/* Form */}
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Environment pill */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#fbf8f5] rounded border border-[#ede3dc] text-xs text-[#524b45]">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isTestMode ? "bg-amber-500" : "bg-[#2e7d32]"
                    }`}
                  />
                  <span className="font-medium text-[#1e1b19]">Environment:</span>{" "}
                  {isTestMode ? "Test Sandbox" : "Live Production"}
                </div>
                <span className="text-[#7f7570] text-[11px]">Managed automatically by Prest</span>
              </div>

              {/* Publishable Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className="text-xs font-semibold text-[#1e1b19] tracking-wider uppercase"
                    htmlFor="publishable-key"
                  >
                    Publishable Key
                  </label>
                  <span className="text-[11px] text-[#7f7570]">Safe for client-side use</span>
                </div>
                <div className="relative">
                  <input
                    id="publishable-key"
                    data-testid="input-stripe-publishable-key"
                    type="text"
                    value={publishableKey}
                    onChange={(e) => {
                      setPublishableKey(e.target.value);
                      if (publishableKeyError) setPublishableKeyError(null);
                    }}
                    placeholder={isTestMode ? "pk_test_..." : "pk_live_..."}
                    className={`w-full h-11 px-3.5 text-sm font-mono text-[#1e1b19] bg-[#faf6f3] border rounded focus:ring-1 focus:ring-[#1e1b19] focus:border-[#1e1b19] outline-none transition-all placeholder:text-[#a09891] placeholder:font-sans ${
                      publishableKeyError ? "border-red-500" : "border-[#d8cfc9]"
                    }`}
                  />
                </div>
                {publishableKeyError && (
                  <p className="text-xs text-red-600 font-medium">{publishableKeyError}</p>
                )}
              </div>

              {/* Secret Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className="text-xs font-semibold text-[#1e1b19] tracking-wider uppercase"
                    htmlFor="secret-key"
                  >
                    Secret Key
                  </label>
                  <span className="text-[11px] text-[#b42318] font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">shield</span> Confidential
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="secret-key"
                    data-testid="input-stripe-secret-key"
                    type={showSecret ? "text" : "password"}
                    value={secretKey}
                    onChange={(e) => {
                      setSecretKey(e.target.value);
                      if (secretKeyError) setSecretKeyError(null);
                    }}
                    placeholder={isTestMode ? "sk_test_..." : "sk_live_..."}
                    className={`w-full h-11 px-3.5 pr-11 text-sm font-mono text-[#1e1b19] bg-[#faf6f3] border rounded focus:ring-1 focus:ring-[#1e1b19] focus:border-[#1e1b19] outline-none transition-all placeholder:text-[#a09891] placeholder:font-sans ${
                      secretKeyError ? "border-red-500" : "border-[#d8cfc9]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7f7570] hover:text-[#1e1b19] p-1 transition-colors flex items-center justify-center cursor-pointer"
                    aria-label="Toggle secret key visibility"
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      {showSecret ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                {secretKeyError && (
                  <p className="text-xs text-red-600 font-medium">{secretKeyError}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  data-testid="btn-stripe-back"
                  className="w-full sm:w-auto px-5 h-11 border border-[#d8cfc9] text-[#524b45] text-xs font-medium uppercase tracking-wider rounded hover:bg-[#f6eee8] hover:text-[#1e1b19] transition-colors cursor-pointer active:scale-95"
                >
                  Back
                </button>

                <div className="w-full sm:w-auto flex-1 flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    data-testid="btn-stripe-test"
                    className="flex-1 h-11 border border-[#1e1b19] text-[#1e1b19] text-xs font-medium uppercase tracking-wider rounded hover:bg-[#f5ede7] transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">
                      {isTesting ? "hourglass_empty" : "sync_alt"}
                    </span>
                    <span>{isTesting ? "Testing..." : "Test Connection"}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="btn-stripe-save-connect"
                    className="flex-1 h-11 bg-[#1a1715] text-[#fff8f5] text-xs font-medium uppercase tracking-wider rounded hover:bg-[#2b2724] active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">
                      {isSubmitting ? "hourglass_empty" : "check_circle"}
                    </span>
                    <span>{isSubmitting ? "Connecting..." : "Save & Connect"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Footer security note */}
          <div className="mt-8 pt-5 border-t border-[#f0e7e1] flex items-start gap-2.5 text-[#7f7570]">
            <span
              className="material-symbols-outlined text-base text-[#524b45] shrink-0 mt-0.5"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified_user
            </span>
            <p className="text-xs leading-relaxed">
              Your payment credentials are stored securely and are used only to connect Prest with your Stripe account. Never exposed in plain text.
            </p>
          </div>
        </div>

        {/* Right Panel: Step-by-Step Mini Guide (Col 8-12) */}
        <div className="md:col-span-5 relative bg-[#faf5f1] p-6 sm:p-8 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#ebdcd2]">
              <div>
                <span className="text-[11px] font-semibold text-[#8a7f77] uppercase tracking-wider block">
                  Operator Guidance
                </span>
                <h3 className="font-garamond text-lg text-[#1e1b19] font-normal">
                  Setup Instructions
                </h3>
              </div>
              <span className="material-symbols-outlined text-[#7a6f67]">menu_book</span>
            </div>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="p-3.5 rounded-lg bg-white border border-[#e8ded6] shadow-xs">
                <div className="flex gap-3 items-start">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1e1b19] text-[#fff8f5] text-[11px] font-bold shrink-0 mt-0.5">
                    1
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#1e1b19]">Open Stripe Dashboard</p>
                    <p className="text-xs text-[#66605a] mt-0.5 leading-snug">
                      Open your Stripe account dashboard.
                    </p>
                    <a
                      href="https://dashboard.stripe.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1e1b19] hover:underline mt-2 pt-1 border-t border-[#f2eae4] w-full"
                    >
                      <span>Open Stripe Dashboard</span>
                      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-lg bg-white/70 border border-[#eee4dc]">
                <div className="flex gap-3 items-start">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#e8ded6] text-[#524b45] text-[11px] font-bold shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1e1b19]">Find Your API Credentials</p>
                    <p className="text-xs text-[#66605a] mt-0.5 leading-snug">
                      Open the API credentials section in Stripe and find the credentials required by Prest.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-lg bg-white/70 border border-[#eee4dc]">
                <div className="flex gap-3 items-start">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#e8ded6] text-[#524b45] text-[11px] font-bold shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1e1b19]">Copy Your Credentials</p>
                    <p className="text-xs text-[#66605a] mt-0.5 leading-snug">
                      Copy the required values from Stripe and paste them into the matching fields here.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-lg bg-white/70 border border-[#eee4dc]">
                <div className="flex gap-3 items-start">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#e8ded6] text-[#524b45] text-[11px] font-bold shrink-0 mt-0.5">
                    4
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1e1b19]">Verify and Connect</p>
                    <p className="text-xs text-[#66605a] mt-0.5 leading-snug">
                      Prest will check your credentials before connecting your account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Need help banner */}
          <div className="mt-6 pt-4 border-t border-[#ebdcd2]">
            <div className="p-3 bg-white/90 rounded border border-[#e5dcd4] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#524b45]">
                <span className="material-symbols-outlined text-[17px] text-[#7a6f67]">
                  help_outline
                </span>
                <span>Need assistance?</span>
              </div>
              <button
                type="button"
                onClick={() => showToast("Opening Stripe Connection Documentation...", "info")}
                className="font-semibold text-[#1e1b19] hover:underline flex items-center gap-0.5 text-[11px] uppercase tracking-wider cursor-pointer"
              >
                <span>View Guide</span>
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  return (
    <PosShell title="Payment Gateways" subtitle="Connect Stripe">
      <div className="bg-[#fbf8f5] min-h-[calc(100vh-64px)] flex flex-col justify-center">
        {content}
      </div>
    </PosShell>
  );
}

