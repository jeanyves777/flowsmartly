import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";

/**
 * POST - Create an Account Session for Stripe Connect embedded onboarding
 * Returns a client_secret to initialize the ConnectComponentsProvider
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
      select: { stripeConnectAccountId: true },
    });

    if (!store?.stripeConnectAccountId) {
      return NextResponse.json(
        { error: "No Stripe Connect account found. Create one first." },
        { status: 400 }
      );
    }

    const accountSession = await stripe.accountSessions.create({
      account: store.stripeConnectAccountId,
      components: {
        account_onboarding: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },
      },
    });

    return NextResponse.json({
      client_secret: accountSession.client_secret,
    });
  } catch (error) {
    console.error("Stripe Account Session error:", error);
    return NextResponse.json(
      { error: "Failed to create account session" },
      { status: 500 }
    );
  }
}
