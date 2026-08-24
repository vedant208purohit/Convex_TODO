import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

export async function POST(req: Request) {
  try {
    const {
      name,
      slug: providedSlug,
      legacyOrganizationId,
      ownerClerkId: providedOwnerClerkId,
      phone,
      addressLine1,
      city,
      state,
      country,
      zipCode,
      latitude,
      longitude,
    } = await req.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Organization name is required." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    let slug = (providedSlug || trimmedName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) {
      slug = `org-${Date.now()}`;
    }

    const managementToken =
      process.env.CONVEX_MANAGEMENT_API_KEY ||
      process.env.CONVEX_MANAGEMENT_TOKEN;
    const teamId = process.env.CONVEX_TEAM_ID;
    const masterConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!managementToken || !teamId || !masterConvexUrl) {
      return NextResponse.json(
        {
          error:
            "Server configuration missing (CONVEX_MANAGEMENT_API_KEY, CONVEX_TEAM_ID, or NEXT_PUBLIC_CONVEX_URL).",
        },
        { status: 500 }
      );
    }

    const defaultClerkIssuer =
      process.env.DEFAULT_CLERK_JWT_ISSUER_DOMAIN?.trim() ||
      process.env.CLERK_JWT_ISSUER_DOMAIN?.trim() ||
      "https://neat-oyster-3072.clerk.accounts.dev";

    // 1. Authenticate Master request via Clerk
    const authResult = await auth();
    const { getToken, userId: authenticatedUserId } = authResult;
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    let token: string | null = null;
    try {
      token = await getToken({ template: "convex" });
    } catch {
      token = await getToken();
    }
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    // 2. Resolve ownerClerkId securely
    const ownerClerkId =
      providedOwnerClerkId &&
      typeof providedOwnerClerkId === "string" &&
      providedOwnerClerkId.trim()
        ? providedOwnerClerkId.trim()
        : authenticatedUserId || undefined;

    const convexClient = new ConvexHttpClient(masterConvexUrl);
    if (token) {
      convexClient.setAuth(token);
    }

    // 3. Check existing organization in Master DB
    if (legacyOrganizationId) {
      const existingByLegacy: any = await convexClient.query(
        api.organizations.getByLegacyOrganizationId,
        {
          legacyOrganizationId,
        }
      );

      if (existingByLegacy && existingByLegacy.status === "active") {
        return NextResponse.json({
          success: true,
          organization: {
            id: existingByLegacy._id,
            name: existingByLegacy.name,
            slug: existingByLegacy.slug,
            legacyOrganizationId: existingByLegacy.legacyOrganizationId,
            ownerClerkId: existingByLegacy.ownerClerkId,
            projectId: existingByLegacy.projectId,
            deploymentId: existingByLegacy.deploymentId,
            deploymentUrl: existingByLegacy.deploymentUrl,
            status: "active",
          },
          message: "Existing active store project found.",
        });
      }
    }

    const existingBySlug: any = await convexClient.query(
      api.organizations.getBySlug,
      { slug }
    );

    if (existingBySlug && existingBySlug.status === "active") {
      return NextResponse.json({
        success: true,
        organization: {
          id: existingBySlug._id,
          name: existingBySlug.name,
          slug: existingBySlug.slug,
          legacyOrganizationId: existingBySlug.legacyOrganizationId,
          ownerClerkId: existingBySlug.ownerClerkId,
          projectId: existingBySlug.projectId,
          deploymentId: existingBySlug.deploymentId,
          deploymentUrl: existingBySlug.deploymentUrl,
          status: "active",
        },
        message: "Existing active store project found.",
      });
    }

    if (existingBySlug && existingBySlug.status === "provisioning") {
      return NextResponse.json(
        { error: `Organization "${trimmedName}" is currently being provisioned.` },
        { status: 409 }
      );
    }

    if (
      existingBySlug &&
      legacyOrganizationId &&
      existingBySlug.legacyOrganizationId !== legacyOrganizationId
    ) {
      slug = `${slug}-${legacyOrganizationId.substring(0, 8)}`;
    }

    // 4. Create/update Master organization record
    const orgId = await convexClient.mutation(api.organizations.create, {
      name: trimmedName,
      slug,
      legacyOrganizationId: legacyOrganizationId || undefined,
      ownerClerkId: ownerClerkId || undefined,
    });

    console.log(
      `Starting provisioning for store organization: ${trimmedName} (slug: ${slug}, legacyId: ${legacyOrganizationId || "none"}, ownerClerkId: ${ownerClerkId || "none"})`
    );

    // 5. Create Convex project via Management API
    const createProjectRes = await fetch(
      `https://api.convex.dev/v1/teams/${teamId}/create_project`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectName: slug,
          deploymentType: "dev",
        }),
      }
    );

    const projectData = await createProjectRes.json();

    if (!createProjectRes.ok) {
      const errorMsg =
        projectData.message ||
        `Failed to create Convex project (${createProjectRes.status}).`;
      await convexClient.mutation(api.organizations.updateStatus, {
        id: orgId,
        status: "failed",
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    const projectId = String(projectData.id || projectData.projectId);
    const deploymentName = projectData.deploymentName;
    const deploymentUrl = projectData.deploymentUrl;

    if (!deploymentName || !deploymentUrl) {
      const errorMsg = "Convex project created, but no deployment was returned.";
      await convexClient.mutation(api.organizations.updateStatus, {
        id: orgId,
        status: "failed",
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // 6. Create Deploy Key
    const createKeyRes = await fetch(
      `https://api.convex.dev/v1/deployments/${deploymentName}/create_deploy_key`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `provision-key-${Date.now()}`,
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
      const errorMsg = keyData.message || "Failed to create deploy key for deployment.";
      await convexClient.mutation(api.organizations.updateStatus, {
        id: orgId,
        status: "failed",
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    const deployKey = keyData.deployKey;

    // 7 & 8. Configure Default deployment & deploy Default App
    let defaultAppPath = process.env.DEFAULT_APP_PATH
      ? path.resolve(process.env.DEFAULT_APP_PATH)
      : path.resolve(process.cwd(), "../pos-default");

    if (!fs.existsSync(defaultAppPath) || !fs.existsSync(path.join(defaultAppPath, "convex"))) {
      const defaultAppAltPath = path.resolve(process.cwd(), "../Default app");
      if (fs.existsSync(defaultAppAltPath) && fs.existsSync(path.join(defaultAppAltPath, "convex"))) {
        defaultAppPath = defaultAppAltPath;
      } else {
        defaultAppPath = path.resolve(process.cwd(), "default-app-convex");
      }
    }

    if (fs.existsSync(defaultAppPath) && !fs.existsSync(path.join(defaultAppPath, "package.json"))) {
      fs.writeFileSync(
        path.join(defaultAppPath, "package.json"),
        JSON.stringify(
          {
            name: "default-app-convex",
            version: "0.1.0",
            private: true,
            dependencies: { convex: "^1.18.0" },
          },
          null,
          2
        )
      );
    }

    console.log(
      `Deploying Default POS app code to ${deploymentName} at path: ${defaultAppPath}`
    );

    const provisioningSecret =
      process.env.PROVISIONING_SECRET || "defx-pos-provisioning-secret-dev";

    if (process.env.NODE_ENV === "production" && !process.env.PROVISIONING_SECRET) {
      console.warn(
        "SECURITY WARNING: PROVISIONING_SECRET environment variable is not defined in production environment."
      );
    }

    try {
      const cliPath = path.resolve(process.cwd(), "node_modules/convex/bin/main.js");
      const useLocalCli = fs.existsSync(cliPath);
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
        console.warn(
          `Warning: Could not set CLERK_JWT_ISSUER_DOMAIN on deployment ${deploymentName}:`,
          envErr.message
        );
      }

      try {
        await execPromise(
          `${convexCmd} env set PROVISIONING_SECRET ${provisioningSecret}`,
          execOptions
        );
      } catch (envErr: any) {
        console.warn(
          `Warning: Could not set PROVISIONING_SECRET on deployment ${deploymentName}:`,
          envErr.message
        );
      }

      await execPromise(
        `${convexCmd} dev --once --typecheck=disable --tail-logs disable`,
        execOptions
      );
    } catch (deployErr: any) {
      const errorMsg = `POS Code deployment failed: ${deployErr.stderr || deployErr.message}`;
      console.error(errorMsg);
      await convexClient.mutation(api.organizations.updateStatus, {
        id: orgId,
        status: "failed",
        projectId,
        deploymentId: deploymentName,
        deploymentUrl,
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // 9. Generate provisioning HMAC SHA-256 token
    const timestamp = Date.now();
    const provisioningToken = await generateHmacSha256(
      provisioningSecret,
      `${slug}:${timestamp}`
    );

    // 10 & 11. Create Default App Organization in store DB with ownerClerkId & HMAC token
    const storeClient = new ConvexHttpClient(deploymentUrl);
    let storeOrgId: any;

    try {
      storeOrgId = await storeClient.mutation("organizations:create" as any, {
        name: trimmedName,
        slug: slug,
        legacyId: legacyOrganizationId || undefined,
        ownerClerkId: ownerClerkId || undefined,
        published: false,
        isTest: false,
        phone: phone || undefined,
        addressLine1: addressLine1 || undefined,
        city: city || undefined,
        state: state || undefined,
        country: country || undefined,
        zipCode: zipCode || undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        provisioningToken,
        timestamp,
      });
    } catch (createErr: any) {
      const errorMsg = `Store organization creation failed: ${createErr.message}`;
      console.error(errorMsg);
      await convexClient.mutation(api.organizations.updateStatus, {
        id: orgId,
        status: "failed",
        projectId,
        deploymentId: deploymentName,
        deploymentUrl,
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // 12. Initialize store defaults with HMAC token
    try {
      await storeClient.mutation("organizations:initializeStore" as any, {
        id: storeOrgId,
        slug,
        provisioningToken,
        timestamp,
      });
    } catch (initErr: any) {
      const errorMsg = `Store organization initialization failed: ${initErr.message}`;
      console.error(errorMsg);
      await convexClient.mutation(api.organizations.updateStatus, {
        id: orgId,
        status: "failed",
        projectId,
        deploymentId: deploymentName,
        deploymentUrl,
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // 13. Mark store organization active in Master DB
    await convexClient.mutation(api.organizations.updateStatus, {
      id: orgId,
      status: "active",
      projectId,
      deploymentId: deploymentName,
      deploymentUrl,
    });

    console.log(
      `Successfully provisioned & initialized store organization: ${trimmedName} (${deploymentUrl})`
    );

    return NextResponse.json({
      success: true,
      organization: {
        id: orgId,
        name: trimmedName,
        slug,
        legacyOrganizationId,
        projectId,
        deploymentId: deploymentName,
        deploymentUrl,
        storeOrgId,
        status: "active",
      },
    });
  } catch (err: any) {
    console.error("Provisioning error:", err);
    return NextResponse.json(
      {
        error:
          err.message ||
          "Internal server error during organization provisioning.",
      },
      { status: 500 }
    );
  }
}
