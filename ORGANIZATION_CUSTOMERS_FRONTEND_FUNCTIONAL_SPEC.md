# Organization Customers (CRM & Directory) Frontend Functional Specification

## 1. Executive Summary & Architectural Overview

The **Customers Subsystem** in `pos-default` serves as the centralized Customer Relationship Management (CRM), guest directory, address book, and guest profile registry across all restaurant sales channels. It bridges in-store dine-in patrons, captain table orders, telephone delivery/takeaway orders, and online storefront checkout (`pos-user`) into a unified, high-performance customer identity layer.

### 1.1 Channel Unification Model
Regardless of where an interaction originates, customer records are unified around their normalized phone number:

```
                                +────────────────────────────────────────+
                                │       Omnichannel Customer Identity    │
                                │   (Unique Index: customers.by_phone)   │
                                +────────────────────────────────────────+
                                                    ▲
        ┌───────────────────┬───────────────────────┼───────────────────────┬───────────────────┐
        │                   │                       │                       │                   │
  ┌───────────┐       ┌───────────┐           ┌───────────┐           ┌───────────┐       ┌───────────┐
  │ Cashier   │       │ Captain   │           │ Web Store │           │ QR Dine-In│           │ Table     │
  │ POS       │       │ App       │           │ (pos-user)│           │ Self-Order│           │ Queue     │
  │ Terminal  │       │ Order     │           │ Delivery  │           │ Web App   │           │ Host Stand│
  └───────────┘       └───────────┘           └───────────┘           └───────────┘           └───────────┘
```

### 1.2 Multi-Role Staff Access Matrix

| Staff Role | View Customers (`/customers`) | Add / Edit Customer | View Order History | Manage Address Book | Delete Customer | POS Quick-Lookup |
|---|---|---|---|---|---|---|
| **Admin / Store Owner** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ✅ Full Access | ✅ Soft Delete | ✅ Full Access |
| **Cashier** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ✅ Full Access | ❌ Forbidden | ✅ Full Access |
| **Captain** | 👁️ View & Lookup | ✅ Add / Edit Name | 👁️ Recent Orders | 👁️ View Only | ❌ Forbidden | ✅ Table Tagging |
| **Waiter** | 👁️ Lookup Only | ❌ Read Only | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden | 👁️ Read Only |

---

## 2. Core Navigation & Screen Hierarchy

The Customers domain is accessible directly from the main POS sidebar navigation at `/customers` as well as embedded as a slide-over drawer / modal across the cashier terminal:

