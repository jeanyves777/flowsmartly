/**
 * RESERVE, and create the funded task, in ONE product transaction.
 *
 * ```text
 * Browser -> FlowAgent
 *              |
 *              |  ONE product transaction:
 *              |    resolve the billing binding      (unbound -> refuse, no debit)
 *              |    reserve `ceiling` credits        (atomic conditional UPDATE)
 *              |    create the AgentTask row
 *              |    create the CreditReservation row
 *              |    write the ledger entry
 *              |  COMMIT
 *              |
 *              +--> (outside the transaction, ./submit.ts) submit to FlowBuild
 * ```
 *
 * ## The reserve is a conditional UPDATE whose ROW COUNT is the verdict
 *
 * It is deliberately NOT the `findUnique -> compare -> { decrement }` shape that
 * `src/lib/credits/index.ts` uses. That shape was MEASURED against real PostgreSQL under
 * two genuinely concurrent sessions: both callers pass the comparison, both update, and
 * the balance goes to -50 from a starting 150 against two claimants of 100. The two
 * spellings differ only in whether the guard is in the `WHERE`, and the difference is
 * 50 versus -50 — the exact ordinary negative credit the founder's ruling forbids.
 *
 * The other 66 `deductCredits` writers are untouched and need no lock: the reserved
 * amount has LEFT `User.aiCredits`, and credits that are not in the spendable balance
 * cannot be spent by anything that spends the spendable balance. The broader
 * `deductCredits` race stays PRODUCT_BACKLOG; this path simply does not inherit it.
 *
 * ## The FlowBuild submission is OUTSIDE this transaction
 *
 * A transaction held across a network call is a transaction whose duration is somebody
 * else's server, and under SQLite in development it would hold the database-wide write
 * lock for that span. The consequence is accepted deliberately: a reservation can
 * outlive a failed submission, so it carries `submissionState` and `expiresAt` and
 * `./sweep.ts` releases it. A durable, compensatable reservation is the price of not
 * holding a lock across the network, and it is the cheaper of the two.
 */

import type { Prisma, PrismaClient } from '@prisma/client';

import {
  MANAGED_BILLING_ACCOUNT_UNBOUND,
  MANAGED_INSUFFICIENT_CREDITS,
  ManagedSpendRefused,
  formatBillingAccountRef,
  resolvePayerUserId,
  type BillingAccountRef,
} from './billing-account';
import { creditsForCeilingPicoUsd } from './ceiling';
import type { FlowbuildTenancy } from './tenancy';

/** A transaction handle or the client itself; every statement below works on either. */
export type PrismaTransactional = PrismaClient | Prisma.TransactionClient;

/**
 * How long a reservation may hold credits with nothing having happened to it.
 *
 * Two hours is longer than any submission and far shorter than "for ever". The sweep is
 * what enforces it; this constant is only the default a caller may override.
 */
export const DEFAULT_RESERVATION_TTL_MS = 2 * 60 * 60 * 1000;

/** The ledger `type` a reservation writes. `CreditTransaction.type` is a free-form String. */
export const RESERVATION_LEDGER_TYPE = 'RESERVATION';
/** The ledger `type` a release writes when credits come back to the spendable balance. */
export const RELEASE_LEDGER_TYPE = 'RESERVATION_RELEASE';
/** A label, never an idempotency handle — see `CreditSettlement.usageRecordId`. */
export const RESERVATION_REFERENCE_TYPE = 'flowbuild_reservation';

export interface FundRunRequest {
  /** WHO PAYS. Polymorphic; `user` is the only kind that resolves to a balance today. */
  readonly billingAccount: BillingAccountRef;
  /** The approved managed ceiling, exact picodollars. Sizes the reservation. */
  readonly ceilingPicoUsd: bigint;
  /** `AgentTask.kind`. Free-form, so a new task kind needs no migration. */
  readonly kind: string;
  /** The tool input, already JSON-encoded by the caller. */
  readonly input: string;
  /** The caller's idempotency key. A retry MUST reuse it; see the unique column. */
  readonly idempotencyKey: string;
  readonly conversationId?: string | null;
  readonly messageId?: string | null;
  readonly reservationTtlMs?: number;
  /** Injected so a proof can pin the instant rather than race the clock. */
  readonly now?: Date;
}

