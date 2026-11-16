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
});

