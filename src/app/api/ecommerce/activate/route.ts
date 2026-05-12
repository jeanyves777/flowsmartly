import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getProductListingCapacity, getProductListingLimit, withProductListingLimit } from "@/lib/ecommerce/product-listing-limits";

/**
 * POST /api/ecommerce/activate
 * Activate FlowShop for any user with an active FlowSmartly account.
 * FlowShop no longer has a separate subscription plan.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true, country: true, region: true, plan: true, planExpiresAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    if (user.planExpiresAt && user.planExpiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PLAN_INACTIVE",
            message: "Your FlowSmartly plan is not active. Reactivate your account to use FlowShop.",
          },
        },
        { status: 403 }
      );
    }

    const existingStore = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true, settings: true },
    });

    const storeData = {
      ecomSubscriptionId: null as string | null,
      ecomSubscriptionStatus: "active",
      ecomPlan: "free",
      isActive: true,
      freeTrialStartedAt: null as Date | null,
      freeTrialEndsAt: null as Date | null,
      freeTrialRemindersSent: "[]",
    };

    const store = existingStore
      ? await prisma.store.update({
          where: { userId: session.userId },
          data: {
            ...storeData,
            settings: withProductListingLimit(existingStore.settings, getProductListingLimit(existingStore.settings)),
          },
          select: { id: true, settings: true },
        })
      : await prisma.store.create({
          data: {
            userId: session.userId,
            name: user.name || "My Store",
            slug: `store-${session.userId.slice(0, 8)}`,
            region: user.region,
            country: user.country,
            settings: withProductListingLimit(null, 20),
            ...storeData,
          },
          select: { id: true, settings: true },
        });

    const listingLimit = await getProductListingCapacity(store);

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: null,
        status: "active",
        plan: "free",
        listingLimit,
      },
    });
  } catch (error) {
    console.error("E-commerce activation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to activate FlowShop" } },
      { status: 500 }
    );
  }
}
