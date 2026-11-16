import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpaySettlementsView } from "./RazorpaySettlementsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/settlements",
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

describe("RazorpaySettlementsView — Reference & PREST System Verification", () => {
  it("renders breadcrumbs, page title, subtitle, and primary action buttons", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementsView embeddedInMarketplace={true} />
    );

    // Breadcrumbs
    expect(html).toContain("Installed Apps");
    expect(html).toContain("Payments");
    expect(html).toContain("Razorpay");
    expect(html).toContain("Settlements");

    // Title & Subtitle
    expect(html).toContain("Settlements");
    expect(html).toContain("Manage your payout history and upcoming transfers");

    // Actions
    expect(html).toContain("Request Settlement");
    expect(html).toContain("Export Statement");
  });

  it("renders all 6 navigation tabs with Settlements active", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Dashboard");
    expect(html).toContain("Transactions");
    expect(html).toContain("Refunds");
    expect(html).toContain("Settlements");
    expect(html).toContain("Health");
    expect(html).toContain("Settings");
  });

  it("renders the 3 top Bento summary metric cards", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Today&#x27;s Settlement");
    expect(html).toContain("Monthly Settlement");
    expect(html).toContain("Next Settlement");
  });

  it("renders past settlements table with all 6 required columns", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Past Settlements");
    expect(html).toContain("Settlement ID");
    expect(html).toContain("Amount");
    expect(html).toContain("Status");
    expect(html).toContain("Transfer Date");
    expect(html).toContain("Bank Account");
    expect(html).toContain("Action");
  });

  it("renders the Settlement Destination card and Need Help card", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Settlement Destination");
    expect(html).toContain("HDFC Bank Primary Current A/C");
    expect(html).toContain("Account ending in •••• 9821");
    expect(html).toContain("VERIFIED");
    expect(html).toContain("Need help with a settlement?");
    expect(html).toContain("View FAQs");
    expect(html).toContain("Contact Support");
  });

  it("renders standalone route wrapped in PosShell with PREST brand elements", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementsView embeddedInMarketplace={false} />
    );

    expect(html).toContain("PREST");
    expect(html).toContain("Management Suite");
    expect(html).toContain("Settlements");
  });
});

