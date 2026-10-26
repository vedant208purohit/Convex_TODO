# Organization Reports Backend Architecture & API Specification

## 1. Executive Summary & Architectural Overview

This document specifies the architecture, calculation models, and API reference for the reporting system in **`pos-default`**, designed for the `reportsbackend` branch.

### 1.1 Architectural Comparison: Legacy Rails vs. Convex

| Aspect | Legacy Rails (`defx-pos` v1) | Modern Convex (`pos-default`) |
| :--- | :--- | :--- |
| **Data Engine** | PostgreSQL monolith with heavy relational joins (`JOIN order_activities`, `GROUP BY`) | Reactive serverless document store with dedicated range index (`by_created_at`) |
| **Execution Model** | Polled HTTP endpoints (`GET /api/v1/sales_report`) with Pagy pagination | Real-time reactive subscriptions (`useQuery(api.reports.getSalesReport, ...)`) |
| **Date Parsing** | Brittle string parsing (`Date.strptime(params[:date_from], "%d/%m/%Y")`) | Unix epoch millisecond timestamps (`fromTimestamp`, `toTimestamp`) |
| **Money Representation** | Integer paise/cents with `/ 100.0` divisions scattered across Ruby views | Integer minor units (cents/paise) consistently tracked end-to-end |
| **Client Workload** | Heavy reliance on client-side calculation or server-side Pagy arrays | High-performance server-side aggregation returning clean summary JSON |
| **Export Mechanism** | WickedPdf / Prawn server PDF rendering uploaded to AWS S3 | Instant client-side CSV export + Web Thermal ESC/POS (80mm) hardware printing |

---

## 2. Convex Schema & Indexing

