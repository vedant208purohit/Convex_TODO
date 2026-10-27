# Organization Kitchen Workstations Frontend Functional Specification

## 1. Executive Summary & Domain Scope

The **Kitchen Workstations Subsystem** in `pos-default` (`/settings?tab=workstations` and `/settings/workstations`) provides store administrators, executive chefs, and operations managers with the core configuration engine for partitioning food and beverage production lines across distinct preparation zones in the kitchen.

It governs:
1. **Physical & Logical Station Definition**: Provisioning kitchen preparation hubs (e.g. **Grill & Tandoor**, **Fryer & Hot Kitchen**, **Salad & Cold Prep**, **Pizza & Oven**, **Beverage & Bar**).
2. **Master Expediter (Expo) Station (`isMain: true`)**: Designating the primary packing, plating, and quality control pass.
3. **Menu Item & Category Routing Matrix**: Dynamic item-to-station mapping (`stationItems`) and 1-click bulk category assignment.
4. **Hardware Station KOT Printer Linkage**: Binding ESC/POS network thermal printers directly to physical prep stations (`printerUseFor: "Station"`).
5. **Real-time KDS Ticket Dispatch**: Feeding filtered order items directly into dedicated Kitchen Display System (`/kds`) terminals.

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                               Omnichannel Order Ingestion Engine                                  │
│             [Cashier POS Terminal]  •  [Captain App]  •  [QR Dine-In]  •  [Online Store]           │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
                                                  ▼
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                              Workstation Item Routing Engine                                      │
│                  (Matches orderItems.itemId against stationItems mapping table)                   │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                          │                                               │
         ┌────────────────┴───────────────┐                               │
         ▼                                ▼                               ▼
+───────────────────+           +───────────────────+           +───────────────────+
│   GRILL STATION   │           │    BAR STATION    │           │  PIZZA & BAKERY   │
│ • Station KDS     │           │ • Station KDS     │           │ • Station KDS     │
│ • LAN KOT Printer │           │ • LAN KOT Printer │           │ • LAN KOT Printer │
+───────────────────+           +───────────────────+           +───────────────────+
         │                                │                               │
         └────────────────┬───────────────┘                               │
                          │                                               │
                          ▼ (All Station Line Items Aggregation)          │
+─────────────────────────────────────────────────────────────────────────┴─────────────────────────+
│                         MASTER EXPEDITER (EXPO) WORKSTATION (`isMain: true`)                      │
│                  Consolidates all stations, coordinates meal pacing & final dispatch             │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Feature Gating & User Roles (RBAC)

### 2.1 Store Feature Gating
* **Master Feature Flag**: `organizations.isWorkstation: true` and `organizationFeatures["is_workstation"].active`.
* When disabled, all menu items route to the default single kitchen queue and main receipt printer.
* When enabled, unlocks multi-station configuration under Settings and station tabs in `/kds`.

### 2.2 RBAC Role Matrix

| Action / Capability | Store Owner / Super Admin | Store Admin | Executive Chef | Cashier | Floor Captain / Waiter |
|---|---|---|---|---|---|
| **Create / Edit Workstation** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ❌ Read Only | ❌ Forbidden |
| **Delete Workstation** | ✅ Soft Delete | ✅ Soft Delete | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Assign Items & Categories** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Link Station Hardware Printer**| ✅ Full Access | ✅ Full Access | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Access Station KDS Terminal** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ✅ Full Access | 👁️ View Only |

---

## 3. Data Models & Convex Schema Definitions

The Workstation domain is backed by two primary tables in Convex (`stations` and `stationItems`) and polymorphic printer bindings (`organizationPrinters`):

### 3.1 Table: `stations`

| Field | Type | Required | Description | Constraints & Business Rules |
|---|---|---|---|---|
| `_id` | `Id<"stations">` | Yes | Unique station document identifier. | Primary Key. |
| `organizationId` | `Id<"organizations">` | Yes | Store reference identifier. | `.index("by_org", ["organizationId"])` |
| `name` | `string` | Yes | Display name of the preparation station. | Trimmed; unique per active store. Legacy error: *"Hey! {name} is already taken."* |
| `isMain` | `boolean` | Yes | Flags station as Master Expediter (Expo). | Exactly one `isMain: true` station per store recommended. |
| `legacyId` | `string` | Optional | Rails PostgreSQL legacy `stations.id` UUID. | `.index("by_legacy_id", ["legacyId"])` |
| `createdAt` | `number` | Yes | Epoch creation timestamp (ms). | Immutable. |
| `updatedAt` | `number` | Optional | Epoch last modification timestamp (ms). | Updated on patches. |
| `deletedAt` | `number` | Optional | Epoch soft deletion timestamp (ms). | Active station when `undefined`. |

