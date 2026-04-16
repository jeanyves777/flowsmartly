/**
 * Commerce Email Templates for FlowShop
 *
 * All customer-facing emails are routed through the store owner's configured
 * email provider (SMTP / SendGrid / Mailgun / SES / Resend) via
 * sendStoreEmail(), so they show the store's branded From address rather than
 * a generic platform sender. They also include store branding (logo / colors
 * / link back to the storefront) and product thumbnails.
 */

import { sendEmail, baseTemplate } from "./index";
import { sendStoreEmail } from "./store-sender";
import { formatPrice as formatCents } from "@/lib/store/currency";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a presigned S3 URL to a proxy URL that never expires.
 * Presigned URLs have a 1h TTL — by the time the buyer opens the email,
 * the image is gone. The proxy re-generates a fresh presigned URL per request.
 */
function toEmailSafeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Match flowsmartly S3 bucket URLs and extract the key
  const match = url.match(/flowsmartly-media\.s3[^/]*\.amazonaws\.com\/([^?]+)/);
  if (match) {
    return `${APP_URL}/api/media/proxy?key=${encodeURIComponent(match[1])}`;
  }
  // Relative URLs need the domain prefix
  if (url.startsWith("/")) return `${APP_URL}${url}`;
  return url;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function storefrontUrl(storeSlug: string, customDomain?: string | null): string {
  if (customDomain) return `https://${customDomain}`;
  return `${APP_URL}/store/${storeSlug}`;
}

/**
 * Branded email shell — logo + title + content + footer. Uses inline styles
 * only; bulletproof in Gmail/Outlook. `accent` defaults to indigo, override
 * with the store's theme colour.
 */
function storeBrandedTemplate(opts: {
  storeName: string;
  logoUrl?: string | null;
  accent?: string;
  storefrontHref: string;
  preheader?: string;
  content: string; // Inner HTML
}): string {
  const accent = opts.accent || "#6366f1";
  const safeLogoUrl = toEmailSafeImageUrl(opts.logoUrl);
  const logo = safeLogoUrl
    ? `<img src="${safeLogoUrl}" alt="${escapeHtml(opts.storeName)}" style="max-height:40px;max-width:160px;display:block;margin:0 auto 8px;" />`
    : `<div style="font-size:22px;font-weight:800;color:${accent};letter-spacing:-0.02em;margin-bottom:8px;">${escapeHtml(opts.storeName)}</div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(opts.storeName)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.04);">
        <tr><td style="padding:28px 32px 20px;text-align:center;border-bottom:1px solid #f4f4f5;">
          <a href="${opts.storefrontHref}" style="text-decoration:none;color:inherit;">${logo}</a>
        </td></tr>
        <tr><td style="padding:28px 32px;line-height:1.6;font-size:15px;color:#18181b;">
          ${opts.content}
        </td></tr>
        <tr><td style="padding:20px 32px 28px;text-align:center;border-top:1px solid #f4f4f5;color:#a1a1aa;font-size:12px;">
          <a href="${opts.storefrontHref}" style="color:${accent};text-decoration:none;font-weight:600;">Visit ${escapeHtml(opts.storeName)} →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function itemsTableHtml(
  items: Array<{ name: string; quantity: number; priceCents: number; imageUrl?: string | null }>,
  currency: string
): string {
  return items
    .map((i) => {
      const safeThumb = toEmailSafeImageUrl(i.imageUrl);
      const thumb = safeThumb
        ? `<img src="${safeThumb}" alt="" style="width:56px;height:56px;border-radius:8px;object-fit:cover;background:#f4f4f5;display:block;" />`
        : `<div style="width:56px;height:56px;border-radius:8px;background:#f4f4f5;"></div>`;
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;vertical-align:middle;width:56px;">${thumb}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f4f4f5;vertical-align:middle;">
            <div style="font-weight:600;color:#18181b;">${escapeHtml(i.name)}</div>
            <div style="color:#71717a;font-size:13px;margin-top:2px;">Qty ${i.quantity}</div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;vertical-align:middle;text-align:right;font-weight:600;white-space:nowrap;">
            ${formatCents(i.priceCents * i.quantity, currency)}
          </td>
        </tr>`;
    })
    .join("");
}

