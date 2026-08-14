import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { exec } from "child_process";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const { name } = await req.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Company name is required." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    // Sanitize name to create project slug
    let slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) {
      slug = `company-${Date.now()}`;
    }

    const managementToken = process.env.CONVEX_MANAGEMENT_TOKEN;
    const teamId = process.env.CONVEX_TEAM_ID;
    const masterConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!managementToken || !teamId || !masterConvexUrl) {
      return NextResponse.json(
        { error: "Server configuration missing (Management token or Team ID)." },
        { status: 500 }
      );
    }

    const convexClient = new ConvexHttpClient(masterConvexUrl);

    // Check if company already exists
    const existing = await convexClient.query(api.companies.getBySlug, { slug });

    if (existing && existing.status === "active") {
      return NextResponse.json(
        { error: `Company "${trimmedName}" (slug: ${slug}) already exists and is active.` },
        { status: 409 }
      );
    }

    if (existing && existing.status === "provisioning") {
      return NextResponse.json(
        { error: `Company "${trimmedName}" is currently being provisioned.` },
        { status: 409 }
      );
    }

    // Record provisioning state in Master Convex DB
    const companyId = await convexClient.mutation(api.companies.create, {
      name: trimmedName,
      slug,
    });

    console.log(`Starting provisioning for company: ${trimmedName} (${slug})`);

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
      const errorMsg = projectData.message || `Failed to create Convex project (${createProjectRes.status}).`;
      await convexClient.mutation(api.companies.updateStatus, {
        id: companyId,
        status: "failed",
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    const projectId = String(projectData.id || projectData.projectId);
    const deploymentName = projectData.deploymentName;
    const deploymentUrl = projectData.deploymentUrl;

    if (!deploymentName) {
      const errorMsg = "Convex project created, but no deployment was returned.";
      await convexClient.mutation(api.companies.updateStatus, {
        id: companyId,
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
      await convexClient.mutation(api.companies.updateStatus, {
        id: companyId,
        status: "failed",
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    const deployKey = keyData.deployKey;

    // Step 3: Deploy Default App schema and functions to the new company deployment
    const defaultAppPath = path.resolve(process.cwd(), "../Default app");

    console.log(`Deploying Default app code to ${deploymentName} at path: ${defaultAppPath}`);

    try {
      await execPromise("npx convex dev --once --tail-logs disable", {
        cwd: defaultAppPath,
        env: {
          ...process.env,
          CONVEX_DEPLOY_KEY: deployKey,
        },
      });
    } catch (deployErr: any) {
      const errorMsg = `Code deployment failed: ${deployErr.stderr || deployErr.message}`;
      console.error(errorMsg);
      await convexClient.mutation(api.companies.updateStatus, {
        id: companyId,
        status: "failed",
        errorMessage: errorMsg,
      });
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    // Step 4: Mark company active in Master App database
    await convexClient.mutation(api.companies.updateStatus, {
      id: companyId,
      status: "active",
      projectId,
      deploymentId: deploymentName,
      deploymentUrl,
    });

    console.log(`Successfully provisioned company: ${trimmedName}`);

    return NextResponse.json({
      success: true,
      company: {
        id: companyId,
        name: trimmedName,
        slug,
        projectId,
        deploymentId: deploymentName,
        deploymentUrl,
        status: "active",
      },
    });
  } catch (err: any) {
    console.error("Provisioning error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during company provisioning." },
      { status: 500 }
    );
  }
}
