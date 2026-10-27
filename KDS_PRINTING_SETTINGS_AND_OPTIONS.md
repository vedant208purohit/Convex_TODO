# Master KDS & Kitchen Printing Feature Flags Specification

This document specifies the configurable printing options, feature flag catalog, UI settings integration, and exact dynamic receipt behaviors for Kitchen Display Systems (KDS) and Kitchen Order Tickets (KOT) in the POS platform.

---

## 1. Executive Overview & Purpose

Restaurants operate under different operational models:

- **Fine Dining / Full Service:** Requires waiter names, guest counts, table numbers, and item modification notes, but **strictly zero prices**.
- **Quick-Service (QSR) / Food Court:** Relies heavily on **order times** and quick prep items; waiter names and guest counts are irrelevant.
- **Cloud Kitchens / Takeaway Stations:** Needs customer contact info, delivery tags, and item pricing/subtotals.

To accommodate different kitchen preferences, KDS printout attributes are managed via **feature flags** in **Settings → Features → Kitchen & KDS**. When a feature toggle is switched ON or OFF, the thermal printout dynamically adapts its content and format.

---

## 2. Settings Navigation & UI Placement

The printing feature flags are integrated directly into the POS Settings hierarchy:

```
Settings
 ├── General
 ├── Service Modes
 ├── Cashier
 └── Kitchen & KDS  ◄── [CONFIGURATION TAB]
      ├── Ticket Header & Details Toggles
      └── Items & Preparation Toggles
```

### UI Features in Settings:

- **Real-time Reactive Sync:** Backed by Convex `organizationFeatures` table; changes apply immediately across all KDS tablets, kitchen terminals, and cashier stations without page refresh.
- **Search & Filter:** Instant search box to quickly filter flags (e.g. searching _"waiter"_, _"modifier"_, or _"price"_).
- **Live Ticket Preview Box:** An interactive simulated 80mm thermal receipt card beside the toggles that updates in real-time as flags are toggled.

---

## 3. Comprehensive Feature Flags Catalog

### Category A: Header & Order Identification (Ticket Header)

|   #    | Feature Key               | Display Name                   | Description                                                           | Enabled (ON) Behavior                                                         | Disabled (OFF) Behavior                     | Default |
| :----: | :------------------------ | :----------------------------- | :-------------------------------------------------------------------- | :---------------------------------------------------------------------------- | :------------------------------------------ | :-----: |
| **A1** | `kds_print_waiter_name`   | **Show Waiter / Server Name**  | Displays the name of the captain or server who took the order.        | Prints `SERVER: Rahul` so the kitchen can call the waiter when food is ready. | Omitted completely from the ticket.         |  `ON`   |
| **A2** | `kds_print_guest_count`   | **Show Guest Count (Pax)**     | Displays the number of guests seated at the table.                    | Prints `GUESTS: 4` to assist line cooks with portioning and bread counts.     | Omitted from the ticket.                    |  `OFF`  |
| **A3** | `kds_print_customer_info` | **Show Customer Name & Phone** | Displays guest name and phone number for takeaway or delivery orders. | Prints `CUSTOMER: Priya (+91 98765 11223)`.                                   | Withheld from ticket for customer privacy.  |  `OFF`  |
| **A4** | `kds_print_order_type`    | **Highlight Order Type Badge** | Distinguishes Dine-In, Takeaway, and Third-Party Delivery orders.     | Prints bold header tag: `[ DINE-IN ]`, `[ TAKEAWAY ]`, or `[ DELIVERY ]`.     | Prints standard non-highlighted order text. |  `ON`   |
| **A5** | `kds_print_timestamp`     | **Show Fired Time & Seconds**  | Prints the exact date and second the ticket was sent to the kitchen.  | Prints `TIME: 18:05:12` allowing expeditor to track exact prep time.          | Prints only HH:MM or date.                  |  `ON`   |

---

### Category B: Items, Modifiers & Cooking Instructions

