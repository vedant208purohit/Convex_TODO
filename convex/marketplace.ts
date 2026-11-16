import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import {
  requireAdmin,
  resolveStoreOrganization,
} from "./organizationUsers";

// -------------------------------------------------------------------------
// DEFAULT MARKETPLACE CATALOG DATA
// -------------------------------------------------------------------------

export const DEFAULT_CATALOG_LISTINGS = [
  {
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
    practicalFeatures: [
      {
        icon: "update",
        title: "Automated Order Status",
        description:
          "Instant real-time kitchen updates pushed directly to guest chats (Accepted, Preparing, Out for Delivery, Ready for Pickup).",
      },
      {
        icon: "receipt_long",
        title: "Digital E-Bill Dispatch",
        description:
          "Zero-friction thermal paperless slips sent directly to guest WhatsApp with downloadable GST tax invoice PDF and quick tipping link.",
      },
      {
        icon: "forward_to_inbox",
        title: "1-Click Guest Re-Engagement",
        description:
          "Targeted anniversary perks and private tasting invitations automatically scheduled for dine-in guests absent for >30 consecutive days.",
      },
      {
        icon: "notifications_active",
        title: "Staff Notification Channel",
        description:
          "Instant VIP table escalation alerts, sommelier summons, and long-ticket delays dispatched immediately to the floor manager WhatsApp group.",
      },
    ],
    prerequisites: [
      {
        icon: "check_circle",
        title: "Meta / WhatsApp Business API Account",
        detail:
          "Verified Meta Business Manager ID with an approved WhatsApp display name.",
      },
      {
        icon: "check_circle",
        title: "Active PREST Cloud POS Connection",
        detail:
          "Online sync enabled for active register terminal and kitchen printers.",
      },
      {
        icon: "domain",
        title: "Compatible Outlets",
        detail:
          "The Grand Bistro HQ (All 3 Floors & Rooftop Terrace Lounge).",
      },
    ],
    permissions: [
      "Order Read-Only",
      "Guest Phone (Encrypted)",
      "Outbound Webhooks",
    ],
    terms: {
      licenseType: "One-time Lifetime Organization License",
      platformSurcharge: "₹0.00 (Zero Wallet Convenience Fee)",
      taxes: "Included in Demo Rate",
    },
    isPublished: true,
    displayOrder: 1,
  },
  {
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
    isOneTime: true,
    actionText: "Start Setup",
    actionType: "setup",
    isPublished: true,
    displayOrder: 2,
  },
  {
    slug: "razorpay",
    title: "Razorpay",
    subtitle: "Accept UPI, Cards, Wallets, EMI and Net Banking payments.",
    vendor: "RAZORPAY",
    category: "Payments",
    description:
      "Accept UPI, Cards, Wallets, EMI and Net Banking payments.",
    badge: "Recommended for India",
    iconName: "razorpay",
    rating: "4.9/5",
    version: "v3.1.2",
    statusText: "Not Connected",
    statusType: "available",
    priceText: "Pay-as-you-go (1.9% per txn)",
    priceAmount: 0,
    isOneTime: true,
    actionText: "Connect",
    actionType: "install",
    isPublished: true,
    displayOrder: 3,
  },
  {
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
    isOneTime: true,
    actionText: "Fix Connection",
    actionType: "fix",
    isPublished: true,
    displayOrder: 4,
  },
  {
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
    isOneTime: true,
    actionText: "Install App",
    actionType: "install",
    isPublished: true,
    displayOrder: 5,
  },
  {
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
    isOneTime: true,
    actionText: "View Details",
    actionType: "details",
    isPublished: true,
    displayOrder: 6,
  },
  {
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
    isOneTime: false,
    actionText: "Install App",
    actionType: "install",
    isPublished: true,
    displayOrder: 7,
  },
  {
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
    isOneTime: true,
    actionText: "Open Dashboard",
    actionType: "open",
    isPublished: true,
    displayOrder: 8,
  },
  {
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
    isOneTime: true,
    actionText: "Install App",
    actionType: "install",
    isPublished: true,
    displayOrder: 9,
  },
  {
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
    isOneTime: true,
    actionText: "Install App",
    actionType: "install",
    isPublished: true,
    displayOrder: 10,
  },
  {
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
    isOneTime: true,
    actionText: "Settings",
    actionType: "settings",
    isPublished: true,
    displayOrder: 11,
  },
  {
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
    isOneTime: false,
    actionText: "Purchase App",
    actionType: "purchase",
    isPublished: true,
    displayOrder: 12,
  },
];

