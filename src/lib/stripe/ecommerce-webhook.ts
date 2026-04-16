/**
 * Shared Stripe ecommerce webhook handlers.
 *
 * Used by both `/api/webhooks/stripe-ecommerce` (dedicated endpoint) and
 * `/api/payments/webhook` (unified endpoint in Stripe Dashboard) so that
 * whichever endpoint Stripe actually delivers the event to, store orders
 * are promoted, inventory is deducted, and branded emails + notifications
 * are fired via the store owner's configured email provider.
 */

import type Stripe from "stripe";
import { prisma } from "@/lib/db/client";
import { purchaseDomain } from "@/lib/domains/manager";
import { restoreInventory, deductInventory } from "@/lib/store/inventory";
import { generateOrderNumber } from "@/lib/constants/ecommerce";
import { stripe } from "@/lib/stripe";

// ───────────────────────────────────────────────────────────────────────────
// Payment succeeded — promote PendingCheckout → Order (or update legacy Order)
// ───────────────────────────────────────────────────────────────────────────

export async function handleEcommercePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const meta = paymentIntent.metadata || {};
  const { type, userId, domainName, tld, sld } = meta;

  // ── Domain purchase ──
  if (type === "domain_purchase" && userId && sld && tld) {
    try {
      const existing = await prisma.storeDomain.findUnique({
        where: { domainName: domainName || `${sld}.${tld}` },
      });
      if (existing) {
        console.log(`Domain ${domainName} already registered, skipping duplicate webhook`);
        return;
      }

      const brandKit = await prisma.brandKit.findFirst({
        where: { userId },
        select: { name: true, email: true, phone: true, address: true, city: true, state: true, zip: true, country: true },
      });

      const contact = brandKit?.name && brandKit?.email && brandKit?.phone && brandKit?.address
        ? {
            first_name: brandKit.name.split(/\s+/)[0] || "Domain",
            last_name: brandKit.name.split(/\s+/).slice(1).join(" ") || "Owner",
            org_name: brandKit.name,
            address1: brandKit.address,
            city: brandKit.city || "New York",
            state: brandKit.state || "NY",
            postal_code: brandKit.zip || "10001",
            country: brandKit.country?.length === 2 ? brandKit.country : "US",
            phone: brandKit.phone.startsWith("+") ? brandKit.phone : `+1.${brandKit.phone.replace(/\D/g, "")}`,
            email: brandKit.email,
          }
        : undefined;

      const result = await purchaseDomain({
        storeId: meta.storeId || null,
        userId,
        domainName: sld,
        tld,
        isFree: false,
        contact,
      });
      console.log(`Domain ${result.domainName} registered after payment ${paymentIntent.id}`);

      const { createInvoice } = await import("@/lib/invoices");
      const domainUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      await createInvoice({
        userId,
        type: "domain_purchase",
        items: [{ description: `Domain registration: ${result.domainName} (1 year)`, quantity: 1, unitPriceCents: paymentIntent.amount, totalCents: paymentIntent.amount }],
        totalCents: paymentIntent.amount,
        paymentMethod: paymentIntent.payment_method_types?.[0] || "card",
        paymentId: paymentIntent.id,
        customerName: domainUser?.name || undefined,
        customerEmail: domainUser?.email || undefined,
      });

      const { notifyDomainRegistered } = await import("@/lib/notifications/domain");
      await notifyDomainRegistered(userId, result.domainName);
    } catch (error: any) {
      console.error(`Failed to register domain ${domainName} after payment:`, error);
      const { notifyDomainRegistrationFailed } = await import("@/lib/notifications/domain");
      if (userId) await notifyDomainRegistrationFailed(userId, domainName || `${sld}.${tld}`, error.message);
    }
    return;
  }

  // ── Store order payment ──
  if (type !== "store_order" && !meta.orderId && !meta.pendingCheckoutId) {
    return; // not a store order event
  }

  const existing = await prisma.order.findFirst({ where: { paymentId: paymentIntent.id } });
  if (existing && existing.paymentStatus === "paid") {
    console.log(`[ecommerce-webhook] Order ${existing.orderNumber} already paid — skipping duplicate`);
    return;
  }

  const { last4, brand } = await extractPaymentDetails(paymentIntent).catch((err) => {
    console.warn("[ecommerce-webhook] Could not extract payment details:", err);
    return { last4: null, brand: null };
  });

  // Legacy flow: Order already exists — update it in place and fire emails.
  if (existing) {
    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        paymentStatus: "paid",
        status: "CONFIRMED",
        paymentLast4: last4,
        paymentBrand: brand,
      },
    });
    await bumpStoreStats(updated.storeId, updated.storeOwnerAmountCents || updated.totalCents, updated.platformFeeCents);
    await fireOrderEmails(updated.id);
    return;
  }

  // New flow: promote PendingCheckout → Order.
  const pendingId = meta.pendingCheckoutId || meta.orderId;
  if (!pendingId) {
    console.error("[ecommerce-webhook] No pendingCheckoutId in metadata, cannot create order", paymentIntent.id);
    return;
  }

  const pending = await prisma.pendingCheckout.findUnique({ where: { id: pendingId } });
  if (!pending) {
    console.error(`[ecommerce-webhook] PendingCheckout ${pendingId} not found for PI ${paymentIntent.id}`);
    return;
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Double-check inside transaction to prevent race from webhook retries
      const alreadyCreated = await tx.order.findFirst({ where: { paymentId: paymentIntent.id } });
      if (alreadyCreated) {
        console.log(`[ecommerce-webhook] Order already exists for PI ${paymentIntent.id} (caught in transaction)`);
        return alreadyCreated;
      }

      let items: Array<{ productId: string; variantId?: string; name: string; quantity: number }> = [];
      try { items = JSON.parse(pending.items || "[]"); } catch { items = []; }

      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          storeId: pending.storeId,
          customerName: pending.customerName,
          customerEmail: pending.customerEmail,
          customerPhone: pending.customerPhone,
          buyerUserId: pending.buyerUserId,
          items: pending.items,
          shippingAddress: pending.shippingAddress,
          shippingMethod: pending.shippingMethod,
          subtotalCents: pending.subtotalCents,
          shippingCents: pending.shippingCents,
          taxCents: pending.taxCents,
          totalCents: pending.totalCents,
          platformFeeCents: pending.platformFeeCents,
          storeOwnerAmountCents: pending.storeOwnerAmountCents,
          currency: pending.currency,
          paymentMethod: "card",
          paymentStatus: "paid",
          paymentId: paymentIntent.id,
          paymentLast4: last4,
          paymentBrand: brand,
          status: "CONFIRMED",
          utmSource: pending.utmSource,
          utmMedium: pending.utmMedium,
          utmCampaign: pending.utmCampaign,
          utmContent: pending.utmContent,
          referrer: pending.referrer,
        },
      });

      await deductInventory(
        items.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, quantity: i.quantity })),
        tx
      );

      await tx.pendingCheckout.delete({ where: { id: pending.id } }).catch(() => {});

      return newOrder;
    });

    await bumpStoreStats(order.storeId, order.storeOwnerAmountCents || order.totalCents, order.platformFeeCents);

    const { attributeOrderToAd } = await import("@/lib/ads/roas-tracker");
    attributeOrderToAd(order.id).catch((err) => console.error("ROAS attribution failed:", err));

    await fireOrderEmails(order.id);
    console.log(`[ecommerce-webhook] Order ${order.orderNumber} created from PendingCheckout ${pending.id}`);
  } catch (err) {
    console.error(`[ecommerce-webhook] Failed to promote PendingCheckout ${pending.id}:`, err);
  }
}

