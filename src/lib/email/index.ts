/**
 * Email Service for FlowSmartly
 * Using Hostinger SMTP for system notifications
 */

import nodemailer from "nodemailer";

// Email configuration
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER || "info@flowsmartly.com",
    pass: process.env.SMTP_PASSWORD,
  },
};

const FROM_EMAIL = process.env.SMTP_FROM || "FlowSmartly <info@flowsmartly.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const APP_NAME = "FlowSmartly";

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (!EMAIL_CONFIG.auth.pass) {
      console.warn("SMTP_PASSWORD not set - email sending disabled");
      return null;
    }
    transporter = nodemailer.createTransport(EMAIL_CONFIG);
  }
  return transporter;
}

// ── Base Email Template ──

export function baseTemplate(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>` : ""}
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #ffffff; padding: 32px 24px; text-align: center; border-bottom: 1px solid #e4e4e7; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; }
    .content { padding: 32px 24px; color: #18181b; }
    .content h2 { color: #18181b; margin: 0 0 16px 0; font-size: 24px; }
    .content p { margin: 0 0 16px 0; line-height: 1.6; color: #3f3f46; }
    .button { display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .button:hover { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); }
    .footer { padding: 24px; text-align: center; color: #71717a; font-size: 14px; border-top: 1px solid #e4e4e7; }
    .footer a { color: #0ea5e9; text-decoration: none; }
    .stats-box { background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .stats-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e4e4e7; }
    .stats-row:last-child { border-bottom: none; }
    .highlight { background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .code { background-color: #f4f4f5; padding: 16px 24px; border-radius: 8px; font-family: monospace; font-size: 32px; letter-spacing: 4px; text-align: center; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="${APP_URL}" style="text-decoration:none;">
        <img src="${APP_URL}/logo.png" alt="${APP_NAME}" style="max-height:48px;max-width:200px;" />
      </a>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p>
        <a href="${APP_URL}">Visit ${APP_NAME}</a> |
        <a href="${APP_URL}/settings">Manage Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
}

// ── Send Email Function ──

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const transport = getTransporter();

  if (!transport) {
    console.log("[Email] Skipped (SMTP not configured):", params.subject);
    return { success: false, error: "Email service not configured" };
  }

  try {
    const info = await transport.sendMail({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    console.log("[Email] Sent:", params.subject, "to", params.to);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

// ── Email Templates ──

// Welcome Email
export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  verificationUrl?: string;
}) {
  const content = `
    <h2>Welcome to ${APP_NAME}, ${params.name}! 🎉</h2>
    <p>We're thrilled to have you join our community of creators and marketers.</p>
    <p>With ${APP_NAME}, you can:</p>
    <ul style="color: #3f3f46; line-height: 1.8;">
      <li>Create AI-powered content in seconds</li>
      <li>Schedule posts across multiple platforms</li>
      <li>Run targeted email and SMS marketing campaigns</li>
      <li>Track your performance with detailed analytics</li>
    </ul>
    ${params.verificationUrl ? `
      <p>Please verify your email address to get started:</p>
      <p style="text-align: center;">
        <a href="${params.verificationUrl}" class="button">Verify Email Address</a>
      </p>
    ` : ""}
    <p>If you have any questions, just reply to this email - we're here to help!</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Welcome to ${APP_NAME}! 🚀`,
    html: baseTemplate(content, "Welcome aboard! Let's create something amazing together."),
  });
}

// Email Verification
export async function sendVerificationEmail(params: {
  to: string;
  name: string;
  verificationUrl: string;
  code?: string;
}) {
  const content = `
    <h2>Verify Your Email Address</h2>
    <p>Hi ${params.name},</p>
    <p>Please verify your email address to complete your ${APP_NAME} account setup.</p>
    ${params.code ? `
      <p>Your verification code is:</p>
      <div class="code">${params.code}</div>
      <p style="text-align: center; color: #71717a; font-size: 14px;">This code expires in 24 hours</p>
    ` : ""}
    <p style="text-align: center;">
      <a href="${params.verificationUrl}" class="button">Verify Email Address</a>
    </p>
    <p style="color: #71717a; font-size: 14px;">If you didn't create an account with ${APP_NAME}, you can safely ignore this email.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Verify your ${APP_NAME} email`,
    html: baseTemplate(content, "Please verify your email address"),
  });
}

// Password Reset
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const content = `
    <h2>Reset Your Password</h2>
    <p>Hi ${params.name},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <p style="text-align: center;">
      <a href="${params.resetUrl}" class="button">Reset Password</a>
    </p>
    <p style="color: #71717a; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
    <div class="warning">
      <strong>Didn't request this?</strong><br>
      If you didn't request a password reset, please ignore this email or contact support if you have concerns.
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `Reset your ${APP_NAME} password`,
    html: baseTemplate(content, "Password reset requested"),
  });
}

// Password Changed Confirmation
export async function sendPasswordChangedEmail(params: {
  to: string;
  name: string;
}) {
  const content = `
    <h2>Password Changed Successfully</h2>
    <p>Hi ${params.name},</p>
    <p>Your ${APP_NAME} password has been successfully changed.</p>
    <div class="highlight">
      <strong>Security Notice</strong><br>
      If you made this change, no further action is needed. If you didn't change your password, please reset it immediately and contact support.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/forgot-password" class="button">Reset Password</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your ${APP_NAME} password was changed`,
    html: baseTemplate(content, "Your password has been updated"),
  });
}

// Credit Purchase Confirmation
export async function sendCreditPurchaseEmail(params: {
  to: string;
  name: string;
  credits: number;
  amount: number;
  newBalance: number;
}) {
  const content = `
    <h2>Credits Added Successfully! 💳</h2>
    <p>Hi ${params.name},</p>
    <p>Thank you for your purchase! Your credits have been added to your account.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Credits Purchased</span>
        <strong>${params.credits.toLocaleString()} credits</strong>
      </div>
      <div class="stats-row">
        <span>Amount Paid</span>
        <strong>$${(params.amount / 100).toFixed(2)}</strong>
      </div>
      <div class="stats-row">
        <span>New Balance</span>
        <strong style="color: #10b981;">${params.newBalance.toLocaleString()} credits</strong>
      </div>
    </div>
    <p>Your credits can be used for:</p>
    <ul style="color: #3f3f46; line-height: 1.8;">
      <li>AI content generation</li>
      <li>SMS marketing campaigns</li>
      <li>Ad campaign boosting</li>
      <li>Premium features</li>
    </ul>
    <p style="text-align: center;">
      <a href="${APP_URL}/dashboard" class="button">Start Creating</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `${params.credits.toLocaleString()} credits added to your account`,
    html: baseTemplate(content, `You just received ${params.credits} credits!`),
  });
}

// Low Credit Warning
export async function sendLowCreditWarningEmail(params: {
  to: string;
  name: string;
  currentBalance: number;
  threshold: number;
}) {
  const content = `
    <h2>Low Credit Balance ⚠️</h2>
    <p>Hi ${params.name},</p>
    <p>Your ${APP_NAME} credit balance is running low.</p>
    <div class="warning">
      <strong>Current Balance: ${params.currentBalance} credits</strong><br>
      You're below your alert threshold of ${params.threshold} credits.
    </div>
    <p>To continue using AI features, SMS campaigns, and ad boosting without interruption, consider adding more credits.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings?tab=billing" class="button">Buy Credits</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Low credit balance - ${params.currentBalance} credits remaining`,
    html: baseTemplate(content, "Your credit balance is running low"),
  });
}

