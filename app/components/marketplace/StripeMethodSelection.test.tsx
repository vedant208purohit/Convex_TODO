import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeMethodSelection } from "./StripeMethodSelection";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/connect",
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

describe("StripeMethodSelection — Screen 3 Reference Parity Verification", () => {
  it("renders Screen 3 matching reference layout, headings, and bento cards", () => {
    const html = renderToStaticMarkup(
      <StripeMethodSelection
        embeddedInMarketplace={true}
        onBackToMarketplace={vi.fn()}
        onSelectExistingAccount={vi.fn()}
        onSelectNewAccount={vi.fn()}
      />
    );

    // 1. Eyebrow badge
    expect(html).toContain("Payment Integration");
    expect(html).toContain("account_balance_wallet");

    // 2. Main Title and Description
    expect(html).toContain("Connect Your Stripe Account");
    expect(html).toContain(
      "Connect Stripe to start receiving payments from your restaurant customers through supported Prest payment channels."
    );

    // 3. Card 1: Existing Stripe Account
    expect(html).toContain("Fastest Connection");
    expect(html).toContain("sync_alt");
    expect(html).toContain("I Already Have a Stripe Account");
    expect(html).toContain(
      "I already use Stripe for my restaurant and want to connect my existing account to Prest."
    );
    expect(html).toContain("What you&#x27;ll need:");
    expect(html).toContain("Active, verified Stripe account");
    expect(html).toContain("Access to your Stripe Dashboard");
    expect(html).toContain("Authorization or API credentials for Prest");
    expect(html).toContain("Connect Existing Account");
    expect(html).toContain("arrow_forward");

    // 4. Card 2: New to Stripe
    expect(html).toContain("Recommended for New Restaurants");
    expect(html).toContain("add_business");
    expect(html).toContain("I&#x27;m New to Stripe");
    expect(html).toContain(
      "I don&#x27;t have a Stripe account yet. I want to create one before connecting it to Prest."
    );
    expect(html).toContain("Onboarding includes:");
    expect(html).toContain("Guided setup for restaurant operators");
    expect(html).toContain("Direct onboarding via Stripe");
    expect(html).toContain("Automatic sync with Prest order settlement");
    expect(html).toContain("Create Stripe Account");
    expect(html).toContain("north_east");

    // 5. Back Navigation
    expect(html).toContain("Back to Payment Gateways");
    expect(html).toContain("arrow_back");

    // 6. Security and Trust Badges
    expect(html).toContain("PCI-DSS Compliant");
    expect(html).toContain("verified_user");
    expect(html).toContain("Secure 256-bit Encryption");
    expect(html).toContain("lock");
    expect(html).toContain("Official Stripe Partner");
    expect(html).toContain("handshake");
  });

  it("renders within PosShell when standalone", () => {
    const html = renderToStaticMarkup(
      <StripeMethodSelection embeddedInMarketplace={false} />
    );
    expect(html).toContain("Connect Your Stripe Account");
    expect(html).toContain("Fastest Connection");
    expect(html).toContain("Recommended for New Restaurants");
  });
});