### 3.2 Table: `stationItems`

| Field | Type | Required | Description | Constraints & Indexing |
|---|---|---|---|---|
| `_id` | `Id<"stationItems">` | Yes | Unique mapping document identifier. | Primary Key. |
| `organizationId` | `Id<"organizations">` | Yes | Store reference identifier. | `.index("by_org", ["organizationId"])` |
| `stationId` | `Id<"stations">` | Yes | Target kitchen workstation. | `.index("by_org_station", ["organizationId", "stationId"])` |
| `itemId` | `Id<"items">` | Yes | Assigned catalog menu item. | `.index("by_org_item", ["organizationId", "itemId"])` |
| `legacyId` | `string` | Optional | Rails legacy `station_items.id` UUID. | `.index("by_legacy_id", ["legacyId"])` |
| `createdAt` | `number` | Yes | Epoch mapping timestamp (ms). | Immutable. |
| `updatedAt` | `number` | Optional | Epoch last update timestamp (ms). | Maintained on reactivation. |
| `deletedAt` | `number` | Optional | Epoch soft deletion timestamp (ms). | Active mapping when `undefined`. |

### 3.3 Hardware Association: `organizationPrinters`
* Each workstation can be bound to a dedicated thermal receipt printer (`resources: "Station"`, `resourceId: station._id`, `printerUseFor: "Station"` or `"WorkStation"`).
* Network thermal printer specifications: ESC/POS protocol, Port `9100`, Static IP / LAN auto-discovery, 80mm / 58mm width.

---

## 4. UI Layout & Screen Workflows (`/settings?tab=workstations`)

### 4.1 Workstations Management Overview Screen

