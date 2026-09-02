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
    color: "#6b7280",
    icon: "Sparkles",
  },
  NON_PROFIT: {
    name: "Non-Profit",
    monthlyCredits: 300,
    priceCentsMonthly: 900,
    priceCentsYearly: 9900,
    stripePriceIdMonthly: process.env.STRIPE_NONPROFIT_MONTHLY_PRICE_ID || "",
    stripePriceIdYearly: process.env.STRIPE_NONPROFIT_YEARLY_PRICE_ID || "",
    features: [
      "300 credits/month",
      "FlowAI assistant",
      "Logo generator",
      "Campaigns & surveys",
      "Brand identity",
      "Social analytics",
    ],
    color: "#10b981",
    icon: "Heart",
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
    color: "#8b5cf6",
    icon: "Zap",
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
    color: "#f59e0b",
    icon: "Briefcase",
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
    color: "#ef4444",
    icon: "Crown",
  },
} as const;

export type PlanId = keyof typeof PLANS;

