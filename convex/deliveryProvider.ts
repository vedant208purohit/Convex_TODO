/**
 * Delivery Provider Abstraction & Porter 3PL Integration Layer
 */

export type DeliveryStatus =
  | "pending"
  | "open"
  | "accepted"
  | "live"
  | "ended"
  | "cancelled"
  | "failed";

export type DeliveryProviderType = "porter" | "internal" | "custom";

export const TERMINAL_STATUSES = new Set<DeliveryStatus>([
  "ended",
  "cancelled",
  "failed",
]);

const PROGRESSION_ORDER: Record<DeliveryStatus, number> = {
  pending: 0,
  open: 1,
  accepted: 2,
  live: 3,
  ended: 4,
  cancelled: 5,
  failed: 5,
};

/**
 * Validates whether a state transition from `currentStatus` to `nextStatus` is permissible.
 * Enforces monotonic forward progression (no regressing backwards) and terminal locks.
 */
export function isValidTransition(
  currentStatus: DeliveryStatus,
  nextStatus: DeliveryStatus
): boolean {
  if (currentStatus === nextStatus) return true;
  if (TERMINAL_STATUSES.has(currentStatus)) return false; // Terminal states cannot change

  // Any non-terminal status can transition to cancelled or failed
  if (nextStatus === "cancelled" || nextStatus === "failed") {
    return true;
  }

  // Forward progression along the standard dispatch lifecycle
  const currentRank = PROGRESSION_ORDER[currentStatus];
  const nextRank = PROGRESSION_ORDER[nextStatus];

  return nextRank > currentRank && nextRank <= 4;
}

/**
 * Returns true if the delivery attempt is in a terminal state.
 */
export function isTerminalStatus(status: DeliveryStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Maps raw provider status strings (e.g. from Porter) to canonical POS delivery statuses.
 */
export function mapPorterStatusToCanonical(porterStatus: string): DeliveryStatus {
  const normalized = (porterStatus || "").trim().toLowerCase();
  switch (normalized) {
    case "open":
    case "created":
    case "reopen":
    case "order.reopen":
      return "open";
    case "accepted":
    case "driver_assigned":
    case "order.accepted":
    case "order_accepted":
      return "accepted";
    case "live":
    case "started":
    case "in_transit":
    case "start_trip":
    case "start-trip":
    case "starttrip":
    case "order.start_trip":
    case "order_start_trip":
      return "live";
    case "ended":
    case "completed":
    case "delivered":
    case "end_job":
    case "end-job":
    case "endjob":
    case "order.end_job":
    case "order_end_job":
      return "ended";
    case "cancel":
    case "cancelled":
    case "canceled":
    case "order.cancel":
    case "order_cancel":
      return "cancelled";
    case "failure":
    case "failed":
      return "failed";
    default:
      return "open";
  }
}

/**
 * Strips secrets, auth tokens, and sensitive headers from snapshot logs.
 */
export function sanitizePayload(data: any): any {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizePayload);

  const sanitized: Record<string, any> = {};
  const SENSITIVE_KEYS = new Set([
    "x-api-key",
    "apikey",
    "api_key",
    "token",
    "secret",
    "authorization",
    "password",
  ]);

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ----------------------------------------------------
// PORTER 3PL API CLIENT HELPERS
// ----------------------------------------------------

export interface PorterQuoteRequest {
  pickup: { lat: number; lng: number };
  drop: { lat: number; lng: number };
  customer: {
    name: string;
    mobile: { country_code: string; number: string };
  };
}

export interface PorterQuoteResponse {
  vehicles?: Array<{
    type: string;
    eta?: number;
    fare?: {
      minor_amount: number;
      currency?: string;
    };
  }>;
  [key: string]: any;
}

export interface PorterCreateOrderPayload {
  request_id: string;
  additional_comments?: string;
  delivery_instructions?: {
    instructions_list: Array<{ type: string; description: string }>;
  };
  pickup_details: {
    address: {
      apartment_address?: string;
      street_address1?: string;
      street_address2?: string;
      landmark?: string;
      city?: string;
      state?: string;
      pincode?: string;
      country?: string;
      lat?: number;
      lng?: number;
      contact_details?: {
        name?: string;
        phone_number?: string;
      };
    };
  };
  drop_details: {
    address: {
      apartment_address?: string;
      street_address1?: string;
      street_address2?: string;
      landmark?: string;
      city?: string;
      state?: string;
      pincode?: string;
      country?: string;
      lat?: number;
      lng?: number;
      contact_details?: {
        name?: string;
        phone_number?: string;
      };
    };
  };
}

export interface PorterCreateOrderResponse {
  order_id?: string;
  tracking_url?: string;
  estimated_fare_details?: {
    minor_amount?: number;
    currency?: string;
  };
  partner_info?: {
    name?: string;
    phone?: string;
    vehicle_number?: string;
    vehicle_type?: string;
    location?: { lat?: number; long?: number };
  };
  estimated_pickup_time?: number;
  [key: string]: any;
}

/**
 * Calls Porter /v1/get_quote
 */
export async function requestPorterQuote(
  params: PorterQuoteRequest,
  config?: { host?: string; apiKey?: string }
): Promise<PorterQuoteResponse> {
  const host = config?.host || process.env.PORTER_HOST || "https://p-apigw.porter.in";
  const apiKey = config?.apiKey || process.env.PORTER_API_KEY || "";

  if (!apiKey) {
    throw new Error("Missing PORTER_API_KEY environment variable.");
  }

  const response = await fetch(`${host}/v1/get_quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      pickup_details: {
        lat: params.pickup.lat,
        lng: params.pickup.lng,
      },
      drop_details: {
        lat: params.drop.lat,
        lng: params.drop.lng,
      },
      customer: {
        name: params.customer.name,
        mobile: {
          country_code: params.customer.mobile.country_code.replace("+", ""),
          number: params.customer.mobile.number,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Porter get_quote failed [${response.status}]: ${errorBody}`);
  }

  return (await response.json()) as PorterQuoteResponse;
}

