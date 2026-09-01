# Frontend API Reference: Organization Languages & Layouts Domains

> **Target Audience**: Frontend Engineers integrating with the DEFx-POS Convex Backend.  
> **Domains Covered**:  
> 1. **Organization Languages Domain (`organizationLanguages`)**: Multi-language catalog management, default language assignment, ISO code validation, and language selection.  
> 2. **Organization Layouts Domain (`organizationLayouts`)**: Restaurant floor plan sections (e.g., Main Dining, Patio, Bar, Rooftop) and display ordering.  
> **Source Files Inspected**: `Default app/convex/schema.ts`, `Default app/convex/organizationLanguages.ts`, `Default app/convex/organizationLanguages.test.ts`, `Default app/convex/organizationLayouts.ts`, `Default app/convex/organizationLayouts.test.ts`, `ORGANIZATION_LANGUAGE_BUSINESS_MODEL_AUDIT.md`, `ORGANIZATION_LAYOUTS_BUSINESS_MODEL_AUDIT.md`.

---

## 1. Scope & System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           STORE CONVEX DB (pos-default)                         │
│                                                                                 │
│   ┌───────────────────────────────────┐    ┌────────────────────────────────┐   │
│   │   organizationLanguages           │    │   organizationLayouts          │   │
│   │   - ISO Language Code ("en", "hi")│    │   - Floor Sections ("Patio")   │   │
│   │   - Exclusive Default Language    │    │   - Section Display Order      │   │
│   │   - Case-Insensitive Uniqueness   │    │   - Case-Insensitive Uniqueness│   │
│   └───────────────────────────────────┘    └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Organization Languages Architecture
The `organizationLanguages` domain manages the multi-lingual menu and receipt capabilities of a restaurant store.
* **Exclusive Default Language**: Exactly one active language in a store can be marked as default (`isDefault: true`). Creating or designating a new default language automatically unsets `isDefault` on any existing default language.
* **Case-Insensitive Uniqueness**: Language `name` (e.g., `"English"`) and `code` (e.g., `"en"`) must be unique case-insensitively across non-deleted records.
* **Soft Deletion**: Removing a language sets `deletedAt = Date.now()` and unsets `isDefault`.

### 1.2 Organization Layouts Architecture
The `organizationLayouts` domain manages floor plan sections (e.g., "Main Floor", "Terrace", "Bar", "VIP Lounge") for table seating and order routing.
* **Case-Insensitive Uniqueness**: Layout `name` must be unique case-insensitively across non-deleted records.
* **Display Ordering**: Optional `displayOrder` integer controls visual ordering in POS seating grids.

---

## 2. Database Schema Documentation

### 2.1 `organizationLanguages` Schema (`Default app/convex/schema.ts`)

| Field | Type | Required? | Description | Frontend Usage | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `name` | `v.string()` | **Yes** | Human-readable language name (e.g., `"English"`, `"Hindi"`). | Display / Edit | Trimmed automatically; case-insensitive unique. |
| `code` | `v.string()` | **Yes** | ISO language code (e.g., `"en"`, `"hi"`, `"ar"`). | Display / Code | Trimmed automatically; case-insensitive unique. Index: `by_code`. |
| `isDefault` | `v.boolean()` | **Yes** | Whether this is the store's primary default language. | Badge / Toggle | Mutually exclusive default toggle. |
| `legacyId` | `v.optional(v.string())` | No | PostgreSQL OrganizationLanguage UUID. | Read-Only | Migration reference. Index: `by_legacy_id`. |
| `createdAt` | `v.number()` | **Yes** | Creation timestamp (ms). | Read-Only | Server-generated. |
| `updatedAt` | `v.number()` | **Yes** | Modification timestamp (ms). | Read-Only | Server-managed. |
| `deletedAt` | `v.optional(v.number())` | No | Soft-deletion timestamp (ms). | Read-Only | Filtered out by active queries when present. |

