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

/**
 * Universal Provider Adapter Interface
 * All payment gateways (Razorpay, Stripe, PayPal) must adhere to this contract.
 */
export interface PaymentProviderAdapter {
  readonly provider: string;

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
   * Normalizes provider-specific error codes into standardized platform error representations.
   */
  normalizeError(error: unknown): NormalizedError;
}

