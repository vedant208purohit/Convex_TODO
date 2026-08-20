# ORGANIZATION DETAILS IMPLEMENTATION-READINESS AUDIT
**Target Application**: DEFx-POS Default App (`pos-default`)  
**Authoritative Reference**: `docs/prd/organization-details-domain-prd.md`  
**Audit Date**: August 20, 2026  
**Status**: AUDIT ONLY — NO CODE MODIFIED

---

## 1. Executive Summary

This Audit Report evaluates the implementation-readiness of the **Organization Details Domain** for the DEFx-POS Default App (`pos-default`). 

The audit compares the authoritative legacy business specifications documented in `organization-details-domain-prd.md` against the current production implementation of `pos-default` (`convex/schema.ts`, `convex/organizations.ts`, and `convex/organizations.test.ts`).

### Key Audit Findings:
1. **Current Schema Coverage**: The existing `organizations` table in `pos-default` currently implements 50+ operational fields, including identity, POS feature flags, payment mode flags, basic contact fields (`phone`, `addressLine1`, `city`, `state`, `country`, `zipCode`), coordinates (`latitude`, `longitude`), `operationTiming` JSON, and `porterIntegration`.
2. **Missing PRD Fields**: 21 fields from the 38 legacy `organizations_details` columns are **MISSING** or **PARTIALLY IMPLEMENTED**, including GST fields (`isGst`, `inclusiveGst`, `separateGst`, `gstNumber`), FSSAI fields (`isFssai`, `fssaiRegistrationNumber`, `expiryDate`), Currency & Timezone (`defaultCurrency`, `defaultCurrencySymbol`, `organizationTimeZone`), Printing configuration (`receiptPrintCount`, `menuBasedPrintToken`, `showQrCode`), Extended contact (`addressLine2`, `landmark`, `mobile`, `email`, `fax`, `areaCode`), and Payment Gateway secrets (`razorPayKeyId`, `razorPayApiKey`, `stripePublishableKey`, `stripeSecretKey`).
3. **Primary Architectural Recommendation**: **Option A — Flatten Organization Details directly into the `organizations` table**. Because `pos-default` operates under an isolated single-tenant database per store (`ONE ORGANIZATION = ONE CONVEX PROJECT = ONE DATABASE`), creating a separate 1-record `organizationDetails` table introduces redundant database lookups without architectural benefit. Sensitive payment keys will be protected using the established `stripSecrets` helper.

---

## 2. Current Default App Organization Architecture

The target DEFx-POS architecture enforces strict separation of concerns between Master Control Plane and Default POS Application:

```
                    MASTER APP (`pos-master`)
                         Control Plane
                               │
                      Organization Registry
                               │
                               ▼
                    DEFAULT APP (`pos-default`)
                         POS Application
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
               Organization          Store Domains
                    │
                    ▼
              One Convex Project
              One Convex Database
```

- **Master App (`pos-master`)**: Owns global organization registration, project provisioning (`projectId`, `deploymentUrl`), lifecycle state tracking (`provisioning`, `active`, `failed`, `deleted`), and legacy PostgreSQL UUID mapping (`legacyOrganizationId`).
- **Default App (`pos-default`)**: Owns all operational store parameters, POS feature toggles, store profile, contact, location coordinates, GST/FSSAI compliance, currency/timezone, operating hours, printing settings, and payment gateway keys inside the isolated tenant Convex database.

---

## 3. Current Default App Schema (`convex/schema.ts`)

The `organizations` table in `convex/schema.ts` currently defines 54 fields:

| Field Name | Convex Type | Optional/Required | Default Value | Indexing | Business Purpose |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `legacyId` | `v.optional(v.string())` | Optional | `nil` | `by_legacy_id` | Legacy PostgreSQL UUID for migration mapping. |
| `name` | `v.string()` | **Required** | None | None | Primary store name. |
| `slug` | `v.string()` | **Required** | Auto-generated | `by_slug` | Unique URL slug. |
| `legalEntityName` | `v.optional(v.string())` | Optional | `nil` | None | Legal corporate entity name. |
| `published` | `v.boolean()` | **Required** | `false` | None | Store visibility publishing flag. |
| `isTest` | `v.boolean()` | **Required** | `false` | None | Test/demo store flag. |
| `createdAt` | `v.number()` | **Required** | `Date.now()` | None | Creation timestamp. |
| `updatedAt` | `v.number()` | **Required** | `Date.now()` | None | Last update timestamp. |
| `deletedAt` | `v.optional(v.number())` | Optional | `nil` | None | Soft deletion timestamp. |
| `phone` | `v.optional(v.string())` | Optional | `nil` | None | Primary store contact phone number. |
| `addressLine1` | `v.optional(v.string())` | Optional | `nil` | None | Primary street address. |
| `city` | `v.optional(v.string())` | Optional | `nil` | None | Store city. |
| `state` | `v.optional(v.string())` | Optional | `nil` | None | Store state name. |
| `country` | `v.optional(v.string())` | Optional | `nil` | None | Store country name. |
| `zipCode` | `v.optional(v.string())` | Optional | `nil` | None | Postal / ZIP code. |
| `latitude` | `v.optional(v.number())` | Optional | `nil` | None | GPS latitude coordinate. |
| `longitude` | `v.optional(v.number())` | Optional | `nil` | None | GPS longitude coordinate. |
| `operationTiming` | `v.optional(v.any())` | Optional | *Seeded in initializeStore* | None | Weekly operating hours JSON grid. |
| `primaryColor` | `v.optional(v.string())` | Optional | `nil` | None | Brand primary hex color. |
| `secondaryColor` | `v.optional(v.string())` | Optional | `nil` | None | Brand secondary hex color. |
| `theme` | `v.optional(v.string())` | Optional | `nil` | None | UI theme key. |
| `isDineIn` | `v.boolean()` | **Required** | `false` | None | Dine-in service flag. |
| `isTakeAway` | `v.boolean()` | **Required** | `true` | None | Takeaway service flag. |
| `isDelivery` | `v.boolean()` | **Required** | `false` | None | Delivery service flag. |
| `isDashboard`..`isVeg` | `v.boolean()` (16 fields) | **Required** | Various | None | POS module feature flags. |
| `digitalStoreStatus` | `v.boolean()` | **Required** | `false` | None | Digital store active status. |
| `deliveryCashOnDelivery`..`scheduledDeliveryCashPayment` | `v.boolean()` (12 fields) | **Required** | Various | None | Payment mode toggles. |
| `paymentSplitting` | `v.optional(v.any())` | Optional | `nil` | None | Bill splitting rules JSON. |
| `transferPercentage` | `v.number()` | **Required** | `0.03` | None | Platform transfer percentage (3%). |
| `transferHoldTime` | `v.number()` | **Required** | `18000` | None | Transfer hold duration (5 hours). |
| `deliveryAggregator` | `v.boolean()` | **Required** | `false` | None | Delivery logistics aggregator flag. |
| `deliverPartner` | `v.optional(v.string())` | Optional | `nil` | None | Delivery partner name. |
| `porterLagTime` | `v.number()` | **Required** | `0` | None | Porter order lag time. |
| `porterIntegration` | `v.optional(v.any())` | Optional | `nil` | None | Porter logistics metadata JSON. |
| `frenchyId` | `v.optional(v.string())` | Optional | `nil` | None | Franchisor ID. |
| `chargebeeCustomerId` | `v.optional(v.string())` | Optional | `nil` | None | Chargebee customer reference. |
| `whatsappIntegration` | `v.boolean()` | **Required** | `false` | None | WhatsApp integration flag. |
| `prestWhatsappIntegration` | `v.boolean()` | **Required** | `false` | None | Prest WhatsApp flag. |
| `whatsappPhoneNumber` | `v.optional(v.string())` | Optional | `nil` | None | WhatsApp phone. |
| `whatsappAccessToken` | `v.optional(v.string())` | Optional | `nil` | None | Sensitive access token (stripped by `stripSecrets`). |

---

## 4. Current Organization Functions (`convex/organizations.ts`)

| Function | Type | Purpose | Input | Output | Authorization | Validation / Rules Enforced |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `get` | Query | Get store org by ID (secrets stripped) | `{ id: v.union(v.id("organizations"), v.string()) }` | `Doc<"organizations"> \| null` | Open | Filters soft-deleted (`deletedAt`). Strips `whatsappAccessToken`. |
| `getByLegacyId` | Query | Query store by legacy PostgreSQL UUID | `{ legacyId: v.string() }` | `Doc<"organizations"> \| null` | Open | Index lookup `by_legacy_id`. Strips secrets. |
| `getBySlug` | Query | Query store by URL slug | `{ slug: v.string() }` | `Doc<"organizations"> \| null` | Open | Index lookup `by_slug`. Strips secrets. |
| `list` | Query | List non-deleted organizations | None | `Array<Doc<"organizations">>` | Open | Filters `deletedAt === undefined`. Strips secrets. |
| `getWithSecrets` | Query | Internal query returning unstripped org | `{ id: v.union(v.id("organizations"), v.string()) }` | `Doc<"organizations"> \| null` | Admin / Internal | Returns full document including sensitive tokens. |
| `create` | Mutation | Create new store organization | 50+ optional fields, `name: v.string()` | `Id<"organizations">` | Admin / Provisioning | Validates non-blank name, legacyId uniqueness, slug deduplication, service mode rules, delivery aggregator location checks. |
| `update` | Mutation | Patch existing organization | `{ id: v.id("organizations"), ...updates }` | `void` | Store Admin | Enforces onlineStore lock on live stores, payment defaults auto-activation, service type validations. |
| `liveOrganization` | Mutation | Publish store to live state | `{ id: v.id("organizations") }` | `void` | Store Admin | Rejects if `onlineStore === true` ("contact support"). |
| `initializeStore` | Mutation | Seed default store processes, stations, payment modes, categories & operating hours | `{ id: v.id("organizations") }` | `{ success: boolean }` | Store Admin / Provisioning | Idempotent seeding of 7 order processes, Main station, 4 payment modes, 10 inventory categories, and default operating hours schedule. |
| `remove` | Mutation | Soft-delete organization | `{ id: v.id("organizations") }` | `{ success: boolean }` | Store Admin | Sets `deletedAt = Date.now()`. |

