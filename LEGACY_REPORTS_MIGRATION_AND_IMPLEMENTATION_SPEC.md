# Legacy `defx-pos` Reports Migration & Convex Implementation Specification

## Document Overview
* **Status**: Complete Engineering Specification
* **Target Audience**: Full-Stack Engineers implementing reports in `pos-default`
* **Source System**: Ruby on Rails Monolith (`defx-pos`, PostgreSQL, Pagy, ActiveModelSerializers, WickedPdf)
* **Target System**: Next.js 14 + Convex Reactive Real-Time Database (`pos-default`, TypeScript)
* **Scope**: 5 Core Business Intelligence Domains:
  1. **Sales Reports** (`/reports/sales`)
  2. **Menu Reports** (`/reports/menu`) — Item Sales (PMIX) & Category Sales
  3. **Orders Reports** (`/reports/orders`) — Volume, AOV, Fulfillment & Delivery Times
  4. **Customer Reports** (`/reports/customers`) — Cohorts, Retention & Lifetime Spend
  5. **Operational Reports** (`/reports/operations`) — Order Processes/KDS Efficiency, Table Occupancy/Layouts, Payment Ledger & Z-Report Shift Close

---

## 1. Architectural Evolution: Rails vs. Convex

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    LEGACY RAILS (defx-pos)                                        |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| • PostgreSQL relational database with heavy SQL joins, EXTRACT(month), and full-table scans       |
| • Money stored in minor units (paise/cents: integer) with `/ 100.0` division scattered in Ruby  |
| • Historical typos in schema: `is_complated: true`                                                |
| • Polled / synchronous HTTP requests with Pagy pagination (`pagy_array`)                          |
| • PDF exports generated via WickedPdf / Prawn on server and uploaded to AWS S3                    |
| • Timezone issues: manual UTC-to-local timezone conversion using `organization_time_zone`         |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
                                                  ▼  MIGRATION & MODERNIZATION
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                                   MODERN CONVEX (pos-default)                                     |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| • High-performance serverless document store with reactive subscriptions (`useQuery`)            |
| • Money standardized in paise/cents (integer) with centralized currency formatting utils         |
| • Correct schema typing: `isCompleted: boolean`, `isRejected: boolean`, indexed by `[org, date]`|
| • Zero-lag indexed range scans: `.withIndex("by_created_at", q => q.eq(...).gte(...).lte(...))`  |
| • Instant client-side CSV downloads + Web Thermal ESC/POS print rendering                        |
| • Pure TypeScript aggregation pipelines with unified epoch timestamp boundaries (ms)              |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Legacy Rails Reports: Logic, Services & Formulas

In `defx-pos`, all reporting endpoints reside under `app/controllers/api/v1/reports_controller.rb` and execute business logic located in `app/lib/reports/*.rb`.

### 2.1 Common Legacy Conventions
* **Date Parsing**: Date strings are supplied as `DD/MM/YYYY` (e.g. `Date.strptime(params[:date_from], "%d/%m/%Y")`). If omitted, defaults to `Date.today`.
* **Completed Orders Filter**: Only completed orders are counted in reporting queries:
  ```ruby
  organization.orders.where(
    created_at: date_from.beginning_of_day..date_to.end_of_day,
    is_complated: true
  ).order(created_at: :asc)
  ```
* **Currency Formatting**: Amounts are stored as integers representing cents/paise:
  ```ruby
  def display_value(value)
    return 0.0 unless value
    "%0.2f" % (value / 100.00)
  end
  ```

---

### 2.2 Report 1: Sales Report (`Reports::SalesReportService`)
* **Legacy Controller Action**: `GET /api/v1/sales_report?date_from=...&date_to=...&page=...&per_page=...`
* **File Reference**: `app/lib/reports/sales_report_service.rb`

#### A. Metric Calculations & Formulas
1. **Total Gross Sales**:
   $$\text{Total Gross Sales} = \sum_{\text{orders}} \text{order.total}$$
2. **Total Tax Collected**:
   $$\text{Total Tax Collected} = \sum_{\text{orders}} (\text{order.c\_gst} + \text{order.s\_gst} + \text{order.i\_gst})$$
3. **Total Refund**:
   $$\text{Total Refund} = \sum_{\text{orders}} \left( \sum_{\text{order\_payments}} \text{payment.refund\_amount} \right)$$
4. **Total Net Sales**:
   $$\text{Total Net Sales} = \text{Total Gross Sales} - \text{Total Tax Collected} - \text{Total Refund}$$
5. **Total Orders**:
   $$\text{Total Orders} = \text{Count of completed orders in range}$$

