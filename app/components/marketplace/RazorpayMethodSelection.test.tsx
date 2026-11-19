import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RazorpayMethodSelection } from "./RazorpayMethodSelection";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/razorpay/connect",
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

describe("Screen 3: RazorpayMethodSelection — Reference Verification", () => {
  it("renders breadcrumbs, page heading, and subtitle matching reference", () => {
    const html = renderToStaticMarkup(
      <RazorpayMethodSelection embeddedInMarketplace={true} />
    );

    // Breadcrumbs
    expect(html).toContain("Marketplace");
    expect(html).toContain("Payment Providers");
    expect(html).toContain("Razorpay Setup");
    expect(html).toContain("chevron_right");

    // Header & Subtitle
    expect(html).toContain("Connect Your Razorpay Account");
    expect(html).toContain("Choose how you want to connect Razorpay with Defx.");
  });

  it("renders Card 1 (I Already Have Razorpay) with exact copy and white button styling", () => {
    const html = renderToStaticMarkup(
      <RazorpayMethodSelection embeddedInMarketplace={true} />
    );

    // Title & exact description
    expect(html).toContain("I Already Have Razorpay");
    expect(html).toContain(
      "Connect using existing Razorpay API credentials. This method allows you to use your current business configurations and transaction history."
    );

    // Link icon
    expect(html).toContain("link");

    // Button: Connect Using API Keys with arrow_forward
    expect(html).toContain("Connect Using API Keys");
    expect(html).toContain("arrow_forward");
    expect(html).toContain("bg-white");
    expect(html).toContain("text-[#0c0a09]");
    expect(html).toContain("border-[#e7e5e4]");
  });

  it("renders Card 2 (I'm New To Razorpay) with exact copy and black primary button styling", () => {
    const html = renderToStaticMarkup(
      <RazorpayMethodSelection embeddedInMarketplace={true} />
    );

    // Title & exact description
    expect(html).toContain("I&#x27;m New To Razorpay");
    expect(html).toContain(
      "Create or connect a Razorpay account through guided onboarding. Ideal for businesses looking to scale their payments infrastructure with Defx."
    );

    // Trending up icon
    expect(html).toContain("trending_up");

    // Button: Continue With Razorpay with launch icon
    expect(html).toContain("Continue With Razorpay");
    expect(html).toContain("launch");
    expect(html).toContain("bg-[#0c0a09]");
    expect(html).toContain("text-white");
  });

  it("renders security information section with encrypted credentials copy and Defx Secure Connect", () => {
    const html = renderToStaticMarkup(
      <RazorpayMethodSelection embeddedInMarketplace={true} />
    );

    expect(html).toContain("verified_user");
    expect(html).toContain(
      "Your credentials are encrypted and never stored in plain text."
    );
    expect(html).toContain("Powered by Defx Secure Connect");
    expect(html).toContain("Razorpay");
  });

  it("renders 3 decorative monochrome tiles (security, account_balance, api)", () => {
    const html = renderToStaticMarkup(
      <RazorpayMethodSelection embeddedInMarketplace={true} />
    );

    expect(html).toContain("security");
    expect(html).toContain("account_balance");
    expect(html).toContain("api");
    expect(html).toContain("opacity-40 grayscale pointer-events-none");
  });

  it("strictly avoids colored MerchantHub blue and green button/card palettes", () => {
    const html = renderToStaticMarkup(
      <RazorpayMethodSelection embeddedInMarketplace={true} />
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
      <RazorpayMethodSelection embeddedInMarketplace={false} />
    );

    expect(html).toContain("Marketplace");
    expect(html).toContain("Connect Your Razorpay Account");
  });
});
