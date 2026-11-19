import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpaySettlementRequestFlow } from "./RazorpaySettlementRequestFlow";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/settlements/request",
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

describe("RazorpaySettlementRequestFlow — 2-Screen Reference & PREST System Verification", () => {
  describe("Screen 1: Request Settlement", () => {
    it("renders page title, description, and breadcrumbs", () => {
      const html = renderToStaticMarkup(
        <RazorpaySettlementRequestFlow initialStep={1} embeddedInMarketplace={true} />
      );

      // Breadcrumbs
      expect(html).toContain("Installed Apps");
      expect(html).toContain("Payments");
      expect(html).toContain("Razorpay");
      expect(html).toContain("Settlements");
      expect(html).toContain("Request Settlement");

      // Title & Subtitle
      expect(html).toContain("Request Settlement");
      expect(html).toContain("Request an eligible settlement from your available Razorpay balance.");
    });

    it("renders Available for Settlement card and Settlement timing card", () => {
      const html = renderToStaticMarkup(
        <RazorpaySettlementRequestFlow initialStep={1} embeddedInMarketplace={true} />
      );

      expect(html).toContain("Available for Settlement");
      expect(html).toContain("Settlement timing");
      expect(html).toContain(
        "The requested amount will be credited to your bank account based on your current Razorpay settlement configuration"
      );
    });

    it("renders settlement amount input with helper text and non-editable account destination", () => {
      const html = renderToStaticMarkup(
        <RazorpaySettlementRequestFlow initialStep={1} embeddedInMarketplace={true} />
      );

      expect(html).toContain("Settlement Amount");
      expect(html).toContain("Enter an amount within your available settlement limit.");
      expect(html).toContain("Settlement Account");
      expect(html).toContain("Default Account");
      expect(html).toContain("lock"); // lock icon indicating non-editable destination
    });

    it("renders Cancel and Continue action buttons", () => {
      const html = renderToStaticMarkup(
        <RazorpaySettlementRequestFlow initialStep={1} embeddedInMarketplace={true} />
      );

      expect(html).toContain("Cancel");
      expect(html).toContain("Continue");
    });
  });

  describe("Screen 2: Review Settlement", () => {
    it("renders Review Settlement header and 4-row review card", () => {
      const html = renderToStaticMarkup(
        <RazorpaySettlementRequestFlow initialStep={2} embeddedInMarketplace={true} />
      );

      // Header
      expect(html).toContain("Review Settlement");
      expect(html).toContain("Review the settlement details before submitting your request.");

      // 4 Review Rows
      expect(html).toContain("Settlement Amount");
      expect(html).toContain("Settlement Account");
      expect(html).toContain("Currency");
      expect(html).toContain("Available Balance");
    });

    it("renders information banner and footer action buttons (Back & Request Settlement)", () => {
      const html = renderToStaticMarkup(
        <RazorpaySettlementRequestFlow initialStep={2} embeddedInMarketplace={true} />
      );

      expect(html).toContain(
        "Settlement processing and timing are subject to your Razorpay account configuration and eligibility."
      );
      expect(html).toContain("Back");
      expect(html).toContain("Request Settlement");
    });

    it("wraps inside PosShell with PREST branding when embeddedInMarketplace is false", () => {
      const html = renderToStaticMarkup(
        <RazorpaySettlementRequestFlow initialStep={2} embeddedInMarketplace={false} />
      );

      expect(html).toContain("PREST");
      expect(html).toContain("Management Suite");
      expect(html).toContain("Settlements");
    });
  });
});

