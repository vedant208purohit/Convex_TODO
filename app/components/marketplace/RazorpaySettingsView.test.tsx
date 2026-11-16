import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpaySettingsView } from "./RazorpaySettingsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/settings",
}));

// Mock Clerk & Convex inside PosShell
vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button">UserButton</div>,
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("RazorpaySettingsView — Settings Screen Verification", () => {
  it("renders breadcrumbs, title, and subtitle", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettingsView embeddedInMarketplace={true} />
    );

    // Breadcrumbs
    expect(html).toContain("Installed Apps");
    expect(html).toContain("Payments");
    expect(html).toContain("Razorpay");
    expect(html).toContain("Settings");

    // Title and description
    expect(html).toContain("Settings");
    expect(html).toContain(
      "Manage your Razorpay account connection and payment preferences."
    );
  });

  it("renders all 6 navigation tabs with Settings active", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettingsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Dashboard");
    expect(html).toContain("Transactions");
    expect(html).toContain("Refunds");
    expect(html).toContain("Settlements");
    expect(html).toContain("Health");
    expect(html).toContain("Settings");
  });

  it("renders Connected Account section with merchant info and active badge", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettingsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Connected Account");
    expect(html).toContain("Active");
    expect(html).toContain("Merchant Name");
    expect(html).toContain("ABC Fashion Store");
    expect(html).toContain("Merchant ID");
    expect(html).toContain("RZP_458736");
    expect(html).toContain("Connected Since");
    expect(html).toContain("Platform Version");
  });

  it("renders Available Payment Methods section with all 5 payment options", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettingsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Available Payment Methods");
    expect(html).toContain("UPI");
    expect(html).toContain("Cards");
    expect(html).toContain("Wallets");
    expect(html).toContain("Net Banking");
    expect(html).toContain("EMI");
  });

  it("renders Connection Management action cards: Refresh, Reconnect, Disconnect", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettingsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Connection Management");
    expect(html).toContain("Refresh Data");
    expect(html).toContain("Fetch latest payment information from Razorpay.");
    expect(html).toContain("Reconnect Account");
    expect(html).toContain("Reconnect your Razorpay account if connection issues occur.");
    expect(html).toContain("Disconnect Account");
    expect(html).toContain("Remove Razorpay from this store.");
  });

  it("renders Data Sync and Security & Audit Protection sections in right column", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettingsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Data Sync");
    expect(html).toContain("Last Sync");
    expect(html).toContain("Sync Frequency");
    expect(html).toContain("Webhook Status");
    expect(html).toContain("Security &amp; Audit Protection");
  });

  it("renders within PosShell when embeddedInMarketplace is false", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettingsView embeddedInMarketplace={false} />
    );

    expect(html).toContain("Settings");
    expect(html).toContain("Store Branch:");
  });
});
