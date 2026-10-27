# PREST POS — Online Store Synchronization Audit & Specification

**Date:** October 26, 2026  
**Document Status:** Complete & Authoritative  
**Audited Repositories:**
- **POS Management & Business Logic:** `pos-default` (Branch: `development`)
- **Customer Storefront Web App:** `pos-user` (Branch: `development`)
- **Legacy POS Management Reference:** `defx-pos-frontend` (Branch: `development`)
- **Legacy Customer Storefront Reference:** `defx-pos-users` (Branch: `main`)
- **Control Plane & Multi-Store Provisioning Reference:** `pos-master` (Branch: `development`)

---

## Executive Summary

This document establishes the authoritative technical audit, gap analysis, and implementation specification for end-to-end synchronization between the PREST POS Online Store configuration (`pos-default`) and the customer-facing digital storefront (`pos-user`).

Both `pos-default` and `pos-user` share the exact same Convex real-time deployment backend (`https://gregarious-chicken-229.convex.cloud`), while `pos-master` operates as the multi-tenant control plane (`https://agreeable-turtle-697.convex.cloud`).

The audit reveals that while `pos-default` possesses an Online Store settings module (`OrganizationOnlineStore.tsx`) with real-time preview frames, theme palettes, and availability controls:
1. **Branding Disconnect:** `primaryColor`, `secondaryColor`, and `theme` persisted by `pos-default` are **completely ignored** by `pos-user`. The storefront had zero references to `primaryColor` and hardcoded Indigo (`#4338ca`) across 80+ customer-facing component nodes.
2. **Availability & Pause Gating Disconnect:** When a store administrator pauses the storefront via `onlineStore = false`, `pos-user` did not query `onlineStore` in `resolveCustomerSession`, did not display a polite paused/closed screen, and `orders.createOrder` lacked backend validation to reject orders for paused stores.
3. **Tenant & Deep-Link URL Resolution:** `OrganizationOnlineStore.tsx` hardcoded `https://${storeSlug}.get-prest.com`, which broke local development, dev preview testing, and multi-tenant routing where storefront deep links and QR codes must use `NEXT_PUBLIC_CUSTOMER_STORE_URL` or `NEXT_PUBLIC_DIGITAL_STORE_BASE_URL`.
4. **Availability & Payment Matrix Disconnect:** The `availability` and `payments` tabs in `OrganizationOnlineStore.tsx` displayed static/mock information for service modes and payment methods rather than reflecting the real persisted store flags (`isDelivery`, `isTakeAway`, `isDineIn`, `deliveryCashOnDelivery`, `deliveryOnlinePayment`, etc.).

---

## Phase 1 — Comprehensive Multi-Repository Audit

### 1. Audit of Current `pos-default` Online Store Settings

The settings module lives at `pos-default/app/components/OrganizationOnlineStore.tsx`, rendered in `pos-default/app/settings/page.tsx` under the `onlineStore` tab.

