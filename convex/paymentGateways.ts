import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, resolveStoreOrganization } from "./organizationUsers";
import { encryptCredentials, maskKeyIdentifier } from "./paymentGatewayCrypto";
import {
  PublicGatewayConnection,
  PaymentConnectionType,
  PaymentAccountMode,
  PaymentConnectionStatus,
  NormalizedTransactionStatus,
  NormalizedRefundStatus,
  NormalizedSettlementStatus,
  WebhookProcessingStatus,
  SyncResourceType,
  SyncType,
  SyncRunStatus,
} from "./paymentGatewayTypes";

/**
 * Strips encrypted credentials from a database connection record to guarantee
 * that client queries never leak ciphertext, encryption keys, or secrets.
 */
function toPublicConnection(conn: any): PublicGatewayConnection {
  const { encryptedCredentials, encryptionKeyVersion, ...safeProps } = conn;
  return {
    ...safeProps,
    maskedKeyId: maskKeyIdentifier(conn.providerAccountId),
  };
}

// =========================================================================
// GATEWAY CONNECTIONS
// =========================================================================

/**
 * Lists gateway connections for the current store organization.
 * Guaranteed safe: never returns credentials.
 */
export const listConnections = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    let q = ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_org", (idx) => idx.eq("organizationId", org._id));

    const connections = await q.collect();

    let filtered = connections;
    if (args.provider) {
      filtered = filtered.filter((c) => c.provider === args.provider);
    }

    return filtered.map(toPublicConnection);
  },
});

/**
 * Gets a single gateway connection by ID.
 * Returns public-safe summary without credentials.
 */
export const getConnection = query({
  args: {
    connectionId: v.id("payment_gateway_connections"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) return null;
    return toPublicConnection(connection);
  },
});

/**
 * Server-side authenticated query to retrieve encrypted credentials for a connection.
 * Used exclusively by server-side payment adapters. Decryption occurs only in server memory.
 */
export const getConnectionCredentials = query({
  args: {
    connectionId: v.optional(v.id("payment_gateway_connections")),
    organizationId: v.optional(v.id("organizations")),
    provider: v.optional(v.string()),
    accountMode: v.optional(v.union(v.literal("test"), v.literal("live"))),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    let connection: any = null;

    if (args.connectionId) {
      connection = await ctx.db.get(args.connectionId);
      if (connection && connection.organizationId !== org._id) {
        throw new Error("Forbidden: Access denied to connection outside current store.");
      }
    } else if (args.provider) {
      const connections = await ctx.db
        .query("payment_gateway_connections")
        .withIndex("by_org_and_provider", (q) =>
          q.eq("organizationId", org._id).eq("provider", args.provider!)
        )
        .collect();

      if (args.accountMode) {
        connection = connections.find(
          (c) => c.accountMode === args.accountMode && c.status === "connected"
        );
      }
      if (!connection) {
        connection =
          connections.find((c) => c.isDefault && c.status === "connected") ||
          connections.find((c) => c.status === "connected") ||
          connections[0];
      }
    }

    if (!connection) return null;

    return {
      connectionId: connection._id,
      organizationId: connection.organizationId,
      provider: connection.provider,
      connectionType: connection.connectionType,
      providerAccountId: connection.providerAccountId,
      merchantName: connection.merchantName,
      accountMode: connection.accountMode,
      status: connection.status,
      encryptedCredentials: connection.encryptedCredentials,
      encryptionKeyVersion: connection.encryptionKeyVersion,
      connectedAt: connection.connectedAt,
      lastVerifiedAt: connection.lastVerifiedAt,
      metadata: connection.metadata,
    };
  },
});

/**
 * Updates merchant metadata on an existing connection.
 */
export const updateConnectionMetadata = mutation({
  args: {
    connectionId: v.id("payment_gateway_connections"),
    merchantName: v.optional(v.string()),
    providerAccountId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new Error("Connection not found");

    const patch: any = { updatedAt: Date.now() };
    if (args.merchantName !== undefined) patch.merchantName = args.merchantName;
    if (args.providerAccountId !== undefined) patch.providerAccountId = args.providerAccountId;
    if (args.metadata !== undefined) {
      patch.metadata = { ...(conn.metadata || {}), ...args.metadata };
    }

    await ctx.db.patch(args.connectionId, patch);
    return args.connectionId;
  },
});

