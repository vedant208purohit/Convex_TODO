# Organization Executive Dashboard Redesign Frontend Functional Specification

## 1. Executive Summary & Redesign Rationale

The **Dashboard Subsystem** in `pos-default` (`/dashboard`) serves as the primary executive command center and operational cockpit for restaurant owners, general managers, head chefs, and floor supervisors.

### 1.1 Existing Dashboard Limitations
The legacy dashboard implementation suffers from several critical shortcomings:
1. **Static Dummy Data**: Renders hardcoded mock metrics (`Total Sales: $4,285.50`, `Total Orders: 124`, `Delivery Time: 28 min`, `Truffle Burger 48 orders`) rather than reactive live data from Convex.
2. **`ComingSoonOverlay` Blocker**: Full-page overlay blocks user interaction and hides data.
3. **Empty Visualizations**: Renders an empty placeholder box ("No data available") rather than dynamic hourly sales bar charts or channel breakdowns.
4. **Disconnected Operational Silos**: Lacks live visibility into table floor occupancy, Kitchen Display System (KDS) prep backlogs, waitlist queue status, and low-inventory stockout alerts.

### 1.2 Target Vision for the Redesigned Dashboard
The redesigned dashboard transforms `/dashboard` into an active, 100% reactive, zero-latency restaurant command center. It unifies:
* **Live Financial KPIs**: Real-time sales, order counts, average ticket size, and period-over-period percentage deltas.
* **Operational Pulse**: Live table occupancy, active kitchen ticket backlog, overdue order alerts, and delivery driver dispatches.
* **Product Mix (PMIX)**: Best-selling items, revenue drivers, and 86'd out-of-stock items.
* **Inventory Stockout Guard**: Immediate alert badges for raw materials breaching refill thresholds.
* **Executive Shortcuts**: 1-click navigation into POS Cashier, KDS, Floor Plan, Queue Stand, and Shift-End Z-Reports.

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                 EXECUTIVE RESTAURANT COMMAND CENTER                               │
│                         Real-time Convex WebSockets • Zero Manual Refresh                         │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
         ┌───────────────────┬────────────────────┼────────────────────┬────────────────────┐
         ▼                   ▼                    ▼                    ▼                    ▼
+─────────────────+ +─────────────────+ +─────────────────+ +─────────────────+ +─────────────────+
│   LIVE TODAY    │ │   OPERATIONAL   │ │  HOURLY DEMAND  │ │   PRODUCT MIX   │ │    CRITICAL     │
│   FINANCIALS    │ │  FLOOR COCKPIT  │ │     CHARTS      │ │   LEADERBOARD   │ │ INVENTORY ALERTS│
│ • Net Revenue   │ │ • Table Status  │ │ • 24h Peak Bars │ │ • Top 5 Dishes  │ │ • Low Stock Raw │
│ • Order Volume  │ │ • KDS Backlog   │ │ • Channel Share │ │ • Margin Contrib│ │ • Overdue KOTs  │
│ • Average Ticket│ │ • Queue Parties │ │ • Payment Modes │ │ • 86'd Items    │ │ • Pending POs   │
+─────────────────+ +─────────────────+ +─────────────────+ +─────────────────+ +─────────────────+
```

---

## 2. Design Language & Visual Aesthetics

The redesigned dashboard adheres strictly to the warm, tactile, editorial aesthetic of `pos-default`:
* **Color Palette**:
  * Canvas Background: Sand / Paper Tone (`#fbf7f4`).
  * Surface Cards: Clean Porcelain (`#ffffff`) with warm subtle borders (`#eadfd6` / `#e7e5e4`).
  * Text Colors: Deep Charcoal Ink (`#1f1a17` for primary headers, `#2d2622` for titles, `#6f655e` for metadata).
  * Semantic Accents:
    * Emerald (`#10b981`, `bg-emerald-50`, `text-emerald-700`): Positive growth, completed orders, healthy stock.
    * Amber (`#f59e0b`, `bg-amber-50`, `text-amber-800`): In-prep kitchen orders, warnings, pending bills.
    * Rose (`#f43f5e`, `bg-rose-50`, `text-rose-700`): Overdue KDS tickets ($>20$m), critical low stock, voids.
