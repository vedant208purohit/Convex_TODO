import crypto from "crypto";
import {
  AccountMode,
  CreatePaymentOrderOptions,
  CreateRefundOptions,
  CredentialVerificationResult,
  FetchOptions,
  FetchResult,
  MerchantProfileResult,
  NormalizedError,
  NormalizedRefund,
  NormalizedRefundStatus,
  NormalizedSettlement,
  NormalizedSettlementStatus,
  NormalizedTransaction,
  NormalizedTransactionStatus,
  PaymentCredentials,
  PaymentOrderResult,
  PaymentProviderAdapter,
  RequestSettlementOptions,
  SettlementEligibilityResult,
  SettlementRequestResult,
  VerifyPaymentSignatureOptions,
} from "../types";

export class RazorpayProviderAdapter implements PaymentProviderAdapter {
  readonly provider = "razorpay";
  private readonly baseUrl: string;

  constructor(baseUrl = "https://api.razorpay.com/v1") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  getSupportedCapabilities(): string[] {
    return [
      "verify_credentials",
      "fetch_profile",
      "fetch_transactions",
      "fetch_payment",
      "create_payment_order",
      "verify_payment_signature",
      "verify_webhook_signature",
      "fetch_refunds",
      "create_refund",
      "fetch_settlements",
      "fetch_settlement_eligibility",
      "request_settlement",
    ];
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

  private getBasicAuth(credentials: PaymentCredentials): string {
    const keyId = (credentials.keyId || "").trim().replace(/^['"]|['"]$/g, "");
    const keySecret = (credentials.keySecret || "").trim().replace(/^['"]|['"]$/g, "");
    return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  }

  private toEpochSeconds(val?: number): number | undefined {
    if (val === undefined || val === null) return undefined;
    if (val > 10000000000) {
      return Math.floor(val / 1000);
    }
    return Math.floor(val);
  }

  private toEpochMilliseconds(val?: number): number {
    if (!val) return Date.now();
    if (val < 10000000000) {
      return val * 1000;
    }
    return val;
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
    const basicAuth = this.getBasicAuth(credentials);

    try {
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
        return {
          success: true,
          verified: true,
          provider: this.provider,
          accountMode,
          credentialsValid: true,
          merchantExists: "unknown",
          accountStatus: "unknown",
          providerAccountId: keyId.trim(),
          message: "Razorpay credentials authenticated successfully.",
        };
      }

      if (response.status === 401) {
        let errorDesc = "Invalid Razorpay Key ID or Key Secret.";
        try {
          const errData = await response.json();
          if (errData?.error?.description) {
            errorDesc = errData.error.description;
          }
        } catch {
          // ignore
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
          message: errorDesc,
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
          message: "Razorpay rate limit exceeded. Please wait a moment before trying again.",
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
        message: `Razorpay service returned status ${response.status}.`,
      };
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        return {
          success: false,
          verified: false,
          provider: this.provider,
          accountMode,
          credentialsValid: false,
          merchantExists: "unknown",
          accountStatus: "unknown",
          code: "NETWORK_TIMEOUT",
          message: "Connection to Razorpay timed out.",
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
    const { keyId } = credentials;
    const accountMode = this.detectAccountMode(keyId || "");
    const basicAuth = this.getBasicAuth(credentials);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

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

  async fetchTransactions(
    credentials: PaymentCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<NormalizedTransaction>> {
    const basicAuth = this.getBasicAuth(credentials);
    const count = Math.min(Math.max(options?.count || 10, 1), 100);
    const skip = Math.max(options?.skip || 0, 0);

    const queryParams = new URLSearchParams();
    queryParams.set("count", String(count));
    queryParams.set("skip", String(skip));

    const fromSec = this.toEpochSeconds(options?.from);
    if (fromSec !== undefined) queryParams.set("from", String(fromSec));

    const toSec = this.toEpochSeconds(options?.to);
    if (toSec !== undefined) queryParams.set("to", String(toSec));

    const url = `${this.baseUrl}/payments?${queryParams.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
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

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error?.description || `Razorpay API returned status ${response.status}`;
      throw new Error(`RAZORPAY_API_ERROR: ${response.status} - ${msg}`);
    }

    const data = await response.json();
    const rawItems: any[] = Array.isArray(data.items) ? data.items : [];

    const items: NormalizedTransaction[] = rawItems.map((item) => {
      let status: NormalizedTransactionStatus = "created";
      if (item.status === "captured") status = "captured";
      else if (item.status === "authorized") status = "authorized";
      else if (item.status === "failed") status = "failed";
      else if (item.status === "refunded") status = "refunded";
      else if (item.status === "created") status = "created";

      const amountMinor = Math.round(Number(item.amount || 0));
      const refundedAmountMinor = item.amount_refunded
        ? Math.round(Number(item.amount_refunded))
        : 0;

      if (
        refundedAmountMinor > 0 &&
        refundedAmountMinor < amountMinor &&
        status !== "refunded"
      ) {
        status = "partially_refunded";
      }

      const createdAtMs = this.toEpochMilliseconds(item.created_at);

      return {
        providerPaymentId: item.id,
        providerOrderId: item.order_id || undefined,
        amountMinor,
        currency: (item.currency || "INR").toUpperCase(),
        paymentMethod: (item.method || "card").toLowerCase(),
        status,
        providerStatus: item.status || "created",
        paidAt: item.captured ? createdAtMs : undefined,
        failedAt: item.status === "failed" ? createdAtMs : undefined,
        errorCode: item.error_code || undefined,
        errorMessage: item.error_description || undefined,
        refundedAmountMinor,
        customerEmail: item.email || undefined,
        customerPhone: item.contact || undefined,
        customerName: item.notes?.customer_name || undefined,
        metadata: item.notes || {},
        createdAt: createdAtMs,
      };
    });

    const totalCount = typeof data.count === "number" ? data.count : undefined;
    const hasMore = items.length === count;

    return {
      items,
      totalCount,
      hasMore,
      count,
      skip,
    };
  }

  async fetchPayment(
    credentials: PaymentCredentials,
    paymentId: string
  ): Promise<NormalizedTransaction> {
    const basicAuth = this.getBasicAuth(credentials);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody?.error?.description || `Razorpay API returned status ${response.status}`);
    }

    const item = await response.json();
    let status: NormalizedTransactionStatus = "created";
    if (item.status === "captured") status = "captured";
    else if (item.status === "authorized") status = "authorized";
    else if (item.status === "failed") status = "failed";
    else if (item.status === "refunded") status = "refunded";

    const amountMinor = Math.round(Number(item.amount || 0));
    const refundedAmountMinor = item.amount_refunded
      ? Math.round(Number(item.amount_refunded))
      : 0;

    if (refundedAmountMinor > 0 && refundedAmountMinor < amountMinor && status !== "refunded") {
      status = "partially_refunded";
    }

    const createdAtMs = this.toEpochMilliseconds(item.created_at);

    return {
      providerPaymentId: item.id,
      providerOrderId: item.order_id || undefined,
      amountMinor,
      currency: (item.currency || "INR").toUpperCase(),
      paymentMethod: (item.method || "card").toLowerCase(),
      status,
      providerStatus: item.status || "created",
      paidAt: item.captured ? createdAtMs : undefined,
      failedAt: item.status === "failed" ? createdAtMs : undefined,
      errorCode: item.error_code || undefined,
      errorMessage: item.error_description || undefined,
      refundedAmountMinor,
      customerEmail: item.email || undefined,
      customerPhone: item.contact || undefined,
      customerName: item.notes?.customer_name || undefined,
      metadata: item.notes || {},
      createdAt: createdAtMs,
    };
  }

  async createPaymentOrder(
    credentials: PaymentCredentials,
    options: CreatePaymentOrderOptions
  ): Promise<PaymentOrderResult> {
    const basicAuth = this.getBasicAuth(credentials);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const payload: any = {
      amount: options.amountMinor,
      currency: (options.currency || "INR").toUpperCase(),
      receipt: options.receipt || `rcpt_${Date.now().toString().slice(-8)}`,
      notes: {
        ...(options.notes || {}),
        internalOrderId: options.internalOrderId || "",
      },
    };

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return {
        success: false,
        orderId: "",
        amountMinor: options.amountMinor,
        currency: options.currency || "INR",
        code: errBody?.error?.code || "ORDER_CREATION_FAILED",
        error: errBody?.error?.description || `Razorpay order creation failed with status ${response.status}`,
      };
    }

    const orderData = await response.json();
    return {
      success: true,
      orderId: orderData.id,
      amountMinor: Number(orderData.amount || options.amountMinor),
      currency: orderData.currency || "INR",
      receipt: orderData.receipt,
      providerStatus: orderData.status,
    };
  }

  verifyPaymentSignature(options: VerifyPaymentSignatureOptions): boolean {
    const { orderId, paymentId, signature, secret } = options;
    if (!orderId || !paymentId || !signature || !secret) return false;
    try {
      const text = `${orderId}|${paymentId}`;
      const expected = crypto.createHmac("sha256", secret).update(text).digest("hex");
      const sigBuf = Buffer.from(signature, "utf8");
      const expBuf = Buffer.from(expected, "utf8");
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
    if (!rawBody || !signature || !secret) return false;
    try {
      const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(signature, "utf8");
      const expBuf = Buffer.from(expected, "utf8");
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  async fetchRefunds(
    credentials: PaymentCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<NormalizedRefund>> {
    const basicAuth = this.getBasicAuth(credentials);
    const count = Math.min(Math.max(options?.count || 10, 1), 100);
    const skip = Math.max(options?.skip || 0, 0);

    const queryParams = new URLSearchParams();
    queryParams.set("count", String(count));
    queryParams.set("skip", String(skip));

    const fromSec = this.toEpochSeconds(options?.from);
    if (fromSec !== undefined) queryParams.set("from", String(fromSec));

    const toSec = this.toEpochSeconds(options?.to);
    if (toSec !== undefined) queryParams.set("to", String(toSec));

    const path = options?.paymentId
      ? `/payments/${options.paymentId}/refunds`
      : "/refunds";

    const url = `${this.baseUrl}${path}?${queryParams.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
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

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error?.description || `Razorpay API returned status ${response.status}`;
      throw new Error(`RAZORPAY_API_ERROR: ${response.status} - ${msg}`);
    }

    const data = await response.json();
    const rawItems: any[] = Array.isArray(data.items) ? data.items : [];

    const items: NormalizedRefund[] = rawItems.map((item) => {
      let status: NormalizedRefundStatus = "pending";
      if (item.status === "processed") status = "processed";
      else if (item.status === "failed") status = "failed";
      else if (item.status === "cancelled") status = "cancelled";

      const initiatedAtMs = this.toEpochMilliseconds(item.created_at);
      const processedAtMs =
        item.status === "processed"
          ? this.toEpochMilliseconds(item.processed_at || item.created_at)
          : undefined;

      return {
        providerRefundId: item.id,
        providerPaymentId: item.payment_id,
        amountMinor: Math.round(Number(item.amount || 0)),
        currency: (item.currency || "INR").toUpperCase(),
        status,
        providerStatus: item.status || "pending",
        speed: item.speed_processed || item.speed_requested || undefined,
        reason: item.notes?.reason || undefined,
        initiatedAt: initiatedAtMs,
        processedAt: processedAtMs,
        errorCode: item.error_code || undefined,
        errorMessage: item.error_description || undefined,
        metadata: item.notes || {},
      };
    });

    const totalCount = typeof data.count === "number" ? data.count : undefined;
    const hasMore = items.length === count;

    return {
      items,
      totalCount,
      hasMore,
      count,
      skip,
    };
  }

  async createRefund(
    credentials: PaymentCredentials,
    paymentId: string,
    options?: CreateRefundOptions
  ): Promise<NormalizedRefund> {
    if (!paymentId || typeof paymentId !== "string" || !paymentId.trim()) {
      throw new Error("INVALID_PAYMENT_ID: Valid Razorpay payment ID is required for refunds.");
    }

    const basicAuth = this.getBasicAuth(credentials);
    const body: Record<string, unknown> = {};

    if (options?.amount !== undefined) {
      if (typeof options.amount !== "number" || options.amount <= 0 || !Number.isInteger(options.amount)) {
        throw new Error("INVALID_REFUND_AMOUNT: Refund amount must be a positive integer in minor currency units (paise).");
      }
      body.amount = options.amount;
    }

    if (options?.speed) {
      body.speed = options.speed;
    }
    if (options?.notes && typeof options.notes === "object") {
      body.notes = options.notes;
    }
    if (options?.receipt) {
      body.receipt = options.receipt;
    }

    const url = `${this.baseUrl}/payments/${paymentId.trim()}/refund`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "PREST-POS-Gateway/1.0",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errCode = data?.error?.code || `HTTP_${response.status}`;
      const errMsg = data?.error?.description || "Failed to create refund on Razorpay.";
      throw new Error(`RAZORPAY_REFUND_ERROR: ${errCode} - ${errMsg}`);
    }

    let status: NormalizedRefundStatus = "pending";
    if (data.status === "processed") status = "processed";
    else if (data.status === "failed") status = "failed";
    else if (data.status === "cancelled") status = "cancelled";

    const initiatedAtMs = this.toEpochMilliseconds(data.created_at);
    const processedAtMs =
      data.status === "processed"
        ? this.toEpochMilliseconds(data.processed_at || data.created_at)
        : undefined;

    return {
      providerRefundId: data.id,
      providerPaymentId: data.payment_id || paymentId.trim(),
      amountMinor: Math.round(Number(data.amount || 0)),
      currency: (data.currency || "INR").toUpperCase(),
      status,
      providerStatus: data.status || "pending",
      speed: data.speed_processed || data.speed_requested || undefined,
      reason: data.notes?.reason || undefined,
      initiatedAt: initiatedAtMs,
      processedAt: processedAtMs,
      errorCode: data.error_code || undefined,
      errorMessage: data.error_description || undefined,
      metadata: data.notes || {},
    };
  }

  async fetchSettlements(
    credentials: PaymentCredentials,
    options?: FetchOptions
  ): Promise<FetchResult<NormalizedSettlement>> {
    const basicAuth = this.getBasicAuth(credentials);
    const count = Math.min(Math.max(options?.count || 10, 1), 100);
    const skip = Math.max(options?.skip || 0, 0);

    const queryParams = new URLSearchParams();
    queryParams.set("count", String(count));
    queryParams.set("skip", String(skip));

    const fromSec = this.toEpochSeconds(options?.from);
    if (fromSec !== undefined) queryParams.set("from", String(fromSec));

    const toSec = this.toEpochSeconds(options?.to);
    if (toSec !== undefined) queryParams.set("to", String(toSec));

    const url = `${this.baseUrl}/settlements?${queryParams.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
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

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error?.description || `Razorpay API returned status ${response.status}`;
      throw new Error(`RAZORPAY_API_ERROR: ${response.status} - ${msg}`);
    }

    const data = await response.json();
    const rawItems: any[] = Array.isArray(data.items) ? data.items : [];

    const items: NormalizedSettlement[] = rawItems.map((item) => {
      let status: NormalizedSettlementStatus = "pending";
      if (item.status === "processed") status = "processed";
      else if (item.status === "failed") status = "failed";
      else if (item.status === "partially_processed") status = "partially_processed";

      const settlementDateMs = this.toEpochMilliseconds(item.created_at);
      const grossAmountMinor = Math.round(Number(item.amount || 0));
      const feesMinor = item.fees !== undefined && item.fees !== null ? Math.round(Number(item.fees)) : undefined;
      const taxMinor = item.tax !== undefined && item.tax !== null ? Math.round(Number(item.tax)) : undefined;

      const netAmountMinor =
        feesMinor !== undefined
          ? Math.max(grossAmountMinor - feesMinor - (taxMinor || 0), 0)
          : grossAmountMinor;

      return {
        providerSettlementId: item.id,
        amountMinor: grossAmountMinor,
        currency: (item.currency || "INR").toUpperCase(),
        status,
        providerStatus: item.status || "created",
        settlementDate: settlementDateMs,
        utrOrReference: item.utr || undefined,
        feesMinor,
        taxMinor,
        netAmountMinor,
        metadata: item,
      };
    });

    const totalCount = typeof data.count === "number" ? data.count : undefined;
    const hasMore = items.length === count;

    return {
      items,
      totalCount,
      hasMore,
      count,
      skip,
    };
  }

  async fetchSettlementEligibility(
    credentials: PaymentCredentials
  ): Promise<SettlementEligibilityResult> {
    const basicAuth = this.getBasicAuth(credentials);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      // Probe ondemand settlements endpoint to check merchant account configuration
      const response = await fetch(`${this.baseUrl}/settlements/ondemand`, {
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

      if (response.ok) {
        // Merchant has Instant / On-Demand Settlements enabled
        return {
          success: true,
          supportsManualSettlement: true,
          isBalanceAvailable: false, // Razorpay standard PG API keys do not expose live GET balance
          availableBalanceMinor: null,
          currency: "INR",
          settlementDestination: null,
          explanation:
            "Instant Settlements is enabled on your Razorpay account. Balance clearing is processed according to your bank eligibility.",
        };
      }

      if (response.status === 400 || response.status === 403 || response.status === 404) {
        const errData = await response.json().catch(() => ({}));
        const desc = errData?.error?.description || "";
        const isNotEnabled =
          desc.toLowerCase().includes("not enabled") ||
          desc.toLowerCase().includes("instant settlement") ||
          response.status === 404;

        return {
          success: true,
          supportsManualSettlement: !isNotEnabled,
          isBalanceAvailable: false,
          availableBalanceMinor: null,
          currency: "INR",
          settlementDestination: null,
          explanation: isNotEnabled
            ? "Instant Settlement is not enabled on your Razorpay merchant account. Standard payouts are deposited automatically according to your T+2 schedule."
            : desc || "Real-time settlement balance is managed automatically via scheduled clearing cycles.",
        };
      }

      return {
        success: true,
        supportsManualSettlement: false,
        isBalanceAvailable: false,
        availableBalanceMinor: null,
        currency: "INR",
        settlementDestination: null,
        explanation:
          "Razorpay settlement service returned an unexpected response. Standard automated clearing remains active.",
      };
    } catch (err: any) {
      return {
        success: false,
        supportsManualSettlement: false,
        isBalanceAvailable: false,
        availableBalanceMinor: null,
        currency: "INR",
        settlementDestination: null,
        error: err.message || "Failed to reach Razorpay settlement service.",
      };
    }
  }

  async requestSettlement(
    credentials: PaymentCredentials,
    options: RequestSettlementOptions
  ): Promise<SettlementRequestResult> {
    const { amountMinor, currency = "INR", description, notes } = options;

    if (
      !amountMinor ||
      typeof amountMinor !== "number" ||
      amountMinor <= 0 ||
      !Number.isInteger(amountMinor)
    ) {
      return {
        success: false,
        code: "INVALID_AMOUNT",
        error: "Settlement amount must be a positive integer in minor units.",
      };
    }

    const basicAuth = this.getBasicAuth(credentials);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseUrl}/settlements/ondemand`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "PREST-POS-Gateway/1.0",
        },
        body: JSON.stringify({
          amount: amountMinor,
          settle_full_balance: false,
          description: description || "PREST Marketplace Settlement Request",
          notes: notes || undefined,
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const desc = data?.error?.description || "";
        const code = data?.error?.code || "";

        if (
          desc.toLowerCase().includes("not enabled") ||
          desc.toLowerCase().includes("instant settlement")
        ) {
          return {
            success: false,
            code: "INSTANT_SETTLEMENT_NOT_ENABLED",
            error:
              "Instant Settlement is not enabled on your Razorpay merchant account. Please request Instant Settlements activation from your Razorpay Dashboard.",
          };
        }

        if (
          desc.toLowerCase().includes("exceeds") ||
          desc.toLowerCase().includes("balance") ||
          desc.toLowerCase().includes("insufficient")
        ) {
          return {
            success: false,
            code: "INSUFFICIENT_SETTLEMENT_BALANCE",
            error:
              desc || "The requested settlement amount exceeds your current available Razorpay balance.",
          };
        }

        return {
          success: false,
          code: code || "RAZORPAY_SETTLEMENT_ERROR",
          error: desc || `Razorpay rejected the settlement request (HTTP ${response.status}).`,
        };
      }

      // Successful response
      const settlementDateMs = data.created_at
        ? this.toEpochMilliseconds(data.created_at)
        : Date.now();
      const grossAmountMinor =
        typeof data.amount === "number" ? data.amount : amountMinor;
      const feesMinor = typeof data.fees === "number" ? data.fees : undefined;
      const taxMinor = typeof data.tax === "number" ? data.tax : undefined;
      const netAmountMinor =
        typeof data.amount_settled === "number" ? data.amount_settled : grossAmountMinor;

      let status: NormalizedSettlementStatus = "pending";
      if (data.status === "processed") status = "processed";
      else if (data.status === "failed") status = "failed";
      else if (data.status === "partially_processed") status = "partially_processed";

      const settlement: NormalizedSettlement = {
        providerSettlementId: data.id || `setlod_${Date.now()}`,
        amountMinor: grossAmountMinor,
        currency: data.currency || currency,
        feesMinor,
        taxMinor,
        netAmountMinor,
        status,
        providerStatus: data.status || "created",
        settlementDate: settlementDateMs,
        utrOrReference: data.utr || data.reference_id || undefined,
        metadata: data,
      };

      return {
        success: true,
        settlement,
      };
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("aborted")) {
        return {
          success: false,
          code: "NETWORK_TIMEOUT",
          error: "Connection to Razorpay settlement endpoint timed out.",
        };
      }

      return {
        success: false,
        code: "RAZORPAY_UNAVAILABLE",
        error: err.message || "Failed to establish network connection with Razorpay.",
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
    if (raw.includes("INVALID_REFUND_AMOUNT")) {
      return {
        code: "INVALID_REFUND_AMOUNT",
        message: "Refund amount is invalid or exceeds the refundable balance.",
        httpStatus: 400,
      };
    }
    if (raw.includes("RAZORPAY_REFUND_ERROR")) {
      return {
        code: "REFUND_REJECTED",
        message: error?.message || "Razorpay rejected the refund request.",
        httpStatus: 400,
      };
    }
    if (raw.includes("INSTANT_SETTLEMENT_NOT_ENABLED")) {
      return {
        code: "INSTANT_SETTLEMENT_NOT_ENABLED",
        message:
          error?.message ||
          "Instant Settlement is not enabled on your Razorpay merchant account.",
        httpStatus: 400,
      };
    }
    if (raw.includes("INSUFFICIENT_SETTLEMENT_BALANCE")) {
      return {
        code: "INSUFFICIENT_SETTLEMENT_BALANCE",
        message:
          error?.message ||
          "Requested settlement amount exceeds your available Razorpay balance.",
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
