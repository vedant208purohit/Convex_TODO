import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripePayoutDetailsView } from "./StripePayoutDetailsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams({ id: "PO_238912", amount: "2000" }),
  usePathname: () => "/marketplace/stripe/payouts/details",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Bistrot de l'Alma — Main Dining Room", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripePayoutDetailsView — Screen 16 Reference Parity Verification", () => {
  it("renders Screen 16 matching reference Bento layout, timeline, additional details, and PREST shell", () => {
    const html = renderToStaticMarkup(
      <StripePayoutDetailsView
        embeddedInMarketplace={false}
        payoutId="#PO_238912"
        amount={2000.0}
        onBack={vi.fn()}
      />
    );

    // 1. Breadcrumb & Header
    expect(html).toContain("Payments &amp; Banking");
    expect(html).toContain("Stripe Payouts");
    expect(html).toContain("#PO_238912");
    expect(html).toContain("Payout Details");
    expect(html).toContain(
      "View the details of funds transferred from your Stripe account to your registered commercial bank account."
    );
    expect(html).toContain("Download Receipt");
    expect(html).toContain("View in Stripe");

    // 2. Primary Summary Card (Span 8)
    expect(html).toContain("Total Payout Amount");
    expect(html).toContain("$2,000.00");
    expect(html).toContain("Processing");
    expect(html).toContain("Created Date");
    expect(html).toContain("Oct 24, 2023");
    expect(html).toContain("Est. Arrival");
    expect(html).toContain("Oct 25, 2023");
    expect(html).toContain("On schedule");
    expect(html).toContain("Destination");
    expect(html).toContain("Chase Comm.");
    expect(html).toContain("Checking");
    expect(html).toContain("Account");
    expect(html).toContain("•••• 4582");
    expect(html).toContain("Verified");

    // 3. Stripe Reference Callout (Span 4)
    expect(html).toContain("Stripe Reference");
    expect(html).toContain("Ref-8239");
    expect(html).toContain("Transfer initiated automatically via daily revenue sweep for Bistrot de l&#x27;Alma.");
    expect(html).toContain(
      "Funds are credited within 1–2 business days depending on Chase Commercial settlement cutoff times."
    );

    // 4. Payout Timeline Card (Span 12)
    expect(html).toContain("Payout Timeline");
    expect(html).toContain("Real-time status updates from Stripe Banking Infrastructure");
    expect(html).toContain("Payout Requested");
    expect(html).toContain("In Progress");
    expect(html).toContain("Sent to Bank");
    expect(html).toContain("Completed");

    // 5. Additional Details Card (Span 12)
    expect(html).toContain("Additional Details");
    expect(html).toContain("Stripe Payout Protocol v2");
    expect(html).toContain("Currency");
    expect(html).toContain("USD ($)");
    expect(html).toContain("Payout Type");
    expect(html).toContain("Standard Daily Batch Sweep");
    expect(html).toContain("Processing Fee");
    expect(html).toContain("$0.00");
    expect(html).toContain("(Included in plan)");
    expect(html).toContain("Bank Reference Code");
    expect(html).toContain("BNK-8921-X2");
    expect(html).toContain("Net Settlement Amount");
    expect(html).toContain("Credited directly to Chase Commercial Checking Account");

    // 6. Security & Frequency Bento Cards
    expect(html).toContain("Secure Financial Transfer");
    expect(html).toContain("Protected by 256-bit TLS bank transmission &amp; PCI-DSS Level 1 compliance.");
    expect(html).toContain("Settlement Frequency");
    expect(html).toContain("This is your 12th payout this month. Automatic daily sweeps active.");

    // 7. PREST Shell & Sidebar
    expect(html).toContain("PREST");
    expect(html).toContain("Restaurant Suite");
    expect(html).toContain("Bistrot de l&#x27;Alma — Paris VII");
    expect(html).toContain("Terminal POS: Bar / Main Salon");
    expect(html).toContain("Claire St. Laurent");
    expect(html).toContain("General Manager");
    expect(html).toContain("Stripe Connect Active");
  });

  it("renders embedded view cleanly inside marketplace container", () => {
    const html = renderToStaticMarkup(
      <StripePayoutDetailsView
        embeddedInMarketplace={true}
        payoutId="#PO_991122"
        amount={4250.0}
      />
    );

    expect(html).toContain("Payout Details");
    expect(html).toContain("#PO_991122");
    expect(html).toContain("$4,250.00");
    expect(html).not.toContain("Terminal POS: Bar / Main Salon");
  });
});

