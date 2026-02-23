/**
 * Notification Service for FlowSmartly
 * Handles in-app notifications and integrates with email service
 */

import { prisma } from "@/lib/db/client";
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendCreditPurchaseEmail,
  sendLowCreditWarningEmail,
  sendCampaignSentEmail,
  sendNewFollowerEmail,
  sendEngagementAlertEmail,
  sendPhoneNumberRentalEmail,
  sendLoginAlertEmail,
  sendPaymentMethodAddedEmail,
  sendPaymentMethodRemovedEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionRenewedEmail,
  sendComplianceApprovedEmail,
  sendComplianceRejectedEmail,
  sendA2pRegistrationSubmittedEmail,
  sendA2pBrandApprovedEmail,
  sendA2pBrandFailedEmail,
  sendA2pCampaignVerifiedEmail,
  sendA2pCampaignFailedEmail,
  sendTollfreeVerificationSubmittedEmail,
  sendTollfreeVerificationApprovedEmail,
  sendTollfreeVerificationRejectedEmail,
  sendAgentApprovedEmail,
  sendAgentRejectedEmail,
  sendTeamInvitationEmail,
  sendContentRemovedEmail,
  sendContentWarningEmail,
  sendEcomTrialReminderEmail,
  sendEcomTrialExpiredEmail,
  sendEcomTrialConvertedEmail,
} from "@/lib/email";

// ── Notification Types ──

export const NOTIFICATION_TYPES = {
  // System
  SYSTEM: "SYSTEM",
  WELCOME: "WELCOME",

  // Account
  EMAIL_VERIFIED: "EMAIL_VERIFIED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  LOGIN_NEW_DEVICE: "LOGIN_NEW_DEVICE",

  // Credits & Billing
  CREDITS_PURCHASED: "CREDITS_PURCHASED",
  CREDITS_LOW: "CREDITS_LOW",
  CREDITS_DEPLETED: "CREDITS_DEPLETED",
  PAYMENT_METHOD_ADDED: "PAYMENT_METHOD_ADDED",
  PAYMENT_METHOD_REMOVED: "PAYMENT_METHOD_REMOVED",
  SUBSCRIPTION_ACTIVATED: "SUBSCRIPTION_ACTIVATED",
  SUBSCRIPTION_RENEWED: "SUBSCRIPTION_RENEWED",
  SUBSCRIPTION_CANCELLED: "SUBSCRIPTION_CANCELLED",
  SUBSCRIPTION_EXPIRING: "SUBSCRIPTION_EXPIRING",

  // Social
  NEW_FOLLOWER: "NEW_FOLLOWER",
  POST_LIKED: "POST_LIKED",
  POST_COMMENTED: "POST_COMMENTED",
  POST_SHARED: "POST_SHARED",
  COMMENT_REPLY: "COMMENT_REPLY",
  MENTION: "MENTION",

  // Marketing
  CAMPAIGN_SENT: "CAMPAIGN_SENT",
  CAMPAIGN_COMPLETED: "CAMPAIGN_COMPLETED",
  SMS_NUMBER_ACTIVATED: "SMS_NUMBER_ACTIVATED",
  SMS_NUMBER_EXPIRING: "SMS_NUMBER_EXPIRING",
  SMS_COMPLIANCE_SUBMITTED: "SMS_COMPLIANCE_SUBMITTED",
  SMS_COMPLIANCE_APPROVED: "SMS_COMPLIANCE_APPROVED",
  SMS_COMPLIANCE_REJECTED: "SMS_COMPLIANCE_REJECTED",
  SMS_A2P_SUBMITTED: "SMS_A2P_SUBMITTED",
  SMS_A2P_BRAND_APPROVED: "SMS_A2P_BRAND_APPROVED",
  SMS_A2P_BRAND_FAILED: "SMS_A2P_BRAND_FAILED",
  SMS_A2P_CAMPAIGN_VERIFIED: "SMS_A2P_CAMPAIGN_VERIFIED",
  SMS_A2P_CAMPAIGN_FAILED: "SMS_A2P_CAMPAIGN_FAILED",
  SMS_TOLLFREE_SUBMITTED: "SMS_TOLLFREE_SUBMITTED",
  SMS_TOLLFREE_APPROVED: "SMS_TOLLFREE_APPROVED",
  SMS_TOLLFREE_REJECTED: "SMS_TOLLFREE_REJECTED",

  // Agent
  AGENT_APPROVED: "AGENT_APPROVED",
  AGENT_REJECTED: "AGENT_REJECTED",

  // Moderation
  CONTENT_FLAGGED: "CONTENT_FLAGGED",
  CONTENT_REMOVED: "CONTENT_REMOVED",
  CONTENT_WARNING: "CONTENT_WARNING",

  // Content
  AI_GENERATION_COMPLETE: "AI_GENERATION_COMPLETE",
  POST_SCHEDULED: "POST_SCHEDULED",
  POST_PUBLISHED: "POST_PUBLISHED",

  // Engagement
  ENGAGEMENT_MILESTONE: "ENGAGEMENT_MILESTONE",
  TRENDING_POST: "TRENDING_POST",

  // Strategy Scoring
  STRATEGY_MILESTONE: "STRATEGY_MILESTONE",
  STRATEGY_MONTHLY_REPORT: "STRATEGY_MONTHLY_REPORT",

  // Strategy Automation
  STRATEGY_AUTOMATION_STARTED: "STRATEGY_AUTOMATION_STARTED",
  STRATEGY_AUTOMATION_POST_CREATED: "STRATEGY_AUTOMATION_POST_CREATED",
  STRATEGY_AUTOMATION_CREDIT_WARNING: "STRATEGY_AUTOMATION_CREDIT_WARNING",
  STRATEGY_AUTOMATION_COMPLETE: "STRATEGY_AUTOMATION_COMPLETE",

  // Messaging
  NEW_MESSAGE: "NEW_MESSAGE",
  APPROVAL_REQUEST: "APPROVAL_REQUEST",
  APPROVAL_APPROVED: "APPROVAL_APPROVED",
  APPROVAL_REJECTED: "APPROVAL_REJECTED",

  // Teams
  TEAM_INVITATION: "TEAM_INVITATION",
  TEAM_MEMBER_JOINED: "TEAM_MEMBER_JOINED",
  TASK_ASSIGNED: "TASK_ASSIGNED",
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
  TASK_COMMENT_ADDED: "TASK_COMMENT_ADDED",

  // Join Requests
  TEAM_JOIN_REQUEST: "TEAM_JOIN_REQUEST",
  TEAM_JOIN_APPROVED: "TEAM_JOIN_APPROVED",
  TEAM_JOIN_REJECTED: "TEAM_JOIN_REJECTED",

  // Data Forms
  DATA_FORM_SUBMISSION: "DATA_FORM_SUBMISSION",

  // E-Commerce (FlowShop)
  ECOM_TRIAL_REMINDER: "ECOM_TRIAL_REMINDER",
  ECOM_TRIAL_EXPIRED: "ECOM_TRIAL_EXPIRED",
  ECOM_TRIAL_CONVERTED: "ECOM_TRIAL_CONVERTED",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// ── Notification Service ──

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
}

