# Orders & Order Processes Architecture & Implementation Guide

This document provides a comprehensive audit of the database state in pos-default, details the legacy Ruby on Rails (defx-pos) and Next.js (defx-pos-frontend) Orders architecture, and provides full technical directives for implementing **Orders, Order Items, Order Activities, Order Payments, and KDS (Kitchen Display System)** in Convex.

---

## ?? 1. Current Database Inventory Audit (pos-default)

### ? All 24 Tables Implemented & Passing Tests:
1. organizations: Core identity, GST/FSSAI compliance, branding, payment credentials.
2. stations: Kitchen/Bar prep stations.
3. paymentModes: Payment options (Cash, Card, UPI, Stripe, Razorpay).
4. inventoryCategories: Categories for store inventory items.
5. organizationUsers: User roles and Clerk user mappings (userId, userType, userPermission).
6. organizationFeatures: Feature flag overrides.
7. menus: Multi-Menu records ("Breakfast", "Main Menu", "Bar Menu").
8. categories: Menu section categories.
9. items: Base food items (price, isGst, dietary flags, 2D/3D storage media IDs).
10. categoryItems: Position junction table for menu items.
11. itemTypes: Classification tags (Veg, Non-Veg, Jain, Vegan).
12. customizations: Option groups ("Add-Ons" / "Preparations").
13. customizationItems: Option choices with prices.
14. organizationLanguages: Supported store languages.
15. organizationLayouts: Dine-in floor plan layouts.
16. organizationTables: Physical dining tables (	ableNumber, seatingCapacity, placement, xPosition, yPosition, currentOrderId).
17. organizationOrderProcesses: Order status pipeline table (
ame, position, published, isSequence, processColor).
18. 	axComponents: Split tax lines (CGST 2.5%, SGST 2.5%, State Tax 6%).
19. 	axGroups: Tax groups with inclusive/exclusive modes.
20. storeTaxSettings: Country tax and ISO currency settings (?, $, £).
21. **orders**: Order header table (daily token #01, formatted order code ORD-20260901-001, orderType, 	ableId, customer info, subtotals, tax totals, discounts, delivery charges, total amount, immutable 	axInfoSnapshot).
22. **orderItems**: Cart line items linked to products, quantity, item price, customization options array, and KDS dish readiness (isReady).
23. **orderActivities**: Status transition timeline log table.
24. **orderPayments**: Payment transaction record table.

---

## ??? 2. Legacy Architecture Audit (defx-pos & defx-pos-frontend)

### From Backend (defx-pos)
* **Tokens & Codes**: Daily queue token (#01, #02) and formatted order number (ORD-20260901-001).
* **Order Types**: DineIn, TakeAway, Delivery, ScheduledPickup, ScheduledDelivery.
* **Sources**: Prest-Cashier, Prest-Captain, Prest-Online, Prest-Cod.
* **Inventory Stock Hook (destruct_item_stock)**: Upon order completion (isCompleted = true), system automatically debits stock from linked inventory items for both base food items and customization add-ons.

### From Frontend (defx-pos-frontend)
* **Cashier POS Cart (AddItemToCart.jsx & AddCustomerInformationComponent.jsx)**:
  * Item quantity adjustments, add-on customizations, tax calculations (inclusive/exclusive GST), discount amounts, split payments.
  * Customer info (customerName, customerPhone, customerEmail).
  * Delivery addresses (ddressLine1, ddressLine2, landmark, city, zipCode, ddressType).
* **Kitchen Display System (KitchenDisplaySystem.jsx & ViewStation.jsx)**: Prep station filtering, item readiness toggling (is_ready), cooking elapsed timers, and ticket stage progression.
* **Captain / Waiter Dine-In (Captain)**: Table status map (Free vs Occupied), assigning 	ableId, tracking guest count (membersOnTable).

---

## ?? 3. Frontend AI Implementation Tasks & Assignments

### ?? Task 1: Cashier POS Cart & Checkout UI
* **Convex API Directives**:
  * Create order: useMutation(api.orders.createOrder)
  * List payment modes: useQuery(api.paymentModes.list)
* **UI Deliverables**:
  * Shopping cart sidebar with item quantity increment/decrement.
  * Customer details form (customerName, customerPhone, customerEmail).
  * Dine-In / Take-Away / Delivery order type tabs.
  * Payment modal (Cash, Card, Split Payment).

### ?? Task 2: Kitchen Display System (KDS) Live Board
* **Convex API Directives**:
  * Realtime orders: useQuery(api.orders.listLiveOrders, { organizationId })
  * Advance status: useMutation(api.orders.updateOrderStatus)
  * Item ready toggle: useMutation(api.orders.toggleOrderItemReady)
* **UI Deliverables**:
  * KDS Kanban board columns grouped by organizationOrderProcesses stages.
  * Live status timer (elapsed cooking time).
  * One-tap "Mark Item Ready" and "Complete Ticket" actions.

### ?? Task 3: Captain / Waiter Dine-In Table Ordering
* **Convex API Directives**:
  * Table list: useQuery(api.tables.listTablesWithStatus, { organizationId })
* **UI Deliverables**:
  * Interactive floor plan table map showing occupied vs free tables.
  * Instant table order placement & table transfer actions.
