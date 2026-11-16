import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getHealthRoute } from "./health/route";
import { POST as postDisconnectRoute } from "./disconnect/route";
import { POST as postReconnectRoute } from "./reconnect/route";
import { GET as getStatusRoute } from "./status/route";

const mockStoreAdmin = {
  userId: "user_test_admin_health",
  storeId: "store_test_gts",
  orgId: "org_test_gts_1" as any,
  role: "org:admin",
  storeConvexClient: null as any,
};

vi.mock("../../../lib/payments/authHelper", () => ({
  requireStoreAdminContext: vi.fn(async () => mockStoreAdmin),
  getStoreAdminContext: vi.fn(async () => mockStoreAdmin),
}));

// Mock credential decryption & encryption
vi.mock("../../../../convex/paymentGatewayCrypto", () => ({
  decryptCredentials: vi.fn(async () => ({
    keyId: "rzp_test_mockKeyId123",
    keySecret: "mockSecretVal456789",
  })),
  encryptCredentials: vi.fn(async (creds) => ({
    encryptedString: JSON.stringify({ ciphertext: "mockCipher", version: 1 }),
    version: 1,
  })),
  maskKeyIdentifier: vi.fn((key) => (key ? `${key.slice(0, 8)}...` : undefined)),
}));

// Mock payment registry adapter
const mockAdapter = {
  provider: "razorpay",
  verifyCredentials: vi.fn(),
};

vi.mock("../../../lib/payments/registry", () => ({
  getPaymentAdapter: vi.fn(() => mockAdapter),
}));