All report functions run on [convex/reports.ts](file:///c:/Workspace/pos-default/convex/reports.ts) using the following database tables and indexes:

### 2.1 Utilized Indexes

| Table | Index Name | Indexed Fields | Query Pattern |
| :--- | :--- | :--- | :--- |
| `orders` | `by_created_at` | `["organizationId", "createdAt"]` | Range scan between `fromTimestamp` and `toTimestamp` |
| `orderPayments` | `by_order` | `["orderId"]` | Fetch payments and refunds for order |
| `orderItems` | `by_order` | `["orderId"]` | Fetch line items and quantities for PMIX |
| `orderActivities` | `by_order` | `["orderId"]` | Measure station preparation / delivery duration |
| `categoryItems` | `by_category` | `["categoryId"]` | Map menu items to category hierarchy |
| `organizationTables` | default | `["organizationId"]` | Table inventory and layout allocation |
| `organizationLayouts`| default | `["name"]` | Floor layout definitions |

---

## 3. Convex Reports API Reference ([convex/reports.ts](file:///c:/Workspace/pos-default/convex/reports.ts))

### 3.1 `api.reports.getSalesReport`

Aggregates gross revenue, collected taxes, customer refunds, and net sales over the specified time range.

#### Arguments
```typescript
{
  organizationId: Id<"organizations">,
  fromTimestamp: number,       // Unix epoch ms (e.g., 00:00:00.000)
  toTimestamp: number,         // Unix epoch ms (e.g., 23:59:59.999)
  orderType?: string,          // Optional channel filter: "DineIn" | "TakeAway" | "Delivery"
  paymentMode?: string         // Optional tender filter: "Cash" | "UPI" | "Card"
}
```

#### Formulas
* **Total Gross Sales**: $\sum \text{order.totalAmount}$
* **Total Tax Collected**: $\sum \text{order.taxTotal}$
* **Total Refund Given**: $\sum_{\text{orders}} \left( \sum_{\text{orderPayments}} \text{payment.refundAmount} \right)$
* **Total Net Sales**: $\text{Gross Sales} - \text{Tax Collected} - \text{Refunds}$

#### Response Structure
```typescript
{
  totalGrossSales: number,      // in paise / cents
  totalTaxCollected: number,
  totalRefund: number,
  totalNetSales: number,
  totalOrders: number,
  salesData: Array<{
    date: string,               // "YYYY-MM-DD"
    displayDate: string,        // "DD/MM/YYYY"
    grossPaise: number,
    refundPaise: number,
    taxPaise: number,
    netPaise: number,
    totalOrders: number
  }>,
  length: number
}
```

---

### 3.2 `api.reports.getOrdersReport`

Analyzes order velocity, average basket size, peak trading hours, fulfillment times, and channel distribution.

#### Arguments
```typescript
{
  organizationId: Id<"organizations">,
  fromTimestamp: number,
  toTimestamp: number,
  orderType?: string
}
```

#### Calculations
* **Average Order Value (AOV)**: $\frac{\text{Total Gross Sales}}{\text{Total Orders}}$
* **Peak Order Time Frame**: Orders are grouped by store local hour; returns the highest volume 1-hour window (e.g., `"08:00 PM - 09:00 PM"`).
* **Average Delivery / Fulfillment Time**: $\frac{\sum \text{orderActivities.totalDuration}}{\text{Count of recorded activities}}$ (in seconds).
* **Order Type Summary**: Breakdown by channel (`DineIn`, `TakeAway`, `Delivery`, `ScheduledPickup`, `ScheduledDelivery`) including order count, average ticket size, and refund rate.

#### Response Structure
```typescript
{
  totalOrders: number,
  totalAvgOrderValue: number,
  averageDeliveryTime: number,  // seconds
  peakOrderTimeFrame: string,
  orderTypeSummary: Array<{
    orderType: string,
    totalOrders: number,
    avgOrderValue: number,
    refundedOrders: number,
    avgDeliveryTime: number
  }>,
  ordersData: Array<{
    date: string,
    displayDate: string,
    totalOrders: number,
    avgOrderValue: number,
    averageDeliveryTime: number,
    peakOrderTimeFrame: string,
    avgItemsPerOrder: number,
    avgOrderType: string
  }>,
  length: number
}
```

---

### 3.3 `api.reports.getMenuReport`

Product Mix (PMIX) analytics evaluating individual dish performance and category revenue contribution.

#### Arguments
```typescript
{
  organizationId: Id<"organizations">,
  fromTimestamp: number,
  toTimestamp: number,
  reportBy?: "item" | "category"
}
```

#### Key Capabilities
* **Top & Bottom Performers**: Identifies the Top 5 and Bottom 5 selling menu items by unit volume.
* **Product Mix (PMIX) Table**:
  - `itemName`, `itemPricePaise`, `totalQuantity`, `grossSalesPaise`, `taxesPaise`, `netSalesPaise`, `salesPercentage`.
* **Category Breakdown Table**:
  - `categoryName`, `itemsSold`, `grossSalesPaise`, `taxesPaise`, `netSalesPaise`, `avgItemPricePaise`, `salesPercentage`.

---

### 3.4 `api.reports.getCustomerReport`

Cohort analytics comparing first-time guest acquisition against repeat diners and tracking guest retention rates.

#### Arguments
```typescript
{
  organizationId: Id<"organizations">,
  fromTimestamp: number,
  toTimestamp: number
}
```

#### Cohort Logic
1. Customer identity is determined via `customerId`, `customerPhone`, or `customerEmail`.
2. The server checks the `orders` table for any order placed by this guest **before** `fromTimestamp`.
   - Guest had prior orders $\rightarrow$ **Repeat Customer**
   - Guest had no prior orders $\rightarrow$ **New Customer**
3. **Retention Rate %**: $\left( \frac{\text{Repeat Customers}}{\text{Total Customers}} \right) \times 100$
4. **Average Customer Spend**: $\frac{\text{Total Net Sales}}{\text{Total Unique Customers}}$

---

### 3.5 `api.reports.getOperationalReport`

Covers three mission-critical restaurant operations domains:

#### A. Payment Mode Ledger
* Groups transactions by tender method (`Cash`, `Card`, `UPI`, `Split`).
* Calculates total payments, volume share %, net collected value, and average ticket per mode.
* Identifies `mostUsedMode` and `leastUsedMode`.
* Daily tender velocity breakdown.

#### B. Tables & Layout Occupancy
* **Occupancy Rate %**: $\left( \frac{\text{Unique Tables Occupied in Period}}{\text{Total Active Tables}} \right) \times 100$
* **Layout Breakdown**: Tables count, orders served, occupancy rate %, revenue generated, and average spend per layout.

#### C. Kitchen & Process Performance (KDS)
* Evaluates `orderActivities` to measure preparation bottlenecks.
* **Average Time in Process**: Prep duration per station.
* **Order Processing Efficiency %**: Percentage of kitchen tasks completed within SLA.

---

### 3.6 `api.reports.getZReportShiftSummary`

Designed for shift-end register balancing and daily closeout.

#### Arguments
```typescript
{
  organizationId: Id<"organizations">,
  fromTimestamp: number,
  toTimestamp: number
}
```

#### Returns
* **Order Metrics**: Total orders, completed orders, voided/cancelled count.
* **Revenue Metrics**: Gross sales, tax collected, total discounts, refunds given, net sales.
* **Payment Tender Breakdown**: Cash in drawer, card total, UPI total, other.

---

## 4. Frontend Integration Guide

To bind a report component in `app/components/reports/` to Convex:

```tsx
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function SalesReportContainer({ organizationId, fromTimestamp, toTimestamp }) {
  const salesReport = useQuery(api.reports.getSalesReport, {
    organizationId,
    fromTimestamp,
    toTimestamp,
  });

  if (salesReport === undefined) {
    return <LoadingSkeleton />;
  }

  return (
    <SalesReportView
      data={salesReport}
      loading={false}
    />
  );
}
```

---

## 5. Security & Multi-Tenancy

* All query handlers strictly require `organizationId: v.id("organizations")`.
* Every query uses `.withIndex("by_created_at", (q) => q.eq("organizationId", args.organizationId)...)` to enforce multi-tenant isolation at the index level. Data from other organizations is never scanned or exposed.
* Rejected and cancelled orders are segregated so that failed payments do not distort revenue metrics.
