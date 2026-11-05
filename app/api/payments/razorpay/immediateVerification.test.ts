import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as connectHandler } from "./connect/route";

const mockStoreAdmin = {
  userId: "user_test_admin_verif",
  storeId: "store_test_verif",
  orgId: "org_test_verif_1" as any,
  role: "org:admin",
  storeConvexClient: null as any,
};

vi.mock("../../../lib/payments/authHelper", () => ({
  requireStoreAdminContext: vi.fn(async () => mockStoreAdmin),
  getStoreAdminContext: vi.fn(async () => mockStoreAdmin),
}));

const mockAdapter = {
  provider: "razorpay",
  validateKeyFormat: vi.fn(),
  verifyCredentials: vi.fn(),
  fetchProfile: vi.fn(),
  normalizeError: vi.fn((err: any) => ({
    code: err.code || "UNKNOWN_ERROR",
    message: err.message || "Adapter error",
    httpStatus: err.code === "INVALID_CREDENTIALS" ? 401 : 400,
  })),
};

vi.mock("../../../lib/payments/registry", () => ({
  getPaymentAdapter: vi.fn(() => mockAdapter),
}));

vi.mock("../../../lib/payments/syncEngine", () => ({
  PaymentSyncEngine: {
    syncTransactions: vi.fn(async () => ({ success: true, count: 5 })),
    syncRefunds: vi.fn(async () => ({ success: true, count: 1 })),
    syncSettlements: vi.fn(async () => ({ success: true, count: 1 })),
  },
}));

describe("PART 2, PART 3, PART 4 & PART 12.B — IMMEDIATE CREDENTIAL VERIFICATION & INITIAL SYNC", () => {
  let mockConvexClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConvexClient = {
      mutation: vi.fn(async (_path: any, _args: any) => "conn_live_abc123"),
      query: vi.fn(async () => null),
    };
    mockStoreAdmin.storeConvexClient = mockConvexClient;
  });

  it("verifies and connects valid live credentials immediately, starting initial background sync", async () => {
    mockAdapter.validateKeyFormat.mockReturnValueOnce({ valid: true });
    mockAdapter.verifyCredentials.mockResolvedValueOnce({
      success: true,
      verified: true,
      provider: "razorpay",
      accountMode: "live",
      credentialsValid: true,
      merchantExists: "yes",
      accountStatus: "active",
      message: "Razorpay REST API authenticated successfully.",
    });
    mockAdapter.fetchProfile.mockResolvedValueOnce({
      success: true,
      provider: "razorpay",
      merchant_name: "Gourmet Bistro",
      merchant_id: "rzp_live_abc123",
      account_mode: "live",
      connection_status: "connected",
      is_profile_available: true,
    });

    const req = new NextRequest("http://localhost:3000/api/payments/razorpay/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key_id: "rzp_live_1234567890abcdef",
        key_secret: "secret_live_9876543210zyxwv",
      }),
    });

    const res = await connectHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe("connected");
    expect(body.accountMode).toBe("live");
    expect(body.merchantName).toBe("Gourmet Bistro");
    expect(body.initialSyncStarted).toBe(true);

    // Verify raw secret is NEVER leaked in API response
    expect(body.key_secret).toBeUndefined();
    expect(body.keySecret).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("secret_live_9876543210zyxwv");

    // Verify connection mutation called with encrypted credentials payload
    expect(mockConvexClient.mutation).toHaveBeenCalledTimes(1);
    const saveArgs = mockConvexClient.mutation.mock.calls[0][1];
    expect(saveArgs.provider).toBe("razorpay");
    expect(saveArgs.accountMode).toBe("live");
    expect(saveArgs.status).toBe("connected");
  });

  it("rejects invalid key format immediately before making any external network requests", async () => {
    mockAdapter.validateKeyFormat.mockReturnValueOnce({
      valid: false,
      error: "Invalid Key ID format. Razorpay Key ID must begin with 'rzp_test_' or 'rzp_live_'.",
    });

    const req = new NextRequest("http://localhost:3000/api/payments/razorpay/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key_id: "invalid_key_prefix_123",
        key_secret: "some_secret",
      }),
    });

    const res = await connectHandler(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe("INVALID_CREDENTIALS");
    expect(body.error).toContain("rzp_test_");

    // Verify no remote verification was attempted
    expect(mockAdapter.verifyCredentials).not.toHaveBeenCalled();
    expect(mockConvexClient.mutation).not.toHaveBeenCalled();
  });

  it("rejects invalid Razorpay credentials (401) and does not persist active connection", async () => {
    mockAdapter.validateKeyFormat.mockReturnValueOnce({ valid: true });
    mockAdapter.verifyCredentials.mockResolvedValueOnce({
      success: false,
      verified: false,
      provider: "razorpay",
      accountMode: "test",
      credentialsValid: false,
      merchantExists: "unknown",
      accountStatus: "unknown",
      code: "INVALID_CREDENTIALS",
      message: "The provided Key ID and Key Secret combination was rejected by Razorpay (HTTP 401).",
    });

    const req = new NextRequest("http://localhost:3000/api/payments/razorpay/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key_id: "rzp_test_wrongKeyId",
        key_secret: "wrongSecret123456",
      }),
    });

    const res = await connectHandler(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.code).toBe("INVALID_CREDENTIALS");
    expect(body.error).toContain("rejected by Razorpay");

    // Verify connection record was NOT created in Convex
    expect(mockConvexClient.mutation).not.toHaveBeenCalled();
  });

  it("handles empty or missing credentials with 400 Bad Request", async () => {
    const req = new NextRequest("http://localhost:3000/api/payments/razorpay/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key_id: "", key_secret: "" }),
    });

    const res = await connectHandler(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe("INVALID_CREDENTIALS");
  });
});

