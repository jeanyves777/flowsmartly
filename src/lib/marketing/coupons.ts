/**
 * Coupon Code Generation & Management
 * Generates unique coupon codes per contact/campaign
 */

import { prisma } from "@/lib/db/client";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Code Generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique coupon code.
 * Format: PREFIX-XXXXXX (e.g., SAVE-A3F9K2)
 */
export function generateCode(prefix: string = "SAVE"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No O/0/I/1 for readability
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `${prefix.toUpperCase()}-${code}`;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a coupon for a specific contact (optionally linked to a campaign).
 * Returns the unique coupon code.
 */
export async function createCoupon(params: {
  userId: string;
  contactId?: string;
  campaignId?: string;
  discount: string;
  prefix?: string;
  expiresAt?: Date;
}): Promise<string> {
  const code = generateCode(params.prefix);

  await prisma.coupon.create({
    data: {
      userId: params.userId,
      contactId: params.contactId,
      campaignId: params.campaignId,
      code,
      discount: params.discount,
      expiresAt: params.expiresAt,
    },
  });

  return code;
}

/**
 * Generate coupon codes in bulk for a list of contacts.
 */
export async function createBulkCoupons(params: {
  userId: string;
  contactIds: string[];
  campaignId?: string;
  discount: string;
  prefix?: string;
  expiresAt?: Date;
}): Promise<Map<string, string>> {
  const codeMap = new Map<string, string>();

  const data = params.contactIds.map((contactId) => {
    const code = generateCode(params.prefix);
    codeMap.set(contactId, code);
    return {
      userId: params.userId,
      contactId,
      campaignId: params.campaignId,
      code,
      discount: params.discount,
      expiresAt: params.expiresAt,
    };
  });

  await prisma.coupon.createMany({ data });

  return codeMap;
}

/**
 * Look up and redeem a coupon code.
 * Returns the coupon if valid, null if invalid/expired/already redeemed.
 */
export async function redeemCoupon(code: string): Promise<{
  valid: boolean;
  discount?: string;
  error?: string;
}> {
  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon) {
    return { valid: false, error: "Invalid coupon code" };
  }

  if (coupon.redeemedAt) {
    return { valid: false, error: "Coupon already redeemed" };
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { valid: false, error: "Coupon has expired" };
  }

  await prisma.coupon.update({
    where: { id: coupon.id },
    data: { redeemedAt: new Date() },
  });

  return { valid: true, discount: coupon.discount };
}

/**
 * Get a contact's active coupon for a campaign (if any).
 */
export async function getContactCoupon(
  contactId: string,
  campaignId?: string
): Promise<string | null> {
  const coupon = await prisma.coupon.findFirst({
    where: {
      contactId,
      campaignId: campaignId || undefined,
      redeemedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });

  return coupon?.code ?? null;
}