function addressHtml(addr: {
  name?: string; line1?: string; street?: string; line2?: string;
  city?: string; state?: string; zip?: string; country?: string;
} | null | undefined): string {
  if (!addr) return "";
  const line1 = addr.line1 || addr.street || "";
  const parts: string[] = [];
  if (addr.name) parts.push(escapeHtml(addr.name));
  if (line1) parts.push(escapeHtml(line1));
  if (addr.line2) parts.push(escapeHtml(addr.line2));
  const cityLine = [addr.city, addr.state, addr.zip].filter(Boolean).join(", ");
  if (cityLine) parts.push(escapeHtml(cityLine));
  if (addr.country) parts.push(escapeHtml(addr.country));
  if (parts.length === 0) return "";
  return `
    <div style="margin:16px 0;padding:14px 16px;background:#fafafa;border-radius:10px;border:1px solid #f4f4f5;">
      <div style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;font-weight:600;">Shipping to</div>
      <div style="color:#18181b;line-height:1.5;font-size:14px;">${parts.join("<br/>")}</div>
    </div>`;
}

// ─── Email Functions ─────────────────────────────────────────────────────────

/**
 * Welcome email for a new store customer after registration.
 * Sent via platform transporter — the customer may not have any orders yet
 * and the owner's SMTP config may not be set up during early store launch.
 */
export async function sendStoreWelcomeEmail(params: {
  to: string;
  customerName: string;
  storeName: string;
  storeSlug: string;
}) {
  const href = storefrontUrl(params.storeSlug);
  const html = storeBrandedTemplate({
    storeName: params.storeName,
    storefrontHref: href,
    content: `
      <h2 style="margin:0 0 8px;font-size:22px;">Welcome, ${escapeHtml(params.customerName)}!</h2>
      <p style="margin:0 0 20px;color:#52525b;">Your ${escapeHtml(params.storeName)} account is ready. Track orders, save favourites, and check out faster.</p>
      <a href="${href}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#ffffff;border-radius:999px;font-weight:600;text-decoration:none;">Shop now</a>
    `,
  });
  return sendEmail({ to: params.to, subject: `Welcome to ${params.storeName}!`, html });
}

/**
 * Order confirmation — sent to the buyer after payment succeeds (card) or
 * order placement (COD / bank transfer / mobile money).
 */
export async function sendOrderConfirmationEmail(params: {
  to: string;
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
  storeLogoUrl?: string | null;
  storeAccentColor?: string | null;
  storeCustomDomain?: string | null;
}) {
  const href = storefrontUrl(params.storeSlug, params.storeCustomDomain);

  const paymentLine = (() => {
    if (params.paymentMethod === "cod") {
      return `<div style="margin:16px 0;padding:12px 14px;border-radius:10px;background:#fef3c7;color:#92400e;font-size:14px;"><strong>Cash on Delivery</strong> — please have ${formatCents(params.totalCents, params.currency)} ready.</div>`;
    }
    if (params.paymentMethod === "card" || params.paymentLast4) {
      const brand = params.paymentBrand ? params.paymentBrand.charAt(0).toUpperCase() + params.paymentBrand.slice(1) : "Card";
      const last4 = params.paymentLast4 ? ` ending in ${escapeHtml(params.paymentLast4)}` : "";
      return `<p style="margin:12px 0;color:#15803d;font-weight:600;">✓ Paid with ${escapeHtml(brand)}${last4}</p>`;
    }
    return `<p style="margin:12px 0;color:#52525b;">Payment method: ${escapeHtml(params.paymentMethod.replace(/_/g, " "))}</p>`;
  })();

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;">Thank you, ${escapeHtml(params.customerName)}!</h2>
    <p style="margin:0 0 16px;color:#52525b;">Your order has been confirmed. We'll email you again when it ships.</p>
    <div style="margin:16px 0;padding:14px 16px;border-radius:10px;background:#eef2ff;color:#3730a3;font-weight:700;">
      Order #${escapeHtml(params.orderNumber)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
      ${itemsTableHtml(params.items, params.currency)}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;">
      <tr><td style="padding:4px 0;color:#71717a;">Subtotal</td><td style="padding:4px 0;text-align:right;">${formatCents(params.subtotalCents, params.currency)}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a;">Shipping</td><td style="padding:4px 0;text-align:right;">${formatCents(params.shippingCents, params.currency)}</td></tr>
      ${params.taxCents > 0 ? `<tr><td style="padding:4px 0;color:#71717a;">Tax</td><td style="padding:4px 0;text-align:right;">${formatCents(params.taxCents, params.currency)}</td></tr>` : ""}
      <tr><td style="padding:10px 0 4px;font-weight:700;border-top:2px solid #e4e4e7;">Total</td><td style="padding:10px 0 4px;text-align:right;font-weight:700;font-size:18px;border-top:2px solid #e4e4e7;">${formatCents(params.totalCents, params.currency)}</td></tr>
    </table>
    ${paymentLine}
    ${addressHtml(params.shippingAddress as any)}
    <div style="margin:20px 0 0;"><a href="${href}/account/orders" style="display:inline-block;padding:12px 22px;background:${params.storeAccentColor || "#6366f1"};color:#ffffff;border-radius:999px;font-weight:600;text-decoration:none;">View my orders</a></div>
  `;

  const html = storeBrandedTemplate({
    storeName: params.storeName,
    logoUrl: params.storeLogoUrl,
    accent: params.storeAccentColor || undefined,
    storefrontHref: href,
    preheader: `Order #${params.orderNumber} confirmed — ${formatCents(params.totalCents, params.currency)}`,
    content,
  });

  // Customer confirmation MUST come from the store's configured email
  // provider so the buyer sees the store's From address, not flowsmartly's.
  return sendStoreEmail({
    storeOwnerUserId: params.storeOwnerUserId,
    to: params.to,
    subject: `Order #${params.orderNumber} confirmed · ${params.storeName}`,
    html,
    storeName: params.storeName,
    requireOwner: true,
  });
}