interface NotificationWithEmail extends CreateNotificationParams {
  sendEmail?: boolean;
  emailData?: Record<string, unknown>;
}

/**
 * Create an in-app notification
 */
export async function createNotification(params: CreateNotificationParams) {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data ? JSON.stringify(params.data) : null,
      actionUrl: params.actionUrl,
    },
  });

  return notification;
}

/**
 * Get user's notifications with pagination
 */
export async function getNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
) {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  const where = {
    userId,
    ...(unreadOnly ? { read: false } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      ...n,
      data: n.data ? JSON.parse(n.data) : null,
    })),
    total,
    unreadCount,
    hasMore: offset + limit < total,
  };
}

/**
 * Mark notification(s) as read
 */
export async function markAsRead(
  userId: string,
  notificationIds?: string[]
) {
  const where = notificationIds
    ? { userId, id: { in: notificationIds } }
    : { userId, read: false };

  await prisma.notification.updateMany({
    where,
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Delete notification(s)
 */
export async function deleteNotifications(
  userId: string,
  notificationIds: string[]
) {
  await prisma.notification.deleteMany({
    where: {
      userId,
      id: { in: notificationIds },
    },
  });

  return { success: true };
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

// ── High-Level Notification Functions ──
// These create in-app notifications AND optionally send emails

/**
 * Notify user of new account (welcome)
 */
export async function notifyWelcome(params: {
  userId: string;
  email: string;
  name: string;
  verificationUrl?: string;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.WELCOME,
    title: "Welcome to FlowSmartly!",
    message: "Your account has been created. Start exploring all the features!",
    actionUrl: "/dashboard",
  });

  // Send welcome email
  await sendWelcomeEmail({
    to: params.email,
    name: params.name,
    verificationUrl: params.verificationUrl,
  });
}

/**
 * Notify user of email verification
 */
export async function notifyEmailVerification(params: {
  userId: string;
  email: string;
  name: string;
  verificationUrl: string;
  code?: string;
}) {
  // Send verification email (no in-app notification needed)
  await sendVerificationEmail({
    to: params.email,
    name: params.name,
    verificationUrl: params.verificationUrl,
    code: params.code,
  });
}

/**
 * Notify user when email is verified
 */
export async function notifyEmailVerified(params: {
  userId: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.EMAIL_VERIFIED,
    title: "Email Verified",
    message: "Your email has been successfully verified!",
    actionUrl: "/settings",
  });
}

/**
 * Notify user of password reset request
 */
export async function notifyPasswordReset(params: {
  email: string;
  name: string;
  resetUrl: string;
}) {
  // Send password reset email (no in-app notification - user can't log in)
  await sendPasswordResetEmail({
    to: params.email,
    name: params.name,
    resetUrl: params.resetUrl,
  });
}

/**
 * Notify user of password change
 */
export async function notifyPasswordChanged(params: {
  userId: string;
  email: string;
  name: string;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.PASSWORD_CHANGED,
    title: "Password Changed",
    message: "Your password has been successfully changed.",
    actionUrl: "/settings?tab=security",
  });

  // Send confirmation email
  await sendPasswordChangedEmail({
    to: params.email,
    name: params.name,
  });
}

/**
 * Notify user of new login from unknown device
 */
export async function notifyNewLogin(params: {
  userId: string;
  email: string;
  name: string;
  device: string;
  ipAddress?: string;
  location?: string;
}) {
  const time = new Date();

  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.LOGIN_NEW_DEVICE,
    title: "New Login Detected",
    message: `New login from ${params.device}${params.location ? ` in ${params.location}` : ""}`,
    data: { device: params.device, ipAddress: params.ipAddress, location: params.location, time: time.toISOString() },
    actionUrl: "/settings?tab=security",
  });

  // Send email alert
  await sendLoginAlertEmail({
    to: params.email,
    name: params.name,
    device: params.device,
    location: params.location,
    ipAddress: params.ipAddress,
    time,
  });
}

