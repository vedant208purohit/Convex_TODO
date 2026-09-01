# Frontend API Reference: Organization Users & Features Domains

> **Target Audience**: Frontend Engineers integrating with the DEFx-POS Convex Backend.  
> **Domains Covered**:  
> 1. **Organization Users Domain (`organizationUsers`)**: Staff onboarding, multi-role assignment, permission synchronization, RBAC guards, and membership management.  
> 2. **Store Feature Flags (`organizationFeatures`)**: Isolated store-level toggleable feature flags in `pos-default`.  
> 3. **Global Features Catalog (`features`)**: Master control-plane global feature registry in `pos-master`.  
> **Source Files Inspected**: `Default app/convex/schema.ts`, `Default app/convex/organizationUsers.ts`, `Default app/convex/organizationUsers.test.ts`, `Default app/convex/organizationFeatures.ts`, `Default app/convex/organizationFeatures.test.ts`, `Master app/convex/schema.ts`, `Master app/convex/features.ts`, `Master app/convex/features.test.ts`.

---

## 1. Scope & System Architecture

```text
                               ┌──────────────────────────────────────────────┐
                               │           CLERK AUTHENTICATION               │
                               └──────────────────────┬───────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────┐
│           MASTER APP (pos-master)            │              │          DEFAULT POS APP (pos-default)         │
│  - Master App Database (`features` table)    │              │  - Per-Store DB (`organizationUsers`)        │
│  - Global Feature Catalog (Master Registry)  │              │  - Staff RBAC & Permissions Synchronization  │
│  - Managed by Super Admin / System Admin     │              │  - Per-Store Feature Flags (`organizationFeatures`)
└──────────────────────────────────────────────┘              └──────────────────────────────────────────────┘
```

### 1.1 Organization Users Architecture
In DEFx-POS, each restaurant store operates its own isolated database containing the `organizationUsers` table.
* **Clerk Identity**: Users are identified by their Clerk User ID string (`userId` / `identity.subject`).
* **Multi-Role Assignment**: Each member can have multiple role tags in `userType: string[]` (e.g. `["cashier", "kds"]`).
* **Automatic Permission Sync**: Assigning roles automatically generates granular CRUD permissions for each role (`userPermission`). Removing a role automatically prunes its corresponding permissions.
* **Role-Based Access Control (RBAC)**:
  * **`requireAuth`**: Ensures caller is authenticated via Clerk JWT.
  * **`requireMember`**: Ensures caller has an active (non-deleted) record in the target store.
  * **`requireAdmin`**: Ensures caller is an active store user with the `admin` role tag.

### 1.2 Features Architecture
* **Store Feature Flags (`organizationFeatures` in `pos-default`)**: Controls runtime feature toggles for a specific store outlet (e.g., `auto_accept`, `skip_phone_number_required`). Toggleable only by Store Admins.
* **Global Features Catalog (`features` in `pos-master`)**: Master App control-plane catalog defining global feature keys, display names, and descriptions. Managed exclusively by Super Admins.

---

## 2. Database Schema Documentation

### 2.1 `organizationUsers` Schema (`Default app/convex/schema.ts`)

| Field | Type | Required? | Description | Frontend Usage | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `organizationId` | `v.id("organizations")` | **Yes** | Target store organization ID. | Context | Index: `by_org`. |
| `userId` | `v.string()` | **Yes** | Clerk User ID (`identity.subject`). | Display / Edit | Foreign key to Clerk user directory. Index: `by_user`. Compound Index: `by_user_and_org`. |
| `userType` | `v.array(v.string())` | **Yes** | Array of assigned role tags. | Display / Edit | e.g. `["admin"]`, `["cashier", "kds"]`. Must contain valid role strings. |
| `userPermission` | `v.optional(v.any())` | No | JSON CRUD permissions map per role tag. | Display / Read | Auto-synchronized based on `userType`. |
| `createdAt` | `v.optional(v.number())` | No | Creation timestamp (ms). | Read-Only | Server-generated. |
| `updatedAt` | `v.number()` | **Yes** | Modification timestamp (ms). | Read-Only | Server-managed. |
| `deletedAt` | `v.optional(v.number())` | No | Soft-deletion timestamp (ms). | Read-Only | Excludes user from active membership queries when present. |

---

### 2.2 `organizationFeatures` Schema (`Default app/convex/schema.ts`)

