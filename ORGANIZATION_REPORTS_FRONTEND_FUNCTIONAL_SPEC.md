# Organization Reports & Business Intelligence Frontend Functional Specification

## 1. Executive Summary & Domain Scope

The **Reports & Analytics Subsystem** in `pos-default` (`/reports` and `/dashboard`) is the central business intelligence, financial auditing, tax compliance, and operational analytics operating terminal for restaurant owners, general managers, head accountants, and shift supervisors.

It ingests transactions across all sales channels (Cashier POS, Captain Handheld, Table QR Self-Ordering, Online Web Storefront) and translates raw transactional data into actionable financial ledgers, product mix (PMIX) analytics, staff performance metrics, and end-of-day Z-Reports.

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                  Omnichannel Transaction Engine                                   │
│              [Cashier POS Orders]  •  [Captain Orders]  •  [QR Dine-In]  •  [Online Delivery]     │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
                                                  ▼
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                           Convex Real-Time Reporting & Aggregation Engine                         │
│             (Time Range Partitioning, Channel Filtering, Tax Splitting & Payment Matrix)          │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
         ┌───────────────────┬────────────────────┼────────────────────┬────────────────────┐
         ▼                   ▼                    ▼                    ▼                    ▼
   ┌───────────┐       ┌───────────┐        ┌───────────┐        ┌───────────┐        ┌───────────┐
   │  Sales &  │       │  Payment  │        │ Item Mix  │        │   Tax &   │        │ Shift-End │
   │  Revenue  │       │  Ledger   │        │  (PMIX)   │        │    GST    │        │ Z-Report  │
   │  Summary  │       │ Breakdown │        │ Analytics │        │ Statement │        │ Close-Out │
   └───────────┘       └───────────┘        └───────────┘        └───────────┘        └───────────┘
