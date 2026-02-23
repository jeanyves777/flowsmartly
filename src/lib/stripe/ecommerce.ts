/**
 * Stripe helpers for FlowShop e-commerce subscription ($5/month add-on).
 * 14-day free trial — card on file required but not charged until trial ends.
 */

import { stripe } from "./index";
import { ECOM_SUBSCRIPTION_PRICE_CENTS } from "@/lib/constants/ecommerce";

/**
 * Create a $5/month e-commerce subscription with 14-day free trial.
 * Card is captured but not charged until trial ends.
 */
export async function createEcommerceSubscription(params: {
  userId: string;
  customerId: string;
  paymentMethodId: string;
}): Promise<{ subscriptionId: string; clientSecret: string | null; status: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  // Set default payment method on customer
  await stripe.customers.update(params.customerId, {
    invoice_settings: { default_payment_method: params.paymentMethodId },
  });

  // Create product first (required for subscription price_data in v2026 API)
  const product = await stripe.products.create({
    name: "FlowShop E-Commerce Add-On",
    description: "Monthly e-commerce store subscription — 14-day free trial",
  });

  const subscription = await stripe.subscriptions.create({
    customer: params.customerId,
    items: [
      {
        price_data: {
          currency: "usd",
          product: product.id,
          recurring: { interval: "month" },
          unit_amount: ECOM_SUBSCRIPTION_PRICE_CENTS,
        },
      },
    ],
    default_payment_method: params.paymentMethodId,
    trial_period_days: 14,
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    metadata: {
      userId: params.userId,
      type: "ecommerce_subscription",
    },
  });

  return {
    subscriptionId: subscription.id,
    clientSecret: null,
    status: subscription.status, // will be "trialing"
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
