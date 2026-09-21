# Organization Inventory & Recipe Management Frontend Functional Specification

## 1. Executive Summary & Domain Scope

The **Inventory, Recipes & Supplier Management Subsystem** in DEFx-POS provides restaurant operators with end-to-end control over food stock, recipe costing, raw ingredient depletion, supplier procurement, purchase orders, and kitchen spoilage.

Unlike generic retail inventory software, restaurant inventory must handle **recipe decomposition** (Bill of Materials): selling a dish (e.g. *Butter Chicken*) or modifier (e.g. *Extra Cheese*) does not deduct a finished good; it automatically depletes multiple raw ingredients (*300g Chicken, 50g Butter, 100ml Cream*) from back-of-house storage.

This functional specification covers:
1. **Raw Ingredient Stock Catalog**: Managing ingredients, dual units (Buying Unit vs Serving Unit), low-stock thresholds, and live balances (`inventoryItems`).
2. **Supplier & Vendor Directory**: Managing vendor contacts, GST/FSSAI tax registrations, and WhatsApp ordering (`suppliers`).
3. **Recipe Formula Builder (Bill of Materials)**: Linking menu catalog items and customization modifiers to raw ingredient quantities (`recipes`).
4. **Purchase Order (PO) & Restocking Lifecycle**: Generating POs, prioritizing drafts, receiving shipments, and auto-crediting stock on settlement (`purchaseOrders`, `purchaseOrderItems`).
5. **Wastage & Dead Stock Tracker**: Recording expired, spilled, or damaged items with audit logs (`logDeadStock`).
6. **Automated Order Depletion Engine**: Real-time atomic stock deduction upon order payment settlement (`completeOrder`).
7. **Immutable Stock Ledger**: Complete chronological audit trail of all credits and debits (`inventoryItemStocks`).

---

## 2. System Architecture & Inventory Lifecycle

```
+-----------------------------------------------------------------------------------+
|                        Store Inventory Module Gating                              |
|           `organizations.isInventory: true`  |  `is_inventory: active`             |
+-----------------------------------------------------------------------------------+
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
+───────────────────────────────────+           +───────────────────────────────────+
|     Procurement & Restocking      |           |     Point of Sale & Kitchen Sales |
|  - Suppliers & Vendors Directory  |           |  - Front-of-House Order Completed |
|  - Purchase Orders (`drafted` ->  |           |  - Base Item & Modifier Recipes   |
|    `sent` -> `settled`)           |           |  - Automatic Recipe Stock Debit   |
+───────────────────────────────────+           +───────────────────────────────────+
                 │                                               │
                 ▼ (Credit: +Stock)                              ▼ (Debit: -Stock)
+───────────────────────────────────────────────────────────────────────────────────+
|                         Live Inventory Stock Catalog                              |
|                          `inventoryItems.availableStock`                          |
|             (Real-time Low-Stock Alert: `availableStock <= minimumRefill`)        |
+───────────────────────────────────────────────────────────────────────────────────+
                                         ▲
                                         │ (Debit: Spoilage / Wastage)
                        +───────────────────────────────────+
                        |     Dead Stock & Wastage Logger   |
                        |   `logDeadStock` (Expired/Damaged)|
                        +───────────────────────────────────+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
|                     Immutable Inventory Stock Ledger Audit                        |
|        `inventoryItemStocks` (Credits, Debits, Order References, PO Bindings)     |
+-----------------------------------------------------------------------------------+
```

---

## 3. Database Schema & Data Models

### 3.1 Raw Inventory Items (`inventoryItems`)

