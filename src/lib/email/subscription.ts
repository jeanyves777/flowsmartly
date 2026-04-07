/**
 * Subscription-related email templates.
 * Expiring reminders, credit resets, re-engagement, and dunning.
 */

import { sendEmail, baseTemplate } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const APP_NAME = "FlowSmartly";

// ── Subscription Expiring Reminder ──

export async function sendSubscriptionExpiringEmail(params: {
  to: string;
  name: string;
  planName: string;
  expiresAt: string;
  daysLeft: number;
}) {
  const urgencyBanner = params.daysLeft <= 2
    ? `<div class="warning" style="background:#fef2f2;border-color:#fca5a5;color:#991b1b;">
        <strong>Urgent:</strong> Your subscription expires in ${params.daysLeft} day${params.daysLeft !== 1 ? "s" : ""}!
      </div>`
    : "";

  const content = `
    <h2>Your Subscription is Expiring Soon</h2>
    <p>Hi ${params.name},</p>
    ${urgencyBanner}
    <p>Your <strong>${params.planName}</strong> plan will expire on <strong>${params.expiresAt}</strong>.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Plan</span>
        <strong>${params.planName}</strong>
      </div>
      <div class="stats-row">
        <span>Expires</span>
        <strong style="color: #ef4444;">${params.expiresAt}</strong>
      </div>
      <div class="stats-row">
        <span>Days Remaining</span>
        <strong style="color: ${params.daysLeft <= 2 ? "#ef4444" : "#f59e0b"};">${params.daysLeft} day${params.daysLeft !== 1 ? "s" : ""}</strong>
      </div>
    </div>
    <p>After expiration, you'll be moved to the free Starter plan and lose access to premium features and monthly credits.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings?tab=billing" class="button">Renew Subscription</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `${params.daysLeft <= 2 ? "URGENT: " : ""}Your ${params.planName} plan expires in ${params.daysLeft} days`,
    html: baseTemplate(content, `Your ${params.planName} subscription expires soon`),
  });
}

// ── Monthly Credits Reset ──

export async function sendCreditsResetEmail(params: {
  to: string;
  name: string;
  planName: string;
  creditsAdded: number;
}) {
  const content = `
    <h2>Monthly Credits Added!</h2>
    <p>Hi ${params.name},</p>
    <p>Your monthly credits for the <strong>${params.planName}</strong> plan have been added to your account.</p>
    <div class="highlight" style="text-align:center;">
      <span style="font-size:28px;font-weight:700;color:#10b981;">+${params.creditsAdded.toLocaleString()}</span><br>
      <span style="font-size:14px;color:#6b7280;">credits added</span>
    </div>
    <p>Use your credits for AI content generation, image creation, video making, and more.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}" class="button">Start Creating</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `+${params.creditsAdded.toLocaleString()} monthly credits added to your account`,
    html: baseTemplate(content, `Your monthly credits have been refreshed`),
  });
}

// ── User Re-engagement ──

export async function sendReengagementEmail(params: {
  to: string;
  name: string;
  daysSinceLogin: number;
}) {
  const content = `
    <h2>We miss you, ${params.name}!</h2>
    <p>It's been ${params.daysSinceLogin} days since your last visit to ${APP_NAME}. A lot has happened while you were away!</p>
    <div class="highlight">
      <strong>Here's what you might be missing:</strong>
      <ul style="margin:10px 0;padding-left:20px;color:#4b5563;">
        <li>New AI features and improvements</li>
        <li>Faster content generation</li>
        <li>Updated social media integrations</li>
        <li>New templates and tools</li>
      </ul>
    </div>
    <p>Come back and see what's new — your account is ready and waiting.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}" class="button">Welcome Back</a>
    </p>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:16px;">
      If you no longer wish to use ${APP_NAME}, you can ignore this email.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `We miss you, ${params.name}! Come back to ${APP_NAME}`,
    html: baseTemplate(content, `It's been a while — come see what's new`),
  });
}

// ── Payment Failed / Dunning ──

export async function sendPaymentFailedEmail(params: {
  to: string;
  name: string;
  planName: string;
  service: string;
}) {
  const content = `
    <h2>Payment Failed — Action Required</h2>
    <p>Hi ${params.name},</p>
    <div class="warning">
      <strong>We couldn't process your payment</strong> for your <strong>${params.planName}</strong> subscription.
    </div>
    <p>Your ${params.service} service may be interrupted if we can't collect payment. Please update your payment method as soon as possible.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Service</span>
        <strong>${params.service}</strong>
      </div>
      <div class="stats-row">
        <span>Plan</span>
        <strong>${params.planName}</strong>
      </div>
      <div class="stats-row">
        <span>Status</span>
        <strong style="color: #ef4444;">Payment Failed</strong>
      </div>
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings?tab=billing" class="button">Update Payment Method</a>
    </p>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:16px;">
      If you believe this is an error, please contact our support team.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Action required: Payment failed for your ${params.planName} plan`,
    html: baseTemplate(content, `Your payment couldn't be processed`),
  });
}
