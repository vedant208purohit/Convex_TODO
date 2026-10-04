# Organization QR Management & Analytics Specification and Implementation Documentation

## Executive Summary
This document provides the canonical architectural design, sub-ticket roadmap, API specifications, and implementation status for the **PREST QR Management and QR Analytics** backend module built on Convex.

The QR system serves as a lightweight **attribution layer** on top of the existing POS system, tracking customer telemetry from initial QR scan down to ordering session, cart activity, order creation, payment completion, and financial attribution—without creating duplicate POS or ordering tables.

---

## Core Architectural Principles

1. **Attribution Layer Over Secondary Systems**:
   - Reuses existing POS entities (`organizations`, `organizationTables`, `orders`).
   - Attaches attribution fields (`qrId`, `sessionId`, `tableId`) across the customer journey.

2. **Stable QR Identity**:
   - Updating QR metadata (e.g. display name, status) retains the exact same `_id` / QR identity. Printed QR stickers remain permanently functional.

3. **Soft Status & Data Retention**:
   - QR codes feature simple business statuses: `ACTIVE` and `INACTIVE`.
   - Disabling a QR prevents new ordering sessions, but **never soft-deletes or purges historical telemetry, scan records, or order attribution**.

4. **Multi-Tenant Outlet Isolation**:
   - Every mutation and query validates store membership and ensures tables/QR codes belong to the caller's organization.

5. **Outlet Timezone Awareness**:
   - All date/time analytics filter queries ("Today", "Yesterday", "Last 7 Days", "Last 30 Days") aggregate based on the store's configured `organizationTimeZone` (e.g., `"Asia/Kolkata"`).

---

## Sub-Ticket Roadmap & Final Status

| Sub-Ticket | Focus Area | Status | Key Deliverables & Test Files |
| :--- | :--- | :---: | :--- |
| **01. QR Foundation** | Schema, CRUD, Assignment & QR Resolution | **COMPLETED** | `organizationQrCodes.ts`, `schema.ts`, `organizationQrCodes.test.ts` (6/6 tests passed). |
| **02. QR Customer Journey** | Scan, Session & Cart Tracking | **COMPLETED** | `organizationQrCustomerJourney.ts`, `organizationQrCustomerJourney.test.ts` (4/4 tests passed). |
| **03. QR Order Attribution** | Orders, Payments & Revenue | **COMPLETED** | `organizationQrOrderAttribution.ts`, `organizationQrOrderAttribution.test.ts` (2/2 tests passed). |
| **04. Individual QR Analytics** | Table / QR Analytics API | **COMPLETED** | `getIndividualAnalytics` in `organizationQrAnalytics.ts`, `organizationQrAnalyticsAndEvents.test.ts`. |
| **05. QR Management & Performance** | Listing + Dashboard APIs | **COMPLETED** | `getOverallPerformance` & `listPaginated` in `organizationQrAnalytics.ts`. |
| **06. Events, Webhooks & Security** | Webhooks, Idempotency & Security | **COMPLETED** | `organizationQrEventsAndWebhooks.ts`, `organizationEventLogs` table, idempotency engine. |

---

## Complete Sub-Ticket Implementation Breakdown

### Sub-Ticket 01: QR Foundation (Status: COMPLETED)
- **Schema**: `organizationQrCodes` table (`status`, `organizationId`, `destination`, `publicToken`, `activatedAt`, `disabledAt`).
- **Functions**: `create`, `update`, `remove`, `enable`, `disable`, `resolvePublic`, `getByTable`, `list`.
- **Validations**: Dine-In table requirement, store table matching, unique QR display names per store.

### Sub-Ticket 02: QR Customer Journey (Status: COMPLETED)
- **Schema**: Added `organizationQrScans`, `organizationOrderingSessions`, `organizationCarts`.
- **Functions**: `recordScan` (rejects inactive QRs, reuses active session within 30m window), `recordCartActivity` (`hasItems` tracking for Cart Created metric), `getQrJourneyStats`.

