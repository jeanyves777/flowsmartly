import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateVideoForRole } from "@/lib/ai/video-router";
import { downloadS3ObjectToBuffer, uploadToS3 } from "@/lib/utils/s3-client";
import { creditService } from "@/lib/credits";
import { nanoid } from "nanoid";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 300;
const AI_COST = 60; // one short looping "moving avatar" render (xAI/Grok — per-render, NO avatar cap)

// A subtle IDLE-motion loop: the presenter looks alive in the corner tile while the cloned
// voice narrates. Silent — it's muted in the room.
const LOOP_PROMPT = "A professional presenter standing still and looking at the camera with a warm, natural expression — subtle idle motion: gentle breathing, small head movements, a soft blink, relaxed shoulders. NOT talking, NOT big gestures. Upper body visible, clean modern studio background, soft lighting, photoreal, high quality.";

/**
 * POST /api/ai/training/presenter/animate — turn the presenter's portrait into a reusable
 * SILENT looping "moving avatar" clip, so the co-host looks alive in the small room tile
 * (the cloned-voice narration plays over it). Uses the xAI/Grok video route — per-render, so
 * it works for every customer with NO avatar cap. { presenterId }. [[training-studio]]
 * [[video-suite-4-playgrounds]] [[training-presenter-talking-video]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const { presenterId } = (await request.json().catch(() => ({}))) as { presenterId?: string };
  if (!presenterId) return err("Nothing to animate");

  const presenter = await prisma.presenterProfile.findFirst({ where: { id: presenterId, userId: session.userId }, select: { id: true, portraitUrl: true } });
  if (!presenter) return err("That presenter no longer exists", 404);
  if (!presenter.portraitUrl) return err("Add a presenter photo first");

  const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: AI_COST, description: "Training Room: presenter avatar loop", referenceType: "presenter_animate", referenceId: presenter.id });
  if (!charge.success) return err(charge.error || "Not enough credits to animate the presenter", 402);

  try {
    // a FRESH copy of the photo so the video provider gets a valid (non-expired) URL
    const buf = await downloadS3ObjectToBuffer(presenter.portraitUrl);
    const mime = /\.png($|\?)/i.test(presenter.portraitUrl) ? "image/png" : /\.webp($|\?)/i.test(presenter.portraitUrl) ? "image/webp" : "image/jpeg";
    const refUrl = await uploadToS3(`presenters/${session.userId}/ref-${nanoid(6)}.${mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg"}`, buf, mime);

    const result = await generateVideoForRole("video_standard", {
      prompt: LOOP_PROMPT,
      durationSeconds: 6,
      aspectRatio: "16:9",
      characterReferenceUrls: [refUrl],
      disableAudio: true,
    });
    if (!result.videoBuffer?.length) throw new Error("empty video");

    const loopVideoUrl = await uploadToS3(`presenters/${session.userId}/loop-${nanoid(8)}.mp4`, result.videoBuffer, "video/mp4");
    const updated = await prisma.presenterProfile.update({ where: { id: presenter.id }, data: { loopVideoUrl }, select: { id: true, loopVideoUrl: true } });
    return NextResponse.json({ success: true, data: { presenterId: updated.id, loopVideoUrl: updated.loopVideoUrl } });
  } catch (e) {
    console.error("[animate] failed:", e instanceof Error ? e.message : e);
    await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: AI_COST, description: "Refund: presenter avatar failed", referenceType: "presenter_animate", referenceId: presenter.id }).catch(() => {});
    return err(e instanceof Error && /face|photo|reference/i.test(e.message) ? "Couldn't build a moving avatar from that photo — try a clear, front-facing portrait" : "Couldn't animate the presenter — try again", 502);
  }
}
