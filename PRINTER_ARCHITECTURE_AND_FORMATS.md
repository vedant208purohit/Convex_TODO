# Master POS Thermal Printing Architecture & Specifications

This document defines the comprehensive printing architecture, workflows, hardware connection methods, transport layers, legacy `defx-pos-frontend` parity mappings, and exact thermal printout formats (58mm / 80mm) across the entire POS application.

---

## 1. System Printing Architecture

The system is built for **silent, high-speed, driver-independent thermal printing** supporting standard **80mm (48-column)** and **58mm (32-column)** ESC/POS thermal printers.

```
                              ┌──────────────────────────────────────────────┐
                              │           CONVEX REALTIME DATABASE           │
                              │           (api.orders.listLiveOrders)        │
                              └──────────────────────┬───────────────────────┘
                                                     │
                                                     ▼
                              ┌──────────────────────────────────────────────┐
                              │            POS-DEFAULT TERMINAL              │
                              │        (GlobalOrderAutoPrinter Provider)     │
                              └──────────────────────┬───────────────────────┘
                                                     │
                                                     ▼
                              ┌──────────────────────────────────────────────┐
                              │           NEXT.JS PRINT CONTROLLER           │
                              │         (/api/printers/print-direct)         │
                              └──────┬───────────────┼───────────────┬───────┘
                                     │               │               │
                 ┌───────────────────┘               │               └───────────────────┐
                 ▼                                   ▼                                   ▼
      ┌─────────────────────┐             ┌─────────────────────┐             ┌─────────────────────┐
      │     LAN / TCP       │             │       USB RAW       │             │   BLUETOOTH / COM   │
      │  Port 9100 Socket   │             │   Win32 Spooler     │             │     Serial COM8     │
      │  (Kitchen / KDS)    │             │   (Workstation /    │             │   (Mobile Printers  │
      │                     │             │    Cashier Desk)    │             │   & Kitchen KOT)    │
      └─────────────────────┘             └─────────────────────┘             └─────────────────────┘
```

---

## 2. Printer Types, Connection Protocols & How to Test

### A. LAN / Network Thermal Printers (Ethernet / Wi-Fi)

#### How It Works:
* LAN printers communicate directly over raw **TCP socket Port 9100** (JetDirect standard).
* **Zero Windows drivers required**: Byte buffers (`ESC/POS`) are streamed directly over the local network via Node.js `net.Socket`.
* Millisecond latency; ideal for kitchen printers located far from the POS terminal.

#### How to Connect:
1. Connect the printer to your router or network switch using an Ethernet cable (or connect via printer Wi-Fi).
2. **Find the Printer's IP Address**:
   * Turn the printer **OFF**.
   * Hold the **FEED** button and turn the printer **ON**.
   * Release FEED after 3 seconds. It will print a self-test slip showing its IP (e.g. `192.168.1.150`).
3. Open **Settings > Printers** (`/settings?tab=printers`) in the POS:
   * **Printer Type**: Select `LAN / Network`.
   * **IP / URL**: Enter the printer IP (e.g. `192.168.1.150`).
   * **Port**: Enter `9100` (default standard thermal port).
   * **Role**: Choose `Station` (Kitchen), `WorkStation`, or `Cashier`.
4. Click **"Save Changes"**.

