/**
 * FlowShop domain pricing and plan constants.
 * Maps TLDs to OpenSRS cost and FlowSmartly retail prices.
 */

// ── Plan Pricing ──

export const ECOM_BASIC_PRICE_CENTS = 500;   // $5/month
export const ECOM_PRO_PRICE_CENTS = 1200;    // $12/month

export type EcomPlan = "basic" | "pro";

export const ECOM_PLAN_NAMES: Record<EcomPlan, string> = {
  basic: "FlowShop Basic",
  pro: "FlowShop Pro",
};

export const ECOM_PLAN_FEATURES: Record<EcomPlan, string[]> = {
  basic: [
    "Full AI-powered store",
    "AI Store Builder autopilot",
    "Product management with AI content",
    "Google Trends & product discovery",
    "Competitor pricing & dynamic pricing",
    "Ad feed integration",
    "Mobile-first storefront",
    "AI product recommendations",
    "Region-aware payments",
    "Free FlowSmartly subdomain",
    "Connect your own domain (BYOD)",
  ],
  pro: [
    "Everything in Basic",
    "1 FREE domain included",
    "Domain auto-configured + SSL",
    "WHOIS privacy protection",
    "Priority AI processing",
    "Advanced analytics dashboard",
    "AI customer support chatbot",
    "Abandoned cart recovery emails",
    "Auto domain renewal (free while subscribed)",
  ],
};

// ── Trial Configuration ──

export const ECOM_BASIC_TRIAL_DAYS = 30;
export const ECOM_PRO_TRIAL_DAYS = 14;
export const ECOM_TRIAL_REMINDER_SCHEDULE = [
  { daysRemaining: 5, key: "day25" },
  { daysRemaining: 2, key: "day28" },
];

// ── Domain Pricing ──

export interface DomainPrice {
  costCents: number;    // Our cost from OpenSRS
  retailCents: number;  // What user pays
}

export const DOMAIN_PRICING: Record<string, DomainPrice> = {
  com:    { costCents: 1011, retailCents: 1499 },
  store:  { costCents: 300,  retailCents: 999 },
  shop:   { costCents: 1100, retailCents: 1699 },
  online: { costCents: 300,  retailCents: 999 },
  co:     { costCents: 1000, retailCents: 1499 },
  net:    { costCents: 1100, retailCents: 1499 },
  org:    { costCents: 1000, retailCents: 1499 },
};

/**
 * TLDs we can advertise as TRULY FREE — wholesale cost to FlowSmartly is
 * $0 (sponsored/promo deal etc.). Empty by default — every TLD in
 * DOMAIN_PRICING has a non-zero costCents (cheapest is .store / .online at
 * $3/yr from OpenSRS), so we can't honestly call any of them free.
 *
 * Populate this list ONLY when a registry actually gives us a zero-cost
 * TLD. The search endpoint reads this + a user-eligibility check before
 * returning `isFreeEligible: true`. The purchase endpoint rejects
 * `isFree: true` for any TLD not in this list.
 */
export const TRULY_FREE_TLDS: string[] = [];

/**
 * Historical / marketing alias kept for legacy callers + UI copy. Do NOT
 * use this for eligibility gating — use TRULY_FREE_TLDS instead.
 * @deprecated use TRULY_FREE_TLDS for gating.
 */
export const FREE_DOMAIN_TLDS = TRULY_FREE_TLDS;

/** Maximum yearly value for free domain — only meaningful when a TLD is in TRULY_FREE_TLDS. */
export const FREE_DOMAIN_MAX_VALUE_CENTS = 1499;

/** All supported TLDs for search */
export const SUPPORTED_TLDS = Object.keys(DOMAIN_PRICING);

/** Get retail price for a TLD in cents, returns null if unsupported */
export function getDomainRetailPrice(tld: string): number | null {
  const pricing = DOMAIN_PRICING[tld.toLowerCase()];
  return pricing ? pricing.retailCents : null;
}

/**
 * Check if a TLD is eligible for a truly-free claim (no wholesale cost to
 * FlowSmartly). Currently returns false for every TLD until we close a
 * sponsored deal — see TRULY_FREE_TLDS.
 */
export function isFreeDomainEligible(tld: string): boolean {
  return TRULY_FREE_TLDS.includes(tld.toLowerCase());
}

/** Format cents to dollar string */
export function formatDomainPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
