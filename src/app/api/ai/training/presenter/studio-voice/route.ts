import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { STUDIO_VOICES, findStudioVoice } from "@/lib/training/studio-voices";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * GET  — the curated list of studio voices the co-host can use.
 * POST — assign a studio voice: upsert a VoiceProfile for the chosen ElevenLabs premade voice
 *        (deduped per user by elevenLabsVoiceId) and return its id, so the presenter can point
 *        its `voiceProfileId` at it. This is the OPTIONAL alternative to cloning your own voice;
 *        because it's a normal VoiceProfile (elevenLabsVoiceId), it drives narration AND the
 *        HeyGen talking-video interventions with one consistent identity.
 * [[training-presenter-talking-video]] [[voice-studio]]
 */
export async function GET() {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  return NextResponse.json({ success: true, data: { voices: STUDIO_VOICES } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const { voiceId } = (await request.json().catch(() => ({}))) as { voiceId?: string };
  if (!voiceId) return err("No voice selected");
  const studio = findStudioVoice(voiceId);
  if (!studio) return err("That studio voice isn't available");

  // Reuse an existing profile for this premade voice if the user already picked it before.
  const existing = await prisma.voiceProfile.findFirst({
    where: { userId: session.userId, elevenLabsVoiceId: studio.id },
    select: { id: true, name: true },
  });
  if (existing) return NextResponse.json({ success: true, data: { voiceProfileId: existing.id, voiceName: existing.name } });

  const created = await prisma.voiceProfile.create({
    data: {
      userId: session.userId,
      name: studio.name,
      type: "studio",
      gender: studio.gender,
      style: "professional",
      elevenLabsVoiceId: studio.id,
    },
    select: { id: true, name: true },
  });
  return NextResponse.json({ success: true, data: { voiceProfileId: created.id, voiceName: created.name } });
}
