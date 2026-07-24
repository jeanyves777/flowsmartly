import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { heygenClient } from "@/lib/ai/heygen-client";
import { synthesize } from "@/lib/training/narration";
import { parseDeck } from "@/lib/training/deck";
import { downloadS3ObjectToBuffer, uploadToS3 } from "@/lib/utils/s3-client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost, DEFAULT_CREDIT_COSTS } from "@/lib/credits/costs";
import { nanoid } from "nanoid";
import sharp from "sharp";
import type { TrainingDeck } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 300;

// HeyGen Avatar IV lip-sync is variable-length, so the live charge scales with the
// spoken duration off the (admin-tunable) per-30s AI_AVATAR_VIDEO_PREMIUM key. This
// sync helper returns a typical ~15s estimate for the client's cost preview.
export function ivMomentCost(): number {
  return Math.max(1, Math.ceil((15 / 30) * DEFAULT_CREDIT_COSTS.AI_AVATAR_VIDEO_PREMIUM));
}

function scriptFor(which: "intro" | "outro" | "moment", who: string, nextTitle?: string): string {
  const name = who.trim().split(/\s+/)[0] || "your co-host";
  if (which === "intro") return `Hi everyone, I'm ${name}, your A I co-host for today. I'm really glad you're here — let's take our time, keep it practical, and get the most out of our session together. Let's dive in.`;
  if (which === "outro") return `And that's everything I planned to share today. Thank you so much for being here and staying engaged — take these ideas and put them to work. I'll see you next time.`;
  return nextTitle
    ? `Great — let's take a quick breath and connect what we've covered. Coming up next: ${nextTitle}. Stay with me.`
    : `Great — let's take a quick breath and connect what we've covered so far. Alright, let's keep going.`;
}

