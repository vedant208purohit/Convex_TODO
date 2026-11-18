import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeInsightsView } from "./StripeInsightsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/insights",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Bistrot de l'Alma — Main Dining Room", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeInsightsView — Screen 17 Reference Parity Verification", () => {
  it("renders Screen 17 matching reference KPI cards, payment trends, regional volume, and payment methods", () => {
    const html = renderToStaticMarkup(
      <StripeInsightsView
        embeddedInMarketplace={false}
        onBackToDashboard={vi.fn()}
      />
    );

    // 1. Breadcrumbs & Header
    expect(html).toContain("Payments");
    expect(html).toContain("Stripe Integration");
    expect(html).toContain("Payment Insights");
    expect(html).toContain(
      "Understand payment activity received through your restaurant&#x27;s connected Stripe account."
    );
    expect(html).toContain("Export CSV");

    // 2. 4 Key Metric KPI Cards
    expect(html).toContain("Total Payment Volume");
    expect(html).toContain("$1,284,500.00");
    expect(html).toContain("+12.5%");
    expect(html).toContain("vs last month");

    expect(html).toContain("Top Dining Region / Country");
    expect(html).toContain("United States");
    expect(html).toContain("42% of settled transactions");

    expect(html).toContain("Settlement Currency");
    expect(html).toContain("USD");
    expect(html).toContain("Native settlement active");

    expect(html).toContain("Average Dining Ticket");
    expect(html).toContain("$85.40");
    expect(html).toContain("-2.1%");
    expect(html).toContain("vs last 7 days");

    // 3. Middle Row: Payment Trends & Volume by Outlet
    expect(html).toContain("Payment Trends");
    expect(html).toContain("Track how payments processed through Stripe change over time.");
    expect(html).toContain("Volume by Outlet / Region");
    expect(html).toContain("Distribution across dining locations");
    expect(html).toContain("SoHo Main Dining");
    expect(html).toContain("$539k");
    expect(html).toContain("Bistro Paris VII");
    expect(html).toContain("$210k");
    expect(html).toContain("Mayfair Room");
    expect(html).toContain("$145k");
    expect(html).toContain("Ginza Salon");
    expect(html).toContain("$98k");
    expect(html).toContain("Manage Default Regions");

    // 4. Bottom Row: Payment Methods Breakdown & Settlement Insights
    expect(html).toContain("Payment Methods Breakdown");
    expect(html).toContain("Processed through Stripe point-of-sale &amp; web");
    expect(html).toContain("Visa");
    expect(html).toContain("40%");
    expect(html).toContain("Mastercard");
    expect(html).toContain("25%");
    expect(html).toContain("Apple Pay");
    expect(html).toContain("15%");
    expect(html).toContain("Google Pay");
    expect(html).toContain("10%");
    expect(html).toContain("Others");

    expect(html).toContain("Recent Order Settlement Insights");
    expect(html).toContain("Dine-in vs Takeaway vs Delivery settlement volumes with Prest order linkage notes.");
    expect(html).toContain("Dine-In Volume");
    expect(html).toContain("$892,100");
    expect(html).toContain("Takeaway");
    expect(html).toContain("$246,300");
    expect(html).toContain("Delivery / Room");
    expect(html).toContain("$146,100");
    expect(html).toContain("View Audit Ledger");

    // 5. PREST Suite Shell
    expect(html).toContain("Prest");
    expect(html).toContain("Restaurant Suite");
    expect(html).toContain("Bistrot de l&#x27;Alma — Main Dining");
  });

  it("renders embedded view cleanly inside marketplace container", () => {
    const html = renderToStaticMarkup(
      <StripeInsightsView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Payment Insights");
    expect(html).toContain("Payment Trends");
    expect(html).not.toContain("Bistrot de l&#x27;Alma — Main Dining");
  });
});