```
+───────────────────────────────────────────────────────────────────────────────────────────+
│  👥 Customers Navigation Hierarchy                                                        │
+───────────────────────────────────────────────────────────────────────────────────────────+
│    ├── 📋 1. Customer Directory (`/customers`)                                             │
│    │     ├── 🔍 Live Real-time Omnisearch (Name, Phone, Email, Legacy ID)                 │
│    │     ├── 📊 CRM KPI Summary Cards (Total Guests, AOV, Active Cohorts, Repeat Rate)     │
│    │     └── 🏷️ Filter Tabs (All, VIP/Frequent Diners, Delivery Profiles, New This Month)  │
│    │                                                                                       │
│    ├── 👤 2. Customer 360° Profile Page / Drawer (`/customers/[id]`)                       │
│    │     ├── 📌 Lifetime Metrics Header (Total Spend, Visit Count, AOV, Last Visit Date)   │
│    │     ├── 🧾 Tab 1: Chronological Order History Timeline & Chit Modal Viewer           │
│    │     ├── 📍 Tab 2: Saved Delivery Address Book & Geolocation Pins                      │
│    │     ├── 💳 Tab 3: Gateway Profile (Razorpay Customer ID & Payment Habits)             │
│    │     └── 🥗 Tab 4: Dietary Notes, Allergies & Special VIP Preferences                  │
│    │                                                                                       │
│    ├── ⚡ 3. POS Cashier Quick-Lookup & On-the-Fly Enrollment (`/cashier`)                 │
│    │     ├── 📞 Speed-Dial Phone Search Bar with Typeahead Autocomplete                    │
│    │     ├── ➕ Idempotent `getOrCreateCustomer` Inline Punch-in                           │
│    │     └── 🛵 1-Click Delivery Address Selection for Telephone Phone Orders              │
│    │                                                                                       │
│    └── ✏️ 4. Customer Form Modals                                                          │
│          ├── 📝 Create / Edit Customer Profile Modal                                       │
│          └── 🏠 Create / Edit User Address Modal with Geocoder Coordinates                 │
+───────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 3. Data Model & Schema Specifications

The Customers module is backed by two primary domain tables in Convex (`customers` and `userAddresses`) and indexed in relationship with `orders`:

### 3.1 Table: `customers`

| Field | Type | Required | Description | Constraints & Indexing |
|---|---|---|---|---|
| `_id` | `Id<"customers">` | Yes | Unique Convex document identifier. | Primary Key. |
| `legacyId` | `string` | Optional | Rails PostgreSQL legacy `users.id` migration key. | `.index("by_legacy_id", ["legacyId"])` |
| `firstName` | `string` | Optional | Customer first name. | Trimmed string (e.g. `"Aarav"`). |
| `lastName` | `string` | Optional | Customer last name / surname. | Trimmed string (e.g. `"Kapoor"`). |
| `phone` | `string` | Yes | Normalized digits-only phone number. | `.index("by_phone", ["phone"])` (Unique among active records). |
| `countryCode` | `string` | Optional | International dialing prefix (Default: `"+91"`). | Formatted with leading `+` or digit code. |
| `email` | `string` | Optional | Customer email address. | `.index("by_email", ["email"])` (Lowercased & validated format). |
| `razorpayCustomerId` | `string` | Optional | Razorpay payment customer vault reference. | e.g. `"cust_K93js8dks92"`. |
| `avatarStorageId` | `Id<"_storage">` | Optional | Convex file storage ID for guest photo avatar. | Optional binary asset. |
| `avatarAssetId` | `Id<"organization_assets">`| Optional | Organization media library asset ID. | Optional relational link. |
| `createdAt` | `number` | Yes | Epoch timestamp of account creation. | Immutable timestamp. |
| `updatedAt` | `number` | Yes | Epoch timestamp of last update. | Updated on all profile edits. |
| `deletedAt` | `number` | Optional | Epoch timestamp for soft deletion. | Active customer when `undefined`. |

### 3.2 Table: `userAddresses`

| Field | Type | Required | Description | Constraints & Indexing |
|---|---|---|---|---|
| `_id` | `Id<"userAddresses">` | Yes | Unique Convex document identifier. | Primary Key. |
| `legacyId` | `string` | Optional | Rails PostgreSQL legacy `user_addresses.id`. | `.index("by_legacy_id", ["legacyId"])` |
| `customerId` | `Id<"customers">` | Yes | Foreign key to parent customer. | `.index("by_customer", ["customerId"])` |
| `addressLine1` | `string` | Yes | Building, flat/house number, street name. | Required non-blank string. |
| `addressLine2` | `string` | Optional | Sub-locality, sector, or apartment name. | Optional secondary line. |
| `landmark` | `string` | Optional | Nearby prominent landmark (e.g. `"Near Metro Pillar 42"`). | Pre-pended with "Near" in formatted string. |
| `city` | `string` | Yes | City / Municipality (e.g. `"Mumbai"`). | Required non-blank string. |
| `zipCode` | `string` | Yes | Postal PIN code (e.g. `"400001"`). | Required non-blank string. |
| `otherLocationDetail`| `string` | Optional | Floor, wing, elevator instructions. | e.g. `"4th Floor, Flat 402, Ring Bell Twice"`. |
| `addressType` | `string` | Yes | Address classification category. | `"Home"`, `"Work"`, `"Other"`. |
| `latitude` | `number` | Optional | GPS latitude decimal. | Used for distance calculation & map routing. |
| `longitude` | `number` | Optional | GPS longitude decimal. | Used for distance calculation & map routing. |
| `completeAddress` | `string` | Optional | Consolidated single-line formatted address. | Auto-generated if not explicitly provided. |
| `deliveryInstructions`| `string` | Optional | Persistent courier instructions. | e.g. `"Leave at security gate with OTP"`. |
| `isDefault` | `boolean` | Optional | Primary default shipping address flag. | Exactly one default address per customer. |
| `createdAt` | `number` | Yes | Epoch creation timestamp. | Immutable. |
| `updatedAt` | `number` | Yes | Epoch last modification timestamp. | Maintained on patch operations. |
| `deletedAt` | `number` | Optional | Epoch soft deletion timestamp. | Active address when `undefined`. |

### 3.3 Linkage with `orders` Table

```typescript
// orders table customer & delivery linkage fields
{
  customerId: v.optional(v.id("customers")),
  customerName: v.optional(v.string()),
  customerPhone: v.optional(v.string()),
  customerEmail: v.optional(v.string()),
  userAddressId: v.optional(v.id("userAddresses")),
  deliveryAddress: v.optional(
    v.object({
      addressLine1: v.string(),
      addressLine2: v.optional(v.string()),
      landmark: v.optional(v.string()),
      city: v.optional(v.string()),
      zipCode: v.optional(v.string()),
      addressType: v.optional(v.string()),
    })
  )
}
```

---

## 4. Screen 1: Customer Directory (`/customers`)

### 4.1 UI Layout & KPI Header

```
+-----------------------------------------------------------------------------------------------------------------------+
|  👥 Customer Management                                                          [ 📥 Export CSV ]  [ ➕ Add Customer ] |
|  Manage guest directory, lifetime order history, delivery addresses, and CRM dining preferences.                     |
+-----------------------------------------------------------------------------------------------------------------------+
|  📊 TOTAL CUSTOMERS      |  ⭐ ACTIVE THIS MONTH    |  💰 AVG LIFETIME SPEND    |  🛵 TOP ORDER TYPE                  |
|     12,450 Guests        |     1,840 Returning       |     ₹ 1,420.00 / guest    |     Dine-In (64%)                   |
+-----------------------------------------------------------------------------------------------------------------------+
|  [ 🔍 Search by Name, Phone, Email, or Legacy ID...                                   ] [ Filter: All Customers  ▼ ]  |
+-----------------------------------------------------------------------------------------------------------------------+
|  NAME & AVATAR      | PHONE NUMBER       | EMAIL               | ORDERS | TOTAL SPENT | LAST VISIT    | ACTIONS       |
+---------------------+--------------------+---------------------+--------+-------------+---------------+---------------+
| 🟢 Aarav Kapoor     | +91 98765 43210    | aarav@example.com   | 18     | ₹ 24,500    | Yesterday     | [👁️] [✏️] [🗑️] |
| 🔵 Priya Sharma     | +91 91234 56789    | priya.s@gmail.com   | 4      | ₹ 3,890     | 3 days ago    | [👁️] [✏️] [🗑️] |
| 🟠 Vikram Singh     | +91 99887 76655    | -                   | 1      | ₹ 850       | 12 Sep 2026   | [👁️] [✏️] [🗑️] |
| ⚪ Walk-in Guest    | +91 98111 00000    | -                   | 2      | ₹ 1,200     | 04 Aug 2026   | [👁️] [✏️] [🗑️] |
+-----------------------------------------------------------------------------------------------------------------------+
| Showing 1 - 25 of 12,450 customers                                                [ First ] [ < Prev ] [ 1 ] 2 3 [ Next > ]|
+-----------------------------------------------------------------------------------------------------------------------+
```

### 4.2 Interactive Functionality & Search Logic
1. **Real-time Live Reactive Search (`customers.searchCustomers`)**:
   - Queries Convex reactively as the user types (debounced at 250ms).
   - Phone search cleans user inputs (ignoring dashes, spaces, parentheses, leading `+91`) and performs fast index lookups on `by_phone`.
   - Supports multi-attribute matching across `firstName`, `lastName`, `email`, `phone`, and `legacyId`.
2. **Dynamic Cohort Filters**:
   - **All Customers**: Complete master active database (`deletedAt === undefined`).
   - **VIP / High Spenders**: Guests with $\ge 10$ orders or total spend $\ge ₹ 10,000$.
   - **Delivery Customers**: Guests with at least 1 saved delivery address.
   - **New Guests (Last 30 Days)**: Registered within the current calendar month.
3. **Table Column Capabilities**:
   - **Name & Avatar**: Colored avatar badge generated from initials with full name.
   - **Phone**: Click-to-call / WhatsApp trigger button (opens WhatsApp Web for instant communication).
   - **Orders Count & Lifetime Spend**: Derived reactively from `orders.by_customer`.
   - **Actions**:
     - 👁️ **View Profile**: Opens Customer 360° Profile Drawer / Page.
     - ✏️ **Edit**: Opens profile editor modal.
     - 🗑️ **Delete**: Triggers soft-delete confirmation modal (`customers.deleteCustomer`).

---

## 5. Screen 2: Customer 360° Profile & CRM Drawer (`/customers/[id]`)

### 5.1 Profile Header & KPI Summary Cards

```
+-----------------------------------------------------------------------------------------------------------------------+
|  < Back to Customers   |  CUSTOMER PROFILE #CUST-982341                                      [ ✏️ Edit ] [ 🗑️ Delete ]  |
+-----------------------------------------------------------------------------------------------------------------------+
|  [ 👤 ]  Aarav Kapoor                              Tier: ⭐ VIP Gold Member (Top 5% Spender)                           |
|          📞 +91 98765 43210   |   ✉️ aarav.kapoor@example.com   |   📅 Customer Since: 14 Feb 2025                       |
+-----------------------------------------------------------------------------------------------------------------------+
|  💰 TOTAL REVENUE        |  🔢 TOTAL VISITS        |  📈 AVERAGE ORDER VALUE  |  🕒 LAST SEEN                          |
|     ₹ 24,500.00          |     18 Orders           |     ₹ 1,361.11 / order   |     Yesterday at 8:45 PM (Table T-04)  |
+-----------------------------------------------------------------------------------------------------------------------+
|  [ 🧾 Order History (18) ]  [ 📍 Saved Addresses (2) ]  [ 💳 Payment Profile ]  [ 🥗 Dietary & VIP Notes ]             |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 5.2 Tab 1: Chronological Order History Timeline