### Sub-Ticket 03: QR Order Attribution (Status: COMPLETED)
- **Schema**: Added `qrId` and `sessionId` to `orders` table with `.index("by_qr")` and `.index("by_session")`.
- **Functions**: `attributeOrderToQr`, `updateOrderPaymentStatus`, `getOrderAttributionStats`.
- **Financial Rules**: Uses `orders.totalAmount` as source of truth; excludes cancelled/refunded orders.

### Sub-Ticket 04: Individual QR Analytics (Status: COMPLETED)
- **Function**: `getIndividualAnalytics` in `organizationQrAnalytics.ts`.
- **Metrics**: `scans`, `sessions`, `carts`, `orders`, `revenue`, `sessionConversion`, `cartConversion`, `orderConversion`, `cartToOrderConversion`, `ordersByTime` (0-23 hourly distribution), `peakTime` (e.g. `"7 PM – 9 PM"` derived from hourly orders), `topItems` (top 5 ordered menu items aggregated from valid orders).
- **Timezone Awareness**: Accepts `timezone` / store local date range bounds (`from`, `to`). Does not store derived conversion metrics as primary database fields.

### Sub-Ticket 05: QR Management & Overall Performance (Status: COMPLETED)
- **Functions**:
  - **`listPaginated`**: Supports searching by QR name, table number, placement, or channel; filtering by status (`ACTIVE`/`INACTIVE`) and channel (`ALL`, `DINE_IN`, `TAKEAWAY`, `DELIVERY`); page and limit pagination; returns embedded table metadata (`capacity`, `placement`, `zone`).
  - **`getOverallPerformance`**: Store-wide aggregation query calculating summary stats (`totalQr`, `activeQr`, `scans`, `sessions`, `orders`, `conversion`, `revenue`) and telemetry rows per QR/table (`qrId`, `name`, `type`, `zone`, `placement`, `scans`, `sessions`, `orders`, `conversion`, `revenue`).
  - **`createBatch`**: Mutation supporting multi-table QR creation. Validates each table, checks for pre-existing active QRs per table, and returns detailed `{ created: [...], failed: [...] }` batch result without failing the entire transaction on individual duplicate tables.

### Sub-Ticket 06: Webhooks, Events, Security & Reliability (Status: COMPLETED)
- **Schema**: `organizationEventLogs` table (`eventId`, `eventType`, `entityId`, `receivedAt`, `processedAt`, `processingStatus`, `error`).
- **Function**: `processEvent` in `organizationQrEventsAndWebhooks.ts` with strict `eventId` idempotency to prevent duplicate metric counting.
- **Security**: Strict store tenant authorization across all endpoints.

---

## Error Codes Reference

| Error Code | Description |
| :--- | :--- |
| `QR_NOT_FOUND` | QR code does not exist or has been soft-deleted. |
| `QR_INACTIVE` | QR code is disabled; cannot start new customer sessions or scans. |
| `INVALID_QR_TYPE` | QR type must be `DINE_IN`, `TAKEAWAY`, `DELIVERY`, or `QUEUE`. |
| `TABLE_NOT_FOUND` | Referenced dining table does not exist. |
| `TABLE_NOT_BELONG_TO_OUTLET` | Table belongs to another organization/store outlet. |
| `UNAUTHORIZED_QR_ACCESS` | Caller does not have authorization for requested store QR code. |
| `SESSION_NOT_FOUND` | Customer ordering session does not exist. |
| `ORDER_NOT_FOUND` | Order document not found in database. |

---

## Test Suite Execution Results

All 15 unit and integration tests passed across the 4 test suites:

```bash
 RUN  v4.1.11 C:/Workspace/pos-default

 ✓ convex/organizationQrCustomerJourney.test.ts (4 tests) 1104ms
 ✓ convex/organizationQrOrderAttribution.test.ts (2 tests) 1152ms
 ✓ convex/organizationQrAnalyticsAndEvents.test.ts (3 tests) 1299ms
 ✓ convex/organizationQrCodes.test.ts (6 tests) 196ms

 Test Files  4 passed (4)
      Tests  15 passed (15)
   Duration  4.01s
```