---

### 2.2 `organizationLayouts` Schema (`Default app/convex/schema.ts`)

| Field | Type | Required? | Description | Frontend Usage | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `name` | `v.string()` | **Yes** | Layout section title (e.g., `"Main Dining"`, `"Patio"`). | Display / Header | Trimmed automatically; case-insensitive unique. Index: `by_name`. |
| `displayOrder` | `v.optional(v.number())` | No | Visual sort position index. | Sort / Reorder | e.g. `1`, `2`, `3`. |
| `legacyId` | `v.optional(v.string())` | No | PostgreSQL OrganizationLayout UUID. | Read-Only | Migration reference. Index: `by_legacy_id`. |
| `createdAt` | `v.number()` | **Yes** | Creation timestamp (ms). | Read-Only | Server-generated. |
| `updatedAt` | `v.number()` | **Yes** | Modification timestamp (ms). | Read-Only | Server-managed. |
| `deletedAt` | `v.optional(v.number())` | No | Soft-deletion timestamp (ms). | Read-Only | Filtered out by active queries when present. |

---

## 3. API Inventory & Classification

### 3.1 Organization Languages APIs (`Default app/convex/organizationLanguages.ts`)

| Function Name | API Type | Caller Access Guard | Purpose |
| :--- | :--- | :--- | :--- |
| `organizationLanguages.list` | Query | Active Store Member | Lists all active (non-deleted) languages for the store. |
| `organizationLanguages.get` | Query | Active Store Member | Fetches a single language by Document ID `v.id("organizationLanguages")`. |
| `organizationLanguages.getByCode` | Query | Active Store Member | Fetches a language by ISO code (case-insensitive). |
| `organizationLanguages.create` | Mutation | **Store Admin** | Creates a new language. Validates unique name/code and handles default exclusivity. |
| `organizationLanguages.update` | Mutation | **Store Admin** | Updates name, code, or default flag. Validates uniqueness if changed. |
| `organizationLanguages.setDefault` | Mutation | **Store Admin** | Designates a language as the active default and unsets previous default. |
| `organizationLanguages.remove` | Mutation | **Store Admin** | Soft-deletes a language (`deletedAt = Date.now()`) and unsets `isDefault`. |

---

### 3.2 Organization Layouts APIs (`Default app/convex/organizationLayouts.ts`)

| Function Name | API Type | Caller Access Guard | Purpose |
| :--- | :--- | :--- | :--- |
| `organizationLayouts.list` | Query | Active Store Member | Lists all active (non-deleted) floor layout sections. |
| `organizationLayouts.get` | Query | Active Store Member | Fetches a single layout section by Document ID `v.id("organizationLayouts")`. |
| `organizationLayouts.create` | Mutation | **Store Admin** | Creates a new layout section (e.g., `"Outdoor Patio"`). Validates unique name. |
| `organizationLayouts.update` | Mutation | **Store Admin** | Updates layout section name and/or display order. |
| `organizationLayouts.remove` | Mutation | **Store Admin** | Soft-deletes a layout section (`deletedAt = Date.now()`). |

---

## 4. Organization Languages API Contracts

### 4.1 `organizationLanguages.list`
**Type**: `Query`  
**Purpose**: Returns all active (non-deleted) store languages.

#### Arguments
*None.*

#### Return Value
```ts
Array<{
  _id: Id<"organizationLanguages">,
  _creationTime: number,
  name: string,
  code: string,
  isDefault: boolean,
  createdAt: number,
  updatedAt: number,
  legacyId?: string
}>
```

---

### 4.2 `organizationLanguages.getByCode`
**Type**: `Query`  
**Purpose**: Look up a language record by its code string (case-insensitive).

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `code` | `v.string()` | **Yes** | ISO language code. | `"hi"` or `"EN"` |

#### Return Value
Returns the matching `Doc<"organizationLanguages">` or `null` if not found / soft-deleted.