/**
 * Notify user of credit purchase
 */
export async function notifyCreditPurchase(params: {
  userId: string;
  email: string;
  name: string;
  credits: number;
  amountCents: number;
  newBalance: number;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.CREDITS_PURCHASED,
    title: "Credits Added",
    message: `${params.credits.toLocaleString()} credits have been added to your account!`,
    data: { credits: params.credits, amount: params.amountCents, balance: params.newBalance },
    actionUrl: "/settings?tab=billing",
  });

  // Send email
  await sendCreditPurchaseEmail({
    to: params.email,
    name: params.name,
    credits: params.credits,
    amount: params.amountCents,
    newBalance: params.newBalance,
  });
}

/**
 * Notify user of low credit balance
 */
export async function notifyLowCredits(params: {
  userId: string;
  email: string;
  name: string;
  currentBalance: number;
  threshold: number;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.CREDITS_LOW,
    title: "Low Credit Balance",
    message: `Your credit balance (${params.currentBalance}) is running low. Consider adding more credits.`,
    data: { balance: params.currentBalance, threshold: params.threshold },
    actionUrl: "/settings?tab=billing",
  });

  // Send email
  await sendLowCreditWarningEmail({
    to: params.email,
    name: params.name,
    currentBalance: params.currentBalance,
    threshold: params.threshold,
  });
}

/**
 * Notify user when credits are depleted
 */
export async function notifyCreditsDepeleted(params: {
  userId: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.CREDITS_DEPLETED,
    title: "Credits Depleted",
    message: "You've run out of credits. Add more to continue using AI features.",
    actionUrl: "/settings?tab=billing",
  });
}

/**
 * Notify user when a payment method is added
 */
export async function notifyPaymentMethodAdded(params: {
  userId: string;
  email: string;
  name: string;
  cardBrand: string;
  last4: string;
}) {
  const time = new Date();

  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.PAYMENT_METHOD_ADDED,
    title: "Payment Method Added",
    message: `A new ${params.cardBrand.toUpperCase()} card ending in ${params.last4} was added to your account.`,
    data: { cardBrand: params.cardBrand, last4: params.last4, time: time.toISOString() },
    actionUrl: "/settings?tab=billing",
  });

  // Send security email
  await sendPaymentMethodAddedEmail({
    to: params.email,
    name: params.name,
    cardBrand: params.cardBrand,
    last4: params.last4,
    time,
  });
}

/**
 * Notify user when a payment method is removed
 */
export async function notifyPaymentMethodRemoved(params: {
  userId: string;
  email: string;
  name: string;
  cardBrand: string;
  last4: string;
}) {
  const time = new Date();

  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.PAYMENT_METHOD_REMOVED,
    title: "Payment Method Removed",
    message: `Your ${params.cardBrand.toUpperCase()} card ending in ${params.last4} was removed from your account.`,
    data: { cardBrand: params.cardBrand, last4: params.last4, time: time.toISOString() },
    actionUrl: "/settings?tab=billing",
  });

  // Send security email
  await sendPaymentMethodRemovedEmail({
    to: params.email,
    name: params.name,
    cardBrand: params.cardBrand,
    last4: params.last4,
    time,
  });
}

/**
 * Notify user when subscription is activated
 */
export async function notifySubscriptionActivated(params: {
  userId: string;
  email: string;
  name: string;
  planName: string;
  monthlyCredits: number;
  amountCents: number;
  interval: string;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_ACTIVATED,
    title: "Subscription Activated",
    message: `Welcome to the ${params.planName} plan! ${params.monthlyCredits.toLocaleString()} credits have been added.`,
    data: { planName: params.planName, monthlyCredits: params.monthlyCredits, amountCents: params.amountCents },
    actionUrl: "/settings?tab=billing",
  });

  // Send confirmation email
  await sendSubscriptionActivatedEmail({
    to: params.email,
    name: params.name,
    planName: params.planName,
    monthlyCredits: params.monthlyCredits,
    amountCents: params.amountCents,
    interval: params.interval,
  });
}

/**
 * Notify user when subscription is cancelled
 */
export async function notifySubscriptionCancelled(params: {
  userId: string;
  email: string;
  name: string;
  planName: string;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_CANCELLED,
    title: "Subscription Cancelled",
    message: `Your ${params.planName} plan has been cancelled. You've been moved to the Starter plan.`,
    data: { planName: params.planName },
    actionUrl: "/settings/upgrade",
  });

  // Send confirmation email
  await sendSubscriptionCancelledEmail({
    to: params.email,
    name: params.name,
    planName: params.planName,
  });
}

/**
 * Notify user when subscription is renewed
 */
export async function notifySubscriptionRenewed(params: {
  userId: string;
  email: string;
  name: string;
  planName: string;
  monthlyCredits: number;
  amountCents: number;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SUBSCRIPTION_RENEWED,
    title: "Subscription Renewed",
    message: `Your ${params.planName} plan has been renewed. ${params.monthlyCredits.toLocaleString()} credits added!`,
    data: { planName: params.planName, monthlyCredits: params.monthlyCredits, amountCents: params.amountCents },
    actionUrl: "/settings?tab=billing",
  });

  // Send confirmation email
  await sendSubscriptionRenewedEmail({
    to: params.email,
    name: params.name,
    planName: params.planName,
    monthlyCredits: params.monthlyCredits,
    amountCents: params.amountCents,
  });
}

/**
 * Notify user of new follower
 */
