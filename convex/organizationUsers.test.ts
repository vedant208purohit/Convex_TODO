/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Users Domain Unit & Business Logic Tests", () => {
  // Helper: Setup store with an initial admin user
  async function setupStoreWithAdmin(adminClerkId = "user_admin_1") {
    const t = convexTest(schema, modules);

    // Create organization with initial owner
    const orgId = await t.mutation(api.organizations.create, {
      name: "Spice Garden",
      ownerClerkId: adminClerkId,
    });

    const asAdmin = t.withIdentity({ subject: adminClerkId });

    return { t, orgId, adminClerkId, asAdmin };
  }

  // 1. Initial Owner Provisioning Flow
  test("1. Initial Owner is auto-created as admin on organization creation", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin("user_owner_99");

    const ownerMember = await asAdmin.query(api.organizationUsers.getByUserId, {
      userId: "user_owner_99",
      organizationId: orgId,
    });

    expect(ownerMember).not.toBeNull();
    expect(ownerMember?.userId).toBe("user_owner_99");
    expect(ownerMember?.userType).toEqual(["admin"]);
    expect(ownerMember?.userPermission?.admin?.create).toBe(true);
    expect(ownerMember?.userPermission?.admin?.delete).toBe(true);
  });

  // 2. Dedicated createInitialOwner Mutation
  test("2. Dedicated createInitialOwner mutation creates or restores admin membership", async () => {
    const t = convexTest(schema, modules);
    const orgId = await t.mutation(api.organizations.create, {
      name: "Coastal Breeze",
    });

    const memberId = await t.mutation(api.organizations.createInitialOwner, {
      organizationId: orgId,
      ownerClerkId: "user_founder_1",
    });
    expect(memberId).toBeDefined();

    const asFounder = t.withIdentity({ subject: "user_founder_1" });
    const member = await asFounder.query(api.organizationUsers.getByUserId, {
      userId: "user_founder_1",
      organizationId: orgId,
    });
    expect(member?.userType).toContain("admin");
  });

  // 3. Unauthenticated requests are rejected
  test("3. Unauthenticated queries and mutations are rejected", async () => {
    const { t, orgId } = await setupStoreWithAdmin();

    // Query without auth
    await expect(
      t.query(api.organizationUsers.list, { organizationId: orgId })
    ).rejects.toThrow("Unauthenticated");

    // Mutation without auth
    await expect(
      t.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_staff_1",
        userType: ["cashier"],
      })
    ).rejects.toThrow("Unauthenticated");
  });

  // 4. Non-member authenticated caller is rejected
  test("4. Authenticated caller without store membership is forbidden", async () => {
    const { t, orgId } = await setupStoreWithAdmin("user_admin_1");
    const asStranger = t.withIdentity({ subject: "user_stranger_unknown" });

    await expect(
      asStranger.query(api.organizationUsers.list, { organizationId: orgId })
    ).rejects.toThrow("Forbidden. Active store membership required.");

    await expect(
      asStranger.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_staff_1",
        userType: ["cashier"],
      })
    ).rejects.toThrow("Forbidden. Admin access required.");
  });

  // 5. Admin can create new staff members with role & automatic permissions
  test("5. Admin creates staff member with role and automatic CRUD permissions", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin();

    const staffId = await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_cashier_1",
      userType: ["cashier", "kds"],
    });

    expect(staffId).toBeDefined();

    const member = await asAdmin.query(api.organizationUsers.get, {
      id: staffId,
    });

    expect(member?.userId).toBe("user_cashier_1");
    expect(member?.userType).toEqual(["cashier", "kds"]);
    expect(member?.userPermission?.cashier?.read).toBe(true);
    expect(member?.userPermission?.kds?.read).toBe(true);
    expect(member?.deletedAt).toBeUndefined();
  });

  // 6. Duplicate active membership is rejected
  test("6. Duplicate active membership creation for same user is rejected", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin();

    await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_waiter_1",
      userType: ["waiter"],
    });

    await expect(
      asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_waiter_1",
        userType: ["waiter"],
      })
    ).rejects.toThrow('User "user_waiter_1" is already a member');
  });

  // 7. Invalid user type is rejected
  test("7. Invalid user type is rejected", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin();

    await expect(
      asAdmin.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_invalid_role",
        userType: ["super_duper_admin" as any],
      })
    ).rejects.toThrow("Invalid user type");
  });

  // 8. Non-admin staff cannot create other staff members
  test("8. Non-admin staff (e.g. cashier) cannot create staff members", async () => {
    const { t, orgId, asAdmin } = await setupStoreWithAdmin();

    await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_cashier_only",
      userType: ["cashier"],
    });

    const asCashier = t.withIdentity({ subject: "user_cashier_only" });

    await expect(
      asCashier.mutation(api.organizationUsers.create, {
        organizationId: orgId,
        userId: "user_another_staff",
        userType: ["waiter"],
      })
    ).rejects.toThrow("Forbidden. Admin access required.");
  });

  // 9. addType appends roles and synchronizes permissions
  test("9. addType appends new role tags and merges default permissions", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin();

    const staffId = await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_multi_role",
      userType: ["waiter"],
    });

    const res = await asAdmin.mutation(api.organizationUsers.addType, {
      id: staffId,
      types: ["captain", "kds"],
    });

    expect(res.userType).toContain("waiter");
    expect(res.userType).toContain("captain");
    expect(res.userType).toContain("kds");

    const updated = await asAdmin.query(api.organizationUsers.get, {
      id: staffId,
    });

    expect(updated?.userPermission?.waiter?.create).toBe(true);
    expect(updated?.userPermission?.captain?.create).toBe(true);
    expect(updated?.userPermission?.kds?.create).toBe(true);
  });

  // 10. removeType prunes roles and prunes permissions
  test("10. removeType removes role tags and prunes corresponding permissions", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin();

    const staffId = await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_prune_test",
      userType: ["cashier", "inventory", "menu"],
    });

    const res = await asAdmin.mutation(api.organizationUsers.removeType, {
      id: staffId,
      types: ["menu"],
    });

    expect(res.userType).toEqual(["cashier", "inventory"]);
    expect(res.deleted).toBe(false);

    const updated = await asAdmin.query(api.organizationUsers.get, {
      id: staffId,
    });

    expect(updated?.userPermission?.cashier).toBeDefined();
    expect(updated?.userPermission?.inventory).toBeDefined();
    expect(updated?.userPermission?.menu).toBeUndefined();
  });

  // 11. removeType automatically soft-deletes when userType becomes empty
  test("11. removeType automatically soft-deletes membership when userType becomes empty", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin();

    const staffId = await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_empty_role_test",
      userType: ["worker"],
    });

    const res = await asAdmin.mutation(api.organizationUsers.removeType, {
      id: staffId,
      types: ["worker"],
    });

    expect(res.deleted).toBe(true);

    const member = await asAdmin.query(api.organizationUsers.get, {
      id: staffId,
    });
    expect(member).toBeNull();
  });

  // 12. Self-Removal Guard
  test("12. Admin cannot delete their own membership (Self-Removal Prevention)", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin("user_admin_self");

    // Add another admin so sole admin isn't the reason
    await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_admin_second",
      userType: ["admin"],
    });

    const ownMember = await asAdmin.query(api.organizationUsers.getByUserId, {
      userId: "user_admin_self",
      organizationId: orgId,
    });

    // Calling remove on self throws "Sorry, you can't remove yourself"
    await expect(
      asAdmin.mutation(api.organizationUsers.remove, {
        id: ownMember!._id,
      })
    ).rejects.toThrow("Sorry, you can't remove yourself");
  });

  // 13. Sole Admin Protection on remove
  test("13. Sole admin cannot be removed by anyone", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin("user_sole_admin");

    const ownMember = await asAdmin.query(api.organizationUsers.getByUserId, {
      userId: "user_sole_admin",
      organizationId: orgId,
    });

    await expect(
      asAdmin.mutation(api.organizationUsers.remove, {
        id: ownMember!._id,
      })
    ).rejects.toThrow();
  });

  // 14. Sole Admin Protection on removeType & update
  test("14. Sole admin cannot have admin role stripped via removeType or update", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin("user_sole_admin_stripping");

    const ownMember = await asAdmin.query(api.organizationUsers.getByUserId, {
      userId: "user_sole_admin_stripping",
      organizationId: orgId,
    });

    // Try removing admin role via removeType
    await expect(
      asAdmin.mutation(api.organizationUsers.removeType, {
        id: ownMember!._id,
        types: ["admin"],
      })
    ).rejects.toThrow("Cannot remove the sole admin of the organization.");

    // Try stripping admin role via update
    await expect(
      asAdmin.mutation(api.organizationUsers.update, {
        id: ownMember!._id,
        userType: ["cashier"],
      })
    ).rejects.toThrow("Cannot remove the sole admin of the organization.");
  });

  // 15. Multiple Admins can remove each other
  test("15. With multiple admins, Admin A can remove Admin B", async () => {
    const { t, orgId, asAdmin } = await setupStoreWithAdmin("user_admin_A");

    const adminBId = await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_admin_B",
      userType: ["admin"],
    });

    // Admin A removes Admin B
    const res = await asAdmin.mutation(api.organizationUsers.remove, {
      id: adminBId,
    });

    expect(res.success).toBe(true);

    const lookup = await asAdmin.query(api.organizationUsers.get, {
      id: adminBId,
    });
    expect(lookup).toBeNull();
  });

  // 16. getCurrentMembership query
  test("16. getCurrentMembership returns the authenticated caller's active membership", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin("user_current_test");

    const membership = await asAdmin.query(
      api.organizationUsers.getCurrentMembership,
      { organizationId: orgId }
    );

    expect(membership).not.toBeNull();
    expect(membership?.userId).toBe("user_current_test");
    expect(membership?.userType).toEqual(["admin"]);
  });

  // 17. list and search queries exclude customer-only members by default
  test("17. list and search queries exclude customer-only members unless includeCustomers is true", async () => {
    const { orgId, asAdmin } = await setupStoreWithAdmin();

    // Create a staff member
    await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_staff_chef",
      userType: ["chef"],
    });

    // Create a customer-only member
    await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_customer_diner",
      userType: ["customer"],
    });

    // Default list returns staff only (admin + chef)
    const staffList = await asAdmin.query(api.organizationUsers.list, {
      organizationId: orgId,
    });
    expect(staffList.length).toBe(2);
    expect(staffList.some((m) => m.userId === "user_customer_diner")).toBe(false);

    // includeCustomers = true returns all 3
    const allList = await asAdmin.query(api.organizationUsers.list, {
      organizationId: orgId,
      includeCustomers: true,
    });
    expect(allList.length).toBe(3);

    // search by userType = "chef"
    const searchChef = await asAdmin.query(api.organizationUsers.search, {
      organizationId: orgId,
      userType: "chef",
    });
    expect(searchChef.length).toBe(1);
    expect(searchChef[0].userId).toBe("user_staff_chef");
  });
});
