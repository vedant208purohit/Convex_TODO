import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeProcessingWithdrawalView } from "./StripeProcessingWithdrawalView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams({ amount: "2000" }),
  usePathname: () => "/marketplace/stripe/payouts/processing",
}));

describe("StripeProcessingWithdrawalView — Screen 14 Reference Parity Verification", () => {
  it("renders Screen 14 matching reference progress card, bento info grid, and PREST luxury theme", () => {
    const html = renderToStaticMarkup(
      <StripeProcessingWithdrawalView
        embeddedInMarketplace={false}
        amount={2000.0}
        onComplete={vi.fn()}
      />
    );

    // 1. Center Card & Progress State
    expect(html).toContain("Processing Your Withdrawal");
    expect(html).toContain("We&#x27;re securely sending your payout request to Stripe.");
    expect(html).toContain("This usually takes a few seconds.");

    // 2. Bento Information Grid
    expect(html).toContain("Target Account");
    expect(html).toContain("•••• 4242");
    expect(html).toContain("Est. Completion");
    expect(html).toContain("&lt; 1 min");

    // 3. Security Assurance
    expect(html).toContain("Secured by Stripe End-to-End Encryption");

    // 4. PREST Suite Topbar & Sidebar (No Blue/Purple Defx accents)
    expect(html).toContain("Prest");
    expect(html).toContain("Restaurant Suite");
    expect(html).toContain("Stripe Integration");
    expect(html).toContain("Payouts");
    expect(html).toContain("Stripe Active");
    expect(html).toContain("Secure withdrawal in progress");
  });

  it("renders embedded view cleanly inside marketplace container", () => {
    const html = renderToStaticMarkup(
      <StripeProcessingWithdrawalView
        embeddedInMarketplace={true}
        amount={4250.0}
        onComplete={vi.fn()}
      />
    );

    expect(html).toContain("Processing Your Withdrawal");
    expect(html).toContain("Target Account");
    expect(html).not.toContain("Stripe Integration");
  });
});

