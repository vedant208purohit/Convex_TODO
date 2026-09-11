/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { generateHmacSha256 } from "./organizations";

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

  // 18. syncStaffFromMaster with valid HMAC signature successfully provisions staff
  test("18. syncStaffFromMaster with valid HMAC signature creates new staff membership", async () => {
    const TEST_SECRET = "test-provisioning-secret-key-12345";
    process.env.PROVISIONING_SECRET = TEST_SECRET;

    const t = convexTest(schema, modules);
    const timestamp = Date.now();
    const createOrgToken = await generateHmacSha256(TEST_SECRET, `taco-haven:${timestamp}`);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Taco Haven",
      slug: "taco-haven",
      timestamp,
      provisioningToken: createOrgToken,
    });

    const syncToken = await generateHmacSha256(TEST_SECRET, `taco-haven:${timestamp}`);

    const result = await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "taco-haven",
      provisioningToken: syncToken,
      timestamp,
      defaultClerkId: "user_default_clerk_cashier_101",
      firstName: "Mateo",
      lastName: "Garcia",
      email: "mateo@tacohaven.com",
      phone: "+1 555-0144",
      role: "cashier",
    });

    expect(result.success).toBe(true);
    expect(result.isExisting).toBe(false);

    // Verify record in store database
    const asCashier = t.withIdentity({ subject: "user_default_clerk_cashier_101" });
    const member = await asCashier.query(api.organizationUsers.getByUserId, {
      userId: "user_default_clerk_cashier_101",
      organizationId: orgId,
    });

    expect(member !== null).toBe(true);
    expect(member?.firstName).toBe("Mateo");
    expect(member?.lastName).toBe("Garcia");
    expect(member?.email).toBe("mateo@tacohaven.com");
    expect(member?.userType).toEqual(["cashier"]);
    expect(member?.userPermission?.cashier?.read).toBe(true);
    expect(member?.userPermission?.cashier?.create).toBe(true);
  });

  // 19. syncStaffFromMaster rejects invalid signature, expired timestamp, or wrong slug
  test("19. syncStaffFromMaster enforces HMAC signature verification and timestamp replay protection", async () => {
    const TEST_SECRET = "test-provisioning-secret-key-12345";
    process.env.PROVISIONING_SECRET = TEST_SECRET;

    const t = convexTest(schema, modules);
    const now = Date.now();
    const createOrgToken = await generateHmacSha256(TEST_SECRET, `burger-spot:${now}`);

    await t.mutation(api.organizations.create, {
      name: "Burger Spot",
      slug: "burger-spot",
      timestamp: now,
      provisioningToken: createOrgToken,
    });

    // Missing / invalid token
    await expect(
      t.mutation(api.organizationUsers.syncStaffFromMaster, {
        slug: "burger-spot",
        provisioningToken: "invalid_hmac_token",
        timestamp: now,
        defaultClerkId: "user_clerk_1",
        role: "waiter",
      })
    ).rejects.toThrow("Invalid provisioning authentication token");

    // Expired timestamp (10 minutes ago)
    const expiredTimestamp = now - 10 * 60 * 1000;
    const expiredToken = await generateHmacSha256(TEST_SECRET, `burger-spot:${expiredTimestamp}`);
    await expect(
      t.mutation(api.organizationUsers.syncStaffFromMaster, {
        slug: "burger-spot",
        provisioningToken: expiredToken,
        timestamp: expiredTimestamp,
        defaultClerkId: "user_clerk_1",
        role: "waiter",
      })
    ).rejects.toThrow("Expired or invalid provisioning token timestamp");

    // Store slug mismatch (token signed for other-slug)
    const wrongSlugToken = await generateHmacSha256(TEST_SECRET, `other-store:${now}`);
    await expect(
      t.mutation(api.organizationUsers.syncStaffFromMaster, {
        slug: "other-store",
        provisioningToken: wrongSlugToken,
        timestamp: now,
        defaultClerkId: "user_clerk_1",
        role: "waiter",
      })
    ).rejects.toThrow("Store slug mismatch");
  });

  // 20. syncStaffFromMaster is idempotent on retry / updates existing member
  test("20. syncStaffFromMaster updates existing member idempotently without creating duplicates", async () => {
    const TEST_SECRET = "test-provisioning-secret-key-12345";
    process.env.PROVISIONING_SECRET = TEST_SECRET;

    const t = convexTest(schema, modules);
    const timestamp1 = Date.now();
    const createOrgToken = await generateHmacSha256(TEST_SECRET, `idempotent-pizza:${timestamp1}`);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Idempotent Pizza",
      slug: "idempotent-pizza",
      timestamp: timestamp1,
      provisioningToken: createOrgToken,
    });

    const token1 = await generateHmacSha256(TEST_SECRET, `idempotent-pizza:${timestamp1}`);

    // First call: create cashier
    const res1 = await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "idempotent-pizza",
      provisioningToken: token1,
      timestamp: timestamp1,
      defaultClerkId: "user_clerk_pizza_staff_1",
      firstName: "Luigi",
      role: "cashier",
    });
    expect(res1.isExisting).toBe(false);

    // Second call: update role to admin & chef
    const timestamp2 = Date.now();
    const token2 = await generateHmacSha256(TEST_SECRET, `idempotent-pizza:${timestamp2}`);

    const res2 = await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "idempotent-pizza",
      provisioningToken: token2,
      timestamp: timestamp2,
      defaultClerkId: "user_clerk_pizza_staff_1",
      firstName: "Luigi",
      lastName: "Mario",
      role: "chef",
    });
    expect(res2.isExisting).toBe(true);
    expect(res2.id).toBe(res1.id);

    // Verify only 1 member exists in organization
    const asStaff = t.withIdentity({ subject: "user_clerk_pizza_staff_1" });
    const members = await asStaff.query(api.organizationUsers.list, {
      organizationId: orgId,
    });
    expect(members.length).toBe(1);
    expect(members[0].lastName).toBe("Mario");
    expect(members[0].userType).toEqual(["chef"]);
  });

  // 21. syncStaffFromMaster restores soft-deleted membership
  test("21. syncStaffFromMaster restores soft-deleted membership on synchronization", async () => {
    const TEST_SECRET = "test-provisioning-secret-key-12345";
    process.env.PROVISIONING_SECRET = TEST_SECRET;

    const t = convexTest(schema, modules);
    const now = Date.now();
    const createOrgToken = await generateHmacSha256(TEST_SECRET, `reactivate-cafe:${now}`);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Reactivate Cafe",
      slug: "reactivate-cafe",
      ownerClerkId: "user_owner_reactivate",
      timestamp: now,
      provisioningToken: createOrgToken,
    });

    const token = await generateHmacSha256(TEST_SECRET, `reactivate-cafe:${now}`);

    const syncRes = await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "reactivate-cafe",
      provisioningToken: token,
      timestamp: now,
      defaultClerkId: "user_clerk_waiter_99",
      role: "waiter",
    });

    // Owner soft-deletes the waiter
    const asOwner = t.withIdentity({ subject: "user_owner_reactivate" });
    await asOwner.mutation(api.organizationUsers.remove, {
      id: syncRes.id,
    });

    // Re-syncing restores the waiter
    const restoreToken = await generateHmacSha256(TEST_SECRET, `reactivate-cafe:${now + 1000}`);
    const restoreRes = await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "reactivate-cafe",
      provisioningToken: restoreToken,
      timestamp: now + 1000,
      defaultClerkId: "user_clerk_waiter_99",
      role: "waiter",
    });

    expect(restoreRes.isExisting).toBe(true);
    expect(restoreRes.wasReactivated).toBe(true);

    const asWaiter = t.withIdentity({ subject: "user_clerk_waiter_99" });
    const restoredMember = await asWaiter.query(api.organizationUsers.getByUserId, {
      userId: "user_clerk_waiter_99",
      organizationId: orgId,
    });
    expect(restoredMember !== null).toBe(true);
    expect(restoredMember?.deletedAt).toBeUndefined();
  });

  test("22. Existing mutations still require regular authentication and admin permissions", async () => {
    delete process.env.PROVISIONING_SECRET;

    const { orgId, asAdmin, t } = await setupStoreWithAdmin("user_store_admin");
    const asCashier = t.withIdentity({ subject: "user_cashier_only" });

    // Admin creates the cashier member
    const memberId = await asAdmin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_cashier_only",
      userType: ["cashier"],
    });

    await expect(
      asCashier.mutation(api.organizationUsers.update, {
        id: memberId,
        userType: ["admin"],
      })
    ).rejects.toThrow("Forbidden. Admin access required.");
  });

  // 23. Role Synchronization: cashier -> admin grants elevated permissions
  test("23. syncStaffFromMaster updates role from cashier to admin and grants admin permissions", async () => {
    const TEST_SECRET = "test-provisioning-secret-key-12345";
    process.env.PROVISIONING_SECRET = TEST_SECRET;

    const t = convexTest(schema, modules);
    const now = Date.now();
    const orgToken = await generateHmacSha256(TEST_SECRET, `role-sync-bistro:${now}`);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Role Sync Bistro",
      slug: "role-sync-bistro",
      ownerClerkId: "user_owner_role_sync",
      timestamp: now,
      provisioningToken: orgToken,
    });

    // 1. Initially provision as cashier
    const token1 = await generateHmacSha256(TEST_SECRET, `role-sync-bistro:${now}`);
    await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "role-sync-bistro",
      provisioningToken: token1,
      timestamp: now,
      defaultClerkId: "user_clerk_promo_1",
      role: "cashier",
    });

    // 2. Promote to admin
    const token2 = await generateHmacSha256(TEST_SECRET, `role-sync-bistro:${now + 1000}`);
    const updateRes = await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "role-sync-bistro",
      provisioningToken: token2,
      timestamp: now + 1000,
      defaultClerkId: "user_clerk_promo_1",
      role: "admin",
    });

    expect(updateRes.isExisting).toBe(true);

    const asUser = t.withIdentity({ subject: "user_clerk_promo_1" });
    const member = await asUser.query(api.organizationUsers.getByUserId, {
      userId: "user_clerk_promo_1",
      organizationId: orgId,
    });

    expect(member?.userType).toEqual(["admin"]);
    expect(member?.userPermission?.admin?.create).toBe(true);
    expect(member?.userPermission?.admin?.delete).toBe(true);
    // Old cashier permission pruned
    expect(member?.userPermission?.cashier).toBeUndefined();
  });

  // 24. Role Synchronization: admin -> cashier prunes elevated permissions
  test("24. syncStaffFromMaster demotes admin to cashier and prunes admin permissions", async () => {
    const TEST_SECRET = "test-provisioning-secret-key-12345";
    process.env.PROVISIONING_SECRET = TEST_SECRET;

    const t = convexTest(schema, modules);
    const now = Date.now();
    const orgToken = await generateHmacSha256(TEST_SECRET, `demote-bistro:${now}`);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Demote Bistro",
      slug: "demote-bistro",
      ownerClerkId: "user_owner_demote",
      timestamp: now,
      provisioningToken: orgToken,
    });

    // 1. Initially provision as admin
    const token1 = await generateHmacSha256(TEST_SECRET, `demote-bistro:${now}`);
    await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "demote-bistro",
      provisioningToken: token1,
      timestamp: now,
      defaultClerkId: "user_clerk_demote_1",
      role: "admin",
    });

    // 2. Demote to cashier
    const token2 = await generateHmacSha256(TEST_SECRET, `demote-bistro:${now + 1000}`);
    await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "demote-bistro",
      provisioningToken: token2,
      timestamp: now + 1000,
      defaultClerkId: "user_clerk_demote_1",
      role: "cashier",
    });

    const asUser = t.withIdentity({ subject: "user_clerk_demote_1" });
    const member = await asUser.query(api.organizationUsers.getByUserId, {
      userId: "user_clerk_demote_1",
      organizationId: orgId,
    });

    expect(member?.userType).toEqual(["cashier"]);
    expect(member?.userPermission?.cashier?.read).toBe(true);
    // Admin permissions strictly deleted
    expect(member?.userPermission?.admin).toBeUndefined();
  });

  // 25. Role Synchronization: chef -> waiter
  test("25. syncStaffFromMaster changes chef to waiter", async () => {
    const TEST_SECRET = "test-provisioning-secret-key-12345";
    process.env.PROVISIONING_SECRET = TEST_SECRET;

    const t = convexTest(schema, modules);
    const now = Date.now();
    const orgToken = await generateHmacSha256(TEST_SECRET, `kitchen-bistro:${now}`);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Kitchen Bistro",
      slug: "kitchen-bistro",
      ownerClerkId: "user_owner_kitchen",
      timestamp: now,
      provisioningToken: orgToken,
    });

    const token1 = await generateHmacSha256(TEST_SECRET, `kitchen-bistro:${now}`);
    await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "kitchen-bistro",
      provisioningToken: token1,
      timestamp: now,
      defaultClerkId: "user_clerk_kitchen_1",
      role: "chef",
    });

    const token2 = await generateHmacSha256(TEST_SECRET, `kitchen-bistro:${now + 1000}`);
    await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "kitchen-bistro",
      provisioningToken: token2,
      timestamp: now + 1000,
      defaultClerkId: "user_clerk_kitchen_1",
      role: "waiter",
    });

    const asUser = t.withIdentity({ subject: "user_clerk_kitchen_1" });
    const member = await asUser.query(api.organizationUsers.getByUserId, {
      userId: "user_clerk_kitchen_1",
      organizationId: orgId,
    });

    expect(member?.userType).toEqual(["waiter"]);
    expect(member?.userPermission?.waiter).toBeDefined();
    expect(member?.userPermission?.chef).toBeUndefined();
  });

  // 26. Role Synchronization: waiter -> captain
  test("26. syncStaffFromMaster changes waiter to captain", async () => {
    const TEST_SECRET = "test-provisioning-secret-key-12345";
    process.env.PROVISIONING_SECRET = TEST_SECRET;

    const t = convexTest(schema, modules);
    const now = Date.now();
    const orgToken = await generateHmacSha256(TEST_SECRET, `floor-bistro:${now}`);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Floor Bistro",
      slug: "floor-bistro",
      ownerClerkId: "user_owner_floor",
      timestamp: now,
      provisioningToken: orgToken,
    });

    const token1 = await generateHmacSha256(TEST_SECRET, `floor-bistro:${now}`);
    await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "floor-bistro",
      provisioningToken: token1,
      timestamp: now,
      defaultClerkId: "user_clerk_floor_1",
      role: "waiter",
    });

    const token2 = await generateHmacSha256(TEST_SECRET, `floor-bistro:${now + 1000}`);
    await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "floor-bistro",
      provisioningToken: token2,
      timestamp: now + 1000,
      defaultClerkId: "user_clerk_floor_1",
      role: "captain",
    });

    const asUser = t.withIdentity({ subject: "user_clerk_floor_1" });
    const member = await asUser.query(api.organizationUsers.getByUserId, {
      userId: "user_clerk_floor_1",
      organizationId: orgId,
    });

    expect(member?.userType).toEqual(["captain"]);
    expect(member?.userPermission?.captain).toBeDefined();
    expect(member?.userPermission?.waiter).toBeUndefined();
  });

  // 27. Repeated role synchronization is idempotent
  test("27. Repeated role synchronization with identical role is idempotent", async () => {
    const TEST_SECRET = "test-provisioning-secret-key-12345";
    process.env.PROVISIONING_SECRET = TEST_SECRET;

    const t = convexTest(schema, modules);
    const now = Date.now();
    const orgToken = await generateHmacSha256(TEST_SECRET, `idem-bistro:${now}`);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Idem Bistro",
      slug: "idem-bistro",
      ownerClerkId: "user_owner_idem",
      timestamp: now,
      provisioningToken: orgToken,
    });

    const token1 = await generateHmacSha256(TEST_SECRET, `idem-bistro:${now}`);
    const res1 = await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "idem-bistro",
      provisioningToken: token1,
      timestamp: now,
      defaultClerkId: "user_clerk_idem_1",
      role: "cashier",
    });

    const token2 = await generateHmacSha256(TEST_SECRET, `idem-bistro:${now + 1000}`);
    const res2 = await t.mutation(api.organizationUsers.syncStaffFromMaster, {
      slug: "idem-bistro",
      provisioningToken: token2,
      timestamp: now + 1000,
      defaultClerkId: "user_clerk_idem_1",
      role: "cashier",
    });

    expect(res1.id).toBe(res2.id);
    expect(res2.isExisting).toBe(true);

    const asOwner = t.withIdentity({ subject: "user_owner_idem" });
    const allMembers = await asOwner.query(api.organizationUsers.list, {
      organizationId: orgId,
    });
    // Exactly 1 record for this staff member (plus the 1 auto-created owner)
    const staffMembers = allMembers.filter((m) => m.userId === "user_clerk_idem_1");
    expect(staffMembers.length).toBe(1);
  });

  // 28. Rejects cross-store slug mismatch
  test("28. Rejects cross-store slug mismatch during synchronization", async () => {
    const TEST_SECRET = "test-provisioning-secret-key-12345";
    process.env.PROVISIONING_SECRET = TEST_SECRET;

    const t = convexTest(schema, modules);
    const now = Date.now();
    const orgToken = await generateHmacSha256(TEST_SECRET, `store-alpha:${now}`);

    await t.mutation(api.organizations.create, {
      name: "Store Alpha",
      slug: "store-alpha",
      ownerClerkId: "user_owner_alpha",
      timestamp: now,
      provisioningToken: orgToken,
    });

    // Token signed for store-beta, but target store is store-alpha
    const badToken = await generateHmacSha256(TEST_SECRET, `store-beta:${now}`);

    await expect(
      t.mutation(api.organizationUsers.syncStaffFromMaster, {
        slug: "store-beta",
        provisioningToken: badToken,
        timestamp: now,
        defaultClerkId: "user_clerk_cross_1",
        role: "cashier",
      })
    ).rejects.toThrow('Store slug mismatch: target store "store-alpha" does not match provisioning token slug "store-beta".');
  });
});
