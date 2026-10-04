/**
 * Centralized Static Master Data for Countries, States, Currencies, Timezones, and Phone Codes.
 * Zero database queries, 0ms synchronous access, offline POS compatible.
 */

export interface StateOption {
  name: string;
  code: string;
}

export interface TimezoneOption {
  label: string;
  value: string;
}

export interface CountryMaster {
  name: string;
  isoCode: string; // ISO 3166-1 alpha-2
  phoneCode: string; // E.164 Dial code with '+'
  currency: {
    code: string;
    symbol: string;
  };
  defaultTimezone: string;
  timezones?: TimezoneOption[];
  states: StateOption[];
  locale: string;
  dateFormat: string;
}

export const COUNTRIES_MASTER: Record<string, CountryMaster> = {
  IN: {
    name: "India",
    isoCode: "IN",
    phoneCode: "+91",
    currency: { code: "INR", symbol: "₹" },
    defaultTimezone: "Asia/Kolkata",
    locale: "en-IN",
    dateFormat: "DD-MM-YYYY",
    timezones: [
      { label: "Asia/Kolkata (IST - UTC+05:30)", value: "Asia/Kolkata" },
    ],
    states: [
      { name: "Andhra Pradesh", code: "AP" },
      { name: "Arunachal Pradesh", code: "AR" },
      { name: "Assam", code: "AS" },
      { name: "Bihar", code: "BR" },
      { name: "Chhattisgarh", code: "CG" },
      { name: "Goa", code: "GA" },
      { name: "Gujarat", code: "GJ" },
      { name: "Haryana", code: "HR" },
      { name: "Himachal Pradesh", code: "HP" },
      { name: "Jharkhand", code: "JH" },
      { name: "Karnataka", code: "KA" },
      { name: "Kerala", code: "KL" },
      { name: "Madhya Pradesh", code: "MP" },
      { name: "Maharashtra", code: "MH" },
      { name: "Manipur", code: "MN" },
      { name: "Meghalaya", code: "ML" },
      { name: "Mizoram", code: "MZ" },
      { name: "Nagaland", code: "NL" },
      { name: "Odisha", code: "OR" },
      { name: "Punjab", code: "PB" },
      { name: "Rajasthan", code: "RJ" },
      { name: "Sikkim", code: "SK" },
      { name: "Tamil Nadu", code: "TN" },
      { name: "Telangana", code: "TS" },
      { name: "Tripura", code: "TR" },
      { name: "Uttar Pradesh", code: "UP" },
      { name: "Uttarakhand", code: "UK" },
      { name: "West Bengal", code: "WB" },
      // Union Territories
      { name: "Andaman and Nicobar Islands", code: "AN" },
      { name: "Chandigarh", code: "CH" },
      { name: "Dadra & Nagar Haveli and Daman & Diu", code: "DN" },
      { name: "Delhi", code: "DL" },
      { name: "Jammu and Kashmir", code: "JK" },
      { name: "Ladakh", code: "LA" },
      { name: "Lakshadweep", code: "LD" },
      { name: "Puducherry", code: "PY" },
    ],
  },
  AE: {
    name: "United Arab Emirates",
    isoCode: "AE",
    phoneCode: "+971",
    currency: { code: "AED", symbol: "AED" },
    defaultTimezone: "Asia/Dubai",
    locale: "en-AE",
    dateFormat: "DD/MM/YYYY",
    timezones: [
      { label: "Asia/Dubai (GST - UTC+04:00)", value: "Asia/Dubai" },
    ],
    states: [
      { name: "Abu Dhabi", code: "AZ" },
      { name: "Ajman", code: "AJ" },
      { name: "Dubai", code: "DU" },
      { name: "Fujairah", code: "FU" },
      { name: "Ras Al Khaimah", code: "RK" },
      { name: "Sharjah", code: "SH" },
      { name: "Umm Al-Quwain", code: "UQ" },
    ],
  },
  US: {
    name: "United States",
    isoCode: "US",
    phoneCode: "+1",
    currency: { code: "USD", symbol: "$" },
    defaultTimezone: "America/New_York",
    locale: "en-US",
    dateFormat: "MM/DD/YYYY",
    timezones: [
      { label: "America/New_York (Eastern - EST/EDT)", value: "America/New_York" },
      { label: "America/Chicago (Central - CST/CDT)", value: "America/Chicago" },
      { label: "America/Denver (Mountain - MST/MDT)", value: "America/Denver" },
      { label: "America/Los_Angeles (Pacific - PST/PDT)", value: "America/Los_Angeles" },
      { label: "America/Phoenix (Arizona - Mountain Standard)", value: "America/Phoenix" },
      { label: "America/Anchorage (Alaska - AKST/AKDT)", value: "America/Anchorage" },
      { label: "Pacific/Honolulu (Hawaii - HST)", value: "Pacific/Honolulu" },
    ],
    states: [
      { name: "Alabama", code: "AL" },
      { name: "Alaska", code: "AK" },
      { name: "Arizona", code: "AZ" },
      { name: "Arkansas", code: "AR" },
      { name: "California", code: "CA" },
      { name: "Colorado", code: "CO" },
      { name: "Connecticut", code: "CT" },
      { name: "Delaware", code: "DE" },
      { name: "Florida", code: "FL" },
      { name: "Georgia", code: "GA" },
      { name: "Hawaii", code: "HI" },
      { name: "Idaho", code: "ID" },
      { name: "Illinois", code: "IL" },
      { name: "Indiana", code: "IN" },
      { name: "Iowa", code: "IA" },
      { name: "Kansas", code: "KS" },
      { name: "Kentucky", code: "KY" },
      { name: "Louisiana", code: "LA" },
      { name: "Maine", code: "ME" },
      { name: "Maryland", code: "MD" },
      { name: "Massachusetts", code: "MA" },
      { name: "Michigan", code: "MI" },
      { name: "Minnesota", code: "MN" },
      { name: "Mississippi", code: "MS" },
      { name: "Missouri", code: "MO" },
      { name: "Montana", code: "MT" },
      { name: "Nebraska", code: "NE" },
      { name: "Nevada", code: "NV" },
      { name: "New Hampshire", code: "NH" },
      { name: "New Jersey", code: "NJ" },
      { name: "New Mexico", code: "NM" },
      { name: "New York", code: "NY" },
      { name: "North Carolina", code: "NC" },
      { name: "North Dakota", code: "ND" },
      { name: "Ohio", code: "OH" },
      { name: "Oklahoma", code: "OK" },
      { name: "Oregon", code: "OR" },
      { name: "Pennsylvania", code: "PA" },
      { name: "Rhode Island", code: "RI" },
      { name: "South Carolina", code: "SC" },
      { name: "South Dakota", code: "SD" },
      { name: "Tennessee", code: "TN" },
      { name: "Texas", code: "TX" },
      { name: "Utah", code: "UT" },
      { name: "Vermont", code: "VT" },
      { name: "Virginia", code: "VA" },
      { name: "Washington", code: "WA" },
      { name: "West Virginia", code: "WV" },
      { name: "Wisconsin", code: "WI" },
      { name: "Wyoming", code: "WY" },
      { name: "District of Columbia", code: "DC" },
    ],
  },
  GB: {
    name: "United Kingdom",
    isoCode: "GB",
    phoneCode: "+44",
    currency: { code: "GBP", symbol: "£" },
    defaultTimezone: "Europe/London",
    locale: "en-GB",
    dateFormat: "DD/MM/YYYY",
    timezones: [
      { label: "Europe/London (GMT/BST - UTC+00:00)", value: "Europe/London" },
    ],
    states: [
      { name: "England", code: "ENG" },
      { name: "Scotland", code: "SCT" },
      { name: "Wales", code: "WLS" },
      { name: "Northern Ireland", code: "NIR" },
    ],
  },
  CA: {
    name: "Canada",
    isoCode: "CA",
    phoneCode: "+1",
    currency: { code: "CAD", symbol: "CA$" },
    defaultTimezone: "America/Toronto",
    locale: "en-CA",
    dateFormat: "YYYY-MM-DD",
    timezones: [
      { label: "America/Toronto (Eastern - Toronto / Ottawa)", value: "America/Toronto" },
      { label: "America/Vancouver (Pacific - Vancouver)", value: "America/Vancouver" },
      { label: "America/Edmonton (Mountain - Calgary / Edmonton)", value: "America/Edmonton" },
      { label: "America/Winnipeg (Central - Winnipeg)", value: "America/Winnipeg" },
      { label: "America/Halifax (Atlantic - Halifax)", value: "America/Halifax" },
      { label: "America/St_Johns (Newfoundland - St. John's)", value: "America/St_Johns" },
    ],
    states: [
      { name: "Alberta", code: "AB" },
      { name: "British Columbia", code: "BC" },
      { name: "Manitoba", code: "MB" },
      { name: "New Brunswick", code: "NB" },
      { name: "Newfoundland and Labrador", code: "NL" },
      { name: "Nova Scotia", code: "NS" },
      { name: "Ontario", code: "ON" },
      { name: "Prince Edward Island", code: "PE" },
      { name: "Quebec", code: "QC" },
      { name: "Saskatchewan", code: "SK" },
      { name: "Northwest Territories", code: "NT" },
      { name: "Nunavut", code: "NU" },
      { name: "Yukon", code: "YT" },
    ],
  },
  AU: {
    name: "Australia",
    isoCode: "AU",
    phoneCode: "+61",
    currency: { code: "AUD", symbol: "A$" },
    defaultTimezone: "Australia/Sydney",
    locale: "en-AU",
    dateFormat: "DD/MM/YYYY",
    timezones: [
      { label: "Australia/Sydney (Eastern - Sydney / Melbourne)", value: "Australia/Sydney" },
      { label: "Australia/Brisbane (Queensland - Brisbane)", value: "Australia/Brisbane" },
      { label: "Australia/Adelaide (Central - Adelaide)", value: "Australia/Adelaide" },
      { label: "Australia/Perth (Western - Perth)", value: "Australia/Perth" },
      { label: "Australia/Darwin (Northern Territory - Darwin)", value: "Australia/Darwin" },
      { label: "Australia/Hobart (Tasmania - Hobart)", value: "Australia/Hobart" },
    ],
    states: [
      { name: "Australian Capital Territory", code: "ACT" },
      { name: "New South Wales", code: "NSW" },
      { name: "Northern Territory", code: "NT" },
      { name: "Queensland", code: "QLD" },
      { name: "South Australia", code: "SA" },
      { name: "Tasmania", code: "TAS" },
      { name: "Victoria", code: "VIC" },
      { name: "Western Australia", code: "WA" },
    ],
  },
  SG: {
    name: "Singapore",
    isoCode: "SG",
    phoneCode: "+65",
    currency: { code: "SGD", symbol: "S$" },
    defaultTimezone: "Asia/Singapore",
    locale: "en-SG",
    dateFormat: "DD/MM/YYYY",
    timezones: [
      { label: "Asia/Singapore (SGT - UTC+08:00)", value: "Asia/Singapore" },
    ],
    states: [
      { name: "Central", code: "01" },
      { name: "East", code: "02" },
      { name: "North", code: "03" },
      { name: "North-East", code: "04" },
      { name: "West", code: "05" },
    ],
  },
  SA: {
    name: "Saudi Arabia",
    isoCode: "SA",
    phoneCode: "+966",
    currency: { code: "SAR", symbol: "SAR" },
    defaultTimezone: "Asia/Riyadh",
    locale: "ar-SA",
    dateFormat: "DD/MM/YYYY",
    timezones: [
      { label: "Asia/Riyadh (AST - UTC+03:00)", value: "Asia/Riyadh" },
    ],
    states: [
      { name: "Riyadh", code: "01" },
      { name: "Makkah", code: "02" },
      { name: "Madinah", code: "03" },
      { name: "Eastern Province", code: "04" },
      { name: "Al Qassim", code: "05" },
      { name: "Asir", code: "06" },
      { name: "Tabuk", code: "07" },
      { name: "Hail", code: "08" },
      { name: "Northern Borders", code: "09" },
      { name: "Jazan", code: "10" },
      { name: "Najran", code: "11" },
      { name: "Al Bahah", code: "12" },
      { name: "Al Jawf", code: "13" },
    ],
  },
  QA: {
    name: "Qatar",
    isoCode: "QA",
    phoneCode: "+974",
    currency: { code: "QAR", symbol: "QAR" },
    defaultTimezone: "Asia/Qatar",
    locale: "ar-QA",
    dateFormat: "DD/MM/YYYY",
    timezones: [
      { label: "Asia/Qatar (AST - UTC+03:00)", value: "Asia/Qatar" },
    ],
    states: [
      { name: "Doha", code: "DA" },
      { name: "Al Rayyan", code: "RA" },
      { name: "Al Wakrah", code: "WA" },
      { name: "Al Khor", code: "KH" },
      { name: "Al Shamal", code: "MS" },
      { name: "Al Daayen", code: "ZA" },
      { name: "Umm Salal", code: "US" },
      { name: "Al Shahaniya", code: "SH" },
    ],
  },
  DE: {
    name: "Germany",
    isoCode: "DE",
    phoneCode: "+49",
    currency: { code: "EUR", symbol: "€" },
    defaultTimezone: "Europe/Berlin",
    locale: "de-DE",
    dateFormat: "DD.MM.YYYY",
    timezones: [
      { label: "Europe/Berlin (CET/CEST - UTC+01:00)", value: "Europe/Berlin" },
    ],
    states: [
      { name: "Baden-Württemberg", code: "BW" },
      { name: "Bavaria", code: "BY" },
      { name: "Berlin", code: "BE" },
      { name: "Brandenburg", code: "BB" },
      { name: "Bremen", code: "HB" },
      { name: "Hamburg", code: "HH" },
      { name: "Hesse", code: "HE" },
      { name: "Lower Saxony", code: "NI" },
      { name: "Mecklenburg-Vorpommern", code: "MV" },
      { name: "North Rhine-Westphalia", code: "NW" },
      { name: "Rhineland-Palatinate", code: "RP" },
      { name: "Saarland", code: "SL" },
      { name: "Saxony", code: "SN" },
      { name: "Saxony-Anhalt", code: "ST" },
      { name: "Schleswig-Holstein", code: "SH" },
      { name: "Thuringia", code: "TH" },
    ],
  },
  FR: {
    name: "France",
    isoCode: "FR",
    phoneCode: "+33",
    currency: { code: "EUR", symbol: "€" },
    defaultTimezone: "Europe/Paris",
    locale: "fr-FR",
    dateFormat: "DD/MM/YYYY",
    timezones: [
      { label: "Europe/Paris (CET/CEST - UTC+01:00)", value: "Europe/Paris" },
    ],
    states: [
      { name: "Auvergne-Rhône-Alpes", code: "ARA" },
      { name: "Bourgogne-Franche-Comté", code: "BFC" },
      { name: "Brittany", code: "BRE" },
      { name: "Centre-Val de Loire", code: "CVL" },
      { name: "Corsica", code: "COR" },
      { name: "Grand Est", code: "GES" },
      { name: "Hauts-de-France", code: "HDF" },
      { name: "Île-de-France", code: "IDF" },
      { name: "Normandy", code: "NOR" },
      { name: "Nouvelle-Aquitaine", code: "NAQ" },
      { name: "Occitanie", code: "OCC" },
      { name: "Pays de la Loire", code: "PDL" },
      { name: "Provence-Alpes-Côte d'Azur", code: "PAC" },
    ],
  },
  JP: {
    name: "Japan",
    isoCode: "JP",
    phoneCode: "+81",
    currency: { code: "JPY", symbol: "¥" },
    defaultTimezone: "Asia/Tokyo",
    locale: "ja-JP",
    dateFormat: "YYYY-MM-DD",
    timezones: [
      { label: "Asia/Tokyo (JST - UTC+09:00)", value: "Asia/Tokyo" },
    ],
    states: [
      { name: "Tokyo", code: "13" },
      { name: "Osaka", code: "27" },
      { name: "Kyoto", code: "26" },
      { name: "Kanagawa", code: "14" },
      { name: "Aichi", code: "23" },
      { name: "Hokkaido", code: "01" },
      { name: "Fukuoka", code: "40" },
    ],
  },
};

