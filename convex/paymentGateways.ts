import { mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAuth, resolveStoreOrganization } from "./organizationUsers";
import { encryptCredentials, decryptCredentials, maskKeyIdentifier } from "./paymentGatewayCrypto";
import { resolveOrganizationCurrency, formatCurrencyMinor } from "../lib/constants/countries";
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
 * Public query (also callable by pos-user without admin auth) to get the active payment gateway
 * configuration for the store organization.
 */
export const getActivePaymentGateway = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let org: any = null;
    if (args.organizationId) {
      org = await ctx.db.get(args.organizationId);
    } else if (args.slug) {
      org = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug!))
        .first();
    }
    if (!org) {
      org = await ctx.db.query("organizations").first();
    }
    if (!org) {
      return {
        activeGateway: null,
        razorpay: null,
        stripe: null,
        publishableKey: null,
        razorpayKeyId: null,
      };
    }

    const connections = await ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_org", (idx) => idx.eq("organizationId", org._id))
      .collect();

    const rzpConn = connections.find(
      (c) => c.provider === "razorpay" && c.status === "connected"
    );
    const stripeConn = connections.find(
      (c) => c.provider === "stripe" && c.status === "connected"
    );

    let activeGateway: "razorpay" | "stripe" | null = null;
    if (org.activePaymentGateway === "stripe") {
      activeGateway = "stripe";
    } else if (org.activePaymentGateway === "razorpay") {
      activeGateway = "razorpay";
    } else if (org.activePaymentGateway === "none") {
      activeGateway = null;
    } else {
      const defaultConn = connections.find(
        (c) => c.isDefault && c.status === "connected"
      );
      if (defaultConn) {
        activeGateway = defaultConn.provider as "razorpay" | "stripe";
      } else if (stripeConn && !rzpConn) {
        activeGateway = "stripe";
      } else if (rzpConn) {
        activeGateway = "razorpay";
      }
    }

    return {
      activeGateway,
      razorpay: rzpConn ? toPublicConnection(rzpConn) : null,
      stripe: stripeConn ? toPublicConnection(stripeConn) : null,
      publishableKey:
        activeGateway === "stripe"
          ? stripeConn?.providerAccountId ||
            org.stripePublishableKey ||
            process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
            null
          : null,
      razorpayKeyId:
        activeGateway === "razorpay"
          ? rzpConn?.providerAccountId ||
            org.razorPayKeyId ||
            process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
            null
          : null,
    };
  },
});

/**
 * Mutation to select and activate the primary customer checkout payment gateway.
 * Only verified/connected gateways may be activated.
 */
export const setActivePaymentGateway = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    provider: v.union(v.literal("razorpay"), v.literal("stripe"), v.literal("none")),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const now = Date.now();

    const connections = await ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_org", (idx) => idx.eq("organizationId", org._id))
      .collect();

    if (args.provider === "stripe") {
      const stripeConn = connections.find(
        (c) => c.provider === "stripe" && c.status === "connected"
      );
      const hasStripeKeys = Boolean(org.stripePublishableKey && org.stripeSecretKey);
      if (!stripeConn && !hasStripeKeys) {
        throw new Error(
          "Stripe cannot be activated because it is not connected or verified. Please connect Stripe first in Payments & Marketplace."
        );
      }

      // Mark Stripe connection as default, unmark Razorpay
      for (const conn of connections) {
        if (conn.provider === "stripe") {
          await ctx.db.patch(conn._id, { isDefault: true, updatedAt: now });
        } else if (conn.isDefault) {
          await ctx.db.patch(conn._id, { isDefault: false, updatedAt: now });
        }
      }
    } else if (args.provider === "razorpay") {
      const rzpConn = connections.find(
        (c) => c.provider === "razorpay" && c.status === "connected"
      );
      const hasRzpKeys = Boolean(org.razorPayKeyId && org.razorPayApiKey);
      if (!rzpConn && !hasRzpKeys) {
        throw new Error(
          "Razorpay cannot be activated because it is not connected or verified. Please connect Razorpay first in Payments & Marketplace."
        );
      }

      // Mark Razorpay connection as default, unmark Stripe
      for (const conn of connections) {
        if (conn.provider === "razorpay") {
          await ctx.db.patch(conn._id, { isDefault: true, updatedAt: now });
        } else if (conn.isDefault) {
          await ctx.db.patch(conn._id, { isDefault: false, updatedAt: now });
        }
      }
    } else {
      // None
      for (const conn of connections) {
        if (conn.isDefault) {
          await ctx.db.patch(conn._id, { isDefault: false, updatedAt: now });
        }
      }
    }

    // Persist to organization record
    await ctx.db.patch(org._id, {
      activePaymentGateway: args.provider,
      updatedAt: now,
    });

    return {
      success: true,
      activeGateway: args.provider,
    };
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
 * Server-to-server query to retrieve encrypted credentials for webhook verification.
 * Does not require Clerk user session since incoming webhooks originate from payment provider servers.
 */
