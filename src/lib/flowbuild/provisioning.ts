/**
 * Provision a FlowSmartly account's FlowBuild tenancy, and bind it to the payer.
 *
 * ## What "provisioning" means across two systems
 *
 * ```text
 * PRODUCT   FlowbuildTenantBinding row      durable, idempotent, this module
 * FLOWBUILD tenants row + payer binding     idempotent, at the first authenticated call
 * ```
 *
 * The two halves derive the SAME identifiers from the SAME billing account reference
 * (`./tenancy.ts`), so they cannot disagree about which tenancy an account owns. Neither
 * half asks the other what the ids are; both compute them. That is what makes the
 * ordering irrelevant — the product may bind before FlowBuild has ever heard of the
 * account, and FlowBuild's own conditional writer produces the same row whenever it
 * first does.
 *
 * ## No single static operator identity stands in for a user
 *
 * The tenancy is a function of the account, so two accounts can never share one. The
 * previous shape — one operator credential resolving to one principal in one tenant —
 * would have made every user's run execute as the same principal, and "preserve tenant
 * isolation" would have been a sentence with nothing behind it.
 *
 * ## Idempotent on the CONSTRAINT, not on a read
 *
 * `@@unique([billingAccountKind, billingAccountId])` is the arbiter. A `findFirst` then
 * `create` would let two concurrent provisioners both find nothing and both insert, and
 * the second would fail at a moment nobody chose — or, worse, succeed and give one
 * account two tenancies. The unique violation is caught and read back instead.
 */

import type { PrismaClient } from '@prisma/client';

import { formatBillingAccountRef, type BillingAccountRef } from './billing-account';
import { isUniqueViolationOn } from './reserve';
import { deriveTenancy, type FlowbuildTenancy } from './tenancy';

export type ProvisionOutcome = 'provisioned' | 'already_bound';

export interface TenantBinding {
  readonly account: BillingAccountRef;
  readonly tenancy: FlowbuildTenancy;
  readonly outcome: ProvisionOutcome;
}

/**
 * Bind `account` to its FlowBuild tenancy, creating the binding if it is not there.
 *
 * @returns `provisioned` on the first call for an account and `already_bound` on every
 *   later one. Two outcomes and not one, because "this deployment just bound an account
 *   for the first time" and "this has run a thousand times" are different facts and only
 *   the first is worth a line in a log.
 */
export async function ensureFlowbuildTenantBinding(
  prisma: PrismaClient,
  account: BillingAccountRef,
): Promise<TenantBinding> {
  const tenancy = deriveTenancy(account);
  try {
    await prisma.flowbuildTenantBinding.create({
      data: {
        billingAccountKind: account.kind,
        billingAccountId: account.id,
        tenantId: tenancy.tenantId,
        workspaceId: tenancy.workspaceId,
        projectId: tenancy.projectId,
        principalId: tenancy.principalId,
      },
      select: { id: true },
    });
    return { account, tenancy, outcome: 'provisioned' };
  } catch (error: unknown) {
    if (
      !isUniqueViolationOn(error, 'billingAccountId') &&
      !isUniqueViolationOn(error, 'tenantId')
    ) {
      throw error;
    }
    const existing = await prisma.flowbuildTenantBinding.findUnique({
      where: {
        billingAccountKind_billingAccountId: {
          billingAccountKind: account.kind,
          billingAccountId: account.id,
        },
      },
      select: { tenantId: true, workspaceId: true, projectId: true, principalId: true },
    });
    if (existing === null) {
      // The INSERT conflicted, so a row exists for one of the two unique keys and it is
      // not this account's. That means a DIFFERENT account already claims this tenancy —
      // which the derivation makes impossible unless the formula changed under rows the
      // old one wrote. It is refused rather than repaired.
      throw new Error(
        'provisioning ' +
          formatBillingAccountRef(account) +
          ' conflicted on a unique key and no binding for that account is readable. The ' +
          'tenancy derivation and the stored rows disagree, which is a migration and not ' +
          'a retry.',
      );
    }
    if (existing.tenantId !== tenancy.tenantId) {
      throw new Error(
        'account ' +
          formatBillingAccountRef(account) +
          ' is bound to tenancy "' +
          existing.tenantId +
          '" and the current derivation produces "' +
          tenancy.tenantId +
          '". A tenancy whose id follows whatever formula shipped last is a tenancy whose ' +
          'runs follow a deployment order, so this is refused rather than rebound.',
      );
    }
    return {
      account,
      tenancy: {
        tenantId: existing.tenantId,
        workspaceId: existing.workspaceId,
        projectId: existing.projectId,
        principalId: existing.principalId,
      },
      outcome: 'already_bound',
    };
  }
}

/**
 * The binding for an account, or `null` when there is none.
 *
 * A READ, deliberately: the reservation path must be able to REFUSE an unbound account
 * with `MANAGED_BILLING_ACCOUNT_UNBOUND` rather than silently provision one mid-spend.
 * Provisioning is an account-lifecycle action; funding a run is not the moment to
 * discover an account has no tenancy.
 */
export async function readFlowbuildTenantBinding(
  prisma: PrismaClient,
  account: BillingAccountRef,
): Promise<FlowbuildTenancy | null> {
  const row = await prisma.flowbuildTenantBinding.findUnique({
    where: {
      billingAccountKind_billingAccountId: {
        billingAccountKind: account.kind,
        billingAccountId: account.id,
      },
    },
    select: {
      tenantId: true,
      workspaceId: true,
      projectId: true,
      principalId: true,
      state: true,
    },
  });
  if (row === null || row.state !== 'BOUND') return null;
  return {
    tenantId: row.tenantId,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    principalId: row.principalId,
  };
}