```
+-----------------------------------------------------------------------------------------------------------------------+
|  ⚙️ Settings > Kitchen Workstations                                                    [ ➕ Add New Workstation ]       |
|  Manage physical kitchen preparation stations, assign menu items, and configure dedicated KOT printers.               |
+-----------------------------------------------------------------------------------------------------------------------+
|  📊 TOTAL WORKSTATIONS   |  ⭐ MASTER EXPEDITER (EXPO) |  🍲 ASSIGNED MENU ITEMS |  🖨️ LINKED KOT PRINTERS            |
|     4 Active Stations    |     Main Kitchen Pass (Expo)|     124 / 148 Items     |     3 Network Printers Online       |
+-----------------------------------------------------------------------------------------------------------------------+
|  STATION NAME           | TYPE               | ASSIGNED ITEMS   | LINKED PRINTER         | ACTIONS                    |
+-------------------------+--------------------+------------------+------------------------+----------------------------+
| ⭐ Main Kitchen Pass    | Master Expo Pass   | All Items (148)  | 🖨️ Expo Printer (LAN)  | [ 👁️ View ] [ ✏️ Edit ]     |
| 🥩 Grill & Tandoor      | Prep Workstation   | 34 Items         | 🖨️ Tandoor Kitchen LAN | [ 👁️ View ] [ ✏️ Edit ] [🗑️] |
| 🍸 Bar & Beverage Bar   | Prep Workstation   | 42 Items         | 🖨️ Bar Counter Wi-Fi   | [ 👁️ View ] [ ✏️ Edit ] [🗑️] |
| 🍕 Pizza & Oven Prep    | Prep Workstation   | 28 Items         | — Not Linked —         | [ 👁️ View ] [ ✏️ Edit ] [🗑️] |
| 🥗 Cold Prep & Salads   | Prep Workstation   | 20 Items         | — Not Linked —         | [ 👁️ View ] [ ✏️ Edit ] [🗑️] |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 4.2 Modal 1: Create / Edit Workstation Modal

```
+─────────────────────────────────────────────────────────────────────────+
| ➕ Create Kitchen Workstation                                [ ✕ Close ] |
+─────────────────────────────────────────────────────────────────────────+
| Station Name *                                                          |
| [ Grill & Tandoor Station                                             ] |
| e.g. Grill, Bar, Pizza Oven, Cold Prep, Bakery                         |
|                                                                         |
| Workstation Role                                                        |
| [ ] Set as Master Expediter (Expo) Station                              |
|     (If enabled, this station monitors all items across all stations)   |
|                                                                         |
| KOT Thermal Printer Linkage (Optional)                                  |
| [ 🖨️ Kitchen Tandoor Printer (192.168.1.150:9100)                    ▼ ] |
+─────────────────────────────────────────────────────────────────────────+
|                                              [ Cancel ] [ Save Station ]|
+─────────────────────────────────────────────────────────────────────────+
```

### 4.3 Modal 2: Assign Items & Categories to Workstation

```
+─────────────────────────────────────────────────────────────────────────+
| 🍲 Assign Menu Items to "Grill & Tandoor Station"            [ ✕ Close ] |
+─────────────────────────────────────────────────────────────────────────+
| ⚡ QUICK ASSIGN BY CATEGORY                                              |
| Select an entire category to assign all its published items at once:   |
| [ Select Category: Tandoori Starters (18 items)                     ▼ ] |
| [ ➕ Assign Category Items (18) ]                                        |
+─────────────────────────────────────────────────────────────────────────+
| 🔍 SEARCH INDIVIDUAL MENU ITEMS                                         |
| [ 🔍 Search item name or SKU...                                       ] |
|                                                                         |
| [x] Chicken Tikka (Tandoori Starters)                       ₹ 340.00    |
| [x] Paneer Tikka (Tandoori Starters)                        ₹ 280.00    |
| [ ] Butter Chicken (Main Course)                            ₹ 420.00    |
| [x] Tandoori Roti (Breads)                                  ₹ 40.00     |
| [x] Garlic Naan (Breads)                                    ₹ 60.00     |
+─────────────────────────────────────────────────────────────────────────+
| Currently Assigned: 34 Items                     [ Cancel ] [ Save Changes ]|
+─────────────────────────────────────────────────────────────────────────+
```

---

## 5. Server-Side Routing Engine & Business Rules

### 5.1 Item to Station Resolution Algorithm (`resolveOrderItemStation`)

When an order is placed from any source (Cashier, Captain, QR, or Web Store), each line item is routed using the shared server-side helper:

```typescript
export async function resolveOrderItemStation(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  itemId: Id<"items">
): Promise<Id<"stations"> | undefined> {
  const mappings = await ctx.db
    .query("stationItems")
    .withIndex("by_org_item", (q) =>
      q.eq("organizationId", organizationId).eq("itemId", itemId)
    )
    .collect();

  const activeMappings = mappings.filter((m) => m.deletedAt === undefined);
  if (activeMappings.length === 0) {
    return undefined; // Unmapped items fallback to default kitchen queue
  }

  for (const mapping of activeMappings) {
    const station = await ctx.db.get(mapping.stationId);
    if (station && station.deletedAt === undefined) {
      return station._id;
    }
  }

  return undefined;
}
```

### 5.2 Unique Name Constraint & Rails Parity
* Enforces uniqueness of station names within the active organization:
  ```typescript
  const isDuplicate = existingStations.some(
    (st) =>
      st.deletedAt === undefined &&
      st.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (isDuplicate) {
    throw new Error(`Hey! ${trimmedName} is already taken.`);
  }
  ```

### 5.3 Cascading Soft-Deletion
* Soft-deleting a station via `stations.remove`:
  1. Sets `deletedAt = Date.now()` on the `stations` record.
  2. Automatically soft-deletes all associated `stationItems` records for that station.
  3. Unlinks the workstation from its assigned `organizationPrinters`.

---

## 6. Convex API Backend Contracts

### 6.1 Workstation Management Endpoints (`convex/stations.ts`)

#### 1. `stations.create`
* **Type**: `mutation` (Station Admin Access Required)
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    name: string,
    isMain?: boolean,
    legacyId?: string
  }
  ```
* **Validation**: Non-empty trimmed name, duplicate name check per store.
* **Response**: `{ success: true, id: Id<"stations"> }`

#### 2. `stations.update`
* **Type**: `mutation` (Station Admin Access Required)
* **Args**:
  ```typescript
  {
    id: Id<"stations">,
    name?: string,
    isMain?: boolean
  }
  ```
* **Response**: `{ success: true }`

#### 3. `stations.remove`
* **Type**: `mutation` (Station Admin Access Required)
* **Args**: `{ id: Id<"stations"> }`
* **Response**: `{ success: true }`
* **Description**: Soft deletes station and all its active item mappings.

#### 4. `stations.list`
* **Type**: `query` (Staff Access Required)
* **Args**: `{ organizationId?: Id<"organizations"> }`
* **Response**: `Array<Doc<"stations">>` (Sorted with `isMain: true` Master Expo station first, followed alphabetically by name).

#### 5. `stations.get`
* **Type**: `query` (Staff Access Required)
* **Args**: `{ id: Id<"stations"> }`
* **Response**: `Doc<"stations"> | null`

---

### 6.2 Station-Item Mapping Endpoints

#### 1. `stations.assignItemToStation`
* **Type**: `mutation`
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    stationId: Id<"stations">,
    itemId: Id<"items">,
    legacyId?: string
  }
  ```
* **Response**: `{ success: true, id: Id<"stationItems">, reactivated: boolean }`
* **Description**: Assigns menu item to station; reactivates soft-deleted mapping if previously existed.

#### 2. `stations.removeItemFromStation`
* **Type**: `mutation`
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    stationId: Id<"stations">,
    itemId: Id<"items">
  }
  ```
