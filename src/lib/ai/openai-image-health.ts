/**
 * OpenAI image-provider circuit breaker.
 *
 * The image router already falls back across providers (xAI → OpenAI → Gemini),
 * but when OpenAI runs out of quota EVERY image op still wastes a call on the
 * dead provider before falling through — adding latency + churn that can make
 * the design agent exhaust its turns. This breaker remembers a recent
 * `insufficient_quota` (or billing) failure and lets the order builders SKIP
 * OpenAI for a cooldown window, so the multi-provider system routes straight to
 * xAI/Gemini until OpenAI is likely healthy again.
 *
 * Process-local + best-effort. On a multi-worker box each worker learns
 * independently on its first quota hit — cheap and self-healing.
 */

const COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes
let downUntil = 0;

/** Mark OpenAI image generation/edit as temporarily unavailable. */
export function markOpenAiImageDown(reason: string): void {
  downUntil = Date.now() + COOLDOWN_MS;
  console.warn(
    `[openai-image-health] OpenAI image provider skipped for ~${Math.round(COOLDOWN_MS / 60000)}min — ${reason}`,
  );
}

/** True while OpenAI image is in cooldown (skip it in provider orders). */
export function isOpenAiImageDown(): boolean {
  return Date.now() < downUntil;
}

/** Detect the quota/billing errors that mean "OpenAI image is out for now". */
export function isOpenAiQuotaError(err: unknown): boolean {
  const s = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    s.includes("insufficient_quota") ||
    s.includes("exceeded your current quota") ||
    s.includes("billing_hard_limit") ||
    s.includes("billing hard limit") ||
    (s.includes("quota") && s.includes("openai"))
  );
}

/** Drop OpenAI from a provider order while it's down — but never to empty. */
export function withoutDownOpenAi<T extends string>(order: T[]): T[] {
  if (!isOpenAiImageDown()) return order;
  const filtered = order.filter((p) => p !== "openai");
  return filtered.length > 0 ? filtered : order;
}