/**
 * Creates or updates a polymorphic payment gateway connection.
 * Encrypts sensitive credentials server-side using versioned authenticated AES-256-GCM.
 */
export const saveConnection = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    provider: v.string(), // "razorpay" | "stripe" | "paypal"
    connectionType: v.union(v.literal("api_key"), v.literal("oauth")),
    providerAccountId: v.optional(v.string()),
    merchantName: v.optional(v.string()),
    accountMode: v.union(v.literal("test"), v.literal("live")),
    status: v.union(
      v.literal("pending"),
      v.literal("connected"),
      v.literal("needs_attention"),
      v.literal("disconnected"),
      v.literal("error")
    ),
    rawCredentials: v.optional(
      v.object({
        keyId: v.optional(v.string()),
        keySecret: v.optional(v.string()),
        accessToken: v.optional(v.string()),
        refreshToken: v.optional(v.string()),
        webhookSecret: v.optional(v.string()),
      })
    ),
    isDefault: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const now = Date.now();

    // Check if an existing connection exists for this provider & mode
    const existingConnections = await ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_org_and_provider", (q) =>
        q.eq("organizationId", org._id).eq("provider", args.provider)
      )
      .collect();

    const existing = existingConnections.find((c) => {
      if (c.accountMode !== args.accountMode) return false;
      if (args.providerAccountId && c.providerAccountId) {
        return c.providerAccountId === args.providerAccountId;
      }
      return true;
    });

    let encryptedCredentials = existing?.encryptedCredentials;
    let encryptionKeyVersion = existing?.encryptionKeyVersion;
    let credentialsUpdatedAt = existing?.credentialsUpdatedAt;

    if (args.rawCredentials) {
      const encrypted = await encryptCredentials(args.rawCredentials, 1);
      encryptedCredentials = encrypted.encryptedString;
      encryptionKeyVersion = encrypted.version;
      credentialsUpdatedAt = now;
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        connectionType: args.connectionType,
        providerAccountId: args.providerAccountId ?? existing.providerAccountId,
        merchantName: args.merchantName ?? existing.merchantName,
        status: args.status,
        encryptedCredentials,
        encryptionKeyVersion,
        credentialsUpdatedAt,
        connectedAt: args.status === "connected" ? (existing.connectedAt ?? now) : existing.connectedAt,
        disconnectedAt: args.status === "disconnected" ? now : undefined,
        lastVerifiedAt: args.status === "connected" ? now : existing.lastVerifiedAt,
        isDefault: args.isDefault ?? existing.isDefault,
        metadata: args.metadata ?? existing.metadata,
        updatedAt: now,
      });

      return existing._id;
    }

    // If marked as default, unset previous default
    if (args.isDefault) {
      for (const conn of existingConnections) {
        if (conn.isDefault) {
          await ctx.db.patch(conn._id, { isDefault: false, updatedAt: now });
        }
      }
    }

    const connectionId = await ctx.db.insert("payment_gateway_connections", {
      organizationId: org._id,
      provider: args.provider,
      connectionType: args.connectionType,
      providerAccountId: args.providerAccountId,
      merchantName: args.merchantName,
      accountMode: args.accountMode,
      status: args.status,
      encryptedCredentials,
      encryptionKeyVersion,
      credentialsUpdatedAt,
      connectedAt: args.status === "connected" ? now : undefined,
      disconnectedAt: undefined,
      lastVerifiedAt: args.status === "connected" ? now : undefined,
      isDefault: args.isDefault ?? existingConnections.length === 0,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return connectionId;
  },
});

// =========================================================================
// TRANSACTIONS
// =========================================================================

/**
 * Idempotently records or updates a payment transaction.
 */
