/**
 * Stripe helpers for FlowShop store orders.
 * Uses inline PaymentIntent — no Stripe Checkout redirect.
 */

import { stripe } from "./index";

/**
 * Create a PaymentIntent for a store order.
 *
 * Returns clientSecret for client-side confirmation with Stripe PaymentElement.
 * Routes the charge through the store's Connect account when one is present.
 *
 * When `paymentMethodTypes` is supplied (owner's saved allowlist from
 * Settings → Payments), we pass it to Stripe explicitly — otherwise we let
 * `automatic_payment_methods` surface every method active on the connected
 * account. Either path results in PaymentElement rendering all eligible tabs.
 */
export async function createStorePaymentIntent(params: {
  orderId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  totalCents: number;
  currency: string;
  customerEmail: string;
  stripeConnectAccountId?: string;
  platformFeeCents?: number;
  paymentMethodTypes?: string[];
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  const useConnect = !!(params.stripeConnectAccountId && params.platformFeeCents != null);
  const useExplicitTypes = Array.isArray(params.paymentMethodTypes) && params.paymentMethodTypes.length > 0;

  const baseParams = {
    amount: params.totalCents,
    currency: params.currency.toLowerCase(),
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
  };

  const paymentIntent = await stripe.paymentIntents.create(
    useExplicitTypes
      ? {
          ...baseParams,
          payment_method_types: params.paymentMethodTypes!,
        }
      : {
          ...baseParams,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "always",
          },
        }
  );

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
}
