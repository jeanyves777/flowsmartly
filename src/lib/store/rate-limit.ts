/**
 * Simple in-memory rate limiter for store auth endpoints.
 * Uses a sliding window counter per IP address.
 *
 * For production at scale, swap this with Redis-based rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp (ms)
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  /** Max requests per window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  login: { max: 5, windowSeconds: 60 },       // 5 login attempts per minute per IP
  register: { max: 3, windowSeconds: 60 },     // 3 registrations per minute per IP
  default: { max: 10, windowSeconds: 60 },     // 10 requests per minute per IP
};

/**
 * Check if a request should be rate-limited.
 * Returns null if OK, or a remaining-seconds number if limited.
 */
export function checkRateLimit(
  ip: string,
  action: "login" | "register" | "default" = "default"
): { limited: boolean; retryAfterSeconds?: number } {
  const config = DEFAULTS[action];
  const key = `${action}:${ip}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { limited: false };
  }

  entry.count++;

  if (entry.count > config.max) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { limited: true, retryAfterSeconds };
  }

  return { limited: false };
}
