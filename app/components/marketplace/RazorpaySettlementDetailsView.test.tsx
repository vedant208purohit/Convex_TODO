import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpaySettlementDetailsView } from "./RazorpaySettlementDetailsView";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/settlements/setl_Nzx736KlaP",
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

describe("RazorpaySettlementDetailsView — Screen 2 Verification", () => {
  it("renders page header with back navigation and Back to History action", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementDetailsView
        settlementId="setl_Nzx736KlaP"
        embeddedInMarketplace={true}
      />
    );

    expect(html).toContain("Settlement Details");
    expect(html).toContain("setl_Nzx736KlaP");
    expect(html).toContain("Back to History");
    expect(html).toContain("arrow_back");
  });

  it("renders initial loading state with accessible description", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementDetailsView
        settlementId="setl_Nzx736KlaP"
        embeddedInMarketplace={true}
      />
    );

    expect(html).toContain("Loading Settlement Details...");
    expect(html).toContain("Retrieving payout confirmation and activity history.");
  });

  it("wraps in PosShell when embeddedInMarketplace is false", () => {
    const html = renderToStaticMarkup(
      <RazorpaySettlementDetailsView
        settlementId="setl_Nzx736KlaP"
        embeddedInMarketplace={false}
      />
    );

    expect(html).toContain("PREST");
    expect(html).toContain("Management Suite");
    expect(html).toContain("Settlement Details");
  });
});

