import {
  AccountMode,
  CredentialVerificationResult,
  MerchantProfileResult,
  NormalizedError,
  PaymentCredentials,
  PaymentProviderAdapter,
} from "../types";

export class RazorpayProviderAdapter implements PaymentProviderAdapter {
  readonly provider = "razorpay";
  private readonly baseUrl: string;

  constructor(baseUrl = "https://api.razorpay.com/v1") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  detectAccountMode(keyId: string): AccountMode {
    if (typeof keyId === "string" && keyId.startsWith("rzp_live_")) {
      return "live";
    }
    return "test";
  }

  validateKeyFormat(keyId: string, keySecret: string): { valid: boolean; error?: string } {
    if (!keyId || typeof keyId !== "string" || !keyId.trim()) {
      return { valid: false, error: "Razorpay Key ID is required." };
    }
    if (!keySecret || typeof keySecret !== "string" || !keySecret.trim()) {
      return { valid: false, error: "Razorpay Key Secret is required." };
    }

    const trimmedKey = keyId.trim();
    const trimmedSecret = keySecret.trim();

    if (!trimmedKey.startsWith("rzp_test_") && !trimmedKey.startsWith("rzp_live_")) {
      return {
        valid: false,
        error: "Invalid Key ID format. Razorpay Key ID must begin with 'rzp_test_' or 'rzp_live_'.",
      };
    }

    if (trimmedKey.length < 14 || trimmedKey.length > 50) {
      return {
        valid: false,
        error: "Key ID length is outside the valid range for Razorpay credentials.",
      };
    }

    if (trimmedSecret.length < 10 || trimmedSecret.length > 64) {
      return {
        valid: false,
        error: "Key Secret length is outside the valid range for Razorpay credentials.",
      };
    }

    return { valid: true };
  }

  async verifyCredentials(credentials: PaymentCredentials): Promise<CredentialVerificationResult> {
    const { keyId, keySecret } = credentials;
    const formatCheck = this.validateKeyFormat(keyId, keySecret);
    if (!formatCheck.valid) {
      return {
        success: false,
        verified: false,
        provider: this.provider,
        accountMode: this.detectAccountMode(keyId || ""),
        credentialsValid: false,
        merchantExists: "unknown",
        accountStatus: "unknown",
        code: "INVALID_CREDENTIALS",
        message: formatCheck.error || "Invalid credential format.",
      };
    }

    const accountMode = this.detectAccountMode(keyId);
    const basicAuth = Buffer.from(`${keyId.trim()}:${keySecret.trim()}`).toString("base64");

    try {
      // 1. Perform minimal read-only authenticated request (Fetch Payments with count=1)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${this.baseUrl}/payments?count=1`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
          "User-Agent": "PREST-POS-Gateway/1.0",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        // Authenticated successfully against Razorpay
        return {
          success: true,
          verified: true,
          provider: this.provider,
          accountMode,
          credentialsValid: true,
          // Standard merchant API keys cannot access Partner APIs to confirm activation or MID independently
          merchantExists: "unknown",
          accountStatus: "unknown",
          providerAccountId: keyId.trim(),
          message: "Razorpay credentials authenticated successfully.",
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          verified: false,
          provider: this.provider,
          accountMode,
          credentialsValid: false,
          merchantExists: "unknown",
          accountStatus: "unknown",
          code: "INVALID_CREDENTIALS",
          message: "Invalid Razorpay Key ID or Key Secret.",
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          verified: false,
          provider: this.provider,
          accountMode,
          credentialsValid: false,
          merchantExists: "unknown",
          accountStatus: "unknown",
          code: "INSUFFICIENT_PERMISSIONS",
          message: "Razorpay credentials do not have sufficient permissions to access payments.",
        };
      }

      if (response.status === 429) {
        return {
          success: false,
          verified: false,
          provider: this.provider,
          accountMode,
          credentialsValid: false,
          merchantExists: "unknown",
          accountStatus: "unknown",
          code: "RAZORPAY_RATE_LIMITED",
          message: "Razorpay API rate limit exceeded. Please wait a moment and try again.",
        };
      }

      if (response.status >= 500) {
        return {
          success: false,
          verified: false,
          provider: this.provider,
          accountMode,
          credentialsValid: false,
          merchantExists: "unknown",
          accountStatus: "unknown",
          code: "RAZORPAY_UNAVAILABLE",
          message: "Razorpay payment services are currently experiencing downtime.",
        };
      }

      return {
        success: false,
        verified: false,
        provider: this.provider,
        accountMode,
        credentialsValid: false,
        merchantExists: "unknown",
        accountStatus: "unknown",
        code: "INVALID_CREDENTIALS",
        message: `Razorpay rejected the verification request (HTTP ${response.status}).`,
      };
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("aborted") || err.message?.includes("timeout")) {
        return {
          success: false,
          verified: false,
          provider: this.provider,
          accountMode,
          credentialsValid: false,
          merchantExists: "unknown",
          accountStatus: "unknown",
          code: "NETWORK_TIMEOUT",
          message: "Network timeout connecting to Razorpay verification services.",
        };
      }

