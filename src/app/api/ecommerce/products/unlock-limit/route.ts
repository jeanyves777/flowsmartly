import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { TRANSACTION_TYPES } from "@/lib/credits";
import {
  FLOWSHOP_PRODUCT_LISTING_UNLOCK_COST,
  FLOWSHOP_PRODUCT_LISTING_UNLOCK_SIZE,
  getProductListingLimit,
  withProductListingLimit,
} from "@/lib/ecommerce/product-listing-limits";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const [user, store] = await Promise.all([
        tx.user.findUnique({
          where: { id: session.userId },
          select: { aiCredits: true },
        }),
        tx.store.findUnique({
          where: { userId: session.userId },
          select: { id: true, settings: true },
        }),
      ]);

      if (!store) throw new Error("NO_STORE");
      if (!user || user.aiCredits < FLOWSHOP_PRODUCT_LISTING_UNLOCK_COST) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      const previousLimit = getProductListingLimit(store.settings);
      const nextLimit = previousLimit + FLOWSHOP_PRODUCT_LISTING_UNLOCK_SIZE;
      const nextSettings = withProductListingLimit(store.settings, nextLimit);

      const updatedUser = await tx.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: FLOWSHOP_PRODUCT_LISTING_UNLOCK_COST } },
        select: { aiCredits: true },
      });

      await tx.creditTransaction.create({
        data: {
          userId: session.userId,
          type: TRANSACTION_TYPES.USAGE,
          amount: -FLOWSHOP_PRODUCT_LISTING_UNLOCK_COST,
          balanceAfter: updatedUser.aiCredits,
          description: `FlowShop product listing unlock (+${FLOWSHOP_PRODUCT_LISTING_UNLOCK_SIZE})`,
          referenceType: "store",
          referenceId: store.id,
          metadata: JSON.stringify({ previousLimit, nextLimit }),
        },
      });

      await tx.store.update({
        where: { id: store.id },
        data: { settings: nextSettings },
      });

      const used = await tx.product.count({
        where: { storeId: store.id, deletedAt: null },
      });

      return {
        limit: nextLimit,
        used,
        remaining: Math.max(0, nextLimit - used),
        unlockCost: FLOWSHOP_PRODUCT_LISTING_UNLOCK_COST,
        unlockSize: FLOWSHOP_PRODUCT_LISTING_UNLOCK_SIZE,
        balance: updatedUser.aiCredits,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NO_STORE") {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "Store not found. Please set up your store first." } },
        { status: 404 }
      );
    }
    if (message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: `Unlocking ${FLOWSHOP_PRODUCT_LISTING_UNLOCK_SIZE} more product listings requires ${FLOWSHOP_PRODUCT_LISTING_UNLOCK_COST} credits.`,
          },
        },
        { status: 402 }
      );
    }

    console.error("Unlock product listing limit error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to unlock product listings" } },
      { status: 500 }
    );
  }
}
