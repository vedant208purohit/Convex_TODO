import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketplaceDetailDrawer } from "./MarketplaceDetailDrawer";
import { MarketplaceApp } from "./types";

const mockRazorpayApp: MarketplaceApp = {
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

const mockWhatsAppApp: MarketplaceApp = {
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

describe("MarketplaceDetailDrawer — Screen 2 Reference Verification", () => {
  it("renders Razorpay Details Drawer matching the reference specifications", () => {
    const html = renderToStaticMarkup(
      <MarketplaceDetailDrawer
        isOpen={true}
        app={mockRazorpayApp}
        walletBalance={14500}
        onClose={vi.fn()}
        onActionClick={vi.fn()}
      />
    );

    // 1. Drawer overlay and dialog container
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Razorpay Details"');
    expect(html).toContain("backdrop-blur-[4px]");
    expect(html).toContain("w-full sm:w-[480px] md:w-[560px]");

    // 2. Drawer Header
    expect(html).toContain("Razorpay");
    expect(html).toContain("India&#x27;s Leading Payment Gateway");
    expect(html).toContain('aria-label="Razorpay"'); // Authentic SVG logo
    expect(html).toContain('aria-label="Close details drawer"');

    // 3. About Section
    expect(html).toContain("About");
    expect(html).toContain(
      "Accept online payments through UPI, Cards, Wallets, EMI and Net Banking. Razorpay provides a unified platform to manage your entire financial flow with high success rates and instant settlements."
    );

    // 4. Core Capabilities Section
    expect(html).toContain("Core Capabilities");

    // Card 1: UPI Payments
    expect(html).toContain("UPI Payments");
    expect(html).toContain("account_balance_wallet");
    expect(html).toContain("PhonePe");
    expect(html).toContain("Google Pay");
    expect(html).toContain("Paytm");
    expect(html).toContain("BHIM");

    // Card 2: Multiple Payment Methods
    expect(html).toContain("Multiple Payment Methods");
    expect(html).toContain("credit_card");
    expect(html).toContain("Support for every customer preference.");
    expect(html).toContain("Cards");
    expect(html).toContain("Wallets");
    expect(html).toContain("Net Banking");
    expect(html).toContain("EMI");

    // Card 3: Payment Tracking
    expect(html).toContain("Payment Tracking");
    expect(html).toContain("analytics");
    expect(html).toContain("Real-time lifecycle monitoring.");
    expect(html).toContain("Transactions");
    expect(html).toContain("Refunds");
    expect(html).toContain("Settlements");

    // 5. Integration Illustration Section
    expect(html).toContain("Integration Ready");

    // 6. Sticky Footer with primary Connect Razorpay button
    expect(html).toContain("Connect Razorpay");
    expect(html).toContain("arrow_forward");
    expect(html).toContain("bg-[#0c0a09]");
    expect(html).toContain("text-white");
    expect(html).toContain("rounded-xl");
  });

  it("does not render when isOpen is false or app is null", () => {
    const htmlClosed = renderToStaticMarkup(
      <MarketplaceDetailDrawer
        isOpen={false}
        app={mockRazorpayApp}
        walletBalance={14500}
        onClose={vi.fn()}
        onActionClick={vi.fn()}
      />
    );
    expect(htmlClosed).toBe("");

    const htmlNull = renderToStaticMarkup(
      <MarketplaceDetailDrawer
        isOpen={true}
        app={null}
        walletBalance={14500}
        onClose={vi.fn()}
        onActionClick={vi.fn()}
      />
    );
    expect(htmlNull).toBe("");
  });

  it("preserves standard drawer layout for non-Razorpay apps", () => {
    const html = renderToStaticMarkup(
      <MarketplaceDetailDrawer
        isOpen={true}
        app={mockWhatsAppApp}
        walletBalance={14500}
        onClose={vi.fn()}
        onActionClick={vi.fn()}
      />
    );

    expect(html).toContain("PREST WhatsApp Automation");
    expect(html).toContain("Practical Features");
    expect(html).toContain("Setup Prerequisites &amp; Requirements");
    expect(html).not.toContain("India&#x27;s Leading Payment Gateway");
    expect(html).not.toContain("Connect Razorpay");
  });

  it("renders Stripe Payments Details Drawer matching Screen 2 reference specifications", () => {
    const mockStripeApp: MarketplaceApp = {
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
      priceText: "Pay-as-you-go",
      priceAmount: 0,
      actionText: "Connect",
      actionType: "install",
      isInstalled: false,
    };

    const html = renderToStaticMarkup(
      <MarketplaceDetailDrawer
        isOpen={true}
        app={mockStripeApp}
        walletBalance={14500}
        onClose={vi.fn()}
        onActionClick={vi.fn()}
      />
    );

    // 1. Drawer overlay and dialog container
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Stripe Payments Details"');
    expect(html).toContain("w-full sm:w-[500px] md:w-[580px]");

    // 2. Drawer Header
    expect(html).toContain("Stripe Payments");
    expect(html).toContain("Official");
    expect(html).toContain("Restaurant Payment Provider");
    expect(html).toContain('aria-label="Stripe"'); // Authentic Stripe SVG icon

    // 3. Intro text & Highlight Box
    expect(html).toContain(
      "Connect Stripe to receive customer payments for your restaurant and manage payment activity through Prest."
    );
    expect(html).toContain("Accept Restaurant Payments");
    expect(html).toContain(
      "Stripe processes eligible customer payments made through your connected restaurant ordering and payment channels. Connect your account to manage payment activity from Prest."
    );

    // 4. Restaurant Benefits Section with 4 Bento Cards
    expect(html).toContain("Restaurant Benefits");
    expect(html).toContain("Prest &amp; Stripe Core");

    // Benefit 1
    expect(html).toContain("Accept Customer Payments");
    expect(html).toContain("payments");
    expect(html).toContain(
      "Receive payments for eligible restaurant orders through your connected Stripe account."
    );

    // Benefit 2
    expect(html).toContain("Track Payments");
    expect(html).toContain("query_stats");
    expect(html).toContain(
      "View payment status and related transaction information from Prest."
    );

    // Benefit 3
    expect(html).toContain("Manage Refunds");
    expect(html).toContain("assignment_return");
    expect(html).toContain(
      "Manage eligible payment refunds using the connected Stripe integration."
    );

    // Benefit 4
    expect(html).toContain("Monitor Payouts");
    expect(html).toContain("account_balance");
    expect(html).toContain(
      "View payout information reported by Stripe, where available."
    );

    // 5. Before Connecting Notice
    expect(html).toContain("Before Connecting");
    expect(html).toContain(
      "Make sure you can access your Stripe account and the required account credentials or authorization permissions."
    );

    // 6. Action buttons
    expect(html).toContain("Connect Stripe");
    expect(html).toContain("arrow_forward");
    expect(html).toContain("Close");
  });

  it("renders Stripe Payments Details Drawer in Connected state with Manage Stripe action", () => {
    const mockConnectedStripeApp: MarketplaceApp = {
      id: "app-stripe",
      slug: "stripe",
      title: "Stripe",
      subtitle: "Connect your Stripe account to accept payments for eligible restaurant orders.",
      vendor: "STRIPE",
      category: "Payments",
      description: "Connect your Stripe account to accept payments.",
      badge: "Connected",
      iconName: "stripe",
      rating: "4.9/5",
      version: "v4.2.0",
      statusText: "Connected",
      statusType: "live",
      priceText: "Pay-as-you-go",
      priceAmount: 0,
      actionText: "Manage",
      actionType: "open",
      isInstalled: true,
      ...({ configuration: { connected: true } } as any),
    };

    const html = renderToStaticMarkup(
      <MarketplaceDetailDrawer
        isOpen={true}
        app={mockConnectedStripeApp}
        walletBalance={14500}
        onClose={vi.fn()}
        onActionClick={vi.fn()}
        isPurchased={true}
      />
    );

    expect(html).toContain("Connected");
    expect(html).toContain("Manage Stripe");
    expect(html).toContain("tune");
    expect(html).toContain("Close");
  });
});

