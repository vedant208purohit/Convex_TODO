/**
 * POS Backend Authentication & Authorization Control Plane Architecture
 * 
 * Flow:
 * 1. Master App handles central Identity Provider (IdP) authentication.
 * 2. Authenticated Users hold global roles (e.g. SYSTEM_ADMIN, STORE_OWNER, STORE_STAFF).
 * 3. User claims include Organization access mappings: `userOrganizations: Array<{ orgId: string, role: string }>`.
 * 4. Master App issues scoped Store access tokens or signs JWTs passed when opening Store POS applications.
 * 5. Store Convex projects validate the token's standard claims without needing a shared multi-tenant DB table.
 */

export type UserRole = "SYSTEM_ADMIN" | "ORG_ADMIN" | "MANAGER" | "CASHIER" | "WAITER";

export interface MasterUser {
  id: string;
  email: string;
  name: string;
  globalRole: UserRole;
  organizations: Array<{
    organizationSlug: string;
    role: UserRole;
  }>;
}

export interface StoreAccessPermission {
  canAccessStore: boolean;
  storeSlug: string;
  role: UserRole;
  token?: string;
}

/**
 * Validates system admin rights for Master App control plane operations
 */
export async function validateMasterAdminAuthorization(req: Request): Promise<boolean> {
  // Foundation placeholder for Phase 1.
  // In production, inspect Authorization bearer header / JWT session cookie.
  const authHeader = req.headers.get("authorization");
  if (process.env.NODE_ENV === "development" && !authHeader) {
    return true; // Dev fallback
  }
  return true;
}

/**
 * Resolves store access permission for a given user and target organization store slug
 */
export async function authorizeUserForStore(
  userId: string,
  storeSlug: string
): Promise<StoreAccessPermission> {
  // Architectural placeholder for future auth integration
  return {
    canAccessStore: true,
    storeSlug,
    role: "ORG_ADMIN",
  };
}
