/**
 * The per-user FlowBuild credential, minted server-side and never seen by a browser.
 *
 * ## Why a static operator token cannot be the answer
 *
 * FlowBuild's only production authentication was one operator credential resolving to
 * one principal in one tenant. Every FlowSmartly user's run would then execute as the
 * same principal in the same tenancy, and "preserve tenant isolation" would be a
 * sentence with no mechanism behind it. So the product mints a credential per SUBJECT.
 *
 * ## What the credential asserts, and — more importantly — what it does not
 *
 * It asserts exactly one thing: WHO the subject is, as a billing account reference. It
 * carries NO tenant id, NO workspace id and NO principal id, because both halves derive
 * those from the subject with the same formula (`./tenancy.ts`). A credential that
 * carried a tenant id would be a credential a bug could point at somebody else's
 * tenancy; there is no field here to point with.
 *
 * ## Server-to-server only
 *
 * The signing key lives in the product server's environment and the minted token travels
 * from the product server to the FlowBuild API. It is never rendered, never returned to
 * a client and never placed in a cookie: a platform credential a browser can read is a
 * platform credential every browser has.
 *
 * ## No fallback secret, ever
 *
 * `CRON_SECRET || "flowsmartly-cron-2026"` exists elsewhere in this repository. Copying
 * that pattern here would make every FlowSmartly user's tenancy reachable by anyone who
 * read the source. An absent key is a refusal that names itself.
 */

import { createHmac, timingSafeEqual } from 'crypto';

import {
  MANAGED_CREDENTIAL_UNCONFIGURED,
  ManagedSpendRefused,
  formatBillingAccountRef,
  parseBillingAccountRef,
  type BillingAccountRef,
} from './billing-account';

/** The env var holding the shared signing key. No default, no fallback. */
export const SUBJECT_SIGNING_KEY_ENV = 'FLOWBUILD_SUBJECT_SIGNING_KEY';

/** The credential's version tag. A future format is a new tag, never a reinterpretation. */
export const SUBJECT_CREDENTIAL_VERSION = 'fbs1';

/** How long a minted credential is good for. Short: it is minted per outbound call. */
export const DEFAULT_CREDENTIAL_TTL_MS = 5 * 60 * 1000;

export interface SubjectClaims {
  readonly v: 1;
  /** `<kind>:<id>` — the billing account, and the only identity assertion made. */
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
}

const base64url = (input: Buffer): string =>
  input.toString('base64').replace(/[+]/gu, '-').replace(/[/]/gu, '_').replace(/=+$/u, '');

const fromBase64url = (input: string): Buffer =>
  Buffer.from(input.replace(/-/gu, '+').replace(/_/gu, '/'), 'base64');

/**
 * The signing key, or a refusal.
 *
 * A minimum length is enforced because a one-character key authenticates as well as a
 * strong one and fails silently: nothing about a short key looks different until
 * somebody guesses it.
 */
export function readSubjectSigningKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = (env[SUBJECT_SIGNING_KEY_ENV] ?? '').trim();
  if (raw === '') {
    throw new ManagedSpendRefused(
      MANAGED_CREDENTIAL_UNCONFIGURED,
      SUBJECT_SIGNING_KEY_ENV +
        ' is not set. Managed FlowBuild runs are refused rather than signed with a ' +
        'literal: a hardcoded fallback on this key makes every tenancy reachable by ' +
        'anyone who can read the source.',
      { variable: SUBJECT_SIGNING_KEY_ENV },
    );
  }
  if (raw.length < 32) {
    throw new ManagedSpendRefused(
      MANAGED_CREDENTIAL_UNCONFIGURED,
      SUBJECT_SIGNING_KEY_ENV +
        ' is shorter than 32 characters. A short key authenticates exactly as well as a ' +
        'strong one right up until somebody guesses it, so the length is a refusal and ' +
        'not a warning.',
      { variable: SUBJECT_SIGNING_KEY_ENV, length: raw.length },
    );
  }
  return Buffer.from(raw, 'utf8');
}

const sign = (key: Buffer, signingInput: string): Buffer =>
  createHmac('sha256', key).update(signingInput, 'utf8').digest();

/** Mint a credential for one subject. Pure given the key, the subject and the clock. */
export function mintSubjectCredential(
  key: Buffer,
  subject: BillingAccountRef,
  options: { readonly now?: Date; readonly ttlMs?: number } = {},
): string {
  const issuedAt = (options.now ?? new Date()).getTime();
  const claims: SubjectClaims = {
    v: 1,
    sub: formatBillingAccountRef(subject),
    iat: issuedAt,
    exp: issuedAt + (options.ttlMs ?? DEFAULT_CREDENTIAL_TTL_MS),
  };
  const body = base64url(Buffer.from(JSON.stringify(claims), 'utf8'));
  const signingInput = SUBJECT_CREDENTIAL_VERSION + '.' + body;
  return signingInput + '.' + base64url(sign(key, signingInput));
}

export type SubjectVerification =
  | { readonly ok: true; readonly subject: BillingAccountRef; readonly claims: SubjectClaims }
  | { readonly ok: false; readonly reason: string };

/**
 * Verify a credential and recover its subject.
 *
 * Shipped from the product because the product is the only party that can prove the
 * minting and the verification agree: this exact function is what the FlowBuild half's
 * equivalent is asserted against, and a contract proven on one side only is a contract
 * proven nowhere.
 *
 * The MAC comparison is `timingSafeEqual` over equal-length buffers. `===` on a MAC
 * leaks its matching prefix to anyone who can time the endpoint, which is the whole
 * attack a MAC exists to stop.
 */
export function verifySubjectCredential(
  key: Buffer,
  presented: string,
  now: Date = new Date(),
): SubjectVerification {
  const parts = presented.split('.');
  if (parts.length !== 3 || parts[0] !== SUBJECT_CREDENTIAL_VERSION) {
    return { ok: false, reason: 'malformed' };
  }
  const expected = sign(key, parts[0] + '.' + parts[1]);
  const actual = fromBase64url(parts[2]);
  if (actual.length !== expected.length) return { ok: false, reason: 'signature' };
  if (!timingSafeEqual(actual, expected)) return { ok: false, reason: 'signature' };

  let claims: SubjectClaims;
  try {
    claims = JSON.parse(fromBase64url(parts[1]).toString('utf8')) as SubjectClaims;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (claims.v !== 1 || typeof claims.sub !== 'string' || typeof claims.exp !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  if (claims.exp <= now.getTime()) return { ok: false, reason: 'expired' };

  try {
    return { ok: true, subject: parseBillingAccountRef(claims.sub), claims };
  } catch {
    return { ok: false, reason: 'subject' };
  }
}