/**
 * New-order alert — sent to the store owner's email on every successful order.
 */
export async function sendNewOrderAlertEmail(params: {
  to: string;
  ownerName: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ name: string; quantity: number; priceCents: number; imageUrl?: string | null }>;
  totalCents: number;
  currency: string;
  paymentMethod: string;
  storeName: string;
  storeSlug: string;
  storeOwnerUserId: string;
  orderId: string;
  storeLogoUrl?: string | null;
  storeAccentColor?: string | null;
  storeCustomDomain?: string | null;
}) {
  const isCod = params.paymentMethod === "cod";
  const href = storefrontUrl(params.storeSlug, params.storeCustomDomain);

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;">New order received</h2>
    <p style="margin:0 0 16px;color:#52525b;">Hi ${escapeHtml(params.ownerName)}, you have a new order on ${escapeHtml(params.storeName)}.</p>
    <div style="margin:16px 0;padding:14px 16px;border-radius:10px;background:#ecfdf5;color:#065f46;">
      <div style="font-weight:700;">Order #${escapeHtml(params.orderNumber)}</div>
      <div style="margin-top:4px;font-size:14px;">${params.items.length} item${params.items.length === 1 ? "" : "s"} · ${formatCents(params.totalCents, params.currency)}</div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
      ${itemsTableHtml(params.items, params.currency)}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;">
      <tr><td style="padding:4px 0;color:#71717a;">Customer</td><td style="padding:4px 0;text-align:right;">${escapeHtml(params.customerName)}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a;">Email</td><td style="padding:4px 0;text-align:right;">${escapeHtml(params.customerEmail)}</td></tr>
      <tr><td style="padding:4px 0;color:#71717a;">Payment</td><td style="padding:4px 0;text-align:right;text-transform:capitalize;">${escapeHtml(params.paymentMethod.replace(/_/g, " "))}</td></tr>
    </table>
    ${isCod ? `<div style="margin:16px 0;padding:12px 14px;border-radius:10px;background:#fef3c7;color:#92400e;font-size:14px;"><strong>Collect on delivery:</strong> ${formatCents(params.totalCents, params.currency)}</div>` : ""}
    <div style="margin:20px 0 0;"><a href="${APP_URL}/ecommerce/orders/${params.orderId}" style="display:inline-block;padding:12px 22px;background:${params.storeAccentColor || "#6366f1"};color:#ffffff;border-radius:999px;font-weight:600;text-decoration:none;">Manage this order</a></div>
  `;

  const html = storeBrandedTemplate({
    storeName: params.storeName,
    logoUrl: params.storeLogoUrl,
    accent: params.storeAccentColor || undefined,
    storefrontHref: href,
    preheader: `New order #${params.orderNumber} — ${formatCents(params.totalCents, params.currency)}`,
    content,
  });

  // Store-owner alerts go through OUR platform sender (FlowSmartly) so that
  // owners always get the notification even before they've configured their
  // own email provider, and so failures in their provider can't silence it.
  return sendEmail({
    to: params.to,
    subject: `New order #${params.orderNumber} · ${formatCents(params.totalCents, params.currency)}`,
    html,
  });
}

/**
 * Shipping update — sent to the buyer as the order moves through fulfilment.
 * The `status` field controls the copy (e.g. "Shipped", "Out for delivery").
 */