#### How to Test LAN:
* **In POS UI**: Click **"Test Connection"** (pings TCP socket) or **"Test Print"** (prints a test receipt).
* **Via API / PowerShell**:
  ```powershell
  $body = @{
      receiptStr = "LAN PRINTER TEST SUCCESS`n`n`n"
      printerType = "Lan"
      printerUrl = "192.168.1.150"
      printerPort = "9100"
  } | ConvertTo-Json

  Invoke-RestMethod -Uri "http://localhost:3000/api/printers/print-direct" -Method Post -Body $body -ContentType "application/json"
  ```

---

### B. USB Thermal Printers

#### How It Works:
* Connected via USB cable directly to the POS computer.
* Uses the **Win32 RAW Spooler API** (`winspool.Drv` `OpenPrinter` + `WritePrinter` in `RAW` mode).
* **Zero browser dialogs**: Bypasses the Chrome/Edge print preview dialog completely and prints instantly.

#### How to Connect:
1. Plug the printer USB cable into the computer.
2. In Windows **Settings > Printers & Scanners**, check the installed printer name (default is usually `POS-80-USB` or `printer-80`).
3. In POS **Settings > Printers** (`/settings?tab=printers`):
   * **Printer Type**: Select `USB`.
   * **Printer Name / Identifier**: Enter `POS-80-USB` (or `printer-80`).
   * **Port**: Enter `USB`.
4. Click **"Save Changes"**.

#### How to Test USB:
* Click **"Test Print"** in Settings.
* PowerShell direct test:
  ```powershell
  $body = @{
      receiptStr = "DIRECT USB TEST`n`n`n"
      printerType = "Usb"
      printerUrl = "POS-80-USB"
      printerPort = "USB"
  } | ConvertTo-Json

  Invoke-RestMethod -Uri "http://localhost:3000/api/printers/print-direct" -Method Post -Body $body -ContentType "application/json"
  ```

---

### C. Bluetooth Thermal Printers

#### How It Works:
* Pairs wirelessly to the POS computer or mobile tablet.
* Communicates via Windows Outgoing Virtual COM Port (e.g. `COM8` at 9600 baud) or WebBluetooth in browser.

#### How to Connect:
1. Turn on the Bluetooth printer.
2. In Windows **Bluetooth & Devices**, click **Add device** and pair with the printer (PIN is typically `0000` or `1234`).
3. Under **More Bluetooth settings > COM Ports**, check the Outgoing COM port (e.g. `COM8`).
4. In POS **Settings > Printers**:
   * **Printer Type**: Select `Bluetooth`.
   * **Printer Name**: Enter `Printer001`.
   * **Port**: Enter `BT` (or `COM8`).
5. Click **"Save Changes"**.

---

## 3. Printer Roles & Routing (`printerUseFor`)

Each printer in the database is tagged with its operational role:

| Role Tag in DB | Typical Hardware | Primary Location | Tickets Assigned |
| :--- | :--- | :--- | :--- |
| **`Station`** | LAN or Bluetooth | Kitchen Line / Bar / Chef Counter | **Kitchen Order Ticket (KOT)** |
| **`WorkStation`** | USB (POS-80-USB) | Food Prep / Assembly Counter | **Food Runner / Assembly Slip** |
| **`Cashier`** | USB (POS-80-USB) | Billing & Cashier Desk | **Customer Tax Invoice & Receipts** |

---

## 4. Module Features & Printing Workflows

### 1. KDS (Kitchen Display System — `/kds`)
* **Purpose**: Kitchen production terminal for station chefs and line cooks.
* **Auto-Printing**: When orders are placed (Cashier, Captain, or QR), incoming cooking tickets auto-print silently to the `Station` printer.
* **Printed Ticket**: **Kitchen Order Ticket (KOT)**
  * Organization header & station name.
  * Order Number & Token Number (`#07`).
  * Order Type (`DineIn`, `TakeAway`, `Delivery`).
  * Table number & Server name (`Online QR` or `Captain`).
  * Items with quantities (`[1] SAMOSA`).
  * Customizations & Modifiers (`[MOD]: Extra Cheese`).
  * Chef Preparation Preferences (`Spicy`, `Less Oil`, `No Onion`).
  * Kitchen Special Notes & Allergy Warnings (`*** ALLERGY: PEANUT ***`).
* **Clean UI**: Manual print buttons on ticket cards are removed to prevent accidental duplicate printing.

---

### 2. Workstation (Food Runner & Assembly — `/workstation`)
* **Purpose**: Assembly counter where dishes from multiple kitchen stations meet before being delivered to guests.
* **Auto-Printing**: Automatically dispatches a runner slip when any new order arrives (with an 800ms non-blocking stagger).
* **Printed Ticket**: **Food Runner / Plate Assembly Slip**
  * Store Name banner.
  * Header: `FOOD RUNNER / ASSEMBLY SLIP`.
  * Token number & Table number.
  * Order time & Server attribution.
  * Section: `PLATE ASSEMBLY CHECKLIST` with verification brackets:
    ```
    ------------------------------------------------
               PLATE ASSEMBLY CHECKLIST
    ------------------------------------------------
    [ ]  1x Vadapav
         --> [MOD]: Extra Cheese
    [ ]  1x Samosa
    ------------------------------------------------
    ```
  * Special instructions & allergy callouts.