      return {
        success: false,
        verified: false,
        provider: this.provider,
        accountMode,
        credentialsValid: false,
        merchantExists: "unknown",
        accountStatus: "unknown",
        code: "RAZORPAY_UNAVAILABLE",
        message: "Failed to establish a network connection with Razorpay.",
      };
    }
  }

  async fetchProfile(credentials: PaymentCredentials): Promise<MerchantProfileResult> {
    const { keyId, keySecret } = credentials;
    const accountMode = this.detectAccountMode(keyId || "");
    const basicAuth = Buffer.from(`${keyId.trim()}:${keySecret.trim()}`).toString("base64");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      // Attempt merchant account endpoint if supported
      const response = await fetch(`${this.baseUrl}/account`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
          "User-Agent": "PREST-POS-Gateway/1.0",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        const data = await response.json().catch(() => ({}));
        return {
          success: true,
          provider: this.provider,
          merchant_name: data.business_name || data.name || null,
          merchant_id: data.id || null,
          account_mode: accountMode,
          connection_status: "connected",
          is_profile_available: true,
        };
      }

      // Standard Razorpay merchant API keys do not have access to /v1/account (partner/oauth scope required).
      // When unavailable (401, 403, 404), return null fields with explicit availability indicator.
      return {
        success: true,
        provider: this.provider,
        merchant_name: null,
        merchant_id: null,
        account_mode: accountMode,
        connection_status: "connected",
        is_profile_available: false,
        message: "Merchant profile endpoint is not available for standard merchant API keys.",
      };
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        return {
          success: false,
          provider: this.provider,
          merchant_name: null,
          merchant_id: null,
          account_mode: accountMode,
          connection_status: "connected",
          is_profile_available: false,
          message: "Razorpay profile retrieval request timed out.",
        };
      }

      // Fallback preserves connection without fabricating IDs
      return {
        success: true,
        provider: this.provider,
        merchant_name: null,
        merchant_id: null,
        account_mode: accountMode,
        connection_status: "connected",
        is_profile_available: false,
        message: "Razorpay merchant profile information is currently unavailable.",
      };
    }
  }

  normalizeError(error: any): NormalizedError {
    const raw = error?.code || error?.message || "";
    if (raw.includes("INVALID_CREDENTIALS") || raw.includes("401")) {
      return {
        code: "INVALID_CREDENTIALS",
        message: "Invalid Razorpay API credentials provided.",
        httpStatus: 401,
      };
    }
    if (raw.includes("INSUFFICIENT_PERMISSIONS") || raw.includes("403")) {
      return {
        code: "INSUFFICIENT_PERMISSIONS",
        message: "Razorpay credentials lack required payment permissions.",
        httpStatus: 403,
      };
    }
    if (raw.includes("RAZORPAY_RATE_LIMITED") || raw.includes("429")) {
      return {
        code: "RAZORPAY_RATE_LIMITED",
        message: "Too many requests sent to Razorpay. Please retry later.",
        httpStatus: 429,
      };
    }
    if (raw.includes("NETWORK_TIMEOUT") || raw.includes("timeout")) {
      return {
        code: "NETWORK_TIMEOUT",
        message: "Network connection to Razorpay timed out.",
        httpStatus: 504,
      };
    }
    if (raw.includes("RAZORPAY_UNAVAILABLE") || raw.includes("503") || raw.includes("500")) {
      return {
        code: "RAZORPAY_UNAVAILABLE",
        message: "Razorpay services are temporarily unavailable.",
        httpStatus: 503,
      };
    }
    if (raw.includes("CONNECTION_NOT_FOUND")) {
      return {
        code: "CONNECTION_NOT_FOUND",
        message: "No connected payment gateway account was found.",
        httpStatus: 404,
      };
    }
    if (raw.includes("CONNECTION_NOT_ACTIVE")) {
      return {
        code: "CONNECTION_NOT_ACTIVE",
        message: "The payment gateway connection is not in an active status.",
        httpStatus: 400,
      };
    }

    return {
      code: "BAD_REQUEST",
      message: error?.message || "An unexpected error occurred during payment gateway operation.",
      httpStatus: 400,
    };
  }
}

