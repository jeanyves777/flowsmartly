import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { stripe } from "@/lib/stripe";

/**
 * POST - Create Stripe Connect Custom account with pre-filled user data
 * Pulls name, email, phone, address from User + BrandKit automatically.
 * Returns the account ID and what fields are still needed.
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

    // If already has Connect account, return it with current requirements
    if (store.stripeConnectAccountId) {
      const account = await stripe.accounts.retrieve(store.stripeConnectAccountId);
      return NextResponse.json({
        accountId: store.stripeConnectAccountId,
        requirements: account.requirements?.currently_due || [],
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      });
    }

    // Pull user data from BrandKit
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      select: { phone: true, address: true, city: true, state: true, zip: true, country: true },
    });

    // Split name into first/last
    const nameParts = (store.user.name || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const country = brandKit?.country || store.country || "US";

    // Create Custom account with all data we already have
    const account = await stripe.accounts.create({
      type: "custom",
      country,
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
        mcc: "5734", // Computer software stores
      },
      individual: {
        first_name: firstName,
        last_name: lastName,
        email: store.user.email,
        ...(brandKit?.phone && {
          phone: brandKit.phone.startsWith("+")
            ? brandKit.phone
            : `+1${brandKit.phone.replace(/\D/g, "")}`,
        }),
        ...(brandKit?.address && {
          address: {
            line1: brandKit.address,
            city: brandKit.city || undefined,
            state: brandKit.state || undefined,
            postal_code: brandKit.zip || undefined,
            country,
          },
        }),
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: "0.0.0.0", // Will be overridden by the completion endpoint with real IP
      },
    });

    // Save account ID
    await prisma.store.update({
      where: { id: store.id },
      data: { stripeConnectAccountId: account.id },
    });

    return NextResponse.json({
      accountId: account.id,
      requirements: account.requirements?.currently_due || [],
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (error: any) {
    console.error("Stripe Connect account creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payout account" },
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

    const account = await stripe.accounts.retrieve(
      store.stripeConnectAccountId
    );

    const isComplete =
      account.charges_enabled && account.payouts_enabled;

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
      requirements: account.requirements?.currently_due || [],
    });
  } catch (error) {
    console.error("Stripe Connect status check error:", error);
    return NextResponse.json(
      { error: "Failed to check payout status" },
      { status: 500 }
    );
  }
}
