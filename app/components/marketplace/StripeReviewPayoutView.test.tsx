import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeReviewPayoutView } from "./StripeReviewPayoutView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams({ amount: "2000" }),
  usePathname: () => "/marketplace/stripe/payouts/review",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Bistrot de l'Alma LLC", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeReviewPayoutView — Screen 13 Reference Parity Verification", () => {
  it("renders Screen 13 matching reference layout, details summary, and confirmation", () => {
    const html = renderToStaticMarkup(
      <StripeReviewPayoutView
        embeddedInMarketplace={false}
        amount={2000.0}
        onBack={vi.fn()}
        onConfirmPayout={vi.fn()}
      />
    );

    // 1. Breadcrumbs & Title
    expect(html).toContain("Payments");
    expect(html).toContain("Stripe Payouts");
    expect(html).toContain("Review Request");
    expect(html).toContain("Review Payout Request");
    expect(html).toContain("Please check your payout transfer details before submitting to Stripe.");

    // 2. Payout Transfer Summary Card
    expect(html).toContain("Payout Transfer Summary");
    expect(html).toContain("Secure Financial Transfer");

    // 3. Line Items
    expect(html).toContain("Payout Amount");
    expect(html).toContain("$2,000.00 USD");
    expect(html).toContain("Processing Fee");
    expect(html).toContain("$0.00");
    expect(html).toContain("Destination Bank");
    expect(html).toContain("Chase Commercial Checking (•••• 4291)");
    expect(html).toContain("Account Holder");
    expect(html).toContain("Bistrot de l&#x27;Alma LLC");
    expect(html).toContain("Estimated Arrival");
    expect(html).toContain("Tomorrow by end of business day");

    // 4. Total to Settle Box
    expect(html).toContain("Total to Settle");
    expect(html).toContain("$2,000.00");

    // 5. Checkbox & Actions
    expect(html).toContain(
      "I confirm that the payout details are correct and acknowledge that bank settlement times depend on clearing protocols."
    );
    expect(html).toContain("Confirm &amp; Submit Payout");
    expect(html).toContain("Back");

    // 6. Advisory Banner & Footer
    expect(html).toContain(
      "Payout requests submitted before 4:00 PM EST are processed on the current business day. Track progress in the Payout History table."
    );
    expect(html).toContain("Prest Financial Settlement Engine © 2025");
    expect(html).toContain("Clearing Protocol");
    expect(html).toContain("Security Disclosures");
    expect(html).toContain("Help Concierge");

    // 7. Store Outlet & Header
    expect(html).toContain("Bistrot de l&#x27;Alma — Paris VII");
    expect(html).toContain("Manage Default Regions");
  });

  it("renders embedded view cleanly inside marketplace container", () => {
    const html = renderToStaticMarkup(
      <StripeReviewPayoutView
        embeddedInMarketplace={true}
        amount={4250.0}
        onBack={vi.fn()}
      />
    );

    expect(html).toContain("Review Payout Request");
    expect(html).toContain("$4,250.00 USD");
    expect(html).not.toContain("Bistrot de l&#x27;Alma — Paris VII");
  });
});

