import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

/**
 * POST - Create Stripe Connect account and return onboarding link
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get store
    const store = await prisma.store.findFirst({
      where: { userId: session.userId },
      include: { user: true },
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // If already has Connect account, return refresh link
    if (store.stripeConnectAccountId) {
      const accountLink = await stripe.accountLinks.create({
        account: store.stripeConnectAccountId,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/ecommerce/settings?tab=payments`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/ecommerce/settings?tab=payments&connect=success`,
        type: "account_onboarding",
      });

      return NextResponse.json({ url: accountLink.url });
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

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/ecommerce/settings?tab=payments`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/ecommerce/settings?tab=payments&connect=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Stripe Connect onboarding error:", error);
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
