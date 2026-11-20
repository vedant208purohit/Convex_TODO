import { NextRequest, NextResponse } from "next/server";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { getPaymentAdapter } from "../../../../lib/payments/registry";
import { encryptCredentials, decryptCredentials } from "../../../../../convex/paymentGatewayCrypto";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const { keyId, keySecret, publishableKey, secretKey, connectionId } = body;
    const effectiveKeyId = (publishableKey || keyId || "").trim();
    const effectiveSecretKey = (secretKey || keySecret || "").trim();

    const adapter = getPaymentAdapter("stripe");

    let credentialsToVerify: { keyId: string; keySecret: string } | null = null;
    let encryptedPayload: { encryptedString: string; version: number } | null = null;

    if (effectiveKeyId && effectiveSecretKey) {
      credentialsToVerify = { keyId: effectiveKeyId, keySecret: effectiveSecretKey };
      const verification = await adapter.verifyCredentials(credentialsToVerify);

      if (!verification.verified || !verification.success) {
        return NextResponse.json(
          {
            success: false,
            code: verification.code || "VERIFICATION_FAILED",
            error: verification.message || "Provided Stripe credentials could not be verified.",
          },
          { status: 400 }
        );
      }

      encryptedPayload = await encryptCredentials(credentialsToVerify);
    } else {
      const existingConn = await storeContext.storeConvexClient.query(
        api.paymentGateways.getConnectionCredentials,
        {
          connectionId,
          organizationId: storeContext.orgId,
          provider: "stripe",
        }
      );

      if (!existingConn || !existingConn.encryptedCredentials) {
        return NextResponse.json(
          {
            success: false,
            code: "MISSING_CREDENTIALS",
            error: "No stored credentials found for reconnection. Please provide publishable and secret keys.",
          },
          { status: 400 }
        );
      }

      const decrypted = await decryptCredentials(existingConn.encryptedCredentials);
      if (!decrypted.keyId || !decrypted.keySecret) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_CREDENTIALS",
            error: "Stored credentials missing Publishable or Secret Key.",
          },
          { status: 400 }
        );
      }

      const verification = await adapter.verifyCredentials({
        keyId: decrypted.keyId,
        keySecret: decrypted.keySecret,
      });

      if (!verification.verified || !verification.success) {
        return NextResponse.json(
          {
            success: false,
            code: "STORED_CREDENTIALS_INVALID",
            error: "Previously stored Stripe credentials are no longer valid. Please reconnect with fresh API keys.",
          },
          { status: 400 }
        );
      }
    }

    const reconnectResult = await storeContext.storeConvexClient.mutation(
      api.paymentGateways.reconnectGatewayConnection,
      {
        connectionId,
        organizationId: storeContext.orgId,
        provider: "stripe",
        encryptedCredentials: encryptedPayload?.encryptedString,
        encryptionKeyVersion: encryptedPayload?.version,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Stripe payment gateway reconnected and verified successfully.",
      data: {
        connectionId: reconnectResult.connectionId,
        provider: "stripe",
        status: "connected",
        connectedAt: reconnectResult.connectedAt,
        lastVerifiedAt: reconnectResult.lastVerifiedAt,
      },
    });
  } catch (err: any) {
    console.error("[Stripe Reconnect API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to reconnect Stripe gateway.",
      },
      { status: 500 }
    );
  }
}

