/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Customer Front Display (CFD) Domain Unit & Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_cfd") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Skyz Restaurant & Banquet",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Settings Loading & Initialization
  describe("CFD Settings Initialization & Updates", () => {
    test("getSettings returns default configuration when no record exists", async () => {
      const { t, orgId } = await setupStoreWithAdmin();

      const settings = await t.query(api.frontDisplay.getSettings, {
        organizationId: orgId,
      });

      expect(settings).toBeDefined();
      expect(settings.cfdEnabled).toBe(true);
      expect(settings.displayLayout).toBe("split");
      expect(settings.theme).toBe("light");
      expect(settings.showPaymentQr).toBe(true);
      expect(settings.showCashTenderedChangeDue).toBe(true);
      expect(settings.returnToWelcomeTimeout).toBe(8);
      expect(settings.storeUpiAddress).toBe("skyz.banquet@icici");
    });

    test("updateSettings persists custom options accurately", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const updated = await asAdmin.mutation(api.frontDisplay.updateSettings, {
        organizationId: orgId,
        cfdEnabled: false,
        displayLayout: "cart",
        theme: "dark",
        showPaymentQr: false,
        storeUpiAddress: "custom@icici",
        showCashTenderedChangeDue: false,
        merchantDisplayName: "Custom Merchant Name",
        showStarRatingSurvey: false,
        showWhatsappReceipt: false,
        returnToWelcomeTimeout: 15,
      });

      expect(updated.cfdEnabled).toBe(false);
      expect(updated.displayLayout).toBe("cart");
      expect(updated.theme).toBe("dark");
      expect(updated.showPaymentQr).toBe(false);
      expect(updated.storeUpiAddress).toBe("custom@icici");
      expect(updated.merchantDisplayName).toBe("Custom Merchant Name");
      expect(updated.returnToWelcomeTimeout).toBe(15);
    });
  });

  // 2. Connected Displays & Pairing
  describe("Connected Displays & Pairing Protocol", () => {
    test("listDisplays returns default dual-screen and wireless tablet when unseeded", async () => {
      const { t, orgId } = await setupStoreWithAdmin();

      const displays = await t.query(api.frontDisplay.listDisplays, {
        organizationId: orgId,
      });

      expect(displays.length).toBe(2);
      expect(displays[0].connectionType).toBe("hdmi");
      expect(displays[1].connectionType).toBe("network");
    });

    test("pairDisplay generates 6-digit PIN with 10-minute expiry", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const pairResult = await asAdmin.mutation(api.frontDisplay.pairDisplay, {
        organizationId: orgId,
        name: "iPad Air Front Counter",
      });

      expect(pairResult.pairingCode).toBeDefined();
      expect(pairResult.pairingCode.length).toBe(6);
      expect(pairResult.expiresAt).toBeGreaterThan(Date.now());
    });

    test("testConnection measures latency and returns active status", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const result = await asAdmin.mutation(api.frontDisplay.testConnection, {
        displayId: "default_hdmi_screen",
      });

      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(result.status).toBe("active");
    });
  });

  // 3. Dynamic UPI QR Generation & Payments
  describe("Dynamic UPI QR & NPCI Standards", () => {
    test("generateDynamicUpiQr creates valid NPCI UPI string with exact amount and merchant", async () => {
      const { asAdmin, orgId } = await setupStoreWithAdmin();

      const qr = await asAdmin.mutation(api.frontDisplay.generateDynamicUpiQr, {
        amount: 1304.5,
        orderNumber: "ORD-1042",
        organizationId: orgId,
      });

      expect(qr.amount).toBe("1304.50");
      expect(qr.upiString).toContain("upi://pay?");
      expect(qr.upiString).toContain("pa=skyz.banquet%40icici");
      expect(qr.upiString).toContain("am=1304.50");
      expect(qr.upiString).toContain("tr=ORD-1042");
    });
  });

  // 4. Session State Synchronization
  describe("Runtime Session State Synchronization", () => {
    test("publishSessionState and getSessionState propagate live cart changes", async () => {
      const { asAdmin, t, orgId } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.frontDisplay.publishSessionState, {
        terminalId: "terminal-01",
        state: "ringing",
        payload: {
          itemsCount: 3,
          subTotal: 120000,
          totalAmount: 126000,
        },
        organizationId: orgId,
      });

      const session = await t.query(api.frontDisplay.getSessionState, {
        terminalId: "terminal-01",
        organizationId: orgId,
      });

      expect(session).toBeDefined();
      expect(session?.state).toBe("ringing");
      expect(session?.payload?.itemsCount).toBe(3);
      expect(session?.payload?.totalAmount).toBe(126000);
    });
  });

  // 5. Instant 1-Touch Star Rating Feedback
  describe("Instant Star Rating Submission", () => {
    test("submitInstantRating creates survey attempt record", async () => {
      const { asAdmin, t, orgId } = await setupStoreWithAdmin();

      // Create an active survey
      const surveyId = await asAdmin.mutation(api.surveys.create, {
        name: "Dinner Experience Feedback",
        active: true,
      });

      const ratingResult = await asAdmin.mutation(
        api.frontDisplay.submitInstantRating,
        {
          score: 5,
          orderNumber: "ORD-1042",
          surveyId,
          organizationId: orgId,
        }
      );

      expect(ratingResult.success).toBe(true);
      expect(ratingResult.score).toBe(5);
    });
  });
});
