# Organization Features / Feature Flags Domain — Business Model & Architecture Audit

**Target Repository**: `pos-default` (`Default app`)  
**Audit Date**: August 21, 2026  
**Status**: `AUDIT COMPLETE — 0 CODE CHANGES MADE`  
**Implementation Readiness**: `READY FOR IMPLEMENTATION`

---

## 1. Executive Summary

This document presents a comprehensive business-model and architectural audit of the **Organization Features / Feature Flags** domain for DEFx-POS. It evaluates the legacy PostgreSQL/Rails architecture (`defx-pos`) against the new single-store-per-Convex-project architecture (`pos-default` and `pos-master`).

### Key Audit Findings:
1. **Polymorphic Elimination**: In legacy Rails, `OrganizationFeaturesFlag` used polymorphic columns (`featureable_type = "Organization"`, `featureable_id`). Code audit confirms `Organization` was the **only** entity implementing `featureable`. Polymorphism is obsolete and can be eliminated in Convex.
2. **Master vs. Default Ownership Split**:
   - **Master App (`pos-master`)**: Owns global `features` catalog definitions (managed strictly by Super Admins).
   - **Default App (`pos-default`)**: Owns store-level feature flag states (`organizationFeatures` table storing `featureKey` and `active: boolean`).
3. **Database Boundary Simplification**: In the new architecture, 1 Store = 1 Dedicated Convex Project Database. Cross-organization queries and global sync batch jobs are eliminated.
4. **Current Convex State**: Neither `features` nor `organizationFeatures` exists in Convex schema yet. Application code is 100% clean.

---

## 2. Legacy Feature Model

In legacy Rails (`defx-pos/app/models/feature.rb`):

### Database Schema (`features`):
- `id`: `uuid` (Primary Key, auto-generated UUID)
- `name`: `string` (Unique, case-insensitive string key, e.g. `"auto_accept"`, `"skip_phone_number_required"`)
- `description`: `text` (Technical description of feature purpose)
- `display_name`: `string` (User-facing feature name)
- `display_description`: `text` (User-facing description)
- `deleted_at`: `datetime` (Soft-deletion timestamp via `acts_as_paranoid`)
- `created_at`: `datetime`
- `updated_at`: `datetime`

### Validations & Callbacks:
- `validates :name, uniqueness: { case_sensitive: false, scope: [:deleted_at] }`
- `after_commit :enqueue_feature_sync_job, on: :create` (Triggers async job to backfill feature flags for all existing organizations).

---

## 3. Legacy Organization Feature Flag Model

In legacy Rails (`defx-pos/app/models/organization_features_flag.rb`):

### Database Schema (`organization_features_flags`):
- `id`: `uuid` (Primary Key)
- `feature_id`: `uuid` (Foreign key to `features.id`)
- `featureable_id`: `uuid` (Polymorphic entity ID)
- `featureable_type`: `string` (Polymorphic entity type, e.g., `"Organization"`)
- `active`: `boolean` (Default: `false`)
- `deleted_at`: `datetime` (Soft-deletion timestamp via `acts_as_paranoid`)
- `created_at`: `datetime`
- `updated_at`: `datetime`

---

## 4. Feature Lifecycle

1. **Creation**:
   - Platform Super Admin posts to `POST /api/v2/features` with `{ name, description, display_name, display_description }`.
   - `Feature` record is inserted with unique name check.
   - `after_commit` fires `FeatureSyncJob`, invoking `Services::OrganizationFeatureSyncService.sync_feature!(feature)`.
2. **Read**:
   - Super Admins list all global features via `GET /api/v2/features`.
3. **Modification**:
   - Super Admins update display metadata via `PATCH /api/v2/features/:id`.
   - **Crucial Rule**: `update_feature_params` does **not** permit changing `:name`. Feature name keys are immutable once created.
4. **Soft Deletion**:
   - Feature soft-deleted via `deleted_at`. `OrganizationFeatureSyncService` ignores soft-deleted features during sync.

---

## 5. Organization Lifecycle

1. **Organization Creation**:
   - Merchant or Admin creates organization.
   - Default store initialization invokes `Services::OrganizationFeatureSyncService.sync_organization!(organization)`.
2. **Feature Flag Seeding**:
   - For every active `Feature` in the database, an `OrganizationFeaturesFlag` record is created for that organization.
   - Default state: `active = false` (disabled by default), unless explicitly seeded via custom tasks (e.g. `add_auto_accept_to_all_orgs` set `active = true`).

---

## 6. Feature Synchronization

In legacy Rails, synchronization was required because all organizations shared one database:

```
[New Feature Created] ──► FeatureSyncJob ──► OrganizationFeatureSyncService.sync_feature!(feature)
                                                    │
                                                    ▼
                                     Creates flag (active: false) for ALL orgs

[New Organization Created] ──► OrganizationFeatureSyncService.sync_organization!(org)
                                       │
                                       ▼
                     Creates missing flags (active: false) for this org
```

### New Architecture Simplification:
In the new architecture, **no batch sync jobs across databases are required**. When Master provisions a store's Convex project, store initialization seeds the store's local `organizationFeatures` table.