| Field | Type | Required | Description | Example / Notes |
|---|---|---|---|---|
| `_id` / `id` | `Id<"inventoryItems">` | Yes | Primary key. | `"inv_item_9812"` |
| `organizationId` | `Id<"organizations">` | Yes | Store identifier. | `"org_123"` |
| `categoryId` | `Id<"inventoryCategories">` | Optional | Classification (e.g., Dairy, Poultry, Spices, Packaging). | `"cat_dairy"` |
| `name` | `string` | Yes | Raw ingredient display name. | `"Amul Butter"`, `"Basmati Rice"` |
| `description` | `string` | Optional | Storage location / grade notes. | `"Deep freezer cold storage 2"` |
| `skuNumber` | `string` | Optional | Barcode or internal stock SKU. | `"SKU-DAIRY-004"` |
| `buyingUnit` | `string` | Yes | Unit used when purchasing from vendors. | `"kilogram"`, `"litre"`, `"packet"`, `"box"`, `"piece"` |
| `servingUnit` | `string` | Yes | Unit used in recipe cooking consumption. | `"gram"`, `"millilitre"`, `"piece"` |
| `minimumStockRefillLevel` | `number` | Yes | Threshold triggering **Low Stock** warning badge. | `5000` (e.g. 5,000g / 5kg) |
| `baselineStockLevel` | `number` | Optional | Ideal target operational stock level. | `20000` (20,000g) |
| `availableStock` | `number` | Yes | Current available stock in serving units. | `8500` (8,500g) |
| `unitCost` | `number` | Optional | Average unit cost in minor units (paise/cents). | `45000` (₹450.00 / kg) |
| `createdAt` | `number` | Yes | Creation timestamp. | `1726590000000` |
| `updatedAt` | `number` | Yes | Last modified timestamp. | `1726590000000` |

### 3.2 Suppliers & Vendors (`suppliers`)

| Field | Type | Required | Description | Example / Notes |
|---|---|---|---|---|
| `_id` / `id` | `Id<"suppliers">` | Yes | Primary key. | `"sup_dairy_corp"` |
| `organizationId` | `Id<"organizations">` | Yes | Store identifier. | `"org_123"` |
| `supplierName` | `string` | Yes | Primary contact person name. | `"Ramesh Sharma"` |
| `companyName` | `string` | Optional | Registered business name. | `"Sharma Dairy & Agro Wholesale"` |
| `phoneNumber` | `string` | Optional | Direct phone line. | `"+91 98111 22334"` |
| `whatsappNumber` | `string` | Optional | WhatsApp ordering phone number. | `"+91 98111 22334"` |
| `email` | `string` | Optional | Vendor procurement email. | `"orders@sharmadairy.com"` |
| `gstNumber` | `string` | Optional | Vendor GST identification number. | `"27AAAAA0000A1Z5"` |
| `fssaiLicNumber` | `string` | Optional | Food safety license registration. | `"10019022009876"` |
| `address` | `string` | Optional | Warehouse / billing address. | `"Plot 42, APMC Wholesale Market"` |
| `city` | `string` | Optional | City location. | `"Mumbai"` |

### 3.3 Recipes & Ingredient Formulas (`recipes`)

| Field | Type | Required | Description | Example / Notes |
|---|---|---|---|---|
| `_id` / `id` | `Id<"recipes">` | Yes | Primary key. | `"rec_8812"` |
| `organizationId` | `Id<"organizations">` | Yes | Store identifier. | `"org_123"` |
| `itemId` | `Id<"items">` | Optional* | Linked menu catalog item ID. | `"item_butter_chicken"` |
| `customizationItemId` | `Id<"customizationItems">` | Optional* | Linked customization choice ID (e.g. Extra Cheese). | `"cust_extra_cheese"` |
| `inventoryItemId` | `Id<"inventoryItems">` | Yes | Raw ingredient consumed. | `"inv_item_butter"` |
| `quantity` | `number` | Yes | Quantity depleted per single order unit. | `50` (50 grams) |
| `unit` | `string` | Yes | Consumption unit (matching `servingUnit`). | `"gram"` |

*\* Note: A recipe record must bind to either `itemId` OR `customizationItemId`.*

### 3.4 Purchase Orders (`purchaseOrders` & `purchaseOrderItems`)

