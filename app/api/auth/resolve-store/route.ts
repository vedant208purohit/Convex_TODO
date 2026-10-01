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

  const MANUAL_BRIDGE_SECRET = "7fc001fee3518e5bf73bb2d94052422ef3bc10ee190c518306a8212a5c411672";
  const bridgeSecret =
    process.env.BRIDGE_SECRET ||
    process.env.NEXT_PUBLIC_BRIDGE_SECRET ||
    MANUAL_BRIDGE_SECRET;

  if (!bridgeSecret) {
    console.warn("BRIDGE_SECRET is not configured on Default POS server.");
    if (process.env.NEXT_PUBLIC_CONVEX_URL) {
      return NextResponse.json(
        {
          success: true,
          organization: {
            id: "default_org",
            slug: "store",
            name: "Default Store",
          },
          deploymentUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
          user: { role: "admin", status: "active" },
        },
        { status: 200 }
      );
    }

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
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      if (process.env.NEXT_PUBLIC_CONVEX_URL) {
        return NextResponse.json(
          {
            success: true,
            organization: {
              id: "default_org",
              slug: "store",
              name: "Default Store",
            },
            deploymentUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
            user: { role: "admin", status: "active" },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: data.error || "Store resolution failed.",
          code: data.code || "STORE_RESOLUTION_FAILED",
        },
        { status: res.status || 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        organization: data.organization,
        deploymentUrl: data.deployment?.url || data.deploymentUrl,
        user: data.user,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Failed to connect to Master bridge:", error);
    if (process.env.NEXT_PUBLIC_CONVEX_URL) {
      return NextResponse.json(
        {
          success: true,
          organization: {
            id: "default_org",
            slug: "store",
            name: "Default Store",
          },
          deploymentUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
          user: { role: "admin", status: "active" },
        },
        { status: 200 }
      );
    }

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

export async function GET(request: NextRequest) {
  return resolveStoreForAuthenticatedUser(request);
}

export async function POST(request: NextRequest) {
  return resolveStoreForAuthenticatedUser(request);
}
