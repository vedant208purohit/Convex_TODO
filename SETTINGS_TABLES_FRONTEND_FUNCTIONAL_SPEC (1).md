# DEFx-POS: Settings Tables & Data Architecture Frontend Functional Specification
**Target Audience:** Product Managers, Frontend Engineers, UI/UX Designers, POS Terminal Developers  
**Domain Scope:** All Backoffice Configuration Tables, Settings Navigation Tabs, Schema Definitions, Convex API Modules, RBAC Access Controls, Validation Rules, and UI Screen Layouts  
**Backend Framework:** Next.js 15 + Convex (Current Store POS) & Ruby on Rails 6 (Legacy Engine)  
**Document Status:** Production Ready & Authoritative Master Specification  
**Last Updated:** September 2026  

---

## 1. Executive Summary & Architecture Overview

The **Settings Subsystem** in DEFx-POS is the central backoffice control plane where restaurant owners, administrators, and floor managers configure store identity, operational rules, hardware peripherals, staff permissions, and sales channels.

### Multi-Tenant Isolation Model
* **One Store = One Dedicated Database:** Each restaurant store operates in its own isolated Convex backend deployment (`pos-default`). 
* **Zero Cross-Tenant Leakage:** Queries and mutations implicitly scope to the active store database; no `Set-Organization` header is required.
* **Identity Decoupling:** Authentication is handled by Clerk (`identity.subject`). Store memberships, employee roles, and granular permissions are stored in the store's `organizationUsers` table.

