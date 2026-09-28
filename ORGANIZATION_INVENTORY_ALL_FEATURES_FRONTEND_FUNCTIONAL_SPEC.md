# Organization Inventory All Features Frontend Functional Specification

## 1. Executive Summary & Sidebar Navigation

The **Inventory Management Subsystem** in DEFx-POS provides restaurant owners, head chefs, and procurement managers with an integrated back-of-house operating suite. It connects menu sales from the front-of-house POS terminal directly to raw ingredient stock balances, vendor purchase orders, recipe food costing, and kitchen wastage tracking.

Based on the application sidebar architecture, the **Inventory** domain is organized into **five dedicated core feature modules**:

```
+-----------------------------------------------------------------------------------+
|  📦 Inventory (Master Feature Gating: `organizations.isInventory: true`)          |
+-----------------------------------------------------------------------------------+
|    ├── 🟢 1. Purchase order  ───> Procurement, vendor drafts, receiving & stock-in|
|    ├── 🏢 2. Supplier        ───> Vendor directory, GSTIN/FSSAI, WhatsApp ordering|
|    ├── 🏷️ 3. Item library    ───> Raw materials, dual units, SKU, low-stock alerts|
|    ├── 🗑️ 4. Dead stock      ───> Spoilage, expired/damaged loss tracking & audits|
|    └── 🍲 5. Item recipes    ───> Bill of Materials (BOM), food costing, auto-debit|
+-----------------------------------------------------------------------------------+
```

---

## 2. Feature 1: Purchase Order (`/inventory/purchase-orders`)

### 2.1 Overview & Operational Purpose
The **Purchase Order (PO)** module handles the complete procurement lifecycle for purchasing raw ingredients, beverages, and packaging supplies from registered suppliers. It tracks order creation, approval prioritization, vendor dispatch, shipment receiving, short-shipment discrepancies, and automated inventory stock-in ledger updates upon settlement.

### 2.2 Purchase Order State Machine

```
   [ Create Draft PO ]
           │
           ▼
     +───────────+       (Dispatched to vendor)       +───────────+
     │  DRAFTED  │ ─────────────────────────────────> │   SENT    │
     +───────────+                                    +───────────+
           │                                                │
           │ (Cancelled by Admin)                           │ (Shipment arrives & verified)
           ▼                                                ▼
     +───────────+                                    +───────────+
     │ CANCELLED │                                    │  SETTLED  │ (Stock Auto-Credited)
     +───────────+                                    +───────────+
```

| Status | Meaning | Valid Actions & Mutations |
|---|---|---|
| **`drafted`** | PO created by staff; items and quantities being finalized. | Edit items, adjust quantities, change supplier, delete draft, dispatch (`update status: "sent"`). |
| **`sent`** | PO has been transmitted to the supplier via PDF export or WhatsApp. | Log partial delivery, update received quantities, mark missing, settle (`settlePurchaseOrder`). |
| **`settled`** | Shipment received, verified, and accepted into storage. | Immutable archive; auto-creates credit entries in `inventoryItemStocks` and increments `availableStock`. |
| **`cancelled`**| PO terminated prior to fulfillment. | Read-only audit archive. |

### 2.3 Data Schema & Fields

#### Table: `purchaseOrders`
* `_id` / `id`: `Id<"purchaseOrders">` (UUID).
* `organizationId`: `Id<"organizations">`.
* `poNumber`: Sequential human-readable code: `PO-YYYYMMDD-XXX` (e.g. `PO-20260925-001`).
* `supplierId`: Foreign key to `suppliers`.
* `purchasePriority`: `union("high", "medium", "low")` (Urgency flag for kitchen restocking).
* `status`: `union("drafted", "sent", "settled", "cancelled")`.
* `totalAmount`: Minor units sum of all line item costs (`orderedQuantity * unitCost`).
* `notes`: Delivery instructions (e.g. *"Deliver before 10 AM to back kitchen loading dock"*).
* `settledAt`: Timestamp when shipment was accepted and credited.
* `createdAt` / `updatedAt`: Timestamps.

#### Table: `purchaseOrderItems`
* `_id`: `Id<"purchaseOrderItems">`.
* `purchaseOrderId`: `Id<"purchaseOrders">`.
* `inventoryItemId`: `Id<"inventoryItems">`.
* `unit`: Unit string (matching `buyingUnit` or `servingUnit`, e.g. `"kg"`, `"litre"`).
* `orderedQuantity`: Requested quantity.
* `receivedQuantity`: Actual received quantity verified during dock receiving.
* `unitCost`: Agreed purchase price per unit in minor units (cents/paise).
* `totalCost`: `orderedQuantity * unitCost`.

