# Master POS Thermal Printing Architecture & Specifications

This document defines the comprehensive printing architecture, workflows, hardware routing, legacy `defx-pos-frontend` parity mappings, and exact thermal printout formats (58mm / 80mm) across the entire POS application.

---

## 1. System Printing Topology

```
                              ┌────────────────────────────────────────┐
                              │       STORE PRINTER CONTROLLER         │
                              └──────────────────┬─────────────────────┘
                                                 │
         ┌─────────────────────────┬─────────────┴─────────────┬─────────────────────────┐
         ▼                         ▼                           ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  CASHIER COUNTER │      │  KITCHEN & BARS  │      │ RUNNER / PACKING │      │  HOST & REPORTS  │
│  (Tax Invoices & │      │   (Cooking KOTs  │      │  (Bag Stickers & │      │   (Queue Slips   │
│   Settlements)   │      │   & Prep Tickets)│      │   Token Slips)   │      │   & Z-Reports)   │
└──────────────────┘      └──────────────────┘      └──────────────────┘      └──────────────────┘
```

---

## 2. Where Does Each Order Print?

### Case A: Order Placed from Cashier Counter
* **Cashier Printer:** Prints the **Customer Tax Invoice / Bill** upon payment settlement (or customer token slip for takeaway).
* **KDS Station Printer:** Fires the **KOT (Kitchen Order Ticket)** directly to the kitchen line cooks so they can start preparing the food immediately.

### Case B: Order Placed by User from Website / Table QR Code
* **KDS Station Printer:** Instantly receives the order and prints the **KOT cooking ticket** with the Table # or Online Delivery/Takeaway tag.
* **Cashier Printer:** Receives the live notification on the cashier screen (prints customer bill when accepted/settled).

### Case C: Order Placed by Captain (from Handheld Device at Table)
* **KDS Station Printer:** Fires the **KOT ticket** to the specific kitchen station (e.g. Bar, Tandoor, Main Kitchen).
* **Cashier Printer:** Does not print a final bill yet because guests are still eating. (Only prints the bill later when guests ask for the check and settle).

---

## 3. In the KDS: Does It Print Automatically If the Printer Is Connected?

**YES!** Here is how the automatic printing works:

```
┌──────────────────────────────────────────────┐
│  New Order Placed                            │
│  (Cashier / Table QR / Captain Handheld)     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼ (Real-time reactive Convex / WebSocket sync)
┌──────────────────────────────────────────────┐
│  KDS Screen Receives Order                   │
│  Checks: Is Station Printer connected        │
│  via Bluetooth (WebBluetooth) or USB?        │
└──────────────────────┬───────────────────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
        [ YES ]                [ NO ]
            │                     │
            ▼                     ▼
Auto-prints KOT silently       Shows order on KDS screen;
over WebBluetooth to the       Chef can tap "Reprint KOT"
thermal station printer.       button once printer is ready.
```

### Technical Workflow:
1. **Zero Browser Dialogs (Silent Auto-Print):** When the printer is connected via **Bluetooth** (WebBluetooth GATT service) or **USB** (WebUSB), the browser communicates directly with the printer hardware. It does **not** open a standard browser print dialog.
2. **Auto-Trigger on Order Arrival:** When a new order arrives on the KDS screen (`!order.is_printed`), the system immediately sends the binary ESC/POS KOT data to the connected Bluetooth printer and marks the ticket as printed.
3. **Manual Reprint Backup:** Every order card on the KDS includes a manual **"Reprint KOT"** button in case paper runs out or the chef needs another physical ticket.

---

## 4. Customer Receipt vs. Kitchen Order Ticket (KOT)

In restaurant and POS engineering, a **Customer Receipt** and a **Kitchen Order Ticket (KOT)** serve two fundamentally different audiences:

| Attribute | Customer Tax Invoice / Receipt | Kitchen Order Ticket (KOT) |
| :--- | :--- | :--- |
| **Primary Audience** | Guest, Accountant, Tax Authorities | Line Cooks, Station Chefs, Expeditor |
| **Pricing & Taxes** | Itemized prices, subtotal, discounts, GST/VAT/Taxes, net total, tip | **STRICTLY NONE** (no prices, no taxes, no payment modes) |
| **Readability** | Standard tabular receipt text (11px / 12px) | **Extra-large bold** Table #, Token #, and Quantities (visible from 3–4 ft away) |
| **Scope of Items** | Complete bill containing all items ordered across the entire meal | **Station-filtered items only** (e.g. Bar printer only receives drink items) |
| **Special Features** | Logo, store address, GSTIN, FSSAI lic #, payment mode, survey QR code | High-contrast modifiers, cooking instructions, allergy warnings, KOT fire counter |

---

## 3. Legacy `defx-pos-frontend` Traceability Matrix

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

## 4. Master Catalog of All 14 Printing Use Cases

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

## 5. Exact Thermal Printout Formats (ASCII Mockups)

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
CGST (2.5%)                                11.70
SGST (2.5%)                                11.70
------------------------------------------------
TOTAL AMOUNT (INR)                     Rs.491.40
ROUND OFF                                  -0.40
------------------------------------------------
NET PAYABLE                            Rs.491.00
------------------------------------------------
PAYMENT DETAILS:
Payment Mode: UPI / Google Pay (Ref: 981248102)
Amount Paid: Rs.491.00
------------------------------------------------
Customer: Priya Sharma (+91 98765 11223)
================================================
Scan QR below to rate your experience:
[    QR CODE    ]
https://defx.menu/survey/1042
================================================
     Thank you for ordering and stay safe...    
================================================
```

---

### Format 2: Bill Estimate / Pre-Check (80mm / 48 Column)

```
================================================
                 THE BISTRO RESTAURANT          
================================================
           *** BILL ESTIMATE / PRE-CHECK ***    
               (THIS IS NOT A TAX INVOICE)      
------------------------------------------------
Date: 26/10/2026 18:15:00   Table: T-04         
Order #: ORD#1042           Token: #18          
Server: Rahul               Guests: 3           
------------------------------------------------
Items                   Qty   Net Price    Value
------------------------------------------------
Paneer Tikka Butter Masala
                         1       320.00   320.00
Butter Naan              2        55.00   110.00
Fresh Lime Soda (Sweet)  1        90.00    90.00
------------------------------------------------
Estimated Sub Total                       520.00
Estimated Taxes (5% GST)                   23.40
------------------------------------------------
ESTIMATED TOTAL                        Rs.543.40
================================================
Please verify your bill items above.
Payment can be made via Cash, Card, or UPI.
================================================
```

---

### Format 3: Kitchen Order Ticket (KOT / Station Ticket)

```
================================================
              KITCHEN ORDER TICKET (KOT)        
================================================
STATION: TANDOOR                   KOT #: KOT-02
DATE: 26/10/2026                  TIME: 18:05:12
ORDER TYPE: DINE-IN              WAITER: Rahul  
------------------------------------------------
TABLE: T-04                       TOKEN: #18    
================================================
QTY   ITEM DESCRIPTION                          
------------------------------------------------
[2]   BUTTER NAAN                               
[1]   PANEER TIKKA                              
      --> [MOD]: Extra Spicy                    
      --> [NOTE]: Crispy, green chutney on side 
[1]   TANDOORI ROTI (BUTTER)                    
================================================
SPECIAL NOTE: GUEST HAS SEVERE NUT ALLERGY      
================================================
```

---

### Format 4: Void / Cancelled KOT (Stop Cooking Alert)

```
************************************************
          *** CANCELLED / VOID KOT ***          
************************************************
STATION: TANDOOR                   TIME: 18:12:44
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
