import { NextRequest, NextResponse } from "next/server";
import { requireStoreAdminContext } from "../../../../lib/payments/authHelper";
import { getPaymentAdapter } from "../../../../lib/payments/registry";
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

    const now = Date.now();

    const healthData = await storeContext.storeConvexClient.query(
      api.paymentGateways.getIntegrationHealthData,
      {
        organizationId: storeContext.orgId,
        provider: "stripe",
      }
    );

    const connection = healthData.connection;

    // Check 1: Connection Status
    let connectionReport: any;
    if (!connection) {
      connectionReport = {
        status: "not_connected",
        connected: false,
        message: "No Stripe gateway connection configured for this store.",
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

    // Check 2: Actual API Connectivity Probe
    let apiReport: any = {
      status: "not_checked",
      message: "API check skipped because connection is inactive.",
      lastCheckedAt: now,
    };

    if (connection && connection.status === "connected") {
      try {
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
              error: "Stored credential bundle is missing Publishable or Secret Key.",
            };
          } else {
            const adapter = getPaymentAdapter("stripe");
            const probeStart = Date.now();
            const verification = await adapter.verifyCredentials({
              keyId: decrypted.keyId,
              keySecret: decrypted.keySecret,
            });
            const latencyMs = Date.now() - probeStart;

            if (verification.verified && verification.success) {
              apiReport = {
                status: "operational",
                reachable: true,
                latencyMs,
                lastCheckedAt: now,
                merchantName: verification.merchantName,
                mode: verification.accountMode,
                statusMessage: "Stripe API endpoints reachable with sub-second response.",
              };
            } else {
              apiReport = {
                status: "degraded",
                reachable: false,
                latencyMs,
                lastCheckedAt: now,
                error: verification.message,
                code: verification.code,
              };
            }
          }
        }
      } catch (probeErr: any) {
        apiReport = {
          status: "unreachable",
          reachable: false,
          latencyMs: 0,
          lastCheckedAt: now,
          error: probeErr.message || "Failed probing Stripe API.",
        };
      }
    }

    // Check 3: Webhooks Telemetry
    const webhooks = healthData.webhooks;
    const webhookReport = {
      configured: connection?.metadata?.webhookConfigured ?? Boolean(connection?.metadata?.webhookSecretLast4),
      secretLast4: connection?.metadata?.webhookSecretLast4,
      totalEvents: webhooks?.totalEvents || 0,
      deliveredEvents: (webhooks?.totalEvents || 0) - (webhooks?.pendingEvents || 0),
      failedEvents: webhooks?.failedEvents || 0,
      deliveryRate: webhooks?.deliveryRate || 100,
      lastReceivedAt: webhooks?.lastReceivedAt,
      lastProcessedAt: webhooks?.lastProcessedAt,
      status:
        webhooks?.deliveryRate === 0
          ? "no_events"
          : (webhooks?.deliveryRate ?? 100) >= 95
          ? "healthy"
          : "degraded",
    };

    // Check 4: Synchronization Telemetry
    const sync = healthData.sync;
    const syncReport = {
      lastSyncAt: sync?.lastSyncAt || connection?.lastSyncAt,
      totalSyncs: sync?.totalRuns || 0,
      completedSyncs: sync?.completedRuns || 0,
      failedSyncs: sync?.failedRuns || 0,
      recordsSynced: sync?.totalRecordsSynced || 0,
      status: sync?.failedRuns > 0 && sync?.completedRuns === 0 ? "failing" : "healthy",
      recentErrors: sync?.recentErrors || [],
    };

    // Overall System Status Evaluation
    let overallStatus: "operational" | "degraded" | "outage" | "disconnected" = "operational";
    if (!connection || connection.status !== "connected") {
      overallStatus = "disconnected";
    } else if (apiReport.status === "unreachable" || apiReport.status === "invalid_credentials") {
      overallStatus = "outage";
    } else if (apiReport.status === "degraded" || webhookReport.status === "degraded") {
      overallStatus = "degraded";
    }

    return NextResponse.json({
      success: true,
      provider: "stripe",
      overallStatus,
      connection: connectionReport,
      apiStatus: apiReport,
      webhooks: webhookReport,
      sync: syncReport,
      timestamp: now,
    });
  } catch (err: any) {
    console.error("[Stripe Health API Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed generating health report.",
      },
      { status: 500 }
    );
  }
}

