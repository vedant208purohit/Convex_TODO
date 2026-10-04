# 🎫 DEVELOPER TICKET & AI PROMPT: Multi-Store & Multi-Table QR Telemetry Integration

> **Target Application**: Customer Digital Storefront  
> **Backend Service**: Convex (`organizationQrCustomerJourney.ts`, `organizationQrCodes.ts`)  
> **Priority**: High (P1)  
> **Audience**: Storefront Developer / Antigravity AI Agent  

---

## 📌 Executive Summary & Architectural Overview

### System Architecture:
1. **POS Backend**: Manages store configurations, dining tables, QR code generation, and analytics dashboards powered by **Convex**.
2. **Customer Digital Storefront**: Public customer-facing Next.js/React web application where customers scan QR codes to view menus, add items to cart, and place orders.

### The Problem Being Solved:
Historically, QR codes only opened a generic store menu without recording rich customer telemetry (device type, operating system, IP location, GPS, browser), scan conversion funnel (Scan ➔ Cart ➔ Order Placed), or session dwell time per table and per store location.

### The Solution:
Every generated QR code (Dine-In, Takeaway, Delivery, Scheduled Pickup) now includes `store` and `qr_id` parameters in the URL:
```text
https://dev-pos-user.get-prest.com/store?store=<STORE_SLUG>&qr_id=<CONVEX_QR_DOC_ID>&type=<QR_TYPE>&table=<TABLE_NAME>
```

When a customer opens this URL, the storefront calls the Convex mutation `api.organizationQrCustomerJourney.recordScan` with device telemetry. Convex automatically maps the `qr_id` to its specific store (`organizationId`) and table (`tableId`), tracks scan counts, creates an ordering session, and attributes cart/revenue analytics in real-time to the POS dashboard.

---

## 🌐 Dynamic QR URL Format Matrix

| Fulfillment Mode | Target URL Structure | Behavior & Context |
| :--- | :--- | :--- |
| **Dine-In** | `.../store?store=balwant-new&qr_id=<ID>&type=DineIn&table=Table01` | Pre-locks **Table 01**. No delivery address needed. |
| **Takeaway** | `.../store?store=balwant-new&qr_id=<ID>&type=TakeAway` | Sets order mode to Takeaway. Prompts for pickup time slot. |
| **Delivery** | `.../store?store=balwant-new&qr_id=<ID>&type=Delivery` | Prompts for customer delivery address & pin code. |
| **Scheduled** | `.../store?store=balwant-new&qr_id=<ID>&type=TakeAway&scheduled=true` | Displays date & time slot selector for pre-ordering. |

---

## 🔑 How Convex Backend Handles Multi-Store Telemetry

In our Convex backend, each `qr_id` document contains:
* `_id`: Convex unique document ID (e.g., `ns776g02jxvnmfhh9ksqeg6qpx8famex`)
* `organizationId`: Store ID reference
* `tableId`: Dining table ID reference (for Dine-In)
* `qrType`: `"DineIn"` | `"TakeAway"` | `"Delivery"` | `"Queue"`

When `api.organizationQrCustomerJourney.recordScan({ qrId, ...telemetry })` is called:
1. Convex looks up `qrId`.
2. It automatically resolves the exact store (`organizationId`) and table (`tableId`).
3. It increments the scan counter for that table and logs an `organizationQrScans` telemetry record with IP, Device, OS, Browser, and GPS info.
4. It initializes or updates an active `organizationOrderingSessions` session token.

---

## 📋 Integration Specifications for Storefront Developer / AI Agent

### Step 1: Create Telemetry Collection Hook (`useQrTelemetry.ts`)
Create a custom React hook in your storefront project (`src/hooks/useQrTelemetry.ts` or `hooks/useQrTelemetry.ts`) that runs when a customer lands on the menu page:

```typescript
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

// Helper to extract device type, OS, and browser from Navigator
function getDeviceTelemetry() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  
  const deviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
  
  let os = "Unknown OS";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Macintosh/i.test(ua)) os = "macOS";
  else if (/Windows/i.test(ua)) os = "Windows";

  let browser = "Unknown Browser";
  if (/CriOS|Chrome/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Edg/i.test(ua)) browser = "Edge";

  return {
    userAgent: ua,
    deviceType,
    os,
    browser,
    screenResolution: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : undefined,
    language: typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US",
    referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
  };
}

export function useQrTelemetry() {
  const recordScan = useMutation(api.organizationQrCustomerJourney.recordScan);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const urlParams = new URLSearchParams(window.location.search);
    const storeSlug = urlParams.get("store");
    const qrId = urlParams.get("qr_id");
    const qrType = urlParams.get("type");
    const tableName = urlParams.get("table");

    if (qrId) {
      // Prevent duplicate scan records on simple page refresh
      const alreadyScanned = sessionStorage.getItem(`scanned_${qrId}`);
      
      if (!alreadyScanned) {
        const telemetry = getDeviceTelemetry();

        recordScan({
          qrId: qrId as any,
          ...telemetry,
        })
          .then((res) => {
            // Store active ordering session details in sessionStorage
            sessionStorage.setItem("qr_session_id", res.sessionId);
            sessionStorage.setItem("qr_table_id", res.tableId || "");
            sessionStorage.setItem("qr_id", res.qrId);
            if (storeSlug) sessionStorage.setItem("store_slug", storeSlug);
            if (qrType) sessionStorage.setItem("qr_type", qrType);
            if (tableName) sessionStorage.setItem("table_name", tableName);
            
            sessionStorage.setItem(`scanned_${qrId}`, "true");
            
            console.log(`[QR Telemetry] Successfully recorded scan event for store '${storeSlug}', table '${res.tableId}'`, res);
          })
          .catch((err) => {
            console.error("[QR Telemetry] Failed to record scan event:", err);
          });
      }
    }
  }, [recordScan]);
}
```

---

### Step 2: Track Cart Additions & Removals (`recordCartActivity`)
Call Convex whenever the total number of items in the customer's cart changes to monitor cart additions and abandoned cart rates:

```typescript
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function useCartTelemetry() {
  const recordCartActivity = useMutation(api.organizationQrCustomerJourney.recordCartActivity);

  const updateCartCount = (itemCount: number) => {
    const sessionId = sessionStorage.getItem("qr_session_id");
    if (sessionId) {
      recordCartActivity({
        sessionId,
        itemCount,
      }).catch((err) => console.error("[Cart Telemetry] Error updating cart count:", err));
    }
  };

  return { updateCartCount };
}
```

---

### Step 3: Order Attribution at Checkout (`attributeOrderToQr`)
When an order is placed on the storefront, pass the stored `qrId`, `sessionId`, and `orderId` to attribute the order revenue & conversion in Convex:

```typescript
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export function useOrderAttribution() {
  const attributeOrderToQr = useMutation(api.organizationQrOrderAttribution.attributeOrderToQr);

  const attributeOrder = (orderId: any) => {
    const sessionId = sessionStorage.getItem("qr_session_id");
    const qrId = sessionStorage.getItem("qr_id");

    if (qrId && orderId) {
      attributeOrderToQr({
        orderId: orderId as any,
        qrId: qrId as any,
        sessionId: sessionId || undefined,
      }).catch((err) => console.error("[Order Attribution] Error attributing order to QR:", err));
    }
  };

  return { attributeOrder };
}
```

---

## 🧪 Acceptance Criteria & Testing Checklist

1. ✅ **Scan Telemetry Capture**:
   - Scanning a QR code logs device type, OS, browser, IP address, screen resolution, and timestamp in Convex table `organizationQrScans`.
2. ✅ **Multi-Store Isolation**:
   - Scans on store `balwant-new` appear under Balwant Store analytics in POS.
   - Scans on store `ajay-cafe` appear under Ajay Cafe analytics in POS.
3. ✅ **Multi-Table Isolation**:
   - Table 01 scans increment Table 01 scan counters; Table 02 scans increment Table 02 counters.
4. ✅ **Cart & Conversion Tracking**:
   - Adding items to cart updates session cart count.
   - Completing checkout updates scan-to-order conversion rate and table revenue attribution in POS Settings ➔ QR Analytics.
