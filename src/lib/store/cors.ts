/**
 * Safe CORS headers for store customer API endpoints.
 *
 * NEVER use wildcard "*" with credentials — that enables CSRF.
 * Instead, echo back the Origin only if it matches the allowlist.
 */

import { NextRequest } from "next/server";

/**
 * Build CORS headers that are safe to use with credentials.
 * Returns the request origin only if it's on the allowlist.
 */
export function safeCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin") || "";

  // Build allowlist from env + common patterns
  const allowed = new Set<string>();

  // Always allow the main app URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  allowed.add(appUrl);
  allowed.add("https://flowsmartly.com");
  allowed.add("https://www.flowsmartly.com");

  // Allow configured store origins (comma-separated)
  const storeOrigins = process.env.STORE_ALLOWED_ORIGINS || "";
  for (const o of storeOrigins.split(",").filter(Boolean)) {
    allowed.add(o.trim());
  }

  // In development, allow localhost
  if (process.env.NODE_ENV === "development") {
    allowed.add("http://localhost:3000");
    allowed.add("http://localhost:3001");
  }

  // Also allow any origin that matches a store subdomain pattern
  // e.g., https://*.flowsmartly.com or any custom domain serving a store
  const isStoreOrigin =
    allowed.has(origin) ||
    origin.endsWith(".flowsmartly.com") ||
    // Allow generated store origins (they run on different ports)
    /^https?:\/\/localhost:\d+$/.test(origin);

  if (isStoreOrigin) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
  }

  // No match — return CORS headers without credentials
  return {
    "Access-Control-Allow-Origin": "",
    "Access-Control-Allow-Credentials": "false",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