* **Manual Print**: Workstation tickets can also be re-printed on demand from the card menu.

---

### 3. Online Storefront & Customer QR (`pos-user`)
* **Purpose**: Dine-in table ordering, takeaway, or delivery placed from customer smartphones.
* **Auto-Printing Flow**:
  1. Customer scans QR and taps "Order" / "Pay" in `pos-user`.
  2. Order is created in Convex (`orderSource: "PREST-QR"`).
  3. The POS terminal's **`GlobalOrderAutoPrinter`** detects the incoming order instantly:
     * **Kitchen KOT** $\rightarrow$ Auto-prints on `Station` printer (`Printer001`).
     * **Food Runner Slip** $\rightarrow$ Auto-prints on `Workstation` printer (`POS-80-USB`).
     * **Customer Invoice** $\rightarrow$ **Held** (does not auto-print, preventing wasted paper while guests are still eating).
  4. POS displays a notification toast: `🖨️ Auto-printed KOT & Runner Slip for Online QR Order (#07)`.

---

### 4. Orders Section (`/orders` & `/orders/[id]`)
* **Purpose**: Store management dashboard for viewing, searching, and managing past and active orders.
* **On-Demand Printing in Order Drawer**:
  * Action buttons in the order drawer remain completely clean and user-controlled.
  * Clicking the receipt button prints the **Customer Tax Invoice** to the `Cashier` printer on demand.
  * Bypasses browser print preview, sending raw ESC/POS directly to the thermal printer.

---

### 5. Cashier Desk (`/cashier`)
* **Purpose**: Walk-in customer POS counter.
* **Order Settlement**:
  * Tendering cash, split, UPI QR, or card payments.
  * Customer receipt generation upon checkout.
  * Automatically dispatches KOT ticket to kitchen and Runner Slip to assembly for cashier orders.

---

### 6. Captain (Handheld Waiter App — `/captain`)
* **Purpose**: Waiters taking orders table-side on tablets or mobile phones.
* **Printing Flow**:
  * Waiter selects items for a table and taps "Fire to Kitchen".
  * KOT is instantly routed to the relevant station printer (e.g. Bar printer for drinks, Kitchen printer for food).
  * Labeled with `SERVER: Captain (Waiter Name)`.
  * Invoice is generated only when the guest asks for the bill at the end of their meal.

---

## 5. Collision Prevention & Stagger Timing

When a single order triggers multiple tickets to the **same physical printer** (e.g., if both Workstation Runner Slip and Cashier Receipt share `POS-80-USB`):

* **KOT**: Dispatched immediately ($t = 0\text{ms}$).
* **Runner Slip**: Staggered by **800ms**.
* **Cashier Receipt** (when triggered): Staggered by **1600ms**.

This prevents Windows spooler lock contention, job drops, and cut-command overlap.

---

## 6. Customer Receipt vs. Kitchen Order Ticket (KOT)

In restaurant and POS engineering, a **Customer Receipt** and a **Kitchen Order Ticket (KOT)** serve two fundamentally different audiences:

| Attribute | Customer Tax Invoice / Receipt | Kitchen Order Ticket (KOT) |
| :--- | :--- | :--- |
| **Primary Audience** | Guest, Accountant, Tax Authorities | Line Cooks, Station Chefs, Expeditor |
| **Pricing & Taxes** | Itemized prices, subtotal, discounts, GST/VAT/Taxes, net total, tip | **STRICTLY NONE** (no prices, no taxes, no payment modes) |
| **Readability** | Standard tabular receipt text (11px / 12px) | **Extra-large bold** Table #, Token #, and Quantities (visible from 3–4 ft away) |
| **Scope of Items** | Complete bill containing all items ordered across the entire meal | **Station-filtered items only** (e.g. Bar printer only receives drink items) |
| **Special Features** | Logo, store address, GSTIN, FSSAI lic #, payment mode, survey QR code | High-contrast modifiers, cooking instructions, allergy warnings, KOT fire counter |