export const recordTransaction = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    connectionId: v.id("payment_gateway_connections"),
    providerPaymentId: v.string(),
    providerOrderId: v.optional(v.string()),
    internalOrderId: v.optional(v.id("orders")),
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    amountMinor: v.number(),
    currency: v.string(),
    paymentMethod: v.string(),
    status: v.union(
      v.literal("created"),
      v.literal("authorized"),
      v.literal("captured"),
      v.literal("failed"),
      v.literal("pending"),
      v.literal("refunded"),
      v.literal("partially_refunded"),
      v.literal("cancelled")
    ),
    providerStatus: v.string(),
    paidAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    refundedAmountMinor: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new Error("Connection not found");

    const orgId = args.organizationId ?? conn.organizationId;
    const now = Date.now();

    // Enforce idempotency via composite index
    const existing = await ctx.db
      .query("payment_transactions")
      .withIndex("by_connection_and_provider_payment", (q) =>
        q.eq("connectionId", args.connectionId).eq("providerPaymentId", args.providerPaymentId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        providerOrderId: args.providerOrderId ?? existing.providerOrderId,
        internalOrderId: args.internalOrderId ?? existing.internalOrderId,
        status: args.status,
        providerStatus: args.providerStatus,
        paidAt: args.paidAt ?? existing.paidAt,
        failedAt: args.failedAt ?? existing.failedAt,
        errorCode: args.errorCode,
        errorMessage: args.errorMessage,
        refundedAmountMinor: args.refundedAmountMinor ?? existing.refundedAmountMinor,
        metadata: args.metadata ?? existing.metadata,
        updatedAt: now,
      });

      return { transactionId: existing._id, alreadyExists: true };
    }

    const transactionId = await ctx.db.insert("payment_transactions", {
      organizationId: orgId,
      connectionId: args.connectionId,
      provider: conn.provider,
      providerPaymentId: args.providerPaymentId,
      providerOrderId: args.providerOrderId,
      internalOrderId: args.internalOrderId,
      customerId: args.customerId,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      amountMinor: args.amountMinor,
      currency: args.currency,
      paymentMethod: args.paymentMethod,
      status: args.status,
      providerStatus: args.providerStatus,
      paidAt: args.paidAt,
      failedAt: args.failedAt,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      refundedAmountMinor: args.refundedAmountMinor ?? 0,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    // Reconcile any existing unlinked refunds for this payment
    const pendingRefunds = await ctx.db
      .query("payment_refunds")
      .withIndex("by_provider_payment_id", (q) =>
        q.eq("providerPaymentId", args.providerPaymentId)
      )
      .collect();

    for (const rf of pendingRefunds) {
      if (!rf.transactionId) {
        await ctx.db.patch(rf._id, { transactionId, updatedAt: now });
      }
    }

    return { transactionId, alreadyExists: false };
  },
});

// =========================================================================
// REFUNDS
// =========================================================================

/**
 * Idempotently records a refund against a payment transaction.
 */
