import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { validateServerProvisioningConfig } from "@/lib/provisioningConfig";
import { triggerStoreDeployment } from "@/lib/deployment-trigger";

export async function POST(req: Request) {
  try {
    // 1. Validate required server environment variables upfront before processing
    const configValidation = validateServerProvisioningConfig();
    if (!configValidation.valid || !configValidation.config) {
      return NextResponse.json(
        {
          error: "Server configuration missing.",
          missing: configValidation.missing,
        },
        { status: 500 }
      );
    }

    const {
      managementToken,
      teamId,
      masterConvexUrl,
    } = configValidation.config;

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

    // 2. Authenticate Master request via Clerk
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

    // 3. Resolve ownerClerkId securely
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

    // 4. Check existing organization in Master DB
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
          status: "active",
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
        status: "active",
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

    if (
      existingBySlug &&
      (existingBySlug.status === "provisioning" || existingBySlug.status === "deploying")
    ) {
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

    // 5. Create/update Master organization record
    const orgId = await convexClient.mutation(api.organizations.create, {
      name: trimmedName,
      slug,
      legacyOrganizationId: legacyOrganizationId || undefined,
      ownerClerkId: ownerClerkId || undefined,
    });

    console.log(
      `[Provision Route] Starting asynchronous provisioning for orgId: ${orgId} (name: "${trimmedName}", slug: "${slug}")`
    );

    // 6. Create Convex project via Management API
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
      console.error(`[Provision Project Error] orgId: ${orgId}, error: ${errorMsg}`);
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
      console.error(`[Provision Metadata Error] orgId: ${orgId}, error: ${errorMsg}`);
      await convexClient.mutation(api.organizations.updateStatus, {
        id: orgId,
        status: "failed",
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // 7. Record metadata on Master organization
    await convexClient.mutation(api.organizations.updateStatus, {
      id: orgId,
      status: "provisioning",
      projectId,
      deploymentId: deploymentName,
      deploymentUrl,
    });

    // 8. Dispatch asynchronous deployment job (GitHub Actions / runner)
    try {
      await triggerStoreDeployment({
        masterOrgId: orgId,
        name: trimmedName,
        slug,
        legacyOrganizationId: legacyOrganizationId || undefined,
        ownerClerkId: ownerClerkId || undefined,
        projectId,
        deploymentId: deploymentName,
        deploymentUrl,
        phone,
        addressLine1,
        city,
        state,
        country,
        zipCode,
        latitude,
        longitude,
      });
    } catch (dispatchErr: any) {
      const errorMsg = `Deployment trigger failed: ${dispatchErr.message || "Unknown trigger error"}`;
      console.error(`[Provision Dispatch Exception] orgId: ${orgId}, error: ${errorMsg}`);
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

    // 9. Return immediate asynchronous provisioning response
    return NextResponse.json(
      {
        success: true,
        status: "provisioning",
        organization: {
          id: orgId,
          name: trimmedName,
          slug,
          legacyOrganizationId,
          projectId,
          deploymentId: deploymentName,
          deploymentUrl,
          status: "provisioning",
        },
        message: "Store provisioning started.",
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("[Provision Route Error]", err);
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
