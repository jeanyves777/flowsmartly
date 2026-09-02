/**
 * Credit ↔ money conversion rates — the SINGLE source of truth.
 *
 * This module deliberately has ZERO imports. `costs.ts` pulls in Prisma, so a
 * client component can never import from it; every UI surface that needs a rate
 * imports from HERE instead. That is what stops a page re-declaring its own
 * local copy and silently drifting from the server — which is exactly what had
 * happened in ads/create and settings/sms-marketing/phone-number.
 *
 * If you are about to write a credit↔money literal anywhere: don't. Import one
 * of these, or add a new named rate here.
 */

/**
 * Credit REDEMPTION rate — what one credit is worth in money. 1 credit = $0.01.
 *
 * This matches the six live `CreditPackage` rows, which all sell at
 * priceCents === credits ($0.01/credit list; $0.0089–$0.0100 effective once
 * bonus grants are counted). The public Terms page publishes this figure.
 *
 * Sale price and redemption rate are the SAME $0.01 today. They are not the
 * same *concept*: if credits are ever repriced, anything charging a card *for*
 * credits must follow the package table, not this constant.
 */
export const CREDIT_TO_CENTS = 1;

/**
 * Ad-budget conversion rate — DELIBERATELY DECOUPLED from CREDIT_TO_CENTS.
 *
 * Numerically identical to CREDIT_TO_CENTS today; that is not a reason to share
 * the constant. Ad budget feeds a real cash payout (viewers withdraw 70% of CPV
 * — see calculateAdRevenueSplit), so a future change to what a credit redeems
 * for must NOT silently re-scale advertiser budgets, CPV maths, or refunds.
 *
 * Every credits→ad-budget conversion MUST use this constant.
 */
export const AD_BUDGET_CREDIT_TO_CENTS = 1;
