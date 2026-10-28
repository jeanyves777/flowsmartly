// Generated public facts from flowsmartly-v5/packages/contracts/src/billing-offers.ts.
// Source SHA256: 47a5b96d90b5d5211437f389f0641bf805ff0b7da702696fa4f06f058537e51d. Regenerate with scripts/sync-billing-offers.mjs; do not edit prices here.
/** Owner-approved offers; public facts only, never provider identifiers or existing-contract repricing.
 * Authority: docs/architecture/BILLING-PLAN-POLICY.md (2026-10-28).
 */
export const BILLING_OFFERS = Object.freeze([
  Object.freeze({
    code: 'free',
    name: 'Free (Pay as you go)',
    monthlyAmountMinor: 0,
    yearlyAmountMinor: 0,
    monthlyIncludedCredits: 0,
  }),
  Object.freeze({
    code: 'personal',
    name: 'Personal',
    monthlyAmountMinor: 2000,
    yearlyAmountMinor: 19200,
    monthlyIncludedCredits: 500,
  }),
  Object.freeze({
    code: 'business',
    name: 'Business',
    monthlyAmountMinor: 12000,
    yearlyAmountMinor: 115200,
    monthlyIncludedCredits: 1500,
  }),
] as const);
export type BillingOffer = (typeof BILLING_OFFERS)[number];
export type PaidBillingOffer = Exclude<BillingOffer, { readonly code: 'free' }>;
export type BillingInterval = 'month' | 'year';
/** Selecting an offer never changes an existing subscription or authorizes payment. */
export function paidBillingOffer(code: string): PaidBillingOffer | undefined {
  return BILLING_OFFERS.find(
    (offer): offer is PaidBillingOffer => offer.code !== 'free' && offer.code === code,
  );
}
/** Both billing intervals release the same monthly allowance through native Billing. */
export function billingOfferPrice(offer: PaidBillingOffer, interval: BillingInterval) {
  const amountMinor = interval === 'year' ? offer.yearlyAmountMinor : offer.monthlyAmountMinor;
  return Object.freeze({
    currency: 'USD' as const,
    interval,
    amountMinor,
    monthlyEquivalentMinor: interval === 'year' ? amountMinor / 12 : amountMinor,
    yearlyDiscountPercent: interval === 'year' ? 20 : 0,
    monthlyIncludedCredits: offer.monthlyIncludedCredits,
    allowanceCadence: 'month' as const,
    purchasedCreditsCarryOver: true as const,
  });
}
