# DEFx-POS Organization Employees & Users: Frontend Product Functional Specification

**Target Audience**: Product Managers, Frontend Engineers, UI/UX Designers, Backend Engineers  
**Target Applications**: `pos-default` (Store POS & Management Portal), `pos-master` (Multi-Tenant Master Registry), Clerk Identity Platform  
**Legacy Reference Source**: `defx-pos` (Ruby on Rails + PostgreSQL)  
**Date**: September 2026  
**Status**: COMPLETE / READY FOR DESIGN & FRONTEND IMPLEMENTATION  

---

## 1. Executive Summary

This document provides a complete, authoritative functional specification of **everything related to Employees and Users within a Restaurant Organization** across DEFx-POS.

In the DEFx-POS architecture, **User Identity** is globally decoupled from **Organization Staff Access**:
1. **User Identity Layer (Clerk)**: Handles user credentials, login methods (Phone OTP, Email OTP, Passwords, Google OAuth), profile names, email addresses, phone numbers, and profile avatars globally.
2. **Store Management & Authorization Layer (Convex `pos-default`)**: Manages localized store employees, multi-role assignments (`userType`), granular feature permissions (`userPermission`), employee lifecycles, and self-removal/sole-admin security rules within each dedicated store database.
3. **Dedicated Floor Waiters (`organizationWaiters`)**: Provides lightweight, PIN/code-based floor staff records for rapid order punching and table service without requiring a full personal Clerk account.

This specification details the business model, data schemas, role/permission matrices, lifecycle workflows, frontend screen specifications, error handling, and exact Convex API contracts needed to design and build the employee management user experience.

---

## 2. Employee/User Business Model

### Conceptual Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Clerk Identity Platform                       │
│  - Global User Identity (userId = "user_2...", email, phone, name, avatar) │
│  - Authentication, Sessions, Password/OTP Verification                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Global User ID (`userId`)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Store Convex Database (`pos-default`)                  │
│                                                                        │
│   ┌────────────────────────┐            ┌──────────────────────────┐   │
│   │     organizations      │            │    organizationUsers     │   │
│   │  (Store Tenant Record) │ 1 ───────* │ (Staff & Role Membership)│   │
│   └────────────────────────┘            └──────────────────────────┘   │
│                │ 1                                                     │
│                │                                                       │
│                ▼ *                                                     │
│   ┌────────────────────────┐                                           │
│   │  organizationWaiters   │                                           │
│   │ (Floor Waiters / POS)  │                                           │
│   └────────────────────────┘                                           │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Business Rules:
1. **Multi-Tenancy & Database Boundary**:
   - Each restaurant organization operates inside an **isolated Convex database deployment** (`pos-default`).
   - Physical tenant isolation eliminates the legacy Rails requirement for passing `Set-Organization` headers.
2. **One User ↔ Multiple Organizations**:
   - A single human being (one Clerk account) can belong to multiple restaurant stores with different roles (e.g., `admin` at Store A, `cashier` at Store B, `customer` at Store C).
   - In each store database, their access is governed by their local `organizationUsers` record.
3. **Separation of Staff vs Customer Memberships**:
   - Staff members hold operational roles (`admin`, `cashier`, `captain`, `waiter`, `chef`, `worker`).
   - Diners placing digital QR orders or joining queues are tagged with `customer` or `bot`.
   - Employee listing screens filter out customer-only and bot-only records by default.
4. **Decoupled Floor Waiter Entity**:
   - Quick-service and dine-in restaurants often employ temporary floor staff who do not have personal company emails or smartphones.
   - The system supports `organizationWaiters` for assigning orders to a waiter code (e.g., `"W-01"`) on the POS register.

---

## 3. User ↔ Organization Relationship

| Aspect | User Identity (Clerk) | Organization Membership (`organizationUsers`) | Floor Waiter (`organizationWaiters`) |
| :--- | :--- | :--- | :--- |
| **System of Record** | Clerk Identity Platform | Store Convex Database (`pos-default`) | Store Convex Database (`pos-default`) |
| **Identifier** | `identity.subject` (`"user_2..."`) | Document `_id` (`Id<"organizationUsers">`) | Document `_id` (`Id<"organizationWaiters">`) |
| **Scope** | Global (cross-organization) | Local to 1 Restaurant Store | Local to 1 Restaurant Store |
| **Attributes Owned** | First Name, Last Name, Email, Phone, Profile Image / Avatar, Auth Credentials | Store Roles (`userType`), CRUD Permissions (`userPermission`), Timestamps, Soft-Delete Status | First Name, Last Name, Waiter Code (`waiterCode`, `normalizedWaiterCode`) |
| **Creation Method** | User self-signup or Clerk Invitation / Admin provisioning | Store Admin action, Store creation seeding, or Digital order placement | Admin / Cashier floor creation |
| **Multiplicity** | 1 Human = 1 Global Account | 1 User = Many Store Memberships | 1 Store = Many Waiters |

---

## 4. Complete Employee / User Field Inventory

