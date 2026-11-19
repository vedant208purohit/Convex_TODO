import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpaySettlementSubmittedView } from "./RazorpaySettlementSubmittedView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "id" ? "setl_Nzx736KlaP" : null),
  }),
  usePathname: () => "/marketplace/razorpay/settlements/submitted",
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

describe("RazorpaySettlementSubmittedView — Screen 1 Verification", () => {
  it("renders breadcrumbs, confirmation visual, and heading", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementSubmittedView
        settlementId="setl_Nzx736KlaP"
        embeddedInMarketplace={true}
      />
    );

    // Breadcrumbs
    expect(html).toContain("Installed Apps");
    expect(html).toContain("Payments");
    expect(html).toContain("Razorpay");
    expect(html).toContain("Settlements");
    expect(html).toContain("Request Submitted");

    // Headings
    expect(html).toContain("Request Submitted");
    expect(html).toContain("Your settlement request has been submitted and is currently being processed.");
  });

  it("renders circular visual with rotating dash ring and payment icon", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementSubmittedView
        settlementId="setl_Nzx736KlaP"
        embeddedInMarketplace={true}
      />
    );

    expect(html).toContain("stroke-dasharray=\"10 20\"");
    expect(html).toContain("payments");
  });

  it("renders footer buttons (Back to Settlements and View Settlement)", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementSubmittedView
        settlementId="setl_Nzx736KlaP"
        embeddedInMarketplace={true}
      />
    );

    expect(html).toContain("Back to Settlements");
    expect(html).toContain("View Settlement");
  });

  it("wraps in PosShell when embeddedInMarketplace is false", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementSubmittedView
        settlementId="setl_Nzx736KlaP"
        embeddedInMarketplace={false}
      />
    );

    expect(html).toContain("PREST");
    expect(html).toContain("Management Suite");
    expect(html).toContain("Settlements");
  });
});

