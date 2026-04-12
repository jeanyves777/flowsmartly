/**
 * Stripe helpers for FlowShop store orders.
 * Uses inline PaymentIntent — no Stripe Checkout redirect.
 */

import { stripe } from "./index";

/**
 * Create a PaymentIntent for a store order.
 * Returns clientSecret for client-side confirmation with CardElement.
 * If the store has a connected Stripe account, routes payment via Stripe Connect.
 */
export async function createStorePaymentIntent(params: {
  orderId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  totalCents: number;
  currency: string;
  customerEmail: string;
  // Stripe Connect (optional — only when store has completed onboarding)
  stripeConnectAccountId?: string;
  platformFeeCents?: number;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  const useConnect = !!(params.stripeConnectAccountId && params.platformFeeCents != null);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: params.totalCents,
    currency: params.currency.toLowerCase(),
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
    receipt_email: params.customerEmail,
    description: `Order from ${params.storeName}`,
    metadata: {
      type: "store_order",
      orderId: params.orderId,
      storeId: params.storeId,
      storeSlug: params.storeSlug,
    },
    ...(useConnect && {
      application_fee_amount: params.platformFeeCents,
      transfer_data: { destination: params.stripeConnectAccountId! },
    }),
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}
