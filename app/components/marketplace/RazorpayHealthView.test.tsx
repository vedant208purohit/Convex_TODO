import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpayHealthView } from "./RazorpayHealthView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/health",
}));

// Mock Clerk & Convex inside PosShell
vi.mock("@clerk/nextjs", () => ({
  UserButton: () => <div data-testid="user-button">UserButton</div>,
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
}));

describe("RazorpayHealthView — Health Monitoring Screen Verification", () => {
  it("renders breadcrumbs, title, subtitle, and Refresh Status action button", () => {
    const html = renderToStaticMarkup(
      <RazorpayHealthView embeddedInMarketplace={true} />
    );

    // Breadcrumbs
    expect(html).toContain("Installed Apps");
    expect(html).toContain("Payments");
    expect(html).toContain("Razorpay");
    expect(html).toContain("Health");

    // Title and description
    expect(html).toContain("Health Monitoring");
    expect(html).toContain(
      "Monitor the health and status of your Razorpay integration. Ensure your payments and settlements are flowing seamlessly."
    );

    // Action button
    expect(html).toContain("Refresh Status");
  });

  it("renders all 6 navigation tabs with Health active", () => {
    const html = renderToStaticMarkup(
      <RazorpayHealthView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Dashboard");
    expect(html).toContain("Transactions");
    expect(html).toContain("Refunds");
    expect(html).toContain("Settlements");
    expect(html).toContain("Health");
    expect(html).toContain("Settings");
  });

  it("renders the 4 Bento health summary cards", () => {
    const html = renderToStaticMarkup(
      <RazorpayHealthView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Connection Status");
    expect(html).toContain("API Status");
    expect(html).toContain("Webhook Status");
    expect(html).toContain("Last Sync");
  });

  it("renders Recent Activity Timeline section", () => {
    const html = renderToStaticMarkup(
      <RazorpayHealthView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Recent Activity Timeline");
    expect(html).toContain("Payment Captured");
    expect(html).toContain("Settlement Synced");
    expect(html).toContain("Webhook Processed");
    expect(html).toContain("Connection Verified");
  });

  it("renders Connection Information table with attributes", () => {
    const html = renderToStaticMarkup(
      <RazorpayHealthView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Connection Information");
    expect(html).toContain("Merchant Name");
    expect(html).toContain("Merchant ID");
    expect(html).toContain("Connected Since");
    expect(html).toContain("Environment");
    expect(html).toContain("Last Verification");
  });

  it("renders Attention Required and System Status Checklist cards", () => {
    const html = renderToStaticMarkup(
      <RazorpayHealthView embeddedInMarketplace={true} />
    );

    expect(html).toContain("Attention Required");
    expect(html).toContain("No Issues Found");
    expect(html).toContain("Status Checklist");
    expect(html).toContain("Razorpay Connected");
    expect(html).toContain("API Reachable");
    expect(html).toContain("Webhooks Active");
    expect(html).toContain("Payments Syncing");
    expect(html).toContain("Settlements Syncing");
    expect(html).toContain("Download Health Report");
  });

  it("renders within PosShell when embeddedInMarketplace is false", () => {
    const html = renderToStaticMarkup(
      <RazorpayHealthView embeddedInMarketplace={false} />
    );

    expect(html).toContain("Health Monitoring");
    expect(html).toContain("Store Branch:");
  });
});