export async function sendShippingUpdateEmail(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  status: string;
  trackingNumber?: string | null;
  shippingMethod?: string | null;
  storeSlug: string;
  storeName: string;
  storeOwnerUserId: string;
  storeLogoUrl?: string | null;
  storeAccentColor?: string | null;
  storeCustomDomain?: string | null;
}) {
  const href = storefrontUrl(params.storeSlug, params.storeCustomDomain);
  const trackingBlock = params.trackingNumber
    ? `<div style="margin:16px 0;padding:14px 16px;border-radius:10px;background:#fafafa;border:1px solid #f4f4f5;">
         <div style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Tracking Number</div>
         <div style="margin-top:4px;font-family:'SFMono-Regular',Consolas,monospace;font-size:16px;letter-spacing:0.05em;">${escapeHtml(params.trackingNumber || "")}</div>
         ${params.shippingMethod ? `<div style="margin-top:4px;color:#71717a;font-size:13px;">Via ${escapeHtml(params.shippingMethod)}</div>` : ""}
       </div>`
    : "";

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;">Your order is ${escapeHtml(params.status.toLowerCase())}</h2>
    <p style="margin:0 0 12px;color:#52525b;">Hi ${escapeHtml(params.customerName)}, here's an update on order #${escapeHtml(params.orderNumber)}.</p>
    <div style="margin:16px 0;padding:14px 16px;border-radius:10px;background:#eff6ff;color:#1e40af;"><strong>Status:</strong> ${escapeHtml(params.status)}</div>
    ${trackingBlock}
    <div style="margin:20px 0 0;"><a href="${href}/account/orders" style="display:inline-block;padding:12px 22px;background:${params.storeAccentColor || "#6366f1"};color:#ffffff;border-radius:999px;font-weight:600;text-decoration:none;">Track my order</a></div>
  `;

  const html = storeBrandedTemplate({
    storeName: params.storeName,
    logoUrl: params.storeLogoUrl,
    accent: params.storeAccentColor || undefined,
    storefrontHref: href,
    preheader: `Order #${params.orderNumber} — ${params.status}`,
    content,
  });

  return sendStoreEmail({
    storeOwnerUserId: params.storeOwnerUserId,
    to: params.to,
    subject: `Order #${params.orderNumber} — ${params.status} · ${params.storeName}`,
    html,
    storeName: params.storeName,
  });
}

/**
 * Delivery confirmation — sent to the buyer when the order is marked DELIVERED.
 */
export async function sendDeliveryConfirmationEmail(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  storeName: string;
  storeSlug: string;
  storeOwnerUserId: string;
  storeLogoUrl?: string | null;
  storeAccentColor?: string | null;
  storeCustomDomain?: string | null;
}) {
  const href = storefrontUrl(params.storeSlug, params.storeCustomDomain);

  const content = `
    <h2 style="margin:0 0 8px;font-size:22px;">Your order has arrived! 🎉</h2>
    <p style="margin:0 0 12px;color:#52525b;">Hi ${escapeHtml(params.customerName)}, order #${escapeHtml(params.orderNumber)} has been delivered.</p>
    <p style="margin:0 0 16px;color:#52525b;">We hope you love it. Tap below to leave a review — it really helps us out.</p>
    <div style="margin:20px 0 0;"><a href="${href}/account/orders" style="display:inline-block;padding:12px 22px;background:${params.storeAccentColor || "#6366f1"};color:#ffffff;border-radius:999px;font-weight:600;text-decoration:none;">View order & leave review</a></div>
  `;

  const html = storeBrandedTemplate({
    storeName: params.storeName,
    logoUrl: params.storeLogoUrl,
    accent: params.storeAccentColor || undefined,
    storefrontHref: href,
    preheader: `Order #${params.orderNumber} has been delivered`,
    content,
  });

  return sendStoreEmail({
    storeOwnerUserId: params.storeOwnerUserId,
    to: params.to,
    subject: `Delivered: Order #${params.orderNumber} · ${params.storeName}`,
    html,
    storeName: params.storeName,
  });
}

// ─── Legacy templates (still used by marketing/intelligence flows) ───────────

/**
 * Weekly intelligence report for the store owner (platform-sent, not branded).
 */