---

## 5. Complete PRD Field Mapping

Mapping of all 38 columns from the legacy `organizations_details` PRD against the current `pos-default` implementation:

| Legacy Field | Legacy Type | Current Default Field | Exists? | Recommended Target Field | Status | Audit Notes |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| `id` | `uuid` | `_id` | **Yes** | `_id` (Convex Document ID) | **ALREADY IMPLEMENTED** | System document ID. |
| `organization_id` | `uuid` | N/A (Project Scope) | N/A | Implicit (1 Org per DB) | **NOT APPLICABLE** | In `pos-default`, 1 Convex project = 1 store database. |
| `address_line_1` | `string` | `addressLine1` | **Yes** | `addressLine1` | **ALREADY IMPLEMENTED** | Present in `organizations`. |
| `address_line_2` | `string` | None | No | `addressLine2` | **MISSING** | Needs to be added to `organizations`. |
| `landmark` | `string` | None | No | `landmark` | **MISSING** | Needs to be added to `organizations`. |
| `city` | `string` | `city` | **Yes** | `city` | **ALREADY IMPLEMENTED** | Present in `organizations`. |
| `zip_code` | `string` | `zipCode` | **Yes** | `zipCode` | **ALREADY IMPLEMENTED** | Present in `organizations`. |
| `country_id` | `uuid` | `country` | Partial | `country` (String) | **PARTIALLY IMPLEMENTED** | Currently string `country`. Legacy referenced `countries.id`. |
| `state_id` | `uuid` | `state` | Partial | `state` (String) | **PARTIALLY IMPLEMENTED** | Currently string `state`. Legacy referenced `states.id`. |
| `phone` | `string` | `phone` | **Yes** | `phone` | **PARTIALLY IMPLEMENTED** | Field exists, but lacks country-specific 9/10-digit validation. |
| `mobile` | `string` | None | No | `mobile` | **MISSING** | Needs to be added to `organizations`. |
| `email` | `string` | None | No | `email` | **MISSING** | Needs to be added to `organizations`. |
| `fax` | `string` | None | No | `fax` | **MISSING** | Needs to be added to `organizations`. |
| `area_code` | `string` | None | No | `areaCode` | **MISSING** | Needs to be added to `organizations`. |
| `is_gst` | `boolean` | None | No | `isGst` | **MISSING** | Tax flag missing. |
| `inclusive_gst` | `boolean` | None | No | `inclusiveGst` | **MISSING** | Inclusive tax flag missing. |
| `separate_gst` | `boolean` | None | No | `separateGst` | **MISSING** | Separate tax flag missing (default `true`). |
| `gst_number` | `string` | None | No | `gstNumber` | **MISSING** | GSTIN string missing. |
| `is_fssai` | `boolean` | None | No | `isFssai` | **MISSING** | Food safety toggle missing. |
| `fssai_registration_number` | `string` | None | No | `fssaiRegistrationNumber` | **MISSING** | FSSAI 14-digit registration missing. |
| `expiry_date` | `datetime` | None | No | `expiryDate` | **MISSING** | FSSAI expiry timestamp missing. |
| `default_currency` | `string` | None | No | `defaultCurrency` | **MISSING** | ISO currency code missing (e.g. `"INR"`). |
| `default_currency_symbol` | `string` | None | No | `defaultCurrencySymbol` | **MISSING** | Currency symbol missing (e.g. `"₹"`). |
| `organization_time_zone` | `string` | None | No | `organizationTimeZone` | **MISSING** | IANA timezone string missing (e.g. `"Asia/Kolkata"`). |
| `operation_timing` | `json` | `operationTiming` | **Yes** | `operationTiming` | **PARTIALLY IMPLEMENTED** | Seeded in `initializeStore`, but lacks overlap & all-day validation. |
| `receipt_print_count` | `integer` | None | No | `receiptPrintCount` | **MISSING** | Print copy count missing (default `1`). |
| `menu_based_print_token` | `boolean` | None | No | `menuBasedPrintToken` | **MISSING** | KOT token toggle missing (default `false`). |
| `show_qr_code` | `boolean` | None | No | `showQrCode` | **MISSING** | Printed QR toggle missing (default `false`). |
| `latitude` | `decimal(10,6)` | `latitude` | **Yes** | `latitude` | **ALREADY IMPLEMENTED** | Convex `v.number()`. |
| `longitude` | `decimal(10,6)` | `longitude` | **Yes** | `longitude` | **ALREADY IMPLEMENTED** | Convex `v.number()`. |
| `porter_integration` | `json` | `porterIntegration` | **Yes** | `porterIntegration` | **ALREADY IMPLEMENTED** | Convex `v.optional(v.any())`. |
| `landmark` | `string` | None | No | `landmark` | **MISSING** | Delivery landmark missing. |
| `razor_pay_key_id` | `string` | None | No | `razorPayKeyId` | **MISSING** | Razorpay Key ID missing. |
| `razor_pay_api_key` | `string` | None | No | `razorPayApiKey` | **MISSING** | Sensitive Razorpay Secret missing. |
| `stripe_publishable_key` | `string` | None | No | `stripePublishableKey` | **MISSING** | Stripe Publishable Key missing. |
| `stripe_secret_key` | `string` | None | No | `stripeSecretKey` | **MISSING** | Sensitive Stripe Secret missing. |
| `created_at` | `datetime` | `createdAt` | **Yes** | `createdAt` | **ALREADY IMPLEMENTED** | Convex millisecond timestamp. |
| `updated_at` | `datetime` | `updatedAt` | **Yes** | `updatedAt` | **ALREADY IMPLEMENTED** | Convex millisecond timestamp. |
| `deleted_at` | `datetime` | `deletedAt` | **Yes** | `deletedAt` | **ALREADY IMPLEMENTED** | Convex millisecond timestamp. |

