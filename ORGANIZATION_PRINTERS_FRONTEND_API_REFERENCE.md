# Frontend API Reference: Organization Printers Domain

> **Target Audience**: Frontend Engineers integrating with the DEFx-POS Convex Backend.  
> **Domain Covered**: **Organization Printers (`organizationPrinters`)** — Thermal receipt printers, kitchen station tickets (KOT), workstation label printers, network port settings, and station bindings.  
> **Source Files Inspected**: `Default app/convex/schema.ts`, `Default app/convex/organizationPrinters.ts`, `Default app/convex/organizationPrinters.test.ts`, `Default app/ORGANIZATION_PRINTERS_BUSINESS_MODEL_AUDIT.md`, `docs/prd/organization-printers-domain-prd.md`.

---

## 1. Scope & System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           STORE CONVEX DB (pos-default)                         │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        organizationPrinters                             │   │
│   │   - Hardware Connection: "Lan" (TCP/IP), "Bluetooth", "Usb"             │   │
│   │   - Printer Purpose Role: "Cashier", "Station", "WorkStation"            │   │
│   │   - Max 1 Active Printer per Purpose Role                               │   │
│   │   - LAN Station Requirement: Lan + Station => stationId Required         │   │
│   │   - Access: Admin & Cashier Roles Permitted to Mutate                   │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Organization Printers Architecture
The `organizationPrinters` domain manages hardware receipt and ticket printer configurations for POS billing counters, kitchen preparation stations (KOT), and order fulfillment workstations.

* **Connection Types (`printerType`)**: Supports `"Lan"` (Network TCP/IP), `"Bluetooth"`, and `"Usb"`.
* **Printer Purpose Roles (`printerUseFor`)**:
  * `"Cashier"`: Billing counter thermal receipt printer.
  * `"Station"`: Kitchen prep station order ticket (KOT) printer.
  * `"WorkStation"`: Order dispatch / packaging workstation label printer.
* **Active Purpose Uniqueness**: A store can have at most **one active printer per `printerUseFor` role**. Attempting to add a second active printer for the same purpose throws an error.
* **Conditional Station Binding**: LAN Station printers (`printerType === "Lan" && printerUseFor === "Station"`) **must** be linked to a specific kitchen station ID (`stationId`).
* **Elevated Operational Permission**: Unlike general store settings, printer configuration mutations (`create`, `update`, `remove`) can be executed by both **Store Admins** and **Cashier** staff members (`requireAdminOrCashier`).

---

## 2. Database Schema Documentation

### 2.1 `organizationPrinters` Schema (`Default app/convex/schema.ts`)

| Field | Type | Required? | Description | Frontend Usage | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `printerUrl` | `v.string()` | **Yes** | IP address, hostname, or hardware URL (e.g. `"192.168.1.100"`). | Display / Edit | Trimmed automatically; cannot be blank. |
| `printerPort` | `v.optional(v.string())` | No | Network port string (e.g. `"9100"`). | Display / Edit | Trimmed automatically. Default thermal LAN port: `9100`. |
| `printerType` | `v.union(v.literal("Lan"), v.literal("Bluetooth"), v.literal("Usb"))` | **Yes** | Hardware interface connection type. | Selection | `"Lan"`, `"Bluetooth"`, or `"Usb"`. |
| `printerUseFor` | `v.union(v.literal("Cashier"), v.literal("Station"), v.literal("WorkStation"))` | **Yes** | Operational role assignment. | Selection / Badge | Maximum 1 active printer per purpose role. Index: `by_use_for`. |
| `stationId` | `v.optional(v.string())` | No | Kitchen station ID reference. | Select / Link | **Required** if `printerType === "Lan"` and `printerUseFor === "Station"`. Index: `by_station`. |
| `legacyId` | `v.optional(v.string())` | No | PostgreSQL OrganizationPrinter UUID. | Read-Only | Migration reference. Index: `by_legacy_id`. |
| `createdAt` | `v.number()` | **Yes** | Creation timestamp (ms). | Read-Only | Server-generated. |
| `updatedAt` | `v.number()` | **Yes** | Modification timestamp (ms). | Read-Only | Server-managed. |
| `deletedAt` | `v.optional(v.number())` | No | Soft-deletion timestamp (ms). | Read-Only | Filtered out by active queries when present. |

---

## 3. API Inventory & Classification

### 3.1 Organization Printers APIs (`Default app/convex/organizationPrinters.ts`)

| Function Name | API Type | Access Guard | Purpose |
| :--- | :--- | :--- | :--- |
| `organizationPrinters.list` | Query | Store Member | Returns all active (non-deleted) printers configured for the store. |
| `organizationPrinters.get` | Query | Store Member | Fetches a single printer configuration by Document ID `v.id("organizationPrinters")`. |
| `organizationPrinters.create` | Mutation | **Admin or Cashier** | Adds a new printer configuration. Validates URL, purpose uniqueness, and station link. |
| `organizationPrinters.update` | Mutation | **Admin or Cashier** | Updates printer IP/URL, port, type, purpose, or station binding. |
| `organizationPrinters.remove` | Mutation | **Admin or Cashier** | Soft-deletes a printer configuration (`deletedAt = Date.now()`). Frees purpose role. |

