import { describe, test, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import crypto from "crypto";

// Mock @clerk/nextjs/server
const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

describe("Phase 4 — Default POS Store Resolution Route (/api/auth/resolve-store)", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const TEST_BRIDGE_SECRET = "default-pos-bridge-secret-test-99";

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    process.env = {
      ...originalEnv,
      BRIDGE_SECRET: TEST_BRIDGE_SECRET,
      MASTER_POS_URL: "http://localhost:3001",
    };
  });

  test("returns 401 UNAUTHORIZED when no active Clerk session exists", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe("UNAUTHORIZED");
  });

  test("returns 500 BRIDGE_MISCONFIGURED when BRIDGE_SECRET is missing", async () => {
    delete process.env.BRIDGE_SECRET;
    delete (process.env as any).NODE_ENV;
    mockAuth.mockResolvedValueOnce({ userId: "user_clerk_b_1" });

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe("BRIDGE_MISCONFIGURED");
  });

  test("generates valid HMAC signature and calls Master bridge endpoint", async () => {
    mockAuth.mockResolvedValueOnce({ userId: "user_clerk_b_123" });

    let capturedUrl = "";
    let capturedOptions: any = null;

    (global.fetch as any).mockImplementationOnce(async (url: string, options: any) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          organization: {
            id: "org_curry_1",
            slug: "curry-bistro",
            name: "Curry Bistro",
          },
          deployment: {
            url: "https://curry-bistro-prod.convex.cloud",
          },
          user: {
            role: "cashier",
            status: "active",
          },
        }),
      };
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.deploymentUrl).toBe("https://curry-bistro-prod.convex.cloud");
    expect(data.organization.name).toBe("Curry Bistro");
    expect(data.user.role).toBe("cashier");

    // Verify Master Bridge request parameters
    expect(capturedUrl).toBe("http://localhost:3001/api/bridge/resolve-store");
    expect(capturedOptions.method).toBe("POST");
    expect(capturedOptions.headers["Content-Type"]).toBe("application/json");

    const sentTimestamp = capturedOptions.headers["x-bridge-timestamp"];
    const sentSignature = capturedOptions.headers["x-bridge-signature"];
    const sentBody = JSON.parse(capturedOptions.body);

    expect(sentBody.defaultClerkId).toBe("user_clerk_b_123");

    // Verify HMAC signature validity
    const expectedSig = crypto
      .createHmac("sha256", TEST_BRIDGE_SECRET)
      .update(`user_clerk_b_123:${sentTimestamp}`)
      .digest("hex");
    expect(sentSignature).toBe(expectedSig);
  });

  test("POST handler works identically to GET", async () => {
    mockAuth.mockResolvedValueOnce({ userId: "user_clerk_b_post" });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        organization: { id: "org_1", slug: "store-1", name: "Store 1" },
        deployment: { url: "https://store-1.convex.cloud" },
        user: { role: "admin", status: "active" },
      }),
    });

    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.deploymentUrl).toBe("https://store-1.convex.cloud");
  });

  test("handles 404 STORE_NOT_ASSIGNED from Master bridge", async () => {
    mockAuth.mockResolvedValueOnce({ userId: "user_unassigned" });

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        error: "Store not assigned for this user.",
        code: "STORE_NOT_ASSIGNED",
      }),
    });

    const res = await GET();
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe("STORE_NOT_ASSIGNED");
  });

  test("handles 403 ACCOUNT_INACTIVE from Master bridge", async () => {
    mockAuth.mockResolvedValueOnce({ userId: "user_inactive" });

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: "User account is inactive.",
        code: "ACCOUNT_INACTIVE",
      }),
    });

    const res = await GET();
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe("ACCOUNT_INACTIVE");
  });

  test("handles 503 DEPLOYMENT_UNAVAILABLE from Master bridge", async () => {
    mockAuth.mockResolvedValueOnce({ userId: "user_waiting_deployment" });

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        error: "Store deployment is not ready.",
        code: "DEPLOYMENT_UNAVAILABLE",
      }),
    });

    const res = await GET();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe("DEPLOYMENT_UNAVAILABLE");
  });

  test("handles network failures to Master bridge (502 BRIDGE_UNREACHABLE)", async () => {
    mockAuth.mockResolvedValueOnce({ userId: "user_clerk_b_1" });

    (global.fetch as any).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const res = await GET();
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.code).toBe("BRIDGE_UNREACHABLE");
  });
});
