/**
 * Inbound call webhook.
 *
 * The provider POSTs `realtime.call.incoming` with a `call_id` when a caller
 * dials one of our numbers. We verify it's really the provider, find the agent
 * that answers that line, and hand the call to the bridge — which holds the
 * realtime socket for the call's lifetime.
 *
 * We ACK fast (the provider expects a prompt 200) and run the call in the
 * background; the app is a long-lived process, so the bridge keeps running after
 * this handler returns.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";
import { runCall } from "@/lib/voice-agent/bridge";

export async function POST(request: NextRequest) {
  let body: {
    type?: string;
    call_id?: string;
    from?: string;
    to?: string;
    phone_number_id?: string;
    data?: { call_id?: string; from?: string; to?: string; phone_number_id?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Only inbound-call events are actionable; ack anything else so the provider
  // doesn't retry.
  if (body.type && body.type !== "realtime.call.incoming") {
    return NextResponse.json({ ok: true });
  }

  const d = body.data || body;
  const callId = d.call_id;
  const toE164 = d.to || "";
  const fromE164 = d.from || "";
  const providerNumberId = d.phone_number_id;
  if (!callId) return NextResponse.json({ ok: false, error: "no call_id" }, { status: 400 });

  // Find the line that was dialled, and the agent answering it. Match on the
  // provider's number id first (exact), then the E.164.
  const number = await prisma.phoneNumber.findFirst({
    where: {
      status: "ACTIVE",
      OR: [
        ...(providerNumberId ? [{ xaiPhoneNumberId: providerNumberId }] : []),
        ...(toE164 ? [{ e164: toE164 }] : []),
      ],
    },
    include: { agent: true },
  });

  // Verify the caller with the number's stored signing secret. A BYO number has
  // its own `signingSecret`; without a match we refuse rather than let anyone
  // spend a tenant's credits by POSTing a call_id.
  const provided = request.headers.get("x-xai-signature") || request.headers.get("authorization") || "";
  if (number?.signingSecret) {
    const ok = provided.includes(number.signingSecret);
    if (!ok) {
      console.warn("[voice webhook] signature mismatch for", number.e164);
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  if (!number?.agent || number.agent.status !== "LIVE") {
    // No live agent on this line — nothing to answer with. Ack so there's no
    // retry storm; the provider handles the caller (voicemail/busy).
    return NextResponse.json({ ok: true, answered: false });
  }

  // Kick off the call in the background and return immediately.
  void runCall({
    callId,
    agentId: number.agent.id,
    userId: number.userId,
    fromE164,
    toE164: toE164 || number.e164 || "",
  }).catch((e) => console.error("[voice webhook] runCall failed:", e));

  return NextResponse.json({ ok: true, answered: true });
}