// Campaign Sent Notification
export async function sendCampaignSentEmail(params: {
  to: string;
  name: string;
  campaignName: string;
  campaignType: "email" | "sms";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
}) {
  const successRate = params.sentCount > 0
    ? Math.round((params.sentCount / params.recipientCount) * 100)
    : 0;

  const content = `
    <h2>Campaign Sent Successfully! 🚀</h2>
    <p>Hi ${params.name},</p>
    <p>Your ${params.campaignType.toUpperCase()} campaign "<strong>${params.campaignName}</strong>" has been sent.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Campaign Type</span>
        <strong>${params.campaignType === "email" ? "📧 Email" : "📱 SMS"}</strong>
      </div>
      <div class="stats-row">
        <span>Total Recipients</span>
        <strong>${params.recipientCount.toLocaleString()}</strong>
      </div>
      <div class="stats-row">
        <span>Successfully Sent</span>
        <strong style="color: #10b981;">${params.sentCount.toLocaleString()}</strong>
      </div>
      ${params.failedCount > 0 ? `
      <div class="stats-row">
        <span>Failed</span>
        <strong style="color: #ef4444;">${params.failedCount.toLocaleString()}</strong>
      </div>
      ` : ""}
      <div class="stats-row">
        <span>Success Rate</span>
        <strong>${successRate}%</strong>
      </div>
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/${params.campaignType}-marketing" class="button">View Campaign Details</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Campaign "${params.campaignName}" sent - ${params.sentCount} delivered`,
    html: baseTemplate(content, `Your ${params.campaignType} campaign is on its way!`),
  });
}

// New Follower Notification
export async function sendNewFollowerEmail(params: {
  to: string;
  name: string;
  followerName: string;
  followerUsername: string;
  followerAvatar?: string;
  totalFollowers: number;
}) {
  const content = `
    <h2>You Have a New Follower! 🎉</h2>
    <p>Hi ${params.name},</p>
    <p><strong>@${params.followerUsername}</strong> (${params.followerName}) just started following you on ${APP_NAME}.</p>
    <div class="highlight">
      <strong>Total Followers: ${params.totalFollowers.toLocaleString()}</strong><br>
      Keep creating amazing content!
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/profile/${params.followerUsername}" class="button">View Profile</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `${params.followerName} is now following you`,
    html: baseTemplate(content, "Someone new is following your journey!"),
  });
}

// Post Engagement Alert
export async function sendEngagementAlertEmail(params: {
  to: string;
  name: string;
  postId: string;
  postCaption: string;
  likes: number;
  comments: number;
  shares: number;
}) {
  const content = `
    <h2>Your Post is Getting Attention! 🔥</h2>
    <p>Hi ${params.name},</p>
    <p>Your recent post is performing well:</p>
    <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <p style="color: #71717a; font-style: italic;">"${params.postCaption.substring(0, 100)}${params.postCaption.length > 100 ? "..." : ""}"</p>
    </div>
    <div class="stats-box">
      <div class="stats-row">
        <span>❤️ Likes</span>
        <strong>${params.likes.toLocaleString()}</strong>
      </div>
      <div class="stats-row">
        <span>💬 Comments</span>
        <strong>${params.comments.toLocaleString()}</strong>
      </div>
      <div class="stats-row">
        <span>🔄 Shares</span>
        <strong>${params.shares.toLocaleString()}</strong>
      </div>
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/posts/${params.postId}" class="button">View Post</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your post is trending! ${params.likes} likes and counting`,
    html: baseTemplate(content, "Your content is getting engagement!"),
  });
}

// Phone Number Rental Confirmation
export async function sendPhoneNumberRentalEmail(params: {
  to: string;
  name: string;
  phoneNumber: string;
  monthlyCost: number;
  creditsCharged: number;
}) {
  const content = `
    <h2>SMS Number Activated! 📱</h2>
    <p>Hi ${params.name},</p>
    <p>Your new SMS marketing number has been activated and is ready to use.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Phone Number</span>
        <strong style="font-family: monospace; font-size: 18px;">${params.phoneNumber}</strong>
      </div>
      <div class="stats-row">
        <span>Monthly Cost</span>
        <strong>$${(params.monthlyCost / 100).toFixed(2)}/month</strong>
      </div>
      <div class="stats-row">
        <span>Credits Charged</span>
        <strong>${params.creditsCharged} credits</strong>
      </div>
    </div>
    <div class="highlight">
      <strong>Getting Started</strong><br>
      You can now send SMS campaigns to your contact lists. Start by creating a new campaign.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/sms-marketing" class="button">Create SMS Campaign</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your SMS number is active: ${params.phoneNumber}`,
    html: baseTemplate(content, "Your SMS marketing number is ready!"),
  });
}

// Weekly Summary
export async function sendWeeklySummaryEmail(params: {
  to: string;
  name: string;
  period: string;
  stats: {
    postsCreated: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    newFollowers: number;
    creditsUsed: number;
    campaignsSent: number;
  };
}) {
  const content = `
    <h2>Your Weekly Summary 📊</h2>
    <p>Hi ${params.name},</p>
    <p>Here's how you did on ${APP_NAME} this week (${params.period}):</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>📝 Posts Created</span>
        <strong>${params.stats.postsCreated}</strong>
      </div>
      <div class="stats-row">
        <span>👁️ Total Views</span>
        <strong>${params.stats.totalViews.toLocaleString()}</strong>
      </div>
      <div class="stats-row">
        <span>❤️ Total Likes</span>
        <strong>${params.stats.totalLikes.toLocaleString()}</strong>
      </div>
      <div class="stats-row">
        <span>💬 Comments</span>
        <strong>${params.stats.totalComments.toLocaleString()}</strong>
      </div>
      <div class="stats-row">
        <span>👥 New Followers</span>
        <strong style="color: #10b981;">+${params.stats.newFollowers}</strong>
      </div>
      <div class="stats-row">
        <span>🎯 Campaigns Sent</span>
        <strong>${params.stats.campaignsSent}</strong>
      </div>
      <div class="stats-row">
        <span>⚡ Credits Used</span>
        <strong>${params.stats.creditsUsed.toLocaleString()}</strong>
      </div>
    </div>
    <p>Keep up the great work! Consistency is key to growing your audience.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/dashboard" class="button">View Full Analytics</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your weekly summary - ${params.stats.totalViews.toLocaleString()} views this week`,
    html: baseTemplate(content, `Here's your weekly performance summary`),
  });
}