Displays every order placed by the customer across all channels:

```
+-----------------------------------------------------------------------------------------------------------------------+
| ORDER #     | DATE & TIME         | SOURCE          | TYPE       | ITEMS SUMMARY           | TOTAL     | STATUS | ACTIONS |
+-------------+---------------------+-----------------+------------+-------------------------+-----------+--------+---------+
| #ORD-9821   | 30 Sep 2026, 8:45 PM| Prest-POS       | Dine-In    | 2x Paneer Tikka, 1x Naan| ₹ 1,450   | 🟢 Paid| [Receipt]|
| #ORD-8712   | 22 Sep 2026, 1:15 PM| Online-Store    | Delivery   | 1x Dal Makhani, 2x Roti | ₹ 620     | 🟢 Paid| [Receipt]|
| #ORD-7401   | 05 Sep 2026, 9:10 PM| Prest-Captain   | Dine-In    | 1x Biryani, 2x Mocktail | ₹ 1,890   | 🟢 Paid| [Receipt]|
+-----------------------------------------------------------------------------------------------------------------------+
```

* **Interactive Chit Viewer Modal**: Clicking `[Receipt]` renders the itemized order breakdown, applied taxes (CGST/SGST/VAT), discount vouchers, server staff name, and an instant **"Reprint Receipt / Bill PDF"** action.