/**
 * POST /api/ai/training/presenter/iv-moment — render a REAL "talking presenter" video for a
 * MOMENT (intro / outro / between-slide) so the co-host actually SPEAKS the line, photoreal
 * and lip-synced, in their CLONED voice.
 *
 * Path: synthesize the line in the cloned voice → HeyGen **Avatar IV, audio-driven** (v3
 * `POST /videos`, `type: "image"` + `audio_url`). This lip-syncs the presenter's photo to the
 * cloned-voice audio and consumes ZERO photo-avatar quota (no reusable avatar is created), so
 * it scales to every customer with no 3-avatar cap. Stored on the deck; the live room plays it
 * with its own baked audio. { materialId, target: "intro" | "outro" | <slideId> }.
 * [[training-presenter-talking-video]] [[heygen-api-constraints]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  if (!heygenClient.isAvailable()) return err("The presenter video service isn't configured right now — please try again shortly.", 503);

  const { materialId, target, mode } = (await request.json().catch(() => ({}))) as { materialId?: string; target?: string; mode?: string };
  if (!materialId || !target) return err("Nothing to generate");

  const mat = await prisma.trainingMaterial.findFirst({ where: { id: materialId, session: { userId: session.userId } }, select: { id: true, deck: true } });
  if (!mat?.deck) return err("That deck no longer exists", 404);
  const deck: TrainingDeck = parseDeck(mat.deck);
  if (!deck.presenterId) return err("Add an AI presenter first");

  const presenter = await prisma.presenterProfile.findFirst({ where: { id: deck.presenterId, userId: session.userId }, select: { name: true, portraitUrl: true, deliveryStyle: true, pace: true, voiceProfileId: true } });
  if (!presenter?.portraitUrl) return err("Add a presenter photo first");
  const voice = presenter.voiceProfileId
    ? await prisma.voiceProfile.findFirst({ where: { id: presenter.voiceProfileId, userId: session.userId }, select: { openaiVoiceId: true, elevenLabsVoiceId: true } })
    : null;

  const slideIdx = deck.slides.findIndex((s) => s.id === target);
  const which: "intro" | "outro" | "moment" = target === "intro" ? "intro" : target === "outro" ? "outro" : "moment";
  const nextTitle = slideIdx >= 0 ? deck.slides.slice(slideIdx + 1).find((s) => !s.presenterMoment && !s.intro && !s.qa && !s.quiz)?.title : undefined;
  // Co-host video for a CONTENT slide: the co-host narrates the WHOLE slide, so the script is the
  // slide's own narration (or its teaching points if it isn't voiced yet), not a short bridge line.
  const cohostMode = mode === "cohost" && slideIdx >= 0;
  const cslide = slideIdx >= 0 ? deck.slides[slideIdx] : null;
  const script = cohostMode
    ? ((cslide?.narration?.text || `${cslide?.title || ""}. ${(cslide?.bullets || []).join(". ")}. ${cslide?.notes || ""}`).replace(/\s+/g, " ").trim().slice(0, 4000) || scriptFor("moment", presenter.name))
    : scriptFor(which, presenter.name, nextTitle);

  // HeyGen Avatar IV audio-driven lip-sync (~$0.067/sec) — was a hardcoded flat 90.
  // Charge by the spoken duration off the properly-priced per-30s Avatar IV key,
  // so a short intro isn't billed like a full 30s clip and a long one isn't underwater.
  const estSeconds = Math.max(6, Math.min(60, Math.round(script.length / 15)));
  const per30 = await getDynamicCreditCost("AI_AVATAR_VIDEO_PREMIUM");
  const MOMENT_COST = Math.max(1, Math.ceil((estSeconds / 30) * per30));
  const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: MOMENT_COST, description: `Training Room: presenter ${which} video`, referenceType: "presenter_iv_moment", referenceId: mat.id });
  if (!charge.success) return err(charge.error || "Not enough credits to generate that", 402);

  try {
    // The presenter's CLONED voice speaks the line — this audio drives the lip-sync.
    const spoken = await synthesize(script, voice, presenter.pace ?? 1, presenter.deliveryStyle ?? "conversational");
    const audioUrl = await uploadToS3(`presenters/${session.userId}/moment-audio-${nanoid(6)}.mp3`, spoken.buffer, "audio/mpeg");

    // A FRESH copy of the photo — REFRAMED to 16:9 anchored at the TOP. HeyGen renders a 16:9
    // video and, given a square / portrait photo, crops the MIDDLE band — which slices the top of
    // the head off. Pre-cropping to 16:9 keeping the top means the full head + headroom survive
    // (a natural talking-head medium shot). Verified on a real 1024×1024 portrait. An already-16:9
    // photo is unchanged (cover on same aspect = no crop). [[training-presenter-talking-video]]
    const raw = await downloadS3ObjectToBuffer(presenter.portraitUrl);
    let buf = raw;
    try { buf = await sharp(raw).resize(1280, 720, { fit: "cover", position: "top" }).jpeg({ quality: 92 }).toBuffer(); }
    catch (e) { console.error("[iv-moment] portrait reframe failed, using original:", e instanceof Error ? e.message : e); buf = raw; }
    const imageUrl = await uploadToS3(`presenters/${session.userId}/ref-${nanoid(6)}.jpg`, buf, "image/jpeg");

    // Avatar IV, audio-driven: the presenter's photo, lip-synced to the cloned voice. No avatar
    // quota consumed (v3 image→video), so this scales to every customer.
    const result = await heygenClient.generateImageToVideo({
      imageUrl,
      audioUrl,
      title: `Training presenter ${which}`,
      estimatedSeconds: Math.max(6, Math.round((spoken.durationMs || 12000) / 1000)),
    });
    if (!result.videoBuffer?.length) throw new Error("empty video");

    const videoUrl = await uploadToS3(`presenters/${session.userId}/moment-${nanoid(8)}.mp4`, result.videoBuffer, "video/mp4");

    if (target === "intro") deck.introVideoUrl = videoUrl;
    else if (target === "outro") deck.outroVideoUrl = videoUrl;
    else if (cohostMode && slideIdx >= 0) deck.slides[slideIdx] = { ...deck.slides[slideIdx], cohostVideoUrl: videoUrl };
    else if (slideIdx >= 0) deck.slides[slideIdx] = { ...deck.slides[slideIdx], momentVideoUrl: videoUrl, momentScript: script };
    deck.voiceKey = presenter.voiceProfileId ?? null; // this video speaks in the presenter's current voice
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck) } });

    // Save to the reusable clip library (best-effort — never blocks the response), tagged by kind so
    // the picker filters per kind: intro / outro / moment / cohost (a full-slide narration video).
    await prisma.presenterClip.create({ data: {
      userId: session.userId,
      presenterId: deck.presenterId,
      kind: cohostMode ? "cohost" : which,
      videoUrl,
      thumbnailUrl: result.thumbnailUrl ?? null,
      voiceProfileId: presenter.voiceProfileId ?? null,
      presenterName: presenter.name ?? null,
      script,
      durationMs: spoken.durationMs ?? null,
    } }).catch((e) => console.error("[iv-moment] clip-library save failed:", e instanceof Error ? e.message : e));

    // return the FULL deck so the client sets it verbatim (no local merge that could drop the URL).
    return NextResponse.json({ success: true, data: { target, videoUrl, deck } });
  } catch (e) {
    console.error(`[iv-moment] ${target} failed:`, e instanceof Error ? e.message : e);
    await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: MOMENT_COST, description: "Refund: presenter video failed", referenceType: "presenter_iv_moment", referenceId: mat.id }).catch(() => {});
    return err(e instanceof Error && /face|photo|image|portrait/i.test(e.message) ? "Couldn't build a talking video from that photo — try a clear, front-facing portrait" : "Couldn't render the presenter video — try again", 502);
  }
}