#### B. Daily Breakdown (`sales_data`)
Orders are grouped by `order.created_at.to_date`:
* `gross_value`: $\sum \text{order.total}$ on that date
* `refund_value`: $\sum \text{payment.refund\_amount}$ on that date
* `taxes_value`: $\sum (\text{c\_gst} + \text{s\_gst} + \text{i\_gst})$ on that date
* `net_value`: $\text{gross\_value} - \text{refund\_value} - \text{taxes\_value}$
* `total_order`: Number of completed orders on that date

#### C. Legacy Response Payload
```json
{
  "total_gross_sales": "₹ 148500.00",
  "total_tax_collected": "₹ 7425.00",
  "total_refund": "₹ 450.00",
  "total_net_sales": "₹ 140625.00",
  "total_orders": 142,
  "sales_data": [
    {
      "date": "2026-10-15",
      "gross_value": "₹ 24500.00",
      "refund_value": "₹ 0.00",
      "taxes_value": "₹ 1225.00",
      "net_value": "₹ 23275.00",
      "total_order": 24
    }
  ],
  "length": 1
}
```

---

### 2.3 Report 2: Menu Reports (Item & Category PMIX)
The legacy codebase splits menu reporting into two specialized services:
1. `Reports::SalesByItemReportService` (`GET /api/v1/reports_controller#sales_by_item_report`)
2. `Reports::SalesByCategoryReportService` (`GET /api/v1/reports_controller#sales_by_category_report`)

#### A. Item Sales (Product Mix - PMIX) Logic
* **File Reference**: `app/lib/reports/sales_by_item_report_service.rb`
* Orders in date range are selected; all associated `OrderItem` records are retrieved.
* Items deleted from the catalog are filtered out via `missing_item_ids`.

**Metric Calculations**:
1. **Total Items Sold**: $\sum \text{order\_item.item\_quantity}$
2. **Average Item Price**: $\frac{\sum \text{order\_item.item\_price}}{\text{Total Items Sold}}$
3. **Top / Least Performing Items**: Sorted by `total_quantity` descending and ascending (Limit 5).
4. **Sales Contribution %**: $\frac{\text{item.total\_quantity}}{\text{Total Items Sold}} \times 100$
5. **Item Tax Calculations (Inclusive vs Exclusive)**:
   For taxable items (`is_taxable == true`), taxes are derived from order tax rates:
   * **If Tax Inclusive (`is_inclusive == true`)**:
     $$\text{Item Tax} = \text{gross\_sales} \times \frac{\text{tax\_rate}}{1 + \text{tax\_rate}}$$
     $$\text{Net Sales} = \text{gross\_sales} - \text{Item Tax}$$
   * **If Tax Exclusive (`is_inclusive == false`)**:
     $$\text{Item Tax} = \text{gross\_sales} \times \text{tax\_rate}$$
     $$\text{Gross Sales with Tax} = \text{gross\_sales} + \text{Item Tax}$$
     $$\text{Net Sales} = \text{gross\_sales}$$

#### B. Category Sales Logic
* **File Reference**: `app/lib/reports/sales_by_category_report_service.rb`
* Order items are grouped by their attached `Category`:
  * `items_sold`: Sum of item quantities under the category
  * `gross_sales`: Gross sum of item prices
  * `tax_collected`: Aggregated category tax
  * `net_sales`: `gross_sales - tax_collected`
  * `avg_item_price`: $\frac{\text{total\_sales}}{\text{total\_quantity}}$
  * Top and least performing categories by volume sold.

---

### 2.4 Report 3: Orders Report (`Reports::OrdersReportService`)
* **Legacy Controller Action**: `GET /api/v1/orders_report`
* **File Reference**: `app/lib/reports/orders_report_service.rb`

#### A. Key Performance Indicators (KPIs)
1. **Total Orders**: Count of completed orders in range.
2. **Total Average Order Value (AOV)**:
   $$\text{AOV} = \frac{\text{Total Gross Sales}}{\text{Total Orders}}$$
3. **Average Delivery / Fulfillment Time**:
   Calculated by joining `orders` with `order_activities` and taking the average of `total_duration` (in seconds):
   ```ruby
   durations = Order.joins(:order_activities)
                    .where(id: order_ids, is_complated: true)
                    .pluck(:total_duration).compact
   average_delivery_time = durations.sum / durations.size
   ```
4. **Peak Order Time Frame**:
   Orders are grouped by hour in the store's configured timezone (`local_time.hour`):
   ```ruby
   peak_hour = hourly_order_counts.max_by { |_, count| count }&.first
   # Formats e.g. "08 PM - 09 PM"
   ```
5. **Order Type Summary**:
   Orders are partitioned by `order_type` (e.g. `DineIn`, `TakeAway`, `Delivery`):
   * `total_by_order_type`: Count of orders in this channel
   * `avg_order_value`: Average total for this channel
   * `refunded_orders`: Count of orders with `order_payments.refund_amount > 0`
   * `avg_delivery_time`: Fulfillment duration for this channel