### 5.3 Tab 2: Saved Delivery Address Book (`userAddresses`)

Allows staff to view, create, edit, and set primary addresses for telephone and online delivery fulfillment:

```
+-----------------------------------------------------------------------------------------------------------------------+
|  SAVED ADDRESSES                                                                                [ ➕ Add New Address ] |
+-----------------------------------------------------------------------------------------------------------------------+
|  [🏠 HOME - DEFAULT]                                      |  [🏢 WORK]                                                |
|  Flat 402, Silver Oak Residency, Linking Road             |  9th Floor, Tech Hub Tower B, BKC Complex                 |
|  Near Bandra Police Station, Bandra West                  |  Near Gate 3, Bandra East                                 |
|  Mumbai - 400050                                          |  Mumbai - 400051                                          |
|  📌 Instructions: Leave with security guard if not home   |  📌 Instructions: Call upon arrival at reception desk     |
|  📍 Lat: 19.0596, Lng: 72.8295                            |  📍 Lat: 19.0657, Lng: 72.8688                            |
|                                                           |                                                           |
|  [ ⭐ Default Address ]   [ ✏️ Edit ]   [ 🗑️ Remove ]      |  [ Make Default ]       [ ✏️ Edit ]   [ 🗑️ Remove ]      |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 5.4 Tab 3: Payment & Gateway Profile
* **Razorpay Customer Identifier**: Displays the linked `razorpayCustomerId` token for saved card tokens, UPI VPA handles, and one-click repeat payment authorization.
* **Preferred Payment Method**: Aggregated metrics on customer's payment habits (e.g. *75% UPI (GooglePay / PhonePe), 25% Credit Card*).

### 5.5 Tab 4: Dietary Notes & Dining Preferences
* **Food Lifestyle**: Veg, Non-Veg, Jain (No onion / garlic), Vegan, Halal.
* **Allergy Alerts**: Peanuts, Dairy/Lactose, Gluten, Shellfish, Soy.
* **Celebration Milestones**: Birthday, Anniversary, Corporate Account Code.

---

## 6. Screen 3: Cashier POS Quick-Lookup & On-the-Fly Enrollment

The Cashier POS terminal (`/cashier`) integrates customer intake seamlessly into the order checkout flow to prevent cashier bottlenecks during peak hours.

### 6.1 POS Cashier Speed-Dial Lookup Diagram

```
                 [ Cashier Enters Customer Phone in POS Header ]
                                       │
                                       ▼
                       [ Query: getCustomerByPhone ]
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
         [ Customer Exists ]                      [ Customer Not Found ]
                  │                                         │
                  ▼                                         ▼
      ┌───────────────────────┐                 ┌───────────────────────┐
      │ Auto-populate Name    │                 │ Prompt Quick Name     │
      │ & Saved Addresses     │                 │ (Optional) & Address  │
      │ Attach to Active Bill │                 │                       │
      └───────────────────────┘                 └───────────────────────┘
                  │                                         │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                      [ Finalize Order & Settle Bill ]
                                       │
                                       ▼
                  [ Mutation: getOrCreateCustomer (Atomic) ]
                                       │
                                       ▼
                   [ Order Saved with customerId & Details ]
