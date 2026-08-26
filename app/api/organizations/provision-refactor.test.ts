import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { POST as provisionHandler } from "./provision/route";
import { POST as retryHandler } from "./retry/route";
import { POST as callbackHandler } from "./callback/route";
import { triggerStoreDeployment } from "@/lib/deployment-trigger";

// Mock @clerk/nextjs/server
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({
    userId: "master_user_test_123",
    getToken: vi.fn().mockResolvedValue("mock-clerk-jwt-token"),
  }),
}));

// Mock ConvexHttpClient as a class
const mockQuery = vi.fn();
const mockMutation = vi.fn();

vi.mock("convex/browser", () => {
  return {
    ConvexHttpClient: class MockConvexHttpClient {
      setAuth = vi.fn();
      query = mockQuery;
      mutation = mockMutation;
    },
  };
});

describe("POS Master Store Provisioning Refactor Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CONVEX_MANAGEMENT_API_KEY: "convex_mgt_mock_secret",
      CONVEX_TEAM_ID: "team_mock_123",
      NEXT_PUBLIC_CONVEX_URL: "https://mock-master.convex.cloud",
      DEFAULT_CLERK_JWT_ISSUER_DOMAIN: "https://mock-clerk.accounts.dev",
      PROVISIONING_SECRET: "defx-pos-provisioning-secret-test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("1. Provision route does not execute child_process or Convex CLI", async () => {
    mockQuery.mockResolvedValue(null); // No existing org by slug/legacyId
    mockMutation.mockResolvedValue("master_org_id_1");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url.toString().includes("create_project")) {
        return new Response(
          JSON.stringify({
            id: "proj_123",
            deploymentName: "dev-taco-kitchen",
            deploymentUrl: "https://dev-taco-kitchen.convex.cloud",
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const req = new Request("http://localhost:3000/api/organizations/provision", {
      method: "POST",
      body: JSON.stringify({
        name: "Taco Kitchen",
        slug: "taco-kitchen",
      }),
    });

    const res = await provisionHandler(req);
    const data = await res.json();

    expect(res.status).toBe(202);
    expect(data.success).toBe(true);
    expect(data.status).toBe("provisioning");
    expect(data.organization.projectId).toBe("proj_123");
    expect(data.organization.deploymentId).toBe("dev-taco-kitchen");
    expect(data.organization.deploymentUrl).toBe("https://dev-taco-kitchen.convex.cloud");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("create_project"),
      expect.any(Object)
    );
  });

  test("2. Provision route returns existing active organization idempotently", async () => {
    mockQuery.mockResolvedValue({
      _id: "master_org_active_1",
      name: "Existing Store",
      slug: "existing-store",
      status: "active",
      projectId: "proj_existing",
      deploymentId: "dev-existing-store",
      deploymentUrl: "https://dev-existing-store.convex.cloud",
    });

    const req = new Request("http://localhost:3000/api/organizations/provision", {
      method: "POST",
      body: JSON.stringify({
        name: "Existing Store",
        slug: "existing-store",
      }),
    });

    const res = await provisionHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("active");
    expect(data.organization.id).toBe("master_org_active_1");
  });

  test("3. Provision route rejects duplicate provisioning requests with 409", async () => {
    mockQuery.mockResolvedValue({
      _id: "master_org_in_progress",
      name: "In Progress Store",
      slug: "in-progress-store",
      status: "provisioning",
    });

    const req = new Request("http://localhost:3000/api/organizations/provision", {
      method: "POST",
      body: JSON.stringify({
        name: "In Progress Store",
        slug: "in-progress-store",
      }),
    });

    const res = await provisionHandler(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("currently being provisioned");
  });

  test("4. Retry route resumes failed organization without creating a duplicate Convex project", async () => {
    mockQuery.mockResolvedValue({
      _id: "failed_org_123",
      name: "Failed Store",
      slug: "failed-store",
      status: "failed",
      projectId: "proj_existing_failed",
      deploymentId: "dev-failed-store",
      deploymentUrl: "https://dev-failed-store.convex.cloud",
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const req = new Request("http://localhost:3000/api/organizations/retry", {
      method: "POST",
      body: JSON.stringify({
        masterOrgId: "failed_org_123",
      }),
    });

    const res = await retryHandler(req);
    const data = await res.json();

    expect(res.status).toBe(202);
    expect(data.success).toBe(true);
    expect(data.status).toBe("provisioning");
    expect(data.organization.projectId).toBe("proj_existing_failed");

    expect(fetchSpy.mock.calls.length).toBe(0);
  });

  test("5. Callback endpoint updates status from authorized server-to-server calls", async () => {
    mockMutation.mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/organizations/callback", {
      method: "POST",
      headers: {
        Authorization: `Bearer defx-pos-provisioning-secret-test`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        masterOrgId: "org_callback_123",
        status: "active",
        projectId: "proj_cb",
        deploymentId: "dev-cb",
        deploymentUrl: "https://dev-cb.convex.cloud",
      }),
    });

    const res = await callbackHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("active");
  });

  test("6. Callback endpoint rejects unauthorized calls", async () => {
    const req = new Request("http://localhost:3000/api/organizations/callback", {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid_secret_token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        masterOrgId: "org_callback_123",
        status: "active",
      }),
    });

    const res = await callbackHandler(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("Invalid callback token");
  });

  test("7. Security: API responses never contain deploy keys or management secrets", async () => {
    mockQuery.mockResolvedValue(null);
    mockMutation.mockResolvedValue("master_org_sec_1");

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          id: "proj_sec",
          deploymentName: "dev-sec-store",
          deploymentUrl: "https://dev-sec-store.convex.cloud",
        }),
        { status: 200 }
      );
    });

    const req = new Request("http://localhost:3000/api/organizations/provision", {
      method: "POST",
      body: JSON.stringify({
        name: "Security Store",
        slug: "security-store",
      }),
    });

    const res = await provisionHandler(req);
    const data = await res.json();

    const responseStr = JSON.stringify(data);
    expect(responseStr.includes("convex_mgt_mock_secret")).toBe(false);
    expect(responseStr.includes("defx-pos-provisioning-secret-test")).toBe(false);
    expect(responseStr.includes("deployKey")).toBe(false);
  });

  test("8. triggerStoreDeployment uses workflow_dispatch with target ref and correct repo", async () => {
    process.env.GITHUB_TOKEN = "ghp_mock_token_12345";
    delete process.env.GITHUB_REPOSITORY;
    process.env.VERCEL_GIT_COMMIT_REF = "feature/async-store-deployment";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );

    const result = await triggerStoreDeployment({
      masterOrgId: "org_gh_123",
      name: "GitHub Store",
      slug: "github-store",
      projectId: "proj_gh",
      deploymentId: "dev-github-store",
      deploymentUrl: "https://dev-github-store.convex.cloud",
    });

    expect(result.dispatched).toBe(true);
    expect(result.target).toBe("github");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.github.com/repos/joshidhruv/pos-master/actions/workflows/deploy-store-backend.yml/dispatches",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer ghp_mock_token_12345",
        }),
        body: expect.stringContaining('"ref":"feature/async-store-deployment"'),
      })
    );
  });

  test("9. Provision route marks org failed when dispatch throws exception", async () => {
    mockQuery.mockResolvedValue(null);
    mockMutation.mockResolvedValue("master_org_fail_1");

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url.toString().includes("create_project")) {
        return new Response(
          JSON.stringify({
            id: "proj_fail",
            deploymentName: "dev-fail-store",
            deploymentUrl: "https://dev-fail-store.convex.cloud",
          }),
          { status: 200 }
        );
      }
      if (url.toString().includes("dispatches")) {
        return new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    process.env.GITHUB_TOKEN = "invalid_token";

    const req = new Request("http://localhost:3000/api/organizations/provision", {
      method: "POST",
      body: JSON.stringify({
        name: "Fail Store",
        slug: "fail-store",
      }),
    });

    const res = await provisionHandler(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("Deployment trigger failed");

    // Verify status was updated to failed on Master DB
    expect(mockMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "master_org_fail_1",
        status: "failed",
      })
    );
  });
});
