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

const mockStripeAppNotConnected: MarketplaceApp = {
  id: "app-stripe",
  slug: "stripe",
  title: "Stripe",
  subtitle: "Connect your Stripe account to accept payments for eligible restaurant orders.",
  vendor: "STRIPE",
  category: "Payments",
  description:
    "Connect your Stripe account to accept payments for eligible restaurant orders and manage payment activity directly through Prest.",
  badge: "Recommended for Restaurants",
  iconName: "stripe",
  rating: "4.9/5",
  version: "v4.2.0",
  statusText: "Not Connected",
  statusType: "available",
  priceText: "Standard MDR",
  priceAmount: 0,
  actionText: "Connect",
  actionType: "install",
  isInstalled: false,
};

const mockStripeAppConnected: MarketplaceApp = {
  ...mockStripeAppNotConnected,
  isInstalled: true,
  statusText: "Connected",
  statusType: "live",
  badge: "Connected",
  actionText: "Manage",
  actionType: "open",
  ...({ configuration: { connected: true } } as any),
};

const mockPayPalCommerceApp: MarketplaceApp = {
  id: "app-paypal",
  slug: "paypal-commerce",
  title: "PayPal Commerce",
  subtitle: "Enable diners to pay with PayPal and Venmo for online pick-up orders and catering reservations.",
  vendor: "PAYPAL",
  category: "Payments",
  description: "Enable diners to pay with PayPal and Venmo for online pick-up orders and catering reservations.",
  badge: "Alternative",
  iconName: "paypal",
  rating: "4.7/5",
  version: "v2.4.0",
  statusText: "Not Installed",
  statusType: "available",
  priceText: "Standard Processing",
  priceAmount: 0,
  actionText: "Install App",
  actionType: "install",
  isInstalled: false,
};

const mockAdyenApp: MarketplaceApp = {
  id: "app-adyen",
  slug: "adyen",
  title: "Adyen",
  subtitle: "Unified terminal and e-commerce payment infrastructure designed for restaurant groups and franchise multi-location venues.",
  vendor: "ADYEN",
  category: "Payments",
  description: "Unified terminal and e-commerce payment infrastructure designed for restaurant groups and franchise multi-location venues.",
  badge: "Enterprise",
  iconName: "adyen",
  rating: "4.8/5",
  version: "v3.1.0",
  statusText: "Not Installed",
  statusType: "available",
  priceText: "Enterprise Rates",
  priceAmount: 0,
  actionText: "Install App",
  actionType: "install",
  isInstalled: false,
};

const mockGenericApp: MarketplaceApp = {
  id: "app-generic",
  slug: "kitchen-display",
  title: "Kitchen Display System",
  subtitle: "Realtime KDS display.",
  vendor: "PREST",
  category: "Operations",
  description: "Realtime ticket kitchen routing.",
  badge: "Available",
  iconName: "kitchen",
  statusText: "Available",
  statusType: "available",
  priceText: "Free",
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

  it("renders Stripe card matching Screen 1 reference design (Stripe logo, Recommended for Restaurants, 5 capabilities, Connect + View Details buttons)", () => {
    const html = renderToStaticMarkup(
      <MarketplaceCard
        app={mockStripeAppNotConnected}
        onActionClick={vi.fn()}
        onCardClick={vi.fn()}
        isPurchased={false}
      />
    );

    // 1. Official Stripe SVG brand mark
    expect(html).toContain('aria-label="Stripe"');
    expect(html).toContain('viewBox="0 0 24 24"');

    // 2. Provider name & category
    expect(html).toContain("Stripe");
    expect(html).toContain("Payments");

    // 3. Recommended for Restaurants label
    expect(html).toContain("Recommended for Restaurants");

    // 4. Exact description from reference
    expect(html).toContain(
      "Connect your Stripe account to accept payments for eligible restaurant orders and manage payment activity directly through Prest."
    );

    // 5. 5 Supported capabilities / features
    expect(html).toContain("Dine-in &amp; POS");
    expect(html).toContain("Online Orders");
    expect(html).toContain("QR Payments");
    expect(html).toContain("Apple Pay");
    expect(html).toContain("Cards");

    // 6. Not Connected status with warm rust/stone dot
    expect(html).toContain("Not Connected");
    expect(html).toContain("bg-[#8B3A2B]");

    // 7. Dual action buttons: Primary Connect + Secondary View Details
    expect(html).toContain("Connect");
    expect(html).toContain("View Details");
    expect(html).toContain("arrow_forward");
  });

  it("renders Stripe card in Connected state with Manage button and connected indicator", () => {
    const html = renderToStaticMarkup(
      <MarketplaceCard
        app={mockStripeAppConnected}
        onActionClick={vi.fn()}
        onCardClick={vi.fn()}
        isPurchased={true}
      />
    );

    // Connected badge and status
    expect(html).toContain("Connected");
    expect(html).toContain("bg-emerald-500");

    // Primary action switches to Manage while keeping View Details
    expect(html).toContain("Manage");
    expect(html).toContain("View Details");
  });

  it("renders PayPal Commerce and Adyen provider cards with authentic styling and tags", () => {
    const paypalHtml = renderToStaticMarkup(
      <MarketplaceCard
        app={mockPayPalCommerceApp}
        onActionClick={vi.fn()}
        onCardClick={vi.fn()}
        isPurchased={false}
      />
    );
    expect(paypalHtml).toContain("PayPal Commerce");
    expect(paypalHtml).toContain("Alternative");
    expect(paypalHtml).toContain("Venmo");
    expect(paypalHtml).toContain("Online Pickup");
    expect(paypalHtml).toContain("Pay Later");
    expect(paypalHtml).toContain("Install App");

    const adyenHtml = renderToStaticMarkup(
      <MarketplaceCard
        app={mockAdyenApp}
        onActionClick={vi.fn()}
        onCardClick={vi.fn()}
        isPurchased={false}
      />
    );
    expect(adyenHtml).toContain("Adyen");
    expect(adyenHtml).toContain("Enterprise");
    expect(adyenHtml).toContain("Smart Terminals");
    expect(adyenHtml).toContain("Franchise Groups");
    expect(adyenHtml).toContain("Unified Flow");
    expect(adyenHtml).toContain("Install App");
  });

  it("strictly preserves other non-payment app cards with standard styling", () => {
    const html = renderToStaticMarkup(
      <MarketplaceCard
        app={mockGenericApp}
        onActionClick={vi.fn()}
        onCardClick={vi.fn()}
        isPurchased={false}
      />
    );

    expect(html).toContain("Kitchen Display System");
    expect(html).toContain("kitchen");
    expect(html).not.toContain('aria-label="Stripe"');
    expect(html).not.toContain('aria-label="Razorpay"');
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
