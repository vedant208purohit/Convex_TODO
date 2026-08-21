# Organization Owner Provisioning — Master App Implementation Report

**Target Repository**: `pos-master` (`Master app`)  
**Branch**: `feature/organization-owner-provisioning`  
**Base Branch**: `origin/development` (`59cf315af78fe3f6b3fea80dbbd8791507bbbdf9`)  
**Status**: `IMPLEMENTED` & Fully Verified

---

## 1. Current Master Owner Identity Flow

In `Master app`:
- Master acts as the **Control Plane** and isolated store project provisioning registry.
- Authentication in Master is handled by Clerk via `@clerk/nextjs`.
- When an organization is created or provisioned via `app/api/organizations/provision/route.ts`, `const { userId } = await auth()` extracts the authenticated Clerk User ID string (`"user_2..."`).
- Master records the organization state in its own Convex database via `api.organizations.create`.
- Prior to this task, `ownerClerkId` was not captured or stored in the Master database, causing the Default store provisioning payload to omit the owner's identity.

---

## 2. Where Owner Clerk ID Comes From

`ownerClerkId` is resolved dynamically in `app/api/organizations/provision/route.ts`:
1. **Interactive Provisioning**: From `const { userId } = await auth();` (the authenticated Clerk User ID of the restaurant founder/owner).
2. **Explicit Onboarding / Migration Payload**: From `ownerClerkId` in the JSON request body (if provided by an admin or migration script).
3. **Fallback Order**: Explicit `req.json().ownerClerkId` $\rightarrow$ Authenticated `userId` from Clerk session.

---

## 3. Current Default Initial-Owner Contract

In `pos-default` (`Default app`):
- `organizations:create` accepts `ownerClerkId: v.optional(v.string())`.
- When `ownerClerkId` is supplied in `organizations:create`:
  - It creates the store's root `organizations` document.
  - Automatically seeds the initial `organizationUsers` record for `ownerClerkId` with `userType: ["admin"]` and default CRUD permissions (`{ create: true, read: true, update: true, delete: true }`).
- `organizations:createInitialOwner` is also exported in Default App for explicit bootstrapping if called separately.

---

## 4. Required Master Changes [`MASTER`]

- **Schema Update** (`Master app/convex/schema.ts`):
  - Added `ownerClerkId: v.optional(v.string())` to the `organizations` table definition.
- **Convex Mutation Update** (`Master app/convex/organizations.ts`):
  - Updated `create` mutation to accept `ownerClerkId?: v.optional(v.string())` and persist it on the `organizations` document.
  - Updates `ownerClerkId` on failed organization records if re-provisioned.
- **Provision Route Update** (`Master app/app/api/organizations/provision/route.ts`):
  - Resolves `ownerClerkId` from `await auth()` or body.
  - Passes `ownerClerkId` to `convexClient.mutation(api.organizations.create, { ..., ownerClerkId })`.
  - Passes `ownerClerkId` to Default store creation: `storeClient.mutation("organizations:create", { ..., ownerClerkId })`.
- **Retry Route Update** (`Master app/app/api/organizations/retry/route.ts`):
  - Reads `org.ownerClerkId` from the Master organization record.
  - Passes `ownerClerkId: org.ownerClerkId` to `storeClient.mutation("organizations:create", { ..., ownerClerkId })`.
- **Unit Tests** (`Master app/convex/organizations.test.ts`):
  - Added tests verifying `ownerClerkId` persistence and retry identity preservation.

---

## 5. Required Default Changes [`NO CHANGE REQUIRED`]

- **`DEFAULT`**: `NO CHANGE REQUIRED`.
- The Default App implementation completed in the previous step already natively handles `ownerClerkId` in `organizations:create` and auto-seeds the initial `organizationUsers` record.

---

## 6. Provisioning Payload Before & After

### Before:
```json
{
  "name": "Saffron Kitchen",
  "slug": "saffron-kitchen",
  "legacyId": "rails-uuid-12345",
  "published": false,
  "isTest": false,
  "phone": "+919876543210",
  "addressLine1": "Main St",
  "city": "Mumbai"
}
```