export interface FundedRun {
  readonly taskId: string;
  readonly reservationId: string;
  readonly userId: string;
  readonly reservedCredits: number;
  readonly balanceAfter: number;
  readonly ceilingPicoUsd: bigint;
  readonly tenancy: FlowbuildTenancy;
  /** `true` when this call reserved; `false` when the idempotency key had already. */
  readonly reserved: boolean;
}

/** The binding row, as the columns this module reads. */
interface BindingRow {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly principalId: string;
}

const tenancyOf = (row: BindingRow): FlowbuildTenancy =>
  Object.freeze({
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    principalId: row.principalId,
  });

/**
 * Reserve the ceiling and create the funded task, atomically.
 *
 * @throws {ManagedSpendRefused} `MANAGED_BILLING_ACCOUNT_UNBOUND` when the payer has no
 *   FlowBuild tenancy bound. Refused BEFORE the decrement, so an unbound account is
 *   never debited and no provider call is ever reachable.
 * @throws {ManagedSpendRefused} `MANAGED_INSUFFICIENT_CREDITS` when the conditional
 *   UPDATE matched no row. The balance is untouched and stays non-negative.
 */
export async function reserveAndCreateFundedTask(
  prisma: PrismaClient,
  request: FundRunRequest,
): Promise<FundedRun> {
  const userId = resolvePayerUserId(request.billingAccount);
  const reservedCredits = creditsForCeilingPicoUsd(request.ceilingPicoUsd);
  const now = request.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (request.reservationTtlMs ?? DEFAULT_RESERVATION_TTL_MS));

  try {
    return await prisma.$transaction(async (tx) => {
      // THE BINDING, first, and inside the transaction. An unbound account is refused
      // before any balance is touched: a debit for a run that can never be submitted is
      // a debit nothing will ever settle or release.
      const binding = await tx.flowbuildTenantBinding.findUnique({
        where: {
          billingAccountKind_billingAccountId: {
            billingAccountKind: request.billingAccount.kind,
            billingAccountId: request.billingAccount.id,
          },
        },
        select: { tenantId: true, workspaceId: true, projectId: true, principalId: true, state: true },
      });
      if (binding === null || binding.state !== 'BOUND') {
        throw new ManagedSpendRefused(
          MANAGED_BILLING_ACCOUNT_UNBOUND,
          'no FlowBuild tenancy is bound to ' +
            formatBillingAccountRef(request.billingAccount) +
            '. A managed run for an account with nowhere to send the bill is a run ' +
            'FlowSmartly pays for and can never invoice, so it is refused before the ' +
            'provider call rather than reported after it.',
          { billingAccount: formatBillingAccountRef(request.billingAccount) },
        );
      }

      // THE RESERVE. One conditional UPDATE; the row count is the verdict. There is no
      // third answer and there is no read that a concurrent session can invalidate
      // between the check and the write, because there is no separate check.
      const held = await tx.user.updateMany({
        where: { id: userId, aiCredits: { gte: reservedCredits } },
        data: { aiCredits: { decrement: reservedCredits } },
      });
      if (held.count !== 1) {
        throw new ManagedSpendRefused(
          MANAGED_INSUFFICIENT_CREDITS,
          'the conditional reserve matched ' +
            held.count +
            ' rows: the account does not exist, or its spendable balance is below the ' +
            reservedCredits +
            ' credits this run authorises. Nothing was decremented and the balance is ' +
            'unchanged.',
          { userId, reservedCredits, matched: held.count },
        );
      }

      // For REPORTING only. The guard has already been enforced by the conditional
      // UPDATE above, so this read is not a precondition for anything and cannot become
      // one: nothing below branches on it.
      const after = await tx.user.findUnique({ where: { id: userId }, select: { aiCredits: true } });
      const balanceAfter = after?.aiCredits ?? 0;

      const task = await tx.agentTask.create({
        data: {
          userId,
          kind: request.kind,
          status: 'pending',
          input: request.input,
          creditCost: reservedCredits,
          conversationId: request.conversationId ?? null,
          messageId: request.messageId ?? null,
        },
        select: { id: true },
      });

      const reservation = await tx.creditReservation.create({
        data: {
          userId,
          billingAccountKind: request.billingAccount.kind,
          billingAccountId: request.billingAccount.id,
          idempotencyKey: request.idempotencyKey,
          flowbuildTaskId: task.id,
          flowbuildTenantId: binding.tenantId,
          flowbuildWorkspaceId: binding.workspaceId,
          flowbuildProjectId: binding.projectId,
          reservedCredits,
          ceilingPicoUsd: request.ceilingPicoUsd,
          expiresAt,
        },
        select: { id: true },
      });

      // The ledger entry, so the balance change is visible where every other one is.
      // `referenceType`/`referenceId` are a LABEL here and are never read as a key: the
      // pair was falsified against production as 26 distinct types carrying duplicate
      // pairs over ~2,489 rows, and no global uniqueness is retrofitted onto it.
      await tx.creditTransaction.create({
        data: {
          userId,
          type: RESERVATION_LEDGER_TYPE,
          amount: -reservedCredits,
          balanceAfter,
          description: 'Reserved for FlowBuild task ' + task.id,
          referenceType: RESERVATION_REFERENCE_TYPE,
          referenceId: reservation.id,
        },
      });

      return {
        taskId: task.id,
        reservationId: reservation.id,
        userId,
        reservedCredits,
        balanceAfter,
        ceilingPicoUsd: request.ceilingPicoUsd,
        tenancy: tenancyOf(binding),
        reserved: true,
      };
    });
  } catch (error: unknown) {
    // A retry that reused its idempotency key loses on the UNIQUE CONSTRAINT, not on a
    // read. That is the whole reason the column is unique: two concurrent retries both
    // find nothing with a `findFirst` and both reserve, and the constraint is the only
    // arbiter that cannot be interleaved.
    if (isUniqueViolationOn(error, 'idempotencyKey')) {
      return await readExistingFundedRun(prisma, request.idempotencyKey);
    }
    throw error;
  }
}