### 2.4 Business Rules & Settle Automation
1. **Zero Quantity Guard**: Transitioning a PO from `drafted` to `sent` validates that no line item has `orderedQuantity == 0`.
2. **Short-Shipment Handling**: If ordered quantity is 30 kg and only 28 kg arrived, staff enters `receivedQuantity = 28`. The missing 2 kg is flagged, and the backend only credits the received 28 kg into inventory.
3. **Atomic Stock-In on Settlement (`settlePurchaseOrder`)**:
   - Increments `inventoryItems.availableStock` by `receivedQuantity`.
   - Updates `inventoryItems.unitCost` to the latest purchase cost.
   - Inserts immutable credit ledger records into `inventoryItemStocks` (`stockType: "credit"`, `sourceType: "PurchaseOrder"`, `purchaseOrderId`, `supplierId`).
   - Marks PO as `settled` with `settledAt = Date.now()`.

---

## 3. Feature 2: Supplier (`/inventory/suppliers`)

### 3.1 Overview & Operational Purpose
The **Supplier** module maintains the master directory of all approved food distributors, dairy farms, meat wholesalers, beverage vendors, and packaging suppliers. It stores business tax compliance IDs (GSTIN, FSSAI), direct contact lines, and enables one-click WhatsApp purchase order dispatch.

### 3.2 Data Schema & Fields (`suppliers`)

| Field | Type | Required | Description | Example / Notes |
|---|---|---|---|---|
| `_id` / `id` | `Id<"suppliers">` | Yes | Primary key. | `"sup_dairy_01"` |
| `organizationId` | `Id<"organizations">` | Yes | Store identifier. | `"org_123"` |
| `supplierName` | `string` | Yes | Contact person / account manager name. | `"Ramesh Sharma"` |
| `companyName` | `string` | Optional | Registered business name. | `"Sharma Agro & Dairy Wholesale Pvt Ltd"` |
| `phoneNumber` | `string` | Optional | Direct phone number. | `"+91 98111 22334"` |
| `whatsappNumber` | `string` | Optional | Verified WhatsApp number for instant PO dispatch. | `"+91 98111 22334"` |
| `email` | `string` | Optional | Procurement order email. | `"orders@sharmaagro.com"` |
| `gstNumber` | `string` | Optional | 15-character Goods & Services Tax ID (GSTIN). | `"27AAAAA0000A1Z5"` |
| `fssaiLicNumber` | `string` | Optional | 14-digit Food Safety License Number. | `"10019022009876"` |
| `address` | `string` | Optional | Physical warehouse / supply depot address. | `"Plot 42, Sector 19, APMC Market"` |
| `city` | `string` | Optional | City / Town. | `"Navi Mumbai"` |

### 3.3 Supplier Procurement Features
* **Vendor Lifetime Metrics**: Displays total lifetime purchase value (₹), active open POs count, and last order date on each vendor card.
* **WhatsApp Order Dispatch**: Generates a pre-formatted WhatsApp chat message containing the PO number, item list, delivery date, and total cost with a direct `https://wa.me/` link.

---

## 4. Feature 3: Item Library (`/inventory/item-library`)

### 4.1 Overview & Operational Purpose
The **Item Library** represents the central catalog of all raw ingredients, sub-preparations, dry goods, fresh produce, and packaging containers stored in the restaurant. It manages dual units of measurement, stock thresholds, live on-hand quantities, and automated low-stock warnings.

### 4.2 Data Schema & Fields (`inventoryItems`)

| Field | Type | Required | Description | Example / Notes |
|---|---|---|---|---|
| `_id` / `id` | `Id<"inventoryItems">` | Yes | Primary key. | `"inv_item_butter"` |
| `organizationId` | `Id<"organizations">` | Yes | Store identifier. | `"org_123"` |
| `categoryId` | `Id<"inventoryCategories">` | Optional | Category (Dairy, Meat, Produce, Spices, Bakery). | `"cat_dairy"` |
| `name` | `string` | Yes | Raw ingredient name. | `"Amul Butter (Salted)"` |
| `skuNumber` | `string` | Optional | Internal stock code or barcode. | `"SKU-DAIRY-001"` |
| `description` | `string` | Optional | Storage location / temperature specifications. | `"Walk-in Cooler #1 (2°C - 4°C)"` |
| `buyingUnit` | `string` | Yes | Bulk purchase unit from vendor. | `"kilogram"`, `"litre"`, `"packet"`, `"box"`, `"piece"` |
| `servingUnit` | `string` | Yes | Granular recipe preparation unit. | `"gram"`, `"millilitre"`, `"piece"` |
| `minimumStockRefillLevel` | `number` | Yes | **Low-Stock Alert Trigger Level**. | `5000` (e.g. 5,000 grams) |
| `baselineStockLevel` | `number` | Optional | Target optimum par level for reordering. | `25000` (25,000 grams) |
| `availableStock` | `number` | Yes | Current verified balance in serving units. | `8200` (8,200 grams) |
| `unitCost` | `number` | Optional | Weighted average cost per unit in minor units. | `48000` (₹480.00 per kg) |

