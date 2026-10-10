/**
 * The FlowBuild write surface, as the product calls it.
 *
 * One endpoint — `POST /v1/commands` — carrying a `command-envelope`. The envelope's
 * `command_id` IS the idempotency key FlowBuild keys its replay guarantee on: "repeated
 * submission of the same `command_id` returns the original command outcome instead of
 * executing twice". A retry that minted a fresh UUID would forfeit that guarantee and
 * execute twice, so `commandId` is derived from the reservation and never generated at
 * the call site.
 *
 * ## The credential is per-user and is minted here, per call
 *
 * `Authorization: Bearer <subject credential>` from `./credential.ts`. FlowBuild derives
 * the tenancy from the subject, so the envelope's `tenant_id`/`workspace_id`/`project_id`
 * are the ones this product DERIVED from the same subject with the same formula. If the
 * two derivations ever disagree the submission is refused by FlowBuild's own
 * envelope authorization, which fails closed.
 */

import {
  MANAGED_SUBMISSION_FAILED,
  ManagedSpendRefused,
  type BillingAccountRef,
} from './billing-account';
import { decimalStringFromPicoUsd } from './ceiling';
import { mintSubjectCredential, readSubjectSigningKey } from './credential';
import type { FlowbuildTenancy } from './tenancy';

export const FLOWBUILD_API_URL_ENV = 'FLOWBUILD_API_URL';
export const COMMANDS_PATH = '/v1/commands';

/** The funding policy a FlowSmartly-managed run declares. Managed, and nothing else. */
export const MANAGED_FUNDING_POLICY = Object.freeze({
  preferred_sources: Object.freeze(['flowsmartly_managed'] as const),
  managed_fallback: 'forbidden' as const,
});

export interface SubmitTaskRequest {
  readonly subject: BillingAccountRef;
  readonly tenancy: FlowbuildTenancy;
  /** The product-allocated task id, reused as the command id so a retry is a replay. */
  readonly commandId: string;
  readonly objective: string;
  readonly acceptanceCriteria: readonly string[];
  /** The reserved ceiling. The SAME number the reservation was sized from. */
  readonly ceilingPicoUsd: bigint;
  readonly executionProfile?: string;
  readonly routingProfile?: string;
  readonly verificationProfile?: string;
  readonly submittedAt?: Date;
}

export interface SubmitTaskResult {
  readonly taskId: string | null;
  readonly runId: string | null;
  readonly status: number;
}

/** What a submission is actually performed by. Injected so a proof can observe ordering. */
export type CommandTransport = (
  url: string,
  init: {
    readonly method: 'POST';
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
  },
) => Promise<{ readonly status: number; readonly text: string }>;

const fetchTransport: CommandTransport = async (url, init) => {
  const response = await fetch(url, init);
  return { status: response.status, text: await response.text() };
};

/**
 * The ceiling as the JSON number `budget.max_flowsmartly_managed_cost_usd` requires.
 *
 * Refused rather than rounded when the picodollar value cannot survive the trip through
 * an IEEE-754 double. The whole design rests on both halves reading ONE number, and a
 * ceiling that arrives a fraction lower than the one the reservation was sized from is
 * two numbers wearing one name.
 */
export function ceilingAsWireNumber(pico: bigint): number {
  const decimal = decimalStringFromPicoUsd(pico);
  const asNumber = Number(decimal);
  if (!Number.isFinite(asNumber) || String(asNumber) !== String(Number(decimal))) {
    throw new RangeError('the managed ceiling ' + decimal + ' is not representable on the wire');
  }
  // Round-trip through the decimal spelling, so a value the double cannot hold exactly
  // is caught here and not discovered as a penny of divergence at settlement.
  if (decimalStringFromPicoUsd(BigInt(Math.round(asNumber * 1e12))) !== decimal) {
    throw new RangeError(
      'the managed ceiling ' +
        decimal +
        ' does not round-trip through a JSON number. Refused rather than shipped: the ' +
        'reservation and FlowBuild ceiling must be one number, not two that agree today.',
    );
  }
  return asNumber;
}

