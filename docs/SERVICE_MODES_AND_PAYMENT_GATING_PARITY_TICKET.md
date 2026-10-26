# 🎫 DEVELOPER TICKET & IMPLEMENTATION SPEC: Service Modes & Payment Gating Parity

> **Target Systems**: 
> 1. `pos-default` (POS Management, Terminal Cashier & Settings)
> 2. `pos-user` (Customer Digital Storefront Web App)
> **Backend Service**: Convex (`convex/orders.ts`, `convex/organizations.ts`, `convex/postpaidOrderRequests.ts`)  
> **Source Parity Reference**: Legacy `defx-pos-frontend` & `defx-pos-users`  
> **Priority**: P1 (High Operational Integrity)  
> **Status**: Ready for Implementation  

---

## 📌 Executive Summary

In restaurant operations, store managers toggle **Service Modes** (`Dine in`, `Takeaway`, `Delivery`, `Scheduled delivery`, and `Scheduled pickup`) and their associated **Payment Modes** (Prepaid vs Postpaid, Online vs Cash) in **Settings → Features → Service Modes**.

While the new **Convex backend schema** and **QR Code Management** screens in `pos-default` already respect these settings, several critical UI and validation gaps exist between the new codebase and the legacy systems (`defx-pos-frontend` and `defx-pos-users`). Disabled service modes and payment types are not yet dynamically hiding or disabling corresponding controls in the **POS Cashier Terminal** and the **Customer Storefront**.

This ticket outlines the exact requirements, files to update, and acceptance criteria to achieve complete functional parity.

---

## 🔍 Parity Gap Analysis Matrix

| Feature / Setting | Legacy Implementation (`defx-pos-frontend` & `defx-pos-users`) | Current Implementation (`pos-default` & `pos-user`) | Gap Status |
| :--- | :--- | :--- | :--- |
| **Settings UI** | MUI Accordions with Checkboxes for 5 modes + sub-switches. | Modern Tailwind/Next.js accordion switches with channel guards. | ✅ **Complete** |
| **QR Code Management** | Separate tabs / links. | Dynamically hides Dine-in, Takeaway, and Delivery QR tabs when disabled. | ✅ **Complete** |
| **Cashier: Order Type Buttons** | Disables "Table" tab if `is_dine_in` is false (`disabledScreen`). Fallbacks to direct cart. | Renders `Dine In`, `Takeaway`, and `Scheduled` buttons statically without checking `activeOrg`. | ⚠️ **Gap: Missing dynamic disable/hide** |
| **Cashier: Payment Methods** | Payment options gated by mode (Cash/Online/Postpaid). | Payment options in Cashier checkout dialog do not strictly filter by `activeOrg` payment flags. | ⚠️ **Gap: Missing payment method gating** |
| **POS Navigation & Tables** | Disables `/settings/tables` sidebar link if `is_dine_in` is false. Disables `/captain` waiter module. | Tables settings and management routes remain enabled regardless of `isDineIn`. | ⚠️ **Gap: Missing sidebar/route guard** |
| **Customer Storefront: Mode Switcher** | Cart tabs conditionally hidden via `<ConditionalView visible={getOrderTypeAvailabel(...)?.is_open}>`. | `ServiceModeSwitcher.tsx` renders all 3 buttons (`Delivery`, `Dine In`, `Take Away`) unconditionally. | ⚠️ **Gap: Missing customer mode filtering** |
| **Customer Storefront: Scheduled Orders** | Rendered "Scheduled pickup" tab in cart with date/time slot picker if `scheduled_pickup` is enabled. | Missing "Scheduled Pickup" in storefront `ServiceModeSwitcher`. | ⚠️ **Gap: Scheduled mode missing in storefront** |
| **Customer Storefront: Checkout Payment** | Checkout buttons dynamically gated: `isCash` and `isOnline` per order type. | Payment options in storefront do not check `takeAwayCashPayment`, `dineinPrepaid`, etc. | ⚠️ **Gap: Missing storefront payment gating** |
| **Convex Backend Order Creation** | Server-side validation rejecting disabled modes. | Gated for postpaid table requests, but `orders.ts` `createOrder` lacks explicit service mode guards. | ⚠️ **Gap: Missing mutation guards in `orders.ts`** |