| Setting / Feature | UI Control in `OrganizationOnlineStore` | Source of Truth | Convex Mutation / Action | Customer Access in `pos-user` | Propagation & Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Store Availability (Master Switch)** | Master Switch in Top Bar & Availability Tab; pause confirmation modal (`showOfflineModal`) | `organizations.onlineStore` (boolean) | `api.organizations.update` (`onlineStore: boolean`) | ❌ **Missing**: `resolveCustomerSession` does not include `onlineStore` | Persists in DB. Note: `organizations.ts` contains a legacy restriction throwing `"Please contact support"` for live non-test stores. |
| **Theme Selection** | 4 Theme cards: Theme 1 (Atelier Classic), Theme 2 (Botanica Clean), Theme 3 (Editorial Serif), Theme 4 (Nocturne OLED) | `organizations.theme` (string) | `api.organizations.update` (`theme: "theme1"`) | ❌ **Missing**: Not exposed to `pos-user` | Themes 2-4 marked "Coming Soon". Theme 1 is authoritative. |
| **Brand Colors (Primary & Secondary)** | Hex text inputs, color pickers, and 5 curated palette presets (`bistro`, `fresh`, `warm`, `minimal`, `luxe`) | `organizations.primaryColor`, `organizations.secondaryColor` | `api.organizations.update` (`primaryColor`, `secondaryColor`) | ❌ **Missing**: `CustomerOrganization` interface lacks color fields; `#4338ca` hardcoded | Validated with 6-char hex regex `isValidHex`. Falls back to `#418244` and `#E52A2A` if missing. |
| **Store Logo & Branding Assets** | Displayed in Theme Inspector and Header Card | `organizations.logoUrl`, `organizations.logoAssetId`, `organizations.logoStorageId` | `api.organizations.update`, `api.r2.createAssetUpload` | ✅ `resolveCustomerSession` resolves R2 asset or storage ID | Supported via `resolveAssetOrStorageUrl`. Sanitizes broken blob URLs. |
| **Menu & Catalog Categories** | Simulated in Theme Inspector; managed in `/menu` | Tables: `categories`, `items`, `customizationGroups` | Managed via `api.items.*`, `api.categories.*` | ✅ `api.categories.list`, `api.items.listByOrganization` | Real-time Convex subscriptions update storefront dynamically without page reload. |
| **Dietary Filters (Veg / Non-Veg)** | Simulated in Inspector; store toggle `isVeg` | `organizations.isVeg`, `items.isVeg` | `api.organizations.update` (`isVeg: boolean`) | ✅ Handled in `PopularProductsSection` & `ProductCard` | If `org.isVeg === true`, storefront operates in Pure-Veg mode. |
| **Service Modes (Delivery, Takeaway, Dine-In)** | Displayed in Availability Tab as 3 summary cards | `organizations.isDelivery`, `isTakeAway`, `isDineIn` | `api.organizations.update` (managed in Features tab) | ✅ Gated in `ServiceModeSwitcher` & `resolveCustomerSession` | When disabled, customers cannot select the mode in cart or scan QR codes. |
| **Channel Payment Matrix** | 3-row matrix table in Payments Tab | `organizations.deliveryCashOnDelivery`, `deliveryOnlinePayment`, `takeAwayCashPayment`, `takeAwayOnlinePayment`, `dineinPrepaid`, `dineinPospaid` | `api.organizations.update` (managed in Payment Modes tab) | ✅ Gated in `CustomerCartView`, `CustomerDeliveryCartView`, `CustomerTakeawayCartView` | Missing payment toggles disable checkout for the respective channel. |
| **Storefront URL & QR Codes** | Domain Pill, Copy button, Open button, and Table QR preview | `organizations.slug` + Configured Base URL | Read from window / env | ⚠️ **Partial**: Hardcoded `https://${storeSlug}.get-prest.com` | Hardcoded string fails on `localhost:3000`, `dev-pos-user`, or custom subdomains. |

---

### 2. Audit of Legacy Business Logic (`defx-pos-frontend` & `defx-pos-users`)

Comparing the legacy implementation against the new codebase reveals several critical behaviors:

1. **Store Offline / Paused Routing (`defx-pos-users/pages/store-close.js`)**:
   - In legacy `defx-pos-users`, if `res.online_store === false`, the router immediately navigated to `/store-close`:
     > *"Restaurant’s online store is closed at the moment."*
   - Furthermore, the header checked operating hours (`operation_timing`) against store timezone and displayed a countdown:
     > *"Restaurant is closed now. It will open in HH:MM:SS."*
   - **Parity Requirement:** The new `pos-user` storefront must check `onlineStore` and show a clean, branded "Online Store Currently Paused" view when `onlineStore === false`, preventing cart actions and checkout.

2. **Theming & Color Injection (`defx-pos-users/components/Header/index.js`)**:
   - Legacy stored `primary_color` and `secondary_color` under `user_view_theme` and injected `PRIMARY_COLOR` into the Redux state, which drove navigation bars, buttons, and badges.
   - **New POS Architecture:** `pos-default` stores `primaryColor` and `secondaryColor` directly on the `organizations` document. `pos-user` must ingest these via `resolveCustomerSession` and apply them dynamically via CSS custom variables (`--store-primary`, `--store-secondary`) so that buttons, stepper controls, cart badges, and accents reflect the store's brand.