| Field | Source | Type | Required? | Nullable? | Default | Editable? | Description | Frontend Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`_id`** | Convex `organizationUsers` | `Id<"organizationUsers">` | **Yes** | No | Convex ID | No | Unique document ID of the organization membership. | Primary key for edit/delete mutations. |
| **`organizationId`** | Convex `organizationUsers` | `Id<"organizations">` | **Yes** | No | Current Org | No | Foreign key linking membership to store organization. | Scoping & validation. |
| **`userId`** | Convex `organizationUsers` | `string` | **Yes** | No | None | No | Clerk User ID (`identity.subject`, e.g. `"user_2..."`). | Maps membership to Clerk profile. |
| **`userType`** | Convex `organizationUsers` | `string[]` | **Yes** | No | `[]` | **Yes** | Array of assigned role strings and feature tags. | Role badges, multi-select role picker. |
| **`userPermission`** | Convex `organizationUsers` | `json` / `object` | No | Yes | Auto-synced | **Yes** | Map of role keys to CRUD boolean flags `{ create, read, update, delete }`. | Granular permission checkboxes/toggles. |
| **`createdAt`** | Convex `organizationUsers` | `number` (Epoch ms) | No | Yes | `Date.now()` | No | Timestamp when user was added to store. | "Joined Date" display in staff table. |
| **`updatedAt`** | Convex `organizationUsers` | `number` (Epoch ms) | **Yes** | No | `Date.now()` | System | Timestamp of last role/permission modification. | Audit info. |
| **`deletedAt`** | Convex `organizationUsers` | `number` (Epoch ms) | No | Yes | `undefined` | System | Soft-deletion timestamp. Set when member is removed. | Status badge ("Active" vs "Inactive"). |
| **`firstName`** | Clerk Identity | `string` | No | Yes | `""` | **Yes** (via Clerk) | User's first name. | Staff table name column, header avatar. |
| **`lastName`** | Clerk Identity | `string` | No | Yes | `""` | **Yes** (via Clerk) | User's last name. | Staff table name column. |
| **`fullName`** | Computed / Clerk | `string` | No | Yes | Derived | No | `[firstName, lastName].filter(Boolean).join(" ")`. | Primary display name. |
| **`email`** | Clerk Identity | `string` | No | Yes | `null` | **Yes** (via Clerk) | Primary verified email address. | Staff contact info, invite identifier. |
| **`phone`** | Clerk Identity | `string` | No | Yes | `null` | **Yes** (via Clerk) | Primary phone number (with country code). | Staff contact info, SMS login ID. |
| **`imageUrl`** | Clerk Identity | `string` (URL) | No | Yes | `null` | **Yes** (via Clerk) | Profile avatar picture URL. | Avatar image component in tables/cards. |
| **`lastSignInAt`** | Clerk Identity | `number` (Epoch ms) | No | Yes | `null` | No | Timestamp of user's most recent login. | "Last Active" column in table. |
| **`waiterCode`** | Convex `organizationWaiters` | `string` | No | Yes | `null` | **Yes** | Short alphanumeric code for floor waiters (e.g., `"W-04"`). | Waiter code badge, POS order assignment. |

---

## 5. Roles and Permissions

### 1. Supported Roles (`VALID_USER_TYPES`)

The system stores roles as an array of strings (`userType: v.array(v.string())`). A single employee can hold multiple roles simultaneously (e.g., `["cashier", "kds", "inventory"]`).

```ts
export const VALID_USER_TYPES = [
  "admin",         // Full Store Administrative Access
  "cashier",       // POS Register, Invoicing, Billing, Payment Handling
  "captain",       // Floor Lead, Table Management, Order Supervision
  "waiter",        // Floor Server, Order Taking, Table Servicing
  "chef",          // Kitchen Display System (KDS), Kitchen Stations
  "worker",        // General Operations Staff
  "customer",      // Digital Diner (ordering via QR / online menu)
  "customer_data", // Diner Profile & Loyalty Context
  "bot",           // Automated Bot / WhatsApp Ordering System
  "dashboard",     // Access to Analytics & Overview Metrics
  "orders",        // Access to Live Orders & History
  "menu",          // Access to Menu Items, Categories, Modifiers
  "kds",           // Access to Kitchen Display Screen
  "queue",         // Access to Queue / Waitlist Management
  "inventory",     // Access to Stock, Suppliers, Purchase Orders
  "report",        // Access to Sales & Tax Reporting
  "survey",        // Access to Customer Feedback & Surveys
] as const;
```

### 2. Role Categories & Access Matrix

| Role Tag | Category | System Description | Employee Management Rights | POS / Operational Scope |
| :--- | :--- | :--- | :--- | :--- |
| **`admin`** | Management | Full store administrator. Has complete control over store settings, staff, billing, menus, and reports. | **Full Control** (Create, Edit, Delete, Role Assignment, Permission Customization) | Unrestricted across all POS screens and settings. |
| **`cashier`** | Staff / POS | Front-of-house register operator. Manages active orders, bills, and settlements. | Read Waiters / Create Waiters (No Admin/Staff management) | Billing, Order Checkout, Cash Drawer, Payment Reconciliation. |
| **`captain`** | Staff / Floor | Floor lead managing table allocations, guest seating, and waiter assignments. | None | Table Layout, Order Transfer, Waiter Assignment, Bill Print. |
| **`waiter`** | Staff / Floor | Floor service staff punching orders at tables. | None | Table Order Entry, Item Status Updates. |
| **`chef`** | Staff / Kitchen | Kitchen station chef preparing food. | None | KDS Screen, Item Preparation Stage Transitions. |
| **`worker`** | Staff / General | General operational staff. | None | Assigned workstation views. |
| **`dashboard`** | Feature Tag | UI access tag for high-level business analytics. | None | View dashboard metrics. |
| **`orders`** | Feature Tag | UI access tag for managing live orders. | None | Orders screen. |
| **`menu`** | Feature Tag | UI access tag for editing menu catalog. | None | Menu catalog management. |
| **`kds`** | Feature Tag | UI access tag for KDS screens. | None | Kitchen display screens. |
| **`queue`** | Feature Tag | UI access tag for waitlist queue management. | None | Queue screen. |
| **`inventory`** | Feature Tag | UI access tag for stock and suppliers. | None | Inventory screen. |
| **`report`** | Feature Tag | UI access tag for downloading reports. | None | Reports screen. |
| **`survey`** | Feature Tag | UI access tag for surveys and feedback. | None | Feedback screen. |
| **`customer`** | Diner | Client ordering food. | None | Digital Menu only. |
| **`bot`** | Automation | Service account for integrations. | None | Automated ordering endpoints. |

