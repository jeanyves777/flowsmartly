/**
 * The one call a product surface makes: fund a run, then submit it.
 *
 * ```text
 * real user -> billing binding -> reserve credits -> create task -> submit to FlowBuild
 * ```
 *
 * The two halves are separate functions and separate awaits, and the ordering is
 * enforced by data dependency rather than by discipline: `submitFundedRun` cannot be
 * called before `reserveAndCreateFundedTask` resolves, and that promise resolves only
 * when the product transaction has committed. There is no arrangement of this file in
 * which a network call happens inside the transaction.
 *
 * A submission failure is NOT thrown. It is returned, with the reservation left durably
 * compensatable, because a caller that had to catch in order to leave the reservation in
 * a recoverable state is a caller that can forget to.
 */

import type { PrismaClient } from '@prisma/client';

import { billingAccountRef, type BillingAccountRef } from './billing-account';
import type { CommandTransport } from './client';
import type { FundedRun } from './reserve';
import { reserveAndCreateFundedTask } from './reserve';
import { submitFundedRun, type SubmissionOutcome } from './submit';

export interface FundAndSubmitRequest {
  /** The signed-in FlowSmartly user. The payer reference is built from it here. */
  readonly userId: string;
  readonly objective: string;
  readonly acceptanceCriteria: readonly string[];
  readonly ceilingPicoUsd: bigint;
  /** `AgentTask.kind`, so the existing task surfaces can render this run. */
  readonly kind?: string;
  readonly idempotencyKey: string;
  readonly conversationId?: string | null;
  readonly messageId?: string | null;
  readonly env?: NodeJS.ProcessEnv;
  readonly transport?: CommandTransport;
}

export interface FundAndSubmitResult {
  readonly funded: FundedRun;
  readonly submission: SubmissionOutcome;
  readonly account: BillingAccountRef;
}

export const FLOWBUILD_TASK_KIND = 'flowbuild_run';

export async function fundAndSubmitRun(
  prisma: PrismaClient,
  request: FundAndSubmitRequest,
): Promise<FundAndSubmitResult> {
  // `user` today; the reference is polymorphic so a `Team` payer is a new kind and not a
  // migration of every row that names a payer.
  const account = billingAccountRef('user', request.userId);

  const funded = await reserveAndCreateFundedTask(prisma, {
    billingAccount: account,
    ceilingPicoUsd: request.ceilingPicoUsd,
    kind: request.kind ?? FLOWBUILD_TASK_KIND,
    input: JSON.stringify({
      objective: request.objective,
      acceptanceCriteria: request.acceptanceCriteria,
    }),
    idempotencyKey: request.idempotencyKey,
    conversationId: request.conversationId ?? null,
    messageId: request.messageId ?? null,
  });

  // COMMITTED. Only now does the network exist for this operation.
  const submission = await submitFundedRun(prisma, {
    funded,
    subject: account,
    objective: request.objective,
    acceptanceCriteria: request.acceptanceCriteria,
    env: request.env,
    transport: request.transport,
  });

  return { funded, submission, account };
}
