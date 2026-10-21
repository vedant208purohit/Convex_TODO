/// <reference types="vite/client" />
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CombirdSmsProvider, getSmsProvider, MockTestSmsProvider } from "./smsProvider";

describe("Combird SMS Provider Unit Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Configuration & Formatting", () => {
    it("reports configured when API key and template ID are provided", () => {
      const provider = new CombirdSmsProvider({
        apiKey: "test_combird_key",
        templateId: "1707178064151587006",
      });
      expect(provider.isConfigured()).toBe(true);
    });

    it("reports unconfigured when API key is missing", () => {
      const provider = new CombirdSmsProvider({
        apiKey: "",
        templateId: "1707178064151587006",
      });
      expect(provider.isConfigured()).toBe(false);
    });

    it("formats phone number by stripping '+' and preserving country code digits", () => {
      const provider = new CombirdSmsProvider({
        apiKey: "test_key",
        templateId: "1707178064151587006",
      });

      expect(provider.formatNumber("+919876543210")).toBe("919876543210");
      expect(provider.formatNumber("+91 98765-43210")).toBe("919876543210");
      expect(provider.formatNumber("9876543210")).toBe("919876543210"); // auto-prepends 91 for 10-digit Indian mobile
    });

    it("formats exact registered DLT template message for SBS user with 4-digit OTP", () => {
      const provider = new CombirdSmsProvider({
        apiKey: "test_key",
        templateId: "1707178064151587006",
        senderId: "EDUMRC",
      });

      // Test with placeholder example 0015
      const msg0015 = provider.formatMessage("0015");
      expect(msg0015).toBe(
        "Dear SBS user, your OTP for login is: 0015. This code is valid for 2 minutes. OTP is confidential. Do not share it with anyone. - EDUMARC"
      );

      // Test with example 7781
      const msg7781 = provider.formatMessage("7781");
      expect(msg7781).toBe(
        "Dear SBS user, your OTP for login is: 7781. This code is valid for 2 minutes. OTP is confidential. Do not share it with anyone. - EDUMARC"
      );
    });

    it("preserves leading zeros in a four-digit OTP such as 0015", () => {
      const provider = new CombirdSmsProvider({
        apiKey: "test_key",
        templateId: "1707178064151587006",
      });

      const message = provider.formatMessage("0015");
      expect(message).toBe(
        "Dear SBS user, your OTP for login is: 0015. This code is valid for 2 minutes. OTP is confidential. Do not share it with anyone. - EDUMARC"
      );
    });

    it("defaults to approved template ID 1707178064151587006 and sender ID EDUMRC", () => {
      const provider = new CombirdSmsProvider({
        apiKey: "test_key",
      });
      expect((provider as any).templateId).toBe("1707178064151587006");
      expect((provider as any).senderId).toBe("EDUMRC");
    });
  });

  describe("sendOtp Dispatch & HTTP Handling", () => {
    it("fails closed when unconfigured with descriptive error without leaking secrets", async () => {
      const provider = new CombirdSmsProvider({
        apiKey: "",
        templateId: "",
      });

      const result = await provider.sendOtp({
        to: "+919876543210",
        otp: "1234",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Combird SMS provider is misconfigured");
      expect(result.provider).toBe("combird");
    });

    it("successfully delivers SMS when Combird API returns 200 OK", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "success", messageId: "combird_msg_998811" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const provider = new CombirdSmsProvider({
        apiKey: "valid_secret_key",
        templateId: "1707178064151587006",
        apiUrl: "https://smsapi.edumarcsms.com/api/v1/sendsms",
        senderId: "EDUMRC",
      });

      const result = await provider.sendOtp({
        to: "+919876543210",
        otp: "7781",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("combird_msg_998811");
      expect(result.provider).toBe("combird");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://smsapi.edumarcsms.com/api/v1/sendsms");
      expect(init.method).toBe("POST");
      expect(init.headers["x-api-key"]).toBe("valid_secret_key");
      expect(init.headers["Content-Type"]).toContain("application/json");

      const body = JSON.parse(init.body);
      expect(body.number).toBe("919876543210");
      expect(body.senderId).toBe("EDUMRC");
      expect(body.templateId).toBe("1707178064151587006");
      expect(body.message).toBe(
        "Dear SBS user, your OTP for login is: 7781. This code is valid for 2 minutes. OTP is confidential. Do not share it with anyone. - EDUMARC"
      );
    });

    it("never logs raw OTP values and masks phone number in dispatch logs", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, data: { transactionId: "tx_abc123" } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const provider = new CombirdSmsProvider({
        apiKey: "valid_secret_key",
        templateId: "1707178064151587006",
      });

      await provider.sendOtp({
        to: "+919876543210",
        otp: "7781",
      });

      const loggedMessages = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(loggedMessages).not.toContain("7781");
      expect(loggedMessages).not.toContain("919876543210");
      expect(loggedMessages).toContain("91******3210");
    });

    it("handles 401 Unauthorized provider rejection gracefully", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ status: "error", message: "Invalid API key" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const provider = new CombirdSmsProvider({
        apiKey: "invalid_key",
        templateId: "1707178064151587006",
      });

      const result = await provider.sendOtp({
        to: "+919876543210",
        otp: "112233",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid API key");
      expect(result.provider).toBe("combird");
    });

    it("handles network failure and timeout gracefully without crashing", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("ETIMEDOUT: Connection timed out"));
      vi.stubGlobal("fetch", fetchMock);

      const provider = new CombirdSmsProvider({
        apiKey: "test_key",
        templateId: "1707178064151587006",
      });

      const result = await provider.sendOtp({
        to: "+919876543210",
        otp: "112233",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("ETIMEDOUT");
      expect(result.provider).toBe("combird");
    });

    it("rejects invalid destination phone numbers before calling remote gateway", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const provider = new CombirdSmsProvider({
        apiKey: "test_key",
        templateId: "1707178064151587006",
      });

      const result = await provider.sendOtp({
        to: "invalid-phone",
        otp: "123456",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid phone number format");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("Provider Factory Selection", () => {
    it("returns MockTestSmsProvider in test environment", () => {
      (process.env as any).NODE_ENV = "test";
      const provider = getSmsProvider();
      expect(provider).toBeInstanceOf(MockTestSmsProvider);
      expect(provider.name).toBe("mock");
    });

    it("returns CombirdSmsProvider in production environment", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.COMBIRD_API_KEY = "live_combird_key";
      const provider = getSmsProvider();
      expect(provider).toBeInstanceOf(CombirdSmsProvider);
      expect(provider.name).toBe("combird");
    });
  });
});
