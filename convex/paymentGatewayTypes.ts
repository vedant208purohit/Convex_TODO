/**
 * Shared Polymorphic Payment Gateway Domain Types & Registry
 *
 * Supports multi-provider architecture (Razorpay, Stripe, PayPal, and future gateways)
 * under the PREST POS tenant architecture.
 */

export const SUPPORTED_PAYMENT_PROVIDERS = ["razorpay", "stripe", "paypal"] as const;
export type PaymentProvider = (typeof SUPPORTED_PAYMENT_PROVIDERS)[number] | (string & {});

export const PAYMENT_CONNECTION_TYPES = ["api_key", "oauth"] as const;
export type PaymentConnectionType = (typeof PAYMENT_CONNECTION_TYPES)[number];

export const PAYMENT_CONNECTION_STATUSES = [
  "pending",
  "connected",
  "needs_attention",
  "disconnected",
  "error",
] as const;
export type PaymentConnectionStatus = (typeof PAYMENT_CONNECTION_STATUSES)[number];

export const PAYMENT_ACCOUNT_MODES = ["test", "live"] as const;
export type PaymentAccountMode = (typeof PAYMENT_ACCOUNT_MODES)[number];

export const NORMALIZED_TRANSACTION_STATUSES = [
  "created",
  "authorized",
  "captured",
  "failed",
  "pending",
  "refunded",
  "partially_refunded",
  "cancelled",
] as const;
export type NormalizedTransactionStatus = (typeof NORMALIZED_TRANSACTION_STATUSES)[number];

export const NORMALIZED_REFUND_STATUSES = [
  "pending",
  "processed",
  "failed",
  "cancelled",
] as const;
export type NormalizedRefundStatus = (typeof NORMALIZED_REFUND_STATUSES)[number];

export const NORMALIZED_SETTLEMENT_STATUSES = [
  "pending",
  "processed",
  "failed",
  "partially_processed",
] as const;
export type NormalizedSettlementStatus = (typeof NORMALIZED_SETTLEMENT_STATUSES)[number];

export const WEBHOOK_PROCESSING_STATUSES = [
  "received",
  "verified",
  "processing",
  "processed",
  "failed",
  "ignored",
] as const;
export type WebhookProcessingStatus = (typeof WEBHOOK_PROCESSING_STATUSES)[number];

export const SYNC_RESOURCE_TYPES = [
  "transactions",
  "refunds",
  "settlements",
] as const;
export type SyncResourceType = (typeof SYNC_RESOURCE_TYPES)[number];

export const SYNC_TYPES = [
  "initial",
  "incremental",
  "manual",
  "scheduled",
] as const;
export type SyncType = (typeof SYNC_TYPES)[number];

export const SYNC_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const;
export type SyncRunStatus = (typeof SYNC_RUN_STATUSES)[number];

/**
 * Provider-agnostic credential bundle structure (encrypted at rest).
 */
export interface GenericCredentialBundle {
  keyId?: string;
  keySecret?: string;
  accessToken?: string;
  refreshToken?: string;
  webhookSecret?: string;
  expiresAt?: number;
  [key: string]: unknown;
}

/**
 * Masked, public-safe connection summary for frontend queries.
 * NEVER exposes encryptedCredentials, keySecret, or raw tokens.
 */
export interface PublicGatewayConnection {
  _id: string;
  organizationId: string;
  provider: string;
  connectionType: PaymentConnectionType;
  providerAccountId?: string;
  merchantName?: string;
  accountMode: PaymentAccountMode;
  status: PaymentConnectionStatus;
  credentialsUpdatedAt?: number;
  connectedAt?: number;
  disconnectedAt?: number;
  lastVerifiedAt?: number;
  lastSyncAt?: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  isDefault: boolean;
  maskedKeyId?: string;
  createdAt: number;
  updatedAt: number;
}

