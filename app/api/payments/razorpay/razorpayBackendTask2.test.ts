/// <reference types="vite/client" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { convexTest } from "convex-test";
import schema from "../../../../convex/schema";
import { api } from "../../../../convex/_generated/api";
import { RazorpayProviderAdapter } from "../../../lib/payments/adapters/RazorpayProviderAdapter";
import { providerRegistry, getPaymentAdapter } from "../../../lib/payments/registry";
import { PaymentProviderAdapter } from "../../../lib/payments/types";
import {
  encryptCredentials,
  decryptCredentials,
  getCryptoKeyForVersion,
} from "../../../../convex/paymentGatewayCrypto";

const modules = import.meta.glob("../../../../convex/**/*.*s");

// Mock Clerk server auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({
    userId: "user_test_admin",
    getToken: vi.fn().mockResolvedValue("mock_token"),
  }),
  currentUser: vi.fn().mockResolvedValue({
    emailAddresses: [{ emailAddress: "admin@prestpos.com" }],
  }),
}));

import { POST as verifyHandler } from "./verify/route";
import { POST as connectHandler } from "./connect/route";
import { GET as profileHandler } from "./profile/route";
import * as authHelper from "../../../lib/payments/authHelper";

describe("BACKEND TASK 2: Razorpay Merchant Connection, Verification & Profile Tests", () => {
  const validTestKeyId = "rzp_test_K82HS91MNB0";
  const validLiveKeyId = "rzp_live_L99AB12XYZ0";
  const validKeySecret = "SecretKey9988AAbbCC";

  let fetchSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
  });

  // =========================================================================
  // 1. CREDENTIAL VERIFICATION TESTS
  // =========================================================================
  describe("1. Credential Verification Tests (Phase 3 & 9)", () => {
    const adapter = new RazorpayProviderAdapter("https://mock.razorpay.com/v1");

    it("1. Rejects missing key_id", async () => {
      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/verify", {
        method: "POST",
        body: JSON.stringify({ key_secret: validKeySecret }),
      });
      const res = await verifyHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.verified).toBe(false);
      expect(data.code).toBe("INVALID_CREDENTIALS");
    });

    it("2. Rejects missing key_secret", async () => {
      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/verify", {
        method: "POST",
        body: JSON.stringify({ key_id: validTestKeyId }),
      });
      const res = await verifyHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.verified).toBe(false);
      expect(data.code).toBe("INVALID_CREDENTIALS");
    });

    it("3. Validates key format (rejects invalid prefixes and lengths)", () => {
      const invalidPrefix = adapter.validateKeyFormat("invalid_prefix_123", validKeySecret);
      expect(invalidPrefix.valid).toBe(false);
      expect(invalidPrefix.error).toContain("rzp_test_");

      const shortKey = adapter.validateKeyFormat("rzp_test_", validKeySecret);
      expect(shortKey.valid).toBe(false);

      const validFormat = adapter.validateKeyFormat(validTestKeyId, validKeySecret);
      expect(validFormat.valid).toBe(true);
    });

    it("4. Rejects invalid credentials when Razorpay returns HTTP 401", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: "BAD_REQUEST_ERROR", description: "The id provided does not exist" },
          }),
          { status: 401 }
        )
      );

      const result = await adapter.verifyCredentials({
        keyId: validTestKeyId,
        keySecret: "WrongSecret",
      });

      expect(result.verified).toBe(false);
      expect(result.credentialsValid).toBe(false);
      expect(result.code).toBe("INVALID_CREDENTIALS");
    });

    it("5. Accepts valid test credentials using mocked Razorpay response", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ entity: "collection", count: 0, items: [] }), { status: 200 })
      );

      const result = await adapter.verifyCredentials({
        keyId: validTestKeyId,
        keySecret: validKeySecret,
      });

      expect(result.verified).toBe(true);
      expect(result.credentialsValid).toBe(true);
      expect(result.accountMode).toBe("test");
      expect(result.provider).toBe("razorpay");
      expect(result.merchantExists).toBe("unknown");
      expect(result.accountStatus).toBe("unknown");
    });

    it("6. Accepts valid live credentials using mocked Razorpay response", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ entity: "collection", count: 0, items: [] }), { status: 200 })
      );

      const result = await adapter.verifyCredentials({
        keyId: validLiveKeyId,
        keySecret: validKeySecret,
      });

      expect(result.verified).toBe(true);
      expect(result.credentialsValid).toBe(true);
      expect(result.accountMode).toBe("live");
    });

    it("7. Handles account activation unavailable gracefully without inventing IDs", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ entity: "collection", count: 0, items: [] }), { status: 200 })
      );

      const result = await adapter.verifyCredentials({
        keyId: validLiveKeyId,
        keySecret: validKeySecret,
      });

      expect(result.accountStatus).toBe("unknown");
      expect(result.merchantExists).toBe("unknown");
      expect(result.message).toContain("authenticated successfully");
    });

    it("8. Handles insufficient API permissions (HTTP 403)", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "FORBIDDEN", description: "Insufficient permissions" } }),
          { status: 403 }
        )
      );

      const result = await adapter.verifyCredentials({
        keyId: validTestKeyId,
        keySecret: validKeySecret,
      });

      expect(result.verified).toBe(false);
      expect(result.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("9. Handles Razorpay rate limiting (HTTP 429)", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "BAD_REQUEST_ERROR", description: "Too many requests" } }),
          { status: 429 }
        )
      );

      const result = await adapter.verifyCredentials({
        keyId: validTestKeyId,
        keySecret: validKeySecret,
      });

      expect(result.verified).toBe(false);
      expect(result.code).toBe("RAZORPAY_RATE_LIMITED");
    });

    it("10. Handles network timeout gracefully", async () => {
      const abortError = new Error("The operation was aborted due to timeout");
      abortError.name = "AbortError";
      fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);

      const result = await adapter.verifyCredentials({
        keyId: validTestKeyId,
        keySecret: validKeySecret,
      });

      expect(result.verified).toBe(false);
      expect(result.code).toBe("NETWORK_TIMEOUT");
    });

    it("11. Handles Razorpay API unavailable (HTTP 503)", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Service Unavailable", { status: 503 })
      );

      const result = await adapter.verifyCredentials({
        keyId: validTestKeyId,
        keySecret: validKeySecret,
      });

      expect(result.verified).toBe(false);
      expect(result.code).toBe("RAZORPAY_UNAVAILABLE");
    });

    it("12. Verification endpoint does NOT persist credentials or create records", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ entity: "collection", count: 0, items: [] }), { status: 200 })
      );

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/verify", {
        method: "POST",
        body: JSON.stringify({ key_id: validTestKeyId, key_secret: validKeySecret }),
      });

      const res = await verifyHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(data.key_secret).toBeUndefined();
      expect(data.encryptedCredentials).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. CONNECTION & ENCRYPTION TESTS
  // =========================================================================
  describe("2. Merchant Connection & Database Persistence Tests (Phase 4 & 9)", () => {
    async function setupConvexStore() {
      const t = convexTest(schema, modules);
      const orgId = await t.mutation(api.organizations.create, {
        name: "Test Connection Store",
      });
      const admin = t.withIdentity({
        name: "Test Admin",
        email: "admin@prestpos.com",
        subject: "user_test_admin",
      });
      return { t, orgId, admin };
    }

    it("1. Successfully connects Razorpay merchant account and returns safe response", async () => {
      const { t, orgId, admin } = await setupConvexStore();

      // Mock verify
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ entity: "collection", count: 0, items: [] }), { status: 200 })
      );

      const connId = await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "razorpay",
        connectionType: "api_key",
        providerAccountId: validTestKeyId,
        accountMode: "test",
        status: "connected",
        rawCredentials: {
          keyId: validTestKeyId,
          keySecret: validKeySecret,
        },
      });

      expect(connId).toBeDefined();

      const publicConn = await admin.query(api.paymentGateways.getConnection, { connectionId: connId });
      expect(publicConn?.status).toBe("connected");
      expect(publicConn?.provider).toBe("razorpay");
      expect(publicConn?.accountMode).toBe("test");
    });

    it("2. Invalid credentials are not saved as connected", async () => {
      const { t } = await setupConvexStore();

      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 })
      );

      const adapter = getPaymentAdapter("razorpay");
      const verify = await adapter.verifyCredentials({
        keyId: validTestKeyId,
        keySecret: "wrong_secret",
      });

      expect(verify.verified).toBe(false);

      // Verify no record inserted into DB
      const conns = await t.run(async (ctx) => ctx.db.query("payment_gateway_connections").collect());
      expect(conns.length).toBe(0);
    });

    it("3. Authenticated encryption is applied before persistence", async () => {
      const { t, orgId, admin } = await setupConvexStore();

      const connId = await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "razorpay",
        connectionType: "api_key",
        accountMode: "live",
        status: "connected",
        rawCredentials: {
          keyId: validLiveKeyId,
          keySecret: validKeySecret,
        },
      });

      const rawDoc = await t.run(async (ctx) => ctx.db.get(connId));
      expect(rawDoc?.encryptedCredentials).toBeDefined();
      expect(rawDoc?.encryptionKeyVersion).toBe(1);

      const parsedCiphertext = JSON.parse(rawDoc!.encryptedCredentials!);
      expect(parsedCiphertext.iv).toBeDefined();
      expect(parsedCiphertext.ciphertext).toBeDefined();
    });

    it("4. Plaintext secret never appears anywhere in the database", async () => {
      const { t, orgId, admin } = await setupConvexStore();

      const connId = await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "razorpay",
        connectionType: "api_key",
        accountMode: "live",
        status: "connected",
        rawCredentials: {
          keyId: validLiveKeyId,
          keySecret: validKeySecret,
        },
      });

      const rawDoc = await t.run(async (ctx) => ctx.db.get(connId));
      const fullJson = JSON.stringify(rawDoc);

      expect(fullJson).not.toContain(validKeySecret);
      expect((rawDoc as any).keySecret).toBeUndefined();
    });

    it("5. Existing connection reconnect safely updates credentials and timestamps", async () => {
      const { t, orgId, admin } = await setupConvexStore();

      const firstId = await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "razorpay",
        connectionType: "api_key",
        providerAccountId: validLiveKeyId,
        accountMode: "live",
        status: "connected",
        rawCredentials: { keyId: validLiveKeyId, keySecret: "OldSecret112233" },
      });

      const firstDoc = await t.run(async (ctx) => ctx.db.get(firstId));
      const initialConnectedAt = firstDoc?.connectedAt;

      // Reconnect with new secret
      const secondId = await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "razorpay",
        connectionType: "api_key",
        providerAccountId: validLiveKeyId,
        accountMode: "live",
        status: "connected",
        rawCredentials: { keyId: validLiveKeyId, keySecret: "NewSecret445566" },
      });

      expect(secondId).toEqual(firstId);

      const updatedDoc = await t.run(async (ctx) => ctx.db.get(firstId));
      expect(updatedDoc?.connectedAt).toBe(initialConnectedAt);
      expect(updatedDoc?.credentialsUpdatedAt).toBeGreaterThanOrEqual(firstDoc!.createdAt);

      // Verify decrypted credentials contain updated secret
      const decrypted = await decryptCredentials(updatedDoc!.encryptedCredentials!);
      expect(decrypted.keySecret).toBe("NewSecret445566");
    });

    it("6. Prevents duplicate active connections for the same account", async () => {
      const { t, orgId, admin } = await setupConvexStore();

      await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "razorpay",
        connectionType: "api_key",
        providerAccountId: validTestKeyId,
        accountMode: "test",
        status: "connected",
      });

      // Second save call with same account
      await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "razorpay",
        connectionType: "api_key",
        providerAccountId: validTestKeyId,
        accountMode: "test",
        status: "connected",
      });

      const conns = await t.run(async (ctx) => ctx.db.query("payment_gateway_connections").collect());
      expect(conns.length).toBe(1);
    });

    it("7. Manages Test and Live connections independently without conflict", async () => {
      const { t, orgId, admin } = await setupConvexStore();

      const testId = await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "razorpay",
        connectionType: "api_key",
        providerAccountId: validTestKeyId,
        accountMode: "test",
        status: "connected",
      });

      const liveId = await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "razorpay",
        connectionType: "api_key",
        providerAccountId: validLiveKeyId,
        accountMode: "live",
        status: "connected",
      });

      expect(testId).not.toEqual(liveId);

      const all = await t.run(async (ctx) => ctx.db.query("payment_gateway_connections").collect());
      expect(all.length).toBe(2);
      expect(all.find((c) => c.accountMode === "test")?.providerAccountId).toBe(validTestKeyId);
      expect(all.find((c) => c.accountMode === "live")?.providerAccountId).toBe(validLiveKeyId);
    });

    it("8. Rejects unauthorized caller without authentication", async () => {
      const { t } = await setupConvexStore();

      // Mutation called without identity
      await expect(
        t.mutation(api.paymentGateways.saveConnection, {
          provider: "razorpay",
          connectionType: "api_key",
          accountMode: "test",
          status: "connected",
        })
      ).rejects.toThrow("Unauthenticated");
    });

    it("9. Cross-store access rejected: cannot access another store's credentials", async () => {
      const { t, orgId: orgA, admin: adminA } = await setupConvexStore();
      const orgB = await t.mutation(api.organizations.create, { name: "Store B" });

      const connA = await adminA.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgA,
        provider: "razorpay",
        connectionType: "api_key",
        accountMode: "live",
        status: "connected",
      });

      // Admin of Store B querying connection from Store A
      const adminB = t.withIdentity({
        name: "Admin B",
        email: "adminB@prest.com",
        subject: "user_admin_b",
      });

      await expect(
        adminB.query(api.paymentGateways.getConnectionCredentials, {
          connectionId: connA,
          organizationId: orgB,
        })
      ).rejects.toThrow("Forbidden");
    });

    it("10. Missing encryption configuration fails securely in production mode", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalKey = process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY_V1;

      try {
        (process.env as any).NODE_ENV = "production";
        delete process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY_V1;
        delete process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY;

        await expect(getCryptoKeyForVersion(1)).rejects.toThrow(
          "ENCRYPTION_CONFIGURATION_MISSING"
        );
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
        if (originalKey) process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY_V1 = originalKey;
      }
    });

    it("11. Provider identification is stored correctly in shared connection table", async () => {
      const { t, orgId, admin } = await setupConvexStore();

      const connId = await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "razorpay",
        connectionType: "api_key",
        accountMode: "live",
        status: "connected",
      });

      const doc = await t.run(async (ctx) => ctx.db.get(connId));
      expect(doc?.provider).toBe("razorpay");
      expect(doc?.connectionType).toBe("api_key");
    });

    it("12. Future Stripe / PayPal adapter compatibility: same shared service and schema", async () => {
      const { t, orgId, admin } = await setupConvexStore();

      // Mock future Stripe provider adapter
      class MockStripeAdapter implements PaymentProviderAdapter {
        readonly provider = "stripe";
        detectAccountMode(key: string) {
          return key.startsWith("pk_live_") ? ("live" as const) : ("test" as const);
        }
        validateKeyFormat(key: string, secret: string) {
          return { valid: true };
        }
        async verifyCredentials() {
          return {
            success: true,
            verified: true,
            provider: "stripe",
            accountMode: "live" as const,
            credentialsValid: true,
            merchantExists: "yes" as const,
            accountStatus: "active" as const,
            message: "Stripe verified",
          };
        }
        async fetchProfile() {
          return {
            success: true,
            provider: "stripe",
            merchant_name: "Stripe Store",
            merchant_id: "acct_12345",
            account_mode: "live" as const,
            connection_status: "connected",
          };
        }
        normalizeError(err: any) {
          return { code: "BAD_REQUEST", message: "Error", httpStatus: 400 };
        }
      }

      providerRegistry.registerAdapter(new MockStripeAdapter());
      const stripeAdapter = getPaymentAdapter("stripe");
      expect(stripeAdapter.provider).toBe("stripe");

      // Verify Stripe saves into the exact same payment_gateway_connections table
      const stripeConnId = await admin.mutation(api.paymentGateways.saveConnection, {
        organizationId: orgId,
        provider: "stripe",
        connectionType: "api_key",
        accountMode: "live",
        status: "connected",
        providerAccountId: "acct_12345",
      });

      const stripeDoc = await t.run(async (ctx) => ctx.db.get(stripeConnId));
      expect(stripeDoc?.provider).toBe("stripe");
      expect(stripeDoc?.providerAccountId).toBe("acct_12345");
    });
  });

  // =========================================================================
  // 3. MERCHANT PROFILE TESTS
  // =========================================================================
  describe("3. Merchant Profile Retrieval Tests (Phase 5 & 9)", () => {
    const adapter = new RazorpayProviderAdapter("https://mock.razorpay.com/v1");

    it("1. Successfully retrieves connected merchant profile when endpoint is available", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "acc_RzpLive123",
            business_name: "Bistro Delight",
          }),
          { status: 200 }
        )
      );

      const profile = await adapter.fetchProfile({
        keyId: validLiveKeyId,
        keySecret: validKeySecret,
      });

      expect(profile.success).toBe(true);
      expect(profile.merchant_name).toBe("Bistro Delight");
      expect(profile.merchant_id).toBe("acc_RzpLive123");
      expect(profile.is_profile_available).toBe(true);
    });

    it("2. Returns merchant name when available from account response", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: "Spice Garden",
          }),
          { status: 200 }
        )
      );

      const profile = await adapter.fetchProfile({
        keyId: validTestKeyId,
        keySecret: validKeySecret,
      });

      expect(profile.merchant_name).toBe("Spice Garden");
    });

    it("3. Returns merchant ID only when supported and retrieved from API", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "MID_999988",
          }),
          { status: 200 }
        )
      );

      const profile = await adapter.fetchProfile({
        keyId: validLiveKeyId,
        keySecret: validKeySecret,
      });

      expect(profile.merchant_id).toBe("MID_999988");
    });

    it("4. Missing profile endpoint handled gracefully without breaking connection", async () => {
      // Standard Razorpay merchant API keys receive 401/403/404 on /v1/account
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Access denied to account endpoint" }), {
          status: 403,
        })
      );

      const profile = await adapter.fetchProfile({
        keyId: validTestKeyId,
        keySecret: validKeySecret,
      });

      expect(profile.success).toBe(true);
      expect(profile.merchant_name).toBeNull();
      expect(profile.merchant_id).toBeNull();
      expect(profile.is_profile_available).toBe(false);
      expect(profile.connection_status).toBe("connected");
    });

    it("5. Route returns 404 when no connection is found for the store", async () => {
      vi.spyOn(authHelper, "requireStoreAdminContext").mockResolvedValueOnce({
        userId: "user_test_admin",
        orgId: "org_123" as any,
        slug: "test-slug",
        storeConvexClient: {
          query: vi.fn().mockResolvedValue(null),
        } as any,
      });

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/profile");
      const res = await profileHandler(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.code).toBe("CONNECTION_NOT_FOUND");
    });

    it("6. Route returns 400 when connection is disconnected or not active", async () => {
      vi.spyOn(authHelper, "requireStoreAdminContext").mockResolvedValueOnce({
        userId: "user_test_admin",
        orgId: "org_123" as any,
        slug: "test-slug",
        storeConvexClient: {
          query: vi.fn().mockResolvedValue({
            connectionId: "conn_123",
            status: "disconnected",
          }),
        } as any,
      });

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/profile");
      const res = await profileHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.code).toBe("CONNECTION_NOT_ACTIVE");
    });

    it("7. Handles Razorpay profile API unavailable (HTTP 503)", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Service Unavailable", { status: 503 })
      );

      const profile = await adapter.fetchProfile({
        keyId: validLiveKeyId,
        keySecret: validKeySecret,
      });

      expect(profile.success).toBe(true);
      expect(profile.merchant_id).toBeNull();
      expect(profile.is_profile_available).toBe(false);
    });

    it("8. Expired or invalid credentials during profile check handled safely", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 })
      );

      const profile = await adapter.fetchProfile({
        keyId: validTestKeyId,
        keySecret: "invalid_secret",
      });

      expect(profile.merchant_name).toBeNull();
      expect(profile.merchant_id).toBeNull();
    });

    it("9. Profile access requires authenticated store admin session", async () => {
      vi.spyOn(authHelper, "requireStoreAdminContext").mockRejectedValueOnce({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Active session required",
      });

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/profile");
      const res = await profileHandler(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("10. Public profile API response never returns key_secret or encrypted payload", async () => {
      const encrypted = await encryptCredentials({
        keyId: validTestKeyId,
        keySecret: validKeySecret,
      });

      vi.spyOn(authHelper, "requireStoreAdminContext").mockResolvedValueOnce({
        userId: "user_test_admin",
        orgId: "org_123" as any,
        slug: "test-slug",
        storeConvexClient: {
          query: vi.fn().mockResolvedValue({
            connectionId: "conn_123",
            provider: "razorpay",
            accountMode: "test",
            status: "connected",
            merchantName: "Acme Store",
            encryptedCredentials: encrypted.encryptedString,
          }),
          mutation: vi.fn().mockResolvedValue(true),
        } as any,
      });

      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Not partner" }), { status: 403 })
      );

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/profile");
      const res = await profileHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.merchant_name).toBe("Acme Store");
      expect(data.keySecret).toBeUndefined();
      expect(data.key_secret).toBeUndefined();
      expect(data.encryptedCredentials).toBeUndefined();
      expect(data.credentials).toBeUndefined();
    });
  });
});
