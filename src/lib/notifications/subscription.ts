/**
 * Subscription-related notification functions.
 * Used by cron jobs for expiration reminders, credit resets, re-engagement, and dunning.
 */

import { createNotification, NOTIFICATION_TYPES } from "@/lib/notifications";
import {
  sendSubscriptionExpiringEmail,
  sendCreditsResetEmail,
  sendReengagementEmail,
  sendPaymentFailedEmail,
} from "@/lib/email/subscription";

// ── Subscription Expiring Reminder ──

export async function notifySubscriptionExpiring(params: {
  userId: string;
  email: string;
  name: string;
  planName: string;
  expiresAt: Date;
  daysLeft: number;
}) {
  const dateStr = params.expiresAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const urgency = params.daysLeft <= 2 ? "URGENT: " : "";

  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING,
    title: `${urgency}Subscription Expiring Soon`,
    message: `Your ${params.planName} plan expires on ${dateStr} (${params.daysLeft} day${params.daysLeft !== 1 ? "s" : ""} left). Renew to keep your features and credits.`,
    data: { planName: params.planName, expiresAt: params.expiresAt.toISOString(), daysLeft: params.daysLeft },
    actionUrl: "/settings?tab=billing",
  });

  await sendSubscriptionExpiringEmail({
    to: params.email,
    name: params.name,
    planName: params.planName,
    expiresAt: dateStr,
    daysLeft: params.daysLeft,
  });
}

// ── Monthly Credits Reset/Allocation ──

export async function notifyCreditsReset(params: {
  userId: string;
  email: string;
  name: string;
  planName: string;
  creditsAdded: number;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_RENEWED,
    title: "Monthly Credits Added",
    message: `${params.creditsAdded.toLocaleString()} credits have been added to your account as part of your ${params.planName} plan.`,
    data: { planName: params.planName, creditsAdded: params.creditsAdded },
    actionUrl: "/settings?tab=billing",
  });

  await sendCreditsResetEmail({
    to: params.email,
    name: params.name,
    planName: params.planName,
    creditsAdded: params.creditsAdded,
  });
}

// ── User Re-engagement ──

export async function notifyReengagement(params: {
  userId: string;
  email: string;
  name: string;
  daysSinceLogin: number;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: "We miss you!",
    message: `It's been ${params.daysSinceLogin} days since your last visit. Come back and check out what's new!`,
    actionUrl: "/",
  });

  await sendReengagementEmail({
    to: params.email,
    name: params.name,
    daysSinceLogin: params.daysSinceLogin,
  });
}

// ── Payment Failed / Dunning ──

export async function notifyPaymentFailed(params: {
  userId: string;
  email: string;
  name: string;
  planName: string;
  service: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: "Payment Failed — Action Required",
    message: `We couldn't process your payment for ${params.planName}. Please update your payment method to avoid service interruption.`,
    data: { planName: params.planName, service: params.service },
    actionUrl: "/settings?tab=billing",
  });

  await sendPaymentFailedEmail({
    to: params.email,
    name: params.name,
    planName: params.planName,
    service: params.service,
  });
}
