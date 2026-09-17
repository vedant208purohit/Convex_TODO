import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { POST as storeStaffCreateHandler } from "./route";

// Mock @clerk/nextjs/server
const mockAuth = vi.fn();
const mockCurrentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}));

// Mock ConvexHttpClient
const mockQuery = vi.fn();
vi.mock("convex/browser", () => {
  return {
    ConvexHttpClient: class MockConvexHttpClient {
      setAuth = vi.fn();
      query = mockQuery;
    },
  };
});

// Mock fetch
const originalFetch = global.fetch;

describe("Store-Side Staff Creation API (/api/staff/create)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      BRIDGE_SECRET: "test-bridge-secret",
      MASTER_POS_URL: "http://localhost:3001",
      NEXT_PUBLIC_CONVEX_URL: "https://mock-store.convex.cloud",
    };

    // Default authenticated Store Admin
    mockAuth.mockResolvedValue({
      userId: "user_default_clerk_admin_1",
      getToken: vi.fn().mockResolvedValue("mock-convex-jwt"),
    });

    // Default store context query in Convex
    mockQuery.mockResolvedValue({
      organizationId: "org_store_doc_1",
      slug: "curry-bistro",
      name: "Curry Bistro",
      callerUserId: "user_default_clerk_admin_1",
      callerRoles: ["admin"],
    });

    // Default mock Master bridge fetch response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        message: "Staff member created successfully.",
        userId: "master_user_1",
        defaultClerkId: "user_clerk_b_101",
        role: "cashier",
      }),
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  // 1. Unauthenticated Request
  test("1. Returns 401 if caller is not authenticated in Default Clerk", async () => {
    mockAuth.mockResolvedValue({ userId: null, getToken: vi.fn() });

    const req = new Request("http://localhost:3000/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        role: "cashier",
      }),
    });

    const res = await storeStaffCreateHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  // 2. Validation Errors
  test("2. Returns 400 on missing or invalid fields", async () => {
    // Missing first name
    const req1 = new Request("http://localhost:3000/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "",
        lastName: "Doe",
        email: "john@example.com",
        role: "cashier",
      }),
    });
    const res1 = await storeStaffCreateHandler(req1);
    expect(res1.status).toBe(400);

    // Invalid email
    const req2 = new Request("http://localhost:3000/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        email: "invalid-email",
        role: "cashier",
      }),
    });
    const res2 = await storeStaffCreateHandler(req2);
    expect(res2.status).toBe(400);

    // Invalid role
    const req3 = new Request("http://localhost:3000/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        role: "unsupported_super_role",
      }),
    });
    const res3 = await storeStaffCreateHandler(req3);
    expect(res3.status).toBe(400);
  });

  // 3. Authorization: Non-Admin Forbidden (403)
  test("3. Returns 403 if caller is not an active admin in the store database", async () => {
    mockQuery.mockRejectedValue(new Error("Forbidden. Admin access required."));

    const req = new Request("http://localhost:3000/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        role: "waiter",
      }),
    });

    const res = await storeStaffCreateHandler(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("FORBIDDEN");
  });

  // 4. Missing BRIDGE_SECRET on Store Server
  test("4. Returns 500 if BRIDGE_SECRET is not configured on store server", async () => {
    delete process.env.BRIDGE_SECRET;

    const req = new Request("http://localhost:3000/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        role: "cashier",
      }),
    });

    const res = await storeStaffCreateHandler(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe("BRIDGE_MISCONFIGURED");
  });

  // 5. Successful Staff Provisioning via HMAC Bridge Relay
  test("5. Generates HMAC signature and relays request to Master staff bridge", async () => {
    const req = new Request("http://localhost:3000/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Aarav",
        lastName: "Shah",
        email: "aarav.shah@currybistro.com",
        phone: "+1 555-0199",
        role: "cashier",
        userType: ["cashier", "orders", "customer_data"],
        userPermission: { cashier: { create: true, read: true, update: true, delete: true } },
      }),
    });

    const res = await storeStaffCreateHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/bridge/staff/create",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-bridge-signature": expect.any(String),
          "x-bridge-timestamp": expect.any(String),
        }),
        body: expect.stringContaining('"slug":"curry-bistro"'),
      })
    );
  });

  // 6. Conflict Propagation from Master (409)
  test("6. Correctly propagates 409 conflict when user belongs to another store", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: "Conflict: This staff identity is already assigned to another store organization.",
      }),
    } as any);

    const req = new Request("http://localhost:3000/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Shared",
        lastName: "Staff",
        email: "shared@otherstore.com",
        role: "waiter",
      }),
    });

    const res = await storeStaffCreateHandler(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already assigned to another store");
  });

  // 7. Network / Bridge Unreachable Error (502)
  test("7. Returns 502 when Master bridge is unreachable", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("fetch failed: connection refused"));

    const req = new Request("http://localhost:3000/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Offline",
        lastName: "Test",
        email: "offline@example.com",
        role: "cashier",
      }),
    });

    const res = await storeStaffCreateHandler(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.code).toBe("BRIDGE_UNREACHABLE");
  });

  // 8. Distinguishes Infrastructure / Backend Errors (500) from Authorization (403)
  test("8. Returns 500 when Store Convex encounters infrastructure or missing function errors", async () => {
    mockQuery.mockRejectedValue(new Error("Convex backend connection failed"));

    const req = new Request("http://localhost:3000/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "Admin",
        email: "test@currybistro.com",
        role: "cashier",
      }),
    });

    const res = await storeStaffCreateHandler(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.code).toBe("STORE_AUTH_FAILED");
  });
});