3. **Backend Order Guarding**:
   - Legacy API rejected orders if the channel was disabled or if the store was inactive.
   - In `pos-user/convex/orders.ts`, service modes were checked, but `org.onlineStore` was **not validated**. Any direct mutation call could still place an order even if the administrator turned off the online store.
   - **Parity Requirement:** `orders.createOrder` must verify `org.onlineStore !== false` before creating orders.

---

### 3. Audit of Current `pos-user` Implementation Gaps

| Area | Current Implementation | Identified Synchronization Flaw | Required Solution |
| :--- | :--- | :--- | :--- |
| **Theme & Brand Colors** | Hardcoded `#4338ca` (Indigo) and `#372abf` throughout `ProductCard`, `StickyCartBar`, `CustomerHeader`, `ServiceModeSwitcher`, `CustomerDeliveryCartView`, `CustomerTakeawayCartView`. | Brand customizations made in POS settings have zero effect on customer storefront. | Map `primaryColor` & `secondaryColor` in `resolveCustomerSession`, `CustomerOrganization`, and inject CSS variables `--store-primary` / `--store-secondary`. |
| **Store Availability** | `resolveCustomerSession` does not query or return `onlineStore`. `CustomerOrderingHome` renders normally even when store is offline. | Customers can browse menu, customize items, and proceed to cart while store owner paused ordering. | Return `onlineStore: activeOrg.onlineStore ?? true` from `resolveCustomerSession`. If `false`, render `CustomerStorePausedView` with clear explanation. |
| **Backend Order Protection** | `orders.createOrder` in `pos-user/convex/orders.ts` and `pos-default/convex/orders.ts` only checked `deletedAt`, item validity, and channel flags (`isDelivery`, etc.). | Orders can still be created via network calls when store is paused. | Add guard in `createOrder`: if `org.onlineStore === false`, throw `"This restaurant is currently not accepting online orders."` |
| **Storefront Link & QR Codes** | `OrganizationOnlineStore.tsx` hardcodes `${storeSlug}.get-prest.com`. | In local dev and PR preview deployments, clicking "Open" or copying the link navigates to production domain instead of active local/dev pos-user instance. | Use centralized helper `getStorefrontUrl(slug, options)` that respects `NEXT_PUBLIC_CUSTOMER_STORE_URL`, `NEXT_PUBLIC_DIGITAL_STORE_BASE_URL`, and wildcard domains. |
| **Availability & Payment Matrix in POS** | `OrganizationOnlineStore.tsx` availability and payments tabs showed static values (e.g. "₹200 min order", "✓ Enabled"). | POS administrator sees static placeholder information instead of actual live store toggles. | Connect Availability and Payment Matrix tabs directly to `org.isDelivery`, `org.isTakeAway`, `org.isDineIn`, `org.deliveryOnlinePayment`, `org.deliveryCashOnDelivery`, etc. |

---

## Phase 2 — Authoritative Configuration Contract

### Configuration-to-Storefront Matrix

