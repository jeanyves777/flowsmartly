/**
 * Platform Fee Calculator
 * Calculates FlowSmartly's commission on store sales
 */

export interface PlatformFeeCalculation {
  totalCents: number;
  platformFeeCents: number;
  storeOwnerAmountCents: number;
  platformFeePercent: number;
}

/**
 * Calculate platform fee for an order
 * @param totalCents - Total order amount in cents
 * @param platformFeePercent - Platform fee percentage (default 5%)
 * @returns Breakdown of fees
 */
export function calculatePlatformFee(
  totalCents: number,
  platformFeePercent: number = 5
): PlatformFeeCalculation {
  // Calculate platform fee (rounded to nearest cent)
  const platformFeeCents = Math.round((totalCents * platformFeePercent) / 100);

  // Store owner receives the remainder
  const storeOwnerAmountCents = totalCents - platformFeeCents;

  return {
    totalCents,
    platformFeeCents,
    storeOwnerAmountCents,
    platformFeePercent,
  };
}

/**
 * Example usage:
 *
 * const order = {
 *   subtotalCents: 10000,  // $100
 *   shippingCents: 500,    // $5
 *   taxCents: 800,         // $8
 * };
 *
 * const total = order.subtotalCents + order.shippingCents + order.taxCents; // $113
 * const fees = calculatePlatformFee(total, 5); // 5% platform fee
 *
 * // Result:
 * // {
 * //   totalCents: 11300,
 * //   platformFeeCents: 565,      // $5.65 (FlowSmartly's cut)
 * //   storeOwnerAmountCents: 10735, // $107.35 (store owner receives)
 * //   platformFeePercent: 5
 * // }
 */
