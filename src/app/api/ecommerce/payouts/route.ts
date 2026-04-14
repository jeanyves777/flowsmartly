import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

/**
 * GET - List payouts for the current store owner
 * Syncs from Stripe on each request and returns the local DB records
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.store.findFirst({
      where: { userId: session.userId, deletedAt: null },
      select: {
        id: true,
        stripeConnectAccountId: true,
        stripeOnboardingComplete: true,
        currency: true,
        platformFeePercent: true,
      },
    });

    if (!store) {
      return NextResponse.json({ error: "No store found" }, { status: 404 });
    }

    if (!store.stripeConnectAccountId) {
      return NextResponse.json({
        success: true,
        data: {
          payouts: [],
          balance: { available: 0, pending: 0 },
          onboardingComplete: false,
          currency: store.currency,
        },
      });
    }

    // Fetch balance from Stripe
    let balance = { available: 0, pending: 0 };
    try {
      const stripeBalance = await stripe.balance.retrieve({
        stripeAccount: store.stripeConnectAccountId,
      });
      balance.available = stripeBalance.available.reduce(
        (sum, b) => sum + b.amount,
        0
      );
      balance.pending = stripeBalance.pending.reduce(
        (sum, b) => sum + b.amount,
        0
      );
    } catch {
      // Balance may not be available yet
    }

    // Sync recent payouts from Stripe into local DB
    try {
      const stripePayouts = await stripe.payouts.list(
        { limit: 50 },
        { stripeAccount: store.stripeConnectAccountId }
      );

      for (const sp of stripePayouts.data) {
        await prisma.storePayout.upsert({
          where: { stripePayoutId: sp.id },
          create: {
            storeId: store.id,
            stripePayoutId: sp.id,
            amountCents: sp.amount,
            feeCents: 0,
            netCents: sp.amount,
            currency: sp.currency,
            status: sp.status,
            failureMessage: sp.failure_message || null,
            method: sp.method || null,
            arrivalDate: sp.arrival_date
              ? new Date(sp.arrival_date * 1000)
              : null,
            description: sp.description || null,
          },
          update: {
            status: sp.status,
            failureMessage: sp.failure_message || null,
            arrivalDate: sp.arrival_date
              ? new Date(sp.arrival_date * 1000)
              : null,
          },
        });
      }
    } catch {
      // Payout list may fail if account is new
    }

    // Fetch from local DB
    const payouts = await prisma.storePayout.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: {
        payouts,
        balance,
        onboardingComplete: store.stripeOnboardingComplete,
        currency: store.currency,
        platformFeePercent: store.platformFeePercent,
      },
    });
  } catch (error: any) {
    console.error("Payouts API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    );
  }
}
