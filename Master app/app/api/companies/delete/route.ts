import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Company ID is required." },
        { status: 400 }
      );
    }

    const managementToken = process.env.CONVEX_MANAGEMENT_TOKEN;
    const masterConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!managementToken || !masterConvexUrl) {
      return NextResponse.json(
        { error: "Server configuration missing (Management token or Convex URL)." },
        { status: 500 }
      );
    }

    const convexClient = new ConvexHttpClient(masterConvexUrl);

    // Retrieve company record from Master Convex DB
    const company = await convexClient.query(api.companies.get, { id: id as any });

    if (!company) {
      return NextResponse.json(
        { error: "Company record not found." },
        { status: 404 }
      );
    }

    console.log(`[DELETE INITIATED] Company: "${company.name}" (ID: ${id}, ProjectID: ${company.projectId || "none"}, Status: ${company.status})`);

    // Edge Case 5: Prevent deletion while company is provisioning
    if (company.status === "provisioning") {
      return NextResponse.json(
        { error: "Company is currently being provisioned. Please wait until provisioning completes before deleting." },
        { status: 400 }
      );
    }

    // Edge Case 6: Prevent concurrent duplicate deletion requests
    if (company.status === "deleting") {
      return NextResponse.json(
        { error: "Company deletion is already in progress." },
        { status: 409 }
      );
    }

    // Mark company as 'deleting' in Master DB to lock duplicate requests
    await convexClient.mutation(api.companies.updateStatus, {
      id: company._id,
      status: "deleting",
    });

    // Edge Case 1: Company has no projectId (e.g. failed during early project creation)
    if (!company.projectId) {
      console.log(`[DELETE] Company "${company.name}" has no projectId. Removing Master DB record directly.`);
      await convexClient.mutation(api.companies.remove, { id: company._id });
      return NextResponse.json({
        success: true,
        message: `Company "${company.name}" record deleted (no Convex project existed).`,
      });
    }

    // Step 1: Call Convex Management API to delete the project and all its deployments
    console.log(`[DELETE API REQUEST] Calling Convex Management API to delete project ${company.projectId} for company "${company.name}"...`);

    const deleteProjectRes = await fetch(
      `https://api.convex.dev/v1/projects/${company.projectId}/delete`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const resStatus = deleteProjectRes.status;
    let resData: any = {};
    try {
      const text = await deleteProjectRes.text();
      if (text) resData = JSON.parse(text);
    } catch (_) {
      // Empty response body on 200 OK is expected
    }

    console.log(`[DELETE API RESPONSE] Status: ${resStatus}, Data:`, resData);

    // Edge Case 2: Project was already deleted manually from Convex Dashboard (404 Not Found)
    if (resStatus === 404 || resData.code === "ProjectNotFound") {
      console.log(`[DELETE] Convex project ${company.projectId} was already removed. Cleaning up Master DB record.`);
      await convexClient.mutation(api.companies.remove, { id: company._id });
      return NextResponse.json({
        success: true,
        message: `Company "${company.name}" deleted. (Convex project was already removed).`,
      });
    }

    // Edge Cases 3 & 4: Management API error or network failure
    if (!deleteProjectRes.ok) {
      const errorMsg = resData.message || resData.error || `Management API returned HTTP ${resStatus}`;
      console.error(`[DELETE FAILED] Could not delete Convex project ${company.projectId}: ${errorMsg}`);

      // DO NOT delete Master DB record! Revert status to failed so user can retry.
      await convexClient.mutation(api.companies.updateStatus, {
        id: company._id,
        status: "failed",
        errorMessage: `Deletion failed: ${errorMsg}`,
      });

      return NextResponse.json(
        { error: `Unable to delete Convex project: ${errorMsg}. Master database record retained safely.` },
        { status: 500 }
      );
    }

    // Step 2: External project deletion succeeded -> Delete Master DB record
    console.log(`[DELETE SUCCESS] Convex project ${company.projectId} deleted. Now removing Master DB record...`);
    await convexClient.mutation(api.companies.remove, { id: company._id });
    console.log(`[DELETE COMPLETE] Company "${company.name}" completely removed from system.`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted company "${company.name}" and its Convex project ${company.projectId}.`,
    });
  } catch (err: any) {
    console.error("[DELETE ERROR] Unexpected server error during company deletion:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during company deletion." },
      { status: 500 }
    );
  }
}
