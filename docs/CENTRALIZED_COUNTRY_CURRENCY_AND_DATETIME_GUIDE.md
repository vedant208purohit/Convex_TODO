# Centralized Country, Currency & Date/Time Standards Guide

> **Important Developer Requirement**: All code handling country information, state lists, phone calling codes, currency symbols, amount formatting, and store date/time conversions **MUST** strictly use the centralized utilities from [`lib/constants/countries.ts`](../lib/constants/countries.ts). 
> 
> **Do NOT** write ad-hoc formatting functions, hardcode symbols (`$`, `₹`, `£`), or create local helper copies in individual component files.

---

## 1. Golden Architecture Rules

1. **Single Source of Truth**:
   - Every country, state/province list, calling prefix (`+91`, `+1`, `+44`, etc.), currency definition, and timezone mapping originates exclusively from [`lib/constants/countries.ts`](../lib/constants/countries.ts).
2. **Render-Time Formatting Only**:
   - Format numbers for **visual rendering and display** only (e.g. `{currencySymbol}{formatCurrencyAmount(amount, activeOrg?.country)}`).
   - **Never format editable input fields** where users type raw digits (e.g. keep `<input value={amount} onChange={...} />` as standard raw numbers/strings).
3. **Store-Aware Dynamic Resolution**:
   - Always resolve country and timezone dynamically using the active store's organization document:
     - `country`: `activeOrg?.country`
     - `organizationTimeZone`: `activeOrg?.organizationTimeZone`
     - `currencySymbol`: `activeOrg?.defaultCurrencySymbol || (activeOrg?.country ? getCurrencyForCountry(activeOrg.country).symbol : "$")`

---

## 2. Centralized APIs & Functions

All functions are exported directly from `@/lib/constants/countries`:

```typescript
import {
  COUNTRIES_MASTER,
  COUNTRY_OPTIONS,
  TIMEZONE_OPTIONS,
  getPhoneCodeForCountry,
  getStatesForCountry,
  getCurrencyForCountry,
  getTimezoneForCountry,
  getTimezonesForCountry,
  formatCurrencyAmount,
  formatPriceWithSymbol,
  formatStoreDate,
  formatStoreTime,
  formatStoreDateTime,
} from "@/lib/constants/countries";
```

### A. Currency & Number Formatting

#### `formatCurrencyAmount(amount, countryCodeOrName?, minFractionDigits?, maxFractionDigits?)`
Formats numeric values with exact international number grouping matching the country's locale:
- **India (`IN` / `India`)**: `1,00,00,000.00` (Lakhs & Crores grouping)
- **United States / UK / Global**: `10,000,000.00` (Standard thousands grouping)
- **Decimal Precision**: Default is `2` fractional digits. Can be overridden for integer cash notes (e.g. `min = 0, max = 0`).

```typescript
// Standard 2-decimal display
formatCurrencyAmount(12500.5, "India"); // "12,500.50"
formatCurrencyAmount(10000000, "India"); // "1,00,00,000.00"
formatCurrencyAmount(10000000, "United States"); // "10,000,000.00"

// Whole cash note denomination button (0 decimals)
formatCurrencyAmount(500, activeOrg?.country, 0, 0); // "500"
```

#### `formatPriceWithSymbol(amount, symbol?, countryCodeOrName?, isPaise?)`
Convenience helper that prepends the currency symbol and automatically handles minor unit conversions (e.g., paise/cents to standard units).

```typescript
formatPriceWithSymbol(2500, "₹", "India", false); // "₹2,500.00"
formatPriceWithSymbol(250000, "₹", "India", true); // "₹2,500.00" (converted from 250,000 paise)
```

---

### B. Date & Time Formatting

Convex timestamps (`Date.now()` number or ISO string) must be formatted using the store's configured `organizationTimeZone` (Convex schema field: `organizationTimeZone`):

#### `formatStoreDateTime(timestamp, timeZone?, countryCodeOrName?, options?)`
Formats date and time in the store's timezone:
```typescript
formatStoreDateTime(Date.now(), activeOrg?.organizationTimeZone, activeOrg?.country);
// Output: "25 Sep 2026, 03:45 PM"
```

