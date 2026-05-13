import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { generatePresenceReport } from "@/lib/listsmartly/presence-report";
import { createNotification } from "@/lib/notifications";
import { LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST } from "@/lib/constants/listsmartly";
import {
  addListSmartlyBillingMonth,
  isListSmartlyPlanEligible,
  LISTSMARTLY_CREDIT_STATUS_ACTIVE,
  LISTSMARTLY_CREDIT_STATUS_PAST_DUE,
} from "@/lib/listsmartly/billing";

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
        user: { select: { id: true, email: true, name: true, aiCredits: true, plan: true, deletedAt: true } },
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
        if (!isListSmartlyPlanEligible(profile.user)) {
          await prisma.listSmartlyProfile.update({
            where: { id: profile.id },
            data: {
              lsSubscriptionStatus: "inactive",
              listSmartlyCreditStatus: LISTSMARTLY_CREDIT_STATUS_PAST_DUE,
              listSmartlyLastCreditFailureAt: now,
              listSmartlyCreditFailureReason: "A FlowSmartly plan is required to keep ListSmartly active.",
            },
          });
          await createNotification({
            userId: profile.user.id,
            type: "SYSTEM",
            title: "ListSmartly paused",
            message: "A FlowSmartly plan is required to keep ListSmartly active.",
            actionUrl: "/settings/upgrade",
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

        const chargeResult = await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: profile.userId },
            select: { aiCredits: true, plan: true, deletedAt: true },
          });

          if (!user || !isListSmartlyPlanEligible(user)) {
            throw new Error("PLAN_REQUIRED");
          }

          if (user.aiCredits < LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST) {
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
              referenceId: profile.id,
              metadata: JSON.stringify({ monthlyCost: LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST }),
            },
          });

          return updatedUser;
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
          message: `Your ${profile.businessName} presence report is ready. ${LISTSMARTLY_MONTHLY_ACTIVE_CREDIT_COST} credits were deducted to keep ListSmartly active.`,
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
        if (error instanceof Error && ["PLAN_REQUIRED", "INSUFFICIENT_CREDITS"].includes(error.message)) {
          const reason =
            error.message === "PLAN_REQUIRED"
              ? "A FlowSmartly plan is required to keep ListSmartly active."
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
            actionUrl: error.message === "PLAN_REQUIRED" ? "/settings/upgrade" : "/buy-credits",
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