export const recordRefund = mutation({
  args: {
    connectionId: v.id("payment_gateway_connections"),
    transactionId: v.optional(v.id("payment_transactions")),
    providerPaymentId: v.optional(v.string()),
    providerRefundId: v.string(),
    amountMinor: v.number(),
    currency: v.string(),
    reason: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    providerStatus: v.string(),
    speed: v.optional(v.string()),
    initiatedAt: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new Error("Connection not found");

    let txn: any = null;
    let resolvedTransactionId = args.transactionId;

    if (resolvedTransactionId) {
      txn = await ctx.db.get(resolvedTransactionId);
    } else if (args.providerPaymentId) {
      txn = await ctx.db
        .query("payment_transactions")
        .withIndex("by_connection_and_provider_payment", (q) =>
          q.eq("connectionId", args.connectionId).eq("providerPaymentId", args.providerPaymentId!)
        )
        .first();
      if (txn) {
        resolvedTransactionId = txn._id;
      }
    }

    const providerPaymentId = args.providerPaymentId || txn?.providerPaymentId || "";
    const organizationId = txn?.organizationId || conn.organizationId;
    const now = Date.now();

    // Enforce idempotency
    const existing = await ctx.db
      .query("payment_refunds")
      .withIndex("by_connection_and_provider_refund", (q) =>
        q.eq("connectionId", args.connectionId).eq("providerRefundId", args.providerRefundId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        transactionId: resolvedTransactionId ?? existing.transactionId,
        providerPaymentId: providerPaymentId || existing.providerPaymentId,
        status: args.status,
        providerStatus: args.providerStatus,
        speed: args.speed ?? existing.speed,
        processedAt: args.processedAt ?? existing.processedAt,
        errorCode: args.errorCode,
        errorMessage: args.errorMessage,
        updatedAt: now,
      });

      // Update aggregate refunded amount on the parent transaction if resolved
      if (resolvedTransactionId && (args.status === "processed" || existing.status === "processed")) {
        const allRefunds = await ctx.db
          .query("payment_refunds")
          .withIndex("by_transaction", (q) => q.eq("transactionId", resolvedTransactionId!))
          .collect();

        const totalRefunded = allRefunds
          .filter((r) => r.status === "processed")
          .reduce((sum, r) => sum + r.amountMinor, 0);

        const currentTxn = txn || (await ctx.db.get(resolvedTransactionId));
        if (currentTxn) {
          const isFullyRefunded = totalRefunded >= currentTxn.amountMinor;
          await ctx.db.patch(currentTxn._id, {
            refundedAmountMinor: totalRefunded,
            status: isFullyRefunded ? "refunded" : "partially_refunded",
            updatedAt: now,
          });
        }
      }

      return { refundId: existing._id, alreadyExists: true };
    }

    const refundId = await ctx.db.insert("payment_refunds", {
      organizationId,
      connectionId: args.connectionId,
      transactionId: resolvedTransactionId,
      provider: conn.provider,
      providerRefundId: args.providerRefundId,
      providerPaymentId,
      amountMinor: args.amountMinor,
      currency: args.currency,
      reason: args.reason,
      status: args.status,
      providerStatus: args.providerStatus,
      speed: args.speed,
      initiatedAt: args.initiatedAt ?? now,
      processedAt: args.processedAt,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    // Update aggregate refunded amount on the parent transaction
    if (resolvedTransactionId && args.status === "processed") {
      const allRefunds = await ctx.db
        .query("payment_refunds")
        .withIndex("by_transaction", (q) => q.eq("transactionId", resolvedTransactionId!))
        .collect();

      const totalRefunded = allRefunds
        .filter((r) => r.status === "processed" || r._id === refundId)
        .reduce((sum, r) => sum + r.amountMinor, 0);

      const currentTxn = txn || (await ctx.db.get(resolvedTransactionId));
      if (currentTxn) {
        const isFullyRefunded = totalRefunded >= currentTxn.amountMinor;
        await ctx.db.patch(currentTxn._id, {
          refundedAmountMinor: totalRefunded,
          status: isFullyRefunded ? "refunded" : "partially_refunded",
          updatedAt: now,
        });
      }
    }

    return { refundId, alreadyExists: false };
  },
});

// =========================================================================
// SETTLEMENTS
// =========================================================================

/**
 * Idempotently records merchant settlement / payout.
 */
export const recordSettlement = mutation({
  args: {
    connectionId: v.id("payment_gateway_connections"),
    providerSettlementId: v.string(),
    amountMinor: v.number(),
    currency: v.string(),
    feesMinor: v.optional(v.number()),
    taxMinor: v.optional(v.number()),
    netAmountMinor: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("partially_processed")
    ),
    providerStatus: v.string(),
    settlementDate: v.number(),
    utrOrReference: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new Error("Connection not found");

    const now = Date.now();

    const existing = await ctx.db
      .query("payment_settlements")
      .withIndex("by_connection_and_provider_settlement", (q) =>
        q.eq("connectionId", args.connectionId).eq("providerSettlementId", args.providerSettlementId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        providerStatus: args.providerStatus,
        utrOrReference: args.utrOrReference ?? existing.utrOrReference,
        updatedAt: now,
      });
      return { settlementId: existing._id, alreadyExists: true };
    }

    const settlementId = await ctx.db.insert("payment_settlements", {
      organizationId: conn.organizationId,
      connectionId: args.connectionId,
      provider: conn.provider,
      providerSettlementId: args.providerSettlementId,
      amountMinor: args.amountMinor,
      currency: args.currency,
      feesMinor: args.feesMinor,
      taxMinor: args.taxMinor,
      netAmountMinor: args.netAmountMinor,
      status: args.status,
      providerStatus: args.providerStatus,
      settlementDate: args.settlementDate,
      utrOrReference: args.utrOrReference,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return { settlementId, alreadyExists: false };
  },
});

// =========================================================================
// WEBHOOK EVENTS
// =========================================================================

/**
 * Idempotently records an incoming webhook event.
 */
export const recordWebhookEvent = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    connectionId: v.optional(v.id("payment_gateway_connections")),
    provider: v.string(),
    providerEventId: v.string(),
    eventType: v.string(),
    eventCategory: v.optional(v.string()),
    payload: v.string(),
    signatureVerified: v.boolean(),
    processingStatus: v.union(
      v.literal("received"),
      v.literal("verified"),
      v.literal("processing"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("ignored")
    ),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const now = Date.now();

    // Enforce idempotency via provider and event ID
    const existing = await ctx.db
      .query("payment_webhook_events")
      .withIndex("by_provider_and_event_id", (q) =>
        q.eq("provider", args.provider).eq("providerEventId", args.providerEventId)
      )
      .first();

    if (existing) {
      return { eventId: existing._id, alreadyExists: true, processingStatus: existing.processingStatus };
    }

    const eventId = await ctx.db.insert("payment_webhook_events", {
      organizationId: org._id,
      connectionId: args.connectionId,
      provider: args.provider,
      providerEventId: args.providerEventId,
      eventType: args.eventType,
      eventCategory: args.eventCategory,
      payload: args.payload,
      signatureVerified: args.signatureVerified,
      processingStatus: args.processingStatus,
      attemptCount: 1,
      receivedAt: now,
      processedAt: args.processingStatus === "processed" ? now : undefined,
      lastError: args.lastError,
      createdAt: now,
      updatedAt: now,
    });

    return { eventId, alreadyExists: false, processingStatus: args.processingStatus };
  },
});