export async function notifyNewFollower(params: {
  userId: string;
  email: string;
  name: string;
  followerName: string;
  followerUsername: string;
  followerAvatar?: string;
  totalFollowers: number;
  sendEmail?: boolean;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.NEW_FOLLOWER,
    title: "New Follower",
    message: `${params.followerName} (@${params.followerUsername}) started following you`,
    data: {
      followerName: params.followerName,
      followerUsername: params.followerUsername,
      followerAvatar: params.followerAvatar,
    },
    actionUrl: `/profile/${params.followerUsername}`,
  });

  // Optionally send email (based on user preferences)
  if (params.sendEmail) {
    await sendNewFollowerEmail({
      to: params.email,
      name: params.name,
      followerName: params.followerName,
      followerUsername: params.followerUsername,
      followerAvatar: params.followerAvatar,
      totalFollowers: params.totalFollowers,
    });
  }
}

/**
 * Notify user of post like
 */
export async function notifyPostLiked(params: {
  userId: string;
  likerName: string;
  likerUsername: string;
  postId: string;
  postCaption?: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.POST_LIKED,
    title: "Post Liked",
    message: `${params.likerName} liked your post`,
    data: { likerName: params.likerName, likerUsername: params.likerUsername },
    actionUrl: `/posts/${params.postId}`,
  });
}

/**
 * Notify user of comment on their post
 */
export async function notifyPostCommented(params: {
  userId: string;
  commenterName: string;
  commenterUsername: string;
  postId: string;
  commentPreview: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.POST_COMMENTED,
    title: "New Comment",
    message: `${params.commenterName} commented: "${params.commentPreview.substring(0, 50)}${params.commentPreview.length > 50 ? "..." : ""}"`,
    data: { commenterName: params.commenterName, commenterUsername: params.commenterUsername, comment: params.commentPreview },
    actionUrl: `/posts/${params.postId}`,
  });
}

/**
 * Notify user of comment reply
 */
export async function notifyCommentReply(params: {
  userId: string;
  replierName: string;
  replierUsername: string;
  postId: string;
  replyPreview: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.COMMENT_REPLY,
    title: "Comment Reply",
    message: `${params.replierName} replied: "${params.replyPreview.substring(0, 50)}${params.replyPreview.length > 50 ? "..." : ""}"`,
    data: { replierName: params.replierName, replierUsername: params.replierUsername, reply: params.replyPreview },
    actionUrl: `/posts/${params.postId}`,
  });
}

/**
 * Notify user that their campaign was sent
 */
export async function notifyCampaignSent(params: {
  userId: string;
  email: string;
  name: string;
  campaignName: string;
  campaignType: "email" | "sms";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.CAMPAIGN_SENT,
    title: "Campaign Sent",
    message: `Your ${params.campaignType.toUpperCase()} campaign "${params.campaignName}" was sent to ${params.sentCount} recipients`,
    data: {
      campaignName: params.campaignName,
      type: params.campaignType,
      sent: params.sentCount,
      failed: params.failedCount,
    },
    actionUrl: `/${params.campaignType}-marketing`,
  });

  // Send email
  await sendCampaignSentEmail({
    to: params.email,
    name: params.name,
    campaignName: params.campaignName,
    campaignType: params.campaignType,
    recipientCount: params.recipientCount,
    sentCount: params.sentCount,
    failedCount: params.failedCount,
  });
}

/**
 * Notify user that their SMS number was activated
 */
export async function notifySmsNumberActivated(params: {
  userId: string;
  email: string;
  name: string;
  phoneNumber: string;
  monthlyCostCents: number;
  creditsCharged: number;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_NUMBER_ACTIVATED,
    title: "SMS Number Activated",
    message: `Your SMS marketing number ${params.phoneNumber} is now active!`,
    data: { phoneNumber: params.phoneNumber },
    actionUrl: "/settings/sms-marketing",
  });

  // Send email
  await sendPhoneNumberRentalEmail({
    to: params.email,
    name: params.name,
    phoneNumber: params.phoneNumber,
    monthlyCost: params.monthlyCostCents,
    creditsCharged: params.creditsCharged,
  });
}

/**
 * Notify user that their SMS compliance application was approved
 */
export async function notifyComplianceApproved(params: {
  userId: string;
  email: string;
  name: string;
  businessName: string;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_COMPLIANCE_APPROVED,
    title: "SMS Compliance Approved",
    message: `Your SMS marketing application for ${params.businessName} has been approved! You can now rent a phone number.`,
    data: { businessName: params.businessName },
    actionUrl: "/settings/sms-marketing",
  });

  // Send email
  await sendComplianceApprovedEmail({
    to: params.email,
    name: params.name,
    businessName: params.businessName,
  });
}

/**
 * Notify user that their SMS compliance application was rejected
 */
export async function notifyComplianceRejected(params: {
  userId: string;
  email: string;
  name: string;
  businessName: string;
  notes: string;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_COMPLIANCE_REJECTED,
    title: "SMS Compliance Needs Revision",
    message: `Your SMS marketing application for ${params.businessName} needs revision. Check the reviewer notes.`,
    data: { businessName: params.businessName, notes: params.notes },
    actionUrl: "/settings/sms-marketing/compliance",
  });

  // Send email
  await sendComplianceRejectedEmail({
    to: params.email,
    name: params.name,
    businessName: params.businessName,
    notes: params.notes,
  });
}

/**
 * Notify user that their agent application was approved
 */