```

---

## 2. Navigation Hierarchy & Role-Based Access (RBAC)

### 2.1 Screen Navigation Map

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  📊 Reports & Analytics Navigation (`/reports`)                                                   │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│    ├── 💰 1. Sales & Revenue Summary (`/reports/sales`)                                           │
│    │     ├── 📈 Gross Revenue, Net Sales, Discounts, Delivery Surcharges, Void Totals            │
│    │     ├── ⏱️ Hourly Peak Sales Heatmap & Average Ticket Size (AOV)                              │
│    │     └── 📅 Day-over-Day / Period Comparison Trendlines                                       │
│    │                                                                                              │
│    ├── 💳 2. Payment Modes & Reconciliation Ledger (`/reports/payments`)                           │
│    │     ├── 💵 Cash vs Card vs UPI (PhonePe, GPay, Paytm) vs 3PL Aggregators (Zomato, Swiggy)   │
│    │     ├── 🔀 Split Payment Distribution & Surcharge Reconciliation                             │
│    │     └── 🏦 Cash Drawer Float Variance & Safe Drop Tracking                                   │
│    │                                                                                              │
│    ├── 🍲 3. Item Sales & Product Mix (PMIX) (`/reports/items`)                                   │
│    │     ├── ⭐ Top 10 Best-Selling Items by Volume (Quantity) and Value (Revenue)                │
│    │     ├── 📉 Slow-Moving & Dead Menu Items (< 5 units sold)                                    │
│    │     ├── 📂 Category Contribution Percentage Breakdown                                        │
│    │     └── 🧀 Modifiers & Add-on Attach Rate Analysis                                           │
│    │                                                                                              │
│    ├── 🧾 4. Tax & Legal Compliance Statement (`/reports/tax`)                                    │
│    │     ├── 🏛️ CGST, SGST, IGST & VAT Component Tax Breakdown Ledger                             │
│    │     ├── 🏷️ Tax-Inclusive vs Tax-Exclusive Base Turnover Audit                                │
│    │     └── 📥 1-Click B2B Invoice & GST HSN/SAC Summary CSV Export                              │
│    │                                                                                              │
│    ├── 🧑‍🍳 5. Staff & Server Productivity (`/reports/staff`)                                      │
│    │     ├── 👨‍💼 Sales Punched per Cashier, Captain & Floor Waiter                                │
│    │     ├── ⏱️ Average Table Turnaround Time & Dwell Duration per Server                         │
│    │     └── 🚨 Void / Discount Audit Log (Loss Prevention & Anti-Theft Guard)                    │
│    │                                                                                              │
│    ├── 🛵 6. Channel & Table Performance (`/reports/channels`)                                    │
│    │     ├── 🍽️ Dine-In vs Takeaway vs Web Delivery vs QR Self-Order Channel Distribution         │
│    │     └── 🪑 RevPASH (Revenue Per Available Seat-Hour) & Table Dwell Times                     │
│    │                                                                                              │
│    └── 📜 7. End-of-Day Terminal Close & Z-Report (`/reports/z-report`)                           │
│          ├── 🔒 Shift Closing Audit & Cash Float Reconciliation                                   │
│          └── 🖨️ 80mm ESC/POS Thermal Receipt Z-Report Print Trigger                              │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

### 2.2 RBAC Role Matrix

| Report Domain | Admin / Store Owner | Head Accountant | General Manager | Cashier | Floor Captain / Chef |
|---|---|---|---|---|---|
| **Sales & Revenue Summary** | ✅ Full Access | ✅ Full Access | ✅ Full Access | 👁️ Current Shift Only | ❌ Forbidden |
| **Payment Ledger & Float** | ✅ Full Access | ✅ Full Access | ✅ Full Access | 👁️ Cash Drawer Only | ❌ Forbidden |
| **Item Sales & PMIX** | ✅ Full Access | ✅ Full Access | ✅ Full Access | 👁️ Read Only | 👁️ Top Items Only |
| **Tax & GST Statements** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Staff & Void Audit Log** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Z-Report Shift Close** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ✅ Settle Own Shift | ❌ Forbidden |

---

## 3. Global Filter Bar & Date Range Architecture

Every report view features a unified top bar with real-time reactive filters:

```
+-----------------------------------------------------------------------------------------------------------------------+
|  📊 REPORTS & ANALYTICS                                                  [ 📥 Export CSV ]  [ 🖨️ Print Statement ]     |
+-----------------------------------------------------------------------------------------------------------------------+
|  DATE PRESET: [ Today ▼ ]  |  CUSTOM RANGE: [ 01 Oct 2026 ] to [ 07 Oct 2026 ]  |  CHANNEL: [ All Channels ▼ ]       |
|  PAYMENT MODE: [ All Modes ▼ ]  |  ORDER STATUS: [ Paid & Completed Only ▼ ]   |  STAFF: [ All Staff ▼ ]              |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 3.1 Date Presets & Dynamic Epoch Boundaries
* **Today**: Current calendar day from `00:00:00.000` to `23:59:59.999` (in store local timezone).
* **Yesterday**: Previous calendar day.
* **This Week**: Monday `00:00:00` to Sunday `23:59:59`.
* **Last 7 Days**: Rolling 7-day window.
* **Month to Date (MTD)**: 1st day of current month to today.
* **Custom Range**: Dual datepicker with ISO timestamp serialization.

---

## 4. Module 1: Sales & Revenue Summary (`/reports/sales`)

### 4.1 UI Layout & Core Financial KPIs

