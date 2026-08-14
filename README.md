# Convex Multi-Project Company Provisioning & Administrative Cleanup System

A proof-of-concept SaaS architecture where **each company/customer receives its own completely separate Convex project and database**.

This is **NOT** a multi-tenant database architecture. There is no `companies` table or `companyId` inside the Todo database. Each company's Convex project is its own isolated control-plane and data boundary.

---

## 🏗️ Architecture Overview

```text
                               CONVEX TEAM
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
       ▼                           ▼                           ▼
 MASTER APP                   DEFAULT APP                  COMPANY 1
 Project (`convex-master-app`) Project (`convex-company-todos`) Project (`company-1`)
       │                           │                           │
  stores company               boilerplate                 ┌───┴───┐
  metadata & status            template app                │ todos │
       │                                                   └───────┘
       ├───────────────────────────────────────────────→ COMPANY 2
       │                                                 Project (`company-2`)
       │                                                   │
       │                                                 ┌───┴───┐
       │                                                 │ todos │
       │                                                 └───────┘
       ├───────────────────────────────────────────────→ COMPANY 3
       │                                                 Project (`company-3`)
       │                                                   │
       │                                                 ┌───┴───┐
       │                                                 │ todos │
       │                                                 └───────┘
       └───────────────────────────────────────────────→ COMPANY N
                                                         Project (`company-N`)
                                                           │
                                                         ┌───┴───┐
                                                         │ todos │
                                                         └───────┘
```

---

## 📦 System Components

### 1. Default App (`/Default app`)
- **Role**: Boilerplate / template application containing standard features (Todo management).
- **Backend (`convex/`)**:
  - `schema.ts`: Clean Todo schema (`todos` table with `title: string` and `completed: boolean`).
  - `todos.ts`: Queries and mutations (`create`, `list`, `toggle`).
- **Frontend (`app/`)**:
  - Standalone Next.js UI for creating, viewing, and toggling todos.
  - `ConvexClientProvider.tsx`: Reads optional `convexUrl` search parameter from the URL query string (`?convexUrl=https://...`), enabling dynamic connection to any provisioned company's Convex deployment.

### 2. Master App (`/Master app`)
- **Role**: Control plane / management dashboard.
- **Backend (`convex/`)**:
  - `schema.ts`: `companies` table storing metadata (`name`, `slug`, `projectId`, `deploymentId`, `deploymentUrl`, `status`, `errorMessage`, `createdAt`).
  - `companies.ts`: Control plane mutations and queries (`create`, `list`, `get`, `getBySlug`, `updateStatus`, `remove`).
- **Server API Routes**:
  - `POST /api/companies/provision`: Automated project provisioning using the Convex Management API.
  - `POST /api/companies/reconcile`: Automated reconciliation service that detects orphaned Convex projects (when an admin manually deletes a company record in the Convex Dashboard) and safely deletes the corresponding Convex project via the Management API.
- **Frontend (`app/page.tsx`)**:
  - Clean UI displaying provisioned companies, status badges, and **"Open Application →"** links.
  - **NO Delete Buttons**: All administrative company deletions are performed by the administrator in the Convex Dashboard data view.

---

## ⚡ How Provisioning & Administrative Cleanup Work

### 1. Provisioning a Company (Master App UI)
```text
Master App Frontend
       │
       ▼
POST /api/companies/provision
       │
       ├── 1. Insert record in Master DB (status: "provisioning")
       ├── 2. Convex Management API: POST /v1/teams/{team_id}/create_project
       ├── 3. Convex Management API: POST /v1/deployments/{deployment}/create_deploy_key
       ├── 4. Execute `npx convex dev --once` with CONVEX_DEPLOY_KEY to push Default App code
       └── 5. Update Master DB record (status: "active", projectId, deploymentUrl)
```

### 2. Administrative Deletion & Reconciliation Workflow
```text
Database Administrator (Convex Dashboard Data View)
       │
       ▼
Manually deletes Company document from `companies` table
       │
       ▼
Company record no longer exists in Master DB
       │
       ▼
Reconciliation Service (`/api/companies/reconcile`)
       ├── 1. Query active Master DB company project IDs
       ├── 2. Query team projects via Management API (`GET /v1/teams/{team_id}/projects`)
       ├── 3. Filter protected infrastructure projects (`convex-master-app`, `convex-company-todos`)
       ├── 4. Detect orphaned company project (project exists on team but NOT in Master DB)
       └── 5. Convex Management API: POST /v1/projects/{orphaned_project_id}/delete
```

---

## 🖥️ Master App UI Specification

The Master App frontend provides a clean control-plane interface without any delete buttons:

```text
Provision New Company
[ Company name                ] [ Provision Company ]

Provisioned Companies & Databases

Company       Status       Convex Deployment       Actions
------------------------------------------------------------
Company 6     ACTIVE       hidden-caterpillar-664  [Open Application →]
Company 2     ACTIVE       lovely-possum-160        [Open Application →]
Company 1     ACTIVE       beaming-egret-564        [Open Application →]
```

---

## 🚀 Running the System Locally

### Prerequisites
- Node.js (v18+)
- Convex CLI authenticated (`npx convex login`)

### Running Default App & Master App

1. **Default App** (runs on port 3000):
   ```bash
   cd "Default app"
   npm run dev -- -p 3000
   ```

2. **Master App** (runs on port 3001):
   ```bash
   cd "Master app"
   npm run dev -- -p 3001
   ```

3. Open **Master App Dashboard** in your browser:
   `http://localhost:3001`

---

## 🧪 Testing Provisioning & Manual Administrative Deletion

1. Open **Master App Dashboard** (`http://localhost:3001`), enter `Company X`, and click **Provision Company**.
2. Click **Open Application →** next to `Company X` and create a todo item.
3. Open the **Convex Dashboard** for `convex-master-app`, navigate to the `companies` table data view, and delete the document for `Company X`.
4. The system reconciliation service automatically detects that `Company X` document is deleted, identifies the orphaned project on Convex, and deletes the actual `company-x` Convex project via the Management API.
5. Other company projects (`Company 1`, `Company 2`, etc.) and infrastructure projects (`convex-master-app`, `convex-company-todos`) remain 100% untouched.