export async function handleEcommercePaymentFailedOrCanceled(paymentIntent: Stripe.PaymentIntent) {
  const pendingId = paymentIntent.metadata?.pendingCheckoutId || paymentIntent.metadata?.orderId;
  if (!pendingId) return;
  try {
    await prisma.pendingCheckout.delete({ where: { id: pendingId } });
    console.log(`[ecommerce-webhook] Dropped PendingCheckout ${pendingId} after ${paymentIntent.status}`);
  } catch { /* already gone */ }
}

async function extractPaymentDetails(paymentIntent: Stripe.PaymentIntent): Promise<{
  last4: string | null;
  brand: string | null;
}> {
  const latestChargeId = (paymentIntent.latest_charge as string | null) || null;
  if (!latestChargeId || !stripe) return { last4: null, brand: null };

  const charge = await stripe.charges.retrieve(latestChargeId, {
    expand: ["payment_method_details"],
  });

  const pmId = typeof charge.payment_method === "string" ? charge.payment_method : null;
  if (pmId) {
    stripe.paymentMethods
      .update(pmId, { allow_redisplay: "always" })
      .catch((e) => console.warn("[ecommerce-webhook] allow_redisplay update failed for", pmId, ":", e?.message));
  }

  const pmd = charge.payment_method_details;
  if (!pmd) return { last4: null, brand: null };

  if (pmd.card) return { last4: pmd.card.last4 || null, brand: pmd.card.brand || null };
  if ((pmd as any).cashapp) return { last4: null, brand: "cashapp" };
  if ((pmd as any).klarna) return { last4: null, brand: "klarna" };
  if ((pmd as any).affirm) return { last4: null, brand: "affirm" };
  if ((pmd as any).afterpay_clearpay) return { last4: null, brand: "afterpay" };
  if ((pmd as any).link) return { last4: null, brand: "link" };
  if (pmd.ideal) return { last4: null, brand: "ideal" };
  if (pmd.bancontact) return { last4: null, brand: "bancontact" };
  if (pmd.sepa_debit) return { last4: pmd.sepa_debit.last4 || null, brand: "sepa" };
  return { last4: null, brand: pmd.type || null };
}