// =========================================================================
// SYNC RUNS & CURSORS
// =========================================================================

/**
 * Records a sync run execution.
 */
export const recordSyncRun = mutation({
  args: {
    connectionId: v.id("payment_gateway_connections"),
    resourceType: v.union(
      v.literal("transactions"),
      v.literal("refunds"),
      v.literal("settlements")
    ),
    syncType: v.union(
      v.literal("initial"),
      v.literal("incremental"),
      v.literal("manual"),
      v.literal("scheduled")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("partial"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    recordsFetched: v.number(),
    recordsCreated: v.number(),
    recordsUpdated: v.number(),
    recordsSkipped: v.number(),
    errorCount: v.number(),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new Error("Connection not found");
    const now = Date.now();

    const runId = await ctx.db.insert("payment_sync_runs", {
      organizationId: conn.organizationId,
      connectionId: args.connectionId,
      provider: conn.provider,
      resourceType: args.resourceType,
      syncType: args.syncType,
      status: args.status,
      startedAt: args.startedAt,
      completedAt: args.completedAt,
      recordsFetched: args.recordsFetched,
      recordsCreated: args.recordsCreated,
      recordsUpdated: args.recordsUpdated,
      recordsSkipped: args.recordsSkipped,
      errorCount: args.errorCount,
      lastError: args.lastError,
      createdAt: now,
      updatedAt: now,
    });

    // Update connection's lastSyncAt
    if (args.status === "completed") {
      await ctx.db.patch(conn._id, {
        lastSyncAt: now,
        updatedAt: now,
      });
    }

    return runId;
  },
});

/**
 * Updates or advances a sync cursor checkpoint for a given resource.
 */
export const updateSyncCursor = mutation({
  args: {
    connectionId: v.id("payment_gateway_connections"),
    resourceType: v.union(
      v.literal("transactions"),
      v.literal("refunds"),
      v.literal("settlements")
    ),
    cursor: v.optional(v.string()),
    lastSuccessfulSyncAt: v.number(),
  },
  handler: async (ctx, args) => {
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) throw new Error("Connection not found");
    const now = Date.now();

    const existing = await ctx.db
      .query("payment_sync_cursors")
      .withIndex("by_connection_and_resource", (q) =>
        q.eq("connectionId", args.connectionId).eq("resourceType", args.resourceType)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        cursor: args.cursor,
        lastSuccessfulSyncAt: args.lastSuccessfulSyncAt,
        updatedAt: now,
      });
      return existing._id;
    }

    const cursorId = await ctx.db.insert("payment_sync_cursors", {
      organizationId: conn.organizationId,
      connectionId: args.connectionId,
      provider: conn.provider,
      resourceType: args.resourceType,
      cursor: args.cursor,
      lastSuccessfulSyncAt: args.lastSuccessfulSyncAt,
      updatedAt: now,
    });

    return cursorId;
  },
});

