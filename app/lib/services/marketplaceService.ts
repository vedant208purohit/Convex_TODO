import { MarketplaceApp, MarketplaceCategory, MarketplaceSortOption } from "../../components/marketplace/types";

export const INITIAL_MARKETPLACE_APPS: MarketplaceApp[] = [
  {
    id: "app-1",
    slug: "prest-whatsapp-automation",
    title: "PREST WhatsApp Automation",
    subtitle: "Direct kitchen notifications, bill dispatch and customer recovery pipeline.",
    vendor: "PREST LAB",
    category: "Communication",
    description:
      "Automate supported restaurant order updates and customer communication using your connected WhatsApp Business provider. Instant kitchen dispatch pings and digital receipt delivery.",
    badge: "Featured",
    iconName: "mark_chat_unread",
    rating: "4.9/5",
    version: "v2.8.4 Enterprise",
    statusText: "Paid — Purchase Required",
    statusType: "paid_required",
    priceText: "₹5,000 One-time demo purchase",
    priceAmount: 5000,
    isOneTime: true,
    actionText: "Purchase for ₹5,000",
    actionType: "purchase",
    isInstalled: false,
    practicalFeatures: [
      {
        icon: "update",
        title: "Automated Order Status",
        description: "Instant real-time kitchen updates pushed directly to guest chats (Accepted, Preparing, Out for Delivery, Ready for Pickup).",
      },
      {
        icon: "receipt_long",
        title: "Digital E-Bill Dispatch",
        description: "Zero-friction thermal paperless slips sent directly to guest WhatsApp with downloadable GST tax invoice PDF and quick tipping link.",
      },
      {
        icon: "forward_to_inbox",
        title: "1-Click Guest Re-Engagement",
        description: "Targeted anniversary perks and private tasting invitations automatically scheduled for dine-in guests absent for >30 consecutive days.",
      },
      {
        icon: "notifications_active",
        title: "Staff Notification Channel",
        description: "Instant VIP table escalation alerts, sommelier summons, and long-ticket delays dispatched immediately to the floor manager WhatsApp group.",
      },
    ],
    prerequisites: [
      {
        icon: "check_circle",
        title: "Meta / WhatsApp Business API Account",
        detail: "Verified Meta Business Manager ID with an approved WhatsApp display name.",
      },
      {
        icon: "check_circle",
        title: "Active PREST Cloud POS Connection",
        detail: "Online sync enabled for active register terminal and kitchen printers.",
      },
      {
        icon: "domain",
        title: "Compatible Outlets",
        detail: "The Grand Bistro HQ (All 3 Floors & Rooftop Terrace Lounge).",
      },
    ],
    permissions: ["Order Read-Only", "Guest Phone (Encrypted)", "Outbound Webhooks"],
    terms: {
      licenseType: "One-time Lifetime Organization License",
      platformSurcharge: "₹0.00 (Zero Wallet Convenience Fee)",
      taxes: "Included in Demo Rate",
    },
  },
  {
    id: "app-2",
    slug: "whatsapp-business",
    title: "WhatsApp Business",
    subtitle: "Customer messaging, table reservations, and concierge channel.",
    vendor: "META",
    category: "Communication",
    description:
      "Connect your WhatsApp Business account to support direct customer communication, reservation responses, and guest concierge desks.",
    badge: "Installed",
    iconName: "chat",
    rating: "4.8/5",
    version: "v1.4.0",
    statusText: "Installed — Setup Required",
    statusType: "installed",
    priceText: "Free with Meta setup",
    priceAmount: 0,
    actionText: "Start Setup",
    actionType: "setup",
    isInstalled: true,
  },
  {
    id: "app-3",
    slug: "razorpay",
    title: "Razorpay",
    subtitle: "Unified payment gateway for table checks and online orders.",
    vendor: "RAZORPAY",
    category: "Payments",
    description:
      "Accept eligible online payments through a connected Razorpay merchant account. Auto-settle QR table checks and mobile pickup orders directly.",
    badge: "Live",
    iconName: "account_balance",
    rating: "4.9/5",
    version: "v3.1.2",
    statusText: "Installed & Active",
    statusType: "live",
    priceText: "Pay-as-you-go (1.9% per txn)",
    priceAmount: 0,
    actionText: "Settings",
    actionType: "settings",
    isInstalled: true,
  },
  {
    id: "app-4",
    slug: "phonepe-payment-gateway",
    title: "PhonePe Payment Gateway",
    subtitle: "Dynamic UPI QR billing and instant customer checkout.",
    vendor: "PHONEPE",
    category: "Payments",
    description:
      "Connect PhonePe Payment Gateway for supported restaurant payment flows, dynamic UPI QR on the customer bill, and unified ledger reports.",
    badge: "Attention",
    iconName: "contactless",
    rating: "4.6/5",
    version: "v2.0.1",
    statusText: "Connection Needs Attention",
    statusType: "attention",
    priceText: "Standard MDR",
    priceAmount: 0,
    actionText: "Fix Connection",
    actionType: "fix",
    isInstalled: true,
  },
  {
    id: "app-5",
    slug: "cashfree-payments",
    title: "Cashfree Payments",
    subtitle: "Vendor payouts, staff tipping disbursals, and instant settlements.",
    vendor: "CASHFREE",
    category: "Payments",
    description:
      "Instant restaurant vendor payouts, staff tipping disbursals, and POS table settlements directly through secure banking rails.",
    badge: "Available",
    iconName: "currency_rupee",
    rating: "4.7/5",
    version: "v1.8.0",
    statusText: "Available",
    statusType: "available",
    priceText: "Free to Install",
    priceAmount: 0,
    actionText: "Install App",
    actionType: "install",
    isInstalled: false,
  },
  {
    id: "app-6",
    slug: "stripe",
    title: "Stripe",
    subtitle: "Global card processing and foreign currency billing.",
    vendor: "STRIPE",
    category: "Payments",
    description:
      "International credit card acceptance and currency exchange for boutique hotel guests, visiting tourists, and global private events.",
    badge: "Available",
    iconName: "credit_card",
    rating: "4.9/5",
    version: "v4.0.0",
    statusText: "Available",
    statusType: "available",
    priceText: "2.9% + ₹30",
    priceAmount: 0,
    actionText: "View Details",
    actionType: "details",
    isInstalled: false,
  },
  {
    id: "app-7",
    slug: "shiprocket",
    title: "Shiprocket",
    subtitle: "Hyper-local courier routing and takeout delivery fleet.",
    vendor: "SHIPROCKET",
    category: "Delivery & Shipping",
    description:
      "Manage eligible direct takeout delivery workflows, assign local hyper-local riders, and automate rider tracking alerts.",
    badge: "Available",
    iconName: "local_shipping",
    rating: "4.5/5",
    version: "v2.1.0",
    statusText: "Available",
    statusType: "available",
    priceText: "From ₹499/mo",
    priceAmount: 499,
    actionText: "Install App",
    actionType: "install",
    isInstalled: false,
  },
  {
    id: "app-8",
    slug: "google-analytics-4",
    title: "Google Analytics 4",
    subtitle: "Web menu engagement tracking and visitor behavior telemetry.",
    vendor: "GOOGLE LLC",
    category: "Analytics",
    description:
      "Understand traffic and customer activity across supported digital ordering experiences and menu viewing trends.",
    badge: "Live",
    iconName: "insights",
    rating: "4.8/5",
    version: "v4.0.0",
    statusText: "Installed & Active",
    statusType: "live",
    priceText: "Free",
    priceAmount: 0,
    actionText: "Open Dashboard",
    actionType: "open",
    isInstalled: true,
  },
  {
    id: "app-9",
    slug: "google-tag-manager",
    title: "Google Tag Manager",
    subtitle: "Conversion tracking tags and digital marketing container.",
    vendor: "GOOGLE LLC",
    category: "Analytics",
    description:
      "Deploy custom tracking tags and conversion events across your web storefront without altering POS terminal code.",
    badge: "Available",
    iconName: "label",
    rating: "4.7/5",
    version: "v2.0.0",
    statusText: "Available",
    statusType: "available",
    priceText: "Free",
    priceAmount: 0,
    actionText: "Install App",
    actionType: "install",
    isInstalled: false,
  },
  {
    id: "app-10",
    slug: "meta-pixel",
    title: "Meta Pixel",
    subtitle: "Instagram and Facebook advertising conversion tracking.",
    vendor: "META",
    category: "Marketing",
    description:
      "Track customer acquisition and optimize Instagram & Facebook dining ads with server-side conversion API triggers.",
    badge: "Available",
    iconName: "ads_click",
    rating: "4.6/5",
    version: "v1.2.0",
    statusText: "Available",
    statusType: "available",
    priceText: "Free",
    priceAmount: 0,
    actionText: "Install App",
    actionType: "install",
    isInstalled: false,
  },
  {
    id: "app-11",
    slug: "customer-feedback-surveys",
    title: "Customer Feedback & Surveys",
    subtitle: "Real-time table ratings and manager incident escalation.",
    vendor: "PREST CORE",
    category: "Operations",
    description:
      "Tabletop QR feedback and instant manager escalation for negative guest ratings before diners depart the dining room.",
    badge: "Live",
    iconName: "reviews",
    rating: "4.9/5",
    version: "v3.0.0",
    statusText: "Installed & Active",
    statusType: "live",
    priceText: "Included with POS",
    priceAmount: 0,
    actionText: "Settings",
    actionType: "settings",
    isInstalled: true,
  },
  {
    id: "app-12",
    slug: "prest-loyalty-rewards",
    title: "PREST Loyalty & Rewards",
    subtitle: "Tiered points program and automated guest return incentives.",
    vendor: "PREST ECOSYSTEM",
    category: "Loyalty & Rewards",
    description:
      "Automated tier accrual, guest lifetime points, and WhatsApp promotional vouchers directly integrated with table tickets.",
    badge: "Available",
    iconName: "loyalty",
    rating: "4.8/5",
    version: "v2.2.0",
    statusText: "Available",
    statusType: "available",
    priceText: "₹1,499/mo",
    priceAmount: 1499,
    actionText: "Purchase App",
    actionType: "purchase",
    isInstalled: false,
  },
];

export function filterAndSortApps(
  apps: MarketplaceApp[],
  category: MarketplaceCategory,
  searchQuery: string,
  sortOption: MarketplaceSortOption,
  tab: string = "explore"
): MarketplaceApp[] {
  let result = [...apps];

  // Tab Filtering
  if (tab === "installed") {
    result = result.filter((app) => app.isInstalled);
  } else if (tab === "purchases") {
    result = result.filter((app) => app.priceAmount > 0);
  }

  // Category Filtering
  if (category !== "all") {
    result = result.filter((app) => app.category === category);
  }

  // Search Query
  if (searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter(
      (app) =>
        app.title.toLowerCase().includes(q) ||
        app.vendor.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q)
    );
  }

  // Sorting
  switch (sortOption) {
    case "a-z":
      result.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "price-low-high":
      result.sort((a, b) => a.priceAmount - b.priceAmount);
      break;
    case "recently-added":
      result.reverse();
      break;
    case "recommended":
    default:
      // Keep curated order
      break;
  }

  return result;
}
