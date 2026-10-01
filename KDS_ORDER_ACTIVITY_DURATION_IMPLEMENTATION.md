# KDS Phase 2 — Order Activity Duration & Preparation Timing Parity Implementation Report

## Executive Summary
This document confirms the completion of **KDS Phase 2: Order Activity Duration & Preparation Timing Tracking** in `pos-default`, achieving full backend parity with legacy `defx-pos`.

---

## 1. Legacy Duration Behavior

Auditing the legacy codebase (`defx-pos/app/models/order_activity.rb`, `defx-pos/app/lib/services/order_observer_service.rb`, and `defx-pos/db/schema.rb`) revealed the exact timing mechanics:

```ruby
# Legacy Rails Service (defx-pos)
since_first_step = order.order_activities.find_by(process_id: first_step_id)&.created_at
total_duration = Time.now - since_first_step
OrderActivity.create(
  order_id: order.id,
  process_id: process.id,
  activity_type: process.name,
  total_duration: total_duration
)
```

### Key Semantics Discovered:
1. **Activity Creation**:
   - Initial activity created at order creation (Position 1 / Initial step) with `total_duration = 0` (or `started_at = order.created_at`).
   - Subsequent activities created each time an order transitions to a new process stage.
2. **Duration Calculation**:
   - Calculated as the elapsed time between `Time.now` (server timestamp when the transition occurs) and `since_first_step` (the timestamp of the initial order activity / order creation).
   - In Rails, `Time.now - since_first_step` returns **seconds**.
3. **Step Lifecycle**:
   - Each transition closes the preceding active step (`completed_at = now`) and starts the new step (`started_at = now`).

---

## 2. Schema Changes

In `pos-default/convex/schema.ts`, the `orderActivities` table was extended with backward-compatible optional fields and performance indexes:

```typescript
// convex/schema.ts
orderActivities: defineTable({
  legacyId: v.optional(v.string()),
  organizationId: v.id("organizations"),
  orderId: v.id("orders"),
  processId: v.optional(v.id("organizationOrderProcesses")),
  processName: v.string(),
  position: v.number(),
  totalDuration: v.optional(v.number()), // Total duration in integer seconds elapsed since initial order step
  startedAt: v.optional(v.number()),     // Epoch timestamp in ms (process start)
  completedAt: v.optional(v.number()),   // Epoch timestamp in ms (process completion)
  createdAt: v.number(),
  updatedAt: v.optional(v.number()),
  deletedAt: v.optional(v.number()),
})
  .index("by_order", ["orderId"])
  .index("by_org", ["organizationId"])
  .index("by_order_process", ["orderId", "processId"])
  .index("by_legacy_id", ["legacyId"]),
```

### Field Rationale:
- `totalDuration`: Stores elapsed seconds since order inception (matching legacy integer seconds).
- `startedAt`: Server-authoritative epoch millisecond timestamp when the activity began.
- `completedAt`: Server-authoritative epoch millisecond timestamp when the activity transitioned out or finished.
- Backward compatibility: All new fields are `v.optional(...)`, allowing existing records without duration timestamps to remain fully readable without error.

---

## 3. Process Transition Changes & Authoritative Helper

An authoritative server-side helper `recordOrderActivity` was introduced in `pos-default/convex/orders.ts`:

```typescript
export async function recordOrderActivity(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    orderId: Id<"orders">;
    processId?: Id<"organizationOrderProcesses">;
    processName: string;
    position?: number;
    now?: number;
  }
)
```

### Integration Across Mutations:
1. `createOrder`:
   - Inserts initial activity (`position: 1`, `totalDuration: 0`, `startedAt: now`).
2. `updateOrderStatus`:
   - Calculates `totalDuration = Math.max(0, Math.round((now - sinceFirstStep) / 1000))` in seconds.
   - Sets `completedAt = now` on the previous active activity.
   - Inserts new activity (`totalDuration`, `startedAt: now`).
3. `completeOrder`:
   - Closes all remaining open activities for the order with `completedAt = now`.
4. `cancelOrder`:
   - Marks open activities as completed (`completedAt = now`) and appends a `"Cancelled"` activity record with cumulative elapsed duration.
5. `addItemsToExistingOrder` & `moveOrderTable`:
   - Logs modification activities using `recordOrderActivity`.
6. `razorpay.ts`:
   - Updated payment confirmation hooks to use `recordOrderActivity`.

---

## 4. Duration Unit

