import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { calculatePlatformFee } from "@/lib/ecommerce/platform-fees";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

/**
 * POST - Create checkout session with platform fee
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storeSlug, items, customerEmail, customerName } = body;

    if (!storeSlug || !items || !customerEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get store with Connect account
    const store = await prisma.store.findUnique({
      where: { slug: storeSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        currency: true,
        stripeConnectAccountId: true,
        stripeOnboardingComplete: true,
        platformFeePercent: true,
      },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    if (!store.stripeConnectAccountId || !store.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: "Store payment setup incomplete" },
        { status: 400 }
      );
    }

    // Validate items and calculate total
    let subtotalCents = 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, priceCents: true, images: true },
      });

      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 404 }
        );
      }

      const itemTotal = product.priceCents * item.quantity;
      subtotalCents += itemTotal;

      // Get product image
      let imageUrl = "";
      try {
        const images = JSON.parse(product.images as string || "[]");
        imageUrl = images[0]?.url || "";
      } catch {}

      lineItems.push({
        price_data: {
          currency: store.currency.toLowerCase(),
          product_data: {
            name: product.name,
            images: imageUrl ? [imageUrl] : [],
          },
          unit_amount: product.priceCents,
        },
        quantity: item.quantity,
      });
    }

    // TODO: Add shipping and tax calculation here
    const shippingCents = 0;
    const taxCents = 0;
    const totalCents = subtotalCents + shippingCents + taxCents;

    // Calculate platform fee
    const feeBreakdown = calculatePlatformFee(
      totalCents,
      store.platformFeePercent
    );

    // Create order record
    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const order = await prisma.order.create({
      data: {
        storeId: store.id,
        orderNumber,
        customerName: customerName || "Guest",
        customerEmail,
        items: JSON.stringify(
          items.map((item: { productId: string; quantity: number }) => ({
            productId: item.productId,
            quantity: item.quantity,
          }))
        ),
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        platformFeeCents: feeBreakdown.platformFeeCents,
        storeOwnerAmountCents: feeBreakdown.storeOwnerAmountCents,
        currency: store.currency,
        paymentMethod: "card",
        paymentStatus: "pending",
        status: "PENDING",
      },
    });

    // Create Stripe checkout session with platform fee
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,
      line_items: lineItems,
      payment_intent_data: {
        application_fee_amount: feeBreakdown.platformFeeCents,
        transfer_data: {
          destination: store.stripeConnectAccountId,
        },
        metadata: {
          orderId: order.id,
          storeId: store.id,
        },
      },
      metadata: {
        orderId: order.id,
        storeId: store.id,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/store/${store.slug}/success?orderId=${order.id}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/store/${store.slug}/cart`,
    });

    // Update order with payment ID
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentId: session.id },
    });

    return NextResponse.json({
      sessionId: session.id,
      sessionUrl: session.url,
      orderId: order.id,
      orderNumber,
      totalCents,
      platformFeeCents: feeBreakdown.platformFeeCents,
      storeOwnerAmountCents: feeBreakdown.storeOwnerAmountCents,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
