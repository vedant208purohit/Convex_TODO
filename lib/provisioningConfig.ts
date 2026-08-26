export interface ServerProvisioningConfig {
  managementToken: string;
  teamId: string;
  masterConvexUrl: string;
  defaultClerkIssuer: string;
  provisioningSecret: string;
}

export interface ValidationResult {
  valid: boolean;
  config?: ServerProvisioningConfig;
  missing: string[];
}

/**
 * Validates all required server configuration variables for organization provisioning.
 * Returns missing variable names if any are unconfigured.
 */
export function validateServerProvisioningConfig(
  env: Record<string, string | undefined> = process.env
): ValidationResult {
  const missing: string[] = [];

  const managementToken = (
    env.CONVEX_MANAGEMENT_API_KEY || env.CONVEX_MANAGEMENT_TOKEN
  )?.trim();
  if (!managementToken) {
    missing.push("CONVEX_MANAGEMENT_API_KEY");
  }

  const teamId = env.CONVEX_TEAM_ID?.trim();
  if (!teamId) {
    missing.push("CONVEX_TEAM_ID");
  }

  const masterConvexUrl = env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!masterConvexUrl) {
    missing.push("NEXT_PUBLIC_CONVEX_URL");
  }

  const defaultClerkIssuer = (
    env.DEFAULT_CLERK_JWT_ISSUER_DOMAIN || env.CLERK_JWT_ISSUER_DOMAIN
  )?.trim();
  if (!defaultClerkIssuer) {
    missing.push("DEFAULT_CLERK_JWT_ISSUER_DOMAIN");
  }

  const provisioningSecret = env.PROVISIONING_SECRET?.trim();
  if (!provisioningSecret) {
    missing.push("PROVISIONING_SECRET");
  }

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
    };
  }

  return {
    valid: true,
    missing: [],
    config: {
      managementToken: managementToken!,
      teamId: teamId!,
      masterConvexUrl: masterConvexUrl!,
      defaultClerkIssuer: defaultClerkIssuer!,
      provisioningSecret: provisioningSecret!,
    },
  };
}
