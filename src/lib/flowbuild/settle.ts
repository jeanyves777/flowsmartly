/**
 * SETTLE one managed provider call against an existing reservation, and RELEASE what a
 * finished run did not use.
 *
 * ## The idempotency handle is the FlowBuild usage-record id, and it is the primary key
 *
 * `usage:<stepId>#managed-model` — derived from the step and mentioning no attempt,
 * deliberately. It is NOT `CreditTransaction.referenceType`/`referenceId`: that pair was
 * falsified against production as 26 distinct types carrying duplicate `(type, id)` pairs
 * across ~370 groups and ~2,489 rows, with no index on either column, and no global
 * `@@unique` can be created without rewriting history. Nothing here retrofits one.
 *
 * The wire `Idempotency-Key` guards REDELIVERY at the transport; this guards BUSINESS
 * duplication. They are different guards because an outbox event id is per-append: two
 * events about one paid call carry two wire keys and one usage-record id.
 *
 * ## The ordering rule: the INSERT runs FIRST
 *
 * `INSERT ... ON CONFLICT DO NOTHING` before the reservation is touched. If it inserts no
 * row the settlement has already been applied and the reservation update must NOT run —
 * otherwise a redelivered outbox message charges the reservation twice. On conflict the
 * stored row is READ BACK and cross-checked, because a bare `DO NOTHING` turns a
 * genuinely different measurement under a reused id into a silent no-op.
 *
 * ## Over-spend never becomes negative credit
 *
 * The founder's ruling: do not silently absorb it, do not create ordinary negative
 * credit, stop further managed execution, require additional funding, and durably record
 * the incurred spend so no spend disappears. So when the charge exceeds what remains:
 * the reservation takes its whole remainder and CLOSES (that is what "stop further
 * managed execution" means at the product end), and the uncovered part is a
 * `shortfallCredits` row in state `OVER_RESERVATION`. `User.aiCredits` is not touched on
 * that path at all, so there is no statement that could drive it below zero.
 *
 * ## Every statement is conditional and its ROW COUNT is the verdict
 *
 * Raw SQL with quoted identifiers, which both PostgreSQL and SQLite accept, through
 * Prisma's tagged template so the parameter placeholder is the driver's own — `$1` under
 * PostgreSQL and `?` under SQLite are exactly the kind of difference a hand-built string
 * gets wrong in one environment only.
 */

import { Prisma, type PrismaClient } from '@prisma/client';

import {
  MANAGED_BILLING_ACCOUNT_MISMATCH,
  MANAGED_NO_OPEN_RESERVATION,
  ManagedSpendRefused,
  formatBillingAccountRef,
  type BillingAccountRef,
} from './billing-account';
import { creditsForChargePicoUsd } from './ceiling';
import { RELEASE_LEDGER_TYPE, RESERVATION_REFERENCE_TYPE } from './reserve';

export type SettlementState = 'SETTLED' | 'OVER_RESERVATION';

export type SettlementOutcome =
  | { readonly settled: true; readonly state: SettlementState; readonly creditsCharged: number; readonly shortfallCredits: number }
  | { readonly settled: false; readonly reason: 'replay'; readonly state: SettlementState };

export interface SettleRequest {
  /** `usage:<stepId>#managed-model`. THE identity of this settlement. */
  readonly usageRecordId: string;
  /** Who FlowBuild says the payer is. Compared to the reservation, never applied to it. */
  readonly billingAccount: BillingAccountRef;
  readonly flowbuildRunId: string;
  readonly flowbuildStepId: string;
  /** The authoritative charge FlowBuild computed, exact picodollars. */
  readonly chargePicoUsd: bigint;
  readonly now?: Date;
}

/** The reservation columns settlement reads. */
interface ReservationRow {
  id: string;
  userId: string;
  billingAccountKind: string;
  billingAccountId: string;
  reservedCredits: number;
  settledCredits: number;
  releasedCredits: number;
  state: string;
}

/**
 * Settle one paid call against the reservation that funds its run.
 *
 * @throws {ManagedSpendRefused} `MANAGED_NO_OPEN_RESERVATION` when no OPEN reservation
 *   matches the run. That is the state FlowBuild must be able to see: it holds an
 *   obligation the product will not accept, and swallowing it would make the spend
 *   disappear.
 * @throws {ManagedSpendRefused} `MANAGED_BILLING_ACCOUNT_MISMATCH` when the event names
 *   a different payer from the reservation. REFUSED, never reassigned: it is a message
 *   about somebody else's money, and applying it would be a cross-tenant debit.
 */