```
+-----------------------------------------------------------------------------------------------------------------------+
|  💰 GROSS REVENUE       |  🏷️ TOTAL DISCOUNTS    |  🛵 DELIVERY CHARGES   |  🏛️ TAXES COLLECTED   |  💵 NET SETTLEMENT   |
|     ₹ 1,48,500.00       |     - ₹ 6,250.00       |     + ₹ 3,400.00       |     + ₹ 7,425.00       |     ₹ 1,53,075.00    |
|     (142 Orders)        |     (18 Promos applied)|     (68 Deliveries)    |     (5% GST Blended)   |     (Settled 100%)   |
+-----------------------------------------------------------------------------------------------------------------------+
|  📈 HOURLY SALES HEATMAP                                                                                              |
|   ₹k                                                                                                                  |
|  25│                                              ██                                                                  |
|  20│                                              ██      ██                                                          |
|  15│                      ██                      ██      ██                                                          |
|  10│                      ██      ██              ██      ██      ██                                                  |
|   5│      ██      ██      ██      ██      ██      ██      ██      ██      ██                                          |
|   0└───┴──██───┴──██───┴──██───┴──██───┴──██───┴──██───┴──██───┴──██───┴──██───┴───                                   |
|       11 AM   12 PM    1 PM    2 PM    3 PM    7 PM    8 PM    9 PM   10 PM                                           |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 4.2 Financial Math & Formula Engine
* **Gross Sales**: $\sum \text{orderItems.totalPrice}$ (Price before discounts and taxes).
* **Total Discounts**: $\sum \text{orders.discountAmount}$ (Coupon codes + custom staff discounts).
* **Net Item Revenue**: $\text{Gross Sales} - \text{Total Discounts}$.
* **Total Tax Collected**: $\sum \text{orders.taxTotal}$.
* **Total Surcharges**: $\sum \text{orders.deliveryCharge}$.
* **Total Net Settlement**: $\text{Net Item Revenue} + \text{Total Tax} + \text{Total Surcharges}$.
* **Average Order Value (AOV)**: $\frac{\text{Total Net Settlement}}{\text{Total Completed Orders}}$.

---

## 5. Module 2: Payment Modes & Settlement Ledger (`/reports/payments`)

### 5.1 Payment Breakdown Matrix

```
+-----------------------------------------------------------------------------------------------------------------------+
| PAYMENT MODE           | TRANSACTIONS | GROSS AMOUNT   | REFUNDS / VOIDS | NET SETTLED    | SHARE (%) | DRAWER STATUS     |
+------------------------+--------------+----------------+-----------------+----------------+-----------+-------------------+
| 💵 Cash in Drawer      | 48           | ₹ 42,300.00    | - ₹ 0.00        | ₹ 42,300.00    | 27.6%     | In Safe           |
| 📱 UPI (GPay / PhonePe)| 62           | ₹ 68,450.00    | - ₹ 450.00      | ₹ 68,000.00    | 44.4%     | Auto-Settled Bank |
| 💳 Credit / Debit Card | 24           | ₹ 31,200.00    | - ₹ 0.00        | ₹ 31,200.00    | 20.4%     | POS Terminal EDC  |
| 🛵 Zomato Online       | 12           | ₹ 9,800.00     | - ₹ 0.00        | ₹ 9,800.00     | 6.4%      | 3PL Aggregator    |
| 🛵 Swiggy Online       | 6            | ₹ 4,775.00     | - ₹ 0.00        | ₹ 4,775.00     | 3.1%      | 3PL Aggregator    |
+------------------------+--------------+----------------+-----------------+----------------+-----------+-------------------+
| TOTAL SETTLED          | 152          | ₹ 1,56,525.00  | - ₹ 450.00      | ₹ 1,56,075.00  | 100.0%    | Balanced          |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 5.2 Cash Drawer Variance & Float Tracker
* **Opening Float**: Cash placed in drawer at start of shift (e.g. ₹ 5,000.00).
* **Total Cash Sales**: ₹ 42,300.00.
* **Cash Drops / Paid Outs**: Cash taken for vendor procurement / petty cash (- ₹ 2,000.00).
* **Expected Drawer Balance**: $\text{Opening Float} + \text{Cash Sales} - \text{Paid Outs} = ₹ 45,300.00$.
* **Actual Counted Cash**: Entered by cashier at shift close (e.g. ₹ 45,300.00).
* **Cash Variance**: $\text{Actual} - \text{Expected} = ₹ 0.00$ (**Perfect Reconciliation**).

---

## 6. Module 3: Item Sales & Product Mix (PMIX) (`/reports/items`)

### 6.1 Product Mix Breakdown Table