---

### 4.3 `organizationLanguages.create`
**Type**: `Mutation`  
**Purpose**: Creates a new language entry for the store.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `v.string()` | **Yes** | Language name. | `"Arabic"` |
| `code` | `v.string()` | **Yes** | Language ISO code. | `"ar"` |
| `isDefault` | `v.optional(v.boolean())` | No | Designates as store default. | `false` |
| `legacyId` | `v.optional(v.string())` | No | Legacy PostgreSQL UUID. | |

#### Return Value
Returns new `Id<"organizationLanguages">`.

#### Business Guards & Errors
1. **Name Validation**: Cannot be blank. Throws `"Name can't be blank"`.
2. **Code Validation**: Cannot be blank. Throws `"Code can't be blank"`.
3. **Unique Name & Code**: Case-insensitive uniqueness check among active records. If duplicate exists, throws `"Hey! <name/code> is already taken."`.
4. **Default Exclusivity**: If `isDefault: true` is passed, handler automatically unsets `isDefault = false` on any existing default language document.

---

### 4.4 `organizationLanguages.setDefault`
**Type**: `Mutation`  
**Purpose**: Sets a specified language as the active default language for the store.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationLanguages")` | **Yes** | Target language ID. | `"jd7639gq498thz..."` |

#### Return Value
`{ success: true }`

#### Side Effects
* Unsets `isDefault = false` on the previous default language.
* Sets `isDefault = true` on the target language.
* Updates `updatedAt = Date.now()`.

---

### 4.5 `organizationLanguages.remove`
**Type**: `Mutation`  
**Purpose**: Soft-deletes a language record.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationLanguages")` | **Yes** | Target language ID. | `"jd7639gq498thz..."` |

#### Return Value
`{ success: true }`

#### Side Effects
* Sets `isDefault = false`.
* Sets `deletedAt = Date.now()`.
* Sets `updatedAt = Date.now()`.

---

## 5. Organization Layouts API Contracts

### 5.1 `organizationLayouts.list`
**Type**: `Query`  
**Purpose**: Returns all active floor layout sections for the store.

#### Arguments
*None.*

#### Return Value
```ts
Array<{
  _id: Id<"organizationLayouts">,
  _creationTime: number,
  name: string,
  displayOrder?: number,
  createdAt: number,
  updatedAt: number,
  legacyId?: string
}>
```

---

### 5.2 `organizationLayouts.create`
**Type**: `Mutation`  
**Purpose**: Adds a new floor plan layout section to the store.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `v.string()` | **Yes** | Layout section name. | `"Main Dining Floor"` |
| `displayOrder` | `v.optional(v.number())` | No | Visual sort position. | `1` |
| `legacyId` | `v.optional(v.string())` | No | Legacy PostgreSQL UUID. | |

#### Return Value
Returns new `Id<"organizationLayouts">`.

#### Business Guards & Errors
1. **Name Validation**: Cannot be blank. Throws `"Name can't be blank"`.
2. **Unique Name**: Case-insensitive uniqueness check among active records. If duplicate exists, throws `"Hey! <name> is already taken."`.

---

### 5.3 `organizationLayouts.update`
**Type**: `Mutation`  
**Purpose**: Updates layout section name and/or sort position.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationLayouts")` | **Yes** | Layout Document ID. | `"j5701xyz..."` |
| `name` | `v.optional(v.string())` | No | New layout name. | `"Rooftop Lounge"` |
| `displayOrder` | `v.optional(v.number())` | No | New sort position. | `2` |

#### Return Value
`{ success: true }`

---

### 5.4 `organizationLayouts.remove`
**Type**: `Mutation`  
**Purpose**: Soft-deletes a floor layout section.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationLayouts")` | **Yes** | Layout Document ID. | `"j5701xyz..."` |

#### Return Value
`{ success: true }`

---

## 6. Error Handling Reference