// =========================================================================
// QUERY ENDPOINTS: TRANSACTIONS, REFUNDS, SETTLEMENTS, SYNC
// =========================================================================

/**
 * Lists payment transactions for the store organization with filtering and pagination.
 */
export const listTransactions = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    connectionId: v.optional(v.id("payment_gateway_connections")),
    status: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    let records: any[] = [];
    if (args.connectionId) {
      records = await ctx.db
        .query("payment_transactions")
        .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId!))
        .collect();
    } else {
      records = await ctx.db
        .query("payment_transactions")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .collect();
    }

    // Filter within store boundary
    records = records.filter((r) => r.organizationId === org._id);

    if (args.status) {
      records = records.filter((r) => r.status === args.status);
    }
    if (args.paymentMethod) {
      const pm = args.paymentMethod.toLowerCase();
      records = records.filter((r) => (r.paymentMethod || "").toLowerCase() === pm);
    }
    if (args.from !== undefined) {
      records = records.filter((r) => r.createdAt >= args.from!);
    }
    if (args.to !== undefined) {
      records = records.filter((r) => r.createdAt <= args.to!);
    }
    if (args.search) {
      const s = args.search.toLowerCase().trim();
      records = records.filter(
        (r) =>
          r.providerPaymentId.toLowerCase().includes(s) ||
          (r.customerEmail && r.customerEmail.toLowerCase().includes(s)) ||
          (r.customerName && r.customerName.toLowerCase().includes(s)) ||
          (r.customerPhone && r.customerPhone.toLowerCase().includes(s))
      );
    }

    // Sort by createdAt descending
    records.sort((a, b) => b.createdAt - a.createdAt);

    const total = records.length;
    const page = Math.max(args.page || 1, 1);
    const limit = Math.min(Math.max(args.limit || 10, 1), 100);
    const skip = (page - 1) * limit;
    const paginated = records.slice(skip, skip + limit);
    const hasMore = skip + limit < total;

    return {
      transactions: paginated,
      total,
      page,
      limit,
      hasMore,
    };
  },
});

/**
 * Lists refunds for the store organization with filtering and pagination.
 */
export const listRefunds = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    connectionId: v.optional(v.id("payment_gateway_connections")),
    status: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    let records: any[] = [];
    if (args.connectionId) {
      records = await ctx.db
        .query("payment_refunds")
        .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId!))
        .collect();
    } else {
      records = await ctx.db
        .query("payment_refunds")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .collect();
    }

    records = records.filter((r) => r.organizationId === org._id);

    if (args.status) {
      records = records.filter((r) => r.status === args.status);
    }
    if (args.providerPaymentId) {
      records = records.filter((r) => r.providerPaymentId === args.providerPaymentId);
    }
    if (args.from !== undefined) {
      records = records.filter((r) => r.initiatedAt >= args.from!);
    }
    if (args.to !== undefined) {
      records = records.filter((r) => r.initiatedAt <= args.to!);
    }
    if (args.search) {
      const s = args.search.toLowerCase().trim();
      records = records.filter(
        (r) =>
          r.providerRefundId.toLowerCase().includes(s) ||
          r.providerPaymentId.toLowerCase().includes(s) ||
          (r.reason && r.reason.toLowerCase().includes(s))
      );
    }

    records.sort((a, b) => b.initiatedAt - a.initiatedAt);

    const total = records.length;
    const page = Math.max(args.page || 1, 1);
    const limit = Math.min(Math.max(args.limit || 10, 1), 100);
    const skip = (page - 1) * limit;
    const paginated = records.slice(skip, skip + limit);
    const hasMore = skip + limit < total;

    return {
      refunds: paginated,
      total,
      page,
      limit,
      hasMore,
    };
  },
});

