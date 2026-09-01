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

    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const { masterOrgId } = await req.json();

    if (!masterOrgId || typeof masterOrgId !== "string") {
      return NextResponse.json(
        { error: "masterOrgId is required." },
        { status: 400 }
      );
    }

    const masterClient = new ConvexHttpClient(masterConvexUrl);
    const token = await getToken({ template: "convex" });
    if (token) {
      masterClient.setAuth(token);
    }

    const org: any = await masterClient.query(api.organizations.get, {
      id: masterOrgId as any,
    });

    if (!org) {
      return NextResponse.json(
        { error: "Master organization record not found." },
        { status: 404 }
      );
    }

    if (org.status !== "failed") {
      return NextResponse.json(
        { error: `Retry is only permitted for failed organizations (current status: ${org.status}).` },
        { status: 400 }
      );
    }

    console.log(
      `[Retry Route] Starting retry for masterOrgId: ${masterOrgId} (name: "${org.name}", slug: "${org.slug}")`
    );

    // Set status to provisioning during retry
    await masterClient.mutation(api.organizations.updateStatus, {
      id: org._id,
      status: "provisioning",
      errorMessage: undefined,
    });

    let projectId = org.projectId;
    let deploymentName = org.deploymentId;
    let deploymentUrl = org.deploymentUrl;

    // 2. Create project ONLY if metadata is missing (never duplicate an existing project)
    if (!projectId || !deploymentName || !deploymentUrl) {
      const createProjectRes = await fetch(
        `https://api.convex.dev/v1/teams/${teamId}/create_project`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${managementToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectName: org.slug,
            deploymentType: "dev",
          }),
        }
      );

      const projectData = await createProjectRes.json();

      if (!createProjectRes.ok) {
        const errorMsg =
          projectData.message ||
          `Failed to create Convex project during retry (${createProjectRes.status}).`;
        console.error(`[Retry Project Error] masterOrgId: ${org._id}, error: ${errorMsg}`);
        await masterClient.mutation(api.organizations.updateStatus, {
          id: org._id,
          status: "failed",
          errorMessage: errorMsg,
        });
        return NextResponse.json({ error: errorMsg }, { status: 500 });
      }

      projectId = String(projectData.id || projectData.projectId);
      deploymentName = projectData.deploymentName;
      deploymentUrl = projectData.deploymentUrl;

      await masterClient.mutation(api.organizations.updateStatus, {
        id: org._id,
        status: "provisioning",
        projectId,
        deploymentId: deploymentName,
        deploymentUrl,
      });
    }

    // 3. Dispatch asynchronous deployment job
    try {
      await triggerStoreDeployment({
        masterOrgId: org._id,
        name: org.name,
        slug: org.slug,
        legacyOrganizationId: org.legacyOrganizationId || undefined,
        ownerClerkId: org.ownerClerkId || undefined,
        projectId,
        deploymentId: deploymentName,
        deploymentUrl,
      });
    } catch (dispatchErr: any) {
      const errorMsg = `Retry deployment trigger failed: ${dispatchErr.message || "Unknown trigger error"}`;
      console.error(`[Retry Dispatch Exception] masterOrgId: ${org._id}, error: ${errorMsg}`);
      await masterClient.mutation(api.organizations.updateStatus, {
        id: org._id,
        status: "failed",
        projectId,
        deploymentId: deploymentName,
        deploymentUrl,
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        status: "provisioning",
        organization: {
          id: org._id,
          name: org.name,
          slug: org.slug,
          projectId,
          deploymentId: deploymentName,
          deploymentUrl,
          status: "provisioning",
        },
        message: "Store retry provisioning started.",
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("[Retry Route Error]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during retry." },
      { status: 500 }
    );
  }
}
