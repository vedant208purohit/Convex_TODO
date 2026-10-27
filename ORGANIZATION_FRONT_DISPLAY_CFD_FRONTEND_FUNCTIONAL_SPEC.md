# Organization Customer Front Display (CFD) Frontend Functional Specification

## 1. Executive Summary & Domain Scope

The **Customer Front Display (CFD) Subsystem** (also known as the **Customer-Facing Display**, **Secondary Counter Screen**, or **Pole Display**) in `pos-default` (`/front-display` and `/settings?tab=frontDisplay`) powers the secondary screen facing patrons at the physical cash billing counter.

In dual-screen commercial POS terminals (such as Sunmi T2, Elo Touch, Posiflex, Windows/macOS dual-monitor setups) or paired counter-top tablets (iPads, Android tablets), the Front Display provides transparent, real-time visual feedback to customers as cashiers ring up orders.

### 1.1 Core Operational Objectives
1. **Transaction Transparency**: Live item-by-item cart mirroring showing item names, quantities, customizations/modifiers, unit prices, discounts, taxes (CGST/SGST/VAT), and total payable amount.
2. **Promotional Brand Engagement**: High-impact rotating promotional banners and marketing media (`organizationCarouselScreens`) during idle intervals and split-screen billing.
3. **Contactless Dynamic Payment QR Code**: Instant rendering of dynamic UPI QR codes (Google Pay, PhonePe, Paytm, BHIM) and Razorpay/Stripe QR codes containing the exact bill amount, speeding up checkout times.
4. **Instant Post-Dine Feedback Capture**: On-screen touch 5-star rating and Net Promoter Score (NPS) surveys integrated directly with `surveys` and `surveyAttempts`.
5. **Digital E-Receipt Dispatch**: 1-touch WhatsApp / SMS e-receipt prompt eliminating paper receipt waste.

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                           CASHIER BILLING TERMINAL (/cashier)                                     │
│               Cashier adds items, alters quantities, applies discounts & tenders cash             │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
                 ┌────────────────────────────────┴────────────────────────────────┐
                 ▼ (Local Dual-Screen)                                             ▼ (Network Paired Tablet)
   +───────────────────────────────+                                 +───────────────────────────────+
   │   BroadcastChannel API        │                                 │   Convex Realtime / WebSocket │
   │   (Zero-latency local IPC)    │                                 │   (`organizationBotTokens`)   │
   +───────────────────────────────+                                 +───────────────────────────────+
                 │                                                                 │
                 └────────────────────────────────┬────────────────────────────────┘
                                                  │
                                                  ▼
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                        CUSTOMER FRONT DISPLAY SCREEN (/front-display)                             │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                                                                                   │
│  [ STATE 1: IDLE / WELCOME ]         [ STATE 2: ACTIVE CART ]       [ STATE 3: PAYMENT QR ]       │
│  • Brand Logo & Welcome Greeting     • Live Ringing Cart Items      • Dynamic Amount UPI QR Code  │
│  • Fullscreen Promo Carousel         • Modifiers & Price Breakdown  • Tendered vs Change Due      │
│  • Daily Specials & Happy Hour       • Running Subtotal & Taxes     • Instant Payment Confirmation│
│                                                                                                   │
│                              [ STATE 4: POST-PAYMENT & FEEDBACK ]                                 │
│                              • Token Number & Pickup Callout (#12)                                │
│                              • Touch 5-Star Experience Survey Rating                              │
│                              • WhatsApp E-Receipt Mobile Input                                    │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Hardware Topology & Synchronization Protocols

The Front Display supports two synchronization pipelines depending on store hardware architecture:

### 2.1 Pipeline A: Local Dual-Screen POS (Zero-Latency Browser IPC)
For POS hardware where the customer display is an integrated secondary monitor (connected via internal HDMI/eDP or USB-C):
* **Technology**: Web `BroadcastChannel` API (`new BroadcastChannel("pos_front_display_channel")`) supplemented by `localStorage` window events.
* **Latency**: $< 16\text{ ms}$ (60 FPS real-time rendering without internet dependency).
* **Launch Mechanism**: Cashier terminal provides a 1-click **"Launch Customer Display"** button that opens `/front-display` in a secondary browser window and positions it on the secondary display screen.

### 2.2 Pipeline B: Network-Paired Wireless Counter Tablet (Cloud Sync)
For installations where an iPad, Android tablet, or counter-top smart display is positioned on the counter wirelessly:
* **Technology**: Convex real-time reactive subscription (`frontDisplay.getActiveSession`) authenticated via `organizationBotTokens`.
* **Pairing**: Cashier terminal generates a 6-digit numeric pairing PIN or QR code that the tablet scans once to bind to the specific cashier register session (`registerId` / `terminalId`).
* **Heartbeat & Status**: The tablet transmits periodic heartbeats (`lastSeenAt`) so the cashier UI displays a green **"CFD Connected"** badge.

### 2.3 Hardware Form Factor Adaptations
* **16:9 Widescreen (1920x1080 / 1366x768)**: Split layout (40% promotional banner media on the left, 60% itemized bill on the right).
* **4:3 Standard Display (1024x768)**: Stacked or condensed two-column layout.
* **10.1" Counter Tablets (1280x800)**: Touch-optimized large buttons for customer tip selection, loyalty phone entry, and survey ratings.
* **Legacy VFD Line Display (2x20 Characters)**: Optional fallback driver dispatching serial ESC/POS character strings (Line 1: Item Name, Line 2: Price & Running Total).

---

## 3. Screen States & Interactive UI Wireframes

### 3.1 State 1: Idle / Welcome Standby Screen

Rendered whenever the cashier has no active order open in the POS:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                    SPICE GARDEN BISTRO                                            │
│                             12, Linking Road, Bandra West, Mumbai                                 │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                                                                                   │
│                           [ HIGH DEFINITION PROMOTIONAL CAROUSEL ]                                │
│                                                                                                   │
│                             "Chef's Weekend Special Platter"                                      │
│                               Tandoori Feast + 2 Mocktails                                        │
│                                    Just ₹ 499 (Save 25%)                                          │
│                                                                                                   │
│                     [ Slide 1 ]  •  [ Slide 2 ]  •  [ Slide 3 ]  •  [ Slide 4 ]                    │
│                                                                                                   │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│ 🕒 08:32 PM  •  Welcome to Spice Garden! Fresh, authentic dining made to order.                    │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

* **Content**: Rotating promotional graphics from `organizationCarouselScreens` with smooth cross-fade animation every 8 seconds.
* **Store Branding**: Restaurant logo, brand slogan, Wi-Fi credentials ("Guest Wi-Fi: SpiceGarden_Guest"), and social media handles (`@spicegardenbistro`).

---

### 3.2 State 2: Active Transaction & Live Cart Mirroring

Triggered the instant the cashier selects a table, starts a walk-in order, or scans/adds the first line item:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  SPICE GARDEN BISTRO  •  Order #ORD-1042  •  Table T-04                       Server: Rajesh K    │
+────────────────────────────────────────┬──────────────────────────────────────────────────────────+
│                                        │  ITEM NAME                    QTY     PRICE      TOTAL   │
│         CURRENT PROMOTION              ├──────────────────────────────────────────────────────────┤
│                                        │  Tandoori Chicken Tikka        2x    ₹ 340.00   ₹ 680.00 │
│    [ Promotional Carousel Slide ]      │    • Customization: Extra Spicy                          │
│                                        │                                                          │
│     "Add a Virgin Mojito to your       │  Paneer Butter Masala          1x    ₹ 380.00   ₹ 380.00 │
│      meal for only ₹ 99 today!"        │    • Note: Less Butter                                   │
│                                        │                                                          │
│                                        │  Butter Garlic Naan            4x     ₹ 60.00   ₹ 240.00 │
│                                        │                                                          │
│                                        │  Mineral Water (1L)            2x     ₹ 40.00    ₹ 80.00 │
│                                        ├──────────────────────────────────────────────────────────┤
│                                        │  Items Subtotal (4 items):                     ₹ 1,380.00│
│                                        │  Discount (PROMO10 applied - 10%):           - ₹  138.00│
│                                        │  Taxes (CGST 2.5% + SGST 2.5%):              + ₹   62.10│
│                                        │  Packaging / Delivery Fee:                   + ₹    0.00│
│                                        ├──────────────────────────────────────────────────────────┤
│                                        │  TOTAL PAYABLE AMOUNT:                         ₹ 1,304.00│
+────────────────────────────────────────┴──────────────────────────────────────────────────────────+
│ 💡 Guest: Aarav Kapoor (+91 98765 43210)  •  Loyalty Points Available: 140 pts                    │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

#### Key Elements on Cart Mirror
1. **Line-Item Highlighting**: When a new item is punched, it enters with a subtle green pulse animation at the top or bottom of the list.
2. **Quantity and Customizations**: Clear display of item modifiers (e.g. *Less Butter, Extra Spicy, Gluten-Free*) ensuring the customer confirms their kitchen preferences.
3. **Discount Clarity**: Explicit line showing discount name and deduction amount (e.g. `- ₹ 138.00`), providing positive reinforcement.
4. **Tax Transparency**: Clear breakout of applicable local taxes (CGST, SGST, VAT) preventing customer bill shock.
5. **Customer Loyalty Banner**: Displays recognized customer name and available reward balance if customer was identified in POS.

---

### 3.3 State 3: Payment & Contactless Dynamic QR Code

When the cashier opens the payment modal and chooses **UPI / QR Code**:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                     PAYMENT SETTLEMENT                                            │
+────────────────────────────────────────┬──────────────────────────────────────────────────────────+
│                                        │                                                          │
│          SCAN & PAY VIA UPI            │                  ORDER PAYMENT SUMMARY                   │
│                                        │                                                          │
│        ┌─────────────────────┐         │  Order Reference:             #ORD-1042                  │
│        │ █▀▀▀▀▀█ ▄ █ █▀▀▀▀▀█ │         │  Table:                       Table T-04                 │
│        │ █ ███ █ █▄█ █ ███ █ │         │  Items:                       4 items (9 units)          │
│        │ █▀▀▀▀▀█ █▀█ █▀▀▀▀▀█ │         │  Subtotal:                    ₹ 1,380.00                 │
│        │ ▄▄▄▄▄ ▄ ▄▄█ ▄ ▄▄▄▄▄ │         │  Discount:                  - ₹   138.00                 │
│        │ █ █▀▀ █▄█▄█ █ █▀▀ █ │         │  Taxes:                     + ₹    62.10                 │
│        │ █▀▀▀▀▀█ ▄▄█ █▀▀▀▀▀█ │         │  ───────────────────────────────────────                 │
│        └─────────────────────┘         │  AMOUNT TO PAY:               ₹ 1,304.00                 │
│                                        │                                                          │
│     Accepts Google Pay, PhonePe,       │  Status: 🟡 Awaiting payment scan...                     │
│         Paytm, BHIM, Cred              │                                                          │
+────────────────────────────────────────┴──────────────────────────────────────────────────────────+
│ 🔒 Secure Encrypted Payment  •  Payment automatically verifies upon bank confirmation              │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

#### Cash Settlement Mode (When Cash Tendered)
If the customer pays with cash, the payment pane shifts to high-contrast Cash Reconciliation:
```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  TOTAL DUE: ₹ 1,304.00   |   CASH TENDERED: ₹ 2,000.00   |   🟢 CHANGE DUE: ₹ 696.00              │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

### 3.4 State 4: Post-Payment Confirmation, Token Callout & Survey

When the payment completes successfully:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                  ✅ PAYMENT SUCCESSFUL!                                           │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                                                                                   │
│                                 YOUR ORDER TOKEN NUMBER IS:                                       │
│                                                                                                   │
│                                     ╔═════════════════════╗                                       │
│                                     ║      TOKEN #12      ║                                       │
│                                     ╚═════════════════════╝                                       │
│                              Please collect your order at the counter                             │
│                                                                                                   │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│ 💬 HOW WAS YOUR EXPERIENCE TODAY?                                                                 │
│                                                                                                   │
│      [ ★ ]          [ ★ ]          [ ★ ]          [ ★ ]          [ ★ ]                            │
│     1 - Poor       2 - Fair       3 - Good      4 - Great     5 - Excellent!                      │
│                                                                                                   │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│ 📱 GET DIGITAL RECEIPT ON WHATSAPP:  [ +91 98765 43210             ] [ 📤 Send Receipt ]          │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│ Returning to home screen in 8 seconds...                                            [ Done (X) ]  │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

* **Instant Star Rating**: Directly records a 1-tap rating via `surveys.submit` into `surveyAttempts` tied to the settled `orderId`.
* **WhatsApp E-Receipt**: Pre-filled with customer phone number if known; guest can alter and tap **"Send Receipt"** to trigger automated PDF dispatch via WhatsApp integration.
* **Auto-Reset Countdown**: Visual progress bar counts down from 8 seconds before returning the display to **State 1 (Idle)**.

---

## 4. Real-Time Broadcast State Architecture

### 4.1 Client-Side Broadcast Payload (`pos_front_display_channel`)

When Cashier POS mutates the local bill, it dispatches an atomic payload:

```typescript
export interface FrontDisplayBroadcastPayload {
  organizationId: string;
  storeName: string;
  terminalId: string;
  cashierName: string;
  state: "idle" | "ringing" | "payment_qr" | "cash_tender" | "completed";
  orderNumber?: string;
  tokenNumber?: string;
  tableNumber?: string;
  customer?: {
    name?: string;
    phone?: string;
    loyaltyPoints?: number;
  };
  cartItems: Array<{
    itemId: string;
    name: string;
    quantity: number;
    unitPrice: number;       // Minor units (paise/cents)
    totalPrice: number;      // Minor units
    customizations?: Array<{
      groupName: string;
      optionName: string;
      price: number;
    }>;
    notes?: string;
  }>;
  totals: {
    subTotal: number;         // Minor units
    discountAmount: number;   // Minor units
    taxTotal: number;         // Minor units
    deliveryCharge: number;   // Minor units
    totalAmount: number;      // Minor units
  };
  payment?: {
    mode: "UPI" | "Cash" | "Card" | "Other";
    dynamicQrString?: string; // UPI URI: upi://pay?pa=store@upi&pn=...&am=1304.00
    qrImageUrl?: string;
    tenderedAmount?: number;
    changeDue?: number;
    status: "Pending" | "Paid" | "Failed";
  };
  survey?: {
    surveyId?: string;
    questionText?: string;
    questionType?: string;
  };
  timestamp: number;
}
```

---

## 5. Admin Settings Configuration (`/settings?tab=frontDisplay`)

```
+-----------------------------------------------------------------------------------------------------------------------+
|  ⚙️ Settings > Customer Front Display (CFD)                                             [ 💾 Save Changes ]             |
|  Configure customer-facing counter monitors, dual-screen cart mirroring, and dynamic QR payments.                    |
+-----------------------------------------------------------------------------------------------------------------------+
|  GENERAL DISPLAY SETTINGS                                                                                             |
|  Customer Front Display Enabled:        (●) Enabled   ( ) Disabled                                                    |
|  Display Mode Layout:                   (●) Split (40% Media Carousel + 60% Cart)                                     |
|                                         ( ) Fullscreen Cart Only                                                      |
|                                         ( ) Media Only (Digital Menu Board)                                           |
|  Theme Styling:                         (●) Minimalist Light   ( ) Modern Dark   ( ) Brand Warm Palette               |
+-----------------------------------------------------------------------------------------------------------------------+
|  PAYMENT & DYNAMIC QR CONFIGURATION                                                                                   |
|  Show Dynamic UPI QR on Screen:         [✓] Enabled                                                                   |
|  Store UPI VPA Address:                 [ spicegardenbistro@hdfcbank                                                ] |
|  Merchant Display Name:                 [ Spice Garden Bistro Bandra                                                ] |
|  Show Cash Tendered & Change Due:       [✓] Enabled (High-contrast green banner)                                      |
+-----------------------------------------------------------------------------------------------------------------------+
|  POST-PAYMENT & FEEDBACK WORKFLOW                                                                                     |
|  Show Post-Dining Star Rating Survey:   [✓] Enabled (Integrated with Active Survey)                                   |
|  Show WhatsApp E-Receipt Box:           [✓] Enabled                                                                   |
|  Auto-Reset Dwell Time:                 [ 8 Seconds                                                                 ▼ ] |
+-----------------------------------------------------------------------------------------------------------------------+
|  CONNECTED CFD SCREENS (NETWORK TABLETS)                                               [ ➕ Pair New Counter Tablet ]   |
|  • Counter 1 Main Dual-Screen (Local Display) ─── 🟢 Active (Zero-latency IPC)           [ Launch Screen ] [ Test Ping ]|
|  • Counter 2 Secondary Tablet (iPad Mini)    ─── 🟢 Online (Heartbeat 3s ago)           [ 🔄 Re-pair ] [ 🚫 Disconnect ]|
+-----------------------------------------------------------------------------------------------------------------------+
```

---

## 6. Convex API Backend Contracts

### 6.1 Front Display Cloud State Endpoints (`convex/frontDisplay.ts`)

#### 1. `frontDisplay.getSessionState`
* **Type**: `query` (Bot Token Auth / Public Session)
* **Args**: `{ terminalId: string, organizationId?: Id<"organizations"> }`
* **Response**: Full `FrontDisplayBroadcastPayload` representing current register state.

#### 2. `frontDisplay.publishSessionState`
* **Type**: `mutation` (Staff Access Required)
* **Args**:
  ```typescript
  {
    terminalId: string,
    state: "idle" | "ringing" | "payment_qr" | "cash_tender" | "completed",
    payload: v.any()
  }
  ```
* **Response**: `{ success: true, timestamp: number }`

#### 3. `frontDisplay.generateDynamicUpiQr`
* **Type**: `mutation` (Staff Access Required)
* **Args**:
  ```typescript
  {
    orderId: Id<"orders">,
    amountPaise: number,
    terminalId: string
  }
  ```
* **Response**:
  ```typescript
  {
    upiString: string, // "upi://pay?pa=...&pn=...&am=1304.00&tr=ORD1042"
    qrCodeDataUrl: string
  }
  ```

#### 4. `frontDisplay.submitInstantRating`
* **Type**: `mutation` (Public / CFD)
* **Args**:
  ```typescript
  {
    orderId: Id<"orders">,
    ratingScore: number, // 1 to 5
    surveyId?: Id<"surveys">
  }
  ```
* **Response**: `{ success: true }`
* **Description**: Atomically creates a published `surveyAttempt` and `surveyAnswer` records linking the rating directly to the settled order.

---

## 7. Frontend Component Hierarchy (`pos-default/app/front-display/`)

```
pos-default/app/
├── front-display/
│   ├── page.tsx                               // Customer Front Display Main Container
│   └── components/
│       ├── CfdIdleStandby.tsx                 // Fullscreen carousel promo & logo banner
│       ├── CfdSplitView.tsx                   // Split 40/60 layout container
│       ├── CfdCartMirror.tsx                  // Live itemized bill with animations
│       ├── CfdCartItemRow.tsx                 // Item line with modifiers & quantity badge
│       ├── CfdTotalsCard.tsx                  // Subtotal, discount, tax & total breakdown
│       ├── CfdPaymentQrModal.tsx              // Dynamic UPI / Gateway QR code component
│       ├── CfdCashTenderBanner.tsx            // Tendered amount vs change due visualizer
│       ├── CfdSuccessScreen.tsx               // Token callout (#12) & payment confirmation
│       ├── CfdQuickSurveyStars.tsx            // 1-touch 5-star customer feedback widget
│       ├── CfdWhatsAppReceiptPrompt.tsx       // Mobile number input for digital receipt
│       └── CfdSyncListener.tsx                // BroadcastChannel & Convex WebSocket bridge
└── components/
    └── OrganizationFrontDisplaySettings.tsx   // Settings tab component for CFD management
```

---

## 8. Quality Assurance & Sign-off Checklist

- [x] **Zero-Latency Local IPC**: BroadcastChannel API synchronizes line-item changes instantly without server roundtrips.
- [x] **Dynamic Amount UPI QR**: Generates exact amount QR codes to eliminate customer manual price entry errors.
- [x] **Accurate Cash Change Visualizer**: Large, clear display of change due to prevent billing disputes.
- [x] **Integrated 1-Touch Survey**: Collects guest ratings directly from the front counter without requiring guest app downloads.
- [x] **Network Resilience**: Falls back gracefully to promotional marketing banners if the POS connection drops.
- [x] **Data Privacy & Masking**: Internal staff notes, food cost margins, and customer database IDs are strictly excluded from the display payload.