async function bumpStoreStats(storeId: string, revenue: number, feeCents: number) {
  await prisma.store.update({
    where: { id: storeId },
    data: {
      orderCount: { increment: 1 },
      totalRevenueCents: { increment: revenue },
      platformFeesCollectedCents: { increment: feeCents },
    },
  });
}

/**
 * Fire customer + store-owner order emails through the store owner's
 * configured email provider (MarketingConfig → sendStoreEmail), plus
 * create in-app notifications and an invoice record.
 */
async function fireOrderEmails(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      store: {
        select: {
          id: true, name: true, slug: true, currency: true, logoUrl: true, theme: true, customDomain: true,
          userId: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });
  if (!order) return;

  let items: Array<{ name: string; quantity: number; priceCents: number; imageUrl?: string | null }> = [];
  try { items = JSON.parse(order.items || "[]"); } catch { items = []; }
  let shippingAddress: Record<string, unknown> = {};
  try { shippingAddress = JSON.parse(order.shippingAddress || "{}"); } catch { shippingAddress = {}; }

  const theme = (() => {
    try { return typeof order.store.theme === "string" ? JSON.parse(order.store.theme) : (order.store.theme || {}); }
    catch { return {}; }
  })() as { colors?: { primary?: string } };
  const accent = theme.colors?.primary;

  const { notifyOrderConfirmation, notifyNewOrder } = await import("@/lib/notifications/commerce");

  // Invoice record for the store owner's accounting.
  try {
    const { createInvoice } = await import("@/lib/invoices");
    const existingInvoice = await prisma.invoice.findFirst({ where: { paymentId: order.paymentId || order.id } });
    if (!existingInvoice) {
      await createInvoice({
        userId: order.store.userId,
        type: "store_order",
        items: items.map((i) => ({
          description: `${i.name} × ${i.quantity}`,
          quantity: i.quantity,
          unitPriceCents: i.priceCents,
          totalCents: i.priceCents * i.quantity,
        })),
        totalCents: order.totalCents,
        paymentMethod: order.paymentMethod || "card",
        paymentId: order.paymentId || order.id,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
      });
    }
  } catch (err) {
    console.error("[ecommerce-webhook] Failed to create invoice for order:", err);
  }

  notifyOrderConfirmation({
    buyerEmail: order.customerEmail,
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    items,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    currency: order.currency,
    paymentMethod: order.paymentMethod || "card",
    paymentLast4: order.paymentLast4,
    paymentBrand: order.paymentBrand,
    shippingAddress,
    storeSlug: order.store.slug,
    storeName: order.store.name,
    storeOwnerUserId: order.store.userId,
    storeLogoUrl: order.store.logoUrl,
    storeAccentColor: accent,
    storeCustomDomain: order.store.customDomain,
  }).catch((err) => console.error("[ecommerce-webhook] Failed to send confirmation email:", err));

  notifyNewOrder({
    storeOwnerUserId: order.store.userId,
    storeOwnerEmail: order.store.user?.email || "",
    storeOwnerName: order.store.user?.name || "Store Owner",
    orderNumber: order.orderNumber,
    orderId: order.id,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    items,
    totalCents: order.totalCents,
    currency: order.currency,
    paymentMethod: order.paymentMethod || "card",
    storeSlug: order.store.slug,
    storeName: order.store.name,
    storeLogoUrl: order.store.logoUrl,
    storeAccentColor: accent,
    storeCustomDomain: order.store.customDomain,
  }).catch((err) => console.error("[ecommerce-webhook] Failed to send new order alert email:", err));
}

