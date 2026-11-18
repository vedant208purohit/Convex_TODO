import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeDashboardView } from "./StripeDashboardView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/dashboard",
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [{ _id: "org_1", name: "Le Bistro Gourmand", country: "United States" }]),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("StripeDashboardView — Screen 7 Reference Parity Verification", () => {
  it("renders Screen 7 matching reference metrics, table, and connection panels", () => {
    const html = renderToStaticMarkup(
      <StripeDashboardView
        embeddedInMarketplace={false}
        onNavigateToTransactions={vi.fn()}
        onBackToMarketplace={vi.fn()}
      />
    );

    // 1. Header & Breadcrumb
    expect(html).toContain("Stripe Payments");
    expect(html).toContain(
      "Monitor payments received through your restaurant and manage payment activity from Prest."
    );
    expect(html).toContain("Export Activity");
    expect(html).toContain("Sync Transactions");

    // 2. 6 Summary Metric Cards
    expect(html).toContain("Today&#x27;s Payment Volume");
    expect(html).toContain("$2,450.00");
    expect(html).toContain("+12.5%");

    expect(html).toContain("Monthly Payment Volume");
    expect(html).toContain("$48,200.00");
    expect(html).toContain("+8.2%");

    expect(html).toContain("Successful Payments");
    expect(html).toContain("45");
    expect(html).toContain("Online");

    expect(html).toContain("Failed Payments");
    expect(html).toContain("2");
    expect(html).toContain("2 Action");

    expect(html).toContain("Refund Activity");
    expect(html).toContain("$120.00");
    expect(html).toContain("0.4% rate");

    expect(html).toContain("Upcoming Payout");
    expect(html).toContain("$1,850.00");
    expect(html).toContain("Expected Tomorrow");

    // 3. Recent Payment Activity Table
    expect(html).toContain("Recent Payment Activity");
    expect(html).toContain("View All in Stripe");
    expect(html).toContain("pi_3M9u7x");
    expect(html).toContain("PREST-1024");
    expect(html).toContain("Rahul Sharma");
    expect(html).toContain("Dine-in (Table 4)");
    expect(html).toContain("$42.50");

    expect(html).toContain("pi_3M9u7y");
    expect(html).toContain("PREST-1025");
    expect(html).toContain("Elena Rostova");

    expect(html).toContain("pi_3M9u7z");
    expect(html).toContain("PREST-1026");
    expect(html).toContain("Marcus Chen");

    // 4. Payment Connection Status & Settlement Policy Panel
    expect(html).toContain("Payment Connection");
    expect(html).toContain("System Online");
    expect(html).toContain("Operational");
    expect(html).toContain("42ms");
    expect(html).toContain("Delivered");
    expect(html).toContain("Settlement Policy");
    expect(html).toContain("Today at 23:59 CET");

    // 5. Sidebar Active Gateway
    expect(html).toContain("Active Gateway");
    expect(html).toContain("Live");
    expect(html).toContain("Stripe Custom Connect");
    expect(html).toContain("acct_12345 • Le Bistro Gourmand");
    expect(html).toContain("Terminal v4.2");
  });
});

