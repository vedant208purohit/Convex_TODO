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

  it("renders the four summary metric cards with exact reference dummy data", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={true} />
    );

    // Card 1: Today's Revenue
    expect(html).toContain("Today&#x27;s Revenue");
    expect(html).toContain("₹15,000");
    expect(html).toContain("+12% from yesterday");

    // Card 2: Successful Payments
    expect(html).toContain("Successful Payments");
    expect(html).toContain("120");
    expect(html).toContain("98.2% Success Rate");

    // Card 3: Failed Payments
    expect(html).toContain("Failed Payments");
    expect(html).toContain("5");
    expect(html).toContain("Avg. 1.2% failure rate");

    // Card 4: Pending Payments
    expect(html).toContain("Pending Payments");
    expect(html).toContain("3");
    expect(html).toContain("Awaiting confirmation");
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

  it("renders Recent Transactions table with all 4 sample records", () => {
    const html = renderToStaticMarkup(
      <RazorpayDashboardView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Recent Transactions");
    expect(html).toContain("View All Transactions");

    // Record 1
    expect(html).toContain("pay_N9S2J8...");
    expect(html).toContain("₹1,200.00");
    expect(html).toContain("amit.verma@email.com");
    expect(html).toContain("UPI");
    expect(html).toContain("Today, 14:22");

    // Record 2
    expect(html).toContain("pay_M8K3L1...");
    expect(html).toContain("₹3,450.00");
    expect(html).toContain("sarah.j@outlook.com");
    expect(html).toContain("Net Banking");
    expect(html).toContain("Today, 13:45");

    // Record 3
    expect(html).toContain("pay_K2J4H9...");
    expect(html).toContain("₹850.00");
    expect(html).toContain("priya.rao@gmail.com");
    expect(html).toContain("Card");
    expect(html).toContain("Today, 12:10");

    // Record 4
    expect(html).toContain("pay_P5M0Q3...");
    expect(html).toContain("₹2,100.00");
    expect(html).toContain("rahul.khanna@biz.in");
    expect(html).toContain("Today, 11:30");
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