### 3. Granular Permission Architecture

Each role automatically maps to a default set of CRUD boolean flags in `userPermission`:

```json
{
  "admin": { "create": true, "read": true, "update": true, "delete": true },
  "cashier": { "create": true, "read": true, "update": true, "delete": true },
  "captain": { "create": true, "read": true, "update": true, "delete": true },
  "waiter": { "create": true, "read": true, "update": true, "delete": true },
  "chef": { "create": true, "read": true, "update": true, "delete": true },
  "worker": { "create": true, "read": true, "update": true, "delete": true },
  "kds": { "create": true, "read": true, "update": true, "delete": true },
  "inventory": { "create": true, "read": true, "update": true, "delete": true },
  "menu": { "create": true, "read": true, "update": true, "delete": true },
  "orders": { "create": true, "read": true, "update": true, "delete": true },
  "queue": { "create": true, "read": true, "update": true, "delete": true },
  "report": { "create": true, "read": true, "update": true, "delete": true },
  "dashboard": { "create": true, "read": true, "update": true, "delete": true },
  "survey": { "create": true, "read": true, "update": true, "delete": true }
}
```

**Permission Synchronization Business Rules**:
1. **Adding a Role**: When a role tag is added to an employee's `userType`, default CRUD permissions for that role are merged into `userPermission`.
2. **Removing a Role**: When a role tag is removed from `userType`, the corresponding key in `userPermission` is pruned (`delete currentPermissions[key]`).
3. **Custom Overrides**: Administrators can selectively toggle individual flags (e.g. revoke `delete` on `menu` for a Junior Manager while keeping `create`, `read`, and `update` active).

---

## 6. Employee Lifecycle

```
                     ┌───────────────────────────────┐
                     │   Add / Onboard Employee      │
                     │  (Admin enters Clerk User ID  │
                     │     or invites via email)     │
                     └───────────────┬───────────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │      Active Membership        │
                     │  - userType assigned          │
                     │  - userPermission auto-synced │
                     │  - deletedAt is undefined     │
                     └───────────────┬───────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           │                                                   │
           ▼ (Role Modified)                                   ▼ (Remove Member or Strip All Roles)
┌─────────────────────────────┐                     ┌─────────────────────────────┐
│       Roles Updated         │                     │        Soft Deleted         │
│ - addType / removeType      │                     │ - deletedAt = Date.now()    │
│ - permissions re-synced     │                     │ - excluded from staff list  │
│ - sole admin guard enforced │                     │ - immediate access lockout  │
└─────────────────────────────┘                     └─────────────────────────────┘
```

### Lifecycle States Table

| State | Meaning | How Entered | Allowed Actions | Frontend Representation |
| :--- | :--- | :--- | :--- | :--- |
| **Active** | Employee has active access to store functions based on assigned roles. | Created via `organizationUsers.create` or owner provisioning. | Log in, perform POS actions, access modules permitted by roles. | Green "Active" badge. Normal row actions (Edit, Deactivate, Change Role). |
| **Role-Restricted** | Employee is active but restricted to specific modules. | Admin edits `userType` array or customizes `userPermission`. | Access only permitted screens. | Role badges (e.g. `[Cashier]`, `[KDS]`). |
| **Deactivated / Removed** | Employee membership is soft-deleted. Access to store is completely revoked. | Admin calls `organizationUsers.remove` or strips all roles via `removeType`. | **None**. Any attempt to access store returns 403 Forbidden. | Excluded from default list. If viewing archive: Gray "Deactivated" badge. |
| **Sole Admin Locked** | Protection state preventing store lockout. | Last remaining admin in store. | Full admin actions, but **cannot be deleted** and **cannot have admin role removed**. | Delete/Demote button disabled with tooltip: *"Sole Administrator"*. |

---

## 7. Employee CRUD Functionality

