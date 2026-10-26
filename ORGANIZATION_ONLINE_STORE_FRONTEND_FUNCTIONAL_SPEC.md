# Organization Online Store & Public Customer Ordering Frontend Functional Specification

## 1. Executive Summary & Omnichannel Storefront Scope

The **Online Store Subsystem** in `pos-user` (running publicly at `{store-slug}.get-prest.com` or custom domains, mirrored in `pos-default` under `/settings?tab=onlineStore`) provides a mobile-first, high-conversion web ordering storefront for restaurant customers.

It empowers guests to browse live digital menus, configure item add-ons and cooking preferences, select between on-demand and scheduled fulfillment, pin precise GPS delivery addresses, and pay seamlessly via UPI, credit/debit cards, or Cash on Delivery (COD). Every online order flows in real time to the restaurant's Cashier POS terminal (`/cashier`), triggers Kitchen Display System (KDS) tickets, prints automated Kitchen Order Tickets (KOTs), and dispatches automated WhatsApp updates to the customer.

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                              PUBLIC CUSTOMER STOREFRONT (pos-user)                                │
│                     Mobile Web App: {store-slug}.get-prest.com / /store                           │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
                                                  ▼
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                  SERVICE MODE RESOLUTION ENGINE                                   │
│              [🛵 Doorstep Delivery]  •  [🥡 Counter Takeaway]  •  [🍽️ Dine-In QR Ordering]        │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
         ┌────────────────────────────────────────┼────────────────────────────────────────┐
         ▼                                        ▼                                        ▼
+──────────────────────────+             +──────────────────────────+             +──────────────────────────+
│   FULFILLMENT TIMING     │             │    DYNAMIC BILLING &     │             │    PAYMENT PROCESSING    │
│  • Express "Now" (25-35m)│             │       TAX ENGINE         │             │  • Razorpay UPI / Cards  │
│  • Advance Scheduled Slot│             │  • Inclusive/Exclusive   │             │  • Stripe International  │
│  • Operating Hours Guard │             │  • Item Modifiers & Tips │             │  • Cash on Delivery (COD)│
+──────────────────────────+             +──────────────────────────+             +──────────────────────────+
                                                  │
                                                  ▼
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                CONVEX REALTIME ORDER DISPATCH                                     │
│                     (Atomic mutations: orders.createOrder & getOrCreateCustomer)                  │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
         ┌────────────────────────────────────────┼────────────────────────────────────────┐
         ▼                                        ▼                                        ▼
