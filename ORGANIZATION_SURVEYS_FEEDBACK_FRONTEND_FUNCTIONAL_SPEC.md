# Organization Customer Surveys & Feedback Frontend Functional Specification

## 1. Executive Summary & Domain Scope

The **Customer Surveys & Feedback Subsystem** in `pos-default` (`/surveys` and `/settings?tab=surveys`) provides restaurant owners, general managers, and guest experience teams with an integrated questionnaire builder, automated post-dining feedback collector, and real-time Net Promoter Score (NPS) analytics suite.

It bridges front-of-house order settlement with customer satisfaction tracking:
1. **Survey & Question Form Builder**: Create multi-question forms with 7 question types (Star Ratings, NPS, Multiple Choice Radio, Multi-Select Checkbox, Dropdowns, Short/Long Text, and Dates) with custom validation rules.
2. **Single-Active Survey Invariant**: Ensures exactly one active survey is live across customer touchpoints at any given time.
3. **Automated Order Receipt QR & SMS Generation**: Generates unique, order-bound feedback links (`/attempts/[attemptId]`) printed on 80mm bill receipts or dispatched via WhatsApp/SMS upon payment settlement.
4. **Public Mobile-First Guest Portal**: Zero-login, mobile-responsive survey screen (`getForRespondent` & `submit`) with client and server-side validation.
5. **Real-Time Analytics & NPS Dashboard**: Aggregates average scores, option distributions, and qualitative review feeds with date range filtering.
6. **Customer 360° Feedback History**: Connects survey responses to the guest's CRM profile (`/customers/[id]`) for VIP sentiment tracking.

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                                  Survey Administration Console                                    │
│                 [Form Builder]  •  [Question Reorder]  •  [Active State Toggle]                   │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
                                                  ▼
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                               Order Feedback Dispatch Trigger                                     │
│                [Bill Receipt QR Code]  •  [WhatsApp Post-Dine Alert]  •  [Web Store]              │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
                                                  ▼
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│                            Public Guest Response Portal (`/attempts/[id]`)                        │
│               [Star Ratings]  •  [Food Quality]  •  [Staff Service]  •  [Text Review]             │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
                                                  │
         ┌────────────────────────────────────────┴────────────────────────────────────────┐
         ▼                                                                                 ▼
