# Multi-Menu Organization Architecture & API Documentation

This document provides a comprehensive guide to the **Organization Menu System** implemented in `pos-default`. It details the multi-menu database schemas, backend Convex queries/mutations, 1:1 field parity with the legacy Ruby on Rails backend (`defx-pos`), testing procedures, and frontend integration examples.

---

## 📌 Architectural Overview

In the DEFx-POS platform:
* **`pos-master` (Control Plane)**: Manages platform organizations, store provisioning via the Convex Management API, and infrastructure health. It contains **no store business data or menu tables**.
* **`pos-default` (Store POS & Customer Blueprint)**: Deployed into each provisioned store project. Contains all store schemas, menu tables, kitchen displays, inventory, and order operations.

### Multi-Menu Data Hierarchy

```text
Organization (organizationId)
  └── Menus (menus table: "Breakfast Menu", "Main Menu", "Bar Menu")
       └── Categories (categories table: "Starters", "Pizzas", "Drinks")
            └── CategoryItems (categoryItems junction table: position, published)
                 └── Items (items table: price, description, dietary tags)
                      ├── ItemTypes (itemTypes table: Veg, Non-Veg, Jain, Vegan)
                      ├── Customizations (customizations table: Add-Ons / Preparations)
                      │    └── CustomizationItems (customizationItems table: Options & Prices)
                      └── Media Storage (Convex Storage IDs for 2D, 3D, iOS 3D, Video)
```

---

## 🗄️ Database Schemas (`convex/schema.ts`)

