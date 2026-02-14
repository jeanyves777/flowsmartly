/**
 * Referral Link Generation & Tracking
 * Creates unique referral codes/links per contact
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
function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `REF-${code}`;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Get or create a referral code for a contact.
 * Returns the referral code (reuses existing if already created).
 */
export async function getOrCreateReferralCode(
  userId: string,
  contactId: string
): Promise<string> {
  // Check for existing active referral
  const existing = await prisma.referral.findFirst({
    where: {
      userId,
      referrerId: contactId,
      status: "PENDING",
    },
  });

  if (existing) {
    return existing.code;
  }

  // Create new referral
  const code = generateReferralCode();
  await prisma.referral.create({
    data: {
      userId,
      referrerId: contactId,
      code,
      status: "PENDING",
    },
  });

  return code;
}

/**
 * Build a full referral link from a code.
 * Uses the app's base URL.
 */
export function buildReferralLink(code: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || "https://app.flowsmartly.com";
  return `${base}/ref/${code}`;
}

/**
 * Get a referral link for a contact (creates if needed).
 */
export async function getReferralLink(
  userId: string,
  contactId: string,
  baseUrl?: string
): Promise<string> {
  const code = await getOrCreateReferralCode(userId, contactId);
  return buildReferralLink(code, baseUrl);
}

/**
 * Process a referral signup — mark as completed.
 */
export async function completeReferral(
  code: string,
  referredContactId: string
): Promise<boolean> {
  const referral = await prisma.referral.findUnique({ where: { code } });

  if (!referral || referral.status !== "PENDING") {
    return false;
  }

  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      referredId: referredContactId,
      status: "COMPLETED",
    },
  });

  return true;
}

/**
 * Get referral stats for a contact.
 */
export async function getReferralStats(contactId: string): Promise<{
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
}> {
  const referrals = await prisma.referral.findMany({
    where: { referrerId: contactId },
  });

  return {
    totalReferrals: referrals.length,
    completedReferrals: referrals.filter((r: { status: string }) => r.status === "COMPLETED" || r.status === "REWARDED").length,
    pendingReferrals: referrals.filter((r: { status: string }) => r.status === "PENDING").length,
  };
}