| Field | Source of Truth (`organizations`) | Mutation / Action | Customer Storefront Consumer (`pos-user`) | Default Value | Synchronization Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `onlineStore` | `organizations.onlineStore` (boolean) | `api.organizations.update` | `resolveCustomerSession` -> `CustomerOrderingHome` -> `CustomerStorePausedView` & `createOrder` | `true` | Real-time Convex subscription. When flipped to `false`, customer storefront immediately disables cart and renders paused screen. |
| `primaryColor` | `organizations.primaryColor` (string) | `api.organizations.update` | `resolveCustomerSession` -> CSS variable `--store-primary` -> Buttons, badges, steppers, cart bar | `#418244` (Forest Green) | Real-time subscription. Validated 6-character hex. Applied dynamically without full page reload. |
| `secondaryColor`| `organizations.secondaryColor` (string) | `api.organizations.update` | `resolveCustomerSession` -> CSS variable `--store-secondary` -> Accent chips, promo badges | `#E52A2A` (Crimson) | Real-time subscription. Validated 6-character hex. Falls back to `#E52A2A`. |
| `theme` | `organizations.theme` (string) | `api.organizations.update` | `resolveCustomerSession` -> Store layout renderer | `"theme1"` | Real-time subscription. Determines primary layout stylesheet. |
| `isDelivery` | `organizations.isDelivery` (boolean) | `api.organizations.update` | `ServiceModeSwitcher` & `CustomerDeliveryCartView` & `createOrder` | `true` | When `false`, delivery channel is hidden and delivery orders are rejected. |
| `isTakeAway` | `organizations.isTakeAway` (boolean) | `api.organizations.update` | `ServiceModeSwitcher` & `CustomerTakeawayCartView` & `createOrder` | `true` | When `false`, takeaway channel is hidden and takeaway orders are rejected. |
| `isDineIn` | `organizations.isDineIn` (boolean) | `api.organizations.update` | Table QR deep-links, `ServiceModeSwitcher`, `createOrder` | `true` | When `false`, table QR codes return `SERVICE_MODE_DISABLED`. |
| `logoUrl` / Assets | `organizations.logoAssetId`, `logoStorageId` | `api.r2.confirmAssetUpload` | `CustomerHeader`, `CustomerLoadingSkeleton` | Fallback icon | Resolves signed R2 CDN URL or Convex storage URL. |
| `isVeg` | `organizations.isVeg` (boolean) | `api.organizations.update` | `CustomerOrderingHome`, `PopularProductsSection` | `false` | When `true`, pure veg badge is shown and all non-veg items are hidden. |
| Payment Toggles | `deliveryCashOnDelivery`, `deliveryOnlinePayment`, `takeAwayCashPayment`, etc. | `api.organizations.update` | `CustomerDeliveryCartView`, `CustomerTakeawayCartView`, `useRazorpayCheckout` | Per-channel boolean | Real-time validation. Disables payment## Phase 3 — Completed Implementation

1. **Authoritative Contract & Session Exposure**:
   - Updated `resolveCustomerSession` in both `pos-user/convex/organizationQrCodes.ts` and `pos-default/convex/organizationQrCodes.ts` to return `onlineStore`, `primaryColor`, `secondaryColor`, and `theme`.
   - Updated `CustomerOrganization` interface in `pos-user/app/components/customer/types.ts`.
   - Updated `buildCustomerOrgFromDoc` in `pos-user/app/components/customer/CustomerOrderingHome.tsx` to map these properties.
   - Enforced online order gating in `pos-user/convex/orders.ts` and `pos-default/convex/orders.ts` (`org.onlineStore !== false`) while permitting POS cashier/waiter in-store orders.
   - Fixed `organizations.update` in both repositories to allow store managers to toggle `onlineStore` freely without artificial support gate rejections. Defaulted `onlineStore` to `true` upon store creation.

2. **Dynamic Storefront Theming & Branding**:
   - In `CustomerOrderingHome.tsx`, injected `--store-primary` and `--store-secondary` CSS variables directly into the root layout style attribute.
   - In `pos-user/app/globals.css`, mapped root tokens `--color-primary` and `--color-secondary` to `var(--store-primary)` and `var(--store-secondary)`, and created `.bg-store-primary`, `.text-store-primary`, and `.btn-store-primary` utilities.
   - Updated `ProductCard.tsx` (ADD button, quantity steppers, customizable badges), `StickyCartBar.tsx` (cart bar background, checkout button), and `ServiceModeSwitcher.tsx` (active mode toggle) to dynamically adopt store branding colors.

3. **Store Offline / Paused Experience**:
   - Created `CustomerStorePausedView.tsx` in `pos-user/app/components/customer/` with responsive layout, store logo, operating hours summary, store contact info, and clear "Store is Paused" notice.
   - In `CustomerOrderingHome.tsx`, immediately renders `CustomerStorePausedView` when `organization?.onlineStore === false`.