// Login Alert (New Device)
export async function sendLoginAlertEmail(params: {
  to: string;
  name: string;
  device: string;
  location?: string;
  ipAddress?: string;
  time: Date;
}) {
  const content = `
    <h2>New Login Detected 🔐</h2>
    <p>Hi ${params.name},</p>
    <p>We detected a new login to your ${APP_NAME} account:</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Device</span>
        <strong>${params.device}</strong>
      </div>
      ${params.location ? `
      <div class="stats-row">
        <span>Location</span>
        <strong>${params.location}</strong>
      </div>
      ` : ""}
      ${params.ipAddress ? `
      <div class="stats-row">
        <span>IP Address</span>
        <strong>${params.ipAddress}</strong>
      </div>
      ` : ""}
      <div class="stats-row">
        <span>Time</span>
        <strong>${params.time.toLocaleString()}</strong>
      </div>
    </div>
    <div class="warning">
      <strong>Wasn't you?</strong><br>
      If you don't recognize this login, change your password immediately.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings?tab=security" class="button">Review Security Settings</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `New login to your ${APP_NAME} account`,
    html: baseTemplate(content, "New device signed into your account"),
  });
}

// Account Deletion Confirmation
export async function sendAccountDeletionEmail(params: {
  to: string;
  name: string;
  deletionDate: Date;
}) {
  const content = `
    <h2>Account Scheduled for Deletion</h2>
    <p>Hi ${params.name},</p>
    <p>Your ${APP_NAME} account has been scheduled for deletion.</p>
    <div class="warning">
      <strong>Deletion Date:</strong> ${params.deletionDate.toLocaleDateString()}<br>
      Your data will be permanently deleted after this date.
    </div>
    <p>If you change your mind, you can cancel the deletion by logging in before the deletion date.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/login" class="button">Cancel Deletion</a>
    </p>
    <p style="color: #71717a; font-size: 14px;">We're sorry to see you go. If you have any feedback, please reply to this email.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your ${APP_NAME} account will be deleted`,
    html: baseTemplate(content, "Your account is scheduled for deletion"),
  });
}

// Payment Method Added (Security Alert)
export async function sendPaymentMethodAddedEmail(params: {
  to: string;
  name: string;
  cardBrand: string;
  last4: string;
  time: Date;
}) {
  const content = `
    <h2>New Payment Method Added</h2>
    <p>Hi ${params.name},</p>
    <p>A new payment method was added to your ${APP_NAME} account.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Card</span>
        <strong>${params.cardBrand.toUpperCase()} ending in ${params.last4}</strong>
      </div>
      <div class="stats-row">
        <span>Date</span>
        <strong>${params.time.toLocaleString()}</strong>
      </div>
    </div>
    <div class="warning">
      <strong>Wasn't you?</strong><br>
      If you didn't add this payment method, remove it immediately and change your password.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings?tab=billing" class="button">Review Payment Methods</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `New payment method added to your ${APP_NAME} account`,
    html: baseTemplate(content, "A new card was added to your account"),
  });
}

// Payment Method Removed (Security Alert)
export async function sendPaymentMethodRemovedEmail(params: {
  to: string;
  name: string;
  cardBrand: string;
  last4: string;
  time: Date;
}) {
  const content = `
    <h2>Payment Method Removed</h2>
    <p>Hi ${params.name},</p>
    <p>A payment method was removed from your ${APP_NAME} account.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Card Removed</span>
        <strong>${params.cardBrand.toUpperCase()} ending in ${params.last4}</strong>
      </div>
      <div class="stats-row">
        <span>Date</span>
        <strong>${params.time.toLocaleString()}</strong>
      </div>
    </div>
    <div class="warning">
      <strong>Wasn't you?</strong><br>
      If you didn't remove this payment method, please contact support immediately and change your password.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings?tab=security" class="button">Review Security Settings</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Payment method removed from your ${APP_NAME} account`,
    html: baseTemplate(content, "A card was removed from your account"),
  });
}

// Subscription Activated
export async function sendSubscriptionActivatedEmail(params: {
  to: string;
  name: string;
  planName: string;
  monthlyCredits: number;
  amountCents: number;
  interval: string;
}) {
  const nextBillingDate = new Date();
  nextBillingDate.setDate(nextBillingDate.getDate() + (params.interval === "yearly" ? 365 : 30));

  const content = `
    <h2>Subscription Activated!</h2>
    <p>Hi ${params.name},</p>
    <p>Your ${APP_NAME} subscription is now active. Welcome to the <strong>${params.planName}</strong> plan!</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Plan</span>
        <strong>${params.planName}</strong>
      </div>
      <div class="stats-row">
        <span>Monthly Credits</span>
        <strong style="color: #10b981;">${params.monthlyCredits.toLocaleString()} credits</strong>
      </div>
      <div class="stats-row">
        <span>Billing Amount</span>
        <strong>$${(params.amountCents / 100).toFixed(2)}/${params.interval === "yearly" ? "year" : "month"}</strong>
      </div>
      <div class="stats-row">
        <span>Next Billing Date</span>
        <strong>${nextBillingDate.toLocaleDateString()}</strong>
      </div>
    </div>
    <div class="highlight">
      <strong>Your credits have been added!</strong><br>
      ${params.monthlyCredits.toLocaleString()} credits are now available in your account.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/dashboard" class="button">Go to Dashboard</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Welcome to ${APP_NAME} ${params.planName}!`,
    html: baseTemplate(content, `Your ${params.planName} subscription is now active`),
  });
}

// Subscription Cancelled
export async function sendSubscriptionCancelledEmail(params: {
  to: string;
  name: string;
  planName: string;
}) {
  const content = `
    <h2>Subscription Cancelled</h2>
    <p>Hi ${params.name},</p>
    <p>Your <strong>${params.planName}</strong> plan subscription has been cancelled.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Previous Plan</span>
        <strong>${params.planName}</strong>
      </div>
      <div class="stats-row">
        <span>Current Plan</span>
        <strong>Starter (Free)</strong>
      </div>
    </div>
    <p>Your account has been moved to the free Starter plan. You can still use ${APP_NAME} with limited features.</p>
    <div class="warning">
      <strong>Wasn't you?</strong><br>
      If you didn't cancel your subscription, please contact support immediately.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings/upgrade" class="button">Resubscribe</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your ${APP_NAME} subscription has been cancelled`,
    html: baseTemplate(content, "Your subscription has been cancelled"),
  });
}

