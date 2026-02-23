import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getOrCreateStripeCustomer } from "@/lib/stripe";
import {
  createEcommerceCheckoutSession,
  createEcommerceSubscription,
} from "@/lib/stripe/ecommerce";

/**
 * POST /api/ecommerce/activate
 * Activate the FlowShop e-commerce add-on ($5/month).
 * If user has a saved payment method: creates inline subscription.
 * Otherwise: creates a Stripe Checkout session for redirect.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Check if user already has a store
    const existingStore = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true, ecomSubscriptionStatus: true },
    });

    if (existingStore && existingStore.ecomSubscriptionStatus === "active") {
      return NextResponse.json(
        { success: false, error: { code: "ALREADY_ACTIVE", message: "FlowShop is already active" } },
        { status: 409 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true, stripeCustomerId: true, country: true, region: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const paymentMethodId = body.paymentMethodId as string | undefined;

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(session.userId);

    if (paymentMethodId) {
      // Inline subscription flow (user has a saved payment method)
      const result = await createEcommerceSubscription({
        userId: session.userId,
        customerId,
        paymentMethodId,
      });

      // Create store record (inactive until webhook confirms)
      if (!existingStore) {
        await prisma.store.create({
          data: {
            userId: session.userId,
            name: user.name || "My Store",
            slug: `store-${session.userId.slice(0, 8)}`,
            region: user.region,
            country: user.country,
            ecomSubscriptionId: result.subscriptionId,
            ecomSubscriptionStatus: result.status === "active" ? "active" : "inactive",
            isActive: result.status === "active",
          },
        });
      } else {
        await prisma.store.update({
          where: { userId: session.userId },
          data: {
            ecomSubscriptionId: result.subscriptionId,
            ecomSubscriptionStatus: result.status === "active" ? "active" : "inactive",
            isActive: result.status === "active",
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          subscriptionId: result.subscriptionId,
          clientSecret: result.clientSecret,
          status: result.status,
          flow: "inline",
        },
      });
    } else {
      // Checkout redirect flow (no saved payment method)
      const result = await createEcommerceCheckoutSession({
        userId: session.userId,
        userEmail: user.email,
        customerId,
      });

      // Create store record (inactive until webhook confirms)
      if (!existingStore) {
        await prisma.store.create({
          data: {
            userId: session.userId,
            name: user.name || "My Store",
            slug: `store-${session.userId.slice(0, 8)}`,
            region: user.region,
            country: user.country,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          url: result.url,
          flow: "checkout",
        },
      });
    }
  } catch (error) {
    console.error("E-commerce activation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to activate e-commerce" } },
      { status: 500 }
    );
  }
}
