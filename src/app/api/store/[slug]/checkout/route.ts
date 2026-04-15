import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { generateOrderNumber } from "@/lib/constants/ecommerce";
import { calculateShipping, type ShippingConfig } from "@/lib/store/cart";
import { validateInventory } from "@/lib/store/inventory";
import { createStorePaymentIntent } from "@/lib/stripe/store-checkout";
import {
  STRIPE_METHOD_CATALOG,
  toPaymentMethodTypes,
  type StripeMethodId,
} from "@/lib/constants/stripe-methods";
import {
  notifyOrderConfirmation,
  notifyNewOrder,
} from "@/lib/notifications/commerce";
import { attributeOrderToAd } from "@/lib/ads/roas-tracker";

// ── Zod Schema ──

const shippingAddressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "ZIP code is required"),
  country: z.string().min(1, "Country is required"),
});

const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});

const checkoutSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email is required"),
  customerPhone: z.string().optional(),
  shippingAddress: shippingAddressSchema,
  items: z.array(checkoutItemSchema).min(1, "At least one item is required"),
  paymentMethod: z.string().refine(
    (v) => v === "card" || v === "cod" || v === "mobile_money" || v === "bank_transfer" || v.startsWith("stripe_"),
    { message: "Invalid payment method" }
  ),
  shippingMethod: z.enum(["standard", "local_pickup"]).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  referrer: z.string().max(500).optional(),
});

