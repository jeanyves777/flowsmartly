import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";

/**
 * POST — Create a Stripe-hosted onboarding link (Account Links) for a Custom
 * account. Used for countries whose bank format we collect via Stripe rather
 * than in-app ("hosted" family), for company accounts, and to let a merchant
 * finish any leftover verification requirements. Still a Custom account — Stripe
 * just collects the country-specific fields correctly.
 */
export async function POST() {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
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
        { error: "No payout account found. Start setup first." },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
    const returnUrl = `${appUrl}/home/sell?payouts=return`;
    const refreshUrl = `${appUrl}/home/sell?payouts=refresh`;

    const link = await stripe.accountLinks.create({
      account: store.stripeConnectAccountId,
      type: "account_onboarding",
      refresh_url: refreshUrl,
      return_url: returnUrl,
      collection_options: { fields: "currently_due" },
    });

    return NextResponse.json({ url: link.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start onboarding";
    console.error("Stripe onboarding link error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