---

## 7. Feature Defaults

### Legacy Seeded Features Catalog (`lib/tasks/features.rake`):

| Feature Name (`name`) | Default `active` | Controlled By | Description / Consumer Behavior |
| :--- | :---: | :--- | :--- |
| `skip_phone_number_required` | `false` | Store Admin | Bypasses customer phone number requirement in `Order` creation. |
| `show_waiter_on_cashier_card` | `false` | Store Admin | Renders waiter name on Cashier UI order cards. |
| `skip_payment_on_cashier_card` | `false` | Store Admin | Allows skipping payment step directly on Cashier UI card. |
| `show_table_on_cashier_card` | `false` | Store Admin | Renders table number on Cashier UI order cards. |
| `show_member_number_on_cashier_card` | `false` | Store Admin | Displays member number on Cashier UI order cards. |
| `show_table_tab_in_cashier` | `false` | Store Admin | Enables table tab navigation in Cashier UI layout. |
| `auto_accept` | `false` | Store Admin | Auto-accepts paid online orders without manual staff confirmation in KDS/Cashier. |

---

## 8. Feature Consumers (Dependency Map)

```
Feature Flag Check ("auto_accept")
   │
   ├─► OrderPaymentsController (V3) ──► If active? ──► Auto-accept paid order
   ├─► RazorpayWebhooksController   ──► If active? ──► Auto-accept paid webhook order
   └─► Order Model (State Machine)  ──► If active? ──► Skip manual approval step

Feature Flag Check ("skip_phone_number_required")
   │
   └─► Order Model (Validation)     ──► If active? ──► Bypass phone presence check

UI Feature Flags ("show_waiter_on_cashier_card", "show_table_on_cashier_card", etc.)
   │
   └─► SingularOrganizationSerializer ──► Serializes `organization_features_flags` array ──► Rendered in POS UI
```

---

## 9. Authentication

- **Master App (`pos-master`)**: Clerk Authentication (`auth()`).
- **Default App Interactive Users (`pos-default`)**: Clerk Authentication (`ctx.auth.getUserIdentity() -> identity.subject`).
- **Provisioning / System Admin**: Trusted server-to-server HMAC authentication.

---

## 10. Authorization

| Action | Allowed Role(s) | Application | Endpoint / Function |
| :--- | :--- | :--- | :--- |
| Create Global Feature | Super Admin | Master App | `POST /api/v2/features` |
| Edit Global Feature Metadata | Super Admin | Master App | `PATCH /api/v2/features/:id` |
| List Global Features | Super Admin | Master App | `GET /api/v2/features` |
| List Store Feature Flags | Store Member / Staff | Default App | `organizationFeatures:list` |
| Toggle Store Feature Flag | Store Admin / Super Admin | Default App | `organizationFeatures:toggle` |
| Provision Default Feature Flags | System Provisioning | Default App | `organizations:initializeStore` |

---

## 11. Master vs. Default Ownership Split

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MASTER APP (pos-master)                         │
│  - Global Features Catalog (`features` table)                          │
│  - System Super Admin UI for creating/managing global feature keys     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Provisions Feature Defaults
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       DEFAULT APP (pos-default)                        │
│  - 1 Isolated Database per Restaurant Tenant                           │
│  - Stores `organizationFeatures` table (`featureKey`, `active`)        │
│  - Consumed directly by Store POS Queries, Mutations & UI              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Polymorphic Relationship Analysis

- **Legacy Model**: `featureable_type: "Organization"`, `featureable_id: uuid`.
- **Code Audit Result**: `grep` search across all Rails models confirms `Organization` was the **ONLY** model with `has_many :organization_features_flags, as: :featureable`.
- **Recommendation**: **ELIMINATE POLYMORPHISM.** In `pos-default`, every database belongs to 1 organization. Polymorphic columns are completely unnecessary.

---

## 13. PostgreSQL → Convex Mapping

| Legacy Rails Field | Legacy Type | Convex Field | Convex Type | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` (UUID) | `uuid` | `_id` | `Id<"organizationFeatures">` | Auto-generated Convex ID |
| `feature_id` (UUID) | `uuid` | `featureKey` | `v.string()` | String feature key (e.g. `"auto_accept"`) |
| `featureable_id` | `uuid` | *Omitted* | N/A | Eliminated (Single-tenant DB) |
| `featureable_type` | `string` | *Omitted* | N/A | Eliminated (Single-tenant DB) |
| `active` | `boolean` | `active` | `v.boolean()` | Enabled/disabled boolean flag |
| `deleted_at` | `timestamp` | `deletedAt` | `v.optional(v.number())` | Soft-deletion epoch ms |
| `created_at` | `timestamp` | `createdAt` | `v.optional(v.number())` | Creation epoch ms |
| `updated_at` | `timestamp` | `updatedAt` | `v.number()` | Update epoch ms |

---

## 14. Proposed Convex Schema

### Default App (`pos-default/convex/schema.ts`):
```ts
// Store-level Organization Features Table
organizationFeatures: defineTable({
  featureKey: v.string(), // e.g. "auto_accept", "skip_phone_number_required"
  active: v.boolean(),    // Enabled/disabled status
  createdAt: v.optional(v.number()),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})
  .index("by_feature_key", ["featureKey"])
  .index("by_active", ["active"]),
