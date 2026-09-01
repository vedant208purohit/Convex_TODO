/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Queue Configurations Domain Unit & Business Logic Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Queue Config Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Singleton & Initialization Tests
  describe("Singleton & Default Initialization", () => {
    test("Initialization creates a store singleton with exact audited defaults", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const config = await asAdmin.mutation(
        api.organizationQueueConfigurations.initialize,
        {}
      );

      expect(config).toBeDefined();
      expect(config.defaultPartySize).toBe(0);
      expect(config.customerViewWaitlist).toBe(false);
      expect(config.onlineWaitlist).toBe(false);
      expect(config.onlineReservation).toBe(false);
      expect(config.bookingApproval).toBe(false);
      expect(config.geoFence).toBe(false);

      expect(config.waitlistHours?.Monday?.is_open).toBe(true);
      expect(config.waitlistHours?.Monday?.hours[0]?.start_time).toContain("11:00:00");
      expect(config.waitlistHours?.Monday?.hours[0]?.end_time).toContain("23:59:00");

      expect(config.reservationHours?.Sunday?.is_open).toBe(true);

      // Repeated initialization is idempotent and returns the same active configuration
      const reInit = await asAdmin.mutation(
        api.organizationQueueConfigurations.initialize,
        {}
      );

      expect(reInit._id).toBe(config._id);
    });

    test("Query get returns null when not yet initialized", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const config = await asAdmin.query(api.organizationQueueConfigurations.get, {});
      expect(config).toBeNull();
    });
  });

  // 2. Schedule Overlap Validation Tests
  describe("Schedule Overlap Validation", () => {
    test("Valid non-overlapping time ranges succeed", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationQueueConfigurations.initialize, {});

      const validSchedule = {
        Monday: {
          is_open: true,
          hours: [
            { start_time: "11:00", end_time: "14:00" },
            { start_time: "14:00", end_time: "18:00" },
          ],
        },
        Tuesday: { is_open: false, hours: [] },
        Wednesday: { is_open: false, hours: [] },
        Thursday: { is_open: false, hours: [] },
        Friday: { is_open: false, hours: [] },
        Saturday: { is_open: false, hours: [] },
        Sunday: { is_open: false, hours: [] },
      };

      const res = await asAdmin.mutation(api.organizationQueueConfigurations.update, {
        waitlistHours: validSchedule,
      });

      expect(res.success).toBe(true);
    });

    test("Overlapping waitlist time ranges fail validation", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationQueueConfigurations.initialize, {});

      const invalidSchedule = {
        Monday: {
          is_open: true,
          hours: [
            { start_time: "11:00", end_time: "15:00" },
            { start_time: "14:00", end_time: "18:00" }, // Overlaps 14:00 - 15:00
          ],
        },
        Tuesday: { is_open: false, hours: [] },
        Wednesday: { is_open: false, hours: [] },
        Thursday: { is_open: false, hours: [] },
        Friday: { is_open: false, hours: [] },
        Saturday: { is_open: false, hours: [] },
        Sunday: { is_open: false, hours: [] },
      };

      await expect(
        asAdmin.mutation(api.organizationQueueConfigurations.update, {
          waitlistHours: invalidSchedule,
        })
      ).rejects.toThrow("overlapping time ranges found for Monday");
    });
  });

  // 3. Authorization Tests
  describe("Authorization Boundary Checks", () => {
    test("Store Admin and Cashier can update settings, but Staff cannot", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_cashier_22",
        userType: ["cashier"],
      });

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_22",
        userType: ["waiter"],
      });

      const asCashier = t.withIdentity({ subject: "user_cashier_22" });
      const asWaiter = t.withIdentity({ subject: "user_waiter_22" });

      await asCashier.mutation(api.organizationQueueConfigurations.update, {
        defaultPartySize: 4,
        bookingApproval: true,
      });

      // Staff (waiter) can read
      const config = await asWaiter.query(api.organizationQueueConfigurations.get, {});
      expect(config?.defaultPartySize).toBe(4);
      expect(config?.bookingApproval).toBe(true);

      // Staff (waiter) cannot update
      await expect(
        asWaiter.mutation(api.organizationQueueConfigurations.update, {
          defaultPartySize: 8,
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });
  });

  // 4. Copy Store Timing Operations
  describe("Copy Store Timing Operations", () => {
    test("Store Admin can copy store operating hours to waitlist or reservation schedule", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationQueueConfigurations.initialize, {});

      const res = await asAdmin.mutation(
        api.organizationQueueConfigurations.copyStoreTiming,
        {
          target: "waitlist",
        }
      );

      expect(res.success).toBe(true);
    });
  });

  // 5. Soft Delete Operations
  describe("Soft Delete Operations", () => {
    test("Remove soft deletes configuration and get returns null", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationQueueConfigurations.initialize, {});

      await asAdmin.mutation(api.organizationQueueConfigurations.remove, {});

      const doc = await asAdmin.query(api.organizationQueueConfigurations.get, {});
      expect(doc).toBeNull();
    });
  });
});