---

## 🛠️ Detailed Implementation Work Packages

### Work Package 1: POS Cashier Terminal (`pos-default`)
**Target File**: [`app/cashier/page.tsx`](file:///c:/Workspace/pos-default/app/cashier/page.tsx)

#### Requirements:
1. **Dynamic Service Mode Buttons (Lines ~3570 - 3730)**:
   * Inspect `activeOrg.isDineIn`, `activeOrg.isTakeAway`, `activeOrg.isDelivery`, `activeOrg.scheduledPickup`, and `activeOrg.scheduledDelivery`.
   * **Dine In**:
     * If `activeOrg.isDineIn === false`:
       * Hide or disable the **Dine In** button.
       * If active cart currently has `orderType === "DineIn"`, auto-switch the cart's `orderType` to the first available mode (`TakeAway` or `Delivery`).
       * Disable table floor plan / table assignment modal opening.
   * **Takeaway**:
     * If `activeOrg.isTakeAway === false`:
       * Hide or disable the **Takeaway** button.
   * **Scheduled**:
     * If both `activeOrg.scheduledPickup === false` and `activeOrg.scheduledDelivery === false`:
       * Hide or disable the **Scheduled** button.
2. **Checkout Payment Methods Gating**:
   * In the Cashier payment checkout modal / tender dialog:
     * When `activeCart.orderType === "DineIn"`:
       * Only allow "Prepaid" (Pay Now) if `activeOrg.dineinPrepaid !== false`.
       * Only allow "Postpaid" (Pay Later / Settle at Table) if `activeOrg.dineinPospaid !== false`.
     * When `activeCart.orderType === "TakeAway"`:
       * Only allow "Cash" if `activeOrg.takeAwayCashPayment !== false`.
       * Only allow "Online / UPI QR" if `activeOrg.takeAwayOnlinePayment !== false`.
     * When `activeCart.orderType === "Delivery"`:
       * Only allow "Cash on Delivery" if `activeOrg.deliveryCashOnDelivery !== false`.
       * Only allow "Online / Pre-paid" if `activeOrg.deliveryOnlinePayment !== false`.

---

### Work Package 2: POS Settings & Navigation Gating (`pos-default`)
**Target Files**: 
* `app/components/Sidebar.tsx` (or dashboard shell layout)
* `app/settings/page.tsx` / `app/components/OrganizationTables.tsx`

#### Requirements:
1. When `activeOrg.isDineIn === false`:
   * In navigation and settings menus, the **Tables / Floor Plan** navigation link should either be hidden or visually disabled with a badge/tooltip: *"Dine-in is disabled in Features Settings"*.
   * Prevent staff from starting dine-in table sessions when Dine-in is toggled off.

---

### Work Package 3: Customer Storefront Service Mode Switcher (`pos-user`)
**Target File**: [`app/components/customer/ServiceModeSwitcher.tsx`](file:///c:/Workspace/pos-user/app/components/customer/ServiceModeSwitcher.tsx)

#### Requirements:
1. **Dynamic Mode Filtering**:
   * `ServiceModeSwitcher` receives `organization: CustomerOrganization`.
   * Filter available modes based on organization capabilities:
     ```tsx
     const availableModes = [
       { key: "dine_in", label: "Dine In", enabled: organization?.isDineIn !== false },
       { key: "takeaway", label: "Take Away", enabled: organization?.isTakeAway !== false },
       { key: "delivery", label: "Delivery", enabled: organization?.isDelivery !== false },
     ].filter(m => m.enabled);
     ```
   * Only render pill buttons for modes where `enabled` is `true`.
2. **Auto-fallback on Disabled Active Mode**:
   * If a customer arrives via a Dine-In URL or previous session with `serviceMode === "dine_in"`, but `organization.isDineIn === false`, auto-switch `serviceMode` to the first available enabled mode (e.g. `"takeaway"`).
3. **Scheduled Pickup Mode Support**:
   * If `organization.scheduledPickup === true`, include Scheduled Pickup in the customer fulfillment selector, opening the advance date and slot picker.

---

### Work Package 4: Customer Checkout Payment Gating (`pos-user`)
**Target Files**: 
* `app/components/customer/CustomerTakeawayCartView.tsx`
* `app/components/customer/CustomerDeliveryOrderTrackingView.tsx`
* Customer payment dialog components in `pos-user`

#### Requirements:
1. **Payment Method Filtering**:
   * When placing a Takeaway order:
     * Show "Cash on Counter" button only if `organization.takeAwayCashPayment !== false`.
     * Show "Pay Online (UPI / Card)" button only if `organization.takeAwayOnlinePayment !== false`.
   * When placing a Dine-In order:
     * Show "Pay at Counter / Postpaid" only if `organization.dineinPospaid !== false`.
     * Show "Pay Now" only if `organization.dineinPrepaid !== false`.
   * When placing a Delivery order:
     * Show "Cash on Delivery" only if `organization.deliveryCashOnDelivery !== false`.
     * Show "Pay Online" only if `organization.deliveryOnlinePayment !== false`.

---

### Work Package 5: Convex Backend Transaction Guards (`pos-default` & `pos-user`)
**Target File**: [`convex/orders.ts`](file:///c:/Workspace/pos-default/convex/orders.ts)

#### Requirements:
In `createOrder` mutation handler, validate `orderType` against the store's current organization record:
```ts
const org = await ctx.db.get(args.organizationId);
if (!org) throw new Error("Store organization not found.");

if (args.orderType === "DineIn" && org.isDineIn === false) {
  throw new Error("Dine-in orders are currently disabled for this restaurant.");
}
if (args.orderType === "TakeAway" && org.isTakeAway === false) {
  throw new Error("Takeaway orders are currently disabled for this restaurant.");
}
if (args.orderType === "Delivery" && org.isDelivery === false) {
  throw new Error("Delivery orders are currently disabled for this restaurant.");
}
if (args.orderType === "ScheduledPickup" && org.scheduledPickup === false) {
  throw new Error("Scheduled pickup orders are currently disabled for this restaurant.");
}
if (args.orderType === "ScheduledDelivery" && org.scheduledDelivery === false) {
  throw new Error("Scheduled delivery orders are currently disabled for this restaurant.");
}
```

---

## ✅ Acceptance Criteria & Test Plan

1. **Cashier Terminal**:
   * Turn OFF `Dine in` in Settings → Verify `Dine In` button is hidden/disabled in Cashier; carts with Dine-in auto-switch to Takeaway.
   * Turn OFF `Takeaway` in Settings → Verify `Takeaway` button is hidden/disabled.
   * Turn OFF `Scheduled pickup` and `Scheduled delivery` → Verify `Scheduled` button is hidden/disabled.
   * Turn OFF Cash payment for Takeaway → Verify Cash payment option is hidden in cashier payment tender for takeaway.
2. **Customer Storefront (`pos-user`)**:
   * Open customer menu on mobile/desktop.
   * Turn OFF `Delivery` in POS settings → Verify Delivery pill disappears from `ServiceModeSwitcher`.
   * Turn OFF `Dine in` in POS settings → Verify Dine-in disappears and customer is defaulted to Takeaway.
   * Verify customer cannot select disabled payment methods at checkout.
3. **Backend Guards**:
   * Send a direct API call or mutation for a disabled `orderType` → Verify Convex transaction fails with descriptive error message.
