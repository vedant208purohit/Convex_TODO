# ORGANIZATION BACKEND API REQUIREMENTS & AUDIT SPECIFICATION

**Document Version**: 1.0.0  
**Project**: `pos-default` (CulinaryPro Kitchen Suite / POS Admin)  
**Scope**: Organization Module — Restaurant Details, Operational Timings, Taxation, Country Requirements  
**Target Audience**: Backend Developers & Frontend Engineers  

---

## 1. Executive Summary

This document provides a comprehensive, unvarnished technical specification and audit report for the **Organization Settings** module. It maps all frontend UI fields to Convex backend schema definitions, mutation/query API contracts, and database persistence models across all 4 core sub-modules:

1. **Restaurant Details** (Identity, Contact, Location, Regional Settings, Logo Storage)
2. **Operational Timings** (Weekly Operating Schedule, Time Slots, Overlap Validation)
3. **Taxation** (Tax Modes, Tax Groups, Tax Components, Item Tax Calculations)
4. **Country Requirements** (FSSAI Food Safety Compliance, GST Compliance, Document Storage)

---

## 2. Current System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND LAYER                                │
│           (Next.js App Router / OrganizationSettings.tsx)               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                    Convex React Client / Hooks
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                            CONVEX BACKEND                               │
│  Queries: list, getStorageUrl, listTaxGroups, listTaxComponents        │
│  Mutations: update, generateUploadUrl, createTaxGroup, createTaxComp   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                       Convex Database & File Storage
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                           PERSISTENCE LAYER                             │
│  Tables: organizations, taxGroups, taxComponents, storeTaxSettings       │
│  Convex Storage: _storage bucket                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema Overview (`convex/schema.ts`)