### 4.3 Key Business Rules
1. **Low-Stock Alert Computation**:
   $$\text{isLowStock} = \text{availableStock} \le \text{minimumStockRefillLevel}$$
   Items meeting this condition automatically display high-visibility **Low Stock (Amber/Red)** pills and populate the *Quick Reorder* dashboard.
2. **Total Valuation**:
   $$\text{Total Asset Value} = \sum (\text{availableStock} \times \text{unitCost})$$
3. **Manual Physical Count Adjustment**:
   Staff can perform monthly physical audits. Adjusting stock inserts an audited `ManualAdjustment` ledger record in `inventoryItemStocks`.

---

## 5. Feature 4: Dead Stock (`/inventory/dead-stock`)

### 5.1 Overview & Operational Purpose
The **Dead Stock** module tracks food wastage, spoiled dairy/produce, expired ingredients, burned or damaged kitchen batches, and transit breakage. Logging dead stock is mandatory for accurate restaurant food cost accounting and detecting back-of-house shrinkage.

### 5.2 Spoilage Classification & Data Model

When staff logs dead stock (`inventory.logDeadStock`), the system records an immutable audit entry in `inventoryItemStocks` and debits available stock.

```
+-----------------------------------------------------------------------------------+
|                            LOG DEAD STOCK / SPOILAGE                              |
+-----------------------------------------------------------------------------------+
|  Ingredient: [ Fresh Dairy Milk (inv_milk_01) ▼ ]                                 |
|  Wasted Quantity: [ 4.5 ] Litres                                                  |
|                                                                                   |
|  Reason for Spoilage (*Mandatory):                                                |
|  (•) Expired Past Best-Before Date      ( ) Spoiled / Sour (Refrigeration Failure)|
|  ( ) Burned / Kitchen Cooking Error     ( ) Dropped / Spilled / Physical Breakage |
|                                                                                   |
|  Incident Notes: [ Walk-in cooler power trip overnight; milk curdle.            ] |
|                                                                                   |
|  Estimated Loss Value: 4.5 L × ₹65.00/L = ₹292.50                                 |
+-----------------------------------------------------------------------------------+
|  [ Cancel ]                                           [ LOG WASTAGE & DEBIT 🗑️ ]  |
+-----------------------------------------------------------------------------------+
```

### 5.3 Dead Stock Audit Fields in `inventoryItemStocks`
* `stockType`: `"debit"`.
* `quantity`: Wasted quantity.
* `unit`: Serving unit (e.g. `"litre"`, `"gram"`).
* `sourceType`: `"DeadStock"`.
* `isDeadStock`: `true`.
* `reasonForDeadStock`: `"Spoiled"` | `"Expired"` | `"Damaged"` | `"Spilled"`.
* `createdAt`: Timestamp.

---

## 6. Feature 5: Item Recipes (`/inventory/item-recipes`)

### 6.1 Overview & Operational Purpose
The **Item Recipes (Bill of Materials)** module builds the mathematical recipe formulas that link front-of-house menu catalog items (`items`) and customization choices (`customizationItems`) to their constituent raw ingredients (`inventoryItems`).

### 6.2 Recipe Decomposition & Auto-Deduction Engine

```
                            [ Order Completed & Paid at Cashier POS ]
                                               │
                                               ▼
                              +---------------------------------+
                              | 1x Butter Chicken (Full)        |
                              |   - Customization: Extra Cheese |
                              +---------------------------------+
                                               │
                 ┌─────────────────────────────┴─────────────────────────────┐
                 ▼                                                           ▼
   [ Base Dish Recipe: `itemId` ]                           [ Modifier Recipe: `customizationItemId` ]
   - 300g Chicken  (inv_chicken)                            - 50g Mozzarella Cheese (inv_cheese)
   - 40g Butter    (inv_butter)                                              │
   - 80ml Cream    (inv_cream)                                               │
                 │                                                           │
                 └─────────────────────────────┬─────────────────────────────┘
                                               │
                                               ▼
                     +---------------------------------------------------+
                     |         Atomic Convex Ledger Debit Execution      |
                     |  - Decrements `inventoryItems.availableStock`     |
                     |  - Writes `inventoryItemStocks` (`OrderSale`)     |
                     +---------------------------------------------------+
```