+──────────────────────────+             +──────────────────────────+             +──────────────────────────+
│    CASHIER POS TERMINAL  │             │   KITCHEN DISPLAY (KDS)  │             │   3PL LOGISTICS / RIDER  │
│  • Instant Sound Alert   │             │  • Workstation Routing   │             │  • Porter Fleet Dispatch │
│  • Table / Delivery Card │             │  • KOT Station Printing  │             │  • Live GPS Map Tracking │
+──────────────────────────+             +──────────────────────────+             +──────────────────────────+
```

---

## 2. Architecture & Service Mode Matrix

The online store supports three primary fulfillment modes, each controlled by master toggles in `organizations`:

### 2.1 Service Modes & Fulfillment Channels

| Service Mode | Organization Schema Toggle | Description | Order Attribution |
|---|---|---|---|
| **Doorstep Delivery** | `isDelivery: true` | Prepared in kitchen and dispatched to customer's saved address via 3PL (Porter) or in-house driver. | `orderType: "Delivery"`, `userAddressId`, `deliveryAddress` |
| **Counter Takeaway / Pickup**| `isTakeAway: true` | Customer picks up packed order at store counter; ready token provided. | `orderType: "TakeAway"`, `tokenNumber` |
| **Dine-In Table QR Order** | `isDineIn: true` | Scanned from table QR sticker (`[tableToken]`); direct table ordering. | `orderType: "DineIn"`, `tableId`, `tableNumber` |
| **Scheduled Advance Order** | `scheduledPickup: true` or `scheduledDelivery: true` | Advance catering or future meal booking with date and 30-minute time slot selection. | `scheduledDeliveryDate`, `scheduledDeliveryTime` |

### 2.2 Payment Acceptance Matrix per Channel

The store administrator configures allowed payment methods per channel under `/settings?tab=onlineStore`:

```
+─────────────────────+───────────────────────────────────+────────────────────────────────────+
| Service Channel     | Cash / Offline Payment Toggle     | Online Gateway Payment Toggle      |
+─────────────────────+───────────────────────────────────+────────────────────────────────────+
| Doorstep Delivery   | `deliveryCashOnDelivery: boolean` | `deliveryOnlinePayment: boolean`   |
| Takeaway Pickup     | `takeAwayCashPayment: boolean`    | `takeAwayOnlinePayment: boolean`   |
| Dine-In Table Order | `dineinPospaid: boolean` (Post)   | `dineinPrepaid: boolean` (Prepaid) |
| Scheduled Pickup    | `scheduledPickupCashPayment`      | `scheduledPickupOnlinePayment`     |
| Scheduled Delivery  | `scheduledDeliveryCashPayment`    | `scheduledDeliveryOnlinePayment`   |
+─────────────────────+───────────────────────────────────+────────────────────────────────────+
```

* **Validation Invariant**: Every enabled service mode MUST have at least one payment toggle enabled. A channel cannot be offered to customers with zero payment options.

---

## 3. Customer Journey & Screen-by-Screen Breakdown

### 3.1 Screen 1: Storefront Home & Catalog Discovery (`/store`)

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  SPICE GARDEN BISTRO                                                   [ 🔍 Search ] [ 👤 Profile ]|
│  📍 12, Linking Road, Bandra West  •  ⭐ 4.8 (1.2k+ reviews)  •  🕒 Open: 11:00 AM – 11:30 PM      │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  SELECT SERVICE MODE:                                                                             │
│  [ 🛵 Delivery (35 min) ]       [ 🥡 Takeaway (20 min) ]       [ 🍽️ Dine-In (Table QR) ]           │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  PROMOTIONAL HERO CAROUSEL:                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  🎉 FLAT 20% OFF ON ORDERS ABOVE ₹499  •  Use Code: FESTIVE20                               │  │
│  │  Chef's Weekend Special: Tandoori Platter combo with 2 Mocktails                            │  │
│  └─────────────────────────────────────────────────────────────────────────────────────────────┘  │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  CATEGORY NAVIGATION: (Sticky Horizontal Scroll)                                                  │
│  [ All ] [ ⭐ Bestsellers ] [ Starters ] [ Main Course ] [ Breads & Rice ] [ Beverages ] [ Desserts ]|
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  MENU CATALOG (PRODUCT CARDS):                                                                    │
│                                                                                                   │
│  ┌─────────────────────────────────────────────────┬───────────────────────────────────────────┐  │
│  │ 🟢 Tandoori Paneer Tikka        ⭐ 4.9 (420)     │ 🔴 Butter Chicken           ⭐ 4.8 (890)   │  │
│  │ Char-grilled cottage cheese with mint chutney.  │ Tender chicken in rich tomato makhani.    │  │
│  │ ₹ 280.00                    [ ➕ ADD (Custom) ] │ ₹ 420.00              [ ➕ ADD (Custom) ] │  │
│  └─────────────────────────────────────────────────┴───────────────────────────────────────────┘  │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  🛒 STICKY BOTTOM CART BAR:   3 Items | ₹ 940.00                      [ View Cart / Checkout ➔ ] │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

#### Key Capabilities of Storefront Home
1. **Multi-Tenant Domain Resolution**: Automatically resolves store brand, theme, currency, and menu based on the subdomain (e.g. `spicegarden.get-prest.com`) or `?slug=spice-garden` query param.
2. **Service Mode Switcher (`ServiceModeSwitcher`)**: Seamless switching between Delivery, Takeaway, and Dine-In. Automatically validates store operational boundaries and updates delivery fee estimations.
3. **Filter Pills**: Real-time filtering by Dietary Preference (Veg Only, Non-Veg, Jain / No Onion-Garlic, Spicy Level) and instant typeahead search.
4. **Dynamic Stock Ribbons**: Real-time greyed-out state and *"Sold Out"* badge when kitchen 86s an item (`inStock: false` or `availableStock === 0`).

---

### 3.2 Screen 2: Product Customization & Modifier Modal (`ProductCustomizationModal`)

When a customer taps **"ADD"** on an item with configurable options:

```
+─────────────────────────────────────────────────────────────────────────+
| 🍲 Customize "Tandoori Paneer Tikka"                         [ ✕ Close ] |
| Base Price: ₹ 280.00                                                    |
+─────────────────────────────────────────────────────────────────────────+
| CHOOSE PORTION SIZE * (Select 1)                              REQUIRED  |
| (●) Regular Portion (6 pcs)                                  + ₹  0.00  |
| ( ) Large Sharing Platter (10 pcs)                           + ₹120.00  |
+─────────────────────────────────────────────────────────────────────────+
| SPICE LEVEL * (Select 1)                                      REQUIRED  |
| ( ) Mild          (●) Medium Spicy         ( ) Extra Hot                |
+─────────────────────────────────────────────────────────────────────────+
| EXTRA ADD-ONS (Optional - Select up to 3)                     OPTIONAL  |
| [✓] Extra Mint Chutney (100ml)                               + ₹ 30.00  |
| [ ] Extra Sliced Onions with Lemon                           + ₹ 20.00  |
| [✓] Garlic Butter Glaze                                      + ₹ 40.00  |
+─────────────────────────────────────────────────────────────────────────+
| CHEF PREPARATION NOTE (Optional)                                        |
| [ Less oil and well roasted, please!                                  ] |
+─────────────────────────────────────────────────────────────────────────+
| Quantity: [ - ]  2  [ + ]          Total: ₹ 700.00   [ Add to Cart ➔ ]  |
+─────────────────────────────────────────────────────────────────────────+
```

* **Repeat Customization Flow (`RepeatCustomizationModal`)**: If the user taps `+` on an item already in the cart with previous customizations, a prompt asks:
  - *"Repeat previous customization? (Regular, Medium Spicy, Extra Chutney)"* OR
  - *"Choose new customizations"*.

---

### 3.3 Screen 3: Delivery Location & Address Selector (`SelectDeliveryLocationView`)

Triggered when the customer chooses **Delivery** service mode:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  < Back to Store  |  SELECT DELIVERY LOCATION                                                     │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  [ 📍 Use Current GPS Location (High Accuracy)                                                   ]│
│  Detected: 14th Road, Khar West, Mumbai - 400052                                                  │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  SAVED ADDRESSES:                                                              [ ➕ Add New Address ]│
│                                                                                                   │
│  (●) [🏠 HOME - DEFAULT]                                                                          │
│      Flat 402, Silver Oak Residency, Linking Road, Bandra West, Mumbai - 400050                   │
│      📌 Instructions: "Leave at security gate with OTP"                                           │
│                                                                                                   │
│  ( ) [🏢 WORK]                                                                                    │
│      9th Floor, Tech Hub Tower B, BKC Complex, Bandra East, Mumbai - 400051                       │
│      📌 Instructions: "Call upon arrival at reception desk"                                       │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  COMPLETE ADDRESS DETAILS (FOR NEW / EDIT):                                                       │
│  House / Flat / Block No. *:     [ Flat 402, Building A                                          ]│
│  Apartment / Road / Area *:      [ Silver Oak Residency, Linking Road                            ]│
│  Landmark (Optional):            [ Near Bandra Police Station                                    ]│
│  Save Address As:                [ (●) Home    ( ) Work    ( ) Other                             ]│
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                                      [ Confirm Delivery Address ➔ ]               │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

* **Geocoding & Range Verification**: Validates the customer's coordinates (`latitude`, `longitude`) against store delivery radius limits (e.g. within 8 km) or triggers out-of-delivery-zone notices.

---

### 3.4 Screen 4: Advance Scheduling Timing Selector (`DeliveryTiming`)

Customers can choose immediate fulfillment or book an advance slot:

```
+─────────────────────────────────────────────────────────────────────────+
| 🕒 Choose Delivery Timing                                    [ ✕ Close ] |
+─────────────────────────────────────────────────────────────────────────+
| FULFILLMENT MODE:                                                       |
| [ ⚡ Now (Express: 25 - 35 mins) ]     [ 📅 Schedule for Later ]         |
+─────────────────────────────────────────────────────────────────────────+
| SELECT DATE: (Rolling 7-Day Window)                                     |
| [ Today (Oct 21) ]  [ Tomorrow (Oct 22) ]  [ Wed, Oct 23 ]  [ Thu, Oct 24 ]|
+─────────────────────────────────────────────────────────────────────────+
| AVAILABLE 30-MINUTE TIME SLOTS:                                         |
| • LUNCH SLOTS:                                                          |
|   [ 12:00 PM – 12:30 PM ]   [ 12:30 PM – 01:00 PM ]   [ 01:00 PM – 01:30 PM ] |
| • DINNER SLOTS:                                                         |
|   [ 07:30 PM – 08:00 PM ]   [ 08:00 PM – 08:30 PM ]   [ 08:30 PM – 09:00 PM ] |
+─────────────────────────────────────────────────────────────────────────+
| Selected: Tomorrow (Oct 22) between 08:00 PM – 08:30 PM                 |
|                                                    [ Confirm Timing ➔ ] |
+─────────────────────────────────────────────────────────────────────────+
```

* **Lead Time & Cutoff Rules (`deliveryTimingUtils.ts`)**:
  - Automatically disables past time slots and slots within the minimum kitchen prep buffer (`parseLeadTimeMinutes`, default 30–45 mins).
  - Respects store operating hours (`storeSchedule`) and weekly blackout days.

---

### 3.5 Screen 5: Cart & Checkout (`CustomerDeliveryCartView` / `CustomerTakeawayCartView`)

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  < Back to Menu  |  YOUR CART (3 ITEMS)                                                           │
+──────────────────────────────────────────────────┬────────────────────────────────────────────────+
│  ORDER ITEMS                                     │  BILL SUMMARY                                  │
│                                                  │                                                │
│  1x Tandoori Chicken Tikka              ₹ 340.00 │  Item Subtotal:                       ₹ 940.00 │
│     • Extra Spicy, Extra Chutney                 │  Delivery Fee:                        ₹  40.00 │
│     Quantity: [ - ] 1 [ + ]                      │  Packaging Charge:                    ₹  20.00 │
│                                                  │  Taxes (5% GST):                      + ₹ 47.00 │
│  1x Paneer Butter Masala                ₹ 380.00 │  Discount (FESTIVE20 applied):       - ₹ 188.00 │
│     Quantity: [ - ] 1 [ + ]                      │  Tip for Delivery Partner:           + ₹  30.00 │
│                                                  │  ───────────────────────────────────────────── │
│  4x Butter Garlic Naan                  ₹ 240.00 │  TOTAL PAYABLE:                       ₹ 889.00 │
│     Quantity: [ - ] 4 [ + ]                      │                                                │
+──────────────────────────────────────────────────┼────────────────────────────────────────────────+
│  DELIVERY ADDRESS:                               │  PAYMENT METHOD:                               │
│  Flat 402, Silver Oak Residency, Bandra West     │  (●) Pay Online (UPI / Card / NetBanking)      │
│  [ Change Address ]                              │  ( ) Cash on Delivery (COD)                    │
+──────────────────────────────────────────────────┴────────────────────────────────────────────────+
│  GUEST CONTACT: [ Aarav Kapoor                 ] [ +91 98765 43210                              ] │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                            [ PLACE ORDER & PAY ₹ 889.00 🚀 ]                      │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

### 3.6 Screen 6: Real-Time Order Tracking & Live Lifecycle (`CustomerDeliveryOrderTrackingView`)

Once an order is confirmed, the customer is routed to the live reactive tracking view:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  ORDER CONFIRMED!  •  #ORD-1042                                              [ 📞 Call Store ]    │
│  Estimated Arrival: 32 mins (08:45 PM)  •  Fulfillment: 🛵 Doorstep Delivery                      │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  LIVE ORDER LIFECYCLE PROGRESSION:                                                                │
│                                                                                                   │
│  [ ✓ ] 1. Order Placed ───────── 08:12 PM (Confirmed by Spice Garden Bistro)                     │
│  [ ✓ ] 2. In the Kitchen ─────── 08:14 PM (Chef is preparing your fresh meal)                     │
│  [ ● ] 3. Ready for Pickup ───── 08:26 PM (Packed & waiting for driver pickup)                   │
│  [   ] 4. Out for Delivery ───── Expected 08:32 PM (Rider on the way)                            │
│  [   ] 5. Delivered ──────────── Expected 08:45 PM                                                │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  🛵 DELIVERY PARTNER DETAILS:                                                                     │
│  Courier: Porter Express  •  Rider: Ramesh Kumar (⭐ 4.9)                                         │
│  Vehicle: Honda Activa (MH-02-CW-4921)                                                            │
│  [ 📞 Call Driver ]               [ 📍 View Live GPS Tracking Map ➔ ]                             │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  ORDER ITEMS SUMMARY (3 items):                                                                   │
│  • 1x Tandoori Chicken Tikka (Extra Spicy)                                                        │
│  • 1x Paneer Butter Masala                                                                        │
│  • 4x Butter Garlic Naan                                                                          │
│  Total Amount Paid: ₹ 889.00 (via UPI - Google Pay)                                               │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  [ 📥 Download Tax Invoice PDF ]                 [ 💬 Rate Your Order (Survey) ]                  │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 4. Payment Gateway Integration Architecture

### 4.1 Razorpay Payment Flow (`useRazorpayCheckout`)

```
   [ Customer Taps "Place Order & Pay" on Cart ]
                         │
                         ▼
   [ Mutation: orders.createOrder with paymentStatus: "Pending" ]
                         │
                         ▼
   [ Frontend Invokes Razorpay Standard Checkout Modal ]
   (Prefilled: Customer Name, Phone, Email, Amount in Paise)
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
   [ Payment Success ]               [ Payment Failure / Dismiss ]
        │                                 │
        ▼                                 ▼
   [ Handler: razorpay_payment_id ]  [ Display Error Banner ]
   [ Mutation: addOrderPayment ]     [ Retain Cart for Retry ]
   [ Order Transitions to "Paid" ]