| Functionality | Supported? | Backend Operation | Arguments Required | Who Can Perform | Business Rules & Guards |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **List Employees** | **Yes** | `query organizationUsers.list` | `organizationId?`, `includeCustomers?` | Store Member (Staff/Admin) | Excludes customer-only and bot records by default. Sorted by creation. |
| **Get Employee Details** | **Yes** | `query organizationUsers.get` | `id: Id<"organizationUsers">` | Store Member | Returns role array and full permission JSON. |
| **Get Employee by User ID** | **Yes** | `query organizationUsers.getByUserId` | `userId: string` | Store Member | Resolves membership by Clerk User ID. |
| **Get Current Logged-in Staff** | **Yes** | `query organizationUsers.getCurrentMembership` | `organizationId?` | Authenticated User | Resolves caller's active role context (0ms lookup). Auto-recovers owner. |
| **Search Employees** | **Yes** | `query organizationUsers.search` | `userType?: string` | Store Member | Filters active staff by role tag. |
| **Add / Create Staff** | **Yes** | `mutation organizationUsers.create` | `userId: string`, `userType: string[]`, `userPermission?: any` | Store Admin | Enforces valid role tags, prevents duplicate memberships, syncs permissions. |
| **Update Staff Roles & Permissions** | **Yes** | `mutation organizationUsers.update` | `id`, `userType?: string[]`, `userPermission?: any` | Store Admin | Enforces Sole Admin Guard if stripping admin role. Re-syncs permissions. |
| **Add Role Tags** | **Yes** | `mutation organizationUsers.addType` | `id`, `types: string[]` | Store Admin | Merges role tags into existing array without overwriting other roles. |
| **Remove Role Tags** | **Yes** | `mutation organizationUsers.removeType` | `id`, `types: string[]` | Store Admin | Enforces Sole Admin Guard. If roles become empty, auto soft-deletes membership. |
| **Remove / Deactivate Employee** | **Yes** | `mutation organizationUsers.remove` | `id: Id<"organizationUsers">` | Store Admin | **Self-Removal Guard** ("Sorry, you can't remove yourself"). **Sole Admin Guard**. Sets `deletedAt`. |
| **Manage Floor Waiters (CRUD)** | **Yes** | `organizationWaiters.*` (`list`, `get`, `create`, `update`, `remove`, `search`) | `firstName`, `lastName`, `waiterCode` | Admin or Cashier | Independent CRUD for floor staff codes (e.g. `"W-01"`). Case-insensitive code uniqueness. |

---

## 8. Employee List Screen Requirements

### Screen Purpose
The main administrative hub for viewing, searching, filtering, and managing store staff members.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Settings > Employees                                                        [ + Add Employee ]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Search by name or email... ]   [ Filter by Role: All Roles ▼ ]   [ Status: Active ▼ ]          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Employee                 Role(s)             Permissions          Joined         Actions        │
│  ──────────────────────────────────────────────────────────────────────────────────────────────  │
│  [Avatar] Rahul Sharma    [Admin]             Full Access          12 Aug 2026   [Edit] [···]   │
│           rahul@spice.com                                                                        │
│                                                                                                  │
│  [Avatar] Priya Patel     [Cashier] [Orders]  Standard Cashier     18 Aug 2026   [Edit] [···]   │
│           priya@spice.com                                                                        │
│                                                                                                  │
│  [Avatar] Amit Verma      [Chef] [KDS]        KDS Operator         24 Aug 2026   [Edit] [···]   │
│           amit@spice.com                                                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Columns & Data Elements
* **Staff Member Identity**:
  * Profile Avatar (`imageUrl` or fallback initials avatar).
  * Full Name (`firstName + " " + lastName`).
  * Email address and/or Phone number.
* **Assigned Roles**:
  * Visual badges for each role in `userType` (e.g., `Admin` in purple, `Cashier` in blue, `Chef` in amber, `Waiter` in green).
* **Granular Permissions Summary**:
  * Indicator tag (e.g., "Full Access", "Standard Cashier", "Customized (4 Modules)").
* **Joined Date**:
  * Formatted date string (e.g. `"Aug 12, 2026"` from `createdAt`).
* **Status**:
  * "Active" badge (green dot) or "Inactive" (gray dot).
* **Actions Menu (`···`)**:
  * Edit Roles & Permissions.
  * Deactivate / Remove Employee.
  * (Disabled for Self or Sole Admin with explanatory tooltip).

### 2. Search & Filtering Capabilities
* **Client / UI Search**: Search staff by name, email, or phone number.
* **Role Filter**: Multi-select dropdown filtering by role tag (`Admin`, `Cashier`, `Captain`, `Waiter`, `Chef`, `KDS`, `Inventory`, etc.).
* **Status Filter**: Toggle between "Active Staff" (default) and "Deactivated Staff".

---

## 9. Add / Invite Employee Screen & Modal

### Modal / Form Layout

| Field | Required? | Input Type | Validation Rules | Example Input | Backend Handling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Clerk User ID / Email** | **Yes** | Text / Email input | Valid Clerk User ID (`"user_..."`) or valid email address. | `user_2pabc123` or `staff@restaurant.com` | Passed to `organizationUsers.create` as `userId`. |
| **Staff Roles (`userType`)** | **Yes** | Multi-select badge picker | At least 1 valid role tag from `VALID_USER_TYPES` must be selected. | `["cashier", "kds"]` | Validated via `validateAndNormalizeUserTypes()`. |
| **Custom Permissions** | Optional | Collapsible accordion with CRUD toggles | Valid JSON object mapping role keys to boolean flags. | `{ cashier: { create: true, read: true, update: true, delete: false } }` | Merged with `DEFAULT_PERMISSIONS` via `syncPermissions()`. |

### Edge Case Handling:
1. **Duplicate User**: If the user is already an active member of this store, the backend throws `"User <userId> is already a member of <OrgName>"`. The frontend should show an inline error: *"This user is already an active employee. You can edit their roles from the employee list."*
2. **Empty Roles**: If no role is selected, the frontend blocks submission with *"Please select at least one role for this employee."*
3. **Invalid Role Tag**: Backend rejects unknown role strings with `"Invalid user type: <type>"`.

---

## 10. Employee Details & Edit Screen

