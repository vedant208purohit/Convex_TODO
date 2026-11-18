import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StripeOnboard } from "./StripeOnboard";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/marketplace/stripe/onboard",
}));

describe("StripeOnboard — Screen 5 Reference Parity Verification", () => {
  it("renders standalone Screen 5 matching reference header, flow diagram, and bento cards", () => {
    const html = renderToStaticMarkup(
      <StripeOnboard
        embeddedInMarketplace={false}
        onBackToMarketplace={vi.fn()}
        onContinueWithStripe={vi.fn()}
      />
    );

    // 1. Header & Brand Tag
    expect(html).toContain("Prest");
    expect(html).toContain("POS Partner");
    expect(html).toContain("Help &amp; Support");
    expect(html).toContain("Save &amp; Exit");

    // 2. Process Flow Diagram
    expect(html).toContain("Restaurant POS");
    expect(html).toContain("restaurant");
    expect(html).toContain("Stripe Gateway");
    expect(html).toContain("credit_card");
    expect(html).toContain("Prest Operations");
    expect(html).toContain("point_of_sale");

    // 3. Main Title & Description
    expect(html).toContain("Create or Connect Stripe");
    expect(html).toContain(
      "Complete your Stripe account setup and connect it to Prest so you can manage restaurant payment activity."
    );

    // 4. 3 Benefits Bento Cards
    expect(html).toContain("Accept Customer Payments");
    expect(html).toContain(
      "Authorize Prest to connect with your existing Stripe account and access supported payment processing."
    );

    expect(html).toContain("Guided Account Setup");
    expect(html).toContain(
      "Create your Stripe account and complete the required business details before connecting it to Prest."
    );

    expect(html).toContain("Modern Table &amp; Digital Payments");
    expect(html).toContain(
      "Enable contactless dining, digital wallets, and split-bill payment settlement."
    );

    // 5. CTA Section
    expect(html).toContain("Continue with Stripe");
    expect(html).toContain("Stripe Standard Verification Notice:");
    expect(html).toContain(
      "Stripe may ask you to complete additional business verification before your restaurant account can accept live customer payments."
    );
    expect(html).toContain("Secured by Stripe Identity and AES-256 Encryption");

    // 6. Footer Security Badges
    expect(html).toContain("PCI-DSS Compliant");
    expect(html).toContain("3D Secure 2.0");
    expect(html).toContain("Official Stripe Connect Partner");
  });

  it("renders embedded mode with back button inside marketplace", () => {
    const html = renderToStaticMarkup(
      <StripeOnboard
        embeddedInMarketplace={true}
        onBackToMarketplace={vi.fn()}
        onContinueWithStripe={vi.fn()}
      />
    );

    expect(html).toContain("Back to Payment Integrations");
    expect(html).toContain("Stripe Connect Flow");
    expect(html).toContain("Create or Connect Stripe");
  });
});