```
+-----------------------------------------------------------------------------------------------------------------------+
| ITEM NAME              | CATEGORY       | QTY SOLD | UNIT PRICE | GROSS REVENUE | % REVENUE | FOOD COST % | COGS (EST.)   |
+------------------------+----------------+----------+------------+---------------+-----------+-------------+---------------+
| Butter Chicken         | Main Course    | 84       | ₹ 450.00   | ₹ 37,800.00   | 24.2%     | 28.5%       | ₹ 10,773.00   |
| Paneer Butter Masala   | Main Course    | 62       | ₹ 380.00   | ₹ 23,560.00   | 15.1%     | 24.0%       | ₹ 5,654.40    |
| Tandoori Butter Naan   | Breads & Roti  | 188      | ₹ 60.00    | ₹ 11,280.00   | 7.2%      | 18.0%       | ₹ 2,030.40    |
| Chicken Dum Biryani    | Rice & Biryani | 45       | ₹ 420.00   | ₹ 18,900.00   | 12.1%     | 31.0%       | ₹ 5,859.00    |
| Virgin Mojito          | Beverages      | 38       | ₹ 180.00   | ₹ 6,840.00    | 4.4%      | 12.0%       | ₹ 820.80      |
+------------------------+----------------+----------+------------+---------------+-----------+-------------+---------------+
| TOTALS                 |                | 417      |            | ₹ 98,380.00   | 63.0%     | 25.2% (Avg) | ₹ 25,137.60   |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 6.2 Category Performance Contribution Chart
* **Main Course**: 42% of revenue.
* **Starters / Appetizers**: 24% of revenue.
* **Breads & Rice**: 16% of revenue.
* **Beverages & Bar**: 12% of revenue.
* **Desserts**: 6% of revenue.

---

## 7. Module 4: Tax & Compliance Statement (`/reports/tax`)

### 7.1 GST & Tax Component Statement

```
+-----------------------------------------------------------------------------------------------------------------------+
| TAX COMPONENT          | RATE (%) | TAXABLE VALUE   | CGST COLLECTED | SGST COLLECTED | IGST / VAT    | TOTAL TAX     |
+------------------------+----------+-----------------+----------------+----------------+---------------+---------------+
| Food & Beverages (Dine)| 5.0%     | ₹ 98,400.00     | ₹ 2,460.00     | ₹ 2,460.00     | -             | ₹ 4,920.00    |
| Food (Delivery/Online) | 5.0%     | ₹ 44,200.00     | ₹ 1,105.00     | ₹ 1,105.00     | -             | ₹ 2,210.00    |
| Packaged Goods / Water | 12.0%    | ₹ 2,450.00      | ₹ 147.00       | ₹ 147.00       | -             | ₹ 294.00      |
+------------------------+----------+-----------------+----------------+----------------+---------------+---------------+
| TOTAL TAX LIABILITY    |          | ₹ 1,45,050.00   | ₹ 3,712.00     | ₹ 3,712.00     | ₹ 0.00        | ₹ 7,424.00    |
+-----------------------------------------------------------------------------------------------------------------------+
```

* **GSTIN & Audit Header**: Includes Store Legal Name, Registered GSTIN, FSSAI License #, State Code, and B2B Invoicing Breakdown.
* **1-Click CA Export**: Generates `.csv` formatted specifically for Indian GST Portal (GSTR-1 & GSTR-3B) filing.

---

## 8. Module 5: Staff & Server Productivity (`/reports/staff`)

```
+-----------------------------------------------------------------------------------------------------------------------+
| STAFF MEMBER           | ROLE     | ORDERS TAKEN | TOTAL REVENUE | AVG TICKET (AOV) | AVG TABLE DWELL | VOIDS / CANCELS|
+------------------------+----------+--------------+---------------+------------------+-----------------+----------------+
| Rajesh Kumar           | Captain  | 42           | ₹ 58,400.00   | ₹ 1,390.47       | 38 mins         | 0 Voids (0%)   |
| Sunita Verma           | Captain  | 36           | ₹ 46,200.00   | ₹ 1,283.33       | 42 mins         | 1 Void (₹ 240) |
| Vikram Joshi           | Cashier  | 54           | ₹ 42,900.00   | ₹ 794.44         | 4 mins          | 0 Voids (0%)   |
+------------------------+----------+--------------+---------------+------------------+-----------------+----------------+
```

### 8.1 Void & Loss Prevention Audit Trail
* Logs every cancelled order (`order.isRejected: true`) or deleted line item (`orderItems` deleted post-KOT).
* Records: Staff name, order number, deleted item name, value, reason code (e.g. *"Wrong Punch"*, *"Guest Changed Mind"*, *"Quality Issue"*), and authorizing supervisor.

---

## 9. Module 6: Shift-End Terminal Close & Z-Report (`/reports/z-report`)

### 9.1 End-of-Day Z-Report Chit Format (80mm ESC/POS Thermal Output)

```
+──────────────────────────────────────────────+
|              SPICE GARDEN BISTRO             |
|          12, Linking Road, Bandra West       |
|               GSTIN: 27AAAAA0000A1Z5         |
|               FSSAI: 11521000000000          |
+──────────────────────────────────────────────+
|            OFFICIAL Z-REPORT (CLOSE)         |
| Z-Report ID: Z-20261007-001                  |
| Shift: Evening Dinner Shift                  |
| Cashier: Vikram Joshi                        |
| Date: 07-Oct-2026  Time: 11:45 PM            |
+──────────────────────────────────────────────+
| FINANCIAL SUMMARY                            |
| Gross Sales (142 orders):      ₹ 1,48,500.00 |
| Total Discounts Given:           - ₹ 6,250.00 |
| Delivery Charges:                + ₹ 3,400.00 |
| Net Taxable Sales:             ₹ 1,45,650.00 |
| CGST (2.5%):                     + ₹ 3,712.00 |
| SGST (2.5%):                     + ₹ 3,712.00 |
| ───────────────────────────────────────────  |
| TOTAL NET REVENUE:             ₹ 1,53,074.00 |
+──────────────────────────────────────────────+
| PAYMENT MODE BREAKDOWN                       |
| Cash:              48 txns       ₹ 42,300.00 |
| UPI:               62 txns       ₹ 68,000.00 |
| Card:              24 txns       ₹ 31,200.00 |
| Online / 3PL:      18 txns       ₹ 14,574.00 |
+──────────────────────────────────────────────+
| CASH DRAWER RECONCILIATION                   |
| Starting Float:                   ₹ 5,000.00 |
| Add Cash Sales:                  ₹ 42,300.00 |
| Less Paid Outs:                  - ₹ 2,000.00 |
| ───────────────────────────────────────────  |
| Expected in Drawer:              ₹ 45,300.00 |
| Actual Cash Counted:             ₹ 45,300.00 |
| Drawer Variance:                      ₹ 0.00 |
+──────────────────────────────────────────────+
| Verified By: _______________________________ |
| Store Manager Signature: ___________________ |
+──────────────────────────────────────────────+
```

---

## 10. Convex API Backend Contracts

### 10.1 Reports Queries & Aggregations (`convex/reports.ts`)

#### 1. `reports.getSalesOverview`
* **Type**: `query` (Staff / Admin Access Required)
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    fromTimestamp: number,
    toTimestamp: number,
    orderType?: string, // "Dine-In" | "Takeaway" | "Delivery" | "Online"
    paymentMode?: string
  }
  ```
