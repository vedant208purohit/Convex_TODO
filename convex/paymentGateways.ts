import { mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth, resolveStoreOrganization } from "./organizationUsers";
import { encryptCredentials, decryptCredentials, maskKeyIdentifier } from "./paymentGatewayCrypto";
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

    // Enforce idempotency & match existing reservation if present
    const idempotencyKey = args.metadata?.idempotencyKey;
    let existing = await ctx.db
      .query("payment_refunds")
      .withIndex("by_connection_and_provider_refund", (q) =>
        q.eq("connectionId", args.connectionId).eq("providerRefundId", args.providerRefundId)
      )
      .first();

    if (!existing && idempotencyKey) {
      const existingRefunds = await ctx.db
        .query("payment_refunds")
        .withIndex("by_provider_payment_id", (q) => q.eq("providerPaymentId", providerPaymentId))
        .collect();
      existing = existingRefunds.find(
        (r) => r.metadata?.idempotencyKey === idempotencyKey
      ) || null;
    }

    if (existing) {
      const shouldUpdateStatus = canTransitionRefund(existing.status, args.status);
      const patchData: any = {
        transactionId: resolvedTransactionId ?? existing.transactionId,
        providerPaymentId: providerPaymentId || existing.providerPaymentId,
        providerRefundId: args.providerRefundId, // Reconcile pending reservation ID with real Razorpay ID
        providerStatus: args.providerStatus,
        speed: args.speed ?? existing.speed,
        processedAt: args.processedAt ?? (args.status === "processed" ? now : existing.processedAt),
        errorCode: args.errorCode,
        errorMessage: args.errorMessage,
        updatedAt: now,
      };

      if (shouldUpdateStatus) {
        patchData.status = args.status;
      }

      await ctx.db.patch(existing._id, patchData);

      // Update aggregate refunded amount on the parent transaction if resolved
      if (resolvedTransactionId && (args.status === "processed" || existing.status === "processed")) {
        const allRefunds = await ctx.db
          .query("payment_refunds")
          .withIndex("by_transaction", (q) => q.eq("transactionId", resolvedTransactionId!))
          .collect();

        const totalRefunded = allRefunds
          .filter((r) => r.status === "processed" || (r._id === existing._id && args.status === "processed"))
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
      processedAt: args.processedAt ?? (args.status === "processed" ? now : undefined),
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

/**
 * Durable refund reservation mutation.
 * Reserves a refund before sending request to Razorpay, preventing concurrent duplicate submissions.
 */
export const reserveRefund = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    connectionId: v.id("payment_gateway_connections"),
    providerPaymentId: v.string(),
    amountMinor: v.number(),
    idempotencyKey: v.string(),
    reason: v.optional(v.string()),
    speed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const now = Date.now();

    // 1. Check existing refunds for this payment
    const existingRefunds = await ctx.db
      .query("payment_refunds")
      .withIndex("by_provider_payment_id", (q) =>
        q.eq("providerPaymentId", args.providerPaymentId)
      )
      .collect();

    // Look for duplicate idempotency key
    const matching = existingRefunds.find(
      (r) => r.metadata?.idempotencyKey === args.idempotencyKey
    );

    if (matching) {
      if (matching.status === "processed") {
        return {
          alreadyProcessed: true,
          refundId: matching._id,
          providerRefundId: matching.providerRefundId,
          amountMinor: matching.amountMinor,
          status: matching.status,
        };
      }
      // If pending reservation exists and is < 60 seconds old, block concurrent duplicate
      if (matching.status === "pending" && now - (matching.createdAt || 0) < 60 * 1000) {
        throw new Error(
          "REFUND_IN_PROGRESS: A refund request for this payment is currently being processed. Please wait."
        );
      }
      // If older than 60s and still pending, allow reuse
      return {
        alreadyProcessed: false,
        refundId: matching._id,
        idempotencyKey: args.idempotencyKey,
        reused: true,
      };
    }

    // 2. Validate transaction & balance
    const txn = await ctx.db
      .query("payment_transactions")
      .withIndex("by_provider_and_payment_id", (q) =>
        q.eq("provider", "razorpay").eq("providerPaymentId", args.providerPaymentId)
      )
      .first();

    if (!txn || txn.organizationId !== org._id) {
      throw new Error("Payment not found for this store.");
    }

    if (txn.status !== "captured" && txn.status !== "partially_refunded") {
      throw new Error(`Payment is not eligible for refund (current status: "${txn.status}").`);
    }

    // Sum all processed refunds + active pending reservations (within last 60s)
    const activeRefunds = existingRefunds.filter(
      (r) => r.status === "processed" || (r.status === "pending" && now - (r.createdAt || 0) < 60 * 1000)
    );
    const totalCommittedOrReserved = activeRefunds.reduce((sum, r) => sum + r.amountMinor, 0);
    const remainingBalance = txn.amountMinor - totalCommittedOrReserved;

    if (args.amountMinor > remainingBalance) {
      throw new Error(
        `REFUND_AMOUNT_EXCEEDS_BALANCE: Remaining refundable balance is ₹${(remainingBalance / 100).toFixed(2)}.`
      );
    }

    // 3. Create durable pending reservation
    const reservationId = await ctx.db.insert("payment_refunds", {
      organizationId: org._id,
      connectionId: args.connectionId,
      transactionId: txn._id,
      provider: "razorpay",
      providerRefundId: `res_${args.idempotencyKey}`,
      providerPaymentId: args.providerPaymentId,
      amountMinor: args.amountMinor,
      currency: txn.currency || "INR",
      reason: args.reason,
      speed: args.speed || "normal",
      status: "pending",
      providerStatus: "reserved",
      initiatedAt: now,
      metadata: {
        idempotencyKey: args.idempotencyKey,
        isReservation: true,
        reservedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    });

    return {
      alreadyProcessed: false,
      refundId: reservationId,
      idempotencyKey: args.idempotencyKey,
    };
  },
});

/**
 * Cancels a pending refund reservation if Razorpay API call fails.
 */
