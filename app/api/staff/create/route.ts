import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import crypto from "crypto";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_STAFF_ROLES = [
  "admin",
  "cashier",
  "captain",
  "waiter",
  "chef",
  "worker",
] as const;

export async function POST(req: Request) {
  try {
    // ----------------------------------------------------
    // 1. Authenticate Store Caller via Default Clerk B
    // ----------------------------------------------------
    const { userId, getToken } = await auth();

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

    // ----------------------------------------------------
    // 2. Parse & Validate Request Body
    // ----------------------------------------------------
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

    const {
      firstName,
      lastName,
      email,
      phone,
      role,
      userType,
      userPermission,
    } = body || {};

    if (!firstName || typeof firstName !== "string" || !firstName.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "First name is required.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    if (!lastName || typeof lastName !== "string" || !lastName.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Last name is required.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid email address is required.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    if (!role || typeof role !== "string" || !role.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Role is required.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const normalizedRole = role.trim().toLowerCase();
    if (!VALID_STAFF_ROLES.includes(normalizedRole as any)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid role: "${role}". Supported staff roles are: ${VALID_STAFF_ROLES.join(", ")}.`,
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedPhone =
      typeof phone === "string" && phone.trim() ? phone.trim() : undefined;

    // ----------------------------------------------------
    // 3. Connect to Store Convex & Verify Admin Rights
    // ----------------------------------------------------
    const storeConvexUrl =
      process.env.NEXT_PUBLIC_CONVEX_URL ||
      process.env.CONVEX_URL ||
      "https://test-store.convex.cloud";

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

    const ADMIN_ROLES = ["admin", "store_admin", "org_admin", "super_admin", "owner"];

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
      const isUnauthenticated =
        errMessage.includes("Unauthenticated") ||
        errMessage.includes("valid authentication token");

      if (isForbidden) {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden: You do not have permission to manage employees for this store.",
            code: "FORBIDDEN",
          },
          { status: 403 }
        );
      }

      if (isUnauthenticated) {
        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized: Store authentication required.",
            code: "UNAUTHORIZED",
          },
          { status: 401 }
        );
      }

      console.error("[Store Auth Error]", authErr);
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

    // ----------------------------------------------------
    // 4. Check Bridge Secret & Sign Server-to-Server Request
    // ----------------------------------------------------
    const bridgeSecret = process.env.BRIDGE_SECRET;

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

    const bridgeUrl = `${masterBaseUrl.replace(/\/$/, "")}/api/bridge/staff/create`;
    const timestamp = Date.now();
    const signature = crypto
      .createHmac("sha256", bridgeSecret)
      .update(`${adminContext.slug}:${timestamp}`)
      .digest("hex");

    // ----------------------------------------------------
    // 5. Relay Request to Master Staff Creation Bridge
    // ----------------------------------------------------
    const payload = {
      slug: adminContext.slug,
      organizationId: adminContext.organizationId,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: normalizedEmail,
      phone: normalizedPhone,
      role: normalizedRole,
      userType: Array.isArray(userType) && userType.length > 0 ? userType : [normalizedRole],
      userPermission,
    };

    try {
      const res = await fetch(bridgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bridge-signature": signature,
          "x-bridge-timestamp": timestamp.toString(),
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        return NextResponse.json(
          {
            success: false,
            error: data.error || "Staff creation failed at Master bridge.",
            code: data.code || (res.status === 409 ? "CONFLICT" : "STAFF_CREATION_FAILED"),
          },
          { status: res.status || 400 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message:
            data.message ||
            `Employee "${normalizedFirstName} ${normalizedLastName}" created successfully. An invitation has been sent!`,
          employee: data,
        },
        { status: 201 }
      );
    } catch (networkErr: any) {
      console.error("Failed to connect to Master staff creation bridge:", networkErr);
      return NextResponse.json(
        {
          success: false,
          error: "Unable to reach Master control plane to provision staff identity.",
          code: "BRIDGE_UNREACHABLE",
        },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error("Store staff creation route error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error creating employee.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