---

## 7. Legacy `defx-pos-frontend` Traceability Matrix

Every printing point previously implemented in `defx-pos-frontend` is mapped below to its active location in `pos-default`:

| # | Exact File in `defx-pos-frontend` | Function in `defx-pos-frontend` | Architectural Purpose | Target Hardware | Target File in `pos-default` |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | `components/Cashier/PaymentMethodComponent.jsx` | `onPrintReceiptHandler(order)` | **Cashier Settlement Receipt** | Cashier Thermal Printer | `app/cashier/page.tsx` |
| **2** | `components/Cashier/AddCustomerInformationComponent.jsx` | `onPrintReceiptHandler(res, cashierPrinters)` | **Quick Customer Token Slip** | Cashier Thermal Printer | `app/cashier/page.tsx` |
| **3** | `components/Orders/OrderComponent.jsx` | `onPrintReceiptHandler(data)` | **Historical Bill Reprint** | Cashier Thermal Printer | `app/orders/page.tsx` & `app/orders/[id]/page.tsx` |
| **4** | `components/Captain/CaptainOrderModal.jsx` | `onPrintReceiptHandler(res)` | **Captain KOT Firing** | Kitchen Station Printers | `app/captain/page.tsx` |
| **5** | `components/KitchenDisplaySystem/ViewStation.jsx` | `getStationReceiptJson()` & `getStationReceiptContent()` | **Kitchen Station KOT Ticket** | Kitchen Station Printers | `app/kds/page.tsx` |
| **6** | `components/Workstation/WorkstationComponent.jsx` | `getReceiptData()` & `onPrintReceiptHandler()` | **Workstation Assembly Slip** | Expo / Runner Printer | `app/workstation/page.tsx` |
| **7** | `components/Settings/Printer/Printer.jsx` | `onPrintReceipt(data)` | **Printer Self-Test / Demo** | Configured Printer | `app/components/OrganizationPrinters.tsx` |

---

## 8. Master Catalog of All 14 Printing Use Cases

### Category 1: Front-of-House / Cashier Operations

#### 1.1 Final Customer Tax Invoice (Settlement Receipt)
* **File:** `app/cashier/page.tsx` (`completedOrderData` modal)
* **When:** Immediately upon successful payment settlement (Cash, Card, UPI, etc.).
* **Why:** Legal tax compliance, customer proof of payment, dispute reference.
* **Target Hardware:** Cashier Thermal Printer (USB / Bluetooth / LAN).
* **Format Required:** Format 1 (Customer Tax Invoice).

#### 1.2 Bill Estimate / Pre-Check Bill (Proforma Invoice)
* **File:** `app/cashier/page.tsx` & `app/captain/page.tsx`
* **When:** When a dine-in table requests the check prior to payment.
* **Why:** Allows guests to verify food items and total at their table before handing over payment.
* **Target Hardware:** Cashier Thermal Printer or Captain Mobile Belt Printer.
* **Format Required:** Format 2 (Bill Estimate - clearly marked `NOT A TAX INVOICE`).

#### 1.3 Quick Customer Token Ticket (QSR / Food Court)
* **File:** `app/cashier/page.tsx` (Customer Takeaway Token flow)
* **When:** When an order is created at a fast-casual or takeaway counter.
* **Why:** The customer retains this physical slip until their number is called on the Live Order Screen.
* **Target Hardware:** Cashier Counter Printer.
* **Format Required:** Format 5 (Token / Queue Slip).

---

### Category 2: Kitchen & Bar Operations (Back-of-House)

