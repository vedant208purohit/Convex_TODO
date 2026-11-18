import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeRequestPayoutView } from "./StripeRequestPayoutView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/payouts/request",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Bistrot de l'Alma — Main Dining Room", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeRequestPayoutView — Screen 12 Reference Parity Verification", () => {
  it("renders Screen 12 matching reference balance cards, withdrawal configuration, and destination account", () => {
    const html = renderToStaticMarkup(
      <StripeRequestPayoutView
        embeddedInMarketplace={false}
        onBackToPayouts={vi.fn()}
      />
    );

    // 1. Header & Eyebrow
    expect(html).toContain("Treasury Operations / Standard Transfer");
    expect(html).toContain("Request Payout");
    expect(html).toContain(
      "Request an eligible payout from your Stripe account to your linked bank account."
    );
    expect(html).toContain("Operational Balance Normal");

    // 2. 4 Balance & Metric Cards
    expect(html).toContain("Available For Payout");
    expect(html).toContain("$4,250.00");
    expect(html).toContain("Ready to transfer");

    expect(html).toContain("Pending Balance");
    expect(html).toContain("$680.00");
    expect(html).toContain("Clears in 2 business days");

    expect(html).toContain("Standard Payout Schedule");
    expect(html).toContain("Automatic Daily");
    expect(html).toContain("Standard cadence active");

    expect(html).toContain("Payout Speed");
    expect(html).toContain("1–2 Business Days");
    expect(html).toContain("Standard ACH / SEPA processing");

    // 3. Withdrawal Configuration Card
    expect(html).toContain("Withdrawal Configuration");
    expect(html).toContain("Step 1 of 2");
    expect(html).toContain("Define your requested allocation and review settlement destination.");

    // 4. Payout Amount Options
    expect(html).toContain("Payout Amount Option");
    expect(html).toContain("Currency: <strong class=\"text-neutral-800\">USD ($)</strong>");
    expect(html).toContain("Withdraw Full Balance");
    expect(html).toContain("Transfer entire available reserve");
    expect(html).toContain("Custom Amount");
    expect(html).toContain("Specify an exact allocation");
    expect(html).toContain(
      "Maximum payout amount is restricted to your available Stripe balance ($4,250.00)."
    );

    // 5. Destination Bank Account
    expect(html).toContain("Destination Bank Account");
    expect(html).toContain("Manage Accounts");
    expect(html).toContain("Chase Commercial Banking ending in •••• 4921");
    expect(html).toContain("Primary Payout Account");
    expect(html).toContain("Routing / Transit verified");
    expect(html).toContain("Business Checking (USD)");

    // 6. Settlement Summary Breakdown
    expect(html).toContain("Settlement Summary Breakdown");
    expect(html).toContain("Requested Payout");
    expect(html).toContain("Transfer Fee");
    expect(html).toContain("$0.00 <span class=\"text-neutral-400 font-sans\">(Standard bank transfer)</span>");
    expect(html).toContain("Net Settlement");
    expect(html).toContain("Funds deposited directly into Chase account");

    // 7. Action Buttons
    expect(html).toContain("Cancel");
    expect(html).toContain("Continue to Review");

    // 8. Footer & Compliance Notes
    expect(html).toContain("Payouts are processed through Stripe financial infrastructure and subject to bank clearing schedules.");
    expect(html).toContain("Stripe Service Terms");
    expect(html).toContain("Payout Disclosure Policy");
    expect(html).toContain("Banking Security SLA");

    // 9. Sidebar and Navigation
    expect(html).toContain("The Grand Dining Room &amp; Bar (Main Outlet)");
    expect(html).toContain("Claire St. Laurent");
    expect(html).toContain("Head of Treasury");
    expect(html).toContain("Payout Request");
    expect(html).toContain("Stripe Financial Live");
  });

  it("renders embedded view properly when inside MarketplaceView container", () => {
    const html = renderToStaticMarkup(
      <StripeRequestPayoutView
        embeddedInMarketplace={true}
        onBackToPayouts={vi.fn()}
      />
    );

    expect(html).toContain("Request Payout");
    expect(html).toContain("Withdrawal Configuration");
    expect(html).not.toContain("The Grand Dining Room &amp; Bar (Main Outlet)");
  });
});

