import { v } from "convex/values";

// ==========================================
// 1. WIDGET CATEGORIES & TYPES
// ==========================================

export type WidgetCategory =
  | "Overview"
  | "Orders"
  | "Workstation"
  | "KDS"
  | "Cashier"
  | "Captain"
  | "Queue"
  | "Menu"
  | "Customers"
  | "Surveys"
  | "Inventory"
  | "Reports";

export const WIDGET_CATEGORIES: WidgetCategory[] = [
  "Overview",
  "Orders",
  "Workstation",
  "KDS",
  "Cashier",
  "Captain",
  "Queue",
  "Menu",
  "Customers",
  "Surveys",
  "Inventory",
  "Reports",
];

export type WidgetVisualType =
  | "kpi"
  | "chart"
  | "table"
  | "live_feed"
  | "alert"
  | "summary";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "current_shift"
  | "previous_shift"
  | "last_7_days"
  | "last_30_days"
  | "custom";

// Convex Validator for DateRangePreset
export const dateRangePresetValidator = v.union(
  v.literal("today"),
  v.literal("yesterday"),
  v.literal("current_shift"),
  v.literal("previous_shift"),
  v.literal("last_7_days"),
  v.literal("last_30_days"),
  v.literal("custom")
);

// Convex Validator for Placement Dimensions & Coordinates
export const placementDimensionsValidator = v.object({
  width: v.number(), // 1 to 12 columns
  height: v.number(), // 1 to 6 row units
});

// Convex Validator for Widget Grid Placement
export const widgetPlacementInputValidator = v.object({
  widgetId: v.string(),
  gridRow: v.number(),
  gridCol: v.number(),
  width: v.number(),
  height: v.number(),
  displayOrder: v.number(),
  isEnabled: v.boolean(),
  configuration: v.optional(v.any()),
  configurationVersion: v.optional(v.number()),
});

// ==========================================
// 2. CENTRALIZED WIDGET DEFINITION INTERFACE
// ==========================================

export interface WidgetSizeOption {
  width: number;
  height: number;
  label: string; // e.g., "1X1 SQUARE (4 Cols)", "6 COL DEFAULT", "8 COL EXPANDED"
}

export interface WidgetDefinition {
  widgetId: string;
  name: string;
  description: string;
  category: WidgetCategory;
  subcategory?: string;
  widgetType: WidgetVisualType;
  dataProviderKey: string;
  supportedSizes: WidgetSizeOption[];
  defaultDimensions: { width: number; height: number };
  defaultConfiguration?: Record<string, any>;
  requiredRole?: "any" | "staff" | "cashier" | "captain" | "admin";
  supportedFilters: Array<
    "date_range" | "station" | "employee" | "payment_mode" | "order_type"
  >;
  supportsDomainFilters?: boolean;
  supportsLiveUpdates: boolean;
  isEnabled: boolean;
  allowMultipleInstances?: boolean;
  catalogVersion: number;
  configurationVersion: number;
}

// ==========================================
// 3. STANDARDIZED DATA CONTRACT
// ==========================================

export interface KpiPayload {
  value: number | string;
  displayValue: string;
  unit?: string;
  label?: string;
  deltaPercent?: number; // e.g. +14.2%
  deltaLabel?: string; // vs yesterday, vs last shift
  trend?: "up" | "down" | "neutral";
  comparisonPeriod?: string;
  secondaryMetrics?: Array<{ label: string; value: string | number }>;
}

export interface ChartSeriesItem {
  label: string;
  value: number;
  percentage?: number;
  formattedValue?: string;
}

