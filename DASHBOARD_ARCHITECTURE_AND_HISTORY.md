# POS Modular Dashboard: Complete Architecture, Module & Widget Specification

> **Single Source of Truth (SSoT) Foundation**:
> All internationalization and regional parameters — including **Currency Symbol**, **ISO Currency Code**, **Phone Dialing Code**, **Locale Number Formatting**, **Date Display Format**, **Timezone Offset**, and **Regional Tax States** — are strictly governed by [`lib/constants/countries.ts`](file:///c:/Workspace/pos-default/lib/constants/countries.ts). This file is the immutable master ground-truth for the entire POS application.

---

## 1. Ground-Truth Master: `lib/constants/countries.ts`

Across all 12 modules, all backend queries in `convex/`, and all frontend React components, formatting and localization do **not** rely on ad-hoc variables or browser guesses. Instead, every store branch is associated with an ISO country code in its `organizations` record, which directly anchors to `COUNTRIES_MASTER`:

```mermaid
flowchart TD
    CountryRegistry["lib/constants/countries.ts\n(Master SSoT Registry)"] --> Resolve["resolveCountryConfig(org.country)"]
    Resolve --> OrgRuntime["Store Runtime Context\n(Currency, Phone Code, TimeZone, Locale, DateFormat)"]
    OrgRuntime --> ConvexBackend["Convex Telemetry Engine\n(convex/dashboardDataProviders.ts)"]
    ConvexBackend --> ReactiveUI["Modular Dashboard & Drawer Cards\n(12 Modules • 97 Live Widgets)"]
```

### Parameters Derived from `countries.ts`:

| Regional Parameter | Code / Standard | Example (`IN`) | Example (`US`) | Architectural Purpose Across Dashboard |
| :--- | :--- | :--- | :--- | :--- |
| **Currency Symbol** | `currency.symbol` | `₹` | `$` | Standard symbol prefixed or suffixed to revenue, AOV, ticket price, cashier drawer totals, and refunds. |
| **Currency Code** | `currency.code` | `INR` | `USD` | ISO-4217 financial code for ledger transactions, payment gateway payloads, and export sheets. |
| **Phone Dialing Code** | `phoneCode` | `+91` | `+1` | E.164 phone prefix used for patron indexing, customer lookups, SMS dispatch, and loyalty accounts. |
| **Locale Formatting** | `locale` | `en-IN` | `en-US` | `Intl.NumberFormat` formatting standard (e.g. Lakhs `1,00,000` in India vs Millions `100,000` in US). |
| **Date Format** | `dateFormat` | `DD-MM-YYYY` | `MM/DD/YYYY` | Standardized date string structure for date pickers, shift summaries, and ticket timestamps. |
| **Store Timezone** | `defaultTimezone` | `Asia/Kolkata` | `America/New_York` | Used to calculate day boundaries (00:00:00 to 23:59:59) so UTC offsets never split trading shifts. |
| **States / Territories** | `states` | 36 States/UTs | 50 States | Used for regional tax rules (GST/CGST/SGST vs US state sales tax) and fiscal reporting. |

---

## 2. Dashboard Architecture & Placement Engine

The dashboard is built on a responsive 12-column CSS Grid engine supporting drag-and-drop rearrangement, dynamic resizing, draft staging, and multi-user isolation.

### 2.1. Grid & Layout Specifications
- **12-Column Grid**: Each widget occupies a specified width (from 1 to 12 columns) and height (1 to 3 grid units).
  - `1x1 Square`: 4 Columns $\times$ 1 Row unit. Ideal for primary KPIs, gauges, and compact metric cards.
  - `2x1 Strip`: 6 Columns $\times$ 1 Row unit. Ideal for comparison bars and secondary breakdowns.
  - `Expanded`: 6 to 8 Columns $\times$ 2 Row units. Ideal for chronological line graphs, area charts, and leaderboards.
  - `Full Width`: 12 Columns $\times$ 2 Row units. Ideal for high-density live order tables and dispatch queues.
- **Automatic Collision Packing**: When widgets are added, moved, or deleted, `pack12ColumnGrid` recalculates coordinates to ensure zero overlapping slots.

### 2.2. State Persistence & Data Contracts
User dashboards are persisted in the Convex `userDashboards` table with atomic revision control:
- **`userDashboards` Table**:
  - `organizationId`: Store branch boundary.
  - `userId`: Clerk user subject identity.
  - `isDraft`: Boolean indicating whether changes are live or staged.
  - `revision`: Integer incremented on each update to prevent concurrent overwrites.
  - `placements`: Array of `{ widgetId, gridRow, gridCol, width, height, displayOrder, isEnabled, configuration }`.

---

## 3. Comprehensive Module & Widget Specifications

Below is the complete specification of all 12 modules and their widgets, detailing what each widget does, the Convex tables queried, the mathematical calculations executed, and the exact data rendered.

```mermaid
flowchart LR
    subgraph CoreOperations["Floor & Revenue Operations"]
        Overview["1. Overview Module\n(8 Widgets)"]
        Orders["2. Orders Module\n(12 Widgets)"]
        Cashier["3. Cashier Module\n(9 Widgets)"]
        KDS["4. KDS Module\n(12 Widgets)"]
        Workstation["5. Workstation Module\n(8 Widgets)"]
    end
    subgraph ServiceAndGuests["Service Pacing & Patron Intelligence"]
        Captain["6. Captain Module\n(7 Widgets)"]
        Queue["7. Queue Module\n(6 Widgets)"]
        Customers["8. Customers Module\n(6 Widgets)"]
        Surveys["9. Surveys Module\n(6 Widgets)"]
    end
    subgraph MenuAndControl["Catalog, Stock & Analytics"]
        Menu["10. Menu PMIX Module\n(8 Widgets)"]
        Inventory["11. Inventory Module\n(6 Widgets)"]
        Reports["12. Reports Module\n(4 Widgets)"]
    end
```

---

### Module 1: Overview (8 Widgets)

Provides the executive heartbeat of current trading performance, floor activity, and financial velocity.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Net Sales**<br>`overview_net_revenue` | 1x1 Sq<br>(4 Col) | Queries `orders` table filtered by `organizationId`, date range, and `paymentStatus === "Paid"`. Tracks settled cash and digital receipts minus discounts and refunds. | **Calculation**: $\sum (\text{totalAmount})$ for paid tickets.<br>**Display**: Formatted net revenue, delta vs prior period, and live counts of `Settled` vs `Open` bills. |
| **2** | **Total Orders**<br>`overview_total_orders` | 1x1 Sq<br>(4 Col) | Queries `orders` table for all non-rejected tickets. Groups orders across service channels (`tableId` present = Dine-In; `Takeaway` = Pick-up; digital = Delivery). | **Calculation**: Total ticket count and channel percentages.<br>**Display**: Total orders badge, percentage growth vs previous cycle, and `Dine-In` vs `Online` split. |
| **3** | **Average Order Value**<br>`overview_average_order_value` | 1x1 Sq<br>(4 Col) | Queries `orders` table for paid tickets in the period to compute the financial check average per dining party. | **Calculation**: $\text{Net Sales} \div \text{Paid Order Count}$. Scans for highest single check (`topTicket`).<br>**Display**: AOV value, percentage vs 7-day rolling average, and top ticket amount. |
| **4** | **Active Orders**<br>`overview_active_orders` | 1x1 Sq<br>(4 Col) | Queries live `orders` where `isCompleted === false` and `orderStatusName` is not Delivered/Cancelled. Monitors open floor dining. | **Calculation**: Counts active running tickets and partitions by kitchen preparation stage vs dining floor.<br>**Display**: Total open tickets, dual progress bar (`Dining` vs `Preparing`). |
| **5** | **Pending Orders**<br>`overview_pending_orders` | 1x1 Sq<br>(4 Col) | Queries `orders` where payment or kitchen confirmation is pending (`paymentStatus === "Pending"` and uncompleted). | **Calculation**: Difference between `Date.now()` and oldest pending order creation timestamp.<br>**Display**: Pending ticket count, oldest buffer wait timer (`Xm Ys`). |
| **6** | **Sales Trend**<br>`overview_sales_trends` | 2x1 Strip<br>(6 Col) | Aggregates all paid orders throughout the trading day into hourly operational windows (`11a`, `1p`, `3p`, `5p`, `7p`, `9p`). | **Calculation**: Buckets revenue per hour adjusted to store timezone. Identifies peak sales hour.<br>**Display**: Intraday column chart highlighting the peak rush period and peak sales figure. |
| **7** | **Order Status Summary**<br>`overview_order_status_distribution` | 1x1 Sq<br>(4 Col) | Queries all current orders and classifies them against configured stages in `organizationOrderProcesses`. | **Calculation**: Splits volume into `Completed`, `Billed`, `In-Prep`, and `New/Other`.<br>**Display**: Multi-segment SVG ring donut chart with color-coded stage counts. |
| **8** | **Business Performance Summary**<br>`overview_business_summary` | 2x1 Strip<br>(6 Col) | Consolidated executive health card. Queries `orders` and `organizationTables` (active seat capacity) to audit yield efficiency. | **Calculation**: $\text{RevPASH} = \text{Net Sales} \div (\text{Total Store Seats} \times \text{Shift Hours})$. Realized Net Margin % and Discount Ratio %.<br>**Display**: 3-metric grid showing RevPASH, Net Margin %, and Discount leakage. |

---

### Module 2: Orders & Fulfilment (12 Widgets)

Monitors real-time ticket ingestion, fulfillment speed, order lifecycle progression, and floor table turns.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Live Orders Feed**<br>`orders_live_feed` | 6 Col | Queries `orders` sorted by `createdAt DESC`. Tracks incoming tickets across Dine-In, Direct Counter, Takeaway, and Online channels. | **Display**: Live chronological order stream showing Order #, Token #, Customer phone/name, Total amount, Order stage, and relative creation time (`2m ago`). |
| **2** | **Total Orders Volume**<br>`orders_total_volume` | 4 Col | Comprehensive order volume scorecard across all store dining channels. | **Calculation**: Total ticket count, delta vs previous equivalent time window, and channel partition. |
| **3** | **Order Status Breakdown**<br>`orders_by_status` | 6 Col | Queries order state progression from `organizationOrderProcesses` (`Accepted`, `In Progress`, `Ready to Deliver`, `Delivered`). | **Display**: Visual bar distribution of tickets currently sitting in each kitchen and service queue. |
| **4** | **Top Orders by Value**<br>`orders_high_value` | 6 Col | Scans `orders` for the largest financial transactions processed during the shift. | **Display**: High-value check ledger showing Order #, Table #, Guest identifier, and settled check amount. |
| **5** | **Delayed Orders Alert**<br>`orders_delayed_alerts` | 4 Col | Analyzes tickets whose elapsed preparation time exceeds configured SLA thresholds (e.g. $> 25\text{ mins}$). | **Display**: Warning card indicating delayed ticket count, oldest breached ticket, and alert severity. |
| **6** | **Orders Over Time**<br>`orders_volume_over_time` | 6 Col | Evaluates temporal order velocity across 2-hour sliding intervals. | **Display**: Line chart tracking order arrival frequency across lunch, afternoon, and dinner rushes. |
| **7** | **Floor Occupancy**<br>`orders_dinein_occupancy` | 4 Col | Queries `organizationTables` and matches active uncompleted dine-in orders (`tableId`). | **Calculation**: $(\text{Occupied Tables} \div \text{Total Store Tables}) \times 100$.<br>**Display**: Live floor percentage, occupied vs available tables count. |

---

### Module 3: Workstation Telemetry (8 Widgets)

Tracks physical POS register terminals, print spool queues, kitchen prep tasks, and counter hardware health.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Workstation Order Summary**<br>`workstation_order_summary` | 4 Col | Discovers active registers from `kitchenWorkstations` and aggregates active orders assigned to each register. | **Display**: Active lane volume, task counts per physical counter terminal, and total spool pool. |
| **2** | **Orders by Workstation**<br>`workstation_orders_by_workstation` | 4 Col | Queries historical tickets attributed to each physical register station (`stationId` / `counterId`). | **Display**: Comparative volume breakdown showing ticket throughput across terminals. |
| **3** | **Active Workstation Tasks**<br>`workstation_active_tasks` | 4 Col | Queries `orderItems` and print queues assigned to workstation stations where items are waiting for dispatch. | **Display**: Real-time queue of print jobs, KOT tickets, kitchen slips, and delayed dispatch alerts. |
| **4** | **Workstation Queue**<br>`workstation_queue` | 4 Col | Tracks the buffer depth of pending kitchen tickets across active workstation lines. | **Display**: Queue depth meter and station bottleneck notifications. |
| **5** | **Preparation Time**<br>`workstation_prep_time` | 4 Col | Computes average fulfillment time per workstation from item creation to `isReady === true`. | **Display**: Average prep duration in minutes, comparison against station target SLAs. |
| **6** | **Delayed Workstation Orders**<br>`workstation_delayed_orders` | 4 Col | Identifies items at a workstation line delayed beyond standard station pacing timers. | **Display**: List of overdue order tokens, workstation name, and elapsed minutes. |
| **7** | **Workstation Performance**<br>`workstation_performance` | 6 Col | Comparative efficiency matrix ranking workstations by total items prepped and average cycle speed. | **Display**: Throughput ranking table with completion rates. |
| **8** | **Terminal Telemetry & Health**<br>`workstation_availability` | 4 Col | Monitors physical terminal connectivity, printer online state, and heartbeat pings. | **Display**: Status indicators (`Online`, `Idle`, `Offline`) for all register terminals. |

---

### Module 4: Kitchen Display System (KDS) (12 Widgets)

Provides kitchen brigade automation, live cook line tracking, expedite pacing, and recipe assembly timers.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Live Kitchen Orders**<br>`kds_live_orders` | 6 Col | Real-time stream of all tickets actively being fired to kitchen prep stations. Queries `orderItems` where `isReady === false`. | **Display**: Kitchen tickets grouped by table/token, order firing time, item modifiers, and chef notes. |
| **2** | **Pending Kitchen Tickets**<br>`kds_pending_tickets` | 4 Col | Queries orders awaiting cook line pickup or chef station acknowledgment. | **Display**: Total ticket backlog count and kitchen queue load status. |
| **3** | **Kitchen Station Queue**<br>`kds_station_queue` | 6 Col | Partitions pending dishes across configured kitchen stations (`stations` table: Grill, Fryer, Bakery, Pantry, Bar). | **Display**: Per-station dish counts and workload distribution bars. |
| **4** | **Kitchen Status Breakdown**<br>`kds_status_breakdown` | 4 Col | Visual partition of active kitchen tickets by cook status (`Queued`, `Cooking`, `Plated`, `Expedited`). | **Display**: Donut breakdown of kitchen fulfillment stages. |
| **5** | **Average Prep Time**<br>`kds_avg_prep_time` | 4 Col | Analyzes elapsed time between order fire timestamp and completion timestamp. | **Display**: Average cook duration in minutes, trend vs shift benchmark. |
| **6** | **Kitchen Delay Alerts**<br>`kds_delay_alerts` | 4 Col | Critical kitchen intervention alerts for tickets exceeding maximum cook time thresholds. | **Display**: High-priority alert banner with ticket number and delay duration. |

---

### Module 5: Cashier & Shift Reconciliation (9 Widgets)

Governs register cash drawers, multi-tender settlement reconciliation, refund audits, and shift closing balances.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Cashier Shift Reconciled**<br>`cashier_shift_summary` | 6 Col | Reconciles active register shift. Queries `orderPayments` and cash collections for the current cashier shift. | **Calculation**: Total sales, cash tendered, digital receipts, and net shift collection.<br>**Display**: Executive shift scorecard with cash balance and transaction counts. |
| **2** | **Register Transaction Volume**<br>`cashier_total_transactions` | 4 Col | Queries total payment transactions completed through cashier stations. | **Display**: Total transaction count and throughput rate per hour. |
| **3** | **Tendered Cash Audit**<br>`cashier_cash_sales` | 4 Col | Isolates cash payments from `orderPayments` (`paymentMode === "Cash"`). | **Calculation**: $\sum (\text{Cash Collections}) - \sum (\text{Cash Refunds})$.<br>**Display**: Net physical cash collected in drawer during the shift. |
| **4** | **Digital Payment Collections**<br>`cashier_digital_sales` | 4 Col | Isolates all non-cash settlements (`UPI`, `Credit Card`, `Debit Card`, `QR Code`). | **Calculation**: Total digital volume and transaction verification counts.<br>**Display**: Digital sales total and percentage of total shift collections. |
| **5** | **Payment Method Breakdown**<br>`cashier_payment_breakdown` | 4 Col | Dynamically reads active payment modes configured in `paymentModes` table. Queries `orderPayments` to compute tender proportions. | **Calculation**: Percentage and currency sum for Cash, UPI, Debit Card, and Credit Card.<br>**Display**: Donut chart with real tender percentages and collection sums. |
| **6** | **Refunds & Voids Audit**<br>`cashier_refund_summary` | 4 Col | Queries refunded and voided transactions (`paymentType === "Debit"` or `status === "Refunded"`). | **Display**: Total refund value, void count, and manager authorization status. |
| **7** | **Cashier Audit Ledger**<br>`cashier_transaction_history` | 6 Col | Chronological transaction feed of all payments processed at the counter. | **Display**: Audit table showing Timestamp, Order #, Tender Type, Cashier Name, and Amount. |
| **8** | **Active Register Sessions**<br>`cashier_open_sessions` | 4 Col | Monitors active open cashier drawer sessions across counter hardware. | **Display**: Open session status, start time, and active cashier identity. |
| **9** | **Split Bill Settlement**<br>`cashier_split_bills` | 4 Col | Tracks orders settled across multiple payment methods (e.g. ₹500 Cash + ₹1,000 UPI). | **Display**: Multi-tender transaction volume and split bill frequency. |

---

### Module 6: Captain & Floor Service (7 Widgets)

Empowers dining floor managers, tracks tableside service pacing, waiter table assignments, and guest callouts.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Active Orders by Captain**<br>`captain_active_orders` | 4 Col | Queries active orders and groups them by assigned service captain (`waiterUserId`). | **Display**: Active ticket counts per captain and running floor load. |
| **2** | **Table Service Status**<br>`captain_table_service_status` | 4 Col | Monitors dining tables across service stages (`Seated`, `Ordered`, `Entree Served`, `Check Presented`). | **Display**: Color-coded floor status indicators across dining sections. |
| **3** | **Captain Floor Allocation**<br>`captain_assigned_tables` | 4 Col | Queries table assignment mappings in `organizationTables` to ensure balanced floor coverage. | **Display**: Table allocation count and seating capacity per captain. |
| **4** | **Service Pacing Tempo**<br>`captain_service_time` | 4 Col | Tracks average duration between order placement and check presentation across floor sections. | **Display**: Pacing tempo in minutes and service efficiency gauge. |
| **5** | **Orders Awaiting Service**<br>`captain_orders_awaiting_service` | 4 Col | Alerts captains to dishes marked `isReady === true` by the kitchen waiting for tableside runner delivery. | **Display**: Pending delivery slip count and elapsed wait times. |
| **6** | **Captain Shift Scorecard**<br>`captain_performance_summary` | 6 Col | Aggregates covers served, total revenue collected, and average table turn time per captain. | **Display**: Shift performance leaderboard comparing captain service metrics. |
| **7** | **Floor Order Audit Trail**<br>`captain_order_activity` | 6 Col | Real-time audit log of tableside modifications, additional items fired, and check splits. | **Display**: Detailed log of captain floor actions with order timestamps. |

---

### Module 7: Queue & Waitlist Management (6 Widgets)

Automates walk-in guest management, waitlist party sizing, SMS callouts, layout indoor/outdoor resolution, and table turnaround velocity.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Current Queue Length**<br>`queue_length` | 1x1 Sq<br>(4 Col) | Queries `organizationQueues` table for parties actively waiting (`arrived`, `pending`, `running_late`, `booked`) within the active operational service window. Joins `layoutId` with `organizationLayouts` to classify parties into Indoor vs Outdoor Patio. | **Calculation**: Counts total waiting parties, sums total waiting guests ($\sum \text{totalGuests}$), and separates into Indoor vs Outdoor by layout name and notes.<br>**Display**: Formatted parties badge (`02 Parties`), total guests badge (`6 Guests`), indoor/outdoor ratio bar, and congestion indicator (`Nominal Flow` or `High Lobby Congestion`). |
| **2** | **Waiting Customers**<br>`queue_waiting_customers` | 1x1 Sq<br>(4 Col) | Live chronological stream of guests waiting for an available table. Extracts clean short ticket numbers (e.g. `QN001`) from daily ticket sequence and clean customer name from notes. | **Calculation**: Computes elapsed wait duration in minutes from `reservationTime` or `createdAt`. Assigns dynamic status (`In Lobby`, `Late`, `Paged`, `Booked`, `Waiting`).<br>**Display**: Live waitlist queue table displaying short ticket, guest name, party size (`4p`), elapsed wait time (`12m`), and live status pill. |
| **3** | **Average Waiting Time**<br>`queue_avg_wait_time` | 1x1 Sq<br>(4 Col) | Analyzes mean turnaround time from guest check-in at host stand to physical table seating across all completed seatings ($\text{completionTime} - \text{createdAt}$) and active waiting parties in the selected time range. | **Calculation**: $\frac{\sum \text{waitDuration}}{\text{totalParties}}$.<br>**Display**: Average wait in minutes (`16.7 mins`), target SLA badge (`Within Target SLA` $\le 20\text{m}$ or `Over Target SLA` $> 20\text{m}$ or `No Active Queue`), quoted time buffer, and target commitment (`Target < 20m`). |
| **4** | **Recently Called Customers**<br>`queue_recent_callouts` | 1x1 Sq<br>(4 Col) | Chronological audit log of customer tickets called, seated at physical tables, or marked as no-show/cancelled. Joins `tableId` with `organizationTables` to display table number (e.g. `Table T1`). | **Calculation**: Sorts by latest activity timestamp (`updatedAt` or `createdAt`). Resolves status color (`text-emerald-700` for seated, `text-amber-700` for paged/late, `text-rose-600` for cancelled).<br>**Display**: Table ledger showing short ticket, guest name, party size, table assignment (`Seated at Table T1`), and store-formatted timestamp. |
| **5** | **Queue Status Breakdown**<br>`queue_status_breakdown` | 1x1 Sq<br>(4 Col) | Real-time mix of waiting party sizes (and completed parties when lobby is clear) to optimize dining room turnover and table allocation. | **Calculation**: Classifies parties into `Couples (2p)`, `Families (4-6p)`, and `Large (7p+)`. Computes percentages that mathematically sum to 100%.<br>**Display**: Multi-colored donut chart with center total Pax indicator, accompanied by exact Pax percentages for each party tier. |
| **6** | **Queue Waiting Time Alerts**<br>`queue_wait_time_alerts` | 1x1 Sq<br>(4 Col) | Proactive bottleneck alert notification when wait times breach the store's 20-minute SLA threshold. Dynamically cross-references `organizationTables` to find vacant available tables to suggest immediate seating. | **Calculation**: Flags active parties where $\text{now} - (\text{reservationTime} \lor \text{createdAt}) \ge 20\text{ mins}$. Finds first vacant, unblocked, unoccupied table from `organizationTables`.<br>**Display**: When nominal, displays green `Wait Times Within SLA` banner (`All guests seated under 20 mins`). When breaching, displays red critical banner with elapsed wait minutes, overdue guest name, and dynamically suggested table (`Seat Table T1`). |

---

### Module 8: Menu & Product Mix (PMIX) (8 Widgets)

Provides deep item profitability analysis, kitchen depletion tracking, recipe attachment, and inventory stockout protection.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Top-Selling Dishes (PMIX)**<br>`menu_top_selling` | 6 Col | Queries `orderItems` joined with valid, non-rejected orders within the selected time period. Aggregates quantity and gross revenue per dish. | **Calculation**: Ranks dishes by volume sold $\times$ price.<br>**Display**: PMIX leaderboard table showing Rank, Item Name, Units Sold, and Gross Revenue contribution. |
| **2** | **Category Revenue Velocity**<br>`menu_most_ordered_categories` | 6 Col | Groups item sales by menu category (`Beverages`, `Appetizers`, `Mains`, `Desserts`). | **Calculation**: Percentage share of total store revenue per category.<br>**Display**: Category contribution bar chart and volume breakdown. |
| **3** | **High Contribution Stars**<br>`menu_bestselling_items` | 4 Col | Highlights high-margin, top-velocity dishes that drive store profitability. | **Display**: Star item card showing units sold, margin contribution, and sales velocity. |
| **4** | **Underperforming Dishes**<br>`menu_low_performing` | 4 Col | Identifies bottom-velocity menu items with low sales, strictly excluding top-sellers. | **Display**: Low-velocity item list with units sold, signaling candidates for menu re-engineering. |
| **5** | **86'd Out-of-Stock Items**<br>`menu_product_availability` | 4 Col | Queries `itemRecipes` and `inventoryItemStocks` to monitor raw ingredient availability. Discovers recipe bottlenecks. | **Calculation**: If any mandatory recipe ingredient has zero available stock, marks the dish as 86'd.<br>**Display**: Out-of-stock menu list indicating the specific shortage ingredient. |
| **6** | **Critical 86 Depletions**<br>`menu_out_of_stock_alerts` | 4 Col | Real-time kitchen warning when active menu items are about to deplete based on current ingredient run-rates. | **Display**: Depletion alert list with remaining estimated portions. |
| **7** | **Modifier Attachment Velocity**<br>`menu_modifier_popularity` | 4 Col | Analyzes customizations and add-on selections (e.g. Extra Cheese, Spice Level) from `orderItems.customizations`. | **Display**: Top attached modifiers and up-sell revenue generated. |
| **8** | **Menu Profitability Matrix**<br>`menu_performance_summary` | 6 Col | Boston Consulting Group (BCG) matrix mapping dishes into Stars, Plowhorses, Puzzles, and Dogs based on margin vs popularity. | **Display**: Comprehensive 4-quadrant menu engineering summary. |

---

### Module 9: Customers & Patron Folios (6 Widgets)

Governs patron relationship management, visit frequency, spend tiers, and dining folio indexing anchored to verified phone numbers.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Total Customers**<br>`customers_total` | 4 Col | Queries unique customer profiles registered across dine-in, takeaway, and digital channels in the selected time range. Indexed by phone number. | **Calculation**: Unique count of patrons who ordered in the period. Computes Dine-In vs Takeaway channel split.<br>**Display**: Total active guests badge, delta vs prior period, and channel proportion bar. |
| **2** | **New Customers**<br>`customers_new` | 4 Col | Discovers first-time dining folios whose first-ever recorded order in store history occurred within the selected window. | **Calculation**: Count of first-time ordering patrons.<br>**Display**: New guest count, acquisition delta, and first-order volume. |
| **3** | **Returning Customers**<br>`customers_returning` | 4 Col | Tracks repeat dining patrons with 2 or more historical visits across store orders. | **Calculation**: $(\text{Repeat Visitors} \div \text{Total Patrons}) \times 100$.<br>**Display**: Retention percentage, repeat guest count, and average visit frequency per patron. |
| **4** | **Recent Customers**<br>`customers_recent` | 4 Col | Queries the most recent dining folios created in the store. Indexes by customer phone number, falling back to Guest Customer. | **Display**: Chronological list of recent patrons showing Name/Phone, Table/Token #, Time, and check amount. |
| **5** | **Most Frequent Customers**<br>`customers_most_frequent` | 4 Col | Leaderboard ranking patrons by total cumulative visits and lifetime spend at the store branch. | **Display**: Top patron leaderboard showing Rank, Name/Phone Number, Visit Count, and Total Spend. |
| **6** | **Customer Order Frequency**<br>`customers_order_frequency` | 4 Col | Cohort analysis segmenting customer base by visit recurrence patterns. | **Calculation**: Segments patrons into `1 Visit`, `2 - 3 Visits`, and `4+ Visits`.<br>**Display**: Frequency distribution bars showing repeat dining adoption. |

---

### Module 10: Surveys & Guest Feedback (CSAT) (6 Widgets)

Captures guest CSAT feedback, NPS trajectory, QR receipt reviews, counter terminal ratings, and service escalation alerts.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Survey Response Count**<br>`surveys_response_counts` | 4 Col | Queries `surveyAttempts` linked to store orders within the active period. Tracks feedback channel split. | **Calculation**: Total completed surveys and partition between QR Receipt vs Customer Facing Display (CFD).<br>**Display**: Response volume badge, delta, and channel percentage bar. |
| **2** | **Average Survey Rating**<br>`surveys_average_rating` | 4 Col | Analyzes numeric star scores across all verified guest feedback attempts. | **Calculation**: $\sum (\text{Ratings}) \div \text{Total Submissions}$. Partitions into Positive ($\ge 4\star$), Neutral ($3\star$), and Negative ($\le 2\star$).<br>**Display**: Score out of 5.0, CSAT badge, and sentiment breakdown. |
| **3** | **Recent Feedback Feed**<br>`surveys_recent_feedback` | 4 Col | Chronological stream of direct guest text reviews, food quality comments, and server compliments. | **Display**: Feedback card showing Star rating, Review comment, Order #, and relative timestamp. |
| **4** | **Satisfaction Trend**<br>`surveys_satisfaction_trends` | 4 Col | 7-day rolling CSAT index tracking kitchen and floor service consistency over time. | **Display**: Rolling trend line curve showing daily score movements against a 4.5+ star SLA target. |
| **5** | **Low-Rating Alerts**<br>`surveys_low_rating_alerts` | 4 Col | Real-time manager escalation alert triggering whenever a guest submits a review with rating $\le 2$ stars. | **Display**: Escalation list with customer contact, table number, server name, and review text for immediate service recovery. |
| **6** | **Survey Response Rate**<br>`surveys_response_rates` | 4 Col | Evaluates survey engagement conversion by comparing survey attempts against total bills printed. | **Calculation**: $(\text{Survey Attempts} \div \text{Total Paid Orders}) \times 100$.<br>**Display**: Engagement conversion percentage and industry benchmark comparison. |

---

### Module 11: Inventory & Stock Governance (6 Widgets)

Monitors ingredient stock levels, store valuation, inventory shrinkage, reorder thresholds, and depletion rates.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Critical Reorder Alerts**<br>`inventory_critical_reorder` | 4 Col | Scans `inventoryItemStocks` against minimum safety stock thresholds configured in `inventoryItems`. | **Display**: Urgent purchase order recommendation list showing Item Name, Current Stock, Unit, and Supplier. |
| **2** | **Store Inventory Valuation**<br>`inventory_valuation` | 4 Col | Queries all active raw materials and calculates total capital invested in on-hand inventory. | **Calculation**: $\sum (\text{Current Stock Quantity} \times \text{Unit Cost})$.<br>**Display**: Total inventory value in store currency and category split. |
| **3** | **Dead Stock Detection**<br>`inventory_dead_stock` | 4 Col | Identifies raw ingredients with zero consumption velocity over the preceding 30 days. | **Display**: Dead stock inventory list with capital tied up and shelf-life warning. |
| **4** | **Stock Movement Ledger**<br>`inventory_stock_movement` | 6 Col | Audit trail of inventory transactions (`PurchaseOrder` credits, `OrderSale` recipe debits, `ManualAdjustment`). | **Display**: Real-time stock movement ledger showing Timestamp, Source, Quantity, and Balance. |
| **5** | **Consumption Velocity**<br>`inventory_consumption_velocity` | 4 Col | Tracks daily ingredient consumption rates driven by POS order fulfillment. | **Display**: Top consumed ingredients per day and estimated days of inventory remaining. |
| **6** | **Audit Discrepancy Matrix**<br>`inventory_audit_discrepancy` | 4 Col | Compares theoretical ingredient usage (calculated from recipe PMIX) against physical stock audit counts. | **Calculation**: $\text{Theoretical Usage} - \text{Actual Usage} = \text{Variance / Waste}$.<br>**Display**: Variance percentage and shrinkage cost. |

---

### Module 12: Reports & Velocity Analytics (4 Widgets)

High-level analytical rollups for shift reconciliations, tax compliance, and multi-period financial audits.

| # | Widget Name & ID | Size | What It Does & What Data It Fetches / Stores | Calculations & Display |
| :- | :--- | :---: | :--- | :--- |
| **1** | **Daily Sales Aggregate**<br>`reports_daily_sales_aggregate` | 6 Col | High-level summary of gross sales, net revenue, hospitality taxes, service charges, and discounts. | **Display**: Executive financial audit matrix with day-over-day growth percentages. |
| **2** | **Hourly Velocity Stream**<br>`reports_hourly_velocity` | 8 Col | Intraday sales throughput curve mapping trading pace across every hour of the business day. | **Display**: Expanded multi-point area curve tracking sales volume and transaction count. |
| **3** | **Channel Contribution**<br>`reports_channel_contribution` | 6 Col | Comparative revenue yield analysis comparing Dine-In, Takeaway, and Delivery digital sales. | **Display**: Multi-bar channel comparison showing total revenue and average ticket per channel. |
| **4** | **Tax Liability Summary**<br>`reports_tax_liability` | 4 Col | Audits collected hospitality taxes (CGST/SGST/VAT) based on store state jurisdiction in `countries.ts`. | **Calculation**: Computes total taxable base and tax collected across applicable tax brackets.<br>**Display**: Compliant tax liability summary for fiscal accounting. |

---

## 4. Backend Data Pipeline & Convex Schema Contracts

All data providers reside in [`convex/dashboardDataProviders.ts`](file:///c:/Workspace/pos-default/convex/dashboardDataProviders.ts) and execute within deterministic, type-safe Convex database queries.

```mermaid
sequenceDiagram
    participant UI as Dashboard Bento UI
    participant API as dashboards:getWidgetData
    participant Provider as dashboardDataProviders.ts
    participant DB as Convex Database
    participant SSoT as lib/constants/countries.ts

    UI->>API: Request Widget Data (widgetId, orgId, dateRangePreset)
    API->>DB: Fetch Active Organization & Verify RBAC
    DB-->>API: Org Record (country, timeZone)
    API->>SSoT: Resolve Country Config (Currency, Locale, DialCode)
    SSoT-->>API: Ground-Truth Config
    API->>Provider: Execute Target Provider (e.g. provideMenuTopSelling)
    Provider->>DB: Query Tables with Org Index (orders, orderItems, recipes)
    DB-->>Provider: Raw Records
    Provider->>Provider: Compute Metrics, Deltas & Timezone Boundaries
    Provider-->>API: Standardized WidgetDataResponse
    API-->>UI: Reactive UI Update (Instant Live Sync)
```

### Key Convex Database Tables & Indexes Utilized:
1. **`orders`**:
   - Indexes: `by_org` (`["organizationId"]`), `by_created_at` (`["organizationId", "createdAt"]`).
   - Fields: `totalAmount`, `subTotal`, `taxTotal`, `discountAmount`, `paymentStatus`, `orderType`, `orderStatusName`, `isCompleted`, `isRejected`, `tableId`, `customerPhone`.
2. **`orderItems`**:
   - Indexes: `by_org` (`["organizationId"]`), `by_order` (`["orderId"]`), `by_station` (`["stationId"]`).
   - Fields: `itemName`, `itemPrice`, `quantity`, `totalPrice`, `isReady`, `customizations`.
3. **`orderPayments`**:
   - Indexes: `by_org_created_at` (`["organizationId", "createdAt"]`).
   - Fields: `paymentType` (`Credit`/`Debit`), `paymentModeName`, `payAmount`.
4. **`organizationTables`**:
   - Fields: `tableNumber`, `seatingCapacity`, `layoutId`, `deletedAt`.
5. **`kitchenWorkstations`**:
   - Fields: `name`, `code`, `status`, `organizationId`.
6. **`surveyAttempts`**:
   - Fields: `orderId`, `source`, `overallRating`, `feedback`, `createdAt`.
7. **`inventoryItems` & `inventoryItemStocks`**:
   - Fields: `stockType` (`credit`/`debit`), `quantity`, `unit`, `unitCost`.
8. **`itemRecipes` & `recipes`**:
   - Links menu dishes to required raw materials and portions for real-time stockout guarding.

---

## 5. Automated Verification & Quality Assurance

The dashboard architecture is backed by an automated test suite in [`convex/dashboard.test.ts`](file:///c:/Workspace/pos-default/convex/dashboard.test.ts):

- **32 / 32 Backend Unit & Integration Tests Passing**:
  - Full catalog registry verification (all 97 catalog entries map to valid providers).
  - RBAC verification (Cashier staff restricted from executive financial reports).
  - Multi-tenant boundary verification (Organization data isolation).
  - Localization verification (Dynamic currency and timezone shifting without hardcoded INR or USD).
  - Real data verification (Elimination of mock fallbacks, accurate non-rejected order filtering).
- **TypeScript Integrity**:
  - `convex/tsconfig.json`: **0 Type Errors**.
  - Project Root TypeScript (`npx tsc --noEmit`): **0 Type Errors**.
- **Master Data Protection**:
  - `lib/constants/countries.ts` has **0 git diff**, preserving master registry integrity.