// Subscription Renewed
export async function sendSubscriptionRenewedEmail(params: {
  to: string;
  name: string;
  planName: string;
  monthlyCredits: number;
  amountCents: number;
}) {
  const content = `
    <h2>Subscription Renewed</h2>
    <p>Hi ${params.name},</p>
    <p>Your <strong>${params.planName}</strong> plan has been renewed and your monthly credits have been added.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Plan</span>
        <strong>${params.planName}</strong>
      </div>
      <div class="stats-row">
        <span>Credits Added</span>
        <strong style="color: #10b981;">+${params.monthlyCredits.toLocaleString()} credits</strong>
      </div>
      <div class="stats-row">
        <span>Amount Charged</span>
        <strong>$${(params.amountCents / 100).toFixed(2)}</strong>
      </div>
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings?tab=billing" class="button">View Billing</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your ${APP_NAME} ${params.planName} plan has been renewed`,
    html: baseTemplate(content, `Your ${params.planName} subscription has been renewed`),
  });
}

// SMS Compliance Approved
export async function sendComplianceApprovedEmail(params: {
  to: string;
  name: string;
  businessName: string;
}) {
  const content = `
    <h2>SMS Compliance Approved!</h2>
    <p>Hi ${params.name},</p>
    <p>Your SMS marketing compliance application for <strong>${params.businessName}</strong> has been approved.</p>
    <div class="highlight">
      <strong>You're all set!</strong><br>
      You can now rent an SMS phone number and start sending marketing campaigns.
    </div>
    <p>Next steps:</p>
    <ul style="color: #3f3f46; line-height: 1.8;">
      <li>Go to SMS Marketing settings to rent a phone number</li>
      <li>Import or add contacts with proper opt-in consent</li>
      <li>Create and send your first SMS campaign</li>
    </ul>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings/sms-marketing" class="button">Rent a Phone Number</a>
    </p>
    <p style="color: #71717a; font-size: 14px;">Remember to always include opt-out instructions in your messages and respect STOP requests.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `SMS compliance approved - You can now send SMS campaigns`,
    html: baseTemplate(content, "Your SMS marketing application has been approved!"),
  });
}

// SMS Compliance Rejected
export async function sendComplianceRejectedEmail(params: {
  to: string;
  name: string;
  businessName: string;
  notes: string;
}) {
  const content = `
    <h2>SMS Compliance Application Needs Revision</h2>
    <p>Hi ${params.name},</p>
    <p>Your SMS marketing compliance application for <strong>${params.businessName}</strong> was not approved at this time.</p>
    <div class="warning">
      <strong>Reviewer Notes:</strong><br>
      ${params.notes}
    </div>
    <p>Please review the feedback above and update your application. Common reasons for rejection include:</p>
    <ul style="color: #3f3f46; line-height: 1.8;">
      <li>Privacy policy URL is not accessible or doesn't cover SMS data handling</li>
      <li>Use case description is too vague</li>
      <li>Sample messages don't include opt-out instructions</li>
      <li>Business information is incomplete</li>
    </ul>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings/sms-marketing/compliance" class="button">Update Application</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Action required: SMS compliance application needs revision`,
    html: baseTemplate(content, "Your SMS application needs some changes"),
  });
}

// Strategy Task Reminder
export async function sendStrategyReminderEmail(params: {
  to: string;
  name: string;
  strategyName: string;
  upcomingTasks: Array<{
    title: string;
    category: string;
    priority: string;
    dueDate: string;
    daysUntilDue: number;
  }>;
}) {
  const taskRows = params.upcomingTasks
    .map(
      (task) => `
    <div class="stats-row">
      <span>
        ${task.title}
        <br><small style="color: #71717a;">${task.category} &middot; ${task.priority} priority</small>
      </span>
      <strong style="color: ${task.daysUntilDue <= 1 ? "#ef4444" : "#f59e0b"};">
        ${task.daysUntilDue === 0 ? "Due today" : task.daysUntilDue === 1 ? "Due tomorrow" : `Due in ${task.daysUntilDue} days`}
      </strong>
    </div>
  `
    )
    .join("");

  const content = `
    <h2>Strategy Task Reminder</h2>
    <p>Hi ${params.name},</p>
    <p>You have <strong>${params.upcomingTasks.length} upcoming task${params.upcomingTasks.length > 1 ? "s" : ""}</strong> in your strategy &ldquo;<strong>${params.strategyName}</strong>&rdquo;:</p>
    <div class="stats-box">
      ${taskRows}
    </div>
    <p>Stay on track by completing these tasks before their due dates.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/content/strategy" class="button">View Strategy</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `${params.upcomingTasks.length} strategy task${params.upcomingTasks.length > 1 ? "s" : ""} due soon`,
    html: baseTemplate(content, "You have upcoming strategy tasks"),
  });
}

// Strategy Weekly Digest
export async function sendStrategyWeeklyDigestEmail(params: {
  to: string;
  name: string;
  strategyName: string;
  completedThisWeek: number;
  totalCompleted: number;
  totalTasks: number;
  progressPercent: number;
  upcomingCount: number;
  overdueCount: number;
}) {
  const content = `
    <h2>Weekly Strategy Progress</h2>
    <p>Hi ${params.name},</p>
    <p>Here's your weekly progress on &ldquo;<strong>${params.strategyName}</strong>&rdquo;:</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Completed this week</span>
        <strong style="color: #10b981;">${params.completedThisWeek} task${params.completedThisWeek !== 1 ? "s" : ""}</strong>
      </div>
      <div class="stats-row">
        <span>Overall progress</span>
        <strong>${params.totalCompleted}/${params.totalTasks} (${params.progressPercent}%)</strong>
      </div>
      <div class="stats-row">
        <span>Upcoming this week</span>
        <strong>${params.upcomingCount} task${params.upcomingCount !== 1 ? "s" : ""}</strong>
      </div>
      ${
        params.overdueCount > 0
          ? `
      <div class="stats-row">
        <span>Overdue</span>
        <strong style="color: #ef4444;">${params.overdueCount} task${params.overdueCount !== 1 ? "s" : ""}</strong>
      </div>
      `
          : ""
      }
    </div>
    ${
      params.progressPercent >= 75
        ? `
    <div class="highlight">
      <strong>Great progress!</strong><br>
      You're ${params.progressPercent}% through your strategy. Keep up the momentum!
    </div>
    `
        : ""
    }
    <p style="text-align: center;">
      <a href="${APP_URL}/content/strategy" class="button">View Strategy Board</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Strategy update: ${params.completedThisWeek} task${params.completedThisWeek !== 1 ? "s" : ""} completed this week`,
    html: baseTemplate(content, `Your weekly strategy digest for ${params.strategyName}`),
  });
}

// Strategy Milestone Celebration Email
export async function sendMilestoneEmail(params: {
  to: string;
  name: string;
  milestoneTitle: string;
  milestoneDescription: string;
  strategyName: string;
}) {
  const content = `
    <h2>Milestone Achieved!</h2>
    <p>Hi ${params.name},</p>
    <p>Congratulations! You've reached a new milestone in your strategy &ldquo;<strong>${params.strategyName}</strong>&rdquo;:</p>
    <div class="highlight" style="text-align: center; padding: 24px;">
      <div style="font-size: 32px; margin-bottom: 8px;">&#127942;</div>
      <strong style="font-size: 18px; color: #f97316;">${params.milestoneTitle}</strong>
      <br>
      <span style="color: #71717a; font-size: 14px;">${params.milestoneDescription}</span>
    </div>
    <p>Keep up the great work! Your consistency and dedication are paying off.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/content/strategy/reports" class="button">View Your Progress</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Milestone: ${params.milestoneTitle} - ${APP_NAME}`,
    html: baseTemplate(content, `You achieved a new milestone in ${params.strategyName}`),
  });
}