export async function notifyAgentApproved(params: {
  userId: string;
  email: string;
  name: string;
  displayName: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.AGENT_APPROVED,
    title: "Agent Application Approved!",
    message: `Congratulations! Your agent application as ${params.displayName} has been approved. You now have full agent access.`,
    data: { displayName: params.displayName },
    actionUrl: "/agent/dashboard",
  });

  await sendAgentApprovedEmail({
    to: params.email,
    name: params.name,
    displayName: params.displayName,
  });
}

/**
 * Notify user that their agent application was rejected
 */
export async function notifyAgentRejected(params: {
  userId: string;
  email: string;
  name: string;
  displayName: string;
  reason?: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.AGENT_REJECTED,
    title: "Agent Application Not Approved",
    message: `Your agent application as ${params.displayName} was not approved.${params.reason ? ` Reason: ${params.reason}` : " Please review and reapply."}`,
    data: { displayName: params.displayName, reason: params.reason },
    actionUrl: "/agent/apply",
  });

  await sendAgentRejectedEmail({
    to: params.email,
    name: params.name,
    displayName: params.displayName,
    reason: params.reason,
  });
}

/**
 * Notify admin that a new compliance application was submitted.
 * Admins are in a separate AdminUser table, so we log for the admin portal to pick up.
 */
export async function notifyComplianceSubmitted(params: {
  userId: string;
  businessName: string;
  userName: string;
}) {
  console.log(
    `[Compliance] New submission from ${params.userName} (${params.businessName}) - userId: ${params.userId}`
  );
}

/**
 * Notify user of engagement milestone
 */
export async function notifyEngagementMilestone(params: {
  userId: string;
  email: string;
  name: string;
  postId: string;
  postCaption: string;
  likes: number;
  comments: number;
  shares: number;
  sendEmail?: boolean;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.ENGAGEMENT_MILESTONE,
    title: "Your Post is Trending!",
    message: `Your post reached ${params.likes} likes!`,
    data: { postId: params.postId, likes: params.likes, comments: params.comments, shares: params.shares },
    actionUrl: `/posts/${params.postId}`,
  });

  // Optionally send email
  if (params.sendEmail) {
    await sendEngagementAlertEmail({
      to: params.email,
      name: params.name,
      postId: params.postId,
      postCaption: params.postCaption,
      likes: params.likes,
      comments: params.comments,
      shares: params.shares,
    });
  }
}

/**
 * Notify user that AI generation is complete
 */
export async function notifyAiGenerationComplete(params: {
  userId: string;
  generationType: string;
  contentId?: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.AI_GENERATION_COMPLETE,
    title: "Content Ready",
    message: `Your AI-generated ${params.generationType} is ready!`,
    data: { type: params.generationType, contentId: params.contentId },
    actionUrl: params.contentId ? `/content/${params.contentId}` : "/ai-studio",
  });
}

/**
 * Notify user that their post was published
 */
export async function notifyPostPublished(params: {
  userId: string;
  postId: string;
  postCaption?: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.POST_PUBLISHED,
    title: "Post Published",
    message: "Your scheduled post has been published!",
    data: { postId: params.postId },
    actionUrl: `/posts/${params.postId}`,
  });
}

/**
 * Notify user that A2P 10DLC registration was submitted
 */
export async function notifyA2pRegistrationSubmitted(params: {
  userId: string;
  email: string;
  name: string;
  phoneNumber: string;
  businessName: string;
  brandSid?: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_A2P_SUBMITTED,
    title: "A2P Registration Submitted",
    message: `Your A2P 10DLC registration for ${params.businessName} has been submitted. Carrier review typically takes 1-7 business days.`,
    data: { phoneNumber: params.phoneNumber, businessName: params.businessName, brandSid: params.brandSid },
    actionUrl: "/sms-marketing",
  });

  await sendA2pRegistrationSubmittedEmail({
    to: params.email,
    name: params.name,
    phoneNumber: params.phoneNumber,
    businessName: params.businessName,
    brandSid: params.brandSid,
  });
}

/**
 * Notify user that A2P brand was approved
 */
export async function notifyA2pBrandApproved(params: {
  userId: string;
  email: string;
  name: string;
  businessName: string;
  campaignCreated: boolean;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_A2P_BRAND_APPROVED,
    title: "A2P Brand Approved",
    message: `Your A2P brand for ${params.businessName} has been approved!${params.campaignCreated ? " Campaign is now pending review." : ""}`,
    data: { businessName: params.businessName, campaignCreated: params.campaignCreated },
    actionUrl: "/sms-marketing",
  });

  await sendA2pBrandApprovedEmail({
    to: params.email,
    name: params.name,
    businessName: params.businessName,
    campaignCreated: params.campaignCreated,
  });
}

/**
 * Notify user that A2P brand registration failed
 */
export async function notifyA2pBrandFailed(params: {
  userId: string;
  email: string;
  name: string;
  businessName: string;
  failureReason?: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_A2P_BRAND_FAILED,
    title: "A2P Brand Registration Issue",
    message: `Your A2P brand registration for ${params.businessName} was not approved.${params.failureReason ? ` Reason: ${params.failureReason}` : ""}`,
    data: { businessName: params.businessName, failureReason: params.failureReason },
    actionUrl: "/sms-marketing",
  });

  await sendA2pBrandFailedEmail({
    to: params.email,
    name: params.name,
    businessName: params.businessName,
    failureReason: params.failureReason,
  });
}

/**
 * Notify user that A2P campaign was verified (fully approved)
 */