### 1. Information Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Employees                                                                             │
│                                                                                                  │
│  [Avatar]  Rahul Sharma                                      Status: [ Active ● ]                │
│            rahul@restaurant.com • +91 98765 43210            Joined: 12 Aug 2026                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Roles & Access Tags                                                                             │
│  [x] Admin     [x] Orders     [ ] Cashier     [ ] KDS     [ ] Inventory     [ ] Menu             │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Granular Permissions (Overrides)                                                                │
│  ▼ Orders Module                                                                                 │
│    [x] Create Orders    [x] View Orders    [x] Update Orders    [ ] Void / Delete Orders         │
│  ▼ Menu Module                                                                                   │
│    [ ] Create Items     [x] View Items     [ ] Edit Prices      [ ] Delete Items                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Danger Zone                                                                                     │
│  [ Deactivate Employee ]  (Revokes store access immediately)                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Field Classification

| Section | Display-Only Fields | Editable Fields | Available Actions |
| :--- | :--- | :--- | :--- |
| **Identity Header** | Clerk User ID, Profile Picture, Registered Email, Phone Number, Joined Date | None (managed in Clerk Profile) | Open Clerk profile link. |
| **Role Assignment** | None | `userType` (Multi-select check buttons) | Add or remove role tags. |
| **Permissions** | Default permission templates | CRUD toggles `{ create, read, update, delete }` per assigned module | Reset to Role Defaults, Save Custom Permissions. |
| **Membership Lifecycle** | Soft-delete timestamp (`deletedAt`) | Status toggle | **Deactivate Employee**, **Reactivate Employee**. |

---

## 11. Employee Actions Matrix

| Action | Supported? | Who Can Perform | Backend Mutation | Preconditions | Result / Side Effect |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Add Role** | **Yes** | Store Admin | `organizationUsers.addType` | Target member is active. | Appends new role tags, merges default CRUD permissions. |
| **Remove Role** | **Yes** | Store Admin | `organizationUsers.removeType` | Target member is active. | Removes role tag, prunes permissions. If role array is empty, soft-deletes record. |
| **Sole Admin Demotion Block** | **Yes** | Enforced | `organizationUsers.removeType` | Admin count === 1. | **Rejected** with error: `"Cannot remove the sole admin of the organization."` |
| **Deactivate Member** | **Yes** | Store Admin | `organizationUsers.remove` | Target member is active. | Sets `deletedAt = Date.now()`. User is immediately locked out of POS store. |
| **Self-Deactivation Block** | **Yes** | Enforced | `organizationUsers.remove` | `member.userId === caller.subject` | **Rejected** with error: `"Sorry, you can't remove yourself"`. |
| **Create Floor Waiter** | **Yes** | Admin / Cashier | `organizationWaiters.create` | Unique `waiterCode`. | Adds floor waiter profile for order attribution. |
| **Edit Floor Waiter** | **Yes** | Admin / Cashier | `organizationWaiters.update` | Valid waiter ID. | Updates name or waiter code. |
| **Delete Floor Waiter** | **Yes** | Admin / Cashier | `organizationWaiters.remove` | Valid waiter ID. | Sets `deletedAt`. Retains historical order attribution via `getWithDeleted`. |

---

## 12. Validation & Error Handling

### 1. Error Categories & User-Facing Messages

| Error Category | Backend Error Message | Frontend Handling & UI Feedback |
| :--- | :--- | :--- |
| **Self-Removal** | `"Sorry, you can't remove yourself"` | Show warning toast: *"You cannot remove your own account from the organization."* (Delete button should also be disabled in UI). |
| **Sole Admin Protection** | `"Cannot remove the sole admin of the organization."` | Show error dialog: *"This store must have at least one administrator. Assign the Admin role to another staff member before removing this admin."* |
| **Duplicate Membership** | `"User <userId> is already a member of <OrgName>."` | Inline form error: *"This user is already a member of this restaurant store."* |
| **Unauthenticated** | `"Unauthenticated. Please provide a valid authentication token."` | Redirect user to `/sign-in` or refresh Clerk JWT session. |
| **Forbidden (Non-Member)** | `"Forbidden. Active store membership required."` | Redirect to store selection / access denied screen. |
| **Forbidden (Non-Admin)** | `"Forbidden. Admin access required."` | Hide administrative controls; show toast: *"You do not have permission to manage employees."* |
| **Empty Role Selection** | `"User types cannot be empty"` | Form validation alert: *"Please select at least one role."* |
| **Invalid Role String** | `"Invalid user type: <type>"` | Disallow unrecognized tags in UI dropdown. |
| **Duplicate Waiter Code** | `"Hey! <waiterCode> is already taken."` | Inline input error on Waiter Code field: *"This waiter code is already assigned to another staff member."* |

---

## 13. Authorization & Security Architecture

### 1. Store-Level Isolation
```
Incoming Mutation / Query (Convex pos-default)
              │
              ▼
    ctx.auth.getUserIdentity() ───► Is Null? ──► Throw 401 Unauthenticated
              │
              ▼ (identity.subject = Clerk User ID)
Query `organizationUsers` table
where userId == identity.subject AND deletedAt == null
              │
              ▼ Found?
    ┌─────────┴─────────┐
   YES                  NO ──► Is Store Owner (org.ownerClerkId == identity.subject)?
    │                           ├── YES ──► Auto-bootstrap Owner Admin Record
    │                           └── NO  ──► Throw 403 Forbidden ("Active store membership required")
    ▼
Check `userType` array & `userPermission`
    │
    ▼ Has 'admin' or required role?
┌───┴───┐
YES     NO ──► Throw 403 Forbidden ("Admin access required")
│
▼
Execute Operation Logic
```