```

### 6.2 Step-by-Step POS Cashier Integration
1. **Speed-Dial Input**:
   - Cashier enters digits in the `Customer Phone` input box (e.g. `9876543210`).
   - The UI runs `customers.getCustomerByPhone` with trailing 10-digit and 91-prefix normalization.
2. **Instant Profile Tagging**:
   - If found, displays customer name, VIP badge, and loyalty spend.
   - For **Delivery Orders**, automatically fetches `userAddresses.getCustomerAddresses` and displays a dropdown of saved addresses with radio buttons.
3. **Atomic `getOrCreateCustomer` Mutation**:
   - When the cashier clicks **"Punch Order"** or **"Settle & Print"**, `getOrCreateCustomer` is dispatched.
   - If new, creates the customer document in Convex.
   - If existing, patches any newly provided fields (e.g., email or updated name) without generating duplicate records.
   - Attaches the resulting `customerId` to the new `orders` document.

---

## 7. Convex API Backend Contracts

### 7.1 Customer Queries & Mutations (`convex/customers.ts`)

#### 1. `customers.getCustomer`
* **Type**: `query`
* **Args**: `{ id: v.id("customers") }`
* **Response**: `Doc<"customers"> | null`
* **Description**: Returns active customer profile if not soft-deleted.

#### 2. `customers.getCustomerByPhone`
* **Type**: `query`
* **Args**: `{ phone: v.string(), countryCode: v.optional(v.string()) }`
* **Response**: `Doc<"customers"> | null`
* **Description**: High-speed index lookup across direct phone, trailing 10-digit, and 91-prefixed format.

#### 3. `customers.searchCustomers`
* **Type**: `query` (Staff Access Required)
* **Args**: `{ query: v.string(), limit: v.optional(v.number()) }`
* **Response**: `Array<Doc<"customers">>`
* **Description**: Reactive search matching name, email, phone, or legacy ID.

#### 4. `customers.getCustomerOrders`
* **Type**: `query` (Staff Access Required)
* **Args**: `{ customerId: v.id("customers") }`
* **Response**: `Array<Doc<"orders">>`
* **Description**: Returns all orders placed by the customer, sorted chronologically descending.

#### 5. `customers.createCustomer`
* **Type**: `mutation`
* **Args**:
  ```typescript
  {
    firstName?: string,
    lastName?: string,
    phone: string,
    countryCode?: string,
    email?: string,
    razorpayCustomerId?: string
  }
  ```
* **Validation**: Validates phone digits (7-15 digits), enforces phone uniqueness among active records, validates email format.
* **Response**: `Id<"customers">`

#### 6. `customers.getOrCreateCustomer`
* **Type**: `mutation`
* **Args**:
  ```typescript
  {
    phone: string,
    countryCode?: string,
    firstName?: string,
    lastName?: string,
    email?: string
  }
  ```
* **Response**: `{ customerId: Id<"customers">, created: boolean }`
* **Description**: Idempotent upsert helper for POS and online store checkouts.

#### 7. `customers.updateCustomer`
* **Type**: `mutation`
* **Args**:
  ```typescript
  {
    id: Id<"customers">,
    firstName?: string,
    lastName?: string,
    phone?: string,
    countryCode?: string,
    email?: string,
    razorpayCustomerId?: string
  }
  ```
* **Response**: `{ success: true }`

#### 8. `customers.deleteCustomer`
* **Type**: `mutation`
* **Args**: `{ id: Id<"customers"> }`
* **Response**: `{ success: true }`
* **Description**: Sets `deletedAt = Date.now()` soft deletion timestamp.

---

### 7.2 Customer Address Queries & Mutations (`convex/userAddresses.ts`)

#### 1. `userAddresses.getCustomerAddresses`
* **Type**: `query`
* **Args**: `{ customerId: v.id("customers") }`
* **Response**: `Array<Doc<"userAddresses">>`
* **Description**: Returns active addresses for customer with `isDefault: true` prioritized first.

#### 2. `userAddresses.createUserAddress`
* **Type**: `mutation`
* **Args**:
  ```typescript
  {
    customerId: Id<"customers">,
    addressLine1: string,
    addressLine2?: string,
    landmark?: string,
    city: string,
    zipCode: string,
    otherLocationDetail?: string,
    addressType?: string, // "Home" | "Work" | "Other"
    latitude?: number,
    longitude?: number,
    completeAddress?: string,
    deliveryInstructions?: string,
    isDefault?: boolean
  }
  ```
* **Business Rule**: If `isDefault: true` or first address, automatically sets `isDefault: false` on all prior customer addresses.
* **Response**: `Id<"userAddresses">`

#### 3. `userAddresses.updateUserAddress`
* **Type**: `mutation`
* **Args**: `{ id: Id<"userAddresses">, ...fields }`
* **Response**: `{ success: true }`

#### 4. `userAddresses.setDefaultUserAddress`
* **Type**: `mutation`
* **Args**: `{ id: Id<"userAddresses"> }`
* **Response**: `{ success: true }`
* **Description**: Atomically designates specified address as primary default and clears default flag on all siblings.

#### 5. `userAddresses.deleteUserAddress`
* **Type**: `mutation`
* **Args**: `{ id: Id<"userAddresses"> }`
* **Response**: `{ success: true }`
* **Description**: Soft deletes address. If deleted address was default, automatically promotes the next newest active address to default.

---

## 8. Business Rules & Edge Case Handling

### 8.1 Phone Normalization & Deduplication Matrix
1. **Sanitization**: Strip all spaces, hyphens, brackets, and plus signs (`raw.replace(/[\s\-\(\)\/\+]/g, "")`).
2. **Indian Number Formatting Rules**:
   - `9876543210` (10 digits) $\rightarrow$ matches `9876543210` or `919876543210`.
   - `+91 98765 43210` $\rightarrow$ normalized to `919876543210`.
   - `09876543210` (leading trunk prefix) $\rightarrow$ normalized to 10-digit base.
3. **E.164 Global Standard**: Supports international dialing codes (7 to 15 digits) with strict regex digit validation.

### 8.2 Address Formatting & Fallbacks
If the frontend does not send a pre-formatted `completeAddress`, the backend automatically generates a standardized address string:
```typescript
const parts = [
  params.addressLine1.trim(),
  params.addressLine2?.trim(),
  params.landmark?.trim() ? `Near ${params.landmark.trim()}` : undefined,
  params.city.trim(),
  params.zipCode.trim(),
].filter(Boolean);

