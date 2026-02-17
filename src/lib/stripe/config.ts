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
    features: ["100 credits/month (email)", "Email marketing", "Basic design tools", "FlowSocial feed access"],
  },
  PRO: {
    name: "Pro",
    monthlyCredits: 300,
    priceCentsMonthly: 1999,
    priceCentsYearly: 19990,
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
    stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
    features: [
      "300 credits/month",
      "AI content generation",
      "All design tools & styles",
      "Brand Identity & Logo Generator",
      "SMS & MMS marketing",
      "Ad campaigns",
    ],
  },
  BUSINESS: {
    name: "Business",
    monthlyCredits: 750,
    priceCentsMonthly: 4999,
    priceCentsYearly: 49990,
    stripePriceIdMonthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || "",
    stripePriceIdYearly: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID || "",
    features: [
      "750 credits/month",
      "Everything in Pro",
      "Campaign management",
      "Analytics dashboard",
      "Priority support",
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    monthlyCredits: 2250,
    priceCentsMonthly: 14999,
    priceCentsYearly: 149990,
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || "",
    stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || "",
    features: [
      "2,250 credits/month",
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
  { id: "credits_100", credits: 100, priceCents: 100, bonus: 0, label: "100 Credits" },
  { id: "credits_500", credits: 500, priceCents: 500, bonus: 0, label: "500 Credits" },
  { id: "credits_1000", credits: 1000, priceCents: 1000, bonus: 50, label: "1,000 + 50 Bonus" },
  { id: "credits_2500", credits: 2500, priceCents: 2500, bonus: 150, label: "2,500 + 150 Bonus" },
  { id: "credits_5000", credits: 5000, priceCents: 5000, bonus: 500, label: "5,000 + 500 Bonus" },
  { id: "credits_25000", credits: 25000, priceCents: 25000, bonus: 3000, label: "25,000 + 3,000 Bonus" },
] as const;
