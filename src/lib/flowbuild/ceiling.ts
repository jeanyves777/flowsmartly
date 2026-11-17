/**
 * The managed ceiling, in the two units it has to be true in at once.
 *
 * FlowBuild accounts in PICODOLLARS because a provider's per-call cost is smaller than a
 * cent and rounding it per call loses real money. FlowSmartly's balance is whole
 * CREDITS. The reservation has to be sized in credits and the ceiling has to be shipped
 * to FlowBuild as a dollar figure, and those two numbers must never disagree about what
 * was authorised.
 *
 * The canonical rate is 1 credit = $0.01, decided 2026-09-01 on production evidence; a
 * same-day $0.05 ruling was REVERSED. `CREDIT_PICO_USD` is the only place it is spelled
 * in this module tree.
 *
 * ## Rounding is UP, always, and in one direction on purpose
 *
 * `creditsForCeilingPicoUsd` rounds up: reserving fewer credits than the ceiling
 * authorises is a run that can spend more than it reserved, which is the loss this whole
 * mechanism exists to bound. Rounding up over-reserves by at most one credit ($0.01) and
 * the unused remainder is released at completion — so the direction that costs a user a
 * cent for the length of a run is preferred over the one that costs FlowSmartly an
 * unbounded amount.
 */

/** 1 credit = $0.01 = 10^10 picodollars. */
export const CREDIT_PICO_USD = 10_000_000_000n;

/** Picodollars per whole US dollar. */
export const PICO_USD_PER_USD = 1_000_000_000_000n;

/**
 * The ceiling as exact picodollars, from a dollar figure a caller wrote down.
 *
 * Parsed from a STRING, not multiplied out of a float: `0.35 * 1e12` is not
 * 350_000_000_000 in IEEE-754, and a ceiling one picodollar under the number somebody
 * typed is a ceiling two systems will disagree about at exactly the boundary where the
 * disagreement matters.
 */
export function ceilingPicoUsdFromDecimalString(usd: string): bigint {
  const match = /^([0-9]+)(?:[.]([0-9]{1,12}))?$/u.exec(usd.trim());
  if (match === null) {
    throw new RangeError(
      'a managed ceiling must be a non-negative decimal with at most 12 fractional digits; ' +
        'received "' +
        usd +
        '". It is parsed rather than multiplied because a float multiplication lands one ' +
        'picodollar off the number somebody typed.',
    );
  }
  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? '').padEnd(12, '0');
  return whole * PICO_USD_PER_USD + BigInt(fraction);
}

/** The picodollar ceiling rendered as the decimal dollar string FlowBuild is sent. */
export function decimalStringFromPicoUsd(pico: bigint): string {
  if (pico < 0n) {
    throw new RangeError('a managed ceiling cannot be negative; received ' + pico.toString());
  }
  const whole = pico / PICO_USD_PER_USD;
  const fraction = (pico % PICO_USD_PER_USD).toString().padStart(12, '0').replace(/0+$/u, '');
  return fraction === '' ? whole.toString() : whole.toString() + '.' + fraction;
}

/** Whole credits that cover `pico`, rounding UP. Never returns a negative. */
export function creditsForCeilingPicoUsd(pico: bigint): number {
  if (pico < 0n) {
    throw new RangeError('a managed ceiling cannot be negative; received ' + pico.toString());
  }
  const credits = (pico + CREDIT_PICO_USD - 1n) / CREDIT_PICO_USD;
  if (credits > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      'the managed ceiling exceeds what an Int column can hold (' +
        credits.toString() +
        ' credits). Refused rather than truncated: a truncated ceiling authorises less ' +
        'than the run was told it had.',
    );
  }
  return Number(credits);
}

/** The picodollar value of a whole number of credits. Exact, no float. */
export const picoUsdForCredits = (credits: number): bigint => BigInt(credits) * CREDIT_PICO_USD;

/**
 * Credits a charge consumes, rounding UP.
 *
 * Same direction and the same reason as the ceiling: a charge that rounded DOWN would
 * let a run of many sub-cent calls settle for less than it spent, and the difference is
 * FlowSmartly's money. A zero charge stays zero — a call that cost nothing consumes
 * nothing, and rounding it up to one credit would invent a debit.
 */
export function creditsForChargePicoUsd(pico: bigint): number {
  if (pico < 0n) {
    throw new RangeError('a managed charge cannot be negative; received ' + pico.toString());
  }
  if (pico === 0n) return 0;
  return creditsForCeilingPicoUsd(pico);
}
