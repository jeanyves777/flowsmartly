/**
 * Stripe Setup Script
 *
 * Creates all products and prices in Stripe, then updates the database
 * with the corresponding Stripe IDs.
 *
 * Run with: npx tsx scripts/setup-stripe.ts
 */

import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("Error: STRIPE_SECRET_KEY environment variable is required");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-01-28.clover",
});

// Plan definitions
const PLANS = [
  {
    planId: "STARTER",
    name: "Starter",
    description: "Perfect for getting started with AI-powered content creation",
    monthlyCredits: 500,
    priceCentsMonthly: 0,
    priceCentsYearly: 0,
    features: [
      "500 AI credits/month",
      "Basic content generation",
      "5 scheduled posts",
      "Community support",
    ],
  },
  {
    planId: "PRO",
    name: "Pro",
    description: "For growing creators who need more power and flexibility",
    monthlyCredits: 2500,
    priceCentsMonthly: 1999, // $19.99
    priceCentsYearly: 19190, // $191.90 (20% off)
    features: [
      "2,500 AI credits/month",
      "Advanced content generation",
      "Unlimited scheduled posts",
      "Priority support",
      "Analytics dashboard",
      "Custom brand voice",
    ],
  },
  {
    planId: "BUSINESS",
    name: "Business",
    description: "For businesses scaling their social media presence",
    monthlyCredits: 10000,
    priceCentsMonthly: 4999, // $49.99
    priceCentsYearly: 47990, // $479.90 (20% off)
    features: [
      "10,000 AI credits/month",
      "All Pro features",
      "Team collaboration (5 members)",
      "White-label exports",
      "API access",
      "Dedicated account manager",
    ],
  },
  {
    planId: "ENTERPRISE",
    name: "Enterprise",
    description: "Custom solutions for large organizations",
    monthlyCredits: 50000,
    priceCentsMonthly: 14999, // $149.99
    priceCentsYearly: 143990, // $1,439.90 (20% off)
    features: [
      "50,000 AI credits/month",
      "All Business features",
      "Unlimited team members",
      "Custom integrations",
      "SLA guarantee",
      "24/7 premium support",
    ],
  },
];

// Credit package definitions
const CREDIT_PACKAGES = [
  {
    packageId: "credits_100",
    name: "100 Credits",
    description: "Small credit pack for occasional use",
    credits: 100,
    bonusCredits: 0,
    priceCents: 500, // $5.00
    discountPercent: 0,
  },
  {
    packageId: "credits_500",
    name: "500 Credits",
    description: "Popular choice for regular users",
    credits: 500,
    bonusCredits: 50,
    priceCents: 2000, // $20.00
    discountPercent: 20,
    isPopular: true,
  },
  {
    packageId: "credits_1000",
    name: "1,000 Credits",
    description: "Best value for power users",
    credits: 1000,
    bonusCredits: 150,
    priceCents: 3500, // $35.00
    discountPercent: 30,
  },
  {
    packageId: "credits_5000",
    name: "5,000 Credits",
    description: "Bulk package for heavy usage",
    credits: 5000,
    bonusCredits: 1000,
    priceCents: 15000, // $150.00
    discountPercent: 40,
  },
];