/**
 * The funded run an earlier call with this idempotency key produced.
 *
 * Exported so `./submit.ts` can resume a submission for a reservation that was created
 * and never submitted — the same read, reached from the other direction.
 */
export async function readExistingFundedRun(
  prisma: PrismaTransactional,
  idempotencyKey: string,
): Promise<FundedRun> {
  const existing = await prisma.creditReservation.findUnique({
    where: { idempotencyKey },
    select: {
      id: true,
      userId: true,
      reservedCredits: true,
      ceilingPicoUsd: true,
      flowbuildTaskId: true,
      flowbuildTenantId: true,
      flowbuildWorkspaceId: true,
      flowbuildProjectId: true,
      billingAccountKind: true,
      billingAccountId: true,
    },
  });
  if (existing === null) {
    // Unreachable through `reserveAndCreateFundedTask`: the unique violation this
    // recovers from is proof a row with that key exists. Checked rather than asserted,
    // because a `!` here would state a guarantee that belongs to the database.
    throw new ManagedSpendRefused(
      MANAGED_INSUFFICIENT_CREDITS,
      'a reservation with idempotency key "' +
        idempotencyKey +
        '" conflicted on INSERT and is not readable. The constraint and the read ' +
        'disagree, which is a database fault and not a caller error.',
      { idempotencyKey },
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: existing.userId },
    select: { aiCredits: true },
  });
  return {
    taskId: existing.flowbuildTaskId,
    reservationId: existing.id,
    userId: existing.userId,
    reservedCredits: existing.reservedCredits,
    balanceAfter: user?.aiCredits ?? 0,
    ceilingPicoUsd: existing.ceilingPicoUsd,
    tenancy: {
      tenantId: existing.flowbuildTenantId,
      workspaceId: existing.flowbuildWorkspaceId,
      projectId: existing.flowbuildProjectId,
      // The principal is derived rather than stored on the reservation: it is a property
      // of the account, and a stale copy on a run row would outlive a re-provisioning.
      principalId: 'fs-u-' + existing.billingAccountKind + '-' + existing.billingAccountId,
    },
    reserved: false,
  };
}

/**
 * Whether an error is a unique-constraint violation naming `column`.
 *
 * Matched on Prisma's `P2002` code and its `target`, and on the raw driver message as a
 * fallback, because `target` is an array under PostgreSQL and a string under SQLite and
 * this file has to be right under both.
 */
export function isUniqueViolationOn(error: unknown, column: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; meta?: { target?: unknown }; message?: unknown };
  if (candidate.code !== 'P2002') return false;
  const target = candidate.meta?.target;
  if (Array.isArray(target)) return target.some((entry) => String(entry).includes(column));
  if (typeof target === 'string') return target.includes(column);
  return typeof candidate.message === 'string' && candidate.message.includes(column);
}
