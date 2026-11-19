import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpayRefundsView } from "./RazorpayRefundsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/refunds",
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

describe("RazorpayRefundsView — Reference & PREST System Verification", () => {
  it("renders breadcrumbs, page title, description, and primary action buttons", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundsView embeddedInMarketplace={true} />
    );

    // Breadcrumbs
    expect(html).toContain("Installed Apps");
    expect(html).toContain("Payments");
    expect(html).toContain("Razorpay");
    expect(html).toContain("chevron_right");

    // Title & Description
    expect(html).toContain("Refunds");
    expect(html).toContain("Manage and track all customer refund requests.");

    // Primary Actions
    expect(html).toContain("Create Refund");
    expect(html).toContain("Export");
  });

  it("renders all 6 navigation tabs with Refunds marked as active", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Dashboard");
    expect(html).toContain("Transactions");
    expect(html).toContain("Refunds");
    expect(html).toContain("Settlements");
    expect(html).toContain("Health");
    expect(html).toContain("Settings");

    // Refunds tab has active bottom border styling
    expect(html).toContain('border-[#0c0a09] text-[#0c0a09]">Refunds</button>');
  });

  it("renders the three Bento summary metric cards from reference", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundsView embeddedInMarketplace={true} />
    );

    // Card 1: Total Refunds
    expect(html).toContain("Total Refunds");
    expect(html).toContain("assignment_return");

    // Card 2: Refund Amount
    expect(html).toContain("Refund Amount");
    expect(html).toContain("payments");

    // Card 3: Pending Refunds
    expect(html).toContain("Pending Refunds");
    expect(html).toContain("pending_actions");
  });

  it("renders Refund History table section with all 7 columns", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Refund History");
    expect(html).toContain("Refund ID");
    expect(html).toContain("Order ID");
    expect(html).toContain("Amount");
    expect(html).toContain("Reason");
    expect(html).toContain("Status");
    expect(html).toContain("Date");
  });

  it("renders dynamic graphical section with Refund Trends and Insight Engine", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundsView embeddedInMarketplace={true} />
    );

    // Left Bento: Refund Trends
    expect(html).toContain("Refund Trends");

    // Right Bento: Insight Engine
    expect(html).toContain("Insight Engine");
    expect(html).toContain("Webhook Reconciled");
  });

  it("renders inside PosShell when embeddedInMarketplace is false", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundsView embeddedInMarketplace={false} />
    );

    // Should include PosShell structure
    expect(html).toContain("PREST");
    expect(html).toContain("Management Suite");
  });

  it("respects PREST design system neutral palette and avoids hardcoded MerchantHub theme colors", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundsView embeddedInMarketplace={true} />
    );

    // Does NOT contain MerchantHub custom theme classes
    expect(html).not.toContain("bg-surface-container-low");
    expect(html).not.toContain("text-on-surface-variant");
    expect(html).not.toContain("bg-primary-container");
    expect(html).not.toContain("text-on-primary-container");

    // Contains PREST neutral/monochrome tokens
    expect(html).toContain("#0c0a09");
    expect(html).toContain("#78716c");
    expect(html).toContain("#e7e5e4");
  });
});
