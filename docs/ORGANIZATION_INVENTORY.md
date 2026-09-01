# Inventory, Recipes & Procurement System Architecture & Implementation Guide

This document provides a comprehensive audit of the database state in `pos-default`, details the legacy Ruby on Rails (`defx-pos`) and Next.js (`defx-pos-frontend`) Inventory architecture, and provides full technical directives for implementing **Inventory Items, Suppliers, Recipes, Purchase Orders, Stock Ledger, Dead Stock, and Order Completion Stock Deductions** in Convex.

---

## ?? 1. Current Database Inventory Audit (`pos-default`)

### ? Existing & Proposed Tables:
1. `inventoryCategories`: Category classification for stock items ("Dairy", "Vegetables", "Beverages", "Packaging").
2. **`suppliers`**: Vendor profiles supplying raw materials (`supplierName`, `companyName`, `phoneNumber`, `email`, `gstNumber`, `fssaiLicNumber`).
3. **`inventoryItems`**: Stock catalog (`name`, `skuNumber`, `buyingUnit`, `servingUnit`, `minimumStockRefillLevel`, `availableStock`).
4. **`recipes`**: Ingredient formulas mapping menu items or customization add-ons to inventory items (`itemId`, `inventoryItemId`, `quantity`, `unit`).
5. **`purchaseOrders`**: Supplier purchase orders (`poNumber`, `supplierId`, `status`: `drafted`/`sent`/`settled`, `purchasePriority`: `high`/`medium`/`low`, `totalAmount`).
6. **`purchaseOrderItems`**: PO line items (`inventoryItemId`, `orderedQuantity`, `receivedQuantity`, `unitCost`).
7. **`inventoryItemStocks`**: Stock movement ledger (`stockType`: `credit`/`debit`, `quantity`, `unit`, `isDeadStock`, `reasonForDeadStock`, `purchaseOrderId`, `orderId`).

---

## ??? 2. Legacy Architecture Audit (`defx-pos` & `defx-pos-frontend`)

### From Backend (`defx-pos`)
* **Stock Movement**: All additions (PO settlement, manual refills) enter as stock_type = "credit". All deductions (POS sales, dead stock) enter as stock_type = "debit".
* **Automatic Stock Deduction (destruct_item_stock)**: Upon order completion (isCompleted = true), system automatically looks up recipe formulas and debits stock for ordered items and customization add-ons.
* **Dead Stock Logging**: Tracking spoiled, expired, damaged, or spilled raw materials with mandatory reason notes.

### From Frontend (`defx-pos-frontend`)
* **Item Library (components/Inventory/ItemLibrary)**: Inventory item CRUD, minimum stock refill thresholds, available stock display.
* **Item Recipes (components/Inventory/ItemRecipes)**: Mapping food items and add-on options to ingredient quantities.
* **Supplier (components/Inventory/Supplier)**: Vendor contact directory, GST, FSSAI numbers.
* **Purchase Orders (components/Inventory/PurchaseOrder)**: Creating, editing, sending, and settling POs to add stock into inventory.
* **Dead Stock (MarkDeadStock.jsx)**: Marking stock as dead stock with spoilage reasons.

---

## ?? 3. Frontend AI Implementation Tasks & Assignments

### ?? Task 1: Inventory Stock Catalog & Low-Stock Dashboard
* **Convex API Directives**:
  * List inventory: useQuery(api.inventory.listInventoryItems)
  * Low stock alerts: useQuery(api.inventory.getLowStockItems)
  * Add item: useMutation(api.inventory.createInventoryItem)

### ?? Task 2: Dish Recipes & Ingredient Formula Builder
* **Convex API Directives**:
  * Link recipe: useMutation(api.inventory.linkItemRecipe)
  * Get recipe: useQuery(api.inventory.getItemRecipe)

### ?? Task 3: Supplier Procurement & Purchase Order Settlement
* **Convex API Directives**:
  * List suppliers: useQuery(api.inventory.listSuppliers)
  * Create PO: useMutation(api.inventory.createPurchaseOrder)
  * Settle PO: useMutation(api.inventory.settlePurchaseOrder)
  * Log dead stock: useMutation(api.inventory.logDeadStock)
