import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeSettingsView } from "./StripeSettingsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/settings",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Le Bistro Gourmand LLC", merchantName: "Le Bistro Gourmand LLC", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeSettingsView — Screen 19 Reference Parity Verification", () => {
  it("renders Screen 19 matching reference connected account, sync status, regions, payment methods, and danger zone", () => {
    const html = renderToStaticMarkup(
      <StripeSettingsView
        embeddedInMarketplace={false}
        onBackToDashboard={vi.fn()}
        onDisconnect={vi.fn()}
      />
    );

    // 1. Breadcrumbs & Header Actions
    expect(html).toContain("Settings");
    expect(html).toContain("Payment Integrations");
    expect(html).toContain("Stripe Settings");
    expect(html).toContain("Manage your connected Stripe account and payment gateway configuration.");
    expect(html).toContain("Refresh Data");
    expect(html).toContain("Open Stripe Dashboard");

    // 2. Section A: Connected Account Card
    expect(html).toContain("Connected Account");
    expect(html).toContain("Verified merchant payment credentials");
    expect(html).toContain("Active &amp; Verified");
    expect(html).toContain("Business Name");
    expect(html).toContain("Le Bistro Gourmand LLC");
    expect(html).toContain("Stripe Account ID");
    expect(html).toContain("acct_1NZ4xX2eR...");
    expect(html).toContain("United States");
    expect(html).toContain("USD ($)");
    expect(html).toContain("Connected Since: <strong class=\"text-[#060607] font-medium\">October 24, 2023</strong>");
    expect(html).toContain("PCI-DSS Level 1 Compliant");

    // 3. Section B: Synchronization Card
    expect(html).toContain("Synchronization");
    expect(html).toContain("Webhook &amp; event listener health");
    expect(html).toContain("Last Sync");
    expect(html).toContain("Sync Frequency");
    expect(html).toContain("Real-time");
    expect(html).toContain("Webhook Status");
    expect(html).toContain("Active");

    // 4. Section C: Default Payment Gateway by Region
    expect(html).toContain("Default Payment Gateway by Region");
    expect(html).toContain("Configure which restaurant regions use Stripe as their primary payment gateway.");
    expect(html).toContain("Manage Default Regions");
    expect(html).toContain("Primary terminal routing for US dining rooms and takeout online ordering");
    expect(html).toContain("United Kingdom &amp; Europe");
    expect(html).toContain("Current Default Gateway");

    // 5. Section D: Supported Payment Methods
    expect(html).toContain("Supported Payment Methods");
    expect(html).toContain("Active payment methods currently accepted at tableside and online checkout.");
    expect(html).toContain("Visa");
    expect(html).toContain("Mastercard");
    expect(html).toContain("Apple Pay");
    expect(html).toContain("Google Pay");
    expect(html).toContain("Bank Transfer");
    expect(html).toContain("Enabled");

    // 6. Section E: Danger Zone
    expect(html).toContain("Danger Zone");
    expect(html).toContain("Disconnecting Stripe will stop new payments from being processed through this connection.");
    expect(html).toContain("Disconnect Stripe");

    // 7. PREST Suite Shell
    expect(html).toContain("Prest");
    expect(html).toContain("Restaurant Suite");
    expect(html).toContain("Bistrot de l&#x27;Alma — Main Dining");
    expect(html).toContain("Stripe Connected");
  });

  it("renders embedded view cleanly inside marketplace container", () => {
    const html = renderToStaticMarkup(
      <StripeSettingsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Stripe Settings");
    expect(html).toContain("Connected Account");
    expect(html).not.toContain("Bistrot de l&#x27;Alma — Main Dining");
  });
});

