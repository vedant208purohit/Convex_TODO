# Organization Users Domain — Implementation Report

**Target Repository**: `pos-default`  
**Branch**: `feature/organization-users`  
**Base Branch**: `origin/development` (`29692f81e5edb1e5df10f1c226b5de02b208fcb0`)  
**Status**: `IMPLEMENTED` & Fully Tested

---

## 1. Existing Legacy Organization Users Behavior

In the legacy Rails/PostgreSQL application (`defx-pos`):
- `organization_users` served as the join table between `users` (global user identity) and `organizations` (tenant store).
- It stored `user_type` as a PostgreSQL `varchar[]` array of role tags, and `user_permission` as a JSON object of granular CRUD flags.
- Legacy `acts_as_paranoid` managed soft deletion via `deleted_at`.
- The `before_save :update_permissions` callback automatically merged default CRUD permissions when a role tag was added and pruned permissions (`slice!`) when a role tag was removed.
- Multi-tenancy in Rails required sending `Set-Organization: <org_id>` on every request.

---

## 2. Final Convex Schema

```ts
// convex/schema.ts
organizationUsers: defineTable({
  organizationId: v.id("organizations"),
  userId: v.string(), // Clerk User ID (identity.subject)
  userType: v.array(v.string()), // Array of string role/type tags (e.g. ["admin", "orders", "inventory"])
  userPermission: v.optional(v.any()), // JSON object mapping role tags to CRUD boolean flags
  createdAt: v.optional(v.number()),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()), // Soft-deletion timestamp
})
  .index("by_user", ["userId"])
  .index("by_org", ["organizationId"])
  .index("by_user_and_org", ["userId", "organizationId"]),
```

---

## 3. Field-by-Field Explanation

| Field Name | Type | Purpose & Justification | Status |
| :--- | :--- | :--- | :--- |
| `organizationId` | `v.id("organizations")` | Foreign key referencing the store's root organization document. Retained for domain integrity. | `IMPLEMENTED` |
| `userId` | `v.string()` | Stores Clerk User ID (`identity.subject`). Decouples global authentication from store membership without redundant user tables. | `IMPLEMENTED` |
| `userType` | `v.array(v.string())` | Array of assigned role tags (e.g., `["admin"]`, `["cashier", "kds"]`). Preserves multi-role semantics. | `IMPLEMENTED` |
| `userPermission` | `v.optional(v.any())` | JSON map storing `{ create: boolean, read: boolean, update: boolean, delete: boolean }` per assigned role. | `IMPLEMENTED` |
| `createdAt` | `v.optional(v.number())` | Millisecond epoch timestamp when membership was created. | `IMPLEMENTED` |
| `updatedAt` | `v.number()` | Millisecond epoch timestamp when membership was last modified. | `IMPLEMENTED` |
| `deletedAt` | `v.optional(v.number())` | Soft-deletion millisecond epoch timestamp. Active queries filter for `deletedAt === undefined`. | `IMPLEMENTED` |

---

## 4. Authentication Model

- **Interactive User Requests**: Authenticated via Clerk JWT. Convex functions invoke `ctx.auth.getUserIdentity()`, returning `identity.subject` as the caller's unique User ID.
- **Store Boundary**: Authentication verifies *identity*, but does **not** grant access unless an active `organizationUsers` record exists for `(userId, organizationId)` where `deletedAt === undefined`.
- **Master Provisioning Requests**: Trusted server-to-server provisioning initializes the organization and initial owner membership using provisioning authentication without requiring an interactive Clerk JWT.

---

## 5. Authorization Model

```
Interactive Request
        │
        ▼
ctx.auth.getUserIdentity() ──► Null? ──► Error: "Unauthenticated"
        │
        ▼ (userId = identity.subject)
Query `organizationUsers` (userId, organizationId, deletedAt: undefined)
        │
        ▼ Not Found? ──► Error: "Forbidden. Active store membership required."
        │
Check `callerMembership.userType`
        │
        ├─► Is Admin? ──────► Authorized for administrative & user management mutations
        │
        └─► Non-Admin Staff ─► Permitted for staff-level operations; User management mutation rejected
```

---

## 6. Valid User Types

The following 17 role and feature tags from the legacy specification are supported:

- **Management & Operational Roles**:
  - `admin`: Full administrative access to store settings, staff, reports, and POS.
  - `cashier`: Register, billing, and payment processing.
  - `captain`: Floor service, table management, and order taking.
  - `waiter`: Table ordering and order status tracking.
  - `chef`: Kitchen Display System (KDS) access and order status updates.
  - `worker`: General operational staff.
  - `customer`: Dining customer.
  - `customer_data`: Customer profile & loyalty tracking context.
  - `bot`: Automated ordering bot or WhatsApp integration agent.
- **Feature Tags**:
  - `dashboard`, `orders`, `menu`, `kds`, `queue`, `inventory`, `report`, `survey`

---

## 7. Permission Model

### Default CRUD Permissions Mapping (`DEFAULT_PERMISSIONS`):
```ts
{
  admin:         { create: true, read: true, update: true, delete: true },
  captain:       { create: true, read: true, update: true, delete: true },
  waiter:        { create: true, read: true, update: true, delete: true },
  worker:        { create: true, read: true, update: true, delete: true },
  cashier:       { create: true, read: true, update: true, delete: true },
  customer:      { create: true, read: true, update: true, delete: true },
  customer_data: { create: true, read: true, update: true, delete: true },
  chef:          { create: true, read: true, update: true, delete: true },
  // Feature flags inherit default CRUD access
}
```

### Permission Synchronization Lifecycle:
1. When a role is added to `userType`, default CRUD permissions for that role are merged into `userPermission`.
2. When a role is removed from `userType`, permissions for pruned roles are stripped from `userPermission` (mirroring Rails `slice!(*user_type)`).
3. Custom granular permissions explicitly provided by an admin are preserved for active roles.

---

## 8. CRUD / Mutation API (`convex/organizationUsers.ts`)

### Queries:
- `organizationUsers:getCurrentMembership`: Fetches the caller's own active membership.
- `organizationUsers:get`: Fetches a single membership by document ID (requires active store membership).
- `organizationUsers:getByUserId`: Fetches an active membership by Clerk User ID string.
- `organizationUsers:list`: Lists active store members. Excludes customer-only records by default; returns all if `includeCustomers: true`.
- `organizationUsers:search`: Searches active members by `userType` filter.

### Mutations:
- `organizationUsers:create`: Admin onboard a new staff member. Enforces unique active membership per user and validates roles.
- `organizationUsers:update`: Admin updates roles or granular permissions. Enforces sole-admin protection.
- `organizationUsers:addType`: Appends role tags and merges default permissions.
- `organizationUsers:removeType`: Removes role tags and prunes permissions. If `userType` becomes empty, automatically soft-deletes the record. Enforces sole-admin protection.
- `organizationUsers:remove`: Soft-deletes a membership. Enforces self-removal prevention and sole-admin protection.

---

## 9. Business Rules

| # | Rule Description | Implementation | Status |
| :--- | :--- | :--- | :--- |
| 1 | Uniqueness | One active membership per `(userId, organizationId)`. Duplicate active creations rejected. | `IMPLEMENTED` |
| 2 | Role Array | `userType` stored as `string[]` allowing multi-role assignment. | `IMPLEMENTED` |
| 3 | Permission Sync | `syncPermissions()` automatically aligns `userPermission` keys with `userType`. | `IMPLEMENTED` |
| 4 | Empty Roles Deletion | If `userType` becomes empty after `removeType`, membership is automatically soft-deleted. | `IMPLEMENTED` |
| 5 | Non-Member Isolation | Authenticated Clerk users with no active membership in the store are rejected with 403 Forbidden. | `IMPLEMENTED` |
| 6 | Staff vs Customer Filter | `list` query excludes customer-only records by default unless `includeCustomers: true`. | `IMPLEMENTED` |

---

## 10. Sole Admin Protection

- **Requirement**: A store must never be left without an active admin.
- **Rule**: If an organization has only 1 active member with `"admin"` in `userType`:
  1. `removeType` rejecting removing `"admin"` tag with: `"Cannot remove the sole admin of the organization."`
  2. `update` rejecting replacing `userType` with non-admin roles with: `"Cannot remove the sole admin of the organization."`
  3. `remove` rejecting deleting the sole admin membership with: `"Cannot remove the sole admin of the organization."`

---

## 11. Self-Modification & Self-Removal Rules

