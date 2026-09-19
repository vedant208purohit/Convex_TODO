# Settings: Digital Store & Brand Media Frontend Functional Specification

## 1. Executive Summary & Domain Scope

The **Digital Store & Brand Media Subsystem** in DEFx-POS manages the public branding, rich media, and compliance presence of a restaurant's digital web storefront. While the *Online Store* setting manages transactional channels and logistics, the **Digital Store** configures the brand identity, visual storytelling, and legal trust elements that customers see when visiting the store's web domain or mobile web app.

This specification covers:
1. **Master Digital Store Visibility**: `digitalStoreStatus` switch controlling storefront accessibility.
2. **Hero Carousels & Brand Story Gallery**: Multi-image management via `digitalStoreImages` (classified into `carousel_image` and `about_us_image` with Cloudflare R2 asset binding).
3. **Brand Story & "About Us" Narrative**: Rich bio copy (`aboutUsContent`) and flagship brand showcase image (`aboutUsImageStorageId` / `aboutUsImageUrl`).
4. **Social Community Channels**: Direct links to Instagram and Facebook profiles.
5. **Legal & Consumer Compliance Links**: Privacy policy (`policyLink`), refund terms (`refundLink`), and service agreements (`termAndConditionLink`).

---

## 2. System Architecture & Image Classification

```
+-----------------------------------------------------------------------------------+
|                        Digital Store Settings Management                          |
+-----------------------------------------------------------------------------------+
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
+──────────────────────────+ +──────────────────────────+ +──────────────────────────+
|  Brand Story & Identity  | | Storefront Visual Media  | | Social & Legal Policies  |
|  `digitalStoreStatus`    | | `digitalStoreImages`     | | `facebookAccountLink`    |
|  `aboutUsContent`        | | 1. `carousel_image`      | | `instagramAccountLink`   |
|  `aboutUsImageUrl`       | | 2. `about_us_image`      | | `policyLink`, `refundLink|
+──────────────────────────+ +──────────────────────────+ +──────────────────────────+
                                         │
                                         ▼ (Cloudflare R2 Asset Pipeline)
                             +──────────────────────────+
                             |   `organization_assets`  |
                             |   (R2 Presigned Upload)  |
                             +──────────────────────────+
                                         │
                                         ▼
                             +──────────────────────────+
                             |  Live Customer Web View  |
                             |  `{FRONT_END_URL}/store` |
                             +──────────────────────────+
```

---

## 3. Database Schema & Data Models

### 3.1 Organization Digital Store Metadata (`organizations`)

| Field | Type | Description | Example / Notes |
|---|---|---|---|
| `digitalStoreStatus` | `boolean` | Master toggle enabling the public digital storefront. | `true` |
| `aboutUsContent` | `string` | Long-form markdown/plain text brand story and chef bio. | `"Founded in 2018, Bistro Royale blends authentic wood-fired pizzas with artisanal brews..."` |
| `aboutUsImageStorageId` | `Id<"_storage">` | Internal storage blob reference for flagship About Us image. | `"kg27...110"` |
| `aboutUsImageUrl` | `string` | Resolved public CDN URL for the About Us flagship photo. | `"https://cdn.store.com/about_cover.webp"` |
| `facebookAccountLink` | `string` | Full Facebook Page URL. | `"https://facebook.com/bistroroyale"` |
| `instagramAccountLink` | `string` | Full Instagram Profile URL. | `"https://instagram.com/bistroroyale"` |
| `policyLink` | `string` | HTTPS URL to Privacy Policy document. | `"https://bistroroyale.com/privacy"` |
| `refundLink` | `string` | HTTPS URL to Refund & Cancellation Policy. | `"https://bistroroyale.com/refund"` |
| `termAndConditionLink` | `string` | HTTPS URL to Terms & Conditions. | `"https://bistroroyale.com/terms"` |

### 3.2 Digital Storefront Media (`digitalStoreImages`)

| Field | Type | Description |
|---|---|---|
| `_id` | `Id<"digitalStoreImages">` | Primary key. |
| `assetId` | `Id<"organization_assets">` | Foreign key referencing verified Cloudflare R2 image asset. |
| `imageType` | `union("carousel_image", "about_us_image")` | Scope classification (Hero Banner vs Brand Story Gallery). |
| `position` | `number` | 1-indexed sequential display order within the specific `imageType`. |
| `legacyId` | `string` | Migrated PostgreSQL UUID from `ssr_images`. |
| `createdAt` | `number` | Creation timestamp. |
| `updatedAt` | `number` | Last modified timestamp. |
| `deletedAt` | `number` | Soft-deletion timestamp. |

---

## 4. Business Logic & Asset Ingestion Pipeline

### 4.1 Cloudflare R2 Upload Flow for Storefront Images
1. **Presigned Upload Request**: Frontend calls `r2.createAssetUpload` providing `fileName`, `contentType`, and `fileSize`.
2. **Direct Client Upload**: Browser directly PUTs binary file data to Cloudflare R2.
3. **Upload Confirmation**: Frontend calls `r2.confirmAssetUpload` which marks asset status as `"uploaded"`.
4. **Storefront Linkage**: Frontend invokes `digitalStoreImages.createDigitalStoreImage({ assetId, imageType })`.
5. **Sequential Positioning**:
   - The backend auto-calculates `max(position) + 1` scoped strictly to that `imageType`.
   - Reordering via `updateImagePosition` or `reorderImages` automatically shifts siblings with zero gaps.

### 4.2 Image Type Differences
* **`carousel_image`**: Displayed as wide hero banners (`21:9` or `16:9` ratio) at the top of `{FRONT_END_URL}/store` to highlight chef specials, discounts, and festive combos.
* **`about_us_image`**: Displayed in the "Our Story / Brand Heritage" section as a curated masonry/grid gallery showcasing kitchen craft and farm-to-table ingredients.

---

## 5. API & Convex Mutation Specifications

```typescript
// 1. Fetch Public Storefront Images
const heroSlides = useQuery(api.digitalStoreImages.listStorefrontImages, {
  imageType: "carousel_image",
});
const aboutGallery = useQuery(api.digitalStoreImages.listStorefrontImages, {
  imageType: "about_us_image",
});