| Table | Field | Type | Description |
|---|---|---|---|
| `purchaseOrders` | `poNumber` | `string` | Auto-generated sequential code (e.g. `PO-20260917-001`). |
| `purchaseOrders` | `supplierId` | `Id<"suppliers">` | Vendor fulfilling this order. |
| `purchaseOrders` | `purchasePriority` | `union("high", "medium", "low")` | Fulfillment urgency flag. |
| `purchaseOrders` | `status` | `union("drafted", "sent", "settled", "cancelled")` | Procurement state. |
| `purchaseOrders` | `totalAmount` | `number` | Minor units total purchase cost. |
| `purchaseOrders` | `settledAt` | `number` (optional) | Timestamp when shipment arrived and was accepted. |
| `purchaseOrderItems`| `purchaseOrderId` | `Id<"purchaseOrders">` | Parent PO link. |
| `purchaseOrderItems`| `inventoryItemId` | `Id<"inventoryItems">` | Raw ingredient ordered. |
| `purchaseOrderItems`| `orderedQuantity` | `number` | Quantity ordered. |
| `purchaseOrderItems`| `receivedQuantity`| `number` (optional) | Actual verified received quantity. |
| `purchaseOrderItems`| `unitCost` | `number` | Cost per unit. |
| `purchaseOrderItems`| `totalCost` | `number` | Line-item total cost (`orderedQuantity * unitCost`). |