export interface ChartPayload {
  chartType: "line" | "bar" | "donut" | "area";
  type?: "line" | "bar" | "donut" | "area";
  categories?: string[]; // e.g. ["11 AM", "12 PM", "1 PM"]
  series: Array<{
    name: string;
    data: number[] | ChartSeriesItem[];
  }>;
  data?: Array<{ label: string; value: number; secondaryValue?: number }>;
  totalValue?: number | string;
  summaryLabel?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface TablePayload {
  columns: TableColumn[];
  rows: Array<Record<string, any>>;
  totalCount: number;
  page?: number;
  pageSize?: number;
}

export interface LiveFeedItem {
  id: string;
  title: string;
  subtitle?: string;
  timestamp?: number;
  timeAgo?: string;
  badge?: {
    text: string;
    variant?: "default" | "success" | "warning" | "destructive" | "neutral";
  };
  amount?: string;
  metadata?: Record<string, any>;
}

export interface LiveFeedPayload {
  items: LiveFeedItem[];
  activeCount?: number;
}

export interface AlertPayload {
  severity: "info" | "warning" | "critical";
  title: string;
  message?: string;
  count: number;
  alertCount?: number;
  items?: Array<Record<string, any>>;
  thresholdLabel?: string;
  actionUrl?: string;
}

export interface WidgetDataResponse {
  widgetId: string;
  dataVersion: number;
  lastUpdatedAt: number;
  timeZone: string;
  currency: string;
  currencySymbol: string;
  isAvailable: boolean;
  unavailableReason?: string;
  appliedFilters: {
    dateRangePreset?: DateRangePreset;
    fromTimestamp?: number;
    toTimestamp?: number;
    stationId?: string;
    employeeId?: string;
    paymentMode?: string;
    orderType?: string;
  };
  kpi?: KpiPayload;
  chart?: ChartPayload;
  table?: TablePayload;
  liveFeed?: LiveFeedPayload;
  alert?: AlertPayload;
  summary?: Record<string, any>;
}

// ==========================================
// 4. PRESET TEMPLATE DEFINITION
// ==========================================

export interface DashboardTemplatePreset {
  templateKey: string;
  name: string;
  description: string;
  categoryTag: string;
  placements: Array<{
    widgetId: string;
    gridRow: number;
    gridCol: number;
    width: number;
    height: number;
    displayOrder: number;
    isEnabled: boolean;
    configuration?: Record<string, any>;
  }>;
}

// ==========================================
// 5. GRID VALIDATION & FINANCIAL HELPERS
// ==========================================

export function validatePlacementBoundaries(
  gridCol: number,
  width: number,
  gridRow: number,
  height: number
): void {
  if (gridCol < 0 || gridCol > 11) {
    throw new Error(`gridCol must be between 0 and 11, got ${gridCol}`);
  }
  if (width < 1 || width > 12) {
    throw new Error(`width must be between 1 and 12, got ${width}`);
  }
  if (gridCol + width > 12) {
    throw new Error("Placement exceeds 12-column grid boundary.");
  }
  if (gridRow < 0) {
    throw new Error(`gridRow cannot be negative, got ${gridRow}`);
  }
  if (height < 1 || height > 24) {
    throw new Error(`height must be between 1 and 24, got ${height}`);
  }
}

export function validateWidgetConfiguration(
  widgetId: string,
  config: any
): void {
  if (config === undefined || config === null) return;
  if (typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Widget configuration must be a JSON object.");
  }
  const serialized = JSON.stringify(config);
  if (serialized.length > 10240) {
    throw new Error("Widget configuration payload exceeds maximum allowed size (10KB).");
  }
}

export function resolveStoreCurrency(org?: {
  defaultCurrency?: string;
  defaultCurrencySymbol?: string;
  country?: string;
} | null): { currency: string; currencySymbol: string } {
  if (!org) {
    return { currency: "USD", currencySymbol: "$" };
  }
  const code = (org.defaultCurrency || "").trim().toUpperCase();
  const symbol = (org.defaultCurrencySymbol || "").trim();

  if (code && symbol) {
    return { currency: code, currencySymbol: symbol };
  }
  if (code === "INR" || symbol === "₹") {
    return { currency: "INR", currencySymbol: "₹" };
  }
  if (code === "USD" || symbol === "$") {
    return { currency: "USD", currencySymbol: "$" };
  }
  if (code === "EUR" || symbol === "€") {
    return { currency: "EUR", currencySymbol: "€" };
  }
  if (code === "GBP" || symbol === "£") {
    return { currency: "GBP", currencySymbol: "£" };
  }
  if (code === "AED") {
    return { currency: "AED", currencySymbol: "AED" };
  }

  const country = (org.country || "").trim().toLowerCase();
  if (country === "india" || country === "in") {
    return { currency: code || "INR", currencySymbol: symbol || "₹" };
  }
  if (country === "united states" || country === "usa" || country === "us") {
    return { currency: code || "USD", currencySymbol: symbol || "$" };
  }
  if (country === "united arab emirates" || country === "uae") {
    return { currency: code || "AED", currencySymbol: symbol || "AED" };
  }

  return {
    currency: code || "USD",
    currencySymbol: symbol || "$",
  };
}

export function formatCurrencyPaise(
  paise: number,
  symbol?: string,
  currencyCode?: string
): string {
  const amount = (paise || 0) / 100;
  const sym = symbol !== undefined ? symbol : "₹";
  const locale = (currencyCode || "").toUpperCase() === "INR" ? "en-IN" : "en-US";
  try {
    return `${sym} ${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } catch {
    return `${sym} ${amount.toFixed(2)}`;
  }
}

export function computePercentageDelta(
  current: number,
  previous: number
): { deltaPercent?: number; deltaLabel: string; trend: "up" | "down" | "neutral" } {
  if (previous === 0) {
    if (current === 0) {
      return { deltaPercent: 0, deltaLabel: "0% vs baseline", trend: "neutral" };
    }
    return {
      deltaPercent: 100,
      deltaLabel: "+100% (new)",
      trend: "up",
    };
  }

  const rawDelta = ((current - previous) / Math.abs(previous)) * 100;
  const delta = Math.round(rawDelta * 10) / 10;
  const trend: "up" | "down" | "neutral" = delta > 0 ? "up" : delta < 0 ? "down" : "neutral";
  const deltaLabel = delta > 0 ? `+${delta}% vs last period` : `${delta}% vs last period`;

  return { deltaPercent: delta, deltaLabel, trend };
}

