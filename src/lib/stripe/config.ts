/**
 * Stripe Configuration Constants
 * Separated from the Stripe client to allow importing without initializing Stripe
 */

// ── Plan configurations ──

export const PLANS = {
  STARTER: {
    name: "Starter",
    monthlyCredits: 100,
    priceCentsMonthly: 0,
    priceCentsYearly: 0,
    features: ["100 credits/month", "Email marketing", "Basic design tools", "FlowSocial feed access"],
  },
  PRO: {
    name: "Pro",
    monthlyCredits: 500,
    priceCentsMonthly: 1999,
    priceCentsYearly: 19990,
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
    stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
    features: [
      "500 credits/month",
      "AI content generation",
      "All design tools & styles",
      "Brand Identity & Logo Generator",
      "SMS & MMS marketing",
      "Ad campaigns",
    ],
  },
  BUSINESS: {
    name: "Business",
    monthlyCredits: 1500,
    priceCentsMonthly: 4999,
    priceCentsYearly: 49990,
    stripePriceIdMonthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || "",
    stripePriceIdYearly: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID || "",
    features: [
      "1,500 credits/month",
      "Everything in Pro",
      "Campaign management",
      "Analytics dashboard",
      "Priority support",
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    monthlyCredits: 5000,
    priceCentsMonthly: 14999,
    priceCentsYearly: 149990,
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || "",
    stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || "",
    features: [
      "5,000 credits/month",
      "Everything in Business",
      "White-label support",
      "Team collaboration",
      "Custom integrations",
      "Dedicated support",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

// ── Credit packages ──

export const CREDIT_PACKAGES = [
  { id: "credits_50", credits: 50, priceCents: 199, bonus: 0, label: "50 Credits" },
  { id: "credits_150", credits: 150, priceCents: 499, bonus: 0, label: "150 Credits" },
  { id: "credits_500", credits: 500, priceCents: 1499, bonus: 25, label: "500 + 25 Bonus" },
  { id: "credits_1000", credits: 1000, priceCents: 2499, bonus: 75, label: "1,000 + 75 Bonus" },
  { id: "credits_3000", credits: 3000, priceCents: 5999, bonus: 300, label: "3,000 + 300 Bonus" },
  { id: "credits_10000", credits: 10000, priceCents: 14999, bonus: 1500, label: "10,000 + 1,500 Bonus" },
] as const;