export async function notifyA2pCampaignVerified(params: {
  userId: string;
  email: string;
  name: string;
  businessName: string;
  phoneNumber: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_A2P_CAMPAIGN_VERIFIED,
    title: "A2P Registration Complete",
    message: `Your A2P 10DLC registration for ${params.businessName} is now fully approved. You can send SMS campaigns with full throughput.`,
    data: { businessName: params.businessName, phoneNumber: params.phoneNumber },
    actionUrl: "/sms-marketing/create",
  });

  await sendA2pCampaignVerifiedEmail({
    to: params.email,
    name: params.name,
    businessName: params.businessName,
    phoneNumber: params.phoneNumber,
  });
}

/**
 * Notify user that A2P campaign failed
 */
export async function notifyA2pCampaignFailed(params: {
  userId: string;
  email: string;
  name: string;
  businessName: string;
  failureReason?: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_A2P_CAMPAIGN_FAILED,
    title: "A2P Campaign Review Issue",
    message: `Your A2P messaging campaign for ${params.businessName} was not approved.${params.failureReason ? ` Reason: ${params.failureReason}` : ""}`,
    data: { businessName: params.businessName, failureReason: params.failureReason },
    actionUrl: "/sms-marketing",
  });

  await sendA2pCampaignFailedEmail({
    to: params.email,
    name: params.name,
    businessName: params.businessName,
    failureReason: params.failureReason,
  });
}

/**
 * Notify user that toll-free verification was submitted
 */
export async function notifyTollfreeVerificationSubmitted(params: {
  userId: string;
  email: string;
  name: string;
  phoneNumber: string;
  businessName: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_TOLLFREE_SUBMITTED,
    title: "Toll-Free Verification Submitted",
    message: `Your toll-free number verification for ${params.businessName} has been submitted. Review typically takes 1-5 business days.`,
    data: { phoneNumber: params.phoneNumber, businessName: params.businessName },
    actionUrl: "/sms-marketing",
  });

  await sendTollfreeVerificationSubmittedEmail({
    to: params.email,
    name: params.name,
    phoneNumber: params.phoneNumber,
    businessName: params.businessName,
  });
}

/**
 * Notify user that toll-free verification was approved
 */
export async function notifyTollfreeVerificationApproved(params: {
  userId: string;
  email: string;
  name: string;
  phoneNumber: string;
  businessName: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_TOLLFREE_APPROVED,
    title: "Toll-Free Number Verified",
    message: `Your toll-free number ${params.phoneNumber} for ${params.businessName} has been verified and is ready for messaging.`,
    data: { phoneNumber: params.phoneNumber, businessName: params.businessName },
    actionUrl: "/sms-marketing/create",
  });

  await sendTollfreeVerificationApprovedEmail({
    to: params.email,
    name: params.name,
    phoneNumber: params.phoneNumber,
    businessName: params.businessName,
  });
}

/**
 * Notify user that toll-free verification was rejected
 */
export async function notifyTollfreeVerificationRejected(params: {
  userId: string;
  email: string;
  name: string;
  phoneNumber: string;
  businessName: string;
  rejectionReason?: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.SMS_TOLLFREE_REJECTED,
    title: "Toll-Free Verification Issue",
    message: `Your toll-free number verification for ${params.businessName} was not approved.${params.rejectionReason ? ` Reason: ${params.rejectionReason}` : ""}`,
    data: { phoneNumber: params.phoneNumber, businessName: params.businessName, rejectionReason: params.rejectionReason },
    actionUrl: "/sms-marketing",
  });

  await sendTollfreeVerificationRejectedEmail({
    to: params.email,
    name: params.name,
    phoneNumber: params.phoneNumber,
    businessName: params.businessName,
    rejectionReason: params.rejectionReason,
  });
}

/**
 * Notify user of a new message in a conversation
 */
export async function notifyNewMessage(params: {
  recipientUserId: string;
  senderName: string;
  messagePreview: string;
  conversationId: string;
}) {
  await createNotification({
    userId: params.recipientUserId,
    type: NOTIFICATION_TYPES.NEW_MESSAGE,
    title: `New message from ${params.senderName}`,
    message: params.messagePreview.substring(0, 100) || "Sent an attachment",
    actionUrl: `/messages/${params.conversationId}`,
  });
}

/**
 * Notify client that content approval has been requested
 */
export async function notifyApprovalRequest(params: {
  clientUserId: string;
  agentName: string;
  postPreview: string;
  conversationId: string;
}) {
  await createNotification({
    userId: params.clientUserId,
    type: NOTIFICATION_TYPES.APPROVAL_REQUEST,
    title: "Content approval requested",
    message: `${params.agentName} sent content for review: ${params.postPreview.substring(0, 80)}`,
    actionUrl: `/messages/${params.conversationId}`,
  });
}

/**
 * Notify agent of client's approval decision (approved or rejected)
 */
export async function notifyApprovalDecision(params: {
  agentUserId: string;
  clientName: string;
  decision: "approved" | "rejected";
  comment?: string;
  conversationId: string;
}) {
  const type = params.decision === "approved" ? NOTIFICATION_TYPES.APPROVAL_APPROVED : NOTIFICATION_TYPES.APPROVAL_REJECTED;
  await createNotification({
    userId: params.agentUserId,
    type,
    title: `Content ${params.decision}`,
    message: `${params.clientName} ${params.decision} your content${params.comment ? ": " + params.comment.substring(0, 80) : ""}`,
    actionUrl: `/messages/${params.conversationId}`,
  });
}

// ── Team Notifications ──

export async function notifyTeamInvitation(params: {
  userId: string;
  teamName: string;
  inviterName: string;
  inviteToken: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.TEAM_INVITATION,
    title: "Team Invitation",
    message: `${params.inviterName} invited you to join ${params.teamName}`,
    actionUrl: `/teams/invite/${params.inviteToken}`,
  });
}