// Strategy Monthly Report Email
export async function sendStrategyReportEmail(params: {
  to: string;
  name: string;
  score: number;
  month: number;
  year: number;
  strategyName: string;
  factors?: {
    completion: number;
    onTime: number;
    consistency: number;
    adherence: number;
    production: number;
  };
  aiInsights?: string;
}) {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[params.month - 1] || "Unknown";
  const scoreColor = params.score >= 80 ? "#10b981" : params.score >= 50 ? "#f59e0b" : "#ef4444";

  const factorRows = params.factors ? `
    <div class="stats-box">
      <div class="stats-row">
        <span>Task Completion</span>
        <strong style="color: #10b981;">${params.factors.completion}%</strong>
      </div>
      <div class="stats-row">
        <span>On-Time Delivery</span>
        <strong style="color: #3b82f6;">${params.factors.onTime}%</strong>
      </div>
      <div class="stats-row">
        <span>Consistency</span>
        <strong style="color: #a855f7;">${params.factors.consistency}%</strong>
      </div>
      <div class="stats-row">
        <span>Plan Adherence</span>
        <strong style="color: #f97316;">${params.factors.adherence}%</strong>
      </div>
      <div class="stats-row">
        <span>Content Production</span>
        <strong style="color: #06b6d4;">${params.factors.production}%</strong>
      </div>
    </div>
  ` : "";

  const insightsSection = params.aiInsights ? `
    <div class="highlight">
      <strong>AI Insights</strong><br>
      ${params.aiInsights}
    </div>
  ` : "";

  const content = `
    <h2>Monthly Strategy Report</h2>
    <p>Hi ${params.name},</p>
    <p>Your marketing strategy report for <strong>${monthName} ${params.year}</strong> is ready.</p>
    <div style="text-align: center; padding: 24px; margin: 20px 0; background: linear-gradient(135deg, ${scoreColor}10, ${scoreColor}20); border-radius: 12px; border: 1px solid ${scoreColor}30;">
      <div style="font-size: 48px; font-weight: 800; color: ${scoreColor};">${params.score}</div>
      <div style="font-size: 14px; color: #71717a; margin-top: 4px;">out of 100</div>
      <div style="font-size: 13px; color: #71717a; margin-top: 2px;">${params.strategyName}</div>
    </div>
    ${factorRows}
    ${insightsSection}
    <p style="text-align: center;">
      <a href="${APP_URL}/content/strategy/reports/${params.year}-${String(params.month).padStart(2, "0")}" class="button">View Full Report</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your ${monthName} strategy score: ${params.score}/100 - ${APP_NAME}`,
    html: baseTemplate(content, `Monthly strategy report for ${params.strategyName}`),
  });
}

// A2P 10DLC Registration Submitted
export async function sendA2pRegistrationSubmittedEmail(params: {
  to: string;
  name: string;
  phoneNumber: string;
  businessName: string;
  brandSid?: string;
}) {
  const content = `
    <h2>A2P 10DLC Registration Submitted</h2>
    <p>Hi ${params.name},</p>
    <p>Your A2P 10DLC registration for <strong>${params.businessName}</strong> has been submitted to carrier networks for review.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Phone Number</span>
        <strong style="font-family: monospace;">${params.phoneNumber}</strong>
      </div>
      <div class="stats-row">
        <span>Business</span>
        <strong>${params.businessName}</strong>
      </div>
      <div class="stats-row">
        <span>Brand Status</span>
        <strong style="color: #f59e0b;">PENDING</strong>
      </div>
    </div>
    <div class="highlight">
      <strong>What happens next?</strong><br>
      Carrier review typically takes 1-7 business days. Once your brand is approved, we'll automatically create your messaging campaign and notify you.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/sms-marketing" class="button">Check Registration Status</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `A2P registration submitted for ${params.phoneNumber}`,
    html: baseTemplate(content, "Your A2P 10DLC registration is under review"),
  });
}

// A2P Brand Approved
export async function sendA2pBrandApprovedEmail(params: {
  to: string;
  name: string;
  businessName: string;
  campaignCreated: boolean;
}) {
  const content = `
    <h2>A2P Brand Approved!</h2>
    <p>Hi ${params.name},</p>
    <p>Great news! Your A2P 10DLC brand registration for <strong>${params.businessName}</strong> has been approved by the carrier networks.</p>
    <div class="highlight">
      <strong>Brand Status: APPROVED</strong><br>
      ${params.campaignCreated
        ? "Your messaging campaign has been automatically created and is now pending review."
        : "Your messaging campaign will be created automatically."}
    </div>
    ${params.campaignCreated ? `
    <p>The campaign review typically takes 1-3 business days. We'll notify you once it's verified.</p>
    ` : ""}
    <p style="text-align: center;">
      <a href="${APP_URL}/sms-marketing" class="button">View Status</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `A2P brand approved for ${params.businessName}`,
    html: baseTemplate(content, "Your A2P brand registration has been approved!"),
  });
}

// A2P Brand Failed
export async function sendA2pBrandFailedEmail(params: {
  to: string;
  name: string;
  businessName: string;
  failureReason?: string;
}) {
  const content = `
    <h2>A2P Brand Registration Issue</h2>
    <p>Hi ${params.name},</p>
    <p>Your A2P 10DLC brand registration for <strong>${params.businessName}</strong> was not approved.</p>
    ${params.failureReason ? `
    <div class="warning">
      <strong>Reason:</strong><br>
      ${params.failureReason}
    </div>
    ` : `
    <div class="warning">
      <strong>The registration could not be completed.</strong><br>
      Please review your business information and try again.
    </div>
    `}
    <p>Common reasons for rejection:</p>
    <ul style="color: #3f3f46; line-height: 1.8;">
      <li>Business information doesn't match public records</li>
      <li>Missing or invalid business website</li>
      <li>Incomplete contact information</li>
    </ul>
    <p style="text-align: center;">
      <a href="${APP_URL}/sms-marketing" class="button">Review & Retry</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Action required: A2P registration issue for ${params.businessName}`,
    html: baseTemplate(content, "Your A2P brand registration needs attention"),
  });
}