export async function sendIntelligenceWeeklyReport(params: {
  to: string;
  ownerName: string;
  storeName: string;
  summary: {
    competitorsFound: number;
    avgSeoScore: number;
    trendHighlights: string[];
    topRecommendations: string[];
  };
  competitorData: { products: { productName: string; competitors: { name: string; priceCents: number }[] }[] };
  seoData: { products: { name: string; score: number }[]; averageScore: number } | null;
}) {
  const { to, ownerName, storeName, summary, competitorData, seoData } = params;
  const trendHighlightsHtml = summary.trendHighlights.length > 0
    ? summary.trendHighlights.map(t => `<li style="padding:4px 0;color:#3f3f46;">${escapeHtml(t)}</li>`).join("")
    : `<li style="color:#71717a;">No notable trends this week</li>`;

  const topCompetitors = competitorData.products.slice(0, 5);
  const competitorHtml = topCompetitors.length > 0
    ? topCompetitors.map(p => `<tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;">${escapeHtml(p.productName)}</td><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;text-align:right;">${p.competitors.length} found</td></tr>`).join("")
    : `<tr><td colspan="2" style="padding:8px 0;color:#71717a;">No competitor data</td></tr>`;

  const lowSeoProducts = (seoData?.products || []).filter(p => p.score < 70).slice(0, 5);
  const seoHtml = lowSeoProducts.length > 0
    ? lowSeoProducts.map(p => `<tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;">${escapeHtml(p.name)}</td><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;text-align:right;">${p.score}/100</td></tr>`).join("")
    : `<tr><td colspan="2" style="padding:8px 0;color:#10b981;">All products have good SEO scores!</td></tr>`;

  const recommendationsHtml = summary.topRecommendations.length > 0
    ? summary.topRecommendations.map(r => `<li style="padding:4px 0;color:#3f3f46;">${escapeHtml(r)}</li>`).join("")
    : "";

  const content = `
    <h2>Weekly Intelligence Report</h2>
    <p>Hi ${escapeHtml(ownerName)}, here's your weekly FlowShop intelligence summary for <strong>${escapeHtml(storeName)}</strong>.</p>
    <div class="stats-box">
      <table style="width:100%;">
        <tr><td style="padding:6px 0;color:#71717a;">Competitors Tracked</td><td style="padding:6px 0;text-align:right;font-weight:600;">${summary.competitorsFound}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a;">Average SEO Score</td><td style="padding:6px 0;text-align:right;font-weight:600;">${summary.avgSeoScore}/100</td></tr>
      </table>
    </div>
    <h3 style="margin-top:24px;">Trend Highlights</h3><ul style="padding-left:20px;">${trendHighlightsHtml}</ul>
    <h3 style="margin-top:24px;">Competitor Overview</h3>
    <table style="width:100%;border-collapse:collapse;"><tbody>${competitorHtml}</tbody></table>
    <h3 style="margin-top:24px;">SEO Attention Needed</h3>
    <table style="width:100%;border-collapse:collapse;"><tbody>${seoHtml}</tbody></table>
    ${recommendationsHtml ? `<h3 style="margin-top:24px;">Recommendations</h3><ul style="padding-left:20px;">${recommendationsHtml}</ul>` : ""}
    <div style="text-align:center;margin-top:32px;"><a href="${APP_URL}/ecommerce/intelligence" style="display:inline-block;background:#3b82f6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Full Report</a></div>`;

  return sendEmail({
    to,
    subject: `Weekly Intelligence Report | ${storeName}`,
    html: baseTemplate(content, `Your weekly intelligence report for ${storeName} is ready`),
  });
}

/**
 * Abandoned-cart reminder to a store customer.
 */
export async function sendAbandonedCartEmail(params: {
  to: string;
  customerName: string;
  storeName: string;
  storeUrl: string;
  items: Array<{ name: string; imageUrl?: string; priceCents: number; quantity: number }>;
  currency: string;
}) {
  const itemsHtml = params.items.map(
    (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e4e4e7;">
          ${i.imageUrl ? `<img src="${i.imageUrl}" width="48" height="48" style="border-radius:6px;vertical-align:middle;margin-right:10px;" />` : ""}
          ${escapeHtml(i.name)}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e4e4e7;text-align:center;">x${i.quantity}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e4e4e7;text-align:right;">${formatCents(i.priceCents * i.quantity, params.currency)}</td>
      </tr>`
  ).join("");

  const html = baseTemplate(
    `
    <h2>You left something behind!</h2>
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>You have items waiting in your cart at <strong>${escapeHtml(params.storeName)}</strong>. Complete your purchase before they sell out!</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;"><tbody>${itemsHtml}</tbody></table>
    <div style="text-align:center;margin:24px 0;">
      <a href="${params.storeUrl}/checkout" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#fff;border-radius:9999px;font-weight:600;text-decoration:none;font-size:16px;">Complete Your Order</a>
    </div>`,
    `You left items in your cart at ${params.storeName}`
  );

  return sendEmail({ to: params.to, subject: `You left something in your cart at ${params.storeName}!`, html });
}
