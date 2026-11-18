import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeRefundsView } from "./StripeRefundsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/refunds",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Bistrot de l'Alma — Main Dining Room", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeRefundsView — Screen 9 Reference Parity Verification", () => {
  it("renders Screen 9 matching reference metrics, refunds table, and breakdown", () => {
    const html = renderToStaticMarkup(
      <StripeRefundsView
        embeddedInMarketplace={false}
        onBackToDashboard={vi.fn()}
      />
    );

    // 1. Header & Breadcrumb
    expect(html).toContain("Restaurant Payment Refunds");
    expect(html).toContain(
      "Review and manage refunds for payments received through your restaurant orders."
    );
    expect(html).toContain("+ Create Refund");
    expect(html).toContain("Filter");
    expect(html).toContain("Export");

    // 2. Summary Metric Cards (4 Cards)
    expect(html).toContain("Total Refunds");
    expect(html).toContain("128");
    expect(html).toContain("vs last 30 days");

    expect(html).toContain("Completed Refunds");
    expect(html).toContain("$2,580.00");

    expect(html).toContain("Pending Refunds");
    expect(html).toContain("4");
    expect(html).toContain("Action needed");

    expect(html).toContain("Failed Refunds");
    expect(html).toContain("1");
    expect(html).toContain("Requires review");

    // 3. Refund Activity Table
    expect(html).toContain("Refund Activity");
    expect(html).toContain("re_9281");
    expect(html).toContain("pi_3N5b2k");
    expect(html).toContain("PREST-1019");
    expect(html).toContain("Alexander Wright");
    expect(html).toContain("Ribeye Steak × 1");
    expect(html).toContain("$45.00");
    expect(html).toContain("Succeeded");

    expect(html).toContain("re_9280");
    expect(html).toContain("Sophia Martinez");
    expect(html).toContain("Pending");

    expect(html).toContain("re_9279");
    expect(html).toContain("Marcus Chen");

    expect(html).toContain("re_9278");
    expect(html).toContain("Elena Rodriguez");
    expect(html).toContain("$124.00");

    // 4. Breakdown by Reason
    expect(html).toContain("Refund Breakdown by Reason");
    expect(html).toContain("Customer Requested");
    expect(html).toContain("Kitchen / Preparation Error");
    expect(html).toContain("Delivery Issue");
    expect(html).toContain("Duplicate Charge");

    // 5. Policy Rules
    expect(html).toContain("Restaurant Policy Rules");
    expect(html).toContain("Automatic approval cap:");
    expect(html).toContain("$50.00 / order");
    expect(html).toContain("Shift manager PIN required:");
    expect(html).toContain("Read Refund Compliance Guidelines");

    // 6. Navigation
    expect(html).toContain("Payment Refunds");
    expect(html).toContain("Charges &amp; Invoices");
    expect(html).toContain("Stripe Connected");
  });
});