// ── POST /api/store/[slug]/checkout ──
//
// CARD PAYMENTS:
//   Do NOT create an Order. Write a PendingCheckout snapshot + Stripe PI.
//   On `payment_intent.succeeded` the webhook promotes PendingCheckout → Order,
//   deducts inventory, and sends the confirmation emails. Walked-away
//   checkouts expire via the PI's natural lifecycle and never appear in the
//   customer's "My Orders" list.
//
// NON-CARD (COD, mobile money, bank transfer):
//   Create the Order immediately since no external payment step has to
//   succeed. Deduct inventory now. Send emails now.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors.map((e) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      items,
      paymentMethod: rawPaymentMethod,
      shippingMethod,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      referrer,
    } = parsed.data;

    // `stripe_klarna` / `stripe_affirm` / ... collapse back to the card rail.
    const chosenStripeMethodId: StripeMethodId | null =
      rawPaymentMethod.startsWith("stripe_")
        ? (rawPaymentMethod.slice("stripe_".length) as StripeMethodId)
        : null;
    const paymentMethod = chosenStripeMethodId ? "card" : rawPaymentMethod;
    const isCardPayment = paymentMethod === "card";

    // ── Fetch store ──

    const store = await prisma.store.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        currency: true,
        region: true,
        settings: true,
        theme: true,
        logoUrl: true,
        customDomain: true,
        isActive: true,
        userId: true,
        stripeConnectAccountId: true,
        stripeOnboardingComplete: true,
        platformFeePercent: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!store || !store.isActive) {
      return NextResponse.json(
        { success: false, error: { code: "STORE_NOT_FOUND", message: "Store not found" } },
        { status: 404 }
      );
    }

    // ── Server-side price + inventory validation ──

    const validatedItems: Array<{
      productId: string;
      variantId?: string;
      name: string;
      variantName?: string;
      priceCents: number;
      quantity: number;
      imageUrl?: string;
    }> = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true, name: true, priceCents: true, status: true, deletedAt: true, images: true,
          variants: { select: { id: true, name: true, priceCents: true } },
        },
      });

      if (!product || product.status !== "ACTIVE" || product.deletedAt) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "PRODUCT_UNAVAILABLE",
              message: `Product "${product?.name || item.productId}" is not available`,
            },
          },
          { status: 400 }
        );
      }

      let priceCents = product.priceCents;
      let variantName: string | undefined;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          return NextResponse.json(
            { success: false, error: { code: "VARIANT_NOT_FOUND", message: `Variant not found for "${product.name}"` } },
            { status: 400 }
          );
        }
        priceCents = variant.priceCents;
        variantName = variant.name;
      }

      validatedItems.push({
        productId: product.id,
        variantId: item.variantId,
        name: product.name,
        variantName,
        priceCents,
        quantity: item.quantity,
        imageUrl: (() => { try { const imgs = JSON.parse(product.images || "[]"); return imgs[0]?.url; } catch { return undefined; } })(),
      });
    }

    const inventoryError = await validateInventory(
      validatedItems.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, quantity: i.quantity }))
    );
    if (inventoryError) {
      return NextResponse.json(
        { success: false, error: { code: "INSUFFICIENT_STOCK", message: inventoryError } },
        { status: 400 }
      );
    }

    // ── Totals ──

    const subtotalCents = validatedItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

    const storeSettings = store.settings ? JSON.parse(store.settings as string) : {};
    const shippingConfig: ShippingConfig | null = storeSettings.shipping || null;
    const shippingCents = calculateShipping(subtotalCents, shippingConfig, shippingMethod);
    const taxCents = 0;
    const totalCents = subtotalCents + shippingCents + taxCents;

    const connectReady = !!(store.stripeConnectAccountId && store.stripeOnboardingComplete);
    const platformFeeCents = connectReady ? Math.round(totalCents * (store.platformFeePercent / 100)) : 0;
    const storeOwnerAmountCents = connectReady ? totalCents - platformFeeCents : 0;

    // ── Stripe method allowlist (from Settings → Payments) ──

    const validStripeIds = new Set(STRIPE_METHOD_CATALOG.map((m) => m.id));
    const stripeAllowlist: StripeMethodId[] = Array.isArray(storeSettings.stripeMethods)
      ? (storeSettings.stripeMethods as unknown[])
          .filter((x): x is string => typeof x === "string")
          .filter((x) => validStripeIds.has(x as StripeMethodId)) as StripeMethodId[]
      : [];

    let stripePaymentMethodTypes: string[] | undefined;
    if (chosenStripeMethodId) {
      stripePaymentMethodTypes = toPaymentMethodTypes([chosenStripeMethodId]);
    } else if (isCardPayment) {
      stripePaymentMethodTypes = ["card", "link"];
    } else if (stripeAllowlist.length > 0) {
      stripePaymentMethodTypes = toPaymentMethodTypes(stripeAllowlist);
    }

    const emailItems = validatedItems.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      priceCents: i.priceCents,
      imageUrl: i.imageUrl || null,
    }));
    const addressForEmail = shippingAddress as Record<string, unknown>;

    // ──────────────────────────────────────────────────────────────────────
    // CARD PATH — PendingCheckout only, no Order yet
    // ──────────────────────────────────────────────────────────────────────
    if (isCardPayment) {
      // 1 — Reserve an order number ahead of time so the PI description /
      //     metadata can reference it even though the Order row doesn't exist
      //     until the webhook promotes the PendingCheckout.
      const orderNumber = generateOrderNumber();

      // 2 — Create the PaymentIntent first so we know the PI id.
      const pendingId = `pc_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      const { clientSecret, paymentIntentId } = await createStorePaymentIntent({
        orderId: pendingId, // we store the PendingCheckout id here — webhook looks it up
        storeId: store.id,
        storeSlug: store.slug,
        storeName: store.name,
        totalCents,
        currency: store.currency,
        customerEmail,
        ...(connectReady && {
          stripeConnectAccountId: store.stripeConnectAccountId!,
          platformFeeCents,
        }),
        paymentMethodTypes: stripePaymentMethodTypes,
      });

      // 3 — Persist the cart snapshot against the PI we just created.
      //     TTL 48h — PI lifetime is ~24h, buffer for clock skew / reviews.
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await prisma.pendingCheckout.create({
        data: {
          id: pendingId,
          storeId: store.id,
          stripePaymentIntentId: paymentIntentId,
          customerName,
          customerEmail,
          customerPhone: customerPhone || null,
          items: JSON.stringify(
            validatedItems.map((i) => ({
              name: i.name,
              priceCents: i.priceCents,
              quantity: i.quantity,
              productId: i.productId,
              variantId: i.variantId,
              variantName: i.variantName,
              imageUrl: i.imageUrl || null,
            }))
          ),
          shippingAddress: JSON.stringify(shippingAddress),
          shippingMethod: shippingMethod || "standard",
          subtotalCents,
          shippingCents,
          taxCents,
          totalCents,
          platformFeeCents,
          storeOwnerAmountCents,
          currency: store.currency,
          paymentMethod: "card",
          stripeConnectAccountId: store.stripeConnectAccountId || null,
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null,
          utmContent: utmContent || null,
          referrer: referrer || null,
          expiresAt,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId: pendingId,      // legacy field name — the client still uses this as an opaque token
          orderNumber,             // reserved; displayed in the confirm UI even before the Order exists
          clientSecret,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // NON-CARD PATH (COD / mobile money / bank transfer) — Order created now
    // ──────────────────────────────────────────────────────────────────────

    const orderNumber = generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          storeId: store.id,
          customerName,
          customerEmail,
          customerPhone: customerPhone || null,
          shippingAddress: JSON.stringify(shippingAddress),
          items: JSON.stringify(
            validatedItems.map((i) => ({
              name: i.name,
              priceCents: i.priceCents,
              quantity: i.quantity,
              productId: i.productId,
              variantId: i.variantId,
              variantName: i.variantName,
              imageUrl: i.imageUrl || null,
            }))
          ),
          subtotalCents,
          shippingCents,
          taxCents,
          totalCents,
          platformFeeCents,
          storeOwnerAmountCents,
          currency: store.currency,
          paymentMethod,
          shippingMethod: shippingMethod || "standard",
          status: "PENDING",
          paymentStatus: "pending",
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null,
          utmContent: utmContent || null,
          referrer: referrer || null,
        },
      });

      // Deduct inventory for offline-paid orders so the stock accurately
      // reflects the hold. (Card-paid inventory is deducted by the webhook.)
      await import("@/lib/store/inventory").then(({ deductInventory }) =>
        deductInventory(
          validatedItems.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, quantity: i.quantity })),
          tx
        )
      );

      return newOrder;
    });

    attributeOrderToAd(order.id).catch((err) => console.error("ROAS attribution failed:", err));

    // Parse store theme for branded emails
    const theme = (() => {
      try { return typeof store.theme === "string" ? JSON.parse(store.theme) : (store.theme || {}); }
      catch { return {}; }
    })() as { colors?: { primary?: string } };
    const accent = theme.colors?.primary;

    // Fire-and-forget branded emails — owner's SMTP via sendStoreEmail
    notifyOrderConfirmation({
      buyerEmail: customerEmail,
      customerName,
      orderNumber: order.orderNumber,
      items: emailItems,
      subtotalCents,
      shippingCents,
      taxCents,
      totalCents,
      currency: store.currency,
      paymentMethod,
      shippingAddress: addressForEmail,
      storeSlug: store.slug,
      storeName: store.name,
      storeOwnerUserId: store.userId,
      storeLogoUrl: store.logoUrl,
      storeAccentColor: accent,
      storeCustomDomain: store.customDomain,
    }).catch((err) => console.error("Failed to send order confirmation email:", err));

    notifyNewOrder({
      storeOwnerUserId: store.userId,
      storeOwnerEmail: store.user.email || "",
      storeOwnerName: store.user.name || "Store Owner",
      orderNumber: order.orderNumber,
      orderId: order.id,
      customerName,
      customerEmail,
      items: emailItems,
      totalCents,
      currency: store.currency,
      paymentMethod,
      storeSlug: store.slug,
      storeName: store.name,
      storeLogoUrl: store.logoUrl,
      storeAccentColor: accent,
      storeCustomDomain: store.customDomain,
    }).catch((err) => console.error("Failed to send new order alert email:", err));

    return NextResponse.json({
      success: true,
      data: { orderId: order.id, orderNumber: order.orderNumber },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CHECKOUT_FAILED",
          message: error instanceof Error ? error.message : "An unexpected error occurred during checkout",
        },
      },
      { status: 500 }
    );
  }
}
