# KDS Station & Station-Item Backend Parity Implementation Report

## 1. Legacy Behavior Confirmed

From our audit of `defx-pos` (Ruby on Rails / PostgreSQL source of truth):

1. **`stations`** (`app/models/station.rb`):
   - Scoped to `organization_id`.
   - Fields: `name` (string, unique per organization among active records), `is_main` (boolean, indicates Master Expediter/Expo station), `deleted_at` (paranoid soft deletion).
   - Relationship: `has_many :station_items`, `has_many :items, through: :station_items`, `has_one :organization_printer, as: :resources`.

2. **`station_items`** (`app/models/station_item.rb`):
   - Join table mapping catalog `items` to `stations`.
   - Fields: `station_id` (UUID), `item_id` (UUID), `deleted_at` (soft deletion).
   - Validation: uniqueness on `[deleted_at, station_id]` for `item_id`.
   - Allows an item to belong to a specific station (or multiple stations in join table).

3. **Category Assignment** (`app/controllers/api/v1/station_items_controller.rb`):
   - Bulk assignment convenience: Resolves active items under `category_id` (`Category -> Category Items -> Station`) and creates `station_items` records for unassigned items. Does not persist a direct category-to-station foreign key.

4. **KDS Ticket Routing & Filtering** (`app/lib/services/order_observer_service.rb` & `app/controllers/api/v1/stations_controller.rb`):
   - When orders are placed, items are resolved to station IDs.
   - Station displays query orders containing line items assigned to that station (`station_items.item_id`).
   - Line-item cooking readiness is tracked via `order_items.is_ready`.

---

## 2. Schema Changes (`pos-default/convex/schema.ts`)

1. **`stations` Table Updated**:
   - Added: `updatedAt` (`v.optional(v.number())`), `deletedAt` (`v.optional(v.number())`), `legacyId` (`v.optional(v.string())`).
   - Indexes added: `.index("by_org_deleted", ["organizationId", "deletedAt"])`, `.index("by_legacy_id", ["legacyId"])`.

2. **`stationItems` Table Added**:
   ```typescript
   stationItems: defineTable({
     legacyId: v.optional(v.string()),
     organizationId: v.id("organizations"),
     stationId: v.id("stations"),
     itemId: v.id("items"),
     createdAt: v.number(),
     updatedAt: v.optional(v.number()),
     deletedAt: v.optional(v.number()),
   })
     .index("by_org", ["organizationId"])
     .index("by_org_station", ["organizationId", "stationId"])
     .index("by_org_item", ["organizationId", "itemId"])
     .index("by_station_item", ["stationId", "itemId"])
     .index("by_legacy_id", ["legacyId"])
   ```

3. **`orderItems` Table Updated**:
   - Added workstation routing indexes:
     - `.index("by_station", ["stationId"])`
     - `.index("by_org_station", ["organizationId", "stationId"])`

---

## 3. Station CRUD APIs (`pos-default/convex/stations.ts`)

- **`create`** (`mutation`): Organization-scoped creation of stations. Validates non-empty name, prevents duplicate active station names in the same organization (`"Hey! <name> is already taken."`), and records timestamps.
- **`update`** (`mutation`): Updates station `name` and `isMain` flag. Enforces organization ownership and duplicate name prevention.
- **`remove`** (`mutation`): Soft-deletes the station (`deletedAt: now`) and cascades soft-deletion to all active `stationItems` linked to that station.
- **`get`** (`query`): Fetches a single active station by ID with organization verification.
- **`list`** (`query`): Lists all active stations for the organization, sorted with Master Expo (`isMain: true`) first, followed by alphabetical order.

---

## 4. Station-Item APIs (`pos-default/convex/stations.ts`)

- **`assignItemToStation`** (`mutation`): Maps a menu item to a station. Prevents duplicate active assignments (`"Hey! '<item>' is already assigned to '<station>'."`). Reactivates soft-deleted records if previously deleted.
- **`removeItemFromStation`** (`mutation`): Soft-deletes the item-to-station mapping.
- **`listStationItems`** (`query`): Returns all active menu items assigned to a station with joined item details (`name`, `price`, `isAvailable`, `isVeg`, `isSpicy`).
- **`listItemStations`** (`query`): Returns all active stations mapped to a specific menu item.

---

## 5. Category Bulk Assignment Behavior