// Initial seed transactions for wallet ledger consistency
export const INITIAL_LEDGER_SEEDS = [
  {
    code: "TXN-994820",
    type: "topup",
    typeLabel: "Top-up",
    amount: 10000,
    balanceBefore: 4500,
    balanceAfter: 14500,
    description: "Wallet Top-up",
    detail: "(via UPI - HDFC Bank)",
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "View Receipt",
    paymentMethod: "upi",
    relativeMinutesAgo: 60 * 24 * 9, // ~9 days ago
  },
  {
    code: "TXN-982144",
    type: "subscription",
    typeLabel: "Subscription",
    amount: -999,
    balanceBefore: 5499,
    balanceAfter: 4500,
    description: "WhatsApp Catalog & Direct Order",
    detail: "(Monthly)",
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "Invoice",
    paymentMethod: "wallet_escrow",
    relativeMinutesAgo: 60 * 24 * 11,
  },
  {
    code: "TXN-973002",
    type: "purchase",
    typeLabel: "Purchase",
    amount: -2500,
    balanceBefore: 7999,
    balanceAfter: 5499,
    description: "PhonePe PG Integration Setup Fee",
    detail: "",
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "Invoice",
    paymentMethod: "wallet_escrow",
    relativeMinutesAgo: 60 * 24 * 14,
  },
  {
    code: "TXN-962119",
    type: "topup",
    typeLabel: "Top-up",
    amount: 5000,
    balanceBefore: 2999,
    balanceAfter: 7999,
    description: "Wallet Top-up",
    detail: "(via Net Banking - ICICI)",
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "View Receipt",
    paymentMethod: "netbanking",
    relativeMinutesAgo: 60 * 24 * 19,
  },
  {
    code: "TXN-950183",
    type: "topup",
    typeLabel: "Top-up",
    amount: 2000,
    balanceBefore: 2999,
    balanceAfter: 2999,
    description: "Top-up Attempt",
    detail: "(UPI QR)",
    status: "pending",
    statusLabel: "Pending",
    actionText: "Check Status",
    paymentMethod: "upi",
    relativeMinutesAgo: 60 * 24 * 24,
  },
  {
    code: "TXN-941092",
    type: "purchase",
    typeLabel: "Purchase",
    amount: -12000,
    balanceBefore: 14999,
    balanceAfter: 2999,
    description: "Zomato Dine-in Sync Extension",
    detail: "(Annual Plan)",
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "Invoice",
    paymentMethod: "wallet_escrow",
    relativeMinutesAgo: 60 * 24 * 31,
  },
  {
    code: "TXN-938812",
    type: "topup",
    typeLabel: "Top-up",
    amount: 30000,
    balanceBefore: 0,
    balanceAfter: 30000,
    description: "Initial Organization Wallet Provisioning",
    detail: "(Wire Transfer)",
    status: "confirmed",
    statusLabel: "Confirmed",
    actionText: "View Receipt",
    paymentMethod: "wire",
    relativeMinutesAgo: 60 * 24 * 39,
  },
];

// -------------------------------------------------------------------------
// INTERNAL HELPERS
// -------------------------------------------------------------------------

/**
 * Ensures global marketplace listings exist; seeds them if missing.
 */
