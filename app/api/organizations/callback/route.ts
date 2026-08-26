import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const provisioningSecret =
      process.env.PROVISIONING_SECRET || "defx-pos-provisioning-secret-dev";

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (token !== provisioningSecret) {
      return NextResponse.json({ error: "Invalid callback token." }, { status: 403 });
    }

    const {
      masterOrgId,
      status,
      projectId,
      deploymentId,
      deploymentUrl,
      errorMessage,
    } = await req.json();

    if (!masterOrgId || !status) {
      return NextResponse.json(
        { error: "masterOrgId and status are required." },
        { status: 400 }
      );
    }

    const masterConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!masterConvexUrl) {
      return NextResponse.json(
        { error: "Server configuration missing (NEXT_PUBLIC_CONVEX_URL)." },
        { status: 500 }
      );
    }

    const masterClient = new ConvexHttpClient(masterConvexUrl);
    await masterClient.mutation(api.organizations.updateStatusFromCallback, {
      id: masterOrgId,
      status,
      projectId: projectId || undefined,
      deploymentId: deploymentId || undefined,
      deploymentUrl: deploymentUrl || undefined,
      errorMessage: errorMessage || undefined,
      secret: provisioningSecret,
    });

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    console.error("Callback error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during callback handling." },
      { status: 500 }
    );
  }
}