- **Self-Removal Guard**: An authenticated admin cannot soft-delete their own membership record (`"Sorry, you can't remove yourself"`). Another admin must perform the removal.
- **Self-Modification**: An admin can update their own non-admin roles or permissions, subject to sole-admin protection.

---

## 12. Soft Delete Behavior

- Soft deletion sets `deletedAt = Date.now()` and `updatedAt = Date.now()`.
- Records are never permanently removed from the database during normal operations.
- Active queries (`get`, `getByUserId`, `list`, `search`, `getCurrentMembership`) strictly filter for `deletedAt === undefined`.
- When an initial owner is re-provisioned for a soft-deleted user, `deletedAt` is cleared and roles are restored.

---

## 13. Initial Owner Provisioning

- `organizations:create` in `convex/organizations.ts` accepts optional `ownerClerkId?: v.optional(v.string())`.
- When supplied, it automatically inserts the initial `organizationUsers` record for the store with `userType: ["admin"]` and default admin CRUD permissions.
- Dedicated mutation `organizations:createInitialOwner` is also exported for explicit provisioning workflows.
- Operates via server-to-server provisioning authentication without requiring an interactive Clerk JWT.

---

## 14. Indexes

1. `by_user` (`["userId"]`): Fast lookup of memberships by Clerk User ID.
2. `by_org` (`["organizationId"]`): Efficient retrieval of all members for the store.
3. `by_user_and_org` (`["userId", "organizationId"]`): Optimal composite lookup for single user membership within the organization.

---

## 15. Security Review

- [x] **No Frontend Identity Spoofing**: `userId` for caller authorization is strictly obtained from `ctx.auth.getUserIdentity()`.
- [x] **Store Isolation**: 1 Store = 1 Convex Database. User identity alone does not grant access without a local active membership document.
- [x] **Role Escalation Guard**: Non-admin staff (e.g. cashier, waiter) cannot create, update, or delete memberships.
- [x] **Sole Admin Immunity**: Store cannot accidentally be rendered admin-less.

---

## 16. Test Coverage

32 unit tests executed and passed via `npx vitest run`:
- `convex/organizations.test.ts` (15 tests passed)
- `convex/organizationUsers.test.ts` (17 tests passed):
  1. Initial owner auto-creation on organization creation.
  2. Dedicated `createInitialOwner` mutation.
  3. Unauthenticated queries and mutations rejected.
  4. Non-member authenticated caller forbidden.
  5. Admin staff creation with automatic CRUD permissions.
  6. Duplicate active membership rejection.
  7. Invalid user type rejection.
  8. Non-admin staff creation rejection.
  9. `addType` role appending and permission merge.
  10. `removeType` role removal and permission pruning.
  11. `removeType` empty role automatic soft deletion.
  12. Self-removal prevention guard (`"Sorry, you can't remove yourself"`).
  13. Sole admin removal protection.
  14. Sole admin role stripping protection.
  15. Multi-admin peer removal support.
  16. `getCurrentMembership` caller resolution.
  17. `list` and `search` staff vs customer filtering.

---

## 17. Files Changed

- `convex/schema.ts` (Added `organizationUsers` table and indexes)
- `convex/organizationUsers.ts` (New module implementing all domain queries, mutations, and authorization helpers)
- `convex/organizations.ts` (Added `ownerClerkId` support to `create` and exported `createInitialOwner`)
- `convex/organizationUsers.test.ts` (New test suite with 17 unit tests)
- `ORGANIZATION_USERS_IMPLEMENTATION_REPORT.md` (Technical implementation report)

---

## 18. Remaining Business Decisions

The following items are marked as `REQUIRES BUSINESS DECISION` for future product iterations:
1. **Dynamic Custom Role Creation**: Currently, roles are constrained to the 17 legacy defined tags. Adding custom merchant-defined roles requires a business decision on dynamic role schemas.
2. **Customer Auto-Creation Policy**: Customer auto-membership insertion is ready to be connected once the `orders` and `queues` domains are implemented.
3. **Invitation & Email Notification Flow**: Out-of-band email invitations for staff onboarding were out of scope and require a product decision on communication provider integration.

---

## 19. Future Extension Points

- Hooking automatic customer `organizationUsers` creation into future `orders:create` and `queues:join` mutations.
- Multi-store dashboard aggregation in Master App for merchants managing multiple store projects.
