import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { exec, spawn } from "child_process";
import path from "path";
import fs from "fs";
import util from "util";

const execPromise = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const { name, slug: providedSlug, legacyOrganizationId } = await req.json();

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

    const managementToken = process.env.CONVEX_MANAGEMENT_API_KEY || process.env.CONVEX_MANAGEMENT_TOKEN;
    const teamId = process.env.CONVEX_TEAM_ID;
    const masterConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!managementToken || !teamId || !masterConvexUrl) {
      return NextResponse.json(
        { error: "Server configuration missing (CONVEX_MANAGEMENT_API_KEY, CONVEX_TEAM_ID, or NEXT_PUBLIC_CONVEX_URL)." },
        { status: 500 }
      );
    }

    const convexClient = new ConvexHttpClient(masterConvexUrl);

    // 1. Check if organization already exists in Master DB by legacyOrganizationId
    if (legacyOrganizationId) {
      const existingByLegacy: any = await convexClient.query(api.organizations.getByLegacyOrganizationId, {
        legacyOrganizationId,
      });

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
    const existingBySlug: any = await convexClient.query(api.organizations.getBySlug, { slug });

    if (existingBySlug && existingBySlug.status === "active") {
      // If legacy ID matches or no legacy ID, return active store
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
    if (existingBySlug && legacyOrganizationId && existingBySlug.legacyOrganizationId !== legacyOrganizationId) {
      slug = `${slug}-${legacyOrganizationId.substring(0, 8)}`;
    }

    // Record provisioning state in Master DB
    const orgId = await convexClient.mutation(api.organizations.create, {
      name: trimmedName,
      slug,
      legacyOrganizationId: legacyOrganizationId || undefined,
    });

    console.log(`Starting provisioning for store organization: ${trimmedName} (slug: ${slug}, legacyId: ${legacyOrganizationId || "none"})`);

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

    if (!deploymentName) {
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

    console.log(`Deploying Default POS app code to ${deploymentName} at path: ${defaultAppPath}`);

    try {
      console.log("=== DIAGNOSTIC LOGS FOR PROVISION ROUTE ===");
      console.log("process.platform:", process.platform);
      console.log("process.execPath:", process.execPath);
      console.log("process.cwd():", process.cwd());
      console.log("process.env.PATH:", process.env.PATH);
      console.log("process.env.Path:", process.env.Path);
      console.log("process.env.ComSpec:", process.env.ComSpec);
      console.log("process.env.COMSPEC:", process.env.COMSPEC);
      console.log("process.env.SystemRoot:", process.env.SystemRoot);
      console.log("process.env.WINDIR:", process.env.WINDIR);
      console.log("fs.existsSync(C:\\Windows\\System32\\cmd.exe):", fs.existsSync("C:\\Windows\\System32\\cmd.exe"));
      console.log("fs.existsSync(ComSpec):", fs.existsSync(process.env.ComSpec || ""));
      console.log("fs.existsSync(COMSPEC):", fs.existsSync(process.env.COMSPEC || ""));

      const nodeDir = path.dirname(process.execPath);
      const currentPath = process.env.PATH || process.env.Path || "";
      const pathEnv = [nodeDir, currentPath].filter(Boolean).join(path.delimiter);
      const systemRoot = process.env.SystemRoot || process.env.systemroot || "C:\\Windows";
      const comspec = process.env.ComSpec || process.env.COMSPEC || `${systemRoot}\\System32\\cmd.exe`;

      const env = {
        ...process.env,
        PATH: pathEnv,
        Path: pathEnv,
        SystemRoot: systemRoot,
        WINDIR: systemRoot,
        ComSpec: comspec,
        COMSPEC: comspec,
        CONVEX_DEPLOY_KEY: deployKey,
      };

      const candidates = [
        path.resolve(defaultAppPath, "node_modules", "convex", "bin", "main.js"),
        path.resolve(process.cwd(), "node_modules", "convex", "bin", "main.js"),
      ];
      const convexBinPath = candidates.find((p) => fs.existsSync(p));

      if (convexBinPath) {
        console.log("Executing Convex CLI directly using Node:", convexBinPath);
        await new Promise<void>((resolve, reject) => {
          const child = spawn(process.execPath, [convexBinPath, "dev", "--once", "--tail-logs", "disable"], {
            cwd: defaultAppPath,
            env,
            shell: false,
          });

          let stderr = "";
          let stdout = "";

          child.stdout?.on("data", (chunk: any) => {
            stdout += chunk.toString();
          });

          child.stderr?.on("data", (chunk: any) => {
            stderr += chunk.toString();
          });

          child.on("error", (err: any) => reject(err));

          child.on("close", (code: number | null) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(stderr || stdout || `Convex CLI exited with code ${code}`));
            }
          });
        });
      } else {
        const npxBinary = process.platform === "win32" ? "npx.cmd" : "npx";
        const npxPath = path.join(nodeDir, npxBinary);
        const npxCmd = fs.existsSync(npxPath) ? `"${npxPath}"` : npxBinary;

        await execPromise(`${npxCmd} convex dev --once --tail-logs disable`, {
          cwd: defaultAppPath,
          shell: comspec,
          env,
        });
      }
    } catch (deployErr: any) {
  const errorMsg = `POS Code deployment failed: ${deployErr.stderr || deployErr.message}`;
  console.error(errorMsg);
  await convexClient.mutation(api.organizations.updateStatus, {
    id: orgId,
    status: "failed",
    errorMessage: errorMsg,
  });
  return NextResponse.json({ error: errorMsg }, { status: 500 });
}

    // Step 4: Mark store organization active in Master DB
    await convexClient.mutation(api.organizations.updateStatus, {
      id: orgId,
      status: "active",
      projectId,
      deploymentId: deploymentName,
      deploymentUrl,
    });

    console.log(`Successfully provisioned store organization: ${trimmedName} (${deploymentUrl})`);

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
        status: "active",
      },
    });
  } catch (err: any) {
    console.error("Provisioning error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during organization provisioning." },
      { status: 500 }
    );
  }
}
