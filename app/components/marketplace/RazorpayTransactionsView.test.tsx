import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpayTransactionsView } from "./RazorpayTransactionsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/transactions",
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

describe("RazorpayTransactionsView — Reference & PREST System Verification", () => {
  it("renders breadcrumbs, page title, description, and Export button", () => {
    const html = renderToStaticMarkup(
      <RazorpayTransactionsView embeddedInMarketplace={true} />
    );

    // Breadcrumbs
    expect(html).toContain("Installed Apps");
    expect(html).toContain("Payments");
    expect(html).toContain("Razorpay");
    expect(html).toContain("chevron_right");

    // Title & Description
    expect(html).toContain("Transactions");
    expect(html).toContain("Monitor and manage all merchant-level payments.");

    // Primary Action
    expect(html).toContain("Export");
    expect(html).toContain("download");
  });

  it("renders all 6 navigation tabs with Transactions marked as active", () => {
    const html = renderToStaticMarkup(
      <RazorpayTransactionsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Dashboard");
    expect(html).toContain("Transactions");
    expect(html).toContain("Refunds");
    expect(html).toContain("Settlements");
    expect(html).toContain("Health");
    expect(html).toContain("Settings");

    // Transactions has active bottom border styling
    expect(html).toContain('border-[#0c0a09] text-[#0c0a09]">Transactions</button>');
  });

  it("renders the four summary metric cards from reference", () => {
    const html = renderToStaticMarkup(
      <RazorpayTransactionsView embeddedInMarketplace={true} />
    );

    // Card 1: Total Transactions
    expect(html).toContain("Total Transactions");
    expect(html).toContain("payments");

    // Card 2: Successful
    expect(html).toContain("Successful");
    expect(html).toContain("check_circle");

    // Card 3: Failed
    expect(html).toContain("Failed");
    expect(html).toContain("error");

    // Card 4: Pending
    expect(html).toContain("Pending");
    expect(html).toContain("pending");
  });

  it("renders filters bar with date range, status, payment method, and search controls", () => {
    const html = renderToStaticMarkup(
      <RazorpayTransactionsView embeddedInMarketplace={true} />
    );

    // Date Range options
    expect(html).toContain("Last 30 Days");
    expect(html).toContain("Last 7 Days");
    expect(html).toContain("Last 24 Hours");
    expect(html).toContain("Custom Range");

    // Status options
    expect(html).toContain("All Status");
    expect(html).toContain("Paid / Captured");
    expect(html).toContain("Failed");
    expect(html).toContain("Pending / Authorized");
    expect(html).toContain("Refunded");
    expect(html).toContain("Partially Refunded");

    // Payment Method options
    expect(html).toContain("Payment Method");
    expect(html).toContain("UPI");
    expect(html).toContain("Card");
    expect(html).toContain("Netbanking");
    expect(html).toContain("Wallet");

    // Search input
    expect(html).toContain('placeholder="Search by Payment ID, customer..."');
  });

  it("renders transaction table header with all 7 columns", () => {
    const html = renderToStaticMarkup(
      <RazorpayTransactionsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Transaction ID");
    expect(html).toContain("Customer");
    expect(html).toContain("Amount");
    expect(html).toContain("Payment Method");
    expect(html).toContain("Status");
    expect(html).toContain("Date");
    expect(html).toContain("Actions");
  });

  it("renders inside PosShell when embeddedInMarketplace is false", () => {
    const html = renderToStaticMarkup(
      <RazorpayTransactionsView embeddedInMarketplace={false} />
    );

    // PosShell renders navigation and header
    expect(html).toContain("Transactions");
    expect(html).toContain("Monitor and manage all merchant-level payments.");
  });

  it("respects PREST design system neutral palette and avoids hardcoded MerchantHub theme colors", () => {
    const html = renderToStaticMarkup(
      <RazorpayTransactionsView embeddedInMarketplace={true} />
    );

    // Should NOT contain MerchantHub custom brand palette classes
    expect(html).not.toContain("bg-primary-container");
    expect(html).not.toContain("text-primary-container");
    expect(html).not.toContain("bg-surface-container-high");
    expect(html).not.toContain("font-headline-md");
  });
});