---

## 6. Field Categorization

The 38 legacy fields are categorized below with recommendations on placement:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            ORGANIZATION TABLE FIELDS                             │
├───────────────────┬───────────────────┬───────────────────┬──────────────────────┤
│ Identity & Core   │ Contact           │ Address           │ Taxation & FSSAI     │
│ - name            │ - phone           │ - addressLine1    │ - isGst              │
│ - slug            │ - mobile          │ - addressLine2    │ - inclusiveGst       │
│ - legalEntityName │ - email           │ - landmark        │ - separateGst        │
│ - published       │ - fax             │ - city            │ - gstNumber          │
│ - isTest          │ - areaCode        │ - state           │ - isFssai            │
│                   │                   │ - country         │ - fssaiRegistration..│
│                   │                   │ - zipCode         │ - expiryDate         │
├───────────────────┼───────────────────┼───────────────────┼──────────────────────┤
│ Currency & Time   │ Printing          │ Location & Porter │ Sensitive Secrets    │
│ - defaultCurrency │ - receiptPrint..  │ - latitude        │ - razorPayKeyId      │
│ - defaultCurr..Sym│ - menuBasedPrint..│ - longitude       │ - razorPayApiKey*    │
│ - organizationT.. │ - showQrCode      │ - porterIntegr..  │ - stripePublishable..│
│ - operationTiming │                   │                   │ - stripeSecretKey*   │
└───────────────────┴───────────────────┴───────────────────┴──────────────────────┘
* Denotes sensitive fields that must be stripped in public queries via stripSecrets.
```

All field categories belong naturally in the single `organizations` table under the single-tenant per Convex project model.

---

## 7. Creation Lifecycle Analysis

### Legacy Rails Creation Lifecycle:
```
Organization created -> after_create hook -> OrganizationsDetail created -> default_operation_timing -> currency derived from Country -> Org Details complete
```

### Current Convex Creation Lifecycle:
```
1. organizations:create -> Inserts basic store record -> Returns orgId
2. organizations:initializeStore -> Idempotently seeds orderProcesses, stations, paymentModes, inventoryCategories, and default operationTiming
```

### Recommended Integrated Creation Flow:
1. **`organizations:create`**: Receives store creation parameters. If `defaultCurrency`, `defaultCurrencySymbol`, or `organizationTimeZone` are provided, inserts them directly.
2. **`organizations:initializeStore`**: Seeds defaults transactionally:
   - Default operating hours (`operationTiming`) if missing.
   - Default printing settings (`receiptPrintCount = 1`, `menuBasedPrintToken = false`, `showQrCode = false`).
   - Default GST flags (`isGst = false`, `inclusiveGst = false`, `separateGst = true`).
   - Default FSSAI flags (`isFssai = false`).
3. **Idempotency**: `initializeStore` is fully idempotent and safe to retry on failure.

---

## 8. Defaults Analysis

| PRD Default | Current Default App Status | Recommendation |
| :--- | :---: | :--- |
| `isGst = false` | Missing | Add to schema definition & `create` mutation defaults (`false`). |
| `inclusiveGst = false` | Missing | Add to schema definition & `create` mutation defaults (`false`). |
| `separateGst = true` | Missing | Add to schema definition & `create` mutation defaults (`true`). |
| `isFssai = false` | Missing | Add to schema definition & `create` mutation defaults (`false`). |
| `receiptPrintCount = 1` | Missing | Add to schema definition & `create` mutation defaults (`1`). |
| `menuBasedPrintToken = false` | Missing | Add to schema definition & `create` mutation defaults (`false`). |
| `showQrCode = false` | Missing | Add to schema definition & `create` mutation defaults (`false`). |
| `porterIntegration = {}` | Implemented | Existing default is `v.optional(v.any())`. |
| `operationTiming` grid | Implemented | Seeded in `initializeStore` (Monday–Sunday 11:00 to 23:59). |
| `transferPercentage = 0.03` | Implemented | Confirmed PRD default 3% implemented in `organizations.ts:404`. |
| `transferHoldTime = 18000` | Implemented | Confirmed PRD default 5 hours implemented in `organizations.ts:405`. |

---

## 9. Phone Validation Analysis

### Legacy PRD Requirements:
- **UAE (`country == "United Arab Emirates"` or `countryCode == "+971"`)**: Raw phone must be **exactly 9 digits**.
- **Other Countries**: Raw phone must be **exactly 10 digits**.
- **Format**: Digits only (`/\A\d+\z/`). Rejects spaces, hyphens, and slashes.
- **Normalization**: Prepends country code to phone number before saving.

### Current Default App Implementation:
- `phone` exists on `organizations` table as `v.optional(v.string())`.
- Used in `validateOrganizationState` to verify phone presence when `deliveryAggregator == true`.
- **Gap**: Lacks international digit count validation (9 vs 10 digits), digit format checking, and country code normalization.

---

## 10. Operating Hours Analysis

### Legacy PRD Requirements:
1. Monday through Sunday schedule.
2. Default 11:00 AM to 11:59 PM.
3. Multi-slot support (`hours` array).
4. No overlapping time slots within a day.
5. All-day open normalization (`is_open_all_day == true` -> `00:00:00` to `23:59:59`).
6. Timezone-aware interpretation (`organization_time_zone`).
7. Overnight range evaluation (e.g., 10:00 PM to 02:00 AM).

### Current Default App Implementation:
- `operationTiming` JSON field exists on `organizations` schema.
- `initializeStore` seeds default hours schedule.
- **Gap**: Lacks slot overlap validation helper, all-day hours normalization, and timezone-aware open store check function.

---

## 11. GST Business Logic Analysis

### Legacy PRD Requirements:
- Master toggle `is_gst`.
- `inclusive_gst` vs `separate_gst`.
- **Cascading Reset Side Effect**: When `is_gst` is updated to `false`:
  1. `inclusive_gst` set to `false`
  2. `separate_gst` set to `false`
  3. All menu items (`items.is_gst = false`) updated to `false`
  4. All customization items (`customization_items.is_gst = false`) updated to `false`
  5. All taxation records (`taxations`) destroyed.

### Current Default App Downstream Table Audit:

| Dependency | Exists in `pos-default`? | Current GST Field? | Implementation Scope |
| :--- | :---: | :---: | :--- |
| `organizations` GST flags | **Yes** (To be added) | N/A | **Can Implement Now** (Phase 1) |
| `items` (Menu Items) | **No** | N/A | **Depends on Future Domain** (Phase 2) |
| `customization_items` | **No** | N/A | **Depends on Future Domain** (Phase 2) |
| `taxations` | **No** | N/A | **Depends on Future Domain** (Phase 2) |

---

## 12. FSSAI Compliance Analysis

- **`isFssai`**: Boolean toggle.
- **`fssaiRegistrationNumber`**: 14-digit registration string.
- **`expiryDate`**: Millisecond timestamp for license expiration.
- **Document Attachments (`fssai_document`, `gst_document`)**: Legacy used ActiveStorage S3 uploads. In Convex, file uploads are **EXPLICITLY DEFERRED** to Phase 3 (using Convex File Storage / S3 presigned URLs).

---

## 13. Currency Analysis

- Legacy derived `default_currency` (ISO code) and `default_currency_symbol` from `Country` via `ISO3166` gem.
- `pos-default` does **not** maintain a heavy relational `countries` / `states` database.
- **Recommendation**:
  - Accept `defaultCurrency` (e.g. `"INR"`, `"USD"`, `"AED"`) and `defaultCurrencySymbol` (e.g. `"₹"`, `"$"`, `"AED"`) as optional parameters in `organizations:create` and `organizations:update`.
  - Provide a static fallback helper mapping country names/codes to default currency symbols (e.g. `"India"` -> `"INR"`, `"₹"`; `"United Arab Emirates"` -> `"AED"`, `"AED"`).

---

## 14. Timezone Analysis

- `organizationTimeZone` (IANA string, e.g. `"Asia/Kolkata"`, `"America/New_York"`).
- Should be added as `v.optional(v.string())` on `organizations` table.
- Default to `"UTC"` if unspecified.

---

## 15. Location & Delivery Analysis

- `latitude`, `longitude`, `phone`, `porterIntegration` already exist in `organizations` schema.
- `validateOrganizationState` in `convex/organizations.ts:105-115` **ALREADY ENFORCES** that enabling `deliveryAggregator` requires `latitude`, `longitude`, and `phone` to be set!
- `landmark` needs to be added to `organizations` schema.
- Porter API quote/dispatch integration is **EXPLICITLY DEFERRED**.

---

## 16. Payment Secret Analysis

Sensitive credentials requiring protection:
- `razorPayKeyId` (Publishable Key ID)
- `razorPayApiKey` (Sensitive Secret Key)
- `stripePublishableKey` (Publishable Key)
- `stripeSecretKey` (Sensitive Secret Key)
- `whatsappAccessToken` (Sensitive Token - *Already exists*)

### Protection Mechanism:
`organizations.ts` already implements a `stripSecrets` helper function:
```typescript
function stripSecrets(org: Doc<"organizations"> | null) {
  if (!org) return null;
  const { whatsappAccessToken, razorPayApiKey, stripeSecretKey, ...safeOrg } = org;
  return safeOrg;
}
```
Standard queries (`get`, `getBySlug`, `getByLegacyId`, `list`) return `stripSecrets(org)`.  
Internal admin query `getWithSecrets` returns unstripped credentials.

---

## 17. Printing Analysis

- `receiptPrintCount`: Integer, default `1`.
- `menuBasedPrintToken`: Boolean, default `false`.
- `showQrCode`: Boolean, default `false`.
- All 3 fields will be added to `organizations` schema and seeded in `initializeStore`.

---

## 18. Soft Delete Analysis

- Legacy `organizations_details` used `acts_as_paranoid` (`deleted_at`).
- In `pos-default`, `organizations` table already has `deletedAt: v.optional(v.number())`.
- When an organization is soft-deleted via `organizations:remove`, setting `deletedAt` soft-deletes all store data on the organization document.

---

## 19. Legacy Dependency Mapping

| Legacy Rails Dependency | Default App Equivalent | Exists in `pos-default`? | Status / Action |
| :--- | :--- | :---: | :--- |
| `Organization` | `organizations` table | **Yes** | Active core table. |
| `Country` | String `country` / Static mapping | Partial | Use string property & static currency map. |
| `State` | String `state` | Partial | Use string property. |
| `Taxation` | `taxations` table | **No** | Deferred to Tax Domain (Phase 2). |
| `Item` | `items` table | **No** | Deferred to Menu Domain (Phase 2). |
| `CustomizationItem` | `customizationItems` table | **No** | Deferred to Menu Domain (Phase 2). |

---

## 20. Convex API / Function Recommendation

| Operation | Function Name | Convex Type | Purpose | Authorization |
| :--- | :--- | :---: | :--- | :--- |
| Get Store Profile | `api.organizations.get` | Query | Return store profile (secrets stripped) | Public / Store Admin |
| Get Store Secrets | `api.organizations.getWithSecrets` | Query | Return store profile with payment secrets | Admin / Service Role |
| Create Store Profile | `api.organizations.create` | Mutation | Create store document with profile & defaults | Master Provisioning |
| Update Store Profile | `api.organizations.update` | Mutation | Update contact, address, GST, FSSAI, printing | Store Admin |
| Initialize Store Defaults | `api.organizations.initializeStore` | Mutation | Seed order processes, stations, and profile defaults | Master Provisioning |

---

## 21. Authorization Dependency

- Authentication and session management are managed by Clerk (`Clerk`).
- Current query/mutation authorization gates check `org.deletedAt` and role flags.
- **Status**: `NO AUTH BLOCKERS` for Organization Details schema fields.

---

## 22. Frontend Dependency

- Future merchant admin dashboard screens ("Business Settings", "Taxation & Compliance", "Hardware & Printing") will consume the updated `organizations` queries and mutations.
- **Status**: Frontend UI is negligible/decoupled; no blocking frontend dependencies.

---

## 23. Migration Mapping (PostgreSQL -> Convex)

| Legacy Rails Field | Convex Field | Transformation | Migration Risk |
| :--- | :--- | :--- | :---: |
| `id` (UUID) | `legacyDetailsId` / N/A | Ignored (1 Org per DB) | Low |
| `address_line_1`, `address_line_2` | `addressLine1`, `addressLine2` | Direct string copy | Low |
| `gst_number` | `gstNumber` | Direct string copy | Low |
| `fssai_registration_number` | `fssaiRegistrationNumber` | Direct string copy | Low |
| `expiry_date` (Datetime) | `expiryDate` (Number) | Convert ISO timestamp to epoch ms | Low |
| `operation_timing` (JSON) | `operationTiming` (Object) | Direct JSON object copy | Low |
| `latitude`, `longitude` (Decimal) | `latitude`, `longitude` (Number) | Cast to Float number | Low |
| `country_id`, `state_id` (UUID) | `country`, `state` (String) | Resolve reference name string | Low |

---

## 24. Schema Architecture Comparison

### Option A — Flatten Organization Details directly into `organizations`
- **Schema Complexity**: Single table (`organizations`).
- **Query Complexity**: 0 Joins. Simple `ctx.db.get` or `ctx.db.query("organizations").first()`.
- **Mutation Complexity**: Single document patch (`ctx.db.patch`).
- **1:1 Relationship**: Physically guaranteed (1 store org per database).
- **Initialization**: Single atomic insert/patch during `initializeStore`.
- **Security**: Secrets protected via `stripSecrets` helper.

### Option B — Separate `organizationDetails` Table with 1:1 Relationship
- **Schema Complexity**: Two tables (`organizations`, `organizationDetails`).
- **Query Complexity**: Requires index queries (`by_org`) and double lookups on every page render.
- **Mutation Complexity**: Multi-table transactional mutations.
- **1:1 Relationship**: Requires manual uniqueness validation in code.

---

## 25. Recommended Schema Architecture

### **RECOMMENDED: OPTION A (Flattened into `organizations`)**

**Rationale**:  
Under the `pos-default` architecture, every store project runs on an isolated Convex database dedicated to that single store tenant. Having a separate `organizationDetails` table containing a single row per database creates redundant schema complexity, double database reads, and multi-table mutation overhead without any architectural benefit.

Flattening the 21 missing operational fields into the existing `organizations` table provides clean, high-performance document reads and atomic updates. Sensitive credentials (`razorPayApiKey`, `stripeSecretKey`) will be stripped using the existing `stripSecrets` pattern.

---

## 26. Phase 1 Implementation Scope (Immediate)

The following items can be implemented immediately in `pos-default` without external dependencies:

1. **Schema Extension**: Add missing fields to `organizations` table in `convex/schema.ts`:
   - Extended Contact & Address: `addressLine2`, `landmark`, `mobile`, `email`, `fax`, `areaCode`
   - GST Fields: `isGst`, `inclusiveGst`, `separateGst`, `gstNumber`
   - FSSAI Fields: `isFssai`, `fssaiRegistrationNumber`, `expiryDate`
   - Currency & Timezone: `defaultCurrency`, `defaultCurrencySymbol`, `organizationTimeZone`
   - Printing Flags: `receiptPrintCount`, `menuBasedPrintToken`, `showQrCode`
   - Payment Secrets: `razorPayKeyId`, `razorPayApiKey`, `stripePublishableKey`, `stripeSecretKey`
2. **Mutation & Default Updates**:
   - Update `create` and `update` mutations in `convex/organizations.ts` to accept and validate profile fields.
   - Update `initializeStore` mutation to seed default GST, FSSAI, printing, and timing parameters.
3. **Secret Protection**: Update `stripSecrets` helper to strip `razorPayApiKey` and `stripeSecretKey`.
4. **Validation Helpers**:
   - Implement international phone validation helper (9 digits for UAE, 10 for others).
   - Implement operating hours overlap & all-day normalization helper.

---

## 27. Phase 2 Dependencies (Future Domains)

- Cascading GST reset side effects against `items` and `customization_items` tables (to be attached when Menu Domain is implemented).
- Cascading GST reset side effects against `taxations` table (to be attached when Taxation Domain is implemented).

---

## 28. Phase 3 Deferred Scope

- FSSAI / GST PDF Document Storage (`fssai_document`, `gst_document`).
- Automated Porter logistics API dispatch integration.

---

## 29. Blocked Scope

- **None**. All core Organization Details fields can be added cleanly to `pos-default`.

---

## 30. Test Plan

When implementation begins, unit test coverage in `convex/organizations.test.ts` must be extended for:

1. **Schema & Defaults**: Verify creation of org with default GST (`isGst=false`, `separateGst=true`), FSSAI (`isFssai=false`), printing (`receiptPrintCount=1`), and currency flags.
2. **Phone Validation**:
   - Test UAE (`+971`): Rejects 8 or 10 digits; accepts 9 digits (`"501234567" -> "+971501234567"`).
   - Test India/Other (`+91`): Rejects 9 digits; accepts 10 digits (`"9876543210" -> "+919876543210"`).
   - Test rejection of hyphens, spaces, and non-numeric characters.
3. **Operating Hours Validation**:
   - Test rejection of overlapping time slots (e.g., 10:00-14:00 and 12:00-16:00).
   - Test normalization of `is_open_all_day == true` to `00:00:00-23:59:59`.
4. **Secret Stripping**: Verify `get` and `list` queries do NOT expose `razorPayApiKey` or `stripeSecretKey`, while `getWithSecrets` returns them.
5. **Idempotent Initialization**: Verify `initializeStore` seeds operating hours and printing defaults without duplicating records on re-execution.

---

## 31. Complete Gap Matrix

| # | Requirement | Current Default App | PRD Requirement | Status | Recommended Change | Dependency | Tests Required |
| :-: | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| 1 | Store Identity & Flags | Implemented in `organizations` | 17 POS feature flags | **PASS** | None | None | Passed (15/15) |
| 2 | Contact (Phone) | Field exists | International 9/10 digit validation | **PARTIAL** | Add phone format & country normalization helper | None | Phone Test |
| 3 | Extended Contact | Missing (`email`, `mobile`, `fax`, `areaCode`) | Store contact details | **MISSING** | Add fields to `organizations` schema | None | Schema Test |
| 4 | Address & Landmark | `addressLine1`, `city`, `zipCode` exist | Include `addressLine2`, `landmark` | **PARTIAL** | Add `addressLine2` & `landmark` to schema | None | Schema Test |
| 5 | GST Compliance | Missing | `isGst`, `inclusiveGst`, `separateGst`, `gstNumber` | **MISSING** | Add GST fields & default `separateGst=true` | None (Phase 1) | GST Test |
| 6 | GST Cascading Reset | Missing | Reset items & taxations when `isGst=false` | **DEFERRED** | Add callback hook | Menu/Tax Domain | Phase 2 Test |
| 7 | FSSAI Compliance | Missing | `isFssai`, `fssaiRegistrationNumber`, `expiryDate` | **MISSING** | Add FSSAI fields to `organizations` schema | None | FSSAI Test |
| 8 | FSSAI/GST Documents | Missing | ActiveStorage PDF upload | **DEFERRED** | Convex File Storage / S3 presigned URLs | Phase 3 | Phase 3 Test |
| 9 | Currency | Missing | `defaultCurrency`, `defaultCurrencySymbol` | **MISSING** | Add currency fields to `organizations` schema | None | Currency Test |
| 10 | Timezone | Missing | `organizationTimeZone` | **MISSING** | Add IANA timezone string field | None | Timezone Test |
| 11 | Operating Hours | `operationTiming` JSON exists | Overlap & all-day normalization | **PARTIAL** | Add timing overlap validation helper | None | Timing Test |
| 12 | Printing Config | Missing | `receiptPrintCount`, `menuBasedPrintToken`, `showQrCode` | **MISSING** | Add printing fields & seed in `initializeStore` | None | Print Test |
| 13 | Geolocation Coordinates | `latitude`, `longitude` exist | Required when `deliveryAggregator=true` | **PASS** | Enforced in `validateOrganizationState` | None | Passed (15/15) |
| 14 | Payment Secrets | `whatsappAccessToken` stripped | Add Razorpay & Stripe keys + strip | **PARTIAL** | Add secret fields & extend `stripSecrets` | None | Secret Test |
| 15 | Soft Delete | `deletedAt` timestamp exists | Soft delete lifecycle | **PASS** | Implemented on `organizations` table | None | Passed (15/15) |

---

## 32. Open Questions

1. **Static Currency Mapping**: Should `pos-default` include a built-in static mapping fallback for country-to-currency (e.g. `"India"` -> `"INR"`, `"₹"`) when explicit currency params are omitted during store creation? *(Recommended: YES)*.
2. **Document Attachment Storage**: Should FSSAI and GST registration documents be uploaded via Convex File Storage or direct S3 presigned URLs in Phase 3? *(Recommended: Convex File Storage)*.

---

# RECOMMENDED IMPLEMENTATION ORDER

When implementation of the Organization Details domain is authorized, execute changes in the following strict order:

1. **Schema Extension (`convex/schema.ts`)**:
   - Add missing fields (`addressLine2`, `landmark`, `mobile`, `email`, `fax`, `areaCode`, `isGst`, `inclusiveGst`, `separateGst`, `gstNumber`, `isFssai`, `fssaiRegistrationNumber`, `expiryDate`, `defaultCurrency`, `defaultCurrencySymbol`, `organizationTimeZone`, `receiptPrintCount`, `menuBasedPrintToken`, `showQrCode`, `razorPayKeyId`, `razorPayApiKey`, `stripePublishableKey`, `stripeSecretKey`) to `organizations` table.
2. **Secret Stripping Update (`convex/organizations.ts`)**:
   - Extend `stripSecrets` helper to filter `razorPayApiKey` and `stripeSecretKey`.
3. **Phone & Operating Hours Validation Helpers**:
   - Add `validatePhoneWithCountryCode` (9 digits for UAE, 10 for others, digit-only format).
   - Add `validateOperatingHoursOverlap` and `normalizeAllDayHours`.
4. **Mutation Arguments & Logic (`convex/organizations.ts`)**:
   - Update `create` and `update` mutations to accept profile arguments, apply defaults, and execute validation helpers.
5. **Store Initialization Seeding (`convex/organizations.ts`)**:
   - Update `initializeStore` mutation to idempotently seed default GST, FSSAI, printing, and operating hours schedule.
6. **Automated Unit Tests (`convex/organizations.test.ts`)**:
   - Add comprehensive Vitest unit test suite covering field creation, phone validations, operating hours overlap, GST defaults, and secret stripping.
7. **Downstream Integration Hooks (Phase 2 & 3)**:
   - Wire cascading GST reset callbacks when Menu and Taxation domains are implemented.