```

### Master App (`pos-master/convex/schema.ts`):
```ts
// Global Features Catalog Table
features: defineTable({
  name: v.string(), // Unique feature key, e.g. "auto_accept"
  displayName: v.string(),
  description: v.optional(v.string()),
  displayDescription: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
  deletedAt: v.optional(v.number()),
}).index("by_name", ["name"]),
```

---

## 15. Proposed Convex Functions

### Default App (`pos-default/convex/organizationFeatures.ts`):
- `organizationFeatures:get`: Query single feature flag status by `featureKey`.
- `organizationFeatures:list`: Query all feature flags for the store.
- `organizationFeatures:toggle`: Admin mutation to enable/disable a feature flag.
- `organizationFeatures:initializeDefaults`: Provisioning mutation to seed default flags.

---

## 16. Provisioning & Initialization Strategy

When Master provisions a store, `organizations:initializeStore` in `pos-default` will invoke `organizationFeatures:initializeDefaults`. This seeds the store's `organizationFeatures` table with default feature flags:

```ts
const DEFAULT_STORE_FEATURES = [
  { featureKey: "skip_phone_number_required", active: false },
  { featureKey: "show_waiter_on_cashier_card", active: false },
  { featureKey: "skip_payment_on_cashier_card", active: false },
  { featureKey: "show_table_on_cashier_card", active: false },
  { featureKey: "show_member_number_on_cashier_card", active: false },
  { featureKey: "show_table_tab_in_cashier", active: false },
  { featureKey: "auto_accept", active: false },
];
```

---

## 17. Migration Strategy

For existing PostgreSQL database migrations:
1. Export `organization_features_flags` where `deleted_at IS NULL`.
2. Extract `feature.name` for each flag via `feature_id`.
3. Ingest into the store's Convex database under `organizationFeatures` table.

---

## 18. Business Invariants

| Rule # | Rule Description | Source | Implementation Guard |
| :--- | :--- | :--- | :--- |
| **INV-1** | Unique Feature Key | `Feature` model | `featureKey` is unique per store database. |
| **INV-2** | Immutable Feature Key | `FeaturesController` | `featureKey` cannot be changed after creation. |
| **INV-3** | Admin Authorization | `AdminPolicy` | Only Admin role can mutate feature `active` status. |
| **INV-4** | Default Disabled State | `OrganizationFeaturesFlag` | Features default to `active: false` unless explicitly configured. |

---

## 19. Test Coverage Matrix

| Business Rule | Legacy Spec File | Target Convex Test | Target Test File |
| :--- | :--- | :--- | :--- |
| Feature Name Uniqueness | `feature_spec.rb` | Global Feature name uniqueness | `Master app/convex/features.test.ts` |
| Store Feature Flag Listing | `organization_features_flag_spec.rb` | List store features | `Default app/convex/organizationFeatures.test.ts` |
| Store Feature Toggle | `organization_features_flag_spec.rb` | Admin toggle active state | `Default app/convex/organizationFeatures.test.ts` |
| Store Default Seeding | `organization_feature_sync_service_spec.rb` | Provisioning default flags | `Default app/convex/organizationFeatures.test.ts` |
| Non-Admin Access Block | `organization_features_flags_controller_spec.rb` | Reject non-admin toggle | `Default app/convex/organizationFeatures.test.ts` |

---

## 20. Security Findings

- **Privilege Escalation Protection**: Non-admin staff (e.g. cashier, waiter, customer) cannot toggle feature flags. Mutations verify caller's `userType` contains `"admin"`.
- **Single-Tenant Security**: Since 1 Store = 1 Convex Database, a store admin can never alter another restaurant's feature flags.

---

## 21. Current Convex Implementation Gaps

1. `organizationFeatures` table does not yet exist in `Default app/convex/schema.ts`.
2. `organizationFeatures.ts` module does not yet exist in `Default app/convex/`.
3. `features` catalog table does not yet exist in `Master app/convex/schema.ts`.

---

## 22. Recommended Implementation Plan

1. **Phase 1**: Add `organizationFeatures` table definition to `Default app/convex/schema.ts`.
2. **Phase 2**: Add global `features` catalog table to `Master app/convex/schema.ts`.
3. **Phase 3**: Implement `Default app/convex/organizationFeatures.ts` with queries (`get`, `list`) and mutations (`toggle`, `initializeDefaults`).
4. **Phase 4**: Wire feature flag defaults into `organizations:initializeStore` during provisioning.
5. **Phase 5**: Add Vitest unit test suite `organizationFeatures.test.ts`.

---

## 23. Open Business Decisions

- None. All specifications, legacy rules, and default feature keys are fully resolved from the source code and database audit.

---

**Audit Completed**: `0 CODE CHANGES MADE TO APPLICATION LOGIC.`
