import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpayApiKeysForm } from "./RazorpayApiKeysForm";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/api-keys",
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

describe("Screen 4: RazorpayApiKeysForm — Reference Verification", () => {
  it("renders breadcrumbs, page heading, and subtitle matching reference", () => {
    const html = renderToStaticMarkup(
      <RazorpayApiKeysForm embeddedInMarketplace={true} />
    );

    // Breadcrumbs
    expect(html).toContain("Marketplace");
    expect(html).toContain("Payment Providers");
    expect(html).toContain("Razorpay Setup");
    expect(html).toContain("API Keys");
    expect(html).toContain("chevron_right");

    // Headings
    expect(html).toContain("Connect Using API Keys");
    expect(html).toContain(
      "Securely link your Razorpay environment to enable Defx automation."
    );
  });

  it("renders Seamless Integration information card with exact copy", () => {
    const html = renderToStaticMarkup(
      <RazorpayApiKeysForm embeddedInMarketplace={true} />
    );

    expect(html).toContain("Seamless Integration");
    expect(html).toContain(
      "Already using Razorpay? Paste your API credentials and Defx will verify the connection automatically using high-grade encryption."
    );
    expect(html).toContain("info");
  });

  it("renders API credentials form fields with placeholders and buttons", () => {
    const html = renderToStaticMarkup(
      <RazorpayApiKeysForm embeddedInMarketplace={true} />
    );

    // Key ID field
    expect(html).toContain("Key ID");
    expect(html).toContain('placeholder="rzp_live_xxxxxxxxxxxxxx"');
    expect(html).toContain("Example: rzp_live_k82Hs91mNb0");

    // Key Secret field
    expect(html).toContain("Key Secret");
    expect(html).toContain('placeholder="••••••••••••••••"');
    expect(html).toContain("visibility");

    // Actions
    expect(html).toContain("Verify &amp; Connect");
    expect(html).toContain("Back");
    expect(html).toContain("bg-[#0c0a09]");
    expect(html).toContain("text-white");
    expect(html).toContain("bg-transparent");
  });

  it("renders Quick Guide with 5-step vertical numbered timeline and exact descriptions", () => {
    const html = renderToStaticMarkup(
      <RazorpayApiKeysForm embeddedInMarketplace={true} />
    );

    expect(html).toContain("Quick Guide");
    expect(html).toContain("auto_stories");

    // Step 1
    expect(html).toContain("Login to Razorpay");
    expect(html).toContain(
      "Access your dashboard at razorpay.com with your merchant credentials."
    );

    // Step 2
    expect(html).toContain("Open Settings");
    expect(html).toContain(
      "Navigate to the &#x27;Settings&#x27; section from the left sidebar navigation."
    );

    // Step 3
    expect(html).toContain("Generate API Keys");
    expect(html).toContain(
      "Click on the &#x27;API Keys&#x27; tab and select &#x27;Generate Key&#x27; (Live Mode)."
    );

    // Step 4
    expect(html).toContain("Copy Keys");
    expect(html).toContain(
      "Ensure you copy both the Key ID and the Secret. The secret is only shown once."
    );

    // Step 5
    expect(html).toContain("Paste Here");
    expect(html).toContain("Paste the credentials into the form and click verify.");
  });

  it("renders Support Assistance Card with Chat Now action", () => {
    const html = renderToStaticMarkup(
      <RazorpayApiKeysForm embeddedInMarketplace={true} />
    );

    expect(html).toContain("Need assistance?");
    expect(html).toContain("Our support team is online 24/7");
    expect(html).toContain("support_agent");
    expect(html).toContain("Chat Now");
  });

  it("renders Security info with Bank-grade AES-256 Encryption and footer copyright", () => {
    const html = renderToStaticMarkup(
      <RazorpayApiKeysForm embeddedInMarketplace={true} />
    );

    expect(html).toContain("Bank-grade AES-256 Encryption");
    expect(html).toContain("security");
    expect(html).toContain("© 2024 DEFX INFRASTRUCTURE • PRIVACY • TERMS");
  });

  it("strictly avoids colored MerchantHub blue and green palettes", () => {
    const html = renderToStaticMarkup(
      <RazorpayApiKeysForm embeddedInMarketplace={true} />
    );

    // Verify absence of MerchantHub colors
    expect(html).not.toContain("bg-[#005faf]");
    expect(html).not.toContain("bg-[#006c49]");
    expect(html).not.toContain("text-primary");
    expect(html).not.toContain("text-secondary");
    expect(html).not.toContain("bg-primary-container");
    expect(html).not.toContain("bg-secondary-container");
  });

  it("renders within PosShell when embeddedInMarketplace is false", () => {
    const html = renderToStaticMarkup(
      <RazorpayApiKeysForm embeddedInMarketplace={false} />
    );

    expect(html).toContain("Marketplace");
    expect(html).toContain("Connect Using API Keys");
  });
});

