/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Payment Modes Unit & Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_pm_1") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Payment Modes Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  describe("Payment Mode CRUD & Validation Tests", () => {
    test("Store Admin can list payment modes", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationPaymentModes.create, {
        name: "Cash",
        active: true,
      });

      const modes = await asAdmin.query(api.organizationPaymentModes.list);
      expect(Array.isArray(modes)).toBe(true);
      expect(modes.length).toBe(1);
      expect(modes[0].name).toBe("Cash");
    });

    test("Store Admin can create a new custom payment mode", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const newId = await asAdmin.mutation(api.organizationPaymentModes.create, {
        name: "Gift Card",
        active: true,
      });

      expect(newId).toBeDefined();

      const modes = await asAdmin.query(api.organizationPaymentModes.list);
      const giftCard = modes.find((m) => m._id === newId);
      expect(giftCard).toBeDefined();
      expect(giftCard?.name).toBe("Gift Card");
      expect(giftCard?.active).toBe(true);
    });

    test("Prevents duplicate payment mode names (case-insensitive)", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      // Create "Cash"
      await asAdmin.mutation(api.organizationPaymentModes.create, {
        name: "Cash",
        active: true,
      });

      // Attempt to create "cash"
      await expect(
        asAdmin.mutation(api.organizationPaymentModes.create, {
          name: "cash",
        })
      ).rejects.toThrow("Hey! cash is already taken.");
    });

    test("Store Admin can update payment mode name and toggle active status", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const newId = await asAdmin.mutation(api.organizationPaymentModes.create, {
        name: "Crypto Pay",
        active: true,
      });

      // Toggle active to false
      await asAdmin.mutation(api.organizationPaymentModes.toggleActive, {
        id: newId,
        active: false,
      });

      let modes = await asAdmin.query(api.organizationPaymentModes.list);
      let updated = modes.find((m) => m._id === newId);
      expect(updated?.active).toBe(false);

      // Rename
      await asAdmin.mutation(api.organizationPaymentModes.update, {
        id: newId,
        name: "Bitcoin / Crypto",
      });

      modes = await asAdmin.query(api.organizationPaymentModes.list);
      updated = modes.find((m) => m._id === newId);
      expect(updated?.name).toBe("Bitcoin / Crypto");
    });

    test("Store Admin can delete a payment mode", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const newId = await asAdmin.mutation(api.organizationPaymentModes.create, {
        name: "Temporary Voucher",
        active: true,
      });

      await asAdmin.mutation(api.organizationPaymentModes.remove, { id: newId });

      const modes = await asAdmin.query(api.organizationPaymentModes.list);
      const found = modes.find((m) => m._id === newId);
      expect(found).toBeUndefined();
    });
  });
});
