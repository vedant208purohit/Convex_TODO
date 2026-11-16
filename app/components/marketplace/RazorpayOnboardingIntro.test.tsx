import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpayOnboardingIntro } from "./RazorpayOnboardingIntro";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/onboarding",
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

describe("Screen 4B: RazorpayOnboardingIntro — Reference Verification", () => {
  it("renders breadcrumbs, badge, heading, and subtitle matching reference", () => {
    const html = renderToStaticMarkup(
      <RazorpayOnboardingIntro embeddedInMarketplace={true} />
    );

    // Breadcrumbs
    expect(html).toContain("Marketplace");
    expect(html).toContain("Payment Providers");
    expect(html).toContain("Razorpay Setup");
    expect(html).toContain("Onboarding");
    expect(html).toContain("chevron_right");

    // Indicator & Headings
    expect(html).toContain("Onboarding Phase 1");
    expect(html).toContain("Create Or Connect Razorpay");
    expect(html).toContain(
      "Don&#x27;t have a Razorpay account yet? We&#x27;ll guide you through account creation and connection to unlock seamless payment processing for your business."
    );
  });

  it("renders all four vertically arranged feature highlights with exact titles and descriptions", () => {
    const html = renderToStaticMarkup(
      <RazorpayOnboardingIntro embeddedInMarketplace={true} />
    );

    // Feature 1
    expect(html).toContain("Accept UPI");
    expect(html).toContain(
      "Enable instant UPI transfers from all major apps."
    );
    expect(html).toContain("payments");

    // Feature 2
    expect(html).toContain("Accept Cards");
    expect(html).toContain(
      "Process Visa, Mastercard, and Rupay credit/debit cards."
    );
    expect(html).toContain("credit_card");

    // Feature 3
    expect(html).toContain("Receive Settlements");
    expect(html).toContain(
      "Direct settlements to your verified bank account."
    );
    expect(html).toContain("account_balance_wallet");

    // Feature 4
    expect(html).toContain("Track Payments");
    expect(html).toContain(
      "Real-time reconciliation through the Defx dashboard."
    );
    expect(html).toContain("monitoring");
  });

  it("renders primary action button with exact copy and black button styling", () => {
    const html = renderToStaticMarkup(
      <RazorpayOnboardingIntro embeddedInMarketplace={true} />
    );

    expect(html).toContain("Continue With Razorpay");
    expect(html).toContain("arrow_forward");
    expect(html).toContain("bg-[#0c0a09]");
    expect(html).toContain("text-white");
  });

  it("renders trust footer with certification badges and exact security text", () => {
    const html = renderToStaticMarkup(
      <RazorpayOnboardingIntro embeddedInMarketplace={true} />
    );

    expect(html).toContain("PCI DSS Level 1");
    expect(html).toContain("ISO 27001 Certified");
    expect(html).toContain("lock");
    expect(html).toContain(
      "Your financial data is encrypted and handled securely by Razorpay."
    );
  });

  it("strictly avoids colored MerchantHub blue and green palettes", () => {
    const html = renderToStaticMarkup(
      <RazorpayOnboardingIntro embeddedInMarketplace={true} />
    );

    // Verify absence of MerchantHub colors
    expect(html).not.toContain("bg-[#005faf]");
    expect(html).not.toContain("bg-[#006c49]");
    expect(html).not.toContain("text-primary");
    expect(html).not.toContain("text-secondary");
    expect(html).not.toContain("bg-primary-fixed");
    expect(html).not.toContain("bg-secondary-container");
  });

  it("renders within PosShell when embeddedInMarketplace is false", () => {
    const html = renderToStaticMarkup(
      <RazorpayOnboardingIntro embeddedInMarketplace={false} />
    );

    expect(html).toContain("Marketplace");
    expect(html).toContain("Create Or Connect Razorpay");
  });
});

