/**
 * Commerce Notifications for FlowShop
 * In-app notifications + email for order lifecycle events.
 */

import { createNotification, NOTIFICATION_TYPES } from "./index";
import {
  sendOrderConfirmationEmail,
  sendNewOrderAlertEmail,
  sendShippingUpdateEmail,
  sendDeliveryConfirmationEmail,
} from "@/lib/email/commerce";

/**
 * Notify buyer: order confirmed (in-app + email)
 */
export async function notifyOrderConfirmation(params: {
  buyerEmail: string;
  customerName: string;
  orderNumber: string;
  items: Array<{ name: string; quantity: number; priceCents: number }>;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  paymentMethod: string;
  storeSlug: string;
  storeName: string;
  buyerUserId?: string;
}) {
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
    storeSlug: params.storeSlug,
    storeName: params.storeName,
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
 * Notify store owner: new order received (in-app + email)
 */
export async function notifyNewOrder(params: {
  storeOwnerUserId: string;
  storeOwnerEmail: string;
  storeOwnerName: string;
  orderNumber: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  itemCount: number;
  totalCents: number;
  currency: string;
  paymentMethod: string;
  storeName: string;
}) {
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
    itemCount: params.itemCount,
    totalCents: params.totalCents,
    currency: params.currency,
    paymentMethod: params.paymentMethod,
    storeName: params.storeName,
    orderId: params.orderId,
  });
}

/**
 * Notify buyer: shipping update (in-app + email)
 */
export async function notifyShippingUpdate(params: {
  buyerEmail: string;
  customerName: string;
  orderNumber: string;
  status: string;
  trackingNumber?: string;
  shippingMethod?: string;
  storeSlug: string;
  storeName: string;
  buyerUserId?: string;
}) {
  await sendShippingUpdateEmail({
    to: params.buyerEmail,
    customerName: params.customerName,
    orderNumber: params.orderNumber,
    status: params.status,
    trackingNumber: params.trackingNumber,
    shippingMethod: params.shippingMethod,
    storeSlug: params.storeSlug,
    storeName: params.storeName,
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
 * Notify buyer: order delivered (in-app + email)
 */
export async function notifyOrderDelivered(params: {
  buyerEmail: string;
  customerName: string;
  orderNumber: string;
  storeName: string;
  storeSlug: string;
  buyerUserId?: string;
}) {
  await sendDeliveryConfirmationEmail({
    to: params.buyerEmail,
    customerName: params.customerName,
    orderNumber: params.orderNumber,
    storeName: params.storeName,
    storeSlug: params.storeSlug,
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
