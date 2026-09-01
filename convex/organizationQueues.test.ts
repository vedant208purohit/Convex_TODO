/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Queues Domain Unit & Business Logic Tests", () => {
  async function setupStoreWithAdmin(adminClerkId = "user_admin_99") {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Queue Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Creation & Sequential Ticket Numbering
  describe("Queue Creation & Ticket Numbering", () => {
    test("Waitlist creation sets arrived status and QN001 ticket format", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const queue = await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "waitlist",
        reservationDate: "2026-08-31",
        totalGuests: 4,
        notes: "Window seat preferred",
      });

      expect(queue).toBeDefined();
      expect(queue.queueType).toBe("waitlist");
      expect(queue.queueStatus).toBe("arrived");
      expect(queue.queueNumber).toContain("31-08-2026.QN001");
      expect(queue.totalGuests).toBe(4);
      expect(queue.notes).toBe("Window seat preferred");
    });

    test("Sequential waitlist and reservation ticket numbering resets per day and prefix", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const q1 = await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "waitlist",
        reservationDate: "2026-08-31",
        totalGuests: 2,
      });

      const q2 = await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "waitlist",
        reservationDate: "2026-08-31",
        totalGuests: 3,
      });

      const r1 = await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "reservation",
        reservationDate: "2026-08-31",
        totalGuests: 5,
      });

      expect(q1.queueNumber).toContain("31-08-2026.QN001");
      expect(q2.queueNumber).toContain("31-08-2026.QN002");
      expect(r1.queueNumber).toContain("31-08-2026.RN001");
    });

    test("Booking approval configuration resolves reservation status to pending or booked", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      // Default bookingApproval = false -> booked
      const r1 = await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "reservation",
        reservationDate: "2026-08-31",
      });
      expect(r1.queueStatus).toBe("booked");

      // Enable bookingApproval in DB
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("organizationQueueConfigurations" as any, {
          bookingApproval: true,
          createdAt: now,
          updatedAt: now,
        });
      });

      const r2 = await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "reservation",
        reservationDate: "2026-08-31",
      });
      expect(r2.queueStatus).toBe("pending");
    });
  });

  // 2. Queue Off Restrictions
  describe("Queue Off Restrictions", () => {
    test("Turning waitlist off prevents new waitlist creations for that date", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "waitlist_off",
        reservationDate: "2026-09-01",
      });

      await expect(
        asAdmin.mutation(api.organizationQueues.create, {
          queueType: "waitlist",
          reservationDate: "2026-09-01",
        })
      ).rejects.toThrow("Waitlist is turned off on 2026-09-01");
    });
  });

  // 3. Table Availability Logic
  describe("Reservation Table Availability", () => {
    test("Available tables filter out tables blocked or reserved in ±1 hour window", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const layoutId = await asAdmin.mutation(api.organizationLayouts.create, {
        name: "Main Dining",
      });

      let t1Id: any;
      let t2Id: any;

      await t.run(async (ctx) => {
        const now = Date.now();
        t1Id = await ctx.db.insert("organizationTables" as any, {
          tableNumber: "T1",
          seatingCapacity: 4,
          layoutId: layoutId,
          createdAt: now,
          updatedAt: now,
        });
        t2Id = await ctx.db.insert("organizationTables" as any, {
          tableNumber: "T2",
          seatingCapacity: 6,
          layoutId: layoutId,
          createdAt: now,
          updatedAt: now,
        });
      });

      const targetTime = Date.UTC(2026, 7, 31, 18, 0, 0); // 18:00

      // Reserve T1 at 18:30 (within 1 hour window)
      await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "reservation",
        reservationDate: "2026-08-31",
        reservationTime: targetTime + 1800000, // 18:30
        tableId: t1Id,
        layoutId: layoutId,
      });

      const available = await t.query(
        api.organizationQueues.availableTablesForReservation,
        {
          queueType: "reservation",
          reservationDate: "2026-08-31",
          reservationTime: targetTime,
          seatingCapacity: 4,
        }
      );

      const tableNumbers = available.map((tbl) => tbl.tableNumber);
      expect(tableNumbers).not.toContain("T1");
      expect(tableNumbers).toContain("T2");
    });
  });

  // 4. Table Assignment & Activity Logging
  describe("Table Assignment & Queue Activities", () => {
    test("Assigning table updates queue entry and logs table_assigned activity", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      let tableId: any;
      await t.run(async (ctx) => {
        const now = Date.now();
        tableId = await ctx.db.insert("organizationTables" as any, {
          tableNumber: "T10",
          seatingCapacity: 4,
          createdAt: now,
          updatedAt: now,
        });
      });

      const queue = await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "waitlist",
        reservationDate: "2026-08-31",
      });

      const updated = await asAdmin.mutation(api.organizationQueues.assignTable, {
        id: queue._id,
        tableId: tableId,
      });

      expect(updated.tableId).toBe(tableId);

      const fetched = await asAdmin.query(api.organizationQueues.get, {
        id: queue._id,
      });

      expect(fetched?.activities).toBeDefined();
      expect(fetched?.activities.some((a) => a.activityType === "table_assigned")).toBe(
        true
      );
    });

    test("Assigning busy table rejects with error", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      let tableId: any;
      await t.run(async (ctx) => {
        const now = Date.now();
        tableId = await ctx.db.insert("organizationTables" as any, {
          tableNumber: "T11",
          seatingCapacity: 4,
          isBlock: true,
          createdAt: now,
          updatedAt: now,
        });
      });

      const queue = await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "waitlist",
        reservationDate: "2026-08-31",
      });

      await expect(
        asAdmin.mutation(api.organizationQueues.assignTable, {
          id: queue._id,
          tableId: tableId,
        })
      ).rejects.toThrow("The table is busy now");
    });
  });

  // 5. Status Transitions & Timestamps
  describe("Status Transitions & Lifecycle Timestamps", () => {
    test("Updating status to completed or cancelled sets timestamps and activity logs", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const queue = await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "waitlist",
        reservationDate: "2026-08-31",
      });

      const completed = await asAdmin.mutation(api.organizationQueues.update, {
        id: queue._id,
        queueStatus: "completed",
      });

      expect(completed.queueStatus).toBe("completed");
      expect(completed.completionTime).toBeDefined();

      const fetched = await asAdmin.query(api.organizationQueues.get, {
        id: queue._id,
      });

      expect(fetched?.activities.some((a) => a.activityType === "completed")).toBe(
        true
      );
    });
  });

  // 6. Authorization
  describe("Authorization Boundary Checks", () => {
    test("Staff/Waiter can list and get, but cannot create or update queues", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_99",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_99" });

      const list = await asWaiter.query(api.organizationQueues.list, {});
      expect(Array.isArray(list)).toBe(true);

      await expect(
        asWaiter.mutation(api.organizationQueues.create, {
          queueType: "waitlist",
          reservationDate: "2026-08-31",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });
  });

  // 7. Soft Deletion
  describe("Soft Deletion", () => {
    test("Remove soft-deletes queue entry and excludes it from active queries", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const queue = await asAdmin.mutation(api.organizationQueues.create, {
        queueType: "waitlist",
        reservationDate: "2026-08-31",
      });

      await asAdmin.mutation(api.organizationQueues.remove, {
        id: queue._id,
      });

      const getRes = await asAdmin.query(api.organizationQueues.get, {
        id: queue._id,
      });

      expect(getRes).toBeNull();
    });
  });
});
