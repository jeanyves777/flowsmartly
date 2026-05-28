import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getVapidPublicKey } from "@/lib/notifications/web-push";

/**
 * POST /api/flow-ai/push/subscribe
 *
 * Body: { endpoint: string, keys: { p256dh: string, auth: string }, userAgent?: string }
 *
 * Upsert the user's PushSubscription row keyed by endpoint. Idempotent —
 * re-subscribing from the same browser just refreshes the keys + bumps
 * updatedAt.
 *
 * GET /api/flow-ai/push/subscribe
 *   → returns the VAPID public key the client needs to call
 *     `pushManager.subscribe({ applicationServerKey })`.
 *
 * DELETE /api/flow-ai/push/subscribe?endpoint=...
 *   → removes a single subscription (called from the client when the
 *     user revokes notification permission).
 */

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { ok: false, error: "Push not configured" },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, publicKey });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint + keys.p256dh + keys.auth are required" },
      { status: 400 },
    );
  }

  const userAgent =
    typeof body.userAgent === "string" && body.userAgent.length < 500
      ? body.userAgent
      : req.headers.get("user-agent")?.slice(0, 500) ?? null;

  // Upsert by endpoint — re-subscribing from the same device replaces
  // any prior subscription (which might have been owned by a different
  // user on shared devices). userId on the row is the source of truth.
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId: session.userId,
      p256dh,
      auth,
      userAgent,
      failureCount: 0,
    },
    create: {
      userId: session.userId,
      endpoint,
      p256dh,
      auth,
      userAgent,
    },
    select: { id: true, endpoint: true },
  });

  return NextResponse.json({ ok: true, subscriptionId: sub.id });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  }
  // Only delete if the subscription belongs to this user — guards
  // against a forged DELETE wiping another user's row by endpoint guess.
  await prisma.pushSubscription
    .deleteMany({ where: { endpoint, userId: session.userId } })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
