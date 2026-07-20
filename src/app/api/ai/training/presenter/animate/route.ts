import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { heygenClient } from "@/lib/ai/heygen-client";
import { downloadS3ObjectToBuffer, uploadToS3 } from "@/lib/utils/s3-client";
import { creditService } from "@/lib/credits";
import { nanoid } from "nanoid";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 300; // a short HeyGen clip renders in a couple of minutes
const AI_COST = 45; // one short talking-photo render (HeyGen PAYG)
// A neutral ~12s line — the clip is played MUTED + looped purely for MOTION; the
// presenter's cloned-voice narration plays over it.
const LOOP_SCRIPT = "Hi everyone, I'm really glad you could join us today. Let's take our time, keep things clear and practical, and make the most of our session together.";

/**
 * POST /api/ai/training/presenter/animate — turn the presenter's portrait into a
 * reusable ~12s LOOPING avatar clip (HeyGen talking-photo), so the co-host MOVES in the
 * live room instead of being a still photo. { presenterId }. [[training-studio]]
 * [[avatar-studio-heygen]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  if (!heygenClient.isAvailable()) return err("The avatar engine isn't configured in this environment", 503);

  const body = (await request.json().catch(() => ({}))) as { presenterId?: string };
  if (!body.presenterId) return err("Nothing to animate");

  const presenter = await prisma.presenterProfile.findFirst({ where: { id: body.presenterId, userId: session.userId }, select: { id: true, portraitUrl: true, talkingPhotoId: true } });
  if (!presenter) return err("That presenter no longer exists", 404);
  if (!presenter.portraitUrl) return err("Upload a presenter photo first");

  const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: AI_COST, description: "Training Room: presenter avatar loop", referenceType: "presenter_animate", referenceId: presenter.id });
  if (!charge.success) return err(charge.error || "Not enough credits to animate the presenter", 402);

  try {
    // 1. a reusable talking_photo id for the portrait (upload once)
    let talkingPhotoId = presenter.talkingPhotoId;
    if (!talkingPhotoId) {
      const buf = await downloadS3ObjectToBuffer(presenter.portraitUrl);
      const mime = /\.png($|\?)/i.test(presenter.portraitUrl) ? "image/png" : /\.webp($|\?)/i.test(presenter.portraitUrl) ? "image/webp" : "image/jpeg";
      const up = await heygenClient.uploadTalkingPhoto(buf, mime);
      talkingPhotoId = up.id;
    }

    // 2. a HeyGen voice is required by the API even though we mute the clip
    const voices = await heygenClient.listVoices().catch(() => []);
    const voiceId = voices[0]?.id;
    if (!voiceId) throw new Error("no HeyGen voice available");

    // 3. render + download the looping motion clip
    const result = await heygenClient.generateAvatarVideo({ avatarId: talkingPhotoId, voiceId, script: LOOP_SCRIPT, aspect: "16:9", quality: "avatar_iv" });
    const loopVideoUrl = await uploadToS3(`presenters/${session.userId}/loop-${nanoid(8)}.mp4`, result.videoBuffer, "video/mp4");

    const updated = await prisma.presenterProfile.update({ where: { id: presenter.id }, data: { talkingPhotoId, loopVideoUrl }, select: { id: true, loopVideoUrl: true } });
    return NextResponse.json({ success: true, data: { presenterId: updated.id, loopVideoUrl: updated.loopVideoUrl } });
  } catch (e) {
    await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: AI_COST, description: "Refund: presenter avatar failed", referenceType: "presenter_animate", referenceId: presenter.id }).catch(() => {});
    return err(e instanceof Error && /photo|face|detect/i.test(e.message) ? "Couldn't build a moving avatar from that photo — try a clear, front-facing portrait" : "Couldn't animate the presenter — try again", 502);
  }
}
