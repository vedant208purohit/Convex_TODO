/**
 * SMS Provider Abstraction for Prest Customer Phone OTP Verification
 *
 * Implements clean multi-provider support:
 * 1. Twilio (International & India)
 * 2. MSG91 (India / DLT compliance)
 * 3. MockTestProvider (Used for local tests & Vitest runner)
 *
 * Security:
 * - Credentials only read from server-side environment variables.
 * - Raw OTP is never logged in logs or returned to client.
 * - Fails closed if SMS provider is not configured.
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
 * Twilio SMS Gateway Implementation
 */
export class TwilioSmsProvider implements SmsProvider {
  name = "twilio";
  private accountSid: string;
  private authToken: string;
  private fromNumber?: string;
  private messagingServiceSid?: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
    this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  }

  isConfigured(): boolean {
    return Boolean(this.accountSid && this.authToken && (this.fromNumber || this.messagingServiceSid));
  }

  async sendOtp(params: { to: string; otp: string; storeName?: string }): Promise<SmsDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Twilio SMS provider is misconfigured. Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or sender ID.",
        provider: "twilio",
      };
    }

    const brand = params.storeName || "Prest";
    const body = `Your ${brand} verification code is: ${params.otp}. Valid for 5 minutes. Do not share this code with anyone.`;

    const formData = new URLSearchParams();
    formData.append("To", params.to);
    formData.append("Body", body);

    if (this.messagingServiceSid) {
      formData.append("MessagingServiceSid", this.messagingServiceSid);
    } else if (this.fromNumber) {
      formData.append("From", this.fromNumber);
    }

    try {
      const basicAuth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || `Twilio SMS dispatch failed with HTTP ${response.status}`,
          provider: "twilio",
        };
      }

      return {
        success: true,
        messageId: data.sid,
        provider: "twilio",
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to dispatch SMS through Twilio",
        provider: "twilio",
      };
    }
  }
}

/**
 * MSG91 SMS Gateway Implementation (Common in India / DLT)
 */
export class Msg91SmsProvider implements SmsProvider {
  name = "msg91";
  private authKey: string;
  private templateId?: string;

  constructor() {
    this.authKey = process.env.MSG91_AUTH_KEY || "";
    this.templateId = process.env.MSG91_TEMPLATE_ID || process.env.MSG91_FLOW_ID;
  }

  isConfigured(): boolean {
    return Boolean(this.authKey && this.templateId);
  }

  async sendOtp(params: { to: string; otp: string; storeName?: string }): Promise<SmsDeliveryResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "MSG91 SMS provider is misconfigured. Missing MSG91_AUTH_KEY or MSG91_TEMPLATE_ID.",
        provider: "msg91",
      };
    }

    // MSG91 mobile number without '+'
    const cleanMobile = params.to.replace(/\+/g, "");
    const brand = params.storeName || "Prest";

    try {
      const url = "https://control.msg91.com/api/v5/otp";
      const response = await fetch(
        `${url}?template_id=${this.templateId}&mobile=${cleanMobile}&authkey=${this.authKey}&otp=${params.otp}&company_name=${encodeURIComponent(brand)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.type === "error") {
        return {
          success: false,
          error: data?.message || `MSG91 SMS dispatch failed with status ${response.status}`,
          provider: "msg91",
        };
      }

      return {
        success: true,
        messageId: data?.request_id || "msg91_sent",
        provider: "msg91",
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to dispatch SMS through MSG91",
        provider: "msg91",
      };
    }
  }
}

/**
 * Factory to retrieve the configured SMS provider.
 * In test environment or when explicitly configured, returns MockTestSmsProvider.
 * In production, fails closed if no provider is configured.
 */
export function getSmsProvider(): SmsProvider {
  const selected = (process.env.SMS_PROVIDER || "").toLowerCase().trim();

  // If in vitest/node test environment, or SMS_PROVIDER is explicitly 'mock'
  if (process.env.NODE_ENV === "test" || selected === "mock" || selected === "test") {
    return new MockTestSmsProvider();
  }

  if (selected === "msg91" || (!selected && process.env.MSG91_AUTH_KEY)) {
    return new Msg91SmsProvider();
  }

  if (selected === "twilio" || (!selected && process.env.TWILIO_ACCOUNT_SID)) {
    return new TwilioSmsProvider();
  }

  // Fails closed if not test and no credentials exist
  return {
    name: "none",
    sendOtp: async () => ({
      success: false,
      error: "SMS provider is not configured on this server. Contact support or configure TWILIO/MSG91 environment variables.",
      provider: "none",
    }),
  };
}
