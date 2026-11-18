import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripePayoutsView } from "./StripePayoutsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/payouts",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Bistrot de l'Alma — Main Dining Room", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripePayoutsView — Screen 11 Reference Parity Verification", () => {
  it("renders Screen 11 matching reference layout, schedule, and live metrics", () => {
    const html = renderToStaticMarkup(
      <StripePayoutsView
        embeddedInMarketplace={false}
        onRequestPayout={vi.fn()}
        onBackToDashboard={vi.fn()}
      />
    );

    // 1. Header & Section Identifiers
    expect(html).toContain("Stripe Payouts");
    expect(html).toContain("Payments &amp; Banking");
    expect(html).toContain("Live Payout Schedule");
    expect(html).toContain(
      "Track money transferred or scheduled to be transferred from your Stripe account to your linked bank account."
    );
    expect(html).toContain("Export CSV");
    expect(html).toContain("Withdraw / Request Payout");

    // 2. Info Notice Banner
    expect(html).toContain(
      "These records show transfers made from your Stripe account to your registered bank account. They are separate from customer order refunds."
    );

    // 3. Metric Cards (3 Cards matching reference)
    expect(html).toContain("Today&#x27;s Payout");
    expect(html).toContain("$1,240.00");
    expect(html).toContain("Estimated settlement by 5:00 PM");

    expect(html).toContain("Monthly Payout Volume");
    expect(html).toContain("$42,850.20");
    expect(html).toContain("+5.4% vs last month");
    expect(html).toContain("Total cleared volume in current cycle");

    expect(html).toContain("Upcoming Scheduled Payout");
    expect(html).toContain("$8,120.45");
    expect(html).toContain("Expected Oct 30, 2023");

    // 4. Recent Payout History Table & Records
    expect(html).toContain("Recent Payout History");
    expect(html).toContain("Automated and manual disbursements to linked treasury accounts.");
    expect(html).toContain("#po_1456");
    expect(html).toContain("$1,850.00");
    expect(html).toContain("Paid");
    expect(html).toContain("Chase Business Checking •••• 6789");

    expect(html).toContain("#po_1455");
    expect(html).toContain("$3,120.50");
    expect(html).toContain("In Transit");
    expect(html).toContain("Wells Fargo Commercial •••• 1122");

    expect(html).toContain("#po_1454");
    expect(html).toContain("$940.00");
    expect(html).toContain("Pending");

    expect(html).toContain("#po_1453");
    expect(html).toContain("$12,400.00");

    // 5. Left Sidebar & Connected Status
    expect(html).toContain("Settlement Ledger");
    expect(html).toContain("Terminal Transactions");
    expect(html).toContain("Tax &amp; Service Charges");
    expect(html).toContain("Disputes &amp; Holds");
    expect(html).toContain("Stripe Connect Active");

    // 6. Outlet Selector & Top Navigation
    expect(html).toContain("SoHo Flagship — Main Dining");
    expect(html).toContain("Manage Default Regions");
  });

  it("renders properly when embedded inside MarketplaceView container", () => {
    const html = renderToStaticMarkup(
      <StripePayoutsView
        embeddedInMarketplace={true}
        onRequestPayout={vi.fn()}
      />
    );

    expect(html).toContain("Stripe Payouts");
    expect(html).toContain("Withdraw / Request Payout");
    // Standalone top nav should be omitted when embedded
    expect(html).not.toContain("SoHo Flagship — Main Dining");
  });
});