---

## 4. API Contracts

### 4.1 `organizationPrinters.list`
**Type**: `Query`  
**Purpose**: Returns all active (non-deleted) store printers.

#### Arguments
*None.*

#### Return Value
```ts
Array<{
  _id: Id<"organizationPrinters">,
  _creationTime: number,
  printerUrl: string,
  printerPort?: string,
  printerType: "Lan" | "Bluetooth" | "Usb",
  printerUseFor: "Cashier" | "Station" | "WorkStation",
  stationId?: string,
  createdAt: number,
  updatedAt: number,
  legacyId?: string
}>
```

#### Authentication & Authorization
* **Authentication**: **REQUIRED** (`requireAuth`).
* **Authorization**: **REQUIRED** (`requireMember`). Must be an active member of the store.

---

### 4.2 `organizationPrinters.get`
**Type**: `Query`  
**Purpose**: Fetches a single printer configuration by its Document ID.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationPrinters")` | **Yes** | Target printer document ID. | `"jd7639gq498thz..."` |

#### Return Value
Returns matching `Doc<"organizationPrinters">` or `null` if not found / soft-deleted.

---

### 4.3 `organizationPrinters.create`
**Type**: `Mutation`  
**Purpose**: Configures a new hardware printer for the store.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `printerUrl` | `v.string()` | **Yes** | IP address or hardware path. | `"192.168.1.100"` |
| `printerType` | `v.union(v.literal("Lan"), v.literal("Bluetooth"), v.literal("Usb"))` | **Yes** | Connection interface. | `"Lan"` |
| `printerUseFor` | `v.union(v.literal("Cashier"), v.literal("Station"), v.literal("WorkStation"))` | **Yes** | Printer operational purpose. | `"Cashier"` |
| `printerPort` | `v.optional(v.string())` | No | Network port string. | `"9100"` |
| `stationId` | `v.optional(v.string())` | No | Kitchen station ID. | `"stn_12345"` |
| `legacyId` | `v.optional(v.string())` | No | Legacy PostgreSQL UUID. | |

#### Return Value
Returns new `Id<"organizationPrinters">`.

#### Business Guards & Errors
1. **Role Access Guard (`requireAdminOrCashier`)**: Requires caller to have either `admin` or `cashier` role tag. Throws `"Forbidden. Admin or Cashier access required."` for other roles.
2. **URL Validation**: Cannot be blank. Throws `"Printer URL can't be blank"`.
3. **LAN Station Requirement**: If `printerType === "Lan"` AND `printerUseFor === "Station"`, `stationId` must be non-blank. Throws `"Station reference is required for LAN station printers."`.
4. **Active Purpose Uniqueness**: Max 1 active printer per `printerUseFor` role. If active printer already exists for that role, throws `"Hey! <printerUseFor> printer is already taken."`.

---

### 4.4 `organizationPrinters.update`
**Type**: `Mutation`  
**Purpose**: Updates an existing printer configuration.

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationPrinters")` | **Yes** | Target printer document ID. | `"jd7639gq498thz..."` |
| `printerUrl` | `v.optional(v.string())` | No | Updated IP address/URL. | `"192.168.1.105"` |
| `printerPort` | `v.optional(v.string())` | No | Updated network port. | `"9100"` |
| `printerType` | `v.optional(...)` | No | Updated connection type. | `"Lan"` |
| `printerUseFor` | `v.optional(...)` | No | Updated purpose role. | `"Station"` |
| `stationId` | `v.optional(v.string())` | No | Updated station ID. | `"stn_67890"` |

#### Return Value
`{ success: true }`

#### Business Guards & Errors
1. **Printer Existence**: Throws `"Printer not found"` if ID does not exist or is soft-deleted.
2. **Effective Values Evaluation**: Re-validates LAN station requirement on effective values (`printerType`, `printerUseFor`, `stationId`).
3. **Purpose Uniqueness**: If changing `printerUseFor`, checks uniqueness against other active printers.

---

### 4.5 `organizationPrinters.remove`
**Type**: `Mutation`  
**Purpose**: Soft-deletes a printer configuration (`deletedAt = Date.now()`).

#### Arguments

| Argument | Type | Required? | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `v.id("organizationPrinters")` | **Yes** | Target printer document ID. | `"jd7639gq498thz..."` |

#### Return Value
`{ success: true }`

#### Side Effects
* Sets `deletedAt = Date.now()`.
* Sets `updatedAt = Date.now()`.
* **Frees Purpose Role**: Once soft-deleted, the `printerUseFor` role becomes available for newly created printers.

