import { NextRequest, NextResponse } from "next/server";
import { auth, createClerkClient } from "@clerk/nextjs/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Extracts userId from either Clerk cookie session (web) or Bearer token (mobile)
async function resolveUserId(request: NextRequest): Promise<string | null> {
  const { userId } = await auth();
  if (userId) return userId;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const payload = await clerk.verifyToken(token);
    return payload.sub || null;
  } catch {
    return null;
  }
}

async function resolveStoreForAuthenticatedUser(request: NextRequest) {
  const userId = await resolveUserId(request);

  console.log("Bridge secret:", process.env.BRIDGE_SECRET);

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: No active Default Clerk session.",
        code: "UNAUTHORIZED",
      },
      { status: 401 },
    );
  }

  const bridgeSecret = process.env.BRIDGE_SECRET;

  const masterBaseUrl =
    process.env.MASTER_POS_URL ||
    process.env.NEXT_PUBLIC_MASTER_POS_URL ||
    "http://localhost:3001";

  let safeMasterHost = "unknown";
  try {
    safeMasterHost = new URL(masterBaseUrl).host;
  } catch {
    safeMasterHost = "invalid-url";
  }

  let safeConvexHost = "none";
  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    try {
      safeConvexHost = new URL(process.env.NEXT_PUBLIC_CONVEX_URL).host;
    } catch {
      safeConvexHost = "invalid-url";
    }
  }

  console.log("[BRIDGE_DEBUG] resolve-store started");
  console.log("[BRIDGE_DEBUG] runtime:", {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
  });
  console.log("[BRIDGE_DEBUG] configuration:", {
    MASTER_POS_URL_PRESENT: Boolean(process.env.MASTER_POS_URL),
    MASTER_POS_URL_HOST: safeMasterHost,
    BRIDGE_SECRET_PRESENT: Boolean(bridgeSecret),
    NEXT_PUBLIC_CONVEX_URL_PRESENT: Boolean(process.env.NEXT_PUBLIC_CONVEX_URL),
    NEXT_PUBLIC_CONVEX_URL_HOST: safeConvexHost,
  });

  if (!bridgeSecret) {
    console.error("BRIDGE_SECRET is not configured on Default POS server.");
    return NextResponse.json(
      {
        success: false,
        error: "Server configuration error: Missing BRIDGE_SECRET.",
        code: "BRIDGE_MISCONFIGURED",
      },
      { status: 500 },
    );
  }

  const bridgeUrl = `${masterBaseUrl.replace(/\/$/, "")}/api/bridge/resolve-store`;
  const timestamp = Date.now();
  const signature = crypto
    .createHmac("sha256", bridgeSecret)
    .update(`${userId}:${timestamp}`)
    .digest("hex");

  console.log("[BRIDGE_DEBUG] calling master bridge:", {
    url: bridgeUrl,
    method: "POST",
    headers: ["Content-Type", "x-bridge-signature", "x-bridge-timestamp"],
    payload: {
      defaultClerkId_present: Boolean(userId),
      defaultClerkId_prefix: userId ? userId.substring(0, 8) + "..." : "none",
    },
  });

  try {
    const res = await fetch(bridgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-signature": signature,
        "x-bridge-timestamp": timestamp.toString(),
      },
      body: JSON.stringify({ defaultClerkId: userId }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    console.log("[BRIDGE_DEBUG] master bridge response:", {
      status: res.status,
      ok: res.ok,
      contentType: res.headers?.get
        ? res.headers.get("content-type")
        : undefined,
      errorCode: data?.code,
      errorMsg: data?.error,
      hasDeploymentUrl: Boolean(data?.deployment?.url || data?.deploymentUrl),
    });

    if (!res.ok || !data.success) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || "Store resolution failed.",
          code: data.code || "STORE_RESOLUTION_FAILED",
        },
        { status: res.status || 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        organization: data.organization,
        deploymentUrl: data.deployment?.url || data.deploymentUrl,
        user: data.user,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Failed to connect to Master bridge:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Unable to reach Master control plane to resolve store deployment.",
        code: "BRIDGE_UNREACHABLE",
      },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  return resolveStoreForAuthenticatedUser(request);
}

export async function POST(request: NextRequest) {
  return resolveStoreForAuthenticatedUser(request);
}