export function readFlowbuildApiUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env[FLOWBUILD_API_URL_ENV] ?? '').trim();
  if (raw === '') {
    throw new ManagedSpendRefused(
      MANAGED_SUBMISSION_FAILED,
      FLOWBUILD_API_URL_ENV +
        ' is not set. There is no default FlowBuild endpoint: a product that guessed one ' +
        'would submit funded work to a host nobody chose.',
      { variable: FLOWBUILD_API_URL_ENV },
    );
  }
  return raw.replace(/\/+$/u, '');
}

/**
 * Submit `task.create` for a run that is already funded.
 *
 * @throws {ManagedSpendRefused} `MANAGED_SUBMISSION_FAILED` on any non-2xx answer or
 *   transport fault. The caller's reservation stays OPEN and compensatable; this
 *   function never touches the balance.
 */
export async function submitTaskCreate(
  request: SubmitTaskRequest,
  options: {
    readonly env?: NodeJS.ProcessEnv;
    readonly transport?: CommandTransport;
  } = {},
): Promise<SubmitTaskResult> {
  const env = options.env ?? process.env;
  const transport = options.transport ?? fetchTransport;
  const baseUrl = readFlowbuildApiUrl(env);
  const credential = mintSubjectCredential(readSubjectSigningKey(env), request.subject);
  const submittedAt = (request.submittedAt ?? new Date()).toISOString();

  const envelope = {
    schema_version: '1',
    command_id: request.commandId,
    command_type: 'task.create',
    command_type_version: 1,
    actor_principal_id: request.tenancy.principalId,
    actor_kind: 'user',
    tenant_id: request.tenancy.tenantId,
    workspace_id: request.tenancy.workspaceId,
    project_id: request.tenancy.projectId,
    submitted_at: submittedAt,
    payload: {
      schema_version: '1',
      objective: request.objective,
      acceptance_criteria: request.acceptanceCriteria,
      execution_profile: request.executionProfile ?? 'standard',
      routing_profile: request.routingProfile ?? 'standard',
      verification_profile: request.verificationProfile ?? 'standard',
      funding_policy: MANAGED_FUNDING_POLICY,
      budget: {
        // THE SAME NUMBER the reservation was sized from. The product's reservation caps
        // the LOSS and FlowBuild's ceiling check caps the SPEND, and they are one
        // guarantee rather than two policies that have to agree.
        max_flowsmartly_managed_cost_usd: ceilingAsWireNumber(request.ceilingPicoUsd),
        max_wall_seconds: 900,
        max_intelligence_calls: 64,
        max_tool_calls: 256,
        max_repair_attempts: 2,
      },
    },
  };

  let answer: { status: number; text: string };
  try {
    answer = await transport(baseUrl + COMMANDS_PATH, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + credential,
        // The wire idempotency key guards REDELIVERY at the transport; `command_id`
        // inside the envelope guards BUSINESS duplication. Different guards, both sent.
        'idempotency-key': request.commandId,
      },
      body: JSON.stringify(envelope),
    });
  } catch (error: unknown) {
    throw new ManagedSpendRefused(
      MANAGED_SUBMISSION_FAILED,
      'the FlowBuild submission could not be delivered: ' +
        (error instanceof Error ? error.message : String(error)),
      { commandId: request.commandId },
    );
  }

  if (answer.status < 200 || answer.status >= 300) {
    throw new ManagedSpendRefused(
      MANAGED_SUBMISSION_FAILED,
      'FlowBuild answered ' + answer.status + ' to the funded task submission',
      { commandId: request.commandId, status: answer.status },
    );
  }

  let acknowledgement: { task_id?: unknown; run_id?: unknown } = {};
  try {
    acknowledgement = JSON.parse(answer.text) as { task_id?: unknown; run_id?: unknown };
  } catch {
    // A 2xx with an unparseable body is still a submission that happened. The run id is
    // then unknown and the reservation is matched by its task id instead; reporting this
    // as a failure would compensate a reservation whose run is executing.
    acknowledgement = {};
  }
  return {
    taskId: typeof acknowledgement.task_id === 'string' ? acknowledgement.task_id : null,
    runId: typeof acknowledgement.run_id === 'string' ? acknowledgement.run_id : null,
    status: answer.status,
  };
}