// 2. Add New Storefront Image (Admin)
await createDigitalStoreImage({
  assetId: confirmedAssetId,
  imageType: "carousel_image",
});

// 3. Reorder Images within Type
await reorderImages({
  imageType: "carousel_image",
  imageIds: [id3, id1, id2],
});

// 4. Update Digital Store Narrative & Links (Admin)
await updateOrg({
  digitalStoreStatus: true,
  aboutUsContent: "Our culinary story...",
  facebookAccountLink: "https://facebook.com/myrestaurant",
  instagramAccountLink: "https://instagram.com/myrestaurant",
  policyLink: "https://myrestaurant.com/privacy",
  refundLink: "https://myrestaurant.com/refunds",
  termAndConditionLink: "https://myrestaurant.com/terms",
});
```

---

## 6. Frontend UI/UX Specifications

```
+-----------------------------------------------------------------------------------+
|  SETTINGS > DIGITAL STORE & BRAND MEDIA                                           |
+-----------------------------------------------------------------------------------+
|  Manage public web branding, hero carousels, brand story, and legal policies.     |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  1. DIGITAL STORE VISIBILITY                                                      |
|  ───────────────────────────────────────────────────────────────────────────────  |
|  [  ON  ]  Publish Digital Storefront to Web Visitors                             |
|                                                                                   |
|  2. HERO BANNER CAROUSELS (`carousel_image`)                                      |
|  ───────────────────────────────────────────────────────────────────────────────  |
|  High-resolution promotional banners displayed on the storefront homepage.        |
|  [ + Upload Banner (1920x800) ]                                                   |
|                                                                                   |
|  +---------------------------+  +---------------------------+                     |
|  | [ Banner Image 1 ]        |  | [ Banner Image 2 ]        |                     |
|  | Pos: [ 1 ▼ ]  [ 🗑️ Delete ]|  | Pos: [ 2 ▼ ]  [ 🗑️ Delete ]|                     |
|  +---------------------------+  +---------------------------+                     |
|                                                                                   |
|  3. BRAND STORY & "ABOUT US"                                                      |
|  ───────────────────────────────────────────────────────────────────────────────  |
|  About Us Narrative:                                                              |
|  +-----------------------------------------------------------------------------+  |
|  | Founded in 2018, Bistro Royale combines rustic wood-fired cooking with      |  |
|  | fresh organic produce sourced directly from local valley farms...           |  |
|  +-----------------------------------------------------------------------------+  |
|  Flagship Cover Image: [ Upload Flagship Photo ] (Current: cover_photo.webp)       |
|                                                                                   |
|  Story Gallery (`about_us_image`):                                                |
|  [ + Add Gallery Photo ]                                                          |
|  [ Photo 1: Kitchen Prep ]   [ Photo 2: Organic Farm ]   [ Photo 3: Dining Patio ] |
|                                                                                   |
|  4. SOCIAL MEDIA COMMUNITY LINKS                                                  |
|  ───────────────────────────────────────────────────────────────────────────────  |
|  Instagram Profile: [ https://instagram.com/bistroroyale                        ] |
|  Facebook Page:     [ https://facebook.com/bistroroyale                         ] |
|                                                                                   |
|  5. LEGAL & COMPLIANCE URLS                                                       |
|  ───────────────────────────────────────────────────────────────────────────────  |
|  Privacy Policy URL:    [ https://bistroroyale.com/privacy                      ] |
|  Refund Policy URL:     [ https://bistroroyale.com/refund                       ] |
|  Terms & Conditions URL:[ https://bistroroyale.com/terms                        ] |
+-----------------------------------------------------------------------------------+
|  [ Discard ]                                               [ SAVE BRAND SETTINGS ]|
+-----------------------------------------------------------------------------------+
```

---

## 7. Implementation Checklist for Frontend Engineers

- [ ] **Master Status Switch**: Connect `digitalStoreStatus` toggle with live publishing state.
- [ ] **Hero Banner Media Gallery**: Build drag-and-drop sortable thumbnail cards for `carousel_image`.
- [ ] **About Us Rich Text & Gallery**: Textarea/Markdown input for `aboutUsContent` and grid manager for `about_us_image`.
- [ ] **R2 Presigned Upload Component**: Reusable file picker supporting drag-and-drop, progress bar, and R2 asset confirmation.
- [ ] **Social & Compliance Links Form**: Input validation ensuring valid `https://` URLs for Instagram, Facebook, and policy links.
