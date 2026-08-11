/**
 * In-memory rate limiting for the unauthenticated public form lookup.
 *
 * Two sliding windows per (IP, form):
 *   - every lookup counts against a generous ceiling, so one client cannot
 *     hammer the endpoint;
 *   - only *failed* lookups count against a much tighter ceiling, because a
 *     caller guessing at names misses almost every time while a real
 *     respondent typing their own name hits. This keeps a venue full of
 *     people behind a single NAT address working while still cutting off
 *     name guessing from that same address.
 *
 * This is process-local. See the honest limitations in the PR description:
 * it does not defend against a distributed caller rotating IPs, and it is not
 * shared across processes. It is defence in depth behind the real gate, which
 * is exact-name matching scoped to the form's own contact list.
 */

const WINDOW_MS = 5 * 60 * 1000;
/** Total lookups allowed per IP per form per window. */
const MAX_LOOKUPS = 30;
/** Failed lookups allowed per IP per form per window. */
const MAX_MISSES = 10;
/** Prune the whole map when it grows past this many keys. */
const SWEEP_AT_KEYS = 5000;

interface Buckets {
  all: number[];
  miss: number[];
}

// Route handlers are bundled separately in the app router, so a module-level
// Map is not shared between routes — keep the store on globalThis.
const globalForRateLimit = globalThis as unknown as {
  __dataFormLookupRateLimit?: Map<string, Buckets>;
};

const store: Map<string, Buckets> =
  globalForRateLimit.__dataFormLookupRateLimit ??
  (globalForRateLimit.__dataFormLookupRateLimit = new Map());

function prune(list: number[], cutoff: number): number[] {
  return list.filter((t) => t > cutoff);
}

function sweep(cutoff: number) {
  for (const [key, buckets] of store) {
    buckets.all = prune(buckets.all, cutoff);
    buckets.miss = prune(buckets.miss, cutoff);
    if (buckets.all.length === 0 && buckets.miss.length === 0) store.delete(key);
  }
}

function bucketsFor(key: string, cutoff: number): Buckets {
  if (store.size > SWEEP_AT_KEYS) sweep(cutoff);

  let buckets = store.get(key);
  if (!buckets) {
    buckets = { all: [], miss: [] };
    store.set(key, buckets);
  }
  buckets.all = prune(buckets.all, cutoff);
  buckets.miss = prune(buckets.miss, cutoff);
  return buckets;
}

function retryAfter(list: number[], cutoff: number): number {
  const oldest = list[0];
  if (!oldest) return Math.ceil(WINDOW_MS / 1000);
  return Math.max(1, Math.ceil((oldest - cutoff) / 1000));
}

/** The caller's IP as far as we can tell it behind the proxy. */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Record a lookup attempt and report whether it should be refused.
 * Call once per request, before touching the database.
 */
export function checkLookupRate(
  ip: string,
  formId: string
): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const buckets = bucketsFor(`${ip}:${formId}`, cutoff);

  if (buckets.miss.length >= MAX_MISSES) {
    return { limited: true, retryAfterSeconds: retryAfter(buckets.miss, cutoff) };
  }
  if (buckets.all.length >= MAX_LOOKUPS) {
    return { limited: true, retryAfterSeconds: retryAfter(buckets.all, cutoff) };
  }

  buckets.all.push(now);
  return { limited: false, retryAfterSeconds: 0 };
}

/** Record that a lookup found nothing, so guessing runs out of attempts. */
export function recordLookupMiss(ip: string, formId: string): void {
  const now = Date.now();
  const buckets = bucketsFor(`${ip}:${formId}`, now - WINDOW_MS);
  buckets.miss.push(now);
}