```

### 4.2 Security & Idempotency Rules
1. **Minor Units Currency**: All financial amounts are calculated and stored in **minor units** (paise/cents: ₹ 889.00 = `88900`) to eliminate floating-point calculation errors.
2. **Customer Identity Upsert**: Automatically invokes `customers.getOrCreateCustomer` upon checkout. If the guest has ordered before, the order is attached to their existing profile and address book.
3. **Webhook Verification**: Production payments are verified server-side via cryptographic signature validation (`razorpay_signature` / Stripe webhook secret).

---

## 5. Convex API Backend Contracts

### 5.1 Storefront Discovery & Menu Queries

#### 1. `organizations.getBySlug`
* **Type**: `query` (Public Unauthenticated)
* **Args**: `{ slug: string }`
* **Response**: Full `CustomerOrganization` record including branding, currency, operating hours, delivery toggles, and payment policies.

#### 2. `menu.getCustomerMenu`
* **Type**: `query` (Public Unauthenticated)
* **Args**: `{ organizationId: Id<"organizations"> }`
* **Response**:
  ```typescript
  Array<{
    category: {
      id: string,
      name: string,
      position: number,
      imageUrl?: string,
      items: Array<{
        category_item_id: string,
        item: CustomerMenuItem,
        customizations: CustomizationGroup[]
      }>
    }
  }>
  ```

---

### 5.2 Order Placement & Tracking Endpoints

#### 1. `orders.createOrder`
* **Type**: `mutation` (Public / Customer Authenticated)
* **Args**:
  ```typescript
  {
    organizationId: Id<"organizations">,
    orderSource: "Online" | "QR" | "WebStore",
    orderType: "Delivery" | "TakeAway" | "DineIn",
    customerId?: Id<"customers">,
    customerName?: string,
    customerPhone: string,
    customerEmail?: string,
    subTotal: number,            // Minor units (paise)
    taxTotal: number,            // Minor units
    discountAmount?: number,     // Minor units
    deliveryCharge?: number,     // Minor units
    totalAmount: number,         // Minor units
    userAddressId?: Id<"userAddresses">,
    deliveryAddress?: {
      addressLine1: string,
      addressLine2?: string,
      landmark?: string,
      city: string,
      zipCode: string,
      addressType?: string,
      latitude?: number,
      longitude?: number
    },
    scheduledDeliveryDate?: string, // e.g. "2026-10-22"
    scheduledDeliveryTime?: string, // e.g. "08:00 PM – 08:30 PM"
    paymentMode: "Razorpay" | "Stripe" | "Cash on Delivery" | "Counter Cash",
    paymentStatus: "Pending" | "Paid",
    specialNotes?: string,
    items: Array<{
      itemId: Id<"items">,
      itemName: string,
      itemPrice: number,
      quantity: number,
      totalPrice: number,
      customizations?: Array<{
        customizationId: Id<"customizations">,
        customizationName: string,
        optionId: Id<"customizationItems">,
        optionName: string,
        price: number
      }>
    }>
  }
  ```
* **Validation**: Validates operating hours, schedule time slot, minimum order amount, and mandatory item modifiers.
* **Response**: `{ orderId: Id<"orders">, orderNumber: string, tokenNumber: string }`

#### 2. `orders.getOrderById`
* **Type**: `query` (Customer / Staff)
* **Args**: `{ orderId: Id<"orders"> }`
* **Response**: Complete order document, line items, live workflow status, delivery driver coordinates, and invoice PDF URLs.

---

## 6. Frontend Component Hierarchy (`pos-user/app/`)

```
pos-user/app/
├── store/
│   ├── page.tsx                               // Storefront Home Page (Subdomain Router)
│   └── cart/page.tsx                          // Dedicated Full-Page Cart
├── order/
│   ├── [tableToken]/page.tsx                  // QR Dine-In Table Ordering Route
│   └── page.tsx                               // Customer Order Tracking & History Route
└── components/customer/
    ├── CustomerOrderingHome.tsx               // Main Catalog, Hero Banners & Menu Grid
    ├── ServiceModeSwitcher.tsx                // Delivery / Takeaway / Dine-In Toggle
    ├── MenuCategoryScroll.tsx                 // Sticky Horizontal Category Scroll
    ├── ProductCard.tsx                        // Item Card with Veg Icon, Price & Add Button
    ├── ProductCustomizationModal.tsx          // Modifier Groups, Add-Ons & Cooking Notes
    ├── RepeatCustomizationModal.tsx           // Quick Re-Add Previous Modifier Prompt
    ├── SelectDeliveryLocationView.tsx         // GPS Geolocation & Saved Address Selector
    ├── DeliveryTiming.tsx                     // Now vs Scheduled Advance Slot Picker
    ├── CustomerDeliveryCartView.tsx           // Delivery Checkout with Itemized Bill
    ├── CustomerTakeawayCartView.tsx           // Takeaway Pickup Checkout
    ├── CustomerOrderTrackingView.tsx          // Live Status Stepper & Progress Tracker
    ├── CustomerDeliveryOrderTrackingView.tsx  // Porter 3PL Driver Info & Map View
    ├── CustomerAuthModal.tsx                  // Mobile OTP Login & Profile Management
    ├── CustomerOrdersHistoryView.tsx          // Past Orders & 1-Click Reorder Ledger
    └── CustomerCartContext.tsx                // Global Cart State, Tax Math & LocalStorage Sync
```

---

## 7. Quality Assurance & Sign-off Checklist

- [x] **Omnichannel Service Mode Gating**: Storefront dynamically toggles Delivery, Takeaway, and Dine-In based on `organizations` configuration.
- [x] **Advance Scheduling Engine**: Complete slot validation (`validateScheduledOrderSlot`) preventing past bookings and respecting store lead-time buffers.
- [x] **Precise Minor Units Financials**: Zero floating-point rounding errors across subtotal, discounts, packaging fees, CGST/SGST taxes, and tips.
- [x] **Multi-Gateway Checkout**: Full integration with Razorpay (UPI, Cards, NetBanking), Stripe, and Cash on Delivery.
- [x] **Idempotent Customer Profiles**: Automatically updates guest contact info and delivery address books via `customers.getOrCreateCustomer`.
- [x] **Real-Time POS & KDS Synchronization**: Online orders immediately populate Cashier billing queues, KDS preparation screens, and station KOT printers.
- [x] **Live 3PL Courier Tracking**: Displays driver assignment, vehicle registration, and tracking URLs.