export async function notifyTeamMemberJoined(params: {
  ownerUserId: string;
  memberName: string;
  teamName: string;
  teamId: string;
}) {
  await createNotification({
    userId: params.ownerUserId,
    type: NOTIFICATION_TYPES.TEAM_MEMBER_JOINED,
    title: "New Team Member",
    message: `${params.memberName} joined ${params.teamName}`,
    actionUrl: `/teams/${params.teamId}`,
  });
}

/**
 * Create a system notification for all users or specific users
 */
export async function createSystemNotification(params: {
  userIds?: string[]; // If not provided, sends to all users
  title: string;
  message: string;
  actionUrl?: string;
}) {
  if (params.userIds && params.userIds.length > 0) {
    // Create for specific users
    await prisma.notification.createMany({
      data: params.userIds.map((userId) => ({
        userId,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
      })),
    });
  } else {
    // Create for all users
    const users = await prisma.user.findMany({
      select: { id: true },
      where: { deletedAt: null },
    });

    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
      })),
    });
  }

  return { success: true };
}

// ── User Notification Preferences ──

interface NotificationPreferences {
  email: {
    marketing: boolean;
    followers: boolean;
    engagement: boolean;
    campaigns: boolean;
    security: boolean;
    billing: boolean;
    strategy: boolean;
  };
  push: {
    followers: boolean;
    engagement: boolean;
    campaigns: boolean;
  };
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: {
    marketing: true,
    followers: true,
    engagement: true,
    campaigns: true,
    security: true,
    billing: true,
    strategy: true,
  },
  push: {
    followers: true,
    engagement: true,
    campaigns: true,
  },
};

/**
 * Get user's notification preferences
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });

  if (!user?.notificationPrefs || user.notificationPrefs === "{}") {
    return DEFAULT_PREFERENCES;
  }

  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(user.notificationPrefs) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Update user's notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const updated = {
    email: { ...current.email, ...preferences.email },
    push: { ...current.push, ...preferences.push },
  };

  await prisma.user.update({
    where: { id: userId },
    data: { notificationPrefs: JSON.stringify(updated) },
  });

  return updated;
}

/**
 * Check if user has enabled a specific notification type
 */
export async function shouldSendEmail(
  userId: string,
  category: keyof NotificationPreferences["email"]
): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId);
  return prefs.email[category] ?? true;
}

// ── Team Project & Task Notifications ──

/**
 * Notify user that a task has been assigned to them
 */
export async function notifyTaskAssigned(params: {
  userId: string;
  taskTitle: string;
  projectName: string;
  assignedBy: string;
  taskId: string;
  projectId: string;
  teamId: string;
}) {
  const assigner = await prisma.user.findUnique({
    where: { id: params.assignedBy },
    select: { name: true },
  });

  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.TASK_ASSIGNED,
    title: "Task Assigned",
    message: `${assigner?.name || "Someone"} assigned you "${params.taskTitle}" in ${params.projectName}`,
    data: {
      taskId: params.taskId,
      projectId: params.projectId,
      teamId: params.teamId,
      assignedBy: params.assignedBy,
    },
    actionUrl: `/teams/${params.teamId}/projects/${params.projectId}`,
  });
}

/**
 * Notify user that a task status has changed
 */
export async function notifyTaskStatusChanged(params: {
  userId: string;
  taskTitle: string;
  projectName: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  taskId: string;
  projectId: string;
  teamId: string;
}) {
  const changer = await prisma.user.findUnique({
    where: { id: params.changedBy },
    select: { name: true },
  });

  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.TASK_STATUS_CHANGED,
    title: "Task Status Updated",
    message: `${changer?.name || "Someone"} changed "${params.taskTitle}" from ${params.oldStatus} to ${params.newStatus}`,
    data: {
      taskId: params.taskId,
      projectId: params.projectId,
      teamId: params.teamId,
      oldStatus: params.oldStatus,
      newStatus: params.newStatus,
      changedBy: params.changedBy,
    },
    actionUrl: `/teams/${params.teamId}/projects/${params.projectId}`,
  });
}

/**
 * Notify task assignee that a comment was added to their task
 */
export async function notifyTaskCommentAdded(params: {
  userId: string;
  taskTitle: string;
  projectName: string;
  commenterName: string;
  commentPreview: string;
  taskId: string;
  projectId: string;
  teamId: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.TASK_COMMENT_ADDED,
    title: "New Comment on Task",
    message: `${params.commenterName} commented on "${params.taskTitle}": ${params.commentPreview.substring(0, 80)}${params.commentPreview.length > 80 ? "..." : ""}`,
    data: {
      taskId: params.taskId,
      projectId: params.projectId,
      teamId: params.teamId,
      commenterName: params.commenterName,
    },
    actionUrl: `/teams/${params.teamId}/projects/${params.projectId}`,
  });
}

// ── Strategy Automation Notifications ──

/**
 * Notify when strategy automation is launched
 */
export async function notifyStrategyAutomationStarted(params: {
  userId: string;
  strategyName: string;
  taskCount: number;
  estimatedCredits: number;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.STRATEGY_AUTOMATION_STARTED,
    title: "Strategy Automation Launched",
    message: `${params.taskCount} task${params.taskCount > 1 ? "s" : ""} from "${params.strategyName}" are now automated. Estimated cost: ${params.estimatedCredits} credits.`,
    data: {
      strategyName: params.strategyName,
      taskCount: params.taskCount,
      estimatedCredits: params.estimatedCredits,
    },
    actionUrl: "/content/automation",
  });
}