export const getWebhookVerificationDetails = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const provider = args.provider || "razorpay";
    let org: any = null;
    if (args.organizationId) {
      org = await ctx.db.get(args.organizationId);
    } else {
      org = await ctx.db.query("organizations").first();
    }
    if (!org) return null;

    const connections = await ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_org_and_provider", (q) =>
        q.eq("organizationId", org._id).eq("provider", provider)
      )
      .collect();

    const conn =
      connections.find((c) => c.status === "connected") ||
      connections.find((c) => c.status === "disconnected") ||
      connections[0];

    if (!conn) return null;

    return {
      connectionId: conn._id,
      organizationId: org._id,
      storeSlug: org.slug,
      provider: conn.provider,
      accountMode: conn.accountMode,
      status: conn.status,
      encryptedCredentials: conn.encryptedCredentials,
      encryptionKeyVersion: conn.encryptionKeyVersion,
      metadata: conn.metadata,
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
 * Configures or updates the store-specific webhook secret securely using authenticated encryption.
 */
export const updateWebhookSecret = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    connectionId: v.id("payment_gateway_connections"),
    webhookSecret: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const conn = await ctx.db.get(args.connectionId);
    if (!conn || conn.organizationId !== org._id) {
      throw new Error("Connection not found for this store");
    }

    let existingBundle: any = {};
    if (conn.encryptedCredentials) {
      try {
        existingBundle = await decryptCredentials(conn.encryptedCredentials);
      } catch (err: any) {
        console.warn("Failed decrypting existing credentials during webhook secret update:", err?.message);
      }
    }

    const cleanSecret = args.webhookSecret.trim();
    const updatedBundle = {
      ...existingBundle,
      webhookSecret: cleanSecret,
    };

    const encrypted = await encryptCredentials(updatedBundle, 1);
    const now = Date.now();

    const metadata = {
      ...(conn.metadata || {}),
      webhookConfigured: Boolean(cleanSecret),
      webhookConfiguredAt: now,
      webhookSecretLast4: cleanSecret ? cleanSecret.slice(-4) : undefined,
    };

    await ctx.db.patch(args.connectionId, {
      encryptedCredentials: encrypted.encryptedString,
      encryptionKeyVersion: encrypted.version,
      credentialsUpdatedAt: now,
      metadata,
      updatedAt: now,
    });

    return { success: true, connectionId: args.connectionId, configured: Boolean(cleanSecret) };
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

    const effectiveMetadata = {
      ...(existing?.metadata || {}),
      ...(args.metadata || {}),
    };

    if (args.rawCredentials) {
      if (args.rawCredentials.webhookSecret) {
        effectiveMetadata.webhookConfigured = true;
        effectiveMetadata.webhookConfiguredAt = now;
        effectiveMetadata.webhookSecretLast4 = args.rawCredentials.webhookSecret.trim().slice(-4);
      }
      const encrypted = await encryptCredentials(args.rawCredentials, 1);
      encryptedCredentials = encrypted.encryptedString;
      encryptionKeyVersion = encrypted.version;
      credentialsUpdatedAt = now;
    }

    let effectiveConnectionId: Id<"payment_gateway_connections">;

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
        metadata: effectiveMetadata,
        updatedAt: now,
      });

      effectiveConnectionId = existing._id;
    } else {
      // If marked as default, unset previous default
      if (args.isDefault) {
        for (const conn of existingConnections) {
          if (conn.isDefault) {
            await ctx.db.patch(conn._id, { isDefault: false, updatedAt: now });
          }
        }
      }

      effectiveConnectionId = await ctx.db.insert("payment_gateway_connections", {
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
        metadata: effectiveMetadata,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Keep marketplaceInstallations in sync for Razorpay
    if (args.provider === "razorpay") {
      const instStatus =
        args.status === "connected"
          ? "live"
          : args.status === "needs_attention"
            ? "attention"
            : args.status === "disconnected"
              ? "uninstalled"
              : "installed";
      const instStatusText =
        args.status === "connected"
          ? "Connected & Active"
          : args.status === "needs_attention"
            ? "Connection Needs Attention"
            : "Not Connected";
      const instActionType =
        args.status === "connected"
          ? "open"
          : args.status === "needs_attention"
            ? "fix"
            : "install";

      const existingInst = await ctx.db
        .query("marketplaceInstallations")
        .withIndex("by_org_and_app", (q) =>
          q.eq("organizationId", org._id).eq("appSlug", "razorpay")
        )
        .first();

      if (existingInst) {
        await ctx.db.patch(existingInst._id, {
          status: instStatus,
          statusText: instStatusText,
          actionType: instActionType,
          uninstalledAt: args.status === "disconnected" ? now : undefined,
          configuration: {
            connected: args.status === "connected",
            status: args.status,
            accountMode: args.accountMode,
            merchantName: args.merchantName,
            providerAccountId: args.providerAccountId,
          },
          updatedAt: now,
        });
      } else if (args.status !== "disconnected") {
        const listing = await ctx.db
          .query("marketplaceListings")
          .withIndex("by_slug", (q) => q.eq("slug", "razorpay"))
          .first();

        if (listing) {
          await ctx.db.insert("marketplaceInstallations", {
            organizationId: org._id,
            listingId: listing._id,
            appSlug: "razorpay",
            status: instStatus,
            statusText: instStatusText,
            actionType: instActionType,
            isPaid: true,
            licenseType: "subscription",
            installedAt: now,
            installedByUserId: "system",
            configuration: {
              connected: args.status === "connected",
              status: args.status,
              accountMode: args.accountMode,
              merchantName: args.merchantName,
              providerAccountId: args.providerAccountId,
            },
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    return effectiveConnectionId;
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

    const effectiveInternalOrderId = args.internalOrderId ?? existing?.internalOrderId;
    let orderDoc: any = null;
    if (effectiveInternalOrderId) {
      try {
        orderDoc = await ctx.db.get(effectiveInternalOrderId as any);
      } catch (_) {}
    }

    const existingMetadata = existing?.metadata || {};
    const passedMetadata = args.metadata || {};
    const mergedMetadata: Record<string, any> = {
      ...existingMetadata,
      ...passedMetadata,
    };

    if (orderDoc) {
      if (!mergedMetadata.orderType && orderDoc.orderType) {
        mergedMetadata.orderType = orderDoc.orderType;
      }
      if (!mergedMetadata.orderNumber && orderDoc.orderNumber) {
        mergedMetadata.orderNumber = orderDoc.orderNumber;
      }
      if (orderDoc.orderType === "DineIn" && !mergedMetadata.table) {
        mergedMetadata.table = orderDoc.table?.number || orderDoc.tableId;
      }
    }

    // Isolate table mapping: takeaway and delivery orders never have table assignments
    if (mergedMetadata.orderType && mergedMetadata.orderType !== "DineIn") {
      delete mergedMetadata.table;
    }

    if (existing) {
      const parsedAmountMinor =
        args.amountMinor !== undefined && args.amountMinor !== null
          ? Math.round(Number(args.amountMinor))
          : existing.amountMinor;

      await ctx.db.patch(existing._id, {
        providerOrderId: args.providerOrderId ?? existing.providerOrderId,
        internalOrderId: effectiveInternalOrderId,
        amountMinor: parsedAmountMinor,
        currency: args.currency || existing.currency,
        paymentMethod: args.paymentMethod || existing.paymentMethod,
        customerName: args.customerName || existing.customerName,
        customerEmail: args.customerEmail || existing.customerEmail,
        customerPhone: args.customerPhone || existing.customerPhone,
        status: args.status,
        providerStatus: args.providerStatus,
        paidAt: args.paidAt ?? existing.paidAt,
        failedAt: args.failedAt ?? existing.failedAt,
        errorCode: args.errorCode,
        errorMessage: args.errorMessage,
        refundedAmountMinor: args.refundedAmountMinor ?? existing.refundedAmountMinor,
        metadata: mergedMetadata,
        updatedAt: now,
      });

      return { transactionId: existing._id, alreadyExists: true };
    }

    const safeAmountMinor = Math.round(Number(args.amountMinor || 0));

    const transactionId = await ctx.db.insert("payment_transactions", {
      organizationId: orgId,
      connectionId: args.connectionId,
      provider: conn.provider,
      providerPaymentId: args.providerPaymentId,
      providerOrderId: args.providerOrderId,
      internalOrderId: effectiveInternalOrderId,
      customerId: args.customerId,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      amountMinor: safeAmountMinor,
      currency: args.currency,
      paymentMethod: args.paymentMethod,
      status: args.status,
      providerStatus: args.providerStatus,
      paidAt: args.paidAt,
      failedAt: args.failedAt,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      refundedAmountMinor: args.refundedAmountMinor ?? 0,
      metadata: mergedMetadata,
      createdAt: args.paidAt || args.failedAt || now,
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
 * Reserves a refund before sending request to payment gateway, preventing concurrent duplicate submissions.
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
    currency: v.optional(v.string()),
    metadata: v.optional(v.any()),
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
    let txn: any = await ctx.db
      .query("payment_transactions")
      .withIndex("by_provider_payment_id", (q) =>
        q.eq("providerPaymentId", args.providerPaymentId)
      )
      .first();

    if (!txn) {
      try {
        txn = await ctx.db.get(args.providerPaymentId as any);
      } catch {}
    }

    if (!txn || txn.organizationId !== org._id) {
      throw new Error("Payment not found for this store.");
    }

    const txStatus = String(txn.status);
    if (
      txStatus !== "captured" &&
      txStatus !== "partially_refunded" &&
      txStatus !== "succeeded" &&
      txStatus !== "successful"
    ) {
      throw new Error(`Payment is not eligible for refund (current status: "${txn.status}").`);
    }

    // Sum all processed refunds + active pending reservations (within last 60s)
    const activeRefunds = existingRefunds.filter(
      (r) => r.status === "processed" || (r.status === "pending" && now - (r.createdAt || 0) < 60 * 1000)
    );
    const totalCommittedOrReserved = activeRefunds.reduce((sum, r) => sum + r.amountMinor, 0);
    const rawTxAmount =
      typeof txn.amountMinor === "number" && txn.amountMinor > 0
        ? Math.round(txn.amountMinor)
        : typeof (txn as any).amount === "number" && (txn as any).amount > 0
          ? Math.round((txn as any).amount)
          : typeof (txn as any).amountPaise === "number" && (txn as any).amountPaise > 0
            ? Math.round((txn as any).amountPaise)
            : typeof (txn as any).grossMinor === "number" && (txn as any).grossMinor > 0
              ? Math.round((txn as any).grossMinor)
              : 0;
    const remainingBalance = Math.max(rawTxAmount - totalCommittedOrReserved, 0);

    if (args.amountMinor > remainingBalance) {
      throw new Error(
        `REFUND_AMOUNT_EXCEEDS_BALANCE: Remaining refundable balance is ${(remainingBalance / 100).toFixed(2)}.`
      );
    }

    // 3. Create durable pending reservation
    const reservationId = await ctx.db.insert("payment_refunds", {
      organizationId: org._id,
      connectionId: args.connectionId,
      transactionId: txn._id,
      provider: txn.provider || "stripe",
      providerRefundId: `res_${args.idempotencyKey}`,
      providerPaymentId: args.providerPaymentId,
      amountMinor: args.amountMinor,
      currency: args.currency || txn.currency || "INR",
      reason: args.reason,
      speed: args.speed || "normal",
      status: "pending",
      providerStatus: "reserved",
      initiatedAt: now,
      metadata: {
        ...(args.metadata || {}),
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

    const storeCurrencyInfo = resolveOrganizationCurrency(org);
    const storeCurrencyCode = (storeCurrencyInfo.code || "INR").toUpperCase();

    // Helper to resiliently extract integer minor units regardless of historical schema naming
    function extractTransactionAmountMinor(r: any): number {
      if (typeof r?.amountMinor === "number" && !isNaN(r.amountMinor)) {
        return Math.round(r.amountMinor);
      }
      if (typeof r?.amount === "number" && !isNaN(r.amount)) {
        return Math.round(r.amount);
      }
      if (typeof r?.amount_minor === "number" && !isNaN(r.amount_minor)) {
        return Math.round(r.amount_minor);
      }
      if (typeof r?.grossMinor === "number" && !isNaN(r.grossMinor)) {
        return Math.round(r.grossMinor);
      }
      if (typeof r?.amountPaise === "number" && !isNaN(r.amountPaise)) {
        return Math.round(r.amountPaise);
      }
      if (typeof r?.amountMinor === "string") {
        const p = parseFloat(r.amountMinor);
        if (!isNaN(p)) return Math.round(p);
      }
      if (typeof r?.amount === "string") {
        const p = parseFloat(r.amount);
        if (!isNaN(p)) return Math.round(p);
      }
      return 0;
    }

    const paginated = await Promise.all(
      records.slice(skip, skip + limit).map(async (r) => {
        let orderType = r.metadata?.orderType;
        let orderNumber = r.metadata?.orderNumber;
        let table = r.metadata?.table;

        if ((!orderType || !orderNumber) && r.internalOrderId) {
          try {
            const linkedOrder: any = await ctx.db.get(r.internalOrderId);
            if (linkedOrder) {
              orderType = orderType || linkedOrder.orderType;
              orderNumber = orderNumber || linkedOrder.orderNumber;
              if (linkedOrder.orderType === "DineIn" && !table) {
                table = linkedOrder.table?.number || linkedOrder.tableId;
              }
            }
          } catch (_) {}
        }

        // Strictly isolate table metadata to DineIn orders
        if (orderType && orderType !== "DineIn") {
          table = undefined;
        }

        const enrichedMetadata = {
          ...(r.metadata || {}),
          ...(orderType ? { orderType } : {}),
          ...(orderNumber ? { orderNumber } : {}),
          ...(table ? { table } : {}),
        };
        if (orderType && orderType !== "DineIn") {
          delete enrichedMetadata.table;
        }

        return {
          ...r,
          amountMinor: extractTransactionAmountMinor(r),
          orderType: orderType || "DineIn",
          metadata: enrichedMetadata,
        };
      })
    );
    const hasMore = skip + limit < total;

    // Calculate aggregated financial KPIs across all matching transactions in this filter/range
    let successfulCount = 0;
    let successfulAmountMinor = 0;
    let failedCount = 0;
    let failedAmountMinor = 0;
    let pendingCount = 0;
    let pendingAmountMinor = 0;
    let totalAmountMinor = 0;

    const currencyBuckets: Record<
      string,
      {
        totalMinor: number;
        successfulMinor: number;
        failedMinor: number;
        pendingMinor: number;
        totalCount: number;
        successfulCount: number;
        failedCount: number;
        pendingCount: number;
      }
    > = {};

    function getBucket(curr: string) {
      const c = (curr || storeCurrencyCode).toUpperCase();
      if (!currencyBuckets[c]) {
        currencyBuckets[c] = {
          totalMinor: 0,
          successfulMinor: 0,
          failedMinor: 0,
          pendingMinor: 0,
          totalCount: 0,
          successfulCount: 0,
          failedCount: 0,
          pendingCount: 0,
        };
      }
      return currencyBuckets[c];
    }

    for (const r of records) {
      const amt = extractTransactionAmountMinor(r);
      const txCurr = (r.currency || storeCurrencyCode).toUpperCase();
      const b = getBucket(txCurr);

      b.totalCount++;
      b.totalMinor += amt;
      totalAmountMinor += amt;

      if (r.status === "captured" || r.status === "partially_refunded" || r.status === "refunded") {
        successfulCount++;
        b.successfulCount++;
        b.successfulMinor += amt;
        successfulAmountMinor += amt;
      } else if (r.status === "failed") {
        failedCount++;
        b.failedCount++;
        b.failedMinor += amt;
        failedAmountMinor += amt;
      } else if (r.status === "pending" || r.status === "authorized" || r.status === "created") {
        pendingCount++;
        b.pendingCount++;
        b.pendingMinor += amt;
        pendingAmountMinor += amt;
      }
    }

    const evaluated = successfulCount + failedCount;
    const successRate = evaluated > 0 ? Math.round((successfulCount / evaluated) * 1000) / 10 : 100;
    const failureRate = evaluated > 0 ? Math.round((failedCount / evaluated) * 1000) / 10 : 0;

    const presentCurrencies = Object.keys(currencyBuckets);
    const storeBucket = currencyBuckets[storeCurrencyCode] || {
      totalMinor: 0,
      successfulMinor: 0,
      failedMinor: 0,
      pendingMinor: 0,
      totalCount: 0,
      successfulCount: 0,
      failedCount: 0,
      pendingCount: 0,
    };

    const isSingleForeignCurrency =
      presentCurrencies.length === 1 && presentCurrencies[0] !== storeCurrencyCode;
    const dominantCurrency = isSingleForeignCurrency ? presentCurrencies[0] : storeCurrencyCode;

    function buildFormattedAmount(
      bucketMinor: number,
      metricType: "total" | "successful" | "failed" | "pending"
    ): string {
      if (isSingleForeignCurrency) {
        return formatCurrencyMinor(bucketMinor, dominantCurrency);
      }

      const storeAmt =
        metricType === "total"
          ? storeBucket.totalMinor
          : metricType === "successful"
            ? storeBucket.successfulMinor
            : metricType === "failed"
              ? storeBucket.failedMinor
              : storeBucket.pendingMinor;

      const baseFormatted = formatCurrencyMinor(storeAmt, storeCurrencyCode, storeCurrencyInfo.locale);

      const foreignParts: string[] = [];
      for (const curr of presentCurrencies) {
        if (curr === storeCurrencyCode) continue;
        const fb = currencyBuckets[curr];
        const fAmt =
          metricType === "total"
            ? fb.totalMinor
            : metricType === "successful"
              ? fb.successfulMinor
              : metricType === "failed"
                ? fb.failedMinor
                : fb.pendingMinor;
        if (fAmt > 0) {
          foreignParts.push(formatCurrencyMinor(fAmt, curr));
        }
      }

      if (foreignParts.length > 0) {
        if (storeAmt === 0) {
          return foreignParts.join(" + ");
        }
        return `${baseFormatted} (+ ${foreignParts.join(", ")})`;
      }

      return baseFormatted;
    }

    return {
      transactions: paginated,
      total,
      page,
      limit,
      hasMore,
      storeCurrency: storeCurrencyCode,
      dominantCurrency,
      storeCurrencyInfo,
      kpis: {
        total: {
          count: total,
          amountMinor: totalAmountMinor,
          formattedAmount: buildFormattedAmount(totalAmountMinor, "total"),
        },
        successful: {
          count: successfulCount,
          amountMinor: successfulAmountMinor,
          formattedAmount: buildFormattedAmount(successfulAmountMinor, "successful"),
        },
        failed: {
          count: failedCount,
          amountMinor: failedAmountMinor,
          formattedAmount: buildFormattedAmount(failedAmountMinor, "failed"),
        },
        pending: {
          count: pendingCount,
          amountMinor: pendingAmountMinor,
          formattedAmount: buildFormattedAmount(pendingAmountMinor, "pending"),
        },
        currencies: currencyBuckets,
        dominantCurrency,
        successRate,
        failureRate,
      },
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
      storeCurrency: resolveOrganizationCurrency(org).code,
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
      storeCurrency: resolveOrganizationCurrency(org).code,
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
 * Validates a payment transaction for refund eligibility and computes the remaining refundable balance,
 * order items, and customer information. Supports lookup by transactionId or providerPaymentId.
 */
export const getTransactionForRefund = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
    providerPaymentId: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);

    let txn: any = null;

    if (args.transactionId) {
      try {
        txn = await ctx.db.get(args.transactionId as Id<"payment_transactions">);
        if (txn && txn.organizationId !== org._id) {
          txn = null;
        }
      } catch {
        // Not a direct doc ID
      }
    }

    if (!txn && args.providerPaymentId) {
      txn = await ctx.db
        .query("payment_transactions")
        .withIndex("by_provider_payment_id", (q) =>
          q.eq("providerPaymentId", args.providerPaymentId!)
        )
        .filter((q) => q.eq(q.field("organizationId"), org._id))
        .first();

      if (!txn && args.provider) {
        txn = await ctx.db
          .query("payment_transactions")
          .withIndex("by_provider_and_payment_id", (q) =>
            q.eq("provider", args.provider!).eq("providerPaymentId", args.providerPaymentId!)
          )
          .filter((q) => q.eq(q.field("organizationId"), org._id))
          .first();
      }
    }

    if (!txn) {
      return null;
    }

    const conn = await ctx.db.get(txn.connectionId);
    let order: any = null;
    if (txn.internalOrderId) {
      try {
        order = await ctx.db.get(txn.internalOrderId);
      } catch {
        // order fetch failed
      }
    }

    const rawAmount =
      typeof txn.amountMinor === "number" && txn.amountMinor > 0
        ? Math.round(txn.amountMinor)
        : typeof (txn as any).amount === "number" && (txn as any).amount > 0
          ? Math.round((txn as any).amount)
          : typeof (txn as any).amountPaise === "number" && (txn as any).amountPaise > 0
            ? Math.round((txn as any).amountPaise)
            : typeof (txn as any).grossMinor === "number" && (txn as any).grossMinor > 0
              ? Math.round((txn as any).grossMinor)
              : 0;

    const totalRefunded = txn.refundedAmountMinor || 0;
    const refundableBalance = Math.max(rawAmount - totalRefunded, 0);

    return {
      transactionId: txn._id,
      connectionId: txn.connectionId,
      provider: txn.provider,
      providerPaymentId: txn.providerPaymentId,
      providerOrderId: txn.providerOrderId,
      amountMinor: rawAmount,
      currency: txn.currency,
      refundedAmountMinor: totalRefunded,
      refundableBalanceMinor: refundableBalance,
      status: txn.status,
      isEligibleForRefund:
        (txn.status === "captured" ||
          txn.status === "partially_refunded" ||
          txn.status === "succeeded" ||
          txn.status === "successful") &&
        refundableBalance > 0,
      connectionStatus: (conn as any)?.status,
      customerName:
        txn.customerName ||
        (txn.metadata as any)?.customerName ||
        order?.customerName ||
        "Customer",
      customerEmail:
        txn.customerEmail ||
        (txn.metadata as any)?.customerEmail ||
        order?.customerEmail,
      orderNumber:
        order?.orderNumber ||
        (txn.metadata as any)?.orderNumber ||
        `ORD-${txn._id.slice(-6).toUpperCase()}`,
      serviceType: order?.diningOption || order?.orderType || "Dine-in",
      table: order?.tableNo ? `Table ${order.tableNo}` : "Takeout / Online",
      waiter: order?.serverName || order?.waiterName || "Staff",
      items: (order?.items || []).map((it: any) => ({
        name: it.name || it.itemName || "Item",
        quantity: it.quantity || 1,
        price:
          typeof it.price === "number"
            ? it.price
            : it.priceMinor
              ? it.priceMinor / 100
              : 0,
        notes: it.notes || it.specialInstructions || undefined,
      })),
    };
  },
});

/**
 * Retrieves the regional payment gateway routing rules, available gateways, and connection statuses for a store.
 */
export const getRegionalGatewayRouting = query({
  args: {
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    let org: any = null;
    if (args.organizationId) {
      org = await ctx.db.get(args.organizationId);
    }
    if (!org) {
      org = await ctx.db.query("organizations").first();
    }
    if (!org) {
      return {
        rules: [],
        availableGateways: [],
        storeCountry: "IN",
      };
    }

    const connections = await ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_org", (idx) => idx.eq("organizationId", org._id))
      .collect();

    const rzpConn = connections.find(
      (c) => c.provider === "razorpay" && c.status === "connected"
    );
    const stripeConn = connections.find(
      (c) => c.provider === "stripe" && c.status === "connected"
    );

    const isRazorpayConnected = Boolean(
      rzpConn || (org.razorPayKeyId && org.razorPayApiKey)
    );
    const isStripeConnected = Boolean(
      stripeConn || (org.stripePublishableKey && org.stripeSecretKey)
    );

    const availableGateways = [
      {
        provider: "stripe",
        name: "Stripe",
        status: isStripeConnected ? "connected" : "disconnected",
        isDefault: org.activePaymentGateway === "stripe",
      },
      {
        provider: "razorpay",
        name: "Razorpay",
        status: isRazorpayConnected ? "connected" : "disconnected",
        isDefault: org.activePaymentGateway === "razorpay",
      },
    ];

    // Read stored regional routing rules if any
    const storedRules: any[] =
      org.paymentSplitting?.regionalRouting ||
      stripeConn?.metadata?.regionalRouting ||
      [];

    const defaultRegionConfigs = [
      {
        regionId: "US",
        regionName: "United States",
        defaultGateway: isStripeConnected ? "stripe" : "none",
        description: "Primary terminal routing for US dining rooms and takeout online ordering",
        defaultEnabled: true,
      },
      {
        regionId: "GB_EU",
        regionName: "United Kingdom & Europe",
        defaultGateway: isStripeConnected ? "stripe" : "none",
        description: "Multi-currency settlements (GBP, EUR) routed via Stripe Europe SE",
        defaultEnabled: true,
      },
      {
        regionId: "IN",
        regionName: "India",
        defaultGateway: isRazorpayConnected ? "razorpay" : isStripeConnected ? "stripe" : "none",
        description: "Domestic INR settlements with UPI, Indian Credit/Debit cards & Netbanking",
        defaultEnabled: true,
      },
      {
        regionId: "AE",
        regionName: "United Arab Emirates",
        defaultGateway: isStripeConnected ? "stripe" : "none",
        description: "Middle East AED currency dining room and online order processing",
        defaultEnabled: false,
      },
      {
        regionId: "CA",
        regionName: "Canada",
        defaultGateway: isStripeConnected ? "stripe" : "none",
        description: "Canadian Dollar (CAD) domestic & cross-border card transactions",
        defaultEnabled: false,
      },
      {
        regionId: "AU",
        regionName: "Australia",
        defaultGateway: isStripeConnected ? "stripe" : "none",
        description: "Australian Dollar (AUD) EFTPOS, Apple Pay & credit card processing",
        defaultEnabled: false,
      },
      {
        regionId: "SG",
        regionName: "Singapore",
        defaultGateway: isStripeConnected ? "stripe" : "none",
        description: "Asia-Pacific Singapore Dollar (SGD) contactless and QR payments",
        defaultEnabled: false,
      },
    ];

    const rules = defaultRegionConfigs.map((cfg) => {
      const existing = storedRules.find((r: any) => r.regionId === cfg.regionId);
      const gateway = existing ? existing.gateway : cfg.defaultGateway;
      const enabled = existing !== undefined ? existing.enabled : cfg.defaultEnabled;

      let connStatus = "disconnected";
      if (gateway === "stripe") {
        connStatus = isStripeConnected ? "connected" : "disconnected";
      } else if (gateway === "razorpay") {
        connStatus = isRazorpayConnected ? "connected" : "disconnected";
      } else {
        connStatus = "none";
      }

      return {
        regionId: cfg.regionId,
        regionName: cfg.regionName,
        gateway,
        enabled,
        description: existing?.description || cfg.description,
        connectionStatus: connStatus,
      };
    });

    return {
      rules,
      availableGateways,
      storeCountry: org.country || "IN",
    };
  },
});

/**
 * Saves and persists regional payment gateway routing rules scoped to the store organization.
 */
export const saveRegionalGatewayRouting = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    rules: v.array(
      v.object({
        regionId: v.string(),
        regionName: v.string(),
        gateway: v.string(),
        enabled: v.boolean(),
        description: v.optional(v.string()),
        connectionStatus: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const org = await resolveStoreOrganization(ctx, args.organizationId);
    const now = Date.now();

    const connections = await ctx.db
      .query("payment_gateway_connections")
      .withIndex("by_org", (idx) => idx.eq("organizationId", org._id))
      .collect();

    const isRazorpayConnected = Boolean(
      connections.some((c) => c.provider === "razorpay" && c.status === "connected") ||
      (org.razorPayKeyId && org.razorPayApiKey)
    );
    const isStripeConnected = Boolean(
      connections.some((c) => c.provider === "stripe" && c.status === "connected") ||
      (org.stripePublishableKey && org.stripeSecretKey)
    );

    // Validate gateway eligibility for all enabled rules
    for (const rule of args.rules) {
      if (rule.enabled && rule.gateway !== "none") {
        if (rule.gateway === "stripe" && !isStripeConnected) {
          throw new Error(
            `Cannot assign Stripe for ${rule.regionName}: Stripe is not connected or active.`
          );
        }
        if (rule.gateway === "razorpay" && !isRazorpayConnected) {
          throw new Error(
            `Cannot assign Razorpay for ${rule.regionName}: Razorpay is not connected or active.`
          );
        }
      }
    }

    // Persist to organization
    const updatedPaymentSplitting = {
      ...(org.paymentSplitting || {}),
      regionalRouting: args.rules,
      updatedAt: now,
    };

    await ctx.db.patch(org._id, {
      paymentSplitting: updatedPaymentSplitting,
      updatedAt: now,
    });

    // Also update metadata on connections
    for (const conn of connections) {
      await ctx.db.patch(conn._id, {
        metadata: {
          ...(conn.metadata || {}),
          regionalRouting: args.rules,
        },
        updatedAt: now,
      });
    }

    return {
      success: true,
      rules: args.rules,
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

    // 1. Resolve store operating currency from authoritative store configuration
    const storeCurrencyInfo = resolveOrganizationCurrency(org);
    const primaryCurrency = storeCurrencyInfo.code;

    // 2. Fetch transactions for this store organization within the query date range (including past year for trends)
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const oneYearAgoMs = args.startOfTodayMs - 366 * ONE_DAY_MS;
    const queryStartMs = Math.min(args.startOfMonthMs, args.startOfTodayMs, oneYearAgoMs);

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

    // 3. Fetch refunds for this store organization within the query date range
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

    let todayGrossMinor = 0;
    let monthGrossMinor = 0;
    let todayRefundsMinor = 0;
    let monthRefundsMinor = 0;

    let successfulPayments = 0;
    let failedPayments = 0;
    let pendingPayments = 0;
    let successfulGrossMinor = 0;
    let failedGrossMinor = 0;
    let pendingGrossMinor = 0;
    let totalGrossMinor = 0;

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

    function extractTransactionAmountMinor(r: any): number {
      if (typeof r?.amountMinor === "number" && !isNaN(r.amountMinor)) {
        return Math.round(r.amountMinor);
      }
      if (typeof r?.amount === "number" && !isNaN(r.amount)) {
        return Math.round(r.amount);
      }
      if (typeof r?.amount_minor === "number" && !isNaN(r.amount_minor)) {
        return Math.round(r.amount_minor);
      }
      if (typeof r?.grossMinor === "number" && !isNaN(r.grossMinor)) {
        return Math.round(r.grossMinor);
      }
      if (typeof r?.amountPaise === "number" && !isNaN(r.amountPaise)) {
        return Math.round(r.amountPaise);
      }
      if (typeof r?.amountMinor === "string") {
        const p = parseFloat(r.amountMinor);
        if (!isNaN(p)) return Math.round(p);
      }
      if (typeof r?.amount === "string") {
        const p = parseFloat(r.amount);
        if (!isNaN(p)) return Math.round(p);
      }
      return 0;
    }

    for (const t of txns) {
      const txCurr = t.currency || primaryCurrency;
      const bucket = getCurrencyBucket(txCurr);
      const effectivePaidTime = t.paidAt || t.createdAt;
      const tAmt = extractTransactionAmountMinor(t);

      if (t.status === "captured" || t.status === "partially_refunded" || t.status === "refunded") {
        successfulPayments++;
        bucket.successfulPayments++;
        if (txCurr === primaryCurrency) successfulGrossMinor += tAmt;
        totalGrossMinor += tAmt;

        if (effectivePaidTime >= args.startOfTodayMs && effectivePaidTime <= args.endOfTodayMs) {
          if (txCurr === primaryCurrency) {
            todayGrossMinor += tAmt;
          }
          bucket.todayGrossMinor += tAmt;
        }

        if (effectivePaidTime >= args.startOfMonthMs && effectivePaidTime <= args.endOfMonthMs) {
          if (txCurr === primaryCurrency) {
            monthGrossMinor += tAmt;
          }
          bucket.monthGrossMinor += tAmt;
        }
      } else if (t.status === "failed") {
        failedPayments++;
        bucket.failedPayments++;
        if (txCurr === primaryCurrency) failedGrossMinor += tAmt;
        totalGrossMinor += tAmt;
      } else if (t.status === "pending" || t.status === "authorized" || t.status === "created") {
        pendingPayments++;
        bucket.pendingPayments++;
        if (txCurr === primaryCurrency) pendingGrossMinor += tAmt;
        totalGrossMinor += tAmt;
      }
    }

    let refundCount = 0;
    for (const r of refunds) {
      const refCurr = r.currency || primaryCurrency;
      if (r.status === "processed") {
        refundCount++;
        const bucket = getCurrencyBucket(refCurr);
        const effectiveRefundTime = r.processedAt || r.initiatedAt;

        if (effectiveRefundTime >= args.startOfTodayMs && effectiveRefundTime <= args.endOfTodayMs) {
          if (refCurr === primaryCurrency) {
            todayRefundsMinor += r.amountMinor;
          }
          bucket.todayRefundsMinor += r.amountMinor;
        }

        if (effectiveRefundTime >= args.startOfMonthMs && effectiveRefundTime <= args.endOfMonthMs) {
          if (refCurr === primaryCurrency) {
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
    const failureRate =
      totalEvaluated > 0
        ? Math.round((failedPayments / totalEvaluated) * 1000) / 10
        : 0;

    // 4. Compute dynamic payment trends across 7D, 30D, and 1Y ranges using actual store transactions
    // 7D Trend: 7 daily bars ending with today (args.endOfTodayMs)
    const trend7D: { label: string; value: number; formattedAmount: string; isLatest?: boolean; amountMinor: number }[] = [];
    let max7DMinor = 0;
    for (let i = 0; i < 7; i++) {
      const dayStart = args.startOfTodayMs - (6 - i) * ONE_DAY_MS;
      const dayEnd = dayStart + ONE_DAY_MS - 1;
      const d = new Date(dayStart);
      const dayLabel = d.toLocaleDateString(storeCurrencyInfo.locale || "en-IN", { weekday: "short" });

      const dayTotalMinor = txns
        .filter((t) => {
          const tTime = t.paidAt || t.createdAt;
          const tCurr = t.currency || primaryCurrency;
          return (
            tCurr === primaryCurrency &&
            (t.status === "captured" || t.status === "partially_refunded" || t.status === "refunded") &&
            tTime >= dayStart &&
            tTime <= dayEnd
          );
        })
        .reduce((sum, t) => sum + (t.amountMinor || 0), 0);

      if (dayTotalMinor > max7DMinor) max7DMinor = dayTotalMinor;
      trend7D.push({
        label: i === 6 ? "Today" : dayLabel,
        value: 0,
        amountMinor: dayTotalMinor,
        formattedAmount: formatCurrencyMinor(dayTotalMinor, primaryCurrency, storeCurrencyInfo.locale),
        isLatest: i === 6,
      });
    }
    for (const point of trend7D) {
      point.value = max7DMinor > 0 ? Math.round((point.amountMinor / max7DMinor) * 100) : 0;
    }

    // 30D Trend: 4 weekly bars ending with today
    const trend30D: { label: string; value: number; formattedAmount: string; isLatest?: boolean; amountMinor: number }[] = [];
    let max30DMinor = 0;
    for (let w = 0; w < 4; w++) {
      const weekStart = args.endOfTodayMs - (4 - w) * 7 * ONE_DAY_MS + 1;
      const weekEnd = weekStart + 7 * ONE_DAY_MS - 1;

      const weekTotalMinor = txns
        .filter((t) => {
          const tTime = t.paidAt || t.createdAt;
          const tCurr = t.currency || primaryCurrency;
          return (
            tCurr === primaryCurrency &&
            (t.status === "captured" || t.status === "partially_refunded" || t.status === "refunded") &&
            tTime >= weekStart &&
            tTime <= weekEnd
          );
        })
        .reduce((sum, t) => sum + (t.amountMinor || 0), 0);

      if (weekTotalMinor > max30DMinor) max30DMinor = weekTotalMinor;
      trend30D.push({
        label: `Week ${w + 1}`,
        value: 0,
        amountMinor: weekTotalMinor,
        formattedAmount: formatCurrencyMinor(weekTotalMinor, primaryCurrency, storeCurrencyInfo.locale),
        isLatest: w === 3,
      });
    }
    for (const point of trend30D) {
      point.value = max30DMinor > 0 ? Math.round((point.amountMinor / max30DMinor) * 100) : 0;
    }

    // 1Y Trend: 12 monthly bars ending with current month
    const trend1Y: { label: string; value: number; formattedAmount: string; isLatest?: boolean; amountMinor: number }[] = [];
    let max1YMinor = 0;
    const currentYear = new Date(args.endOfTodayMs).getUTCFullYear();
    const currentMonthIdx = new Date(args.endOfTodayMs).getUTCMonth();
    for (let m = 0; m < 12; m++) {
      const targetMonthDate = new Date(Date.UTC(currentYear, currentMonthIdx - (11 - m), 1, 0, 0, 0));
      const mStart = targetMonthDate.getTime();
      const nextMonthDate = new Date(Date.UTC(currentYear, currentMonthIdx - (11 - m) + 1, 1, 0, 0, 0));
      const mEnd = nextMonthDate.getTime() - 1;
      const mLabel = targetMonthDate.toLocaleDateString(storeCurrencyInfo.locale || "en-IN", { month: "short" });

      const monthTotalMinor = txns
        .filter((t) => {
          const tTime = t.paidAt || t.createdAt;
          const tCurr = t.currency || primaryCurrency;
          return (
            tCurr === primaryCurrency &&
            (t.status === "captured" || t.status === "partially_refunded" || t.status === "refunded") &&
            tTime >= mStart &&
            tTime <= mEnd
          );
        })
        .reduce((sum, t) => sum + (t.amountMinor || 0), 0);

      if (monthTotalMinor > max1YMinor) max1YMinor = monthTotalMinor;
      trend1Y.push({
        label: mLabel,
        value: 0,
        amountMinor: monthTotalMinor,
        formattedAmount: formatCurrencyMinor(monthTotalMinor, primaryCurrency, storeCurrencyInfo.locale),
        isLatest: m === 11,
      });
    }
    for (const point of trend1Y) {
      point.value = max1YMinor > 0 ? Math.round((point.amountMinor / max1YMinor) * 100) : 0;
    }

    const paymentTrends = {
      "7D": trend7D,
      "30D": trend30D,
      "1Y": trend1Y,
    };

    return {
      organizationId: org._id,
      storeName: org.name,
      storeCountry: org.country,
      storeCurrency: primaryCurrency,
      storeCurrencyInfo,
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
      successfulGrossMinor,
      failedGrossMinor,
      pendingGrossMinor,
      totalGrossMinor,
      refundCount,
      successRate,
      failureRate,
      currencies,
      paymentTrends,
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
    let eventCategory = "payment";
    if (
      args.eventType.startsWith("refund.") ||
      args.eventType.startsWith("charge.refunded")
    ) {
      eventCategory = "refund";
    } else if (
      args.eventType.startsWith("settlement.") ||
      args.eventType.startsWith("payout.")
    ) {
      eventCategory = "settlement";
    }

    let eventRecordId = existingEvent?._id;
    if (!existingEvent || !eventRecordId) {
      eventRecordId = await ctx.db.insert("payment_webhook_events", {
        organizationId: org._id,
        connectionId,
        provider: args.provider,
        providerEventId: args.providerEventId,
        eventType: args.eventType,
        eventCategory,
        payload: args.payload,
        signatureVerified: args.signatureVerified,
        processingStatus: args.signatureVerified ? "processing" : "failed",
        attemptCount: 1,
        receivedAt: now,
        lastError: args.signatureVerified ? undefined : "UNVERIFIED_SIGNATURE: Webhook signature verification failed.",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(eventRecordId, {
        eventCategory,
        signatureVerified: args.signatureVerified,
        processingStatus: args.signatureVerified ? "processing" : "failed",
        attemptCount: (existingEvent.attemptCount || 1) + 1,
        lastError: args.signatureVerified ? undefined : "UNVERIFIED_SIGNATURE: Webhook signature verification failed.",
        updatedAt: now,
      });
    }

    if (!args.signatureVerified) {
      return {
        eventId: eventRecordId,
        success: false,
        error: "Signature verification failed. Unverified events are not processed.",
      };
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

          const targetOrderId =
            payment.notes?.orderId ||
            payment.notes?.order_id ||
            payment.notes?.prestOrderId;
          if (targetOrderId) {
            try {
              const normOrderId = ctx.db.normalizeId("orders", targetOrderId);
              if (normOrderId) {
                patchData.internalOrderId = normOrderId;
                if (normalizedStatus === "captured") {
                  const targetOrder = await ctx.db.get(normOrderId);
                  if (targetOrder && targetOrder.paymentStatus !== "Paid") {
                    await ctx.db.patch(targetOrder._id, {
                      paymentStatus: "Paid",
                      paymentMode: "Razorpay",
                      updatedAt: now,
                    });
                  }
                }
              }
            } catch {}
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
      } else if (
        args.provider === "stripe" &&
        (eventType === "payment_intent.succeeded" ||
          eventType === "payment_intent.payment_failed" ||
          eventType === "payment_intent.amount_capturable_updated" ||
          eventType === "payment_intent.created" ||
          eventType === "charge.succeeded" ||
          eventType === "charge.failed")
      ) {
        const stripeObj = parsedPayload.data?.object;
        if (!stripeObj || !stripeObj.id) {
          throw new Error("Missing Stripe payment entity in payload");
        }

        const providerPaymentId = stripeObj.id;
        const rawStatus = stripeObj.status;
        let normalizedStatus: "authorized" | "captured" | "failed" | "pending" = "pending";
        if (rawStatus === "succeeded" || eventType === "payment_intent.succeeded" || eventType === "charge.succeeded") {
          normalizedStatus = "captured";
        } else if (rawStatus === "failed" || eventType === "payment_intent.payment_failed" || eventType === "charge.failed") {
          normalizedStatus = "failed";
        } else if (rawStatus === "requires_capture" || eventType === "payment_intent.amount_capturable_updated") {
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

          const targetOrderId = stripeObj.metadata?.orderId || stripeObj.metadata?.prestOrderId;
          let linkedOrderDoc: any = null;
          if (targetOrderId) {
            try {
              const normOrderId = ctx.db.normalizeId("orders", targetOrderId);
              if (normOrderId) {
                patchData.internalOrderId = normOrderId;
                const targetOrder = await ctx.db.get(normOrderId);
                if (targetOrder) {
                  linkedOrderDoc = targetOrder;
                  if (normalizedStatus === "captured" && targetOrder.paymentStatus !== "Paid") {
                    await ctx.db.patch(targetOrder._id, {
                      paymentStatus: "Paid",
                      paymentMode: "Stripe",
                      updatedAt: now,
                    });
                  }
                }
              }
            } catch {}
          }

          if (!linkedOrderDoc && existingTxn.internalOrderId) {
            try {
              linkedOrderDoc = await ctx.db.get(existingTxn.internalOrderId);
            } catch {}
          }

          const existingMeta = existingTxn.metadata || {};
          const incomingMeta = stripeObj.metadata || {};
          const mergedWebhookMeta: Record<string, any> = {
            ...existingMeta,
            ...incomingMeta,
          };
          if (linkedOrderDoc) {
            if (!mergedWebhookMeta.orderType && linkedOrderDoc.orderType) {
              mergedWebhookMeta.orderType = linkedOrderDoc.orderType;
            }
            if (!mergedWebhookMeta.orderNumber && linkedOrderDoc.orderNumber) {
              mergedWebhookMeta.orderNumber = linkedOrderDoc.orderNumber;
            }
            if (linkedOrderDoc.orderType === "DineIn" && !mergedWebhookMeta.table) {
              mergedWebhookMeta.table = linkedOrderDoc.table?.number || linkedOrderDoc.tableId;
            }
          }
          if (mergedWebhookMeta.orderType && mergedWebhookMeta.orderType !== "DineIn") {
            delete mergedWebhookMeta.table;
          }
          patchData.metadata = mergedWebhookMeta;

          if (normalizedStatus === "captured") {
            patchData.paidAt = stripeObj.created ? stripeObj.created * 1000 : now;
          } else if (normalizedStatus === "failed") {
            patchData.failedAt = stripeObj.created ? stripeObj.created * 1000 : now;
            patchData.errorCode = stripeObj.last_payment_error?.code || stripeObj.failure_code || existingTxn.errorCode;
            patchData.errorMessage = stripeObj.last_payment_error?.message || stripeObj.failure_message || existingTxn.errorMessage;
          }

          if (stripeObj.amount_refunded !== undefined) {
            patchData.refundedAmountMinor = stripeObj.amount_refunded;
          }

          await ctx.db.patch(existingTxn._id, patchData);
        } else {
          if (!connectionId) {
            throw new Error(`Cannot create transaction: No connection found for provider ${args.provider}`);
          }

          const customerEmail = stripeObj.receipt_email || stripeObj.billing_details?.email;
          const customerName =
            stripeObj.billing_details?.name ||
            stripeObj.shipping?.name ||
            stripeObj.metadata?.customerName;
          const customerPhone =
            stripeObj.billing_details?.phone ||
            stripeObj.shipping?.phone ||
            stripeObj.metadata?.customerPhone;
          const paymentMethod =
            stripeObj.payment_method_details?.type ||
            stripeObj.payment_method_types?.[0] ||
            "card";

          const rawTargetOrderId =
            stripeObj.metadata?.orderId || stripeObj.metadata?.prestOrderId;
          let internalOrderId: any = undefined;
          let newOrderDoc: any = null;
          if (rawTargetOrderId) {
            try {
              const normId = ctx.db.normalizeId("orders", rawTargetOrderId);
              if (normId) {
                internalOrderId = normId;
                const targetOrder = await ctx.db.get(normId);
                if (targetOrder) {
                  newOrderDoc = targetOrder;
                  if (normalizedStatus === "captured" && targetOrder.paymentStatus !== "Paid") {
                    await ctx.db.patch(targetOrder._id, {
                      paymentStatus: "Paid",
                      paymentMode: "Stripe",
                      updatedAt: now,
                    });
                  }
                }
              }
            } catch {}
          }

          const incomingInsertMeta: Record<string, any> = { ...(stripeObj.metadata || {}) };
          if (newOrderDoc) {
            if (!incomingInsertMeta.orderType && newOrderDoc.orderType) {
              incomingInsertMeta.orderType = newOrderDoc.orderType;
            }
            if (!incomingInsertMeta.orderNumber && newOrderDoc.orderNumber) {
              incomingInsertMeta.orderNumber = newOrderDoc.orderNumber;
            }
            if (newOrderDoc.orderType === "DineIn" && !incomingInsertMeta.table) {
              incomingInsertMeta.table = newOrderDoc.table?.number || newOrderDoc.tableId;
            }
          }
          if (incomingInsertMeta.orderType && incomingInsertMeta.orderType !== "DineIn") {
            delete incomingInsertMeta.table;
          }

          const txnId = await ctx.db.insert("payment_transactions", {
            organizationId: org._id,
            connectionId,
            provider: args.provider,
            providerPaymentId,
            providerOrderId:
              stripeObj.metadata?.orderId ||
              stripeObj.metadata?.prestOrderId ||
              providerPaymentId,
            internalOrderId,
            customerName,
            customerEmail,
            customerPhone,
            amountMinor: stripeObj.amount || 0,
            currency: (stripeObj.currency || "USD").toUpperCase(),
            paymentMethod,
            status: normalizedStatus,
            providerStatus: rawStatus || normalizedStatus,
            paidAt:
              normalizedStatus === "captured"
                ? stripeObj.created
                  ? stripeObj.created * 1000
                  : now
                : undefined,
            failedAt:
              normalizedStatus === "failed"
                ? stripeObj.created
                  ? stripeObj.created * 1000
                  : now
                : undefined,
            errorCode: stripeObj.last_payment_error?.code || stripeObj.failure_code,
            errorMessage: stripeObj.last_payment_error?.message || stripeObj.failure_message,
            refundedAmountMinor: stripeObj.amount_refunded || 0,
            metadata: incomingInsertMeta,
            createdAt: stripeObj.created ? stripeObj.created * 1000 : now,
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
        args.provider === "stripe" &&
        (eventType === "charge.refunded" ||
          eventType === "refund.created" ||
          eventType === "refund.updated")
      ) {
        const stripeObj = parsedPayload.data?.object;
        if (!stripeObj || !stripeObj.id) {
          throw new Error("Missing Stripe refund or charge entity in payload");
        }

        if (eventType === "charge.refunded") {
          const providerPaymentId = stripeObj.payment_intent || stripeObj.id;
          const txn = await ctx.db
            .query("payment_transactions")
            .withIndex("by_provider_and_payment_id", (q) =>
              q.eq("provider", args.provider).eq("providerPaymentId", providerPaymentId)
            )
            .first();

          if (txn) {
            const refundedAmount = stripeObj.amount_refunded || txn.amountMinor;
            const isFullyRefunded = refundedAmount >= txn.amountMinor;
            await ctx.db.patch(txn._id, {
              refundedAmountMinor: refundedAmount,
              status: isFullyRefunded ? "refunded" : refundedAmount > 0 ? "partially_refunded" : txn.status,
              updatedAt: now,
            });
          }
        } else {
          // Stripe Refund object
          const providerRefundId = stripeObj.id;
          const providerPaymentId = stripeObj.payment_intent || stripeObj.charge;
          const refundStatus: "processed" | "pending" | "failed" | "cancelled" =
            stripeObj.status === "succeeded"
              ? "processed"
              : stripeObj.status === "failed"
              ? "failed"
              : stripeObj.status === "canceled"
              ? "cancelled"
              : "pending";

          const txn = providerPaymentId
            ? await ctx.db
                .query("payment_transactions")
                .withIndex("by_provider_and_payment_id", (q) =>
                  q.eq("provider", args.provider).eq("providerPaymentId", providerPaymentId)
                )
                .first()
            : null;

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

          let refundDocId = existingRefund?._id;
          if (existingRefund) {
            const shouldUpdateStatus = canTransitionRefund(existingRefund.status, refundStatus);
            const patchData: any = {
              providerRefundId,
              providerStatus: stripeObj.status || refundStatus,
              updatedAt: now,
            };

            if (shouldUpdateStatus) {
              patchData.status = refundStatus;
              if (refundStatus === "processed") {
                patchData.processedAt = stripeObj.created ? stripeObj.created * 1000 : now;
              }
            }

            if (stripeObj.failure_reason) {
              patchData.errorCode = stripeObj.failure_reason;
              patchData.errorMessage = stripeObj.failure_reason;
            }

            await ctx.db.patch(existingRefund._id, patchData);
          } else {
            refundDocId = await ctx.db.insert("payment_refunds", {
              organizationId: org._id,
              connectionId: resolvedConnectionId,
              transactionId: txn?._id,
              provider: args.provider,
              providerRefundId,
              providerPaymentId: providerPaymentId || "",
              amountMinor: stripeObj.amount || 0,
              currency: (stripeObj.currency || "USD").toUpperCase(),
              reason: stripeObj.reason || undefined,
              status: refundStatus,
              providerStatus: stripeObj.status || refundStatus,
              speed: "normal",
              initiatedAt: stripeObj.created ? stripeObj.created * 1000 : now,
              processedAt:
                refundStatus === "processed"
                  ? stripeObj.created
                    ? stripeObj.created * 1000
                    : now
                  : undefined,
              errorCode: stripeObj.failure_reason,
              errorMessage: stripeObj.failure_reason,
              metadata: stripeObj.metadata,
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
        }
      } else if (
        args.provider === "stripe" &&
        (eventType === "payout.paid" ||
          eventType === "payout.created" ||
          eventType === "payout.failed" ||
          eventType === "payout.canceled" ||
          eventType === "payout.updated")
      ) {
        const payout = parsedPayload.data?.object;
        if (!payout || !payout.id) {
          throw new Error("Missing payout entity in payload");
        }

        if (!connectionId) {
          throw new Error(`Cannot process settlement: No connection found for provider ${args.provider}`);
        }

        const providerSettlementId = payout.id;
        const existingSettlement = await ctx.db
          .query("payment_settlements")
          .withIndex("by_connection_and_provider_settlement", (q) =>
            q.eq("connectionId", connectionId!).eq("providerSettlementId", providerSettlementId)
          )
          .first();

        const amountMinor = payout.amount || 0;
        const netAmountMinor = payout.amount || 0;
        const settlementStatus: "processed" | "pending" | "failed" =
          payout.status === "paid"
            ? "processed"
            : payout.status === "failed" || payout.status === "canceled"
            ? "failed"
            : "pending";

        if (existingSettlement) {
          await ctx.db.patch(existingSettlement._id, {
            status: settlementStatus,
            providerStatus: payout.status || settlementStatus,
            utrOrReference: payout.destination || payout.balance_transaction || existingSettlement.utrOrReference,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("payment_settlements", {
            organizationId: org._id,
            connectionId,
            provider: args.provider,
            providerSettlementId,
            amountMinor,
            currency: (payout.currency || "USD").toUpperCase(),
            feesMinor: 0,
            taxMinor: 0,
            netAmountMinor,
            status: settlementStatus,
            providerStatus: payout.status || settlementStatus,
            settlementDate: payout.arrival_date ? payout.arrival_date * 1000 : (payout.created ? payout.created * 1000 : now),
            utrOrReference: payout.destination || payout.balance_transaction || payout.id,
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

    if (provider === "razorpay") {
      const existingInst = await ctx.db
        .query("marketplaceInstallations")
        .withIndex("by_org_and_app", (q) =>
          q.eq("organizationId", org._id).eq("appSlug", "razorpay")
        )
        .first();
      if (existingInst) {
        await ctx.db.patch(existingInst._id, {
          status: "uninstalled",
          statusText: "Not Connected",
          actionType: "install",
          uninstalledAt: now,
          updatedAt: now,
        });
      }
    }

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
      conn?.metadata?.webhookConfigured ||
      conn?.metadata?.webhookSecret ||
      process.env.RAZORPAY_WEBHOOK_SECRET
    );

    const verifiedEvents = webhookEvents.filter((e) => e.signatureVerified === true);
    const processedEvents = webhookEvents.filter(
      (e) => e.signatureVerified === true && e.processingStatus === "processed"
    );
    const recentFailedEvents = webhookEvents.filter(
      (e) => e.processingStatus === "failed" && e.receivedAt >= oneDayAgo
    );

    let webhookStatus: "healthy" | "awaiting_events" | "warning" | "degraded" | "not_configured" | "inactive" =
      "not_configured";

    if (!conn || conn.status === "disconnected") {
      webhookStatus = "inactive";
    } else if (!hasWebhookSecret) {
      webhookStatus = "not_configured";
    } else if (recentFailedEvents.length > 0 && (!lastProcessedAt || lastProcessedAt < oneDayAgo)) {
      webhookStatus = "degraded";
    } else if (processedEvents.length > 0) {
      webhookStatus = "healthy";
    } else {
      webhookStatus = "awaiting_events";
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



