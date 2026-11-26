/**
 * WHO PAYS for a FlowBuild run, as a reference and never as a balance.
 *
 * ## The reference is polymorphic, and that is the whole point of this module
 *
 * Today every payer is a `User` and the credits live on `User.aiCredits`. Tomorrow one
 * may be a `Team`. A binding written as a bare `userId` would make the second case a
 * migration of every row that names a payer; written as `kind` + `id` it is a new value
 * of `kind`, and nothing about the column, the index or the wire shape changes.
 *
 * Nothing here migrates credits to `Team`. `user` is the only kind any code path
 * provisions, and `resolvePayerUserId` refuses every other kind by name rather than
 * quietly treating its id as a user id.
 *
 * ## Bound is not funded, and neither is affordable
 *
 * FlowBuild's own `MANAGED_BILLING_ACCOUNT_UNBOUND` answers "this tenancy has nowhere to
 * send the bill". It is a different question from custody ("whose credential is this")
 * and from balance ("are there enough credits"), and the three are separate refusal
 * codes here for the reason FlowBuild keeps them separate: folding an unbillable tenancy
 * into a custody failure sends an operator looking at credentials for a provisioning
 * omission they did not make.
 */

/** The account kinds a binding may name. CLOSED: an unrecognised kind is a refusal. */
export const BILLING_ACCOUNT_KINDS = Object.freeze(['user', 'team'] as const);

export type BillingAccountKind = (typeof BILLING_ACCOUNT_KINDS)[number];

export const isBillingAccountKind = (value: unknown): value is BillingAccountKind =>
  typeof value === 'string' && (BILLING_ACCOUNT_KINDS as readonly string[]).includes(value);

/** A payer named by kind and id. Never a balance, never a credential. */
export interface BillingAccountRef {
  readonly kind: BillingAccountKind;
  readonly id: string;
}

/* -------------------------------------------------------------------------- */
/* Refusals                                                                    */
/* -------------------------------------------------------------------------- */

/** The caller has no billing account bound at all. Refused BEFORE any provider call. */
export const MANAGED_BILLING_ACCOUNT_UNBOUND = 'MANAGED_BILLING_ACCOUNT_UNBOUND';
/** A kind outside {@link BILLING_ACCOUNT_KINDS}: a typo, not a decision. */
export const MANAGED_BILLING_ACCOUNT_KIND_UNRECOGNISED = 'MANAGED_BILLING_ACCOUNT_KIND_UNRECOGNISED';
/** A kind this build recognises and does not yet fund, named rather than coerced. */
export const MANAGED_BILLING_ACCOUNT_KIND_UNSUPPORTED = 'MANAGED_BILLING_ACCOUNT_KIND_UNSUPPORTED';
/** An id whose characters cannot survive derivation into a tenancy identifier. */
export const MANAGED_BILLING_ACCOUNT_ID_UNSUPPORTED = 'MANAGED_BILLING_ACCOUNT_ID_UNSUPPORTED';
/** The balance cannot cover the ceiling. Deterministic, and zero provider calls. */
export const MANAGED_INSUFFICIENT_CREDITS = 'MANAGED_INSUFFICIENT_CREDITS';
/** The caller is not the payer the reservation names. Refused, never reassigned. */
export const MANAGED_BILLING_ACCOUNT_MISMATCH = 'MANAGED_BILLING_ACCOUNT_MISMATCH';
/** A settlement arrived for a reservation that is not OPEN, or does not exist. */
export const MANAGED_NO_OPEN_RESERVATION = 'MANAGED_NO_OPEN_RESERVATION';
/** The FlowBuild submission did not succeed; the reservation stays compensatable. */
export const MANAGED_SUBMISSION_FAILED = 'MANAGED_SUBMISSION_FAILED';
/** The subject signing key is absent. A money path never falls back to a literal. */
export const MANAGED_CREDENTIAL_UNCONFIGURED = 'MANAGED_CREDENTIAL_UNCONFIGURED';