#### 2.1 First-Fire Kitchen Order Ticket (New KOT #1)
* **File:** `app/captain/page.tsx`, `app/cashier/page.tsx`, or Customer QR Table Ordering
* **When:** The exact second a new table order is placed.
* **Why:** Alerts the kitchen line cooks to begin food preparation.
* **Target Hardware:** Destination Kitchen Station Printers (Curry, Tandoor, Bar, Pantry via LAN / USB).
* **Format Required:** Format 3 (Kitchen Order Ticket - station items only).

#### 2.2 Running Add-On KOT (KOT #2, #3, ...)
* **File:** `app/captain/page.tsx` & `app/cashier/page.tsx`
* **When:** When seated guests order additional dishes or drinks later in the meal.
* **Why:** **CRITICAL:** Only prints the *newly added items*. Printing the whole order would cause duplicate cooking.
* **Target Hardware:** Destination station printer for newly added items only.
* **Format Required:** Format 3 (Marked `*** RUNNING KOT #2 (ADD-ON) ***`).

#### 2.3 Cancelled / Void KOT (Stop Cooking Alert)
* **File:** `app/cashier/page.tsx`, `app/orders/page.tsx`, `app/kds/page.tsx`
* **When:** When an item is cancelled or voided after being sent to the kitchen.
* **Why:** Signals line cooks to immediately stop cooking, avoiding food wastage and cost leakage.
* **Target Hardware:** Kitchen Station Printer.
* **Format Required:** Format 4 (Void / Cancelled KOT).

#### 2.4 Station Transfer / Table Shift Slip
* **File:** `app/cashier/page.tsx` & `app/captain/page.tsx`
* **When:** When guests shift from Table A to Table B, or merge tables.
* **Why:** Informs line cooks and food runners where to serve the pending food dishes.
* **Target Hardware:** Kitchen Display / Runner Printer.
* **Format Required:** Compact shift notice (`TABLE SHIFT: T-03 --> T-08`).

---

### Category 3: Packaging, Delivery & Food Runners

#### 3.1 Workstation Runner / Expeditor Slip
* **File:** `app/workstation/page.tsx` & `app/kds/page.tsx`
* **When:** When individual stations finish cooking and plates arrive at the Pass / Expo counter.
* **Why:** Expeditor uses this checklist to ensure all plates are assembled before serving.
* **Target Hardware:** Workstation / Expo Printer.
* **Format Required:** Format 6 (Runner Checklist).

#### 3.2 Takeaway / Delivery Bag Label & Sticker
* **File:** `app/workstation/page.tsx` & `app/cashier/page.tsx`
* **When:** Packing orders into takeaway bags (In-house, Zomato, Swiggy, UberEats).
* **Why:** Identifies customer details, order items, and rider code without opening food containers.
* **Target Hardware:** Adhesive Thermal Label Printer (or continuous roll).
* **Format Required:** Bag tag sticker format.

---

### Category 4: Order Management & Auditing

#### 4.1 On-Demand Historical Bill Reprint
* **File:** `app/orders/page.tsx` & `app/orders/[id]/page.tsx`
* **When:** Guest loses their receipt, or requests duplicate invoices for company reimbursement.
* **Why:** Provides a duplicate invoice copy while preventing fraud.
* **Target Hardware:** Cashier Thermal Printer.
* **Format Required:** Format 1 (Marked `*** DUPLICATE COPY ***`).

#### 4.2 Refund / Credit Note Receipt
* **File:** `app/orders/page.tsx`
* **When:** An order is refunded or returned.
* **Why:** Accounting proof for cash drawer deduction and customer signed acknowledgment.
* **Target Hardware:** Cashier Thermal Printer.
* **Format Required:** Negative amount breakdown with original invoice reference.

---

### Category 5: Host Stand & Waitlist Queue

#### 5.1 Walk-In Guest Waitlist Token Slip
* **File:** `app/queue/page.tsx`
* **When:** When a walk-in guest checks in at the host desk or queue kiosk.
* **Why:** Physical ticket gives guests their Queue Number and live tracker QR code.
* **Target Hardware:** Host Desk / Kiosk Printer.
* **Format Required:** Format 5 (Waitlist Ticket).

---

### Category 6: Management & Store Closing Reports