```
+----------------------------------------------------------------------------------------------------+
|                                    SETTINGS DOMAINS & DATA FLOW                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ SETTINGS PORTAL: `/settings` ]                                                                  |
|        │                                                                                           |
|        ├──> 1. Store Identity & Operations   ───> `organizations` (Profile, Timings, Gateways)    |
|        ├──> 2. Hardware & Thermal Peripherals───> `organizationPrinters`                           |
|        ├──> 3. Store Feature Flags           ───> `organizationFeatures`                           |
|        ├──> 4. Employees & Access Control    ───> `organizationUsers` (Clerk RBAC & Matrix)       |
|        ├──> 5. Floor Waiters & Badges        ───> `organizationWaiters`                            |
|        ├──> 6. Kitchen Order Workflow        ───> `organizationOrderProcesses` (KDS Pipeline)      |
|        ├──> 7. Seating & Floor Canvas        ───> `organizationLayouts` & `organizationTables`     |
|        ├──> 8. Digital QR Codes              ───> `organizationQrCodes`                            |
|        ├──> 9. Signage & Bot Dispatches      ───> `organizationCarouselScreens` & `BotTokens`      |
|        ├──> 10. Payment Settlement & Tenders ───> `paymentModes` & `orderPayments`                 |
|        ├──> 11. Taxation & Tax Groups        ───> `storeTaxSettings`, `taxGroups`, `taxes`         |
|        ├──> 12. Waitlist & Queue Engine      ───> `organizationQueueConfigurations` & `Queues`     |
|        ├──> 13. Advance Pickup Scheduling    ───> `organizationSchedulePickups`                    |
|        └──> 14. Multi-Language Locales       ───> `organizationLanguages`                          |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Master Settings Table Registry & Architecture Map

| # | Settings Navigation Tab | Backing Convex Table(s) | Convex Backend Module | Primary Purpose & Features | Auth Requirement |
|---|---|---|---|---|---|
| 1 | **Organization** | `organizations` | [`organizations.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizations.ts) | Store profile, address, operating hours, logo, compliance (GST, FSSAI), channel flags. | Store Admin |
| 2 | **Printers** | `organizationPrinters` | [`organizationPrinters.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationPrinters.ts) | Thermal ESC/POS receipt & KOT printers (LAN, USB, Bluetooth), role routing. | Store Admin |
| 3 | **Features** | `organizationFeatures` | [`organizationFeatures.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationFeatures.ts) | Store-level feature flags (skip phone, show waiter, auto accept, card badges). | Store Admin |
| 4 | **Employees** | `organizationUsers` | [`organizationUsers.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationUsers.ts) | Staff directory, Clerk user ID mapping, roles array, granular JSON CRUD permissions. | Store Admin |
| 5 | **Waiters** | `organizationWaiters` | [`organizationWaiters.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationWaiters.ts) | Floor servers directory, unique short badge codes (e.g. `W-01`), table attribution. | Admin / Cashier |
| 6 | **Order Processes** | `organizationOrderProcesses` | [`organizationOrderProcesses.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationOrderProcesses.ts) | KDS pipeline stages (Placed, Preparing, Ready, Delivered), sequence flags, colors. | Store Admin |
| 7 | **Tables & Layouts** | `organizationLayouts`<br>`organizationTables` | [`organizationLayouts.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationLayouts.ts)<br>[`organizationTables.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationTables.ts) | Floor sections (Rooftop, Patio, Indoor) + Dining tables, capacity, 2D canvas coords. | Admin / Cashier |
| 8 | **QR Codes** | `organizationQrCodes` | [`organizationQrCodes.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationQrCodes.ts) | Dynamic Dine-In, Takeaway, and Queue QR codes with scan tracking. | Store Admin |
| 9 | **Live Screens** | `organizationCarouselScreens`<br>`organizationBotTokens` | [`organizationCarouselScreens.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationCarouselScreens.ts)<br>[`organizationBotTokens.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationBotTokens.ts) | TV promotional signage carousels + Telegram/WhatsApp order dispatch tokens. | Store Admin |
| 10 | **Payment Modes** | `paymentModes`<br>`organizations` | [`paymentModes.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/paymentModes.ts)<br>[`organizations.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizations.ts) | Custom POS settlement modes (Cash, Card, UPI, Custom) + Gateway API keys. | Admin / Cashier |
| 11 | **Taxation** | `storeTaxSettings`<br>`taxGroups`<br>`taxes` | [`taxation.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/taxation.ts) | Regional tax rates (CGST, SGST, VAT), compound taxes, tax inclusive/exclusive modes. | Store Admin |
| 12 | **Queues / Waitlist**| `organizationQueueConfigurations`<br>`organizationQueues` | [`organizationQueueConfigurations.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationQueueConfigurations.ts)<br>[`organizationQueues.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationQueues.ts) | Waitlist operating hours, geofencing coordinates/radius, party sizes, queue tickets. | Admin / Cashier |
| 13 | **Scheduled Orders** | `organizationSchedulePickups` | [`organizationSchedulePickups.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationSchedulePickups.ts) | Advance ordering slots, pickup/delivery lead time, time-slot duration limits. | Store Admin |
| 14 | **Languages** | `organizationLanguages` | [`organizationLanguages.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationLanguages.ts) | Multi-language menu support (English, Hindi, Gujarati, French, Arabic), default locale. | Store Admin |

---

## 3. Deep-Dive Specification for Every Settings Table

---

### 3.1 Store Identity & Operations Table: `organizations`
* **Convex File:** [`convex/organizations.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizations.ts)  
* **Schema Definition:** Consolidates store identity, operational switches, operating hours, compliance, and gateway keys.

