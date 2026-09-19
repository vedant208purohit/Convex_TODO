# Orders Screen & Order Details: Complete UI/UX Design Specification

This specification documents the **Orders Management Hub** (`/orders`) and **Single Order Details View** (`/orders/[orderId]`), matching the exact implementation in `defx-pos-frontend` and backend architecture in `defx-pos` / `pos-default`.

> [!IMPORTANT]
> **Scope Boundaries for the Designer:**
> 1. **Floor Plan / Seating Table Diagrams are EXCLUDED**: The Order screen only shows a simple text metadata label for Dine-In (e.g. `Table T-04 (Ground Floor)`). Floor plans / graphical tables belong to a separate Table Management screen.
> 2. **Kitchen Display System (KDS) is EXCLUDED**: KDS is a separate screen used inside the kitchen by chefs. It is not part of this cashier/manager orders hub.
> 3. **Payment & Refund Settlement ARE INCLUDED**: The Order screen allows viewing the full payment history ledger, collecting pending payments (`Add Payment`), and issuing refunds (`Issue Refund`) directly.

---

## 📑 Table of Contents
1. [Information Architecture & Navigation Flow](#1-information-architecture--navigation-flow)
2. [Screen 1: Orders Hub / List Page (`/orders`)](#2-screen-1-orders-hub--list-page-orders)
3. [Screen 2: Single Order Details Page (`/orders/[orderId]`)](#3-screen-2-single-order-details-page-ordersorderid)
4. [Slide-Over Drawers & Modals](#4-slide-over-drawers--modals)
5. [Payment & Refund Mechanics (`PaymentMethodComponent`)](#5-payment--refund-mechanics-paymentmethodcomponent)
6. [Data Dictionary & API Payload Structures](#6-data-dictionary--api-payload-structures)
7. [Design System Tokens & Visual Specs](#7-design-system-tokens--visual-specs)

---

## 1. Information Architecture & Navigation Flow

```mermaid
graph TD
    A[Orders Hub: /orders] -->|Click Order Row| B[Order Details View: /orders/[orderId]]
    A -->|Click '+ Add Custom Filter'| C[Add Custom Filter Drawer]
    A -->|Click 'Export to Excel'| D[Download Orders .xlsx]
    
    B -->|Click 'Add Payment'| E[Payment Method Drawer (Credit)]
    B -->|Click 'Issue Refund'| F[Payment Refund Drawer (Debit)]
    B -->|Click 'Order Timeline'| G[Order Timeline Drawer]
    B -->|Click 'Delivery Management'| H[Delivery Rider Management Card/Drawer]
    B -->|Click 'Edit Order'| I[Edit Order / Add Items Drawer]
    B -->|Click 'Print Receipt'| J[Thermal Bluetooth / USB Hardware Print]
    B -->|Click 'Download PDF'| K[Download Tax Invoice PDF]
    B -->|Click 'Delete Order' / 'Delete Items'| L[Confirmation Caution Dialog]
```

---

## 2. Screen 1: Orders Hub / List Page (`/orders`)

A clean, high-density operational view designed for store managers, cashiers, and supervisors to monitor and manage all incoming and historical orders.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Orders                                                                                                │
│  Manage store orders, filter by channels, and view billing status                                      │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  TOP TOOLBAR:                                                                                          │
│  ┌─────────────────────────────────┐ ┌──────────────────────────────┐ ┌───────────────┐ ┌────────────┐│
│  │ 📅 09/09/2026 - 09/09/2026  ▾   │ │ 🔍 Search Customer / Phone...│ │ + Custom Filter│ │ 📥 Export  ││
│  └─────────────────────────────────┘ └──────────────────────────────┘ └───────────────┘ └────────────┘│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  STATUS FILTER TABS:                                                                                   │
│  [All] [Order Placed] [Accepted] [In Kitchen] [Food Ready] [Out for Delivery] [Completed] [Cancelled]  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ORDERS DATA TABLE:                                                                                    │
│  ┌────────────┬────────────────┬────────────────────────┬─────────────┬────────────────────┬───────────┬───────────┐│
│  │ ORDER #    │ ORDER STATUS   │ CUSTOMER / PHONE       │ ORDER TYPE  │ ORDERED DATE & TIME│ PAYMENT   │ PRICE (▲) ││
│  ├────────────┼────────────────┼────────────────────────┼─────────────┼────────────────────┼───────────┼───────────┤│
│  │ #ORD-1082  │ 🟢 In Kitchen  │ Rahul Sharma           │ Dine In     │ 09/09/2026 12:42 PM│ ₹330 Paid │ ₹330.00   ││
│  │            │ (Station: Grill│ +91 98200 12345        │             │                    │           │           ││
│  ├────────────┼────────────────┼────────────────────────┼─────────────┼────────────────────┼───────────┼───────────┤│
│  │ #ORD-1081  │ 🔵 Out for Del │ Amit Verma             │ Delivery    │ 09/09/2026 12:30 PM│ ₹680 Unpd │ ₹680.00   ││
│  │            │ (Rider: Ravi)  │ +91 98111 22334        │             │                    │ (COD)     │           ││
│  ├────────────┼────────────────┼────────────────────────┼─────────────┼────────────────────┼───────────┼───────────┤│
│  │ #ORD-1080  │ ⚪ Completed   │ Sneha Patel            │ Take Away   │ 09/09/2026 12:15 PM│ ₹150 Paid │ ₹150.00   ││
│  │            │                │ +91 98999 00112        │             │ Pick up: 01:00 PM  │           │           ││
│  └────────────┴────────────────┴────────────────────────┴─────────────┴────────────────────┴───────────┴───────────┘│
│                                                                                                        │
│  PAGINATION:  [< Previous]  [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ Next >]       Showing 1-10 of 142 Orders     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Top Toolbar Components
1. **Date Range Picker (`DateRangePicker`)**:
   - Formatted button: `📅 DD/MM/YYYY - DD/MM/YYYY` (Defaults to current date `Today`).
   - Popover calendar allowing quick presets (*Today, Yesterday, Last 7 Days, This Month*) or custom range.
2. **Search Autocomplete Input (`searchInputValue`)**:
   - Magnifying glass search field with autocomplete dropdown.
   - Matches: Customer Name, Mobile Number, Order Number (`#ORD-1082`), Token Number (`T-24`).
3. **`+ Add Custom Filter` Button**:
   - Opens the slide-over `AddCustomFilterDrawer`.
4. **`📥 Export to Excel` Button (`ExcelSheetDownloadButton`)**:
   - Exports the currently filtered order dataset directly into an `.xlsx` spreadsheet.

---

### 2.2 Orders Data Table Columns

| Column Header | Width | Data Format & Rendering | Click / Sort Behavior |
| :--- | :--- | :--- | :--- |
| **Order number** | `12%` | e.g., `#ORD-1082` | **Clickable Link**: Navigates to `/orders/[orderId]`. |
| **Order status** | `14%` | Colored circular dot + Status Text (`🟢 Accepted`, `🟡 In Kitchen`, `🔵 Out for Delivery`, `⚪ Completed`, `🔴 Cancelled`). Color dynamically fetched from `organizationOrderProcesses.process_color`. | Non-clickable |
| **Customer name / Phone number** | `20%` | Primary: Customer Full Name.<br/>Secondary: Mobile number with country code (`+91 98200 12345`). Displays `-` if walk-in/anonymous. | Non-clickable |
| **Order type** | `12%` | Capitalized tag: `Dine In`, `Take Away`, `Delivery`, `Scheduled Pickup`, `Scheduled Delivery`. | Non-clickable |
| **Ordered date and time** | `18%` | Format: `DD/MM/YYYY hh:mm A`. If scheduled: adds subtitle `Pick up :- [Date/Time]`. | **Sortable**: Click toggles `created_at` sorting (`asc` / `desc`). |
| **Payment status** | `12%` | Semantic color badge:<br/>• If paid: `[Total] Paid` in **Green** (`#219653`).<br/>• If unpaid: `[Total] Unpaid` in **Red** (`#eb5757`).<br/>• If Cash on Delivery: adds `(COD)` indicator. | Non-clickable |
| **Order Price** | `12%` | Formatted currency amount (e.g., `₹330.00` or `$42.50`), right-aligned. | **Sortable**: Click toggles `total` price sorting (`asc` / `desc`). |

---

## 3. Screen 2: Single Order Details Page (`/orders/[orderId]`)

Accessed by clicking any order row. Provides a complete 360-degree view of the order, items, customer info, fulfillment status, payment transaction ledger, and action buttons.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Orders   /   Order #ORD-1082                                                                │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  TOP METADATA BAR (Header Info):                                                                       │
│  Order #: #ORD-1082   • Token #: T-24   • Type: Dine-In (Table T-04)   • Status: 🟢 In Kitchen         │
│  Date: 09/09/2026     • Time: 12:42 PM  • Source: QR Dine-In                                           │
├───────────────────────────────────────────────────────────────────┬────────────────────────────────────┤
│  LEFT COLUMN (65% Width)                                          │  RIGHT COLUMN (35% Width)          │
│                                                                   │                                    │
│  [CARD 1: CUSTOMER & ADDRESS DETAILS]                             │  [CARD 4: BILLING & TAX BREAKDOWN] │
│   • Name: Rahul Sharma         • Phone: +91 98200 12345           │   • Sub Total:             ₹350.00 │
│   • Address Type: HOME                                            │   • CGST (2.5%):            + ₹7.50│
│   • Address: 402 Palm Heights, Linking Road, Mumbai 400050        │   • SGST (2.5%):            + ₹7.50│
│                                                                   │   ──────────────────────────────── │
│  [CARD 2: ORDERED ITEMS DETAILS]                                  │   • TOTAL:                 ₹365.00 │
│  ┌───┬───────────────────────────────┬──────┬─────────┬──────────┐│                                    │
│  │[x]│ Items & Customization Items   │ Price│ Qty     │Sub Total ││  [CARD 5: ISSUE REFUND] (If due)   │
│  ├───┼───────────────────────────────┼──────┼─────────┼──────────┤│   Debit / Refund Amount:   ₹120.00 │
│  │[ ]│ Artisanal Spiced Vadapav 🛍️   │₹70.00│ 2       │ ₹170.00  ││   [   Issue Refund Button    ]    │
│  │   │  (+ Extra Garlic Chutney ₹15, │      │         │          ││                                    │
│  │   │   + Butter Pav ₹15)           │      │         │          ││  [CARD 6: ORDER ACTIONS GRID]      │
│  ├───┼───────────────────────────────┼──────┼─────────┼──────────┤│   Printer Status: 🖨️ Connected 🟢  │
│  │[ ]│ Belgian Mocha Frappé          │₹180  │ 1       │ ₹180.00  ││   ┌────────────────┬──────────────┐│
│  └───┴───────────────────────────────┴──────┴─────────┴──────────┘│   │ [✏️ Edit Order] │[🗑️ Del Order]││
│  [🗑️ Delete Selected Items]   [ Update Receipt ]                 │   ├────────────────┼──────────────┤│
│                                                                   │   │ [🖨️ Print Bill] │[📥 Down PDF] ││
│  [CARD 3: PAYMENT INFORMATION (LEDGER)]                           │   ├────────────────┼──────────────┤│
│  ┌────────────────────┬───────────┬───────────┬──────────────────┐│   │ [💳 Add Paymnt]│[⏰ Timeline] ││
│  │ Payment Time       │ Mode      │ Type      │ Amount           ││   └────────────────┴──────────────┘│
│  ├────────────────────┼───────────┼───────────┼──────────────────┤│                                    │
│  │ 09/09/2026 12:44 PM│ UPI / GPay│ Credit    │ ₹365.00          ││  [CARD 7: DELIVERY MANAGEMENT]     │
│  │ 09/09/2026 01:10 PM│ Cash      │ Debit(Ref)│ ₹120.00          ││   (Visible if Type = Delivery)     │
│  └────────────────────┴───────────┴───────────┴──────────────────┘│   • Rider: Ravi Kumar (+91 98111)  │
│                                                                   │   • Status: 🛵 Out for Delivery    │
└───────────────────────────────────────────────────────────────────┴────────────────────────────────────┘
```

### 3.1 Left Column Components

#### Card 1: Customer & Address Details
- **Customer Name**: Displays customer's full name.
- **Customer Phone**: Formatted with international dialing code (e.g. `+91 98200 12345`).
- **Address Details** (If Delivery):
  - Address Type Pill (`HOME`, `WORK`, `OTHER`).
  - Concatenated address line: `Address Line 1, Address Line 2, Landmark, City, Zip Code`.

#### Card 2: Item Details Table
- **Multi-Select Checkboxes**: Each line item has a checkbox. Checking items enables the `Delete [N] Items` bulk void action.
- **Item Name & Carrybag Icon**: Item name + small takeout carrybag badge (`🛍️`) if item has `is_togo: true`.
- **Customization Items Subtitle**: Listed in parentheses under the item name with extra cost (e.g. `(1 x Extra Garlic Chutney ₹15.00, 1 x Butter Pav ₹15.00)`).
- **Price**: Base unit price.
- **Qty**: Ordered quantity.
- **Sub Total**: Calculated item subtotal (`(Base Price + Customizations) × Qty`).
- **Bottom Actions**:
  - `Delete [N] Items` (Red danger button, opens Confirmation Caution Dialog).
  - `Update Receipt` (Saves customer or line item modifications).

#### Card 3: Payment Information (Transaction Ledger)
Displays every tender transaction recorded against this order:
- **Payment Time**: Format `DD/MM/YYYY hh:mm A`.
- **Mode**: Payment mode used (`Cash`, `Card`, `UPI`, `Net Banking`, `Wallet`).
- **Type**:
  - `Credit`: Payment received from customer.
  - `Debit`: Refund amount returned to customer.
- **Amount**: Formatted currency amount.

---

### 3.2 Right Column Components

#### Card 4: Billing & Tax Breakdown
- **Sub Total**: Sum of all items and customization items.
- **Dynamic Organization Taxes**:
  - Automatically loops through configured taxes (e.g. `CGST (2.5%): ₹7.50`, `SGST (2.5%): ₹7.50`, `VAT (18%): ₹45.00`).
- **Delivery Charge**: Delivery fee if applicable.
- **Round-off**: Nearest integer adjustment.
- **Total**: Grand bill total.

#### Card 5: Issue Refund Card
*Appears automatically whenever refunded amount is less than total paid amount (e.g. after item deletion/voiding).*
- **Debit Amount**: Calculated refund balance due to customer.
- **`Issue Refund` Button**: Opens the `PaymentMethodComponent` in `refund` mode to settle the return.

#### Card 6: Order Actions Grid (6-Button Quick Grid)
- **Printer Status Header**: Shows paired status for Bluetooth / USB hardware thermal printers (with green connected / red disconnected icon).
- **Action Buttons**:
  1. **`✏️ Edit Order`**: Opens `EditOrder` drawer to add items or adjust quantities.
  2. **`🗑️ Delete Order`**: Opens caution dialog to cancel and delete the order.
  3. **`🖨️ Print Receipt`**: Sends raw ESC/POS commands directly to Bluetooth / USB thermal receipt printers.
  4. **`📥 Download PDF`**: Downloads official A4 / 80mm tax invoice PDF.
  5. **`💳 Add Payment`**: Opens `PaymentMethodComponent` drawer in `credit` mode to collect pending payment.
  6. **`⏰ Order Timeline`**: Opens `OrderTimeLine` drawer.

#### Card 7: Delivery Management Card
*(Visible for `Delivery` and `ScheduledDelivery` orders)*
- Shows assigned driver name, phone number, vehicle number, and dispatch status.

---

## 4. Slide-Over Drawers & Modals

### 4.1 Drawer 1: Add Custom Filter Drawer (`AddCustomFilterDrawer.jsx`)
- **Order Status**: Multi-select dropdown for pipeline stages (`Order Placed`, `In Kitchen`, `Food Ready`, `Completed`, `Cancelled`).
- **Customer**: Autocomplete search by registered customer profile.
- **Order Type**: Checkboxes for `DineIn`, `TakeAway`, `Delivery`, `ScheduledPickup`, `ScheduledDelivery`.
- **Order Price Range**: `Price From` and `Price To` currency inputs.
- **Ordered Date**: Date picker for order placement date.
- **Pickup Date**: Date picker for scheduled orders.
- **Footer**: `Reset All Filters` and `Apply Filters`.

---

### 4.2 Drawer 2: Order Timeline (`OrderTImeLine.jsx`)
- **Vertical Step Progress Bar**:
  - Node dot colored with stage's theme color.
  - Stage title (e.g. *Order Placed*, *Accepted*, *In Kitchen*, *Food Ready*, *Out for Delivery*, *Completed*).
  - Timestamp (e.g. `09/09/2026, 12:42:15 PM`).
  - Elapsed duration counter between stages (e.g. `+4m 10s`).
  - Actor / Staff name who triggered the update.

---

### 4.3 Drawer 3: Edit Order (`EditOrder.jsx`)
- **Menu Search Bar**: Quick search to append new food items to the active bill.
- **Quantity Stepper**: `+` and `-` buttons to increment/decrement quantities.
- **Item Deletion**: Trash icon with mandatory reason for kitchen waste tracking.
- **Instant Recalculation**: Subtotal, taxes, and total refresh automatically.

---

### 4.4 Confirmation Caution Dialog (`ConfirmationDialog.jsx`)
- **Header**: Centered `Caution!` or `Delete #ORD-XXXX?`.
- **Description**: *"Are you sure you want to delete 2 items?"* or *"Are you sure you want to delete this order?"*.
- **Actions**: `Cancel` (neutral button) and `Confirm / Delete` (red danger button with spinner loading state).

---

## 5. Payment & Refund Mechanics (`PaymentMethodComponent`)

The `PaymentMethodComponent` is an interactive drawer supporting two distinct modes:

### Mode A: `credit` (Add / Collect Payment)
1. **Total Due Amount**: Prominently displayed at the top.
2. **Payment Mode Selectors**:
   - `Cash`: Shows tender calculator with pre-set quick bills (`₹100`, `₹200`, `₹500`, `₹2000`), custom amount given input, and dynamic **Change Return Amount**.
   - `UPI QR Code`: Generates dynamic on-screen UPI QR code with a 3-minute countdown timer and auto-polling payment confirmation.
   - `Card / POS Machine`: Terminal reference number input.
   - `Split Payment`: Allows splitting across multiple modes (e.g. ₹200 Cash + ₹165 UPI).
3. **`Submit Payment` CTA**: Records transaction into the payment ledger and updates order payment status to `Paid`.

### Mode B: `refund` (Issue Customer Refund)
1. **Refund Balance Due**: Displays calculated debit amount.
2. **Refund Mode Selector**: Choose refund tender (`Cash`, `Original UPI`, `Bank Transfer`).
3. **`Issue Refund` CTA**: Records a `Debit` transaction in the payment ledger and updates financial balances.

---

## 6. Data Dictionary & API Payload Structures

### Single Order API Response Payload
```json
{
  "id": "ord_89123891",
  "order_number": "#ORD-1082",
  "token_number": "T-24",
  "order_type": "DineIn",
  "order_source": "QR Dine-In",
  "order_status_id": "proc_kitchen_01",
  "order_status": "In Kitchen",
  "order_created": 1788938520000,
  "user": {
    "first_name": "Rahul",
    "last_name": "Sharma",
    "phone": "9820012345",
    "country_code": "+91",
    "email": "rahul@example.com"
  },
  "user_address": {
    "address_type": "HOME",
    "address_line_1": "402 Palm Heights",
    "address_line_2": "Linking Road",
    "landmark": "Near Bandra Post Office",
    "city": "Mumbai",
    "zip_code": "400050"
  },
  "table": {
    "table_number": "T-04",
    "layout_name": "Ground Floor"
  },
  "order_items": [
    {
      "id": "oi_111",
      "item_id": "item_vadapav",
      "item": {
        "name": "Artisanal Spiced Vadapav",
        "price": 7000,
        "display_price": "70.00"
      },
      "item_quantity": 2,
      "is_togo": false,
      "customizations": [
        { "item_quantity": 1, "item": { "name": "Extra Garlic Chutney", "display_price": "15.00" } },
        { "item_quantity": 1, "item": { "name": "Butter Pav", "display_price": "15.00" } }
      ]
    }
  ],
  "taxations": [
    { "taxation_name": "CGST", "display_tax_rate": 2.5 },
    { "taxation_name": "SGST", "display_tax_rate": 2.5 }
  ],
  "display_sub_total": "350.00",
  "display_total": "365.00",
  "order_payments": [
    {
      "id": "pay_01",
      "payment_type": "Credit",
      "payment_mode": { "mode": "UPI / GPay" },
      "pay_amount": 36500,
      "created_at": "2026-09-09T12:44:00Z"
    }
  ]
}
```

---

## 7. Design System Tokens & Visual Specs

| UI Element | CSS / Tailwind Token | Hex Code | Visual Style |
| :--- | :--- | :--- | :--- |
| **Primary Typography** | `font-sans` / `Inter` | `#262626` | Clean 400/500 weight for high-density tables |
| **Header Typography** | `Circular-700` / `Inter-Bold` | `#000000` | 700 weight for Order # and card headers |
| **Paid Indicator** | `text-[#219653]` / `bg-emerald-50` | `#219653` | Green text on soft background |
| **Unpaid / Due Indicator** | `text-[#eb5757]` / `bg-rose-50` | `#eb5757` | Red text for unpaid/due status |
| **Table Head Background** | `bg-[#f6f6f6]` | `#f6f6f6` | Subtle light gray for table headers |
| **Primary Action CTA** | `bg-[#0c0a09]` / `bg-[#262626]` | `#0c0a09` | High-contrast dark button |
| **Delete / Void Button** | `bg-[#eb5757]` | `#eb5757` | Bold red for destructive confirmation |
| **Borders & Dividers** | `border-[#e7e5e4]` | `#e7e5e4` | 1px hairline card borders and table row dividers |