| Field | Type | Required? | Description | Frontend Usage | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `featureKey` | `v.string()` | **Yes** | Unique feature flag identifier key. | Display / Identifier | e.g. `"auto_accept"`. Index: `by_feature_key`. |
| `active` | `v.boolean()` | **Yes** | Boolean toggle state of the feature. | Display / Toggle | `true` = Enabled, `false` = Disabled. Index: `by_active`. |
| `createdAt` | `v.optional(v.number())` | No | Creation timestamp (ms). | Read-Only | Server-generated. |
| `updatedAt` | `v.number()` | **Yes** | Modification timestamp (ms). | Read-Only | Server-managed. |
| `deletedAt` | `v.optional(v.number())` | No | Soft-deletion timestamp (ms). | Read-Only | Filtered out by `get` and `list` queries. |

---

### 2.3 `features` Schema (`Master app/convex/schema.ts`)

| Field | Type | Required? | Description | Frontend Usage | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `name` | `v.string()` | **Yes** | Internal feature key name. | Identifier | Case-insensitive unique. Index: `by_name`. |
| `displayName` | `v.string()` | **Yes** | Human-readable title for UI rendering.| Display | Cannot be blank. |
| `description` | `v.optional(v.string())` | No | Full feature description text. | Display | |
| `displayDescription`| `v.optional(v.string())` | No | Short subtitle/description for cards. | Display | |
| `createdAt` | `v.number()` | **Yes** | Creation timestamp (ms). | Read-Only | Server-generated. |
| `updatedAt` | `v.optional(v.number())` | No | Modification timestamp (ms). | Read-Only | Server-managed. |
| `deletedAt` | `v.optional(v.number())` | No | Soft-deletion timestamp (ms). | Read-Only | Filtered out by list/get queries. |

---

## 3. API Inventory & Classification

### 3.1 Organization Users APIs (`Default app/convex/organizationUsers.ts`)

| Function Name | API Type | Caller Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `organizationUsers.getCurrentMembership` | Query | Authenticated User | Returns active store membership object for the current logged-in caller. |
| `organizationUsers.get` | Query | Active Store Member | Fetches a single member record by Document ID `v.id("organizationUsers")`. |
| `organizationUsers.getByUserId` | Query | Active Store Member | Fetches a member record by Clerk `userId`. |
| `organizationUsers.list` | Query | Active Store Member | Lists active store staff members (excludes customer-only & bot records by default). |
| `organizationUsers.search` | Query | Active Store Member | Filters active store members by `userType` role. |
| `organizationUsers.create` | Mutation | Store Admin | Onboards a new staff member with specified roles and auto-synced CRUD permissions. |
| `organizationUsers.update` | Mutation | Store Admin | Updates roles and/or custom permissions for an existing member. Enforces sole admin protection. |
| `organizationUsers.addType` | Mutation | Store Admin | Appends new role tags to a member and merges default CRUD permissions. |
| `organizationUsers.removeType` | Mutation | Store Admin | Removes specified role tags. Soft-deletes member if `userType` becomes empty. |
| `organizationUsers.remove` | Mutation | Store Admin | Soft-deletes member. Enforces self-removal and sole-admin protection guards. |

---

### 3.2 Store Feature Flags APIs (`Default app/convex/organizationFeatures.ts`)

| Function Name | API Type | Caller Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `organizationFeatures.get` | Query | Any App Frontend | Fetches flag state by `featureKey`. Returns `null` if not found or soft-deleted. |
| `organizationFeatures.list` | Query | Any App Frontend | Lists all active store feature flags. |
| `organizationFeatures.toggle` | Mutation | **Store Admin** | Enables or disables a feature flag (`active: boolean`). Restricted to Store Admins. |
| `organizationFeatures.initializeDefaults` | Mutation | Store Provisioner / Admin | Idempotently seeds default store feature flags with `active = false`. |
| `organizationFeatures.softDelete` | Mutation | Store Admin | Soft-deletes feature flag key (`deletedAt = Date.now()`). |

---

### 3.3 Master App Global Features Catalog APIs (`Master app/convex/features.ts`)

| Function Name | API Type | Caller Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `features.list` | Query | Master Dashboard | Returns all global feature catalog entries. |
| `features.get` | Query | Master Dashboard | Returns a single feature entry by ID or name. |
| `features.create` | Mutation | **Super Admin** | Registers a new global feature in Master App. Enforces case-insensitive name uniqueness. |
| `features.updateMetadata` | Mutation | **Super Admin** | Updates `displayName`, `description`, or `displayDescription`. |
| `features.softDelete` | Mutation | **Super Admin** | Soft-deletes a feature from the global catalog. |