| Field Category | Field Name | Type | Description & UI Mapping |
|---|---|---|---|
| **Identity & Branding** | `name` | `string` | Restaurant legal / trading name. |
| | `slug` | `string` | URL-friendly store identifier. |
| | `description` | `optional string` | Short store bio for digital menu header. |
| | `logoStorageId` / `logoUrl` | `optional string` | Store logo image asset. |
| | `bannerStorageId` / `bannerUrl`| `optional string`| Store digital header banner. |
| | `primaryColor` / `secondaryColor`| `optional string`| Hex brand accent colors (e.g. `#E11D48`). |
| **Address & Contact** | `addressLine1`, `addressLine2` | `optional string` | Physical street address. |
| | `city`, `state`, `zipCode`, `country`| `optional string` | Location metadata. |
| | `latitude`, `longitude` | `optional string` | GPS coordinates for delivery geofencing. |
| | `phone`, `email`, `website` | `optional string` | Customer service contact info. |
| **Operating Hours** | `timing` | `optional JSON` | 7-day operating schedule array (Open/Close times per day). |
| | `isStoreClosed` | `optional boolean` | Emergency manual store closure toggle. |
| **Compliance & Tax** | `gstNumber`, `fssaiLicNumber` | `optional string` | Regulatory compliance IDs printed on tax invoices. |
| | `currencyCode`, `currencySymbol`| `string` | Local currency (e.g. `INR`, `₹`, `USD`, `$`). |
| **Module Switches** | `isDineIn`, `isTakeAway`, `isDelivery` | `boolean` | Core sales channel toggles. |
| | `isKds`, `isInventory`, `isReport` | `boolean` | POS module feature activation switches. |
| | `isVeg` | `boolean` | 100% Pure Vegetarian restaurant badge. |
| **Payment Gateways** | `razorPayKeyId`, `razorPayApiKey` | `optional string` | Razorpay Merchant credentials. |
| | `stripePublishableKey`, `stripeSecretKey`| `optional string`| Stripe Merchant credentials. |

---

### 3.2 Hardware Printers Table: `organizationPrinters`
* **Convex File:** [`convex/organizationPrinters.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationPrinters.ts)  
* **Purpose:** Manages thermal receipt and Kitchen Order Ticket (KOT) printers connected via Network (LAN IP), USB, or Bluetooth.

| Field Name | Type | Constraint | Description & UI Mapping |
|---|---|---|---|
| `_id` | `Id<"organizationPrinters">` | Primary Key | Printer profile ID. |
| `name` | `string` | Required | Friendly label (e.g., `"Cashier Counter EPSON"`, `"Kitchen Station 1"`). |
| `printerRole` | `union("Cashier", "Station", "WorkStation")` | Enum | Determines routing: Cashier prints bills; Station prints KOTs. |
| `ipAddress` | `optional string` | IP format | LAN IP address for thermal network printing (e.g., `192.168.1.100`). |
| `port` | `optional number` | Port format | Thermal socket port (typically `9100`). |
| `paperSize` | `optional string` | Enum | Thermal roll width: `"80mm"` (standard) or `"58mm"` (compact). |
| `autoCut` | `optional boolean` | Boolean | Sends auto-cut paper pulse after job completion. |
| `openCashDrawer`| `optional boolean` | Boolean | Sends RJ11 drawer kick pulse upon bill settlement. |
| `stationId` | `optional Id<"kitchenStations">` | Reference | Links printer to a specific kitchen preparation station. |

---

### 3.3 Store Feature Flags Table: `organizationFeatures`
* **Convex File:** [`convex/organizationFeatures.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationFeatures.ts)  
* **Purpose:** Toggles operational behaviors and card metadata displays for cashier and floor workflows.

| Feature Key | Default | Functional Behavior in POS Terminal |
|---|---|---|
| `skip_phone_number_required` | `false` | When `true`, customer phone number is optional during POS checkout. |
| `show_waiter_on_cashier_card` | `false` | When `true`, displays serving waiter badge on live order cards. |
| `skip_payment_on_cashier_card` | `false` | When `true`, allows order completion without immediate payment collection. |
| `show_table_on_cashier_card` | `false` | When `true`, highlights table number pill on live order cards. |
| `show_member_number_on_cashier_card`| `false`| When `true`, displays customer membership/loyalty number on ticket. |
| `show_table_tab_in_cashier` | `false` | When `true`, embeds the visual table seating floor plan directly into `/orders`. |
| `auto_accept` | `true` | When `true`, incoming digital orders bypass manual acceptance queue. |

---

