import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateWithClonedVoice as generateWithElevenLabs } from "@/lib/voice/elevenlabs-client";
import { generateWithClonedVoice as generateWithOpenAI } from "@/lib/voice/openai-voice-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { nanoid } from "nanoid";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 60;
// A natural line so the owner can compare the CLONE against their own voice.
const CLONE_TEXT = "Hi, this is my cloned voice. If this sounds just like me, we're ready to present together.";
// A neutral line for a ready-made STUDIO voice (it isn't the owner's own voice).
const STUDIO_TEXT = "Hi everyone, and welcome to today's training session. I'm your co-host, and I'll walk us through it together.";

/**
 * POST /api/ai/training/presenter/preview-voice — return a short sample SPOKEN BY THE
 * CLONE (not the original recording) so the owner can confirm the ElevenLabs/OpenAI clone
 * actually sounds like them before using it in a presentation. Cached on the profile
 * (previewUrl) so repeat auditions are instant. Free. { voiceProfileId }.
 * [[training-studio]] [[voice-studio]] [[elevenlabs-free-plan-blocks-clones]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const { voiceProfileId } = (await request.json().catch(() => ({}))) as { voiceProfileId?: string };
  if (!voiceProfileId) return err("No voice selected");

  const voice = await prisma.voiceProfile.findFirst({
    where: { id: voiceProfileId, userId: session.userId },
    select: { id: true, previewUrl: true, elevenLabsVoiceId: true, openaiVoiceId: true, type: true },
  });
  if (!voice) return err("That voice isn't available", 404);
  if (voice.previewUrl) return NextResponse.json({ success: true, data: { previewUrl: voice.previewUrl, cached: true } });
  if (!voice.elevenLabsVoiceId && !voice.openaiVoiceId) return err("That voice has no sample to preview");

  const previewText = voice.type === "studio" || voice.type === "library" ? STUDIO_TEXT : CLONE_TEXT;
  try {
    const buffer = voice.elevenLabsVoiceId
      ? await generateWithElevenLabs({ text: previewText, voiceId: voice.elevenLabsVoiceId })
      : await generateWithOpenAI({ text: previewText, voiceId: voice.openaiVoiceId! });
    const previewUrl = await uploadToS3(`voice-clones/${session.userId}/preview-${nanoid(8)}.mp3`, buffer, "audio/mpeg");
    await prisma.voiceProfile.update({ where: { id: voice.id }, data: { previewUrl } });
    return NextResponse.json({ success: true, data: { previewUrl, cached: false } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // surface the ElevenLabs plan gate plainly (the clone can't be voiced on this plan)
    if (/not available on your current plan|upgrade your subscription/i.test(msg)) {
      return err("Your voice plan can't play cloned voices yet — upgrade to hear the clone.", 402);
    }
    return err("Couldn't generate a preview of the cloned voice — try again", 502);
  }
}
