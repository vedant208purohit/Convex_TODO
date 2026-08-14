import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const PROTECTED_SLUGS = new Set([
  "convex-master-app",
  "convex-company-todos",
  "restaurant-practice",
]);

export async function GET() {
  return await handleReconciliation();
}

export async function POST() {
  return await handleReconciliation();
}

async function handleReconciliation() {
  try {
    const managementToken = process.env.CONVEX_MANAGEMENT_TOKEN;
    const teamId = process.env.CONVEX_TEAM_ID;
    const masterConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!managementToken || !teamId || !masterConvexUrl) {
      return NextResponse.json(
        { error: "Server configuration missing (Management token, Team ID, or Convex URL)." },
        { status: 500 }
      );
    }

    const convexClient = new ConvexHttpClient(masterConvexUrl);

    // 1. Retrieve all active company records from Master Convex DB
    const companies = await convexClient.query(api.companies.list);

    // Collect active project IDs and slugs currently stored in Master DB
    const activeProjectIds = new Set<string>();
    const activeSlugs = new Set<string>();

    companies.forEach((comp) => {
      if (comp.projectId) {
        activeProjectIds.add(String(comp.projectId));
      }
      if (comp.slug) {
        activeSlugs.add(comp.slug);
      }
    });

    console.log(`[RECONCILIATION] Active Master DB Project IDs:`, Array.from(activeProjectIds));

    // 2. Fetch all team projects from Convex Management API
    const projectsRes = await fetch(
      `https://api.convex.dev/v1/teams/${teamId}/projects`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${managementToken}`,
        },
      }
    );

    if (!projectsRes.ok) {
      const errorText = await projectsRes.text();
      console.error(`[RECONCILIATION FAILED] Could not fetch team projects: ${errorText}`);
      return NextResponse.json(
        { error: `Management API error fetching projects: ${errorText}` },
        { status: 500 }
      );
    }

    const projectsData = await projectsRes.json();
    const teamProjects: Array<{ id: number | string; slug: string; name: string }> =
      projectsData.items || [];

    // 3. Filter for orphaned company projects
    const deletedProjects: Array<{ id: string; slug: string; name: string }> = [];

    for (const proj of teamProjects) {
      const projIdStr = String(proj.id);
      const slug = proj.slug;

      // Never touch protected infrastructure projects
      if (PROTECTED_SLUGS.has(slug)) {
        continue;
      }

      // If the project ID/slug is NOT present in Master DB active companies, it is ORPHANED!
      const isOrphaned = !activeProjectIds.has(projIdStr) && !activeSlugs.has(slug);

      if (isOrphaned) {
        console.log(`[RECONCILIATION] Detected orphaned project: "${proj.name}" (ID: ${projIdStr}, Slug: ${slug}). Deleting...`);

        // Delete orphaned project via Convex Management API
        const deleteRes = await fetch(
          `https://api.convex.dev/v1/projects/${projIdStr}/delete`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${managementToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (deleteRes.ok || deleteRes.status === 404) {
          console.log(`[RECONCILIATION CLEANUP SUCCESS] Successfully deleted orphaned project "${slug}" (ID: ${projIdStr}).`);
          deletedProjects.push({ id: projIdStr, slug, name: proj.name });
        } else {
          const errText = await deleteRes.text();
          console.error(`[RECONCILIATION CLEANUP FAILED] Could not delete project ${projIdStr}: ${errText}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      cleanedCount: deletedProjects.length,
      deletedProjects,
    });
  } catch (err: any) {
    console.error("[RECONCILIATION ERROR]:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during reconciliation." },
      { status: 500 }
    );
  }
}