/**
 * Lists settlements for the store organization with filtering and pagination.
 */
export const listSettlements = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    connectionId: v.optional(v.id("payment_gateway_connections")),
    status: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    search: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    let records: any[] = [];
    if (args.connectionId) {
      records = await ctx.db
        .query("payment_settlements")
        .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId!))
        .collect();
    } else {
      records = await ctx.db
        .query("payment_settlements")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .collect();
    }

    records = records.filter((r) => r.organizationId === org._id);

    if (args.status) {
      records = records.filter((r) => r.status === args.status);
    }
    if (args.from !== undefined) {
      records = records.filter((r) => r.settlementDate >= args.from!);
    }
    if (args.to !== undefined) {
      records = records.filter((r) => r.settlementDate <= args.to!);
    }
    if (args.search) {
      const s = args.search.toLowerCase().trim();
      records = records.filter(
        (r) =>
          r.providerSettlementId.toLowerCase().includes(s) ||
          (r.utrOrReference && r.utrOrReference.toLowerCase().includes(s))
      );
    }

    records.sort((a, b) => b.settlementDate - a.settlementDate);

    const total = records.length;
    const page = Math.max(args.page || 1, 1);
    const limit = Math.min(Math.max(args.limit || 10, 1), 100);
    const skip = (page - 1) * limit;
    const paginated = records.slice(skip, skip + limit);
    const hasMore = skip + limit < total;

    return {
      settlements: paginated,
      total,
      page,
      limit,
      hasMore,
    };
  },
});

/**
 * Validates a payment transaction for refund eligibility and computes the remaining refundable balance.
 */
export const getTransactionForRefund = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    providerPaymentId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    const txn = await ctx.db
      .query("payment_transactions")
      .withIndex("by_provider_and_payment_id", (q) =>
        q.eq("provider", "razorpay").eq("providerPaymentId", args.providerPaymentId)
      )
      .first();

    if (!txn || txn.organizationId !== org._id) {
      return null;
    }

    const conn = await ctx.db.get(txn.connectionId);
    const totalRefunded = txn.refundedAmountMinor || 0;
    const refundableBalance = Math.max(txn.amountMinor - totalRefunded, 0);

    return {
      transactionId: txn._id,
      connectionId: txn.connectionId,
      provider: txn.provider,
      providerPaymentId: txn.providerPaymentId,
      amountMinor: txn.amountMinor,
      currency: txn.currency,
      refundedAmountMinor: totalRefunded,
      refundableBalanceMinor: refundableBalance,
      status: txn.status,
      isEligibleForRefund:
        (txn.status === "captured" || txn.status === "partially_refunded") &&
        refundableBalance > 0,
      connectionStatus: conn?.status,
    };
  },
});

/**
 * Retrieves the current synchronization status and cursors for a connection.
 */
export const getSyncStatus = query({
  args: {
    connectionId: v.id("payment_gateway_connections"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const conn = await ctx.db.get(args.connectionId);
    if (!conn) return null;

    const cursors = await ctx.db
      .query("payment_sync_cursors")
      .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId))
      .collect();

    const runs = await ctx.db
      .query("payment_sync_runs")
      .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId))
      .collect();

    runs.sort((a, b) => b.startedAt - a.startedAt);

    return {
      lastSyncAt: conn.lastSyncAt,
      cursors: cursors.map((c) => ({
        resourceType: c.resourceType,
        lastSuccessfulSyncAt: c.lastSuccessfulSyncAt,
      })),
      recentRuns: runs.slice(0, 5),
    };
  },
});

