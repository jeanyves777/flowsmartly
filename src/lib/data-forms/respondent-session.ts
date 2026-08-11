/**
 * The bearer a respondent holds after solving a challenge.
 *
 * It is an opaque random reference, not a signed payload. The previous design
 * base64-encoded `{formId, contactId, expiry}` and appended an HMAC — which
 * authenticates but does not encrypt, so anyone holding the token (or reading
 * it out of a proxy log) could decode the raw contact id. Here the token is 32
 * random bytes; purpose, scope, lifetime and revocation all live server-side in
 * a row that can be changed or deleted. Only the token's hash is stored, so a
 * database read does not yield usable bearers.
 *
 * It is carried in an Authorization header or a POST body, never a query
 * string, because query strings are retained by ordinary proxy, access and APM
 * logging.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const SESSION_TTL_MS = 20 * 60 * 1000;
export const SESSION_PURPOSE_PREFILL = "smart_collect_prefill";

export function mintSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashSessionToken(token) };
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenHashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Reads the bearer from the Authorization header, falling back to a POST body field. */
export function readBearer(headers: Headers, body?: unknown): string | null {
  const header = headers.get("authorization");
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (match) return match[1].trim();
  }
  if (body && typeof body === "object" && "token" in body) {
    const value = (body as { token?: unknown }).token;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export interface StoredSession {
  id: string;
  formId: string;
  contactId: string;
  purpose: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
}

export type SessionCheck =
  | { ok: true }
  | { ok: false; reason: "wrong_form" | "wrong_purpose" | "expired" | "revoked" | "consumed" };

/**
 * Pure decision: may this session act, here, now? `allowConsumed` is false for
 * the one mutation a session is permitted, and true for reads.
 */
export function checkSession(
  session: StoredSession,
  formId: string,
  purpose: string,
  now: Date = new Date(),
  allowConsumed = true
): SessionCheck {
  if (session.formId !== formId) return { ok: false, reason: "wrong_form" };
  if (session.purpose !== purpose) return { ok: false, reason: "wrong_purpose" };
  if (session.revokedAt) return { ok: false, reason: "revoked" };
  if (session.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (!allowConsumed && session.consumedAt) return { ok: false, reason: "consumed" };
  return { ok: true };
}
