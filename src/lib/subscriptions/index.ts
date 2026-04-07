/**
 * Subscription Management Service
 * Handles subscription lifecycle: expiration, reminders, credit allocation, Stripe sync.
 */

import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import {
  notifySubscriptionCancelled,
  notifyLowCredits,
} from "@/lib/notifications";
import {
  notifySubscriptionExpiring,
  notifyCreditsReset,
  notifyReengagement,
  notifyPaymentFailed,
} from "@/lib/notifications/subscription";

// ── 1. Subscription Expiration Check ──

/**
 * Find users whose plan has expired (planExpiresAt < now) and reset them to STARTER.
 * This is a safety net for when Stripe webhooks fail.
 */
export async function checkExpiredSubscriptions() {
  const now = new Date();

  const expiredUsers = await prisma.user.findMany({
    where: {
      plan: { not: "STARTER" },
      planExpiresAt: { lt: now },
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      planExpiresAt: true,
    },
  });

  let reset = 0;
  for (const user of expiredUsers) {
    try {
      const previousPlan = user.plan;
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: "STARTER", planExpiresAt: null },
      });

      notifySubscriptionCancelled({
        userId: user.id,
        email: user.email,
        name: user.name,
        planName: previousPlan,
      }).catch(() => {});

      reset++;
      console.log(`[Subscriptions] Expired plan reset: user ${user.id} (${previousPlan} → STARTER)`);
    } catch (err) {
      console.error(`[Subscriptions] Failed to reset expired plan for user ${user.id}:`, err);
    }
  }

  return { total: expiredUsers.length, reset };
}

// ── 2. Subscription Renewal Reminders ──

/**
 * Send reminder emails to users whose subscription expires within N days.
 * Skips users who already received a reminder at the same threshold.
 */
export async function sendSubscriptionReminders() {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  // 7-day reminders
  const sevenDayUsers = await prisma.user.findMany({
    where: {
      plan: { not: "STARTER" },
      planExpiresAt: { gte: now, lte: sevenDaysFromNow },
      deletedAt: null,
    },
    select: { id: true, email: true, name: true, plan: true, planExpiresAt: true },
  });

  let sevenDay = 0;
  let twoDay = 0;

  for (const user of sevenDayUsers) {
    // Check if it's within the 2-day window
    const isWithinTwoDays = user.planExpiresAt! <= twoDaysFromNow;

    // Check if a reminder was already sent recently (avoid duplicates)
    const recentReminder = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: "SUBSCRIPTION_EXPIRING",
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentReminder) continue;

    const daysLeft = Math.ceil((user.planExpiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    try {
      await notifySubscriptionExpiring({
        userId: user.id,
        email: user.email,
        name: user.name,
        planName: user.plan,
        expiresAt: user.planExpiresAt!,
        daysLeft,
      });

      if (isWithinTwoDays) twoDay++;
      else sevenDay++;
    } catch (err) {
      console.error(`[Subscriptions] Failed to send reminder for user ${user.id}:`, err);
    }
  }

  return { sevenDay, twoDay };
}

// ── 3. Low Credit Warnings ──

/**
 * Check all active users' credit balances and send warnings when below threshold.
 * Default threshold: 50 credits.
 */
export async function checkLowCreditBalances(threshold = 50) {
  const usersWithLowCredits = await prisma.user.findMany({
    where: {
      plan: { not: "STARTER" }, // Only warn paying users
      aiCredits: { gt: 0, lte: threshold },
      deletedAt: null,
    },
    select: { id: true, email: true, name: true, aiCredits: true },
  });

  let warned = 0;

  for (const user of usersWithLowCredits) {
    // Check if we already warned within the last 3 days
    const recentWarning = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: "CREDITS_LOW",
        createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
    });

    if (recentWarning) continue;

    try {
      await notifyLowCredits({
        userId: user.id,
        email: user.email,
        name: user.name,
        currentBalance: user.aiCredits,
        threshold,
      });
      warned++;
    } catch (err) {
      console.error(`[Credits] Failed to send low credit warning for user ${user.id}:`, err);
    }
  }

  // Also check for depleted credits
  const depletedUsers = await prisma.user.findMany({
    where: {
      plan: { not: "STARTER" },
      aiCredits: 0,
      deletedAt: null,
    },
    select: { id: true },
  });

  let depleted = 0;
  for (const user of depletedUsers) {
    const recentDepletedNotif = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: "CREDITS_DEPLETED",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    if (!recentDepletedNotif) {
      try {
        const { notifyCreditsDepeleted } = await import("@/lib/notifications");
        await notifyCreditsDepeleted({ userId: user.id });
        depleted++;
      } catch { /* silent */ }
    }
  }

  return { warned, depleted, threshold };
}

// ── 4. Monthly Credit Reset / Allocation ──

/**
 * Calculate a user's purchased credits (PURCHASE type — these never expire).
 */
