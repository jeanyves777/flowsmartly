/**
 * Commerce Email Templates for FlowShop
 * Order confirmation, new order alerts, shipping updates, delivery confirmation.
 */

import { sendEmail } from "./index";
import { baseTemplate } from "./index";

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Send order confirmation email to the buyer
 */
export async function sendOrderConfirmationEmail(params: {
  to: string;
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
}) {
  const itemsHtml = params.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;">${i.name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;text-align:center;">x${i.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e4e4e7;text-align:right;">${formatCents(i.priceCents * i.quantity, params.currency)}</td>
      </tr>`
    )
    .join("");

  const paymentInfo =
    params.paymentMethod === "cod"
      ? `<div class="warning"><strong>Cash on Delivery</strong> — Please have ${formatCents(params.totalCents, params.currency)} ready when your order arrives.</div>`
      : params.paymentMethod === "card"
        ? `<p style="color:#10b981;font-weight:600;">Payment confirmed</p>`
        : `<p>Payment method: ${params.paymentMethod.replace(/_/g, " ")}</p>`;

  const html = baseTemplate(
    `
    <h2>Order Confirmed!</h2>
    <p>Thank you for your order, ${params.customerName}!</p>
    <div class="highlight">
      <strong>Order #${params.orderNumber}</strong>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="border-bottom:2px solid #e4e4e7;">
          <th style="padding:8px 0;text-align:left;font-size:13px;color:#71717a;">Item</th>
          <th style="padding:8px 0;text-align:center;font-size:13px;color:#71717a;">Qty</th>
          <th style="padding:8px 0;text-align:right;font-size:13px;color:#71717a;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="stats-box">
      <table style="width:100%;">
        <tr><td style="padding:6px 0;color:#71717a;">Subtotal</td><td style="padding:6px 0;text-align:right;">${formatCents(params.subtotalCents, params.currency)}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a;">Shipping</td><td style="padding:6px 0;text-align:right;">${formatCents(params.shippingCents, params.currency)}</td></tr>
        ${params.taxCents > 0 ? `<tr><td style="padding:6px 0;color:#71717a;">Tax</td><td style="padding:6px 0;text-align:right;">${formatCents(params.taxCents, params.currency)}</td></tr>` : ""}
        <tr style="border-top:2px solid #e4e4e7;"><td style="padding:8px 0;font-weight:bold;">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold;font-size:18px;">${formatCents(params.totalCents, params.currency)}</td></tr>
      </table>
    </div>
    ${paymentInfo}
    <p style="margin-top:24px;">We'll send you updates as your order progresses.</p>
    `,
    `Your order #${params.orderNumber} has been confirmed - ${params.storeName}`
  );

  return sendEmail({
    to: params.to,
    subject: `Order Confirmed - #${params.orderNumber} | ${params.storeName}`,
    html,
  });
}

/**
 * Send new order alert to the store owner
 */
export async function sendNewOrderAlertEmail(params: {
  to: string;
  ownerName: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  itemCount: number;
  totalCents: number;
  currency: string;
  paymentMethod: string;
  storeName: string;
  orderId: string;
}) {
  const isCod = params.paymentMethod === "cod";
  const codWarning = isCod
    ? `<div class="warning"><strong>Cash on Delivery order</strong> — Remember to collect ${formatCents(params.totalCents, params.currency)} on delivery and mark the order as paid.</div>`
    : "";

  const html = baseTemplate(
    `
    <h2>New Order Received!</h2>
    <p>Hi ${params.ownerName}, you have a new order on ${params.storeName}.</p>
    <div class="highlight">
      <strong>Order #${params.orderNumber}</strong><br/>
      <span style="color:#71717a;">${params.itemCount} item${params.itemCount > 1 ? "s" : ""} — ${formatCents(params.totalCents, params.currency)}</span>
    </div>
    <div class="stats-box">
      <table style="width:100%;">
        <tr><td style="padding:6px 0;color:#71717a;">Customer</td><td style="padding:6px 0;text-align:right;">${params.customerName}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a;">Email</td><td style="padding:6px 0;text-align:right;">${params.customerEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a;">Payment</td><td style="padding:6px 0;text-align:right;text-transform:capitalize;">${params.paymentMethod.replace(/_/g, " ")}</td></tr>
        <tr style="border-top:1px solid #e4e4e7;"><td style="padding:8px 0;font-weight:bold;">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${formatCents(params.totalCents, params.currency)}</td></tr>
      </table>
    </div>
    ${codWarning}
    <a href="${APP_URL}/ecommerce/orders/${params.orderId}" class="button">View Order Details</a>
    `,
    `New order #${params.orderNumber} - ${formatCents(params.totalCents, params.currency)}`
  );

  return sendEmail({
    to: params.to,
    subject: `New Order #${params.orderNumber} - ${formatCents(params.totalCents, params.currency)} | ${params.storeName}`,
    html,
  });
}

/**
 * Send shipping update email to the buyer
 */
export async function sendShippingUpdateEmail(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  status: string;
  trackingNumber?: string;
  shippingMethod?: string;
  storeSlug: string;
  storeName: string;
}) {
  const trackingInfo = params.trackingNumber
    ? `<div class="stats-box">
        <p style="margin:0 0 4px 0;color:#71717a;font-size:13px;">Tracking Number</p>
        <p style="margin:0;font-family:monospace;font-size:16px;letter-spacing:1px;">${params.trackingNumber}</p>
        ${params.shippingMethod ? `<p style="margin:8px 0 0 0;color:#71717a;font-size:13px;">Via: ${params.shippingMethod}</p>` : ""}
      </div>`
    : "";

  const html = baseTemplate(
    `
    <h2>Shipping Update</h2>
    <p>Hi ${params.customerName}, your order has been updated!</p>
    <div class="highlight">
      <strong>Order #${params.orderNumber}</strong><br/>
      <span style="color:#10b981;font-weight:600;">Status: ${params.status}</span>
    </div>
    ${trackingInfo}
    <p>We'll notify you when your order arrives.</p>
    `,
    `Your order #${params.orderNumber} has been ${params.status.toLowerCase()}`
  );

  return sendEmail({
    to: params.to,
    subject: `Order ${params.status} - #${params.orderNumber} | ${params.storeName}`,
    html,
  });
}

/**
 * Send delivery confirmation email to the buyer
 */
export async function sendDeliveryConfirmationEmail(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  storeName: string;
  storeSlug: string;
}) {
  const html = baseTemplate(
    `
    <h2>Order Delivered!</h2>
    <p>Hi ${params.customerName}, your order has been delivered!</p>
    <div class="highlight">
      <strong>Order #${params.orderNumber}</strong> has been successfully delivered.
    </div>
    <p>Thank you for shopping at ${params.storeName}!</p>
    <p style="color:#71717a;font-size:14px;">If you have any issues with your order, please contact the store.</p>
    `,
    `Your order #${params.orderNumber} has been delivered!`
  );

  return sendEmail({
    to: params.to,
    subject: `Order Delivered - #${params.orderNumber} | ${params.storeName}`,
    html,
  });
}