// A2P Campaign Verified (Fully Approved)
export async function sendA2pCampaignVerifiedEmail(params: {
  to: string;
  name: string;
  businessName: string;
  phoneNumber: string;
}) {
  const content = `
    <h2>A2P Registration Complete!</h2>
    <p>Hi ${params.name},</p>
    <p>Your A2P 10DLC registration for <strong>${params.businessName}</strong> is now fully approved.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Phone Number</span>
        <strong style="font-family: monospace;">${params.phoneNumber}</strong>
      </div>
      <div class="stats-row">
        <span>Brand Status</span>
        <strong style="color: #10b981;">APPROVED</strong>
      </div>
      <div class="stats-row">
        <span>Campaign Status</span>
        <strong style="color: #10b981;">VERIFIED</strong>
      </div>
    </div>
    <div class="highlight">
      <strong>You're all set!</strong><br>
      Your number is now fully registered for A2P 10DLC messaging. You can send SMS campaigns with higher throughput and better deliverability.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/sms-marketing/create" class="button">Create SMS Campaign</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `A2P registration complete - ${params.phoneNumber} is ready`,
    html: baseTemplate(content, "Your A2P 10DLC registration is fully approved!"),
  });
}

// A2P Campaign Failed
export async function sendA2pCampaignFailedEmail(params: {
  to: string;
  name: string;
  businessName: string;
  failureReason?: string;
}) {
  const content = `
    <h2>A2P Campaign Review Issue</h2>
    <p>Hi ${params.name},</p>
    <p>Your A2P messaging campaign for <strong>${params.businessName}</strong> was not approved during review.</p>
    ${params.failureReason ? `
    <div class="warning">
      <strong>Reason:</strong><br>
      ${params.failureReason}
    </div>
    ` : `
    <div class="warning">
      <strong>The campaign review was unsuccessful.</strong><br>
      Please review your messaging use case and try again.
    </div>
    `}
    <p>Your brand is still approved. You may need to update your:</p>
    <ul style="color: #3f3f46; line-height: 1.8;">
      <li>Use case description</li>
      <li>Sample messages (must include opt-out instructions)</li>
      <li>Privacy policy URL</li>
    </ul>
    <p style="text-align: center;">
      <a href="${APP_URL}/sms-marketing" class="button">Review & Retry</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Action required: A2P campaign issue for ${params.businessName}`,
    html: baseTemplate(content, "Your A2P campaign registration needs attention"),
  });
}

// Toll-Free Verification Submitted
export async function sendTollfreeVerificationSubmittedEmail(params: {
  to: string;
  name: string;
  phoneNumber: string;
  businessName: string;
}) {
  const content = `
    <h2>Toll-Free Verification Submitted</h2>
    <p>Hi ${params.name},</p>
    <p>Your toll-free number verification for <strong>${params.businessName}</strong> has been submitted for carrier review.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Phone Number</span>
        <strong style="font-family: monospace;">${params.phoneNumber}</strong>
      </div>
      <div class="stats-row">
        <span>Business</span>
        <strong>${params.businessName}</strong>
      </div>
      <div class="stats-row">
        <span>Status</span>
        <strong style="color: #f59e0b;">PENDING REVIEW</strong>
      </div>
    </div>
    <div class="highlight">
      <strong>What happens next?</strong><br>
      Carrier review typically takes 1-5 business days. We'll notify you once your toll-free number is verified and ready for messaging.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/sms-marketing" class="button">Check Verification Status</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Toll-free verification submitted for ${params.phoneNumber}`,
    html: baseTemplate(content, "Your toll-free number verification is under review"),
  });
}

// Toll-Free Verification Approved
export async function sendTollfreeVerificationApprovedEmail(params: {
  to: string;
  name: string;
  phoneNumber: string;
  businessName: string;
}) {
  const content = `
    <h2>Toll-Free Number Verified!</h2>
    <p>Hi ${params.name},</p>
    <p>Great news! Your toll-free number for <strong>${params.businessName}</strong> has been verified and is now ready for messaging.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Phone Number</span>
        <strong style="font-family: monospace;">${params.phoneNumber}</strong>
      </div>
      <div class="stats-row">
        <span>Status</span>
        <strong style="color: #10b981;">VERIFIED</strong>
      </div>
    </div>
    <div class="highlight">
      <strong>You're all set!</strong><br>
      Your toll-free number is now fully verified. You can send SMS campaigns with full messaging capabilities.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/sms-marketing/create" class="button">Create SMS Campaign</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Toll-free number verified: ${params.phoneNumber}`,
    html: baseTemplate(content, "Your toll-free number is verified and ready!"),
  });
}

// Toll-Free Verification Rejected
export async function sendTollfreeVerificationRejectedEmail(params: {
  to: string;
  name: string;
  phoneNumber: string;
  businessName: string;
  rejectionReason?: string;
}) {
  const content = `
    <h2>Toll-Free Verification Issue</h2>
    <p>Hi ${params.name},</p>
    <p>Your toll-free number verification for <strong>${params.businessName}</strong> was not approved.</p>
    ${params.rejectionReason ? `
    <div class="warning">
      <strong>Reason:</strong><br>
      ${params.rejectionReason}
    </div>
    ` : `
    <div class="warning">
      <strong>The verification was not approved.</strong><br>
      Please review your business information and messaging use case.
    </div>
    `}
    <p>Common reasons for rejection:</p>
    <ul style="color: #3f3f46; line-height: 1.8;">
      <li>Missing or inaccessible opt-in screenshot</li>
      <li>Use case description too vague</li>
      <li>Business website doesn't match registration</li>
      <li>Sample messages missing opt-out instructions</li>
    </ul>
    <p style="text-align: center;">
      <a href="${APP_URL}/sms-marketing" class="button">Review & Resubmit</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Action required: Toll-free verification issue for ${params.phoneNumber}`,
    html: baseTemplate(content, "Your toll-free verification needs attention"),
  });
}

