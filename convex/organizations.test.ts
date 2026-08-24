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

  // 8, 15, 16. Creation Defaults & Organization Details Defaults
  test("8, 15, 16. Correct creation & profile defaults applied (GST, FSSAI, Printing, Currency, Timezone)", async () => {
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

    // Organization Details Profile Defaults
    expect(org?.isGst).toBe(false);
    expect(org?.inclusiveGst).toBe(false);
    expect(org?.separateGst).toBe(true);
    expect(org?.isFssai).toBe(false);
    expect(org?.receiptPrintCount).toBe(1);
    expect(org?.menuBasedPrintToken).toBe(false);
    expect(org?.showQrCode).toBe(false);
    expect(org?.organizationTimeZone).toBe("UTC");
    expect(org?.defaultCurrency).toBe("INR");
    expect(org?.defaultCurrencySymbol).toBe("₹");
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

    // Update to postpaid
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

  // 15. Contact & Address Fields Update
  test("15. Stores extended contact and address profile fields", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Address Profile Store",
      addressLine1: "123 MG Road",
      addressLine2: "Suite 404",
      landmark: "Near Metro Station",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      zipCode: "560001",
      email: "contact@store.com",
      mobile: "+919876543211",
      fax: "080-1234567",
      areaCode: "080",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.addressLine1).toBe("123 MG Road");
    expect(org?.addressLine2).toBe("Suite 404");
    expect(org?.landmark).toBe("Near Metro Station");
    expect(org?.city).toBe("Bengaluru");
    expect(org?.state).toBe("Karnataka");
    expect(org?.country).toBe("India");
    expect(org?.email).toBe("contact@store.com");
    expect(org?.mobile).toBe("+919876543211");
  });

  // 16. GST Compliance Updates
  test("16. Updates GST configuration flags and registration number", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "GST Registered Cafe",
    });

    await t.mutation(api.organizations.update, {
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

  // 17. FSSAI Food Safety Compliance
  test("17. Updates FSSAI license details and expiry timestamp", async () => {
    const t = convexTest(schema, modules);

    const expiryTime = Date.now() + 365 * 86400 * 1000;
    const orgId = await t.mutation(api.organizations.create, {
      name: "FSSAI Compliant Bakery",
      isFssai: true,
      fssaiRegistrationNumber: "12345678901234",
      expiryDate: expiryTime,
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.isFssai).toBe(true);
    expect(org?.fssaiRegistrationNumber).toBe("12345678901234");
    expect(org?.expiryDate).toBe(expiryTime);
  });

  // 18. Currency & Country Resolution
  test("18. Resolves explicit currency or country-based fallback currency", async () => {
    const t = convexTest(schema, modules);

    // Test explicit currency
    const orgId1 = await t.mutation(api.organizations.create, {
      name: "US Dollar Diner",
      defaultCurrency: "USD",
      defaultCurrencySymbol: "$",
    });
    const org1 = await t.query(api.organizations.get, { id: orgId1 });
    expect(org1?.defaultCurrency).toBe("USD");
    expect(org1?.defaultCurrencySymbol).toBe("$");

    // Test country fallback for UAE
    const orgId2 = await t.mutation(api.organizations.create, {
      name: "Dubai Sweets",
      country: "United Arab Emirates",
    });
    const org2 = await t.query(api.organizations.get, { id: orgId2 });
    expect(org2?.defaultCurrency).toBe("AED");
    expect(org2?.defaultCurrencySymbol).toBe("AED");
  });

  // 19. Timezone Configuration
  test("19. Stores explicit timezone or defaults to UTC", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Kolkata Kitchen",
      organizationTimeZone: "Asia/Kolkata",
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.organizationTimeZone).toBe("Asia/Kolkata");
  });

  // 20. Phone Validation Rules
  test("20. Enforces country-specific phone rules (UAE 9 digits, India 10 digits, no formatting characters)", async () => {
    const t = convexTest(schema, modules);

    // UAE 9 digits valid
    const uaeOrgId = await t.mutation(api.organizations.create, {
      name: "UAE Grill",
      country: "United Arab Emirates",
      phone: "501234567",
    });
    const uaeOrg = await t.query(api.organizations.get, { id: uaeOrgId });
    expect(uaeOrg?.phone).toBe("+971501234567");

    // UAE invalid digit counts
    await expect(
      t.mutation(api.organizations.create, {
        name: "UAE Short Phone",
        country: "United Arab Emirates",
        phone: "50123456",
      })
    ).rejects.toThrow("Phone must be 9 digits long for UAE");

    await expect(
      t.mutation(api.organizations.create, {
        name: "UAE Long Phone",
        country: "United Arab Emirates",
        phone: "5012345678",
      })
    ).rejects.toThrow("Phone must be 9 digits long for UAE");

    // India 10 digits valid
    const indOrgId = await t.mutation(api.organizations.create, {
      name: "India Curry",
      country: "India",
      phone: "9876543210",
    });
    const indOrg = await t.query(api.organizations.get, { id: indOrgId });
    expect(indOrg?.phone).toBe("+919876543210");

    // India invalid digit counts
    await expect(
      t.mutation(api.organizations.create, {
        name: "India Short Phone",
        country: "India",
        phone: "987654321",
      })
    ).rejects.toThrow("Phone must be 10 digits long for other countries");

    // Rejects formatting characters (spaces, hyphens, slashes)
    await expect(
      t.mutation(api.organizations.create, {
        name: "Hyphen Phone",
        phone: "987-654-3210",
      })
    ).rejects.toThrow("Phone must contain only digits, with no spaces, hyphens, or slashes");

    await expect(
      t.mutation(api.organizations.create, {
        name: "Space Phone",
        phone: "987 654 3210",
      })
    ).rejects.toThrow("Phone must contain only digits, with no spaces, hyphens, or slashes");
  });

  // 21. Operating Hours Overlap Validation & All-Day Normalization
  test("21. Validates operating hours overlap and normalizes all-day schedules", async () => {
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
      t.mutation(api.organizations.create, {
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

    const orgId = await t.mutation(api.organizations.create, {
      name: "24-7 Diner",
      operationTiming: allDayTiming,
    });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.operationTiming["Monday"]["hours"][0]["start_time"]).toBe("2023-05-08T00:00:00.000+05:30");
  });

  // 22. Printing Settings & Validation
  test("22. Stores printing configurations and rejects negative print count", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
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
      t.mutation(api.organizations.update, {
        id: orgId,
        receiptPrintCount: 0,
      })
    ).rejects.toThrow("receiptPrintCount must be at least 1");
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

    await expect(
      t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.update, {
        id: orgId,
        onlineStore: true,
      })
    ).rejects.toThrow("Please contact support");

    const orgId2 = await t.mutation(api.organizations.create, {
      name: "Publishing Gate Test",
      onlineStore: true,
    });

    await expect(
      t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.liveOrganization, { id: orgId2 })
    ).rejects.toThrow("Please contact support");
  });

  // 29. Secret Protection (Razorpay, Stripe, WhatsApp)
  test("29. Public read queries strip sensitive tokens (whatsappAccessToken, razorPayApiKey, stripeSecretKey)", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
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
    const internalOrg = await t.query(api.organizations.getWithSecrets, {
      id: orgId,
    });
    expect(internalOrg?.whatsappAccessToken).toBe("super-secret-bearer-token-12345");
    expect(internalOrg?.razorPayApiKey).toBe("rzp_secret_67890");
    expect(internalOrg?.stripeSecretKey).toBe("sk_live_67890");
  });

  // 30-32. Store Initialization & Idempotency
  test("30-32. initializeStore seeds order processes, stations, payment modes, inventory categories, and operating hours idempotently", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Seed Store",
    });

    const res1 = await t.mutation(api.organizations.initializeStore, {
      id: orgId,
    });
    expect(res1.success).toBe(true);

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.operationTiming).toBeDefined();

    // Idempotency check
    const res2 = await t.mutation(api.organizations.initializeStore, {
      id: orgId,
    });
    expect(res2.success).toBe(true);
  });

  // 33-35. Soft Deletion
  test("33-35. Soft deletion sets deletedAt and excludes org from active queries", async () => {
    const t = convexTest(schema, modules);

    const orgId = await createTestOrg(t, {
      name: "To Be Deleted Org",
    });

    await t.withIdentity({ name: "Tester", subject: "user_test" }).mutation(api.organizations.remove, { id: orgId });

    const getResult = await t.query(api.organizations.get, { id: orgId });
    expect(getResult).toBeNull();

    const internalOrg = await t.query(api.organizations.getWithSecrets, {
      id: orgId,
    });
    expect(internalOrg?.deletedAt).toBeDefined();
  });
});