* **Duration Unit**: **Seconds** (integer).
* **Legacy Evidence**:
  In Ruby/Rails, subtracting two `Time` objects (`Time.now - since_first_step`) produces the difference as a `Float` in seconds. In `defx-pos`, `total_duration` is an integer/float column representing total elapsed seconds. In `pos-default`, `totalDuration = Math.max(0, Math.round((now - sinceFirstStep) / 1000))` maintains exact second-precision parity.

---

## 5. Repeated & Skipped Process Behavior

* **Skipped Processes** (e.g. `Placed` $\rightarrow$ `Ready`):
  - Does not invent artificial zero-duration records for omitted steps.
  - Automatically calculates `totalDuration` from the initial step timestamp to current transition time.
  - Closes the active initial step and opens the `Ready` step cleanly.
* **Repeated Processes** (e.g. `Preparing` $\rightarrow$ `Ready` $\rightarrow$ `Preparing` for food rework):
  - Appends a new activity record with updated cumulative `totalDuration`.
  - Closes the preceding `Ready` step with `completedAt = now`.
  - Accurately tracks preparation timeline without overwriting history.

---

## 6. Cancellation & Incomplete Behavior

* **Incomplete / In-Progress Orders**:
  - The latest activity retains `completedAt: undefined` while active.
  - Duration is actively visible via `totalDuration` or computed real-time in KDS queries.
* **Cancelled Orders**:
  - `cancelOrder` sets `isRejected: true` and logs a final `Cancelled` activity (position 99) with total elapsed duration.
  - All preceding active activities are finalized with `completedAt = now`.
* **Order Completion**:
  - `completeOrder` finalizes all open activities with `completedAt = now`.

---

## 7. KDS Query Integration

The KDS query `getStationOrders` in `convex/stations.ts` was enhanced to include `activities` and `currentDuration` for each order ticket:

```typescript
// convex/stations.ts -> getStationOrders
const activities = await ctx.db
  .query("orderActivities")
  .withIndex("by_order", (q) => q.eq("orderId", order._id))
  .collect();

const sortedActivities = activities
  .filter((a) => a.deletedAt === undefined)
  .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);

const latestActivity = sortedActivities[sortedActivities.length - 1];
const currentDuration = latestActivity?.totalDuration ?? 0;
```

---

## 8. Test Suite Results

A dedicated integration test suite `convex/orderActivities.test.ts` was implemented covering 8 comprehensive domain scenarios:

```bash
npx vitest run convex/orderActivities.test.ts convex/stations.test.ts convex/orders.test.ts convex/organizationOrderProcesses.test.ts convex/organizationPrinters.test.ts
```

### Results:
```text
 ✓ convex/organizationOrderProcesses.test.ts (20 tests)
 ✓ convex/organizationPrinters.test.ts (19 tests)
 ✓ convex/stations.test.ts (12 tests)
 ✓ convex/orders.test.ts (7 tests)
 ✓ convex/orderActivities.test.ts (8 tests)

 Test Files  5 passed (5)
      Tests  66 passed (66)
```

### Key Scenarios Verified:
1. `Initial order creation creates position 1 activity with totalDuration = 0 and startedAt`
2. `Sequential process transitions calculate totalDuration in seconds and close previous step`
3. `Order completion closes all open order activities`
4. `Skipped processes work cleanly and record duration since initial step`
5. `Repeated processes append new activities with updated cumulative duration`
6. `Cancelled order logs cancellation activity and closes open activities`
7. `KDS getStationOrders includes order activities and currentDuration metrics`
8. `Cross-organization isolation and backward compatibility`

---

## 9. Phase 1 Station & Routing Confirmation

All Phase 1 functionality remains 100% operational with 0 regressions:
- **Station backend parity**: COMPLETE (`stations` table and CRUD operations verified)
- **Station-item routing**: COMPLETE (`stationItems` join table and category bulk routing verified)
- **Order-item station assignment**: COMPLETE (`resolveOrderItemStation` auto-routes items on order creation)
- **KDS station filtering backend**: COMPLETE (`getStationOrders` queries tickets filtered by workstation)

---

## 10. Remaining KDS Backend Gaps

With the completion of `orderActivities.totalDuration`, `startedAt`, and `completedAt`:
- **All primary KDS backend schemas and duration metrics have achieved full parity with legacy `defx-pos`.**
- Next Recommended Step: Final read-only end-to-end KDS verification (order creation $\rightarrow$ station routing $\rightarrow$ KDS filtering $\rightarrow$ process transitions $\rightarrow$ item readiness $\rightarrow$ activity duration tracking $\rightarrow$ notifications $\rightarrow$ receipt printers).