### 6.3 Theoretical Food Cost & Gross Margin Math

$$\text{Theoretical Dish Cost} = \sum_{i=1}^{n} (\text{Recipe Quantity}_i \times \text{Ingredient Unit Cost}_i)$$

$$\text{Gross Profit Margin \%} = \frac{\text{Retail Menu Price} - \text{Theoretical Dish Cost}}{\text{Retail Menu Price}} \times 100$$

*Example*:
* Retail Price: ₹380.00
* Ingredients: Chicken (₹60) + Butter (₹19.20) + Cream (₹16.00) + Gravy Base (₹24.00) = **₹119.20**
* Gross Margin = $\frac{380 - 119.20}{380} \times 100 = \mathbf{68.6\%}$

---

## 7. Frontend UI Layouts for All 5 Features

### 7.1 Screen: Purchase Orders (`/inventory/purchase-orders`)

```
+---------------------------------------------------------------------------------------------------+
|  [Logo]  INVENTORY > PURCHASE ORDERS                     [ + Create Purchase Order ]              |
+---------------------------------------------------------------------------------------------------+
|  [ All POs (14) ]    [ Drafts (2) ]    [ Sent / In-Transit (4) ]    [ Settled (8) ]               |
+---------------------------------------------------------------------------------------------------+
|  PO NUMBER        SUPPLIER             PRIORITY   ITEMS COUNT   TOTAL COST    STATUS     ACTIONS  |
|  ───────────────  ───────────────────  ─────────  ────────────  ────────────  ─────────  ───────  |
|  PO-20260925-001  Sharma Dairy Agro    🔴 HIGH    6 Items       ₹18,450.00    SENT 📨    [ Settle]|
|  PO-20260924-002  Metro Meat Wholes.   🟡 MEDIUM  4 Items       ₹24,000.00    SETTLED 📥 [ View ] |
|  PO-20260924-001  Kisan Fresh Produce  🟢 LOW     12 Items      ₹6,200.00     DRAFT 📝   [ Edit ] |
+---------------------------------------------------------------------------------------------------+
```

---

### 7.2 Screen: Supplier Directory (`/inventory/suppliers`)

```
+---------------------------------------------------------------------------------------------------+
|  [Logo]  INVENTORY > SUPPLIERS                           [ + Add New Supplier ]                   |
+---------------------------------------------------------------------------------------------------+
|  COMPANY NAME             CONTACT PERSON       PHONE / WHATSAPP      GSTIN / FSSAI       ACTIONS  |
|  ───────────────────────  ───────────────────  ────────────────────  ──────────────────  ───────  |
|  Sharma Dairy Wholesale   Ramesh Sharma        +91 98111 22334 [💬]  27AAAAA0000A1Z5     [Edit]   |
|  Metro Meat Wholesalers   Irfan Khan           +91 98222 33445 [💬]  27BBBBB1111B2Z6     [Edit]   |
|  Kisan Fresh Produce      Sunil Patil          +91 98333 44556 [💬]  27CCCCC2222C3Z7     [Edit]   |
+---------------------------------------------------------------------------------------------------+
```

---

### 7.3 Screen: Item Library (`/inventory/item-library`)

```
+---------------------------------------------------------------------------------------------------+
|  [Logo]  INVENTORY > ITEM LIBRARY                        [ + Add Raw Ingredient ]                 |
+---------------------------------------------------------------------------------------------------+
|  SKU / NAME          CATEGORY    ON-HAND STOCK       MIN. REFILL    UNIT COST    STATUS   ACTIONS |
|  ──────────────────  ──────────  ──────────────────  ─────────────  ───────────  ───────  ─────── |
|  DAIRY-001           Dairy       2,400 g (2.4 kg)    5,000 g        ₹480 / kg    🔴 LOW   [ +PO ] |
|  Amul Salted Butter                                                                               |
|  MEAT-004            Poultry     14,200 g (14.2 kg)  8,000 g        ₹240 / kg    🟢 OK    [Restock|
|  Boneless Chicken                                                                                 |
+---------------------------------------------------------------------------------------------------+
```

---

### 7.4 Screen: Dead Stock Log (`/inventory/dead-stock`)