### 2. Security Invariants:
* **Zero Client Impersonation**: Role arrays and permissions are never accepted from client tokens or client identity parameters. The server resolves caller identity strictly via `ctx.auth.getUserIdentity()`.
* **Database Boundary Isolation**: Tenant queries only scan records in the dedicated store database (`organizationId` linkage).
* **Owner Auto-Repair / Seeding**: If the store creator accesses an unseeded store, the backend automatically boots their `organizationUsers` record with `userType: ["admin"]`.

---

## 14. Authentication vs Organization User

| Feature / Responsibility | Clerk Identity Platform | Store Convex Database (`organizationUsers`) |
| :--- | :--- | :--- |
| **User Authentication** | **Primary Owner** (Passkeys, OTP, Passwords, OAuth) | Validates JWT issuer and `identity.subject` |
| **User Profile Metadata** | **Primary Owner** (`firstName`, `lastName`, `email`, `phone`, `imageUrl`) | Does not store redundant profile copies |
| **Session & Token Management** | **Primary Owner** (JWT token signing & expiration) | Consumes signed JWT token |
| **Store Access Authorization** | None (Clerk does not control local POS permissions) | **Primary Owner** (Validates active membership in store database) |
| **Store Roles (`userType`)** | None | **Primary Owner** (`["admin", "cashier", "kds", ...]`) |
| **Granular Permissions (`userPermission`)** | None | **Primary Owner** (`{ cashier: { create: true, ... } }`) |
| **Floor Waiter Codes** | None | **Primary Owner** (`organizationWaiters` table) |

---

## 15. Related Employee Functionality Across POS Domains

| POS Domain | Employee Dependency | Backend Implementation in `pos-default` | Frontend Impact / Usage |
| :--- | :--- | :--- | :--- |
| **Orders & Invoicing** | Order creator, Cashier attribution, Floor Waiter attribution | `orders` table has `cashierUserId: v.optional(v.string())`, `waiterUserId: v.optional(v.string())`. | Orders table displays which cashier billed the order and which waiter took the table order. |
| **Table Management** | Waiter assignment to tables | `organizationTables` and `orders` track table-to-waiter linkage. | Captain assigns active waiter to table; POS filters orders by waiter. |
| **Floor Waiters** | Fast waiter selection on POS register | Dedicated `organizationWaiters` domain table and queries (`organizationWaiters.list`). | POS Order Header includes quick waiter picker dropdown. |
| **Kitchen Display (KDS)** | KDS station authorization | `requireMember` with `"chef"`, `"kds"`, or `"admin"` role checks. | Chef sees live tickets for their assigned preparation station. |
| **Printers & KOT Routing** | Printer management authorization | `requireAdminOrCashier` in `organizationPrinters.ts`. | Cashier/Admin configures kitchen ticket routing. |
| **Order Processes** | Workflow stage transition authorization | `requireAdminOrCashier` in `organizationOrderProcesses.ts`. | Staff advances order from "Pending" → "Preparing" → "Ready" → "Served". |
| **Queue Management** | Waitlist queue operator | `requireAdminOrCashier` in `organizationQueues.ts`. | Host/Captain adds guests to queue and assigns tables. |

---

## 16. Legacy Rails → Convex Migration Status

| Capability | Legacy Rails (`defx-pos`) | Current Convex (`pos-default`) | Status | Implementation Gap / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Join Model** | `organization_users` (UUID join table) | `organizationUsers` table (Convex) | ✅ Fully Implemented | Indexed by `userId`, `organizationId`, `by_user_and_org`. |
| **Multi-Role Array** | `user_type: varchar[]` | `userType: v.array(v.string())` | ✅ Fully Implemented | Complete support for multiple simultaneous roles. |
| **Permission Sync** | `before_save :update_permissions` | `syncPermissions()` helper in mutation | ✅ Fully Implemented | Automatic injection of defaults and pruning on role changes. |
| **Self-Removal Guard** | `@current_user.id == @user.id` check | `member.userId === identity.subject` check | ✅ Fully Implemented | Throws `"Sorry, you can't remove yourself"`. |
| **Sole Admin Guard** | Not strictly enforced in Rails V1 | `countActiveAdmins(ctx, orgId) <= 1` guard | ✅ Fully Implemented | Blocks last admin removal/demotion. |
| **Soft Deletion** | `acts_as_paranoid` (`deleted_at`) | `deletedAt: v.optional(v.number())` | ✅ Fully Implemented | Filtered out in active queries; preserves data integrity. |
| **Floor Waiters** | `organization_waiters` (PostgreSQL) | `organizationWaiters` table (Convex) | ✅ Fully Implemented | Complete CRUD and case-insensitive code uniqueness. |
| **Auth System** | Custom SMS OTP / Devise JWT | Clerk Identity Platform | ✅ Fully Implemented | Seamless JWT verification via `auth.config.ts`. |
| **Employee List Query** | `GET /api/v1/users/organization_employee_users` | `query organizationUsers.list` | ✅ Fully Implemented | Excludes customer/bot records by default. |
| **Staff Profile Resolution** | User fields stored in PostgreSQL `users` table | User profiles stored in Clerk | 🟡 Needs Frontend Integration | Frontend combines `organizationUsers.list` with Clerk user profiles. |
| **Email/SMS Invitation Flow** | Direct account creation via Phone OTP | Direct User ID binding in Convex | 🟡 Enhancement Opportunity | Frontend can integrate Clerk Invitations API for new staff emails. |

---

## 17. Frontend Screen Specification