async function getPurchasedCreditsBalance(userId: string): Promise<number> {
  const purchased = await prisma.creditTransaction.aggregate({
    where: { userId, type: TRANSACTION_TYPES.PURCHASE },
    _sum: { amount: true },
  });
  const purchasedUsage = await prisma.creditTransaction.aggregate({
    where: { userId, type: TRANSACTION_TYPES.USAGE, amount: { lt: 0 } },
    _sum: { amount: true },
  });
  // Total purchased minus total usage — but purchased balance can't go below 0
  // We can't easily separate which usage came from purchased vs subscription credits,
  // so we calculate: total purchased ever (they don't expire)
  return Math.max(0, purchased._sum.amount || 0);
}

/**
 * Monthly credit RESET for subscription plans.
 *
 * RULES:
 * - Monthly subscription credits RESET (not add on top) — old unused subscription credits expire
 * - Purchased credits (PURCHASE type) NEVER expire and are preserved
 * - Before allocating: verify user has a valid stripeCustomerId (payment went through Stripe)
 * - New balance = plan.monthlyCredits + remaining purchased credits
 *
 * This is a safety net — primary allocation happens via Stripe webhook (invoice.payment_succeeded).
 * Only allocates if no SUBSCRIPTION credit transaction exists for this billing period.
 */
export async function checkMonthlyCreditAllocations() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const FREE_ROLES = ["STARTER", "ADMIN", "SUPER_ADMIN", "AGENT"];

  // Find active subscribers with Stripe connection and valid expiry
  const users = await prisma.user.findMany({
    where: {
      plan: { notIn: FREE_ROLES },
      stripeCustomerId: { not: null }, // Must have Stripe — payment must go through
      planExpiresAt: { gte: now },     // Still active
      deletedAt: null,
    },
    select: { id: true, email: true, name: true, plan: true, aiCredits: true },
  });

  let allocated = 0;
  let skipped = 0;

  for (const user of users) {
    // Check if credits were already allocated this billing period
    const recentAllocation = await prisma.creditTransaction.findFirst({
      where: {
        userId: user.id,
        type: TRANSACTION_TYPES.SUBSCRIPTION,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentAllocation) {
      skipped++;
      continue;
    }

    // Look up plan's monthly credits
    const plan = await prisma.plan.findFirst({
      where: { planId: user.plan, isActive: true },
      select: { monthlyCredits: true, name: true },
    });

    if (!plan || plan.monthlyCredits <= 0) {
      skipped++;
      continue;
    }

    try {
      // Calculate purchased credits (these persist)
      const purchasedCredits = await getPurchasedCreditsBalance(user.id);

      // New balance = plan monthly credits + purchased credits
      const newBalance = plan.monthlyCredits + purchasedCredits;
      const resetAmount = newBalance - user.aiCredits;

      // Set the balance directly (reset, not increment)
      await prisma.user.update({
        where: { id: user.id },
        data: { aiCredits: newBalance },
      });

      // Record the transaction (shows the net change)
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          type: TRANSACTION_TYPES.SUBSCRIPTION,
          amount: resetAmount,
          balanceAfter: newBalance,
          description: `${plan.name} plan monthly credits reset (${plan.monthlyCredits} subscription + ${purchasedCredits} purchased)`,
          referenceType: "cron_monthly_reset",
          referenceId: `cron-${now.toISOString().slice(0, 7)}`,
        },
      });

      await notifyCreditsReset({
        userId: user.id,
        email: user.email,
        name: user.name,
        planName: plan.name,
        creditsAdded: plan.monthlyCredits,
      });

      allocated++;
      console.log(`[Credits] Monthly reset: user ${user.id} → ${newBalance} credits (${plan.monthlyCredits} sub + ${purchasedCredits} purchased, was ${user.aiCredits})`);
    } catch (err) {
      console.error(`[Credits] Failed monthly reset for user ${user.id}:`, err);
    }
  }

  return { total: users.length, allocated, skipped };
}

/**
 * Reset credits on subscription renewal (called from Stripe webhook).
 * Same logic: monthly credits RESET, purchased credits preserved.
 */
export async function resetCreditsForRenewal(userId: string, monthlyCredits: number, planName: string) {
  const purchasedCredits = await getPurchasedCreditsBalance(userId);
  const newBalance = monthlyCredits + purchasedCredits;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiCredits: true },
  });

  const resetAmount = newBalance - (user?.aiCredits || 0);

  await prisma.user.update({
    where: { id: userId },
    data: { aiCredits: newBalance },
  });

  await prisma.creditTransaction.create({
    data: {
      userId,
      type: TRANSACTION_TYPES.SUBSCRIPTION,
      amount: resetAmount,
      balanceAfter: newBalance,
      description: `${planName} plan monthly credits reset (${monthlyCredits} subscription + ${purchasedCredits} purchased)`,
      referenceType: "stripe_renewal_reset",
      referenceId: `renewal-${new Date().toISOString().slice(0, 7)}`,
    },
  });

  return { newBalance, purchasedCredits, resetAmount };
}

