/**
 * Voice Agent — voice preview. Speaks a short line in the chosen voice so the
 * user hears it before assigning it. Returns raw audio (mp3) to <audio>.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { ttsPreview } from "@/lib/voice-agent/xai-phone";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { voiceId, text } = await request.json();
  if (!voiceId) return NextResponse.json({ error: "No voice" }, { status: 400 });

  const line = String(text || "Thanks for calling — how can I help you today?").slice(0, 200);
  const r = await ttsPreview(voiceId, line);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });

  return new NextResponse(new Uint8Array(r.audio), {
    headers: { "Content-Type": r.contentType, "Cache-Control": "private, max-age=300" },
  });
}