### 3.4 Employees & Permissions Table: `organizationUsers`
* **Convex File:** [`convex/organizationUsers.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationUsers.ts)  
* **Purpose:** Maps Clerk user identities to the store, assigning roles and granular resource-level CRUD permission maps.

| Field Name | Type | Description & UI Mapping |
|---|---|---|
| `userId` | `string` | Clerk User Subject ID (`user_2xxxxxxxxxxxx`). |
| `userType` | `Array<string>` | Active roles array: `["admin"]`, `["cashier"]`, `["captain"]`, `["waiter"]`, `["kitchen"]`. |
| `userPermission` | `optional JSON` | Granular CRUD map: `{"orders": {"create": true, "read": true, "update": true, "delete": false}}`. |
| `firstName`, `lastName` | `optional string` | Profile display names. |
| `email`, `phone` | `optional string` | Contact and invitation credentials. |
| `status` | `union("active", "inactive", "invited")`| Membership lifecycle state. |

---

### 3.5 Waiters & Service Staff Table: `organizationWaiters`
* **Convex File:** [`convex/organizationWaiters.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationWaiters.ts)  
* **Purpose:** Lightweight floor server profiles requiring no personal Clerk account.

| Field Name | Type | Constraint | Description & UI Mapping |
|---|---|---|---|
| `firstName`, `lastName` | `optional string` | Token Search | Server's display name. |
| `waiterCode` | `optional string` | Display Code | Original case-preserved badge code (e.g. `"W01"`, `"104"`). |
| `normalizedWaiterCode` | `optional string` | Unique per Store | Normalized lowercase code enforcing uniqueness (`"Hey! {code} is already taken."`). |
| `deletedAt` | `optional number` | Soft Delete | Past orders maintain resolution via `getWithDeleted`. |

---

