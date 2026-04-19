/**
 * Validate redirect URLs to prevent open-redirect attacks.
 *
 * Rules:
 * - Relative paths starting with "/" are always safe (same-origin).
 * - Absolute URLs must parse AND their hostname must match an allowed host.
 * - Anything else returns the fallback.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";

function appHost(): string {
  try {
    return new URL(APP_URL).host.toLowerCase();
  } catch {
    return "flowsmartly.com";
  }
}

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Returns the URL if it is safe to redirect to, otherwise returns the fallback.
 *
 * @param url - candidate redirect target (may be relative or absolute, may be undefined)
 * @param allowedHosts - extra hostnames allowed beyond the app host (e.g. a store's custom domain)
 * @param fallback - absolute URL to return when the candidate is invalid
 */
export function sanitizeRedirectUrl(
  url: string | undefined | null,
  allowedHosts: string[] = [],
  fallback: string = APP_URL
): string {
  if (!url) return fallback;

  // Same-origin relative path
  if (url.startsWith("/") && !url.startsWith("//")) {
    return url;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fallback;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return fallback;
  }

  const host = parsed.host.toLowerCase();
  const allow = new Set<string>([appHost(), ...allowedHosts.map((h) => h.toLowerCase())]);

  if (isDev()) {
    allow.add("localhost");
    allow.add("127.0.0.1");
  }

  // Exact host match
  if (allow.has(host)) return parsed.toString();

  // Strip port for comparison (e.g. localhost:3100)
  const hostNoPort = host.split(":")[0];
  if (allow.has(hostNoPort)) return parsed.toString();

  for (const allowed of allow) {
    const allowedNoPort = allowed.split(":")[0];
    if (hostNoPort === allowedNoPort) return parsed.toString();
    // Subdomain match (*.flowsmartly.com)
    if (hostNoPort.endsWith(`.${allowedNoPort}`)) return parsed.toString();
  }

  return fallback;
}

/**
 * Returns true if the URL is an allowed redirect target. Convenience wrapper.
 */
export function isSafeRedirectUrl(
  url: string | undefined | null,
  allowedHosts: string[] = []
): boolean {
  if (!url) return false;
  return sanitizeRedirectUrl(url, allowedHosts, "__INVALID__") !== "__INVALID__";
}
