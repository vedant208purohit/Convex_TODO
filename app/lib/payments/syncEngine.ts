/**
 * Polymorphic Payment Gateway Synchronization Engine
 *
 * Handles transaction, refund, and settlement synchronization across any payment provider
 * (Razorpay, Stripe, PayPal) with:
 * - Overlapping boundary windows (prevents clock skew / race omissions)
 * - Idempotency & deduplication
 * - Separate entity cursors
 * - Concurrency protection per connection & entity
 * - Bounded retries with exponential backoff and jitter
 * - Audit logging in payment_sync_runs and payment_sync_cursors
 */

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { PaymentProviderAdapter, PaymentCredentials } from "./types";

export type SyncResourceType = "transactions" | "refunds" | "settlements";
export type SyncType = "initial" | "incremental" | "manual" | "scheduled";

export interface SyncResult {
  resourceType: SyncResourceType;
  syncType: SyncType;
  status: "completed" | "failed" | "skipped";
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorCount: number;
  lastError?: string;
  durationMs: number;
}

// In-process lock tracker to avoid concurrent syncs for the same connection and entity
const activeSyncLocks = new Set<string>();

// Safety buffer to catch transactions created on boundary edges: 5 minutes
const OVERLAP_BUFFER_MS = 5 * 60 * 1000;