/**
 * Calls Porter /v1/orders/create
 */
export async function createPorterOrder(
  payload: PorterCreateOrderPayload,
  config?: { host?: string; apiKey?: string }
): Promise<PorterCreateOrderResponse> {
  const host = config?.host || process.env.PORTER_HOST || "https://p-apigw.porter.in";
  const apiKey = config?.apiKey || process.env.PORTER_API_KEY || "";

  if (!apiKey) {
    throw new Error("Missing PORTER_API_KEY environment variable.");
  }

  const response = await fetch(`${host}/v1/orders/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      responseData?.message ||
      responseData?.error ||
      `Porter order creation failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return responseData as PorterCreateOrderResponse;
}

/**
 * Calls Porter /v1/orders/:order_id/cancel
 */
export async function cancelPorterOrder(
  providerOrderId: string,
  config?: { host?: string; apiKey?: string }
): Promise<any> {
  const host = config?.host || process.env.PORTER_HOST || "https://p-apigw.porter.in";
  const apiKey = config?.apiKey || process.env.PORTER_API_KEY || "";

  if (!apiKey) {
    throw new Error("Missing PORTER_API_KEY environment variable.");
  }

  const response = await fetch(`${host}/v1/orders/${providerOrderId}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Porter order cancellation failed [${response.status}]: ${errorBody}`);
  }

  return await response.json().catch(() => ({ success: true }));
}

/**
 * Calls Porter /v1.1/orders/:order_id (Tracking)
 */
export async function trackPorterOrder(
  providerOrderId: string,
  config?: { host?: string; apiKey?: string }
): Promise<any> {
  const host = config?.host || process.env.PORTER_HOST || "https://p-apigw.porter.in";
  const apiKey = config?.apiKey || process.env.PORTER_API_KEY || "";

  if (!apiKey) {
    throw new Error("Missing PORTER_API_KEY environment variable.");
  }

  const response = await fetch(`${host}/v1.1/orders/${providerOrderId}`, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Porter track order failed [${response.status}]: ${errorBody}`);
  }

  return await response.json();
}
