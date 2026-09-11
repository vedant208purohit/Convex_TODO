import { describe, test, expect, vi, beforeEach } from "vitest";
import { GET } from "./resolve-store/route";
import crypto from "crypto";

// Mock @clerk/nextjs/server
const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

describe("Phase 5 — Default POS Dual-App Access, Cross-Store Isolation & Hardening", () => {
  const originalEnv = process.env;
  const TEST_BRIDGE_SECRET = "default-pos-phase-5-secret-key-456";

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    process.env = {
      ...originalEnv,
      BRIDGE_SECRET: TEST_BRIDGE_SECRET,
      MASTER_POS_URL: "http://localhost:3001",
    };
  });

  describe("1. Dual-App Admin Session in Default POS", () => {
    test("successfully resolves Store POS deployment for an administrator using Default Clerk B identity", async () => {
      const defaultClerkBId = "user_default_clerk_b_admin_001";
      mockAuth.mockResolvedValueOnce({ userId: defaultClerkBId });

      (global.fetch as any).mockImplementationOnce(async (url: string, options: any) => {
        // Verify Master Bridge request
        expect(url).toBe("http://localhost:3001/api/bridge/resolve-store");
        expect(options.method).toBe("POST");

        const timestamp = options.headers["x-bridge-timestamp"];
        const signature = options.headers["x-bridge-signature"];
        const expectedSig = crypto
          .createHmac("sha256", TEST_BRIDGE_SECRET)
          .update(`${defaultClerkBId}:${timestamp}`)
          .digest("hex");
        expect(signature).toBe(expectedSig);

        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            organization: {
              id: "org_curry_bistro",
              slug: "curry-bistro",
              name: "Curry Bistro",
            },
            deployment: {
              url: "https://curry-bistro-prod.convex.cloud",
            },
            user: {
              role: "admin",
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
      expect(data.organization.slug).toBe("curry-bistro");
      expect(data.user.role).toBe("admin");

      // Verify no secrets leaked
      expect(data.BRIDGE_SECRET).toBeUndefined();
      expect(data.PROVISIONING_SECRET).toBeUndefined();
    });
  });

  describe("2. Cross-Store & Multi-Tenant Attack Scenarios", () => {
    test("Unassigned Default Clerk B user receives 404 STORE_NOT_ASSIGNED and no deployment", async () => {
      mockAuth.mockResolvedValueOnce({ userId: "user_unassigned_stranger" });

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
      expect(data.deploymentUrl).toBeUndefined();
    });

    test("Deactivated staff member receives 403 ACCOUNT_INACTIVE", async () => {
      mockAuth.mockResolvedValueOnce({ userId: "user_deactivated_staff" });

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
      expect(data.deploymentUrl).toBeUndefined();
    });

    test("Multiple store assignment conflict fails closed with 409 INCONSISTENT_IDENTITY_ASSIGNMENT", async () => {
      mockAuth.mockResolvedValueOnce({ userId: "user_conflicting_assignment" });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: "Inconsistent identity assignment: Multiple store assignments found.",
          code: "INCONSISTENT_IDENTITY_ASSIGNMENT",
        }),
      });

      const res = await GET();
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe("INCONSISTENT_IDENTITY_ASSIGNMENT");
      expect(data.deploymentUrl).toBeUndefined();
    });
  });
});
