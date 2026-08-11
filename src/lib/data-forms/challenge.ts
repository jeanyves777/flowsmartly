/**
 * The proof-of-possession step.
 *
 * Discovery ("is there a record under this name and address?") and
 * authorization ("you may read and change that record") are separate. A name
 * only selects who gets sent a code; nothing is disclosed and nothing is
 * writable until the caller returns a code that was delivered to a channel
 * ALREADY stored on the contact. That is the whole point: the channel is one we
 * held before the request, so controlling it means something.
 */
import { createHash, randomInt, timingSafeEqual } from "crypto";

export const CODE_TTL_MS = 10 * 60 * 1000;
/** Guesses allowed against a single issued code before it is burned. */
export const MAX_CODE_ATTEMPTS = 5;
export const CODE_LENGTH = 6;

const globalForPepper = globalThis as unknown as { __dataFormPepper?: string };

/**
 * Peppers the stored code hash so a database read alone does not yield usable
 * codes. Production should set DATA_FORM_CHALLENGE_PEPPER; JWT_SECRET is
 * accepted so an existing deployment is not left unpeppered by accident.
 */
function pepper(): string {
  const configured =
    process.env.DATA_FORM_CHALLENGE_PEPPER || process.env.JWT_SECRET;
  if (configured) return configured;

  if (!globalForPepper.__dataFormPepper) {
    globalForPepper.__dataFormPepper = randomBytesHex();
    console.warn(
      "[data-forms] DATA_FORM_CHALLENGE_PEPPER is not set — using a per-process value. Codes will not survive a restart."
    );
  }
  return globalForPepper.__dataFormPepper;
}

function randomBytesHex(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += randomInt(0, 0xffffffff).toString(16);
  return out;
}

/** A uniformly random numeric code. `randomInt` is rejection-sampled, not modulo-biased. */
export function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += randomInt(0, 10).toString();
  return code;
}

/**
 * Hash bound to the form and contact it was issued for, so a code observed in
 * one context cannot be replayed against another even if the digest leaks.
 */
export function hashCode(formId: string, contactId: string, code: string): string {
  return createHash("sha256")
    .update(`${pepper()}|${formId}|${contactId}|${code}`)
    .digest("hex");
}

export function codeHashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Shape of a stored challenge, as far as the decision logic cares. */
export interface StoredChallenge {
  id: string;
  formId: string;
  contactId: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
}

export type ChallengeCheck =
  | { ok: true }
  | { ok: false; reason: "expired" | "consumed" | "exhausted" | "mismatch" };

/**
 * Pure decision: may this submitted code be accepted against this challenge?
 * Kept separate from the database so every branch is directly testable.
 */
export function checkChallenge(
  challenge: StoredChallenge,
  submittedCode: string,
  now: Date = new Date()
): ChallengeCheck {
  if (challenge.consumedAt) return { ok: false, reason: "consumed" };
  if (challenge.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (challenge.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: "exhausted" };

  const expected = hashCode(challenge.formId, challenge.contactId, submittedCode);
  if (!codeHashesMatch(expected, challenge.codeHash)) return { ok: false, reason: "mismatch" };

  return { ok: true };
}