+───────────────────────────────────────────────────+             +───────────────────────────────────────────────────+
│            REAL-TIME SURVEY ANALYTICS             │             │            CUSTOMER CRM PROFILE LINKAGE           │
│  • Average Rating Score & Score Distribution      │             │  • Past guest survey history (`listByCustomer`)   │
│  • Multiple Choice Percentage Breakdown           │             │  • Order-to-Feedback attribution (#ORD-1042)      │
│  • Qualitative Feedback Stream & NPS Gauges       │             │  • Unhappy guest resolution alerts                │
+───────────────────────────────────────────────────+             +───────────────────────────────────────────────────+
```

---

## 2. Navigation Hierarchy & Role-Based Access (RBAC)

### 2.1 Navigation Layout

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│  📋 Surveys & Guest Feedback Navigation (`/surveys`)                                              │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
│    ├── 📑 1. Survey Catalog & Form Manager (`/surveys`)                                           │
│    │     ├── 🟢 Active Survey Status Badge & Single-Active Toggle                                 │
│    │     ├── ➕ Create New Survey / Clone Existing Survey (`copySurveyId`)                        │
│    │     └── 📊 Total Questions Count & Published Response Counters                              │
│    │                                                                                              │
│    ├── ✏️ 2. Visual Question Builder & Editor (`/surveys/[id]/builder`)                           │
│    │     ├── 🔀 Drag-and-Drop Question Reordering (`surveyQuestions.reorder`)                    │
│    │     ├── 🏷️ 7 Supported Question Types (Numeric, Checkbox, Radio, Select, Short, Long, Date)  │
│    │     └── 🛡️ Validation Rules (Required, Min/Max Length, Numeric Bounds)                      │
│    │                                                                                              │
│    ├── 📈 3. Survey Analytics & NPS Dashboard (`/surveys/[id]/results`)                           │
│    │     ├── ⭐ Overall Guest Satisfaction & Average Rating Calculations                         │
│    │     ├── 📊 Option Frequency Charts & Distribution Graphs                                     │
│    │     └── 💬 Real-Time Qualitative Comments Stream                                            │
│    │                                                                                              │
│    └── 🧾 4. Individual Survey Response Ledger (`/surveys/[id]/responses`)                        │
│          ├── 👤 Order #, Customer Phone, Submission Date & Time                                   │
│          └── 👁️ Full Answer Sheet Inspection Drawer                                               │
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

### 2.2 RBAC Role Matrix

| Capability / Action | Store Owner / Super Admin | Store Admin | General Manager | Cashier | Floor Captain / Waiter |
|---|---|---|---|---|---|
| **Create / Edit / Clone Survey** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Reorder / Delete Questions** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Toggle Active Survey State** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **View Survey Analytics & NPS** | ✅ Full Access | ✅ Full Access | ✅ Full Access | 👁️ Read Only | ❌ Forbidden |
| **Trigger Receipt Survey QR** | ✅ Automatic | ✅ Automatic | ✅ Automatic | ✅ Auto-Print | ✅ On-Chit |
| **Public Guest Submission** | 🌐 Public Guest | 🌐 Public Guest | 🌐 Public Guest | 🌐 Public Guest | 🌐 Public Guest |

---

## 3. Data Models & Convex Schema Definitions

The Survey domain is backed by 4 relational tables in Convex:

```
+─────────────+       1:N       +──────────────────+
│   surveys   │ ─────────────── │ surveyQuestions  │
+─────────────+                 +──────────────────+
       │ 1:N                             │ 1:N
       ▼                                 ▼
+─────────────────+    1:N      +──────────────────+
│ surveyAttempts  │ ─────────── │  surveyAnswers   │
+─────────────────+             +──────────────────+
```

### 3.1 Table: `surveys`

| Field | Type | Required | Description | Constraints & Business Rules |
|---|---|---|---|---|
| `_id` | `Id<"surveys">` | Yes | Primary document identifier. | Primary Key. |
| `name` | `string` | Yes | Internal survey title (e.g. *"Dine-In Guest Feedback"*). | Required non-blank string. |
| `introduction` | `string` | Optional | Welcome text displayed on public landing page. | e.g. *"Help us improve your dining experience!"* |
| `afterSurveyContent` | `string` | Optional | Thank-you message displayed upon submission. | e.g. *"Thank you! Show this to get 10% off next visit."* |
| `active` | `boolean` | Yes | Designates the store's single active survey. | `.index("by_active", ["active"])`. Exactly 1 active survey. |
| `legacyId` | `string` | Optional | Rails PostgreSQL legacy `rapidfire_surveys.id`. | `.index("by_legacy_id", ["legacyId"])` |
| `createdAt` | `number` | Yes | Epoch creation timestamp (ms). | Immutable. |
| `updatedAt` | `number` | Yes | Epoch last modification timestamp (ms). | Updated on patches. |

### 3.2 Table: `surveyQuestions`

| Field | Type | Required | Description | Constraints & Indexing |
|---|---|---|---|---|
| `_id` | `Id<"surveyQuestions">` | Yes | Primary document identifier. | Primary Key. |
| `surveyId` | `Id<"surveys">` | Yes | Foreign key to parent survey. | `.index("by_survey_id", ["surveyId"])` |
| `type` | `union` | Yes | Question input type. | `"numeric"`, `"checkbox"`, `"radio"`, `"select"`, `"short"`, `"long"`, `"date"`. Locked if answers exist. |
| `questionText` | `string` | Yes | The prompt presented to the customer. | Required non-blank string. |
| `defaultText` | `string` | Optional | Default pre-filled input value. | Optional string. |
| `placeholder` | `string` | Optional | UI input placeholder text. | Optional string. |
| `position` | `number` | Yes | 1-indexed display order. | `.index("by_survey_position", ["surveyId", "position"])` |
| `answerOptions` | `array<string>` | Optional | Multi-choice options for radio/checkbox/select. | Cleaned non-empty strings. |
| `validationRules` | `object` | Optional | Form validation constraints. | `{ presence?: boolean, minimumLength?: number, maximumLength?: number, greaterThanOrEqualTo?: number, lessThanOrEqualTo?: number }` |
| `createdAt` | `number` | Yes | Creation timestamp (ms). | Immutable. |
| `updatedAt` | `number` | Yes | Modification timestamp (ms). | Maintained on updates. |

### 3.3 Table: `surveyAttempts`

| Field | Type | Required | Description | Constraints & Indexing |
|---|---|---|---|---|
| `_id` | `Id<"surveyAttempts">` | Yes | Primary attempt identifier. | Primary Key. |
| `surveyId` | `Id<"surveys">` | Yes | Survey being answered. | `.index("by_survey_id", ["surveyId"])` |
| `orderId` | `Id<"orders">` | Optional | Foreign key to settled order. | `.index("by_order_survey", ["orderId", "surveyId"])` |
| `customerId` | `string` | Optional | Normalized guest phone or customer ID. | `.index("by_customer_id", ["customerId"])` |
| `published` | `boolean` | Yes | `false` when draft/pending; `true` once submitted. | `.index("by_survey_published", ["surveyId", "published"])` |
| `submittedAt` | `number` | Optional | Epoch timestamp when user clicked submit. | Recorded at submission time. |
| `createdAt` | `number` | Yes | Creation timestamp (ms). | Immutable. |
| `updatedAt` | `number` | Yes | Last update timestamp (ms). | Maintained on submission. |

### 3.4 Table: `surveyAnswers`

| Field | Type | Required | Description | Constraints & Indexing |
|---|---|---|---|---|
| `_id` | `Id<"surveyAnswers">` | Yes | Primary answer identifier. | Primary Key. |
| `attemptId` | `Id<"surveyAttempts">` | Yes | Foreign key to parent attempt. | `.index("by_attempt_id", ["attemptId"])` |
| `questionId` | `Id<"surveyQuestions">` | Yes | Foreign key to answered question. | `.index("by_question_id", ["questionId"])` |
| `answerText` | `string` | Optional | Text/string answer for short, long, date, or radio. | Optional string. |
| `selectedOptions` | `array<string>` | Optional | Array of chosen choices for checkbox/multi-select. | Subset of `question.answerOptions`. |
| `numericValue` | `number` | Optional | Integer rating value for numeric questions. | Validated within range rules. |
| `createdAt` | `number` | Yes | Creation timestamp (ms). | Immutable. |
| `updatedAt` | `number` | Yes | Modification timestamp (ms). | Maintained on updates. |

---

## 4. Single-Active Survey Invariant & State Machine

To prevent customer confusion and ensure consistent QR receipt generation, the system enforces a strict **Single-Active Survey Invariant**:

```
                  [ Admin Toggles Survey B to Active: true ]
                                       │
                                       ▼
                   [ Mutation: surveys.update or create ]
                                       │
                                       ▼
            [ Atomically Deactivates Survey A (active: false) ]
            [ Sets Survey B (active: true) ]
                                       │
                                       ▼
           [ All New Order QR Codes Instantly Link to Survey B ]
```

### 4.1 Deactivation Guard Rule
* A store **cannot deactivate its only active survey** without activating another one (`throws Error: "At least one survey must be active"`).
* When a new survey is created with `active: true` or an existing survey is activated, all sibling surveys in the store are automatically patched to `active: false`.

---

## 5. Screen 1: Survey Management & Catalog (`/surveys`)

```
+-----------------------------------------------------------------------------------------------------------------------+
|  📋 Customer Surveys & Feedback                                    [ ➕ Clone Survey ]  [ ➕ Create New Survey ]         |
|  Build guest questionnaires, configure receipt QR codes, and monitor real-time guest satisfaction.                    |
+-----------------------------------------------------------------------------------------------------------------------+
|  📊 TOTAL SURVEYS       |  🟢 ACTIVE SURVEY          |  💬 TOTAL RESPONSES      |  ⭐ AVERAGE STORE RATING             |
|     3 Surveys           |     Dine-In Guest Feedback |     1,280 Published      |     4.82 / 5.0 (NPS: +74)           |
+-----------------------------------------------------------------------------------------------------------------------+
|  SURVEY NAME                  | STATUS     | QUESTIONS | RESPONSES | CREATED DATE | ACTIONS                       |
+-------------------------------+------------+-----------+-----------+--------------+-------------------------------+
| 🟢 Dine-In Guest Feedback     | ⭐ ACTIVE  | 6 Qs      | 942       | 12 Jan 2026  | [ ✏️ Edit ] [ 📊 Results ] [📋]|
| ⚪ Home Delivery Experience    | Inactive   | 4 Qs      | 338       | 04 Feb 2026  | [ Activate ] [ ✏️ Edit ] [ 📊 ] |
| ⚪ Weekend Buffet Special     | Inactive   | 5 Qs      | 0         | 01 Oct 2026  | [ Activate ] [ ✏️ Edit ] [ 🗑️ ] |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

## 6. Screen 2: Question Builder & Form Editor (`/surveys/[id]/builder`)

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|  < Back to Surveys  |  EDIT SURVEY: "Dine-In Guest Feedback"              [ 👁️ Preview ] [ 💾 Save ]|
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|  Survey Name: [ Dine-In Guest Feedback                                                          ] |
|  Intro Text:  [ Welcome to Spice Garden Bistro! Please take 1 minute to share your feedback.   ] |
|  Thank You:   [ Thank you! Your feedback helps us serve you better every day.                   ] |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|  QUESTION LIST (DRAG HANDLE TO REORDER)                                   [ ➕ Add Question ]      |
|                                                                                                   |
|  [ ☰ 1 ]  ⭐ Overall Dining Experience Rating                                     [ ✏️ ] [ 📋 ] [ 🗑️ ]|
|           Type: Numeric (Rating 1 to 5 Stars) • Required: YES                                     |
|                                                                                                   |
|  [ ☰ 2 ]  🍲 How was the food taste and temperature?                             [ ✏️ ] [ 📋 ] [ 🗑️ ]|
|           Type: Radio Choice (Excellent, Good, Average, Poor) • Required: YES                     |
|                                                                                                   |
|  [ ☰ 3 ]  🧑‍🍳 Which staff member served your table?                               [ ✏️ ] [ 📋 ] [ 🗑️ ]|
|           Type: Dropdown Select • Required: NO                                                    |
|                                                                                                   |
|  [ ☰ 4 ]  🍕 Which items did you enjoy the most?                                  [ ✏️ ] [ 📋 ] [ 🗑️ ]|
|           Type: Multi-Select Checkbox • Required: NO                                              |
|                                                                                                   |
|  [ ☰ 5 ]  💬 Any suggestions or comments for our head chef?                       [ ✏️ ] [ 📋 ] [ 🗑️ ]|
|           Type: Long Text Area • Required: NO • Max: 500 chars                                    |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

### 6.1 Supported Question Types Matrix

| Question Type | UI Input Widget | Validation Options | Analytics Render Mode |
|---|---|---|---|
| **`numeric`** | ⭐ 1–5 Star Bar / 0–10 NPS Slider | `greaterThanOrEqualTo`, `lessThanOrEqualTo`, `presence` | Mean Average Score + Distribution Histogram |
| **`radio`** | 🔘 Single-Choice Radio Group | `presence` | Percentage Doughnut / Horizontal Bar Chart |
| **`checkbox`** | ☑️ Multi-Select Checkbox List | `presence` | Frequency Count Bar Chart |
| **`select`** | 🔽 Dropdown Menu Picker | `presence` | Option Distribution Chart |
| **`short`** | 📝 Single-Line Text Input | `minimumLength`, `maximumLength`, `presence` | Chronological Card Stream |
| **`long`** | 💬 Multi-Line Feedback Textarea | `minimumLength`, `maximumLength`, `presence` | Full Review Stream with Sentiment Filter |
| **`date`** | 📅 HTML5 Calendar Datepicker | `presence` (Format: `YYYY-MM-DD`) | Date Grouping Stream |

---

## 7. Screen 3: Public Mobile Guest Survey Portal (`/attempts/[attemptId]`)

When a guest scans the QR code printed on their receipt or opens the post-dining SMS link:

```
+───────────────────────────────────────────────────────────────+
|                    SPICE GARDEN BISTRO                        |
|              Order #ORD-1042  •  Table T-04                   |
+───────────────────────────────────────────────────────────────+
| Welcome! Please take 1 minute to share your feedback.         |
+───────────────────────────────────────────────────────────────+
| 1. How would you rate your overall experience? *              |
|    [ ★ ]  [ ★ ]  [ ★ ]  [ ★ ]  [ ★ ]   (5 Stars - Excellent!) |
|                                                               |
| 2. Food Taste & Quality *                                     |
|    (●) Excellent   ( ) Good   ( ) Average   ( ) Poor          |
|                                                               |
| 3. What did you love most today?                              |
|    [✓] Flavor & Taste   [✓] Quick Service   [ ] Ambiance      |
|                                                               |
| 4. Additional comments or suggestions:                        |
|    ┌────────────────────────────────────────────────────────┐ |
|    │ The paneer tikka was outstanding! Friendly service.    │ |
|    └────────────────────────────────────────────────────────┘ |
+───────────────────────────────────────────────────────────────+
|                  [ SUBMIT GUEST FEEDBACK 🚀 ]                 |
+───────────────────────────────────────────────────────────────+
```

---

## 8. Screen 4: Real-Time Survey Results & Analytics (`/surveys/[id]/results`)

```
+-----------------------------------------------------------------------------------------------------------------------+
|  < Back to Surveys  |  ANALYTICS: "Dine-In Guest Feedback"                       [ 📥 Export CSV ] [ 📅 Date Filter ] |
+-----------------------------------------------------------------------------------------------------------------------+
|  📊 TOTAL RESPONSES     |  ⭐ AVERAGE RATING       |  👍 PROMOTERS (NPS)       |  👎 DETRACTORS                      |
|     942 Published       |     4.85 / 5.0 Stars     |     82% (772 guests)      |     3% (28 guests)                  |
+-----------------------------------------------------------------------------------------------------------------------+
|  QUESTION 1: OVERALL DINING EXPERIENCE RATING (Numeric)                                                              |
|  Average: 4.85 / 5.0                                                                                                  |
|  5 Stars: ████████████████████████████████ 82% (772)                                                                  |
|  4 Stars: ██████ 12% (113)                                                                                            |
|  3 Stars: █ 3% (29)                                                                                                   |
|  2 Stars: █ 2% (18)                                                                                                   |
|  1 Star:  ░ 1% (10)                                                                                                   |
+-----------------------------------------------------------------------------------------------------------------------+
|  QUESTION 2: FOOD TASTE & QUALITY (Radio Choice)                                                                      |
|  • Excellent: 78% (735)  |  • Good: 16% (151)  |  • Average: 4% (38)  |  • Poor: 2% (18)                            |
+-----------------------------------------------------------------------------------------------------------------------+
|  RECENT CUSTOMER COMMENTS (FEEDBACK FEED)                                                                             |
|  • "The Dal Makhani and Garlic Naan were world class!" — Table T-04 (Yesterday at 9:15 PM)                            |
|  • "Great service by waiter Rajesh. Clean tables and fast food delivery." — Table T-02 (02 Oct 2026)                   |
+-----------------------------------------------------------------------------------------------------------------------+
```

---

## 9. Convex API Backend Contracts

### 9.1 Survey Management Endpoints (`convex/surveys.ts`)

#### 1. `surveys.list`
* **Type**: `query` (Staff Access Required)
* **Response**: `Array<Doc<"surveys"> & { questionsCount: number }>` (Sorted by `createdAt: asc`).

#### 2. `surveys.get`
* **Type**: `query` (Staff Access Required)
* **Args**: `{ id: Id<"surveys"> }`
* **Response**: `Doc<"surveys"> & { questions: Array<Doc<"surveyQuestions">> }`

#### 3. `surveys.getActive`
* **Type**: `query` (Public & Staff)
* **Response**: Currently active survey record with ordered questions, or `null`.

#### 4. `surveys.create`
* **Type**: `mutation` (Staff Access Required)
* **Args**:
  ```typescript
  {
    name: string,
    introduction?: string,
    afterSurveyContent?: string,
    active?: boolean,
    copySurveyId?: Id<"surveys">,
    legacyId?: string
  }
  ```
* **Business Rule**: If `copySurveyId` is provided, automatically clones all questions from the source survey. If `active: true`, atomically deactivates all other surveys.
* **Response**: `Id<"surveys">`

#### 5. `surveys.update`
* **Type**: `mutation` (Staff Access Required)
* **Args**: `{ id: Id<"surveys">, name?: string, introduction?: string, afterSurveyContent?: string, active?: boolean }`
* **Response**: `{ success: true }`

#### 6. `surveys.remove`
* **Type**: `mutation` (Staff Access Required)
* **Args**: `{ id: Id<"surveys"> }`
* **Response**: `{ success: true }`
* **Description**: Cascades deletion to all questions, attempts, and answers.

#### 7. `surveys.getResults`
* **Type**: `query` (Staff Access Required)
* **Args**: `{ surveyId: Id<"surveys">, fromDate?: number, toDate?: number, attemptId?: Id<"surveyAttempts"> }`
* **Response**: Aggregated rating averages, score distributions, choice frequency counts, and text response lists.

---

### 9.2 Question Builder Endpoints (`convex/surveyQuestions.ts`)

#### 1. `surveyQuestions.create`
* **Type**: `mutation`
* **Args**: `{ surveyId: Id<"surveys">, type: string, questionText: string, defaultText?: string, placeholder?: string, position?: number, answerOptions?: string[], validationRules?: object }`
* **Response**: `Id<"surveyQuestions">`

#### 2. `surveyQuestions.update`
* **Type**: `mutation`
* **Args**: `{ id: Id<"surveyQuestions">, ...fields }`
* **Validation**: Throws error if attempting to alter `type` after answers exist.

#### 3. `surveyQuestions.reorder`
* **Type**: `mutation`
* **Args**: `{ surveyId: Id<"surveys">, questionIds: Array<Id<"surveyQuestions">> }`
* **Response**: `{ success: true }`

#### 4. `surveyQuestions.copy`
* **Type**: `mutation`
* **Args**: `{ questionId: Id<"surveyQuestions"> }`
* **Response**: `Id<"surveyQuestions">`

---

### 9.3 Attempt & Guest Submission Endpoints (`convex/surveyAttempts.ts`)

#### 1. `surveyAttempts.getOrCreateForOrder`
* **Type**: `mutation`
* **Args**: `{ orderId: Id<"orders">, customerId?: string, publicBaseUrl?: string }`
* **Response**: `{ attemptId: Id<"surveyAttempts">, surveyId: Id<"surveys">, published: boolean, surveyQrUrl: string }`

#### 2. `surveyAttempts.getForRespondent`
* **Type**: `query` (Public Unauthenticated)
* **Args**: `{ attemptId: Id<"surveyAttempts"> }`
* **Response**: Sanitized survey structure and current draft answers without exposing sensitive internal store data.

#### 3. `surveyAttempts.submit`
* **Type**: `mutation` (Public Unauthenticated)
* **Args**:
  ```typescript
  {
    attemptId: Id<"surveyAttempts">,
    answers: Array<{
      questionId: Id<"surveyQuestions">,
      answerText?: string,
      selectedOptions?: string[],
      numericValue?: number
    }>
  }
  ```
* **Validation**: Validates required fields (`presence`), allowed multi-choice options, numeric bounds, text lengths, and date formats.
* **Response**: `{ success: true, afterSurveyContent: string }`

---

## 10. Frontend Component Hierarchy (`pos-default/app/surveys/`)

```
pos-default/app/
├── surveys/
│   ├── page.tsx                               // Survey Catalog & Active Survey Manager
│   ├── [id]/
│   │   ├── builder/page.tsx                   // Drag-and-Drop Question Form Builder
│   │   ├── results/page.tsx                   // Analytics, NPS & Charts Dashboard
│   │   └── responses/page.tsx                 // Individual Response Sheets Ledger
├── attempts/
│   └── [attemptId]/page.tsx                   // Public Mobile Guest Feedback Portal
└── components/
    ├── SurveyTable.tsx                        // Survey catalog data table
    ├── CreateSurveyModal.tsx                  // Modal for new survey / cloning
    ├── QuestionBuilderList.tsx                // Sortable drag-and-drop question canvas
    ├── QuestionConfigDrawer.tsx               // Question type & validation rule editor
    ├── StarRatingInput.tsx                    // Interactive 5-star / NPS rating widget
    ├── SurveyAnalyticsCard.tsx                // Option frequency & distribution chart
    └── SurveyResponseSheetModal.tsx           // Guest answer sheet viewer modal
```

---

## 11. Quality Assurance & Sign-off Checklist

- [x] **Single-Active Invariant**: Strict atomic toggle preventing zero-active or multiple-active survey states.
- [x] **Locked Question Type Guard**: Prevents modifying question types once answers have been submitted.
- [x] **7 Supported Question Types**: Full support for Numeric, Radio, Checkbox, Select, Short, Long, and Date.
- [x] **Order QR Code Generation**: Idempotent `getOrCreateForOrder` generating bill receipt feedback URLs.
- [x] **Public Respondent Portal**: Sanitized zero-login guest submission with full server-side validation.
- [x] **Real-Time Analytics & NPS**: Accurate average rating, distribution histograms, and customer CRM linking.