### 3.5 Stock Ledger & Audit Log (`inventoryItemStocks`)

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"inventoryItemStocks">` | Ledger transaction entry primary key. |
| `inventoryItemId` | `Id<"inventoryItems">` | Raw ingredient affected. |
| `stockType` | `union("credit", "debit")` | Balance direction (`credit` increases stock; `debit` decreases stock). |
| `quantity` | `number` | Quantity changed in serving units. |
| `unit` | `string` | Unit string (e.g. `"gram"`, `"ml"`). |
| `sourceType` | `string` | Trigger reason: `"PurchaseOrder"`, `"OrderSale"`, `"ManualAdjustment"`, `"DeadStock"`. |
| `orderId` | `Id<"orders">` (optional) | Linked sales order ID for `"OrderSale"` debits. |
| `purchaseOrderId` | `Id<"purchaseOrders">` (optional) | Linked PO ID for `"PurchaseOrder"` credits. |
| `supplierId` | `Id<"suppliers">` (optional) | Vendor link. |
| `isDeadStock` | `boolean` (optional) | Flagged `true` for wastage/spoilage entries. |
| `reasonForDeadStock`| `string` (optional) | Spoilage reason: `"Spoiled"`, `"Expired"`, `"Damaged"`, `"Spilled"`. |

---

## 4. Key Operational Workflows & Business Logic

### 4.1 Workflow 1: Automatic Depletion on Order Settlement
1. **Trigger**: Cashier settles payment on a table or counter order (`orders.completeOrder`).
2. **Decomposition**:
   - Backend queries all `orderItems` for the completed order.
   - For each item, finds all linked `recipes` by `itemId`.
   - For all chosen modifiers (`customizations`), finds linked `recipes` by `customizationItemId`.
3. **Atomic Ledger Debit**:
   - Computes `consumedQty = recipe.quantity * orderItem.quantity`.
   - Calculates `newStock = Math.max(0, availableStock - consumedQty)`.
   - Inserts immutable `inventoryItemStocks` record with `stockType: "debit"`, `sourceType: "OrderSale"`, and `orderId`.
   - Patches `inventoryItems.availableStock`.
4. **Low-Stock Notification**: If `newStock <= minimumStockRefillLevel`, system flags item as `isLowStock: true` on the inventory dashboard.

---

### 4.2 Workflow 2: Purchase Order Procurement & Settlement
1. **Drafting PO**: Admin/Chef selects a supplier, adds required ingredients, sets quantities and unit costs, and chooses priority (`high`, `medium`, `low`).
2. **Status Progression**:
   - Initial status: `drafted`.
   - Dispatched to vendor (via PDF / WhatsApp): Status moves to `sent`.
3. **Shipment Receipt & Settlement (`settlePurchaseOrder`)**:
   - Delivery arrives at loading dock; store manager counts actual received quantities.
   - Manager taps **"Settle & Restock PO"**:
     - System loops through all PO line items.
     - Adds received quantity to `inventoryItems.availableStock`.
     - Updates `inventoryItems.unitCost` to the latest purchase cost.
     - Creates `inventoryItemStocks` credit records (`stockType: "credit"`, `sourceType: "PurchaseOrder"`).
     - Marks PO status as `settled` with `settledAt = now`.

---

### 4.3 Workflow 3: Recipe Formulation (Bill of Materials)
1. In Menu Management or Inventory Recipe Builder, Chef selects a menu dish (e.g. *Paneer Tikka Roll*).
2. Chef adds ingredient lines:
   - *Paneer*: 120 grams
   - *Capsicum & Onion*: 50 grams
   - *Mint Chutney*: 30 ml
   - *Rumali Roti Wrap*: 1 piece
3. Recipe Costing Engine automatically multiplies each ingredient quantity by its latest `unitCost` to calculate the **Theoretical Food Cost** and **Gross Profit Margin %** against the menu retail price.

---

### 4.4 Workflow 4: Spoilage & Dead Stock Logging
1. Kitchen staff identifies expired dairy or burned meat batch.
2. Staff invokes **"Log Spoilage / Dead Stock"** (`logDeadStock`):
   - Selects ingredient, entered quantity, and reason (`"Spoiled"`, `"Expired"`, `"Damaged"`, `"Spilled"`).
   - Backend deducts `availableStock` and records an audited dead stock entry in `inventoryItemStocks`.

---

## 5. Frontend UI/UX Specifications

### 5.1 Screen 1: Inventory Stock Master Dashboard (`/inventory`)

```
+---------------------------------------------------------------------------------------------------+
|  [Logo]  INVENTORY MANAGEMENT      Module: [ Active 🟢 ]      Low-Stock Alerts: [ ⚠️ 3 Items ]    |
+---------------------------------------------------------------------------------------------------+
|  [ Stock Catalog ]      [ Purchase Orders (2 Active) ]      [ Recipes / BOM ]      [ Suppliers ]  |
+---------------------------------------------------------------------------------------------------+
|  [ + Add Raw Ingredient ]   [ Log Dead Stock / Spoilage ]   [ Search Ingredients 🔍 ]   [ Filter ] |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  SKU / ITEM NAME        CATEGORY   AVAILABLE STOCK     MIN. REFILL    UNIT COST    STATUS  ACTION |
|  ─────────────────────  ─────────  ──────────────────  ─────────────  ───────────  ──────  ────── |
|  DAIRY-001              Dairy      2,400 g (2.4 kg)    5,000 g        ₹480 / kg    🔴 LOW  [ +PO ]|
|  Amul Butter                                                                                      |
|  ─────────────────────────────────────────────────────────────────────────────────────────────────|
|  MEAT-004               Poultry    14,200 g (14.2 kg)  8,000 g        ₹240 / kg    🟢 OK   [ Restock ]
|  Boneless Chicken                                                                                 |
|  ─────────────────────────────────────────────────────────────────────────────────────────────────|
|  VEG-012                Produce    850 g (0.85 kg)     2,000 g        ₹60 / kg     🔴 LOW  [ +PO ]|
|  Fresh Button Mushroom                                                                            |
|  ─────────────────────────────────────────────────────────────────────────────────────────────────|
|  DRY-008                Grains     45,000 g (45 kg)    10,000 g       ₹110 / kg    🟢 OK   [ Restock ]
|  Basmati Rice (Classic)                                                                           |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
|  Showing 1 - 4 of 48 Ingredients          Total Inventory Value: ₹1,84,500.00                     |
+---------------------------------------------------------------------------------------------------+
```

---

### 5.2 Screen 2: Recipe Builder & Costing Engine (`/inventory/recipes`)

```
+-----------------------------------------------------------------------------------+
|  RECIPE BUILDER: [ Paneer Butter Masala (Full) ▼ ]       Menu Price: ₹380.00      |
+-----------------------------------------------------------------------------------+
|  Configure ingredient quantities depleted per single dish preparation.            |
|                                                                                   |
|  INGREDIENT               QUANTITY     UNIT COST        EST. INGREDIENT COST      |
|  ───────────────────────  ───────────  ───────────────  ────────────────────────  |
|  1. Fresh Paneer          250 g        ₹360.00 / kg     ₹90.00                   |
|  2. Amul Butter           40 g         ₹480.00 / kg     ₹19.20                   |
|  3. Fresh Dairy Cream     50 ml        ₹220.00 / L      ₹11.00                   |
|  4. Tomato Gravy Base     180 g        ₹80.00 / kg      ₹14.40                   |
|  5. Garam Masala Spice    10 g         ₹650.00 / kg     ₹6.50                    |
|                                                                                   |
|  [ + Add Ingredient Line ]                                                        |
+-----------------------------------------------------------------------------------+
|  THEORETICAL FOOD COST: ₹141.10         GROSS PROFIT MARGIN: 62.8% (₹238.90)     |
+-----------------------------------------------------------------------------------+
|  [ Cancel ]                                            [ SAVE RECIPE FORMULA 💾 ] |
+-----------------------------------------------------------------------------------+
```

---

### 5.3 Screen 3: Purchase Order Management & Settlement (`/inventory/purchase-orders`)

```
+-----------------------------------------------------------------------------------+
|  PURCHASE ORDER: #PO-20260917-002     Status: [ SENT 📨 ]     Priority: [ HIGH 🔴 ]|
|  Supplier: Sharma Dairy & Wholesale   Created: Today, 11:30 AM                    |
+-----------------------------------------------------------------------------------+
|  LINE ITEMS IN SHIPMENT                                                           |
|  ───────────────────────────────────────────────────────────────────────────────  |
|  Item Name         Ordered Qty    Received Qty     Unit Cost       Total Cost     |
|  ────────────────  ─────────────  ───────────────  ──────────────  ─────────────  |
|  Amul Butter       20 kg          [ 20 ] kg        ₹460.00 / kg    ₹9,200.00      |
|  Dairy Cream       15 Litres      [ 15 ] Litres    ₹210.00 / L     ₹3,150.00      |
|  Fresh Paneer      30 kg          [ 28 ] kg ⚠️     ₹340.00 / kg    ₹9,520.00      |
|                                                                                   |
|  PO Total Payable: ₹21,870.00                                                     |
+-----------------------------------------------------------------------------------+
|  Delivery Notes: Short shipment of 2kg paneer noted on delivery challan.          |
+-----------------------------------------------------------------------------------+
|  [ Cancel PO ]         [ Export PDF 📄 ]         [ SETTLE & CREDIT STOCK 📥 ]     |
+-----------------------------------------------------------------------------------+
```

---

## 6. Implementation Checklist for Frontend Engineers

- [ ] **Feature Gating Check**: Ensure `/inventory` routes require `isInventory` feature flag and `userType.includes("inventory")` or `"admin"`.
- [ ] **Real-Time Stock Catalog**: Build table view subscribing to `inventory.listInventoryItems` with low-stock badge filters.
- [ ] **Recipe Builder Modal**: Implement multi-ingredient selector with real-time food cost and gross margin calculations.
- [ ] **Purchase Order Flow**: Build 3-step PO wizard (Draft -> Send -> Settle) connecting to `createPurchaseOrder` and `settlePurchaseOrder`.
- [ ] **Dead Stock Logger Drawer**: Form capturing wasted quantity and mandatory reason (`Spoiled`, `Expired`, `Damaged`, `Spilled`).
- [ ] **Supplier Directory CRUD**: Full management interface for supplier phone, email, WhatsApp, GST, and FSSAI details.
- [ ] **Stock Movement Ledger**: Paginated audit log table displaying timestamped credits and debits linked to sales orders and PO numbers.
