import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { heygenClient } from "@/lib/ai/heygen-client";
import { synthesize } from "@/lib/training/narration";
import { parseDeck } from "@/lib/training/deck";
import { downloadS3ObjectToBuffer, uploadToS3 } from "@/lib/utils/s3-client";
import { creditService } from "@/lib/credits";
import { nanoid } from "nanoid";
import type { TrainingDeck } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 300; // one short Avatar IV clip renders in a couple of minutes

// 0.3 credits/sec is HeyGen's Avatar IV rate; add our service markup, floor at a few credits.
const COST_PER_SEC = 0.5; // 0.3 + markup
export function ivMomentCost(seconds: number): number { return Math.max(4, Math.ceil(seconds * COST_PER_SEC)); }

/** The spoken line for each on-screen moment. Kept warm + short (these are ~10-14s clips). */
function scriptFor(target: string, deck: TrainingDeck, presenterName: string, nextTitle?: string): string {
  const who = (presenterName || "").trim().split(/\s+/)[0] || "your co-host";
  if (target === "intro") return `Hi everyone, I'm ${who}, your A I co-host for today. I'm really glad you're here — let's take our time, keep it practical, and get the most out of our session together. Let's dive in.`;
  if (target === "outro") return `And that's everything I planned to share today. Thank you so much for being here and staying engaged — take these ideas and put them to work. I'll see you next time.`;
  // a between-slide bridge (contextual if we know what's next)
  return nextTitle
    ? `Great — let's take a quick breath and connect what we've covered. Coming up next: ${nextTitle}. Stay with me.`
    : `Great — let's take a quick breath and connect what we've covered so far. Alright, let's keep going.`;
}

/**
 * POST /api/ai/training/presenter/iv-moment — render ONE realistic Avatar IV talking video
 * for a presenter MOMENT (the intro, the outro, or a between-slide "moment"), in the
 * presenter's CLONED voice (audio-driven Avatar IV). Stores it on the deck so the live room
 * plays it WITH audio at that moment. { materialId, target: "intro" | "outro" | <slideId> }.
 * [[training-presenter-talking-video]] [[avatar-studio-heygen]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  if (!heygenClient.isAvailable()) return err("The presenter video engine isn't configured here", 503);

  const { materialId, target } = (await request.json().catch(() => ({}))) as { materialId?: string; target?: string };
  if (!materialId || !target) return err("Nothing to generate");

  const mat = await prisma.trainingMaterial.findFirst({
    where: { id: materialId, session: { userId: session.userId } },
    select: { id: true, deck: true },
  });
  if (!mat?.deck) return err("That deck no longer exists", 404);
  const deck = parseDeck(mat.deck);
  if (!deck.presenterId) return err("Add an AI presenter first");

  const presenter = await prisma.presenterProfile.findFirst({
    where: { id: deck.presenterId, userId: session.userId },
    select: { name: true, portraitUrl: true, talkingPhotoId: true, deliveryStyle: true, pace: true, voiceProfileId: true },
  });
  if (!presenter?.portraitUrl) return err("Add a presenter photo first");
  const voice = presenter.voiceProfileId
    ? await prisma.voiceProfile.findFirst({ where: { id: presenter.voiceProfileId, userId: session.userId }, select: { openaiVoiceId: true, elevenLabsVoiceId: true } })
    : null;

  // Which slide (for a between-slide moment) + the line to speak.
  const slideIdx = deck.slides.findIndex((s) => s.id === target);
  const nextTitle = slideIdx >= 0 ? deck.slides.slice(slideIdx + 1).find((s) => !s.presenterMoment && !s.intro && !s.qa && !s.quiz)?.title : undefined;
  const script = scriptFor(target, deck, presenter.name, nextTitle);

  // Charge an estimate up front (~13s), reconcile after we know the real duration.
  const estCharge = ivMomentCost(13);
  const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: estCharge, description: `Training Room: presenter ${target === "intro" || target === "outro" ? target : "moment"} video`, referenceType: "presenter_iv_moment", referenceId: mat.id });
  if (!charge.success) return err(charge.error || "Not enough credits to generate that", 402);
  const refund = async (n: number) => { if (n > 0) await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: n, description: "Refund: unused presenter video credits", referenceType: "presenter_iv_moment", referenceId: mat.id }).catch(() => {}); };

  try {
    // 1. a reusable talking_photo id for the portrait
    let talkingPhotoId = presenter.talkingPhotoId;
    if (!talkingPhotoId) {
      const buf = await downloadS3ObjectToBuffer(presenter.portraitUrl);
      const mime = /\.png($|\?)/i.test(presenter.portraitUrl) ? "image/png" : /\.webp($|\?)/i.test(presenter.portraitUrl) ? "image/webp" : "image/jpeg";
      talkingPhotoId = (await heygenClient.uploadTalkingPhoto(buf, mime)).id;
      await prisma.presenterProfile.update({ where: { id: deck.presenterId }, data: { talkingPhotoId } }).catch(() => {});
    }

    // 2. synth the line in the CLONED voice → upload so Avatar IV can lip-sync to it
    const spoken = await synthesize(script, voice, presenter.pace ?? 1, presenter.deliveryStyle ?? "conversational");
    const audioUrl = await uploadToS3(`presenters/${session.userId}/moment-audio-${nanoid(6)}.mp3`, spoken.buffer, "audio/mpeg");

    // 3. realistic Avatar IV video, audio-driven (real voice + IV motion)
    const result = await heygenClient.generateAvatarVideo({ avatarId: talkingPhotoId, voiceId: "", script, audioUrl, aspect: "16:9", quality: "avatar_iv" });
    const videoUrl = await uploadToS3(`presenters/${session.userId}/moment-${nanoid(8)}.mp4`, result.videoBuffer, "video/mp4");

    // reconcile the charge to the real clip length
    const realSec = result.duration || Math.round(spoken.durationMs / 1000) || 13;
    await refund(estCharge - ivMomentCost(realSec));

    // 4. store on the deck
    if (target === "intro") deck.introVideoUrl = videoUrl;
    else if (target === "outro") deck.outroVideoUrl = videoUrl;
    else if (slideIdx >= 0) { deck.slides[slideIdx] = { ...deck.slides[slideIdx], momentVideoUrl: videoUrl, momentScript: script }; }
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck) } });

    return NextResponse.json({ success: true, data: { target, videoUrl } });
  } catch (e) {
    console.error("[iv-moment] failed:", e instanceof Error ? e.message : e);
    await refund(estCharge);
    return err(e instanceof Error && /photo|face|detect/i.test(e.message) ? "Couldn't build a talking video from that photo — try a clear, front-facing portrait" : "Couldn't render the presenter video — try again", 502);
  }
}