// Agent Application Approved
export async function sendAgentApprovedEmail(params: {
  to: string;
  name: string;
  displayName: string;
}) {
  const content = `
    <h2>Agent Application Approved!</h2>
    <p>Hi ${params.name},</p>
    <p>Great news! Your agent application as <strong>${params.displayName}</strong> has been approved.</p>
    <div class="highlight">
      <strong>You're now a FlowSmartly Agent!</strong><br>
      Your account has been upgraded to the Agent plan with full feature access.
    </div>
    <p>Here's what you can do now:</p>
    <ul style="color: #3f3f46; line-height: 1.8;">
      <li>Set up your agent profile and landing page</li>
      <li>Start onboarding clients</li>
      <li>Manage client accounts from your dashboard</li>
      <li>Access all premium features at no cost</li>
    </ul>
    <p style="text-align: center;">
      <a href="${APP_URL}/agent/dashboard" class="button">Go to Agent Dashboard</a>
    </p>
    <p>Welcome to the team! We're excited to have you.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Congratulations! Your agent application has been approved`,
    html: baseTemplate(content, "Your FlowSmartly agent application has been approved!"),
  });
}

// Agent Application Rejected
export async function sendAgentRejectedEmail(params: {
  to: string;
  name: string;
  displayName: string;
  reason?: string;
}) {
  const content = `
    <h2>Agent Application Update</h2>
    <p>Hi ${params.name},</p>
    <p>Thank you for your interest in becoming a FlowSmartly agent. Unfortunately, your application as <strong>${params.displayName}</strong> was not approved at this time.</p>
    ${params.reason ? `
    <div class="warning">
      <strong>Reason:</strong><br>
      ${params.reason}
    </div>
    ` : `
    <div class="warning">
      <strong>Your application did not meet our current requirements.</strong><br>
      Please review your profile and consider reapplying.
    </div>
    `}
    <p>Common reasons for rejection:</p>
    <ul style="color: #3f3f46; line-height: 1.8;">
      <li>Incomplete profile or bio</li>
      <li>Insufficient specialties or industry experience</li>
      <li>Portfolio links not accessible or relevant</li>
    </ul>
    <p>You're welcome to update your application and reapply.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/agent/apply" class="button">Update Application</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Update on your FlowSmartly agent application`,
    html: baseTemplate(content, "Your agent application needs attention"),
  });
}

// Team Invitation Email
export async function sendTeamInvitationEmail(params: {
  to: string;
  inviterName: string;
  teamName: string;
  role: string;
  inviteUrl: string;
  expiresInDays: number;
}) {
  const content = `
    <h2>You've Been Invited!</h2>
    <p>Hi there,</p>
    <p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.teamName}</strong> as a <strong>${params.role}</strong> on FlowSmartly.</p>
    <div class="highlight">
      <strong>Team:</strong> ${params.teamName}<br>
      <strong>Role:</strong> ${params.role}<br>
      <strong>Expires:</strong> ${params.expiresInDays} days from now
    </div>
    <p style="text-align: center;">
      <a href="${params.inviteUrl}" class="button">Accept Invitation</a>
    </p>
    <p>If you don't have a FlowSmartly account yet, you'll be prompted to create one.</p>
    <p style="color: #71717a; font-size: 13px;">This invitation will expire in ${params.expiresInDays} days. If you didn't expect this invitation, you can safely ignore this email.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `${params.inviterName} invited you to join ${params.teamName} on FlowSmartly`,
    html: baseTemplate(content, `You've been invited to join ${params.teamName}`),
  });
}

// Content Removed (Moderation)
export async function sendContentRemovedEmail(params: {
  to: string;
  name: string;
  contentType: string;
  reason: string;
}) {
  const content = `
    <h2>Content Removed</h2>
    <p>Hi ${params.name},</p>
    <p>Your ${params.contentType} has been removed for violating our community guidelines.</p>
    <div class="warning">
      <strong>Reason:</strong><br>
      ${params.reason}
    </div>
    <p>Please review our guidelines to avoid future violations. Repeated violations may result in account restrictions.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/feed" class="button">View Community Guidelines</a>
    </p>
    <p style="color: #71717a; font-size: 14px;">If you believe this was a mistake, please contact support by replying to this email.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Content Removed - ${APP_NAME}`,
    html: baseTemplate(content, "Your content has been removed"),
  });
}

// Content Warning (Moderation)
export async function sendContentWarningEmail(params: {
  to: string;
  name: string;
  reason: string;
}) {
  const content = `
    <h2>Community Guidelines Warning</h2>
    <p>Hi ${params.name},</p>
    <p>We've reviewed content on your account and found it may not align with our community guidelines.</p>
    <div class="warning">
      <strong>Reason:</strong><br>
      ${params.reason}
    </div>
    <p>Please ensure your content follows our community guidelines. Repeated violations may result in account restrictions.</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/feed" class="button">View Guidelines</a>
    </p>
    <p style="color: #71717a; font-size: 14px;">If you believe this was a mistake, please contact support by replying to this email.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Community Guidelines Warning - ${APP_NAME}`,
    html: baseTemplate(content, "Please review our community guidelines"),
  });
}

// Test Email Function (for admin/debugging)
export async function sendTestEmail(to: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const content = `
    <h2>Test Email ✅</h2>
    <p>This is a test email from ${APP_NAME}.</p>
    <p>If you're seeing this, your email configuration is working correctly!</p>
    <div class="highlight">
      <strong>Configuration Details:</strong><br>
      Host: ${EMAIL_CONFIG.host}<br>
      Port: ${EMAIL_CONFIG.port}<br>
      From: ${FROM_EMAIL}
    </div>
    <p>Time sent: ${new Date().toLocaleString()}</p>
  `;

  return sendEmail({
    to,
    subject: `Test Email from ${APP_NAME}`,
    html: baseTemplate(content, "This is a test email"),
  });
}

// ── Strategy Automation Emails ──────────────────────────────────────────────

// Strategy Automation Started
export async function sendStrategyAutomationStartedEmail(params: {
  to: string;
  name: string;
  strategyName: string;
  taskCount: number;
  taskNames: string[];
  estimatedCredits: number;
}) {
  const taskList = params.taskNames
    .map((t) => `<li style="padding: 4px 0;">${t}</li>`)
    .join("");

  const content = `
    <h2>Your Strategy Is Now on Autopilot</h2>
    <p>Hi ${params.name},</p>
    <p>Great news! <strong>${params.taskCount} task${params.taskCount > 1 ? "s" : ""}</strong> from your strategy &ldquo;<strong>${params.strategyName}</strong>&rdquo; are now automated:</p>
    <div class="stats-box">
      <ul style="margin: 0; padding-left: 20px;">
        ${taskList}
      </ul>
    </div>
    <p>Each task will generate AI-crafted posts with images on your schedule. Credits are deducted per post (~${params.estimatedCredits} credits estimated total).</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/content/automation" class="button">View Automations</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Strategy automated: ${params.taskCount} tasks on autopilot`,
    html: baseTemplate(content, `Your strategy "${params.strategyName}" is now automated`),
  });
}