#### B. Daily Orders Table (`orders_data`)
Per date: `total_order`, `avg_order_value`, `average_delivery_time`, `peak_order_time_frame`, `avg_items_per_order` ($\frac{\sum \text{order\_items}}{\text{orders.size}}$), and `avg_order_type` (most frequent order channel).

---

### 2.5 Report 4: Customer Report (`Reports::CustomersReportService`)
* **Legacy Controller Action**: `GET /api/v1/customers_report`
* **File Reference**: `app/lib/reports/customers_report_service.rb`

#### A. Cohort & Retention Logic
1. **New Customers in Period**:
   Find all customer IDs who had orders created **before** `date_from.beginning_of_day`:
   ```ruby
   customer_ids_with_previous_orders = @organization.orders
     .where("created_at < ?", @date_from.beginning_of_day)
     .pluck(:user_id).uniq
   ```
   Orders whose `user_id` is NOT in that list are classified as **New Customers**.
2. **Repeat Customers**:
   $$\text{Repeat Customers} = \text{Total Customers} - \text{New Customers}$$
3. **Retention Rate**:
   $$\text{Retention Rate (\%)} = \left( \frac{\text{Repeat Customers}}{\text{Total Customers}} \right) \times 100$$
4. **Average Customer Spend**:
   $$\text{Average Customer Spend} = \frac{\sum_{\text{orders}} \text{order.total}}{\text{Total Customers}}$$

#### B. Daily Breakdown
Table rows contain: `date`, `total_customers`, `new_customers`, `repeat_customers`, `retention_rate`, and `avg_customer_spend`.

---

### 2.6 Report 5: Operational Reports
The legacy operational analytics encompass three services:
1. `Reports::ProcessesReportService` (KDS / Kitchen Process Performance)
2. `Reports::TablesReportService` (Table Dwell, Occupancy & Layouts)
3. `Reports::PaymentsReportService` (Payment Ledger & Float Reconciliation)

#### A. KDS & Order Process Analytics (`processes_report_service.rb`)
* **Average Time in Each Process**:
  $$\text{Avg Duration} = \frac{\sum \text{OrderActivity.total\_duration}}{\text{Total Orders}}$$
* **Order Processing Efficiency**:
  $$\text{Efficiency \%} = \left( \frac{\text{Activities with total\_duration} > 0}{\text{Total Activities}} \right) \times 100$$
* Daily tracking of throughput and kitchen bottlenecks.

#### B. Tables & Layouts Analytics (`tables_report_service.rb`)
* **Layout Occupancy Rate**:
  $$\text{Occupancy Rate (\%)} = \left( \frac{\text{Unique Tables Occupied in Layout}}{\text{Total Tables in Layout}} \right) \times 100$$
* **Average Occupancy Duration**: Total active duration spent across tables divided by table orders.
* **Layout Breakdown**: Layout name, total tables, orders served, occupancy rate %, peak occupancy time, average order value, and expected revenue contribution.
* Daily row: `most_used_table`, `layout`, `total_orders_served`, `avg_occupancy_duration`, `avg_occupancy_rate`, `avg_order_value`.

#### C. Payments & Cash Drawer Ledger (`payments_report_service.rb`)
* Net Payment per transaction: $\text{pay\_amount} - \text{refund\_amount}$.
* Grouping by `payment_mode`:
  * Total transactions, share percentage ($\frac{\text{mode\_txns}}{\text{total\_txns}} \times 100$), total net amount, and average transaction value.
* Identifies `most_used_mode` and `least_used_mode`.
* Daily breakdown of payment mode velocity.

---

## 3. Modern Convex Backend Architecture (`pos-default/convex/reports.ts`)

Convex replaces legacy controller actions with reactive TypeScript query functions that run directly against indexed tables.

### 3.1 Schema Requirements & Indexes Utilized
From `pos-default/convex/schema.ts`:
* `orders`: Indexed by `["organizationId", "createdAt"]` (`by_created_at`), `["organizationId", "orderStatusId"]` (`by_org_status`), and `["organizationId", "tableId"]` (`by_org_table`).
* `orderItems`: Indexed by `["organizationId"]` (`by_org`) and `["orderId"]` (`by_order`).
* `orderPayments`: Indexed by `["orderId"]` (`by_order`).
* `orderActivities`: Indexed by `["organizationId"]` (`by_org`) and `["orderId"]` (`by_order`).
* `customers`: Indexed by `["phone"]` (`by_phone`) and `["email"]` (`by_email`).
* `organizationTables`: Indexed by `["organizationId"]` (`by_org`).
* `organizationLayouts`: Indexed by `["organizationId"]` (`by_org`).

---

### 3.2 Convex Query Contracts & Signatures

All report queries take standard range parameters and optional channel filters:

```typescript
export interface ReportFilterArgs {
  organizationId: Id<"organizations">;
  fromTimestamp: number; // Unix epoch ms (inclusive start: 00:00:00.000)
  toTimestamp: number;   // Unix epoch ms (inclusive end: 23:59:59.999)
  orderType?: "DineIn" | "TakeAway" | "Delivery" | "ScheduledPickup" | "ScheduledDelivery";
  paymentMode?: string;
  tableId?: Id<"organizationTables">;
}
```

---

### 3.3 Implementation: Sales Report (`reports.getSalesReport`)

```typescript
// convex/reports.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getSalesReport = query({
  args: {
    organizationId: v.id("organizations"),
    fromTimestamp: v.number(),
    toTimestamp: v.number(),
    orderType: v.optional(v.string()),
    paymentMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Fetch completed orders in time range using index
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .gte("createdAt", args.fromTimestamp)
          .lte("createdAt", args.toTimestamp)
      )
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();

    // Filter by optional order type or payment mode
    const filteredOrders = orders.filter((o) => {
      if (args.orderType && o.orderType !== args.orderType) return false;
      if (args.paymentMode && o.paymentMode !== args.paymentMode) return false;
      return true;
    });

    // 2. Fetch order payments for refund calculation
    let totalGrossSales = 0;
    let totalTaxCollected = 0;
    let totalRefunds = 0;
    let totalDiscounts = 0;
    let totalDeliveryCharges = 0;

    // Grouping by date (YYYY-MM-DD in UTC / local store timezone)
    const dailyMap = new Map<string, {
      date: string;
      grossSales: number;
      taxCollected: number;
      refunds: number;
      netSales: number;
      orderCount: number;
    }>();

    // Hourly heatmap (0 to 23)
    const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      orderCount: 0,
      revenue: 0,
    }));

    for (const order of filteredOrders) {
      totalGrossSales += order.totalAmount;
      totalTaxCollected += order.taxTotal;
      totalDiscounts += order.discountAmount || 0;
      totalDeliveryCharges += order.deliveryCharge || 0;

      // Payments & Refunds
      const payments = await ctx.db
        .query("orderPayments")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      const orderRefund = payments.reduce((acc, p) => acc + (p.refundAmount || 0), 0);
      totalRefunds += orderRefund;

      // Group by Day
      const dateKey = new Date(order.createdAt).toISOString().split("T")[0];
      const existingDay = dailyMap.get(dateKey) || {
        date: dateKey,
        grossSales: 0,
        taxCollected: 0,
        refunds: 0,
        netSales: 0,
        orderCount: 0,
      };

      existingDay.grossSales += order.totalAmount;
      existingDay.taxCollected += order.taxTotal;
      existingDay.refunds += orderRefund;
      existingDay.netSales += (order.totalAmount - order.taxTotal - orderRefund);
      existingDay.orderCount += 1;
      dailyMap.set(dateKey, existingDay);

      // Hourly Heatmap
      const hour = new Date(order.createdAt).getHours();
      hourlyDistribution[hour].orderCount += 1;
      hourlyDistribution[hour].revenue += order.totalAmount;
    }

    const totalNetSales = totalGrossSales - totalTaxCollected - totalRefunds;
    const aov = filteredOrders.length > 0 ? Math.round(totalGrossSales / filteredOrders.length) : 0;

    return {
      kpis: {
        totalGrossSales,      // minor units
        totalTaxCollected,   // minor units
        totalRefunds,        // minor units
        totalNetSales,       // minor units
        totalDiscounts,      // minor units
        totalDeliveryCharges,// minor units
        totalOrders: filteredOrders.length,
        averageOrderValue: aov,
      },
      dailyBreakdown: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      hourlyDistribution,
    };
  },
});
```

---

### 3.4 Implementation: Menu PMIX & Category Report (`reports.getMenuReport`)