---

## 4. Organization Users API Contracts

### 4.1 Allowed Role Types (`VALID_USER_TYPES`)

The system supports the following 17 standardized role tags:

```ts
export const VALID_USER_TYPES = [
  "admin",          // Full store administration & staff management
  "cashier",        // Cashier POS checkout screen
  "captain",        // Captain / Waiter ordering terminal
  "waiter",         // Table service waiter
  "chef",           // Kitchen chef
  "worker",         // General store worker
  "customer",       // Registered customer
  "customer_data",  // Customer analytics data profile
  "bot",            // Automated API integration bot
  "dashboard",      // Store Dashboard module access
  "orders",         // Orders management screen
  "menu",           // Menu editor screen
  "kds",            // Kitchen Display System
  "queue",          // Queue / Token management
  "inventory",      // Inventory management
  "report",         // Analytics & reporting
  "survey",         // Customer feedback surveys
] as const;
```

---

### 4.2 Automatic Permission Synchronization (`syncPermissions`)

When roles are created or modified, the backend automatically generates default CRUD permissions for each role tag:

```json
{
  "cashier": { "create": true, "read": true, "update": true, "delete": true },
  "kds": { "create": true, "read": true, "update": true, "delete": true }
}
```

* **Adding Roles**: Injects default `{ create: true, read: true, update: true, delete: true }` permissions for new role tags.
* **Removing Roles**: Automatically prunes permission keys for role tags that are no longer assigned.

---

### 4.3 `organizationUsers.getCurrentMembership`
**Type**: `Query`  
**Purpose**: Returns the active store membership document for the authenticated caller.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `organizationId` | `v.optional(v.id("organizations"))` | No | Store Organization ID. | `"jd7639gq498thz..."` |

#### Return Value
```ts
{
  _id: Id<"organizationUsers">,
  organizationId: Id<"organizations">,
  userId: string,
  userType: string[],
  userPermission: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }>,
  createdAt?: number,
  updatedAt: number
} | null
```

---

### 4.4 `organizationUsers.list`
**Type**: `Query`  
**Purpose**: Returns active store staff members. Excludes customer-only (`["customer"]`, `["customer_data"]`) and bot (`["bot"]`) records unless `includeCustomers: true` is passed.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `organizationId` | `v.optional(v.id("organizations"))` | No | Store Organization ID. | `"jd7639gq498thz..."` |
| `includeCustomers`| `v.optional(v.boolean())` | No | If true, returns all members including customers/bots. | `false` |

#### Return Value
`Doc<"organizationUsers">[]`

---

### 4.5 `organizationUsers.create`
**Type**: `Mutation`  
**Purpose**: Onboards a new staff member to the store.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `organizationId` | `v.optional(v.id("organizations"))` | No | Store Organization ID. | `"jd7639gq498thz..."` |
| `userId` | `v.string()` | **Yes** | Clerk User ID (`identity.subject`). | `"user_2P9x8b..."` |
| `userType` | `v.array(v.string())` | **Yes** | Non-empty array of valid role tags. | `["cashier", "kds"]` |
| `userPermission` | `v.optional(v.any())` | No | Optional custom permission overrides.| |

#### Return Value
Returns new `Id<"organizationUsers">`.

#### Validation & Business Guards
1. **Empty User ID Check**: Throws `"User ID is required"` if empty string provided.
2. **Role Validation**: Normalizes and checks role strings against `VALID_USER_TYPES`. Throws `"Invalid user type: <type>"` if invalid.
3. **Duplicate Membership Check**: Throws `"User \"<userId>\" is already a member of <StoreName>."` if user is already an active member.
4. **Admin Access Guard**: Requires caller to be an active admin (`requireAdmin`). *Exception*: Allowed if database has 0 active members (initial bootstrapping).

---

### 4.6 `organizationUsers.update`
**Type**: `Mutation`  
**Purpose**: Updates roles (`userType`) and/or permissions (`userPermission`) of an existing member.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationUsers")` | **Yes** | Member Document ID. | `"k5701abc..."` |
| `userType` | `v.optional(v.array(v.string()))` | No | Updated array of role tags. | `["captain", "orders"]` |
| `userPermission` | `v.optional(v.any())` | No | Updated permission object. | |

