import { NextRequest, NextResponse } from "next/server";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { getPaymentAdapter } from "../../../../lib/payments/registry";
import { encryptCredentials, decryptCredentials } from "../../../../../convex/paymentGatewayCrypto";
import { api } from "../../../../../convex/_generated/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller and verify admin authorization
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
      // Body is optional if reconnecting with stored credentials
    }

    const { keyId, keySecret, connectionId } = body;
    const adapter = getPaymentAdapter("razorpay");

    let credentialsToVerify: { keyId: string; keySecret: string } | null = null;
    let encryptedPayload: { encryptedString: string; version: number } | null = null;

    if (keyId && keySecret) {
      // Flow A: Fresh credentials supplied
      credentialsToVerify = { keyId: keyId.trim(), keySecret: keySecret.trim() };
      const verification = await adapter.verifyCredentials(credentialsToVerify);

      if (!verification.verified || !verification.success) {
        return NextResponse.json(
          {
            success: false,
            code: verification.code || "VERIFICATION_FAILED",
            error: verification.message || "Provided Razorpay credentials could not be verified.",
          },
          { status: 400 }
        );
      }

      encryptedPayload = await encryptCredentials(credentialsToVerify);
    } else {
      // Flow B: Reconnect using existing encrypted credentials
      const existingConn = await storeContext.storeConvexClient.query(
        api.paymentGateways.getConnectionCredentials,
        {
          connectionId,
          organizationId: storeContext.orgId,
          provider: "razorpay",
        }
      );

      if (!existingConn || !existingConn.encryptedCredentials) {
        return NextResponse.json(
          {
            success: false,
            code: "MISSING_CREDENTIALS",
            error: "No stored credentials found for reconnection. Please provide keyId and keySecret.",
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
            error: "Stored credentials missing keyId or keySecret.",
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
            error: "Previously stored Razorpay credentials are no longer valid. Please reconnect with fresh API keys.",
          },
          { status: 400 }
        );
      }
    }

    // Update connection status back to connected
    const updatedConnection = await storeContext.storeConvexClient.mutation(
      api.paymentGateways.reconnectGatewayConnection,
      {
        connectionId,
        organizationId: storeContext.orgId,
        provider: "razorpay",
        encryptedCredentials: encryptedPayload?.encryptedString,
        encryptionKeyVersion: encryptedPayload?.version,
        providerAccountId: credentialsToVerify?.keyId,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Razorpay payment gateway reconnected and verified successfully.",
      data: {
        connection: updatedConnection,
        reconnectedAt: Date.now(),
        syncResumed: true,
      },
    });
  } catch (err: any) {
    console.error("[Razorpay Reconnect API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to reconnect Razorpay gateway.",
      },
      { status: 500 }
    );
  }
}
