/**
 * Commerce Notifications for FlowShop
 *
 * In-app dashboard notifications + branded customer emails for order lifecycle
 * events. Emails are sent through the store owner's configured email provider
 * (MarketingConfig) — not the platform sender — so buyers see the store's
 * branded From address.
 */

import { createNotification, NOTIFICATION_TYPES } from "./index";
import {
  sendOrderConfirmationEmail,
  sendNewOrderAlertEmail,
  sendShippingUpdateEmail,
  sendDeliveryConfirmationEmail,
} from "@/lib/email/commerce";

interface StoreBranding {
  storeLogoUrl?: string | null;
  storeAccentColor?: string | null;
  storeCustomDomain?: string | null;
}

/**
 * Notify buyer: order confirmed (branded email + in-app notification for
 * logged-in customers). Only fires for a card order AFTER the Stripe webhook
 * confirms payment, or immediately for COD/mobile money/bank transfer.
 */
export async function notifyOrderConfirmation(params: {
  buyerEmail: string;
  customerName: string;
  orderNumber: string;
  items: Array<{ name: string; quantity: number; priceCents: number; imageUrl?: string | null }>;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  paymentMethod: string;
  paymentLast4?: string | null;
  paymentBrand?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  storeSlug: string;
  storeName: string;
  storeOwnerUserId: string;
  buyerUserId?: string;
} & StoreBranding) {
  await sendOrderConfirmationEmail({
    to: params.buyerEmail,
    customerName: params.customerName,
    orderNumber: params.orderNumber,
    items: params.items,
    subtotalCents: params.subtotalCents,
    shippingCents: params.shippingCents,
    taxCents: params.taxCents,
    totalCents: params.totalCents,
    currency: params.currency,
    paymentMethod: params.paymentMethod,
    paymentLast4: params.paymentLast4,
    paymentBrand: params.paymentBrand,
    shippingAddress: params.shippingAddress,
    storeSlug: params.storeSlug,
    storeName: params.storeName,
    storeOwnerUserId: params.storeOwnerUserId,
    storeLogoUrl: params.storeLogoUrl,
    storeAccentColor: params.storeAccentColor,
    storeCustomDomain: params.storeCustomDomain,
  });

  if (params.buyerUserId) {
    await createNotification({
      userId: params.buyerUserId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "Order Confirmed",
      message: `Your order #${params.orderNumber} at ${params.storeName} has been confirmed!`,
      data: { orderNumber: params.orderNumber, storeSlug: params.storeSlug },
      actionUrl: `/store/${params.storeSlug}/track/${params.orderNumber}`,
    });
  }
}

/**
 * Notify store owner: new order received (in-app dashboard notification +
 * branded alert email).
 */
export async function notifyNewOrder(params: {
  storeOwnerUserId: string;
  storeOwnerEmail: string;
  storeOwnerName: string;
  orderNumber: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ name: string; quantity: number; priceCents: number; imageUrl?: string | null }>;
  totalCents: number;
  currency: string;
  paymentMethod: string;
  storeSlug: string;
  storeName: string;
} & StoreBranding) {
  await createNotification({
    userId: params.storeOwnerUserId,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: "New Order",
    message: `New order #${params.orderNumber} from ${params.customerName} for ${new Intl.NumberFormat("en-US", { style: "currency", currency: params.currency, minimumFractionDigits: 2 }).format(params.totalCents / 100)}`,
    data: { orderId: params.orderId, orderNumber: params.orderNumber },
    actionUrl: `/ecommerce/orders/${params.orderId}`,
  });

  await sendNewOrderAlertEmail({
    to: params.storeOwnerEmail,
    ownerName: params.storeOwnerName,
    orderNumber: params.orderNumber,
    customerName: params.customerName,
    customerEmail: params.customerEmail,
    items: params.items,
    totalCents: params.totalCents,
    currency: params.currency,
    paymentMethod: params.paymentMethod,
    storeName: params.storeName,
    storeSlug: params.storeSlug,
    storeOwnerUserId: params.storeOwnerUserId,
    orderId: params.orderId,
    storeLogoUrl: params.storeLogoUrl,
    storeAccentColor: params.storeAccentColor,
    storeCustomDomain: params.storeCustomDomain,
  });
}

/**
 * Notify buyer: shipping update (branded email + in-app notification).
 */
export async function notifyShippingUpdate(params: {
  buyerEmail: string;
  customerName: string;
  orderNumber: string;
  status: string;
  trackingNumber?: string | null;
  shippingMethod?: string | null;
  storeSlug: string;
  storeName: string;
  storeOwnerUserId: string;
  buyerUserId?: string;
} & StoreBranding) {
  await sendShippingUpdateEmail({
    to: params.buyerEmail,
    customerName: params.customerName,
    orderNumber: params.orderNumber,
    status: params.status,
    trackingNumber: params.trackingNumber,
    shippingMethod: params.shippingMethod,
    storeSlug: params.storeSlug,
    storeName: params.storeName,
    storeOwnerUserId: params.storeOwnerUserId,
    storeLogoUrl: params.storeLogoUrl,
    storeAccentColor: params.storeAccentColor,
    storeCustomDomain: params.storeCustomDomain,
  });

  if (params.buyerUserId) {
    await createNotification({
      userId: params.buyerUserId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: `Order ${params.status}`,
      message: `Your order #${params.orderNumber} is now ${params.status.toLowerCase()}.${params.trackingNumber ? ` Tracking: ${params.trackingNumber}` : ""}`,
      data: { orderNumber: params.orderNumber, storeSlug: params.storeSlug },
      actionUrl: `/store/${params.storeSlug}/track/${params.orderNumber}`,
    });
  }
}

/**
 * Notify buyer: order delivered (branded email + in-app notification).
 */
export async function notifyOrderDelivered(params: {
  buyerEmail: string;
  customerName: string;
  orderNumber: string;
  storeName: string;
  storeSlug: string;
  storeOwnerUserId: string;
  buyerUserId?: string;
} & StoreBranding) {
  await sendDeliveryConfirmationEmail({
    to: params.buyerEmail,
    customerName: params.customerName,
    orderNumber: params.orderNumber,
    storeName: params.storeName,
    storeSlug: params.storeSlug,
    storeOwnerUserId: params.storeOwnerUserId,
    storeLogoUrl: params.storeLogoUrl,
    storeAccentColor: params.storeAccentColor,
    storeCustomDomain: params.storeCustomDomain,
  });

  if (params.buyerUserId) {
    await createNotification({
      userId: params.buyerUserId,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "Order Delivered",
      message: `Your order #${params.orderNumber} from ${params.storeName} has been delivered!`,
      data: { orderNumber: params.orderNumber, storeSlug: params.storeSlug },
      actionUrl: `/store/${params.storeSlug}/track/${params.orderNumber}`,
    });
  }
}