/**
 * Exponential backoff with jitter helper for retryable errors.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 2,
  initialDelayMs = 500
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const isRetryable =
        err?.message?.includes("429") ||
        err?.message?.includes("RAZORPAY_RATE_LIMITED") ||
        err?.message?.includes("NETWORK_TIMEOUT") ||
        err?.message?.includes("503") ||
        err?.message?.includes("502");

      if (attempt > retries || !isRetryable) {
        throw err;
      }

      const delay = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

export class PaymentSyncEngine {
  /**
   * Synchronizes payment transactions from the gateway provider into payment_transactions.
   */
  static async syncTransactions(params: {
    convexClient: any;
    connectionId: Id<"payment_gateway_connections">;
    adapter: PaymentProviderAdapter;
    credentials: PaymentCredentials;
    syncType?: SyncType;
    fromEpochMs?: number;
    toEpochMs?: number;
    maxRecords?: number;
  }): Promise<SyncResult> {
    return this.runSyncTask({
      ...params,
      resourceType: "transactions",
      fetchAndPersist: async ({ from, to, convexClient, connectionId, adapter, credentials, maxRecords }) => {
        let skip = 0;
        const count = 50;
        let fetchedTotal = 0;
        let createdTotal = 0;
        let updatedTotal = 0;
        let maxSeenTimestamp = from;

        while (fetchedTotal < maxRecords) {
          const fetchResult = await retryWithBackoff(() =>
            adapter.fetchTransactions(credentials, {
              count,
              skip,
              from,
              to,
            })
          );

          if (!fetchResult.items || fetchResult.items.length === 0) {
            break;
          }

          fetchedTotal += fetchResult.items.length;

          for (const item of fetchResult.items) {
            const res = await convexClient.mutation(api.paymentGateways.recordTransaction, {
              connectionId,
              providerPaymentId: item.providerPaymentId,
              providerOrderId: item.providerOrderId,
              internalOrderId:
                (item as any).internalOrderId ||
                (item.metadata?.orderId ? (item.metadata.orderId as any) : undefined),
              customerEmail: item.customerEmail,
              customerPhone: item.customerPhone,
              customerName: item.customerName,
              amountMinor: item.amountMinor,
              currency: item.currency,
              paymentMethod: item.paymentMethod,
              status: item.status,
              providerStatus: item.providerStatus,
              paidAt: item.paidAt,
              failedAt: item.failedAt,
              errorCode: item.errorCode,
              errorMessage: item.errorMessage,
              refundedAmountMinor: item.refundedAmountMinor,
              metadata: item.metadata,
            });

            if (res.alreadyExists) {
              updatedTotal++;
            } else {
              createdTotal++;
            }

            if (item.createdAt > maxSeenTimestamp) {
              maxSeenTimestamp = item.createdAt;
            }
          }

          if (!fetchResult.hasMore) {
            break;
          }

          skip += fetchResult.items.length;
        }

        return {
          recordsFetched: fetchedTotal,
          recordsCreated: createdTotal,
          recordsUpdated: updatedTotal,
          recordsSkipped: 0,
          newCursorTime: maxSeenTimestamp,
        };
      },
    });
  }

  /**
   * Synchronizes refunds from the gateway provider into payment_refunds.
   */
  static async syncRefunds(params: {
    convexClient: any;
    connectionId: Id<"payment_gateway_connections">;
    adapter: PaymentProviderAdapter;
    credentials: PaymentCredentials;
    syncType?: SyncType;
    fromEpochMs?: number;
    toEpochMs?: number;
    maxRecords?: number;
  }): Promise<SyncResult> {
    return this.runSyncTask({
      ...params,
      resourceType: "refunds",
      fetchAndPersist: async ({ from, to, convexClient, connectionId, adapter, credentials, maxRecords }) => {
        let skip = 0;
        const count = 50;
        let fetchedTotal = 0;
        let createdTotal = 0;
        let updatedTotal = 0;
        let maxSeenTimestamp = from;

        while (fetchedTotal < maxRecords) {
          const fetchResult = await retryWithBackoff(() =>
            adapter.fetchRefunds(credentials, {
              count,
              skip,
              from,
              to,
            })
          );

          if (!fetchResult.items || fetchResult.items.length === 0) {
            break;
          }

          fetchedTotal += fetchResult.items.length;

          for (const item of fetchResult.items) {
            const res = await convexClient.mutation(api.paymentGateways.recordRefund, {
              connectionId,
              providerRefundId: item.providerRefundId,
              providerPaymentId: item.providerPaymentId,
              amountMinor: item.amountMinor,
              currency: item.currency,
              reason: item.reason,
              status: item.status,
              providerStatus: item.providerStatus,
              speed: item.speed,
              initiatedAt: item.initiatedAt,
              processedAt: item.processedAt,
              errorCode: item.errorCode,
              errorMessage: item.errorMessage,
              metadata: item.metadata,
            });

            if (res.alreadyExists) {
              updatedTotal++;
            } else {
              createdTotal++;
            }

            if (item.initiatedAt > maxSeenTimestamp) {
              maxSeenTimestamp = item.initiatedAt;
            }
          }

          if (!fetchResult.hasMore) {
            break;
          }

          skip += fetchResult.items.length;
        }

        return {
          recordsFetched: fetchedTotal,
          recordsCreated: createdTotal,
          recordsUpdated: updatedTotal,
          recordsSkipped: 0,
          newCursorTime: maxSeenTimestamp,
        };
      },
    });
  }

  /**
   * Synchronizes settlements / payouts from the gateway provider into payment_settlements.
   */
  static async syncSettlements(params: {
    convexClient: any;
    connectionId: Id<"payment_gateway_connections">;
    adapter: PaymentProviderAdapter;
    credentials: PaymentCredentials;
    syncType?: SyncType;
    fromEpochMs?: number;
    toEpochMs?: number;
    maxRecords?: number;
  }): Promise<SyncResult> {
    return this.runSyncTask({
      ...params,
      resourceType: "settlements",
      fetchAndPersist: async ({ from, to, convexClient, connectionId, adapter, credentials, maxRecords }) => {
        let skip = 0;
        const count = 50;
        let fetchedTotal = 0;
        let createdTotal = 0;
        let updatedTotal = 0;
        let maxSeenTimestamp = from;

        while (fetchedTotal < maxRecords) {
          const fetchResult = await retryWithBackoff(() =>
            adapter.fetchSettlements(credentials, {
              count,
              skip,
              from,
              to,
            })
          );

          if (!fetchResult.items || fetchResult.items.length === 0) {
            break;
          }

          fetchedTotal += fetchResult.items.length;

          for (const item of fetchResult.items) {
            const res = await convexClient.mutation(api.paymentGateways.recordSettlement, {
              connectionId,
              providerSettlementId: item.providerSettlementId,
              amountMinor: item.amountMinor,
              currency: item.currency,
              feesMinor: item.feesMinor,
              taxMinor: item.taxMinor,
              netAmountMinor: item.netAmountMinor,
              status: item.status,
              providerStatus: item.providerStatus,
              settlementDate: item.settlementDate,
              utrOrReference: item.utrOrReference,
              metadata: item.metadata,
            });

            if (res.alreadyExists) {
              updatedTotal++;
            } else {
              createdTotal++;
            }

            if (item.settlementDate > maxSeenTimestamp) {
              maxSeenTimestamp = item.settlementDate;
            }
          }

          if (!fetchResult.hasMore) {
            break;
          }

          skip += fetchResult.items.length;
        }

        return {
          recordsFetched: fetchedTotal,
          recordsCreated: createdTotal,
          recordsUpdated: updatedTotal,
          recordsSkipped: 0,
          newCursorTime: maxSeenTimestamp,
        };
      },
    });
  }

  /**
   * Generic task execution wrapper that handles locking, cursor retrieval,
   * audit logging in payment_sync_runs, and error boundary isolation.
   */
  private static async runSyncTask(params: {
    convexClient: any;
    connectionId: Id<"payment_gateway_connections">;
    resourceType: SyncResourceType;
    syncType?: SyncType;
    adapter: PaymentProviderAdapter;
    credentials: PaymentCredentials;
    fromEpochMs?: number;
    toEpochMs?: number;
    maxRecords?: number;
    fetchAndPersist: (ctx: {
      from: number;
      to: number;
      convexClient: any;
      connectionId: Id<"payment_gateway_connections">;
      adapter: PaymentProviderAdapter;
      credentials: PaymentCredentials;
      maxRecords: number;
    }) => Promise<{
      recordsFetched: number;
      recordsCreated: number;
      recordsUpdated: number;
      recordsSkipped: number;
      newCursorTime: number;
    }>;
  }): Promise<SyncResult> {
    const lockKey = `${params.connectionId}:${params.resourceType}`;

    // Concurrency protection: avoid overlapping syncs for the same entity and connection
    if (activeSyncLocks.has(lockKey)) {
      return {
        resourceType: params.resourceType,
        syncType: params.syncType || "incremental",
        status: "skipped",
        recordsFetched: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errorCount: 0,
        durationMs: 0,
      };
    }

    activeSyncLocks.add(lockKey);
    const startedAt = Date.now();
    const syncType = params.syncType || "incremental";
    const maxRecords = params.maxRecords || 250;

    try {
      // Determine sync window from existing cursor
      const syncStatus = await params.convexClient.query(api.paymentGateways.getSyncStatus, {
        connectionId: params.connectionId,
      });

      const existingCursor = syncStatus?.cursors?.find(
        (c: any) => c.resourceType === params.resourceType
      );

      let from = params.fromEpochMs;
      if (from === undefined) {
        if (existingCursor && existingCursor.lastSuccessfulSyncAt) {
          // Apply safe overlap window of 5 minutes to avoid boundary race conditions
          from = Math.max(existingCursor.lastSuccessfulSyncAt - OVERLAP_BUFFER_MS, 0);
        } else {
          // Default initial window: last 60 days
          from = Date.now() - 60 * 24 * 60 * 60 * 1000;
        }
      }

      const to = params.toEpochMs || Date.now();

      // Execute entity-specific synchronization
      const runMetrics = await params.fetchAndPersist({
        from,
        to,
        convexClient: params.convexClient,
        connectionId: params.connectionId,
        adapter: params.adapter,
        credentials: params.credentials,
        maxRecords,
      });

      const completedAt = Date.now();

      // Only advance sync cursor after successful persistence
      if (runMetrics.newCursorTime && runMetrics.newCursorTime > from) {
        await params.convexClient.mutation(api.paymentGateways.updateSyncCursor, {
          connectionId: params.connectionId,
          resourceType: params.resourceType,
          lastSuccessfulSyncAt: runMetrics.newCursorTime,
        });
      }

      // Record audit log entry in payment_sync_runs
      await params.convexClient.mutation(api.paymentGateways.recordSyncRun, {
        connectionId: params.connectionId,
        resourceType: params.resourceType,
        syncType,
        status: "completed",
        startedAt,
        completedAt,
        recordsFetched: runMetrics.recordsFetched,
        recordsCreated: runMetrics.recordsCreated,
        recordsUpdated: runMetrics.recordsUpdated,
        recordsSkipped: runMetrics.recordsSkipped,
        errorCount: 0,
      });

      return {
        resourceType: params.resourceType,
        syncType,
        status: "completed",
        recordsFetched: runMetrics.recordsFetched,
        recordsCreated: runMetrics.recordsCreated,
        recordsUpdated: runMetrics.recordsUpdated,
        recordsSkipped: runMetrics.recordsSkipped,
        errorCount: 0,
        durationMs: completedAt - startedAt,
      };
    } catch (err: any) {
      const completedAt = Date.now();
      const lastError = err?.message || "Sync operation failed.";

      await params.convexClient
        .mutation(api.paymentGateways.recordSyncRun, {
          connectionId: params.connectionId,
          resourceType: params.resourceType,
          syncType,
          status: "failed",
          startedAt,
          completedAt,
          recordsFetched: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          errorCount: 1,
          lastError,
        })
        .catch(() => {});

      return {
        resourceType: params.resourceType,
        syncType,
        status: "failed",
        recordsFetched: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errorCount: 1,
        lastError,
        durationMs: completedAt - startedAt,
      };
    } finally {
      activeSyncLocks.delete(lockKey);
    }
  }
}
