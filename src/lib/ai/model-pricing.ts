/**
 * Anthropic list prices (USD per 1M tokens) for the Claude models this app runs,
 * used to record the REAL dollar cost of each call into AIUsage so credit
 * pricing can be reconciled against actual spend (admin AI-spend view).
 *
 * Cache writes bill ≈ 1.25× input, cache reads ≈ 0.1× input. Uncached input
 * (Anthropic `usage.input_tokens`) is billed at the full input rate.
 *
 * Source: platform.claude.com pricing (Haiku 4.5 $1/$5, Sonnet $3/$15,
 * Opus 4.8 $5/$25 per 1M in/out). Keep in sync when models/prices change.
 */
const MODEL_PRICING: Array<{ match: RegExp; in: number; out: number }> = [
  { match: /haiku/i, in: 1, out: 5 },
  { match: /sonnet/i, in: 3, out: 15 },
  { match: /opus/i, in: 5, out: 25 },
];

/** Per-1M input/output USD rates for a model id (defaults to the cheapest tier). */
export function priceForModel(model: string): { in: number; out: number } {
  return MODEL_PRICING.find((p) => p.match.test(model)) ?? MODEL_PRICING[0];
}

/**
 * Real cost of a Claude call in whole cents (rounded). `inputTokens` is the
 * UNCACHED input; cache reads bill at ~0.1× and cache writes at ~1.25×.
 */
export function computeClaudeCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheCreationTokens = 0,
): number {
  const p = priceForModel(model);
  const usd =
    (inputTokens * p.in +
      outputTokens * p.out +
      cacheReadTokens * p.in * 0.1 +
      cacheCreationTokens * p.in * 1.25) /
    1_000_000;
  return Math.round(usd * 100);
}
