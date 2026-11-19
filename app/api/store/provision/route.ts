import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { exec } from "child_process";
import path from "path";
import util from "util";
import fs from "fs";

const execPromise = util.promisify(exec);

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Helper: HMAC SHA-256 Signature Generator
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
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Please sign in." }, { status: 401 });
    }

    const managementToken =
      process.env.CONVEX_MANAGEMENT_TOKEN || process.env.CONVEX_MANAGEMENT_API_KEY;
    const teamId = process.env.CONVEX_TEAM_ID;
    const provisioningSecret =
      process.env.PROVISIONING_SECRET || "defx-pos-provisioning-secret-dev";

    const body = await req.json();
    const {
      organizationName,
      restaurantName,
      businessType,
      locationsCount,
      addressLine1,
      suiteUnit,
      city,
      state,
      zipCode,
      country,
      phone,
      currency,
      language,
      organizationTimeZone,
      isDineIn,
      isTakeAway,
      isDelivery,
      deliveryFleetType,
      operatingHoursTemplate,
      operationTiming,
    } = body;

    const targetName = (restaurantName || organizationName || "My Restaurant").trim();
    const baseSlug = targetName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const slug = baseSlug || "store";

    // 1. If Convex Management Token & Team ID are configured, spin up real Convex project
    if (managementToken && teamId) {
      console.log(`[Store Provisioning] Creating new Convex project for team ${teamId}, slug: ${slug}...`);

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
        console.error("[Store Provisioning Error]", projectData);
        return NextResponse.json(
          { error: projectData.message || "Failed to create dedicated Convex backend project." },
          { status: 500 }
        );
      }

      const deploymentName = projectData.deploymentName;
      const deploymentUrl = projectData.deploymentUrl;

      // Create deploy key for the new deployment
      const createKeyRes = await fetch(
        `https://api.convex.dev/v1/deployments/${deploymentName}/create_deploy_key`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${managementToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `store-key-${Date.now()}`,
            allowedActions: [
              "deployment:deploy",
              "deployment:logs:view",
              "deployment:env:view",
              "deployment:env:write",
              "deployment:data:view",
              "deployment:data:write",
            ],
          }),
        }
      );

      const keyData = await createKeyRes.json();
      const deployKey = keyData.deployKey;

      if (!deployKey) {
        console.error("[Store Provisioning Error] Failed to generate deployKey:", keyData);
        return NextResponse.json(
          { error: keyData.message || "Failed to create deployment access key." },
          { status: 500 }
        );
      }

      // Deploy Convex backend schema and functions to the new project deployment
      console.log(`[Store Provisioning] Deploying backend schema and functions to ${deploymentName}...`);
      const defaultAppPath = process.cwd();
      const cliPath = path.resolve(defaultAppPath, "node_modules/convex/bin/main.js");
      const convexCmd = fs.existsSync(cliPath)
        ? `"${process.execPath}" "${cliPath}"`
        : "npx convex";

      const clerkIssuer =
        process.env.CLERK_JWT_ISSUER_DOMAIN || "https://modest-raptor-18.clerk.accounts.dev";

      // Pass deploy key via custom env object so it doesn't touch local .env.local
      const execOptions: any = {
        cwd: defaultAppPath,
        env: {
          ...process.env,
          CONVEX_DEPLOY_KEY: deployKey,
          CLERK_JWT_ISSUER_DOMAIN: clerkIssuer,
          PROVISIONING_SECRET: provisioningSecret,
        },
      };

      if (process.platform === "win32" && process.env.ComSpec) {
        execOptions.shell = process.env.ComSpec;
      }

      // 1. Set required environment variables on the new deployment
      try {
        await execPromise(
          `${convexCmd} env set CLERK_JWT_ISSUER_DOMAIN ${clerkIssuer}`,
          execOptions
        );
      } catch (envErr: any) {
        console.warn(`[Store Provisioning Warning] Could not set CLERK_JWT_ISSUER_DOMAIN: ${envErr.message}`);
      }

      try {
        await execPromise(
          `${convexCmd} env set PROVISIONING_SECRET ${provisioningSecret}`,
          execOptions
        );
      } catch (envErr: any) {
        console.warn(`[Store Provisioning Warning] Could not set PROVISIONING_SECRET: ${envErr.message}`);
      }

      // 2. Deploy schema and functions
      try {
        await execPromise(
          `${convexCmd} deploy --typecheck=disable`,
          execOptions
        );
        console.log(`[Store Provisioning] Deployment push succeeded via 'convex deploy'.`);
      } catch (deployErr: any) {
        console.error("[Store Provisioning Error] Schema deployment failed:", deployErr.stderr || deployErr.message);
        return NextResponse.json(
          { error: `Database schema setup failed: ${deployErr.stderr || deployErr.message}` },
          { status: 500 }
        );
      }

      // Seed & initialize the new deployment
      const timestamp = Date.now();
      const provisioningToken = await generateHmacSha256(
        provisioningSecret,
        `${slug}:${timestamp}`
      );

      const storeClient = new ConvexHttpClient(deploymentUrl);

      // Create the organization record in the new deployment
      const storeOrgId: any = await storeClient.mutation("organizations:create" as any, {
        name: targetName,
        slug,
        legalEntityName: organizationName || targetName,
        country: country || "US",
        state: state || "",
        city: city || "",
        phone: phone || "",
        ownerClerkId: userId,
        provisioningToken,
        timestamp,
      });

      // Save complete Onboarding details (step: 4, completed: false so they go to Step 4 Checklist)
      await storeClient.mutation("organizations:saveOnboarding" as any, {
        id: storeOrgId,
        step: 4,
        completed: false,
        organizationName,
        restaurantName: targetName,
        businessType,
        locationsCount,
        addressLine1,
        suiteUnit,
        city,
        state,
        zipCode,
        country,
        phone,
        currency,
        language,
        organizationTimeZone,
        isDineIn: isDineIn ?? true,
        isTakeAway: isTakeAway ?? true,
        isDelivery: isDelivery ?? false,
        deliveryFleetType: deliveryFleetType ?? "blended",
        operatingHoursTemplate: operatingHoursTemplate ?? "standard",
        operationTiming,
      });

      // Add user as Owner in organizationUsers using server-to-server authenticated create mutation
      try {
        await storeClient.mutation("organizationUsers:create" as any, {
          organizationId: storeOrgId,
          userId,
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          email: user?.primaryEmailAddress?.emailAddress || "",
          userType: ["admin", "cashier"],
          status: "active",
          provisioningToken,
          timestamp,
        });
      } catch (userErr: any) {
        console.warn("[Store Provisioning Warning] Owner creation warning:", userErr?.message || userErr);
      }

      // Initialize store default tables, stations, payment modes, layouts and processes
      try {
        await storeClient.mutation("organizations:initializeStore" as any, {
          id: storeOrgId,
          slug,
          name: targetName,
          country: country || undefined,
          state: state || undefined,
          city: city || undefined,
          phone: phone || undefined,
          organizationTimeZone: organizationTimeZone || undefined,
          provisioningToken,
          timestamp,
        });
      } catch (initErr) {
        console.warn("[Store Provisioning Warning] initializeStore warning:", initErr);
      }

      // Register store & owner in Master POS directory for cross-device resolution
      const masterConvexUrl =
        process.env.MASTER_CONVEX_URL ||
        process.env.NEXT_PUBLIC_MASTER_CONVEX_URL ||
        "https://majestic-fox-670.convex.cloud";

      try {
        const masterClient = new ConvexHttpClient(masterConvexUrl);
        const masterOrgId: any = await masterClient.mutation(
          "organizations:registerStoreForBridge" as any,
          {
            secret: provisioningSecret,
            name: targetName,
            slug,
            deploymentUrl,
            ownerClerkId: userId,
            country: country || undefined,
            state: state || undefined,
            city: city || undefined,
            phone: phone || undefined,
          }
        );

        if (masterOrgId && userId) {
          await masterClient.mutation("users:create" as any, {
            organizationId: masterOrgId,
            defaultClerkId: userId,
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            email: user?.primaryEmailAddress?.emailAddress || "",
            role: "owner",
            status: "active",
            secret: provisioningSecret,
          });
          console.log(`[Store Provisioning] Registered store and owner in Master POS (org: ${masterOrgId})`);
        }
      } catch (masterErr: any) {
        console.warn(
          "[Store Provisioning Warning] Master POS registration failed:",
          masterErr?.message || masterErr
        );
      }

      return NextResponse.json({
        success: true,
        deploymentUrl,
        deploymentName,
        slug,
        organizationId: storeOrgId,
        redirectUrl: `/?convexUrl=${encodeURIComponent(deploymentUrl)}`,
      });
    }

    // 2. Fallback if Management Token not configured: Initialize on current deployment
    const currentConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!currentConvexUrl) {
      return NextResponse.json(
        { error: "No Convex deployment URL configured." },
        { status: 500 }
      );
    }

    const storeClient = new ConvexHttpClient(currentConvexUrl);
    const timestamp = Date.now();
    const provisioningToken = await generateHmacSha256(
      provisioningSecret,
      `${slug}:${timestamp}`
    );

    const storeOrgId: any = await storeClient.mutation("organizations:create" as any, {
      name: targetName,
      slug,
      legalEntityName: organizationName || targetName,
      country: country || "US",
      state: state || "",
      city: city || "",
      phone: phone || "",
      ownerClerkId: userId,
      provisioningToken,
      timestamp,
    });

    await storeClient.mutation("organizations:saveOnboarding" as any, {
      id: storeOrgId,
      step: 4,
      completed: false,
      organizationName,
      restaurantName: targetName,
      businessType,
      locationsCount,
      addressLine1,
      suiteUnit,
      city,
      state,
      zipCode,
      country,
      phone,
      currency,
      language,
      organizationTimeZone,
      isDineIn: isDineIn ?? true,
      isTakeAway: isTakeAway ?? true,
      isDelivery: isDelivery ?? false,
      deliveryFleetType: deliveryFleetType ?? "blended",
      operatingHoursTemplate: operatingHoursTemplate ?? "standard",
      operationTiming,
    });

    try {
      await storeClient.mutation("organizationUsers:create" as any, {
        organizationId: storeOrgId,
        userId,
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        email: user?.primaryEmailAddress?.emailAddress || "",
        userType: ["admin", "cashier"],
        status: "active",
      });
    } catch (uErr) {
      console.warn("Owner user creation warning:", uErr);
    }

    // Register store and owner in Master POS so resolve-store finds it immediately
    const masterConvexUrl =
      process.env.MASTER_CONVEX_URL ||
      process.env.NEXT_PUBLIC_MASTER_CONVEX_URL ||
      "https://majestic-fox-670.convex.cloud";

    try {
      const masterClient = new ConvexHttpClient(masterConvexUrl);
      const masterOrgId: any = await masterClient.mutation(
        "organizations:registerStoreForBridge" as any,
        {
          secret: provisioningSecret,
          name: targetName,
          slug,
          deploymentUrl: currentConvexUrl,
          ownerClerkId: userId,
          country: country || undefined,
          state: state || undefined,
          city: city || undefined,
          phone: phone || undefined,
        }
      );

      if (masterOrgId && userId) {
        await masterClient.mutation("users:create" as any, {
          organizationId: masterOrgId,
          defaultClerkId: userId,
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          email: user?.primaryEmailAddress?.emailAddress || "",
          role: "owner",
          status: "active",
          secret: provisioningSecret,
        });
        console.log(`[Store Provisioning] Registered store and owner in Master POS (org: ${masterOrgId})`);
      }
    } catch (masterErr: any) {
      console.warn(
        "[Store Provisioning Warning] Master POS registration failed:",
        masterErr?.message || masterErr
      );
    }

    return NextResponse.json({
      success: true,
      deploymentUrl: currentConvexUrl,
      slug,
      organizationId: storeOrgId,
      redirectUrl: `/onboarding`,
    });
  } catch (error: any) {
    console.error("[Store Provisioning Route Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to provision new store deployment." },
      { status: 500 }
    );
  }
}