#### `formatStoreDate(timestamp, timeZone?, countryCodeOrName?, options?)`
Formats date only:
```typescript
formatStoreDate(Date.now(), activeOrg?.organizationTimeZone, activeOrg?.country);
// Output: "25 Sep 2026"
```

#### `formatStoreTime(timestamp, timeZone?, countryCodeOrName?, options?)`
Formats time only:
```typescript
formatStoreTime(Date.now(), activeOrg?.organizationTimeZone, activeOrg?.country);
// Output: "03:45 PM"
```

---

### C. Country, State, Phone & Currency Metadata

#### `getCurrencyForCountry(countryNameOrCode)`
Returns `{ code: string, symbol: string, name: string }`.
```typescript
getCurrencyForCountry("India"); // { code: "INR", symbol: "₹", name: "Indian Rupee" }
getCurrencyForCountry("United Kingdom"); // { code: "GBP", symbol: "£", name: "British Pound" }
```

#### `getPhoneCodeForCountry(countryNameOrCode)`
Returns the calling code with `+` prefix (e.g. `"+91"`, `"+1"`, `"+44"`).

#### `getStatesForCountry(countryNameOrCode)`
Returns an array of state objects `Array<{ name: string, code: string }>` for cascading dropdowns.

#### `getTimezoneForCountry(countryNameOrCode)`
Returns the primary IANA timezone string (e.g. `"Asia/Kolkata"`, `"America/New_York"`).

---

## 3. Store Phone Number Storage Standard

### Database Model (`organizations` table)
- Phone numbers are stored in **`organizations.phone`** as a full international string (e.g. `"+919821982192"`).
- *(Note: `organizations.mobile` exists in `schema.ts` as a legacy database column, but active operations, settings, and receipts use `organizations.phone`)*.

### Standard UI Component Pattern (Settings / Forms)
```typescript
// 1. Initial State Parsing
const phoneCode = org.country ? getPhoneCodeForCountry(org.country) : "+91";
let num = (org.phone || "").trim();
if (num.startsWith("+")) {
  const match = PHONE_CODE_OPTIONS.find((opt) => num.startsWith(opt.code));
  if (match) {
    phoneCountryCode = match.code;
    phoneNumber = num.slice(match.code.length).trim();
  }
}

// 2. Saving to Backend Mutation
const fullPhone = phoneNumber.trim()
  ? `${phoneCountryCode}${phoneNumber.trim().replace(/\D/g, "")}`
  : undefined;

await updateOrgMutation({ id: org._id, phone: fullPhone });
```

---

## 4. UI Implementation Cheatsheet

### Standard Header Resolution Pattern
```typescript
export function MyPosComponent({ organizationId }: { organizationId: Id<"organizations"> }) {
  const organizations = useQuery(api.organizations.list);
  const activeOrg = organizations?.find((o) => o?._id === organizationId) || organizations?.[0];
  
  const currencySymbol =
    activeOrg?.defaultCurrencySymbol ||
    (activeOrg?.country ? getCurrencyForCountry(activeOrg.country).symbol : "₹");
    
  return (
    <div>
      {/* Price tag */}
      <span>{currencySymbol}{formatCurrencyAmount(item.price, activeOrg?.country)}</span>
      
      {/* Timestamp */}
      <span>{formatStoreDateTime(order.createdAt, activeOrg?.organizationTimeZone, activeOrg?.country)}</span>
    </div>
  );
}
```

---

## 5. Summary Checklist for Code Reviews & PRs

Before creating or approving any PR, verify:
- [ ] No hardcoded currency symbols (e.g. `"$"`, `"₹"`, `"£"`) in JSX strings.
- [ ] No `.toFixed(2)` or raw `.toLocaleString()` used for monetary values.
- [ ] No hardcoded `"en-IN"` or `"en-US"` in `new Date().toLocaleString()`.
- [ ] Centralized imports only from `@/lib/constants/countries`.
- [ ] TypeScript check `npx tsc --noEmit` passes with 0 errors.
