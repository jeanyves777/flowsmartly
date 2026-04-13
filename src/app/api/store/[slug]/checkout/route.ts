import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { generateOrderNumber } from "@/lib/constants/ecommerce";
import { calculateShipping, type ShippingConfig } from "@/lib/store/cart";
import { validateInventory, deductInventory } from "@/lib/store/inventory";
import { createStorePaymentIntent } from "@/lib/stripe/store-checkout";
import { stripe } from "@/lib/stripe";
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
  paymentMethod: z.enum(["card", "cod", "mobile_money", "bank_transfer"]),
  shippingMethod: z.enum(["standard", "local_pickup"]).optional(),
  // UTM Attribution
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  referrer: z.string().max(500).optional(),
});

// ── POST /api/store/[slug]/checkout ──

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Parse and validate request body
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
      paymentMethod,
      shippingMethod,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      referrer,
    } = parsed.data;

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
        {
          success: false,
          error: { code: "STORE_NOT_FOUND", message: "Store not found" },
        },
        { status: 404 }
      );
    }

    // ── Server-side price validation ──
    // NEVER trust client prices — fetch from DB for each item

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
          id: true,
          name: true,
          priceCents: true,
          status: true,
          deletedAt: true,
          images: true,
          variants: {
            select: {
              id: true,
              name: true,
              priceCents: true,
            },
          },
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
            {
              success: false,
              error: {
                code: "VARIANT_NOT_FOUND",
                message: `Variant not found for "${product.name}"`,
              },
            },
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

    // ── Inventory validation ──

    const inventoryError = await validateInventory(
      validatedItems.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        name: i.name,
        quantity: i.quantity,
      }))
    );

    if (inventoryError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INSUFFICIENT_STOCK", message: inventoryError },
        },
        { status: 400 }
      );
    }

    // ── Calculate totals ──

    const subtotalCents = validatedItems.reduce(
      (sum, item) => sum + item.priceCents * item.quantity,
      0
    );

    const storeSettings = store.settings
      ? JSON.parse(store.settings as string)
      : {};
    const shippingConfig: ShippingConfig | null =
      storeSettings.shipping || null;

    const shippingCents = calculateShipping(
      subtotalCents,
      shippingConfig,
      shippingMethod
    );

    const taxCents = 0; // Deferred: tax calculation
    const totalCents = subtotalCents + shippingCents + taxCents;

    // ── Deduplication: reuse existing pending card payment within 24h ──
    // Prevents duplicate orders when a user abandons and retries checkout.
    if (paymentMethod === "card" && stripe) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existingPending = await prisma.order.findFirst({
        where: {
          storeId: store.id,
          customerEmail,
          paymentMethod: "card",
          paymentStatus: "pending",
          totalCents,
          createdAt: { gte: cutoff },
        },
        select: { id: true, paymentId: true },
        orderBy: { createdAt: "desc" },
      });
      if (existingPending?.paymentId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(existingPending.paymentId);
          if (pi.status !== "canceled" && pi.status !== "succeeded") {
            return NextResponse.json({
              success: true,
              data: { orderId: existingPending.id, clientSecret: pi.client_secret, total: totalCents },
            });
          }
        } catch { /* PI gone — fall through to create fresh order */ }
      }
    }

    // ── Platform fee calculation (for Stripe Connect stores) ──
    const connectReady = !!(store.stripeConnectAccountId && store.stripeOnboardingComplete);
    const platformFeeCents = connectReady
      ? Math.round(totalCents * (store.platformFeePercent / 100))
      : 0;
    const storeOwnerAmountCents = connectReady ? totalCents - platformFeeCents : 0;

    // ── Prisma transaction: create Order + deduct inventory ──

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

      // Deduct inventory atomically
      await deductInventory(
        validatedItems.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          name: i.name,
          quantity: i.quantity,
        })),
        tx
      );

      return newOrder;
    });

    // ── Fire-and-forget ROAS attribution ──

    attributeOrderToAd(order.id).catch((err) =>
      console.error("ROAS attribution failed:", err)
    );

    // ── Fire-and-forget notification emails ──
    // For card payments, emails are sent ONLY after the webhook confirms payment.
    // For all other methods (COD, mobile_money, bank_transfer), send immediately.

    const emailItems = validatedItems.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      priceCents: i.priceCents,
    }));

    if (paymentMethod !== "card") {
      // Buyer confirmation
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
        storeSlug: store.slug,
        storeName: store.name,
      }).catch((err) =>
        console.error("Failed to send order confirmation email:", err)
      );

      // Store owner notification
      notifyNewOrder({
        storeOwnerUserId: store.userId,
        storeOwnerEmail: store.user.email || "",
        storeOwnerName: store.user.name || "Store Owner",
        orderNumber: order.orderNumber,
        orderId: order.id,
        customerName,
        customerEmail,
        itemCount: validatedItems.length,
        totalCents,
        currency: store.currency,
        paymentMethod,
        storeName: store.name,
      }).catch((err) =>
        console.error("Failed to send new order alert email:", err)
      );
    }

    // ── Payment method handling ──

    if (paymentMethod === "card") {
      const { clientSecret, paymentIntentId } = await createStorePaymentIntent({
        orderId: order.id,
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
      });

      // Update order with paymentIntentId for webhook matching
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentId: paymentIntentId },
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          clientSecret,
        },
      });
    }

    // COD, mobile_money, bank_transfer — no redirect needed
    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CHECKOUT_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred during checkout",
        },
      },
      { status: 500 }
    );
  }
}
