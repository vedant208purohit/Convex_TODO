import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpaySuccessView, RazorpayConnectionResult } from "./RazorpaySuccessView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/success",
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

describe("Screen 5: RazorpaySuccessView — Reference & Data-Driven Verification", () => {
  const mockResultOAuth: RazorpayConnectionResult = {
    merchantName: "Trattoria Milano",
    merchantId: "MID_998877",
    accountMode: "live",
    connectedAt: "Nov 3, 2026",
    connectionMethod: "oauth",
    capabilities: [
      { id: "account_connected", title: "Account Connected", enabled: true },
      { id: "payments_enabled", title: "Payments Enabled", enabled: true },
      { id: "transaction_sync", title: "Transaction Sync Enabled", enabled: true },
      {
        id: "settlement_tracking",
        title: "Settlement Tracking Enabled",
        enabled: false,
        statusLabel: "Pending RBI Verification",
      },
    ],
  };

  const mockResultApiKeys: RazorpayConnectionResult = {
    merchantName: "Bangalore Bistro",
    merchantId: "MID_API_1122",
    accountMode: "test",
    connectedAt: "Nov 2, 2026",
    connectionMethod: "api_keys",
    capabilities: [
      { id: "account_connected", title: "Account Connected", enabled: true },
      { id: "payments_enabled", title: "Payments Enabled", enabled: false, statusLabel: "Test Mode" },
      { id: "transaction_sync", title: "Transaction Sync Enabled", enabled: false, statusLabel: "Disabled" },
      { id: "settlement_tracking", title: "Settlement Tracking Enabled", enabled: false, statusLabel: "Disabled" },
    ],
  };

  it("renders success hero section with animated checkmark and PREST adapted title and subtitle", () => {
    const html = renderToStaticMarkup(
      <RazorpaySuccessView embeddedInMarketplace={true} connectionResult={mockResultOAuth} />
    );

    // Hero Checkmark
    expect(html).toContain("check_circle");
    expect(html).toContain("success-hero-checkmark");

    // Title & Subtitle
    expect(html).toContain("Razorpay Connected Successfully");
    expect(html).toContain(
      "Your merchant account is now successfully integrated with PREST."
    );
  });

  it("renders data-driven merchant details grid with custom merchant data and live account mode", () => {
    const html = renderToStaticMarkup(
      <RazorpaySuccessView embeddedInMarketplace={true} connectionResult={mockResultOAuth} />
    );

    expect(html).toContain("Trattoria Milano");
    expect(html).toContain("MID_998877");
    expect(html).toContain("live");
    expect(html).toContain("Nov 3, 2026");
  });

  it("renders test account mode correctly", () => {
    const html = renderToStaticMarkup(
      <RazorpaySuccessView embeddedInMarketplace={true} connectionResult={mockResultApiKeys} />
    );

    expect(html).toContain("Bangalore Bistro");
    expect(html).toContain("MID_API_1122");
    expect(html).toContain("test");
    expect(html).toContain("Nov 2, 2026");
  });

  it("accurately reflects individual capability states and pending labels instead of faking all enabled", () => {
    const html = renderToStaticMarkup(
      <RazorpaySuccessView embeddedInMarketplace={true} connectionResult={mockResultOAuth} />
    );

    expect(html).toContain("Next Steps Enabled");
    expect(html).toContain("Account Connected");
    expect(html).toContain("Payments Enabled");
    expect(html).toContain("Transaction Sync Enabled");
    expect(html).toContain("Settlement Tracking Enabled");
    expect(html).toContain("Pending RBI Verification");
  });

  it("renders accurate connection method trust indicator for OAuth", () => {
    const html = renderToStaticMarkup(
      <RazorpaySuccessView embeddedInMarketplace={true} connectionResult={mockResultOAuth} />
    );

    expect(html).toContain("Secure Integration via Razorpay OAuth 2.0");
    expect(html).toContain("verified_user");
  });

  it("renders accurate connection method trust indicator for API Keys without falsely claiming OAuth", () => {
    const html = renderToStaticMarkup(
      <RazorpaySuccessView embeddedInMarketplace={true} connectionResult={mockResultApiKeys} />
    );

    expect(html).toContain("Secure Integration via Razorpay API Keys");
    expect(html).not.toContain("Secure Integration via Razorpay OAuth 2.0");
  });

  it("renders primary Go To Dashboard and secondary Return To Marketplace action buttons with correct styling", () => {
    const html = renderToStaticMarkup(
      <RazorpaySuccessView embeddedInMarketplace={true} connectionResult={mockResultOAuth} />
    );

    expect(html).toContain("Go To Dashboard");
    expect(html).toContain("Return To Marketplace");
    expect(html).toContain("bg-[#0c0a09]");
    expect(html).toContain("text-white");
    expect(html).toContain("bg-white");
  });

  it("strictly avoids colored MerchantHub blue and green palettes", () => {
    const html = renderToStaticMarkup(
      <RazorpaySuccessView embeddedInMarketplace={true} connectionResult={mockResultOAuth} />
    );

    expect(html).not.toContain("bg-[#005faf]");
    expect(html).not.toContain("bg-[#006c49]");
    expect(html).not.toContain("text-primary");
    expect(html).not.toContain("text-secondary");
    expect(html).not.toContain("bg-primary-container");
    expect(html).not.toContain("bg-secondary-container");
  });

  it("renders within PosShell when embeddedInMarketplace is false", () => {
    const html = renderToStaticMarkup(
      <RazorpaySuccessView embeddedInMarketplace={false} connectionResult={mockResultOAuth} />
    );

    expect(html).toContain("Marketplace");
    expect(html).toContain("Razorpay Connected Successfully");
  });
});

