import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeWithdrawalSuccessView } from "./StripeWithdrawalSuccessView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams({ amount: "2000" }),
  usePathname: () => "/marketplace/stripe/payouts/success",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Bistrot de l'Alma — Main Dining Room", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeWithdrawalSuccessView — Screen 15 Reference Parity Verification", () => {
  it("renders Screen 15 matching reference layout, requested amount, destination, and quick actions", () => {
    const html = renderToStaticMarkup(
      <StripeWithdrawalSuccessView
        embeddedInMarketplace={false}
        amount={2000.0}
        payoutId="PO_238912"
        onViewHistory={vi.fn()}
        onBackToDashboard={vi.fn()}
        onViewDetails={vi.fn()}
      />
    );

    // 1. Left Hero Banner (PREST Warm Palette)
    expect(html).toContain("Withdrawal Successful");
    expect(html).toContain("Payout transmission to Stripe Banking Infrastructure initiated.");

    // 2. Right Info Panel
    expect(html).toContain("Requested Amount");
    expect(html).toContain("$2,000.00");
    expect(html).toContain("Processing");

    // 3. Grid Metadata
    expect(html).toContain("Destination");
    expect(html).toContain("HDFC / Chase");
    expect(html).toContain("Settlement Account •••• 4242");

    expect(html).toContain("Estimated Arrival");
    expect(html).toContain("Tomorrow");
    expect(html).toContain("By 5:00 PM EST");

    expect(html).toContain("Reference ID");
    expect(html).toContain("PO_238912");

    expect(html).toContain("Status Updates");
    expect(html).toContain("Sent to email address");

    // 4. Quick Actions
    expect(html).toContain("View Payout History");
    expect(html).toContain("Download Receipt");
    expect(html).toContain("Back to Dashboard");

    // 5. Footer Advisory
    expect(html).toContain("Funds are typically available within 24 hours depending on your bank&#x27;s processing times.");
    expect(html).toContain("Help Center");

    // 6. PREST Suite Shell
    expect(html).toContain("Prest");
    expect(html).toContain("Restaurant Suite");
    expect(html).toContain("Stripe Integration");
  });

  it("renders embedded view cleanly inside marketplace container", () => {
    const html = renderToStaticMarkup(
      <StripeWithdrawalSuccessView
        embeddedInMarketplace={true}
        amount={4250.0}
        payoutId="PO_999888"
      />
    );

    expect(html).toContain("Withdrawal Successful");
    expect(html).toContain("$4,250.00");
    expect(html).toContain("PO_999888");
    expect(html).not.toContain("Stripe Integration");
  });
});