export const cancelReservedRefund = mutation({
  args: {
    refundId: v.id("payment_refunds"),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const refund = await ctx.db.get(args.refundId);
    if (!refund) return;
    if (refund.status === "pending") {
      await ctx.db.patch(args.refundId, {
        status: "failed",
        providerStatus: "reservation_failed",
        errorCode: args.errorCode,
        errorMessage: args.errorMessage,
        updatedAt: Date.now(),
      });
    }
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
    if (args.connectionId && args.status) {
      records = await ctx.db
        .query("payment_transactions")
        .withIndex("by_connection_and_status", (q) =>
          q.eq("connectionId", args.connectionId!).eq("status", args.status as any)
        )
        .order("desc")
        .collect();
    } else if (args.connectionId) {
      let q = ctx.db
        .query("payment_transactions")
        .withIndex("by_connection_and_created_at", (q: any) => {
          let builder: any = q.eq("connectionId", args.connectionId!);
          if (args.from !== undefined) {
            builder = builder.gte("createdAt", args.from);
          }
          return builder;
        })
        .order("desc");
      records = await q.collect();
    } else {
      let q = ctx.db
        .query("payment_transactions")
        .withIndex("by_org_and_created_at", (q: any) => {
          let builder: any = q.eq("organizationId", org._id);
          if (args.from !== undefined) {
            builder = builder.gte("createdAt", args.from);
          }
          return builder;
        })
        .order("desc");
      records = await q.collect();
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
    if (args.connectionId && args.status) {
      records = await ctx.db
        .query("payment_refunds")
        .withIndex("by_connection_and_status", (q) =>
          q.eq("connectionId", args.connectionId!).eq("status", args.status as any)
        )
        .order("desc")
        .collect();
    } else if (args.connectionId) {
      let q = ctx.db
        .query("payment_refunds")
        .withIndex("by_connection_and_initiated_at", (q: any) => {
          let builder: any = q.eq("connectionId", args.connectionId!);
          if (args.from !== undefined) {
            builder = builder.gte("initiatedAt", args.from);
          }
          return builder;
        })
        .order("desc");
      records = await q.collect();
    } else {
      let q = ctx.db
        .query("payment_refunds")
        .withIndex("by_org_and_initiated_at", (q: any) => {
          let builder: any = q.eq("organizationId", org._id);
          if (args.from !== undefined) {
            builder = builder.gte("initiatedAt", args.from);
          }
          return builder;
        })
        .order("desc");
      records = await q.collect();
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
    if (args.connectionId && args.status) {
      records = await ctx.db
        .query("payment_settlements")
        .withIndex("by_connection_and_status", (q) =>
          q.eq("connectionId", args.connectionId!).eq("status", args.status as any)
        )
        .order("desc")
        .collect();
    } else if (args.connectionId) {
      let q = ctx.db
        .query("payment_settlements")
        .withIndex("by_connection_and_settlement_date", (q: any) => {
          let builder: any = q.eq("connectionId", args.connectionId!);
          if (args.from !== undefined) {
            builder = builder.gte("settlementDate", args.from);
          }
          return builder;
        })
        .order("desc");
      records = await q.collect();
    } else {
      let q = ctx.db
        .query("payment_settlements")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .order("desc");
      records = await q.collect();
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
 * Retrieves a single settlement record by ID or providerSettlementId, scoped to the caller's store.
 */
export const getSettlement = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    settlementId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    // 1. Try finding by document _id
    let record: any = null;
    try {
      record = await ctx.db.get(args.settlementId as any);
      if (record && record.organizationId !== org._id) {
        record = null;
      }
    } catch {
      // not a document id, proceed
    }

    // 2. Try finding by providerSettlementId
    if (!record) {
      record = await ctx.db
        .query("payment_settlements")
        .withIndex("by_provider_settlement_id", (q) =>
          q.eq("providerSettlementId", args.settlementId)
        )
        .first();
      if (record && record.organizationId !== org._id) {
        record = null;
      }
    }

    return record;
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

// =========================================================================
// DASHBOARD ANALYTICS & WEBHOOK EVENT PROCESSING
// =========================================================================

/**
 * State transition safety matrix for transactions:
 * Terminal/captured states must not regress if delayed events arrive out-of-order.
 */
function canTransitionTransaction(currentStatus: string, newStatus: string): boolean {
  if (currentStatus === newStatus) return true;
  // If already refunded, never regress to any non-refunded state
  if (currentStatus === "refunded") return false;
  // If partially refunded, never regress to created/authorized/pending/failed
  if (currentStatus === "partially_refunded" && newStatus !== "refunded") return false;
  // If captured, never regress to authorized, pending, created, or failed
  if (
    currentStatus === "captured" &&
    (newStatus === "authorized" ||
      newStatus === "pending" ||
      newStatus === "created" ||
      newStatus === "failed")
  ) {
    return false;
  }
  return true;
}

/**
 * State transition safety matrix for refunds:
 * Terminal/processed states must not regress if delayed events arrive out-of-order.
 */
function canTransitionRefund(currentStatus: string, newStatus: string): boolean {
  if (currentStatus === newStatus) return true;
  // If already processed, never regress to pending, failed, or cancelled
  if (currentStatus === "processed") return false;
  // If failed or cancelled, do not regress to pending
  if ((currentStatus === "failed" || currentStatus === "cancelled") && newStatus === "pending") return false;
  return true;
}

/**
 * Retrieves aggregate payment analytics for the dashboard.
 * Evaluates metrics safely per currency, using store timezone calendar boundaries.
 * Optimized to query only relevant current-month date ranges using compound indexes.
 */
export const getDashboardAnalytics = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    connectionId: v.optional(v.id("payment_gateway_connections")),
    provider: v.optional(v.string()),
    startOfTodayMs: v.number(),
    endOfTodayMs: v.number(),
    startOfMonthMs: v.number(),
    endOfMonthMs: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const provider = args.provider || "razorpay";

    // 1. Fetch transactions for this store organization within the current month date range
    const queryStartMs = Math.min(args.startOfMonthMs, args.startOfTodayMs) - 24 * 60 * 60 * 1000;
    let txns: any[];
    if (args.connectionId) {
      txns = await ctx.db
        .query("payment_transactions")
        .withIndex("by_connection_and_created_at", (q) =>
          q.eq("connectionId", args.connectionId!).gte("createdAt", queryStartMs)
        )
        .collect();
    } else {
      txns = await ctx.db
        .query("payment_transactions")
        .withIndex("by_org_and_created_at", (q) =>
          q.eq("organizationId", org._id).gte("createdAt", queryStartMs)
        )
        .collect();
    }

    if (provider) {
      txns = txns.filter((t) => t.provider === provider);
    }

    // 2. Fetch refunds for this store organization within the current month date range
    let refunds: any[];
    if (args.connectionId) {
      refunds = await ctx.db
        .query("payment_refunds")
        .withIndex("by_connection_and_initiated_at", (q) =>
          q.eq("connectionId", args.connectionId!).gte("initiatedAt", queryStartMs)
        )
        .collect();
    } else {
      refunds = await ctx.db
        .query("payment_refunds")
        .withIndex("by_org_and_initiated_at", (q) =>
          q.eq("organizationId", org._id).gte("initiatedAt", queryStartMs)
        )
        .collect();
    }

    if (provider) {
      refunds = refunds.filter((r) => r.provider === provider);
    }

    const primaryCurrency = txns[0]?.currency || "INR";

    let todayGrossMinor = 0;
    let monthGrossMinor = 0;
    let todayRefundsMinor = 0;
    let monthRefundsMinor = 0;

    let successfulPayments = 0;
    let failedPayments = 0;
    let pendingPayments = 0;

    const currencies: Record<
      string,
      {
        todayGrossMinor: number;
        todayRefundsMinor: number;
        monthGrossMinor: number;
        monthRefundsMinor: number;
        successfulPayments: number;
        failedPayments: number;
        pendingPayments: number;
      }
    > = {};

    function getCurrencyBucket(curr: string) {
      if (!currencies[curr]) {
        currencies[curr] = {
          todayGrossMinor: 0,
          todayRefundsMinor: 0,
          monthGrossMinor: 0,
          monthRefundsMinor: 0,
          successfulPayments: 0,
          failedPayments: 0,
          pendingPayments: 0,
        };
      }
      return currencies[curr];
    }

    for (const t of txns) {
      const bucket = getCurrencyBucket(t.currency || primaryCurrency);
      const effectivePaidTime = t.paidAt || t.createdAt;

      if (t.status === "captured" || t.status === "partially_refunded" || t.status === "refunded") {
        successfulPayments++;
        bucket.successfulPayments++;

        if (effectivePaidTime >= args.startOfTodayMs && effectivePaidTime <= args.endOfTodayMs) {
          if (t.currency === primaryCurrency) {
            todayGrossMinor += t.amountMinor;
          }
          bucket.todayGrossMinor += t.amountMinor;
        }

        if (effectivePaidTime >= args.startOfMonthMs && effectivePaidTime <= args.endOfMonthMs) {
          if (t.currency === primaryCurrency) {
            monthGrossMinor += t.amountMinor;
          }
          bucket.monthGrossMinor += t.amountMinor;
        }
      } else if (t.status === "failed") {
        failedPayments++;
        bucket.failedPayments++;
      } else if (t.status === "pending" || t.status === "authorized" || t.status === "created") {
        pendingPayments++;
        bucket.pendingPayments++;
      }
    }

    let refundCount = 0;
    for (const r of refunds) {
      if (r.status === "processed") {
        refundCount++;
        const bucket = getCurrencyBucket(r.currency || primaryCurrency);
        const effectiveRefundTime = r.processedAt || r.initiatedAt;

        if (effectiveRefundTime >= args.startOfTodayMs && effectiveRefundTime <= args.endOfTodayMs) {
          if (r.currency === primaryCurrency) {
            todayRefundsMinor += r.amountMinor;
          }
          bucket.todayRefundsMinor += r.amountMinor;
        }

        if (effectiveRefundTime >= args.startOfMonthMs && effectiveRefundTime <= args.endOfMonthMs) {
          if (r.currency === primaryCurrency) {
            monthRefundsMinor += r.amountMinor;
          }
          bucket.monthRefundsMinor += r.amountMinor;
        }
      } else if (r.status === "pending") {
        refundCount++;
      }
    }

    const todayNetMinor = Math.max(todayGrossMinor - todayRefundsMinor, 0);
    const monthNetMinor = Math.max(monthGrossMinor - monthRefundsMinor, 0);

    const totalEvaluated = successfulPayments + failedPayments;
    const successRate =
      totalEvaluated > 0
        ? Math.round((successfulPayments / totalEvaluated) * 1000) / 10
        : 100;

    return {
      organizationId: org._id,
      primaryCurrency,
      todayRevenue: {
        grossMinor: todayGrossMinor,
        refundsMinor: todayRefundsMinor,
        netMinor: todayNetMinor,
        currency: primaryCurrency,
      },
      monthlyRevenue: {
        grossMinor: monthGrossMinor,
        refundsMinor: monthRefundsMinor,
        netMinor: monthNetMinor,
        currency: primaryCurrency,
      },
      successfulPayments,
      failedPayments,
      pendingPayments,
      refundCount,
      successRate,
      currencies,
    };
  },
});

/**
 * Idempotently and securely processes an incoming Razorpay webhook event.
 * Enforces atomic deduplication, state machine regression protection, and entity upserts.
 */
export const processWebhookEvent = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    connectionId: v.optional(v.id("payment_gateway_connections")),
    provider: v.string(), // "razorpay"
    providerEventId: v.string(),
    eventType: v.string(),
    payload: v.string(), // raw JSON string
    signatureVerified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const now = Date.now();

    // 1. Deduplication check via provider and providerEventId
    const existingEvent = await ctx.db
      .query("payment_webhook_events")
      .withIndex("by_provider_and_event_id", (q) =>
        q.eq("provider", args.provider).eq("providerEventId", args.providerEventId)
      )
      .first();

    if (existingEvent && existingEvent.processingStatus === "processed") {
      return {
        eventId: existingEvent._id,
        alreadyProcessed: true,
        status: "processed",
      };
    }

    // 2. Resolve connection if not explicitly provided
    let connectionId = args.connectionId;
    if (!connectionId) {
      const conn = await ctx.db
        .query("payment_gateway_connections")
        .withIndex("by_org_and_provider", (q) =>
          q.eq("organizationId", org._id).eq("provider", args.provider)
        )
        .first();
      if (conn) {
        connectionId = conn._id;
      }
    }

    // 3. Upsert the payment_webhook_events record
    let eventRecordId = existingEvent?._id;
    if (!existingEvent || !eventRecordId) {
      eventRecordId = await ctx.db.insert("payment_webhook_events", {
        organizationId: org._id,
        connectionId,
        provider: args.provider,
        providerEventId: args.providerEventId,
        eventType: args.eventType,
        payload: args.payload,
        signatureVerified: args.signatureVerified,
        processingStatus: "processing",
        attemptCount: 1,
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(eventRecordId, {
        processingStatus: "processing",
        attemptCount: (existingEvent.attemptCount || 1) + 1,
        updatedAt: now,
      });
    }

    // 4. Parse payload
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(args.payload);
    } catch (parseErr: any) {
      await ctx.db.patch(eventRecordId, {
        processingStatus: "failed",
        lastError: `Invalid JSON payload: ${parseErr.message}`,
        updatedAt: now,
      });
      return { eventId: eventRecordId, error: "Invalid JSON", success: false };
    }

    try {
      const eventType = args.eventType;

      if (
        eventType === "payment.authorized" ||
        eventType === "payment.captured" ||
        eventType === "payment.failed"
      ) {
        const payment =
          parsedPayload.payload?.payment?.entity ||
          parsedPayload.payment?.entity ||
          parsedPayload.payload?.payment ||
          parsedPayload.payment;

        if (!payment || !payment.id) {
          throw new Error("Missing payment entity in payload");
        }

        const providerPaymentId = payment.id;
        const rawStatus = payment.status;
        let normalizedStatus: "authorized" | "captured" | "failed" | "pending" = "pending";
        if (eventType === "payment.captured" || rawStatus === "captured") {
          normalizedStatus = "captured";
        } else if (eventType === "payment.failed" || rawStatus === "failed") {
          normalizedStatus = "failed";
        } else if (eventType === "payment.authorized" || rawStatus === "authorized") {
          normalizedStatus = "authorized";
        }

        const existingTxn = await ctx.db
          .query("payment_transactions")
          .withIndex("by_provider_and_payment_id", (q) =>
            q.eq("provider", args.provider).eq("providerPaymentId", providerPaymentId)
          )
          .first();

        if (existingTxn) {
          const shouldUpdateStatus = canTransitionTransaction(existingTxn.status, normalizedStatus);
          const patchData: any = {
            providerStatus: rawStatus || existingTxn.providerStatus,
            updatedAt: now,
          };

          if (shouldUpdateStatus) {
            patchData.status = normalizedStatus;
          }

          if (normalizedStatus === "captured") {
            patchData.paidAt = payment.created_at ? payment.created_at * 1000 : now;
          } else if (normalizedStatus === "failed") {
            patchData.failedAt = payment.created_at ? payment.created_at * 1000 : now;
            patchData.errorCode = payment.error_code || existingTxn.errorCode;
            patchData.errorMessage = payment.error_description || existingTxn.errorMessage;
          }

          if (payment.amount_refunded !== undefined) {
            patchData.refundedAmountMinor = payment.amount_refunded;
          }

          await ctx.db.patch(existingTxn._id, patchData);
        } else {
          if (!connectionId) {
            throw new Error(`Cannot create transaction: No connection found for provider ${args.provider}`);
          }

          const txnId = await ctx.db.insert("payment_transactions", {
            organizationId: org._id,
            connectionId,
            provider: args.provider,
            providerPaymentId,
            providerOrderId: payment.order_id,
            customerName: payment.notes?.customer_name || payment.notes?.name,
            customerEmail: payment.email,
            customerPhone: payment.contact,
            amountMinor: payment.amount || 0,
            currency: payment.currency || "INR",
            paymentMethod: payment.method || "card",
            status: normalizedStatus,
            providerStatus: rawStatus || normalizedStatus,
            paidAt:
              normalizedStatus === "captured"
                ? payment.created_at
                  ? payment.created_at * 1000
                  : now
                : undefined,
            failedAt:
              normalizedStatus === "failed"
                ? payment.created_at
                  ? payment.created_at * 1000
                  : now
                : undefined,
            errorCode: payment.error_code,
            errorMessage: payment.error_description,
            refundedAmountMinor: payment.amount_refunded || 0,
            metadata: payment.notes,
            createdAt: payment.created_at ? payment.created_at * 1000 : now,
            updatedAt: now,
          });

          // Link any orphaned refunds
          const orphanedRefunds = await ctx.db
            .query("payment_refunds")
            .withIndex("by_provider_payment_id", (q) =>
              q.eq("providerPaymentId", providerPaymentId)
            )
            .collect();
          for (const rf of orphanedRefunds) {
            if (!rf.transactionId) {
              await ctx.db.patch(rf._id, { transactionId: txnId, updatedAt: now });
            }
          }
        }
      } else if (
        eventType === "refund.created" ||
        eventType === "refund.processed" ||
        eventType === "refund.failed"
      ) {
        const refund =
          parsedPayload.payload?.refund?.entity ||
          parsedPayload.refund?.entity ||
          parsedPayload.payload?.refund ||
          parsedPayload.refund;

        if (!refund || !refund.id) {
          throw new Error("Missing refund entity in payload");
        }

        const providerRefundId = refund.id;
        const providerPaymentId = refund.payment_id;
        const refundStatus: "processed" | "pending" | "failed" | "cancelled" =
          eventType === "refund.failed" || refund.status === "failed"
            ? "failed"
            : eventType === "refund.processed" || refund.status === "processed"
            ? "processed"
            : refund.status === "cancelled"
            ? "cancelled"
            : "pending";

        const txn = await ctx.db
          .query("payment_transactions")
          .withIndex("by_provider_and_payment_id", (q) =>
            q.eq("provider", args.provider).eq("providerPaymentId", providerPaymentId)
          )
          .first();

        const resolvedConnectionId = connectionId || txn?.connectionId;
        if (!resolvedConnectionId) {
          throw new Error(`Cannot process refund: No connection found for provider ${args.provider}`);
        }

        let existingRefund = await ctx.db
          .query("payment_refunds")
          .withIndex("by_connection_and_provider_refund", (q) =>
            q.eq("connectionId", resolvedConnectionId).eq("providerRefundId", providerRefundId)
          )
          .first();

        // Check if an existing reservation matches by idempotencyKey
        const idempotencyKey = refund.notes?.idempotencyKey || refund.receipt;
        if (!existingRefund && idempotencyKey) {
          const allPaymentRefunds = await ctx.db
            .query("payment_refunds")
            .withIndex("by_provider_payment_id", (q) =>
              q.eq("providerPaymentId", providerPaymentId)
            )
            .collect();
          existingRefund = allPaymentRefunds.find(
            (r) => r.metadata?.idempotencyKey === idempotencyKey
          ) || null;
        }

        let refundDocId = existingRefund?._id;
        if (existingRefund) {
          const shouldUpdateStatus = canTransitionRefund(existingRefund.status, refundStatus);
          const patchData: any = {
            providerRefundId, // reconcile reservation ID if previously pending
            providerStatus: refund.status || refundStatus,
            speed: refund.speed_processed || refund.speed_requested || existingRefund.speed,
            updatedAt: now,
          };

          if (shouldUpdateStatus) {
            patchData.status = refundStatus;
            if (refundStatus === "processed") {
              patchData.processedAt = refund.created_at ? refund.created_at * 1000 : now;
            }
          }

          if (refund.error_code || refund.error_description) {
            patchData.errorCode = refund.error_code;
            patchData.errorMessage = refund.error_description;
          }

          await ctx.db.patch(existingRefund._id, patchData);
        } else {
          refundDocId = await ctx.db.insert("payment_refunds", {
            organizationId: org._id,
            connectionId: resolvedConnectionId,
            transactionId: txn?._id,
            provider: args.provider,
            providerRefundId,
            providerPaymentId,
            amountMinor: refund.amount || 0,
            currency: refund.currency || "INR",
            reason: refund.notes?.reason || refund.notes?.comment,
            status: refundStatus,
            providerStatus: refund.status || refundStatus,
            speed: refund.speed_processed || refund.speed_requested || "normal",
            initiatedAt: refund.created_at ? refund.created_at * 1000 : now,
            processedAt: refundStatus === "processed" ? (refund.created_at ? refund.created_at * 1000 : now) : undefined,
            errorCode: refund.error_code,
            errorMessage: refund.error_description,
            metadata: refund.notes,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Reconcile parent transaction refunded amount
        if (txn) {
          const allRefunds = await ctx.db
            .query("payment_refunds")
            .withIndex("by_provider_payment_id", (q) =>
              q.eq("providerPaymentId", providerPaymentId)
            )
            .collect();

          const totalRefunded = allRefunds
            .filter(
              (r) =>
                r.status === "processed" ||
                (r._id === refundDocId && refundStatus === "processed")
            )
            .reduce((sum, r) => sum + r.amountMinor, 0);

          const isFullyRefunded = totalRefunded >= txn.amountMinor;
          await ctx.db.patch(txn._id, {
            refundedAmountMinor: totalRefunded,
            status: isFullyRefunded ? "refunded" : totalRefunded > 0 ? "partially_refunded" : txn.status,
            updatedAt: now,
          });
        }
      } else if (eventType === "settlement.processed") {
        const settlement =
          parsedPayload.payload?.settlement?.entity ||
          parsedPayload.settlement?.entity ||
          parsedPayload.payload?.settlement ||
          parsedPayload.settlement;

        if (!settlement || !settlement.id) {
          throw new Error("Missing settlement entity in payload");
        }

        if (!connectionId) {
          throw new Error(
            `Cannot process settlement: No connection found for provider ${args.provider}`
          );
        }

        const providerSettlementId = settlement.id;
        const existingSettlement = await ctx.db
          .query("payment_settlements")
          .withIndex("by_connection_and_provider_settlement", (q) =>
            q
              .eq("connectionId", connectionId!)
              .eq("providerSettlementId", providerSettlementId)
          )
          .first();

        const amountMinor = settlement.amount || 0;
        const feesMinor = settlement.fees || 0;
        const taxMinor = settlement.tax || 0;
        const netAmountMinor = amountMinor - feesMinor - taxMinor;

        if (existingSettlement) {
          await ctx.db.patch(existingSettlement._id, {
            status: "processed",
            providerStatus: settlement.status || "processed",
            utrOrReference: settlement.utr || existingSettlement.utrOrReference,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("payment_settlements", {
            organizationId: org._id,
            connectionId,
            provider: args.provider,
            providerSettlementId,
            amountMinor,
            currency: settlement.currency || "INR",
            feesMinor,
            taxMinor,
            netAmountMinor,
            status: "processed",
            providerStatus: settlement.status || "processed",
            settlementDate: settlement.created_at ? settlement.created_at * 1000 : now,
            utrOrReference: settlement.utr,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        await ctx.db.patch(eventRecordId, {
          processingStatus: "ignored",
          updatedAt: now,
        });
        return { eventId: eventRecordId, success: true, ignored: true, eventType };
      }

      await ctx.db.patch(eventRecordId, {
        processingStatus: "processed",
        processedAt: now,
        updatedAt: now,
      });

      return {
        eventId: eventRecordId,
        success: true,
        eventType,
        status: "processed",
      };
    } catch (err: any) {
      await ctx.db.patch(eventRecordId, {
        processingStatus: "failed",
        lastError: err.message || "Failed processing webhook event",
        updatedAt: now,
      });
      return {
        eventId: eventRecordId,
        success: false,
        error: err.message || "Failed processing webhook event",
      };
    }
  },
});

// =========================================================================
// CONNECTION LIFECYCLE & INTEGRATION HEALTH
// =========================================================================

/**
 * Disconnects an active payment gateway connection safely.
 * Disables live processing and automatic sync while strictly preserving
 * all historical financial records (transactions, refunds, settlements, audit runs).
 */
export const disconnectGatewayConnection = mutation({
  args: {
    connectionId: v.optional(v.id("payment_gateway_connections")),
    organizationId: v.optional(v.id("organizations")),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const provider = args.provider || "razorpay";
    const now = Date.now();

    let conn: any = null;
    if (args.connectionId) {
      conn = await ctx.db.get(args.connectionId);
    } else {
      const connections = await ctx.db
        .query("payment_gateway_connections")
        .withIndex("by_org_and_provider", (q) =>
          q.eq("organizationId", org._id).eq("provider", provider)
        )
        .collect();
      conn =
        connections.find((c) => c.status === "connected") ||
        connections.find((c) => c.status === "needs_attention") ||
        connections[0];
    }

    if (!conn || conn.organizationId !== org._id) {
      throw new Error("Connection not found for this store.");
    }

    await ctx.db.patch(conn._id, {
      status: "disconnected",
      disconnectedAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      connectionId: conn._id,
      status: "disconnected",
      disconnectedAt: now,
      provider: conn.provider,
      merchantName: conn.merchantName,
    };
  },
});

/**
 * Reconnects a previously disconnected payment gateway connection.
 * Can reuse existing verified credentials or update them with freshly verified credentials.
 */
export const reconnectGatewayConnection = mutation({
  args: {
    connectionId: v.optional(v.id("payment_gateway_connections")),
    organizationId: v.optional(v.id("organizations")),
    provider: v.optional(v.string()),
    encryptedCredentials: v.optional(v.string()),
    encryptionKeyVersion: v.optional(v.number()),
    providerAccountId: v.optional(v.string()),
    accountMode: v.optional(v.union(v.literal("test"), v.literal("live"))),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const provider = args.provider || "razorpay";
    const now = Date.now();

    let conn: any = null;
    if (args.connectionId) {
      conn = await ctx.db.get(args.connectionId);
    } else {
      const connections = await ctx.db
        .query("payment_gateway_connections")
        .withIndex("by_org_and_provider", (q) =>
          q.eq("organizationId", org._id).eq("provider", provider)
        )
        .collect();
      conn =
        connections.find((c) => c.status === "disconnected") ||
        connections.find((c) => c.status === "needs_attention") ||
        connections[0];
    }

    if (!conn || conn.organizationId !== org._id) {
      throw new Error("Connection not found for this store.");
    }

    const patch: any = {
      status: "connected",
      disconnectedAt: undefined,
      lastVerifiedAt: now,
      updatedAt: now,
    };

    if (args.encryptedCredentials) {
      patch.encryptedCredentials = args.encryptedCredentials;
      patch.encryptionKeyVersion = args.encryptionKeyVersion || 1;
      patch.credentialsUpdatedAt = now;
    }

    if (args.providerAccountId) {
      patch.providerAccountId = args.providerAccountId;
    }

    if (args.accountMode) {
      patch.accountMode = args.accountMode;
    }

    await ctx.db.patch(conn._id, patch);

    const updated = await ctx.db.get(conn._id);
    return toPublicConnection(updated);
  },
});

/**
 * Aggregates live integration health status across Connection, Webhook, and Synchronization.
 */
export const getIntegrationHealthData = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    connectionId: v.optional(v.id("payment_gateway_connections")),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const provider = args.provider || "razorpay";
    const now = Date.now();

    // 1. Connection telemetry
    let conn: any = null;
    if (args.connectionId) {
      conn = await ctx.db.get(args.connectionId);
    } else {
      const connections = await ctx.db
        .query("payment_gateway_connections")
        .withIndex("by_org_and_provider", (q) =>
          q.eq("organizationId", org._id).eq("provider", provider)
        )
        .collect();
      conn =
        connections.find((c) => c.status === "connected") ||
        connections.find((c) => c.status === "disconnected") ||
        connections[0];
    }

    const publicConn = conn ? toPublicConnection(conn) : null;

    // 2. Webhooks telemetry
    let webhookEvents: any[] = [];
    if (conn) {
      webhookEvents = await ctx.db
        .query("payment_webhook_events")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .collect();
      webhookEvents = webhookEvents.filter(
        (e) => e.provider === provider && (!e.connectionId || e.connectionId === conn._id)
      );
    }

    const totalEvents = webhookEvents.length;
    let lastReceivedAt: number | undefined;
    let lastProcessedAt: number | undefined;
    let pendingEvents = 0;
    let failedEvents = 0;

    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    for (const ev of webhookEvents) {
      if (!lastReceivedAt || ev.receivedAt > lastReceivedAt) {
        lastReceivedAt = ev.receivedAt;
      }
      if (ev.processedAt && (!lastProcessedAt || ev.processedAt > lastProcessedAt)) {
        lastProcessedAt = ev.processedAt;
      }
      if (
        ev.processingStatus === "pending" ||
        ev.processingStatus === "processing" ||
        ev.processingStatus === "received"
      ) {
        pendingEvents++;
      }
      if (ev.processingStatus === "failed" && ev.receivedAt >= oneDayAgo) {
        failedEvents++;
      }
    }

    const hasWebhookSecret = Boolean(
      conn?.metadata?.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET
    );

    let webhookStatus: "healthy" | "warning" | "degraded" | "not_configured" | "unknown" =
      "not_configured";
    if (hasWebhookSecret) {
      if (failedEvents > 0 && (!lastProcessedAt || lastProcessedAt < oneDayAgo)) {
        webhookStatus = "degraded";
      } else if (totalEvents > 0) {
        webhookStatus = "healthy";
      } else {
        webhookStatus = "healthy"; // Configured & ready for transactions
      }
    } else {
      webhookStatus = totalEvents > 0 ? "warning" : "not_configured";
    }

    // 3. Sync Telemetry
    const syncStatus = {
      transactions: {
        status: "never",
        lastSyncedAt: undefined as number | undefined,
        lastSuccessfulSyncAt: undefined as number | undefined,
        recordsFetched: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        lastError: undefined as string | undefined,
      },
      refunds: {
        status: "never",
        lastSyncedAt: undefined as number | undefined,
        lastSuccessfulSyncAt: undefined as number | undefined,
        recordsFetched: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        lastError: undefined as string | undefined,
      },
      settlements: {
        status: "never",
        lastSyncedAt: undefined as number | undefined,
        lastSuccessfulSyncAt: undefined as number | undefined,
        recordsFetched: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        lastError: undefined as string | undefined,
      },
    };

    if (conn) {
      const cursors = await ctx.db
        .query("payment_sync_cursors")
        .withIndex("by_connection", (q) => q.eq("connectionId", conn._id))
        .collect();

      const runs = await ctx.db
        .query("payment_sync_runs")
        .withIndex("by_connection", (q) => q.eq("connectionId", conn._id))
        .collect();

      for (const resType of ["transactions", "refunds", "settlements"] as const) {
        const cursor = cursors.find((c) => c.resourceType === resType);
        if (cursor) {
          syncStatus[resType].lastSuccessfulSyncAt = cursor.lastSuccessfulSyncAt;
        }

        const entityRuns = runs
          .filter((r) => r.resourceType === resType)
          .sort((a, b) => b.startedAt - a.startedAt);

        const latestRun = entityRuns[0];
        if (latestRun) {
          syncStatus[resType].lastSyncedAt = latestRun.startedAt;
          syncStatus[resType].status =
            latestRun.status === "completed" ? "success" : latestRun.status;
          syncStatus[resType].recordsFetched = latestRun.recordsFetched;
          syncStatus[resType].recordsCreated = latestRun.recordsCreated;
          syncStatus[resType].recordsUpdated = latestRun.recordsUpdated;
          syncStatus[resType].lastError = latestRun.lastError;
        } else if (cursor) {
          syncStatus[resType].lastSyncedAt = cursor.lastSuccessfulSyncAt;
          syncStatus[resType].status = "success";
        }
      }
    }

    // 4. Recent Activity Telemetry
    const recentActivity: any[] = [];
    if (conn) {
      if (conn.lastVerifiedAt) {
        recentActivity.push({
          id: `verify_${conn.lastVerifiedAt}`,
          type: "verification",
          title: "Connection Verified",
          description: "Manual verification check completed successfully.",
          timestamp: conn.lastVerifiedAt,
          status: "success",
        });
      }

      for (const ev of webhookEvents.slice(0, 5)) {
        recentActivity.push({
          id: `wh_${ev._id}`,
          type: "webhook",
          title: "Webhook Processed",
          description: `${ev.eventType || "event.payment"} received and acknowledged.`,
          timestamp: ev.processedAt || ev.receivedAt,
          status: ev.processingStatus === "failed" ? "failed" : "success",
        });
      }

      const txs = await ctx.db
        .query("payment_transactions")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .order("desc")
        .take(5);

      for (const tx of txs) {
        recentActivity.push({
          id: `tx_${tx._id}`,
          type: "payment",
          title: tx.status === "captured" ? "Payment Captured" : tx.status === "failed" ? "Payment Failed" : "Payment Initiated",
          description: `Order #${tx.providerOrderId || tx.providerPaymentId} was successfully processed via API.`,
          timestamp: tx.paidAt || tx.createdAt,
          status: tx.status === "captured" ? "success" : tx.status === "failed" ? "failed" : "pending",
        });
      }

      const stls = await ctx.db
        .query("payment_settlements")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .order("desc")
        .take(5);

      for (const stl of stls) {
        recentActivity.push({
          id: `stl_${stl._id}`,
          type: "settlement",
          title: "Settlement Synced",
          description: `Daily settlement batch #${stl.providerSettlementId} has been acknowledged.`,
          timestamp: stl.settlementDate || stl.createdAt,
          status: stl.status === "processed" ? "success" : "pending",
        });
      }

      const rfs = await ctx.db
        .query("payment_refunds")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .order("desc")
        .take(5);

      for (const rf of rfs) {
        recentActivity.push({
          id: `rf_${rf._id}`,
          type: "refund",
          title: "Refund Processed",
          description: `Refund #${rf.providerRefundId} of ${(rf.amountMinor / 100).toFixed(2)} processed.`,
          timestamp: rf.processedAt || rf.initiatedAt || rf.createdAt,
          status: rf.status === "processed" ? "success" : "pending",
        });
      }

      recentActivity.sort((a, b) => b.timestamp - a.timestamp);
    }

    return {
      connection: publicConn,
      webhook: {
        status: webhookStatus,
        configured: hasWebhookSecret,
        lastReceivedAt,
        lastProcessedAt,
        pendingEvents,
        failedEvents,
        totalEvents,
      },
      sync: syncStatus,
      recentActivity: recentActivity.slice(0, 10),
      checkedAt: now,
    };
  },
});

// =========================================================================
// 15-MINUTE AUTOMATIC SYNCHRONIZATION ENGINE
// =========================================================================

/**
 * Retrieves all active connections that are eligible for automated synchronization.
 * Excludes disconnected, pending, or paused connections.
 */
export const getActiveConnectionsForScheduledSync = internalQuery({
  args: {
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_status", (q) => q.eq("status", "connected"));

    const connections = await q.collect();
    if (args.provider) {
      return connections.filter((c) => c.provider === args.provider);
    }
    return connections;
  },
});

/**
 * Synchronizes an entity resource from Razorpay REST API inside the scheduled action runner.
 */
async function syncScheduledEntityResource(params: {
  ctx: any;
  connectionId: any;
  resourceType: "transactions" | "refunds" | "settlements";
  url: string;
  basicAuth: string;
  mapItemToMutation: (item: any) => any;
  recordMutation: any;
}) {
  const startedAt = Date.now();
  let fetchedTotal = 0;
  let createdTotal = 0;
  let updatedTotal = 0;

  try {
    const syncStatus: any = await params.ctx.runQuery(api.paymentGateways.getSyncStatus, {
      connectionId: params.connectionId,
    });
    const cursor = syncStatus?.cursors?.find((c: any) => c.resourceType === params.resourceType);

    // 5-minute overlap window to prevent edge races
    const from = cursor?.lastSuccessfulSyncAt
      ? Math.max(cursor.lastSuccessfulSyncAt - 5 * 60 * 1000, 0)
      : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const fromSec = Math.floor(from / 1000);
    const toSec = Math.floor(Date.now() / 1000);

    const count = 50;
    let skip = 0;
    const maxRecordsToSync = 500; // Bounded ceiling per 15-minute cron run
    let maxSeenTimestamp = from;

    while (fetchedTotal < maxRecordsToSync) {
      const pageUrl = `${params.url}?count=${count}&skip=${skip}&from=${fromSec}&to=${toSec}`;

      // Retry with exponential backoff on 429 / 5xx
      let response: any = null;
      let attempt = 0;
      while (attempt < 3) {
        attempt++;
        try {
          const res = await fetch(pageUrl, {
            method: "GET",
            headers: {
              Authorization: `Basic ${params.basicAuth}`,
              Accept: "application/json",
              "User-Agent": "PREST-POS-ScheduledSync/1.0",
            },
          });
          if (res.status === 200) {
            response = await res.json();
            break;
          } else if (res.status === 429 || res.status >= 500) {
            if (attempt >= 3) {
              throw new Error(`HTTP ${res.status} after ${attempt} attempts`);
            }
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
          } else {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error?.description || `HTTP ${res.status}`);
          }
        } catch (err: any) {
          if (attempt >= 3) throw err;
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
        }
      }

      const items = response?.items || [];
      if (items.length === 0) {
        break;
      }

      for (const item of items) {
        fetchedTotal++;
        const args = params.mapItemToMutation(item);
        const res = await params.ctx.runMutation(params.recordMutation, args);
        if (res?.alreadyExists) {
          updatedTotal++;
        } else {
          createdTotal++;
        }

        const itemTime = item.created_at ? item.created_at * 1000 : Date.now();
        if (itemTime > maxSeenTimestamp) {
          maxSeenTimestamp = itemTime;
        }
      }

      // If fewer items returned than page size, all items in window have been retrieved
      if (items.length < count) {
        break;
      }

      skip += items.length;
    }

    if (maxSeenTimestamp > from) {
      await params.ctx.runMutation(api.paymentGateways.updateSyncCursor, {
        connectionId: params.connectionId,
        resourceType: params.resourceType,
        lastSuccessfulSyncAt: maxSeenTimestamp,
      });
    }

    await params.ctx.runMutation(api.paymentGateways.recordSyncRun, {
      connectionId: params.connectionId,
      resourceType: params.resourceType,
      syncType: "scheduled",
      status: "completed",
      startedAt,
      completedAt: Date.now(),
      recordsFetched: fetchedTotal,
      recordsCreated: createdTotal,
      recordsUpdated: updatedTotal,
      recordsSkipped: 0,
      errorCount: 0,
    });
  } catch (err: any) {
    await params.ctx.runMutation(api.paymentGateways.recordSyncRun, {
      connectionId: params.connectionId,
      resourceType: params.resourceType,
      syncType: "scheduled",
      status: "failed",
      startedAt,
      completedAt: Date.now(),
      recordsFetched: fetchedTotal,
      recordsCreated: createdTotal,
      recordsUpdated: updatedTotal,
      recordsSkipped: 0,
      errorCount: 1,
      lastError: err?.message || "Scheduled sync failed",
    });
    throw err;
  }
}

/**
 * 15-Minute Scheduled Sync Action executed via Convex Crons.
 * Disconnected connections are immediately skipped. Transactions, refunds,
 * and settlements execute independently.
 */
export const runScheduledSync: any = internalAction({
  args: {},
  handler: async (ctx): Promise<any> => {
    const activeConnections = await ctx.runQuery(
      internal.paymentGateways.getActiveConnectionsForScheduledSync,
      { provider: "razorpay" }
    );

    if (activeConnections.length === 0) {
      return { skipped: true, reason: "No active Razorpay connections found" };
    }

    const results = [];
    for (const conn of activeConnections) {
      if (!conn.encryptedCredentials) continue;

      let credentials: any;
      try {
        credentials = await decryptCredentials(conn.encryptedCredentials);
      } catch (err: any) {
        console.error(
          `[Scheduled Sync] Failed to decrypt credentials for connection ${conn._id}:`,
          err
        );
        continue;
      }

      const basicAuth = btoa(`${credentials.keyId}:${credentials.keySecret}`);
      const baseUrl = "https://api.razorpay.com/v1";

      // 1. Transactions
      try {
        await syncScheduledEntityResource({
          ctx,
          connectionId: conn._id,
          resourceType: "transactions",
          url: `${baseUrl}/payments`,
          basicAuth,
          mapItemToMutation: (item: any) => ({
            connectionId: conn._id,
            providerPaymentId: item.id,
            providerOrderId: item.order_id,
            customerEmail: item.email,
            customerPhone: item.contact,
            amountMinor: item.amount || 0,
            currency: item.currency || "INR",
            paymentMethod: item.method || "card",
            status:
              item.status === "captured"
                ? "captured"
                : item.status === "failed"
                ? "failed"
                : "pending",
            providerStatus: item.status,
            paidAt: item.created_at ? item.created_at * 1000 : undefined,
            refundedAmountMinor: item.amount_refunded || 0,
            metadata: item.notes,
          }),
          recordMutation: api.paymentGateways.recordTransaction,
        });
      } catch (txErr: any) {
        console.error(`[Scheduled Sync] Transaction sync error for ${conn._id}:`, txErr);
      }

      // 2. Refunds
      try {
        await syncScheduledEntityResource({
          ctx,
          connectionId: conn._id,
          resourceType: "refunds",
          url: `${baseUrl}/refunds`,
          basicAuth,
          mapItemToMutation: (item: any) => ({
            connectionId: conn._id,
            providerRefundId: item.id,
            providerPaymentId: item.payment_id,
            amountMinor: item.amount || 0,
            currency: item.currency || "INR",
            status: item.status === "processed" ? "processed" : "pending",
            providerStatus: item.status,
            speed: item.speed_processed || item.speed_requested || "normal",
            initiatedAt: item.created_at ? item.created_at * 1000 : Date.now(),
            processedAt:
              item.status === "processed"
                ? item.created_at
                  ? item.created_at * 1000
                  : Date.now()
                : undefined,
            metadata: item.notes,
          }),
          recordMutation: api.paymentGateways.recordRefund,
        });
      } catch (rfErr: any) {
        console.error(`[Scheduled Sync] Refunds sync error for ${conn._id}:`, rfErr);
      }

      // 3. Settlements
      try {
        await syncScheduledEntityResource({
          ctx,
          connectionId: conn._id,
          resourceType: "settlements",
          url: `${baseUrl}/settlements`,
          basicAuth,
          mapItemToMutation: (item: any) => ({
            connectionId: conn._id,
            providerSettlementId: item.id,
            amountMinor: item.amount || 0,
            currency: item.currency || "INR",
            feesMinor: item.fees || 0,
            taxMinor: item.tax || 0,
            netAmountMinor: (item.amount || 0) - (item.fees || 0) - (item.tax || 0),
            status: "processed",
            providerStatus: item.status || "processed",
            settlementDate: item.created_at ? item.created_at * 1000 : Date.now(),
            utrOrReference: item.utr,
          }),
          recordMutation: api.paymentGateways.recordSettlement,
        });
      } catch (stlErr: any) {
        console.error(`[Scheduled Sync] Settlements sync error for ${conn._id}:`, stlErr);
      }

      results.push({ connectionId: conn._id, status: "completed" });
    }

    return { success: true, processedCount: results.length };
  },
});