The menu system adds **7 core domain tables** to [`convex/schema.ts`](file:///c:/Workspace/pos-default/convex/schema.ts) without altering existing store schemas:

### 1. `menus`
Stores multiple menus per organization with default menu rotation and active status:
* `organizationId`: `v.id("organizations")`
* `name`: `v.string()` (e.g. "Main Menu", "Breakfast Menu", "Late Night Menu")
* `description`: `v.optional(v.string())`
* `isDefault`: `v.boolean()` (Stores can mark one menu as default)
* `isActive`: `v.boolean()`
* `position`: `v.number()`
* `createdAt`: `v.number()`, `updatedAt`: `v.number()`
* **Indexes**: `by_org`, `by_org_default`

### 2. `categories`
Sections inside a menu:
* `organizationId`: `v.id("organizations")`
* `menuId`: `v.id("menus")`
* `name`: `v.string()`
* `position`: `v.number()`, `published`: `v.boolean()`
* `name_hi`: `v.optional(v.string())`, `name_gu`: `v.optional(v.string())` (Multilingual support)
* **Indexes**: `by_menu`, `by_org`

### 3. `items`
Base food & product items:
* `organizationId`: `v.id("organizations")`
* `name`: `v.string()`, `price`: `v.number()` (minor units / paise / cents)
* `description`: `v.optional(v.string())`
* `published`: `v.boolean()`, `isAvailable`: `v.boolean()`, `isGst`: `v.boolean()`
* `isVeg`: `v.boolean()`, `isSpicy`: `v.boolean()`, `markAsBestseller`: `v.boolean()`
* `favouriteItem`: `v.optional(v.boolean())`
* `showQuantity`: `v.boolean()`, `quantity`: `v.optional(v.number())`, `quantityUnit`: `v.optional(v.string())`
* `skuNumber`: `v.optional(v.string())`
* `showCalorie`: `v.boolean()`, `calorie`: `v.optional(v.string())`, `calorieMetric`: `v.optional(v.string())` ("kcal")
* `daysOfUnavailable`: `v.optional(v.number())`
* `servingSize`: `v.optional(v.string())`, `serving`: `v.optional(v.number())`, `caloriesPerServing`: `v.optional(v.string())`
* `itemTypeIds`: `v.optional(v.array(v.id("itemTypes")))`
* `imageStorageId`: `v.optional(v.id("_storage"))` (Standard Image)
* `threeDModelStorageId`: `v.optional(v.id("_storage"))` (Web 3D Model)
* `threeDModelIosStorageId`: `v.optional(v.id("_storage"))` (iOS `.usdz` Model)
* `videoStorageId`: `v.optional(v.id("_storage"))` (Product Video)
* **Indexes**: `by_org`

### 4. `categoryItems`
Many-to-many junction table between categories and items:
* `organizationId`: `v.id("organizations")`, `categoryId`: `v.id("categories")`, `itemId`: `v.id("items")`
* `position`: `v.number()`, `published`: `v.boolean()`
* **Indexes**: `by_category`

### 5. `itemTypes`
Dietary labels:
* `organizationId`: `v.id("organizations")`, `name`: `v.string()`, `icon`: `v.optional(v.string())`
* **Indexes**: `by_org`

### 6. `customizations`
Add-On and Preparation option groups:
* `organizationId`: `v.id("organizations")`, `itemId`: `v.id("items")`, `name`: `v.string()`
* `customizationType`: `v.union(v.literal("AddOns"), v.literal("Preparations"))`
* `required`: `v.boolean()`, `maxSelected`: `v.number()`, `position`: `v.number()`, `published`: `v.boolean()`
* **Indexes**: `by_item`

### 7. `customizationItems`
Individual choices inside a customization group:
* `organizationId`: `v.id("organizations")`, `customizationId`: `v.id("customizations")`, `name`: `v.string()`, `price`: `v.number()`
* `isGst`: `v.optional(v.boolean())`, `showQuantity`: `v.optional(v.boolean())`, `quantity`: `v.optional(v.number())`, `quantityUnit`: `v.optional(v.string())`
* `description`: `v.optional(v.string())`, `showCalorie`: `v.optional(v.boolean())`, `calorie`: `v.optional(v.string())`, `calorieMetric`: `v.optional(v.string())`
* `daysOfUnavailable`: `v.optional(v.number())`, `isAvailable`: `v.boolean()`, `position`: `v.number()`
* `itemTypeIds`: `v.optional(v.array(v.id("itemTypes")))`, `imageStorageId`: `v.optional(v.id("_storage"))`
* **Indexes**: `by_customization`

---

## ⚡ Backend API Module (`convex/menu.ts`)

### Menu Management Mutations & Queries
* **`listMenus({ organizationId })`**: Returns all menus for a store ordered by position.
* **`getMenu({ id })`**: Returns a single menu record by ID.
* **`createMenu({ organizationId, name, description, isDefault, isActive, position })`**: Creates a new menu. Auto-assigns default menu status if first menu.
* **`setDefaultMenu({ id })`**: Atomically updates the target menu to `isDefault: true` and unsets any previous default menu for that store.
* **`updateMenu({ id, name, description, isActive, position })`**: Updates menu parameters.
* **`deleteMenu({ id })`**: Deletes a menu.

### Organization Menu Execution Query (`getOrganizationMenu`)

Replicates Rails `get_organization_menu` endpoint with multi-menu and storage resolution:

```typescript
export const getOrganizationMenu = query({
  args: {
    organizationId: v.id("organizations"),
    menuId: v.optional(v.id("menus")),  // Optional: falls back to active default menu if omitted!
    search: v.optional(v.string()),     // Search item name/description substring
    isVeg: v.optional(v.boolean()),      // Filter vegetarian items
    isSpicy: v.optional(v.boolean()),    // Filter spicy items
  },
  handler: async (ctx, args) => { ... }
});
```

#### JSON Response Format (`getOrganizationMenu`)
```json
[
  {
    "category": {
      "id": "cat_123",
      "name": "Starters",
      "name_hi": "स्टार्टर्स",
      "name_gu": "સ્ટાર્ટર્સ",
      "position": 1,
      "published": true,
      "items": [
        {
          "category_item_id": "ci_456",
          "item": {
            "id": "item_789",
            "name": "Paneer Tikka",
            "price": 25000,
            "display_price": "250.00",
            "description": "Charcoal grilled cottage cheese",
            "published": true,
            "is_available": true,
            "is_gst": true,
            "is_veg": true,
            "is_spicy": true,
            "show_quantity": false,
            "quantity": null,
            "quantity_unit": null,
            "sku_number": "SKU-001",
            "mark_as_bestseller": true,
            "favourite_item": false,
            "show_calorie": true,
            "calorie": "350",
            "calorie_metric": "kcal",
            "days_of_unavailable": 0,
            "serving_size": "6 pieces",
            "serving": 1,
            "calories_per_serving": "350 kcal",
            "items_item_types": [
              { "id": "type_veg", "name": "Veg", "icon": "veg-icon" }
            ]
          },
          "customizations": [
            {
              "id": "cust_111",
              "name": "Dips & Sauces",
              "customization_type": "Add-Ons",
              "required": false,
              "max_selected": 2,
              "position": 1,
              "published": true,
              "customization_items": [
                {
                  "id": "ciopt_222",
                  "name": "Mint Chutney",
                  "price": 3000,
                  "display_price": "30.00",
                  "is_gst": false,
                  "is_available": true,
                  "position": 1,
                  "customization_item_image_url": { "original": "https://..." },
                  "items_item_types": []
                }
              ]
            }
          ],
          "item_image_url": "https://store-deployment.convex.cloud/api/storage/...",
          "item_3d_image_url": "https://store-deployment.convex.cloud/api/storage/...",
          "item_3d_image_for_ios_url": "https://...",
          "item_video_url": "https://..."
        }
      ]
    }
  }
]
```

---

## 🧪 Testing & Verification (`convex/menu.test.ts`)

Run the test suite locally using Vitest:

```bash
npx vitest run
```

### Verified Test Cases:
1. **Multi-Menu Provisioning & Default Rotation**: Verifies creating multiple menus, setting defaults, and listing menus.
2. **Full Nested Tree Construction**: Tests categories, items, customization groups, and options nesting.
3. **Attribute & Search Filtering**: Verifies substring searching and vegetarian filtering.

---

## 💻 Frontend Code Snippet (Next.js / React)

```typescript
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function RestaurantMenu({ organizationId }: { organizationId: string }) {
  // Automatically loads store's default active menu in real time!
  const menuData = useQuery(api.menu.getOrganizationMenu, {
    organizationId: organizationId as any,
  });

  if (!menuData) return <div>Loading Menu...</div>;

  return (
    <div>
      {menuData.map(({ category }) => (
        <section key={category.id}>
          <h2>{category.name}</h2>
          {category.items.map(({ item, customizations, item_image_url }) => (
            <div key={item.id} className="menu-item">
              {item_image_url && <img src={item_image_url} alt={item.name} />}
              <h3>{item.name} - ₹{item.display_price}</h3>
              <p>{item.description}</p>
              {item.is_veg && <span className="badge-veg">Veg</span>}
              {item.is_spicy && <span className="badge-spicy">Spicy</span>}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
```

---

## 🎨 Frontend AI Implementation Tasks & Assignments

This section outlines the exact React/Next.js tasks assigned to Frontend AI agents or UI engineers when building the store menu interface:

### 🎯 Task 1: Store Multi-Menu Switcher & Management UI
* **Goal**: Build an admin interface to view all store menus, switch default active menus, and create new menus.
* **Convex API Directives**:
  * Read menus: `useQuery(api.menu.listMenus, { organizationId })`
  * Create menu: `useMutation(api.menu.createMenu)` (`{ organizationId, name, description, isDefault }`)
  * Switch default: `useMutation(api.menu.setDefaultMenu)` (`{ id: menuId }`)
* **UI Deliverables**:
  * Top navigation tabs / dropdown selector listing all available store menus ("Breakfast", "Main Menu", "Bar Menu").
  * Active Default Menu badge indicator (`Default Active`).
  * "Create New Menu" modal dialog with name, description, and "Set as Default" toggle.

---

### 🎯 Task 2: Store POS & Digital Customer Menu Screen
* **Goal**: Render the complete nested category and item menu tree with search and dietary attribute filters.
* **Convex API Directives**:
  * Query menu tree: `useQuery(api.menu.getOrganizationMenu, { organizationId, menuId, search, isVeg, isSpicy })`
* **UI Deliverables**:
  * Category navigation bar (sticky sidebar or horizontal tabs).
  * Search input bar (live filtering by item name or description substring).
  * Dietary Filter Toggles (`Is Veg Only`, `Is Spicy Only`).
  * Item Cards displaying:
    * `name`, `display_price` (e.g. `₹250.00`), `description`.
    * Dietary badges (`Veg` green icon, `Spicy` red flame icon, `Bestseller` star).
    * `item_image_url` thumbnail.
    * Tax indicator badge (`Tax Included` vs `+ Tax`).

---

### 🎯 Task 3: Item Add-Ons & Customizations Modal
* **Goal**: Display customization groups when an item is selected for the cart.
* **UI Deliverables**:
  * Modal drawer displaying customization groups (`Add-Ons` vs `Preparations`).
  * Enforce group rules: `required: true` (must pick at least 1 option) and `max_selected` (checkbox/radio input bounds).
  * Display option extra price (`+ ₹30.00`).

