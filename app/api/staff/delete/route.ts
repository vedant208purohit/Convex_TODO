import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    // 1. Authenticate caller session via Clerk
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: You must be logged in to manage employees.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // 2. Parse request body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request body.",
          code: "BAD_REQUEST",
        },
        { status: 400 }
      );
    }

    const { id, defaultClerkId, email } = body || {};

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Employee membership ID is required.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    // 3. Connect to Store Convex & Verify Admin Rights
    let storeConvexUrl =
      process.env.NEXT_PUBLIC_CONVEX_URL ||
      process.env.CONVEX_URL ||
      "https://test-store.convex.cloud";

    const bridgeSecret = process.env.BRIDGE_SECRET;
    const masterBaseUrl =
      process.env.MASTER_POS_URL ||
      process.env.NEXT_PUBLIC_MASTER_POS_URL ||
      "http://localhost:3001";

    if (bridgeSecret) {
      try {
        const resolveTimestamp = Date.now();
        const resolveSignature = crypto
          .createHmac("sha256", bridgeSecret)
          .update(`${userId}:${resolveTimestamp}`)
          .digest("hex");

        const resolveRes = await fetch(
          `${masterBaseUrl.replace(/\/$/, "")}/api/bridge/resolve-store`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-bridge-signature": resolveSignature,
              "x-bridge-timestamp": resolveTimestamp.toString(),
            },
            body: JSON.stringify({ defaultClerkId: userId }),
            cache: "no-store",
          }
        );

        const resolveData = await resolveRes.json().catch(() => ({}));
        if (resolveRes.ok && resolveData.success) {
          const resolvedUrl =
            resolveData.deployment?.url || resolveData.deploymentUrl;
          if (resolvedUrl && typeof resolvedUrl === "string" && resolvedUrl.trim()) {
            storeConvexUrl = resolvedUrl.trim();
          }
        }
      } catch (resolveErr) {
        // Fallback to storeConvexUrl
      }
    }

    const storeConvexClient = new ConvexHttpClient(storeConvexUrl);

    let token: string | null = null;
    try {
      token = await getToken({ template: "convex" });
    } catch {
      try {
        token = await getToken();
      } catch {
        token = null;
      }
    }
    if (token) {
      storeConvexClient.setAuth(token);
    }

    let userEmail: string | undefined;
    try {
      const clerkUser = await currentUser();
      userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;
    } catch {
      userEmail = undefined;
    }

    let adminContext: {
      organizationId: string;
      slug: string;
      name?: string;
      callerUserId: string;
      callerRoles: string[];
    } | null = null;

    try {
      adminContext = await storeConvexClient.query(
        api.organizationUsers.getStoreAdminContext,
        {
          userId,
          email: userEmail,
        }
      );
    } catch (authErr: any) {
      const errMessage = authErr?.message || "";
      const isForbidden =
        errMessage.includes("Forbidden") ||
        errMessage.includes("Admin access required") ||
        errMessage.includes("Active store membership required");

      if (isForbidden) {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden: You do not have permission to delete employees for this store.",
            code: "FORBIDDEN",
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Store backend service error during authorization check.",
          code: "STORE_AUTH_FAILED",
        },
        { status: 500 }
      );
    }

    if (!adminContext || !adminContext.slug) {
      return NextResponse.json(
        {
          success: false,
          error: "Store organization context could not be resolved.",
          code: "STORE_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // 4. Soft-delete employee from Store Convex
    try {
      await storeConvexClient.mutation(api.organizationUsers.remove, {
        id: id as any,
      });
    } catch (removeErr: any) {
      console.error("[Store Employee Remove Error]", removeErr);
      return NextResponse.json(
        {
          success: false,
          error: removeErr?.message || "Failed to remove employee in store database.",
          code: "STORE_REMOVE_FAILED",
        },
        { status: 500 }
      );
    }

    // 5. Forward deprovisioning to Master bridge if BRIDGE_SECRET is configured
    if (bridgeSecret) {
      const bridgeUrl = `${masterBaseUrl.replace(/\/$/, "")}/api/bridge/staff/delete`;
      const timestamp = Date.now();
      const signature = crypto
        .createHmac("sha256", bridgeSecret)
        .update(`${adminContext.slug}:${timestamp}`)
        .digest("hex");

      try {
        const bridgeRes = await fetch(bridgeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-bridge-signature": signature,
            "x-bridge-timestamp": timestamp.toString(),
          },
          body: JSON.stringify({
            slug: adminContext.slug,
            organizationId: adminContext.organizationId,
            defaultClerkId: defaultClerkId?.trim(),
            email: email?.trim(),
          }),
          cache: "no-store",
        });

        if (!bridgeRes.ok) {
          console.warn("[Master Bridge Staff Delete Warn] Status:", bridgeRes.status);
        }
      } catch (bridgeErr) {
        console.warn("[Master Bridge Staff Delete Error]", bridgeErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Employee removed successfully.",
    });
  } catch (error: any) {
    console.error("Store staff deletion route error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error deleting employee.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
