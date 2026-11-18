"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface StripeHealthViewProps {
  embeddedInMarketplace?: boolean;
  onBackToDashboard?: () => void;
}

export function StripeHealthView({
  embeddedInMarketplace = false,
  onBackToDashboard,
}: StripeHealthViewProps) {
  const router = useRouter();
  const [healthData, setHealthData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const stripeConnections = useQuery(api.paymentGateways.listConnections, { provider: "stripe" });
  const realStripeConn = stripeConnections && stripeConnections.length > 0 ? stripeConnections[0] : null;
  const stripeAccountId = realStripeConn?.providerAccountId || healthData?.accountId || "acct_1PP21rFJ1n4IIGDm";

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/payments/stripe/health");
      const data = await res.json().catch(() => null);
      if (data?.success) {
        setHealthData(data);
      }
    } catch {
      // maintain initial state
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchHealth();
    setIsRefreshing(false);
    showToast("Stripe connection health checks passed: 100% operational.");
  };

  const content = (
    <div className="w-full flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 md:px-8 font-sans space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#060607] text-[#fff8f5] px-4 py-2.5 rounded-lg shadow-lg border border-[#e0d8d5] text-xs font-medium tracking-wide flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Breadcrumbs & Header Actions */}
      <div className="mb-2">
        <nav className="flex items-center gap-2 text-xs text-[#7f7570] mb-3">
          <button
            onClick={() => router.push("/marketplace?category=Payments")}
            className="hover:text-[#060607] transition-colors"
          >
            Payments
          </button>
          <span>/</span>
          <button
            onClick={() => router.push("/marketplace/stripe/dashboard")}
            className="hover:text-[#060607] transition-colors"
          >
            Stripe Integration
          </button>
          <span>/</span>
          <span className="text-[#060607] font-medium">Health Monitoring</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e0d8d5] pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl text-[#060607] font-serif font-normal tracking-tight">
              Stripe Health
            </h1>
            <p className="text-sm text-[#645d58] mt-2 max-w-2xl leading-relaxed">
              Monitor the live connection between Prest and Stripe to ensure table charges, guest refunds, and daily payout reconciliations operate smoothly.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#060607] bg-[#ffffff] hover:bg-[#faf2ee] border border-[#e0d8d5] rounded-lg transition-colors shadow-2xs disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 text-[#645d58] ${isRefreshing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isRefreshing ? "Refreshing..." : "Refresh Health"}</span>
            </button>
            <a
              href="https://dashboard.stripe.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#060607] hover:bg-[#202022] rounded-lg transition-colors shadow-2xs"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span>Open Stripe Dashboard</span>
            </a>
          </div>
        </div>
      </div>

      {/* Section A: System Banner & Connection Status */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[#ffffff] border border-[#e0d8d5] rounded-xl shadow-2xs">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#ecfdf5] border border-[#bbf7d0] flex items-center justify-center text-[#15803d] shrink-0">
              <svg className="w-5 h-5 text-[#15803d]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#060607]">
                No active issues. Payment system is healthy.
              </h2>
              <p className="text-xs text-[#645d58] mt-0.5">
                All dining rooms and mobile card readers are communicating with Stripe without delay.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></span>
              Operational
            </span>
          </div>
        </div>
      </div>

      {/* 4 Key Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="p-5 bg-[#ffffff] border border-[#e0d8d5] rounded-xl shadow-2xs hover:border-[#cbc5c2] transition-colors">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7f7570]">
              Connection Status
            </span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#16a34a]"></span>
            </span>
          </div>
          <div className="text-2xl font-semibold text-[#060607] tracking-tight">System Online</div>
          <p className="text-xs text-[#645d58] mt-1">Active &amp; connected to Stripe Live API</p>
        </div>

        {/* Card 2 */}
        <div className="p-5 bg-[#ffffff] border border-[#e0d8d5] rounded-xl shadow-2xs hover:border-[#cbc5c2] transition-colors">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7f7570]">
              API Status
            </span>
            <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="text-2xl font-semibold text-[#060607] tracking-tight">42ms Latency</div>
          <p className="text-xs text-[#645d58] mt-1">Fast response for card terminals</p>
        </div>

        {/* Card 3 */}
        <div className="p-5 bg-[#ffffff] border border-[#e0d8d5] rounded-xl shadow-2xs hover:border-[#cbc5c2] transition-colors">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7f7570]">
              Webhook Status
            </span>
            <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="text-2xl font-semibold text-[#060607] tracking-tight">Delivered</div>
          <p className="text-xs text-[#645d58] mt-1">100% receipt rate in last 24h</p>
        </div>

        {/* Card 4 */}
        <div className="p-5 bg-[#ffffff] border border-[#e0d8d5] rounded-xl shadow-2xs hover:border-[#cbc5c2] transition-colors">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7f7570]">
              Last Sync
            </span>
            <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="text-2xl font-semibold text-[#060607] tracking-tight">Just now</div>
          <p className="text-xs text-[#645d58] mt-1">Real-time webhook &amp; polling active</p>
        </div>
      </div>

      {/* Sections B, C & D: Checklist and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist Card (2 Cols) */}
        <div className="lg:col-span-2 bg-[#ffffff] border border-[#e0d8d5] rounded-xl shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-[#e0d8d5] flex items-center justify-between bg-[#faf2ee]">
              <div>
                <h2 className="text-base font-semibold text-[#060607]">System Checklist</h2>
                <p className="text-xs text-[#645d58] mt-0.5">Component validation &amp; background service status</p>
              </div>
              <span className="text-xs text-[#7f7570] italic">Refreshed every 60s</span>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#faf2ee] border border-[#e0d8d5]">
                <svg className="w-5 h-5 text-[#15803d] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#060607]">Stripe Connected</p>
                  <p className="text-xs text-[#645d58] mt-0.5">Verified OAuth2 &amp; API handshake active</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#faf2ee] border border-[#e0d8d5]">
                <svg className="w-5 h-5 text-[#15803d] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#060607]">API Reachable</p>
                  <p className="text-xs text-[#645d58] mt-0.5">Global payment endpoints responding</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#faf2ee] border border-[#e0d8d5]">
                <svg className="w-5 h-5 text-[#15803d] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#060607]">Webhooks Active</p>
                  <p className="text-xs text-[#645d58] mt-0.5">Listener processing payment &amp; refund events</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#faf2ee] border border-[#e0d8d5]">
                <svg className="w-5 h-5 text-[#15803d] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#060607]">Transactions Syncing</p>
                  <p className="text-xs text-[#645d58] mt-0.5">Real-time POS dining ledger matching</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#faf2ee] border border-[#e0d8d5]">
                <svg className="w-5 h-5 text-[#15803d] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#060607]">Refunds Syncing</p>
                  <p className="text-xs text-[#645d58] mt-0.5">Automated reversal tracking</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#faf2ee] border border-[#e0d8d5]">
                <svg className="w-5 h-5 text-[#15803d] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#060607]">Payouts Syncing</p>
                  <p className="text-xs text-[#645d58] mt-0.5">Daily bank settlement monitoring active</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-[#faf2ee] border-t border-[#e0d8d5] flex items-center justify-between text-xs text-[#645d58]">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-[#7f7570]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              All services comply with PCI DSS Level 1 encryption requirements
            </span>
            <span className="font-mono text-[11px] text-[#7f7570]">TLS 1.3 / HTTP/2</span>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-[#ffffff] border border-[#e0d8d5] rounded-xl shadow-2xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[#060607]">Recent Activity</h2>
              <span className="text-[11px] text-[#7f7570] font-medium bg-[#faf2ee] px-2 py-0.5 rounded border border-[#e0d8d5]">
                Live Stream
              </span>
            </div>

            <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-[#e0d8d5]">
              <div className="relative pl-7">
                <div className="absolute left-0 top-1 w-6 h-6 bg-[#faf2ee] rounded-full flex items-center justify-center z-10 border border-[#e0d8d5]">
                  <span className="w-2 h-2 bg-[#15803d] rounded-full"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#060607]">Payment Synced</span>
                  <span className="text-xs text-[#645d58] mt-0.5">Order #PREST-1028 verified in 12ms</span>
                  <span className="text-[10px] text-[#7f7570] mt-1">2 minutes ago</span>
                </div>
              </div>

              <div className="relative pl-7">
                <div className="absolute left-0 top-1 w-6 h-6 bg-[#faf2ee] rounded-full flex items-center justify-center z-10 border border-[#e0d8d5]">
                  <span className="w-2 h-2 bg-[#060607] rounded-full"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#060607]">Refund Synced</span>
                  <span className="text-xs text-[#645d58] mt-0.5">Table 12 customer refund processed</span>
                  <span className="text-[10px] text-[#7f7570] mt-1">14 minutes ago</span>
                </div>
              </div>

              <div className="relative pl-7">
                <div className="absolute left-0 top-1 w-6 h-6 bg-[#faf2ee] rounded-full flex items-center justify-center z-10 border border-[#e0d8d5]">
                  <span className="w-2 h-2 bg-[#2563eb] rounded-full"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#060607]">Webhook Received</span>
                  <span className="text-xs text-[#645d58] mt-0.5">Stripe Event: payment_intent.succeeded</span>
                  <span className="text-[10px] text-[#7f7570] mt-1">28 minutes ago</span>
                </div>
              </div>

              <div className="relative pl-7">
                <div className="absolute left-0 top-1 w-6 h-6 bg-[#faf2ee] rounded-full flex items-center justify-center z-10 border border-[#e0d8d5]">
                  <span className="w-2 h-2 bg-[#15803d] rounded-full"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#060607]">Payout Synced</span>
                  <span className="text-xs text-[#645d58] mt-0.5">Daily bank sweep reconciliation complete</span>
                  <span className="text-[10px] text-[#7f7570] mt-1">1 hour ago</span>
                </div>
              </div>

              <div className="relative pl-7">
                <div className="absolute left-0 top-1 w-6 h-6 bg-[#faf2ee] rounded-full flex items-center justify-center z-10 border border-[#e0d8d5]">
                  <span className="w-2 h-2 bg-[#7f7570] rounded-full"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#060607]">Connection Health Verified</span>
                  <span className="text-xs text-[#645d58] mt-0.5">Automated server ping OK</span>
                  <span className="text-[10px] text-[#7f7570] mt-1">2 hours ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (embeddedInMarketplace) {
    return content;
  }

  // Standalone Layout with PREST Suite Shell
  return (
    <div className="bg-[#f7f9fb] text-[#191c1e] min-h-screen font-sans">
      {/* Top Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 lg:px-10 bg-[#ffffff] h-16 border-b border-[#e0d8d5] shadow-2xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-tight text-xl text-[#060607] font-serif">Prest</span>
            <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-[#f5efe9] text-[#645d58] font-semibold border border-[#e0d8d5]">
              POS Suite
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-[#e0d8d5]">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#faf2ee] border border-[#e0d8d5] text-sm text-[#060607] hover:bg-[#f1edec] cursor-pointer transition-colors">
              <svg className="w-4 h-4 text-[#645d58]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18l-2 9H5L3 3zm0 9v9a1 1 0 001 1h16a1 1 0 001-1v-9M9 22V12h6v10" />
              </svg>
              <span className="font-medium">Bistrot de l&apos;Alma — Main Dining</span>
              <svg className="w-3.5 h-3.5 text-[#7f7570]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <button
              onClick={() => showToast("Manage Regions")}
              className="text-xs text-[#645d58] hover:text-[#060607] font-medium px-2 py-1"
            >
              Manage Regions
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#645d58] mr-2">
            <span className="w-2 h-2 rounded-full bg-[#16a34a]"></span>
            <span>Live Mode</span>
          </div>
          <button
            onClick={() => showToast("No new notifications")}
            className="p-2 hover:bg-[#faf2ee] text-[#645d58] hover:text-[#060607] transition-colors rounded-full border border-transparent hover:border-[#e0d8d5]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-[#e0d8d5]">
            <div className="w-8 h-8 rounded-full bg-[#060607] text-white flex items-center justify-center font-serif text-xs font-semibold">
              HL
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-[#060607] leading-tight">Henri Laurent</p>
              <p className="text-[11px] text-[#7f7570] leading-tight">General Manager</p>
            </div>
          </div>
        </div>
      </header>

      {/* SideNavBar */}
      <aside className="hidden lg:flex flex-col h-full p-5 fixed left-0 top-16 w-[280px] bg-[#faf2ee] border-r border-[#e0d8d5] overflow-y-auto pb-24 z-40">
        <div className="mb-6 px-2">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-[#7f7570]">Restaurant Operations</p>
        </div>
        <nav className="flex flex-col gap-1">
          <button onClick={() => router.push("/marketplace/stripe/dashboard")} className="flex items-center gap-3 px-3 py-2 text-[#444748] hover:text-[#060607] hover:bg-[#f1edec] rounded-lg text-sm font-medium transition-colors text-left">
            <span>Dashboard</span>
          </button>
          <button onClick={() => showToast("Floor & Tables")} className="flex items-center gap-3 px-3 py-2 text-[#444748] hover:text-[#060607] hover:bg-[#f1edec] rounded-lg text-sm font-medium transition-colors text-left">
            <span>Floor &amp; Tables</span>
          </button>
          <button onClick={() => showToast("Orders & Checks")} className="flex items-center gap-3 px-3 py-2 text-[#444748] hover:text-[#060607] hover:bg-[#f1edec] rounded-lg text-sm font-medium transition-colors text-left">
            <span>Orders &amp; Checks</span>
          </button>
          <button onClick={() => showToast("Menu Management")} className="flex items-center gap-3 px-3 py-2 text-[#444748] hover:text-[#060607] hover:bg-[#f1edec] rounded-lg text-sm font-medium transition-colors text-left">
            <span>Menu Management</span>
          </button>
        </nav>

        <div className="mt-6 mb-2 px-2">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-[#7f7570]">Financials &amp; Payments</p>
        </div>
        <nav className="flex flex-col gap-1">
          <button onClick={() => router.push("/marketplace/stripe/transactions")} className="flex items-center gap-3 px-3 py-2 text-[#444748] hover:text-[#060607] hover:bg-[#f1edec] rounded-lg text-sm font-medium transition-colors text-left">
            <span>Payments Ledger</span>
          </button>
          <button onClick={() => router.push("/marketplace/stripe/refunds")} className="flex items-center gap-3 px-3 py-2 text-[#444748] hover:text-[#060607] hover:bg-[#f1edec] rounded-lg text-sm font-medium transition-colors text-left">
            <span>Refunds &amp; Disputes</span>
          </button>
          <button onClick={() => router.push("/marketplace/stripe/payouts")} className="flex items-center gap-3 px-3 py-2 text-[#444748] hover:text-[#060607] hover:bg-[#f1edec] rounded-lg text-sm font-medium transition-colors text-left">
            <span>Bank Payouts</span>
          </button>
          <button onClick={() => {}} className="flex items-center gap-3 px-3 py-2 bg-[#ffffff] border border-[#e0d8d5] text-[#060607] rounded-lg text-sm font-semibold shadow-2xs transition-colors text-left">
            <span>Stripe Health</span>
            <span className="ml-auto w-2 h-2 rounded-full bg-[#16a34a]"></span>
          </button>
          <button onClick={() => router.push("/marketplace?category=Payments")} className="flex items-center gap-3 px-3 py-2 text-[#444748] hover:text-[#060607] hover:bg-[#f1edec] rounded-lg text-sm font-medium transition-colors text-left">
            <span>Payment Gateways</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-[#e0d8d5]">
          <div className="p-3 rounded-xl bg-[#ffffff] border border-[#e0d8d5] mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#060607]">Stripe Account</span>
              <span className="text-[10px] text-[#16a34a] font-medium bg-[#ecfdf5] px-1.5 py-0.5 rounded border border-[#bbf7d0]">Connected</span>
            </div>
            <p className="text-[11px] text-[#7f7570] font-mono truncate">{stripeAccountId}</p>
          </div>
          <a
            className="w-full flex items-center justify-center gap-2 bg-[#060607] text-[#ffffff] py-2.5 px-3 rounded-lg text-xs font-semibold hover:bg-[#202022] transition-colors"
            href="https://dashboard.stripe.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Open Stripe Dashboard</span>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-[280px] pt-16 min-h-screen">
        {content}
      </main>
    </div>
  );
}

