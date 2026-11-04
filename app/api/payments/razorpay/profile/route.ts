import { NextRequest, NextResponse } from "next/server";
import { getPaymentAdapter } from "../../../../lib/payments/registry";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { decryptCredentials } from "../../../../../convex/paymentGatewayCrypto";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate caller & resolve store context
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

    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    // 2. Query gateway connection from Convex
    const connection = await storeContext.storeConvexClient.query(
      api.paymentGateways.getConnectionCredentials,
      {
        organizationId: storeContext.orgId,
        provider: "razorpay",
      }
    );

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          code: "CONNECTION_NOT_FOUND",
          error: "No Razorpay connection found for this store. Please connect Razorpay in Marketplace.",
        },
        { status: 404 }
      );
    }

    if (connection.status !== "connected") {
      return NextResponse.json(
        {
          success: false,
          code: "CONNECTION_NOT_ACTIVE",
          error: `Razorpay connection is not active (current status: "${connection.status}").`,
        },
        { status: 400 }
      );
    }

    // 3. Check for cached profile in connection metadata
    const cachedProfile = connection.metadata?.cachedProfile;
    const cacheTimestamp = connection.metadata?.cachedProfileAt;
    const isCacheValid =
      !forceRefresh &&
      cachedProfile &&
      cacheTimestamp &&
      Date.now() - cacheTimestamp < 15 * 60 * 1000; // 15-minute cache

    if (isCacheValid) {
      return NextResponse.json({
        success: true,
        provider: "razorpay",
        merchant_name: cachedProfile.merchant_name || connection.merchantName || null,
        merchant_id: cachedProfile.merchant_id || null,
        account_mode: connection.accountMode,
        connection_status: connection.status,
        cached: true,
      });
    }

    if (!connection.encryptedCredentials) {
      return NextResponse.json({
        success: true,
        provider: "razorpay",
        merchant_name: connection.merchantName || null,
        merchant_id: null,
        account_mode: connection.accountMode,
        connection_status: connection.status,
        is_profile_available: false,
      });
    }

    // 4. Decrypt credentials in trusted server-side context
    let credentials: any;
    try {
      credentials = await decryptCredentials(connection.encryptedCredentials);
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CREDENTIALS",
          error: "Failed to decrypt stored credentials. Key rotation or reconfiguration may be required.",
        },
        { status: 500 }
      );
    }

    // 5. Query Razorpay API via Adapter
    const adapter = getPaymentAdapter("razorpay");
    const profile = await adapter.fetchProfile({
      keyId: credentials.keyId,
      keySecret: credentials.keySecret,
    });

    const merchantName = profile.merchant_name || connection.merchantName || null;
    const merchantId = profile.merchant_id || null;

    // 6. Update cache in metadata asynchronously without blocking response
    storeContext.storeConvexClient
      .mutation(api.paymentGateways.updateConnectionMetadata, {
        connectionId: connection.connectionId,
        merchantName: merchantName || undefined,
        metadata: {
          cachedProfile: {
            merchant_name: merchantName,
            merchant_id: merchantId,
          },
          cachedProfileAt: Date.now(),
        },
      })
      .catch(() => {});

    // 7. Safe Public Response
    return NextResponse.json({
      success: true,
      provider: "razorpay",
      merchant_name: merchantName,
      merchant_id: merchantId,
      account_mode: connection.accountMode,
      connection_status: connection.status,
    });
  } catch (err: any) {
    const adapter = getPaymentAdapter("razorpay");
    const normalized = adapter.normalizeError(err);

    return NextResponse.json(
      {
        success: false,
        code: normalized.code,
        error: normalized.message,
      },
      { status: normalized.httpStatus }
    );
  }
}
