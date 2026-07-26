/**
 * Live status of an in-progress outbound call, for the in-call session UI.
 *
 * The dialer places the call (POST …/outbound → conversationId), then polls here
 * every couple of seconds. We read the ElevenLabs conversation and return its
 * status, duration and transcript-so-far, so the session shows Dialing → In call
 * → Ended with the turns streaming in. Best-effort: if EL hasn't materialised the
 * conversation yet, we report "pending" and the client keeps polling.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getConvaiConversation } from "@/lib/voice-agent/elevenlabs-convai";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;

  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ success: false, error: { message: "Missing conversationId" } }, { status: 400 });

  const agent = await prisma.voiceAgent.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
  if (!agent) return NextResponse.json({ success: false, error: { message: "Agent not found" } }, { status: 404 });

  const d = await getConvaiConversation(conversationId);
  if (!d.ok) {
    // Not materialised yet (call still connecting) — tell the client to keep polling.
    return NextResponse.json({ success: true, status: "pending", durationSec: 0, transcript: [], summary: null });
  }
  const data = d.data;
  const transcript = (data.transcript || [])
    .filter((t) => t.message)
    .map((t) => ({ role: t.role === "agent" ? "agent" : "caller", at: t.time_in_call_secs ?? 0, text: t.message }));

  return NextResponse.json({
    success: true,
    status: (data.status || "in-progress").toLowerCase(),
    durationSec: data.metadata?.call_duration_secs ?? 0,
    transcript,
    summary: data.analysis?.transcript_summary || null,
  });
}
