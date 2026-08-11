/**
 * Shared plumbing for the public respondent routes: the durable rate-counter
 * store, form resolution, and the rate gate itself.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { clientIdentity } from "./client-identity";
import { consumeRate, type RateCounterStore, type RateRule } from "./rate-limit";
import {
  checkSession,
  hashSessionToken,
  readBearer,
  type SessionCheck,
} from "./respondent-session";

/** Roughly one sweep per hundred requests; cheap, and keeps the table bounded. */
const SWEEP_PROBABILITY = 0.01;

export const prismaRateStore: RateCounterStore = {
  async increment(bucketKey, expiresAt) {
    try {
      const row = await prisma.publicRateCounter.upsert({
        where: { bucketKey },
        create: { bucketKey, count: 1, expiresAt },
        update: { count: { increment: 1 } },
        select: { count: true },
      });
      return row.count;
    } catch {
      // Two callers created the same bucket at once; the row exists now.
      const row = await prisma.publicRateCounter.update({
        where: { bucketKey },
        data: { count: { increment: 1 } },
        select: { count: true },
      });
      return row.count;
    }
  },
  async sweep(now) {
    await prisma.publicRateCounter.deleteMany({ where: { expiresAt: { lt: now } } });
  },
};

export interface PublicSmartForm {
  id: string;
  userId: string;
  contactListId: string;
}

/**
 * The form, only if it is a live respondent-facing form bound to a list.
 * Fails closed on a missing list: with no list there is no audience, and we
 * never fall back to the owner's whole contact book.
 */
export async function loadPublicSmartForm(slug: string): Promise<PublicSmartForm | null> {
  const form = await prisma.dataForm.findUnique({
    where: { slug },
    select: { id: true, type: true, status: true, userId: true, contactListId: true },
  });

  if (!form) return null;
  if (form.status !== "ACTIVE") return null;
  if (!["SMART_COLLECT", "ATTENDANCE"].includes(form.type)) return null;
  if (!form.contactListId) return null;

  return { id: form.id, userId: form.userId, contactListId: form.contactListId };
}

/**
 * Count the request and refuse it if over the limit. Identity comes from the
 * ingress-written header only — never a caller-supplied one.
 *
 * Returns a response to send, or null to continue.
 */
export async function enforceRate(
  headers: Headers,
  rule: RateRule,
  suffix: string
): Promise<NextResponse | null> {
  const { identity } = clientIdentity(headers);

  if (Math.random() < SWEEP_PROBABILITY) {
    // Best effort; a failed sweep must never fail the request.
    prismaRateStore.sweep(new Date()).catch(() => {});
  }

  const decision = await consumeRate(prismaRateStore, rule, `${identity}|${suffix}`);
  if (decision.allowed) return null;

  return NextResponse.json(
    {
      success: false,
      error: { message: "Too many attempts. Please wait a few minutes and try again." },
    },
    { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } }
  );
}

export interface ResolvedSession {
  id: string;
  contactId: string;
}

type SessionFailure = Extract<SessionCheck, { ok: false }>["reason"] | "unknown";

export type SessionResolution =
  | { ok: true; session: ResolvedSession }
  | { ok: false; reason: SessionFailure };

/**
 * Look up the bearer and decide whether it may act here. The token is read from
 * the Authorization header (or a POST body field), never from the URL.
 *
 * `allowConsumed` is false for the single mutation a session is permitted.
 */
export async function resolveRespondentSession(
  headers: Headers,
  body: unknown,
  formId: string,
  purpose: string,
  allowConsumed = true
): Promise<SessionResolution> {
  const bearer = readBearer(headers, body);
  if (!bearer) return { ok: false, reason: "unknown" };

  const row = await prisma.dataFormRespondentSession.findUnique({
    where: { tokenHash: hashSessionToken(bearer) },
    select: {
      id: true,
      formId: true,
      contactId: true,
      purpose: true,
      expiresAt: true,
      consumedAt: true,
      revokedAt: true,
    },
  });
  if (!row) return { ok: false, reason: "unknown" };

  const verdict = checkSession(row, formId, purpose, new Date(), allowConsumed);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  return { ok: true, session: { id: row.id, contactId: row.contactId } };
}
