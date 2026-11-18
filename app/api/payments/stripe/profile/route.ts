import { NextRequest, NextResponse } from "next/server";
import { getPaymentAdapter } from "../../../../lib/payments/registry";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { decryptCredentials } from "../../../../../convex/paymentGatewayCrypto";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    let storeContext: any;
    try {
      storeContext = await requireStoreAdminContext(req);
    } catch (authErr: any) {
      return NextResponse.json(
        {
          success: false,
          code: authErr.code || "UNAUTHORIZED",
          error: authErr.message || "Unauthorized access.",
        },
        { status: authErr.status || 401 }
      );
    }

    const connection = await storeContext.storeConvexClient.query(
      api.paymentGateways.getConnectionCredentials,
      {
        organizationId: storeContext.orgId,
        provider: "stripe",
      }
    );

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          code: "CONNECTION_NOT_FOUND",
          error: "No Stripe connection found for this store.",
        },
        { status: 404 }
      );
    }

    if (!connection.encryptedCredentials) {
      return NextResponse.json(
        {
          success: false,
          code: "CREDENTIALS_MISSING",
          error: "Credentials missing or unreadable.",
        },
        { status: 400 }
      );
    }

    const decrypted = await decryptCredentials(connection.encryptedCredentials);
    const adapter = getPaymentAdapter("stripe");

    const profile = await adapter.fetchProfile({
      keyId: decrypted.keyId || connection.providerAccountId || "",
      keySecret: decrypted.keySecret || "",
    });

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (err: any) {
    const adapter = getPaymentAdapter("stripe");
    const normalized = adapter.normalizeError(err);
    return NextResponse.json(
      {
        success: false,
        code: normalized.code || "INTERNAL_ERROR",
        error: normalized.message || "Failed to fetch merchant profile.",
      },
      { status: normalized.httpStatus || 500 }
    );
  }
}

