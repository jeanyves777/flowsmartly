import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";

// POST /api/payments/portal - Create a Stripe Customer Portal session
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { success: false, error: { message: "Stripe is not configured" } },
        { status: 500 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, stripeCustomerId: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "User not found" } },
        { status: 404 }
      );
    }

    let customerId = user.stripeCustomerId;

    // Create a Stripe customer if one doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: session.userId },
      });

      customerId = customer.id;

      // Save the customer ID to the user
      await prisma.user.update({
        where: { id: session.userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create a Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/settings?tab=billing`,
    });

    return NextResponse.json({
      success: true,
      data: { url: portalSession.url },
    });
  } catch (error) {
    console.error("Create portal session error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create portal session" } },
      { status: 500 }
    );
  }
}
