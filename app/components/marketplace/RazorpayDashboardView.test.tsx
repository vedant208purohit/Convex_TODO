import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpayDashboardView } from "./RazorpayDashboardView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/dashboard",
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

describe("Screen 6: RazorpayDashboardView — Reference & Dummy Data Verification", () => {
  it("renders breadcrumbs, title, and all 6 internal navigation tabs with Dashboard active", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={true} />
    );

    // Breadcrumbs
    expect(html).toContain("Installed Apps");
    expect(html).toContain("Payments");
    expect(html).toContain("Razorpay");
    expect(html).toContain("chevron_right");

    // Header
    expect(html).toContain("Razorpay Payments");
    expect(html).toContain("Gateway Active (Live Mode)");

    // Internal Tabs
    expect(html).toContain("Dashboard");
    expect(html).toContain("Transactions");
    expect(html).toContain("Refunds");
    expect(html).toContain("Settlements");
    expect(html).toContain("Health");
    expect(html).toContain("Settings");
  });

  it("renders the four summary metric cards with isolated store baseline data", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={true} />
    );

    // Card 1: Today's Revenue
    expect(html).toContain("Today&#x27;s Revenue");
    expect(html).toContain("₹0.00");
    expect(html).toContain("Real-time daily telemetry");

    // Card 2: Successful Payments
    expect(html).toContain("Successful Payments");

    // Card 3: Failed Payments
    expect(html).toContain("Failed Payments");

    // Card 4: Pending Payments
    expect(html).toContain("Pending Payments");
  });

  it("renders Payment Trends chart card with 7D, 30D, 1Y selectors and 7D daily bars", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Payment Trends");
    expect(html).toContain("7D");
    expect(html).toContain("30D");
    expect(html).toContain("1Y");

    // Daily bar labels
    expect(html).toContain("Mon");
    expect(html).toContain("Tue");
    expect(html).toContain("Wed");
    expect(html).toContain("Thu");
    expect(html).toContain("Fri");
    expect(html).toContain("Sat");
    expect(html).toContain("Sun");
  });

  it("renders Razorpay Integration Status card with live indicator and View API Credentials button", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={true} />
    );

    expect(html).toContain("INTEGRATION STATUS");
    expect(html).toContain("Razorpay is Live");
    expect(html).toContain(
      "Your API keys are active and transactions are flowing seamlessly."
    );
    expect(html).toContain("rzp_live_••••••••••••Nb0");
    expect(html).toContain("View API Credentials");
  });

  it("renders Recent Transactions table with isolated store empty state", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Recent Transactions");
    expect(html).toContain("View All Transactions");
    expect(html).toContain("No recent transactions found for this store.");
  });

  it("renders distinguishable status badges without colored backgrounds", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Success");
    expect(html).toContain("Failed");
    expect(html).toContain("Pending");

    // Strictly monochrome neutral styling
    expect(html).not.toContain("bg-red-");
    expect(html).not.toContain("bg-green-");
    expect(html).not.toContain("bg-orange-");
  });

  it("strictly avoids colored MerchantHub blue and green palettes", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={true} />
    );

    expect(html).not.toContain("bg-[#005faf]");
    expect(html).not.toContain("bg-[#006c49]");
    expect(html).not.toContain("text-primary");
    expect(html).not.toContain("bg-primary-container");
  });

  it("renders within PosShell when embeddedInMarketplace is false", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={false} />
    );

    expect(html).toContain("Marketplace");
    expect(html).toContain("Razorpay Payments");
  });

  it("renders internal navigation tabs including Transactions, Refunds, and Settlements", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Transactions");
    expect(html).toContain("Refunds");
    expect(html).toContain("Settlements");
    expect(html).toContain("Health");
    expect(html).toContain("Settings");
  });
});

