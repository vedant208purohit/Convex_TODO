import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { exec } from "child_process";
import path from "path";
import util from "util";
import fs from "fs";

const execPromise = util.promisify(exec);

// HMAC SHA-256 Signature Generator
async function generateHmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface StoreDeploymentRunnerParams {
  masterOrgId: string;
  name: string;
  slug: string;
  legacyOrganizationId?: string;
  ownerClerkId?: string;
  projectId: string;
  deploymentId: string; // deploymentName
  deploymentUrl: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
}

export async function runStoreDeployment(
  params: StoreDeploymentRunnerParams
): Promise<{ success: boolean; error?: string }> {
  const masterConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const managementToken =
    process.env.CONVEX_MANAGEMENT_API_KEY ||
    process.env.CONVEX_MANAGEMENT_TOKEN;
  const provisioningSecret =
    process.env.PROVISIONING_SECRET || "defx-pos-provisioning-secret-dev";
  const defaultClerkIssuer =
    process.env.DEFAULT_CLERK_JWT_ISSUER_DOMAIN?.trim() ||
    process.env.CLERK_JWT_ISSUER_DOMAIN?.trim() ||
    "https://neat-oyster-3072.clerk.accounts.dev";

  if (!masterConvexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is required.");
  }

  const masterClient = new ConvexHttpClient(masterConvexUrl);

  const updateMasterStatus = async (
    status: "deploying" | "active" | "failed",
    errorMsg?: string
  ) => {
    try {
      await masterClient.mutation(api.organizations.updateStatusFromCallback, {
        id: params.masterOrgId as any,
        status,
        projectId: params.projectId,
        deploymentId: params.deploymentId,
        deploymentUrl: params.deploymentUrl,
        errorMessage: errorMsg,
        secret: provisioningSecret,
      });
    } catch (err: any) {
      console.error(`Failed to update master status to ${status}:`, err.message);
    }
  };

  try {
    // 1. Mark deploying
    await updateMasterStatus("deploying");

    // 2. Resolve or create deploy key
    let deployKey = process.env.CONVEX_DEPLOY_KEY;
    if (!deployKey && managementToken) {
      const createKeyRes = await fetch(
        `https://api.convex.dev/v1/deployments/${params.deploymentId}/create_deploy_key`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${managementToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `runner-key-${Date.now()}`,
            allowedActions: [
              "deployment:deploy",
              "deployment:logs:view",
              "deployment:env:view",
              "deployment:env:write",
            ],
          }),
        }
      );

      const keyData = await createKeyRes.json();
      if (!createKeyRes.ok || !keyData.deployKey) {
        throw new Error(keyData.message || "Failed to generate deploy key for deployment.");
      }
      deployKey = keyData.deployKey;
    }

    if (!deployKey) {
      throw new Error("No CONVEX_DEPLOY_KEY available for deployment execution.");
    }

    // 3. Resolve pos-default application path
    let defaultAppPath = process.env.DEFAULT_APP_PATH
      ? path.resolve(process.env.DEFAULT_APP_PATH)
      : path.resolve(process.cwd(), "../pos-default");

    if (!fs.existsSync(/*turbopackIgnore: true*/ defaultAppPath) || !fs.existsSync(/*turbopackIgnore: true*/ path.join(defaultAppPath, "convex"))) {
      const defaultAppAltPath = path.resolve(process.cwd(), "../Default app");
      if (fs.existsSync(/*turbopackIgnore: true*/ defaultAppAltPath) && fs.existsSync(/*turbopackIgnore: true*/ path.join(defaultAppAltPath, "convex"))) {
        defaultAppPath = defaultAppAltPath;
      } else {
        defaultAppPath = path.resolve(process.cwd(), "default-app-convex");
      }
    }

    // 4. Run Convex CLI deployment
    const cliPath = path.resolve(process.cwd(), "node_modules/convex/bin/main.js");
    const useLocalCli = fs.existsSync(/*turbopackIgnore: true*/ cliPath);
    const convexCmd = useLocalCli ? `"${process.execPath}" "${cliPath}"` : "npx convex";

    const execOptions: any = {
      cwd: defaultAppPath,
      env: {
        ...process.env,
        CONVEX_DEPLOY_KEY: deployKey,
        CLERK_JWT_ISSUER_DOMAIN: defaultClerkIssuer,
        PROVISIONING_SECRET: provisioningSecret,
      },
    };

    if (process.platform === "win32" && process.env.ComSpec) {
      execOptions.shell = process.env.ComSpec;
    }

    try {
      await execPromise(
        `${convexCmd} env set CLERK_JWT_ISSUER_DOMAIN ${defaultClerkIssuer}`,
        execOptions
      );
    } catch (envErr: any) {
      console.warn(`Could not set CLERK_JWT_ISSUER_DOMAIN on deployment: ${envErr.message}`);
    }

    try {
      await execPromise(
        `${convexCmd} env set PROVISIONING_SECRET ${provisioningSecret}`,
        execOptions
      );
    } catch (envErr: any) {
      console.warn(`Could not set PROVISIONING_SECRET on deployment: ${envErr.message}`);
    }

    await execPromise(
      `${convexCmd} dev --once --typecheck=disable --tail-logs disable`,
      execOptions
    );

    // 5. Generate provisioning HMAC SHA-256 token
    const timestamp = Date.now();
    const provisioningToken = await generateHmacSha256(
      provisioningSecret,
      `${params.slug}:${timestamp}`
    );

    // 6. Connect Store Convex Client
    const storeClient = new ConvexHttpClient(params.deploymentUrl);
    let storeOrgId: any;

    try {
      const existingStoreOrg: any = await storeClient.query(
        "organizations:getBySlug" as any,
        { slug: params.slug }
      );

      if (existingStoreOrg) {
        storeOrgId = existingStoreOrg._id;
      } else {
        storeOrgId = await storeClient.mutation("organizations:create" as any, {
          name: params.name,
          slug: params.slug,
          legacyId: params.legacyOrganizationId || undefined,
          ownerClerkId: params.ownerClerkId || undefined,
          published: false,
          isTest: false,
          phone: params.phone || undefined,
          addressLine1: params.addressLine1 || undefined,
          city: params.city || undefined,
          state: params.state || undefined,
          country: params.country || undefined,
          zipCode: params.zipCode || undefined,
          latitude: params.latitude || undefined,
          longitude: params.longitude || undefined,
          provisioningToken,
          timestamp,
        });
      }
    } catch (createErr: any) {
      throw new Error(`Store organization creation failed: ${createErr.message}`);
    }

    // 7. Initialize store defaults
    try {
      await storeClient.mutation("organizations:initializeStore" as any, {
        id: storeOrgId,
        slug: params.slug,
        provisioningToken,
        timestamp,
      });
    } catch (initErr: any) {
      throw new Error(`Store organization initialization failed: ${initErr.message}`);
    }

    // 8. Mark active
    await updateMasterStatus("active");
    return { success: true };
  } catch (err: any) {
    const errorMsg = err.stderr || err.message || "Store deployment failed";
    const sanitizedError = errorMsg.replace(/prod:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+/g, "[REDACTED_DEPLOY_KEY]");
    console.error("Store deployment runner error:", sanitizedError);
    await updateMasterStatus("failed", sanitizedError);
    return { success: false, error: sanitizedError };
  }
}
