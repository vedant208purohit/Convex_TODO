import { NextRequest, NextResponse } from "next/server";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { getPaymentAdapter } from "../../../../lib/payments/registry";
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

    const now = Date.now();

    // 2. Query aggregated health telemetry from Convex (store-isolated)
    const healthData = await storeContext.storeConvexClient.query(
      api.paymentGateways.getIntegrationHealthData,
      {
        organizationId: storeContext.orgId,
        provider: "razorpay",
      }
    );

    const connection = healthData.connection;

    // 3. Evaluate Check 1: Connection Status
    let connectionReport: any;
    if (!connection) {
      connectionReport = {
        status: "not_connected",
        connected: false,
        message: "No Razorpay gateway connection configured for this store.",
      };
    } else {
      connectionReport = {
        id: connection._id,
        status: connection.status,
        connected: connection.status === "connected",
        type: connection.connectionType,
        mode: connection.accountMode,
        merchantName: connection.merchantName,
        maskedKeyId: connection.maskedKeyId,
        connectedAt: connection.connectedAt,
        lastVerifiedAt: connection.lastVerifiedAt,
        disconnectedAt: connection.disconnectedAt,
        credentialsUpdatedAt: connection.credentialsUpdatedAt,
      };
    }

    // 4. Evaluate Check 2: Actual API Connectivity (Lightweight Probe)
    let apiReport: any = {
      status: "not_checked",
      message: "API check skipped because connection is inactive.",
      lastCheckedAt: now,
    };

    if (connection && connection.status === "connected") {
      try {
        // Fetch server credentials safely in memory
        const credentialsRecord = await storeContext.storeConvexClient.query(
          api.paymentGateways.getConnectionCredentials,
          {
            connectionId: connection._id,
            organizationId: storeContext.orgId,
          }
        );

        if (credentialsRecord?.encryptedCredentials) {
          const decrypted = await decryptCredentials(credentialsRecord.encryptedCredentials);
          if (!decrypted.keyId || !decrypted.keySecret) {
            apiReport = {
              status: "invalid_credentials",
              latencyMs: 0,
              lastCheckedAt: now,
              error: "Stored credential bundle is missing keyId or keySecret.",
            };
          } else {
            const adapter = getPaymentAdapter("razorpay");
            const probeStart = Date.now();
            const verification = await adapter.verifyCredentials({
              keyId: decrypted.keyId,
              keySecret: decrypted.keySecret,
            });
            const latencyMs = Date.now() - probeStart;

            if (verification.verified && verification.success) {
              apiReport = {
                status: "healthy",
                mode: verification.accountMode,
                latencyMs,
                lastCheckedAt: now,
                message: "Razorpay REST API authenticated and responsive.",
              };
            } else if (verification.code === "INVALID_CREDENTIALS") {
              apiReport = {
                status: "invalid_credentials",
                latencyMs,
                lastCheckedAt: now,
                error: verification.message || "Invalid or revoked API credentials.",
              };
            } else if (verification.code === "INSUFFICIENT_PERMISSIONS") {
              apiReport = {
                status: "insufficient_permissions",
                latencyMs,
                lastCheckedAt: now,
                error: "API key lacks required payment gateway permissions.",
              };
            } else if (verification.code === "RATE_LIMITED") {
              apiReport = {
                status: "rate_limited",
                latencyMs,
                lastCheckedAt: now,
                error: "Razorpay API rate limits exceeded.",
              };
            } else {
              apiReport = {
                status: "degraded",
                latencyMs,
                lastCheckedAt: now,
                error: verification.message || "API probe failed.",
              };
            }
          }
        } else {
          apiReport = {
            status: "missing_credentials",
            lastCheckedAt: now,
            error: "No encrypted credentials found on active connection.",
          };
        }
      } catch (apiErr: any) {
        apiReport = {
          status: "unreachable",
          lastCheckedAt: now,
          error: apiErr.message || "Network timeout connecting to Razorpay API.",
        };
      }
    } else if (connection?.status === "disconnected") {
      apiReport = {
        status: "disconnected",
        lastCheckedAt: now,
        message: "Gateway is currently disconnected by merchant administrator.",
      };
    }

    // 5. Evaluate Check 3: Webhook Telemetry
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    const webhookUrl = `${proto}://${host}/api/payments/razorpay/webhook?store=${storeContext.storeSlug || "default"}`;

    const rawWebhookStatus = healthData.webhook.status;
    let webhookStatusLabel = "Pending Setup";
    if (rawWebhookStatus === "healthy") webhookStatusLabel = "Active";
    else if (rawWebhookStatus === "awaiting_events") webhookStatusLabel = "Awaiting First Event";
    else if (rawWebhookStatus === "degraded") webhookStatusLabel = "Degraded";
    else if (rawWebhookStatus === "inactive") webhookStatusLabel = "Inactive";

    const webhookReport = {
      status: rawWebhookStatus,
      statusLabel: webhookStatusLabel,
      configured: healthData.webhook.configured,
      webhookUrl,
      lastReceivedAt: healthData.webhook.lastReceivedAt,
      lastProcessedAt: healthData.webhook.lastProcessedAt,
      pendingEvents: healthData.webhook.pendingEvents,
      failedEvents: healthData.webhook.failedEvents,
      totalEvents: healthData.webhook.totalEvents,
    };

    // 6. Evaluate Check 4: Last Sync Status
    const syncReport = healthData.sync;

    // 7. Calculate Overall Integration Health
    let overallStatus: "healthy" | "warning" | "degraded" | "unhealthy" | "disconnected";

    if (!connection || connection.status === "disconnected") {
      overallStatus = "disconnected";
    } else if (
      connection.status === "needs_attention" ||
      apiReport.status === "invalid_credentials" ||
      apiReport.status === "missing_credentials"
    ) {
      overallStatus = "unhealthy";
    } else if (
      apiReport.status === "rate_limited" ||
      apiReport.status === "unreachable" ||
      apiReport.status === "degraded" ||
      webhookReport.status === "degraded" ||
      syncReport.transactions.status === "failed" ||
      syncReport.refunds.status === "failed" ||
      syncReport.settlements.status === "failed"
    ) {
      overallStatus = "degraded";
    } else if (
      webhookReport.status === "warning" ||
      webhookReport.status === "not_configured" ||
      syncReport.transactions.status === "never"
    ) {
      overallStatus = "warning";
    } else {
      overallStatus = "healthy";
    }

    return NextResponse.json({
      success: true,
      data: {
        overallStatus,
        connection: connectionReport,
        api: apiReport,
        webhook: webhookReport,
        sync: syncReport,
        recentActivity: healthData.recentActivity || [],
        checkedAt: now,
      },
    });
  } catch (err: any) {
    console.error("[Razorpay Health API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to generate integration health report.",
      },
      { status: 500 }
    );
  }
}