#### Return Value
`{ success: true }`

#### Business Guards & Protections
* **Sole Admin Protection**: If removing the `admin` role tag from a user who is the sole remaining admin of the store, handler throws `"Cannot remove the sole admin of the organization."`.

---

### 4.7 `organizationUsers.addType`
**Type**: `Mutation`  
**Purpose**: Appends new role tags to an existing member without overwriting existing roles.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationUsers")` | **Yes** | Member Document ID. | `"k5701abc..."` |
| `types` | `v.array(v.string())` | **Yes** | Array of role tags to append. | `["inventory"]` |

#### Return Value
`{ success: true, userType: string[] }`

---

### 4.8 `organizationUsers.removeType`
**Type**: `Mutation`  
**Purpose**: Removes specified role tags from a member and prunes their permissions.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationUsers")` | **Yes** | Member Document ID. | `"k5701abc..."` |
| `types` | `v.array(v.string())` | **Yes** | Array of role tags to remove. | `["kds"]` |

#### Return Value
`{ success: true, deleted: boolean, userType: string[] }`

#### Business Guards & Protections
1. **Sole Admin Protection**: Throws `"Cannot remove the sole admin of the organization."` if removing `admin` from sole admin.
2. **Auto Soft-Delete**: If removing the roles causes `userType` to become empty (`[]`), the handler soft-deletes the record (`deletedAt = Date.now()`) and returns `deleted: true`.

---

### 4.9 `organizationUsers.remove`
**Type**: `Mutation`  
**Purpose**: Soft-deletes a store user membership.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationUsers")` | **Yes** | Member Document ID. | `"k5701abc..."` |

#### Return Value
`{ success: true }`

#### Business Guards & Protections
1. **Self-Removal Protection**: Handler checks caller identity. If `member.userId === identity.subject`, throws `"Sorry, you can't remove yourself"`.
2. **Sole Admin Protection**: If member has `admin` role, handler checks total active admins. If `adminCount <= 1`, throws `"Cannot remove the sole admin of the organization."`.

---

## 5. Store Feature Flags API Contracts (Default POS App)

### 5.1 Default Audited Feature Catalog

The system defines 7 standard per-store feature flags initialized during store provisioning:

