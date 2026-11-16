import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { resolveOrganizationCurrency, type OrganizationCurrencyInfo } from "../../../lib/constants/countries";
import crypto from "crypto";

export interface AuthenticatedStoreContext {
  userId: string;
  userEmail?: string;
  storeConvexClient: ConvexHttpClient;
  orgId: string;
  slug: string;
  storeName?: string;
  storeCountry?: string;
  defaultCurrency?: string;
  defaultCurrencySymbol?: string;
  organizationTimeZone?: string;
  storeCurrency?: string;
  storeCurrencyInfo?: OrganizationCurrencyInfo;
}

/**
 * Resolves the authenticated caller, verifies admin permission, and connects
 * to the store-isolated Convex backend.
 */
export async function requireStoreAdminContext(req?: Request): Promise<AuthenticatedStoreContext> {
  // 1. Resolve Clerk session
  let userId: string | null = null;
  let token: string | null = null;

  try {
    const authSession = await auth();
    userId = authSession.userId;
    try {
      token = await authSession.getToken({ template: "convex" });
    } catch {
      token = await authSession.getToken();
    }
  } catch {
    userId = null;
  }

  // Support test headers in non-production/test environments
  if (!userId && process.env.NODE_ENV === "test" && req) {
    userId = req.headers.get("x-test-user-id");
    token = req.headers.get("x-test-token") || "test-token";
  }

  if (!userId) {
    const err: any = new Error("Unauthorized: Active session required.");
    err.status = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }

  // 2. Resolve store Convex URL
  let storeConvexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    process.env.CONVEX_URL ||
    "https://gregarious-chicken-229.convex.cloud";

  const bridgeSecret = process.env.BRIDGE_SECRET;
  const masterBaseUrl =
    process.env.MASTER_POS_URL ||
    process.env.NEXT_PUBLIC_MASTER_POS_URL ||
    "http://localhost:3001";

  let targetSlug: string | undefined;
  let targetOrgId: string | undefined;
  if (req) {
    try {
      const url = new URL(req.url);
      targetSlug = url.searchParams.get("slug") || url.searchParams.get("store") || undefined;
      targetOrgId = url.searchParams.get("organizationId") || url.searchParams.get("orgId") || undefined;
    } catch {}
    if (!targetSlug && (req as any).headers?.get) {
      targetSlug =
        (req as any).headers.get("x-store-slug") ||
        (req as any).headers.get("x-selected-store") ||
        undefined;
    }
  }

  if (bridgeSecret && userId && !userId.startsWith("test_")) {
    try {
      const resolveTimestamp = Date.now();
      const resolveSignature = crypto
        .createHmac("sha256", bridgeSecret)
        .update(`${userId}:${resolveTimestamp}`)
        .digest("hex");

      const resolveRes = await fetch(
        `${masterBaseUrl.replace(/\/$/, "")}/api/bridge/resolve-store`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-bridge-signature": resolveSignature,
            "x-bridge-timestamp": resolveTimestamp.toString(),
          },
          body: JSON.stringify({
            defaultClerkId: userId,
            slug: targetSlug,
            organizationId: targetOrgId,
          }),
          cache: "no-store",
        }
      );

      const resolveData = await resolveRes.json().catch(() => ({}));
      if (resolveRes.ok && resolveData.success) {
        const resolvedUrl = resolveData.deployment?.url || resolveData.deploymentUrl;
        if (resolvedUrl && typeof resolvedUrl === "string" && resolvedUrl.trim()) {
          storeConvexUrl = resolvedUrl.trim();
        }
      }
    } catch {
      // Fallback to storeConvexUrl
    }
  }

  const storeConvexClient = new ConvexHttpClient(storeConvexUrl);
  if (token) {
    storeConvexClient.setAuth(token);
  }

  let userEmail: string | undefined;
  try {
    const clerkUser = await currentUser();
    userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;
  } catch {
    userEmail = undefined;
  }

  // 3. Verify Admin Permission via getStoreAdminContext
  let adminContext: any;
  try {
    adminContext = await storeConvexClient.query(
      api.organizationUsers.getStoreAdminContext,
      {
        userId,
        email: userEmail,
      }
    );
  } catch (authErr: any) {
    const errMessage = authErr?.message || "";
    if (
      errMessage.includes("Forbidden") ||
      errMessage.includes("Admin access required") ||
      errMessage.includes("Active store membership required")
    ) {
      const err: any = new Error("Forbidden: Admin privileges required to manage payment gateways.");
      err.status = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    if (errMessage.includes("Unauthenticated")) {
      const err: any = new Error("Unauthorized: Unauthenticated store caller.");
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    throw authErr;
  }

  if (!adminContext || !adminContext.organizationId) {
    const err: any = new Error("Forbidden: Admin privileges required to manage payment gateways.");
    err.status = 403;
    err.code = "FORBIDDEN";
    throw err;
  }

  const resolvedCurrencyInfo = resolveOrganizationCurrency({
    country: adminContext.country,
    defaultCurrency: adminContext.defaultCurrency,
    defaultCurrencySymbol: adminContext.defaultCurrencySymbol,
  });

  return {
    userId,
    userEmail,
    storeConvexClient,
    orgId: adminContext.organizationId,
    slug: adminContext.slug,
    storeName: adminContext.name,
    storeCountry: adminContext.country,
    defaultCurrency: adminContext.defaultCurrency,
    defaultCurrencySymbol: adminContext.defaultCurrencySymbol,
    organizationTimeZone: adminContext.organizationTimeZone,
    storeCurrency: resolvedCurrencyInfo.code,
    storeCurrencyInfo: resolvedCurrencyInfo,
  };
}

