import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";

/**
 * POST - Generate a one-time login link to the Stripe Express Dashboard
 */
export async function POST() {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.store.findFirst({
      where: { userId: session.userId },
      select: { stripeConnectAccountId: true, stripeOnboardingComplete: true },
    });

    if (!store?.stripeConnectAccountId || !store.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: "Stripe Connect onboarding not complete" },
        { status: 400 }
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(
      store.stripeConnectAccountId
    );

    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    console.error("Stripe login link error:", error);
    return NextResponse.json(
      { error: "Failed to generate dashboard link" },
      { status: 500 }
    );
  }
}