export type ManagedRefusalCode =
  | typeof MANAGED_BILLING_ACCOUNT_UNBOUND
  | typeof MANAGED_BILLING_ACCOUNT_KIND_UNRECOGNISED
  | typeof MANAGED_BILLING_ACCOUNT_KIND_UNSUPPORTED
  | typeof MANAGED_BILLING_ACCOUNT_ID_UNSUPPORTED
  | typeof MANAGED_INSUFFICIENT_CREDITS
  | typeof MANAGED_BILLING_ACCOUNT_MISMATCH
  | typeof MANAGED_NO_OPEN_RESERVATION
  | typeof MANAGED_SUBMISSION_FAILED
  | typeof MANAGED_CREDENTIAL_UNCONFIGURED;

/**
 * A refusal that carries its CODE.
 *
 * The code is what an arm asserts. A test that only checked that something threw would
 * pass against a module that threw for an unrelated reason, and this programme has been
 * bitten by exactly that: assert the reason, never merely a non-zero outcome.
 */
export class ManagedSpendRefused extends Error {
  readonly code: ManagedRefusalCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: ManagedRefusalCode,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'ManagedSpendRefused';
    this.code = code;
    this.details = details;
  }
}

export const isManagedSpendRefused = (error: unknown): error is ManagedSpendRefused =>
  error instanceof ManagedSpendRefused;

/* -------------------------------------------------------------------------- */
/* Construction                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ids that survive derivation into a FlowBuild tenancy identifier.
 *
 * cuid ids are alphanumeric, so this admits every id the product mints today. It is a
 * refusal and not a sanitiser on purpose: a sanitiser maps two different accounts onto
 * one identifier, and two accounts sharing a tenancy is the cross-tenant defect this
 * whole path exists to prevent.
 */
const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;

export function billingAccountRef(kind: string, id: string): BillingAccountRef {
  if (!isBillingAccountKind(kind)) {
    throw new ManagedSpendRefused(
      MANAGED_BILLING_ACCOUNT_KIND_UNRECOGNISED,
      'the billing account kind "' +
        kind +
        '" is not one this build knows (' +
        BILLING_ACCOUNT_KINDS.join(', ') +
        '). An account bound to a kind nothing can resolve is an account that looks ' +
        'billable and is not.',
      { kind },
    );
  }
  if (!ACCOUNT_ID_PATTERN.test(id)) {
    throw new ManagedSpendRefused(
      MANAGED_BILLING_ACCOUNT_ID_UNSUPPORTED,
      'the billing account id is empty or carries characters a tenancy identifier cannot ' +
        'derive from. It is refused rather than sanitised: a sanitiser maps two accounts ' +
        'onto one tenancy.',
      { kind, idLength: id.length },
    );
  }
  return Object.freeze({ kind, id });
}

/** `<kind>:<id>`, for a log line or a wire field. */
export const formatBillingAccountRef = (ref: BillingAccountRef): string => ref.kind + ':' + ref.id;

/**
 * Parse `<kind>:<id>`, refusing anything that is not one.
 *
 * The split is on the FIRST colon only, so an id that ever contains one is still read
 * whole rather than truncated at it — and `billingAccountRef` then refuses that id
 * anyway, which is two independent statements of the same rule rather than one.
 */
export function parseBillingAccountRef(declaration: string): BillingAccountRef {
  const separator = declaration.indexOf(':');
  if (separator <= 0 || separator === declaration.length - 1) {
    throw new ManagedSpendRefused(
      MANAGED_BILLING_ACCOUNT_KIND_UNRECOGNISED,
      'a billing account declaration is "<kind>:<id>"; received "' + declaration + '".',
      { declaration },
    );
  }
  return billingAccountRef(declaration.slice(0, separator), declaration.slice(separator + 1));
}

/**
 * The `User.id` that holds the balance, or a refusal naming the kind.
 *
 * The `team` arm THROWS. It does not fall through to treating the team id as a user id,
 * which is the shape that would silently debit whichever user happened to share an id
 * space with a team. When teams acquire a balance this function gains a branch and every
 * caller keeps compiling.
 */
export function resolvePayerUserId(ref: BillingAccountRef): string {
  if (ref.kind === 'user') return ref.id;
  throw new ManagedSpendRefused(
    MANAGED_BILLING_ACCOUNT_KIND_UNSUPPORTED,
    'billing account kind "' +
      ref.kind +
      '" is recognised and holds no credit balance in this build. Credits live on ' +
      'User.aiCredits and nothing here migrates them.',
    { kind: ref.kind },
  );
}
