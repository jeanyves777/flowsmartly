import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import {
  normalizeUnlockPlatform,
  SOCIAL_ACCOUNT_UNLOCK_CREDIT_COST,
} from "@/lib/social/account-capacity";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const platform = normalizeUnlockPlatform(body.platform);
    const quantity = Math.max(1, Math.min(10, Number(body.quantity || 1)));

    if (!platform) {
      return NextResponse.json(
        { success: false, error: { message: "Choose a valid platform to unlock." } },
        { status: 400 }
      );
    }

    const creditsRequired = SOCIAL_ACCOUNT_UNLOCK_CREDIT_COST * quantity;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true, freeCredits: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const purchasedCredits = Math.max(0, user.aiCredits - (user.freeCredits || 0));
      if (purchasedCredits < creditsRequired) {
        return {
          insufficient: true,
          aiCredits: user.aiCredits,
          purchasedCredits,
          creditsRequired,
        };
      }

      const updatedUser = await tx.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: creditsRequired } },
        select: { aiCredits: true },
      });

      const unlock = await tx.socialAccountConnectionUnlock.create({
        data: {
          userId: session.userId,
          platform,
          slots: quantity,
          creditsSpent: creditsRequired,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: session.userId,
          type: "USAGE",
          amount: -creditsRequired,
          balanceAfter: updatedUser.aiCredits,
          referenceType: "social_account_unlock",
          referenceId: unlock.id,
          reason: `Unlocked ${quantity} ${platform} connection slot${quantity === 1 ? "" : "s"}`,
          description: `Unlocked ${quantity} additional ${platform} connection slot${quantity === 1 ? "" : "s"}`,
          metadata: JSON.stringify({
            platform,
            quantity,
            creditsPerSlot: SOCIAL_ACCOUNT_UNLOCK_CREDIT_COST,
          }),
        },
      });

      return {
        insufficient: false,
        aiCredits: updatedUser.aiCredits,
        purchasedCredits: Math.max(0, updatedUser.aiCredits - (user.freeCredits || 0)),
        creditsRequired,
        unlock,
      };
    });

    if (result.insufficient) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: `Unlocking an additional ${platform} connection requires ${creditsRequired} credits.`,
            creditsRequired,
            creditsAvailable: result.purchasedCredits,
          },
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        platform,
        quantity,
        creditsUsed: creditsRequired,
        creditsRemaining: result.aiCredits,
      },
    });
  } catch (error) {
    console.error("Social account unlock error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to unlock additional connection slot." } },
      { status: 500 }
    );
  }
}
