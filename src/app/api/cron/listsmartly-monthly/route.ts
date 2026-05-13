import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { generatePresenceReport } from "@/lib/listsmartly/presence-report";
import { createNotification } from "@/lib/notifications";
import { LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST } from "@/lib/constants/listsmartly";
import {
  addListSmartlyBillingMonth,
  isListSmartlyAccountEligible,
  LISTSMARTLY_CREDIT_STATUS_ACTIVE,
  LISTSMARTLY_CREDIT_STATUS_PAST_DUE,
  requiresListSmartlyPaymentBackup,
} from "@/lib/listsmartly/billing";
import {
  chargeListSmartlyBackupCredits,
  getListSmartlyPaymentBackup,
} from "@/lib/listsmartly/payment-backup";

/**
 * GET /api/cron/listsmartly-monthly
 * Monthly cron that deducts ListSmartly keep-active credits and creates reports.
 *
 * Protected with CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
        { status: 401 }
      );
    }

    const now = new Date();
    const profiles = await prisma.listSmartlyProfile.findMany({
      where: {
        OR: [
          { listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_ACTIVE },
          { lsSubscriptionStatus: { in: ["active", "trialing"] } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            aiCredits: true,
            plan: true,
            deletedAt: true,
            stripeCustomerId: true,
          },
        },
      },
    });

    let processed = 0;
    let charged = 0;
    let initialized = 0;
    let skipped = 0;
    let pastDue = 0;
    let success = 0;
    let failed = 0;

    for (const profile of profiles) {
      processed++;

      try {
        if (!isListSmartlyAccountEligible(profile.user)) {
          await prisma.listSmartlyProfile.update({
            where: { id: profile.id },
            data: {
              lsSubscriptionStatus: "inactive",
              listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_PAST_DUE,
              listSmartlyLastCreditFailureAt: now,
              listSmartlyCreditFailureReason: "The FlowSmartly account is inactive.",
            },
          });
          await createNotification({
            userId: profile.user.id,
            type: "SYSTEM",
            title: "ListSmartly paused",
            message: "Your FlowSmartly account must be active to keep ListSmartly running.",
            actionUrl: "/settings/upgrade",
            data: { profileId: profile.id },
          });
          pastDue++;
          continue;
        }

        const backupPaymentRequired = requiresListSmartlyPaymentBackup(profile.user);
        const paymentBackup = backupPaymentRequired
          ? await getListSmartlyPaymentBackup(profile.user.stripeCustomerId)
          : { ready: true, paymentMethodId: null, label: null, reason: null };

        if (backupPaymentRequired && !paymentBackup.ready) {
          await prisma.listSmartlyProfile.update({
            where: { id: profile.id },
            data: {
              lsSubscriptionStatus: "past_due",
              listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_PAST_DUE,
              listSmartlyLastCreditFailureAt: now,
              listSmartlyCreditFailureReason:
                paymentBackup.reason || "A valid backup payment method is required to keep ListSmartly active.",
            },
          });
          await createNotification({
            userId: profile.user.id,
            type: "SYSTEM",
            title: "ListSmartly needs a payment method",
            message: "Add a valid payment method so ListSmartly can stay active when your credits run low.",
            actionUrl: "/settings",
            data: { profileId: profile.id },
          });
          pastDue++;
          continue;
        }

        if (!profile.listSmartlyNextCreditChargeAt) {
          await prisma.listSmartlyProfile.update({
            where: { id: profile.id },
            data: {
              lsPlan: "included",
              lsSubscriptionStatus: "active",
              listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_ACTIVE,
              listSmartlyUnlockedAt: profile.listSmartlyUnlockedAt || now,
              listSmartlyNextCreditChargeAt: addListSmartlyBillingMonth(now),
              listSmartlyLastCreditFailureAt: null,
              listSmartlyCreditFailureReason: null,
            },
          });
          initialized++;
          continue;
        }

        if (profile.listSmartlyNextCreditChargeAt > now) {
          skipped++;
          continue;
        }

        const freshUser = await prisma.user.findUnique({
          where: { id: profile.userId },
          select: {
            aiCredits: true,
            plan: true,
            deletedAt: true,
            stripeCustomerId: true,
          },
        });

        if (!freshUser || !isListSmartlyAccountEligible(freshUser)) {
          throw new Error("ACCOUNT_INACTIVE");
        }

        const freshBackupRequired = requiresListSmartlyPaymentBackup(freshUser);
        const freshPaymentBackup = freshBackupRequired
          ? await getListSmartlyPaymentBackup(freshUser.stripeCustomerId)
          : { ready: true, paymentMethodId: null, label: null, reason: null };

        if (freshBackupRequired && !freshPaymentBackup.ready) {
          throw new Error("PAYMENT_METHOD_REQUIRED");
        }

        const backupCharge =
          freshUser.aiCredits < LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST && freshBackupRequired
            ? await chargeListSmartlyBackupCredits({
                userId: profile.userId,
                profileId: profile.id,
                stripeCustomerId: freshUser.stripeCustomerId!,
                paymentMethodId: freshPaymentBackup.paymentMethodId!,
                credits: LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST,
                description: `ListSmartly monthly keep-active credits for ${profile.businessName}`,
              })
            : null;

        const chargeResult = await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: profile.userId },
            select: { aiCredits: true, plan: true, deletedAt: true },
          });

          if (!user || !isListSmartlyAccountEligible(user)) {
            throw new Error("ACCOUNT_INACTIVE");
          }

          let currentCredits = user.aiCredits;

          if (backupCharge) {
            const toppedUpUser = await tx.user.update({
              where: { id: profile.userId },
              data: { aiCredits: { increment: LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST } },
              select: { aiCredits: true },
            });
            currentCredits = toppedUpUser.aiCredits;

            await tx.creditTransaction.create({
              data: {
                userId: profile.userId,
                type: "PURCHASE",
                amount: LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST,
                balanceAfter: currentCredits,
                description: "ListSmartly backup card credit top-up",
                referenceType: "listsmartly_backup_charge",
                referenceId: backupCharge.paymentIntentId,
                metadata: JSON.stringify({
                  monthlyCost: LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST,
                  amountCents: backupCharge.amountCents,
                }),
              },
            });
          }

          if (currentCredits < LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST) {
            throw new Error("INSUFFICIENT_CREDITS");
          }

          const updatedUser = await tx.user.update({
            where: { id: profile.userId },
            data: { aiCredits: { decrement: LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST } },
            select: { aiCredits: true },
          });

          await tx.listSmartlyProfile.update({
            where: { id: profile.id },
            data: {
              lsPlan: "included",
              lsSubscriptionStatus: "active",
              listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_ACTIVE,
              listSmartlyUnlockedAt: profile.listSmartlyUnlockedAt || now,
              listSmartlyLastCreditChargeAt: now,
              listSmartlyNextCreditChargeAt: addListSmartlyBillingMonth(now),
              listSmartlyLastCreditFailureAt: null,
              listSmartlyCreditFailureReason: null,
            },
          });

          await tx.creditTransaction.create({
            data: {
              userId: profile.userId,
              type: "USAGE",
              amount: -LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST,
              balanceAfter: updatedUser.aiCredits,
              description: "ListSmartly monthly active access",
              referenceType: "listsmartly_monthly",
              referenceId: backupCharge?.paymentIntentId || profile.id,
              metadata: JSON.stringify({
                monthlyCost: LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST,
                backupPaymentCharged: Boolean(backupCharge),
                backupPaymentIntentId: backupCharge?.paymentIntentId || null,
              }),
            },
          });

          return { ...updatedUser, backupPaymentCharged: Boolean(backupCharge) };
        });

        const report = await generatePresenceReport(profile.id, "cron");
        await prisma.presenceReport.update({
          where: { id: report.reportId },
          data: { creditsUsed: LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST },
        });

        await createNotification({
          userId: profile.user.id,
          type: "SYSTEM",
          title: "Monthly Presence Report Ready",
          message: chargeResult.backupPaymentCharged
            ? `Your ${profile.businessName} presence report is ready. Your backup payment method funded and used ${LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST} ListSmartly credits.`
            : `Your ${profile.businessName} presence report is ready. ${LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST} credits were deducted to keep ListSmartly active.`,
          actionUrl: "/listsmartly/reports",
          data: {
            reportId: report.reportId,
            citationScore: report.citationScore,
            overallScore: report.overallScore,
            balanceAfter: chargeResult.aiCredits,
          },
        });

        charged++;
        success++;
      } catch (error) {
        if (
          error instanceof Error &&
          [
            "ACCOUNT_INACTIVE",
            "PAYMENT_METHOD_REQUIRED",
            "BACKUP_PAYMENT_FAILED",
            "STRIPE_NOT_CONFIGURED",
            "INSUFFICIENT_CREDITS",
          ].includes(error.message)
        ) {
          const reason =
            error.message === "ACCOUNT_INACTIVE"
              ? "The FlowSmartly account must be active to keep ListSmartly active."
              : error.message === "PAYMENT_METHOD_REQUIRED" || error.message === "STRIPE_NOT_CONFIGURED"
                ? "A valid backup payment method is required to keep ListSmartly active without a FlowSmartly subscription."
                : error.message === "BACKUP_PAYMENT_FAILED"
                  ? "The backup payment method could not be charged for the monthly ListSmartly credits."
                  : `At least ${LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST} credits are required to keep ListSmartly active.`;

          await prisma.listSmartlyProfile.update({
            where: { id: profile.id },
            data: {
              lsSubscriptionStatus: "past_due",
              listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_PAST_DUE,
              listSmartlyLastCreditFailureAt: now,
              listSmartlyCreditFailureReason: reason,
            },
          });

          await createNotification({
            userId: profile.user.id,
            type: "SYSTEM",
            title: "ListSmartly needs attention",
            message: reason,
            actionUrl:
              error.message === "PAYMENT_METHOD_REQUIRED" ||
              error.message === "BACKUP_PAYMENT_FAILED" ||
              error.message === "STRIPE_NOT_CONFIGURED"
                ? "/settings"
                : error.message === "ACCOUNT_INACTIVE"
                  ? "/settings/upgrade"
                  : "/buy-credits",
            data: { profileId: profile.id },
          });

          pastDue++;
          continue;
        }

        console.error(`[ListSmartly Cron] Failed for profile ${profile.id}:`, error);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed,
        charged,
        initialized,
        skipped,
        pastDue,
        success,
        failed,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[ListSmartly Cron] Monthly billing error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Cron job failed" } },
      { status: 500 }
    );
  }
}