|   #    | Feature Key                 | Display Name                         | Description                                                               | Enabled (ON) Behavior                                                         | Disabled (OFF) Behavior                                             | Default |
| :----: | :-------------------------- | :----------------------------------- | :------------------------------------------------------------------------ | :---------------------------------------------------------------------------- | :------------------------------------------------------------------ | :-----: |
| **B1** | `kds_print_item_modifiers`  | **Show Item Modifiers & Variants**   | Prints item customization selections (e.g., Extra Spicy, Less Oil, Jain). | Indents and highlights modifiers: `--> [MOD]: Extra Spicy`.                   | Only base item name is printed.                                     |  `ON`   |
| **B2** | `kds_print_special_notes`   | **Show Custom Kitchen Instructions** | Prints custom notes entered by the server or guest.                       | Prints: `--> [NOTE]: Crispy, green chutney on side`.                          | Suppresses custom free-text notes.                                  |  `ON`   |
| **B3** | `kds_print_show_prices`     | **Print Prices on KOT**              | Shows individual item prices and ticket subtotal.                         | Prints item prices and subtotal (useful for cloud kitchens / combined slips). | **Strictly NO prices or currency symbols** (standard KOT practice). |  `OFF`  |
| **B4** | `kds_print_combo_breakdown` | **Expand Combo / Meal Components**   | Expands combo items into their individual sub-dishes for line cooks.      | Prints combo parent item followed by all included sub-dishes indented.        | Prints only the top-level combo item title.                         |  `ON`   |

---

### Category C: Automation & Hardware

|   #    | Feature Key              | Display Name                      | Description                                                        | Enabled (ON) Behavior                                                     | Disabled (OFF) Behavior                                            | Default |
| :----: | :----------------------- | :-------------------------------- | :----------------------------------------------------------------- | :------------------------------------------------------------------------ | :----------------------------------------------------------------- | :-----: |
| **C1** | `kds_auto_print_on_fire` | **Auto-Print KOT on Order Fired** | Automatically triggers physical printer when order arrives on KDS. | Dispatches ESC/POS print job immediately upon order arrival in real time. | Chef uses manual **"Print KOT"** button on order card when needed. |  `OFF`  |

---

## 4. Visual Comparison: Thermal Printout Output

### Case 1: Standard Restaurant Setup (Recommended Flags ON)

_Flags: Waiter: ON | Guest Count: ON | Modifiers: ON | Special Notes: ON | Prices: OFF_

```
================================================
              KITCHEN ORDER TICKET (KOT)
================================================
STATION: MAIN CURRY                KOT #: KOT-02
DATE: 27/10/2026                  TIME: 18:05:12
ORDER TYPE: [ DINE-IN ]           SERVER: Rahul
GUESTS: 4                         TOKEN: #18
------------------------------------------------
TABLE: T-04
================================================
QTY   ITEM DESCRIPTION
------------------------------------------------
[2]   PANEER TIKKA BUTTER MASALA
      --> [MOD]: Extra Spicy
      --> [NOTE]: Less oil, gravy well cooked
[4]   BUTTER NAAN
[1]   DAL MAKHANI
================================================
NOTE: Pack mint chutney on side
================================================
```

---

### Case 2: Minimalist / Quick-Service Setup

_Flags: Waiter: OFF | Guest Count: OFF | Modifiers: ON | Special Notes: OFF | Prices: OFF_

```
================================================
              KITCHEN ORDER TICKET (KOT)
================================================
STATION: MAIN                      ORD: ORD#1042
DATE: 27/10/2026                  TIME: 18:05:12
ORDER TYPE: [ TAKEAWAY ]          TOKEN: #18
TABLE: T-04
================================================
QTY   ITEM DESCRIPTION
------------------------------------------------
[2]   PANEER TIKKA ROLL
      --> [MOD]: Extra Spicy
[1]   FRENCH FRIES
================================================
```

---

## 5. KDS Screen Printing Triggers

The KDS supports both automated and on-demand printing options:

1. **Auto-Print on Fire (`kds_auto_print_on_fire`):**
   - When enabled in **Settings → Features → Kitchen & KDS**, whenever a new order arrives on the KDS live screen, the terminal will automatically chime and immediately send a formatted KOT ticket to the designated station printer.
2. **Manual "Print KOT" Action:**
   - Every order card on the live KDS screen ([KdsTerminalView.tsx](file:///c:/Workspace/pos-default/app/components/kds/KdsTerminalView.tsx)) has a dedicated **"Print KOT"** button.
   - Chefs can reprint a ticket at any time by tapping the button, ensuring kitchen staff always have physical paper backup on demand.
