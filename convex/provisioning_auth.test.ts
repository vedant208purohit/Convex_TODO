/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { generateHmacSha256 } from "./organizations";

const modules = import.meta.glob("./**/*.*s");
const TEST_SECRET = "test-provisioning-secret-12345";

describe("Provisioning Authentication Architecture Tests", () => {
  beforeEach(() => {
    process.env.PROVISIONING_SECRET = TEST_SECRET;
  });

  test("1. Unauthenticated / missing credential call to organizations:create is rejected", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.organizations.create, {
        name: "Unauthenticated Store",
      })
    ).rejects.toThrow("Unauthenticated provisioning request: missing token or timestamp.");
  });

  test("2. Invalid provisioning token is rejected", async () => {
    const t = convexTest(schema, modules);
    const timestamp = Date.now();

    await expect(
      t.mutation(api.organizations.create, {
        name: "Fake Token Store",
        slug: "fake-token-store",
        timestamp,
        provisioningToken: "invalid-token-hash-xyz",
      })
    ).rejects.toThrow("Invalid provisioning authentication token.");
  });

  test("3. Expired timestamp (> 5 minutes old) is rejected", async () => {
    const t = convexTest(schema, modules);
    const slug = "expired-store";
    const expiredTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    const validTokenForOldTimestamp = await generateHmacSha256(
      TEST_SECRET,
      `${slug}:${expiredTimestamp}`
    );

    await expect(
      t.mutation(api.organizations.create, {
        name: "Expired Store",
        slug,
        timestamp: expiredTimestamp,
        provisioningToken: validTokenForOldTimestamp,
      })
    ).rejects.toThrow("Expired or invalid provisioning token timestamp.");
  });

  test("4. Valid Master server HMAC token allows store creation & initialization", async () => {
    const t = convexTest(schema, modules);
    const slug = "valid-master-store";
    const timestamp = Date.now();
    const provisioningToken = await generateHmacSha256(
      TEST_SECRET,
      `${slug}:${timestamp}`
    );

    // Create store with valid token
    const orgId = await t.mutation(api.organizations.create, {
      name: "Valid Master Store",
      slug,
      timestamp,
      provisioningToken,
    });

    expect(orgId).toBeDefined();

    // Initialize store with valid token
    const initRes = await t.mutation(api.organizations.initializeStore, {
      id: orgId,
      slug,
      timestamp,
      provisioningToken,
    });

    expect(initRes.success).toBe(true);

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.name).toBe("Valid Master Store");
    expect(org?.slug).toBe(slug);
  });

  test("5. Valid Clerk user identity alone CANNOT call organizations:create without provisioning token", async () => {
    const t = convexTest(schema, modules);

    const clerkUser = t.withIdentity({
      name: "Malicious User",
      email: "attacker@defx.com",
      subject: "user_clerk_attacker",
    });

    await expect(
      clerkUser.mutation(api.organizations.create, {
        name: "Clerk User Store Creation Attempt",
      })
    ).rejects.toThrow("Unauthenticated provisioning request: missing token or timestamp.");
  });

  test("6. Token generated for Store A cannot be reused for Store B (Scope binding)", async () => {
    const t = convexTest(schema, modules);
    const timestamp = Date.now();
    
    // Token generated specifically for store-a
    const tokenForStoreA = await generateHmacSha256(
      TEST_SECRET,
      `store-a:${timestamp}`
    );

    // Attempt to use tokenForStoreA to create store-b
    await expect(
      t.mutation(api.organizations.create, {
        name: "Store B",
        slug: "store-b",
        timestamp,
        provisioningToken: tokenForStoreA,
      })
    ).rejects.toThrow("Invalid provisioning authentication token.");
  });
});
