/**
 * Stripe helpers for FlowShop e-commerce subscription ($5/month add-on).
 */

import { stripe } from "./index";
import { ECOM_SUBSCRIPTION_PRICE_CENTS } from "@/lib/constants/ecommerce";

/**
 * Create a $5/month e-commerce subscription for a user.
 * Uses ad-hoc price_data (no pre-created Stripe Price needed).
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
    description: "Monthly e-commerce store subscription",
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
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    expand: ["latest_invoice.confirmation_secret"],
    metadata: {
      userId: params.userId,
      type: "ecommerce_subscription",
    },
  });

  const invoice = subscription.latest_invoice as import("stripe").default.Invoice;
  const clientSecret = invoice?.confirmation_secret?.client_secret || null;

  return {
    subscriptionId: subscription.id,
    clientSecret,
    status: subscription.status,
  };
}

/**
 * Create a checkout session for e-commerce subscription (redirect flow).
 * Used when user has no saved payment method.
 */
export async function createEcommerceCheckoutSession(params: {
  userId: string;
  userEmail: string;
  customerId?: string | null;
}): Promise<{ url: string | null }> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  const sessionParams: import("stripe").default.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: ECOM_SUBSCRIPTION_PRICE_CENTS,
          product_data: {
            name: "FlowShop E-Commerce Add-On",
            description: "Monthly e-commerce store — $5/month",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: params.userId,
      type: "ecommerce_subscription",
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/ecommerce/onboarding?activated=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/ecommerce?cancelled=true`,
  };

  if (params.customerId) {
    sessionParams.customer = params.customerId;
  } else {
    sessionParams.customer_email = params.userEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return { url: session.url };
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
