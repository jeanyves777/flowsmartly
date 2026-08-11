/**
 * Short-lived, form-bound respondent tokens for the public Smart Collect flow.
 *
 * The public form pages must be able to say "this is the record you just
 * identified yourself as" without ever putting a raw `Contact.id` on the wire.
 * A raw id is a durable, guessable-if-leaked handle to a person's record; a
 * token is bound to one form, expires, and cannot be forged without the server
 * secret. Public endpoints therefore accept a token and never a contact id.
 */
import { createHmac, timingSafeEqual, randomBytes } from "crypto";

/** Long enough to fill in a short form, short enough to be useless if copied. */
const TTL_MS = 30 * 60 * 1000;

interface TokenPayload {
  /** form id the token is bound to */
  f: string;
  /** contact id */
  c: string;
  /** expiry (epoch ms) */
  e: number;
}

const globalForToken = globalThis as unknown as {
  __dataFormTokenFallbackSecret?: string;
};

function signingSecret(): string {
  const configured =
    process.env.JWT_SECRET ||
    process.env.STORE_CUSTOMER_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (configured) return configured;

  // No configured secret (local dev). Fall back to a per-process random key so
  // tokens still work inside this process and remain unforgeable from outside.
  // They do not survive a restart, which is the correct failure for dev.
  if (!globalForToken.__dataFormTokenFallbackSecret) {
    globalForToken.__dataFormTokenFallbackSecret = randomBytes(32).toString("hex");
    console.warn(
      "[data-forms] No JWT_SECRET set — respondent tokens use a per-process key."
    );
  }
  return globalForToken.__dataFormTokenFallbackSecret;
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

/** Mint a token that identifies `contactId` to `formId` only, for TTL_MS. */
export function issueRespondentToken(formId: string, contactId: string): string {
  const payload: TokenPayload = { f: formId, c: contactId, e: Date.now() + TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Verify a token against the form it must be bound to.
 * Returns the contact id, or null if the token is malformed, forged, expired,
 * or issued for a different form.
 */
export function readRespondentToken(
  token: unknown,
  formId: string
): string | null {
  if (typeof token !== "string" || token.length < 8 || token.length > 4096) {
    return null;
  }

  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const encoded = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(encoded));
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload.c !== "string" || typeof payload.f !== "string") {
    return null;
  }
  if (payload.f !== formId) return null;
  if (typeof payload.e !== "number" || payload.e < Date.now()) return null;

  return payload.c;
}
