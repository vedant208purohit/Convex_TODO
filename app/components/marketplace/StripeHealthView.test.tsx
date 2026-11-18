import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeHealthView } from "./StripeHealthView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/health",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "conn_1", provider: "stripe", providerAccountId: "acct_1PP21rfJ1n4IIGDm" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeHealthView — Screen 18 Reference Parity Verification", () => {
  it("renders Screen 18 matching reference system banner, health cards, checklist, and recent activity feed", () => {
    const html = renderToStaticMarkup(
      <StripeHealthView
        embeddedInMarketplace={false}
        onBackToDashboard={vi.fn()}
      />
    );

    // 1. Breadcrumbs & Header Actions
    expect(html).toContain("Payments");
    expect(html).toContain("Stripe Integration");
    expect(html).toContain("Health Monitoring");
    expect(html).toContain("Stripe Health");
    expect(html).toContain(
      "Monitor the live connection between Prest and Stripe to ensure table charges, guest refunds, and daily payout reconciliations operate smoothly."
    );
    expect(html).toContain("Refresh Health");
    expect(html).toContain("Open Stripe Dashboard");

    // 2. Section A: System Banner
    expect(html).toContain("No active issues. Payment system is healthy.");
    expect(html).toContain(
      "All dining rooms and mobile card readers are communicating with Stripe without delay."
    );
    expect(html).toContain("Operational");

    // 3. 4 Key Health Cards
    expect(html).toContain("Connection Status");
    expect(html).toContain("System Online");
    expect(html).toContain("Active &amp; connected to Stripe Live API");

    expect(html).toContain("API Status");
    expect(html).toContain("42ms Latency");
    expect(html).toContain("Fast response for card terminals");

    expect(html).toContain("Webhook Status");
    expect(html).toContain("Delivered");
    expect(html).toContain("100% receipt rate in last 24h");

    expect(html).toContain("Last Sync");
    expect(html).toContain("Just now");
    expect(html).toContain("Real-time webhook &amp; polling active");

    // 4. System Checklist
    expect(html).toContain("System Checklist");
    expect(html).toContain("Component validation &amp; background service status");
    expect(html).toContain("Stripe Connected");
    expect(html).toContain("API Reachable");
    expect(html).toContain("Webhooks Active");
    expect(html).toContain("Transactions Syncing");
    expect(html).toContain("Refunds Syncing");
    expect(html).toContain("Payouts Syncing");
    expect(html).toContain("All services comply with PCI DSS Level 1 encryption requirements");

    // 5. Recent Activity Feed
    expect(html).toContain("Recent Activity");
    expect(html).toContain("Live Stream");
    expect(html).toContain("Payment Synced");
    expect(html).toContain("Refund Synced");
    expect(html).toContain("Webhook Received");
    expect(html).toContain("Payout Synced");
    expect(html).toContain("Connection Health Verified");

    // 6. PREST Shell & Sidebar
    expect(html).toContain("Prest");
    expect(html).toContain("POS Suite");
    expect(html).toContain("Bistrot de l&#x27;Alma — Main Dining");
    expect(html).toContain("Henri Laurent");
    expect(html).toContain("General Manager");
  });

  it("renders embedded view cleanly inside marketplace container", () => {
    const html = renderToStaticMarkup(
      <StripeHealthView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Stripe Health");
    expect(html).toContain("System Checklist");
    expect(html).not.toContain("Henri Laurent");
  });
});

