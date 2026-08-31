# International Taxation Engine & `isGst` Integration Documentation

This document details the **International Taxation Engine** implemented in `pos-default` supporting **India 🇮🇳, USA 🇺🇸, Canada 🇨🇦, Australia 🇦🇺, and the UK 🇬🇧**, seamlessly integrated with the `isGst` flag on menu items.

---

## 📌 Features & Capabilities

1. **Tax Modes**:
   * **`exclusive`** (USA, Canada): Tax is added on top of item price (`Final Price = Base Price + Tax`).
   * **`inclusive`** (Australia, UK, India optional): Tax is included inside the displayed price (`Tax = Price * (Rate / (100 + Rate))`).
2. **Multi-Component Split Lines**:
   * Support for multi-line taxes (e.g. CGST 2.5% + SGST 2.5%, or State Sales Tax 6.0% + City Tax 2.5%, or Federal GST 5% + PST 7%).
3. **Item `isGst` Integration**:
   * `isGst === false`: Tax exempt (`tax_amount = "0.00"`).
   * `isGst === true`: Evaluates item tax against store's active default tax group.
4. **Auto Store Setup**:
   * Replicates Rails `TaxationServices::GetTaxation` by auto-configuring default tax components, tax groups, and ISO currency symbols (`₹`, `$`, `£`) based on store country code.

---

## 🗄️ Database Schemas (`convex/schema.ts`)

Added 3 domain tables to `convex/schema.ts`:

### 1. `taxComponents`
* `organizationId`: `v.id("organizations")`
* `name`: `v.string()` (e.g. "CGST", "SGST", "State Sales Tax", "City Tax", "GST", "VAT")
* `rate`: `v.number()` (Percentage float e.g. `2.5`, `6.0`, `5.0`, `10.0`, `20.0`)
* `code`: `v.optional(v.string())`
* `createdAt`: `v.number()`

### 2. `taxGroups`
* `organizationId`: `v.id("organizations")`
* `name`: `v.string()`
* `taxMode`: `v.union(v.literal("inclusive"), v.literal("exclusive"))`
* `componentIds`: `v.array(v.id("taxComponents"))`
* `isDefault`: `v.boolean()`
* `createdAt`: `v.number()`, `updatedAt`: `v.number()`

### 3. `storeTaxSettings`
* `organizationId`: `v.id("organizations")`
* `countryCode`: `v.string()` ("IN", "US", "CA", "AU", "UK")
* `stateCode`: `v.optional(v.string())`
* `currencyCode`: `v.string()` ("INR", "USD", "CAD", "AUD", "GBP")
* `currencySymbol`: `v.string()` ("₹", "$", "£")
* `defaultTaxGroupId`: `v.optional(v.id("taxGroups"))`
* `updatedAt`: `v.number()`

---

## ⚡ Backend API Module (`convex/taxation.ts`)

### Functions
* **`autoSetupStoreTaxation({ organizationId, countryCode, stateCode })`**: Auto-provisions store currency and default tax groups.
* **`calculateItemTax({ organizationId, price, isGst, taxGroupId })`**: Utility query returning split tax breakdown for any menu item.
* **`createTaxComponent`**, **`listTaxComponents`**, **`createTaxGroup`**, **`listTaxGroups`**, **`setDefaultTaxGroup`**.

---

## 🧪 Verification & Tests (`convex/taxation.test.ts`)

Run tests via Vitest:
```bash
npx vitest run
```

### Verified Scenarios:
1. **India (IN)**: ₹250.00 item ➔ 5% GST split into 2.5% CGST + 2.5% SGST. Currency: `INR` (`₹`).
2. **USA (US)**: $100.00 item ➔ 8.5% Exclusive Sales Tax ($8.50 tax, final price $108.50). Currency: `USD` (`$`).
3. **UK**: £12.00 item ➔ 20% Inclusive VAT (£2.00 tax, final price £12.00). Currency: `GBP` (`£`).
4. **Item `isGst = false`**: $50.00 tax-exempt item ➔ 0 tax, final price $50.00.

---

## 🎨 Frontend AI Implementation Tasks & Assignments

This section outlines the exact React/Next.js tasks assigned to Frontend AI agents or UI engineers when building store taxation interfaces:

### 🎯 Task 1: Store Country Onboarding & Tax Setup Wizard
* **Goal**: Build a store onboarding widget allowing admins to select their store country and auto-provision taxation & currency settings.
* **Convex API Directives**:
  * Get settings: `useQuery(api.taxation.getStoreTaxSettings, { organizationId })`
  * Run auto setup: `useMutation(api.taxation.autoSetupStoreTaxation)` (`{ organizationId, countryCode: "IN" | "US" | "CA" | "AU" | "UK", stateCode }`)
* **UI Deliverables**:
  * Country Selector Dropdown ("India 🇮🇳", "USA 🇺🇸", "Canada 🇨🇦", "Australia 🇦🇺", "United Kingdom 🇬🇧").
  * ISO Currency Indicator (`₹ INR`, `$ USD`, `£ GBP`, `$ CAD`, `$ AUD`).
  * "Auto-Configure Country Taxes" action button with success notification.

---

### 🎯 Task 2: Tax Group Management Admin Panel
* **Goal**: Build an admin screen to manage tax groups, toggle `inclusive` vs `exclusive` modes, and view split component lines.
* **Convex API Directives**:
  * List tax groups: `useQuery(api.taxation.listTaxGroups, { organizationId })`
  * Create tax group: `useMutation(api.taxation.createTaxGroup)` (`{ organizationId, name, taxMode: "inclusive" | "exclusive", componentIds }`)
  * Set default group: `useMutation(api.taxation.setDefaultTaxGroup)` (`{ id: groupId }`)
* **UI Deliverables**:
  * Tax Group Cards showing mode badge (`Tax Inclusive` vs `Tax Exclusive`) and component list (e.g. `CGST: 2.5%`, `SGST: 2.5%`).
  * Tax Group Creation Form with mode toggle switch.

---

### 🎯 Task 3: POS Cart & Printed Receipt Tax Breakdown
* **Goal**: Display accurate tax calculations on checkout screens, cart line items, and printed receipts.
* **Convex API Directives**:
  * Query tax calculation: `useQuery(api.taxation.calculateItemTax, { organizationId, price, isGst, taxGroupId })`
  * Use `tax_info` summary object returned in `getOrganizationMenu` query.
* **UI Deliverables**:
  * Cart Line Item: Badge indicating `(Tax Included)` for inclusive mode or `+ Tax` for exclusive mode.
  * Checkout & Printed Receipt Summary Box:
    * Subtotal
    * Split Tax Component Lines (e.g., `CGST (2.5%): ₹6.25`, `SGST (2.5%): ₹6.25`, or `State Sales Tax (6.0%): $6.00`)
    * Final Amount Payable