```
+---------------------------------------------------------------------------------------------------+
|  [Logo]  INVENTORY > DEAD STOCK & WASTAGE                [ + Log Dead Stock / Spoilage ]          |
+---------------------------------------------------------------------------------------------------+
|  DATE / TIME         INGREDIENT          QUANTITY WASTED    REASON          LOSS VALUE  LOGGED BY |
|  ──────────────────  ──────────────────  ─────────────────  ──────────────  ──────────  ───────── |
|  25 Sep, 14:10       Fresh Dairy Milk    4.5 Litres         Spoiled / Sour  ₹292.50     Chef Amit |
|  24 Sep, 18:30       Burger Buns (Pack)  6 Packets          Expired Date    ₹360.00     Staff Raj |
|  23 Sep, 11:20       Tomato Gravy Batch  2.0 kg             Cooking Error   ₹160.00     Chef Amit |
+---------------------------------------------------------------------------------------------------+
```

---

### 7.5 Screen: Item Recipes (`/inventory/item-recipes`)

```
+---------------------------------------------------------------------------------------------------+
|  [Logo]  INVENTORY > ITEM RECIPES                        [ + Build New Recipe ]                   |
+---------------------------------------------------------------------------------------------------+
|  MENU DISH / MODIFIER        PORTION     FOOD COST    MENU PRICE   MARGIN %    INGREDIENTS COUNT  |
|  ──────────────────────────  ──────────  ───────────  ───────────  ──────────  ─────────────────  |
|  Paneer Butter Masala        Full (1p)   ₹119.20      ₹380.00      68.6% 🟢    5 Ingredients      |
|  Butter Chicken Special      Full (1p)   ₹142.50      ₹420.00      66.1% 🟢    6 Ingredients      |
|  Modifier: Extra Mozzarella  Portion     ₹18.00       ₹50.00       64.0% 🟢    1 Ingredient       |
+---------------------------------------------------------------------------------------------------+
```

---

## 8. Complete API Matrix for All 5 Features

| Feature Sub-Module | Convex Operation | Type | Purpose | RBAC Guard |
|---|---|---|---|---|
| **1. Purchase Order** | `inventory.createPurchaseOrder` | Mutation | Drafts new PO with line items. | Admin / Inventory |
| **1. Purchase Order** | `inventory.settlePurchaseOrder` | Mutation | Verifies delivery & auto-credits stock. | Admin / Inventory |
| **2. Supplier** | `inventory.listSuppliers` | Query | Lists active supplier directory. | Staff / Inventory |
| **2. Supplier** | `inventory.createSupplier` | Mutation | Registers new vendor profile. | Admin / Inventory |
| **2. Supplier** | `inventory.updateSupplier` | Mutation | Updates vendor details / contacts. | Admin / Inventory |
| **2. Supplier** | `inventory.deleteSupplier` | Mutation | Removes vendor record. | Admin / Inventory |
| **3. Item Library** | `inventory.listInventoryItems` | Query | Returns stock catalog with `isLowStock` flags. | Staff / Inventory |
| **3. Item Library** | `inventory.createInventoryItem` | Mutation | Adds raw ingredient with dual units. | Admin / Inventory |
| **3. Item Library** | `inventory.updateInventoryItem` | Mutation | Edits ingredient cost or refill thresholds. | Admin / Inventory |
| **4. Dead Stock** | `inventory.logDeadStock` | Mutation | Records wastage & debits on-hand stock. | Chef / Inventory |
| **5. Item Recipes** | `inventory.linkItemRecipe` | Mutation | Binds dish/modifier to ingredient quantity. | Chef / Inventory |
| **5. Item Recipes** | `inventory.getItemRecipe` | Query | Fetches recipe formula & food cost breakdown. | Chef / Inventory |
| **5. Item Recipes** | `inventory.removeItemRecipe` | Mutation | Deletes ingredient line from recipe. | Chef / Inventory |

---

## 9. Implementation Checklist for Frontend Engineers

- [ ] **Sidebar Navigation Routing**: Wire the 5 submenu items matching the sidebar design:
  - `/inventory/purchase-orders` (Purchase order)
  - `/inventory/suppliers` (Supplier)
  - `/inventory/item-library` (Item library)
  - `/inventory/dead-stock` (Dead stock)
  - `/inventory/item-recipes` (Item recipes)
- [ ] **Purchase Order Wizard**: Build PO creation modal with item search, live total calculations, and a 1-click receiving & settlement drawer.
- [ ] **Supplier Directory Form**: Build vendor modal capturing GSTIN, FSSAI, email, address, and WhatsApp link generator.
- [ ] **Item Library Table**: Build real-time table with low-stock badge filters and stock refill action modals.
- [ ] **Dead Stock Logger**: Build drawer with mandatory loss reason radio buttons and automated loss cost calculation.
- [ ] **Recipe Formula Builder**: Build interactive dish ingredient linker with theoretical food cost and gross profit margin % gauges.
