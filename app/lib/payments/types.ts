/**
 * Generic Payment Provider Adapter Architecture & Common Types
 *
 * Designed to support Razorpay today, and Stripe, PayPal, Square, etc. in the future
 * through shared polymorphic backend services without modifying the database schema.
 */

export type AccountMode = "test" | "live";

export interface CredentialVerificationResult {
  success: boolean;
  verified: boolean;
  provider: string;
  accountMode: AccountMode;
  credentialsValid: boolean;
  merchantExists: "yes" | "no" | "unknown";
  accountStatus: "active" | "inactive" | "unknown";
  message: string;
  providerAccountId?: string;
  merchantName?: string;
  rawError?: string;
  code?: string;
}

export interface MerchantProfileResult {
  success: boolean;
  provider: string;
  merchant_name: string | null;
  merchant_id: string | null;
  account_mode: AccountMode;
  connection_status: string;
  is_profile_available?: boolean;
  message?: string;
}

export interface NormalizedError {
  code: string;
  message: string;
  httpStatus: number;
}

export interface PaymentCredentials {
  keyId: string;
  keySecret: string;
  accessToken?: string;
  refreshToken?: string;
  [key: string]: unknown;
}

export type NormalizedTransactionStatus =
  | "created"
  | "authorized"
  | "captured"
  | "failed"
  | "pending"
  | "refunded"
  | "partially_refunded"
  | "cancelled";

export interface NormalizedTransaction {
  providerPaymentId: string;
  providerOrderId?: string;
  amountMinor: number;
  currency: string;
  paymentMethod: string;
  status: NormalizedTransactionStatus;
  providerStatus: string;
  paidAt?: number;
  failedAt?: number;
  errorCode?: string;
  errorMessage?: string;
  refundedAmountMinor?: number;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export type NormalizedRefundStatus = "pending" | "processed" | "failed" | "cancelled";

export interface NormalizedRefund {
  providerRefundId: string;
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  status: NormalizedRefundStatus;
  providerStatus: string;
  speed?: string;
  reason?: string;
  initiatedAt: number;
  processedAt?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export type NormalizedSettlementStatus =
  | "pending"
  | "processed"
  | "failed"
  | "partially_processed";

export interface NormalizedSettlement {
  providerSettlementId: string;
  amountMinor: number;
  currency: string;
  status: NormalizedSettlementStatus;
  providerStatus: string;
  settlementDate: number;
  utrOrReference?: string;
  feesMinor?: number;
  taxMinor?: number;
  netAmountMinor: number;
  metadata?: Record<string, unknown>;
}

export interface FetchOptions {
  count?: number;
  skip?: number;
  from?: number; // epoch timestamp in seconds or ms
  to?: number;   // epoch timestamp in seconds or ms
  paymentId?: string;
}

export interface CreateRefundOptions {
  amount?: number; // minor units (paise/cents). If omitted, full refund is requested.
  speed?: "normal" | "optimum";
  notes?: Record<string, string>;
  receipt?: string;
}

export interface RequestSettlementOptions {
  amountMinor: number; // minor units (paise/cents)
  currency?: string;
  description?: string;
  notes?: Record<string, any>;
}

export interface SettlementEligibilityResult {
  success: boolean;
  supportsManualSettlement: boolean;
  isBalanceAvailable: boolean;
  availableBalanceMinor: number | null;
  currency: string;
  settlementDestination: {
    bankName: string;
    maskedAccount: string;
    isDefault: boolean;
    isVerified: boolean;
  } | null;
  minAmountMinor?: number;
  maxAmountMinor?: number;
  explanation?: string;
  code?: string;
  error?: string;
}

export interface SettlementRequestResult {
  success: boolean;
  settlement?: NormalizedSettlement;
  code?: string;
  error?: string;
}

export interface FetchResult<T> {
  items: T[];
  totalCount?: number;
  hasMore: boolean;
  count: number;
  skip: number;
}

export interface CreatePaymentOrderOptions {
  amountMinor: number; // minor units (paise/cents)
  currency: string;    // ISO 4217 code (e.g. "INR")
  receipt?: string;
  notes?: Record<string, string>;
  internalOrderId?: string;
}

export interface PaymentOrderResult {
  success: boolean;
  orderId: string;
  amountMinor: number;
  currency: string;
  receipt?: string;
  providerStatus?: string;
  code?: string;
  error?: string;
}

export interface VerifyPaymentSignatureOptions {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}

/**
 * Universal Provider Adapter Interface
 * All payment gateways (Razorpay, Stripe, PayPal) must adhere to this contract.
 */
export interface PaymentProviderAdapter {
  readonly provider: string;

  /**
   * Returns list of supported capability identifiers for this provider.
   */
  getSupportedCapabilities?(): string[];

  /**
   * Detects whether credentials belong to a test or live environment.
   */
  detectAccountMode(keyId: string): AccountMode;

  /**
   * Validates syntactic format of the provided credentials before making network calls.
   */
  validateKeyFormat(keyId: string, keySecret: string): { valid: boolean; error?: string };

  /**
   * Performs an authentic, minimal read-only check against the provider's REST API.
   * Does NOT persist any data or credentials.
   */
  verifyCredentials(credentials: PaymentCredentials): Promise<CredentialVerificationResult>;

  /**
   * Fetches official merchant account profile information if supported by the provider.
   */
  fetchProfile(credentials: PaymentCredentials): Promise<MerchantProfileResult>;

  /**
   * Fetches payments/transactions from provider REST API.
   */
  fetchTransactions(
    credentials: PaymentCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<NormalizedTransaction>>;

  /**
   * Fetches a single payment record by provider payment ID.
   */
  fetchPayment?(
    credentials: PaymentCredentials,
    paymentId: string
  ): Promise<NormalizedTransaction>;

  /**
   * Creates a payment order for POS checkout flow.
   */
  createPaymentOrder?(
    credentials: PaymentCredentials,
    options: CreatePaymentOrderOptions
  ): Promise<PaymentOrderResult>;

  /**
   * Verifies the cryptographic payment completion signature returned by checkout widget.
   */
  verifyPaymentSignature?(
    options: VerifyPaymentSignatureOptions
  ): boolean;

  /**
   * Verifies incoming webhook HMAC signature.
   */
  verifyWebhookSignature?(
    rawBody: string,
    signature: string,
    secret: string
  ): boolean;

  /**
   * Fetches refunds from provider REST API.
   */
  fetchRefunds(
    credentials: PaymentCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<NormalizedRefund>>;

  /**
   * Initiates a refund for a payment via provider REST API.
   */
  createRefund(
    credentials: PaymentCredentials,
    paymentId: string,
    options?: CreateRefundOptions
  ): Promise<NormalizedRefund>;

  /**
   * Fetches settlements/payouts from provider REST API.
   */
  fetchSettlements(
    credentials: PaymentCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<NormalizedSettlement>>;

  /**
   * Fetches real-time settlement balance and eligibility from provider if supported.
   */
  fetchSettlementEligibility?(
    credentials: PaymentCredentials
  ): Promise<SettlementEligibilityResult>;

  /**
   * Requests a manual or on-demand settlement payout via provider REST API.
   */
  requestSettlement?(
    credentials: PaymentCredentials,
    options: RequestSettlementOptions
  ): Promise<SettlementRequestResult>;

  /**
   * Normalizes provider-specific error codes into standardized platform error representations.
   */
  normalizeError(error: unknown): NormalizedError;
}
