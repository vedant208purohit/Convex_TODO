# Organization Live Screen & Digital Signage Frontend Functional Specification

## 1. Executive Summary & Domain Scope

The **Live Screen & Digital Signage Subsystem** in `pos-default` (`/settings?tab=liveScreens` and `/live/[slug]`) enables restaurant operators to turn commercial Smart TVs, Android TV boxes, Fire Sticks, and digital signage kiosks into automated, real-time customer-facing display terminals.

It powers two core operational functions:
1. **Promotional Carousel & Marketing Signage**: High-impact cycling of high-definition promotional banners, seasonal combo graphics, happy hour specials, and chef recommendation media.
2. **Live Order Readiness & Token Callout Board**: An integrated "Now Serving" split-screen display that notifies dining room guests and delivery drivers when orders transition from "In Kitchen" to "Ready for Pickup".

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                              POS Admin & Media Management Console                                 │
│                     (/settings?tab=liveScreens in pos-default POS terminal)                       │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
                                                  ▼
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                               Convex Cloud Media & Asset Engine                                   │
│              (Image upload, _storage, acts_as_list reordering, bot token authentication)          │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
         ┌────────────────────────────────────────┼────────────────────────────────────────┐
         ▼                                        ▼                                        ▼
+──────────────────────────+             +──────────────────────────+             +──────────────────────────+
│  FULLSCREEN CAROUSEL TV  │             │   SPLIT TOKEN CALLOUT    │             │   DIGITAL MENU BOARD     │
│  • 16:9 4K Promotions    │             │  • 65% Promo Carousel    │             │  • Live Category Menus   │
│  • Smooth Cross-Fade     │             │  • 35% "Now Serving"     │             │  • Auto-86'd Sold Out    │
│  • 5s–15s Dwell Timers   │             │  • Token Ready Alerts    │             │  • Dynamic Daily Pricing │
+──────────────────────────+             +──────────────────────────+             +──────────────────────────+
```

---

## 2. Hardware Pairing & Device Authentication (`organizationBotTokens`)

Public TV screens and wall-mounted Android displays operate in unstaffed environments where entering employee email/passwords is impractical. The system uses secure, hardware-paired **Bot Tokens**:

### 2.1 TV Device Pairing Flow

```
   [ Mount Smart TV / Open TV Browser to app.get-prest.com/pair ]
                                  │
                                  ▼
                   [ TV Displays 6-Digit Pairing Code ]
                                  │
                                  ▼
         [ Store Admin Enters 6-Digit Code in POS Settings ]
                                  │
                                  ▼
         [ Mutation: organizationBotTokens.pairTvDevice ]
                                  │
                                  ▼
       [ TV Receives Long-Lived Bot Token (Secure UUID) ]
                                  │
                                  ▼
    [ TV Automatically Launches Live Screen Display without Login ]
