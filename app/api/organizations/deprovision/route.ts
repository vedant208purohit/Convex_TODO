import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

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
    const masterConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!managementToken || !masterConvexUrl) {
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

    if (org.status === "deleted") {
      return NextResponse.json(
        { error: "Organization is already deleted." },
        { status: 400 }
      );
    }

    // Set status to deleting
    await masterClient.mutation(api.organizations.updateStatus, {
      id: org._id,
      status: "deleting",
    });

    // Execute project destruction via Convex Management API if projectId exists
    if (org.projectId) {
      const deleteRes = await fetch(
        `https://api.convex.dev/v1/projects/${org.projectId}/delete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${managementToken}`,
          },
        }
      );

      if (!deleteRes.ok) {
        const errorText = await deleteRes.text();
        const errorMsg = `Failed to delete Convex project (${deleteRes.status}): ${errorText}`;
        console.error(errorMsg);

        // Preserve Master record, record failure status
        await masterClient.mutation(api.organizations.updateStatus, {
          id: org._id,
          status: "failed",
          errorMessage: errorMsg,
        });

        return NextResponse.json({ error: errorMsg }, { status: 500 });
      }
    }

    // Soft delete master organization record on successful deprovisioning
    await masterClient.mutation(api.organizations.softDelete, {
      id: org._id,
    });

    return NextResponse.json({
      success: true,
      message: `Organization "${org.name}" successfully deprovisioned and soft-deleted.`,
    });
  } catch (err: any) {
    console.error("Deprovision error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during deprovisioning." },
      { status: 500 }
    );
  }
}
