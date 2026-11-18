import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeApiKeysForm } from "./StripeApiKeysForm";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/api-keys",
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

describe("StripeApiKeysForm — Screen 4 Reference Parity Verification", () => {
  it("renders Screen 4 matching reference layout, inputs, guidance, and buttons", () => {
    const html = renderToStaticMarkup(
      <StripeApiKeysForm
        embeddedInMarketplace={true}
        onBack={vi.fn()}
        onVerify={vi.fn()}
      />
    );

    // 1. Header Badge & Title
    expect(html).toContain("Payment Gateway Setup");
    expect(html).toContain("Connect Your Stripe Account");
    expect(html).toContain(
      "Enter your Stripe account credentials so Prest can securely connect to your payment gateway."
    );

    // 2. Environment pill
    expect(html).toContain("Environment:");
    expect(html).toContain("Live Production");
    expect(html).toContain("Managed automatically by Prest");

    // 3. Form labels and placeholders
    expect(html).toContain("Publishable Key");
    expect(html).toContain("Safe for client-side use");
    expect(html).toContain("pk_live_...");

    expect(html).toContain("Secret Key");
    expect(html).toContain("Confidential");
    expect(html).toContain("sk_live_...");
    expect(html).toContain("visibility");

    // 4. Action buttons
    expect(html).toContain("Back");
    expect(html).toContain("Test Connection");
    expect(html).toContain("sync_alt");
    expect(html).toContain("Save &amp; Connect");
    expect(html).toContain("check_circle");

    // 5. Security footnote
    expect(html).toContain(
      "Your payment credentials are stored securely and are used only to connect Prest with your Stripe account. Never exposed in plain text."
    );

    // 6. Right Panel: Step-by-Step Operator Guidance
    expect(html).toContain("Operator Guidance");
    expect(html).toContain("Setup Instructions");
    expect(html).toContain("Open Stripe Dashboard");
    expect(html).toContain("Find Your API Credentials");
    expect(html).toContain("Copy Your Credentials");
    expect(html).toContain("Verify and Connect");
    expect(html).toContain("https://dashboard.stripe.com/");
    expect(html).toContain("Need assistance?");
    expect(html).toContain("View Guide");
  });

  it("renders standalone inside PosShell with clean layout", () => {
    const html = renderToStaticMarkup(
      <StripeApiKeysForm embeddedInMarketplace={false} />
    );
    expect(html).toContain("Connect Your Stripe Account");
    expect(html).toContain("Publishable Key");
    expect(html).toContain("Secret Key");
  });
});