```

### 2.2 Bot Token RBAC & Security Isolation
* **Token Identity**: Linked to an isolated system bot user (`userType: ["bot"]`) within `organizationUsers`.
* **Read-Only Scoping**: Bot tokens have strict read-only access restricted solely to public carousel assets (`organizationCarouselScreens`) and order token numbers (`orders.tokenNumber`). They cannot access customer PII, financial ledgers, or sales reports.
* **Instant Revocation**: Store owners can view all connected TV devices in Settings and revoke any lost or decommissioned screen with 1 click.

---

## 3. Data Models & Convex Schema Definitions

The Live Screen domain is backed by `organizationCarouselScreens` and `organizationBotTokens`:

### 3.1 Table: `organizationCarouselScreens`

| Field | Type | Required | Description | Constraints & Indexing |
|---|---|---|---|---|
| `_id` | `Id<"organizationCarouselScreens">` | Yes | Primary document ID. | Primary Key. |
| `organizationId` | `Id<"organizations">` | Yes | Store reference ID. | `.index("by_org", ["organizationId"])` |
| `position` | `number` | Yes | Sequential slide position index (1-indexed). | `.index("by_position", ["position"])` |
| `storageId` | `Id<"_storage">` | Optional | Convex binary storage ID. | Stores original image/video file. |
| `assetId` | `Id<"organization_assets">` | Optional | Central organization asset reference. | Shared media asset reference. |
| `imageUrl` | `string` | Optional | CDN optimized public URL. | Serves high-speed WebP/PNG assets. |
| `fileName` | `string` | Optional | Original uploaded file name. | e.g. `"summer_combo_banner_1080p.png"`. |
| `legacyId` | `string` | Optional | Rails legacy UUID. | `.index("by_legacy_id", ["legacyId"])` |
| `createdAt` | `number` | Yes | Creation timestamp (ms). | Immutable. |
| `updatedAt` | `number` | Yes | Modification timestamp (ms). | Maintained on reordering. |
| `deletedAt` | `number` | Optional | Soft deletion timestamp (ms). | Active slide when `undefined`. |

### 3.2 Table: `organizationBotTokens`

| Field | Type | Required | Description | Constraints & Indexing |
|---|---|---|---|---|
| `_id` | `Id<"organizationBotTokens">` | Yes | Primary document ID. | Primary Key. |
| `organizationId` | `Id<"organizations">` | Yes | Store reference ID. | `.index("by_org", ["organizationId"])` |
| `token` | `string` | Yes | Cryptographic device UUID string. | Unique index. |
| `deviceName` | `string` | Optional | User-friendly TV label. | e.g. `"Dining Hall 65-inch LG TV"`. |
| `env` | `string` | Optional | Environment tag. | `"production"`, `"staging"`. |
| `userId` | `string` | Yes | Bound bot user ID. | References guest bot user. |
| `lastSeenAt` | `number` | Optional | Heartbeat timestamp from TV. | Used to show Online/Offline status. |
| `createdAt` | `number` | Yes | Creation timestamp (ms). | Immutable. |
| `deletedAt` | `number` | Optional | Soft deletion timestamp (ms). | Active token when `undefined`. |

---

## 4. Screen 1: Admin Live Screen Configuration (`/settings?tab=liveScreens`)

```
+-----------------------------------------------------------------------------------------------------------------------+
|  ⚙️ Settings > Live Screens & Digital Signage                                           [ ➕ Upload New Slide ]         |
|  Manage promotional carousel slides, display transition intervals, and paired TV displays.                           |
+-----------------------------------------------------------------------------------------------------------------------+
|  📊 TOTAL SLIDES         |  ⏱️ SLIDE INTERVAL       |  📺 PAIRED TV SCREENS     |  🎨 DISPLAY MODE                    |
|     6 Active Slides      |     8 Seconds / slide    |     2 Connected (Online)  |     Split Promo + Ready Tokens      |
+-----------------------------------------------------------------------------------------------------------------------+
|  CAROUSEL SLIDES (DRAG & DROP TO REORDER)                                                                             |
|                                                                                                                       |
|  [ ☰ 1 ] ┌─────────────┐   [ ☰ 2 ] ┌─────────────┐   [ ☰ 3 ] ┌─────────────┐   [ ☰ 4 ] ┌─────────────┐                |
|          │ [Banner 1]  │           │ [Banner 2]  │           │ [Banner 3]  │           │ [Banner 4]  │                |
|          │ Happy Hour  │           │ Weekend BBQ │           │ Biryani Fest│           │ Desserts 20%│                |
|          └─────────────┘           └─────────────┘           └─────────────┘           └─────────────┘                |
|          [ 👁️ ] [ 🗑️ ]             [ 👁️ ] [ 🗑️ ]             [ 👁️ ] [ 🗑️ ]             [ 👁️ ] [ 🗑️ ]                 |
+-----------------------------------------------------------------------------------------------------------------------+
|  📺 PAIRED TV DEVICES                                                                  [ ➕ Pair New TV Screen ]       |
|  • Dining Room 65" Sony 4K (Token: ...8f92)  ─── 🟢 Online (Active 2s ago)              [ 🔄 Refresh ] [ 🚫 Unpair ]   |
|  • Counter Pickup Samsung TV (Token: ...1a4b) ─── 🟢 Online (Active 5s ago)              [ 🔄 Refresh ] [ 🚫 Unpair ]   |
+-----------------------------------------------------------------------------------------------------------------------+
```

### 4.1 Interactive Administrative Features
1. **Drag-and-Drop Positional Reordering**:
   - Intuitive drag handles (`☰`) allowing staff to drag slide tiles into new positions.
   - Employs `acts_as_list` sequential shifting: dragging Slide 4 to Position 1 automatically shifts Slides 1, 2, and 3 down to Positions 2, 3, and 4.
2. **Slide Media Uploader**:
   - Supports 16:9 landscape aspect ratio (recommended $1920 \times 1080$ or $3840 \times 2160$) and 9:16 vertical kiosk format.
   - Built-in client-side image compression (converting large camera photos to high-performance WebP before upload).
3. **Slide Interval Selector**:
   - Global dwell time dropdown: `5 Seconds`, `8 Seconds (Recommended)`, `10 Seconds`, `15 Seconds`, `20 Seconds`.

---

## 5. Screen 2: Public TV Player Display (`/live/[slug]`)

The public TV screen player is a lightweight, zero-overhead Web app designed to run 24/7 on low-power TV web browsers (Tizen OS, webOS, Android TV, Fire TV Silk Browser):

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                  PUBLIC TV SPLIT-SCREEN VIEW                                      │
+──────────────────────────────────────────────────┬────────────────────────────────────────────────+
│                                                  │  📢 NOW SERVING / ORDER STATUS                 │
│                                                  │                                                │
│                                                  │  🟢 READY FOR PICKUP                           │
│              PROMOTIONAL CAROUSEL                │  ┌──────────────┐   ┌──────────────┐           │
│                   (65% Width)                    │  │   TOKEN #12  │   │   TOKEN #14  │           │
│                                                  │  │  Table T-04  │   │  Takeaway    │           │
│           [ High-Definition Food Photo ]         │  └──────────────┘   └──────────────┘           │
│                                                  │  ┌──────────────┐   ┌──────────────┐           │
│              "Special Weekend Combo              │  │   TOKEN #15  │   │   TOKEN #18  │           │
│             Tandoori Platter @ ₹499"             │  │  Delivery    │   │  Table T-09  │           │
│                                                  │  └──────────────┘   └──────────────┘           │
│                                                  │                                                │
│                                                  │  🟡 PREPARING IN KITCHEN                       │
│                                                  │  Token #19, #20, #21, #22, #24                 │
+──────────────────────────────────────────────────┴────────────────────────────────────────────────+
│ 🕒 08:45 PM  •  Welcome to Spice Garden Bistro! Please collect your order when token is called.    │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

### 5.1 TV Player Technical Capabilities
1. **Zero-Lag Reactive Refresh**:
   - Subscribes reactively to Convex queries (`organizationCarouselScreens` and `orders`).
   - When the cashier marks an order ready in POS or the admin uploads a new slide, the TV updates instantly via WebSocket without page reloads.
2. **Smooth GPU Cross-Fade Transitions**:
   - CSS hardware-accelerated opacity cross-fades ($600\text{ms}$ cubic-bezier) prevent jarring black flashes between slide rotations.
3. **Sound Bell for Ready Tokens**:
   - Optional audio chime triggers on the TV speakers when a new token moves into the **"Ready for Pickup"** section.
4. **Offline Resilience & Asset Caching**:
   - Uses browser Cache Storage / ServiceWorker to cache all active slide image bitmaps locally. If the restaurant Wi-Fi drops momentarily, the TV continues cycling existing slides uninterrupted.

---

## 6. Convex API Backend Contracts

### 6.1 Carousel Screen Endpoints (`convex/carouselScreens.ts`)

#### 1. `carouselScreens.list`
* **Type**: `query` (Staff Access Required)
* **Args**: `{ organizationId?: Id<"organizations"> }`
* **Response**: `Array<Doc<"organizationCarouselScreens">>` (Sorted strictly by `position: asc`).

#### 2. `carouselScreens.create`
* **Type**: `mutation`
* **Args**:
  ```typescript
  {
    organizationId?: Id<"organizations">,
    storageId: Id<"_storage">,
    imageUrl?: string,
    fileName?: string,
    position?: number
  }
  ```
* **Business Rule**: If `position` is omitted, automatically assigns `position = max(existing) + 1`.
* **Response**: `Id<"organizationCarouselScreens">`

#### 3. `carouselScreens.reorder`
* **Type**: `mutation`
* **Args**:
  ```typescript
  {
    screenId: Id<"organizationCarouselScreens">,
    newPosition: number
  }
  ```
* **Business Rule**: Implements `acts_as_list` logic. Shifts intermediate slide positions up or down atomically.
* **Response**: `{ success: true }`

#### 4. `carouselScreens.remove`
* **Type**: `mutation`
* **Args**: `{ screenId: Id<"organizationCarouselScreens"> }`
* **Response**: `{ success: true }`
* **Description**: Soft deletes the slide and compacts remaining positions ($1, 2, 3...$).

---

### 6.2 Public TV Player Queries (`convex/liveScreens.ts`)

#### 1. `liveScreens.getPublicDisplayState`
* **Type**: `query` (Public Unauthenticated / Bot Token Auth)
* **Args**:
  ```typescript
  {
    slug?: string,
    botToken?: string
  }
  ```
* **Response**:
  ```typescript
  {
    storeName: string,
    displayMode: "carousel_only" | "split_tokens" | "menu_board",
    slideIntervalSeconds: number,
    slides: Array<{
      _id: string,
      position: number,
      imageUrl: string,
    }>,
    readyTokens: Array<{
      orderId: string,
      tokenNumber: string,
      orderType: string,
      tableNumber?: string,
    }>,
    preparingTokens: Array<string>,
  }
  ```

---

## 7. Frontend Component Hierarchy

```
pos-default/app/
├── live/
│   └── [slug]/page.tsx                        // Public TV Display Player Kiosk Container
├── settings/
│   └── page.tsx                               // POS Admin Settings ("liveScreens" tab)
└── components/
    ├── OrganizationLiveScreens.tsx            // Admin Live Screens Manager Component
    ├── CarouselSlideGrid.tsx                  // Drag-and-drop sortable slide canvas
    ├── CarouselSlideUploader.tsx              // Image dropzone with aspect ratio guide
    ├── TvPairingModal.tsx                     // 6-digit code TV pairing dialog
    ├── PairedDevicesList.tsx                  // List of active connected TV screens
    ├── TvCarouselPlayer.tsx                   // Hardware-accelerated fullscreen slide cycler
    └── TvOrderTokenBoard.tsx                  // "Now Serving" live ready token grid
```

---

## 8. Quality Assurance & Sign-off Checklist

- [x] **Sequential Slide Ordering**: Strict adherence to `acts_as_list` positional indexes without numbering gaps.
- [x] **Secure TV Bot Authentication**: Device-based pairing without exposing employee accounts on public TVs.
- [x] **Split-Screen Token Callout**: Live sync with kitchen prep stages for instant "Now Serving" updates.
- [x] **Zero-Reload Reactive Playback**: Smooth transitions and instant asset updating via WebSocket.
- [x] **Hardware Kiosk Support**: Fullscreen landscape and portrait compatibility for commercial displays.