### 1. Screen Map
```
Settings
└── Employees & Staff
    ├── Tab 1: Store Employees (`organizationUsers`)
    │   ├── Employee List Table
    │   ├── Add Employee Dialog / Modal
    │   └── Edit Employee Sheet / Drawer
    └── Tab 2: Floor Waiters (`organizationWaiters`)
        ├── Waiters List Table
        ├── Add Waiter Modal
        └── Edit Waiter Modal
```

---

### Screen 1: Store Employees List (`Settings > Employees`)

* **Purpose**: View, search, and manage all registered store staff members.
* **Backend Query**: `useQuery(api.organizationUsers.list, {})`
* **Permission Required**: Any active store staff member (`requireMember`). Administrative actions (`Add`, `Edit`, `Delete`) require `admin` role.
* **UI Components**:
  * Page Header: Title ("Employees"), Subtitle ("Manage store staff, roles, and permissions"), Primary Button `[ + Add Employee ]`.
  * Filter Bar:
    * Search input: Name / Email filter.
    * Role dropdown: `All Roles`, `Admin`, `Cashier`, `Captain`, `Waiter`, `Chef`, etc.
  * Staff Table:
    * Columns: `Employee` (Avatar + Full Name + Email), `Roles` (Badges), `Permissions` (Summary), `Joined` (Date), `Actions` (`Edit`, `···`).
* **States**:
  * **Loading**: Render 4 skeleton table rows.
  * **Empty State**: Icon + *"No employees found"*. Button: `[ Add First Employee ]`.
  * **Error State**: Banner displaying error message with `[ Retry ]` button.

---

### Screen 2: Add Employee Dialog

* **Purpose**: Onboard a new staff member into the store organization.
* **Backend Mutation**: `useMutation(api.organizationUsers.create)`
* **Inputs**:
  * `User Identifier`: Text input (Clerk User ID or Email).
  * `Roles`: Multi-select pill selector (`Admin`, `Cashier`, `Captain`, `Waiter`, `Chef`, `KDS`, `Inventory`, `Menu`, `Reports`).
  * `Custom Permissions` (Optional Collapsible): Checkbox matrix for `Create`, `Read`, `Update`, `Delete` across modules.
* **Validation**:
  * User ID / Email must not be empty.
  * At least one role must be selected.
* **Success Action**: Close dialog, show success toast (*"Employee added successfully"*), table auto-updates via Convex reactivity.

---

### Screen 3: Edit Employee Sheet / Drawer

* **Purpose**: Modify an existing employee's roles or fine-tune their module permissions.
* **Backend Query / Mutation**: `useQuery(api.organizationUsers.get, { id })` & `useMutation(api.organizationUsers.update)`
* **Inputs**:
  * Display-only Header: Employee profile details from Clerk.
  * Role Multi-select: Checkboxes for valid roles.
  * Permissions Accordion: Granular CRUD checkboxes for each assigned role.
* **Guards & Warnings**:
  * If editing the **Sole Admin**, the `Admin` role checkbox is locked/disabled with tooltip: *"Cannot remove the sole admin of the organization."*
* **Danger Zone**:
  * `[ Deactivate Employee ]` button: Triggers confirmation modal.
  * If user is viewing their own profile: Deactivate button is disabled with tooltip: *"You cannot deactivate your own account."*

---

### Screen 4: Floor Waiters Management (`Settings > Employees > Waiters Tab`)

* **Purpose**: Manage floor staff codes for quick POS order attribution without requiring personal user accounts.
* **Backend Query / Mutations**:
  * `useQuery(api.organizationWaiters.list)`
  * `useMutation(api.organizationWaiters.create)`
  * `useMutation(api.organizationWaiters.update)`
  * `useMutation(api.organizationWaiters.remove)`
* **Inputs**:
  * First Name (`firstName`).
  * Last Name (`lastName`).
  * Waiter Code (`waiterCode`, e.g., `"W-01"`, `"W-02"`).
* **Table Columns**:
  * `Waiter Name`: Full Name.
  * `Waiter Code`: Code Badge (e.g. `[ W-01 ]`).
  * `Created`: Date.
  * `Actions`: `[ Edit ]`, `[ Delete ]`.

---

## 18. Recommended User Flows

### Flow 1: Add New Store Employee
```
Admin opens Settings > Employees
        │
        ▼
Clicks "[ + Add Employee ]"
        │
        ▼
Modal opens: Enters Clerk User ID/Email & selects Roles (e.g. ["cashier", "orders"])
        │
        ▼
Clicks "Save Employee"
        │
        ▼
Frontend calls `api.organizationUsers.create`
        │
        ├── Backend validates uniqueness & normalizes roles
        ├── Backend injects default CRUD permissions
        └── Backend inserts record into `organizationUsers` table
        │
        ▼
Modal closes; Success toast displayed; Employee instantly appears in table
```

### Flow 2: Deactivate Employee (with Self & Sole Admin Guards)
```
Admin clicks "···" on Employee row > Selects "Deactivate Employee"
        │
        ▼
Frontend checks:
  ├── Is target user the caller themselves? ──► Disable / Block ("Cannot remove yourself")
  └── Is target user the sole admin?        ──► Disable / Block ("Cannot remove sole admin")
        │
        ▼ (Confirmation Dialog)
Admin confirms: "Are you sure you want to revoke store access for Amit Verma?"
        │
        ▼
Frontend calls `api.organizationUsers.remove({ id })`
        │
        ▼
Backend sets `deletedAt = Date.now()`; Reactivity immediately removes row from active list
```