export async function settleManagedCharge(
  prisma: PrismaClient,
  request: SettleRequest,
): Promise<SettlementOutcome> {
  const charge = creditsForChargePicoUsd(request.chargePicoUsd);
  const settledAt = request.now ?? new Date();

  return await prisma.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findFirst({
      where: { flowbuildRunId: request.flowbuildRunId },
      select: {
        id: true,
        userId: true,
        billingAccountKind: true,
        billingAccountId: true,
        reservedCredits: true,
        settledCredits: true,
        releasedCredits: true,
        state: true,
      },
    });
    if (reservation === null) {
      throw new ManagedSpendRefused(
        MANAGED_NO_OPEN_RESERVATION,
        'no reservation funds FlowBuild run "' +
          request.flowbuildRunId +
          '". The spend FlowBuild reports is real and this product cannot account for ' +
          'it, so the settlement is refused loudly rather than dropped.',
        { flowbuildRunId: request.flowbuildRunId },
      );
    }
    assertSamePayer(reservation, request.billingAccount);

    // (1) THE INSERT, FIRST. A row that does not insert is a settlement that has already
    // been applied, and statement (2) must not run for it.
    const inserted = await tx.$executeRaw`
      INSERT INTO "CreditSettlement" (
        "usageRecordId", "reservationId", "userId", "creditsCharged", "chargePicoUsd",
        "state", "shortfallCredits", "flowbuildRunId", "flowbuildStepId", "settledAt")
      VALUES (${request.usageRecordId}, ${reservation.id}, ${reservation.userId},
              ${charge}, ${request.chargePicoUsd}, ${'SETTLED'}, ${0},
              ${request.flowbuildRunId}, ${request.flowbuildStepId}, ${settledAt})
      ON CONFLICT ("usageRecordId") DO NOTHING`;

    if (inserted === 0) {
      // A REPLAY. Read the stored row back and cross-check: a bare DO NOTHING turns a
      // genuinely different measurement under a reused id into a silent no-op, and a
      // silent no-op on a money path is a charge nobody will ever see again.
      const stored = await tx.creditSettlement.findUnique({
        where: { usageRecordId: request.usageRecordId },
        select: { creditsCharged: true, chargePicoUsd: true, state: true },
      });
      if (stored !== null && stored.chargePicoUsd !== request.chargePicoUsd) {
        throw new ManagedSpendRefused(
          MANAGED_NO_OPEN_RESERVATION,
          'usage record "' +
            request.usageRecordId +
            '" is already settled at ' +
            stored.chargePicoUsd.toString() +
            ' picodollars and this delivery reports ' +
            request.chargePicoUsd.toString() +
            '. Two different measurements under one id is a duplicate id, not a replay.',
          { usageRecordId: request.usageRecordId },
        );
      }
      return {
        settled: false,
        reason: 'replay',
        state: (stored?.state as SettlementState | undefined) ?? 'SETTLED',
      };
    }

    // (2) TAKE THE CHARGE FROM THE RESERVATION, and never more than remains. The whole
    // settlement decision is in this WHERE clause; the row count is the answer.
    const covered = await tx.$executeRaw`
      UPDATE "CreditReservation"
         SET "settledCredits" = "settledCredits" + ${charge},
             "updatedAt" = ${settledAt}
       WHERE "id" = ${reservation.id}
         AND "state" = 'OPEN'
         AND "reservedCredits" - "settledCredits" - "releasedCredits" >= ${charge}`;

    if (covered === 1) {
      // The credits left `User.aiCredits` at reserve time, so a covered settlement
      // touches no balance at all. That is what makes double settlement harmless in the
      // balance and detectable in the ledger.
      return { settled: true, state: 'SETTLED', creditsCharged: charge, shortfallCredits: 0 };
    }

    if (reservation.state !== 'OPEN') {
      throw new ManagedSpendRefused(
        MANAGED_NO_OPEN_RESERVATION,
        'reservation "' +
          reservation.id +
          '" is ' +
          reservation.state +
          ' and cannot absorb a further charge. FlowBuild holds an obligation this ' +
          'product will not accept, and it must be able to see that.',
        { reservationId: reservation.id, state: reservation.state },
      );
    }

    // OVER-RESERVATION. Take everything that remains and no more, close the reservation,
    // and record the uncovered part as an obligation. No balance statement runs.
    const remainder = reservation.reservedCredits - reservation.settledCredits - reservation.releasedCredits;
    const shortfall = charge - remainder;
    await tx.$executeRaw`
      UPDATE "CreditReservation"
         SET "settledCredits" = "reservedCredits" - "releasedCredits",
             "state" = 'CLOSED',
             "closedReason" = ${'OVER_RESERVATION'},
             "updatedAt" = ${settledAt}
       WHERE "id" = ${reservation.id} AND "state" = 'OPEN'`;
    await tx.$executeRaw`
      UPDATE "CreditSettlement"
         SET "state" = ${'OVER_RESERVATION'}, "shortfallCredits" = ${shortfall}
       WHERE "usageRecordId" = ${request.usageRecordId}`;

    return {
      settled: true,
      state: 'OVER_RESERVATION',
      creditsCharged: charge,
      shortfallCredits: shortfall,
    };
  });
}

