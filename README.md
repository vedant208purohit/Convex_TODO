# POS Default App — Store Template

Repository: `https://github.com/joshidhruv/pos-default.git`

The **Default App** is the standard, reusable POS application template deployed into each organization's dedicated Convex project.

---

## 1. Responsibilities & Separation of Concerns

The Default App contains the store-level POS functionality:
- **POS Frontend**: Store administration and operational interface.
- **Organization Domain Schema**: Complete idiomatic Convex schema for store identity, operational feature toggles, payment methods, delivery rules, and third-party integration settings.
- **Store Queries & Mutations**: Idiomatic Convex handlers for managing store settings.
- **Dynamic Deployment Connection**: Dynamic runtime binding via `ConvexClientProvider` to any provisioned Store Convex deployment passed via `?convexUrl=...`.

### What the Default App MUST NOT Contain:
- Master App control-plane or cross-organization registry tables.
- Convex Management API credentials or project provisioning logic.
- Master Clerk authentication logic.
- `companyId` / `tenantId` columns for multi-tenant database partitioning.

---

## 2. Dynamic Convex Connection Model

The Default App frontend connects dynamically to any organization's store deployment:

```
Browser opens: http://localhost:3000?convexUrl=https://store-xyz.convex.cloud
                                    │
                                    ▼
                     ConvexClientProvider reads query param
                                    │
                                    ▼
                Binds ConvexReactClient to store-xyz deployment
```

If no `convexUrl` parameter is supplied, it falls back to `process.env.NEXT_PUBLIC_CONVEX_URL`.

---

## 3. Organization Domain (Phase 1)

The store schema (`convex/schema.ts`) supports all Phase 1 PostgreSQL Organization fields:
- **Legacy Identity**: `legacyId` (original PostgreSQL UUID)
- **Store Identity**: `name`, `slug`, `legalEntityName`, `published`, `isTest`, `isVeg`
- **POS Feature Flags**: `isDineIn`, `isTakeAway`, `isDashboard`, `isInventory`, `isOrders`, `isWorkstation`, `isCashier`, `isSettings`, `onlineStore`, `isDelivery`, `isMenu`, `isQueue`, `isKds`, `isSurveys`, `isCustomer`, `isCaptain`, `isReport`
- **Payment Modes**: Dine-in (prepaid/postpaid), Take-away (cash/online), Delivery (cash/online), Scheduled pickup/delivery, splitting configurations
- **Delivery Config**: Aggregator integration, delivery partner, lag times
- **Integrations**: Frenchy, Chargebee, WhatsApp

---

## 4. Environment Variables

Create `.env.local` based on `.env.example`:

```env
# Fallback Store Convex Deployment URL
NEXT_PUBLIC_CONVEX_URL=https://your-store-deployment.convex.cloud
```

---

## 5. Local Development

```bash
# Install dependencies
npm install

# Run Convex dev for local store development
npx convex dev

# Run Next.js server on port 3000
npm run dev -- -p 3000
```