---

## 5. Error Handling Reference

| Error Message | Thrown By | Root Cause | Recommended Frontend Handling |
| :--- | :--- | :--- | :--- |
| `"Unauthenticated. Please provide a valid authentication token."` | `requireAuth` | Missing or expired Clerk JWT token. | Redirect user to login screen. |
| `"Forbidden. Active store membership required."` | `requireMember` | User has no active membership in store. | Display "Access Denied" screen. |
| `"Forbidden. Admin or Cashier access required."` | `requireAdminOrCashier` | Caller lacks `admin` or `cashier` role. | Disable printer edit/add controls for unauthorized staff. |
| `"Printer URL can't be blank"` | `create`, `update` | Empty or whitespace-only IP/URL string. | Highlight IP address input field with error border. |
| `"Station reference is required for LAN station printers."` | `create`, `update` | Selected LAN + Station without picking a station. | Force station dropdown selection when LAN + Station selected. |
| `"Hey! <printerUseFor> printer is already taken."` | `create`, `update` | Active printer already assigned to that role. | Display warning "A <role> printer is already configured". |
| `"Printer not found"` | `update`, `remove` | Invalid ID or soft-deleted printer. | Refresh printer list from server; show alert. |

---

## 6. Concrete Frontend Usage Examples

### 6.1 Store Printer Hardware Setup Form (React + Convex)

```tsx
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function PrinterSetupForm() {
  const printers = useQuery(api.organizationPrinters.list, {});
  const createPrinter = useMutation(api.organizationPrinters.create);
  const removePrinter = useMutation(api.organizationPrinters.remove);

  const [printerUrl, setPrinterUrl] = useState("192.168.1.100");
  const [printerPort, setPrinterPort] = useState("9100");
  const [printerType, setPrinterType] = useState<"Lan" | "Bluetooth" | "Usb">("Lan");
  const [printerUseFor, setPrinterUseFor] = useState<"Cashier" | "Station" | "WorkStation">("Cashier");
  const [stationId, setStationId] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!printers) return <div>Loading printer settings...</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await createPrinter({
        printerUrl,
        printerPort,
        printerType,
        printerUseFor,
        stationId: printerType === "Lan" && printerUseFor === "Station" ? stationId : undefined,
      });
      alert("Printer added successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to add printer");
    }
  };

  return (
    <div className="printer-setup-panel">
      <h2>Store Hardware Printers</h2>
      {error && <div className="error-alert">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label>Printer IP / URL</label>
        <input 
          value={printerUrl} 
          onChange={(e) => setPrinterUrl(e.target.value)} 
          placeholder="192.168.1.100" 
          required 
        />

        <label>Port</label>
        <input 
          value={printerPort} 
          onChange={(e) => setPrinterPort(e.target.value)} 
          placeholder="9100" 
        />

        <label>Interface Type</label>
        <select value={printerType} onChange={(e) => setPrinterType(e.target.value as any)}>
          <option value="Lan">LAN (TCP/IP)</option>
          <option value="Bluetooth">Bluetooth</option>
          <option value="Usb">USB Direct</option>
        </select>

        <label>Printer Role Purpose</label>
        <select value={printerUseFor} onChange={(e) => setPrinterUseFor(e.target.value as any)}>
          <option value="Cashier">Cashier Receipt Printer</option>
          <option value="Station">Kitchen Station Ticket (KOT)</option>
          <option value="WorkStation">Workstation Label Printer</option>
        </select>

        {printerType === "Lan" && printerUseFor === "Station" && (
          <div>
            <label>Target Kitchen Station ID</label>
            <input 
              value={stationId} 
              onChange={(e) => setStationId(e.target.value)} 
              placeholder="e.g. station_kitchen_1" 
              required 
            />
          </div>
        )}

        <button type="submit">Add Printer</button>
      </form>

      <h3>Configured Printers</h3>
      <ul>
        {printers.map((p) => (
          <li key={p._id}>
            <strong>[{p.printerUseFor}]</strong> {p.printerUrl}:{p.printerPort || "9100"} ({p.printerType})
            <button onClick={() => removePrinter({ id: p._id })}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 7. Frontend Integration Checklist

- [ ] **Role Permissions**: Ensure both **Store Admin** and **Cashier** staff can access the printer setup screen.
- [ ] **LAN Station Condition**: Conditionally require and show `stationId` input when `printerType === "Lan"` and `printerUseFor === "Station"`.
- [ ] **Default Thermal Port**: Pre-fill `printerPort` with `"9100"` as default for LAN thermal printers.
- [ ] **Role Uniqueness Warning**: Catch `"Hey! <role> printer is already taken."` errors and show clear UI feedback.
- [ ] **Printer Status List**: Connect `api.organizationPrinters.list` to display active hardware status in POS billing counters.