```typescript
export const getMenuReport = query({
  args: {
    organizationId: v.id("organizations"),
    fromTimestamp: v.number(),
    toTimestamp: v.number(),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    // 1. Fetch completed orders
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .gte("createdAt", args.fromTimestamp)
          .lte("createdAt", args.toTimestamp)
      )
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();

    const orderIds = new Set(orders.map((o) => o._id));

    // 2. Fetch order items for these orders
    const allOrderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const relevantItems = allOrderItems.filter((item) => orderIds.has(item.orderId));

    // 3. Aggregate by Item
    const itemMap = new Map<string, {
      itemId: Id<"items">;
      itemName: string;
      unitPrice: number;
      quantitySold: number;
      grossRevenue: number;
    }>();

    let totalQuantitySold = 0;
    let totalMenuRevenue = 0;

    for (const item of relevantItems) {
      totalQuantitySold += item.quantity;
      totalMenuRevenue += item.totalPrice;

      const key = item.itemId;
      const existing = itemMap.get(key) || {
        itemId: item.itemId,
        itemName: item.itemName,
        unitPrice: item.itemPrice,
        quantitySold: 0,
        grossRevenue: 0,
      };

      existing.quantitySold += item.quantity;
      existing.grossRevenue += item.totalPrice;
      itemMap.set(key, existing);
    }

    // Attach Category information
    const itemRecords = Array.from(itemMap.values());
    const itemDetails = await Promise.all(
      itemRecords.map(async (rec) => {
        const itemDoc = await ctx.db.get(rec.itemId);
        // Find category via categoryItems
        const categoryRel = await ctx.db
          .query("categoryItems")
          .withIndex("by_item", (q) => q.eq("itemId", rec.itemId))
          .first();

        let categoryName = "Uncategorized";
        let catId: Id<"categories"> | undefined;
        if (categoryRel) {
          const cat = await ctx.db.get(categoryRel.categoryId);
          if (cat) {
            categoryName = cat.name;
            catId = cat._id;
          }
        }

        const salesShare = totalQuantitySold > 0 ? (rec.quantitySold / totalQuantitySold) * 100 : 0;

        return {
          ...rec,
          categoryId: catId,
          categoryName,
          salesSharePercentage: Number(salesShare.toFixed(2)),
        };
      })
    );

    // Optional category filtering
    const filteredItems = args.categoryId
      ? itemDetails.filter((i) => i.categoryId === args.categoryId)
      : itemDetails;

    // Top 5 & Least 5
    const topPerforming = [...filteredItems].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5);
    const leastPerforming = [...filteredItems].sort((a, b) => a.quantitySold - b.quantitySold).slice(0, 5);

    // Aggregate by Category
    const categoryMap = new Map<string, {
      categoryName: string;
      itemsSold: number;
      grossRevenue: number;
    }>();

    for (const item of itemDetails) {
      const existing = categoryMap.get(item.categoryName) || {
        categoryName: item.categoryName,
        itemsSold: 0,
        grossRevenue: 0,
      };
      existing.itemsSold += item.quantitySold;
      existing.grossRevenue += item.grossRevenue;
      categoryMap.set(item.categoryName, existing);
    }

    const categoryBreakdown = Array.from(categoryMap.values()).map((cat) => ({
      ...cat,
      revenuePercentage: totalMenuRevenue > 0 ? Number(((cat.grossRevenue / totalMenuRevenue) * 100).toFixed(2)) : 0,
    }));

    return {
      kpis: {
        totalItemsSold: totalQuantitySold,
        totalMenuRevenue,
        avgItemPrice: totalQuantitySold > 0 ? Math.round(totalMenuRevenue / totalQuantitySold) : 0,
        topItem: topPerforming[0] || null,
        leastItem: leastPerforming[0] || null,
      },
      topPerformingItems: topPerforming,
      leastPerformingItems: leastPerforming,
      itemSalesTable: filteredItems,
      categoryBreakdown,
    };
  },
});
```

---

### 3.5 Implementation: Orders Report (`reports.getOrdersReport`)

```typescript
export const getOrdersReport = query({
  args: {
    organizationId: v.id("organizations"),
    fromTimestamp: v.number(),
    toTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .gte("createdAt", args.fromTimestamp)
          .lte("createdAt", args.toTimestamp)
      )
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();

    let totalRevenue = 0;
    const channelMap = new Map<string, { count: number; revenue: number }>();
    const hourlyMap = new Map<number, number>();

    // Activities for duration calculation
    const allActivities = await ctx.db
      .query("orderActivities")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const activityByOrder = new Map<string, number>();
    for (const act of allActivities) {
      if (act.totalDuration && act.totalDuration > 0) {
        const cur = activityByOrder.get(act.orderId) || 0;
        activityByOrder.set(act.orderId, cur + act.totalDuration);
      }
    }

    let totalDurationSum = 0;
    let durationCount = 0;

    for (const order of orders) {
      totalRevenue += order.totalAmount;

      // Channel split
      const ch = order.orderType;
      const curCh = channelMap.get(ch) || { count: 0, revenue: 0 };
      curCh.count += 1;
      curCh.revenue += order.totalAmount;
      channelMap.set(ch, curCh);

      // Hourly Peak
      const hr = new Date(order.createdAt).getHours();
      hourlyMap.set(hr, (hourlyMap.get(hr) || 0) + 1);

      // Duration
      const dur = activityByOrder.get(order._id);
      if (dur !== undefined) {
        totalDurationSum += dur;
        durationCount += 1;
      }
    }

    // Determine Peak Window
    let peakHour = 12;
    let maxHourCount = 0;
    for (const [hour, count] of hourlyMap.entries()) {
      if (count > maxHourCount) {
        maxHourCount = count;
        peakHour = hour;
      }
    }

    const startH = peakHour % 12 || 12;
    const endH = (peakHour + 1) % 12 || 12;
    const ampm = peakHour >= 12 ? "PM" : "AM";
    const peakTimeFrame = `${startH} ${ampm} - ${endH} ${ampm}`;

    const avgDeliveryTimeSeconds = durationCount > 0 ? Math.round(totalDurationSum / durationCount) : 0;
    const aov = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

    const channelSummary = Array.from(channelMap.entries()).map(([channel, data]) => ({
      channel,
      totalOrders: data.count,
      totalRevenue: data.revenue,
      avgOrderValue: Math.round(data.revenue / data.count),
      sharePercentage: Number(((data.count / orders.length) * 100).toFixed(2)),
    }));

    return {
      kpis: {
        totalOrders: orders.length,
        averageOrderValue: aov,
        averageFulfillmentTimeSeconds: avgDeliveryTimeSeconds,
        peakOrderTimeFrame: peakTimeFrame,
      },
      channelSummary,
    };
  },
});
```