function assertSamePayer(reservation: ReservationRow, account: BillingAccountRef): void {
  if (
    reservation.billingAccountKind === account.kind &&
    reservation.billingAccountId === account.id
  ) {
    return;
  }
  throw new ManagedSpendRefused(
    MANAGED_BILLING_ACCOUNT_MISMATCH,
    'the settlement names billing account ' +
      formatBillingAccountRef(account) +
      ' and the reservation belongs to ' +
      reservation.billingAccountKind +
      ':' +
      reservation.billingAccountId +
      '. It is refused rather than reassigned: it is a message about somebody else' +
      "'s money.",
    {
      reservationId: reservation.id,
      reservationAccount: reservation.billingAccountKind + ':' + reservation.billingAccountId,
      eventAccount: formatBillingAccountRef(account),
    },
  );
}

export type ReleaseReason = 'SETTLED_COMPLETE' | 'EXPIRED' | 'SUBMISSION_FAILED';

export interface ReleaseOutcome {
  readonly released: boolean;
  readonly releasedCredits: number;
  readonly balanceAfter: number | null;
}

/**
 * Hand the unused remainder of a reservation back to the spendable balance, EXACTLY ONCE.
 *
 * The close is the claim. Two concurrent releasers issue the same conditional UPDATE and
 * exactly one sees a row count of 1; the other sees 0 and adds nothing. The balance
 * increment then runs only for the claimant, so "exactly once" is a property of the
 * statement rather than of the caller's care.
 */
export async function releaseReservation(
  prisma: PrismaClient,
  reservationId: string,
  reason: ReleaseReason,
  now: Date = new Date(),
): Promise<ReleaseOutcome> {
  return await prisma.$transaction(async (tx) => {
    // THE CLAIM. `releasedCredits` is computed from the row's own columns, which is why
    // this is raw SQL: an ORM update cannot say "this column minus that one" and a
    // read-then-write would reintroduce the race the whole design removes.
    const claimed = await tx.$executeRaw`
      UPDATE "CreditReservation"
         SET "releasedCredits" = "reservedCredits" - "settledCredits",
             "state" = 'CLOSED',
             "closedReason" = ${reason},
             "updatedAt" = ${now}
       WHERE "id" = ${reservationId} AND "state" = 'OPEN'`;
    if (claimed !== 1) {
      return { released: false, releasedCredits: 0, balanceAfter: null };
    }

    const row = await tx.creditReservation.findUnique({
      where: { id: reservationId },
      select: { userId: true, releasedCredits: true },
    });
    const releasedCredits = row?.releasedCredits ?? 0;
    if (row === null || releasedCredits <= 0) {
      return { released: true, releasedCredits: 0, balanceAfter: null };
    }

    const user = await tx.user.update({
      where: { id: row.userId },
      data: { aiCredits: { increment: releasedCredits } },
      select: { aiCredits: true },
    });
    await tx.creditTransaction.create({
      data: {
        userId: row.userId,
        type: RELEASE_LEDGER_TYPE,
        amount: releasedCredits,
        balanceAfter: user.aiCredits,
        description: 'Released from FlowBuild reservation ' + reservationId + ' (' + reason + ')',
        referenceType: RESERVATION_REFERENCE_TYPE,
        referenceId: reservationId,
      },
    });
    return { released: true, releasedCredits, balanceAfter: user.aiCredits };
  });
}

/** Re-exported so a caller can narrow a raw-SQL fault without importing Prisma itself. */
export const isPrismaKnownError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;
