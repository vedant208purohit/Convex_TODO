/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Master App Global Features Domain Tests", () => {
  test("1. Super Admin / User can create a global feature", async () => {
    const t = convexTest(schema, modules);

    const featureId = await t.mutation(api.features.create, {
      name: "auto_accept",
      displayName: "Auto Accept Orders",
      description: "Auto accepts online orders",
      displayDescription: "Automatically accept incoming paid orders.",
    });

    expect(featureId).toBeDefined();

    const feature = await t.query(api.features.get, { id: featureId });
    expect(feature).not.toBeNull();
    expect(feature?.name).toBe("auto_accept");
    expect(feature?.displayName).toBe("Auto Accept Orders");
    expect(feature?.description).toBe("Auto accepts online orders");
    expect(feature?.displayDescription).toBe("Automatically accept incoming paid orders.");
    expect(feature?.createdAt).toBeDefined();
    expect(feature?.deletedAt).toBeUndefined();
  });

  test("2. Blank feature name or displayName is rejected", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.features.create, {
        name: "",
        displayName: "Display Name",
      })
    ).rejects.toThrow("Feature name can't be blank");

    await expect(
      t.mutation(api.features.create, {
        name: "test_feature",
        displayName: "   ",
      })
    ).rejects.toThrow("Feature displayName can't be blank");
  });

  test("3. Feature names are unique case-insensitively (case-insensitive collision prevention)", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.features.create, {
      name: "auto_accept",
      displayName: "Auto Accept Orders",
    });

    await expect(
      t.mutation(api.features.create, {
        name: "AUTO_ACCEPT",
        displayName: "Auto Accept Upper Case",
      })
    ).rejects.toThrow(/case-insensitive collision/i);

    await expect(
      t.mutation(api.features.create, {
        name: "Auto_Accept",
        displayName: "Auto Accept Mixed Case",
      })
    ).rejects.toThrow(/case-insensitive collision/i);
  });

  test("4. Soft-deleted feature uniqueness and read rules", async () => {
    const t = convexTest(schema, modules);

    const featureId = await t.mutation(api.features.create, {
      name: "skip_phone_number_required",
      displayName: "Skip Phone Number Required",
    });

    await t.mutation(api.features.softDelete, { id: featureId });

    const fetched = await t.query(api.features.get, { id: featureId });
    expect(fetched).toBeNull();

    const newFeatureId = await t.mutation(api.features.create, {
      name: "SKIP_PHONE_NUMBER_REQUIRED",
      displayName: "Skip Phone Number Required New",
    });

    expect(newFeatureId).toBeDefined();
    expect(newFeatureId).not.toBe(featureId);
  });

  test("5. Super Admin / User can list features and filter deleted features", async () => {
    const t = convexTest(schema, modules);

    const id1 = await t.mutation(api.features.create, {
      name: "feature_one",
      displayName: "Feature One",
    });

    const id2 = await t.mutation(api.features.create, {
      name: "feature_two",
      displayName: "Feature Two",
    });

    await t.mutation(api.features.softDelete, { id: id2 });

    const activeList = await t.query(api.features.list, {});
    expect(activeList.length).toBe(1);
    expect(activeList[0]._id).toBe(id1);

    const fullList = await t.query(api.features.list, { includeDeleted: true });
    expect(fullList.length).toBe(2);
  });

  test("6. Super Admin / User can update feature display metadata", async () => {
    const t = convexTest(schema, modules);

    const featureId = await t.mutation(api.features.create, {
      name: "show_table_tab_in_cashier",
      displayName: "Show Table Tab",
      description: "Old description",
    });

    await t.mutation(api.features.updateMetadata, {
      id: featureId,
      displayName: "Updated Table Tab Display",
      description: "New updated technical description",
      displayDescription: "New user-facing description",
    });

    const feature = await t.query(api.features.get, { id: featureId });
    expect(feature?.name).toBe("show_table_tab_in_cashier");
    expect(feature?.displayName).toBe("Updated Table Tab Display");
    expect(feature?.description).toBe("New updated technical description");
    expect(feature?.displayDescription).toBe("New user-facing description");
    expect(feature?.updatedAt).toBeDefined();
  });

  test("7. Feature name is immutable and cannot be altered via updateMetadata", async () => {
    const t = convexTest(schema, modules);

    const featureId = await t.mutation(api.features.create, {
      name: "immutable_key",
      displayName: "Immutable Key",
    });

    await t.mutation(api.features.updateMetadata, {
      id: featureId,
      displayName: "New Display Name",
    });

    const feature = await t.query(api.features.get, { id: featureId });
    expect(feature?.name).toBe("immutable_key");
  });

  test("8. Query get by feature name", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.features.create, {
      name: "auto_accept",
      displayName: "Auto Accept Orders",
    });

    const foundByLower = await t.query(api.features.get, { name: "auto_accept" });
    expect(foundByLower?.displayName).toBe("Auto Accept Orders");

    const foundByUpper = await t.query(api.features.get, { name: "AUTO_ACCEPT" });
    expect(foundByUpper?.displayName).toBe("Auto Accept Orders");
  });

  test("9. Non-Super Admin identity is rejected from creating or mutating features", async () => {
    const t = convexTest(schema, modules);

    const cashier = t.withIdentity({ role: "cashier", subject: "user_cashier_99" });

    await expect(
      cashier.mutation(api.features.create, {
        name: "test_unauthorized",
        displayName: "Unauthorized Test",
      })
    ).rejects.toThrow(/Unauthorized/i);
  });
});
