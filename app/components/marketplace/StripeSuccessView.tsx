"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { resolveOrganizationCurrency } from "../../lib/payments/currency";

export interface StripeSuccessConnectionData {
  businessName?: string;
  stripeAccountId?: string;
  country?: string;
  currency?: string;
  connectedSince?: string;
}

interface StripeSuccessViewProps {
  embeddedInMarketplace?: boolean;
  connectionData?: StripeSuccessConnectionData;
  onGoToDashboard?: () => void;
  onReturnToMarketplace?: () => void;
}

export function StripeSuccessView({
  embeddedInMarketplace = false,
  connectionData,
  onGoToDashboard,
  onReturnToMarketplace,
}: StripeSuccessViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read organization name if available
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations && organizations.length > 0 ? organizations[0] : null;

  // Resolve query parameters or defaults matching reference
  const paramAccountId = searchParams?.get("account_id") || searchParams?.get("acct");
  const paramBusinessName = searchParams?.get("business") || searchParams?.get("name");

  const storeCurrencyInfo = resolveOrganizationCurrency(activeOrg);
  const isIndia =
    activeOrg?.country === "India" ||
    activeOrg?.country === "IN" ||
    storeCurrencyInfo.countryCode === "IN";
  const currencySymbol = isIndia ? "₹" : storeCurrencyInfo.symbol || "$";
  const currencyCode = isIndia ? "INR" : storeCurrencyInfo.currencyCode || "USD";

  const businessName =
    connectionData?.businessName ||
    paramBusinessName ||
    activeOrg?.name ||
    "Le Bistro Gourmand";

  const stripeAccountId =
    connectionData?.stripeAccountId ||
    paramAccountId ||
    "acct_12345";

  const operatingCountry = connectionData?.country || (isIndia ? "India" : (activeOrg?.country || "United States"));
  const defaultCurrency = connectionData?.currency || `${currencyCode} (${currencySymbol})`;
  const connectedSince = connectionData?.connectedSince || "Just now";

  const handleDashboard = () => {
    if (onGoToDashboard) {
      onGoToDashboard();
    } else if (embeddedInMarketplace) {
      router.push("/marketplace?flow=stripe-dashboard");
    } else {
      router.push("/marketplace/stripe/dashboard");
    }
  };

  const handleReturn = () => {
    if (onReturnToMarketplace) {
      onReturnToMarketplace();
    } else if (embeddedInMarketplace) {
      router.push("/marketplace?flow=stripe-dashboard");
    } else {
      router.push("/marketplace/stripe/dashboard");
    }
  };

  const content = (
    <div className="w-full max-w-3xl px-4 md:px-0 py-8 md:py-10 flex flex-col items-center mx-auto font-sans">
      {/* Success Badge */}
      <div className="relative flex items-center justify-center mb-8">
        <div className="w-20 h-20 rounded-full bg-[#1b4332]/10 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#1b4332] text-white flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined !text-[28px] font-bold">check</span>
          </div>
        </div>
      </div>

      {/* Main Heading & Description */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl text-[#1e1b19] tracking-tight mb-3 font-serif">
          Stripe Connected Successfully
        </h1>
        <p className="text-base text-[#645d58] max-w-lg mx-auto leading-relaxed">
          Your Stripe account is now connected to Prest. You can manage your restaurant payment activity through the Prest admin panel.
        </p>
      </div>

      {/* 2 Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 w-full mb-10">
        {/* Card 1: Connection Summary (3 cols) */}
        <div
          data-testid="connection-summary-card"
          className="md:col-span-3 bg-white border border-[#e0d8d5] rounded-xl p-6 shadow-xs"
        >
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-[#1e1b19]">restaurant</span>
            <h3 className="text-lg font-medium text-[#1e1b19] font-serif">
              Connection Summary
            </h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-[#f4ece8]">
              <span className="text-xs uppercase tracking-wider text-[#7f7570] font-medium">
                BUSINESS NAME
              </span>
              <span className="text-sm text-[#1e1b19] font-semibold text-right">
                {businessName}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#f4ece8]">
              <span className="text-xs uppercase tracking-wider text-[#7f7570] font-medium">
                STRIPE ACCOUNT ID
              </span>
              <span className="text-sm text-[#1e1b19] font-mono text-right">
                {stripeAccountId}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#f4ece8]">
              <span className="text-xs uppercase tracking-wider text-[#7f7570] font-medium">
                OPERATING COUNTRY
              </span>
              <span className="text-sm text-[#1e1b19] text-right">
                {operatingCountry}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-[#f4ece8]">
              <span className="text-xs uppercase tracking-wider text-[#7f7570] font-medium">
                DEFAULT CURRENCY
              </span>
              <span className="text-sm text-[#1e1b19] text-right font-medium">
                {defaultCurrency}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-xs uppercase tracking-wider text-[#7f7570] font-medium">
                CONNECTED SINCE
              </span>
              <span className="text-sm text-[#645d58] italic text-right">
                {connectedSince}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Provisioning Status (2 cols) */}
        <div
          data-testid="provisioning-status-card"
          className="md:col-span-2 bg-[#faf6f3] border border-[#e0d8d5] rounded-xl p-6 flex flex-col justify-between"
        >
          <h3 className="text-lg font-medium text-[#1e1b19] mb-4 font-serif">
            Provisioning Status
          </h3>

          <ul className="space-y-3">
            {[
              "Account Connected",
              "Dining Payments Enabled",
              "Table Order Sync Enabled",
              "Refund Sync Enabled",
              "Daily Payout Sync Enabled",
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#1b4332]/15 text-[#1b4332] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined !text-xs font-bold">check</span>
                </div>
                <span className="text-sm text-[#1e1b19]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* What You Can Do Next */}
      <div className="w-full mb-10">
        <h3 className="text-lg font-medium text-[#1e1b19] mb-4 text-center md:text-left font-serif">
          What You Can Do Next
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            data-testid="next-action-payments"
            className="bg-white border border-[#e0d8d5] rounded-xl p-5 hover:border-[#1e1b19]/30 transition-all cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#faf2ee] flex items-center justify-center text-[#1e1b19] mb-3 group-hover:bg-[#1c1b1d] group-hover:text-white transition-colors">
              <span className="material-symbols-outlined !text-[20px]">payments</span>
            </div>
            <h4 className="text-sm font-semibold text-[#1e1b19] mb-1.5">
              Manage Payments
            </h4>
            <p className="text-xs text-[#645d58] leading-relaxed">
              View and monitor payments associated with your eligible restaurant orders.
            </p>
          </div>

          <div
            data-testid="next-action-refunds"
            className="bg-white border border-[#e0d8d5] rounded-xl p-5 hover:border-[#1e1b19]/30 transition-all cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#faf2ee] flex items-center justify-center text-[#1e1b19] mb-3 group-hover:bg-[#1c1b1d] group-hover:text-white transition-colors">
              <span className="material-symbols-outlined !text-[20px]">replay</span>
            </div>
            <h4 className="text-sm font-semibold text-[#1e1b19] mb-1.5">
              Manage Refunds
            </h4>
            <p className="text-xs text-[#645d58] leading-relaxed">
              Review and process eligible refunds through your connected Stripe account.
            </p>
          </div>

          <div
            data-testid="next-action-payouts"
            className="bg-white border border-[#e0d8d5] rounded-xl p-5 hover:border-[#1e1b19]/30 transition-all cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#faf2ee] flex items-center justify-center text-[#1e1b19] mb-3 group-hover:bg-[#1c1b1d] group-hover:text-white transition-colors">
              <span className="material-symbols-outlined !text-[20px]">account_balance</span>
            </div>
            <h4 className="text-sm font-semibold text-[#1e1b19] mb-1.5">
              Monitor Payouts
            </h4>
            <p className="text-xs text-[#645d58] leading-relaxed">
              View payout information available from Stripe directly inside Prest.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button
          type="button"
          onClick={handleDashboard}
          data-testid="btn-go-stripe-dashboard"
          className="flex-1 bg-[#1e1b19] text-white font-medium text-sm h-12 rounded-lg hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <span>Go to Stripe Dashboard</span>
          <span className="material-symbols-outlined !text-base">arrow_forward</span>
        </button>

        <button
          type="button"
          onClick={handleReturn}
          data-testid="btn-return-payment-integrations"
          className="flex-1 bg-white text-[#1e1b19] border border-[#e0d8d5] font-medium text-sm h-12 rounded-lg hover:bg-[#faf6f3] active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
        >
          Return to Payment Integrations
        </button>
      </div>
    </div>
  );

  if (embeddedInMarketplace) {
    return <div className="bg-[#fff8f5] text-[#1e1b19] min-h-[600px] w-full">{content}</div>;
  }

  return (
    <div className="bg-[#fff8f5] text-[#1e1b19] min-h-screen flex items-center justify-center selection:bg-[#ebe1da] selection:text-[#1e1b19]">
      <main className="w-full flex flex-col items-center">{content}</main>
    </div>
  );
}

