/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Marketplace Frontend End-to-End Integration Tests", () => {
  test("E2E Flow: Browse catalog -> Filter & Search -> Purchase via Checkout -> Verify Ledger & Wallet Update", async () => {
    const t = convexTest(schema, modules);

    // Provision store
    const orgId = await t.mutation(api.organizations.create, {
      name: "The Grand Bistro Flagship",
    });

    const storeAdmin = t.withIdentity({
      name: "Dhruv Joshi",
      email: "dhruv@thegrandbistro.com",
      subject: "clerk_dhruv_admin",
    });

    // Initialize Store Marketplace (seeds catalog and initial installations)
    await storeAdmin.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: orgId,
    });

    // 1. Initial Load: Explore Tab
    const exploreCatalog = await storeAdmin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      tab: "explore",
      category: "all",
      sortOption: "recommended",
    });
    expect(exploreCatalog.apps.length).toBe(12);

    // Initial Wallet balance check
    const initialWallet = await storeAdmin.query(api.marketplace.getWallet, {
      explicitOrgId: orgId,
    });
    expect(initialWallet.balance).toBe(14500);

    // 2. Tab Navigation: Installed Products Tab
    const installedCatalog = await storeAdmin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      tab: "installed",
    });
    expect(installedCatalog.apps.length).toBeGreaterThanOrEqual(4);
    installedCatalog.apps.forEach((app) => {
      expect(app.isInstalled).toBe(true);
    });

    // Verify WhatsApp Automation is NOT yet installed
    const heroBefore = exploreCatalog.apps.find(
      (a) => a.slug === "prest-whatsapp-automation"
    );
    expect(heroBefore?.isInstalled).toBe(false);

    // 3. Category Filter: 'Operations'
    const operationsCatalog = await storeAdmin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      tab: "explore",
      category: "Operations",
    });
    expect(operationsCatalog.apps.length).toBe(1);
    expect(operationsCatalog.apps[0].slug).toBe("customer-feedback-surveys");

    // 4. Search Filter: 'Stripe'
    const searchResult = await storeAdmin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      tab: "explore",
      searchQuery: "Stripe",
    });
    expect(searchResult.apps.length).toBe(1);
    expect(searchResult.apps[0].title).toBe("Stripe");

    // 5. Checkout Flow: User purchases PREST WhatsApp Automation for ₹5,000
    const checkoutListing = await storeAdmin.query(api.marketplace.getListing, {
      explicitOrgId: orgId,
      appIdOrSlug: "prest-whatsapp-automation",
    });
    expect(checkoutListing).not.toBeNull();
    expect(checkoutListing?.priceAmount).toBe(5000);
    expect(checkoutListing?.isInstalled).toBe(false);

    const purchaseRes = await storeAdmin.mutation(api.marketplace.purchaseApp, {
      explicitOrgId: orgId,
      appIdOrSlug: "prest-whatsapp-automation",
      idempotencyKey: "e2e_checkout_flow_001",
    });
    expect(purchaseRes.success).toBe(true);
    expect(purchaseRes.newBalance).toBe(14500 - 5000); // 9500
    expect(purchaseRes.transactionCode).toMatch(/^TXN-\d{6}$/);

    // 6. Post-Purchase Verification: Catalog state updates reactively
    const updatedCatalog = await storeAdmin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      tab: "installed",
    });
    const heroAfter = updatedCatalog.apps.find(
      (a) => a.slug === "prest-whatsapp-automation"
    );
    expect(heroAfter?.isInstalled).toBe(true);
    expect(heroAfter?.badge).toBe("Installed");

    // Subscriptions tab reflects the paid add-on
    const subscriptions = await storeAdmin.query(api.marketplace.listCatalog, {
      explicitOrgId: orgId,
      tab: "purchases",
    });
    expect(
      subscriptions.apps.some((a) => a.slug === "prest-whatsapp-automation")
    ).toBe(true);

    // 7. Wallet Ledger Verification: Transaction appears at the top
    const ledger = await storeAdmin.query(api.marketplace.listTransactions, {
      explicitOrgId: orgId,
    });
    const latestTx = ledger[0];
    expect(latestTx.code).toBe(purchaseRes.transactionCode);
    expect(latestTx.amount).toBe(-5000);
    expect(latestTx.description).toBe("PREST WhatsApp Automation");
    expect(latestTx.status).toBe("confirmed");

    // 8. Add Money Flow: User tops up ₹25,000 via Net Banking
    const topupRes = await storeAdmin.mutation(api.marketplace.topupWallet, {
      explicitOrgId: orgId,
      amount: 25000,
      paymentMethod: "netbanking",
      idempotencyKey: "e2e_topup_flow_001",
    });
    expect(topupRes.success).toBe(true);
    expect(topupRes.newBalance).toBe(9500 + 25000); // 34500

    const postTopupWallet = await storeAdmin.query(api.marketplace.getWallet, {
      explicitOrgId: orgId,
    });
    expect(postTopupWallet.balance).toBe(34500);

    // 9. Auto-Topup Configuration Flow
    await storeAdmin.mutation(api.marketplace.updateAutoTopup, {
      explicitOrgId: orgId,
      enabled: true,
      threshold: 5000,
      amount: 15000,
    });

    const configuredWallet = await storeAdmin.query(api.marketplace.getWallet, {
      explicitOrgId: orgId,
    });
    expect(configuredWallet.autoTopupEnabled).toBe(true);
    expect(configuredWallet.autoTopupThreshold).toBe(5000);
    expect(configuredWallet.autoTopupAmount).toBe(15000);
  });

  test("Negative & Denial Flows: Non-admin rejection, cross-tenant denial, and insufficient balance error", async () => {
    const t = convexTest(schema, modules);

    const storeAId = await t.mutation(api.organizations.create, {
      name: "Store Alpha",
    });
    const storeBId = await t.mutation(api.organizations.create, {
      name: "Store Beta",
    });

    const storeAdminA = t.withIdentity({
      name: "Store A Admin",
      email: "admin_a@alpha.com",
      subject: "clerk_admin_a",
    });

    const storeAdminB = t.withIdentity({
      name: "Store B Admin",
      email: "admin_b@beta.com",
      subject: "clerk_admin_b",
    });

    // Establish ownership of Store A by Admin A, and Store B by Admin B
    await storeAdminA.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: storeAId,
    });
    await storeAdminB.mutation(api.marketplace.initializeMarketplace, {
      explicitOrgId: storeBId,
    });

    // 1. Cross-tenant modification rejection
    await expect(
      storeAdminB.mutation(api.marketplace.purchaseApp, {
        explicitOrgId: storeAId,
        appIdOrSlug: "prest-whatsapp-automation",
      })
    ).rejects.toThrow("Forbidden");

    await expect(
      storeAdminB.mutation(api.marketplace.topupWallet, {
        explicitOrgId: storeAId,
        amount: 5000,
        paymentMethod: "upi",
      })
    ).rejects.toThrow("Forbidden");

    // 2. Unauthenticated user rejection
    await expect(
      t.mutation(api.marketplace.purchaseApp, {
        explicitOrgId: storeAId,
        appIdOrSlug: "prest-whatsapp-automation",
      })
    ).rejects.toThrow("Unauthenticated");

    // 3. Insufficient balance rejection after funds exhausted
    // First purchase: 14500 - 5000 = 9500
    await storeAdminA.mutation(api.marketplace.purchaseApp, {
      explicitOrgId: storeAId,
      appIdOrSlug: "prest-whatsapp-automation",
    });

    // Second purchase: 9500 - 5000 = 4500
    await storeAdminA.mutation(api.marketplace.purchaseApp, {
      explicitOrgId: storeAId,
      appIdOrSlug: "prest-whatsapp-automation",
    });

    // Third purchase: requires 5000, balance has only 4500 -> must throw
    await expect(
      storeAdminA.mutation(api.marketplace.purchaseApp, {
        explicitOrgId: storeAId,
        appIdOrSlug: "prest-whatsapp-automation",
      })
    ).rejects.toThrow("Insufficient wallet balance");
  });
});
