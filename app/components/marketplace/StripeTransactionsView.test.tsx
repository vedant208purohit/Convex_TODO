import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeTransactionsView } from "./StripeTransactionsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/transactions",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Bistrot de l'Alma — Main Dining Room", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeTransactionsView — Screen 8 Reference Parity Verification", () => {
  it("renders Screen 8 matching reference layout, 4 metric cards, filter bar, and transactions table", () => {
    const html = renderToStaticMarkup(
      <StripeTransactionsView
        embeddedInMarketplace={false}
        onBackToDashboard={vi.fn()}
      />
    );

    // 1. Title & Header
    expect(html).toContain("Financial Operations");
    expect(html).toContain("Payment Transactions");
    expect(html).toContain(
      "View payments received for your dine-in, takeaway, delivery and other supported restaurant orders."
    );
    expect(html).toContain("Export CSV");
    expect(html).toContain("+ New Terminal Charge");

    // 2. 4 Metric Bento Cards
    expect(html).toContain("Total Transactions");
    expect(html).toContain("1,248");
    expect(html).toContain("past 30 days");

    expect(html).toContain("Successful");
    expect(html).toContain("1,194");
    expect(html).toContain("95.7% clear rate");

    expect(html).toContain("Failed Payments");
    expect(html).toContain("14");
    expect(html).toContain("1.1% decline");

    expect(html).toContain("Pending Review");
    expect(html).toContain("40");
    expect(html).toContain("Awaiting auth");

    // 3. Filter Bar
    expect(html).toContain("Search Payment ID, Prest Order #, Customer...");
    expect(html).toContain("Last 30 Days");
    expect(html).toContain("All Statuses");
    expect(html).toContain("All Order Types");
    expect(html).toContain("Payment Method");
    expect(html).toContain("Reset");

    // 4. Detailed Table Rows
    expect(html).toContain("pi_3N5b2k");
    expect(html).toContain("PREST-1028");
    expect(html).toContain("Alice Brown");
    expect(html).toContain("alice.b@email.com");
    expect(html).toContain("Dine-in");
    expect(html).toContain("(T12)");
    expect(html).toContain("Steak Frites × 2, Pinot Noir × 2");
    expect(html).toContain("$120.00");
    expect(html).toContain("Visa •••• 4242");

    expect(html).toContain("pi_8K1m9z");
    expect(html).toContain("PREST-1027");
    expect(html).toContain("James Smith");
    expect(html).toContain("Takeaway");
    expect(html).toContain("Failed");

    expect(html).toContain("pi_4L2n8x");
    expect(html).toContain("PREST-1026");
    expect(html).toContain("Maria Lopez");
    expect(html).toContain("Delivery");
    expect(html).toContain("Pending");

    expect(html).toContain("pi_7P9q2w");
    expect(html).toContain("PREST-1025");
    expect(html).toContain("Robert King");
    expect(html).toContain("(T2)");

    // 5. Sidebar Operator Pill
    expect(html).toContain("Alex Rivera");
    expect(html).toContain("General Manager");
  });
});