describe("RAZORPAY HEALTH MONITORING & CONNECTION LIFECYCLE SUITE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. INTEGRATION HEALTH MONITORING (GET /api/payments/razorpay/health)
  // =========================================================================
  describe("1. GET /api/payments/razorpay/health", () => {
    it("reports overall status 'healthy' when connection, API, webhook, and sync are operational", async () => {
      mockAdapter.verifyCredentials.mockResolvedValueOnce({
        success: true,
        verified: true,
        provider: "razorpay",
        accountMode: "live",
      });

      const mockHealthData = {
        connection: {
          _id: "conn_1",
          status: "connected",
          connectionType: "api_key",
          accountMode: "live",
          merchantName: "Acme Gourmet",
          maskedKeyId: "rzp_live_•••••••cdef",
          connectedAt: 1700000000000,
          lastVerifiedAt: 1700000000000,
        },
        webhook: {
          status: "healthy",
          configured: true,
          totalEvents: 45,
          failedEvents: 0,
          pendingEvents: 0,
          lastReceivedAt: 1700001000000,
          lastProcessedAt: 1700001000000,
        },
        sync: {
          transactions: {
            status: "success",
            lastSyncedAt: 1700002000000,
            recordsFetched: 15,
            recordsCreated: 2,
            recordsUpdated: 13,
          },
          refunds: {
            status: "success",
            lastSyncedAt: 1700002000000,
            recordsFetched: 1,
            recordsCreated: 0,
            recordsUpdated: 1,
          },
          settlements: {
            status: "success",
            lastSyncedAt: 1700002000000,
            recordsFetched: 1,
            recordsCreated: 0,
            recordsUpdated: 1,
          },
        },
        checkedAt: 1700002500000,
      };

      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async (_fn, args) => {
          if (args?.connectionId) {
            return {
              encryptedCredentials: "mock-encrypted",
            };
          }
          return mockHealthData;
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/health");
      const res = await getHealthRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.overallStatus).toBe("healthy");
      expect(json.data.connection.status).toBe("connected");
      expect(json.data.connection.mode).toBe("live");
      expect(json.data.api.status).toBe("healthy");
      expect(json.data.webhook.status).toBe("healthy");
      expect(json.data.sync.transactions.status).toBe("success");
    });

    it("reports 'disconnected' when gateway connection is inactive", async () => {
      const mockHealthData = {
        connection: {
          _id: "conn_1",
          status: "disconnected",
          disconnectedAt: 1700005000000,
        },
        webhook: { status: "not_configured", configured: false },
        sync: {
          transactions: { status: "never" },
          refunds: { status: "never" },
          settlements: { status: "never" },
        },
      };

      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async () => mockHealthData),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/health");
      const res = await getHealthRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.overallStatus).toBe("disconnected");
      expect(json.data.connection.status).toBe("disconnected");
      expect(json.data.connection.connected).toBe(false);
    });

    it("reports 'unhealthy' when Razorpay API probe returns invalid credentials (401)", async () => {
      mockAdapter.verifyCredentials.mockResolvedValueOnce({
        success: false,
        verified: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid Razorpay Key ID or Key Secret.",
      });

      const mockHealthData = {
        connection: {
          _id: "conn_1",
          status: "connected",
        },
        webhook: { status: "healthy", configured: true },
        sync: {
          transactions: { status: "success" },
          refunds: { status: "success" },
          settlements: { status: "success" },
        },
      };

      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async (_fn, args) => {
          if (args?.connectionId) {
            return { encryptedCredentials: "mock-encrypted" };
          }
          return mockHealthData;
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/health");
      const res = await getHealthRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.overallStatus).toBe("unhealthy");
      expect(json.data.api.status).toBe("invalid_credentials");
    });

    it("reports 'degraded' when API rate limit is exceeded", async () => {
      mockAdapter.verifyCredentials.mockResolvedValueOnce({
        success: false,
        verified: false,
        code: "RATE_LIMITED",
        message: "Too Many Requests",
      });

      const mockHealthData = {
        connection: { _id: "conn_1", status: "connected" },
        webhook: { status: "healthy", configured: true },
        sync: {
          transactions: { status: "success" },
          refunds: { status: "success" },
          settlements: { status: "success" },
        },
      };

      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async (_fn, args) => {
          if (args?.connectionId) {
            return { encryptedCredentials: "mock-encrypted" };
          }
          return mockHealthData;
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/health");
      const res = await getHealthRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.overallStatus).toBe("degraded");
      expect(json.data.api.status).toBe("rate_limited");
    });

    it("reports 'degraded' when sync execution has failed", async () => {
      mockAdapter.verifyCredentials.mockResolvedValueOnce({
        success: true,
        verified: true,
      });

      const mockHealthData = {
        connection: { _id: "conn_1", status: "connected" },
        webhook: { status: "healthy", configured: true },
        sync: {
          transactions: { status: "success" },
          refunds: { status: "failed", lastError: "Gateway timeout" },
          settlements: { status: "success" },
        },
      };

      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async (_fn, args) => {
          if (args?.connectionId) {
            return { encryptedCredentials: "mock-encrypted" };
          }
          return mockHealthData;
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/health");
      const res = await getHealthRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.overallStatus).toBe("degraded");
      expect(json.data.sync.refunds.status).toBe("failed");
    });
  });

  // =========================================================================
  // 2. DISCONNECT API (POST /api/payments/razorpay/disconnect)
  // =========================================================================
  describe("2. POST /api/payments/razorpay/disconnect", () => {
    it("successfully disconnects connection while preserving historical financial data", async () => {
      let mutationArgs: any;
      mockStoreAdmin.storeConvexClient = {
        mutation: vi.fn(async (_fn, args) => {
          mutationArgs = args;
          return {
            connectionId: "conn_1",
            status: "disconnected",
            disconnectedAt: 1700008000000,
          };
        }),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: "conn_1" }),
      });

      const res = await postDisconnectRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("disconnected");
      expect(json.data.historicalDataPreserved).toBe(true);
      expect(mutationArgs.connectionId).toBe("conn_1");
      expect(mutationArgs.provider).toBe("razorpay");
    });
  });

  // =========================================================================
  // 3. RECONNECT API (POST /api/payments/razorpay/reconnect)
  // =========================================================================
  describe("3. POST /api/payments/razorpay/reconnect", () => {
    it("reconnects with verified fresh credentials", async () => {
      mockAdapter.verifyCredentials.mockResolvedValueOnce({
        success: true,
        verified: true,
        accountMode: "live",
      });

      mockStoreAdmin.storeConvexClient = {
        mutation: vi.fn(async () => ({
          _id: "conn_1",
          status: "connected",
          accountMode: "live",
          connectedAt: 1700000000000,
          lastVerifiedAt: 1700009000000,
        })),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/reconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId: "rzp_live_fresh123",
          keySecret: "freshSecret456",
        }),
      });

      const res = await postReconnectRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.connection.status).toBe("connected");
      expect(json.data.syncResumed).toBe(true);
    });

    it("rejects invalid fresh credentials during reconnection", async () => {
      mockAdapter.verifyCredentials.mockResolvedValueOnce({
        success: false,
        verified: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid Key ID or Secret.",
      });

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/reconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId: "rzp_live_badKey",
          keySecret: "badSecret",
        }),
      });

      const res = await postReconnectRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.code).toBe("INVALID_CREDENTIALS");
    });

    it("reconnects using stored verified credentials when no new keys are supplied", async () => {
      mockAdapter.verifyCredentials.mockResolvedValueOnce({
        success: true,
        verified: true,
        accountMode: "live",
      });

      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async () => ({
          connectionId: "conn_1",
          encryptedCredentials: "mock-encrypted-stored",
        })),
        mutation: vi.fn(async () => ({
          _id: "conn_1",
          status: "connected",
        })),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/reconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await postReconnectRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.connection.status).toBe("connected");
    });
  });

  // =========================================================================
  // 4. CONNECTION STATUS API (GET /api/payments/razorpay/status)
  // =========================================================================
  describe("4. GET /api/payments/razorpay/status", () => {
    it("returns safe lifecycle state without leaking secrets", async () => {
      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async () => [
          {
            _id: "conn_1",
            provider: "razorpay",
            status: "connected",
            connectionType: "api_key",
            accountMode: "live",
            merchantName: "Acme Gourmet",
            maskedKeyId: "rzp_live_•••••••cdef",
            connectedAt: 1700000000000,
            lastVerifiedAt: 1700001000000,
            disconnectedAt: null,
          },
        ]),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/status");
      const res = await getStatusRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.connected).toBe(true);
      expect(json.data.status).toBe("connected");
      expect(json.data.accountMode).toBe("live");
      expect(json.data.maskedKeyId).toBe("rzp_live_•••••••cdef");

      // Verify no sensitive keys leaked
      expect(json.data.keySecret).toBeUndefined();
      expect(json.data.encryptedCredentials).toBeUndefined();
      expect(json.data.webhookSecret).toBeUndefined();
    });

    it("correctly indicates disconnected state and canReconnect flag", async () => {
      mockStoreAdmin.storeConvexClient = {
        query: vi.fn(async () => [
          {
            _id: "conn_1",
            provider: "razorpay",
            status: "disconnected",
            connectionType: "api_key",
            accountMode: "live",
            disconnectedAt: 1700009000000,
          },
        ]),
      };

      const req = new NextRequest("http://localhost:3000/api/payments/razorpay/status");
      const res = await getStatusRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.connected).toBe(false);
      expect(json.data.status).toBe("disconnected");
      expect(json.data.canReconnect).toBe(true);
      expect(json.data.disconnectedAt).toBe(1700009000000);
    });
  });
});
