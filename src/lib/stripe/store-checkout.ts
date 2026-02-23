/**
 * Stripe Checkout Session for FlowShop store orders.
 * Creates a one-time payment session for store order purchases.
 */

import { stripe } from "./index";
import type Stripe from "stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export interface StoreCheckoutItem {
  name: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string;
}

/**
 * Create a Stripe Checkout Session for a store order.
 * Returns the session URL for redirect.
 */
export async function createStoreOrderCheckoutSession(params: {
  orderId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  items: StoreCheckoutItem[];
  shippingCents: number;
  currency: string;
  customerEmail: string;
}): Promise<{ url: string | null; sessionId: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.");
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = params.items.map(
    (item) => ({
      price_data: {
        currency: params.currency.toLowerCase(),
        unit_amount: item.priceCents,
        product_data: {
          name: item.name,
          ...(item.imageUrl && { images: [item.imageUrl] }),
        },
      },
      quantity: item.quantity,
    })
  );

  // Add shipping as a line item if > 0
  if (params.shippingCents > 0) {
    lineItems.push({
      price_data: {
        currency: params.currency.toLowerCase(),
        unit_amount: params.shippingCents,
        product_data: { name: "Shipping" },
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    customer_email: params.customerEmail,
    metadata: {
      type: "store_order",
      orderId: params.orderId,
      storeId: params.storeId,
      storeSlug: params.storeSlug,
    },
    success_url: `${APP_URL}/store/${params.storeSlug}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/store/${params.storeSlug}/checkout?cancelled=true`,
  });

  return { url: session.url, sessionId: session.id };
}