export async function ensureCatalogSeeded(ctx: MutationCtx | QueryCtx) {
  const existingCount = (await ctx.db.query("marketplaceListings").take(1)).length;
  if (existingCount > 0) return;

  if (!("insert" in ctx.db)) return; // QueryCtx cannot insert
  const mutationDb = (ctx as MutationCtx).db;

  const now = Date.now();
  for (const item of DEFAULT_CATALOG_LISTINGS) {
    await mutationDb.insert("marketplaceListings", {
      ...item,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Resolves a marketplace listing by Convex Id, slug, fake_id index, or title.
 */
export async function resolveListing(
  ctx: MutationCtx | QueryCtx,
  appIdOrSlug: string
): Promise<Doc<"marketplaceListings"> | null> {
  let listing: Doc<"marketplaceListings"> | null = null;
  try {
    listing = await ctx.db.get(appIdOrSlug as Id<"marketplaceListings">);
  } catch {
    // not raw ID
  }

  if (!listing) {
    listing = await ctx.db
      .query("marketplaceListings")
      .withIndex("by_slug", (q) => q.eq("slug", appIdOrSlug))
      .first();
  }

  if (!listing && appIdOrSlug.startsWith("fake_id_")) {
    const idx = parseInt(appIdOrSlug.replace("fake_id_", ""), 10);
    if (!isNaN(idx) && DEFAULT_CATALOG_LISTINGS[idx]) {
      const targetSlug = DEFAULT_CATALOG_LISTINGS[idx].slug;
      listing = await ctx.db
        .query("marketplaceListings")
        .withIndex("by_slug", (q) => q.eq("slug", targetSlug))
        .first();
    }
  }

  if (!listing) {
    const fallback = DEFAULT_CATALOG_LISTINGS.find(
      (l, idx) =>
        l.slug === appIdOrSlug ||
        l.title.toLowerCase() === appIdOrSlug.toLowerCase() ||
        `fake_id_${idx}` === appIdOrSlug
    );
    if (fallback) {
      listing = await ctx.db
        .query("marketplaceListings")
        .withIndex("by_slug", (q) => q.eq("slug", fallback.slug))
        .first();
    }
  }

  return listing;
}

/**
 * Resolves or seeds the organization's billing wallet and default ledger records.
 */
export async function getOrCreateWallet(
  ctx: MutationCtx | QueryCtx,
  organizationId: Id<"organizations">
): Promise<Doc<"marketplaceWallets">> {
  const existing = await ctx.db
    .query("marketplaceWallets")
    .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
    .first();

  if (existing) return existing;

  if (!("insert" in ctx.db)) {
    // Read-only fallback mock structure if query context cannot mutate
    return {
      _id: "placeholder" as Id<"marketplaceWallets">,
      _creationTime: Date.now(),
      organizationId,
      balance: 14500,
      escrowId: "PRST-WLT-88219",
      currency: "INR",
      autoTopupEnabled: false,
      autoTopupThreshold: 2000,
      autoTopupAmount: 5000,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  const mutationDb = (ctx as MutationCtx).db;
  const now = Date.now();

  const walletId = await mutationDb.insert("marketplaceWallets", {
    organizationId,
    balance: 14500,
    escrowId: `PRST-WLT-${Math.floor(10000 + Math.random() * 90000)}`,
    currency: "INR",
    autoTopupEnabled: false,
    autoTopupThreshold: 2000,
    autoTopupAmount: 5000,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  // Seed default historical transactions
  for (const seed of INITIAL_LEDGER_SEEDS) {
    const txTime = now - seed.relativeMinutesAgo * 60 * 1000;
    await mutationDb.insert("marketplaceTransactions", {
      organizationId,
      walletId,
      code: seed.code,
      type: seed.type,
      typeLabel: seed.typeLabel,
      amount: seed.amount,
      balanceBefore: seed.balanceBefore,
      balanceAfter: seed.balanceAfter,
      description: seed.description,
      detail: seed.detail,
      status: seed.status,
      statusLabel: seed.statusLabel,
      actionText: seed.actionText,
      paymentMethod: seed.paymentMethod,
      initiatedByUserId: "system_bootstrap",
      createdAt: txTime,
    });
  }

  // Pre-seed initial installed apps for WhatsApp Business, GA4, Surveys
  const preInstalledSlugs = [
    { slug: "whatsapp-business", status: "installed", actionType: "setup", isPaid: false },
    { slug: "phonepe-payment-gateway", status: "attention", actionType: "fix", isPaid: false },
    { slug: "google-analytics-4", status: "live", actionType: "open", isPaid: false },
    { slug: "customer-feedback-surveys", status: "live", actionType: "settings", isPaid: false },
  ];

  const allListings = await mutationDb.query("marketplaceListings").collect();
  for (const item of preInstalledSlugs) {
    const listing = allListings.find((l) => l.slug === item.slug);
    if (listing) {
      await mutationDb.insert("marketplaceInstallations", {
        organizationId,
        listingId: listing._id,
        appSlug: listing.slug,
        status: item.status,
        statusText: listing.statusText,
        actionType: item.actionType,
        isPaid: item.isPaid,
        licenseType: "free",
        installedAt: now - 86400000 * 5,
        installedByUserId: "system_bootstrap",
        createdAt: now - 86400000 * 5,
        updatedAt: now - 86400000 * 5,
      });
    }
  }

  return (await mutationDb.get(walletId))!;
}

// -------------------------------------------------------------------------
// PUBLIC CONVEX QUERIES
// -------------------------------------------------------------------------

/**
 * Retrieves the full marketplace catalog with organization-specific installation state.
 */
export const listCatalog = query({
  args: {
    explicitOrgId: v.optional(v.id("organizations")),
    category: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    sortOption: v.optional(v.string()),
    tab: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Resolve store organization
    const org = await resolveStoreOrganization(ctx, args.explicitOrgId);

    // 2. Fetch catalog listings
    let listings = await ctx.db
      .query("marketplaceListings")
      .withIndex("by_published", (q) => q.eq("isPublished", true))
      .collect();

    // Fallback to static catalog if table hasn't been seeded by mutation yet
    if (listings.length === 0) {
      listings = DEFAULT_CATALOG_LISTINGS.map((l, idx) => ({
        ...l,
        _id: `fake_id_${idx}` as unknown as Id<"marketplaceListings">,
        _creationTime: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    }

    // 3. Fetch current organization's installations
    const installations = await ctx.db
      .query("marketplaceInstallations")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();

    const activeInstallations = installations.filter((inst) => inst.status !== "uninstalled");
    const installedMap = new Map(activeInstallations.map((inst) => [inst.appSlug, inst]));

    // Check payment gateway connections for this store organization
    const paymentConnections = await ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();

    const razorpayConn = paymentConnections.find(
      (c) => c.provider === "razorpay" && c.status !== "disconnected"
    );

    // 4. Merge listings with organization installation state
    let apps = listings.map((l) => {
      const inst = installedMap.get(l.slug);
      let isInstalled = Boolean(inst);

      let statusText = l.statusText;
      let statusType = l.statusType;
      let actionText = l.actionText;
      let actionType = l.actionType;

      if (isInstalled && inst) {
        if (inst.statusText) statusText = inst.statusText;
        if (inst.status) statusType = inst.status;
        if (inst.actionType) actionType = inst.actionType;

        if (inst.status === "installed") {
          statusText = "Installed — Setup Required";
          actionText = "Start Setup";
          actionType = "setup";
        } else if (inst.status === "live") {
          statusText = "Installed & Active";
          actionText = l.slug === "google-analytics-4" ? "Open Dashboard" : "Settings";
          actionType = l.slug === "google-analytics-4" ? "open" : "settings";
        } else if (inst.status === "attention") {
          statusText = "Connection Needs Attention";
          actionText = "Fix Connection";
          actionType = "fix";
        }
      }

      // Check authoritative payment gateway connection for Razorpay
      if (l.slug === "razorpay") {
        if (razorpayConn) {
          if (razorpayConn.status === "connected") {
            isInstalled = true;
            statusText = "Connected & Active";
            statusType = "live";
            actionText = "Open Dashboard";
            actionType = "open";
          } else if (razorpayConn.status === "needs_attention" || razorpayConn.status === "error") {
            isInstalled = true;
            statusText = "Connection Needs Attention";
            statusType = "attention";
            actionText = "Fix Connection";
            actionType = "fix";
          } else if (razorpayConn.status === "pending") {
            statusText = "Verification In Progress";
            statusType = "pending";
            actionText = "Verifying...";
            actionType = "pending";
          }
        }
      }

      const effectiveId =
        typeof l._id === "string" && (l._id.startsWith("fake_id_") || l._id === l.slug)
          ? l.slug
          : (l._id as string);

      return {
        id: effectiveId,
        slug: l.slug,
        title: l.title,
        subtitle: l.subtitle,
        vendor: l.vendor,
        category: l.category,
        description: l.description,
        badge:
          l.slug === "razorpay" && razorpayConn?.status === "connected"
            ? "Connected"
            : isInstalled
              ? "Installed"
              : l.badge,
        iconName: l.iconName,
        rating: l.rating,
        version: l.version,
        statusText,
        statusType,
        priceText: l.priceText,
        priceAmount: l.priceAmount,
        isOneTime: l.isOneTime,
        actionText,
        actionType,
        isInstalled,
        installedAt: inst?.installedAt || razorpayConn?.connectedAt,
        practicalFeatures: l.practicalFeatures,
        prerequisites: l.prerequisites,
        permissions: l.permissions,
        terms: l.terms,
        configuration:
          l.slug === "razorpay" && razorpayConn
            ? {
                connected: razorpayConn.status === "connected",
                status: razorpayConn.status,
                accountMode: razorpayConn.accountMode,
                merchantName: razorpayConn.merchantName,
                providerAccountId: razorpayConn.providerAccountId,
              }
            : inst?.configuration,
      };
    });

    // 5. Apply Tab Filtering
    const activeTab = args.tab || "explore";
    if (activeTab === "installed") {
      apps = apps.filter((app) => app.isInstalled);
    } else if (activeTab === "purchases") {
      // Subscriptions & Purchases tab: includes connected subscriptions (such as Razorpay) and paid apps
      apps = apps.filter(
        (app) => (app.priceAmount > 0 || app.slug === "razorpay") && app.isInstalled
      );
    }

    // 6. Apply Category Filtering
    if (args.category && args.category !== "all") {
      apps = apps.filter((app) => app.category === args.category);
    }

    // 7. Apply Search Filtering
    if (args.searchQuery && args.searchQuery.trim().length > 0) {
      const q = args.searchQuery.toLowerCase().trim();
      apps = apps.filter(
        (app) =>
          app.title.toLowerCase().includes(q) ||
          app.vendor.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q) ||
          app.category.toLowerCase().includes(q)
      );
    }

    // 8. Apply Sorting
    switch (args.sortOption) {
      case "a-z":
        apps.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "price-low-high":
        apps.sort((a, b) => a.priceAmount - b.priceAmount);
        break;
      case "recently-added":
        apps.reverse();
        break;
      case "recommended":
      default:
        // Preserves default curated order
        break;
    }

    return {
      apps,
      totalCount: apps.length,
      organizationId: org._id,
      storeName: org.name,
    };
  },
});

/**
 * Retrieves a single marketplace listing by ID or Slug.
 */
export const getListing = query({
  args: {
    appIdOrSlug: v.string(),
    explicitOrgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.explicitOrgId);

    let listing = await resolveListing(ctx, args.appIdOrSlug);

    // Fallback to static catalog if unseeded
    if (!listing) {
      const idx = args.appIdOrSlug.startsWith("fake_id_")
        ? parseInt(args.appIdOrSlug.replace("fake_id_", ""), 10)
        : -1;
      const found =
        (!isNaN(idx) && idx >= 0 && DEFAULT_CATALOG_LISTINGS[idx]) ||
        DEFAULT_CATALOG_LISTINGS.find(
          (l) => l.slug === args.appIdOrSlug || l.title === args.appIdOrSlug
        );
      if (found) {
        listing = {
          ...found,
          _id: found.slug as unknown as Id<"marketplaceListings">,
          _creationTime: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
    }

    if (!listing) return null;

    // Check organization installation
    const inst = await ctx.db
      .query("marketplaceInstallations")
      .withIndex("by_org_and_app", (q) =>
        q.eq("organizationId", org._id).eq("appSlug", listing!.slug)
      )
      .first();

    const isInstalled = Boolean(inst && inst.status !== "uninstalled");

    return {
      ...listing,
      id: listing._id,
      isInstalled,
      installation: inst && inst.status !== "uninstalled" ? inst : null,
    };
  },
});

/**
 * Retrieves the organization's billing wallet balance and status.
 */
export const getWallet = query({
  args: {
    explicitOrgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.explicitOrgId);
    const wallet = await getOrCreateWallet(ctx, org._id);

    return {
      ...wallet,
      storeName: org.name,
      currencySymbol: "₹",
    };
  },
});

/**
 * Retrieves the organization's wallet transaction ledger.
 */
export const listTransactions = query({
  args: {
    explicitOrgId: v.optional(v.id("organizations")),
    type: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.explicitOrgId);

    let transactions = await ctx.db
      .query("marketplaceTransactions")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .order("desc")
      .collect();

    // Fallback if not yet initialized
    if (transactions.length === 0) {
      const now = Date.now();
      transactions = INITIAL_LEDGER_SEEDS.map((s, idx) => ({
        _id: `tx_fake_${idx}` as Id<"marketplaceTransactions">,
        _creationTime: now - s.relativeMinutesAgo * 60000,
        organizationId: org._id,
        walletId: "wallet_fake" as Id<"marketplaceWallets">,
        code: s.code,
        type: s.type,
        typeLabel: s.typeLabel,
        amount: s.amount,
        balanceBefore: s.balanceBefore,
        balanceAfter: s.balanceAfter,
        description: s.description,
        detail: s.detail,
        status: s.status,
        statusLabel: s.statusLabel,
        actionText: s.actionText,
        paymentMethod: s.paymentMethod,
        initiatedByUserId: "system_bootstrap",
        createdAt: now - s.relativeMinutesAgo * 60000,
      }));
    }

    // 1. Filter by type
    if (args.type && args.type !== "all") {
      transactions = transactions.filter((tx) => tx.type === args.type);
    }

    // 2. Filter by search query
    if (args.searchQuery && args.searchQuery.trim().length > 0) {
      const q = args.searchQuery.toLowerCase().trim();
      transactions = transactions.filter(
        (tx) =>
          tx.code.toLowerCase().includes(q) ||
          tx.description.toLowerCase().includes(q) ||
          (tx.detail && tx.detail.toLowerCase().includes(q))
      );
    }

    // 3. Filter by date range
    if (args.startDate !== undefined) {
      transactions = transactions.filter((tx) => tx.createdAt >= args.startDate!);
    }
    if (args.endDate !== undefined) {
      transactions = transactions.filter((tx) => tx.createdAt <= args.endDate!);
    }

    if (args.limit && args.limit > 0) {
      transactions = transactions.slice(0, args.limit);
    }

    // Format for frontend
    return transactions.map((tx) => ({
      id: tx._id,
      code: tx.code,
      dateTime: new Date(tx.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      description: tx.description,
      detail: tx.detail || "",
      type: tx.type,
      typeLabel: tx.typeLabel,
      amount: tx.amount,
      status: tx.status,
      statusLabel: tx.statusLabel,
      actionText: tx.actionText,
    }));
  },
});

/**
 * Lists active installed applications for the store organization.
 */
export const listInstallations = query({
  args: {
    explicitOrgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.explicitOrgId);

    const installations = await ctx.db
      .query("marketplaceInstallations")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .collect();

    return installations.filter((inst) => inst.status !== "uninstalled");
  },
});

// -------------------------------------------------------------------------
// PUBLIC CONVEX MUTATIONS
// -------------------------------------------------------------------------

/**
 * Initializes/seeds default catalog listings and organization wallet.
 */
export const initializeMarketplace = mutation({
  args: {
    explicitOrgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdmin(ctx, args.explicitOrgId);
    await ensureCatalogSeeded(ctx);
    const wallet = await getOrCreateWallet(ctx, org._id);
    return { success: true, walletId: wallet._id };
  },
});

/**
 * Installs a free marketplace app for the organization.
 */
export const installApp = mutation({
  args: {
    appIdOrSlug: v.string(),
    explicitOrgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { identity, org } = await requireAdmin(ctx, args.explicitOrgId);
    await ensureCatalogSeeded(ctx);

    // Resolve listing
    const listing = await resolveListing(ctx, args.appIdOrSlug);

    if (!listing) {
      throw new Error(`Marketplace app '${args.appIdOrSlug}' not found.`);
    }

    if (listing.priceAmount > 0) {
      throw new Error(
        `'${listing.title}' requires purchase. Please use the purchase workflow.`
      );
    }

    // Check existing installation
    const existing = await ctx.db
      .query("marketplaceInstallations")
      .withIndex("by_org_and_app", (q) =>
        q.eq("organizationId", org._id).eq("appSlug", listing!.slug)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "installed",
        uninstalledAt: undefined,
        updatedAt: now,
      });
      return { success: true, installationId: existing._id };
    }

    const installationId = await ctx.db.insert("marketplaceInstallations", {
      organizationId: org._id,
      listingId: listing._id,
      appSlug: listing.slug,
      status: "installed",
      statusText: "Installed — Setup Required",
      actionType: "setup",
      isPaid: false,
      licenseType: "free",
      installedAt: now,
      installedByUserId: identity.subject,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, installationId };
  },
});

/**
 * Purchases an application using the organization's billing wallet balance.
 */
export const purchaseApp = mutation({
  args: {
    appIdOrSlug: v.string(),
    explicitOrgId: v.optional(v.id("organizations")),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity, org } = await requireAdmin(ctx, args.explicitOrgId);
    await ensureCatalogSeeded(ctx);

    // 1. Idempotency Check
    if (args.idempotencyKey) {
      const existingTx = await ctx.db
        .query("marketplaceTransactions")
        .withIndex("by_idempotency", (q) =>
          q.eq("organizationId", org._id).eq("idempotencyKey", args.idempotencyKey!)
        )
        .first();

      if (existingTx) {
        const wallet = await getOrCreateWallet(ctx, org._id);
        return {
          success: true,
          transactionCode: existingTx.code,
          newBalance: wallet.balance,
          idempotentReplay: true,
        };
      }
    }

    // 2. Resolve Listing
    const listing = await resolveListing(ctx, args.appIdOrSlug);

    if (!listing) {
      throw new Error(`Marketplace app '${args.appIdOrSlug}' not found.`);
    }

    // 3. Resolve Wallet & Check Balance
    const wallet = await getOrCreateWallet(ctx, org._id);
    const price = listing.priceAmount > 0 ? listing.priceAmount : 5000;

    if (wallet.balance < price) {
      throw new Error(
        `Insufficient wallet balance (Available: ₹${wallet.balance.toLocaleString(
          "en-IN"
        )}, Required: ₹${price.toLocaleString("en-IN")}). Please add money.`
      );
    }

    const now = Date.now();
    const newBalance = wallet.balance - price;
    const txCode = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;

    // 4. Atomic Wallet Debit
    await ctx.db.patch(wallet._id, {
      balance: newBalance,
      updatedAt: now,
    });

    // 5. Insert Immutable Transaction Ledger Row
    await ctx.db.insert("marketplaceTransactions", {
      organizationId: org._id,
      walletId: wallet._id,
      code: txCode,
      type: listing.isOneTime ? "purchase" : "subscription",
      typeLabel: listing.isOneTime ? "Purchase" : "Subscription",
      amount: -price,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      description: listing.title,
      detail: listing.isOneTime ? "(Lifetime License)" : "(Monthly)",
      status: "confirmed",
      statusLabel: "Confirmed",
      actionText: "Invoice",
      appSlug: listing.slug,
      paymentMethod: "wallet_escrow",
      idempotencyKey: args.idempotencyKey,
      initiatedByUserId: identity.subject,
      createdAt: now,
    });

    // 6. Record or Update Installation Record
    const existingInst = await ctx.db
      .query("marketplaceInstallations")
      .withIndex("by_org_and_app", (q) =>
        q.eq("organizationId", org._id).eq("appSlug", listing!.slug)
      )
      .first();

    if (existingInst) {
      await ctx.db.patch(existingInst._id, {
        status: "installed",
        statusText: "Installed — Setup Required",
        actionType: "setup",
        isPaid: true,
        purchasedAt: now,
        uninstalledAt: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("marketplaceInstallations", {
        organizationId: org._id,
        listingId: listing._id,
        appSlug: listing.slug,
        status: "installed",
        statusText: "Installed — Setup Required",
        actionType: "setup",
        isPaid: true,
        licenseType: listing.isOneTime ? "one_time" : "subscription",
        purchasedAt: now,
        installedAt: now,
        installedByUserId: identity.subject,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      transactionCode: txCode,
      newBalance,
      appTitle: listing.title,
    };
  },
});

/**
 * Credits the organization's billing wallet with an escrow deposit.
 */
export const topupWallet = mutation({
  args: {
    amount: v.number(),
    paymentMethod: v.string(), // "upi" | "netbanking" | "card" | "wire"
    explicitOrgId: v.optional(v.id("organizations")),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity, org } = await requireAdmin(ctx, args.explicitOrgId);

    // Validate limits
    if (args.amount < 500 || args.amount > 100000) {
      throw new Error(
        "Deposit amount must be between ₹500.00 and ₹1,00,000.00 INR."
      );
    }

    // Idempotency check
    if (args.idempotencyKey) {
      const existingTx = await ctx.db
        .query("marketplaceTransactions")
        .withIndex("by_idempotency", (q) =>
          q.eq("organizationId", org._id).eq("idempotencyKey", args.idempotencyKey!)
        )
        .first();

      if (existingTx) {
        const wallet = await getOrCreateWallet(ctx, org._id);
        return {
          success: true,
          transactionCode: existingTx.code,
          newBalance: wallet.balance,
          idempotentReplay: true,
        };
      }
    }

    const wallet = await getOrCreateWallet(ctx, org._id);
    const now = Date.now();
    const newBalance = wallet.balance + args.amount;
    const txCode = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;

    // Atomic Balance Credit
    await ctx.db.patch(wallet._id, {
      balance: newBalance,
      lastTopupAt: now,
      updatedAt: now,
    });

    const methodDetail =
      args.paymentMethod === "upi"
        ? "(via Instant UPI)"
        : args.paymentMethod === "netbanking"
          ? "(via Net Banking)"
          : args.paymentMethod === "card"
            ? "(via Corporate Card)"
            : "(via Escrow Transfer)";

    // Insert Ledger Record
    await ctx.db.insert("marketplaceTransactions", {
      organizationId: org._id,
      walletId: wallet._id,
      code: txCode,
      type: "topup",
      typeLabel: "Top-up",
      amount: args.amount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      description: "Wallet Top-up",
      detail: methodDetail,
      status: "confirmed",
      statusLabel: "Confirmed",
      actionText: "View Receipt",
      paymentMethod: args.paymentMethod,
      idempotencyKey: args.idempotencyKey,
      initiatedByUserId: identity.subject,
      createdAt: now,
    });

    return {
      success: true,
      transactionCode: txCode,
      newBalance,
    };
  },
});

/**
 * Configures automated wallet top-up parameters.
 */
export const updateAutoTopup = mutation({
  args: {
    enabled: v.boolean(),
    threshold: v.optional(v.number()),
    amount: v.optional(v.number()),
    explicitOrgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdmin(ctx, args.explicitOrgId);
    const wallet = await getOrCreateWallet(ctx, org._id);

    const now = Date.now();
    await ctx.db.patch(wallet._id, {
      autoTopupEnabled: args.enabled,
      ...(args.threshold !== undefined ? { autoTopupThreshold: args.threshold } : {}),
      ...(args.amount !== undefined ? { autoTopupAmount: args.amount } : {}),
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Updates application configuration, credentials reference, or operational status.
 */
export const updateInstallationConfig = mutation({
  args: {
    appIdOrSlug: v.string(),
    status: v.optional(v.string()), // "installed" | "live" | "attention"
    statusText: v.optional(v.string()),
    configuration: v.optional(v.any()),
    explicitOrgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdmin(ctx, args.explicitOrgId);

    const inst = await ctx.db
      .query("marketplaceInstallations")
      .withIndex("by_org_and_app", (q) =>
        q.eq("organizationId", org._id).eq("appSlug", args.appIdOrSlug)
      )
      .first();

    if (!inst) {
      throw new Error(`Application '${args.appIdOrSlug}' is not installed.`);
    }

    const now = Date.now();
    await ctx.db.patch(inst._id, {
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.statusText !== undefined ? { statusText: args.statusText } : {}),
      ...(args.configuration !== undefined ? { configuration: args.configuration } : {}),
      lastSyncedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Uninstalls a marketplace application from the store.
 */
export const uninstallApp = mutation({
  args: {
    appIdOrSlug: v.string(),
    explicitOrgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { org } = await requireAdmin(ctx, args.explicitOrgId);

    const inst = await ctx.db
      .query("marketplaceInstallations")
      .withIndex("by_org_and_app", (q) =>
        q.eq("organizationId", org._id).eq("appSlug", args.appIdOrSlug)
      )
      .first();

    if (!inst || inst.status === "uninstalled") {
      return { success: true, alreadyUninstalled: true };
    }

    const now = Date.now();
    await ctx.db.patch(inst._id, {
      status: "uninstalled",
      uninstalledAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Records a pending Razorpay order in the organization's transaction ledger.
 */
export const recordPendingRazorpayTopup = mutation({
  args: {
    amount: v.number(),
    paymentMethod: v.string(), // "upi" | "netbanking" | "card"
    razorpayOrderId: v.string(),
    explicitOrgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    const { identity, org } = await requireAdmin(ctx, args.explicitOrgId);

    if (args.amount < 500 || args.amount > 100000) {
      throw new Error("Deposit amount must be between ₹500.00 and ₹1,00,000.00 INR.");
    }

    const wallet = await getOrCreateWallet(ctx, org._id);
    const now = Date.now();
    const txCode = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;

    const methodDetail =
      args.paymentMethod === "upi"
        ? "(via Instant UPI)"
        : args.paymentMethod === "netbanking"
          ? "(via Net Banking)"
          : args.paymentMethod === "card"
            ? "(via Corporate Card)"
            : "(via Escrow Transfer)";

    const txId = await ctx.db.insert("marketplaceTransactions", {
      organizationId: org._id,
      walletId: wallet._id,
      code: txCode,
      type: "topup",
      typeLabel: "Top-up",
      amount: args.amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance,
      description: "Wallet Top-up",
      detail: methodDetail,
      status: "pending",
      statusLabel: "Pending Authorization",
      actionText: "Processing",
      paymentMethod: args.paymentMethod,
      razorpayOrderId: args.razorpayOrderId,
      initiatedByUserId: identity.subject,
      createdAt: now,
    });

    return {
      transactionId: txId,
      transactionCode: txCode,
    };
  },
});

/**
 * Confirms a verified Razorpay payment, atomically crediting the organization's escrow wallet.
 * Enforces strict idempotency based on razorpayPaymentId.
 */
export const confirmRazorpayTopup = mutation({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.optional(v.string()),
    amount: v.number(),
    paymentMethod: v.optional(v.string()),
    explicitOrgId: v.optional(v.id("organizations")),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity, org } = await requireAdmin(ctx, args.explicitOrgId);
    const wallet = await getOrCreateWallet(ctx, org._id);

    // 1. Idempotency Check via razorpayPaymentId
    const existingByPayment = await ctx.db
      .query("marketplaceTransactions")
      .withIndex("by_razorpay_payment_id", (q) =>
        q.eq("organizationId", org._id).eq("razorpayPaymentId", args.razorpayPaymentId)
      )
      .first();

    if (existingByPayment && existingByPayment.status === "confirmed") {
      return {
        success: true,
        transactionCode: existingByPayment.code,
        newBalance: wallet.balance,
        idempotentReplay: true,
      };
    }

    // 2. Locate any pending transaction created during order creation
    const pendingTx = await ctx.db
      .query("marketplaceTransactions")
      .withIndex("by_razorpay_order_id", (q) =>
        q.eq("organizationId", org._id).eq("razorpayOrderId", args.razorpayOrderId)
      )
      .first();

    const now = Date.now();
    const newBalance = wallet.balance + args.amount;
    const txCode = pendingTx ? pendingTx.code : `TXN-${Math.floor(100000 + Math.random() * 900000)}`;

    // 3. Atomically update wallet balance
    await ctx.db.patch(wallet._id, {
      balance: newBalance,
      lastTopupAt: now,
      updatedAt: now,
    });

    const methodDetail =
      args.paymentMethod === "upi"
        ? "(via Instant UPI)"
        : args.paymentMethod === "netbanking"
          ? "(via Net Banking)"
          : args.paymentMethod === "card"
            ? "(via Corporate Card)"
            : "(via Escrow Transfer)";

    if (pendingTx) {
      await ctx.db.patch(pendingTx._id, {
        status: "confirmed",
        statusLabel: "Confirmed",
        actionText: "View Receipt",
        balanceAfter: newBalance,
        razorpayPaymentId: args.razorpayPaymentId,
        razorpaySignature: args.razorpaySignature,
        paymentMethod: args.paymentMethod || pendingTx.paymentMethod,
        detail: methodDetail,
      });
    } else {
      await ctx.db.insert("marketplaceTransactions", {
        organizationId: org._id,
        walletId: wallet._id,
        code: txCode,
        type: "topup",
        typeLabel: "Top-up",
        amount: args.amount,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: "Wallet Top-up",
        detail: methodDetail,
        status: "confirmed",
        statusLabel: "Confirmed",
        actionText: "View Receipt",
        paymentMethod: args.paymentMethod,
        razorpayOrderId: args.razorpayOrderId,
        razorpayPaymentId: args.razorpayPaymentId,
        razorpaySignature: args.razorpaySignature,
        idempotencyKey: args.idempotencyKey,
        initiatedByUserId: identity.subject,
        createdAt: now,
      });
    }

    return {
      success: true,
      transactionCode: txCode,
      newBalance,
    };
  },
});