---

### 3.6 Implementation: Customer Report (`reports.getCustomerReport`)

```typescript
export const getCustomerReport = query({
  args: {
    organizationId: v.id("organizations"),
    fromTimestamp: v.number(),
    toTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Orders in target period
    const periodOrders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .gte("createdAt", args.fromTimestamp)
          .lte("createdAt", args.toTimestamp)
      )
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();

    // 2. Identify customers who had orders prior to the start of period
    const priorOrders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .lt("createdAt", args.fromTimestamp)
      )
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();

    const historicalCustomerKeys = new Set<string>();
    for (const po of priorOrders) {
      if (po.customerId) historicalCustomerKeys.add(po.customerId);
      else if (po.customerPhone) historicalCustomerKeys.add(po.customerPhone);
    }

    // 3. Classify period customers
    const uniqueCustomerKeysInPeriod = new Set<string>();
    let newCustomersCount = 0;
    let totalSpend = 0;

    const customerSpendMap = new Map<string, {
      name: string;
      phone: string;
      orderCount: number;
      totalSpend: number;
      isNew: boolean;
    }>();

    for (const ord of periodOrders) {
      totalSpend += ord.totalAmount;
      const key = ord.customerId || ord.customerPhone || "Guest";
      uniqueCustomerKeysInPeriod.add(key);

      const isNew = !historicalCustomerKeys.has(key);

      const existing = customerSpendMap.get(key) || {
        name: ord.customerName || "Guest Customer",
        phone: ord.customerPhone || "N/A",
        orderCount: 0,
        totalSpend: 0,
        isNew,
      };

      existing.orderCount += 1;
      existing.totalSpend += ord.totalAmount;
      customerSpendMap.set(key, existing);
    }

    for (const key of uniqueCustomerKeysInPeriod) {
      if (!historicalCustomerKeys.has(key)) {
        newCustomersCount += 1;
      }
    }

    const totalUniqueCustomers = uniqueCustomerKeysInPeriod.size;
    const repeatCustomersCount = Math.max(0, totalUniqueCustomers - newCustomersCount);
    const retentionRate = totalUniqueCustomers > 0
      ? Number(((repeatCustomersCount / totalUniqueCustomers) * 100).toFixed(2))
      : 0;

    const avgSpend = totalUniqueCustomers > 0 ? Math.round(totalSpend / totalUniqueCustomers) : 0;

    return {
      kpis: {
        totalCustomers: totalUniqueCustomers,
        newCustomers: newCustomersCount,
        repeatCustomers: repeatCustomersCount,
        retentionRate,
        avgCustomerSpend: avgSpend,
      },
      topCustomers: Array.from(customerSpendMap.values())
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 10),
    };
  },
});
```

---

### 3.7 Implementation: Operational Reports (`reports.getOperationalReport`)

