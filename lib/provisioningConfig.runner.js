import assert from "node:assert";
import { validateServerProvisioningConfig } from "./provisioningConfig.js";

const validEnv = {
  CONVEX_MANAGEMENT_API_KEY: "convex_mgt_test_key_12345",
  CONVEX_TEAM_ID: "team_test_12345",
  NEXT_PUBLIC_CONVEX_URL: "https://test-master.convex.cloud",
  DEFAULT_CLERK_JWT_ISSUER_DOMAIN: "https://test-clerk.accounts.dev",
  PROVISIONING_SECRET: "test-provisioning-secret-12345",
};

console.log("Running server provisioning config validation assertions...");

// 1. All valid
const res1 = validateServerProvisioningConfig(validEnv);
assert.strictEqual(res1.valid, true);
assert.deepStrictEqual(res1.missing, []);
assert.strictEqual(res1.config?.managementToken, "convex_mgt_test_key_12345");
assert.strictEqual(res1.config?.teamId, "team_test_12345");
assert.strictEqual(res1.config?.masterConvexUrl, "https://test-master.convex.cloud");
assert.strictEqual(res1.config?.defaultClerkIssuer, "https://test-clerk.accounts.dev");
assert.strictEqual(res1.config?.provisioningSecret, "test-provisioning-secret-12345");
console.log("✓ 1. Valid environment pass");

// 2. Missing CONVEX_MANAGEMENT_API_KEY & CONVEX_MANAGEMENT_TOKEN
const res2 = validateServerProvisioningConfig({ ...validEnv, CONVEX_MANAGEMENT_API_KEY: undefined, CONVEX_MANAGEMENT_TOKEN: undefined });
assert.strictEqual(res2.valid, false);
assert.ok(res2.missing.includes("CONVEX_MANAGEMENT_API_KEY"));
console.log("✓ 2. Missing management key detected");

// 3. Fallback CONVEX_MANAGEMENT_TOKEN
const res3 = validateServerProvisioningConfig({ ...validEnv, CONVEX_MANAGEMENT_API_KEY: undefined, CONVEX_MANAGEMENT_TOKEN: "convex_mgt_token_fallback" });
assert.strictEqual(res3.valid, true);
assert.strictEqual(res3.config?.managementToken, "convex_mgt_token_fallback");
console.log("✓ 3. Management token fallback accepted");

// 4. Missing CONVEX_TEAM_ID
const res4 = validateServerProvisioningConfig({ ...validEnv, CONVEX_TEAM_ID: undefined });
assert.strictEqual(res4.valid, false);
assert.ok(res4.missing.includes("CONVEX_TEAM_ID"));
console.log("✓ 4. Missing CONVEX_TEAM_ID detected");

// 5. Missing NEXT_PUBLIC_CONVEX_URL
const res5 = validateServerProvisioningConfig({ ...validEnv, NEXT_PUBLIC_CONVEX_URL: undefined });
assert.strictEqual(res5.valid, false);
assert.ok(res5.missing.includes("NEXT_PUBLIC_CONVEX_URL"));
console.log("✓ 5. Missing NEXT_PUBLIC_CONVEX_URL detected");

// 6. Missing Clerk issuer domain
const res6 = validateServerProvisioningConfig({ ...validEnv, DEFAULT_CLERK_JWT_ISSUER_DOMAIN: undefined, CLERK_JWT_ISSUER_DOMAIN: undefined });
assert.strictEqual(res6.valid, false);
assert.ok(res6.missing.includes("DEFAULT_CLERK_JWT_ISSUER_DOMAIN"));
console.log("✓ 6. Missing Clerk issuer domain detected");

// 7. Fallback CLERK_JWT_ISSUER_DOMAIN
const res7 = validateServerProvisioningConfig({ ...validEnv, DEFAULT_CLERK_JWT_ISSUER_DOMAIN: undefined, CLERK_JWT_ISSUER_DOMAIN: "https://fallback-clerk.accounts.dev" });
assert.strictEqual(res7.valid, true);
assert.strictEqual(res7.config?.defaultClerkIssuer, "https://fallback-clerk.accounts.dev");
console.log("✓ 7. Clerk issuer fallback accepted");

// 8. Missing PROVISIONING_SECRET
const res8 = validateServerProvisioningConfig({ ...validEnv, PROVISIONING_SECRET: undefined });
assert.strictEqual(res8.valid, false);
assert.ok(res8.missing.includes("PROVISIONING_SECRET"));
console.log("✓ 8. Missing PROVISIONING_SECRET detected");

console.log("ALL 8 VALIDATION TESTS PASSED CLEANLY!");
