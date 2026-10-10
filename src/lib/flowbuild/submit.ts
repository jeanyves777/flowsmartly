/**
 * The submission, which happens AFTER the product transaction has committed.
 *
 * ## Why the ordering is a mechanism and not a convention
 *
 * `reserveAndCreateFundedTask` returns only once its `$transaction` has resolved, which
 * for an interactive Prisma transaction means the `COMMIT` has been acknowledged by the
 * server. This module is a SEPARATE function that takes that return value as its input,
 * so there is no arrangement of the code in which the network call can be issued while
 * the transaction is open — the value it needs does not exist until the commit is done.
 * That is stronger than a comment saying "do not hold the transaction across the call".
 *
 * ## A failed submission leaves a durable, compensatable reservation
 *
 * It does NOT refund inline. An inline refund is a second money write on the failure
 * path of a network call, and a network call that failed is exactly the situation in
 * which the process may not survive to perform it. So the failure is RECORDED
 * (`submissionState = 'FAILED'`, an attempt count, a refusal code) and `./sweep.ts`
 * releases it — once, by a conditional UPDATE whose row count is the verdict.
 *
 * The same is true of a submission that never returns at all: the row stays PENDING and
 * `expiresAt` is what eventually releases it. Nothing strands credits for ever.
 */

import type { PrismaClient } from '@prisma/client';

import { isManagedSpendRefused, type BillingAccountRef } from './billing-account';
import { submitTaskCreate, type CommandTransport } from './client';
import type { FundedRun } from './reserve';

export type SubmissionState = 'PENDING' | 'SUBMITTED' | 'FAILED';

export interface SubmitFundedRunRequest {
  readonly funded: FundedRun;
  readonly subject: BillingAccountRef;
  readonly objective: string;
  readonly acceptanceCriteria: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
  readonly transport?: CommandTransport;
}

export interface SubmissionOutcome {
  readonly submitted: boolean;
  readonly runId: string | null;
  readonly code: string | null;
}

/**
 * Submit a funded run and record what happened to the reservation.
 *
 * Never throws for a submission fault: the fault is the OUTCOME, because a caller that
 * had to catch in order to leave the reservation compensatable is a caller that can
 * forget to. It still throws for a programming fault, which is not a state any
 * compensation can express.
 */
export async function submitFundedRun(
  prisma: PrismaClient,
  request: SubmitFundedRunRequest,
): Promise<SubmissionOutcome> {
  try {
    const result = await submitTaskCreate(
      {
        subject: request.subject,
        tenancy: request.funded.tenancy,
        // The product-allocated task id IS the command id, so a retry of this submission
        // is a REPLAY at FlowBuild rather than a second run.
        commandId: request.funded.taskId,
        objective: request.objective,
        acceptanceCriteria: request.acceptanceCriteria,
        ceilingPicoUsd: request.funded.ceilingPicoUsd,
      },
      { env: request.env, transport: request.transport },
    );

    await prisma.creditReservation.update({
      where: { id: request.funded.reservationId },
      data: {
        submissionState: 'SUBMITTED',
        submissionAttempts: { increment: 1 },
        submissionCode: null,
        submittedAt: new Date(),
        flowbuildRunId: result.runId,
      },
    });
    return { submitted: true, runId: result.runId, code: null };
  } catch (error: unknown) {
    const code = isManagedSpendRefused(error) ? error.code : 'MANAGED_SUBMISSION_FAILED';
    // RECORDED, not refunded. The refund is the sweep's, and it is one conditional
    // UPDATE so that a process which dies between here and there loses nothing.
    await prisma.creditReservation.update({
      where: { id: request.funded.reservationId },
      data: {
        submissionState: 'FAILED',
        submissionAttempts: { increment: 1 },
        submissionCode: code,
      },
    });
    return { submitted: false, runId: null, code };
  }
}
