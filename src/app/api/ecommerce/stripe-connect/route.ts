import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";

/**
 * POST - Create Stripe Connect Express account (if not exists)
 * Returns the account ID for use with embedded onboarding
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
      include: { user: true },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // If already has Connect account, return it
    if (store.stripeConnectAccountId) {
      return NextResponse.json({ accountId: store.stripeConnectAccountId });
    }

    // Create new Connect account
    const account = await stripe.accounts.create({
      type: "express",
      country: store.country || "US",
      email: store.user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      business_profile: {
        name: store.name,
        url: store.customDomain
          ? `https://${store.customDomain}`
          : `${process.env.NEXT_PUBLIC_APP_URL}/store/${store.slug}`,
      },
    });

    // Save account ID
    await prisma.store.update({
      where: { id: store.id },
      data: { stripeConnectAccountId: account.id },
    });

    return NextResponse.json({ accountId: account.id });
  } catch (error) {
    console.error("Stripe Connect account creation error:", error);
    return NextResponse.json(
      { error: "Failed to create Stripe Connect account" },
      { status: 500 }
    );
  }
}

/**
 * GET - Check Connect account status
 */
export async function GET() {
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
      select: {
        stripeConnectAccountId: true,
        stripeOnboardingComplete: true,
      },
    });

    if (!store || !store.stripeConnectAccountId) {
      return NextResponse.json({
        connected: false,
        onboardingComplete: false,
      });
    }

    // Check account status with Stripe
    const account = await stripe.accounts.retrieve(
      store.stripeConnectAccountId
    );

    const isComplete =
      account.charges_enabled && account.payouts_enabled;

    // Update onboarding status if changed
    if (isComplete !== store.stripeOnboardingComplete) {
      await prisma.store.update({
        where: { userId: session.userId },
        data: { stripeOnboardingComplete: isComplete },
      });
    }

    return NextResponse.json({
      connected: true,
      onboardingComplete: isComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (error) {
    console.error("Stripe Connect status check error:", error);
    return NextResponse.json(
      { error: "Failed to check Stripe Connect status" },
      { status: 500 }
    );
  }
}
