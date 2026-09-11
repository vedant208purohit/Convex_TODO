import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";

export async function resolveStoreForAuthenticatedUser() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: No active Default Clerk session.",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  const bridgeSecret =
    process.env.BRIDGE_SECRET ||
    (process.env.NODE_ENV === "test" ? "test-bridge-secret" : undefined);

  if (!bridgeSecret) {
    console.error("BRIDGE_SECRET is not configured on Default POS server.");
    return NextResponse.json(
      {
        success: false,
        error: "Server configuration error: Missing BRIDGE_SECRET.",
        code: "BRIDGE_MISCONFIGURED",
      },
      { status: 500 }
    );
  }

  const masterBaseUrl =
    process.env.MASTER_POS_URL ||
    process.env.NEXT_PUBLIC_MASTER_POS_URL ||
    "http://localhost:3001";

  const bridgeUrl = `${masterBaseUrl.replace(/\/$/, "")}/api/bridge/resolve-store`;
  const timestamp = Date.now();
  const signature = crypto
    .createHmac("sha256", bridgeSecret)
    .update(`${userId}:${timestamp}`)
    .digest("hex");

  try {
    const res = await fetch(bridgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-signature": signature,
        "x-bridge-timestamp": timestamp.toString(),
      },
      body: JSON.stringify({ defaultClerkId: userId }),
      // Short cache lifetime / no-store to prevent stale deployment resolutions
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || "Store resolution failed.",
          code: data.code || "STORE_RESOLUTION_FAILED",
        },
        { status: res.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        organization: data.organization,
        deploymentUrl: data.deployment?.url,
        user: data.user,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Failed to connect to Master bridge:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to reach Master control plane to resolve store deployment.",
        code: "BRIDGE_UNREACHABLE",
      },
      { status: 502 }
    );
  }
}

export async function GET() {
  return resolveStoreForAuthenticatedUser();
}

export async function POST() {
  return resolveStoreForAuthenticatedUser();
}