* **Responsive Grid Architecture**:
  * Desktop ($\ge 1280\text{px}$): 4-column KPI ribbon + 2-column operational canvas.
  * Tablet ($768\text{px} - 1279\text{px}$): 2-column adaptive flow.
  * Mobile ($< 768\text{px}$): 1-column touch-friendly cards with horizontal swipe ribbons.

---

## 3. Screen Layout & Component Wireframes (`/dashboard`)

### 3.1 Header & Time-Period Filter Bar

```
+-----------------------------------------------------------------------------------------------------------------------+
|  SPICE GARDEN BISTRO  •  EXECUTIVE DASHBOARD                                            [ 🖨️ Daily Summary ] [ ⚙️ ]  |
|  Live store operations, sales performance, and kitchen throughput.                                                    |
+-----------------------------------------------------------------------------------------------------------------------+
|  DATE PRESET: [ Today (Live) ▼ ]  |  CHANNEL: [ All Channels ▼ ]  |  STORE STATUS: 🟢 Open  |  LAST SYNC: Just now     |
|  [ Today ]  [ Yesterday ]  [ Last 7 Days ]  [ Month to Date ]  [ Custom Date Range... ]                               |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

### 3.2 Module 1: Real-Time Executive KPI Ribbon

5 high-impact metric tiles displaying live metrics with period-over-period percentage comparison:

```
+-----------------------------------------------------------------------------------------------------------------------+
|  💰 NET REVENUE         |  🧾 TOTAL ORDERS       |  📈 AVG ORDER VALUE    |  🪑 TABLE OCCUPANCY    |  ⏱️ AVG KITCHEN PREP |
|  ₹ 1,48,500.00          |  142 Orders            |  ₹ 1,045.77            |  78% (18 / 23 Tables)  |  18.4 mins           |
|  ▲ +14.2% vs yesterday  |  ▲ +8.5% vs yesterday  |  ▲ +5.2% vs last week  |  68 Guests seated      |  ▼ -2.1 min (Faster) |
|  [ 124 Paid • 18 Open ] |  [ 92 Dine • 50 Online]|  [ Top Ticket: ₹4,200] |  [ 5 Tables Available] |  [ Target: < 20 min] |
+-----------------------------------------------------------------------------------------------------------------------+
```

#### Math & Calculation Engine
* **Net Revenue**: $\sum \text{orders.totalAmount}$ where `paymentStatus === "Paid"` and `isRejected !== true`.
* **Period Comparison ($\Delta$)**: Percentage difference against the matching prior timeframe (e.g. Current Day vs Prior Day at same hour, or Current Week vs Prior Week).
* **Average Order Value (AOV)**: $\frac{\text{Net Revenue}}{\text{Total Completed Orders}}$.
* **Table Occupancy**: $\frac{\text{Occupied Tables}}{\text{Total Active Tables}} \times 100\%$.
* **Avg Kitchen Prep Time**: Average elapsed duration between order placement and `allStationItemsReady: true` recorded in `orderActivities`.

---

### 3.3 Module 2: Live Operational Floor & Kitchen Cockpit

Provides instant visibility into physical restaurant operations:

```
+────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────+
│ 🪑 LIVE FLOOR & TABLE STATUS (23 Tables Total)         │ 🍳 KITCHEN & KDS BACKLOG PULSE                               │
├────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│  🟢 OCCUPIED (Seated):         14 Tables (52 Guests)   │  🟡 IN PREPARATION:            8 Tickets (24 Items)          │
│  🟡 BILLED (Payment Pending):   4 Tables (16 Guests)   │  🟢 READY FOR PICKUP:          4 Tickets (Packed at pass)    │
│  ⚪ AVAILABLE (Ready to Seat):  5 Tables (20 Capacity) │  🔴 OVERDUE (> 20 MINS):        1 Ticket  (#ORD-1038, 22m)   │
│                                                        │                                                              │
│  [ Quick Jump: Open Interactive Floor Plan ➔ ]         │  [ Quick Jump: Open Kitchen KDS Display ➔ ]                  │
+────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────+
│ 🛵 ONLINE & DELIVERY FLEET STATUS                      │ 👥 FRONT-OF-HOUSE QUEUE & WAITLIST                           │
├────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│  • New Incoming Web Orders:    3 Orders (Needs Accept) │  • Waiting Parties:            6 Parties (18 Guests)         │
│  • Dispatched with Courier:    5 Orders (Porter Fleet) │  • Average Wait Time:          15 - 20 mins                  │
│  • Out for Takeaway Pickup:    4 Orders (Tokens Ready) │  • Next Party to Seat:         Sharma (Party of 4, #Q-08)    │
│                                                        │                                                              │
│  [ Quick Jump: View Online Orders Queue ➔ ]            │  [ Quick Jump: Host Stand Queue Management ➔ ]               │
+────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────+
```

---

### 3.4 Module 3: Revenue & Demand Trend Visualizations

Two interactive, responsive SVG visualization cards replacing the static empty chart:

```
+────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────+
│ 📈 HOURLY SALES & DEMAND DISTRIBUTION (TODAY)                          │ 🛵 SALES BY CHANNEL BREAKDOWN                │
├────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│   ₹k                                                                   │  Dine-In Restaurant Orders:   62% (₹ 92,070) │
│  25│                                            ██                     │  ████████████████████████                    │
│  20│                                            ██     ██              │  Online Delivery Store:       24% (₹ 35,640) │
│  15│                     ██                     ██     ██              │  █████████                                   │
│  10│                     ██     ██              ██     ██     ██       │  Takeaway Counter Pickup:     14% (₹ 20,790) │
│   5│     ██      ██      ██     ██      ██      ██     ██     ██       │  █████                                       │
│   0└──┴──██───┴──██───┴──██──┴──██───┴──██───┴──██──┴──██──┴──██──┴───  ├──────────────────────────────────────────────┤
│      11 AM   12 PM    1 PM   2 PM    3 PM    7 PM   8 PM   9 PM  10 PM │ 💳 PAYMENT METHODS ACCEPTED                  │
│                                                                        │  • UPI / Dynamic QR:          48% (₹ 71,280) │
│  Peak Lunch: 01:00 PM (₹18.5k)  •  Peak Dinner: 08:30 PM (₹24.8k)      │  • Credit / Debit Card:       28% (₹ 41,580) │
│                                                                        │  • Cash in Drawer:            24% (₹ 35,640) │
+────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────+
```

---

### 3.5 Module 4: Product Performance & Category Leaderboard

Displays menu intelligence directly on the dashboard:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────+
│ ⭐ TOP 5 BEST-SELLING DISHES (TODAY)                                                [ View Full Item Sales (PMIX) ➔ ]  │
+──────────────────────────┬─────────────────┬───────────┬──────────────┬──────────────┬──────────────┬─────────────────+
│ DISH NAME                │ CATEGORY        │ QTY SOLD  │ UNIT PRICE   │ GROSS SALES  │ REVENUE %    │ IN-STOCK STATUS │
+──────────────────────────+─────────────────+───────────+──────────────+──────────────+──────────────+─────────────────+
│ 1. Butter Chicken        │ Main Course     │ 48 orders │ ₹ 450.00     │ ₹ 21,600.00  │ 14.5%        │ 🟢 18 portions  │
│ 2. Paneer Butter Masala  │ Main Course     │ 36 orders │ ₹ 380.00     │ ₹ 13,680.00  │ 9.2%         │ 🟢 24 portions  │
│ 3. Garlic Butter Naan    │ Breads & Roti   │ 112 orders│ ₹  60.00     │ ₹  6,720.00  │ 4.5%         │ 🟢 In Stock     │
│ 4. Chicken Dum Biryani   │ Rice & Biryani  │ 28 orders │ ₹ 420.00     │ ₹ 11,760.00  │ 7.9%         │ 🟡 4 portions   │
│ 5. Tandoori Paneer Tikka │ Starters        │ 24 orders │ ₹ 280.00     │ ₹  6,720.00  │ 4.5%         │ 🟢 In Stock     │
+──────────────────────────┴─────────────────┴───────────┴──────────────┴──────────────┴──────────────┴─────────────────+
│ 🚨 86'd / OUT-OF-STOCK ITEMS TODAY:  Truffle Mushroom Risotto (Chef 86'd), Fresh Alphonso Shake (Ingredient Stockout) │
+───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

### 3.6 Module 5: Critical Inventory & Supply Warnings

Provides proactive loss-prevention and stockout alerts:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────+
│ 📦 CRITICAL INVENTORY ALERTS (RAW INGREDIENTS)                                          [ Open Inventory Ledger ➔ ]    │
+───────────────────────────────────┬─────────────────┬──────────────────┬─────────────────┬────────────────────────────+
│ RAW MATERIAL                      │ CURRENT STOCK   │ REFILL THRESHOLD │ DEFICIT / NEED  │ SUPPLIER STATUS            │
+───────────────────────────────────+─────────────────+──────────────────+─────────────────+────────────────────────────+
│ 🔴 Fresh Cooking Cream (Amul)     │ 1.5 Litres      │ 10.0 Litres      │ - 8.5 Litres    │ PO Drafted: #PO-20261023-01│
│ 🔴 Paneer / Cottage Cheese        │ 3.2 kg          │ 15.0 kg          │ - 11.8 kg       │ Supplier: Sharma Dairy Farm│
│ 🟡 Basmati Rice (Daawat Gold)     │ 12.0 kg         │ 25.0 kg          │ - 13.0 kg       │ Restock Recommended        │
+───────────────────────────────────┴─────────────────┴──────────────────┴─────────────────┴────────────────────────────+
```

---

### 3.7 Module 6: Executive Quick-Action Bar

Sticky footer action bar offering instant single-click jumps:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────+
│ ⚡ QUICK ACTIONS:  [ 🖥️ Cashier POS ]  [ 🍳 KDS Kitchen ]  [ 🪑 Floor Plan ]  [ 👥 Queue Stand ]  [ 📜 Shift Close (Z) ]│
+───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 4. Convex API Backend Contracts (`convex/dashboard.ts`)

To power the redesigned dashboard with sub-second reactive updates, 5 optimized Convex query endpoints are established:

### 4.1 Endpoint 1: `dashboard.getLiveExecutiveOverview`
* **Type**: `query` (Staff Access Required)
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    dateRangePreset?: "today" | "yesterday" | "last_7_days" | "month_to_date" | "custom",
    fromTimestamp?: number,
    toTimestamp?: number
  }
  ```
* **Response Payload**:
  ```typescript
  {
    kpis: {
      netRevenuePaise: number,
      formattedNetRevenue: string,
      revenueDeltaPercent: number, // e.g. +14.2
      totalOrdersCount: number,
      ordersDeltaPercent: number,
      paidOrdersCount: number,
      openOrdersCount: number,
      averageOrderValuePaise: number,
      formattedAov: string,
      aovDeltaPercent: number,
      tableOccupancyPercent: number,
      activeTablesCount: number,
      totalTablesCount: number,
      seatedGuestsCount: number,
      averageKitchenPrepMinutes: number,
      prepDeltaMinutes: number
    }
  }
  ```

---

### 4.2 Endpoint 2: `dashboard.getOperationalPulse`
* **Type**: `query` (Staff Access Required)
* **Args**: `{ organizationId?: Id<"organizations"> }`
* **Response Payload**:
  ```typescript
  {
    tables: {
      occupiedCount: number,
      billedCount: number,
      availableCount: number,
      totalCount: number
    },
    kitchen: {
      inPrepTicketsCount: number,
      readyTicketsCount: number,
      overdueTicketsCount: number,
      overdueTickets: Array<{
        orderId: Id<"orders">,
        orderNumber: string,
        tableNumber?: string,
        elapsedMinutes: number
      }>
    },
    online: {
      pendingAcceptanceCount: number,
      dispatchedCount: number,
      takeawayReadyCount: number
    },
    queue: {
      waitingPartiesCount: number,
      waitingGuestsCount: number,
      estimatedWaitMinutes: number,
      nextParty?: {
        name: string,
        partySize: number,
        token: string
      }
    }
  }
  ```

---

### 4.3 Endpoint 3: `dashboard.getHourlyDemandTrends`
* **Type**: `query`
* **Args**: `{ organizationId?: Id<"organizations">, targetDateYMD?: string }`
* **Response Payload**:
  ```typescript
  {
    hourlyBuckets: Array<{
      hour: number, // 0 to 23
      label: string, // "11 AM", "12 PM"
      revenuePaise: number,
      ordersCount: number
    }>,
    channelBreakdown: Array<{
      channel: "DineIn" | "Delivery" | "TakeAway" | "QR",
      revenuePaise: number,
      ordersCount: number,
      percentage: number
    }>,
    paymentBreakdown: Array<{
      mode: string,
      amountPaise: number,
      percentage: number
    }>
  }
  ```

---

### 4.4 Endpoint 4: `dashboard.getTopSellingProducts`
* **Type**: `query`
* **Args**: `{ organizationId?: Id<"organizations">, limit?: number }`
* **Response Payload**:
  ```typescript
  {
    topItems: Array<{
      rank: number,
      itemId: Id<"items">,
      name: string,
      categoryName: string,
      quantitySold: number,
      unitPricePaise: number,
      totalRevenuePaise: number,
      revenuePercentage: number,
      inStock: boolean,
      availablePortions?: number
    }>,
    outOfStockItems: Array<{
      itemId: Id<"items">,
      name: string,
      categoryName: string,
      reason: string
    }>
  }
  ```

---

### 4.5 Endpoint 5: `dashboard.getCriticalInventoryAlerts`
* **Type**: `query`
* **Args**: `{ organizationId?: Id<"organizations"> }`
* **Response Payload**:
  ```typescript
  Array<{
    inventoryItemId: Id<"inventoryItems">,
    name: string,
    currentStock: number,
    unit: string,
    minRefillLevel: number,
    deficit: number,
    urgency: "critical" | "warning",
    pendingPoNumber?: string
  }>
  ```

---

## 5. Frontend Component Hierarchy (`pos-default/app/dashboard/`)

```
pos-default/app/dashboard/
├── page.tsx                           // Main Executive Dashboard Container
└── components/
    ├── DashboardHeader.tsx            // Date range presets, store status badge & refresh timer
    ├── ExecutiveKpiRibbon.tsx         // 5-Card KPI ribbon (Revenue, Orders, AOV, Occupancy, Prep Time)
    ├── KpiMetricCard.tsx              // Individual KPI card with icon, delta percentage, and trend spark
    ├── OperationalCockpit.tsx         // 4-Card live operational pulse (Floor, Kitchen, Delivery, Queue)
    ├── HourlyDemandChart.tsx          // Interactive SVG hourly sales and order count bar chart
    ├── ChannelDistributionChart.tsx   // Order source distribution & payment methods breakdown
    ├── TopSellingProductsTable.tsx    // PMIX bestsellers leaderboard & 86'd out-of-stock items banner
    ├── CriticalInventoryAlerts.tsx    // Low-stock raw material alert card with PO draft status
    ├── QuickActionsBar.tsx            // Sticky single-click navigation bar to core modules
    └── DigitalMenuCatalog.tsx         // Embedded multi-language live catalog viewer
```

---

## 6. Implementation Roadmap & Transition Strategy

1. **Remove `ComingSoonOverlay`**:
   - Retire the placeholder blocker component from `pos-default/app/dashboard/page.tsx`.
2. **Deploy `dashboard.ts` Convex API**:
   - Implement the 5 query endpoints aggregating data across `orders`, `orderItems`, `organizationTables`, and `inventoryItems`.
3. **Replace Hardcoded Mock Objects**:
   - Swap the static `const stats = [...]` and `const sourceData = [...]` arrays with live reactive `useQuery(api.dashboard.*)` subscriptions.
4. **Preserve `DigitalMenuCatalog` Integration**:
   - Maintain the multi-language localized menu catalog component within a dedicated tab or collapsible section.
5. **Add Role-Based Visibility**:
   - Super Admins / Store Owners see all financial revenue figures.
   - Chefs see kitchen throughput, ticket aging, and out-of-stock items.
   - Cashiers / Floor Managers see active table occupancy, queue count, and running orders.

---

## 7. Quality Assurance & Sign-off Checklist

- [x] **100% Live Reactive Data**: Replaces all static mock variables with real-time Convex subscriptions.
- [x] **No Coming Soon Wall**: Full interactive dashboard available immediately upon login.
- [x] **Accurate Financial Math**: Net sales strictly exclude pending, rejected, and refunded orders; uses minor units (paise).
- [x] **Dynamic Hourly Chart**: SVG visualization dynamically plotting lunch and dinner peak hours.
- [x] **Operational Cockpit**: Live synchronization with active table statuses, KDS tickets, and waitlist counts.
- [x] **Loss Prevention & Alerts**: Highlights tickets taking $> 20$ minutes and raw ingredients below refill levels.
- [x] **Responsive Aesthetics**: High-contrast, warm editorial styling compatible with desktop, tablet, and mobile displays.
