import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";
import { notifyPaymentMethodAdded } from "@/lib/notifications";

// POST /api/payments/methods/notify - Send notification after card added
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { success: false, error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { paymentMethodId } = body as { paymentMethodId?: string };

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: "paymentMethodId is required" },
        { status: 400 }
      );
    }

    // Verify the payment method belongs to this user's customer
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true, stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: "No customer found" },
        { status: 400 }
      );
    }

    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== user.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: "Payment method not found" },
        { status: 404 }
      );
    }

    const cardBrand = pm.card?.brand || "card";
    const last4 = pm.card?.last4 || "****";

    // Send notification (fire-and-forget)
    notifyPaymentMethodAdded({
      userId: session.userId,
      email: user.email,
      name: user.name,
      cardBrand,
      last4,
    }).catch((err) => console.error("Failed to send payment method added notification:", err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Payment method notify error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