---

## 19. Backend API / Convex Contract

### Queries

| Function | Type | Arguments | Return Value | Auth Required | Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `organizationUsers:getCurrentMembership` | `query` | `organizationId?: Id<"organizations">` | `Doc<"organizationUsers"> \| null` | Yes | Active Member / Owner |
| `organizationUsers:list` | `query` | `organizationId?: Id<"organizations">`, `includeCustomers?: boolean` | `Array<Doc<"organizationUsers">>` | Yes | Active Store Member |
| `organizationUsers:get` | `query` | `id: Id<"organizationUsers">` | `Doc<"organizationUsers"> \| null` | Yes | Active Store Member |
| `organizationUsers:getByUserId` | `query` | `userId: string`, `organizationId?: Id<"organizations">` | `Doc<"organizationUsers"> \| null` | Yes | Active Store Member |
| `organizationUsers:search` | `query` | `userType?: string`, `organizationId?: Id<"organizations">` | `Array<Doc<"organizationUsers">>` | Yes | Active Store Member |
| `organizationWaiters:list` | `query` | `{}` | `Array<{ _id, firstName, lastName, waiterCode, createdAt, updatedAt }>` | Yes | Active Store Member |
| `organizationWaiters:get` | `query` | `id: Id<"organizationWaiters">` | `WaiterResponse \| null` | Yes | Active Store Member |
| `organizationWaiters:search` | `query` | `name?: string`, `firstName?: string`, `lastName?: string`, `waiterCode?: string` | `Array<WaiterResponse>` | Yes | Active Store Member |

---

### Mutations

| Function | Type | Arguments | Return Value | Auth Required | Permissions | Errors Handled |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `organizationUsers:create` | `mutation` | `organizationId?`, `userId: string`, `userType: string[]`, `userPermission?: any` | `Id<"organizationUsers">` | Yes | Store Admin | `User already member`, `Empty userType`, `Invalid userType` |
| `organizationUsers:update` | `mutation` | `id: Id<"organizationUsers">`, `userType?: string[]`, `userPermission?: any` | `{ success: boolean }` | Yes | Store Admin | `Sole admin protection`, `Invalid userType` |
| `organizationUsers:addType` | `mutation` | `id: Id<"organizationUsers">`, `types: string[]` | `{ success: boolean, userType: string[] }` | Yes | Store Admin | `Invalid userType` |
| `organizationUsers:removeType` | `mutation` | `id: Id<"organizationUsers">`, `types: string[]` | `{ success: boolean, deleted: boolean, userType: string[] }` | Yes | Store Admin | `Sole admin protection` |
| `organizationUsers:remove` | `mutation` | `id: Id<"organizationUsers">` | `{ success: boolean }` | Yes | Store Admin | `Self-removal guard`, `Sole admin protection` |
| `organizationWaiters:create` | `mutation` | `firstName?`, `lastName?`, `waiterCode?`, `legacyId?` | `WaiterResponse` | Yes | Admin or Cashier | `Duplicate waiterCode` |
| `organizationWaiters:update` | `mutation` | `id: Id<"organizationWaiters">`, `firstName?`, `lastName?`, `waiterCode?` | `WaiterResponse` | Yes | Admin or Cashier | `Duplicate waiterCode`, `Not found` |
| `organizationWaiters:remove` | `mutation` | `id: Id<"organizationWaiters">` | `{ success: boolean }` | Yes | Admin or Cashier | `Not found` |

---

## 20. Backend Gaps & Recommendations for Product Management

| Requirement | Current Support | Backend Work Needed | Priority | Product / Design Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Clerk Profile Enrichment** | Identity data lives in Clerk; `organizationUsers` only has `userId`. | None strictly required if frontend queries Clerk directly; optional Convex profile cache helper. | **P1 (High)** | In Frontend, use Clerk's user lookup or pass email/name when listing staff, or display user ID / Clerk avatar component (`<UserAvatar userId={...} />`). |
| **Email Invitation Flow** | `organizationUsers.create` expects an existing Clerk User ID. | Add an action wrapping Clerk Backend SDK (`clerkClient.organizations.createInvitation` or `clerkClient.users.createUser`). | **P2 (Medium)** | Allows an admin to invite staff by entering an email address even if they haven't registered on Clerk yet. |
| **Floor Waiter Management UI** | Complete backend support in `organizationWaiters.ts`. | **None (Backend is 100% complete)**. | **P1 (High)** | Build the frontend Waiters tab under Settings > Employees. |
| **Activity / Audit Log** | Convex tracks `createdAt` and `updatedAt`. | Dedicated `auditLogs` table for logging employee role modifications. | **P3 (Low)** | Optional future enhancement for enterprise compliance. |

---

## 21. Open Questions / Design Decisions for Product Team

1. **Staff Onboarding Model**: Should admins add staff by entering an existing Clerk User ID / Phone number, or should the frontend send an email invitation via Clerk's invitation service?
   * *Recommendation*: Support both: direct Clerk User ID binding for instant access, plus Clerk Email Invitation for new employees.
2. **Floor Waiter vs User Waiter**:
   * For table ordering on POS, the system supports both `organizationWaiters` (PIN/code-based) and full `organizationUsers` with `userType: ["waiter"]`. The frontend POS table screen should allow selecting either.
3. **Multi-Role UX**:
   * Since `userType` is an array, the role selector must be a multi-select badge picker, allowing employees to hold complementary roles (e.g. `["cashier", "kds", "inventory"]`).

---

**End of Specification**