### 3.6 Kitchen Workflow Pipeline Table: `organizationOrderProcesses`
* **Convex File:** [`convex/organizationOrderProcesses.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationOrderProcesses.ts)  
* **Purpose:** Defines customizable kitchen workflow stages and KDS order lifecycle transitions.

| Field Name | Type | Constraint | Description & UI Mapping |
|---|---|---|---|
| `name` | `string` | Required | Process stage label (e.g. `"Order Placed"`, `"Preparing"`, `"Ready"`, `"Served"`). |
| `position` | `number` | Unique Integer | Step position in sequence pipeline (`1`, `2`, `3`, `4`). |
| `isSequence` | `boolean` | Boolean | `true` for progressive stages; `false` for non-sequential states (e.g. Cancelled, Modified). |
| `published` | `boolean` | Boolean | Active status switch. |
| `color` | `optional string` | Hex Regex (`^#([A-Fa-f0-9]{6})$`) | Visual stage color badge (e.g. `#10B981` for Ready). |

---

### 3.7 Tables & Seating Sections Tables: `organizationLayouts` & `organizationTables`
* **Convex Files:** [`convex/organizationLayouts.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationLayouts.ts) & [`convex/organizationTables.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationTables.ts)  
* **Purpose:** Floor sections (rooms/zones) and dining tables with 2D visual canvas coordinates.

#### Table: `organizationLayouts`
* `name: string`: Floor zone name (e.g. `"Main Dining"`, `"Rooftop"`). Case-insensitive unique.
* `displayOrder?: number`: Tab ordering weight.

#### Table: `organizationTables`
* `tableNumber: string`: Table identifier (e.g. `"T-01"`, `"VIP-1"`). Scoped unique per layout.
* `seatingCapacity: number`: Number of seats (positive integer `> 0`).
* `placement?: string`: Placement tag (`"Indoor"`, `"Outdoor"`, `"Window"`, `"Bar"`).
* `xPosition?: string`, `yPosition?: string`: 2D Coordinates on 1600x1600 canvas (auto-calculated if omitted).
* `kidsSeatAvailability`, `disabledSeatAvailability`, `barbequeGrillAvailability`: Amenity flags.
* `isBlock: boolean`, `isRequested: boolean`, `currentOrderId?: string`: Live seating state flags.

---

### 3.8 Dynamic QR Codes Table: `organizationQrCodes`
* **Convex File:** [`convex/organizationQrCodes.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationQrCodes.ts)  
* **Purpose:** Manages printable QR codes for customer table self-ordering, takeaway ordering, and waitlist joining.

| Field Name | Type | Description & UI Mapping |
|---|---|---|
| `name` | `string` | QR label (e.g. `"Table T-01 QR"`, `"Counter Takeaway QR"`). |
| `qrType` | `union("DineIn", "TakeAway", "Queue")` | Destination flow when scanned by guest. |
| `tableId` | `optional Id<"organizationTables">` | Links QR to specific dining table for automatic Dine-In cart tagging. |
| `qrUrl` | `optional string` | Fully qualified customer deep link URL. |
| `counter` | `number` | Cumulative scan counter for guest traffic analytics. |

---

### 3.9 Signage Screens & Bot Tokens: `organizationCarouselScreens` & `organizationBotTokens`
* **Convex Files:** [`convex/organizationCarouselScreens.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationCarouselScreens.ts) & [`convex/organizationBotTokens.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationBotTokens.ts)

#### Table: `organizationCarouselScreens`
* `name: string`: Signage slide title.
* `storageId?: string` / `imageUrl?: string`: High-resolution promotional graphic.
* `position: number`: Display sequence for live TV signage boards.
* `published: boolean`: Visibility switch.

#### Table: `organizationBotTokens`
* `botType: string`: Integration service (e.g. `"telegram"`, `"whatsapp"`).
* `token: string`: Encrypted bot token for automated kitchen / manager alerts.
* `channelId?: string`: Target chat or channel group ID.

---

### 3.10 Payment Modes & Gateways Table: `paymentModes`
* **Convex File:** [`convex/paymentModes.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/paymentModes.ts)  
* **Purpose:** Custom tender options for POS cashier settlement and split billing.

| Field Name | Type | Description & UI Mapping |
|---|---|---|
| `name` | `string` | Tender label (e.g. `"Cash"`, `"Card / POS"`, `"UPI / QR"`, `"Room Charge"`, `"Gift Voucher"`). Case-insensitive unique. |
| `active` | `boolean` | Cashier terminal availability switch. |
| `createdAt` | `number` | Creation timestamp. |

---

### 3.11 Taxation & Tax Groups Tables: `storeTaxSettings`, `taxGroups`, `taxes`
* **Convex File:** [`convex/taxation.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/taxation.ts)  
* **Purpose:** Configures multi-tier tax systems (GST, CGST, SGST, VAT, Service Charges).

#### Table: `storeTaxSettings`
* `currencyCode: string`, `currencySymbol: string`: Primary store currency.
* `countryCode: string`, `stateCode?: string`: Geographic jurisdiction.
* `defaultTaxGroupId?: Id<"taxGroups">`: Default tax bracket assigned to new menu items.

#### Table: `taxGroups` & `taxes`
* `name: string`: Group title (e.g. `"GST 5%"`, `"GST 18%"`, `"Liquor VAT 20%"`).
* `components: Array<{ name: string, rate: number }>`: Itemized breakdown (e.g. CGST 2.5% + SGST 2.5%).

---

### 3.12 Queue & Waitlist Tables: `organizationQueueConfigurations` & `organizationQueues`
* **Convex Files:** [`convex/organizationQueueConfigurations.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationQueueConfigurations.ts) & [`convex/organizationQueues.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationQueues.ts)

#### Table: `organizationQueueConfigurations`
* `timing: JSON`: Weekly queue acceptance schedule.
* `geofenceLatitude`, `geofenceLongitude`, `geofenceRadius`: In-person location verification radius (meters).
* `minPartySize`, `maxPartySize`: Capacity constraints for online waitlist bookings.

#### Table: `organizationQueues`
* `tokenNumber: string`: Formatted queue ticket (e.g. `"Q-104"`).
* `customerName`, `customerPhone`: Guest contact info.
* `partySize: number`: Number of guests.
* `status: union("Waiting", "Called", "Seated", "Cancelled", "NoShow")`: Waitlist lifecycle.

---

### 3.13 Scheduled Orders Table: `organizationSchedulePickups`
* **Convex File:** [`convex/organizationSchedulePickups.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationSchedulePickups.ts)  
* **Purpose:** Advance ordering configuration for catering, scheduled pickups, and pre-booked deliveries.

| Field Name | Type | Description & UI Mapping |
|---|---|---|
| `advanceTimeLimit` | `number` | Maximum advance days allowed (e.g. 7 days). |
| `timeSlotSize` | `number` | Interval duration in minutes (e.g. 15 or 30 min slots). |
| `minOrderPreparationTime`| `number` | Minimum lead time required in minutes before pickup. |
| `timing` | `JSON` | Daily scheduled pickup operating hours. |

---

### 3.14 Multi-Language Localization Table: `organizationLanguages`
* **Convex File:** [`convex/organizationLanguages.ts`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/convex/organizationLanguages.ts)  
* **Purpose:** Multi-language catalog support for international and multi-lingual guest ordering.

| Field Name | Type | Description & UI Mapping |
|---|---|---|
| `name` | `string` | Language title (e.g. `"English"`, `"Hindi"`, `"Gujarati"`, `"Arabic"`). |
| `code` | `string` | ISO 639-1 language code (e.g. `"en"`, `"hi"`, `"gu"`, `"ar"`). |
| `isDefault` | `boolean` | Store primary fallback locale. Exactly one language is default per store. |
| `published` | `boolean` | Public menu visibility toggle. |

---

## 4. RBAC & Access Control Matrix Across Settings

| Settings Tab / Domain | Backing Table | Read Access (`requireMember`) | Create / Edit / Delete Access |
|---|---|---|---|
| **Organization Profile** | `organizations` | All Store Staff | **Store Admin Only** |
| **Printers** | `organizationPrinters` | All Store Staff | **Store Admin Only** |
| **Feature Flags** | `organizationFeatures` | All Store Staff | **Store Admin Only** |
| **Employees / Staff** | `organizationUsers` | All Store Staff | **Store Admin Only** |
| **Waiters Directory** | `organizationWaiters` | All Store Staff | **Admin & Cashier** |
| **Order Processes** | `organizationOrderProcesses` | All Store Staff | **Store Admin Only** |
| **Tables & Layouts** | `organizationLayouts`<br>`organizationTables` | All Store Staff | **Admin & Cashier** |
| **QR Codes** | `organizationQrCodes` | All Store Staff | **Store Admin Only** |
| **Live Screens & Bots** | `organizationCarouselScreens`<br>`organizationBotTokens` | All Store Staff | **Store Admin Only** |
| **Payment Modes** | `paymentModes` | All Store Staff | **Admin & Cashier** |
| **Taxation** | `storeTaxSettings`, `taxGroups` | All Store Staff | **Store Admin Only** |
| **Queue Configuration** | `organizationQueueConfigurations` | All Store Staff | **Store Admin Only** |
| **Queue Entries** | `organizationQueues` | All Store Staff | **Admin & Cashier** |
| **Scheduled Pickups** | `organizationSchedulePickups` | All Store Staff | **Store Admin Only** |
| **Languages** | `organizationLanguages` | All Store Staff | **Store Admin Only** |

---

## 5. Frontend Settings Shell & UI Navigation Architecture

**Route:** [`/settings`](file:///Users/vedantpurohit/Desktop/ruby/pos-default/app/settings/page.tsx)  
**Layout:** Two-Panel Responsive Shell (Left: Navigation List, Right: Active Domain View).

```
+----------------------------------------------------------------------------------------------------+
| SETTINGS — MANAGEMENT PORTAL                                                   Store: [ Bistro 42 ]|
+----------------------------------------------------------------------------------------------------+
| SETTINGS MENU               | ACTIVE SETTINGS CONTENT AREA                                         |
|-----------------------------|----------------------------------------------------------------------|
| [ 🏢 Organization         ] |                                                                      |
| [ 🖨️ Printers             ] |   Selected Tab Component: `<OrganizationSettings />`                 |
| [ ⚡ Features             ] |   • Store Profile, Logo & Header Banner                              |
| [ 👥 Employees            ] |   • 7-Day Operating Hours Schedule                                   |
| [ 👔 Waiters              ] |   • Compliance: GST Number, FSSAI License                            |
| [ 🔄 Order Processes      ] |   • Sales Channel Switches (Dine-In, Takeaway, Delivery)             |
| [ 🍽️ Tables & Layouts     ] |   • Online Payment Gateways (Razorpay & Stripe API Keys)             |
| [ 📱 QR Codes             ] |                                                                      |
| [ 📺 Live Screens         ] |                                                                      |
| [ 💳 Payment Modes        ] |                                                                      |
| [ 📊 Taxation             ] |                                                                      |
| [ 📋 Queue & Waitlist     ] |                                                                      |
+----------------------------------------------------------------------------------------------------+
```

### URL State Management:
* Tab switching updates the search parameter: `/settings?tab=printers`, `/settings?tab=tables`, `/settings?tab=staff`.
* Deep linking directly opens the target configuration card upon reload.
* Unsaved changes prompt a browser navigation warning guard.

---

## 6. Data Integrity, Validation Rules & Edge Cases

| Domain / Scenario | System Constraint | Frontend Validation & Error Handling |
|---|---|---|
| **Sole Admin Protection** | Cannot demote or delete the last remaining Store Admin in `organizationUsers`. | Throws `"Cannot modify the only active admin"`; UI blocks action with alert modal. |
| **Self-Deactivation Guard** | Logged-in admin cannot remove their own admin privileges. | UI disables the self-delete/demote button for the active Clerk user ID. |
| **Unique Code / Name Collisions** | Enforced case-insensitively across `waiterCode`, `tableNumber` (in layout), `paymentModes.name`, `organizationLayouts.name`. | Catches backend duplicate message (`"Hey! {item} is already taken."`) and renders red inline alert. |
| **Mandatory Payment Policy** | If a channel is active (e.g. Dine-In), at least one payment policy (Prepaid or Postpaid) must be enabled. | Checkbox prevents unchecking the last remaining active payment policy. |
| **Soft Delete Archival Integrity** | Deleting a table, waiter, or printer sets `deletedAt: timestamp`. | Historical orders resolve names via `getWithDeleted` without foreign key breaks. |
| **Hex Color Validation** | `organizationOrderProcesses.color` requires 6-digit hex string. | Color picker input with pattern regex `^#([A-Fa-f0-9]{6})$`. |

---

## 7. Implementation Checklist for Frontend Engineers

```markdown
- [ ] 1. Verify all 14 Settings Tabs are registered in `pos-default/app/settings/page.tsx`.
- [ ] 2. Connect `<OrganizationSettings />` to `api.organizations.update` for profile, timings, and gateway secrets.
- [ ] 3. Connect `<OrganizationPrinters />` to `api.organizationPrinters` for thermal ESC/POS hardware setup.
- [ ] 4. Connect `<OrganizationFeatures />` to `api.organizationFeatures.bulkSetFeatures` for store feature flags.
- [ ] 5. Connect `<OrganizationEmployees />` to `api.organizationUsers` with Clerk RBAC and permission matrix.
- [ ] 6. Connect `<OrganizationWaiters />` to `api.organizationWaiters` for quick floor badge server directory.
- [ ] 7. Connect `<OrderProcessesView />` to `api.organizationOrderProcesses` with sequence drag-and-drop.
- [ ] 8. Connect `<OrganizationTables />` to `api.organizationTables` & `api.organizationLayouts` with 2D Canvas.
- [ ] 9. Connect `<OrganizationQrCodes />` to `api.organizationQrCodes` for table deep links & batch print sheet.
- [ ] 10. Connect `<OrganizationLiveScreens />` to `api.organizationCarouselScreens` & `api.organizationBotTokens`.
- [ ] 11. Connect `<OrganizationPaymentModes />` to `api.paymentModes` for custom POS settlement tenders.
- [ ] 12. Connect `<TaxationSettings />` to `api.taxation` for tax groups and default tax brackets.
- [ ] 13. Verify URL query parameter synchronization (`/settings?tab=...`) and role-based view permissions.
```