* **Response**: `{ success: true }`

#### 3. `stations.assignCategoryItemsToStation`
* **Type**: `mutation`
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    stationId: Id<"stations">,
    categoryId: Id<"categories">
  }
  ```
* **Response**:
  ```typescript
  {
    success: true,
    count: number,
    assignedItemIds: Array<Id<"items">>
  }
  ```
* **Description**: Fetches all active published items in the specified category and assigns them in bulk.

#### 4. `stations.listStationItems`
* **Type**: `query`
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    stationId: Id<"stations">
  }
  ```
* **Response**:
  ```typescript
  Array<{
    mappingId: Id<"stationItems">,
    stationId: Id<"stations">,
    item: {
      _id: Id<"items">,
      name: string,
      price: number,
      isAvailable: boolean,
      published: boolean,
      isVeg: boolean,
      isSpicy?: boolean
    },
    createdAt: number
  }>
  ```

#### 5. `stations.listItemStations`
* **Type**: `query`
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    itemId: Id<"items">
  }
  ```
* **Response**: Returns list of all stations assigned to a specific item.

---

### 6.3 Real-Time KDS Station Stream (`stations.getStationOrders`)
* **Type**: `query`
* **Args**: `{ organizationId?: Id<"organizations">, stationId: Id<"stations"> }`
* **Response**: Returns grouped active orders and item lists routed specifically to that workstation, with live `allStationItemsReady` calculations and `activeOrdersCount`.

---

## 7. Frontend Component Hierarchy (`pos-default/app/components/`)

```
pos-default/app/
├── settings/
│   └── page.tsx                              // Settings Router with "workstations" tab
└── components/
    ├── OrganizationWorkstations.tsx          // Master Workstations Settings View
    ├── WorkstationsTable.tsx                 // Station list table with items count & printer badge
    ├── CreateWorkstationModal.tsx            // Station creation modal (name, isMain, printer)
    ├── EditWorkstationModal.tsx              // Station editor modal
    ├── AssignItemsModal.tsx                  // Category bulk assign & item search multi-select
    ├── StationPrinterSelector.tsx            // Network printer dropdown selector
    └── DeleteWorkstationConfirmModal.tsx     // Soft deletion warning modal
```

---

## 8. Quality Assurance & Verification Checklist

- [x] **Store Name Uniqueness**: Exact match to legacy Rails validation message: *"Hey! {name} is already taken."*
- [x] **Master Expediter (Expo)**: Full support for `isMain: true` flagship pass station.
- [x] **Category Bulk Routing**: `assignCategoryItemsToStation` efficiently assigns all category items in a single atomic transaction.
- [x] **Hardware KOT Printing**: Polished linkage with `organizationPrinters` (`printerUseFor: "Station"`).
- [x] **Cascading Cleanup**: Deleting a workstation cleanly soft-deletes its `stationItems` child mappings.
- [x] **KDS Stream Synchronization**: Direct reactive pipeline with `/kds` touchscreen stations via `stations.getStationOrders`.