* **Response Payload**:
  ```typescript
  {
    totalOrders: number,
    grossRevenue: number,
    netRevenue: number,
    totalDiscounts: number,
    totalTax: number,
    totalDeliveryCharges: number,
    averageOrderValue: number,
    hourlyBuckets: Array<{
      hour: number, // 0 to 23
      ordersCount: number,
      revenue: number,
    }>,
    channelDistribution: Array<{
      channel: string,
      ordersCount: number,
      revenue: number,
      percentage: number,
    }>
  }
  ```

#### 2. `reports.getPaymentModeSummary`
* **Type**: `query`
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    fromTimestamp: number,
    toTimestamp: number
  }
  ```
* **Response Payload**:
  ```typescript
  Array<{
    paymentMode: string,
    transactionCount: number,
    grossAmount: number,
    refundAmount: number,
    netSettledAmount: number,
    percentage: number,
  }>
  ```

#### 3. `reports.getItemSalesAnalysis`
* **Type**: `query`
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    fromTimestamp: number,
    toTimestamp: number,
    categoryId?: Id<"categories">,
    limit?: number
  }
  ```
* **Response Payload**:
  ```typescript
  {
    topItems: Array<{
      itemId: Id<"items">,
      itemName: string,
      categoryName: string,
      quantitySold: number,
      unitPrice: number,
      totalRevenue: number,
      revenuePercentage: number,
    }>,
    categoryBreakdown: Array<{
      categoryName: string,
      totalQuantity: number,
      totalRevenue: number,
      percentage: number,
    }>
  }
  ```

