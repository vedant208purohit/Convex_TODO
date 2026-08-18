# POS Master App — Control Plane

Repository: `https://github.com/joshidhruv/pos-master.git`

The **Master App** is the central control-plane and administrative console for the DEFx-POS multi-project architecture.

---

## 1. Responsibilities & Separation of Concerns

The Master App is strictly responsible for control plane operations:
- **Organization Registry**: Central database registry of all stores/organizations, their deployment status, and metadata.
- **Convex Project Provisioning**: Automated provisioning of dedicated Convex projects and deployments using the Convex Management API (`https://api.convex.dev/v1`).
- **POS Template Deployment**: Automated initialization of new store projects with the `pos-default` schema and functions using server-side deploy keys.
- **Reconciliation & Health**: Identification and cleanup of orphaned deployments.
- **Store POS Redirection**: Secure routing and launch links to individual Store POS applications with dynamic Convex URLs.

### What the Master App MUST NOT Contain:
- Store POS transactional or business tables (menus, orders, inventory, tables, payments).
- Multi-tenant shared database tables.
- PostgreSQL or Rails runtime dependencies.

---

## 2. Responsibilities Matrix

| Feature / Responsibility | POS Master (`pos-master`) | POS Default (`pos-default`) | Organization Store Project |
| :--- | :---: | :---: | :---: |
| Control Plane Dashboard | ✅ | ❌ | ❌ |
| Organization Registry | ✅ | ❌ | ❌ |
| Convex Project Provisioning | ✅ | ❌ | ❌ |
| Management API Credentials | ✅ (Server-only) | ❌ | ❌ |
| Reconciliation & Cleanup | ✅ | ❌ | ❌ |
| POS UI & Components | ❌ | ✅ | ✅ (Runtime) |
| Store Organization Domain | ❌ | ✅ | ✅ (Runtime) |
| POS Business Logic & Queries | ❌ | ✅ | ✅ (Runtime) |
| Store Database / Data Isolation | ❌ | ❌ | ✅ (Dedicated DB) |

---

## 3. Architecture Model

```
                           CONVEX TEAM / CONTROL PLANE
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
             POS MASTER APP                        POS DEFAULT APP
         (pos-master repository)               (pos-default repository)
              Control Plane                          POS Template
                    │                                     │
                    ▼ (Management API)                    ▼ (Deployed to each store)
     ┌──────────────────────────────┬──────────────────────────────┐
     ▼                              ▼                              ▼
 Store 1 Project                Store 2 Project                Store N Project
 (Dedicated Database)           (Dedicated Database)           (Dedicated Database)
```

**Core Invariant**: `ONE ORGANIZATION = ONE CONVEX PROJECT = ONE DATABASE`

---

## 4. Environment Variables

Create `.env.local` based on `.env.example`:

```env
# Convex Deployment URL for Master App Control Plane
NEXT_PUBLIC_CONVEX_URL=https://your-master-app.convex.cloud

# Convex Management API Key (Server-side only — never exposed to client)
CONVEX_MANAGEMENT_API_KEY=convex_mgt_...

# Convex Team ID for dynamic project provisioning
CONVEX_TEAM_ID=team_...

# Path to Default App template directory (defaults to ../Default app or ../pos-default)
DEFAULT_APP_PATH=../pos-default

# Default App Frontend Base URL for "Open Store POS" navigation
NEXT_PUBLIC_DEFAULT_APP_URL=http://localhost:3000
```

---

## 5. Local Development

```bash
# Install dependencies
npm install

# Run Convex dev for Master App
npx convex dev

# Run Next.js server on port 3001
npm run dev -- -p 3001
```