// Automation Credit Warning
export async function sendAutomationCreditWarningEmail(params: {
  to: string;
  name: string;
  remainingCredits: number;
  estimatedNeeded: number;
}) {
  const content = `
    <h2>Running Low on Credits</h2>
    <p>Hi ${params.name},</p>
    <p>Your credit balance (<strong>${params.remainingCredits} credits</strong>) is getting low. Your active strategy automations need approximately <strong>${params.estimatedNeeded} credits</strong> to complete all scheduled posts.</p>
    <div class="highlight">
      <strong>What happens?</strong><br>
      Automations will pause when credits run out. Top up to keep your marketing strategy running smoothly.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/settings?tab=billing" class="button">Add Credits</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Low credits: ${params.remainingCredits} remaining for automations`,
    html: baseTemplate(content, "Your automation credits are running low"),
  });
}

// Strategy Automation Summary (weekly)
export async function sendStrategyAutomationSummaryEmail(params: {
  to: string;
  name: string;
  strategyName: string;
  postsCreated: number;
  creditsSpent: number;
  tasksCompleted: number;
  totalTasks: number;
}) {
  const progressPercent = params.totalTasks > 0
    ? Math.round((params.tasksCompleted / params.totalTasks) * 100)
    : 0;

  const content = `
    <h2>Automation Weekly Summary</h2>
    <p>Hi ${params.name},</p>
    <p>Here's your weekly automation summary for &ldquo;<strong>${params.strategyName}</strong>&rdquo;:</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Posts Generated</span>
        <strong>${params.postsCreated}</strong>
      </div>
      <div class="stats-row">
        <span>Credits Used</span>
        <strong>${params.creditsSpent}</strong>
      </div>
      <div class="stats-row">
        <span>Strategy Progress</span>
        <strong>${progressPercent}% (${params.tasksCompleted}/${params.totalTasks})</strong>
      </div>
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/content/strategy/reports" class="button">View Full Report</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Automation update: ${params.postsCreated} posts created this week`,
    html: baseTemplate(content, `Weekly automation summary for ${params.strategyName}`),
  });
}

// ── FlowShop E-Commerce Trial Emails ────────────────────────────────────────

// FlowShop Trial Reminder
export async function sendEcomTrialReminderEmail(params: {
  to: string;
  name: string;
  daysRemaining: number;
  storeName: string;
}) {
  const content = `
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; border-radius: 8px 8px 0 0; margin: -32px -24px 24px -24px;">
      <h2 style="color: #ffffff; margin: 0; font-size: 24px;">Your FlowShop Trial Ends in ${params.daysRemaining} Day${params.daysRemaining !== 1 ? "s" : ""}</h2>
    </div>
    <p>Hi ${params.name},</p>
    <p>Your free trial for <strong>${params.storeName}</strong> on FlowShop is ending in <strong>${params.daysRemaining} day${params.daysRemaining !== 1 ? "s" : ""}</strong>.</p>
    <div class="warning">
      <strong>What happens when your trial ends?</strong><br>
      Your store will be deactivated and customers won't be able to browse or purchase. Don't worry though &mdash; none of your products, orders, or data will be deleted.
    </div>
    <p>To keep your store running without interruption, add a payment method now:</p>
    <p style="text-align: center;">
      <a href="${APP_URL}/ecommerce/settings?tab=subscription" class="button" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">Add Payment Method</a>
    </p>
    <p style="color: #71717a; font-size: 14px;">If you have any questions about FlowShop plans, visit your subscription settings or reply to this email.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your FlowShop trial ends in ${params.daysRemaining} days`,
    html: baseTemplate(content, `Your FlowShop trial for ${params.storeName} is ending soon`),
  });
}

// FlowShop Trial Expired
export async function sendEcomTrialExpiredEmail(params: {
  to: string;
  name: string;
  storeName: string;
}) {
  const content = `
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; border-radius: 8px 8px 0 0; margin: -32px -24px 24px -24px;">
      <h2 style="color: #ffffff; margin: 0; font-size: 24px;">Your FlowShop Free Trial Has Ended</h2>
    </div>
    <p>Hi ${params.name},</p>
    <p>Your free trial for <strong>${params.storeName}</strong> on FlowShop has expired. Your store is now inactive and is no longer visible to customers.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Store</span>
        <strong>${params.storeName}</strong>
      </div>
      <div class="stats-row">
        <span>Status</span>
        <strong style="color: #ef4444;">Inactive</strong>
      </div>
      <div class="stats-row">
        <span>Data</span>
        <strong style="color: #10b981;">Preserved</strong>
      </div>
    </div>
    <div class="highlight">
      <strong>Your data is safe!</strong><br>
      All your products, orders, and store settings have been preserved. Subscribe to a plan to reactivate your store instantly.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/ecommerce/settings?tab=subscription" class="button" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">Reactivate Your Store</a>
    </p>
    <p style="color: #71717a; font-size: 14px;">Need help choosing a plan? Reply to this email and we'll be happy to assist.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your FlowShop free trial has ended`,
    html: baseTemplate(content, `Your FlowShop trial for ${params.storeName} has expired`),
  });
}

// FlowShop Trial Converted to Paid Subscription
export async function sendEcomTrialConvertedEmail(params: {
  to: string;
  name: string;
  storeName: string;
  planName: string;
  amountCents: number;
}) {
  const content = `
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; border-radius: 8px 8px 0 0; margin: -32px -24px 24px -24px;">
      <h2 style="color: #ffffff; margin: 0; font-size: 24px;">FlowShop Subscription Confirmed</h2>
    </div>
    <p>Hi ${params.name},</p>
    <p>Your FlowShop subscription is now active! Your store <strong>${params.storeName}</strong> is live and ready for business.</p>
    <div class="stats-box">
      <div class="stats-row">
        <span>Store</span>
        <strong>${params.storeName}</strong>
      </div>
      <div class="stats-row">
        <span>Plan</span>
        <strong>${params.planName}</strong>
      </div>
      <div class="stats-row">
        <span>Billing Amount</span>
        <strong>$${(params.amountCents / 100).toFixed(2)}/month</strong>
      </div>
      <div class="stats-row">
        <span>Status</span>
        <strong style="color: #10b981;">Active</strong>
      </div>
    </div>
    <div class="highlight">
      <strong>You're all set!</strong><br>
      Your store is fully active. Customers can browse your products and place orders.
    </div>
    <p style="text-align: center;">
      <a href="${APP_URL}/ecommerce/dashboard" class="button" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">Go to Dashboard</a>
    </p>
    <p style="color: #71717a; font-size: 14px;">Thank you for choosing FlowShop. If you have any questions, reply to this email.</p>
  `;

  return sendEmail({
    to: params.to,
    subject: `FlowShop subscription confirmed`,
    html: baseTemplate(content, `Your FlowShop subscription for ${params.storeName} is now active`),
  });
}