```typescript
// 1. Core Organization Table
organizations: defineTable({
  legacyId: v.optional(v.string()),
  name: v.string(),
  slug: v.string(),
  legalEntityName: v.optional(v.string()),
  published: v.boolean(),
  isTest: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),

  // Contact & Location
  phone: v.optional(v.string()),
  addressLine1: v.optional(v.string()),
  addressLine2: v.optional(v.string()),
  landmark: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  country: v.optional(v.string()),
  zipCode: v.optional(v.string()),
  mobile: v.optional(v.string()),
  email: v.optional(v.string()),
  fax: v.optional(v.string()),
  areaCode: v.optional(v.string()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  operationTiming: v.optional(v.any()),

  // GST & FSSAI Compliance
  isGst: v.boolean(),
  inclusiveGst: v.boolean(),
  separateGst: v.boolean(),
  gstNumber: v.optional(v.string()),
  isFssai: v.boolean(),
  fssaiRegistrationNumber: v.optional(v.string()),
  expiryDate: v.optional(v.number()),

  // Regional & Currency
  defaultCurrency: v.optional(v.string()),
  defaultCurrencySymbol: v.optional(v.string()),
  organizationTimeZone: v.optional(v.string()),

  // Logo Storage
  logoUrl: v.optional(v.string()),
  logoStorageId: v.optional(v.id("_storage")),
})

// 2. Tax Components Table
taxComponents: defineTable({
  organizationId: v.id("organizations"),
  name: v.string(),
  rate: v.number(),
  code: v.optional(v.string()),
  createdAt: v.number(),
})

// 3. Tax Groups Table
taxGroups: defineTable({
  organizationId: v.id("organizations"),
  name: v.string(),
  taxMode: v.union(v.literal("inclusive"), v.literal("exclusive")),
  componentIds: v.array(v.id("taxComponents")),
  isDefault: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

---

## 4. Complete Field Inventory & Mapping Matrix

### Sub-Module 1: Restaurant Details

| Field Name | UI Input Type | Data Type | Required | Default | DB Schema Field | API GET | API UPDATE | API DELETE | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Org Logo Upload** | File Input | `string` / `Id<"_storage">` | No | `""` | `logoUrl`, `logoStorageId` | `getStorageUrl` | `generateUploadUrl` & `update` | `update` (`logoUrl:""`) | ✅ Working |
| **Organization Name** | Text Input | `string` | **Yes** | `""` | `name` | `list` | `update` | N/A (Required) | ✅ Working |
| **Legal Entity Name** | Text Input | `string` | No | `""` | `legalEntityName` | `list` | `update` | Set `""` | ✅ Working |
| **Address Line 1** | Text Input | `string` | No | `""` | `addressLine1` | `list` | `update` | Set `""` | ✅ Working |
| **Address Line 2** | Text Input | `string` | No | `""` | `addressLine2` | `list` | `update` | Set `""` | ✅ Working |
| **City** | Text Input | `string` | No | `""` | `city` | `list` | `update` | Set `""` | ✅ Working |
| **Zipcode** | Text Input | `string` | No | `""` | `zipCode` | `list` | `update` | Set `""` | ✅ Working |
| **State** | Text Input | `string` | No | `""` | `state` | `list` | `update` | Set `""` | ✅ Working |
| **Country** | Select | `string` | No | `"India"` | `country` | `list` | `update` | Set `"India"` | ✅ Working |
| **Timezone** | Select | `string` | No | `"Asia/Kolkata"` | `organizationTimeZone` | `list` | `update` | Reset default | ✅ Working |
| **Currency** | Select | `string` | No | `"INR"` | `defaultCurrency`, `defaultCurrencySymbol` | `list` | `update` | Reset default | ✅ Working |
| **Email** | Text Input | `string` | No | `""` | `email` | `list` | `update` | Set `""` | ✅ Working |
| **Phone Number** | Select + Text | `string` | No | `""` | `phone` | `list` | `update` | Set `""` | ✅ Working |
| **Fax Number** | Text Input | `string` | No | `""` | `fax` | `list` | `update` | Set `""` | ✅ Working |

---

### Sub-Module 2: Operational Timings

| Field Name | UI Input Type | Data Type | Required | Default | DB Schema Field | API GET | API UPDATE | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Schedule Table** | Table + Drawer | `JSON Object` | No | 7-day schedule | `operationTiming` | `list` | `update` | ✅ Working |
| **Day Open Status** | Toggle / Pill | `boolean` | Yes | `true` | `operationTiming[day].is_open` | `list` | `update` | ✅ Working |
| **All-Day Status** | Toggle | `boolean` | No | `false` | `operationTiming[day].is_open_all_day` | `list` | `update` | ✅ Working |
| **Time Slots (Start/End)** | Time Inputs | `Array<{start_time, end_time}>` | Yes | `[{"11:00", "23:59"}]` | `operationTiming[day].hours` | `list` | `update` | ✅ Working |

---

### Sub-Module 3: Taxation

| Field Name | UI Input Type | Data Type | Required | Default | DB Schema Field | API GET | API UPDATE | API DELETE | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tax Inclusive Mode** | Segmented Toggle | `boolean` | Yes | `false` | `inclusiveGst`, `separateGst` | `list` | `update` | N/A | ✅ Working |
| **Tax Groups** | Cards Table | `taxGroups` record | Yes | Default Group | `taxGroups` table | `listTaxGroups` | `createTaxGroup` | ⚠️ Missing API | 🟡 Partial |
| **Tax Components** | Rows Input | `taxComponents` record | Yes | CGST/SGST | `taxComponents` table | `listTaxComponents` | `createTaxComponent` | ⚠️ Missing API | 🟡 Partial |
| **Set Default Group** | Button / Badge | `boolean` | Yes | `true` | `taxGroups.isDefault` | `listTaxGroups` | `setDefaultTaxGroup` | N/A | ✅ Working |

---

### Sub-Module 4: Country Requirements

| Field Name | UI Input Type | Data Type | Required | Default | DB Schema Field | API GET | API UPDATE | API DELETE | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FSSAI Enabled** | Toggle Card | `boolean` | Yes | `false` | `isFssai` | `list` | `update` | N/A | ✅ Working |
| **FSSAI Reg Number** | Text Input | `string` | No | `""` | `fssaiRegistrationNumber` | `list` | `update` | Set `""` | ✅ Working |
| **FSSAI Expiry Date** | Date Picker | `number` (timestamp) | No | `undefined` | `expiryDate` | `list` | `update` | Set `undefined` | ✅ Working |
| **FSSAI Certificate File** | Upload Box | Storage ID / URL | No | `undefined` | ❌ Missing Field | ❌ Missing | ❌ Missing | ❌ Missing | 🔴 Action Required |
| **GST Enabled** | Toggle Card | `boolean` | Yes | `false` | `isGst` | `list` | `update` | N/A | ✅ Working |
| **GST Number** | Text Input | `string` | No | `""` | `gstNumber` | `list` | `update` | Set `""` | ✅ Working |
| **GST Certificate File** | Upload Box | Storage ID / URL | No | `undefined` | ❌ Missing Field | ❌ Missing | ❌ Missing | ❌ Missing | 🔴 Action Required |

---

## 5. Existing vs Missing API Inventory

### A. Implemented APIs

```typescript
// 1. Query: List Organizations
api.organizations.list () => Doc<"organizations">[]

