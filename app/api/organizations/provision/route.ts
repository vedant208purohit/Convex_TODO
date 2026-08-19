import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { exec } from "child_process";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const {
      name,
      slug: providedSlug,
      legacyOrganizationId,
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
    // Derive a unique project slug
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

    const convexClient = new ConvexHttpClient(masterConvexUrl);

    // 1. Check if organization already exists in Master DB by legacyOrganizationId
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
            projectId: existingByLegacy.projectId,
            deploymentId: existingByLegacy.deploymentId,
            deploymentUrl: existingByLegacy.deploymentUrl,
            status: "active",
          },
          message: "Existing active store project found.",
        });
      }
    }

    // 2. Check if organization already exists in Master DB by slug
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

    // Ensure slug uniqueness if collision with a non-legacy project
    if (
      existingBySlug &&
      legacyOrganizationId &&
      existingBySlug.legacyOrganizationId !== legacyOrganizationId
    ) {
      slug = `${slug}-${legacyOrganizationId.substring(0, 8)}`;
    }

    // Record provisioning state in Master DB
    const orgId = await convexClient.mutation(api.organizations.create, {
      name: trimmedName,
      slug,
      legacyOrganizationId: legacyOrganizationId || undefined,
    });

    console.log(
      `Starting provisioning for store organization: ${trimmedName} (slug: ${slug}, legacyId: ${legacyOrganizationId || "none"})`
    );

    // Step 1: Create project & deployment in Convex via Management API
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

    // Step 2: Create Deploy Key for deployment
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

    // Step 3: Deploy Default App schema and functions to the new store deployment
    const defaultAppPath = process.env.DEFAULT_APP_PATH
      ? path.resolve(process.env.DEFAULT_APP_PATH)
      : path.resolve(process.cwd(), "../Default app");

    console.log(
      `Deploying Default POS app code to ${deploymentName} at path: ${defaultAppPath}`
    );

    try {
      await execPromise("npx convex dev --once --tail-logs disable", {
        cwd: defaultAppPath,
        env: {
          ...process.env,
          CONVEX_DEPLOY_KEY: deployKey,
        },
      });
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

    // Step 4: Create Default App Organization in store database
    const storeClient = new ConvexHttpClient(deploymentUrl);
    let storeOrgId: any;

    try {
      storeOrgId = await storeClient.mutation("organizations:create" as any, {
        name: trimmedName,
        slug: slug,
        legacyId: legacyOrganizationId || undefined,
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

    // Step 5: Initialize store defaults (order processes, station, payment modes, categories, operating hours)
    try {
      await storeClient.mutation("organizations:initializeStore" as any, {
        id: storeOrgId,
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

    // Step 6: Mark store organization active in Master DB only after initialization succeeds
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
