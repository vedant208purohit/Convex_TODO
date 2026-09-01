/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Default App Store Organization Features Domain Tests", () => {
  const EXPECTED_FEATURE_KEYS = [
    "skip_phone_number_required",
    "show_waiter_on_cashier_card",
    "skip_payment_on_cashier_card",
    "show_table_on_cashier_card",
    "show_member_number_on_cashier_card",
    "show_table_tab_in_cashier",
    "auto_accept",
  ];

  async function setupStoreWithAdmin(adminSubject = "user_admin_123", adminRole = "admin") {
    const t = convexTest(schema, modules);
    const orgId = await t.mutation(api.organizations.create, {
      name: "Test POS Store",
      ownerClerkId: adminSubject,
    });
    const admin = t.withIdentity({ role: adminRole, subject: adminSubject });
    return { t, orgId, admin };
  }

  test("1 & 2. Feature initialization creates all seven audited feature keys with active = false", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    const features = await t.query(api.organizationFeatures.list, {});
    expect(features.length).toBe(7);

    const keys = features.map((f) => f.featureKey);
    for (const key of EXPECTED_FEATURE_KEYS) {
      expect(keys).toContain(key);
    }

    for (const feature of features) {
      expect(feature.active).toBe(false);
      expect(feature.createdAt).toBeDefined();
    }
  });

  test("3, 4 & 5. Initialization is idempotent and preserves existing active state on re-initialization", async () => {
    const { t, admin } = await setupStoreWithAdmin();

    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    // Store Admin toggles auto_accept to true
    await admin.mutation(api.organizationFeatures.toggle, {
      featureKey: "auto_accept",
      active: true,
    });

    const autoAcceptBefore = await t.query(api.organizationFeatures.get, {
      featureKey: "auto_accept",
    });
    expect(autoAcceptBefore?.active).toBe(true);

    // Run initialization a second time
    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    // Total records remain 7 (no duplicates)
    const featuresAfter = await t.query(api.organizationFeatures.list, {});
    expect(featuresAfter.length).toBe(7);

    // Preserves active = true
    const autoAcceptAfter = await t.query(api.organizationFeatures.get, {
      featureKey: "auto_accept",
    });
    expect(autoAcceptAfter?.active).toBe(true);
  });

  test("6. Store Admin can toggle feature flag active status", async () => {
    const { t, admin } = await setupStoreWithAdmin();

    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    await admin.mutation(api.organizationFeatures.toggle, {
      featureKey: "skip_phone_number_required",
      active: true,
    });

    const flag = await t.query(api.organizationFeatures.get, {
      featureKey: "skip_phone_number_required",
    });
    expect(flag?.active).toBe(true);

    // Toggle back to false
    await admin.mutation(api.organizationFeatures.toggle, {
      featureKey: "skip_phone_number_required",
      active: false,
    });

    const flagDisabled = await t.query(api.organizationFeatures.get, {
      featureKey: "skip_phone_number_required",
    });
    expect(flagDisabled?.active).toBe(false);
  });

  test("6b. Admin role aliases (store_admin, org_admin, super_admin) can toggle feature flags", async () => {
    const { t } = await setupStoreWithAdmin();
    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    // store_admin JWT claim caller
    const storeAdmin = t.withIdentity({ role: "store_admin", subject: "user_store_admin_1" });
    await storeAdmin.mutation(api.organizationFeatures.toggle, {
      featureKey: "auto_accept",
      active: true,
    });
    let flag = await t.query(api.organizationFeatures.get, { featureKey: "auto_accept" });
    expect(flag?.active).toBe(true);

    // org_admin JWT claim caller
    const orgAdmin = t.withIdentity({ role: "org_admin", subject: "user_org_admin_1" });
    await orgAdmin.mutation(api.organizationFeatures.toggle, {
      featureKey: "auto_accept",
      active: false,
    });
    flag = await t.query(api.organizationFeatures.get, { featureKey: "auto_accept" });
    expect(flag?.active).toBe(false);

    // super_admin JWT claim caller
    const superAdmin = t.withIdentity({ role: "super_admin", subject: "user_super_admin_1" });
    await superAdmin.mutation(api.organizationFeatures.toggle, {
      featureKey: "auto_accept",
      active: true,
    });
    flag = await t.query(api.organizationFeatures.get, { featureKey: "auto_accept" });
    expect(flag?.active).toBe(true);
  });

  test("7. Non-admin users (cashier, waiter, customer) cannot toggle feature flags", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();

    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    // Create cashier, waiter, customer staff records
    await admin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_cashier_1",
      userType: ["cashier"],
    });
    await admin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_waiter_1",
      userType: ["waiter"],
    });
    await admin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_customer_1",
      userType: ["customer"],
    });

    const cashier = t.withIdentity({ role: "cashier", subject: "user_cashier_1" });
    const waiter = t.withIdentity({ role: "waiter", subject: "user_waiter_1" });
    const customer = t.withIdentity({ role: "customer", subject: "user_customer_1" });

    // Cashier attempt fails
    await expect(
      cashier.mutation(api.organizationFeatures.toggle, {
        featureKey: "auto_accept",
        active: true,
      })
    ).rejects.toThrow(/Forbidden|Unauthorized/i);

    // Waiter attempt fails
    await expect(
      waiter.mutation(api.organizationFeatures.toggle, {
        featureKey: "auto_accept",
        active: true,
      })
    ).rejects.toThrow(/Forbidden|Unauthorized/i);

    // Customer attempt fails
    await expect(
      customer.mutation(api.organizationFeatures.toggle, {
        featureKey: "auto_accept",
        active: true,
      })
    ).rejects.toThrow(/Forbidden|Unauthorized/i);

    // Verify flag remained false
    const flag = await t.query(api.organizationFeatures.get, {
      featureKey: "auto_accept",
    });
    expect(flag?.active).toBe(false);
  });

  test("7b. Unauthenticated user cannot toggle feature flags", async () => {
    const { t } = await setupStoreWithAdmin();
    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    await expect(
      t.mutation(api.organizationFeatures.toggle, {
        featureKey: "auto_accept",
        active: true,
      })
    ).rejects.toThrow(/Unauthenticated/i);
  });

  test("7c. Admin from Org A cannot toggle feature flag scoped to Org B", async () => {
    const t = convexTest(schema, modules);

    // Seed defaults
    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    // Create Organization A and B
    await t.mutation(api.organizations.create, {
      name: "Org A",
      ownerClerkId: "admin_a",
    });
    const orgBId = await t.mutation(api.organizations.create, {
      name: "Org B",
      ownerClerkId: "admin_b",
    });

    const adminA = t.withIdentity({ subject: "admin_a" });

    // Attempting to invoke toggle with Org B explicitly when Admin A only belongs to Org A throws Forbidden
    await expect(
      adminA.mutation(api.organizationFeatures.toggle, {
        organizationId: orgBId,
        featureKey: "auto_accept",
        active: true,
      })
    ).rejects.toThrow(/Forbidden/i);
  });

  test("7d. Non-admin user cannot soft delete feature flag", async () => {
    const { t, orgId, admin } = await setupStoreWithAdmin();
    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    await admin.mutation(api.organizationUsers.create, {
      organizationId: orgId,
      userId: "user_cashier_2",
      userType: ["cashier"],
    });
    const cashier = t.withIdentity({ role: "cashier", subject: "user_cashier_2" });

    await expect(
      cashier.mutation(api.organizationFeatures.softDelete, {
        featureKey: "auto_accept",
      })
    ).rejects.toThrow(/Forbidden|Unauthorized/i);
  });

  test("8. `get` query returns feature flag state by featureKey", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    const flag = await t.query(api.organizationFeatures.get, {
      featureKey: "show_waiter_on_cashier_card",
    });

    expect(flag).not.toBeNull();
    expect(flag?.featureKey).toBe("show_waiter_on_cashier_card");
    expect(flag?.active).toBe(false);
  });

  test("9. `list` query returns store feature flags", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    const flags = await t.query(api.organizationFeatures.list, {});
    expect(flags.length).toBe(7);
  });

  test("10. Deleted flags are excluded from normal queries and not resurrected by initializeDefaults", async () => {
    const { t, admin } = await setupStoreWithAdmin();

    await t.mutation(api.organizationFeatures.initializeDefaults, {});

    // Soft delete auto_accept
    await admin.mutation(api.organizationFeatures.softDelete, {
      featureKey: "auto_accept",
    });

    const getRes = await t.query(api.organizationFeatures.get, {
      featureKey: "auto_accept",
    });
    expect(getRes).toBeNull();

    const activeList = await t.query(api.organizationFeatures.list, {});
    expect(activeList.length).toBe(6);

    // Re-initialization should NOT resurrect soft-deleted flag
    await t.mutation(api.organizationFeatures.initializeDefaults, {});
    const postInitGet = await t.query(api.organizationFeatures.get, {
      featureKey: "auto_accept",
    });
    expect(postInitGet).toBeNull();

    const fullList = await t.query(api.organizationFeatures.list, {
      includeDeleted: true,
    });
    expect(fullList.length).toBe(7);
  });

  test("11. Unknown feature key returns null for get and throws error for toggle", async () => {
    const { t, admin } = await setupStoreWithAdmin();

    const unknownGet = await t.query(api.organizationFeatures.get, {
      featureKey: "unknown_non_existent_key",
    });
    expect(unknownGet).toBeNull();

    await expect(
      admin.mutation(api.organizationFeatures.toggle, {
        featureKey: "unknown_non_existent_key",
        active: true,
      })
    ).rejects.toThrow(/not found/i);
  });

  test("12. Store provisioning (organizations:initializeStore) triggers feature flag seeding", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Saffron Grill",
    });

    await t.mutation(api.organizations.initializeStore, { id: orgId });

    const features = await t.query(api.organizationFeatures.list, {});
    expect(features.length).toBe(7);
    for (const f of features) {
      expect(f.active).toBe(false);
    }
  });
});
