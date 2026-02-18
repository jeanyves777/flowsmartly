/**
 * User-to-User Referral Program Service
 *
 * Commission rules:
 * - Regular user/agent refers client: 5% recurring for 3 months
 * - Agent refers another agent: 50% one-time on first client's first month
 */

import { prisma } from "@/lib/db/client";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Code Generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique referral code.
 * Format: REF-XXXXXXXX (e.g., REF-K3F9M2P7)
 */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `REF-${code}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get or create a user's personal referral code.
 * Stored on User.referralCode field.
 */
export async function getUserReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (user?.referralCode) return user.referralCode;

  // Generate unique code with retry loop for uniqueness
  let code: string = "";
  let attempts = 0;
  do {
    code = generateCode();
    const exists = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!exists) break;
    attempts++;
  } while (attempts < 10);

  await prisma.user.update({
    where: { id: userId },
    data: { referralCode: code },
  });

  return code;
}

/**
 * Build full referral URL from a code.
 */
export function buildReferralLink(code: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  return `${base}/ref/${code}`;
}

/**
 * Validate a referral code — returns referrer info or null.
 * Used by registration page to show "Referred by X".
 */
export async function validateReferralCode(
  code: string
): Promise<{
  referrerId: string;
  referrerName: string;
  isAgent: boolean;
} | null> {
  const user = await prisma.user.findFirst({
    where: { referralCode: code },
    select: {
      id: true,
      name: true,
      agentProfile: { select: { id: true, status: true } },
    },
  });

  if (!user) return null;

  return {
    referrerId: user.id,
    referrerName: user.name,
    isAgent: user.agentProfile?.status === "APPROVED",
  };
}

/**
 * Process a referral at signup time.
 * Creates a UserReferral record linking referrer → new user.
 * Commission: 5% recurring for 3 months.
 */
export async function processReferralSignup(
  newUserId: string,
  referralCode: string
): Promise<boolean> {
  // Find referrer by code
  const referrer = await prisma.user.findFirst({
    where: { referralCode: referralCode },
    select: {
      id: true,
      agentProfile: { select: { id: true, status: true } },
    },
  });

  if (!referrer || referrer.id === newUserId) return false;

  // Check if new user is already referred (unique constraint)
  const existing = await prisma.userReferral.findUnique({
    where: { referredUserId: newUserId },
  });
  if (existing) return false;

  // Determine referral type based on referrer's agent status
  const referrerIsAgent = referrer.agentProfile?.status === "APPROVED";
  const referralType = referrerIsAgent
    ? "AGENT_TO_CLIENT"
    : "USER_TO_CLIENT";

  // 3 months from now
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 3);

  await prisma.userReferral.create({
    data: {
      referrerUserId: referrer.id,
      referredUserId: newUserId,
      referralCode: referralCode,
      referralType,
      commissionRate: 0.05,
      commissionType: "RECURRING",
      expiresAt,
      status: "ACTIVE",
    },
  });

  return true;
}

/**
 * Calculate and award commission when a referred user makes a payment.
 * Called from Stripe webhook after processing payment.
 * Idempotent: checks sourcePaymentId to prevent double-awarding.
 */
export async function calculateAndAwardCommission(params: {
  payerUserId: string;
  paymentAmountCents: number;
  sourceType: "SUBSCRIPTION" | "CREDIT_PURCHASE";
  sourcePaymentId: string;
}): Promise<void> {
  const { payerUserId, paymentAmountCents, sourceType, sourcePaymentId } =
    params;

  if (paymentAmountCents <= 0) return;

  // Find active referral for this payer
  const referral = await prisma.userReferral.findUnique({
    where: { referredUserId: payerUserId },
  });

  if (!referral || referral.status !== "ACTIVE") return;

  // Check if commission period has expired
  if (referral.expiresAt && new Date() > referral.expiresAt) {
    await prisma.userReferral.update({
      where: { id: referral.id },
      data: { status: "EXPIRED" },
    });
    return;
  }

  // Idempotency: skip if already processed this payment
  const existingCommission = await prisma.referralCommission.findFirst({
    where: { sourcePaymentId },
  });
  if (existingCommission) return;

  // Calculate commission
  const commissionCents = Math.round(
    paymentAmountCents * referral.commissionRate
  );
  if (commissionCents <= 0) return;

  // Create commission, add to referrer's balance, and record earning
  await prisma.$transaction([
    prisma.referralCommission.create({
      data: {
        referralId: referral.id,
        referrerUserId: referral.referrerUserId,
        amountCents: commissionCents,
        sourcePaymentId,
        sourceType,
        status: "PAID",
        paidAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: referral.referrerUserId },
      data: { balanceCents: { increment: commissionCents } },
    }),
    prisma.earning.create({
      data: {
        userId: referral.referrerUserId,
        amountCents: commissionCents,
        source: "REFERRAL",
        sourceId: sourcePaymentId,
      },
    }),
  ]);
}

/**
 * Check and process agent-to-agent first-hire commission.
 * Called when an AgentClient is created (agent gets hired).
 * If this agent was referred by another agent and this is their first client,
 * award 50% one-time commission on the first month's payment.
 */
export async function checkAgentFirstHireCommission(params: {
  agentUserId: string;
  firstMonthPriceCents: number;
}): Promise<void> {
  const { agentUserId, firstMonthPriceCents } = params;

  if (firstMonthPriceCents <= 0) return;

  // Find if this agent was referred
  const referral = await prisma.userReferral.findUnique({
    where: { referredUserId: agentUserId },
  });

  if (!referral || referral.status === "CANCELLED") return;

  // Verify referrer is also an approved agent
  const referrer = await prisma.user.findUnique({
    where: { id: referral.referrerUserId },
    select: { agentProfile: { select: { id: true, status: true } } },
  });
  if (!referrer?.agentProfile || referrer.agentProfile.status !== "APPROVED")
    return;

  // Check if this is the agent's first client (count should be 1)
  const clientCount = await prisma.agentClient.count({
    where: {
      agentProfile: { userId: agentUserId },
      status: { in: ["ACTIVE", "PAUSED"] },
    },
  });

  if (clientCount !== 1) return;

  // Idempotency: check if already awarded
  const existingCommission = await prisma.referralCommission.findFirst({
    where: {
      referralId: referral.id,
      sourceType: "AGENT_HIRE",
    },
  });
  if (existingCommission) return;

  // Award 50% one-time commission
  const commissionCents = Math.round(firstMonthPriceCents * 0.5);

  await prisma.$transaction([
    // Upgrade referral type to AGENT_TO_AGENT
    prisma.userReferral.update({
      where: { id: referral.id },
      data: {
        referralType: "AGENT_TO_AGENT",
        commissionRate: 0.5,
        commissionType: "ONE_TIME",
      },
    }),
    prisma.referralCommission.create({
      data: {
        referralId: referral.id,
        referrerUserId: referral.referrerUserId,
        amountCents: commissionCents,
        sourceType: "AGENT_HIRE",
        status: "PAID",
        paidAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: referral.referrerUserId },
      data: { balanceCents: { increment: commissionCents } },
    }),
    prisma.earning.create({
      data: {
        userId: referral.referrerUserId,
        amountCents: commissionCents,
        source: "REFERRAL",
        sourceId: `agent_hire_${agentUserId}`,
      },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Dashboard Queries
// ---------------------------------------------------------------------------

/**
 * Get referral stats for a user's dashboard.
 */
export async function getMyReferralStats(userId: string) {
  const [totalReferrals, activeReferrals, totalEarned, pendingCommissions] =
    await Promise.all([
      prisma.userReferral.count({
        where: { referrerUserId: userId },
      }),
      prisma.userReferral.count({
        where: { referrerUserId: userId, status: "ACTIVE" },
      }),
      prisma.referralCommission.aggregate({
        where: { referrerUserId: userId, status: "PAID" },
        _sum: { amountCents: true },
      }),
      prisma.referralCommission.aggregate({
        where: { referrerUserId: userId, status: "PENDING" },
        _sum: { amountCents: true },
      }),
    ]);

  return {
    totalReferrals,
    activeReferrals,
    totalEarnedCents: totalEarned._sum.amountCents || 0,
    pendingCommissionsCents: pendingCommissions._sum.amountCents || 0,
  };
}

/**
 * Get paginated list of a user's referrals.
 */
export async function getMyReferrals(
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  const [referrals, total] = await Promise.all([
    prisma.userReferral.findMany({
      where: { referrerUserId: userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        referred: {
          select: { name: true, email: true, avatarUrl: true },
        },
        commissions: {
          where: { status: "PAID" },
          select: { amountCents: true },
        },
      },
    }),
    prisma.userReferral.count({
      where: { referrerUserId: userId },
    }),
  ]);

  return {
    referrals: referrals.map((r) => ({
      id: r.id,
      referredName: r.referred.name,
      referredEmail: r.referred.email,
      referredAvatar: r.referred.avatarUrl,
      referralType: r.referralType,
      status: r.status,
      commissionRate: r.commissionRate,
      commissionType: r.commissionType,
      expiresAt: r.expiresAt?.toISOString() || null,
      totalEarnedCents: r.commissions.reduce(
        (sum, c) => sum + c.amountCents,
        0
      ),
      createdAt: r.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get paginated commission history for a user.
 */
export async function getMyCommissions(
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  const [commissions, total] = await Promise.all([
    prisma.referralCommission.findMany({
      where: { referrerUserId: userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        referral: {
          include: {
            referred: { select: { name: true } },
          },
        },
      },
    }),
    prisma.referralCommission.count({
      where: { referrerUserId: userId },
    }),
  ]);

  return {
    commissions: commissions.map((c) => ({
      id: c.id,
      amountCents: c.amountCents,
      sourceType: c.sourceType,
      status: c.status,
      referredName: c.referral.referred.name,
      paidAt: c.paidAt?.toISOString() || null,
      createdAt: c.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// Admin Queries
// ---------------------------------------------------------------------------

/**
 * Get platform-wide referral stats for admin dashboard.
 */
export async function getAdminReferralStats() {
  const [
    totalReferrals,
    activeReferrals,
    totalPaid,
    totalPending,
    topReferrers,
  ] = await Promise.all([
    prisma.userReferral.count(),
    prisma.userReferral.count({ where: { status: "ACTIVE" } }),
    prisma.referralCommission.aggregate({
      where: { status: "PAID" },
      _sum: { amountCents: true },
    }),
    prisma.referralCommission.aggregate({
      where: { status: "PENDING" },
      _sum: { amountCents: true },
    }),
    prisma.referralCommission.groupBy({
      by: ["referrerUserId"],
      where: { status: "PAID" },
      _sum: { amountCents: true },
      _count: { id: true },
      orderBy: { _sum: { amountCents: "desc" } },
      take: 10,
    }),
  ]);

  // Fetch top referrer user details
  const topReferrerIds = topReferrers.map((t) => t.referrerUserId);
  const topReferrerUsers = await prisma.user.findMany({
    where: { id: { in: topReferrerIds } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });

  const userMap = new Map(topReferrerUsers.map((u) => [u.id, u]));

  return {
    totalReferrals,
    activeReferrals,
    totalPaidCents: totalPaid._sum.amountCents || 0,
    totalPendingCents: totalPending._sum.amountCents || 0,
    topReferrers: topReferrers.map((t) => {
      const user = userMap.get(t.referrerUserId);
      return {
        userId: t.referrerUserId,
        name: user?.name || "Unknown",
        email: user?.email || "",
        avatarUrl: user?.avatarUrl || null,
        totalEarnedCents: t._sum.amountCents || 0,
        referralCount: t._count.id,
      };
    }),
  };
}

/**
 * Get all referrals for admin with filtering and pagination.
 */
export async function getAdminReferrals(params: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
}) {
  const { page = 1, limit = 20, status, type } = params;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.referralType = type;

  const [referrals, total] = await Promise.all([
    prisma.userReferral.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        referrer: { select: { name: true, email: true } },
        referred: { select: { name: true, email: true } },
        commissions: {
          where: { status: "PAID" },
          select: { amountCents: true },
        },
      },
    }),
    prisma.userReferral.count({ where }),
  ]);

  return {
    referrals: referrals.map((r) => ({
      id: r.id,
      referrerName: r.referrer.name,
      referrerEmail: r.referrer.email,
      referredName: r.referred.name,
      referredEmail: r.referred.email,
      referralType: r.referralType,
      status: r.status,
      commissionRate: r.commissionRate,
      commissionType: r.commissionType,
      expiresAt: r.expiresAt?.toISOString() || null,
      totalEarnedCents: r.commissions.reduce(
        (sum, c) => sum + c.amountCents,
        0
      ),
      createdAt: r.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/**
 * Get all commissions for admin with pagination.
 */
export async function getAdminCommissions(params: {
  page?: number;
  limit?: number;
}) {
  const { page = 1, limit = 20 } = params;

  const [commissions, total] = await Promise.all([
    prisma.referralCommission.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        referrer: { select: { name: true, email: true } },
        referral: {
          include: { referred: { select: { name: true } } },
        },
      },
    }),
    prisma.referralCommission.count(),
  ]);

  return {
    commissions: commissions.map((c) => ({
      id: c.id,
      referrerName: c.referrer.name,
      referrerEmail: c.referrer.email,
      referredName: c.referral.referred.name,
      amountCents: c.amountCents,
      sourceType: c.sourceType,
      status: c.status,
      paidAt: c.paidAt?.toISOString() || null,
      createdAt: c.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
