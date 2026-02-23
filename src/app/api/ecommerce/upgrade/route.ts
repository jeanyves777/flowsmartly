import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { changeEcomPlan } from "@/lib/stripe/ecommerce";
import { getDomainRetailPrice } from "@/lib/domains/pricing";
import type { EcomPlan } from "@/lib/domains/pricing";

/**
 * POST /api/ecommerce/upgrade
 * Upgrade or downgrade a FlowShop subscription plan.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const plan = body.plan as string | undefined;

    if (!plan || (plan !== "basic" && plan !== "pro")) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_PLAN", message: "Plan must be 'basic' or 'pro'" } },
        { status: 400 }
      );
    }

    // Fetch user's store
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        ecomPlan: true,
        ecomSubscriptionId: true,
        ecomSubscriptionStatus: true,
        freeDomainClaimed: true,
      },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You need an active FlowShop store to change plans" } },
        { status: 400 }
      );
    }

    // Check for active subscription
    const hasActiveSub = store.ecomSubscriptionStatus === "active" || store.ecomSubscriptionStatus === "trialing";
    if (!hasActiveSub || !store.ecomSubscriptionId) {
      return NextResponse.json(
        { success: false, error: { code: "INACTIVE_SUBSCRIPTION", message: "An active FlowShop subscription is required to change plans" } },
        { status: 400 }
      );
    }

    // Check if already on the requested plan
    if (store.ecomPlan === plan) {
      return NextResponse.json(
        { success: false, error: { code: "SAME_PLAN", message: `You are already on the ${plan} plan` } },
        { status: 400 }
      );
    }

    const isDowngrade = store.ecomPlan === "pro" && plan === "basic";
    let freeDomainWarning: string | undefined;

    // If downgrading from pro and user has a free domain claimed, warn and convert it to paid
    if (isDowngrade && store.freeDomainClaimed) {
      freeDomainWarning =
        "Your free domain will become a paid domain. It will be billed at the standard renewal rate on its next renewal date.";

      // Find the free domain and update its billing
      const freeDomains = await prisma.storeDomain.findMany({
        where: { storeId: store.id, isFree: true },
      });

      for (const freeDomain of freeDomains) {
        const renewalPrice = getDomainRetailPrice(freeDomain.tld) ?? 0;
        await prisma.storeDomain.update({
          where: { id: freeDomain.id },
          data: {
            isFree: false,
            renewalPriceCents: renewalPrice,
          },
        });
      }
    }

    // Change the plan in Stripe
    const result = await changeEcomPlan({
      subscriptionId: store.ecomSubscriptionId,
      newPlan: plan as EcomPlan,
      userId: session.userId,
    });

    // Update the store record
    await prisma.store.update({
      where: { id: store.id },
      data: {
        ecomPlan: plan,
        ...(isDowngrade ? { freeDomainClaimed: false } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        plan,
        status: result.status,
        ...(freeDomainWarning ? { freeDomainWarning } : {}),
      },
    });
  } catch (error) {
    console.error("Plan upgrade error:", error);
    const message = error instanceof Error ? error.message : "Failed to change plan";
    return NextResponse.json(
      { success: false, error: { code: "UPGRADE_FAILED", message } },
      { status: 500 }
    );
  }
}
