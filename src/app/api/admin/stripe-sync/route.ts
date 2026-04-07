import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { syncStripeSubscriptions } from "@/lib/subscriptions";

/**
 * GET /api/admin/stripe-sync
 * Admin endpoint: Sync subscription data from Stripe and report discrepancies.
 * Also callable as a cron job with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  // Check admin auth or cron secret
  const cronSecret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "flowsmartly-cron-2026";

  if (cronSecret !== expectedSecret) {
    // Fall back to session-based admin auth
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { plan: true },
    });

    // Simple admin check — adjust based on your admin role system
    if (!user || user.plan !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  }

  try {
    console.log("[Admin] Starting Stripe subscription sync...");
    const result = await syncStripeSubscriptions();
    console.log(`[Admin] Stripe sync: ${result.synced}/${result.total} synced, ${result.discrepancies} discrepancies`);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Admin] Stripe sync error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/stripe-sync
 * Fix a specific discrepancy by syncing a user's plan from Stripe.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { plan: true },
  });

  if (!adminUser || adminUser.plan !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: "userId and action are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, plan: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (action === "reset_to_starter") {
      await prisma.user.update({
        where: { id: userId },
        data: { plan: "STARTER", planExpiresAt: null },
      });
      return NextResponse.json({ success: true, message: `User ${user.email} reset to STARTER` });
    }

    if (action === "sync_from_stripe") {
      if (!user.stripeCustomerId) {
        return NextResponse.json({ error: "User has no Stripe customer ID" }, { status: 400 });
      }

      const { stripe } = await import("@/lib/stripe");
      if (!stripe) {
        return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const planId = sub.metadata?.planId || user.plan;
        // Stripe v2025+ API: period end from items or metadata
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days

        await prisma.user.update({
          where: { id: userId },
          data: { plan: planId, planExpiresAt: periodEnd },
        });

        return NextResponse.json({
          success: true,
          message: `User ${user.email} synced: plan=${planId}, expires=${periodEnd.toISOString()}`,
        });
      } else {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: "STARTER", planExpiresAt: null },
        });
        return NextResponse.json({
          success: true,
          message: `No active Stripe subscription. User ${user.email} reset to STARTER.`,
        });
      }
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[Admin] Stripe sync fix error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