```typescript
export const getOperationalReport = query({
  args: {
    organizationId: v.id("organizations"),
    fromTimestamp: v.number(),
    toTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Orders and Activities
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_created_at", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .gte("createdAt", args.fromTimestamp)
          .lte("createdAt", args.toTimestamp)
      )
      .filter((q) => q.eq(q.field("isCompleted"), true))
      .collect();

    const orderIds = new Set(orders.map((o) => o._id));

    const activities = await ctx.db
      .query("orderActivities")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const periodActivities = activities.filter((a) => orderIds.has(a.orderId));
    const completedActivities = periodActivities.filter((a) => (a.totalDuration || 0) > 0);

    const efficiencyRate = periodActivities.length > 0
      ? Number(((completedActivities.length / periodActivities.length) * 100).toFixed(2))
      : 100;

    // 2. Table Occupancy Analytics
    const allTables = await ctx.db
      .query("organizationTables")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const occupiedTableIds = new Set(
      orders.map((o) => o.tableId).filter((tid): tid is Id<"organizationTables"> => !!tid)
    );

    const totalTables = allTables.length;
    const occupiedCount = occupiedTableIds.size;
    const occupancyPercentage = totalTables > 0 ? Number(((occupiedCount / totalTables) * 100).toFixed(2)) : 0;

    // 3. Payment Mode Reconciliation Ledger
    const paymentModeMap = new Map<string, {
      mode: string;
      txnCount: number;
      grossAmount: number;
      refundAmount: number;
      netAmount: number;
    }>();

    for (const order of orders) {
      const payments = await ctx.db
        .query("orderPayments")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const p of payments) {
        const mode = p.paymentModeName || "Unknown";
        const existing = paymentModeMap.get(mode) || {
          mode,
          txnCount: 0,
          grossAmount: 0,
          refundAmount: 0,
          netAmount: 0,
        };

        const pay = p.payAmount || p.amount;
        const ref = p.refundAmount || 0;
        existing.txnCount += 1;
        existing.grossAmount += pay;
        existing.refundAmount += ref;
        existing.netAmount += (pay - ref);
        paymentModeMap.set(mode, existing);
      }
    }

    return {
      kdsPerformance: {
        totalOrdersReceived: orders.length,
        totalActivitiesTracked: periodActivities.length,
        orderProcessingEfficiency: efficiencyRate,
      },
      tableOccupancy: {
        totalTables,
        occupiedTables: occupiedCount,
        occupancyPercentage,
      },
      paymentLedger: Array.from(paymentModeMap.values()),
    };
  },
});
```

---

## 4. Frontend Architecture: `pos-default` Implementation Guide

### 4.1 Route & File Structure
All reporting routes live under `/reports`:

```
pos-default/app/reports/
├── layout.tsx                         // Persistent Report Nav & Topbar
├── page.tsx                           // Redirects to /reports/sales
├── sales/page.tsx                     // Sales & Revenue Summary
├── menu/page.tsx                      // Menu PMIX & Category Performance
├── orders/page.tsx                    // Order Volume & Channel Fulfillment
├── customers/page.tsx                 // Customer Cohorts & Retention
├── operations/page.tsx                // Kitchen Processes & Table Occupancy
├── z-report/page.tsx                  // End-of-Day Shift Closeout Chit
└── components/
    ├── ReportsFilterBar.tsx           // Date Presets, Datepicker & Channel Dropdown
    ├── ReportStatCard.tsx             // KPI Tiles with Micro-Trend Indicators
    ├── HourlyHeatmapChart.tsx         // Accessible SVG Bar Chart
    ├── DataTablePagination.tsx        // Standard Table Controls (10, 25, 50 rows)
    ├── ExportDropdown.tsx             // CSV Download & Thermal Print Triggers
    └── ZReportReceiptModal.tsx        // 80mm ESC/POS Virtual Slip Preview
```

---

### 4.2 Global Filter Bar State Management
State should sync with the URL query parameters so reports can be shared, bookmarked, or refreshed:
* `preset`: `today` | `yesterday` | `thisWeek` | `last7Days` | `mtd` | `custom`
* `from`: ISO string or epoch ms
* `to`: ISO string or epoch ms
* `channel`: `all` | `DineIn` | `TakeAway` | `Delivery`

#### Date Range Resolution Helper
```typescript
// app/reports/utils/datePresets.ts
export function resolveDateRange(preset: string, customFrom?: string, customTo?: string) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "last7Days": {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      return { from: startOfDay(past), to: endOfDay(now) };
    }
    case "mtd": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(firstDay), to: endOfDay(now) };
    }
    case "custom":
      return {
        from: customFrom ? new Date(customFrom).getTime() : startOfDay(now),
        to: customTo ? new Date(customTo).getTime() : endOfDay(now),
      };
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}
```

---

### 4.3 Screen-by-Screen UI Specifications

#### 1. Sales & Revenue Page (`/reports/sales`)
* **KPI Row (5 Tiles)**:
  1. Gross Sales (Total revenue before taxes and discounts)
  2. Total Discounts (Coupon codes + Cashier discounts)
  3. Total Taxes Collected (CGST + SGST + VAT)
  4. Total Refunds Issued
  5. Net Settled Sales
* **Visual Component**: Hourly Sales Heatmap bar chart (`HourlyHeatmapChart.tsx`) showing sales volume by hour.
* **Daily Ledger Table**: Columns for `Date`, `Gross Sales`, `Discounts`, `Taxes`, `Refunds`, `Net Sales`, and `Orders`.

