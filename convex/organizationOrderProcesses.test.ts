/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Order Processes Domain Unit & Business Logic Tests", () => {
  // Helper: Setup store with an initial admin user
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    // Create store organization with initial owner
    const orgId = await t.mutation(api.organizations.create, {
      name: "Order Processes Test Store",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Creation Tests
  describe("Creation Logic & Validations", () => {
    test("Store Admin can create a sequential order process", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const procId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Custom Kitchen Prep",
        isSequence: true,
        processColor: "#262626",
      });

      expect(procId).toBeDefined();

      const processDoc = await asAdmin.query(api.organizationOrderProcesses.get, { id: procId });
      expect(processDoc).not.toBeNull();
      expect(processDoc?.name).toBe("Custom Kitchen Prep");
      expect(processDoc?.isSequence).toBe(true);
      expect(processDoc?.processColor).toBe("#262626");
      expect(processDoc?.published).toBe(false); // Custom default is false
    });

    test("Cashier staff can create an order process", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_cashier_10",
        userType: ["cashier"],
      });

      const asCashier = t.withIdentity({ subject: "user_cashier_10" });

      const procId = await asCashier.mutation(api.organizationOrderProcesses.create, {
        name: "Packing Step",
        isSequence: true,
        processColor: "#ABCDEF",
      });

      expect(procId).toBeDefined();
    });

    test("Non-admin and non-cashier staff (e.g. waiter) cannot create a process", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_1",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_1" });

      await expect(
        asWaiter.mutation(api.organizationOrderProcesses.create, {
          name: "Unauthorized Step",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });

    test("Non-admin and non-cashier staff (e.g. waiter) cannot update, reorder, or remove a process", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      const procId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Protected Process",
        position: 1,
        isSequence: true,
      });

      await asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_1",
        userType: ["waiter"],
      });

      const asWaiter = t.withIdentity({ subject: "user_waiter_1" });

      await expect(
        asWaiter.mutation(api.organizationOrderProcesses.update, {
          id: procId,
          name: "Unauthorized Update",
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");

      await expect(
        asWaiter.mutation(api.organizationOrderProcesses.reorder, {
          id: procId,
          position: 2,
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");

      await expect(
        asWaiter.mutation(api.organizationOrderProcesses.remove, {
          id: procId,
        })
      ).rejects.toThrow("Forbidden. Admin or Cashier access required.");
    });

    test("Unauthenticated user cannot create, update, reorder, or remove a process", async () => {
      const { t, asAdmin } = await setupStoreWithAdmin();

      const procId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Auth Check Process",
      });

      await expect(
        t.mutation(api.organizationOrderProcesses.create, {
          name: "Unauthenticated Step",
        })
      ).rejects.toThrow("Unauthenticated");

      await expect(
        t.mutation(api.organizationOrderProcesses.update, {
          id: procId,
          name: "Unauthenticated Update",
        })
      ).rejects.toThrow("Unauthenticated");

      await expect(
        t.mutation(api.organizationOrderProcesses.reorder, {
          id: procId,
          position: 2,
        })
      ).rejects.toThrow("Unauthenticated");

      await expect(
        t.mutation(api.organizationOrderProcesses.remove, {
          id: procId,
        })
      ).rejects.toThrow("Unauthenticated");
    });

    test("Missing or blank name is rejected", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await expect(
        asAdmin.mutation(api.organizationOrderProcesses.create, {
          name: "",
        })
      ).rejects.toThrow("Name can't be blank");

      await expect(
        asAdmin.mutation(api.organizationOrderProcesses.create, {
          name: "   ",
        })
      ).rejects.toThrow("Name can't be blank");
    });

    test("Duplicate name is rejected case-insensitively among active records", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Accepted",
        isSequence: true,
        processColor: "#111111",
      });

      await expect(
        asAdmin.mutation(api.organizationOrderProcesses.create, {
          name: "accepted",
          isSequence: true,
        })
      ).rejects.toThrow("Hey! accepted is already taken.");
    });

    test("Soft-deleted name can be reused", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const oldId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Accepted",
      });

      await asAdmin.mutation(api.organizationOrderProcesses.remove, { id: oldId });

      const newId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Accepted",
      });

      expect(newId).toBeDefined();
    });

    test("Process color validation rules for sequential vs non-sequential", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      // Invalid color format for sequential process
      await expect(
        asAdmin.mutation(api.organizationOrderProcesses.create, {
          name: "Step 1",
          isSequence: true,
          processColor: "invalid_color",
        })
      ).rejects.toThrow("is not a valid color");

      // Valid 3-digit hex code
      const id1 = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Step 1",
        isSequence: true,
        processColor: "#FFF",
      });
      expect(id1).toBeDefined();

      // Valid 6-digit hex code
      const id2 = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Step 2",
        isSequence: true,
        processColor: "#262626",
      });
      expect(id2).toBeDefined();

      // Non-sequential process can omit processColor
      const id3 = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Action Step",
        isSequence: false,
      });
      expect(id3).toBeDefined();
    });
  });

  // 2. Position Rules & Auto Assignment
  describe("Position Rules & Auto Position Assignment", () => {
    test("Position auto-generates when omitted within its isSequence scope", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const p1 = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Seq 1",
        isSequence: true,
      });
      const p2 = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Seq 2",
        isSequence: true,
      });

      const doc1 = await asAdmin.query(api.organizationOrderProcesses.get, { id: p1 });
      const doc2 = await asAdmin.query(api.organizationOrderProcesses.get, { id: p2 });

      expect(doc1?.position).toBe(1);
      expect(doc2?.position).toBe(2);

      // Non-sequential scope generates positions independently
      const ns1 = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "NonSeq 1",
        isSequence: false,
      });
      const docNs1 = await asAdmin.query(api.organizationOrderProcesses.get, { id: ns1 });
      expect(docNs1?.position).toBe(1);
    });

    test("Duplicate active position within the same isSequence scope is rejected", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Seq 1",
        position: 1,
        isSequence: true,
      });

      await expect(
        asAdmin.mutation(api.organizationOrderProcesses.create, {
          name: "Seq 2",
          position: 1,
          isSequence: true,
        })
      ).rejects.toThrow("A organization order process exists at this position 1");
    });
  });

  // 3. Published & Filtering
  describe("Published & List Filtering", () => {
    test("Default published value is false for custom process", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const id = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Custom Unpub",
      });

      const doc = await asAdmin.query(api.organizationOrderProcesses.get, { id });
      expect(doc?.published).toBe(false);
    });

    test("List can filter by published and isSequence", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Seq Pub",
        published: true,
        isSequence: true,
      });
      await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Seq Unpub",
        published: false,
        isSequence: true,
      });
      await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "NonSeq Pub",
        published: true,
        isSequence: false,
      });

      const pubList = await asAdmin.query(api.organizationOrderProcesses.list, { published: true });
      expect(pubList).toHaveLength(2);

      const seqList = await asAdmin.query(api.organizationOrderProcesses.list, { isSequence: true });
      expect(seqList).toHaveLength(2);
    });
  });

  // 4. Update Operations
  describe("Update Logic & Revalidations", () => {
    test("Can update process description", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const pId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Initial Stage",
        description: "Initial description",
        isSequence: true,
        processColor: "#111111",
      });

      await asAdmin.mutation(api.organizationOrderProcesses.update, {
        id: pId,
        description: "Updated description text",
      });

      const updated = await asAdmin.query(api.organizationOrderProcesses.get, { id: pId });
      expect(updated?.description).toBe("Updated description text");
    });


    test("Store Admin can update process attributes", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const pId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Initial Name",
        isSequence: true,
        processColor: "#111111",
      });

      await asAdmin.mutation(api.organizationOrderProcesses.update, {
        id: pId,
        name: "Updated Name",
        processColor: "#222222",
        published: true,
      });

      const updated = await asAdmin.query(api.organizationOrderProcesses.get, { id: pId });
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.processColor).toBe("#222222");
      expect(updated?.published).toBe(true);
    });

    test("Soft-deleted process cannot be updated", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const pId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "To Delete",
      });

      await asAdmin.mutation(api.organizationOrderProcesses.remove, { id: pId });

      await expect(
        asAdmin.mutation(api.organizationOrderProcesses.update, {
          id: pId,
          name: "New Name",
        })
      ).rejects.toThrow("Process not found");
    });
  });

  // 5. Reorder Behavior
  describe("Reorder Behavior", () => {
    test("Reordering contiguous positions within sequence scope", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const p1 = await asAdmin.mutation(api.organizationOrderProcesses.create, { name: "Step 1", position: 1, isSequence: true });
      const p2 = await asAdmin.mutation(api.organizationOrderProcesses.create, { name: "Step 2", position: 2, isSequence: true });
      const p3 = await asAdmin.mutation(api.organizationOrderProcesses.create, { name: "Step 3", position: 3, isSequence: true });
      const p4 = await asAdmin.mutation(api.organizationOrderProcesses.create, { name: "Step 4", position: 4, isSequence: true });

      // Move Step 4 to position 2
      await asAdmin.mutation(api.organizationOrderProcesses.reorder, {
        id: p4,
        position: 2,
      });

      const list = await asAdmin.query(api.organizationOrderProcesses.list, { isSequence: true });
      const namesInOrder = list.map((doc) => doc.name);

      expect(namesInOrder).toEqual(["Step 1", "Step 4", "Step 2", "Step 3"]);
      expect(list.map((doc) => doc.position)).toEqual([1, 2, 3, 4]);
    });
  });

  // 6. Soft Delete Behavior
  describe("Soft Delete Behavior", () => {
    test("Remove sets deletedAt and frees up name and position", async () => {
      const { asAdmin } = await setupStoreWithAdmin();

      const pId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Temp Step",
        position: 1,
      });

      await asAdmin.mutation(api.organizationOrderProcesses.remove, { id: pId });

      const activeList = await asAdmin.query(api.organizationOrderProcesses.list, {});
      expect(activeList).toHaveLength(0);

      // Name & position can now be reused
      const newId = await asAdmin.mutation(api.organizationOrderProcesses.create, {
        name: "Temp Step",
        position: 1,
      });

      expect(newId).toBeDefined();
    });
  });

  // 7. Store Initialization Seeding
  describe("Idempotent Store Initialization", () => {
    test("initializeStore seeds exactly 7 default processes (4 sequential, 3 non-sequential)", async () => {
      const { t, orgId, asAdmin } = await setupStoreWithAdmin();

      // Trigger store initialization
      await t.mutation(api.organizations.initializeStore, { id: orgId });

      const processes = await asAdmin.query(api.organizationOrderProcesses.list, {});
      expect(processes).toHaveLength(7);

      const seq = processes.filter((p) => p.isSequence);
      const nonSeq = processes.filter((p) => !p.isSequence);

      expect(seq).toHaveLength(4);
      expect(nonSeq).toHaveLength(3);

      expect(seq.map((p) => p.name)).toEqual(["Accepted", "In progress", "Ready to deliver", "Delivered"]);
      expect(seq.map((p) => p.position)).toEqual([1, 2, 3, 4]);
      expect(seq.map((p) => p.processColor)).toEqual(["#262626", "#EA9C1B", "#FC8019", "#219653"]);

      expect(nonSeq.map((p) => p.name)).toEqual(["Created", "Modify", "Reject"]);
      expect(nonSeq.map((p) => p.position)).toEqual([1, 2, 3]);

      // Running initializeStore again does not duplicate processes
      await t.mutation(api.organizations.initializeStore, { id: orgId });
      const reCheck = await asAdmin.query(api.organizationOrderProcesses.list, {});
      expect(reCheck).toHaveLength(7);
    });
  });
});
