/**
 * Canonical Storefront URL generator for PREST POS.
 * Resolves the customer storefront URL across local dev, staging/preview, and production.
 */
export interface StorefrontUrlOptions {
  slug?: string;
  path?: string; // e.g. "/store"
  params?: Record<string, string | number | boolean | undefined | null>;
  originOverride?: string;
  customerStoreUrl?: string;
  baseDomain?: string;
  env?: "development" | "production" | "staging" | "test";
}

export function getCanonicalStorefrontUrl(options: StorefrontUrlOptions): string {
  const {
    slug,
    path = "/store",
    params = {},
    originOverride,
    customerStoreUrl,
    baseDomain,
    env,
  } = options;
  const cleanSlug = (slug || "").trim().toLowerCase();

  // 1. Resolve base origin
  const explicitOverride = originOverride || customerStoreUrl;
  const configuredOrigin = (
    explicitOverride ||
    (typeof process !== "undefined" && (
      process.env.NEXT_PUBLIC_CUSTOMER_STORE_URL ||
      process.env.NEXT_PUBLIC_DIGITAL_STORE_BASE_URL ||
      process.env.NEXT_PUBLIC_POS_USER_APP_URL
    )) ||
    ""
  ).trim().replace(/\/$/, "");

  let base = "";

  if (configuredOrigin) {
    if (configuredOrigin.includes("{slug}")) {
      base = configuredOrigin.replace("{slug}", cleanSlug || "store");
    } else {
      base = configuredOrigin;
    }
  } else if (baseDomain) {
    base = cleanSlug ? `https://${cleanSlug}.${baseDomain.replace(/^\./, "")}` : `https://${baseDomain}`;
  } else if (env === "development") {
    base = "http://localhost:3002";
  } else if (typeof window !== "undefined" && window?.location?.hostname) {
    const host = window.location.hostname;
    const port = window.location.port;

    if (host.includes("localhost") || host === "127.0.0.1") {
      // Local development
      base = port === "3002"
        ? `${window.location.protocol}//${host}:3002`
        : `http://localhost:3002`;
    } else if (host.endsWith("get-prest.com")) {
      const parts = host.split(".");
      if (parts[0].startsWith("dev-")) {
        base = `https://dev-pos-user.get-prest.com`;
      } else if (parts[0].startsWith("staging-")) {
        base = `https://staging-pos-user.get-prest.com`;
      } else if (cleanSlug) {
        base = `https://${cleanSlug}.get-prest.com`;
      } else {
        base = `https://app.get-prest.com`;
      }
    } else if (cleanSlug) {
      base = `https://${cleanSlug}.get-prest.com`;
    } else {
      base = `${window.location.protocol}//${window.location.host}`;
    }
  } else {
    // Server-side default
    base = cleanSlug ? `https://${cleanSlug}.get-prest.com` : "https://get-prest.com";
  }

  // 2. Query Parameters
  const searchParams = new URLSearchParams();

  // When using a shared host (e.g. localhost:3002, dev-pos-user.get-prest.com),
  // include store slug as query parameter `store` for slug resolution
  const isDedicatedSubdomain = cleanSlug ? base.includes(`://${cleanSlug}.`) : false;
  if (!isDedicatedSubdomain && cleanSlug) {
    searchParams.set("store", cleanSlug);
  }

  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      searchParams.set(key, String(val).trim());
    }
  }

  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const queryString = searchParams.toString();

  // If base already contains /store and cleanPath is /store, avoid duplicate /store/store
  if (base.endsWith("/store") && cleanPath === "/store") {
    return queryString ? `${base}?${queryString}` : base;
  }

  const urlWithoutQuery = `${base}${cleanPath}`;
  return queryString ? `${urlWithoutQuery}?${queryString}` : urlWithoutQuery;
}