#### 2. Menu PMIX Page (`/reports/menu`)
* **KPI Row (4 Tiles)**: Total Items Sold, Menu Revenue, Average Item Price, Top Selling Item Name.
* **Category Breakdown Matrix**: Donut/Progress bar showing % revenue contribution per category.
* **Item Sales PMIX Table**:
  * Columns: `Item Name`, `Category`, `Unit Price`, `Qty Sold`, `Gross Revenue`, `Share %`.
  * Search input & category filter pills.
  * Badges for top 5 ("Fast Mover") and bottom 5 ("Slow Mover").

#### 3. Orders Analytics Page (`/reports/orders`)
* **KPI Row (4 Tiles)**: Total Orders Punched, Average Order Value (AOV), Avg Kitchen Fulfillment Time (minutes), Peak Ordering Window.
* **Channel Distribution Grid**: Cards for `DineIn`, `TakeAway`, `Delivery`, and `ScheduledDelivery` with transaction count, revenue, and AOV.

#### 4. Customers Report Page (`/reports/customers`)
* **KPI Row (4 Tiles)**: Unique Customers, New Customers (1st-time), Repeat Customers, Retention Rate %, Avg Customer Spend.
* **Customer Leaderboard**: Top 10 Spenders in range with phone number, visits count, and total lifetime spend in period.

#### 5. Operational Analytics Page (`/reports/operations`)
* **KDS Kitchen Performance**: Order processing efficiency %, average dwell time per workstation.
* **Table & Layout Occupancy**: Table utilization % per floor layout, table turnaround times.
* **Payment Mode Reconciliation**: Matrix comparing Cash, UPI, Card, Aggregators with gross, refund, and net settled amounts.

#### 6. End-of-Day Z-Report (`/reports/z-report`)
* Shift closeout modal allowing cashier to enter **Counted Drawer Cash**.
* Calculates cash variance:
  $$\text{Variance} = \text{Counted Cash} - (\text{Opening Float} + \text{Cash Sales} - \text{Paid Outs})$$
* Generates an **80mm Thermal Receipt ESC/POS preview** that sends the print job to physical USB/Network thermal printers.

---

### 4.4 Client-Side CSV Export Utility

Instead of waiting for server-side Ruby Prawn/WickedPdf renders, the frontend converts Convex JSON payloads to CSV instantly:

```typescript
// app/reports/utils/exportCsv.ts
export function downloadReportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? "");
          return str.includes(",") ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

---

## 5. Engineer Implementation Roadmap

Follow these 6 tactical implementation milestones:

| Milestone | Deliverables | Verification Criteria |
|---|---|---|
| **Phase 1: Backend Convex Queries** | Create `pos-default/convex/reports.ts` containing the 5 core queries: `getSalesReport`, `getMenuReport`, `getOrdersReport`, `getCustomerReport`, `getOperationalReport`. | Write unit tests in `convex/reports.test.ts` verifying exact mathematical accuracy against sample orders. |
| **Phase 2: Common Layout & Filters** | Build `/reports/layout.tsx` and `ReportsFilterBar.tsx` supporting date presets, custom datepickers, and URL query synchronization. | Changing date presets immediately triggers Convex query re-execution without page reloads. |
| **Phase 3: Sales & Menu Screens** | Build `/reports/sales/page.tsx` and `/reports/menu/page.tsx` with KPI metric cards, tables, and hourly heatmap charts. | Cross-check Gross Sales - Taxes - Refunds == Net Sales across all views. |
| **Phase 4: Orders & Customer Screens** | Build `/reports/orders/page.tsx` and `/reports/customers/page.tsx` with channel splits and cohort retention calculations. | Confirm that customers ordering prior to the range are classified as "Repeat". |
| **Phase 5: Operations & Z-Report** | Build `/reports/operations/page.tsx` and `/reports/z-report/page.tsx` with cash drawer variance and thermal chit print triggers. | Shift closing chit prints cleanly on standard 80mm receipt format. |
| **Phase 6: CSV Export & RBAC** | Implement 1-click CSV export on every table and verify role permissions (e.g. Cashiers restricted to current shift). | CSV downloads instantly without memory leaks or missing headers. |

---

## 6. Mathematical Reconciliation Checklist for QA
Before approving the reports feature for production:
- [ ] **Net Sales Equation**: `Gross Sales - Total Tax Collected - Total Refunds == Total Net Sales`
- [ ] **AOV Equation**: `Total Gross Sales / Total Completed Orders == Average Order Value`
- [ ] **Payment Reconciliation**: `Sum(Payment Modes Net Amount) == Total Net Sales`
- [ ] **Retention Math**: `New Customers + Repeat Customers == Total Unique Customers in Period`
- [ ] **Drawer Float Variance**: `(Starting Float + Cash Sales - Cash Paid Out) - Actual Cash Counted == Cash Variance`
- [ ] **Currency Minor Unit Integrity**: All monetary values in Convex are stored as integer paise/cents and formatted with `Intl.NumberFormat` as `₹ XX,XXX.00` on the frontend.