/**
 * Common Country Dial Options formatted for quick dropdowns
 */
export const COUNTRY_DIAL_OPTIONS = [
  { code: "+91", label: "IN +91", country: "India", iso: "IN" },
  { code: "+1", label: "US +1", country: "United States", iso: "US" },
  {
    code: "+971",
    label: "AE +971",
    country: "United Arab Emirates",
    iso: "AE",
  },
  { code: "+44", label: "UK +44", country: "United Kingdom", iso: "GB" },
  { code: "+33", label: "FR +33", country: "France", iso: "FR" },
  { code: "+61", label: "AU +61", country: "Australia", iso: "AU" },
  { code: "+65", label: "SG +65", country: "Singapore", iso: "SG" },
  { code: "+49", label: "DE +49", country: "Germany", iso: "DE" },
  { code: "+81", label: "JP +81", country: "Japan", iso: "JP" },
  { code: "+966", label: "SA +966", country: "Saudi Arabia", iso: "SA" },
  { code: "+974", label: "QA +974", country: "Qatar", iso: "QA" },
];

export interface TimezoneOption {
  label: string;
  value: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { label: "Asia/Kolkata (IST)", value: "Asia/Kolkata" },
  { label: "Asia/Dubai (GST)", value: "Asia/Dubai" },
  { label: "America/New_York (EST)", value: "America/New_York" },
  { label: "Europe/London (GMT)", value: "Europe/London" },
  { label: "Europe/Paris (CET)", value: "Europe/Paris" },
  { label: "Asia/Singapore (SGT)", value: "Asia/Singapore" },
  { label: "Australia/Sydney (AEST)", value: "Australia/Sydney" },
  { label: "Asia/Riyadh (AST)", value: "Asia/Riyadh" },
  { label: "Asia/Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "UTC", value: "UTC" },
];

export const COUNTRY_OPTIONS: string[] = Object.values(COUNTRIES_MASTER).map(
  (c) => c.name,
);

export const CURRENCY_OPTIONS = Array.from(
  new Map(
    Object.values(COUNTRIES_MASTER).map((c) => [
      c.currency.code,
      {
        label: `${c.currency.code} (${c.currency.symbol})`,
        currency: c.currency.code,
        symbol: c.currency.symbol,
      },
    ]),
  ).values(),
);

export const PHONE_CODE_OPTIONS = Array.from(
  new Map(
    Object.values(COUNTRIES_MASTER).map((c) => [
      c.phoneCode,
      {
        code: c.phoneCode,
        country: c.name,
      },
    ]),
  ).values(),
);

/**
 * Resolves a CountryMaster object by ISO Code, Country Name, or Phone Dial Code (case-insensitive).
 */
export function getCountryMaster(
  codeOrNameOrDial?: string,
): CountryMaster | undefined {
  if (!codeOrNameOrDial) return undefined;
  const upper = codeOrNameOrDial.toUpperCase().trim();

  // Try direct ISO lookup first
  if (COUNTRIES_MASTER[upper]) {
    return COUNTRIES_MASTER[upper];
  }

  // Look up by country name, ISO code, or phone dial code
  const lower = codeOrNameOrDial.toLowerCase().trim();
  const entry = Object.values(COUNTRIES_MASTER).find(
    (c) =>
      c.name.toLowerCase() === lower ||
      c.isoCode.toLowerCase() === lower ||
      c.phoneCode === codeOrNameOrDial.trim() ||
      `${c.isoCode} ${c.phoneCode}`.toLowerCase() === lower,
  );
  return entry;
}

/**
 * Checks if a country name, ISO code, or phone dial code represents India.
 */
export function isIndiaCountry(codeOrNameOrDial?: string): boolean {
  if (!codeOrNameOrDial) return false;
  const clean = codeOrNameOrDial.trim().toLowerCase();
  return (
    clean === "in" ||
    clean === "india" ||
    clean === "+91" ||
    clean === "in +91" ||
    clean === "91"
  );
}

/**
 * Returns the list of states for a given country ISO code or name.
 */
export function getStatesForCountry(codeOrName: string): StateOption[] {
  const master = getCountryMaster(codeOrName);
  return master?.states || [];
}

/**
 * Returns currency info ({ code, symbol }) for a given country.
 */
export function getCurrencyForCountry(codeOrName: string): {
  code: string;
  symbol: string;
} {
  const master = getCountryMaster(codeOrName);
  return master?.currency || { code: "INR", symbol: "₹" };
}

/**
 * Returns available timezone options for a given country.
 */
export function getTimezonesForCountry(codeOrName: string): TimezoneOption[] {
  const master = getCountryMaster(codeOrName);
  if (master?.timezones && master.timezones.length > 0) {
    return master.timezones;
  }
  if (master?.defaultTimezone) {
    return [{ label: master.defaultTimezone, value: master.defaultTimezone }];
  }
  return TIMEZONE_OPTIONS;
}

/**
 * Returns default timezone for a given country.
 */
export function getTimezoneForCountry(codeOrName: string): string {
  const master = getCountryMaster(codeOrName);
  return master?.defaultTimezone || "Asia/Kolkata";
}

/**
 * Returns default phone dial code (e.g., '+91') for a given country.
 */
export function getPhoneCodeForCountry(codeOrName: string): string {
  const master = getCountryMaster(codeOrName);
  return master?.phoneCode || "+91";
}

/**
 * Formats a phone number cleanly with the country dial code.
 */
export function formatPhoneNumberWithCountryCode(
  rawPhone: string,
  defaultCode: string = "+91",
): string {
  if (!rawPhone || !rawPhone.trim()) return "";
  const trimmed = rawPhone.trim();

  // If already starts with '+', ensure clean spacing between dial code and number
  if (trimmed.startsWith("+")) {
    const digitsOnly = trimmed.replace(/\D/g, "");
    for (const opt of COUNTRY_DIAL_OPTIONS) {
      const codeDigits = opt.code.replace(/\D/g, "");
      if (digitsOnly.startsWith(codeDigits)) {
        const local = digitsOnly.slice(codeDigits.length);
        return `${opt.code} ${local}`;
      }
    }
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  const currentCode = defaultCode.startsWith("+")
    ? defaultCode
    : `+${defaultCode}`;

  if (currentCode === "+91") {
    if (digits.length === 12 && digits.startsWith("91")) {
      return `+91 ${digits.slice(2)}`;
    }
    return `+91 ${digits}`;
  } else if (currentCode === "+1") {
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 ${digits.slice(1)}`;
    }
    return `+1 ${digits}`;
  } else if (currentCode === "+971") {
    if (digits.length === 12 && digits.startsWith("971")) {
      return `+971 ${digits.slice(3)}`;
    }
    return `+971 ${digits}`;
  } else if (currentCode === "+44") {
    if (digits.length === 12 && digits.startsWith("44")) {
      return `+44 ${digits.slice(2)}`;
    }
    return `+44 ${digits}`;
  } else if (currentCode === "+33") {
    if (digits.length === 11 && digits.startsWith("33")) {
      return `+33 ${digits.slice(2)}`;
    }
    return `+33 ${digits}`;
  } else if (currentCode === "+61") {
    if (digits.length === 11 && digits.startsWith("61")) {
      return `+61 ${digits.slice(2)}`;
    }
    return `+61 ${digits}`;
  }

  const dialDigits = currentCode.replace(/\D/g, "");
  if (digits.startsWith(dialDigits) && digits.length > dialDigits.length + 8) {
    return `${currentCode} ${digits.slice(dialDigits.length)}`;
  }
  return `${currentCode} ${digits}`;
}

/**
 * Returns standard IETF BCP 47 locale string for a given country (e.g., 'en-IN', 'en-US', 'en-GB').
 */
export function getLocaleForCountry(codeOrName?: string): string {
  const master = getCountryMaster(codeOrName);
  return master?.locale || (codeOrName?.toLowerCase() === "india" || codeOrName?.toUpperCase() === "IN" ? "en-IN" : "en-US");
}

/**
 * Returns the country's date format pattern (e.g. 'DD-MM-YYYY', 'MM/DD/YYYY').
 */
export function getDateFormatForCountry(codeOrName?: string): string {
  const master = getCountryMaster(codeOrName);
  return master?.dateFormat || "DD/MM/YYYY";
}

/**
 * Centralized Number & Price Grouping Formatter
 * Correctly handles Indian Lakh/Crore grouping (en-IN: 1,00,000.00) vs International Thousand/Million (en-US: 100,000.00).
 */
export function formatCurrencyAmount(
  amount: number | string | undefined | null,
  countryCodeOrName?: string,
  minFractionDigits = 2,
  maxFractionDigits = 2,
): string {
  if (amount === undefined || amount === null || amount === "") return "0.00";
  const num = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/[^0-9.-]+/g, ""));
  if (isNaN(num)) return "0.00";

  const locale = getLocaleForCountry(countryCodeOrName);

  try {
    return num.toLocaleString(locale, {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
    });
  } catch {
    return num.toFixed(minFractionDigits);
  }
}

/**
 * Centralized Price Formatter with Currency Symbol
 * Formats amount with attached currency symbol and country-specific number grouping.
 * Supports both paise/cents (isPaise = true, divides by 100) or decimal units (isPaise = false).
 */
export function formatPriceWithSymbol(
  amount: number | string | undefined | null,
  symbol?: string,
  countryCodeOrName?: string,
  isPaise = false,
): string {
  if (amount === undefined || amount === null || amount === "") {
    return symbol ? `${symbol} 0.00` : "0.00";
  }
  let num = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/[^0-9.-]+/g, ""));
  if (isNaN(num)) num = 0;
  if (isPaise) num = num / 100;

  const formattedNum = formatCurrencyAmount(num, countryCodeOrName);
  return symbol ? `${symbol} ${formattedNum}` : formattedNum;
}

/**
 * Centralized Store Date Formatter
 * Formats timestamps or Dates into the store's regional standard date string.
 */
export function formatStoreDate(
  dateInput: number | string | Date | undefined | null,
  countryCodeOrName?: string,
  timezone?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!dateInput) return "";
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  const locale = getLocaleForCountry(countryCodeOrName);
  const targetTz = timezone || getTimezoneForCountry(countryCodeOrName || "");

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: targetTz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Centralized Store Date & Time Formatter
 * Formats timestamp into date with localized time (e.g. '25/09/2026, 11:30 AM').
 */
export function formatStoreDateTime(
  dateInput: number | string | Date | undefined | null,
  countryCodeOrName?: string,
  timezone?: string,
): string {
  return formatStoreDate(dateInput, countryCodeOrName, timezone, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Centralized Store Time Formatter (e.g. '11:30 AM')
 */
export function formatStoreTime(
  dateInput: number | string | Date | undefined | null,
  timezone?: string,
  countryCodeOrName?: string,
): string {
  if (!dateInput) return "";
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  const locale = getLocaleForCountry(countryCodeOrName);
  const targetTz = timezone || getTimezoneForCountry(countryCodeOrName || "");

  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: targetTz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  }
}

