/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Default Auth Guards Behavior Tests", () => {
  test("Unauthenticated calls to update, liveOrganization, remove, getWithSecrets are rejected", async () => {
    const t = convexTest(schema, modules);

    // Create an organization (simulating store provisioning)
    const orgId = await t.mutation(api.organizations.create, {
      name: "Auth Guard Store",
    });

    // Unauthenticated update throws Unauthenticated
    await expect(
      t.mutation(api.organizations.update, {
        id: orgId,
        phone: "+1234567890",
      })
    ).rejects.toThrow("Unauthenticated");

    // Unauthenticated liveOrganization throws Unauthenticated
    await expect(
      t.mutation(api.organizations.liveOrganization, { id: orgId })
    ).rejects.toThrow("Unauthenticated");

    // Unauthenticated remove throws Unauthenticated
    await expect(
      t.mutation(api.organizations.remove, { id: orgId })
    ).rejects.toThrow("Unauthenticated");

    // Unauthenticated getWithSecrets throws Unauthenticated
    await expect(
      t.query(api.organizations.getWithSecrets, { id: orgId })
    ).rejects.toThrow("Unauthenticated");
  });

  test("Authenticated calls with valid Clerk identity proceed cleanly", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Auth Guard Store",
    });

    // Mock authenticated caller with Clerk identity
    const authCaller = t.withIdentity({
      name: "Store Admin",
      email: "admin@defx.com",
      subject: "user_clerk_12345",
    });

    // Authenticated update succeeds
    await authCaller.mutation(api.organizations.update, {
      id: orgId,
      primaryColor: "#FF5733",
    });

    const getRes = await t.query(api.organizations.get, { id: orgId });
    expect(getRes?.primaryColor).toBe("#FF5733");

    // Authenticated getWithSecrets succeeds
    const secretsRes = await authCaller.query(api.organizations.getWithSecrets, {
      id: orgId,
    });
    expect(secretsRes?._id).toBe(orgId);

    // Authenticated liveOrganization succeeds
    await authCaller.mutation(api.organizations.liveOrganization, {
      id: orgId,
    });

    const liveRes = await t.query(api.organizations.get, { id: orgId });
    expect(liveRes?.published).toBe(true);

    // Authenticated remove succeeds
    const removeRes = await authCaller.mutation(api.organizations.remove, {
      id: orgId,
    });
    expect(removeRes.success).toBe(true);
  });
});
