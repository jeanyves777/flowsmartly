import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  addListSmartlyBillingMonth,
  buildListSmartlyAccess,
  getListSmartlyCreditStatus,
  isListSmartlyAccountEligible,
  LISTSMARTLY_CREDIT_STATUS_ACTIVE,
  LISTSMARTLY_CREDIT_STATUS_LOCKED,
  requiresListSmartlyPaymentBackup,
} from "@/lib/listsmartly/billing";
import { getListSmartlyPaymentBackup } from "@/lib/listsmartly/payment-backup";
import {
  LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST,
  LISTSMARTLY_UNLOCK_CREDIT_COST,
} from "@/lib/constants/listsmartly";

/**
 * GET /api/listsmartly/subscription
 * Returns credit-backed ListSmartly access details.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [user, profile] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { plan: true, aiCredits: true, deletedAt: true, stripeCustomerId: true },
      }),
      prisma.listSmartlyProfile.findFirst({
        where: { userId: session.userId },
      }),
    ]);

    const backupPaymentRequired = requiresListSmartlyPaymentBackup(user || null);
    const paymentBackup = backupPaymentRequired
      ? await getListSmartlyPaymentBackup(user?.stripeCustomerId)
      : { ready: true, paymentMethodId: null, label: null, reason: null };

    return NextResponse.json({
      success: true,
      data: {
        ...buildListSmartlyAccess(profile, {
          ...(user || {}),
          paymentBackupReady: paymentBackup.ready,
          paymentBackupLabel: paymentBackup.label,
          paymentBackupReason: paymentBackup.reason,
        }),
        paymentBackupRequired: backupPaymentRequired,
        paymentBackupReady: paymentBackup.ready,
        paymentBackupLabel: paymentBackup.label,
        paymentBackupReason: paymentBackup.reason,
        subscriptionId: profile?.lsSubscriptionId || null,
        trialStartedAt: null,
        trialEndsAt: null,
        priceMonthly: 0,
      },
    });
  } catch (err) {
    console.error("[ListSmartly Subscription] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch ListSmartly access" }, { status: 500 });
  }
}
/**
 * PATCH /api/listsmartly/subscription
 * Reactivates ListSmartly access with credits. New profiles should use /activate.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const action = body.action || "reactivate";

    if (!["unlock", "reactivate"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const billingUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        plan: true,
        aiCredits: true,
        deletedAt: true,
        stripeCustomerId: true,
      },
    });

    if (!billingUser || !isListSmartlyAccountEligible(billingUser)) {
      throw new Error("ACCOUNT_INACTIVE");
    }

    const backupPaymentRequired = requiresListSmartlyPaymentBackup(billingUser);
    const paymentBackup = backupPaymentRequired
      ? await getListSmartlyPaymentBackup(billingUser.stripeCustomerId)
      : { ready: true, paymentMethodId: null, label: null, reason: null };

    if (backupPaymentRequired && !paymentBackup.ready) {
      throw new Error("PAYMENT_METHOD_REQUIRED");
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.userId },
        select: { id: true, plan: true, aiCredits: true, deletedAt: true },
      });
      if (!user || !isListSmartlyAccountEligible(user)) {
        throw new Error("ACCOUNT_INACTIVE");
      }

      const profile = await tx.listSmartlyProfile.findFirst({
        where: { userId: session.userId },
      });
      if (!profile) throw new Error("PROFILE_REQUIRED");

      const creditStatus = getListSmartlyCreditStatus(profile);
      const isActive = creditStatus === LISTSMARTLY_CREDIT_STATUS_ACTIVE;
      const chargeAmount = isActive
        ? 0
        : profile.listSmartlyUnlockedAt
          ? LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST
          : LISTSMARTLY_UNLOCK_CREDIT_COST;

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
      const updatedProfile = await tx.listSmartlyProfile.update({
        where: { id: profile.id },
        data: {
          lsPlan: "included",
          lsSubscriptionStatus: "active",
          lsSubscriptionId: null,
          freeTrialStartedAt: null,
          freeTrialEndsAt: null,
          listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_ACTIVE,
          listSmartlyUnlockedAt: profile.listSmartlyUnlockedAt || now,
          listSmartlyLastCreditChargeAt: chargeAmount > 0 ? now : profile.listSmartlyLastCreditChargeAt,
          listSmartlyNextCreditChargeAt: addListSmartlyBillingMonth(now),
          listSmartlyLastCreditFailureAt: null,
          listSmartlyCreditFailureReason: null,
        },
      });

      if (chargeAmount > 0) {
        await tx.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -chargeAmount,
            balanceAfter: updatedUser.aiCredits,
            description:
              chargeAmount === LISTSMARTLY_UNLOCK_CREDIT_COST
                ? "ListSmartly first-time unlock"
                : "ListSmartly access reactivation",
            referenceType:
              chargeAmount === LISTSMARTLY_UNLOCK_CREDIT_COST
                ? "listsmartly_unlock"
                : "listsmartly_reactivation",
            referenceId: updatedProfile.id,
            metadata: JSON.stringify({ creditCost: chargeAmount }),
          },
        });
      }

      return { profile: updatedProfile, user: updatedUser, chargedCredits: chargeAmount };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...buildListSmartlyAccess(result.profile, {
          ...result.user,
          paymentBackupReady: paymentBackup.ready,
          paymentBackupLabel: paymentBackup.label,
          paymentBackupReason: paymentBackup.reason,
        }),
        chargedCredits: result.chargedCredits,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ACCOUNT_INACTIVE") {
      return NextResponse.json(
        { success: false, error: "Your account must be active to use ListSmartly." },
        { status: 403 }
      );
    }
    if (err instanceof Error && err.message === "PAYMENT_METHOD_REQUIRED") {
      return NextResponse.json(
        {
          success: false,
          error: "Add a valid payment method before using ListSmartly without a FlowSmartly subscription.",
          code: "PAYMENT_METHOD_REQUIRED",
        },
        { status: 403 }
      );
    }
    if (err instanceof Error && err.message === "PROFILE_REQUIRED") {
      return NextResponse.json({ success: false, error: "No ListSmartly profile" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json(
        {
          success: false,
          error: `Not enough credits. Unlock costs ${LISTSMARTLY_UNLOCK_CREDIT_COST} credits and reactivation costs ${LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST} credits.`,
        },
        { status: 402 }
      );
    }

    console.error("[ListSmartly Subscription] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update ListSmartly access" }, { status: 500 });
  }
}

/**
 * DELETE /api/listsmartly/subscription
 * Deactivates credit-backed ListSmartly access locally. No Stripe cancellation.
 */
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.listSmartlyProfile.updateMany({
      where: { userId: session.userId },
      data: {
        lsSubscriptionStatus: "inactive",
        listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_LOCKED,
        listSmartlyCreditFailureReason: null,
      },
    });

    return NextResponse.json({ success: true, message: "ListSmartly access deactivated" });
  } catch (err) {
    console.error("[ListSmartly Subscription] DELETE error:", err);
    return NextResponse.json({ error: "Failed to deactivate ListSmartly access" }, { status: 500 });
  }
}
