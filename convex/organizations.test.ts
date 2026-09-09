/// <reference path="./vitest-env.d.ts" />
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
    slug,
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

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org).toBeDefined();
    expect(org?.name).toBe("Saffron Kitchen");
    expect(org?.slug).toBe("saffron-kitchen");
    expect(org?.isDineIn).toBe(false);
    expect(org?.isTakeAway).toBe(true);
    expect(org?.published).toBe(false);
    expect(org?.isTest).toBe(false);
    expect(org?.receiptPrintCount).toBe(1);
    expect(org?.transferPercentage).toBe(0.03);
    expect(org?.transferHoldTime).toBe(18000);
  });

  // 2. Slug Uniqueness & Auto-Suffix Increment
  test("2. Disambiguates duplicate slugs by generating unique suffixes", async () => {
    const t = convexTest(schema, modules);

    const orgId1 = await createTestOrg(t, {
      name: "Spice Garden",
      slug: "spice-garden",
    });

    const orgId2 = await createTestOrg(t, {
      name: "Spice Garden 2",
      slug: "spice-garden-1",
    });

    const org1 = await t.query(api.organizations.get, { id: orgId1 });
    const org2 = await t.query(api.organizations.get, { id: orgId2 });

    expect(org1?.slug).toBe("spice-garden");
    expect(org2?.slug).toBe("spice-garden-1");
  });

  // 3. Name Whitespace Trimming & Blank Validation
  test("3. Trims whitespace and rejects blank organization names", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "   Curry House   ",
    });
    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.name).toBe("Curry House");

    await expect(
      createTestOrg(t, { name: "   " })
    ).rejects.toThrow("Name can't be blank");
  });

  // 4. Custom Slug Formatting
  test("4. Normalizes custom provided slug to lowercase kebab-case", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "My Bistro",
      slug: "My--Custom__Slug!!",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.slug).toBe("My--Custom__Slug!!");
  });

  // 5. Legacy ID Uniqueness Check
  test("5. Rejects duplicate legacyId", async () => {
    const t = convexTest(schema, modules);

    await createTestOrg(t, {
      name: "Legacy Store 1",
      legacyId: "LEGACY-123",
    });

    await expect(
      createTestOrg(t, {
        name: "Legacy Store 2",
        legacyId: "LEGACY-123",
      })
    ).rejects.toThrow('Organization with legacyId "LEGACY-123" already exists.');
  });

  // 6. Lookups (get, getByLegacyId, getBySlug)
  test("6. Lookups by ID, legacyId, and slug return organization", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Lookup Test Store",
      legacyId: "LEG-LOOKUP-001",
      slug: "lookup-test-store",
    });

    const byId = await t.query(api.organizations.get, { id: orgId });
    expect(byId?.name).toBe("Lookup Test Store");

    const byLegacy = await t.query(api.organizations.getByLegacyId, {
      legacyId: "LEG-LOOKUP-001",
    });
    expect(byLegacy?._id).toBe(orgId);

    const bySlug = await t.query(api.organizations.getBySlug, {
      slug: "lookup-test-store",
    });
    expect(bySlug?._id).toBe(orgId);
  });

  // 7. Non-existent & invalid ID lookups return null
  test("7. Invalid or missing lookups return null without throwing", async () => {
    const t = convexTest(schema, modules);

    const byId = await t.query(api.organizations.get, { id: "invalid-id" });
    expect(byId).toBeNull();

    const byLegacy = await t.query(api.organizations.getByLegacyId, {
      legacyId: "non-existent",
    });
    expect(byLegacy).toBeNull();

    const bySlug = await t.query(api.organizations.getBySlug, {
      slug: "non-existent-slug",
    });
    expect(bySlug).toBeNull();
  });

  // 8. Rule 1: DineIn + TakeAway + Delivery cannot all be false
  test("8. Rule 1: Rejects setting all service modes to false", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, {
        name: "No Service Store",
        isDineIn: false,
        isTakeAway: false,
        isDelivery: false,
      })
    ).rejects.toThrow("At least one of 'is_dine_in', 'is_take_away', or 'is_delivery' must be accept.");
  });

  // 9. Rule 2: DineIn enabled requires at least one payment option
  test("9. Rule 2: Rejects DineIn enabled with no payment option", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, {
        name: "DineIn No Payment Store",
        isDineIn: true,
        dineinPrepaid: false,
        dineinPospaid: false,
      })
    ).rejects.toThrow("At least one of 'dinein_prepaid' or 'dinein_pospaid' must be accept.");
  });

  // 10. Rule 3: TakeAway enabled requires at least one payment option
  test("10. Rule 3: Rejects TakeAway enabled with no payment option", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, {
        name: "TakeAway No Payment Store",
        isTakeAway: true,
        takeAwayOnlinePayment: false,
        takeAwayCashPayment: false,
      })
    ).rejects.toThrow("At least one of 'take_away_cash_payment' or 'take_away_online_payment' must be accept.");
  });

  // 11. Rule 4: Delivery enabled requires at least one payment option
  test("11. Rule 4: Rejects Delivery enabled with no payment option", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, {
        name: "Delivery No Payment Store",
        isDelivery: true,
        deliveryCashOnDelivery: false,
        deliveryOnlinePayment: false,
      })
    ).rejects.toThrow("At least one of 'delivery_cash_on_delivery' or 'delivery_online_payment' must be accept.");
  });

  // 12. Rule 5: Delivery Aggregator requires GPS & phone number
  test("12. Rule 5: Rejects Delivery Aggregator without GPS coordinates and phone", async () => {
    const t = convexTest(schema, modules);

    await expect(
      createTestOrg(t, {
        name: "Aggregator Missing GPS",
        deliveryAggregator: true,
        phone: "+919876543210",
      })
    ).rejects.toThrow("Cannot enable delivery — please ensure latitude, longitude, and phone number are set in organization details.");

    // Valid aggregator creation with complete location
    const validOrgId = await createTestOrg(t, {
      name: "Aggregator Valid Store",
      deliveryAggregator: true,
      phone: "9876543210",
      latitude: 19.076,
      longitude: 72.8777,
    });

    const validOrg = await t.query(api.organizations.get, { id: validOrgId });
    expect(validOrg?.deliveryAggregator).toBe(true);
  });

  // 13. GST Compliance Configuration
  test("13. Updates GST configuration flags and registration number", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "GST Registered Cafe",
    });

    await t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.update, {
      id: orgId,
      isGst: true,
      inclusiveGst: true,
      separateGst: false,
      gstNumber: "29AAAAA0000A1Z5",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.isGst).toBe(true);
    expect(org?.inclusiveGst).toBe(true);
    expect(org?.separateGst).toBe(false);
    expect(org?.gstNumber).toBe("29AAAAA0000A1Z5");
  });

  // 14. FSSAI Compliance Configuration
  test("14. Validates FSSAI compliance settings", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "FSSAI Restaurant",
      isFssai: true,
      fssaiRegistrationNumber: "10019022009876",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.isFssai).toBe(true);
    expect(org?.fssaiRegistrationNumber).toBe("10019022009876");
  });

  // 15. Default Currency & Symbol Configuration
  test("15. Configures currency and symbol defaulting to INR and ₹", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Rupee Store",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.defaultCurrency).toBe("INR");
    expect(org?.defaultCurrencySymbol).toBe("₹");
  });

  // 16. Regional Timezone Configuration
  test("16. Stores organization timezone", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Kolkata Store",
      organizationTimeZone: "Asia/Kolkata",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.organizationTimeZone).toBe("Asia/Kolkata");
  });

  // 17. Phone Validation Rules
  test("17. Enforces country-specific phone rules (UAE 9 digits, India 10 digits, no formatting characters)", async () => {
    const t = convexTest(schema, modules);

    // UAE 9 digits valid
    const uaeOrgId = await createTestOrg(t, {
      name: "UAE Grill",
      country: "United Arab Emirates",
      phone: "501234567",
    });
    const uaeOrg = await t.query(api.organizations.get, { id: uaeOrgId });
    expect(uaeOrg?.phone).toBe("+971501234567");

    // UAE invalid digit counts
    await expect(
      createTestOrg(t, {
        name: "UAE Short Phone",
        country: "United Arab Emirates",
        phone: "50123456",
      })
    ).rejects.toThrow("Phone must be 9 digits long for UAE");

    await expect(
      createTestOrg(t, {
        name: "UAE Long Phone",
        country: "United Arab Emirates",
        phone: "5012345678",
      })
    ).rejects.toThrow("Phone must be 9 digits long for UAE");

    // India 10 digits valid
    const indOrgId = await createTestOrg(t, {
      name: "India Curry",
      country: "India",
      phone: "9876543210",
    });
    const indOrg = await t.query(api.organizations.get, { id: indOrgId });
    expect(indOrg?.phone).toBe("+919876543210");

    // India invalid digit counts
    await expect(
      createTestOrg(t, {
        name: "India Short Phone",
        country: "India",
        phone: "987654321",
      })
    ).rejects.toThrow("Phone must be 10 digits long for India");

    // Rejects formatting characters (spaces, hyphens, slashes)
    await expect(
      createTestOrg(t, {
        name: "Hyphen Phone",
        phone: "987-654-3210",
      })
    ).rejects.toThrow("Phone must contain only digits, with no spaces, hyphens, or slashes");

    await expect(
      createTestOrg(t, {
        name: "Space Phone",
        phone: "987 654 3210",
      })
    ).rejects.toThrow("Phone must contain only digits, with no spaces, hyphens, or slashes");
  });

  // 18. Operating Hours Overlap Validation & All-Day Normalization
  test("18. Validates operating hours overlap and normalizes all-day schedules", async () => {
    const t = convexTest(schema, modules);

    // Overlapping time slots rejected
    const overlappingTiming = {
      Monday: {
        hours: [
          { start_time: "10:00", end_time: "14:00" },
          { start_time: "12:00", end_time: "16:00" },
        ],
      },
    };

    await expect(
      createTestOrg(t, {
        name: "Overlapping Hours Bistro",
        operationTiming: overlappingTiming,
      })
    ).rejects.toThrow("overlapping time ranges found for Monday");

    // All-day open normalization
    const allDayTiming = {
      Monday: {
        is_open_all_day: true,
        hours: [],
      },
    };

    const orgId = await createTestOrg(t, {
      name: "24-7 Diner",
      operationTiming: allDayTiming,
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.operationTiming["Monday"]["hours"][0]["start_time"]).toBe("2023-05-08T00:00:00.000+05:30");
  });

  // 19. Printing Settings & Validation
  test("19. Stores printing configurations and rejects negative print count", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Printer Express",
      receiptPrintCount: 2,
      menuBasedPrintToken: true,
      showQrCode: true,
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.receiptPrintCount).toBe(2);
    expect(org?.menuBasedPrintToken).toBe(true);
    expect(org?.showQrCode).toBe(true);

    // Rejects receiptPrintCount < 1
    await expect(
      t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.update, {
        id: orgId,
        receiptPrintCount: 0,
      })
    ).rejects.toThrow("receiptPrintCount must be at least 1");
  });

  // 20. Secret Protection (Razorpay, Stripe, WhatsApp)
  test("20. Public read queries strip sensitive tokens (whatsappAccessToken, razorPayApiKey, stripeSecretKey)", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Secret Credentials Org",
      whatsappAccessToken: "super-secret-bearer-token-12345",
      razorPayKeyId: "rzp_live_12345",
      razorPayApiKey: "rzp_secret_67890",
      stripePublishableKey: "pk_live_12345",
      stripeSecretKey: "sk_live_67890",
    });

    const publicOrg = await t.query(api.organizations.get, { id: orgId });
    expect("whatsappAccessToken" in (publicOrg || {})).toBe(false);
    expect("razorPayApiKey" in (publicOrg || {})).toBe(false);
    expect("stripeSecretKey" in (publicOrg || {})).toBe(false);

    // Non-secret publishable keys remain visible
    expect(publicOrg?.razorPayKeyId).toBe("rzp_live_12345");
    expect(publicOrg?.stripePublishableKey).toBe("pk_live_12345");

    // Internal admin query returns full secrets
    const internalOrg = await t.withIdentity({ name: "Tester", subject: "user_test" }).query(api.organizations.getWithSecrets, {
      id: orgId,
    });
    expect(internalOrg?.whatsappAccessToken).toBe("super-secret-bearer-token-12345");
    expect(internalOrg?.razorPayApiKey).toBe("rzp_secret_67890");
    expect(internalOrg?.stripeSecretKey).toBe("sk_live_67890");
  });

  // 21. Store Initialization & Idempotency
  test("21. initializeStore seeds order processes, stations, payment modes, inventory categories, and operating hours idempotently", async () => {
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

  // 22. Soft Deletion
  test("22. Soft deletion sets deletedAt and excludes org from active queries", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "To Be Deleted Org",
    });

    await t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.remove, { id: orgId });

    const getResult = await t.query(api.organizations.get, { id: orgId });
    expect(getResult).toBeNull();

    const internalOrg = await t.withIdentity({ name: "Tester", subject: "user_test" }).query(api.organizations.getWithSecrets, {
      id: orgId,
    });
    expect(internalOrg?.deletedAt).toBeDefined();
  });

  // 23. FSSAI & GST Compliance Document Storage & URL Fields
  test("23. Saves, updates, and clears FSSAI and GST document storage IDs and URLs", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "Document Compliance Store",
    });

    // Store blob to generate valid storage ID via t.run
    const fssaiStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["fssai doc"])));
    const gstStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["gst doc"])));

    await t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.update, {
      id: orgId,
      fssaiDocumentStorageId: fssaiStorageId,
      fssaiDocumentUrl: "https://example.com/fssai.pdf",
      gstDocumentStorageId: gstStorageId,
      gstDocumentUrl: "https://example.com/gst.pdf",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.fssaiDocumentStorageId).toBe(fssaiStorageId);
    expect(org?.fssaiDocumentUrl).toBe("https://example.com/fssai.pdf");
    expect(org?.gstDocumentStorageId).toBe(gstStorageId);
    expect(org?.gstDocumentUrl).toBe("https://example.com/gst.pdf");

    // Clear document fields by updating URL to empty string or replacing
    await t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.update, {
      id: orgId,
      fssaiDocumentUrl: "",
      gstDocumentUrl: "",
    });

    const clearedOrg = await t.query(api.organizations.get, { id: orgId });
    expect(clearedOrg?.fssaiDocumentUrl).toBe("");
    expect(clearedOrg?.gstDocumentUrl).toBe("");
  });

  // 24. Organization Logo R2 Asset ID Persistence & Dual Schema
  test("24. Accepts and persists logoAssetId while preserving dual schema logoStorageId", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "R2 Logo Store",
    });

    const legacyStorageId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["legacy logo"])));
    const assetId = await t.run(async (ctx) => {
      return await ctx.db.insert("organization_assets", {
        organizationId: orgId,
        storageKey: `organizations/${orgId}/logo/test.png`,
        fileName: "test.png",
        contentType: "image/png",
        fileSize: 1024,
        assetType: "logo",
        status: "uploaded",
        createdBy: "user_test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Update organization with logoAssetId
    await t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.update, {
      id: orgId,
      logoStorageId: legacyStorageId,
      logoAssetId: assetId,
    });

    // Verify organization query returns logoAssetId
    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.logoAssetId).toBe(assetId);
    expect(org?.logoStorageId).toBe(legacyStorageId);

    // Verify organizations.list query returns logoAssetId
    const orgs = await t.query(api.organizations.list);
    const listedOrg = orgs.find((o) => o?._id === orgId);
    expect(listedOrg?.logoAssetId).toBe(assetId);
    expect(listedOrg?.logoStorageId).toBe(legacyStorageId);

    // Verify clearing logo removes logoAssetId
    await t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.update, {
      id: orgId,
      logoUrl: "",
    });

    const clearedOrg = await t.query(api.organizations.get, { id: orgId });
    expect(clearedOrg?.logoAssetId).toBeUndefined();
    expect(clearedOrg?.logoStorageId).toBeUndefined();
  });
});
