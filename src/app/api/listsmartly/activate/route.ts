import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { initializeListings } from "@/lib/listsmartly/sync-engine";
import { seedDirectories } from "@/lib/listsmartly/directories";
import {
  addListSmartlyBillingMonth,
  buildListSmartlyAccess,
  getListSmartlyCreditStatus,
  isListSmartlyPlanEligible,
  LISTSMARTLY_CREDIT_STATUS_ACTIVE,
} from "@/lib/listsmartly/billing";
import { LISTSMARTLY_UNLOCK_CREDIT_COST } from "@/lib/constants/listsmartly";

// POST /api/listsmartly/activate - Unlock ListSmartly with credits.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { businessName, industry } = body;

    let name = businessName;
    if (!name) {
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
        select: { name: true },
      });
      name = brandKit?.name || null;
    }
    if (!name) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true },
      });
      name = user?.name || "My Business";
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.userId },
        select: { id: true, plan: true, aiCredits: true, deletedAt: true },
      });

      if (!user || !isListSmartlyPlanEligible(user)) {
        throw new Error("PLAN_REQUIRED");
      }

      const existing = await tx.listSmartlyProfile.findUnique({
        where: { userId: session.userId },
      });

      const alreadyUnlocked =
        Boolean(existing?.listSmartlyUnlockedAt) ||
        getListSmartlyCreditStatus(existing) === LISTSMARTLY_CREDIT_STATUS_ACTIVE;
      const chargeAmount = alreadyUnlocked ? 0 : LISTSMARTLY_UNLOCK_CREDIT_COST;

      if (chargeAmount > 0 && user.aiCredits < chargeAmount) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      const updatedUser =
        chargeAmount > 0
          ? await tx.user.update({
              where: { id: session.userId },
              data: { aiCredits: { decrement: chargeAmount } },
              select: { aiCredits: true, plan: true, deletedAt: true },
            })
          : user;

      const now = new Date();
      const accessData = {
        lsPlan: "included",
        lsSubscriptionId: null,
        lsSubscriptionStatus: "active",
        freeTrialStartedAt: null,
        freeTrialEndsAt: null,
        listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_ACTIVE,
        listSmartlyUnlockedAt: existing?.listSmartlyUnlockedAt || now,
        listSmartlyLastCreditChargeAt:
          chargeAmount > 0 ? now : existing?.listSmartlyLastCreditChargeAt || null,
        listSmartlyNextCreditChargeAt:
          existing?.listSmartlyNextCreditChargeAt || addListSmartlyBillingMonth(now),
        listSmartlyLastCreditFailureAt: null,
        listSmartlyCreditFailureReason: null,
      };

      const profile = existing
        ? await tx.listSmartlyProfile.update({
            where: { id: existing.id },
            data: {
              ...accessData,
              businessName: existing.businessName || name,
              industry: existing.industry || industry || null,
            },
          })
        : await tx.listSmartlyProfile.create({
            data: {
              userId: session.userId,
              businessName: name,
              industry: industry || null,
              ...accessData,
            },
          });

      if (chargeAmount > 0) {
        await tx.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -chargeAmount,
            balanceAfter: updatedUser.aiCredits,
            description: "ListSmartly first-time unlock",
            referenceType: "listsmartly_unlock",
            referenceId: profile.id,
            metadata: JSON.stringify({ unlockCost: chargeAmount }),
          },
        });
      }

      return { profile, user: updatedUser, chargedCredits: chargeAmount };
    });

    try {
      const dirCount = await prisma.listingDirectory.count();
      if (dirCount === 0) {
        await seedDirectories();
      }
      await initializeListings(result.profile.id, industry);
    } catch (err) {
      console.error("Failed to initialize listings:", err);
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          ...result.profile,
          categories: JSON.parse(result.profile.categories),
          hours: JSON.parse(result.profile.hours),
          photos: JSON.parse(result.profile.photos),
          socialLinks: JSON.parse(result.profile.socialLinks),
        },
        access: buildListSmartlyAccess(result.profile, result.user),
        chargedCredits: result.chargedCredits,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_REQUIRED") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PLAN_REQUIRED",
            message: "A FlowSmartly plan is required to unlock ListSmartly.",
          },
        },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: `You need ${LISTSMARTLY_UNLOCK_CREDIT_COST} credits to unlock ListSmartly.`,
          },
        },
        { status: 402 }
      );
    }

    console.error("Activate ListSmartly error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to activate ListSmartly" } },
      { status: 500 }
    );
  }
}
