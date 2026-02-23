/**
 * Stripe helpers for FlowShop e-commerce subscriptions.
 * Basic ($5/month): 30-day free trial, no card required.
 * Pro ($12/month): 14-day free trial, card required.
 */

import Stripe from "stripe";
import { stripe } from "./index";
import {
  ECOM_BASIC_PRICE_CENTS,
  ECOM_PRO_PRICE_CENTS,
  ECOM_PLAN_NAMES,
  ECOM_BASIC_TRIAL_DAYS,
  ECOM_PRO_TRIAL_DAYS,
  type EcomPlan,
} from "@/lib/domains/pricing";

/**
 * Create a FlowShop subscription with plan-specific trial period.
 * Basic: 30-day trial. Pro: 14-day trial.
 * Card is captured but not charged until trial ends.
 */
export async function createEcommerceSubscription(params: {
  userId: string;
  customerId: string;
  paymentMethodId: string;
  plan?: EcomPlan;
}): Promise<{ subscriptionId: string; clientSecret: string | null; status: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  const plan: EcomPlan = params.plan || "basic";
  const priceCents = plan === "pro" ? ECOM_PRO_PRICE_CENTS : ECOM_BASIC_PRICE_CENTS;
  const planName = ECOM_PLAN_NAMES[plan];
  const trialDays = plan === "pro" ? ECOM_PRO_TRIAL_DAYS : ECOM_BASIC_TRIAL_DAYS;

  // Set default payment method on customer
  await stripe.customers.update(params.customerId, {
    invoice_settings: { default_payment_method: params.paymentMethodId },
  });

  // Create product (required for subscription price_data in v2026 API)
  const product = await stripe.products.create({
    name: planName,
    description: `${planName} — Monthly e-commerce store subscription`,
  });

  const subscription = await stripe.subscriptions.create({
    customer: params.customerId,
    items: [
      {
        price_data: {
          currency: "usd",
          product: product.id,
          recurring: { interval: "month" },
          unit_amount: priceCents,
        },
      },
    ],
    default_payment_method: params.paymentMethodId,
    trial_period_days: trialDays,
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    metadata: {
      userId: params.userId,
      type: "ecommerce_subscription",
      plan,
    },
  });

  return {
    subscriptionId: subscription.id,
    clientSecret: null,
    status: subscription.status, // will be "trialing"
  };
}

/**
 * Convert a free trial (no Stripe subscription) to a paid Basic subscription.
 * Called when a user adds a card during or after the free trial.
 * No further trial — billing starts immediately.
 */
export async function convertFreeTrialToSubscription(params: {
  userId: string;
  customerId: string;
  paymentMethodId: string;
}): Promise<{ subscriptionId: string; status: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  await stripe.customers.update(params.customerId, {
    invoice_settings: { default_payment_method: params.paymentMethodId },
  });

  const product = await stripe.products.create({
    name: ECOM_PLAN_NAMES.basic,
    description: `${ECOM_PLAN_NAMES.basic} — Monthly e-commerce store subscription`,
  });

  const subscription = await stripe.subscriptions.create({
    customer: params.customerId,
    items: [
      {
        price_data: {
          currency: "usd",
          product: product.id,
          recurring: { interval: "month" },
          unit_amount: ECOM_BASIC_PRICE_CENTS,
        },
      },
    ],
    default_payment_method: params.paymentMethodId,
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    metadata: {
      userId: params.userId,
      type: "ecommerce_subscription",
      plan: "basic",
    },
  });

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
  };
}

/**
 * Upgrade or downgrade an existing FlowShop subscription.
 * Changes the price on the existing subscription.
 */
export async function changeEcomPlan(params: {
  subscriptionId: string;
  newPlan: EcomPlan;
  userId: string;
}): Promise<{ status: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  const sub = await stripe.subscriptions.retrieve(params.subscriptionId);
  if (!sub || sub.status === "canceled") {
    throw new Error("Subscription not found or already cancelled.");
  }

  const priceCents = params.newPlan === "pro" ? ECOM_PRO_PRICE_CENTS : ECOM_BASIC_PRICE_CENTS;
  const planName = ECOM_PLAN_NAMES[params.newPlan];

  // Create new product for the new plan
  const product = await stripe.products.create({
    name: planName,
    description: `${planName} — Monthly e-commerce store subscription`,
  });

  // Update the subscription item with new price
  const currentItem = sub.items.data[0];
  if (!currentItem) {
    throw new Error("Subscription has no items.");
  }

  await stripe.subscriptions.update(params.subscriptionId, {
    items: [
      {
        id: currentItem.id,
        price_data: {
          currency: "usd",
          product: product.id,
          recurring: { interval: "month" },
          unit_amount: priceCents,
        },
      },
    ],
    proration_behavior: "create_prorations",
    metadata: {
      userId: params.userId,
      type: "ecommerce_subscription",
      plan: params.newPlan,
    },
  });

  const updated = await stripe.subscriptions.retrieve(params.subscriptionId);

  return {
    status: updated.status,
  };
}

/**
 * Cancel an e-commerce subscription.
 */
export async function cancelEcommerceSubscription(subscriptionId: string): Promise<void> {
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  await stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Create a PaymentIntent for domain purchase.
 */
export async function createDomainPaymentIntent(params: {
  userId: string;
  customerId: string;
  domainName: string;
  amountCents: number;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: "usd",
    customer: params.customerId,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
    description: `Domain registration: ${params.domainName}`,
    metadata: {
      type: "domain_purchase",
      userId: params.userId,
      domainName: params.domainName,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}
