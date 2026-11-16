import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketplaceCard } from "./MarketplaceCard";
import { MarketplaceApp } from "./types";

const mockRazorpayAppNotConnected: MarketplaceApp = {
  id: "app-3",
  slug: "razorpay",
  title: "Razorpay",
  subtitle: "Accept UPI, Cards, Wallets, EMI and Net Banking payments.",
  vendor: "RAZORPAY",
  category: "Payments",
  description: "Accept UPI, Cards, Wallets, EMI and Net Banking payments.",
  badge: "Recommended for India",
  iconName: "razorpay",
  rating: "4.9/5",
  version: "v3.1.2",
  statusText: "Not Connected",
  statusType: "available",
  priceText: "Pay-as-you-go (1.9% per txn)",
  priceAmount: 0,
  actionText: "Connect",
  actionType: "install",
  isInstalled: false,
};

const mockRazorpayAppGenuinelyConnected: MarketplaceApp = {
  ...mockRazorpayAppNotConnected,
  isInstalled: true,
  statusText: "Installed & Active",
  statusType: "live",
  actionText: "Settings",
  actionType: "settings",
  permissions: ["Payments Read/Write"],
  // Explicit connection metadata
  ...({ configuration: { connected: true } } as any),
};

const mockStripeApp: MarketplaceApp = {
  id: "app-stripe",
  slug: "stripe",
  title: "Stripe",
  subtitle: "Global payment processing platform.",
  vendor: "STRIPE",
  category: "Payments",
  description: "Global credit and debit card processing.",
  badge: "Available",
  iconName: "credit_card",
  statusText: "Available",
  statusType: "available",
  priceText: "Standard MDR",
  priceAmount: 0,
  actionText: "Install App",
  actionType: "install",
  isInstalled: false,
};

const mockHeroApp: MarketplaceApp = {
  id: "app-1",
  slug: "prest-whatsapp-automation",
  title: "PREST WhatsApp Automation",
  subtitle: "Direct kitchen notifications.",
  vendor: "PREST LAB",
  category: "Communication",
  description: "Automate kitchen dispatch.",
  badge: "Featured",
  iconName: "mark_chat_unread",
  statusText: "Paid — Purchase Required",
  statusType: "paid_required",
  priceText: "₹5,000",
  priceAmount: 5000,
  actionText: "Purchase for ₹5,000",
  actionType: "purchase",
  isInstalled: false,
};

describe("MarketplaceCard — Reference Parity Verification", () => {
  it("renders Razorpay card matching reference content (Name, Description, Tags, Logo, Badge, Not Connected status, Connect button)", () => {
    const html = renderToStaticMarkup(
      <MarketplaceCard
        app={mockRazorpayAppNotConnected}
        onActionClick={vi.fn()}
        onCardClick={vi.fn()}
        isPurchased={false}
      />
    );

    // 1. Provider name
    expect(html).toContain("Razorpay");

    // 2. Exact description from reference
    expect(html).toContain("Accept UPI, Cards, Wallets, EMI and Net Banking payments.");

    // 3. Payment method tags
    expect(html).toContain("UPI");
    expect(html).toContain("Cards");
    expect(html).toContain("Wallets");
    expect(html).toContain("Net Banking");

    // 4. Authentic Razorpay SVG brand logo
    expect(html).toContain('aria-label="Razorpay"');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain(
      'd="M22.436 0l-11.91 7.773-1.174 4.276 6.625-4.297L11.65 24h4.391l6.395-24zM14.26 10.098L3.389 17.166 1.564 24h9.008l3.688-13.902Z"'
    );

    // 5. Provider recommendation badge
    expect(html).toContain("Recommended for India");

    // 6. Status presentation: Not Connected with neutral dot
    expect(html).toContain("Not Connected");
    expect(html).toContain("bg-[#a8a29e]");

    // 7. Action button: Connect with Black primary styling & White text
    expect(html).toContain("Connect");
    expect(html).toContain("bg-[#0c0a09]");
    expect(html).toContain("text-white");
    expect(html).toContain("hover:bg-[#262626]");
    expect(html).toContain("border-[#0c0a09]");
  });

  it("preserves genuine connection state and shows Settings when provider is authentically connected", () => {
    const html = renderToStaticMarkup(
      <MarketplaceCard
        app={mockRazorpayAppGenuinelyConnected}
        onActionClick={vi.fn()}
        onCardClick={vi.fn()}
        isPurchased={true}
      />
    );

    // Should reflect connected state and settings action
    expect(html).toContain("Settings");
    expect(html).toContain("Installed");
    expect(html).toContain("tune");
  });

  it("strictly preserves other provider cards without modifying their icons, tags, or buttons", () => {
    const html = renderToStaticMarkup(
      <MarketplaceCard
        app={mockStripeApp}
        onActionClick={vi.fn()}
        onCardClick={vi.fn()}
        isPurchased={false}
      />
    );

    // Stripe uses material symbol
    expect(html).not.toContain('aria-label="Razorpay"');
    expect(html).toContain("credit_card");
    // Does NOT render Razorpay-specific tags
    expect(html).not.toContain("Net Banking");
    // Uses standard neutral button styling
    expect(html).toContain("bg-[#fdf8f7]");
    expect(html).toContain("text-[#0c0a09]");
    expect(html).toContain("border-[#e7e5e4]");
  });

  it("preserves WhatsApp Automation hero card styling", () => {
    const html = renderToStaticMarkup(
      <MarketplaceCard
        app={mockHeroApp}
        onActionClick={vi.fn()}
        onCardClick={vi.fn()}
        isPurchased={false}
      />
    );

    expect(html).toContain("PREST WhatsApp Automation");
    expect(html).toContain("mark_chat_unread");
    expect(html).toContain("Purchase for ₹5,000");
  });
});
