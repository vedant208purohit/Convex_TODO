import { describe, expect, test } from "vitest";
import { validateServerProvisioningConfig } from "./provisioningConfig";

describe("validateServerProvisioningConfig", () => {
  const validEnv = {
    CONVEX_MANAGEMENT_API_KEY: "convex_mgt_test_key_12345",
    CONVEX_TEAM_ID: "team_test_12345",
    NEXT_PUBLIC_CONVEX_URL: "https://test-master.convex.cloud",
    DEFAULT_CLERK_JWT_ISSUER_DOMAIN: "https://test-clerk.accounts.dev",
    PROVISIONING_SECRET: "test-provisioning-secret-12345",
  };

  test("1. Returns valid when all required environment variables are set", () => {
    const result = validateServerProvisioningConfig(validEnv);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.config?.managementToken).toBe("convex_mgt_test_key_12345");
    expect(result.config?.teamId).toBe("team_test_12345");
    expect(result.config?.masterConvexUrl).toBe("https://test-master.convex.cloud");
    expect(result.config?.defaultClerkIssuer).toBe("https://test-clerk.accounts.dev");
    expect(result.config?.provisioningSecret).toBe("test-provisioning-secret-12345");
  });

  test("2. Detects missing CONVEX_MANAGEMENT_API_KEY and CONVEX_MANAGEMENT_TOKEN", () => {
    const env = { ...validEnv, CONVEX_MANAGEMENT_API_KEY: undefined, CONVEX_MANAGEMENT_TOKEN: undefined };
    const result = validateServerProvisioningConfig(env);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("CONVEX_MANAGEMENT_API_KEY");
  });

  test("3. Accepts CONVEX_MANAGEMENT_TOKEN as fallback for CONVEX_MANAGEMENT_API_KEY", () => {
    const env = { ...validEnv, CONVEX_MANAGEMENT_API_KEY: undefined, CONVEX_MANAGEMENT_TOKEN: "convex_mgt_token_fallback" };
    const result = validateServerProvisioningConfig(env);
    expect(result.valid).toBe(true);
    expect(result.config?.managementToken).toBe("convex_mgt_token_fallback");
  });

  test("4. Detects missing CONVEX_TEAM_ID", () => {
    const env = { ...validEnv, CONVEX_TEAM_ID: undefined };
    const result = validateServerProvisioningConfig(env);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("CONVEX_TEAM_ID");
  });

  test("5. Detects missing NEXT_PUBLIC_CONVEX_URL", () => {
    const env = { ...validEnv, NEXT_PUBLIC_CONVEX_URL: undefined };
    const result = validateServerProvisioningConfig(env);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("NEXT_PUBLIC_CONVEX_URL");
  });

  test("6. Detects missing Clerk issuer domain when both variables are absent", () => {
    const env = { ...validEnv, DEFAULT_CLERK_JWT_ISSUER_DOMAIN: undefined, CLERK_JWT_ISSUER_DOMAIN: undefined };
    const result = validateServerProvisioningConfig(env);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("DEFAULT_CLERK_JWT_ISSUER_DOMAIN");
  });

  test("7. Accepts CLERK_JWT_ISSUER_DOMAIN as fallback for DEFAULT_CLERK_JWT_ISSUER_DOMAIN", () => {
    const env = { ...validEnv, DEFAULT_CLERK_JWT_ISSUER_DOMAIN: undefined, CLERK_JWT_ISSUER_DOMAIN: "https://fallback-clerk.accounts.dev" };
    const result = validateServerProvisioningConfig(env);
    expect(result.valid).toBe(true);
    expect(result.config?.defaultClerkIssuer).toBe("https://fallback-clerk.accounts.dev");
  });

  test("8. Detects missing PROVISIONING_SECRET", () => {
    const env = { ...validEnv, PROVISIONING_SECRET: undefined };
    const result = validateServerProvisioningConfig(env);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("PROVISIONING_SECRET");
  });

  test("9. Reports multiple missing variables simultaneously", () => {
    const env = {
      CONVEX_MANAGEMENT_API_KEY: undefined,
      CONVEX_TEAM_ID: undefined,
      NEXT_PUBLIC_CONVEX_URL: "https://test-master.convex.cloud",
      DEFAULT_CLERK_JWT_ISSUER_DOMAIN: undefined,
      PROVISIONING_SECRET: undefined,
    };
    const result = validateServerProvisioningConfig(env);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual([
      "CONVEX_MANAGEMENT_API_KEY",
      "CONVEX_TEAM_ID",
      "DEFAULT_CLERK_JWT_ISSUER_DOMAIN",
      "PROVISIONING_SECRET",
    ]);
  });
});