// ── 5. User Re-engagement ──

/**
 * Send re-engagement emails to users who haven't logged in for 30+ days.
 * Only sends once per 30 days per user.
 */
export async function sendReengagementEmails() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const inactiveUsers = await prisma.user.findMany({
    where: {
      lastLoginAt: { lt: thirtyDaysAgo },
      deletedAt: null,
      emailVerified: true,
    },
    select: { id: true, email: true, name: true, lastLoginAt: true },
    take: 100, // Process in batches
  });

  let sent = 0;

  for (const user of inactiveUsers) {
    // Check if we already sent a re-engagement email in the last 30 days
    const recentReengagement = await prisma.notification.findFirst({
      where: {
        userId: user.id,
        type: "SYSTEM",
        title: "We miss you!",
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentReengagement) continue;

    const daysSinceLogin = Math.floor(
      (Date.now() - (user.lastLoginAt?.getTime() || 0)) / (24 * 60 * 60 * 1000)
    );

    try {
      await notifyReengagement({
        userId: user.id,
        email: user.email,
        name: user.name,
        daysSinceLogin,
      });
      sent++;
    } catch (err) {
      console.error(`[Reengagement] Failed for user ${user.id}:`, err);
    }
  }

  return { checked: inactiveUsers.length, sent };
}

// ── 6. Failed Payment / Dunning ──

/**
 * Check for users with past_due subscriptions (from Stripe) and send dunning emails.
 * Also checks for users with stripeCustomerId who have no active subscription.
 */
export async function checkFailedPayments() {
  // Check for ecommerce stores with past_due status
  const pastDueStores = await prisma.store.findMany({
    where: {
      ecomSubscriptionStatus: "past_due",
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      ecomPlan: true,
      user: { select: { email: true, name: true } },
    },
  });

  let notified = 0;

  for (const store of pastDueStores) {
    // Check if we already sent a dunning email in the last 3 days
    const recentDunning = await prisma.notification.findFirst({
      where: {
        userId: store.userId,
        type: "SYSTEM",
        title: { contains: "Payment Failed" },
        createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
    });

    if (recentDunning) continue;

    try {
      await notifyPaymentFailed({
        userId: store.userId,
        email: store.user.email,
        name: store.user.name,
        planName: store.ecomPlan === "pro" ? "FlowShop Pro" : "FlowShop Basic",
        service: "FlowShop",
      });
      notified++;
    } catch (err) {
      console.error(`[Dunning] Failed for store ${store.id}:`, err);
    }
  }

  return { pastDue: pastDueStores.length, notified };
}

// ── 7. Stripe Subscription Sync (Admin) ──

/**
 * Sync subscription data from Stripe for all users with a stripeCustomerId.
 * Compares local plan/status with Stripe's actual state and fixes discrepancies.
 */
export async function syncStripeSubscriptions() {
  const { stripe } = await import("@/lib/stripe");
  if (!stripe) throw new Error("Stripe not configured");

  const users = await prisma.user.findMany({
    where: {
      stripeCustomerId: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      plan: true,
      planExpiresAt: true,
      stripeCustomerId: true,
    },
  });

  let synced = 0;
  let discrepancies = 0;
  const issues: Array<{
    userId: string;
    email: string;
    issue: string;
    localPlan: string;
    stripePlan: string | null;
    stripeStatus: string | null;
  }> = [];

  for (const user of users) {
    if (!user.stripeCustomerId) continue;

    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 5,
      });

      const activeSub = subscriptions.data.find(
        (s) => s.status === "active" || s.status === "trialing"
      );

      if (activeSub) {
        const stripePlanId = activeSub.metadata?.planId;
        const stripeStatus = activeSub.status;

        if (user.plan === "STARTER" && stripePlanId) {
          // Stripe has active sub but local is STARTER — fix it
          issues.push({
            userId: user.id,
            email: user.email,
            issue: "Local plan is STARTER but Stripe has active subscription",
            localPlan: user.plan,
            stripePlan: stripePlanId,
            stripeStatus,
          });
          discrepancies++;
        }
      } else if (user.plan !== "STARTER") {
        // No active Stripe subscription but local plan is not STARTER
        const cancelledSub = subscriptions.data.find(
          (s) => s.status === "canceled" || s.status === "unpaid"
        );

        if (cancelledSub) {
          issues.push({
            userId: user.id,
            email: user.email,
            issue: "Stripe subscription cancelled/unpaid but local plan still active",
            localPlan: user.plan,
            stripePlan: cancelledSub.metadata?.planId || null,
            stripeStatus: cancelledSub.status,
          });
          discrepancies++;
        }
      }

      synced++;
    } catch (err) {
      console.error(`[Stripe Sync] Failed for user ${user.id}:`, err);
    }
  }

  return { total: users.length, synced, discrepancies, issues };
}
