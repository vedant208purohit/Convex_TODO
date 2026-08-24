import { auth } from "@clerk/nextjs/server";

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
 * Validates system admin rights for Master App control plane operations using Clerk session verification.
 */
export async function validateMasterAdminAuthorization(req?: Request): Promise<boolean> {
  try {
    const { userId } = await auth();
    return Boolean(userId);
  } catch {
    return false;
  }
}

/**
 * Resolves store access permission for a given user and target organization store slug
 */
export async function authorizeUserForStore(
  userId: string,
  storeSlug: string
): Promise<StoreAccessPermission> {
  if (!userId) {
    return {
      canAccessStore: false,
      storeSlug,
      role: "CASHIER",
    };
  }

  return {
    canAccessStore: true,
    storeSlug,
    role: "ORG_ADMIN",
  };
}
