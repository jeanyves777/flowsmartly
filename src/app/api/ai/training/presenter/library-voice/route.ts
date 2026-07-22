import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * POST /api/ai/training/presenter/library-voice — assign a voice picked from the browsable
 * ElevenLabs library to the co-host. Stores it as a normal VoiceProfile (elevenLabsVoiceId =
 * the shared voice_id) so it drives narration AND the HeyGen talking-video interventions with
 * one identity. The voice is used by id directly (no "add"), so it consumes no voice slot.
 * { voiceId, name, gender?, accent? }. [[training-presenter-talking-video]] [[voice-studio]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const { voiceId, name, gender, accent } = (await request.json().catch(() => ({}))) as {
    voiceId?: string; name?: string; gender?: string; accent?: string;
  };
  if (!voiceId || !/^[A-Za-z0-9]{12,40}$/.test(voiceId)) return err("No voice selected");

  const existing = await prisma.voiceProfile.findFirst({
    where: { userId: session.userId, elevenLabsVoiceId: voiceId },
    select: { id: true, name: true },
  });
  if (existing) return NextResponse.json({ success: true, data: { voiceProfileId: existing.id, voiceName: existing.name } });

  const created = await prisma.voiceProfile.create({
    data: {
      userId: session.userId,
      name: (name || "Library voice").slice(0, 60),
      type: "library",
      gender: gender ? gender.slice(0, 20) : null,
      accent: accent ? accent.slice(0, 40) : null,
      style: "professional",
      elevenLabsVoiceId: voiceId,
    },
    select: { id: true, name: true },
  });
  return NextResponse.json({ success: true, data: { voiceProfileId: created.id, voiceName: created.name } });
}
