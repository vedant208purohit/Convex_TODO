import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { generateR2SignedDownloadUrl } from "./r2SignedUrl";

export interface ResolveAssetOptions {
  assetId?: Id<"organization_assets"> | null;
  storageId?: Id<"_storage"> | null;
  organizationId?: Id<"organizations"> | null;
  expiresInSeconds?: number;
}

export type AssetResolverContext =
  | QueryCtx
  | MutationCtx
  | {
      db: { get: (id: unknown) => Promise<unknown> };
      storage: { getUrl: (id: unknown) => Promise<string | null> };
    };

/**
 * Resolves an asset URL using R2 first with Convex Storage fallback.
 *
 * Rules:
 * 1. If `assetId` is present:
 *    - Loads `organization_assets` document.
 *    - Enforces organization isolation: asset.organizationId MUST match options.organizationId.
 *    - Validates lifecycle status: MUST be "uploaded" (not "pending", "failed", or "deleted").
 *    - Validates soft deletion: deletedAt MUST be undefined.
 *    - Generates a signed R2 GET download URL using the trusted storageKey.
 * 2. If R2 asset is not usable (missing, pending, deleted, cross-org, or generation error):
 *    - Falls back to `storageId` via `ctx.storage.getUrl(storageId)`.
 * 3. Returns null if neither resolves.
 */
export async function resolveAssetOrStorageUrl(
  ctx: AssetResolverContext,
  options: ResolveAssetOptions
): Promise<string | null> {
  const { assetId, storageId, organizationId, expiresInSeconds } = options;

  // 1. Try R2 Resolution First
  if (assetId) {
    try {
      const asset = (await ctx.db.get(assetId)) as Doc<"organization_assets"> | null;

      if (asset && asset.deletedAt === undefined && asset.status === "uploaded") {
        // Enforce organization isolation if organizationId is provided
        const isAuthorizedOrg =
          !organizationId || String(asset.organizationId) === String(organizationId);

        if (isAuthorizedOrg && asset.storageKey) {
          try {
            const r2SignedUrl = await generateR2SignedDownloadUrl(
              asset.storageKey,
              expiresInSeconds || 900
            );
            if (r2SignedUrl) {
              return r2SignedUrl;
            }
          } catch {
            // R2 signed URL generation fallback
          }
        }
      }
    } catch {
      // Asset DB lookup fallback
    }
  }

  // 2. Fallback to Legacy Convex Storage
  if (storageId) {
    try {
      const storageUrl = await ctx.storage.getUrl(storageId);
      if (storageUrl) {
        return storageUrl;
      }
    } catch {
      // Storage lookup fallback
    }
  }

  return null;
}