const formatted = parts.join(", ");
```

### 8.3 Single Default Address Invariant
A customer can have multiple delivery addresses (Home, Office, Holiday Home), but must never have more than one default address:
* Creating an address with `isDefault: true` unsets `isDefault` on all sibling addresses.
* Deleting a default address automatically designates the most recently updated remaining active address as the new default.

---

## 9. Frontend Component Hierarchy & State Architecture

```
pos-default/app/customers/
├── page.tsx                           // Main Customer Directory Page
├── [id]/
│   └── page.tsx                       // Customer 360° Profile Page
└── components/
    ├── CustomerStatsHeader.tsx        // KPI revenue & visit count cards
    ├── CustomerTable.tsx              // Reactive data table with sort/filter
    ├── CustomerSearchInput.tsx        // Debounced phone/name search bar
    ├── CustomerOrderTimeline.tsx      // Chronological order cards & receipt chit modal
    ├── CustomerAddressBook.tsx        // Address card grid with default badge toggle
    ├── AddCustomerModal.tsx           // New customer registration modal
    ├── EditCustomerModal.tsx          // Profile editor modal
    └── AddAddressModal.tsx            // Address form with Google Places autocomplete
```

---

## 10. Summary & Sign-off Checklist

- [x] **Omnichannel Customer Identification**: Phone number based customer resolution across Cashier POS, Captain App, and Web Storefront.
- [x] **Full Backend API Alignment**: Fully backed by `pos-default/convex/customers.ts` and `userAddresses.ts`.
- [x] **Idempotent POS Enrollment**: Integrated `getOrCreateCustomer` workflow avoiding duplicate customer fragmentation during rush hours.
- [x] **Address Management & Default Invariant**: Complete delivery address lifecycle with multi-address support and automatic default promotion.
- [x] **Security & Permissions**: Granular staff authorization protecting customer data access.
