import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpayRefundDetailsView } from "./RazorpayRefundDetailsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/refunds/RF_903412",
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

describe("RazorpayRefundDetailsView — Reference & PREST System Verification", () => {
  it("renders breadcrumbs leading from Installed Apps down to Refunds", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundDetailsView refundId="RF_903412" embeddedInMarketplace={true} />
    );

    // Breadcrumbs
    expect(html).toContain("Installed Apps");
    expect(html).toContain("Payments");
    expect(html).toContain("Razorpay");
    expect(html).toContain("Refunds");
    expect(html).toContain("chevron_right");
  });

  it("renders initial loading state with accessible status message", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundDetailsView refundId="RF_903412" embeddedInMarketplace={true} />
    );

    expect(html).toContain("Loading Refund Details...");
    expect(html).toContain("Retrieving payment reconciliation and gateway logs.");
  });

  it("renders standalone page wrapped inside PosShell with PREST brand hierarchy", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundDetailsView refundId="RF_903412" embeddedInMarketplace={false} />
    );

    // Should include PosShell branding
    expect(html).toContain("PREST");
    expect(html).toContain("Management Suite");
    expect(html).toContain("Refund Details");
  });

  it("contains print stylesheet markup with all mandatory receipt audit fields", () => {
    const html = renderToStaticMarkup(
      <RazorpayRefundDetailsView refundId="RF_903412" embeddedInMarketplace={true} />
    );

    expect(html).toContain("PREST POS — REFUND RECEIPT");
    expect(html).toContain("REFUND ID");
    expect(html).toContain("RAZORPAY PAYMENT ID");
    expect(html).toContain("ORDER REFERENCE");
    expect(html).toContain("CUSTOMER");
    expect(html).toContain("Original Transaction Amount");
    expect(html).toContain("Refund Amount");
    expect(html).toContain("Remaining Balance");
    expect(html).toContain("PCI DSS Compliant");
  });
});

