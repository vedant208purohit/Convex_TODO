/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Master App Organization Domain Tests", () => {
  test("1. Creates Master Organization starting in provisioning status", async () => {
    const t = convexTest(schema, modules);

    const masterOrgId = await t.mutation(api.organizations.create, {
      name: "Saffron Kitchen",
      slug: "saffron-kitchen",
    });

    expect(masterOrgId).toBeDefined();

    const org = await t.query(api.organizations.get, { id: masterOrgId });
    expect(org).not.toBeNull();
    expect(org?.name).toBe("Saffron Kitchen");
    expect(org?.slug).toBe("saffron-kitchen");
    expect(org?.status).toBe("provisioning");
    expect(org?.createdAt).toBeDefined();
  });

  test("2. Legacy ID lookup and duplicate protection", async () => {
    const t = convexTest(schema, modules);

    const legacyId = "rails-uuid-12345";
    const masterOrgId = await t.mutation(api.organizations.create, {
      name: "Legacy Store",
      slug: "legacy-store",
      legacyOrganizationId: legacyId,
    });

    const fetched = await t.query(api.organizations.getByLegacyOrganizationId, {
      legacyOrganizationId: legacyId,
    });

    expect(fetched?._id).toBe(masterOrgId);

    // Creating again with same legacyId returns existing ID if provisioning
    const duplicateId = await t.mutation(api.organizations.create, {
      name: "Legacy Store Dup",
      slug: "legacy-store-dup",
      legacyOrganizationId: legacyId,
    });

    expect(duplicateId).toBe(masterOrgId);
  });

  test("3. Slug deduplication with legacy ID disambiguation", async () => {
    const t = convexTest(schema, modules);

    const orgId1 = await t.mutation(api.organizations.create, {
      name: "Taco Haven",
      slug: "taco-haven",
      legacyOrganizationId: "legacy-11111111-aaaa",
    });

    // Mark first org active
    await t.mutation(api.organizations.updateStatus, {
      id: orgId1,
      status: "active",
    });

    // Creating second org with same slug but different legacy ID disambiguates slug
    const orgId2 = await t.mutation(api.organizations.create, {
      name: "Taco Haven 2",
      slug: "taco-haven",
      legacyOrganizationId: "legacy-22222222-bbbb",
    });

    const org2 = await t.query(api.organizations.get, { id: orgId2 });
    expect(org2?.slug).toBe("taco-haven-legacy-2");
  });

  test("4. Status update lifecycle transitions (active, failed, deleting, deleted)", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Lifecycle Store",
      slug: "lifecycle-store",
    });

    // Active
    await t.mutation(api.organizations.updateStatus, {
      id: orgId,
      status: "active",
      projectId: "proj-123",
      deploymentId: "dep-123",
      deploymentUrl: "https://dep-123.convex.cloud",
    });

    let org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.status).toBe("active");
    expect(org?.projectId).toBe("proj-123");
    expect(org?.deploymentUrl).toBe("https://dep-123.convex.cloud");

    // Failed
    await t.mutation(api.organizations.updateStatus, {
      id: orgId,
      status: "failed",
      errorMessage: "CLI Deployment Timeout",
    });

    org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.status).toBe("failed");
    expect(org?.errorMessage).toBe("CLI Deployment Timeout");
  });

  test("5. Soft deletion sets status=deleted and deletedAt", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Deleted Store",
      slug: "deleted-store",
    });

    await t.mutation(api.organizations.softDelete, { id: orgId });

    const org = await t.query(api.organizations.get, { id: orgId });
    expect(org?.status).toBe("deleted");
    expect(org?.deletedAt).toBeDefined();

    // Default list query excludes soft-deleted records
    const listActive = await t.query(api.organizations.list, {});
    expect(listActive.find((o) => o._id === orgId)).toBeUndefined();

    // list query with includeDeleted: true includes soft-deleted records
    const listAll = await t.query(api.organizations.list, { includeDeleted: true });
    expect(listAll.find((o) => o._id === orgId)).toBeDefined();
  });

  test("6. Querying get with empty string or invalid ID returns null safely", async () => {
    const t = convexTest(schema, modules);

    const emptyRes = await t.query(api.organizations.get, { id: "" });
    expect(emptyRes).toBeNull();

    const invalidRes = await t.query(api.organizations.get, { id: "invalid-id-string" });
    expect(invalidRes).toBeNull();
  });

  test("7. Owner Clerk ID is persisted on Master organization creation", async () => {
    const t = convexTest(schema, modules);

    const masterOrgId = await t.mutation(api.organizations.create, {
      name: "Owner Test Kitchen",
      slug: "owner-test-kitchen",
      ownerClerkId: "user_clerk_owner_123",
    });

    const org = await t.query(api.organizations.get, { id: masterOrgId });
    expect(org?.ownerClerkId).toBe("user_clerk_owner_123");
  });

  test("8. Re-provisioning or retry preserves the original ownerClerkId", async () => {
    const t = convexTest(schema, modules);

    const masterOrgId = await t.mutation(api.organizations.create, {
      name: "Retry Owner Kitchen",
      slug: "retry-owner-kitchen",
      ownerClerkId: "user_original_owner_999",
    });

    // Mark failed
    await t.mutation(api.organizations.updateStatus, {
      id: masterOrgId,
      status: "failed",
      errorMessage: "Network error",
    });

    // Retry mutation with ownerClerkId specified or omitted preserves original ownerClerkId
    const retryOrgId = await t.mutation(api.organizations.create, {
      name: "Retry Owner Kitchen",
      slug: "retry-owner-kitchen",
    });

    expect(retryOrgId).toBe(masterOrgId);
    const org = await t.query(api.organizations.get, { id: masterOrgId });
    expect(org?.ownerClerkId).toBe("user_original_owner_999");
    expect(org?.status).toBe("provisioning");
  });
});
