/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Marketplace Backend Domain & Security Tests", () => {
  test("1. Catalog retrieval with default seeds, categories, search, and sorting", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Marketplace Test Bistro",
    });

    const admin = t.withIdentity({
      name: "Bistro Admin",
      email: "bistro_admin@prest.com",
      subject: "clerk_bistro_admin",
    });

    // Initialize marketplace
    await admin.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: orgId,
    });

    // 1. Full catalog query
    const catalog = await admin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
    });
    expect(catalog.apps.length).toBe(12);
    expect(catalog.storeName).toBe("Marketplace Test Bistro");

    // 2. Category filtering
    const paymentsCatalog = await admin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      category: "Payments",
    });
    expect(paymentsCatalog.apps.length).toBeGreaterThanOrEqual(4);
    paymentsCatalog.apps.forEach((a) => {
      expect(a.category).toBe("Payments");
    });

    // 3. Search query
    const searchCatalog = await admin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      searchQuery: "WhatsApp",
    });
    expect(searchCatalog.apps.length).toBe(3);
    expect(searchCatalog.apps.map((a) => a.slug)).toContain("prest-whatsapp-automation");
    expect(searchCatalog.apps.map((a) => a.slug)).toContain("whatsapp-business");
    expect(searchCatalog.apps.map((a) => a.slug)).toContain("prest-loyalty-rewards");

    // 4. Sorting (A-Z)
    const sortedCatalog = await admin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      sortOption: "a-z",
    });
    for (let i = 0; i < sortedCatalog.apps.length - 1; i++) {
      expect(
        sortedCatalog.apps[i].title.localeCompare(sortedCatalog.apps[i + 1].title)
      ).toBeLessThanOrEqual(0);
    }

    // 5. Single listing lookup
    const heroApp = await admin.query(api.marketplace.getListing, {
      appIdOrSlug: "prest-whatsapp-automation",
      explicitOrgId: orgId,
    });
    expect(heroApp).not.toBeNull();
    expect(heroApp?.title).toBe("PREST WhatsApp Automation");
    expect(heroApp?.priceAmount).toBe(5000);
    expect(heroApp?.practicalFeatures?.length).toBe(4);
  });

  test("2. Wallet balance retrieval, auto-initialization, and ledger listing", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Wallet Test Store",
    });

    const admin = t.withIdentity({
      name: "Wallet Admin",
      email: "wallet_admin@prest.com",
      subject: "clerk_wallet_admin",
    });

    // Initial wallet query
    const wallet = await admin.query(api.marketplace.getWallet, {
      explicitOrgId: orgId,
    });
    expect(wallet.balance).toBe(14500);
    expect(wallet.currency).toBe("INR");
    expect(wallet.status).toBe("active");

    // Initial ledger query
    const transactions = await admin.query(api.marketplace.listTransactions, {
      explicitOrgId: orgId,
    });
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions[0].code).toBeDefined();
    expect(transactions[0].status).toBeDefined();
  });

  test("3. Wallet top-up with limits validation, atomic credit, and ledger recording", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Topup Test Store",
    });

    const admin = t.withIdentity({
      name: "Topup Admin",
      email: "topup_admin@prest.com",
      subject: "clerk_topup_admin",
    });

    await admin.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: orgId,
    });

    // 1. Reject invalid limits
    await expect(
      admin.mutation(api.marketplace.topupWallet, {
        explicitOrgId: orgId,
        amount: 100, // below min 500
        paymentMethod: "upi",
      })
    ).rejects.toThrow("Deposit amount must be between ₹500.00 and ₹1,00,000.00 INR.");

    await expect(
      admin.mutation(api.marketplace.topupWallet, {
        explicitOrgId: orgId,
        amount: 150000, // above max 100000
        paymentMethod: "upi",
      })
    ).rejects.toThrow("Deposit amount must be between ₹500.00 and ₹1,00,000.00 INR.");

    // 2. Successful top-up
    const topupRes = await admin.mutation(api.marketplace.topupWallet, {
      explicitOrgId: orgId,
      amount: 5000,
      paymentMethod: "upi",
      idempotencyKey: "topup_key_001",
    });
    expect(topupRes.success).toBe(true);
    expect(topupRes.newBalance).toBe(14500 + 5000);

    // 3. Idempotent retry returns same balance without double credit
    const retryRes = await admin.mutation(api.marketplace.topupWallet, {
      explicitOrgId: orgId,
      amount: 5000,
      paymentMethod: "upi",
      idempotencyKey: "topup_key_001",
    });
    expect(retryRes.idempotentReplay).toBe(true);
    expect(retryRes.newBalance).toBe(14500 + 5000);

    // Verify ledger has top-up entry
    const updatedLedger = await admin.query(api.marketplace.listTransactions, {
      explicitOrgId: orgId,
      type: "topup",
    });
    const latestTx = updatedLedger[0];
    expect(latestTx.amount).toBe(5000);
    expect(latestTx.type).toBe("topup");
  });

  test("4. Free app installation and status transition", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Install Test Store",
    });

    const admin = t.withIdentity({
      name: "Install Admin",
      email: "install_admin@prest.com",
      subject: "clerk_install_admin",
    });

    await admin.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: orgId,
    });

    // Install free app (Cashfree Payments)
    const installRes = await admin.mutation(api.marketplace.installApp, {
      explicitOrgId: orgId,
      appIdOrSlug: "cashfree-payments",
    });
    expect(installRes.success).toBe(true);

    // Also test installing via fallback fake_id identifier (e.g. fake_id_4)
    const installFakeRes = await admin.mutation(api.marketplace.installApp, {
      explicitOrgId: orgId,
      appIdOrSlug: "fake_id_4",
    });
    expect(installFakeRes.success).toBe(true);

    // Check catalog reflects installed status
    const catalog = await admin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      tab: "installed",
    });
    const cashfree = catalog.apps.find((a) => a.slug === "cashfree-payments");
    expect(cashfree).toBeDefined();
    expect(cashfree?.isInstalled).toBe(true);

    // Rejection on attempting installApp for paid app
    await expect(
      admin.mutation(api.marketplace.installApp, {
        explicitOrgId: orgId,
        appIdOrSlug: "prest-whatsapp-automation",
      })
    ).rejects.toThrow("requires purchase");
  });

  test("5. Paid app purchase with atomic wallet debit and insufficient funds guard", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Purchase Test Store",
    });

    const admin = t.withIdentity({
      name: "Purchase Admin",
      email: "purchase_admin@prest.com",
      subject: "clerk_purchase_admin",
    });

    await admin.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: orgId,
    });

    // Initial wallet: 14,500
    // Purchase PREST WhatsApp Automation (₹5,000)
    const purchaseRes = await admin.mutation(api.marketplace.purchaseApp, {
      explicitOrgId: orgId,
      appIdOrSlug: "prest-whatsapp-automation",
      idempotencyKey: "purchase_wa_001",
    });
    expect(purchaseRes.success).toBe(true);
    expect(purchaseRes.newBalance).toBe(14500 - 5000);

    // Idempotent retry returns same balance
    const replayRes = await admin.mutation(api.marketplace.purchaseApp, {
      explicitOrgId: orgId,
      appIdOrSlug: "prest-whatsapp-automation",
      idempotencyKey: "purchase_wa_001",
    });
    expect(replayRes.idempotentReplay).toBe(true);
    expect(replayRes.newBalance).toBe(9500);

    // Verify catalog reflects installed state for hero app
    const catalog = await admin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      tab: "installed",
    });
    const wa = catalog.apps.find((a) => a.slug === "prest-whatsapp-automation");
    expect(wa?.isInstalled).toBe(true);

    // Deduct wallet balance below price and verify insufficient funds rejection
    // Let's purchase 1 more to drop to 4,500
    await admin.mutation(api.marketplace.purchaseApp, {
      explicitOrgId: orgId,
      appIdOrSlug: "prest-whatsapp-automation",
      idempotencyKey: "purchase_wa_002",
    });
    // Now balance is 9500 - 5000 = 4500

    // Next purchase requires 5000, wallet has 4500 -> must reject
    await expect(
      admin.mutation(api.marketplace.purchaseApp, {
        explicitOrgId: orgId,
        appIdOrSlug: "prest-whatsapp-automation",
        idempotencyKey: "purchase_wa_003",
      })
    ).rejects.toThrow("Insufficient wallet balance");
  });

  test("6. Multi-tenancy isolation and RBAC security enforcement", async () => {
    const t = convexTest(schema, modules);

    // Create Organization A and Organization B
    const orgAId = await t.mutation(api.organizations.create, {
      name: "Organization Alpha",
    });
    const orgBId = await t.mutation(api.organizations.create, {
      name: "Organization Beta",
    });

    const adminA = t.withIdentity({
      name: "Admin Alpha",
      email: "alpha@prest.com",
      subject: "clerk_alpha",
    });

    const adminB = t.withIdentity({
      name: "Admin Beta",
      email: "beta@prest.com",
      subject: "clerk_beta",
    });

    // 1. Initialize for Org A
    await adminA.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: orgAId,
    });

    // 2. Unauthenticated calls are rejected
    await expect(
      t.mutation(api.marketplace.purchaseApp, {
        explicitOrgId: orgAId,
        appIdOrSlug: "prest-whatsapp-automation",
      })
    ).rejects.toThrow("Unauthenticated");

    await expect(
      t.mutation(api.marketplace.topupWallet, {
        explicitOrgId: orgAId,
        amount: 2000,
        paymentMethod: "upi",
      })
    ).rejects.toThrow("Unauthenticated");

    // 3. Admin A purchases on Org A
    await adminA.mutation(api.marketplace.purchaseApp, {
      explicitOrgId: orgAId,
      appIdOrSlug: "prest-whatsapp-automation",
    });

    // 4. Org A catalog shows WhatsApp as installed
    const catalogA = await adminA.query(api.marketplace.listCatalog, {
      explicitOrgId: orgAId,
      tab: "installed",
    });
    expect(
      catalogA.apps.some((a) => a.slug === "prest-whatsapp-automation")
    ).toBe(true);

    // 5. Org B catalog does NOT show WhatsApp as installed (strict isolation)
    const catalogB = await adminB.query(api.marketplace.listCatalog, {
      explicitOrgId: orgBId,
      tab: "installed",
    });
    expect(
      catalogB.apps.some((a) => a.slug === "prest-whatsapp-automation")
    ).toBe(false);

    // 6. Admin B cannot top up or mutate Org A's wallet
    await expect(
      adminB.mutation(api.marketplace.topupWallet, {
        explicitOrgId: orgAId,
        amount: 2000,
        paymentMethod: "upi",
      })
    ).rejects.toThrow("Forbidden");
  });

  test("7. Configuration updates, uninstallation, and auto-topup management", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Config Test Store",
    });

    const admin = t.withIdentity({
      name: "Config Admin",
      email: "config_admin@prest.com",
      subject: "clerk_config_admin",
    });

    await admin.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: orgId,
    });

    // Install an app
    await admin.mutation(api.marketplace.installApp, {
      explicitOrgId: orgId,
      appIdOrSlug: "meta-pixel",
    });

    // Update configuration and status to live
    const updateRes = await admin.mutation(api.marketplace.updateInstallationConfig, {
      explicitOrgId: orgId,
      appIdOrSlug: "meta-pixel",
      status: "live",
      statusText: "Installed & Active",
      configuration: { pixelId: "1234567890" },
    });
    expect(updateRes.success).toBe(true);

    // Verify config status
    const listing = await admin.query(api.marketplace.getListing, {
      appIdOrSlug: "meta-pixel",
      explicitOrgId: orgId,
    });
    expect(listing?.isInstalled).toBe(true);
    expect(listing?.installation?.status).toBe("live");
    expect(listing?.installation?.configuration?.pixelId).toBe("1234567890");

    // Configure Auto-Topup
    const autoTopupRes = await admin.mutation(api.marketplace.updateAutoTopup, {
      explicitOrgId: orgId,
      enabled: true,
      threshold: 3000,
      amount: 10000,
    });
    expect(autoTopupRes.success).toBe(true);

    const wallet = await admin.query(api.marketplace.getWallet, {
      explicitOrgId: orgId,
    });
    expect(wallet.autoTopupEnabled).toBe(true);
    expect(wallet.autoTopupThreshold).toBe(3000);
    expect(wallet.autoTopupAmount).toBe(10000);

    // Uninstall app
    const uninstallRes = await admin.mutation(api.marketplace.uninstallApp, {
      explicitOrgId: orgId,
      appIdOrSlug: "meta-pixel",
    });
    expect(uninstallRes.success).toBe(true);

    const postUninstall = await admin.query(api.marketplace.getListing, {
      appIdOrSlug: "meta-pixel",
      explicitOrgId: orgId,
    });
    expect(postUninstall?.isInstalled).toBe(false);
  });
});