#### 4. `reports.getTaxSummary`
* **Type**: `query`
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    fromTimestamp: number,
    toTimestamp: number
  }
  ```
* **Response Payload**:
  ```typescript
  {
    taxableTurnover: number,
    cgstTotal: number,
    sgstTotal: number,
    igstTotal: number,
    vatTotal: number,
    totalTaxLiability: number,
    itemsTaxSnapshot: Array<{
      taxRate: number,
      taxableAmount: number,
      taxAmount: number,
    }>
  }
  ```

#### 5. `reports.generateZReport`
* **Type**: `mutation`
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    shiftOpeningFloat: number,
    actualCashCounted: number,
    paidOutNotes?: string,
    paidOutAmount?: number
  }
  ```
* **Response**:
  ```typescript
  {
    zReportId: string,
    generatedAt: number,
    summary: Record<string, any>,
    variance: number,
    isBalanced: boolean,
    printPayloadEscPos: string
  }
  ```

---

## 11. Frontend Component Hierarchy (`pos-default/app/reports/`)

```
pos-default/app/reports/
├── page.tsx                           // Main Reports Dashboard Container
├── sales/page.tsx                     // Sales & Revenue Summary Tab
├── payments/page.tsx                  // Payment Ledger & Cash Float Tab
├── items/page.tsx                     // Product Mix (PMIX) Item Sales Tab
├── tax/page.tsx                       // Tax & GST Statement Tab
├── staff/page.tsx                     // Server Productivity & Void Audit Tab
├── z-report/page.tsx                  // End-of-Day Z-Report Settlement Tab
└── components/
    ├── ReportsFilterHeader.tsx        // Date presets, custom datepicker, channel filter
    ├── RevenueMetricCards.tsx         // KPI metric tiles (Gross, Net, Tax, AOV)
    ├── HourlySalesBarChart.tsx        // Dynamic SVG/Canvas hourly bar chart
    ├── PaymentModeTable.tsx           // Payment distribution ledger with drawer status
    ├── ItemPmixTable.tsx              // Quantity & revenue table with category pills
    ├── TaxSummaryCard.tsx             // CGST / SGST liability card with GSTIN details
    ├── StaffPerformanceTable.tsx      // Waiter / Captain sales leaderboard
    ├── ZReportThermalChit.tsx         // 80mm ESC/POS styled print preview component
    └── ExportButtonMenu.tsx           // CSV / Excel / PDF export dropdown
```

---

## 12. Quality Assurance & Sign-off Checklist

- [x] **Omnichannel Aggregation**: Seamlessly compiles sales across Cashier POS, Captain App, QR Self-Order, and Web Delivery.
- [x] **Financial Math Accuracy**: Exact reconciliation between Gross Sales, Discounts, Delivery Charges, Taxes, and Net Settlement.
- [x] **GST / Tax Compliance**: Accurate separation of CGST (2.5%), SGST (2.5%), VAT, and Taxable Base Turnover.
- [x] **Product Mix (PMIX)**: Real-time item volume, revenue contribution %, and category breakdown.
- [x] **Cash Drawer Reconciliation**: Float tracking and variance calculation preventing cash leakage.
- [x] **End-of-Day Z-Report**: Official thermal chit generation and 1-click ESC/POS print trigger.
- [x] **Data Export**: 1-click CSV download formatted for accounting software (Tally, QuickBooks, Excel).