4. **Correct Storefront URL & QR Deep-Link Generation**:
   - Implemented `lib/storefrontUrl.ts` across both `pos-default` and `pos-user`.
   - Resolves canonical base URL dynamically:
     - Local development: `http://localhost:3002/store?store=${slug}`
     - Staging/dev shared domain: `https://dev-pos-user.get-prest.com/store?store=${slug}`
     - Production: Wildcard subdomain `https://${slug}.get-prest.com` or custom domain.
   - Updated `pos-default/app/components/OrganizationOnlineStore.tsx` Domain Pill, "Copy Storefront URL", and "Open Store" actions to use `getCanonicalStorefrontUrl`.
   - Synchronized QR code generation in `pos-default/convex/organizationQrCodes.ts` and `pos-user/convex/organizationQrCodes.ts` to build canonical QR URLs.

5. **POS Availability & Channel Payment Matrix Wiring**:
   - Bound Availability Tab toggles in `pos-default/app/components/OrganizationOnlineStore.tsx` to live organization fields `isDelivery`, `isTakeAway`, and `isDineIn`.
   - Bound Channel Payment Matrix toggles to `deliveryOnlinePayment`, `deliveryCashOnDelivery`, `takeAwayOnlinePayment`, `takeAwayCashPayment`, `dineinPrepaid`, and `dineinPospaid`.

---

## Phase 4 — Automated Test Suite & Validation Matrix

### Automated Vitest Results
- **`pos-user/convex/onlineStoreSync.test.ts`**:
  - `✓ 1. Synchronizes primaryColor, secondaryColor, theme, and onlineStore from POS to customer session`
  - `✓ 2. Blocks customer online orders when onlineStore is paused/disabled, while permitting POS cashier orders`
  - `✓ 3. Enforces strict multi-tenant isolation: Store A settings never leak into Store B`
  - `✓ 4. Generates canonical storefront URLs across Local, Dev, and Production environments`
- **`pos-user` Overall Test Suite**: 33 test files passed, 397 tests passed, 0 failures.
- **`pos-default/convex/organizationQrCodes.test.ts`**: 6/6 tests passed.
- **TypeScript Static Verification**:
  - `npx tsc --noEmit` in `pos-user`: Clean (0 errors).
  - `npx tsc --noEmit` in `pos-default`: Clean (0 errors).

---

## Phase 5 — Manual Verification Protocols

### Test Protocol 1: End-to-End Brand Color Change & Real-Time Reflection
1. Log into `pos-default` as a store manager or administrator.
2. Navigate to **Online Store Settings** (`/settings` or `/online-store`).
3. Select the **Branding & Appearance** tab.
4. Pick a distinctive Primary Color (e.g., `#059669` Emerald Green) and Secondary Color (e.g., `#10b981`), then select the "Modern" theme.
5. Click **Save Changes**. Verify that the save notification displays success and persistence is confirmed by Convex.
6. Open the customer storefront URL for this store in a separate browser tab or mobile viewport (e.g., `http://localhost:3002/store?store=<slug>`).
7. Observe that without a hard reload, the page mounts with `--store-primary: #059669`, the "ADD" buttons on product cards, category navigation pills, and sticky bottom cart bar immediately render in `#059669`.
8. Change the color in `pos-default` to `#4f46e5` (Indigo) and save. Observe the customer storefront reflect the updated styling seamlessly.

### Test Protocol 2: Storefront URL Generation and QR Deep-Link Resolution
1. In `pos-default` Online Store Settings, examine the **Storefront URL** pill at the top of the screen:
   - In local development mode (`NODE_ENV=development` or `window.location.hostname === "localhost"`), the URL resolves to `http://localhost:3002/store?store=<slug>`.
   - In production or when wildcard DNS is enabled, it resolves to `https://<slug>.get-prest.com`.
2. Click **Copy Storefront URL** and paste into your browser; verify that it lands directly on the customer storefront with the correct store context loaded.
3. Click **Open Store** button; verify that it opens the identical canonical URL in a new browser tab.
4. Navigate to **QR Codes** under POS Settings, generate a TakeAway or Dine-In QR code, and inspect the generated QR code URL. Verify that it targets the canonical customer storefront host and encodes the store and table parameters accurately.