| Error Message | Thrown By | Root Cause | Recommended Frontend Handling |
| :--- | :--- | :--- | :--- |
| `"Unauthenticated. Please provide a valid authentication token."` | `requireAuth` | Missing or expired Clerk JWT token. | Redirect user to login screen. |
| `"Forbidden. Active store membership required."` | `requireMember` | User has no membership in store. | Display "Access Denied" screen. |
| `"Forbidden. Admin access required."` | `requireAdmin` | User lacks `admin` role tag. | Disable edit/delete buttons for non-admins. |
| `"Name can't be blank"` | `create`, `update` | Empty or whitespace-only name string. | Highlight input field with error border. |
| `"Code can't be blank"` | `organizationLanguages:create/update` | Empty or whitespace-only language code. | Highlight code input field. |
| `"Hey! <name/code> is already taken."` | `create`, `update` | Case-insensitive duplicate name or code. | Display validation error "Name/Code already exists". |
| `"Language not found"` | `update`, `setDefault`, `remove` | Invalid ID or soft-deleted language. | Refresh list from server; show alert. |
| `"Layout not found"` | `update`, `remove` | Invalid ID or soft-deleted layout. | Refresh list from server; show alert. |

---

## 7. Concrete Frontend Usage Examples

### 7.1 Language Selector Component (React + Convex)

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function StoreLanguageSelector() {
  const languages = useQuery(api.organizationLanguages.list, {});
  const setDefaultLanguage = useMutation(api.organizationLanguages.setDefault);

  if (!languages) return <div>Loading languages...</div>;

  const defaultLang = languages.find((l) => l.isDefault);

  return (
    <div className="language-selector">
      <label>Current Default Language: <strong>{defaultLang?.name || "None"}</strong></label>
      
      <select 
        value={defaultLang?._id || ""}
        onChange={(e) => setDefaultLanguage({ id: e.target.value as any })}
      >
        {languages.map((lang) => (
          <option key={lang._id} value={lang._id}>
            {lang.name} ({lang.code.toUpperCase()}) {lang.isDefault ? "★ Default" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

### 7.2 Floor Layout Sections Manager (React + Convex)

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function FloorLayoutManager() {
  const layouts = useQuery(api.organizationLayouts.list, {});
  const createLayout = useMutation(api.organizationLayouts.create);
  const removeLayout = useMutation(api.organizationLayouts.remove);
  
  const [newLayoutName, setNewLayoutName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!layouts) return <div>Loading floor layouts...</div>;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createLayout({ name: newLayoutName });
      setNewLayoutName("");
    } catch (err: any) {
      setError(err.message || "Failed to create layout section");
    }
  };

  return (
    <div className="layout-manager">
      <h2>Floor Plan Sections</h2>
      {error && <div className="error-alert">{error}</div>}

      <form onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="New Section (e.g. Terrace Bar)"
          value={newLayoutName}
          onChange={(e) => setNewLayoutName(e.target.value)}
        />
        <button type="submit">Add Section</button>
      </form>

      <ul className="layout-list">
        {layouts.map((layout) => (
          <li key={layout._id}>
            <span>{layout.name}</span>
            <button onClick={() => removeLayout({ id: layout._id })}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 8. Frontend Integration Checklist

- [ ] **Languages Selector**: Connect `api.organizationLanguages.list` to the digital menu language picker.
- [ ] **Default Language Setting**: Implement `api.organizationLanguages.setDefault` in store admin settings.
- [ ] **Code Validation**: Ensure ISO codes are formatted cleanly before submission (e.g. `"en"`, `"hi"`, `"ar"`).
- [ ] **Floor Layout Rendering**: Query `api.organizationLayouts.list` to populate seating section tabs on POS cashier/waiter screens.
- [ ] **Name Duplication Alerts**: Catch `"Hey! <name> is already taken."` errors in form modals for both languages and layouts.