#### 6.1 End of Shift / Day-Close Settlement Summary (Z-Report)
* **File:** `app/reports/page.tsx` & `app/cashier/page.tsx`
* **When:** End of each cashier shift or restaurant closing time.
* **Why:** Reconciles physical drawer cash against recorded POS transactions.
* **Target Hardware:** Cashier Thermal Printer.
* **Format Required:** Format 7 (Daily Register Close Z-Report).

---

### Category 7: Hardware Maintenance

#### 7.1 Self-Test Diagnostic (Demo Print)
* **File:** `app/components/OrganizationPrinters.tsx`
* **When:** When testing or configuring a LAN, Bluetooth, or USB printer in settings.
* **Why:** Verifies communication, driver baud rates, paper width, and cutter function.
* **Target Hardware:** Selected printer being tested.
* **Format Required:** Diagnostic test receipt pattern.

---

## 9. Exact Thermal Printout Formats (ASCII Mockups)

### Format 1: Customer Tax Invoice (80mm / 48 Column)

```
================================================
                 THE BISTRO RESTAURANT          
              Plot 42, Bandra West, Mumbai      
                 Phone: +91 98765 43210         
               GSTIN: 27AAAAA0000A1Z5           
             FSSAI Lic #: 11521012345678        
------------------------------------------------
                  TAX INVOICE                   
================================================
Date: 26/10/2026 18:20:15   Order #: ORD#1042   
Table: T-04                 Token: #18          
Order Type: Dine In         Waiter: Rahul       
------------------------------------------------
Items                   Qty   Net Price    Value
------------------------------------------------
Paneer Tikka Butter Masala
                         1       320.00   320.00
  [Mod: Extra Spicy]
Butter Naan              2        55.00   110.00
Fresh Lime Soda (Sweet)  1        90.00    90.00
------------------------------------------------
Sub Total                                 520.00
Discount (10% FESTIVE)                    -52.00
Net Taxable Amount                        468.00
CGST (2.5%)                                11.70
SGST (2.5%)                                11.70
Round Off                                  +0.60
================================================
TOTAL AMOUNT PAYABLE                    ₹ 492.00
================================================
Payment Mode: UPI (Ref: 4291882103)             
Paid Amount:                             ₹ 492.00
Change Due:                                ₹ 0.00
------------------------------------------------
GST Breakdown:
Rate       Taxable Amt      CGST       SGST
5.0%            468.00     11.70      11.70
------------------------------------------------
Scan to rate your dining experience:
[    QR CODE    ]
Thank you for dining with us! Visit again.
================================================
```

---

### Format 2: Bill Estimate / Pre-Check Bill (Proforma)

```
================================================
                 THE BISTRO RESTAURANT          
------------------------------------------------
             *** BILL ESTIMATE ***              
         (NOT A TAX INVOICE - PRE-CHECK)        
================================================
Date: 26/10/2026 18:15:00   Table: T-04         
Order #: ORD#1042           Waiter: Rahul       
------------------------------------------------
Items                        Qty          Amount
------------------------------------------------
Paneer Tikka Butter Masala     1          320.00
Butter Naan                    2          110.00
Fresh Lime Soda (Sweet)        1           90.00
------------------------------------------------
Sub Total                                 520.00
Estimated Taxes (5% GST)                   26.00
================================================
ESTIMATED TOTAL                         ₹ 546.00
================================================
Please present this slip at cashier or call your
server to process payment (Cash / Card / UPI).
================================================
```

---

### Format 3: Kitchen Order Ticket (KOT #1 - High Visibility)

```
================================================
                KITCHEN ORDER TICKET            
================================================
KOT #: KOT#1-1042           STATION: MAIN KITCHEN
DATE: 26/10/2026 18:02:11   WAITER: Rahul       
------------------------------------------------
████████████████████████████████████████████████
█  TABLE: T-04                  TOKEN: #18     █
████████████████████████████████████████████████
ORDER TYPE: DINE-IN (First Fire)
------------------------------------------------
QTY   ITEM NAME & MODIFIERS                     
------------------------------------------------
[1]   PANEER TIKKA BUTTER MASALA                
      --> PREP: Extra Spicy                     
      --> PREP: Less Butter                     
[2]   BUTTER NAAN                               
------------------------------------------------
NOTES: Guest has mild lactose sensitivity.      
================================================
```

