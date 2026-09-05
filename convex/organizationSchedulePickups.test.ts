/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Schedule Pickups Domain Unit & Integration Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_schedule_test") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Schedule Pickup Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Initialization & Default Timings
  describe("Initialization & Default Timings", () => {
    test("get automatically initializes 7-day default pickup & delivery schedules", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const config = await asAdmin.query(
        api.organizationSchedulePickups.get,
        {}
      );

      expect(config).toBeDefined();
      expect(config?.advanceOrderTimeLimit).toBe("12");
      expect(config?.advancePickupLimit).toBe(1);
      expect(config?.advancePickupLimitType).toBe("months");
      expect(config?.pickupTimeSlotSize).toBe("15");

      // Verify 7-day weekly schedule structures
      expect(config?.pickupTimings?.Monday?.is_open).toBe(true);
      expect(config?.pickupTimings?.Sunday?.is_open).toBe(true);
      expect(config?.deliveryTimings?.Monday?.is_open).toBe(true);
      expect(config?.deliveryTimings?.Sunday?.is_open).toBe(true);
    });

    test("initialize mutation creates explicit active document idempotently", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const first = await asAdmin.mutation(
        api.organizationSchedulePickups.initialize,
        {}
      );
      const second = await asAdmin.mutation(
        api.organizationSchedulePickups.initialize,
        {}
      );

      expect(first._id).toBeDefined();
      expect(first._id).toBe(second._id);
    });
  });

  // 2. Public V3 Playback & Queries
  describe("Public V3 Playback & Queries", () => {
    test("getPublic allows unauthenticated access for customer checkout", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      // Seed config
      await asAdmin.mutation(api.organizationSchedulePickups.initialize, {});

      // Unauthenticated public V3 query
      const publicConfig = await t.query(
        api.organizationSchedulePickups.getPublic,
        {}
      );

      expect(publicConfig).not.toBeNull();
      expect(publicConfig?.pickupTimeSlotSize).toBe("15");
      expect(publicConfig?.pickupTimings?.Monday?.is_open).toBe(true);
    });
  });

  // 3. Updates & Address Management
  describe("Updates & Address Management", () => {
    test("update modifies time limits, slot sizes, and pickup address details", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      // Seed config
      const initial = await asAdmin.mutation(
        api.organizationSchedulePickups.initialize,
        {}
      );

      const updated = await asAdmin.mutation(
        api.organizationSchedulePickups.update,
        {
          id: initial._id,
          pickupTimeSlotSize: "30",
          pickupAddressLine1: "123 Main Street",
          city: "New York",
          country: "USA",
          zipcode: "10001",
        }
      );

      expect(updated.pickupTimeSlotSize).toBe("30");
      expect(updated.pickupAddressLine1).toBe("123 Main Street");
      expect(updated.city).toBe("New York");
      expect(updated.country).toBe("USA");
      expect(updated.zipcode).toBe("10001");
    });
  });

  // 4. Soft Delete & Feature Flag Synchronization
  describe("Soft Delete & Feature Flag Synchronization", () => {
    test("remove soft-deletes config and disables store feature flags", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      // Seed config
      const initial = await asAdmin.mutation(
        api.organizationSchedulePickups.initialize,
        {}
      );

      // Enable feature flags on store
      await asAdmin.mutation(api.organizations.update, {
        id: orgId,
        scheduledPickup: true,
        scheduledDelivery: true,
      });

      // Soft delete schedule pickup config
      await asAdmin.mutation(api.organizationSchedulePickups.remove, {
        id: initial._id,
      });

      // Verify config is hidden from public V3 reads
      const publicConfig = await t.query(
        api.organizationSchedulePickups.getPublic,
        {}
      );
      expect(publicConfig).toBeNull();

      // Verify store feature flags were disabled
      const org = await asAdmin.query(api.organizations.get, { id: orgId });
      expect(org?.scheduledPickup).toBe(false);
      expect(org?.scheduledDelivery).toBe(false);
    });
  });

  // 5. Authorization Boundary Checks
  describe("Authorization Boundary Checks", () => {
    test("Staff/Waiter role cannot update or remove schedule pickup configuration", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      // Seed config
      const initial = await asAdmin.mutation(
        api.organizationSchedulePickups.initialize,
        {}
      );

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_schedule",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_schedule" });

      const config = await asWaiter.query(
        api.organizationSchedulePickups.get,
        {}
      );
      expect(config).not.toBeNull();

      await expect(
        asWaiter.mutation(api.organizationSchedulePickups.update, {
          id: initial._id,
          pickupTimeSlotSize: "60",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");

      await expect(
        asWaiter.mutation(api.organizationSchedulePickups.remove, {
          id: initial._id,
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });
  });
});