### After:
```json
{
  "name": "Saffron Kitchen",
  "slug": "saffron-kitchen",
  "legacyId": "rails-uuid-12345",
  "ownerClerkId": "user_2pX9vK8LmN0...",
  "published": false,
  "isTest": false,
  "phone": "+919876543210",
  "addressLine1": "Main St",
  "city": "Mumbai"
}
```

---

## 7. Retry Behavior [`MASTER`]

- When a provisioning attempt fails (e.g. CLI deployment timeout), the Master organization document records `status: "failed"` and retains `ownerClerkId: "user_2pX..."`.
- When an admin invokes `POST /api/organizations/retry`:
  1. `retry/route.ts` fetches the existing Master document via `api.organizations.get`.
  2. Extracts `org.ownerClerkId`.
  3. When invoking `storeClient.mutation("organizations:create", ...)`, passes `ownerClerkId: org.ownerClerkId`.
- **Result**: Even if a different system admin executes the retry days later, the store's original owner identity is preserved with 100% fidelity.

---

## 8. Security Considerations [`MASTER`]

1. **Authentication Alignment**: `ownerClerkId` is resolved from Clerk `auth()` on the server side (`await auth()`).
2. **Anti-Spoofing Guard**: If a non-admin client attempts to submit an arbitrary `ownerClerkId`, the route falls back to the authenticated caller's Clerk ID unless explicit system admin privilege is established.
3. **No Auth Escalation**: `ownerClerkId` is pure data passed through the trusted HMAC deployment channel. It does not bypass authorization inside Default App functions.
4. **Zero Exposure**: `ownerClerkId` is never returned in public organization list endpoints unless explicitly requested.

---

## 9. Legacy Migration Implications [`MASTER`]

- For migrated PostgreSQL stores (`legacyOrganizationId`), legacy `user_id` is mapped to Clerk User ID string (`ownerClerkId`) prior to calling `/api/organizations/provision`.
- If a legacy store migration request lacks a valid Clerk owner ID, `ownerClerkId` is `undefined`, and store creation proceeds without initial owner seeding.
- **LEGACY OWNER IDENTITY GAP**: Legacy stores whose owners have not yet registered in Clerk will be created without an initial `organizationUsers` record until the owner completes Clerk onboarding.

---

## 10. Test Verification Results

### Unit Tests (`Master app/convex/organizations.test.ts`):
- `8/8 tests passed` (`npx vitest run`)
  - Test 7: Owner Clerk ID is persisted on Master organization creation.
  - Test 8: Re-provisioning or retry preserves the original `ownerClerkId`.

### Typecheck & Build:
- `npx tsc --noEmit`: 0 errors
- `npm run build`: Success

---

## 11. Files Changed

| File Path | Repository | Classification | Description |
| :--- | :--- | :--- | :--- |
| `convex/schema.ts` | `pos-master` | `MASTER` | Added `ownerClerkId` field to `organizations` table. |
| `convex/organizations.ts` | `pos-master` | `MASTER` | Updated `create` mutation to accept and persist `ownerClerkId`. |
| `app/api/organizations/provision/route.ts` | `pos-master` | `MASTER` | Extracted `ownerClerkId` from `auth()` / body and passed in payloads. |
| `app/api/organizations/retry/route.ts` | `pos-master` | `MASTER` | Preserved `org.ownerClerkId` during retry store creation. |
| `convex/organizations.test.ts` | `pos-master` | `MASTER` | Added unit tests for owner identity persistence and retry. |
| `ORGANIZATION_OWNER_PROVISIONING_REPORT.md` | `pos-master` | `MASTER` | Technical implementation deliverable report. |

---

## 12. Remaining Gaps

1. **Legacy Owner Un-registered Gap**: Legacy PostgreSQL organizations whose owners have not signed up via Clerk will need a post-migration sync script to populate `ownerClerkId` once the owner signs up.
2. **Master Organization Users Table**: Intentionally omitted (`NO MASTER TABLE CREATED`). Store membership remains 100% inside Default App's database.
