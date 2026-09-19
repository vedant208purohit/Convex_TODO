/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

describe("Organization Assets Schema Validation Tests", () => {
  test("1. Successfully creates, queries, and updates organization_assets record with indexes", async () => {
    const t = convexTest(schema, modules);

    // Create an organization
    const orgId = await t.mutation(api.organizations.create, {
      name: "Asset Test Store",
    });

    // Run db operations using test context
    await t.run(async (ctx) => {
      const now = Date.now();
      const storageKey = `organizations/${orgId}/menu_image/${now}-abc123-burger.png`;

      // 1. Insert asset record
      const assetId = await ctx.db.insert("organization_assets", {
        organizationId: orgId,
        storageKey,
        fileName: "burger.png",
        contentType: "image/png",
        fileSize: 204800,
        assetType: "menu_image",
        status: "pending",
        createdBy: "user_clerk_123",
        createdAt: now,
        updatedAt: now,
      });

      expect(assetId).toBeDefined();

      // 2. Query by ID
      const asset = await ctx.db.get(assetId);
      expect(asset).not.toBeNull();
      expect(asset?.fileName).toBe("burger.png");
      expect(asset?.status).toBe("pending");
      expect(asset?.fileSize).toBe(204800);

      // 3. Query via by_organization index
      const orgAssets = await ctx.db
        .query("organization_assets")
        .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
        .collect();
      expect(orgAssets.length).toBe(1);
      expect(orgAssets[0].storageKey).toBe(storageKey);

      // 4. Query via by_organization_asset_type index
      const menuAssets = await ctx.db
        .query("organization_assets")
        .withIndex("by_organization_asset_type", (q) =>
          q.eq("organizationId", orgId).eq("assetType", "menu_image")
        )
        .collect();
      expect(menuAssets.length).toBe(1);

      // 5. Query via by_storage_key index
      const keyAsset = await ctx.db
        .query("organization_assets")
        .withIndex("by_storage_key", (q) => q.eq("storageKey", storageKey))
        .first();
      expect(keyAsset).not.toBeNull();
      expect(keyAsset?._id).toBe(assetId);

      // 6. Update status to uploaded
      await ctx.db.patch(assetId, {
        status: "uploaded",
        updatedAt: Date.now(),
      });

      // 7. Query via by_status index
      const uploadedAssets = await ctx.db
        .query("organization_assets")
        .withIndex("by_status", (q) => q.eq("status", "uploaded"))
        .collect();
      expect(uploadedAssets.length).toBe(1);
      expect(uploadedAssets[0].status).toBe("uploaded");
    });
  });

  test("2. Supports all asset lifecycle status states (pending, uploaded, failed, deleted)", async () => {
    const t = convexTest(schema, modules);

    const orgId = await t.mutation(api.organizations.create, {
      name: "Status Test Store",
    });

    await t.run(async (ctx) => {
      const statuses = ["pending", "uploaded", "failed", "deleted"] as const;

      for (const st of statuses) {
        const now = Date.now();
        const assetId = await ctx.db.insert("organization_assets", {
          organizationId: orgId,
          storageKey: `organizations/${orgId}/document/${now}-${st}.pdf`,
          fileName: `${st}.pdf`,
          contentType: "application/pdf",
          fileSize: 1024,
          assetType: "document",
          status: st,
          createdAt: now,
          updatedAt: now,
        });

        const rec = await ctx.db.get(assetId);
        expect(rec?.status).toBe(st);
      }
    });
  });
});
