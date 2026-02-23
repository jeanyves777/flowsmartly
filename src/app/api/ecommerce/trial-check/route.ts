import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { notifyEcomTrialReminder, notifyEcomTrialExpired } from "@/lib/notifications";
import { ECOM_TRIAL_REMINDER_SCHEDULE } from "@/lib/domains/pricing";

/**
 * GET /api/ecommerce/trial-check
 * Cron-compatible endpoint that:
 * 1. Sends trial reminder emails at scheduled intervals (5 days, 2 days remaining)
 * 2. Expires free trials that have passed their end date
 *
 * Protected with CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  try {
    // ── Authentication ──
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
        { status: 401 }
      );
    }

    const now = new Date();
    let remindersCount = 0;
    let expiredCount = 0;

    // ── Job 1: Send trial reminders ──
    const trialStores = await prisma.store.findMany({
      where: {
        ecomSubscriptionStatus: "free_trial",
        freeTrialEndsAt: { not: null },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    for (const store of trialStores) {
      const freeTrialEndsAt = store.freeTrialEndsAt!;
      const daysRemaining = Math.ceil(
        (freeTrialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      let remindersSent: string[];
      try {
        remindersSent = JSON.parse(store.freeTrialRemindersSent);
      } catch {
        remindersSent = [];
      }

      for (const schedule of ECOM_TRIAL_REMINDER_SCHEDULE) {
        if (
          daysRemaining <= schedule.daysRemaining &&
          !remindersSent.includes(schedule.key)
        ) {
          await notifyEcomTrialReminder({
            userId: store.user.id,
            email: store.user.email,
            name: store.user.name,
            daysRemaining: schedule.daysRemaining,
            storeName: store.name,
          });

          remindersSent.push(schedule.key);
          remindersCount++;
        }
      }

      // Update reminders sent if any new ones were added
      if (remindersSent.length > 0) {
        const currentSent: string[] = (() => {
          try {
            return JSON.parse(store.freeTrialRemindersSent);
          } catch {
            return [];
          }
        })();

        if (remindersSent.length > currentSent.length) {
          await prisma.store.update({
            where: { id: store.id },
            data: { freeTrialRemindersSent: JSON.stringify(remindersSent) },
          });
        }
      }
    }

    // ── Job 2: Expire trials ──
    const expiredStores = await prisma.store.findMany({
      where: {
        ecomSubscriptionStatus: "free_trial",
        freeTrialEndsAt: { lte: now },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    for (const store of expiredStores) {
      await prisma.store.update({
        where: { id: store.id },
        data: {
          ecomSubscriptionStatus: "expired",
          isActive: false,
        },
      });

      await notifyEcomTrialExpired({
        userId: store.user.id,
        email: store.user.email,
        name: store.user.name,
        storeName: store.name,
      });

      expiredCount++;
    }

    return NextResponse.json({
      success: true,
      data: { reminders: remindersCount, expired: expiredCount },
    });
  } catch (error) {
    console.error("Trial check cron error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Trial check failed" } },
      { status: 500 }
    );
  }
}
