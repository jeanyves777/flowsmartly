/**
 * The compensation sweep: nothing strands credits for ever.
 *
 * Three obligations, in the order they matter:
 *
 * 1. **Expire.** An OPEN reservation past `expiresAt` against which nothing has settled
 *    is released. This is what stops a submission that never succeeded — or never
 *    returned at all — from holding a user's credits indefinitely.
 * 2. **Compensate a failed submission.** `submissionState = 'FAILED'` with no settlement
 *    is released immediately rather than after the TTL: the failure is already known,
 *    and making a user wait two hours for credits a network error took is a policy
 *    nobody chose.
 * 3. **Report, never silently repair.** The invariants the database cannot express as
 *    CHECK constraints under SQLite are ASSERTED here and reported. A sweep that
 *    quietly rewrote a reservation whose settlements did not add up would destroy the
 *    evidence that something upstream is wrong.
 *
 * Every release goes through `releaseReservation`, whose conditional close is the claim,
 * so the sweep is replay-safe and idempotent by construction: running it twice, or
 * running two of it at once, releases each reservation exactly once.
 */

import type { PrismaClient } from '@prisma/client';

import { releaseReservation, type ReleaseReason } from './settle';

export interface SweepReport {
  readonly examined: number;
  readonly released: number;
  readonly creditsReturned: number;
  readonly skipped: number;
  /** R3/R4 violations found. Reported, never repaired. */
  readonly discrepancies: readonly string[];
}

export interface SweepOptions {
  readonly now?: Date;
  /** A bound so one pass cannot become an unbounded transaction storm. */
  readonly limit?: number;
}

/**
 * Release every reservation that is owed a release.
 *
 * A reservation with settlements against it is NOT expired here even when it is past its
 * TTL: its run is spending, and releasing the remainder underneath a run in flight is
 * the exact "spent out from under a run" failure the reservation exists to prevent. Such
 * a reservation is closed by settlement completion instead, and a stuck one shows up in
 * `discrepancies` rather than being guessed at.
 */
export async function sweepReservations(
  prisma: PrismaClient,
  options: SweepOptions = {},
): Promise<SweepReport> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 200;

  const candidates = await prisma.creditReservation.findMany({
    where: {
      state: 'OPEN',
      settledCredits: 0,
      OR: [{ submissionState: 'FAILED' }, { expiresAt: { lt: now } }],
    },
    select: {
      id: true,
      submissionState: true,
      expiresAt: true,
      reservedCredits: true,
      settledCredits: true,
      releasedCredits: true,
      _count: { select: { settlements: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let released = 0;
  let creditsReturned = 0;
  let skipped = 0;
  const discrepancies: string[] = [];

  for (const candidate of candidates) {
    // A row whose `settledCredits` is 0 but which HAS settlement rows is R3-inconsistent.
    // Reported and skipped: releasing it would hand back credits a settlement already
    // spent, and repairing it here would erase the evidence.
    if (candidate._count.settlements > 0) {
      discrepancies.push(
        'reservation ' +
          candidate.id +
          ' reports settledCredits=0 with ' +
          candidate._count.settlements +
          ' settlement rows (R3)',
      );
      skipped += 1;
      continue;
    }
    const reason: ReleaseReason =
      candidate.submissionState === 'FAILED' ? 'SUBMISSION_FAILED' : 'EXPIRED';
    const outcome = await releaseReservation(prisma, candidate.id, reason, now);
    if (outcome.released) {
      released += 1;
      creditsReturned += outcome.releasedCredits;
    } else {
      // Another sweeper claimed it between the read and the write. That is the
      // conditional close doing its job, not a fault.
      skipped += 1;
    }
  }

  return {
    examined: candidates.length,
    released,
    creditsReturned,
    skipped,
    discrepancies: Object.freeze(discrepancies),
  };
}

/**
 * Assert R3 and R4 across every reservation, and REPORT.
 *
 * ```text
 * R3  sum(CreditSettlement.creditsCharged) == CreditReservation.settledCredits
 * R4  a reservation is CLOSED only when settled + released == reserved
 * ```
 *
 * R1 (`settled + released <= reserved`) and R2 (`aiCredits >= 0`) are enforced by the
 * WHERE clauses in `./reserve.ts` and `./settle.ts` — a violated row is one the
 * statement cannot write — so they are not re-checked here. R3 and R4 are the two no
 * single statement can enforce, which is exactly why they need a job.
 */
export async function reconcileReservations(
  prisma: PrismaClient,
  limit = 500,
): Promise<readonly string[]> {
  const reservations = await prisma.creditReservation.findMany({
    select: {
      id: true,
      state: true,
      reservedCredits: true,
      settledCredits: true,
      releasedCredits: true,
      settlements: { select: { creditsCharged: true, state: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const findings: string[] = [];
  for (const reservation of reservations) {
    // OVER_RESERVATION settlements charge MORE than the reservation could absorb by
    // definition, so R3 compares only the covered part: the shortfall is the obligation
    // and is deliberately not in `settledCredits`.
    const covered = reservation.settlements
      .filter((settlement) => settlement.state === 'SETTLED')
      .reduce((total, settlement) => total + settlement.creditsCharged, 0);
    const hasOverReservation = reservation.settlements.some(
      (settlement) => settlement.state === 'OVER_RESERVATION',
    );
    if (!hasOverReservation && covered !== reservation.settledCredits) {
      findings.push(
        'R3 reservation ' +
          reservation.id +
          ': settlements sum to ' +
          covered +
          ' and settledCredits is ' +
          reservation.settledCredits,
      );
    }
    if (
      reservation.state === 'CLOSED' &&
      reservation.settledCredits + reservation.releasedCredits !== reservation.reservedCredits
    ) {
      findings.push(
        'R4 reservation ' +
          reservation.id +
          ' is CLOSED with settled+released=' +
          (reservation.settledCredits + reservation.releasedCredits) +
          ' against reserved=' +
          reservation.reservedCredits,
      );
    }
  }
  return Object.freeze(findings);
}