---

### Format 4: Void / Cancelled KOT (Stop Cooking Alert)

```
************************************************
            *** KOT ITEM CANCELLED ***          
************************************************
TIME: 26/10/2026 18:07:33   STATION: MAIN KITCHEN
TABLE: T-04                       TOKEN: #18    
ORDER #: ORD#1042                WAITER: Rahul  
------------------------------------------------
CANCELLED ITEMS:
------------------------------------------------
[-1]  PANEER TIKKA (Extra Spicy)                
------------------------------------------------
REASON: Customer changed mind / duplicate order 
AUTHORIZED BY: Manager (Vikram)                 
************************************************
   *** ATTENTION: DO NOT PREPARE THIS DISH ***  
************************************************
```

---

### Format 5: Quick Counter Token & Waitlist Queue Slip

```
================================================
             THE BISTRO - WAITLIST TICKET       
================================================

             ████████████████████████           
             █                      █           
             █      QUEUE: Q-14     █           
             █                      █           
             ████████████████████████           

Guest Name: Sharma Party (4 Guests)             
Date: 26/10/2026                 Time: 18:10    
Estimated Wait Time: ~20 - 25 mins              
------------------------------------------------
Scan QR to track your live queue spot:
[    QR CODE    ]
https://defx.menu/queue/track/Q-14
------------------------------------------------
Please arrive within 5 minutes of your number
being announced. Thank you for your patience!
================================================
```

---

### Format 6: Workstation Assembly & Packing Runner Slip

```
================================================
            WORKSTATION RUNNER CHECKLIST        
================================================
ORDER #: ORD#1042                 TOKEN: #18    
TYPE: TAKEAWAY                    BAG #: 1 of 2 
CUSTOMER: Priya Sharma (+91 98765 11223)        
TIME FIRED: 18:05                 EXPEDITE: YES 
------------------------------------------------
CHECKLIST:
[ ] 1x Paneer Tikka (Tandoor Station)
[ ] 2x Butter Naan (Tandoor Station)
[ ] 1x Fresh Lime Soda (Bar Station)
[ ] Cutlery & Napkins Included
[ ] Mint Chutney & Onion Salad
================================================
PACKED BY: ___________________ (Sign)           
================================================
```

---

### Format 7: End-of-Day / Shift Close Report (Z-Report)

```
================================================
            DAILY REGISTER CLOSE (Z-REPORT)     
================================================
STORE: The Bistro (Bandra West)                 
REGISTER #: REG-01         CASHIER: Amit Singh  
SHIFT: Evening (14:00 - 23:00)                  
DATE: 26/10/2026 23:15:40                       
------------------------------------------------
SALES SUMMARY:
Total Orders: 64
Gross Sales:                        Rs.58,450.00
Total Discounts Applied:            Rs.-3,200.00
Total Voids / Refunds (2 orders):     Rs.-850.00
Net Sales:                          Rs.54,400.00
Total CGST (2.5%):                   Rs.1,360.00
Total SGST (2.5%):                   Rs.1,360.00
------------------------------------------------
TOTAL REVENUE COLLECTED             Rs.57,120.00
================================================
PAYMENT BREAKDOWN:
Cash Collected:                     Rs.16,420.00
Credit / Debit Card:                Rs.24,500.00
UPI / QR Payments:                  Rs.16,200.00
------------------------------------------------
CASH DRAWER RECONCILIATION:
Opening Cash Float:                  Rs.2,000.00
Cash Sales Recorded:                Rs.16,420.00
Cash Payouts (Vendor Milk):           Rs.-600.00
------------------------------------------------
EXPECTED CASH IN DRAWER:            Rs.17,820.00
ACTUAL CASH COUNTED:                Rs.17,820.00
DRAWER DISCREPANCY (Over/Short):         Rs.0.00
================================================
Cashier Signature:      Manager Signature:

__________________      __________________
================================================
```
