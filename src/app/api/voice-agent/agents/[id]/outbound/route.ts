/**
 * Place an outbound call from the agent's own number to a caller.
 *
 * The agent + its number must already be provisioned on ElevenLabs (Phase 2).
 * Until a carrier is configured, this returns a clear "no outbound number yet".
 */

import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { placeOutboundCall } from "@/lib/voice-agent/elevenlabs-telephony";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;

  const agent = await prisma.voiceAgent.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
  if (!agent) return NextResponse.json({ success: false, error: { message: "Agent not found" } }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const to = String((body as { toNumber?: string }).toNumber || "").trim();
  if (!/^\+[1-9]\d{7,14}$/.test(to)) {
    return NextResponse.json({ success: false, error: { message: "Enter the number to call in full international format." } }, { status: 400 });
  }

  const r = await placeOutboundCall(id, to);
  if (!r.ok) return NextResponse.json({ success: false, error: { message: r.error } }, { status: 400 });
  return NextResponse.json({ success: true, conversationId: r.conversationId });
}
