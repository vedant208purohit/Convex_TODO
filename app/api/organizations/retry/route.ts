import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { exec } from "child_process";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const { masterOrgId } = await req.json();

    if (!masterOrgId || typeof masterOrgId !== "string") {
      return NextResponse.json(
        { error: "masterOrgId is required." },
        { status: 400 }
      );
    }

    const managementToken =
      process.env.CONVEX_MANAGEMENT_API_KEY ||
      process.env.CONVEX_MANAGEMENT_TOKEN;
    const teamId = process.env.CONVEX_TEAM_ID;
    const masterConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!managementToken || !teamId || !masterConvexUrl) {
      return NextResponse.json(
        { error: "Server configuration missing." },
        { status: 500 }
      );
    }

    const masterClient = new ConvexHttpClient(masterConvexUrl);

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

    // Set status to provisioning during retry
    await masterClient.mutation(api.organizations.updateStatus, {
      id: org._id,
      status: "provisioning",
      errorMessage: undefined,
    });

    let projectId = org.projectId;
    let deploymentName = org.deploymentId;
    let deploymentUrl = org.deploymentUrl;

    // 1. Create project if missing
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
    }

    // 2. Generate deploy key
    const createKeyRes = await fetch(
      `https://api.convex.dev/v1/deployments/${deploymentName}/create_deploy_key`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `retry-key-${Date.now()}`,
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
      const errorMsg = keyData.message || "Failed to create deploy key during retry.";
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

    const deployKey = keyData.deployKey;

    // 3. Re-run CLI code deployment
    const defaultAppPath = process.env.DEFAULT_APP_PATH
      ? path.resolve(process.env.DEFAULT_APP_PATH)
      : path.resolve(process.cwd(), "../Default app");

    try {
      await execPromise("npx convex dev --once --typecheck=disable --tail-logs disable", {
        cwd: defaultAppPath,
        env: {
          ...process.env,
          CONVEX_DEPLOY_KEY: deployKey,
        },
      });
    } catch (deployErr: any) {
      const errorMsg = `POS Code deployment failed during retry: ${deployErr.stderr || deployErr.message}`;
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

    // 4. Connect store client & check if store organization exists
    const storeClient = new ConvexHttpClient(deploymentUrl);
    let storeOrgId: any;

    try {
      const existingStoreOrg: any = await storeClient.query(
        "organizations:getBySlug" as any,
        { slug: org.slug }
      );

      if (existingStoreOrg) {
        storeOrgId = existingStoreOrg._id;
      } else {
        storeOrgId = await storeClient.mutation("organizations:create" as any, {
          name: org.name,
          slug: org.slug,
          legacyId: org.legacyOrganizationId || undefined,
          ownerClerkId: org.ownerClerkId || undefined,
          published: false,
          isTest: false,
        });
      }
    } catch (createErr: any) {
      const errorMsg = `Store organization creation/verification failed during retry: ${createErr.message}`;
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

    // 5. Initialize store defaults (Idempotent)
    try {
      await storeClient.mutation("organizations:initializeStore" as any, {
        id: storeOrgId,
      });
    } catch (initErr: any) {
      const errorMsg = `Store organization initialization failed during retry: ${initErr.message}`;
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

    // 6. Mark active
    await masterClient.mutation(api.organizations.updateStatus, {
      id: org._id,
      status: "active",
      projectId,
      deploymentId: deploymentName,
      deploymentUrl,
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: org._id,
        name: org.name,
        slug: org.slug,
        projectId,
        deploymentId: deploymentName,
        deploymentUrl,
        status: "active",
      },
    });
  } catch (err: any) {
    console.error("Retry error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during retry." },
      { status: 500 }
    );
  }
}