// ───────────────────────────────────────────────────────────────────────────
// Refund / Connect / Payout handlers
// ───────────────────────────────────────────────────────────────────────────

export async function handleEcommerceRefund(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string;
  const order = await prisma.order.findFirst({ where: { paymentId: paymentIntentId } });
  if (!order) return;

  const refundedAmountCents = charge.amount_refunded;

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: "refunded", status: "REFUNDED" },
  });

  restoreInventory(order.id).catch((err) => console.error("Failed to restore inventory on refund:", err));

  await prisma.store.update({
    where: { id: order.storeId },
    data: {
      totalRevenueCents: { decrement: refundedAmountCents },
      platformFeesCollectedCents: { decrement: order.platformFeeCents },
    },
  });

  console.log(`[ecommerce-webhook] Order ${order.orderNumber} refunded`);
}

export async function handleEcommerceAccountUpdated(account: Stripe.Account) {
  const isComplete = !!(account.charges_enabled && account.payouts_enabled);
  const store = await prisma.store.findFirst({
    where: { stripeConnectAccountId: account.id },
    select: { id: true, stripeOnboardingComplete: true },
  });
  if (!store) return;
  if (isComplete !== store.stripeOnboardingComplete) {
    await prisma.store.update({
      where: { id: store.id },
      data: { stripeOnboardingComplete: isComplete },
    });
    console.log(`[ecommerce-webhook] Store ${store.id} Connect status updated: onboardingComplete=${isComplete}`);
  }
}

export async function handleEcommercePayoutEvent(payout: Stripe.Payout, connectedAccountId?: string) {
  if (!connectedAccountId) return;
  const store = await prisma.store.findFirst({
    where: { stripeConnectAccountId: connectedAccountId },
    select: { id: true },
  });
  if (!store) return;

  await prisma.storePayout.upsert({
    where: { stripePayoutId: payout.id },
    create: {
      storeId: store.id,
      stripePayoutId: payout.id,
      amountCents: payout.amount,
      feeCents: 0,
      netCents: payout.amount,
      currency: payout.currency,
      status: payout.status,
      failureMessage: payout.failure_message || null,
      method: payout.method || null,
      arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
      description: payout.description || null,
    },
    update: {
      status: payout.status,
      failureMessage: payout.failure_message || null,
      arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
    },
  });

  console.log(`[ecommerce-webhook] Payout ${payout.id} ${payout.status} for store ${store.id}`);
}