/**
 * Notify when an automated strategy post is created
 */
export async function notifyAutomationPostCreated(params: {
  userId: string;
  taskTitle: string;
  postId: string;
  creditsUsed: number;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.STRATEGY_AUTOMATION_POST_CREATED,
    title: "Automated Post Created",
    message: `New post generated for strategy task "${params.taskTitle}" (${params.creditsUsed} credits used)`,
    data: {
      taskTitle: params.taskTitle,
      postId: params.postId,
      creditsUsed: params.creditsUsed,
    },
    actionUrl: "/content/schedule",
  });
}

/**
 * Notify when credits are running low for automation
 */
export async function notifyAutomationCreditWarning(params: {
  userId: string;
  remainingCredits: number;
  estimatedNeeded: number;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.STRATEGY_AUTOMATION_CREDIT_WARNING,
    title: "Low Credits for Automation",
    message: `Your balance (${params.remainingCredits} credits) may not cover remaining automated posts (~${params.estimatedNeeded} credits needed). Top up to keep automations running.`,
    data: {
      remainingCredits: params.remainingCredits,
      estimatedNeeded: params.estimatedNeeded,
    },
    actionUrl: "/settings?tab=billing",
  });
}

/**
 * Notify when all strategy automations have completed their run
 */
export async function notifyStrategyAutomationComplete(params: {
  userId: string;
  strategyName: string;
  totalPosts: number;
  totalCreditsSpent: number;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.STRATEGY_AUTOMATION_COMPLETE,
    title: "Strategy Automation Complete",
    message: `All automations for "${params.strategyName}" have finished. ${params.totalPosts} posts generated, ${params.totalCreditsSpent} credits spent.`,
    data: {
      strategyName: params.strategyName,
      totalPosts: params.totalPosts,
      totalCreditsSpent: params.totalCreditsSpent,
    },
    actionUrl: "/content/strategy/reports",
  });
}

// ── Content Moderation Notifications ──

/**
 * Notify user that their content has been removed
 */
export async function notifyContentRemoved(params: {
  userId: string;
  email: string;
  name: string;
  contentType: "post" | "comment";
  reason: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.CONTENT_REMOVED,
    title: `Your ${params.contentType} has been removed`,
    message: `Reason: ${params.reason}. Please review our community guidelines.`,
    actionUrl: "/feed",
  });

  sendContentRemovedEmail({
    to: params.email,
    name: params.name,
    contentType: params.contentType,
    reason: params.reason,
  }).catch((err) => console.error("Failed to send content removed email:", err));
}

/**
 * Notify user of a community guidelines warning
 */
export async function notifyContentWarning(params: {
  userId: string;
  email: string;
  name: string;
  reason: string;
}) {
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.CONTENT_WARNING,
    title: "Community Guidelines Warning",
    message: `Your content has been reviewed: ${params.reason}. Repeated violations may result in account suspension.`,
    actionUrl: "/feed",
  });

  sendContentWarningEmail({
    to: params.email,
    name: params.name,
    reason: params.reason,
  }).catch((err) => console.error("Failed to send content warning email:", err));
}

// ── FlowShop E-Commerce Trial Notifications ──

/**
 * Notify user that their FlowShop trial is expiring soon
 */
export async function notifyEcomTrialReminder(params: {
  userId: string;
  email: string;
  name: string;
  daysRemaining: number;
  storeName: string;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.ECOM_TRIAL_REMINDER,
    title: "FlowShop Trial Ending Soon",
    message: `Your free trial for ${params.storeName} ends in ${params.daysRemaining} day${params.daysRemaining !== 1 ? "s" : ""}. Add a payment method to keep your store active.`,
    data: { daysRemaining: params.daysRemaining, storeName: params.storeName },
    actionUrl: "/ecommerce/settings?tab=subscription",
  });

  // Send reminder email
  await sendEcomTrialReminderEmail({
    to: params.email,
    name: params.name,
    daysRemaining: params.daysRemaining,
    storeName: params.storeName,
  });
}

/**
 * Notify user that their FlowShop trial has expired
 */
export async function notifyEcomTrialExpired(params: {
  userId: string;
  email: string;
  name: string;
  storeName: string;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.ECOM_TRIAL_EXPIRED,
    title: "FlowShop Trial Expired",
    message: `Your free trial for ${params.storeName} has ended. Your store is now inactive. Subscribe to reactivate it.`,
    data: { storeName: params.storeName },
    actionUrl: "/ecommerce/settings?tab=subscription",
  });

  // Send expiration email
  await sendEcomTrialExpiredEmail({
    to: params.email,
    name: params.name,
    storeName: params.storeName,
  });
}

/**
 * Notify user that their FlowShop trial has converted to a paid subscription
 */
export async function notifyEcomTrialConverted(params: {
  userId: string;
  email: string;
  name: string;
  storeName: string;
  planName: string;
  amountCents: number;
}) {
  // Create in-app notification
  await createNotification({
    userId: params.userId,
    type: NOTIFICATION_TYPES.ECOM_TRIAL_CONVERTED,
    title: "FlowShop Subscription Active",
    message: `Your ${params.storeName} store is now on the ${params.planName} plan. Your store is fully active!`,
    data: { storeName: params.storeName, planName: params.planName, amountCents: params.amountCents },
    actionUrl: "/ecommerce/dashboard",
  });

  // Send confirmation email
  await sendEcomTrialConvertedEmail({
    to: params.email,
    name: params.name,
    storeName: params.storeName,
    planName: params.planName,
    amountCents: params.amountCents,
  });
}