// 2. Query: Get Storage URL
api.organizations.getStorageUrl ({ storageId: Id<"_storage"> }) => string | null

// 3. Mutation: Generate Upload URL
api.organizations.generateUploadUrl () => string

// 4. Mutation: Update Organization Details
api.organizations.update ({ id: Id<"organizations">, ...fields }) => void

// 5. Query: List Tax Groups
api.taxation.listTaxGroups ({ organizationId: Id<"organizations"> }) => Doc<"taxGroups">[]

// 6. Query: List Tax Components
api.taxation.listTaxComponents ({ organizationId: Id<"organizations"> }) => Doc<"taxComponents">[]

// 7. Mutation: Create Tax Group
api.taxation.createTaxGroup ({ organizationId, name, taxMode, componentIds, isDefault }) => Id<"taxGroups">

// 8. Mutation: Create Tax Component
api.taxation.createTaxComponent ({ organizationId, name, rate, code }) => Id<"taxComponents">

// 9. Mutation: Set Default Tax Group
api.taxation.setDefaultTaxGroup ({ id: Id<"taxGroups"> }) => { success: true }
```

---

### B. Genuinely Missing Backend APIs & Schema Enhancements

To achieve 100% complete CRUD and compliance document support, the backend developer must implement the following 6 backend endpoints:

#### Requirement 1: Tax Group Update Mutation (`updateTaxGroup`)
- **File**: `convex/taxation.ts`
- **Type**: `mutation`
- **Arguments**:
  ```typescript
  args: {
    id: v.id("taxGroups"),
    name: v.optional(v.string()),
    taxMode: v.optional(v.union(v.literal("inclusive"), v.literal("exclusive"))),
    componentIds: v.optional(v.array(v.id("taxComponents"))),
    isDefault: v.optional(v.boolean()),
  }
  ```
- **Behavior**: Patches specified tax group record. If `isDefault` is set to `true`, unsets `isDefault` on all other tax groups for the organization.

#### Requirement 2: Tax Group Delete Mutation (`removeTaxGroup`)
- **File**: `convex/taxation.ts`
- **Type**: `mutation`
- **Arguments**:
  ```typescript
  args: { id: v.id("taxGroups") }
  ```
- **Behavior**: Deletes the specified `taxGroups` record from the database.

#### Requirement 3: Tax Component Update Mutation (`updateTaxComponent`)
- **File**: `convex/taxation.ts`
- **Type**: `mutation`
- **Arguments**:
  ```typescript
  args: {
    id: v.id("taxComponents"),
    name: v.optional(v.string()),
    rate: v.optional(v.number()),
    code: v.optional(v.string()),
  }
  ```
- **Behavior**: Patches specified `taxComponents` record.

#### Requirement 4: Tax Component Delete Mutation (`removeTaxComponent`)
- **File**: `convex/taxation.ts`
- **Type**: `mutation`
- **Arguments**:
  ```typescript
  args: { id: v.id("taxComponents") }
  ```
- **Behavior**: Deletes the specified `taxComponents` record from the database.

#### Requirement 5: Compliance Certificate Fields in `organizations` Schema
- **File**: `convex/schema.ts`
- **Fields to add inside `organizations` table**:
  ```typescript
  fssaiDocumentStorageId: v.optional(v.id("_storage")),
  fssaiDocumentUrl: v.optional(v.string()),
  gstDocumentStorageId: v.optional(v.id("_storage")),
  gstDocumentUrl: v.optional(v.string()),
  ```

#### Requirement 6: Accept Compliance Document Fields in `organizations.update` Mutation
- **File**: `convex/organizations.ts`
- **Arguments to add to `update` mutation**:
  ```typescript
  fssaiDocumentStorageId: v.optional(v.id("_storage")),
  fssaiDocumentUrl: v.optional(v.string()),
  gstDocumentStorageId: v.optional(v.id("_storage")),
  gstDocumentUrl: v.optional(v.string()),
  ```

---

## 6. Full End-to-End Flow Verification Matrix

| Flow | Sub-Module | Steps Verified | Status |
| :--- | :--- | :--- | :--- |
| **Logo Upload** | Restaurant Details | `generateUploadUrl` → HTTP POST → Storage ID → `update` → `getStorageUrl` → Preview | ✅ PASS |
| **Logo Replace** | Restaurant Details | Upload new image → new Storage ID → update DB → resolve new URL → UI updates | ✅ PASS |
| **Logo Remove** | Restaurant Details | Click Remove → `formData.logoUrl=""` → `ctx.db.replace()` purges DB → preview clears | ✅ PASS |
| **Timing Save** | Operational Timings | Edit schedule → Overlap validation → `updateOrg` → DB patch → reload retains timings | ✅ PASS |
| **Tax Group Add**| Taxation | Open drawer → enter components → `createTaxComponent` → `createTaxGroup` → DB insert | ✅ PASS |
| **Tax Group Edit**| Taxation | Open drawer → update data → requires `updateTaxGroup` API | 🟡 Pending Backend API |
| **FSSAI Details**| Country Requirements| Edit FSSAI number + Expiry date → `updateOrg` → DB patch → reload retains data | ✅ PASS |
| **GST Details** | Country Requirements| Edit GST number → `updateOrg` → DB patch → reload retains data | ✅ PASS |
| **Compliance Upload**| Country Requirements| UI box exists → requires backend schema storage fields | 🔴 Pending Schema Fields |

---

## 7. Backend Implementation Checklist

- [ ] Add `fssaiDocumentStorageId` and `gstDocumentStorageId` to `convex/schema.ts`.
- [ ] Update `convex/organizations.ts` `update` mutation to accept compliance document storage arguments.
- [ ] Add `updateTaxGroup` mutation in `convex/taxation.ts`.
- [ ] Add `removeTaxGroup` mutation in `convex/taxation.ts`.
- [ ] Add `updateTaxComponent` mutation in `convex/taxation.ts`.
- [ ] Add `removeTaxComponent` mutation in `convex/taxation.ts`.
- [ ] Run `npx convex dev --once` to deploy all schema and mutation updates to Convex Cloud.

---

## 8. Final Verification Status

- **TypeScript Type Check (`npx tsc --noEmit`)**: ✅ **0 Errors**
- **Next.js Production Build (`npm run build`)**: ✅ **Exit Code 0**
- **Convex Deployment Sync (`npx convex dev --once`)**: ✅ **Functions Ready**
