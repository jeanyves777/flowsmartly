import { prisma } from "@/lib/db/client";

/**
 * Store-coupon logic in one place — the coupons API, the public validate
 * endpoint, and the checkout route all call these so a code is applied
 * identically everywhere. Store-scoped (StoreCoupon), distinct from the
 * marketing `Coupon` model which is never wired to checkout.
 */

export interface CouponRow {
  id: string; code: string; type: string; value: number;
  minOrderCents: number | null; usageLimit: number | null; usageCount: number;
  isActive: boolean; expiresAt: Date | null;
}

/** Discount in cents for a coupon against a subtotal (never exceeds the subtotal). */
export function computeDiscountCents(coupon: CouponRow, subtotalCents: number, shippingCents = 0): number {
  if (coupon.type === "percentage") return Math.min(subtotalCents, Math.round(subtotalCents * (Math.max(0, Math.min(100, coupon.value)) / 100)));
  if (coupon.type === "fixed") return Math.min(subtotalCents, Math.max(0, coupon.value));
  if (coupon.type === "free_shipping") return Math.max(0, shippingCents);
  return 0;
}

/** Human-readable reason a coupon can't be used, or null if it's valid. */
export function couponError(coupon: CouponRow | null, subtotalCents: number, now = new Date()): string | null {
  if (!coupon) return "That code isn't valid.";
  if (!coupon.isActive) return "That code is no longer active.";
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime()) return "That code has expired.";
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) return "That code has reached its usage limit.";
  if (coupon.minOrderCents != null && subtotalCents < coupon.minOrderCents) return `This code needs a minimum order of ${(coupon.minOrderCents / 100).toFixed(2)}.`;
  return null;
}

/** Look up + validate a store coupon; returns the discount or an error message. */
export async function applyCoupon(storeId: string, code: string, subtotalCents: number, shippingCents = 0): Promise<{ coupon: CouponRow; discountCents: number } | { error: string }> {
  const norm = (code || "").trim().toUpperCase();
  if (!norm) return { error: "Enter a code." };
  const coupon = await prisma.storeCoupon.findUnique({ where: { storeId_code: { storeId, code: norm } } }).catch(() => null);
  const err = couponError(coupon as CouponRow | null, subtotalCents);
  if (err || !coupon) return { error: err || "That code isn't valid." };
  return { coupon: coupon as CouponRow, discountCents: computeDiscountCents(coupon as CouponRow, subtotalCents, shippingCents) };
}
