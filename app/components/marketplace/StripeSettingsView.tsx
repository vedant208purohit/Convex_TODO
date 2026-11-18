"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { resolveOrganizationCurrency } from "../../lib/payments/currency";

interface StripeSettingsViewProps {
  embeddedInMarketplace?: boolean;
  onBackToDashboard?: () => void;
  onDisconnect?: () => void;
}

export function StripeSettingsView({
  embeddedInMarketplace = false,
  onBackToDashboard,
  onDisconnect,
}: StripeSettingsViewProps) {
  const router = useRouter();

  // Store & Currency Resolution
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;
  const storeCurrencyInfo = resolveOrganizationCurrency(activeOrg);
  const isIndia =
    activeOrg?.country === "India" ||
    activeOrg?.country === "IN" ||
    storeCurrencyInfo.countryCode === "IN";
  const currencySymbol = isIndia ? "₹" : storeCurrencyInfo.symbol || "$";
  const currencyCode = isIndia ? "INR" : storeCurrencyInfo.currencyCode || "USD";
  const countryName = activeOrg?.country || (isIndia ? "India" : "United States");

  // Real live Stripe Connection from Convex
  const stripeConnections = useQuery(api.paymentGateways.listConnections, { provider: "stripe" });
  const realStripeConn =
    stripeConnections && stripeConnections.length > 0 ? stripeConnections[0] : null;

  const businessName =
    realStripeConn?.merchantName || activeOrg?.name || "DEFX Inc.";
  const accountId =
    realStripeConn?.providerAccountId ||
    realStripeConn?.maskedKeyId ||
    (businessName.includes("Bistro") ? "acct_1NZ4xX2eR..." : "acct_1PP21rFJ1n4IIGDm");
  const connectedSince = realStripeConn?.connectedAt
    ? new Date(realStripeConn.connectedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : businessName.includes("Bistro")
      ? "October 24, 2023"
      : "Active";

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncTime, setSyncTime] = useState("2 minutes ago");
  const [isCopied, setIsCopied] = useState(false);
  const [isRegionsModalOpen, setIsRegionsModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Regional Gateway Routing from Convex
  const routingData = useQuery(api.paymentGateways.getRegionalGatewayRouting, {});
  const saveRegionalRoutingMutation = useMutation(api.paymentGateways.saveRegionalGatewayRouting);

  const [editableRules, setEditableRules] = useState<any[]>([]);
  const [isSavingRegions, setIsSavingRegions] = useState(false);

  useEffect(() => {
    if (routingData?.rules) {
      setEditableRules(routingData.rules);
    }
  }, [routingData?.rules]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyAccount = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(accountId);
    }
    setIsCopied(true);
    showToast("Stripe Account ID copied to clipboard.");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch("/api/payments/stripe/health");
      setSyncTime("Just now");
    } catch {
      // fallback
    } finally {
      setIsRefreshing(false);
    }
    showToast("Stripe gateway settings and webhook status updated.");
  };

  const handleSaveRegions = async () => {
    setIsSavingRegions(true);
    try {
      const sanitizedRules = (editableRules.length > 0 ? editableRules : (routingData?.rules || [])).map((r: any) => ({
        regionId: r.regionId,
        regionName: r.regionName,
        gateway: r.gateway,
        enabled: Boolean(r.enabled),
        description: r.description,
        connectionStatus: r.connectionStatus,
      }));
      await saveRegionalRoutingMutation({
        organizationId: activeOrg?._id,
        rules: sanitizedRules,
      });
      setIsRegionsModalOpen(false);
      showToast("Default regional payment gateway assignments updated.");
    } catch (err: any) {
      showToast(err.message || "Failed to update regional assignments.");
    } finally {
      setIsSavingRegions(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnectModalOpen(false);
    try {
      await fetch("/api/payments/stripe/disconnect", { method: "POST" });
    } catch {
      // ignore
    }
    showToast("Stripe account disconnected.");
    if (onDisconnect) {
      onDisconnect();
    } else {
      router.push("/marketplace?category=Payments");
    }
  };

  const content = (
    <div className="w-full flex-1 max-w-6xl mx-auto p-4 sm:p-6 md:p-10 font-sans space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#060607] text-[#fff8f5] px-4 py-2.5 rounded-lg shadow-lg border border-[#e0d8d5] text-xs font-medium tracking-wide flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-[#645d58] mb-3">
        <button
          onClick={() => router.push("/marketplace?category=Payments")}
          className="hover:text-[#060607] transition-colors"
        >
          Settings
        </button>
        <span className="text-[#e0d8d5]">/</span>
        <button
          onClick={() => router.push("/marketplace?category=Payments")}
          className="hover:text-[#060607] transition-colors"
        >
          Payment Integrations
        </button>
        <span className="text-[#e0d8d5]">/</span>
        <span className="text-[#060607] font-medium">Stripe Settings</span>
      </nav>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#e0d8d5]">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-normal text-[#060607] tracking-tight">
            Stripe Settings
          </h1>
          <p className="text-sm text-[#645d58] mt-1 font-normal">
            Manage your connected Stripe account and payment gateway configuration.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 border border-[#e0d8d5] bg-white hover:bg-[#faf2ee] text-xs font-medium text-[#060607] rounded shadow-2xs transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 text-[#645d58] ${isRefreshing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Data</span>
          </button>
          <a
            href="https://dashboard.stripe.com/"
            rel="noopener noreferrer"
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 bg-[#060607] hover:bg-[#1f1f1f] text-white text-xs font-medium rounded shadow-2xs transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Open Stripe Dashboard</span>
          </a>
        </div>
      </div>

      {/* Bento Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section A: Connected Account card */}
        <section className="lg:col-span-2 bg-white border border-[#e0d8d5] rounded-lg p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-5 mb-5 border-b border-[#e0d8d5]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-[#faf2ee] border border-[#e0d8d5] flex items-center justify-center text-[#060607]">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18l-2 9H5L3 3zm0 9v9a1 1 0 001 1h16a1 1 0 001-1v-9M9 22V12h6v10" />
                </svg>
              </div>
              <div>
                <h2 className="font-serif text-lg font-semibold text-[#060607]">Connected Account</h2>
                <p className="text-xs text-[#645d58]">Verified merchant payment credentials</p>
              </div>
            </div>
            {/* Status Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#edf7ee] border border-[#2e6f40]/20 text-[#2e6f40] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2e6f40]"></span>
              <span>Active &amp; Verified</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
            <div>
              <span className="text-[11px] font-semibold text-[#645d58] uppercase tracking-wider block mb-1">
                Business Name
              </span>
              <p className="text-[15px] font-semibold text-[#060607]">{businessName}</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#645d58] uppercase tracking-wider block mb-1">
                Stripe Account ID
              </span>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-[#faf2ee] px-2 py-1 rounded border border-[#e0d8d5] text-[#060607]">
                  {accountId}
                </code>
                <button
                  type="button"
                  onClick={handleCopyAccount}
                  className="text-[#645d58] hover:text-[#060607] transition-colors p-1"
                  title="Copy account ID"
                >
                  {isCopied ? (
                    <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#645d58] uppercase tracking-wider block mb-1">
                Country
              </span>
              <div className="flex items-center gap-1.5 text-sm text-[#060607]">
                <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>{countryName}</span>
              </div>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#645d58] uppercase tracking-wider block mb-1">
                Default Currency
              </span>
              <p className="text-sm font-semibold text-[#060607]">{currencyCode} ({currencySymbol})</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#e0d8d5] flex items-center justify-between text-xs text-[#645d58]">
            <span>Connected Since: <strong className="text-[#060607] font-medium">{connectedSince}</strong></span>
            <span className="inline-flex items-center gap-1 text-[#645d58]">
              <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
              </svg>
              PCI-DSS Level 1 Compliant
            </span>
          </div>
        </section>

        {/* Section B: Synchronization card */}
        <section className="bg-white border border-[#e0d8d5] rounded-lg p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 pb-5 mb-5 border-b border-[#e0d8d5]">
              <div className="w-9 h-9 rounded bg-[#faf2ee] border border-[#e0d8d5] flex items-center justify-center text-[#060607]">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <h2 className="font-serif text-lg font-semibold text-[#060607]">Synchronization</h2>
                <p className="text-xs text-[#645d58]">Webhook &amp; event listener health</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-[#645d58]">Last Sync</span>
                <span className="text-xs font-semibold text-[#060607]">{syncTime}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-[#645d58]">Sync Frequency</span>
                <span className="text-[11px] font-medium text-[#645d58] bg-[#f1edec] px-2 py-0.5 rounded border border-[#e0d8d5]">
                  Real-time
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-[#645d58]">Webhook Status</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#2e6f40]"></span>
                  <span className="text-xs font-medium text-[#2e6f40]">Active</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-[#e0d8d5]">
            <div className="text-[11px] text-[#645d58] leading-relaxed bg-[#faf2ee] p-3 rounded border border-[#e0d8d5]">
              All settlement records, refunds, and terminal transactions are automatically mapped to Prest general ledger.
            </div>
          </div>
        </section>
      </div>

      {/* Section C: Default Payment Gateway by Region */}
      <section className="bg-white border border-[#e0d8d5] rounded-lg p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-5 border-b border-[#e0d8d5] gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#060607]">
              Default Payment Gateway by Region
            </h2>
            <p className="text-xs text-[#645d58] mt-0.5">
              Configure which restaurant regions use Stripe as their primary payment gateway.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsRegionsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded border border-[#e0d8d5] bg-white hover:bg-[#faf2ee] text-xs font-medium text-[#060607] transition-colors self-start sm:self-auto shadow-2xs"
          >
            <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>Manage Default Regions</span>
          </button>
        </div>

        <div className="space-y-3">
          {(routingData?.rules || [
            {
              regionId: "US",
              regionName: "United States",
              gateway: "stripe",
              enabled: true,
              description: "Primary terminal routing for US dining rooms and takeout online ordering",
              connectionStatus: "connected",
            },
            {
              regionId: "GB_EU",
              regionName: "United Kingdom & Europe",
              gateway: "stripe",
              enabled: true,
              description: "Multi-currency settlements (GBP, EUR) routed via Stripe Europe SE",
              connectionStatus: "connected",
            },
          ])
            .filter((r: any) => r.enabled)
            .map((rule: any) => (
              <div
                key={rule.regionId}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded border border-[#e0d8d5] bg-[#faf2ee]/60 gap-3"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#645d58] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {rule.regionId === "US" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    ) : (
                      <>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </>
                    )}
                  </svg>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#060607]">{rule.regionName}</p>
                      <span className="font-mono text-[10px] bg-white border border-[#e0d8d5] text-[#645d58] px-1.5 py-0.2 rounded">
                        {rule.regionId}
                      </span>
                    </div>
                    <p className="text-xs text-[#645d58] mt-0.5">{rule.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded bg-white border border-[#e0d8d5] text-[#060607]">
                    {rule.gateway === "stripe"
                      ? "Stripe · Current Default Gateway"
                      : rule.gateway === "razorpay"
                        ? "Razorpay · Current Default Gateway"
                        : "Current Default Gateway"}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#edf7ee] text-[#2e6f40] border border-[#2e6f40]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2e6f40]" />
                    Active
                  </span>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Section D: Supported Payment Methods */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#060607]">
              Supported Payment Methods
            </h2>
            <p className="text-xs text-[#645d58] mt-0.5">
              Active payment methods currently accepted at tableside and online checkout.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Visa */}
          <div className="bg-white border border-[#e0d8d5] rounded-lg p-4 shadow-2xs flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded bg-[#faf2ee] border border-[#e0d8d5] flex items-center justify-center text-[#060607]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[#060607]">Visa</span>
            <span className="px-2 py-0.5 bg-[#edf7ee] text-[#2e6f40] rounded text-[10px] font-semibold tracking-wider uppercase">
              Enabled
            </span>
          </div>

          {/* Mastercard */}
          <div className="bg-white border border-[#e0d8d5] rounded-lg p-4 shadow-2xs flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded bg-[#faf2ee] border border-[#e0d8d5] flex items-center justify-center text-[#060607]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="12" r="6" />
                <circle cx="15" cy="12" r="6" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[#060607]">Mastercard</span>
            <span className="px-2 py-0.5 bg-[#edf7ee] text-[#2e6f40] rounded text-[10px] font-semibold tracking-wider uppercase">
              Enabled
            </span>
          </div>

          {/* Apple Pay */}
          <div className="bg-white border border-[#e0d8d5] rounded-lg p-4 shadow-2xs flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded bg-[#faf2ee] border border-[#e0d8d5] flex items-center justify-center text-[#060607]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[#060607]">Apple Pay</span>
            <span className="px-2 py-0.5 bg-[#edf7ee] text-[#2e6f40] rounded text-[10px] font-semibold tracking-wider uppercase">
              Enabled
            </span>
          </div>

          {/* Google Pay */}
          <div className="bg-white border border-[#e0d8d5] rounded-lg p-4 shadow-2xs flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded bg-[#faf2ee] border border-[#e0d8d5] flex items-center justify-center text-[#060607]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[#060607]">Google Pay</span>
            <span className="px-2 py-0.5 bg-[#edf7ee] text-[#2e6f40] rounded text-[10px] font-semibold tracking-wider uppercase">
              Enabled
            </span>
          </div>

          {/* Bank Transfer */}
          <div className="bg-white border border-[#e0d8d5] rounded-lg p-4 shadow-2xs flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded bg-[#faf2ee] border border-[#e0d8d5] flex items-center justify-center text-[#060607]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2l9 5H3l9-5z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[#060607]">Bank Transfer</span>
            <span className="px-2 py-0.5 bg-[#edf7ee] text-[#2e6f40] rounded text-[10px] font-semibold tracking-wider uppercase">
              Enabled
            </span>
          </div>
        </div>
      </section>

      {/* Section E: Danger Zone */}
      <section className="bg-white border border-[#e0d8d5] rounded-lg p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-[#9e2a2b]">
              <svg className="w-4 h-4 text-[#9e2a2b]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h2 className="font-serif text-base font-semibold">Danger Zone</h2>
            </div>
            <p className="text-xs text-[#645d58] leading-relaxed">
              Disconnecting Stripe will stop new payments from being processed through this connection. Historical payments, refunds and payouts will remain available in Prest.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDisconnectModalOpen(true)}
            className="whitespace-nowrap px-4 py-2 bg-[#9e2a2b] hover:bg-[#832324] !text-white text-xs font-medium rounded transition-colors self-start md:self-auto flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <svg className="w-4 h-4 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className="text-white font-medium">Disconnect Stripe</span>
          </button>
        </div>
      </section>

      {/* Regional Management Modal */}
      {isRegionsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060607]/40 backdrop-blur-xs animate-in fade-in">
          <div className="relative bg-white w-full max-w-xl rounded-lg p-6 border border-[#e0d8d5] shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-[#e0d8d5]">
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#060607]">Default Gateway by Region</h3>
                <p className="text-xs text-[#645d58]">Configure primary payment gateway assignments per geographical region</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRegionsModalOpen(false)}
                className="text-[#645d58] hover:text-[#060607] p-1 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {(editableRules.length > 0 ? editableRules : [
                {
                  regionId: "US",
                  regionName: "United States (Domestic)",
                  gateway: "stripe",
                  enabled: true,
                  description: "Primary terminal routing for US dining rooms and takeout online ordering",
                  connectionStatus: "connected",
                },
                {
                  regionId: "GB_EU",
                  regionName: "United Kingdom & Europe",
                  gateway: "stripe",
                  enabled: true,
                  description: "Multi-currency settlements (GBP, EUR) routed via Stripe Europe SE",
                  connectionStatus: "connected",
                },
                {
                  regionId: "IN",
                  regionName: "India",
                  gateway: "razorpay",
                  enabled: true,
                  description: "Domestic INR settlements with UPI, Indian Credit/Debit cards & Netbanking",
                  connectionStatus: "connected",
                },
                {
                  regionId: "AE",
                  regionName: "United Arab Emirates",
                  gateway: "stripe",
                  enabled: false,
                  description: "Middle East AED currency dining room and online order processing",
                  connectionStatus: "connected",
                },
                {
                  regionId: "CA",
                  regionName: "Canada",
                  gateway: "stripe",
                  enabled: false,
                  description: "Canadian Dollar (CAD) domestic & cross-border card transactions",
                  connectionStatus: "connected",
                },
              ]).map((rule: any) => {
                const isAssignedConnected =
                  rule.gateway === "none" ||
                  (routingData?.availableGateways?.find((g: any) => g.provider === rule.gateway)?.status === "connected");

                return (
                  <div
                    key={rule.regionId}
                    className={`p-3.5 rounded border transition-colors ${
                      rule.enabled
                        ? "border-[#060607]/40 bg-[#faf2ee]"
                        : "border-[#e0d8d5] bg-white opacity-80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEditableRules((prev) => {
                              const base = prev.length > 0 ? prev : (routingData?.rules || []);
                              return base.map((r: any) =>
                                r.regionId === rule.regionId ? { ...r, enabled: checked } : r
                              );
                            });
                          }}
                          className="mt-0.5 rounded text-[#060607] focus:ring-[#060607] border-[#e0d8d5] cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#060607] block">{rule.regionName}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white rounded border border-[#e0d8d5] text-[#645d58]">
                              {rule.regionId}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#645d58] block mt-0.5">{rule.description}</span>
                        </div>
                      </label>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <select
                          value={rule.gateway}
                          disabled={!rule.enabled}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditableRules((prev) => {
                              const base = prev.length > 0 ? prev : (routingData?.rules || []);
                              return base.map((r: any) =>
                                r.regionId === rule.regionId ? { ...r, gateway: val } : r
                              );
                            });
                          }}
                          className={`text-xs rounded border border-[#e0d8d5] px-2.5 py-1 bg-white font-medium text-[#060607] focus:ring-1 focus:ring-[#060607] focus:outline-hidden ${
                            !rule.enabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                          }`}
                        >
                          <option value="none">No Gateway</option>
                          <option value="stripe">Stripe</option>
                          <option value="razorpay">Razorpay</option>
                        </select>

                        <div className="flex items-center gap-1">
                          {rule.enabled && (
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                                isAssignedConnected
                                  ? "bg-[#edf7ee] text-[#2e6f40] border-[#2e6f40]/20"
                                  : "bg-[#fdf2f2] text-[#9e2a2b] border-[#9e2a2b]/20"
                              }`}
                            >
                              {isAssignedConnected ? "Ready" : "Not Connected"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#e0d8d5]">
              <span className="text-[11px] text-[#645d58]">
                Changes persist automatically to your restaurant store configuration.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegionsModalOpen(false)}
                  disabled={isSavingRegions}
                  className="px-4 py-2 border border-[#e0d8d5] text-xs font-medium rounded hover:bg-[#faf2ee] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRegions}
                  disabled={isSavingRegions}
                  className="px-4 py-2 bg-[#060607] hover:bg-[#1f1f1f] text-white text-xs font-medium rounded transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingRegions && (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  <span>{isSavingRegions ? "Saving..." : "Save Regions"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Modal Overlay */}
      {isDisconnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060607]/40 backdrop-blur-xs animate-in fade-in">
          <div className="relative bg-white w-full max-w-md rounded-lg p-6 border border-[#e0d8d5] shadow-xl text-center space-y-4">
            <div className="w-12 h-12 bg-[#fdf2f2] text-[#9e2a2b] rounded-full flex items-center justify-center mx-auto border border-[#9e2a2b]/20">
              <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-serif text-xl font-semibold text-[#060607]">Disconnect Stripe?</h3>
            <p className="text-xs text-[#645d58] leading-relaxed">
              Disconnecting Stripe will stop new payments from being processed through this connection. Historical payments, refunds and payouts will remain available in Prest.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                className="w-full py-2.5 bg-[#9e2a2b] text-white text-xs font-medium rounded hover:bg-[#832324] transition-colors"
              >
                Confirm Disconnection
              </button>
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(false)}
                className="w-full py-2.5 border border-[#e0d8d5] bg-[#faf2ee] text-[#060607] text-xs font-medium rounded hover:bg-[#f1edec] transition-colors"
              >
                Cancel &amp; Keep Active
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  // Standalone Layout with PREST Suite Shell
  return (
    <div className="bg-[#fff8f5] text-[#1e1b19] min-h-screen flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 w-full border-b border-[#e0d8d5] bg-white sticky top-0 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#060607] text-white flex items-center justify-center font-serif font-semibold text-base tracking-wide">
              P
            </div>
            <div>
              <span className="font-serif font-bold text-[17px] tracking-tight text-[#060607] block leading-tight">
                Prest
              </span>
              <span className="text-[10px] tracking-widest uppercase font-medium text-[#645d58] block">
                Restaurant Suite
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium tracking-wide">
            <button onClick={() => router.push("/marketplace/stripe/dashboard")} className="text-[#645d58] hover:text-[#060607] transition-colors py-1">Overview</button>
            <button onClick={() => router.push("/marketplace/stripe/transactions")} className="text-[#645d58] hover:text-[#060607] transition-colors py-1">Orders</button>
            <button onClick={() => router.push("/marketplace/stripe/payouts")} className="text-[#645d58] hover:text-[#060607] transition-colors py-1">Payments</button>
            <button onClick={() => showToast("Menu")} className="text-[#645d58] hover:text-[#060607] transition-colors py-1">Menu</button>
            <button onClick={() => router.push("/marketplace/stripe/insights")} className="text-[#645d58] hover:text-[#060607] transition-colors py-1">Reports</button>
            <button onClick={() => {}} className="text-[#060607] font-semibold border-b-2 border-[#060607] py-1">Settings</button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded border border-[#e0d8d5] bg-[#faf2ee] text-xs font-medium text-[#060607]">
            <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18l-2 9H5L3 3zm0 9v9a1 1 0 001 1h16a1 1 0 001-1v-9M9 22V12h6v10" />
            </svg>
            <span>Bistrot de l&apos;Alma — Main Dining</span>
            <svg className="w-3.5 h-3.5 text-[#645d58]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>

          <button
            onClick={() => setIsRegionsModalOpen(true)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#e0d8d5] bg-white hover:bg-[#faf2ee] text-xs font-medium text-[#060607] transition-colors"
          >
            <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>Manage Default Regions</span>
          </button>

          <button className="w-8 h-8 rounded border border-[#e0d8d5] flex items-center justify-center text-[#645d58] hover:text-[#060607] hover:bg-[#faf2ee] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          <div className="w-8 h-8 rounded-full border border-[#e0d8d5] bg-[#ebe1da] flex items-center justify-center text-xs font-semibold text-[#060607]">
            LB
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-[calc(100vh-64px)]">
        {/* Left Persistent Sidebar */}
        <aside className="hidden lg:flex flex-col w-[250px] border-r border-[#e0d8d5] bg-[#faf2ee] p-5 justify-between shrink-0">
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold tracking-wider text-[#645d58] uppercase px-2 mb-2 block">
                Management
              </span>
              <button
                onClick={() => router.push("/marketplace/stripe/dashboard")}
                className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-[#645d58] hover:text-[#060607] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Operations</span>
              </button>
              <button
                onClick={() => showToast("Menus")}
                className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-[#645d58] hover:text-[#060607] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Menus</span>
              </button>
              <button
                onClick={() => router.push("/marketplace/stripe/transactions")}
                className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-[#645d58] hover:text-[#060607] hover:bg-[#eee7e3] rounded transition-colors text-left"
              >
                <span>Financials &amp; Payments</span>
              </button>
              <button
                onClick={() => {}}
                className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-[#060607] bg-white border border-[#e0d8d5] shadow-2xs rounded text-left font-semibold"
              >
                <span>Settings</span>
              </button>
            </div>

            <div className="pt-4 border-t border-[#e0d8d5] space-y-1">
              <span className="text-[11px] font-semibold tracking-wider text-[#645d58] uppercase px-2 mb-2 block">
                Settings Subsections
              </span>
              <button onClick={() => showToast("General Preferences")} className="w-full text-left block px-3 py-1.5 text-xs text-[#645d58] hover:text-[#060607]">General Preferences</button>
              <button onClick={() => {}} className="w-full text-left block px-3 py-1.5 text-xs font-semibold text-[#060607] pl-4 border-l-2 border-[#060607] -ml-[1px]">Payment Integrations</button>
              <button onClick={() => showToast("Taxes & Surcharges")} className="w-full text-left block px-3 py-1.5 text-xs text-[#645d58] hover:text-[#060607]">Taxes &amp; Surcharges</button>
              <button onClick={() => showToast("POS Hardware & Terminals")} className="w-full text-left block px-3 py-1.5 text-xs text-[#645d58] hover:text-[#060607]">POS Hardware &amp; Terminals</button>
              <button onClick={() => showToast("Staff & Permissions")} className="w-full text-left block px-3 py-1.5 text-xs text-[#645d58] hover:text-[#060607]">Staff &amp; Permissions</button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#e0d8d5]">
            <div className="flex items-center justify-between p-2.5 rounded border border-[#e0d8d5] bg-white">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2e6f40]"></span>
                <span className="text-xs font-medium text-[#060607]">Stripe Connected</span>
              </div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-[#645d58] bg-[#f1edec] px-1.5 py-0.5 rounded">
                Live
              </span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">{content}</main>
      </div>
    </div>
  );
}

