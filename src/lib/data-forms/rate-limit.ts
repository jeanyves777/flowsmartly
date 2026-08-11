/**
 * Rate limiting for the unauthenticated public form routes.
 *
 * Three properties the previous in-memory limiter did not have:
 *
 *  1. **Atomic.** Admission and recording are the same database statement — an
 *     increment that returns the new count. The old code checked a map, awaited
 *     the database, then recorded, so a concurrent burst was admitted wholesale
 *     before any of it was counted.
 *  2. **Shared.** The counters live in the database, so every process serving
 *     the route sees the same numbers and a restart does not reset them.
 *  3. **Bounded.** Fixed windows put the window start in the key, so a bucket is
 *     a single row that stops being written to when the window rolls, and old
 *     rows are deleted by expiry rather than by pruning growing arrays.
 *
 * The store is injectable so the window and admission logic can be tested
 * without a database.
 */

export interface RateCounterStore {
  /** Increment the bucket and return its NEW count. Must be atomic. */
  increment(bucketKey: string, expiresAt: Date): Promise<number>;
  /** Delete counters whose window has passed. */
  sweep(now: Date): Promise<void>;
}

export interface RateRule {
  /** Namespace, so two limits never share a bucket. */
  scope: string;
  /** Requests allowed per window. */
  max: number;
  windowSeconds: number;
}

export interface RateDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  count: number;
}

export function bucketKey(rule: RateRule, identity: string, now: Date): string {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(now.getTime() / windowMs) * windowMs;
  return `${rule.scope}|${identity}|${windowStart}`;
}

function windowEnd(rule: RateRule, now: Date): Date {
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(now.getTime() / windowMs) * windowMs;
  return new Date(windowStart + windowMs);
}

/**
 * Count this request and say whether it is allowed. The increment happens
 * first and unconditionally, so concurrent callers each observe their own
 * position in the window and cannot all be admitted at once.
 */
export async function consumeRate(
  store: RateCounterStore,
  rule: RateRule,
  identity: string,
  now: Date = new Date()
): Promise<RateDecision> {
  const expiresAt = windowEnd(rule, now);
  const count = await store.increment(bucketKey(rule, identity, now), expiresAt);
  const allowed = count <= rule.max;
  return {
    allowed,
    count,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

/** The limits applied to the public respondent flow. */
export const RATE_RULES = {
  /** Asking for a code — the expensive, email-sending step. */
  challengeStart: { scope: "df:start", max: 5, windowSeconds: 15 * 60 } as RateRule,
  /** Guessing a code. Six digits, so redemption must be tightly capped. */
  challengeVerify: { scope: "df:verify", max: 10, windowSeconds: 15 * 60 } as RateRule,
  /** Using a session that was already earned; generous, it is authenticated. */
  session: { scope: "df:session", max: 60, windowSeconds: 15 * 60 } as RateRule,
} as const;