async function setupStripe() {
  console.log("========================================");
  console.log("FlowSmartly Stripe Setup");
  console.log("========================================\n");

  // ── Step 1: Create Subscription Plan Products & Prices ──
  console.log("[1/3] Creating subscription plan products...\n");

  for (const plan of PLANS) {
    // Skip free plan - no Stripe product needed
    if (plan.priceCentsMonthly === 0) {
      console.log(`  Skipping ${plan.name} (free plan)`);

      // Update database with null Stripe IDs
      await prisma.plan.upsert({
        where: { planId: plan.planId },
        update: {
          name: plan.name,
          description: plan.description,
          priceCentsMonthly: plan.priceCentsMonthly,
          priceCentsYearly: plan.priceCentsYearly,
          monthlyCredits: plan.monthlyCredits,
          features: JSON.stringify(plan.features),
          stripePriceIdMonthly: null,
          stripePriceIdYearly: null,
          stripeProductId: null,
        },
        create: {
          planId: plan.planId,
          name: plan.name,
          description: plan.description,
          priceCentsMonthly: plan.priceCentsMonthly,
          priceCentsYearly: plan.priceCentsYearly,
          monthlyCredits: plan.monthlyCredits,
          features: JSON.stringify(plan.features),
          isPopular: plan.planId === "PRO",
          sortOrder: PLANS.findIndex(p => p.planId === plan.planId),
          color: plan.planId === "PRO" ? "#8B5CF6" : plan.planId === "BUSINESS" ? "#F59E0B" : plan.planId === "ENTERPRISE" ? "#EC4899" : "#0EA5E9",
          icon: plan.planId === "PRO" ? "Zap" : plan.planId === "BUSINESS" ? "Building2" : plan.planId === "ENTERPRISE" ? "Crown" : "Sparkles",
        },
      });
      continue;
    }

    console.log(`  Creating ${plan.name} plan...`);

    // Create or retrieve product
    let product: Stripe.Product;
    const existingProducts = await stripe.products.search({
      query: `metadata['planId']:'${plan.planId}'`,
    });

    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
      console.log(`    Found existing product: ${product.id}`);

      // Update product metadata
      product = await stripe.products.update(product.id, {
        name: `FlowSmartly ${plan.name} Plan`,
        description: plan.description,
        metadata: { planId: plan.planId, monthlyCredits: String(plan.monthlyCredits) },
      });
    } else {
      product = await stripe.products.create({
        name: `FlowSmartly ${plan.name} Plan`,
        description: plan.description,
        metadata: { planId: plan.planId, monthlyCredits: String(plan.monthlyCredits) },
      });
      console.log(`    Created product: ${product.id}`);
    }

    // Create monthly price
    let monthlyPrice: Stripe.Price;
    const existingMonthlyPrices = await stripe.prices.search({
      query: `product:'${product.id}' metadata['interval']:'monthly' active:'true'`,
    });

    if (existingMonthlyPrices.data.length > 0) {
      monthlyPrice = existingMonthlyPrices.data[0];
      console.log(`    Found existing monthly price: ${monthlyPrice.id}`);
    } else {
      monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.priceCentsMonthly,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { interval: "monthly", planId: plan.planId },
      });
      console.log(`    Created monthly price: ${monthlyPrice.id} ($${(plan.priceCentsMonthly / 100).toFixed(2)}/mo)`);
    }

    // Create yearly price
    let yearlyPrice: Stripe.Price;
    const existingYearlyPrices = await stripe.prices.search({
      query: `product:'${product.id}' metadata['interval']:'yearly' active:'true'`,
    });

    if (existingYearlyPrices.data.length > 0) {
      yearlyPrice = existingYearlyPrices.data[0];
      console.log(`    Found existing yearly price: ${yearlyPrice.id}`);
    } else {
      yearlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.priceCentsYearly,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: { interval: "yearly", planId: plan.planId },
      });
      console.log(`    Created yearly price: ${yearlyPrice.id} ($${(plan.priceCentsYearly / 100).toFixed(2)}/yr)`);
    }

    // Update database
    await prisma.plan.upsert({
      where: { planId: plan.planId },
      update: {
        name: plan.name,
        description: plan.description,
        priceCentsMonthly: plan.priceCentsMonthly,
        priceCentsYearly: plan.priceCentsYearly,
        monthlyCredits: plan.monthlyCredits,
        features: JSON.stringify(plan.features),
        stripeProductId: product.id,
        stripePriceIdMonthly: monthlyPrice.id,
        stripePriceIdYearly: yearlyPrice.id,
      },
      create: {
        planId: plan.planId,
        name: plan.name,
        description: plan.description,
        priceCentsMonthly: plan.priceCentsMonthly,
        priceCentsYearly: plan.priceCentsYearly,
        monthlyCredits: plan.monthlyCredits,
        features: JSON.stringify(plan.features),
        stripeProductId: product.id,
        stripePriceIdMonthly: monthlyPrice.id,
        stripePriceIdYearly: yearlyPrice.id,
        isPopular: plan.planId === "PRO",
        sortOrder: PLANS.findIndex(p => p.planId === plan.planId),
        color: plan.planId === "PRO" ? "#8B5CF6" : plan.planId === "BUSINESS" ? "#F59E0B" : "#EC4899",
        icon: plan.planId === "PRO" ? "Zap" : plan.planId === "BUSINESS" ? "Building2" : "Crown",
      },
    });

    console.log(`    Database updated\n`);
  }

  // ── Step 2: Create Credit Package Products & Prices ──
  console.log("\n[2/3] Creating credit package products...\n");

  for (const pkg of CREDIT_PACKAGES) {
    console.log(`  Creating ${pkg.name} package...`);

    const totalCredits = pkg.credits + pkg.bonusCredits;

    // Create or retrieve product
    let product: Stripe.Product;
    const existingProducts = await stripe.products.search({
      query: `metadata['packageId']:'${pkg.packageId}'`,
    });

    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
      console.log(`    Found existing product: ${product.id}`);

      // Update product
      product = await stripe.products.update(product.id, {
        name: `FlowSmartly ${pkg.name}`,
        description: pkg.bonusCredits > 0
          ? `${pkg.credits} credits + ${pkg.bonusCredits} bonus credits`
          : `${pkg.credits} AI credits`,
        metadata: {
          packageId: pkg.packageId,
          credits: String(pkg.credits),
          bonusCredits: String(pkg.bonusCredits),
          totalCredits: String(totalCredits),
        },
      });
    } else {
      product = await stripe.products.create({
        name: `FlowSmartly ${pkg.name}`,
        description: pkg.bonusCredits > 0
          ? `${pkg.credits} credits + ${pkg.bonusCredits} bonus credits`
          : `${pkg.credits} AI credits`,
        metadata: {
          packageId: pkg.packageId,
          credits: String(pkg.credits),
          bonusCredits: String(pkg.bonusCredits),
          totalCredits: String(totalCredits),
        },
      });
      console.log(`    Created product: ${product.id}`);
    }

    // Create one-time price
    let price: Stripe.Price;
    const existingPrices = await stripe.prices.search({
      query: `product:'${product.id}' active:'true' type:'one_time'`,
    });

    if (existingPrices.data.length > 0) {
      price = existingPrices.data[0];
      console.log(`    Found existing price: ${price.id}`);
    } else {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: pkg.priceCents,
        currency: "usd",
        metadata: { packageId: pkg.packageId },
      });
      console.log(`    Created price: ${price.id} ($${(pkg.priceCents / 100).toFixed(2)})`);
    }

    // Update database
    await prisma.creditPackage.upsert({
      where: { packageId: pkg.packageId },
      update: {
        name: pkg.name,
        description: pkg.description,
        credits: pkg.credits,
        bonusCredits: pkg.bonusCredits,
        priceCents: pkg.priceCents,
        discountPercent: pkg.discountPercent,
        stripeProductId: product.id,
        stripePriceId: price.id,
        isPopular: pkg.isPopular || false,
      },
      create: {
        packageId: pkg.packageId,
        name: pkg.name,
        description: pkg.description,
        credits: pkg.credits,
        bonusCredits: pkg.bonusCredits,
        priceCents: pkg.priceCents,
        discountPercent: pkg.discountPercent,
        stripeProductId: product.id,
        stripePriceId: price.id,
        isPopular: pkg.isPopular || false,
        sortOrder: CREDIT_PACKAGES.findIndex(p => p.packageId === pkg.packageId),
      },
    });

    console.log(`    Database updated\n`);
  }

  // ── Step 3: Create Webhook Endpoint (if not exists) ──
  console.log("\n[3/3] Checking webhook endpoint...\n");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/payments/webhook`;

  if (appUrl.includes("localhost")) {
    console.log("  Skipping webhook creation for localhost");
    console.log("  Use 'stripe listen --forward-to localhost:3000/api/payments/webhook' for local testing\n");
  } else {
    const existingWebhooks = await stripe.webhookEndpoints.list({ limit: 100 });
    const existingWebhook = existingWebhooks.data.find(w => w.url === webhookUrl);

    if (existingWebhook) {
      console.log(`  Found existing webhook: ${existingWebhook.id}`);
      console.log(`  Webhook secret: ${existingWebhook.secret ? "Already configured" : "Check Stripe dashboard"}`);
    } else {
      const webhook = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: [
          "checkout.session.completed",
          "customer.subscription.created",
          "customer.subscription.updated",
          "customer.subscription.deleted",
          "invoice.paid",
          "invoice.payment_failed",
        ],
      });
      console.log(`  Created webhook: ${webhook.id}`);
      console.log(`  Webhook URL: ${webhookUrl}`);
      console.log(`\n  IMPORTANT: Copy the webhook signing secret from Stripe dashboard`);
      console.log(`  and add it to your .env file as STRIPE_WEBHOOK_SECRET`);
    }
  }

  // ── Summary ──
  console.log("\n========================================");
  console.log("Setup Complete!");
  console.log("========================================\n");

  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
  const packages = await prisma.creditPackage.findMany({ orderBy: { sortOrder: "asc" } });

  console.log("Subscription Plans:");
  for (const plan of plans) {
    const monthly = plan.priceCentsMonthly ? `$${(plan.priceCentsMonthly / 100).toFixed(2)}/mo` : "Free";
    const yearly = plan.priceCentsYearly ? `$${(plan.priceCentsYearly / 100).toFixed(2)}/yr` : "Free";
    console.log(`  ${plan.name}: ${monthly} | ${yearly} | ${plan.monthlyCredits} credits/mo`);
    if (plan.stripeProductId) {
      console.log(`    Product: ${plan.stripeProductId}`);
      console.log(`    Monthly Price: ${plan.stripePriceIdMonthly}`);
      console.log(`    Yearly Price: ${plan.stripePriceIdYearly}`);
    }
  }

  console.log("\nCredit Packages:");
  for (const pkg of packages) {
    const total = pkg.credits + pkg.bonusCredits;
    const bonus = pkg.bonusCredits > 0 ? ` (+${pkg.bonusCredits} bonus)` : "";
    console.log(`  ${pkg.name}: $${(pkg.priceCents / 100).toFixed(2)} for ${pkg.credits}${bonus} credits`);
    if (pkg.stripeProductId) {
      console.log(`    Product: ${pkg.stripeProductId}`);
      console.log(`    Price: ${pkg.stripePriceId}`);
    }
  }

  console.log("\nNext steps:");
  console.log("1. If running locally, use: stripe listen --forward-to localhost:3000/api/payments/webhook");
  console.log("2. For production, copy the webhook secret from Stripe dashboard to .env");
  console.log("3. Restart your development server to apply changes\n");

  await prisma.$disconnect();
}

setupStripe().catch(async (error) => {
  console.error("Setup failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
