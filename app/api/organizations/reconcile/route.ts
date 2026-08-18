import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function POST() {
  try {
    const managementToken = process.env.CONVEX_MANAGEMENT_API_KEY || process.env.CONVEX_MANAGEMENT_TOKEN;
    const teamId = process.env.CONVEX_TEAM_ID;
    const masterConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!managementToken || !teamId || !masterConvexUrl) {
      return NextResponse.json(
        { error: "Server configuration missing." },
        { status: 500 }
      );
    }

    const convexClient = new ConvexHttpClient(masterConvexUrl);

    // 1. Fetch active organizations from Master DB
    const activeOrgs: any[] = await convexClient.query(api.organizations.list);
    const activeProjectIds = new Set(
      activeOrgs
        .map((org: any) => org.projectId)
        .filter((id: any): id is string => Boolean(id))
    );

    // 2. Fetch all team projects via Management API
    const projectsRes = await fetch(
      `https://api.convex.dev/v1/teams/${teamId}/projects`,
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
        },
      }
    );

    if (!projectsRes.ok) {
      const errText = await projectsRes.text();
      return NextResponse.json(
        { error: `Failed to fetch team projects: ${errText}` },
        { status: projectsRes.status }
      );
    }

    const projects: Array<{ id: number | string; name: string; slug: string }> = await projectsRes.json();

    // Infrastructure projects to protect from reconciliation deletion
    const protectedProjects = new Set([
      "convex-master-app",
      "convex-company-todos",
      "pos-master-app",
      "pos-default-app",
    ]);

    const deletedProjects: string[] = [];

    // 3. Identify and delete orphaned store projects
    for (const project of projects) {
      const projIdStr = String(project.id);
      const projName = project.slug || project.name;

      if (protectedProjects.has(projName)) {
        continue;
      }

      if (!activeProjectIds.has(projIdStr)) {
        console.log(`Reconciling orphaned Convex project: ${projName} (ID: ${projIdStr})`);

        const deleteRes = await fetch(
          `https://api.convex.dev/v1/projects/${projIdStr}/delete`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${managementToken}`,
            },
          }
        );

        if (deleteRes.ok) {
          deletedProjects.push(projName);
        } else {
          console.error(`Failed to delete orphaned project ${projName}:`, await deleteRes.text());
        }
      }
    }

    return NextResponse.json({
      success: true,
      reconciledCount: deletedProjects.length,
      deletedProjects,
    });
  } catch (err: any) {
    console.error("Reconciliation error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during reconciliation." },
      { status: 500 }
    );
  }
}
