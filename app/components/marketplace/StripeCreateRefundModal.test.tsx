import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeCreateRefundModal } from "./StripeCreateRefundModal";

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Bistrot de l'Alma — Main Dining Room", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeCreateRefundModal — Screen 10 Parity Verification", () => {
  it("renders Create Refund Modal with all sections matching reference", () => {
    const html = renderToStaticMarkup(
      <StripeCreateRefundModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        contextData={{
          paymentId: "pi_3N5b2k8R4yT9q",
          orderNumber: "PREST-1028",
          customerName: "Alexander Wright",
          serviceType: "Dine-in",
          table: "Table 12",
          waiter: "Jean-Luc",
          originalAmount: 120.0,
          alreadyRefunded: 0.0,
          remainingRefundable: 120.0,
        }}
      />
    );

    // 1. Header & Badge
    expect(html).toContain("Create Refund");
    expect(html).toContain("Captured");
    expect(html).toContain("Refund a restaurant order payment securely using Stripe");

    // 2. Order Context
    expect(html).toContain("Prest Dining");
    expect(html).toContain("PREST-1028");
    expect(html).toContain("Dine-in · Table 12 · Waiter:");
    expect(html).toContain("Jean-Luc");
    expect(html).toContain("pi_3N5b2k8R4yT9q");
    expect(html).toContain("Alexander Wright");
    expect(html).toContain("$120.00");
    expect(html).toContain("Remaining Refundable");

    // 3. Restaurant Order Summary
    expect(html).toContain("Restaurant Order Summary");
    expect(html).toContain("Ribeye Steak");
    expect(html).toContain("Medium Rare, Peppercorn Sauce");
    expect(html).toContain("$48.00");
    expect(html).toContain("Duck Breast");
    expect(html).toContain("Pinot Noir Bottle");

    // 4. Refund Eligibility
    expect(html).toContain("Refund Eligibility");
    expect(html).toContain("Payment Successful");
    expect(html).toContain("Refund Available");
    expect(html).toContain("Amount Available");
    expect(html).toContain("Within Refund Window");

    // 5. Configuration (Full vs Partial) & Reason
    expect(html).toContain("Full Refund");
    expect(html).toContain("Partial Refund");
    expect(html).toContain("Refund Reason (Stripe)");
    expect(html).toContain("Internal POS Note");

    // 6. Transaction Summary & Footer
    expect(html).toContain("Transaction Summary");
    expect(html).toContain("Original Order");
    expect(html).toContain("Remaining Balance");
    expect(html).toContain("Processed via Stripe Payments");
    expect(html).toContain("Cancel");
  });

  it("does not render when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <StripeCreateRefundModal isOpen={false} onClose={vi.fn()} />
    );
    expect(html).toBe("");
  });
});

