/**
 * The FlowBuild tenancy a FlowSmartly billing account owns.
 *
 * ## DERIVED, never asserted by a client, and never invented per request
 *
 * The identifiers below are a pure function of the billing account reference. That is
 * the property that makes the credential in `./credential.ts` safe: the product asserts
 * only WHO the subject is, and both halves derive the tenancy from that subject with the
 * same formula. Nothing on the wire carries a tenant id, so nothing on the wire can
 * claim one — which is a stronger guarantee than validating a claimed tenant id, because
 * there is no claim to validate.
 *
 * This formula is duplicated, deliberately, in the FlowBuild repository at
 * `packages/domain/src/managed/account-tenancy.ts`. The two are one contract and the
 * prefixes are asserted on both sides. A divergence makes a product-minted credential
 * resolve to a tenancy the product never provisioned, which fails CLOSED (the run is
 * refused for an unprovisioned tenancy) rather than open (a run against somebody else's).
 *
 * ## Why a prefix and not a hash
 *
 * A hash would be shorter and would hide the account id from anybody reading a run row.
 * It would also make a support question — whose run is this — unanswerable without a
 * lookup table, and it introduces a collision class this build has no need to reason
 * about. The account id is already opaque; the tenancy is one derived from it, and the
 * derivation is injective because `billingAccountRef` has already refused every id that
 * could collide after the substitution below.
 */

import { formatBillingAccountRef, type BillingAccountRef } from './billing-account';

export const TENANT_PREFIX = 'fs-t-';
export const WORKSPACE_PREFIX = 'fs-w-';
export const PROJECT_PREFIX = 'fs-p-';
export const PRINCIPAL_PREFIX = 'fs-u-';

/** The four identifiers one billing account's FlowBuild work happens under. */
export interface FlowbuildTenancy {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly principalId: string;
}

/**
 * The tenancy for an account reference.
 *
 * Total: `billingAccountRef` has already refused an id whose characters cannot appear in
 * an identifier, so this function has no failure mode and no `null` return a caller
 * could forget to check.
 */
export function deriveTenancy(ref: BillingAccountRef): FlowbuildTenancy {
  const suffix = formatBillingAccountRef(ref).replace(':', '-');
  return Object.freeze({
    tenantId: TENANT_PREFIX + suffix,
    workspaceId: WORKSPACE_PREFIX + suffix,
    projectId: PROJECT_PREFIX + suffix,
    principalId: PRINCIPAL_PREFIX + suffix,
  });
}
