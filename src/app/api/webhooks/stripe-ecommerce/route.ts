import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { purchaseDomain } from "@/lib/domains/manager";
import { restoreInventory, deductInventory } from "@/lib/store/inventory";
import { generateOrderNumber } from "@/lib/constants/ecommerce";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_ECOMMERCE!;

/**
 * POST - Handle Stripe webhooks for e-commerce payments
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.canceled":
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailedOrCanceled(paymentIntent);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        break;
      }

      case "payout.paid":
      case "payout.failed":
      case "payout.canceled": {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutEvent(payout, event.account);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 400 });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Payment succeeded — promote PendingCheckout → Order OR, if an Order
// already exists (legacy pre-PendingCheckout flow), update it in place.
// ───────────────────────────────────────────────────────────────────────────

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const meta = paymentIntent.metadata || {};
  const { type, userId, domainName, tld, sld } = meta;

  // ── Domain purchase (unrelated flow, unchanged) ──
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

  // Idempotency: if an Order already exists for this PI, do nothing.
  const existing = await prisma.order.findFirst({ where: { paymentId: paymentIntent.id } });
  if (existing && existing.paymentStatus === "paid") {
    console.log(`[webhook] Order ${existing.orderNumber} already paid — skipping duplicate webhook`);
    return;
  }

  // Last-4 + brand extraction — best-effort from the PI's latest charge.
  const { last4, brand } = await extractPaymentDetails(paymentIntent).catch((err) => {
    console.warn("[webhook] Could not extract payment details:", err);
    return { last4: null, brand: null };
  });

  // Legacy flow: an Order row already exists (pre-PendingCheckout migration) —
  // update it in place and fire emails.
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

  // New flow: promote the PendingCheckout into a real Order.
  const pendingId = meta.pendingCheckoutId || meta.orderId;
  if (!pendingId) {
    console.error("[webhook] No pendingCheckoutId in metadata, cannot create order", paymentIntent.id);
    return;
  }

  const pending = await prisma.pendingCheckout.findUnique({ where: { id: pendingId } });
  if (!pending) {
    console.error(`[webhook] PendingCheckout ${pendingId} not found for PI ${paymentIntent.id}`);
    return;
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const items = JSON.parse(pending.items || "[]") as Array<{
        productId: string; variantId?: string; name: string; quantity: number;
      }>;

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

      // Deduct inventory now that payment is confirmed.
      await deductInventory(
        items.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, quantity: i.quantity })),
        tx
      );

      // Drop the pending snapshot — the Order supersedes it.
      await tx.pendingCheckout.delete({ where: { id: pending.id } }).catch(() => {});

      return newOrder;
    });

    await bumpStoreStats(order.storeId, order.storeOwnerAmountCents || order.totalCents, order.platformFeeCents);

    // ROAS attribution (fire-and-forget)
    const { attributeOrderToAd } = await import("@/lib/ads/roas-tracker");
    attributeOrderToAd(order.id).catch((err) => console.error("ROAS attribution failed:", err));

    await fireOrderEmails(order.id);
    console.log(`[webhook] Order ${order.orderNumber} created from PendingCheckout ${pending.id}`);
  } catch (err) {
    console.error(`[webhook] Failed to promote PendingCheckout ${pending.id}:`, err);
  }
}

// Delete the pending snapshot when Stripe tells us the customer gave up.
async function handlePaymentFailedOrCanceled(paymentIntent: Stripe.PaymentIntent) {
  const pendingId = paymentIntent.metadata?.pendingCheckoutId || paymentIntent.metadata?.orderId;
  if (!pendingId) return;
  try {
    await prisma.pendingCheckout.delete({ where: { id: pendingId } });
    console.log(`[webhook] Dropped PendingCheckout ${pendingId} after ${paymentIntent.status}`);
  } catch { /* already gone */ }
}

async function extractPaymentDetails(paymentIntent: Stripe.PaymentIntent): Promise<{
  last4: string | null;
  brand: string | null;
}> {
  // Expand the latest charge to read the payment method details.
  const latestChargeId = (paymentIntent.latest_charge as string | null) || null;
  if (!latestChargeId) return { last4: null, brand: null };

  const charge = await stripe.charges.retrieve(latestChargeId, {
    expand: ["payment_method_details"],
  });

  // Promote the attached PaymentMethod so it appears in future Saved tabs.
  // Cards auto-saved via setup_future_usage default to allow_redisplay=limited;
  // SetupIntent-saved cards default to unspecified. Both can be hidden by
  // PaymentElement. Flipping to "always" makes them reliably visible.
  const pmId = typeof charge.payment_method === "string" ? charge.payment_method : null;
  if (pmId) {
    stripe.paymentMethods
      .update(pmId, { allow_redisplay: "always" })
      .catch((e) => console.warn("[webhook] allow_redisplay update failed for", pmId, ":", e?.message));
  }

  const pmd = charge.payment_method_details;
  if (!pmd) return { last4: null, brand: null };

  // Card rails
  if (pmd.card) return { last4: pmd.card.last4 || null, brand: pmd.card.brand || null };
  // Cash App Pay
  if ((pmd as any).cashapp) return { last4: null, brand: "cashapp" };
  // Klarna / Affirm / Afterpay — no last4, use rail name as brand
  if ((pmd as any).klarna) return { last4: null, brand: "klarna" };
  if ((pmd as any).affirm) return { last4: null, brand: "affirm" };
  if ((pmd as any).afterpay_clearpay) return { last4: null, brand: "afterpay" };
  // Link
  if ((pmd as any).link) return { last4: null, brand: "link" };
  // iDEAL / Bancontact / SEPA Direct Debit — expose IBAN last 4 where available
  if (pmd.ideal) return { last4: null, brand: "ideal" };
  if (pmd.bancontact) return { last4: null, brand: "bancontact" };
  if (pmd.sepa_debit) return { last4: pmd.sepa_debit.last4 || null, brand: "sepa" };
  // Everything else
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

  const items = JSON.parse(order.items || "[]") as Array<{
    name: string; quantity: number; priceCents: number; imageUrl?: string | null;
  }>;
  const shippingAddress = JSON.parse(order.shippingAddress || "{}") as Record<string, unknown>;

  const theme = (() => {
    try { return typeof order.store.theme === "string" ? JSON.parse(order.store.theme) : (order.store.theme || {}); }
    catch { return {}; }
  })() as { colors?: { primary?: string } };
  const accent = theme.colors?.primary;

  const { notifyOrderConfirmation, notifyNewOrder } = await import("@/lib/notifications/commerce");

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
  }).catch((err) => console.error("Failed to send confirmation email:", err));

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
  }).catch((err) => console.error("Failed to send new order alert email:", err));
}

// ───────────────────────────────────────────────────────────────────────────
// Other webhook handlers (unchanged behaviour)
// ───────────────────────────────────────────────────────────────────────────

async function handleRefund(charge: Stripe.Charge) {
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

  console.log(`Order ${order.orderNumber} refunded`);
}

async function handleAccountUpdated(account: Stripe.Account) {
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
    console.log(`Store ${store.id} Connect status updated: onboardingComplete=${isComplete}`);
  }
}

async function handlePayoutEvent(payout: Stripe.Payout, connectedAccountId?: string) {
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

  console.log(`Payout ${payout.id} ${payout.status} for store ${store.id}`);
}
