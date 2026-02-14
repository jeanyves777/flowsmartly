/**
 * Stripe Integration for FlowSmartly
 *
 * Handles:
 * - Credit package purchases via Checkout Sessions
 * - Subscription plan upgrades
 * - Webhook event processing
 */

import Stripe from "stripe";
import { prisma } from "@/lib/db/client";

// Re-export configuration constants for backward compatibility
export { PLANS, CREDIT_PACKAGES, type PlanId } from "./config";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set — Stripe features will be unavailable");
}

// Only create Stripe instance if the key is available
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    })
  : null;

// ── Checkout session creation (using database) ──

export async function createCreditCheckoutSession(params: {
  userId: string;
  userEmail: string;
  packageId: string;
  stripeCustomerId?: string | null;
}) {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  // Fetch package from database
  const pkg = await prisma.creditPackage.findUnique({
    where: { packageId: params.packageId },
  });

  if (!pkg || !pkg.isActive) {
    throw new Error("Invalid or inactive credit package");
  }

  const totalCredits = pkg.credits + pkg.bonusCredits;

  // Use stored Stripe price ID if available, otherwise create ad-hoc price
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = pkg.stripePriceId
    ? { price: pkg.stripePriceId, quantity: 1 }
    : {
        price_data: {
          currency: "usd",
          unit_amount: pkg.priceCents,
          product_data: {
            name: `${totalCredits} AI Credits`,
            description: `${pkg.credits} credits${pkg.bonusCredits > 0 ? ` + ${pkg.bonusCredits} bonus credits` : ""}`,
          },
        },
        quantity: 1,
      };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [lineItem],
    metadata: {
      userId: params.userId,
      packageId: pkg.packageId,
      credits: String(pkg.credits),
      bonus: String(pkg.bonusCredits),
      type: "credit_purchase",
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings?tab=billing&payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings?tab=billing&payment=cancelled`,
  };

  if (params.stripeCustomerId) {
    sessionParams.customer = params.stripeCustomerId;
  } else {
    sessionParams.customer_email = params.userEmail;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

export async function createSubscriptionCheckoutSession(params: {
  userId: string;
  userEmail: string;
  planId: string;
  interval: "monthly" | "yearly";
  stripeCustomerId?: string | null;
}) {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  // Fetch plan from database
  const plan = await prisma.plan.findUnique({
    where: { planId: params.planId },
  });

  if (!plan || !plan.isActive) {
    throw new Error("Invalid or inactive plan");
  }

  if (params.planId === "STARTER") {
    throw new Error("Cannot subscribe to free plan");
  }

  // Get the appropriate Stripe price ID
  const priceId = params.interval === "yearly"
    ? plan.stripePriceIdYearly
    : plan.stripePriceIdMonthly;

  // Use stored Stripe price ID if available, otherwise create ad-hoc price
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        price_data: {
          currency: "usd",
          recurring: { interval: params.interval === "yearly" ? "year" : "month" },
          unit_amount: params.interval === "yearly"
            ? plan.priceCentsYearly
            : plan.priceCentsMonthly,
          product_data: { name: `FlowSmartly ${plan.name} Plan` },
        },
        quantity: 1,
      };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [lineItem],
    metadata: {
      userId: params.userId,
      planId: plan.planId,
      monthlyCredits: String(plan.monthlyCredits),
      type: "subscription",
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings?tab=billing&payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings?tab=billing&payment=cancelled`,
  };

  if (params.stripeCustomerId) {
    sessionParams.customer = params.stripeCustomerId;
  } else {
    sessionParams.customer_email = params.userEmail;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

// ── Get or create Stripe customer ──

export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// ── Create PaymentIntent for credit purchases (inline, no redirect) ──

export async function createCreditPaymentIntent(params: {
  userId: string;
  packageId: string;
  customerId: string;
  paymentMethodId: string;
}) {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  const pkg = await prisma.creditPackage.findUnique({
    where: { packageId: params.packageId },
  });

  if (!pkg || !pkg.isActive) {
    throw new Error("Invalid or inactive credit package");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: pkg.priceCents,
    currency: "usd",
    customer: params.customerId,
    payment_method: params.paymentMethodId,
    confirm: true,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
    metadata: {
      userId: params.userId,
      packageId: pkg.packageId,
      credits: String(pkg.credits),
      bonus: String(pkg.bonusCredits),
      type: "credit_purchase",
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    status: paymentIntent.status,
    paymentIntentId: paymentIntent.id,
  };
}

// ── Create Subscription inline (no redirect) ──

export async function createInlineSubscription(params: {
  userId: string;
  planId: string;
  interval: "monthly" | "yearly";
  customerId: string;
  paymentMethodId: string;
}) {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  const plan = await prisma.plan.findUnique({
    where: { planId: params.planId },
  });

  if (!plan || !plan.isActive) {
    throw new Error("Invalid or inactive plan");
  }

  if (params.planId === "STARTER") {
    throw new Error("Cannot subscribe to free plan");
  }

  // Set default payment method on customer
  await stripe.customers.update(params.customerId, {
    invoice_settings: { default_payment_method: params.paymentMethodId },
  });

  // Get the appropriate Stripe price ID or create ad-hoc
  const priceId = params.interval === "yearly"
    ? plan.stripePriceIdYearly
    : plan.stripePriceIdMonthly;

  // Build subscription items
  let subscriptionItem: Stripe.SubscriptionCreateParams.Item;
  if (priceId) {
    subscriptionItem = { price: priceId };
  } else {
    // Create a product first, then use price_data with product ID
    // (v2026 API requires product ID, not product_data in subscription price_data)
    const product = await stripe.products.create({
      name: `FlowSmartly ${plan.name} Plan`,
    });
    subscriptionItem = {
      price_data: {
        currency: "usd",
        product: product.id,
        recurring: { interval: params.interval === "yearly" ? "year" : "month" },
        unit_amount: params.interval === "yearly"
          ? plan.priceCentsYearly
          : plan.priceCentsMonthly,
      },
    };
  }

  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: params.customerId,
    items: [subscriptionItem],
    default_payment_method: params.paymentMethodId,
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    expand: ["latest_invoice.confirmation_secret"],
    metadata: {
      userId: params.userId,
      planId: plan.planId,
      monthlyCredits: String(plan.monthlyCredits),
      type: "subscription",
    },
  };

  const subscription = await stripe.subscriptions.create(subscriptionParams);

  // Extract clientSecret from the expanded invoice's confirmation_secret
  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const clientSecret = invoice?.confirmation_secret?.client_secret || null;

  return {
    subscriptionId: subscription.id,
    clientSecret,
    status: subscription.status,
  };
}

// ── Helper to get plan by ID from database ──

export async function getPlanFromDB(planId: string) {
  return prisma.plan.findUnique({
    where: { planId },
  });
}

// ── Helper to get credit package by ID from database ──

export async function getCreditPackageFromDB(packageId: string) {
  return prisma.creditPackage.findUnique({
    where: { packageId },
  });
}
