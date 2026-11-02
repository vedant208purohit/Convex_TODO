import { describe, it, expect } from "vitest";
import {
  COUNTRIES_MASTER,
  COUNTRY_DIAL_OPTIONS,
  getCountryMaster,
  getStatesForCountry,
  getCurrencyForCountry,
  getTimezoneForCountry,
  getPhoneCodeForCountry,
  formatPhoneNumberWithCountryCode,
  isIndiaCountry,
  resolveOrganizationCurrency,
  formatPriceWithSymbol,
  formatOrganizationPrice,
} from "./countries";

describe("Centralized Countries Master & Geographical Data Module", () => {
  describe("COUNTRIES_MASTER Definition", () => {
    it("should include core supported countries with valid schemas", () => {
      expect(COUNTRIES_MASTER.IN).toBeDefined();
      expect(COUNTRIES_MASTER.AE).toBeDefined();
      expect(COUNTRIES_MASTER.US).toBeDefined();
      expect(COUNTRIES_MASTER.GB).toBeDefined();
      expect(COUNTRIES_MASTER.CA).toBeDefined();
      expect(COUNTRIES_MASTER.AU).toBeDefined();
      expect(COUNTRIES_MASTER.SG).toBeDefined();

      // Validate India
      expect(COUNTRIES_MASTER.IN.name).toBe("India");
      expect(COUNTRIES_MASTER.IN.phoneCode).toBe("+91");
      expect(COUNTRIES_MASTER.IN.currency.symbol).toBe("₹");
      expect(COUNTRIES_MASTER.IN.defaultTimezone).toBe("Asia/Kolkata");
      expect(COUNTRIES_MASTER.IN.states.length).toBeGreaterThanOrEqual(28);

      // Validate UAE
      expect(COUNTRIES_MASTER.AE.name).toBe("United Arab Emirates");
      expect(COUNTRIES_MASTER.AE.phoneCode).toBe("+971");
      expect(COUNTRIES_MASTER.AE.currency.code).toBe("AED");
      expect(COUNTRIES_MASTER.AE.states.some((s) => s.name === "Dubai")).toBe(true);

      // Validate US
      expect(COUNTRIES_MASTER.US.name).toBe("United States");
      expect(COUNTRIES_MASTER.US.phoneCode).toBe("+1");
      expect(COUNTRIES_MASTER.US.currency.symbol).toBe("$");
      expect(COUNTRIES_MASTER.US.states.length).toBeGreaterThanOrEqual(50);
    });
  });

  describe("getCountryMaster Resolver", () => {
    it("should resolve by ISO code", () => {
      expect(getCountryMaster("IN")?.name).toBe("India");
      expect(getCountryMaster("ae")?.name).toBe("United Arab Emirates");
      expect(getCountryMaster("US")?.name).toBe("United States");
    });

    it("should resolve by full Country Name", () => {
      expect(getCountryMaster("India")?.isoCode).toBe("IN");
      expect(getCountryMaster("United Arab Emirates")?.isoCode).toBe("AE");
      expect(getCountryMaster("australia")?.isoCode).toBe("AU");
    });

    it("should resolve by Phone Dial Code", () => {
      expect(getCountryMaster("+91")?.name).toBe("India");
      expect(getCountryMaster("+971")?.name).toBe("United Arab Emirates");
      expect(getCountryMaster("+1")?.name).toBe("United States");
      expect(getCountryMaster("IN +91")?.name).toBe("India");
    });

    it("should return undefined for invalid or empty inputs", () => {
      expect(getCountryMaster("")).toBeUndefined();
      expect(getCountryMaster(undefined as any)).toBeUndefined();
      expect(getCountryMaster("Atlantis")).toBeUndefined();
    });
  });

  describe("Geographical Helper Functions", () => {
    it("getStatesForCountry should return all states for India and UAE", () => {
      const indiaStates = getStatesForCountry("India");
      expect(indiaStates.length).toBeGreaterThanOrEqual(28);
      expect(indiaStates.some((s) => s.name === "Gujarat")).toBe(true);
      expect(indiaStates.some((s) => s.name === "Maharashtra")).toBe(true);

      const uaeStates = getStatesForCountry("AE");
      expect(uaeStates.some((s) => s.name === "Abu Dhabi")).toBe(true);
      expect(uaeStates.some((s) => s.name === "Dubai")).toBe(true);

      expect(getStatesForCountry("NonExistent")).toEqual([]);
    });

    it("getCurrencyForCountry should return correct currency and symbol", () => {
      expect(getCurrencyForCountry("India")).toEqual({ code: "INR", symbol: "₹" });
      expect(getCurrencyForCountry("AE")).toEqual({ code: "AED", symbol: "AED" });
      expect(getCurrencyForCountry("United States")).toEqual({ code: "USD", symbol: "$" });
      expect(getCurrencyForCountry("United Kingdom")).toEqual({ code: "GBP", symbol: "£" });
      expect(getCurrencyForCountry("Germany")).toEqual({ code: "EUR", symbol: "€" });
    });

    it("getTimezoneForCountry should return default timezone", () => {
      expect(getTimezoneForCountry("India")).toBe("Asia/Kolkata");
      expect(getTimezoneForCountry("United Arab Emirates")).toBe("Asia/Dubai");
      expect(getTimezoneForCountry("US")).toBe("America/New_York");
      expect(getTimezoneForCountry("Singapore")).toBe("Asia/Singapore");
    });

    it("getPhoneCodeForCountry should return phone dial code with plus sign", () => {
      expect(getPhoneCodeForCountry("India")).toBe("+91");
      expect(getPhoneCodeForCountry("AE")).toBe("+971");
      expect(getPhoneCodeForCountry("United States")).toBe("+1");
      expect(getPhoneCodeForCountry("Australia")).toBe("+61");
      expect(getPhoneCodeForCountry("Unknown")).toBe("+91"); // fallback
    });

    it("isIndiaCountry should accurately identify India variants", () => {
      expect(isIndiaCountry("India")).toBe(true);
      expect(isIndiaCountry("india")).toBe(true);
      expect(isIndiaCountry("IN")).toBe(true);
      expect(isIndiaCountry("+91")).toBe(true);
      expect(isIndiaCountry("IN +91")).toBe(true);
      expect(isIndiaCountry("91")).toBe(true);

      expect(isIndiaCountry("United States")).toBe(false);
      expect(isIndiaCountry("+971")).toBe(false);
      expect(isIndiaCountry("AE")).toBe(false);
      expect(isIndiaCountry("")).toBe(false);
      expect(isIndiaCountry(undefined)).toBe(false);
    });
  });

  describe("formatPhoneNumberWithCountryCode", () => {
    it("should format raw Indian 10-digit number with +91", () => {
      expect(formatPhoneNumberWithCountryCode("9876543210", "+91")).toBe("+91 9876543210");
    });

    it("should format raw UAE 9-digit number with +971", () => {
      expect(formatPhoneNumberWithCountryCode("501234567", "+971")).toBe("+971 501234567");
    });

    it("should handle already prefixed dial codes cleanly", () => {
      expect(formatPhoneNumberWithCountryCode("+919876543210")).toBe("+91 9876543210");
      expect(formatPhoneNumberWithCountryCode("+971501234567")).toBe("+971 501234567");
      expect(formatPhoneNumberWithCountryCode("+15551234567")).toBe("+1 5551234567");
    });

    it("should return empty string for blank input", () => {
      expect(formatPhoneNumberWithCountryCode("")).toBe("");
      expect(formatPhoneNumberWithCountryCode("   ")).toBe("");
    });
  });

  describe("COUNTRY_DIAL_OPTIONS", () => {
    it("should contain standard dial options for all major POS target regions", () => {
      expect(COUNTRY_DIAL_OPTIONS.some((o) => o.code === "+91" && o.iso === "IN")).toBe(true);
      expect(COUNTRY_DIAL_OPTIONS.some((o) => o.code === "+971" && o.iso === "AE")).toBe(true);
      expect(COUNTRY_DIAL_OPTIONS.some((o) => o.code === "+1" && o.iso === "US")).toBe(true);
      expect(COUNTRY_DIAL_OPTIONS.some((o) => o.code === "+44" && o.iso === "GB")).toBe(true);
    });
  });

  describe("resolveOrganizationCurrency & formatOrganizationPrice", () => {
    it("should resolve currency for UAE organization without explicit defaultCurrencySymbol", () => {
      const uaeOrg = { country: "AE" };
      const resolved = resolveOrganizationCurrency(uaeOrg);
      expect(resolved.code).toBe("AED");
      expect(resolved.symbol).toBe("AED");
      expect(resolved.countryCode).toBe("AE");

      expect(formatOrganizationPrice(1500, uaeOrg)).toBe("AED 1,500.00");
    });

    it("should resolve currency for India organization correctly", () => {
      const inOrg = { country: "IN" };
      const resolved = resolveOrganizationCurrency(inOrg);
      expect(resolved.code).toBe("INR");
      expect(resolved.symbol).toBe("₹");
      expect(resolved.countryCode).toBe("IN");

      expect(formatOrganizationPrice(1500, inOrg)).toBe("₹1,500.00");
    });

    it("should resolve currency for United States organization correctly", () => {
      const usOrg = { country: "US" };
      const resolved = resolveOrganizationCurrency(usOrg);
      expect(resolved.code).toBe("USD");
      expect(resolved.symbol).toBe("$");
      expect(resolved.countryCode).toBe("US");

      expect(formatOrganizationPrice(1500, usOrg)).toBe("$1,500.00");
    });

    it("should resolve currency for United Kingdom organization correctly", () => {
      const ukOrg = { country: "GB" };
      const resolved = resolveOrganizationCurrency(ukOrg);
      expect(resolved.code).toBe("GBP");
      expect(resolved.symbol).toBe("£");

      expect(formatOrganizationPrice(1500, ukOrg)).toBe("£1,500.00");
    });

    it("should resolve currency for Germany / France (EUR) correctly", () => {
      const deOrg = { country: "DE" };
      const resolved = resolveOrganizationCurrency(deOrg);
      expect(resolved.code).toBe("EUR");
      expect(resolved.symbol).toBe("€");

      expect(formatOrganizationPrice(1500, deOrg)).toBe("€1,500.00");
    });

    it("should fall back safely to India when organization country is undefined", () => {
      const emptyOrg = {};
      const resolved = resolveOrganizationCurrency(emptyOrg);
      expect(resolved.code).toBe("INR");
      expect(resolved.symbol).toBe("₹");
      expect(resolved.countryCode).toBe("IN");

      expect(formatOrganizationPrice(1500, emptyOrg)).toBe("₹1,500.00");
    });

    it("should respect explicit custom currency configuration on the organization", () => {
      const customOrg = {
        country: "AE",
        defaultCurrency: "AED",
        defaultCurrencySymbol: "AED",
      };
      const resolved = resolveOrganizationCurrency(customOrg);
      expect(resolved.code).toBe("AED");
      expect(resolved.symbol).toBe("AED");
      expect(formatOrganizationPrice(25000, customOrg, true)).toBe("AED 250.00");
    });

    it("should format single-char symbols without space and multi-char symbols with space", () => {
      expect(formatPriceWithSymbol(1500, "₹", "IN")).toBe("₹1,500.00");
      expect(formatPriceWithSymbol(1500, "$", "US")).toBe("$1,500.00");
      expect(formatPriceWithSymbol(1500, "£", "GB")).toBe("£1,500.00");
      expect(formatPriceWithSymbol(1500, "€", "DE")).toBe("€1,500.00");
      expect(formatPriceWithSymbol(1500, "AED", "AE")).toBe("AED 1,500.00");
      expect(formatPriceWithSymbol(1500, "SAR", "SA")).toBe("SAR 1,500.00");
      expect(formatPriceWithSymbol(1500, "CA$", "CA")).toBe("CA$ 1,500.00");
    });
  });
});
