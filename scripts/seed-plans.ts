/**
 * Seed Plans and Credit Packages
 *
 * Run with: npm run db:seed-plans
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const plans = [
  {
    planId: "STARTER",
    name: "Starter",
    description: "Free plan with email marketing and basic tools",
    priceCentsMonthly: 0,
    priceCentsYearly: 0,
    monthlyCredits: 100,
    features: JSON.stringify([
      "100 credits/month (email)",
      "Email marketing",
      "Basic design tools",
      "FlowSocial feed access",
    ]),
    isPopular: false,
    sortOrder: 0,
    color: "#6b7280",
    icon: "Sparkles",
    isActive: true,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    stripeProductId: null,
  },
  {
    planId: "PRO",
    name: "Pro",
    description: "For creators who want AI-powered content and SMS marketing",
    priceCentsMonthly: 1999,
    priceCentsYearly: 19990,
    monthlyCredits: 300,
    features: JSON.stringify([
      "300 credits/month",
      "AI content generation",
      "All design tools & styles",
      "Brand Identity & Logo Generator",
      "SMS & MMS marketing",
      "Ad campaigns",
    ]),
    isPopular: true,
    sortOrder: 1,
    color: "#f97316",
    icon: "Zap",
    isActive: true,
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || null,
    stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || null,
    stripeProductId: process.env.STRIPE_PRO_PRODUCT_ID || null,
  },
  {
    planId: "BUSINESS",
    name: "Business",
    description: "For teams and businesses scaling their marketing efforts",
    priceCentsMonthly: 4999,
    priceCentsYearly: 49990,
    monthlyCredits: 750,
    features: JSON.stringify([
      "750 credits/month",
      "Everything in Pro",
      "Campaign management",
      "Analytics dashboard",
      "Priority support",
    ]),
    isPopular: false,
    sortOrder: 2,
    color: "#3b82f6",
    icon: "Building2",
    isActive: true,
    stripePriceIdMonthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || null,
    stripePriceIdYearly: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID || null,
    stripeProductId: process.env.STRIPE_BUSINESS_PRODUCT_ID || null,
  },
  {
    planId: "ENTERPRISE",
    name: "Enterprise",
    description: "Full-featured solution for large organizations",
    priceCentsMonthly: 14999,
    priceCentsYearly: 149990,
    monthlyCredits: 2250,
    features: JSON.stringify([
      "2,250 credits/month",
      "Everything in Business",
      "White-label support",
      "Team collaboration",
      "Custom integrations",
      "Dedicated support",
    ]),
    isPopular: false,
    sortOrder: 3,
    color: "#ef4444",
    icon: "Rocket",
    isActive: true,
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || null,
    stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || null,
    stripeProductId: process.env.STRIPE_ENTERPRISE_PRODUCT_ID || null,
  },
  {
    planId: "AGENT",
    name: "Agent",
    description: "Free plan for approved marketplace agents with full feature access",
    priceCentsMonthly: 0,
    priceCentsYearly: 0,
    monthlyCredits: 100,
    features: JSON.stringify([
      "100 credits/month (buy more as needed)",
      "Full feature access",
      "All AI tools & generators",
      "SMS & Email marketing",
      "Ad campaigns",
      "Client management dashboard",
      "Agent impersonation mode",
    ]),
    isPopular: false,
    sortOrder: 5,
    color: "#8b5cf6",
    icon: "Briefcase",
    isActive: true,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    stripeProductId: null,
  },
];

const creditPackages = [
  {
    packageId: "credits_100",
    name: "100 Credits",
    description: "Starter pack for trying things out",
    credits: 100,
    priceCents: 100,
    bonusCredits: 0,
    discountPercent: 0,
    isPopular: false,
    sortOrder: 1,
    isActive: true,
    stripePriceId: process.env.STRIPE_CREDITS_100_PRICE_ID || null,
    stripeProductId: process.env.STRIPE_CREDITS_PRODUCT_ID || null,
  },
  {
    packageId: "credits_500",
    name: "500 Credits",
    description: "Small credit pack for occasional use",
    credits: 500,
    priceCents: 500,
    bonusCredits: 0,
    discountPercent: 0,
    isPopular: false,
    sortOrder: 2,
    isActive: true,
    stripePriceId: process.env.STRIPE_CREDITS_500_PRICE_ID || null,
    stripeProductId: process.env.STRIPE_CREDITS_PRODUCT_ID || null,
  },
  {
    packageId: "credits_1000",
    name: "1,000 + 50 Bonus",
    description: "Good value for regular creators",
    credits: 1000,
    priceCents: 1000,
    bonusCredits: 50,
    discountPercent: 0,
    isPopular: false,
    sortOrder: 3,
    isActive: true,
    stripePriceId: process.env.STRIPE_CREDITS_1000_PRICE_ID || null,
    stripeProductId: process.env.STRIPE_CREDITS_PRODUCT_ID || null,
  },
  {
    packageId: "credits_2500",
    name: "2,500 + 150 Bonus",
    description: "Best value for regular creators",
    credits: 2500,
    priceCents: 2500,
    bonusCredits: 150,
    discountPercent: 0,
    isPopular: true,
    sortOrder: 4,
    isActive: true,
    stripePriceId: process.env.STRIPE_CREDITS_2500_PRICE_ID || null,
    stripeProductId: process.env.STRIPE_CREDITS_PRODUCT_ID || null,
  },
  {
    packageId: "credits_5000",
    name: "5,000 + 500 Bonus",
    description: "Great for power users",
    credits: 5000,
    priceCents: 5000,
    bonusCredits: 500,
    discountPercent: 0,
    isPopular: false,
    sortOrder: 5,
    isActive: true,
    stripePriceId: process.env.STRIPE_CREDITS_5000_PRICE_ID || null,
    stripeProductId: process.env.STRIPE_CREDITS_PRODUCT_ID || null,
  },
  {
    packageId: "credits_25000",
    name: "25,000 + 3,000 Bonus",
    description: "Maximum value for agencies and teams",
    credits: 25000,
    priceCents: 25000,
    bonusCredits: 3000,
    discountPercent: 0,
    isPopular: false,
    sortOrder: 6,
    isActive: true,
    stripePriceId: process.env.STRIPE_CREDITS_25000_PRICE_ID || null,
    stripeProductId: process.env.STRIPE_CREDITS_PRODUCT_ID || null,
  },
];

async function main() {
  console.log("Seeding plans and credit packages...\n");

  // Seed plans
  console.log("Seeding plans:");
  for (const plan of plans) {
    const result = await prisma.plan.upsert({
      where: { planId: plan.planId },
      update: plan,
      create: plan,
    });
    console.log(`  - ${result.name} (${result.planId}): $${(result.priceCentsMonthly / 100).toFixed(2)}/mo`);
  }

  // Seed credit packages
  console.log("\nSeeding credit packages:");
  for (const pkg of creditPackages) {
    const result = await prisma.creditPackage.upsert({
      where: { packageId: pkg.packageId },
      update: pkg,
      create: pkg,
    });
    console.log(`  - ${result.name}: ${result.credits} credits + ${result.bonusCredits} bonus = $${(result.priceCents / 100).toFixed(2)}`);
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error("Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
