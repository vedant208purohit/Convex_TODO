import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeSuccessView } from "./StripeSuccessView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === "account_id" || key === "acct") return "acct_12345";
      if (key === "business" || key === "name") return "Le Bistro Gourmand";
      return null;
    },
  }),
  usePathname: () => "/marketplace/stripe/success",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Le Bistro Gourmand", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeSuccessView — Screen 6 Reference Parity Verification", () => {
  it("renders success view matching reference layout, bento cards, and actions", () => {
    const html = renderToStaticMarkup(
      <StripeSuccessView
        embeddedInMarketplace={false}
        connectionData={{
          businessName: "Le Bistro Gourmand",
          stripeAccountId: "acct_12345",
          country: "United States",
          currency: "USD ($)",
          connectedSince: "Just now",
        }}
        onGoToDashboard={vi.fn()}
        onReturnToMarketplace={vi.fn()}
      />
    );

    // 1. Success indicator and heading
    expect(html).toContain("Stripe Connected Successfully");
    expect(html).toContain(
      "Your Stripe account is now connected to Prest. You can manage your restaurant payment activity through the Prest admin panel."
    );

    // 2. Connection Summary Card
    expect(html).toContain("Connection Summary");
    expect(html).toContain("BUSINESS NAME");
    expect(html).toContain("Le Bistro Gourmand");
    expect(html).toContain("STRIPE ACCOUNT ID");
    expect(html).toContain("acct_12345");
    expect(html).toContain("OPERATING COUNTRY");
    expect(html).toContain("United States");
    expect(html).toContain("DEFAULT CURRENCY");
    expect(html).toContain("USD ($)");
    expect(html).toContain("CONNECTED SINCE");
    expect(html).toContain("Just now");

    // 3. Provisioning Status Card
    expect(html).toContain("Provisioning Status");
    expect(html).toContain("Account Connected");
    expect(html).toContain("Dining Payments Enabled");
    expect(html).toContain("Table Order Sync Enabled");
    expect(html).toContain("Refund Sync Enabled");
    expect(html).toContain("Daily Payout Sync Enabled");

    // 4. What You Can Do Next
    expect(html).toContain("What You Can Do Next");
    expect(html).toContain("Manage Payments");
    expect(html).toContain("View and monitor payments associated with your eligible restaurant orders.");
    expect(html).toContain("Manage Refunds");
    expect(html).toContain("Review and process eligible refunds through your connected Stripe account.");
    expect(html).toContain("Monitor Payouts");
    expect(html).toContain("View payout information available from Stripe directly inside Prest.");

    // 5. Action Buttons
    expect(html).toContain("Go to Stripe Dashboard");
    expect(html).toContain("Return to Payment Integrations");
  });
});

