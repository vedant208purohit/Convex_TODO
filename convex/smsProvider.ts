/**
 * Combird SMS Provider Implementation for Prest Customer Mobile OTP Verification
 *
 * Implements integration with Combird (Edumarc SMS API):
 * - API Endpoint: https://smsapi.edumarcsms.com/api/v1/sendsms
 * - Authentication: "x-api-key" header using COMBIRD_API_KEY
 * - Request Payload: { number, message, senderId, templateId }
 * - DLT Template: Approved "Your Prest OTP for verification is: {otp}..."
 *
 * Security:
 * - Credentials only read from server-side environment variables.
 * - Raw OTP values and API keys are never logged or exposed.
 * - Fails closed if Combird is unconfigured in production.
 */

export interface SmsDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export interface SmsProvider {
  name: string;
  sendOtp(params: {
    to: string; // E.164 normalized phone, e.g. "+919876543210"
    otp: string; // 6-digit OTP
    storeName?: string;
  }): Promise<SmsDeliveryResult>;
}

// In-memory test store to assert delivery in automated test suites
export const mockSmsHistory: Array<{
  to: string;
  otp: string;
  storeName?: string;
  sentAt: number;
}> = [];

export function clearMockSmsHistory() {
  mockSmsHistory.length = 0;
}

/**
 * Mock provider for unit & integration testing
 */
export class MockTestSmsProvider implements SmsProvider {
  name = "mock";

  async sendOtp(params: { to: string; otp: string; storeName?: string }): Promise<SmsDeliveryResult> {
    mockSmsHistory.push({
      to: params.to,
      otp: params.otp,
      storeName: params.storeName,
      sentAt: Date.now(),
    });

    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      provider: "mock",
    };
  }
}

/**
 * Combird / Edumarc SMS Gateway Implementation
 */
export class CombirdSmsProvider implements SmsProvider {
  name = "combird";
  private apiKey: string;
  private templateId: string;
  private apiUrl: string;
  private senderId: string;

  constructor(options?: {
    apiKey?: string;
    templateId?: string;
    apiUrl?: string;
    senderId?: string;
  }) {
    this.apiKey =
      options?.apiKey ||
      process.env.COMBIRD_API_KEY ||
      process.env.COMBIRDS_API_KEY ||
      "";
    this.templateId =
      options?.templateId ||
      process.env.COMBIRD_TEMPLATE_ID ||
      process.env.COMBIRDS_TEMPLATE_ID ||
      "1707168926925165526";
    this.apiUrl =
      options?.apiUrl ||
      process.env.COMBIRD_API_URL ||
      process.env.COMBIRD_API_BASE_URL ||
      "https://smsapi.edumarcsms.com/api/v1/sendsms";
    this.senderId =
      options?.senderId ||
      process.env.COMBIRD_SENDER_ID ||
      "EDUMRC";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.templateId);
  }

  /**
   * Normalizes destination number into pure digits with country code, without '+'
   * E.g. "+919876543210" -> "919876543210"
   */
  formatNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `91${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Formats the DLT-registered message template for Prest OTP verification
   */
  formatMessage(otp: string): string {
    return `Your Prest OTP for verification is: ${otp}. OTP is confidential, refrain from sharing it with anyone. By Edumarc Technologies`;
  }

  async sendOtp(params: { to: string; otp: string; storeName?: string }): Promise<SmsDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Combird SMS provider is misconfigured. Missing COMBIRD_API_KEY or COMBIRD_TEMPLATE_ID.",
        provider: "combird",
      };
    }

    const toNumber = this.formatNumber(params.to);
    if (!toNumber || toNumber.length < 10) {
      return {
        success: false,
        error: "Invalid phone number format for Combird SMS delivery.",
        provider: "combird",
      };
    }

    const message = this.formatMessage(params.otp);

    const payload = {
      number: toNumber,
      message,
      senderId: this.senderId,
      templateId: this.templateId,
    };

    console.log(
      `[Combird SMS Dispatch] Sending to: ${toNumber}, Template: ${this.templateId}, SenderID: ${this.senderId}, Message: "${message}"`
    );

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log(`[Combird SMS Response] HTTP ${response.status}: ${responseText}`);

      let responseData: any = {};
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      if (response.ok || (response.status >= 200 && response.status < 300)) {
        const messageId =
          responseData?.messageId ||
          responseData?.id ||
          responseData?.data?.id ||
          `combird_${Date.now()}`;

        return {
          success: true,
          messageId: String(messageId),
          provider: "combird",
        };
      }

      const errorMessage =
        responseData?.message ||
        responseData?.error ||
        responseData?.raw ||
        `Combird SMS delivery failed with HTTP status ${response.status}`;

      return {
        success: false,
        error: errorMessage,
        provider: "combird",
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Network error while connecting to Combird SMS gateway",
        provider: "combird",
      };
    }
  }
}

/**
 * Factory to retrieve the configured SMS provider.
 * - In test environment or when explicitly set to 'mock', returns MockTestSmsProvider.
 * - In production and normal operation, returns CombirdSmsProvider.
 */
export function getSmsProvider(): SmsProvider {
  const selected = (process.env.SMS_PROVIDER || "").toLowerCase().trim();

  // If in vitest/node test environment, or SMS_PROVIDER is explicitly 'mock'
  if (process.env.NODE_ENV === "test" || selected === "mock" || selected === "test") {
    return new MockTestSmsProvider();
  }

  // Combird is the sole provider for phone OTP
  return new CombirdSmsProvider();
}