- **`assignCategoryItemsToStation`** (`mutation`):
  - Fetches all active, published items under `categoryId` via `categoryItems`.
  - Iterates over items and adds/reactivates mappings in `stationItems`.
  - Skips already assigned items without overwriting or deleting unrelated mappings.
  - Returns `{ success: true, count: assignedCount, assignedItemIds }`.

---

## 6. Order-Item Routing Implementation (`pos-default/convex/orders.ts`)

- **Server-Side Helper `resolveOrderItemStation`**:
  - Queries `stationItems` by `organizationId` and `itemId`.
  - Resolves the active target `stationId` (verifying station is not soft-deleted).
  - Returns `undefined` safely for unassigned items.
- **Integration Points**:
  1. `createOrder` (Canonical ingestion for Dine-In, Takeaway, Delivery, Scheduled Pickup/Delivery, POS Cashier/Captain/Customer).
  2. `addItemsToExistingOrder` (Appending items to active orders).

---

## 7. KDS Query & Index Implementation

- **`getStationOrders`** (`query`):
  - Uses `.withIndex("by_org_station", q => q.eq("organizationId", orgId).eq("stationId", stationId))` on `orderItems`.
  - Groups line items by `orderId` and filters tickets so each station KDS receives only its relevant line items.
  - Computes `activeOrdersCount` and `allStationItemsReady` per ticket.
  - Fully reactive for live real-time touchscreen KDS displays.

---

## 8. Authorization

- Reuses canonical `requireMember`, `requireAdmin`, and `requireStationAdmin` helpers from `organizationUsers.ts`.
- Allows `admin`, `cashier`, `chef`, and store owners to manage stations and item routing.
- Restricts station querying (`getStationOrders`, `listStationItems`) to active store staff members (`admin`, `cashier`, `captain`, `waiter`, `chef`, `kds`, `worker`).
- Rejects unauthenticated callers and cross-organization requests with `"Forbidden"`.

---

## 9. Tests (`pos-default/convex/stations.test.ts`)

Added 12 automated unit and integration tests covering:
1. Station CRUD (create, get, list, update, soft-delete).
2. Duplicate name and validation enforcement.
3. Role authorization (Admin, Cashier, Chef allowed; strangers rejected).
4. Item assignment, duplicate prevention, and soft-delete removal.
5. Category bulk assignment to workstations.
6. Order item routing on `createOrder` (Grill vs Bar vs Unmapped).
7. Order item routing on `addItemsToExistingOrder`.
8. KDS station ticket segregation (`getStationOrders`).
9. Line item readiness toggling (`toggleOrderItemReady` $\rightarrow$ `allStationItemsReady`).
10. Customer online delivery order routing with customizations.
11. Multi-station join table membership.
12. Cross-store multi-tenant security isolation.

---

## 10. Validation Results

- `npx convex codegen`: **Passed** (TypeScript bindings generated cleanly).
- `npx tsc --noEmit`: **Passed** (0 errors).
- `npx vitest run convex/stations.test.ts convex/orders.test.ts convex/organizationPrinters.test.ts convex/organizationOrderProcesses.test.ts convex/menu.test.ts`: **Passed (64 / 64 tests passing)**.

---

## 11. Files Changed

- `convex/schema.ts` (Updated `stations`, added `stationItems`, updated `orderItems` indexes)
- `convex/stations.ts` (New module implementing Station CRUD, station-item mapping, category bulk assignment, routing helper, and KDS queries)
- `convex/orders.ts` (Integrated `resolveOrderItemStation` in `createOrder` and `addItemsToExistingOrder`)
- `convex/organizationPrinters.ts` (Updated `listStations` to filter soft-deleted stations)
- `convex/stations.test.ts` (New test suite with 12 comprehensive unit/integration tests)
- `KDS_STATION_ROUTING_IMPLEMENTATION.md` (Implementation documentation)

---

## 12. Remaining KDS Gaps (Out of Scope for this Task)

- `orderActivities.totalDuration` metric calculation per preparation stage.
- Dedicated interactive KDS touch-screen UI frontend (`/kds` screen redesign).
- Network ESC/POS hardware KOT print driver dispatch.

---

## Final Parity Status

```text
Station backend parity: COMPLETE
Station-item routing: COMPLETE
Order-item station assignment: COMPLETE
KDS station filtering backend: COMPLETE
```