```ts
export const DEFAULT_STORE_FEATURES = [
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

### 5.2 `organizationFeatures.get`
**Type**: `Query`  
**Purpose**: Returns the feature flag object by key, or `null` if disabled/soft-deleted.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `featureKey` | `v.string()` | **Yes** | Feature flag key string. | `"auto_accept"` |

#### Return Value
```ts
{
  _id: Id<"organizationFeatures">,
  featureKey: string,
  active: boolean,
  createdAt?: number,
  updatedAt: number
} | null
```

---

### 5.3 `organizationFeatures.list`
**Type**: `Query`  
**Purpose**: Lists all active store feature flags.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `includeDeleted` | `v.optional(v.boolean())` | No | If true, includes soft-deleted flags. | `false` |

#### Return Value
`Doc<"organizationFeatures">[]`

---

### 5.4 `organizationFeatures.toggle`
**Type**: `Mutation`  
**Purpose**: Enables or disables a store feature flag (`active: boolean`).

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `featureKey` | `v.string()` | **Yes** | Feature flag key string. | `"auto_accept"` |
| `active` | `v.boolean()` | **Yes** | New boolean active state. | `true` |

#### Return Value
`{ success: true, featureKey: string, active: boolean }`

#### Authentication & Authorization
* **Authorization**: Checks caller identity token. Caller must have role `"admin"`, `"STORE_ADMIN"`, `"ORG_ADMIN"`, or `"super_admin"`.
* **Error**: Non-admin callers (e.g. `cashier`, `waiter`, `customer`) throw `"Unauthorized: Only Store Admin users can toggle feature flags."`.

---

### 5.5 `organizationFeatures.initializeDefaults`
**Type**: `Mutation`  
**Purpose**: Idempotently seeds default store feature flags during store provisioning.

#### Arguments
*None.*

#### Behavior
* Inserts missing flags with `active = false`.
* **Idempotency Guarantee**: If a flag already exists (whether `active: true` or `active: false`), existing state is preserved. Does **not** resurrect soft-deleted flags.

---

## 6. Global Features Catalog API Contracts (Master App)

### 6.1 `features.create` (Master App)
**Type**: `Mutation`  
**Purpose**: Super Admin registers a new global feature in Master App.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `v.string()` | **Yes** | Internal feature key name. | `"kitchen_display_v2"` |
| `displayName` | `v.string()` | **Yes** | Human-readable title. | `"Kitchen Display System v2"` |
| `description` | `v.optional(v.string())` | No | Long description. | `"Advanced multi-screen KDS grid"` |
| `displayDescription`| `v.optional(v.string())` | No | Subtitle description. | `"KDS v2 Module"` |

#### Return Value
Returns `Id<"features">`.

#### Business Guards & Errors
* **Super Admin Guard**: Requires `role === "super_admin"`, `"SYSTEM_ADMIN"`, or `"admin"`.
* **Name Validation**: Cannot be blank. Enforces **case-insensitive uniqueness** across active global features. Throws `"Feature with name \"<name>\" already exists (case-insensitive collision)."`.

---

## 7. Side Effects Summary Matrix

| Domain | API Function | Primary Action | Side Effects & Automatic Operations |
| :--- | :--- | :--- | :--- |
| **Org Users** | `organizationUsers.create` | Inserts `organizationUsers` record | Validates roles; automatically calculates & inserts `userPermission` CRUD grid. |
| **Org Users** | `organizationUsers.update` | Patches roles/permissions | Re-calculates permission sync; enforces sole-admin protection. |
| **Org Users** | `organizationUsers.addType` | Appends role tags | Merges new role permissions with existing `userPermission` object. |
| **Org Users** | `organizationUsers.removeType` | Removes role tags | Prunes permissions. Soft-deletes record (`deleted: true`) if `userType` becomes `[]`. |
| **Org Users** | `organizationUsers.remove` | Soft-deletes member record | Sets `deletedAt = Date.now()`. Blocks self-removal & sole-admin deletion. |
| **Store Features** | `organizationFeatures.toggle` | Toggles `active` boolean flag | Updates `updatedAt`. Requires Store Admin role. |
| **Store Features** | `initializeDefaults` | Seeds 7 default flags | Idempotent; preserves user toggles & soft-deleted states. |
| **Global Features** | `features.create` | Inserts global `features` record | Master App global catalog insertion. Case-insensitive name uniqueness check. |

---

## 8. Error Handling Reference

| Error Message | Thrown By | Root Cause | Recommended Frontend Handling |
| :--- | :--- | :--- | :--- |
| `"Unauthenticated. Please provide a valid authentication token."` | `requireAuth` | Missing or expired Clerk JWT identity. | Redirect user to login screen. |
| `"Forbidden. Active store membership required."` | `requireMember` | Authenticated user has no membership in store. | Display "Access Denied: Not a store member" screen. |
| `"Forbidden. Admin access required."` | `requireAdmin` | User lacks `admin` role tag. | Disable admin action buttons; display permission alert. |
| `"User ID is required"` | `organizationUsers.create` | Empty string provided for `userId`. | Highlight user selection field. |
| `"User type cannot be empty"` / `"Invalid user type: <type>"` | `validateAndNormalizeUserTypes` | Empty or invalid role tag string provided. | Restrict role selector dropdown to `VALID_USER_TYPES`. |
| `"User \"<userId>\" is already a member of <StoreName>."` | `organizationUsers.create` | User is already an active member of this store. | Show notification "User is already onboarded". |
| `"Cannot remove the sole admin of the organization."` | `update`, `removeType`, `remove` | Attempted to delete or demote the last remaining admin. | Show modal "Please assign another admin before removing this account". |
| `"Sorry, you can't remove yourself"` | `organizationUsers.remove` | Admin attempted to call `remove` on their own record. | Hide "Delete Account" button for currently logged-in user. |
| `"Unauthorized: Only Store Admin users can toggle feature flags."` | `organizationFeatures.toggle` | Non-admin user attempted to toggle feature flag. | Disable feature flag toggle switches for non-admin users. |
| `"Feature flag \"<key>\" not found."` | `organizationFeatures.toggle` | Invalid or soft-deleted feature key. | Refresh feature flags list from server. |
| `"Feature with name \"<name>\" already exists (case-insensitive collision)."` | `features.create` | Duplicate global feature key in Master App. | Prompt admin for unique feature key name. |

---

## 9. Concrete Frontend Usage Examples

### 9.1 Checking Member Permissions & Current Staff Role

```tsx
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function StaffNavigationHeader() {
  const membership = useQuery(api.organizationUsers.getCurrentMembership, {});

  if (membership === undefined) return <div>Loading permissions...</div>;
  if (membership === null) return <div>Access Denied (Not a store member)</div>;

  const isAdmin = membership.userType.includes("admin");
  const canAccessKds = membership.userType.includes("kds") || isAdmin;
  const canAccessCashier = membership.userType.includes("cashier") || isAdmin;

  return (
    <nav className="staff-nav">
      <span>Logged in as: {membership.userType.join(", ")}</span>
      {canAccessCashier && <a href="/cashier">Cashier POS</a>}
      {canAccessKds && <a href="/kds">Kitchen Display</a>}
      {isAdmin && <a href="/admin/staff">Staff Management</a>}
    </nav>
  );
}
```

---

### 9.2 Managing Store Staff Members (React + Convex)

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

export function StaffManagementList() {
  const staff = useQuery(api.organizationUsers.list, {});
  const removeStaff = useMutation(api.organizationUsers.remove);
  const addRole = useMutation(api.organizationUsers.addType);
  const [error, setError] = useState<string | null>(null);

  if (!staff) return <div>Loading staff list...</div>;

  const handleRemove = async (id: Id<"organizationUsers">) => {
    setError(null);
    try {
      await removeStaff({ id });
    } catch (err: any) {
      setError(err.message || "Failed to remove staff member");
    }
  };

  const handlePromoteToCaptain = async (id: Id<"organizationUsers">) => {
    try {
      await addRole({ id, types: ["captain"] });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="staff-panel">
      <h2>Store Staff Members</h2>
      {error && <div className="error-banner">{error}</div>}

      <table>
        <thead>
          <tr>
            <th>User ID</th>
            <th>Assigned Roles</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member._id}>
              <td>{member.userId}</td>
              <td>{member.userType.join(", ")}</td>
              <td>
                {!member.userType.includes("captain") && (
                  <button onClick={() => handlePromoteToCaptain(member._id)}>
                    + Add Captain Role
                  </button>
                )}
                <button onClick={() => handleRemove(member._id)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

### 9.3 Toggling Store Feature Flags (React + Convex)

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function FeatureFlagsTogglePanel() {
  const features = useQuery(api.organizationFeatures.list, {});
  const toggleFeature = useMutation(api.organizationFeatures.toggle);

  if (!features) return <div>Loading feature flags...</div>;

  const handleToggle = async (featureKey: string, currentActive: boolean) => {
    try {
      await toggleFeature({
        featureKey,
        active: !currentActive,
      });
    } catch (err: any) {
      alert(err.message || "Failed to toggle feature flag");
    }
  };

  return (
    <div className="features-panel">
      <h3>Store Feature Flags</h3>
      <ul>
        {features.map((flag) => (
          <li key={flag._id} className="feature-item">
            <span>{flag.featureKey}</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={flag.active}
                onChange={() => handleToggle(flag.featureKey, flag.active)}
              />
              <span className="slider"></span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 10. Frontend Integration Checklist

- [ ] **Auth Token Passing**: Verify Clerk JWT headers are passed to Convex Client for `organizationUsers` queries/mutations.
- [ ] **Staff Navigation RBAC**: Use `getCurrentMembership` query to dynamically render navigation items based on `userType`.
- [ ] **Role Selection Input**: Restrict staff onboarding role selections to valid `VALID_USER_TYPES`.
- [ ] **Self-Removal Guard Handling**: Catch `"Sorry, you can't remove yourself"` and hide delete action buttons on the current user's profile card.
- [ ] **Sole Admin Protection**: Catch `"Cannot remove the sole admin of the organization."` error and display a user-friendly modal.
- [ ] **Feature Flag Toggles**: Use `api.organizationFeatures.list` and `api.organizationFeatures.toggle` in the store settings panel.
- [ ] **Feature Guarding**: Wrap conditional POS features (e.g. `auto_accept`, `skip_phone_number_required`) with `useQuery(api.organizationFeatures.get, { featureKey: "..." })`.
- [ ] **Store Provisioning Hook**: Ensure `initializeDefaults` is invoked during store setup to seed all 7 default feature flags.
