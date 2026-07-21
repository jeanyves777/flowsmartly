import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateVideoForRole } from "@/lib/ai/video-router";
import { downloadS3ObjectToBuffer, uploadToS3 } from "@/lib/utils/s3-client";
import { creditService } from "@/lib/credits";
import { nanoid } from "nanoid";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 300; // a single ~8s film renders in a couple of minutes
const AI_COST = 120; // one generated film (Veo/Grok, PAYG)

const PROMPTS = {
  intro: "A confident, friendly professional presenter warmly welcoming an audience to a training session. Natural, expressive HAND GESTURES, open body language, a genuine smile, looking directly at the camera. Upper and mid body visible, standing, with subtle natural movement — NOT a static talking head. Clean modern studio background, soft cinematic lighting, photoreal, high quality.",
  outro: "A warm, professional presenter wrapping up a training session — thanking the audience with an appreciative hand gesture and a confident smile, looking directly at the camera. Upper and mid body visible, natural expressive movement. Clean modern studio background, soft cinematic lighting, photoreal, high quality.",
};

/**
 * POST /api/ai/training/presenter/intro-video — generate a full-body, gesture-rich
 * INTRO or OUTRO film for the presenter, from their photo, via the film pipeline
 * (Veo/Grok) — NOT a talking-photo lip-sync. Audio-free so the cloned-voice narration
 * plays over it. { presenterId, kind: "intro" | "outro" }.
 * [[training-studio]] [[video-suite-4-playgrounds]] [[grok-video-caps-and-verify]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const { presenterId, kind } = (await request.json().catch(() => ({}))) as { presenterId?: string; kind?: "intro" | "outro" };
  const which: "intro" | "outro" = kind === "outro" ? "outro" : "intro";
  if (!presenterId) return err("Nothing to animate");

  const presenter = await prisma.presenterProfile.findFirst({ where: { id: presenterId, userId: session.userId }, select: { id: true, portraitUrl: true } });
  if (!presenter) return err("That presenter no longer exists", 404);
  if (!presenter.portraitUrl) return err("Add a presenter photo first");

  const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: AI_COST, description: `Training Room: presenter ${which} film`, referenceType: "presenter_intro_video", referenceId: presenter.id });
  if (!charge.success) return err(charge.error || "Not enough credits to generate the film", 402);

  try {
    // a FRESH copy of the photo so the video provider gets a valid (non-expired) URL
    const buf = await downloadS3ObjectToBuffer(presenter.portraitUrl);
    const mime = /\.png($|\?)/i.test(presenter.portraitUrl) ? "image/png" : /\.webp($|\?)/i.test(presenter.portraitUrl) ? "image/webp" : "image/jpeg";
    const refUrl = await uploadToS3(`presenters/${session.userId}/ref-${nanoid(6)}.${mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg"}`, buf, mime);

    const result = await generateVideoForRole("video_standard", {
      prompt: PROMPTS[which],
      durationSeconds: 8,
      aspectRatio: "16:9",
      characterReferenceUrls: [refUrl], // keep the presenter's likeness; prompt drives full body
      disableAudio: true,               // narration is the only audio; the clip is silent
    });
    if (!result.videoBuffer?.length) throw new Error("empty video");

    const url = await uploadToS3(`presenters/${session.userId}/${which}-${nanoid(8)}.mp4`, result.videoBuffer, "video/mp4");
    const updated = await prisma.presenterProfile.update({ where: { id: presenter.id }, data: which === "intro" ? { introVideoUrl: url } : { outroVideoUrl: url }, select: { introVideoUrl: true, outroVideoUrl: true } });
    return NextResponse.json({ success: true, data: { kind: which, url, introVideoUrl: updated.introVideoUrl, outroVideoUrl: updated.outroVideoUrl } });
  } catch (e) {
    await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: AI_COST, description: `Refund: presenter ${which} film failed`, referenceType: "presenter_intro_video", referenceId: presenter.id }).catch(() => {});
    return err(e instanceof Error && /face|photo|reference/i.test(e.message) ? "Couldn't build a film from that photo — try a clear, front-facing portrait" : `Couldn't generate the ${which} film — try again`, 502);
  }
}
