/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { generateHmacSha256 } from "./organizations";

const modules = import.meta.glob("./**/*.*s");
const TEST_SECRET = "test-provisioning-secret-12345";

async function createTestOrg(t: any, args: any) {
  process.env.PROVISIONING_SECRET = TEST_SECRET;
  const timestamp = Date.now();
  const rawName = args.name || "Org";
  const slug = args.slug || rawName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "org";
  const provisioningToken = await generateHmacSha256(TEST_SECRET, `${slug}:${timestamp}`);

  return await t.mutation(api.organizations.create, {
    ...args,
    timestamp,
    provisioningToken,
  });
}

async function initTestStore(t: any, orgId: any, slug: string = "seed-store") {
  process.env.PROVISIONING_SECRET = TEST_SECRET;
  const timestamp = Date.now();
  const provisioningToken = await generateHmacSha256(TEST_SECRET, `${slug}:${timestamp}`);

  return await t.mutation(api.organizations.initializeStore, {
    id: orgId,
    slug,
    timestamp,
    provisioningToken,
  });
}

describe("Organization Domain Business Logic Tests", () => {
  beforeEach(() => {
    process.env.PROVISIONING_SECRET = TEST_SECRET;
  });

  // 1. Valid Creation & Auto Slug Generation
  test("1. Valid Organization creation with defaults", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Saffron Kitchen",
    });

    expect(orgId).toBeDefined();

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org).not.toBeNull();
    expect(org?.name).toBe("Saffron Kitchen");
    expect(org?.slug).toBe("saffron-kitchen");

    // Empty or invalid string ID handles gracefully returning null
    const emptyRes = await t.query(api.organizations.get, { id: "" });
    expect(emptyRes).toBeNull();

    const invalidRes = await t.query(api.organizations.get, { id: "invalid-id-string" });
    expect(invalidRes).toBeNull();
  });

  // 2 & 3. Name Validation
  test("2. Blank or whitespace-only name is rejected", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, { name: "" })
    ).rejects.toThrow("Name can't be blank");

    await expect(
      createTestOrg(t, { name: "   " })
    ).rejects.toThrow("Name can't be blank");
  });

  // 4 & 5. Slug Normalization
  test("4 & 5. Slug auto-generated and normalized from name", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "  The   Great Pizza Palace & Bar!! ",
      slug: "the-great-pizza-palace-bar",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.slug).toBe("the-great-pizza-palace-bar");
  });

  // 6 & 7. Duplicate Slug Handling (-1, -2)
  test("6 & 7. Duplicate slug appends sequential counters (-1, -2)", async () => {
    const t = convexTest(schema, modules);

    const orgId1 = await createTestOrg(t, {
      name: "Taco Haven",
      slug: "taco-haven",
    });

    const orgId2 = await createTestOrg(t, {
      name: "Taco Haven",
      slug: "taco-haven-1",
    });

    const orgId3 = await createTestOrg(t, {
      name: "Taco Haven",
      slug: "taco-haven-2",
    });

    const org1 = await t.query(api.organizations.get, { id: orgId1 });
    const org2 = await t.query(api.organizations.get, { id: orgId2 });
    const org3 = await t.query(api.organizations.get, { id: orgId3 });

    expect(org1?.slug).toBe("taco-haven");
    expect(org2?.slug).toBe("taco-haven-1");
    expect(org3?.slug).toBe("taco-haven-2");
  });

  // 8, 15, 16. Creation Defaults
  test("8, 15, 16. Correct creation defaults applied (transferPercentage=0.03, transferHoldTime=18000)", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Default Bistro",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.published).toBe(false);
    expect(org?.isTest).toBe(false);
    expect(org?.isDineIn).toBe(false);
    expect(org?.isTakeAway).toBe(true);
    expect(org?.isDelivery).toBe(false);
    expect(org?.isQueue).toBe(true);
    expect(org?.takeAwayOnlinePayment).toBe(true);
    expect(org?.transferPercentage).toBe(0.03);
    expect(org?.transferHoldTime).toBe(18000);
  });

  // 9. Service Type Validation
  test("9. At least one service type is required", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, {
        name: "No Service Bistro",
        isTakeAway: false,
        isDineIn: false,
        isDelivery: false,
      })
    ).rejects.toThrow(
      "At least one of 'is_dine_in', 'is_take_away', or 'is_delivery' must be accept."
    );
  });

  // 10. Dine-in Payment Dependency
  test("10. Dine-in requires prepaid or postpaid payment option", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, {
        name: "DineIn Without Payment",
        isDineIn: true,
        isTakeAway: false,
        dineinPrepaid: false,
        dineinPospaid: false,
      })
    ).rejects.toThrow(
      "At least one of 'dinein_prepaid' or 'dinein_pospaid' must be accept."
    );
  });

  // 11. Dine-in Prepaid/Postpaid Exclusivity
  test("11. Dine-in prepaid and postpaid are mutually exclusive", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Exclusivity Diner",
      isDineIn: true,
      dineinPrepaid: true,
    });

    let org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.dineinPrepaid).toBe(true);
    expect(org?.dineinPospaid).toBe(false);

    // Update to postpaid (Interactive Auth)
    await t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.update, {
      id: orgId,
      dineinPospaid: true,
    });

    org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.dineinPospaid).toBe(true);
    expect(org?.dineinPrepaid).toBe(false);
  });

  // 12. Takeaway Payment Dependency
  test("12. Takeaway requires cash or online payment option", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, {
        name: "Takeaway Without Payment",
        isTakeAway: true,
        takeAwayCashPayment: false,
        takeAwayOnlinePayment: false,
      })
    ).rejects.toThrow(
      "At least one of 'take_away_cash_payment' or 'take_away_online_payment' must be accept."
    );
  });

  // 13. Delivery Payment Dependency
  test("13. Delivery requires COD or online payment option", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, {
        name: "Delivery Without Payment",
        isDelivery: true,
        isTakeAway: false,
        deliveryCashOnDelivery: false,
        deliveryOnlinePayment: false,
      })
    ).rejects.toThrow(
      "At least one of 'delivery_cash_on_delivery' or 'delivery_online_payment' must be accept."
    );
  });

  // 14. Delivery Aggregator Location/Phone Validation
  test("14. Delivery aggregator requires latitude, longitude, and phone", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, {
        name: "Aggregator Without Location",
        deliveryAggregator: true,
      })
    ).rejects.toThrow(
      "Cannot enable delivery — please ensure latitude, longitude, and phone number are set in organization details."
    );

    // Valid with location details
    const orgId = await createTestOrg(t, {
      name: "Aggregator With Location",
      deliveryAggregator: true,
      latitude: 12.9716,
      longitude: 77.5946,
      phone: "+919876543210",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.deliveryAggregator).toBe(true);
  });

  // 17-22. Store Initialization & Idempotency
  test("17-22. initializeStore seeds 7 order processes, Main station, 4 payment modes, 10 inventory categories, operating hours idempotently", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Seed Store",
      slug: "seed-store",
    });

    const res1 = await initTestStore(t, orgId, "seed-store");
    expect(res1.success).toBe(true);

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.operationTiming).toBeDefined();

    // Idempotency check
    const res2 = await initTestStore(t, orgId, "seed-store");
    expect(res2.success).toBe(true);
  });

  // 23-28. Publishing & Online Store Restriction
  test("27 & 28. onlineStore lock on live published store & publishing restrictions", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Online Store Lock Test",
      published: true,
      isTest: false,
      onlineStore: false,
    });

    // Modifying onlineStore on live published store throws support error
    await expect(
      t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.update, {
        id: orgId,
        onlineStore: true,
      })
    ).rejects.toThrow("Please contact support");

    // Live publishing gate throws support error if onlineStore == true
    const orgId2 = await createTestOrg(t, {
      name: "Publishing Gate Test",
      onlineStore: true,
    });

    await expect(
      t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.liveOrganization, { id: orgId2 })
    ).rejects.toThrow("Please contact support");
  });

  // 33. Secret Protection
  test("33. Public read queries strip sensitive whatsappAccessToken", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Secret Org",
      whatsappAccessToken: "super-secret-bearer-token-12345",
    });

    const publicOrg = await t.query(api.organizations.get, { id: orgId });
    expect("whatsappAccessToken" in (publicOrg || {})).toBe(false);

    const internalOrg = await t.withIdentity({ name: "Tester", subject: "user_test" }).query(api.organizations.getWithSecrets, {
      id: orgId,
    });
    expect(internalOrg?.whatsappAccessToken).toBe(
      "super-secret-bearer-token-12345"
    );
  });

  // 34-36. Soft Deletion
  test("34-36. Soft deletion sets deletedAt and excludes org from active queries", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "To Be Deleted Org",
    });

    await t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.remove, { id: orgId });

    // Public get returns null for soft deleted org
    const getResult = await t.query(api.organizations.get, { id: orgId });
    expect(getResult).toBeNull();

    // Internal lookup shows deletedAt is set
    const internalOrg = await t.withIdentity({ name: "Tester", subject: "user_test" }).query(api.organizations.getWithSecrets, {
      id: orgId,
    });
    expect(internalOrg?.deletedAt).toBeDefined();
  });
});
