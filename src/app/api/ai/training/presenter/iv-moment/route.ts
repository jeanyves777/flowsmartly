import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateVideoForRole } from "@/lib/ai/video-router";
import { synthesize } from "@/lib/training/narration";
import { parseDeck } from "@/lib/training/deck";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { downloadS3ObjectToBuffer, uploadToS3 } from "@/lib/utils/s3-client";
import { creditService } from "@/lib/credits";
import { nanoid } from "nanoid";
import type { TrainingDeck } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 300;
const MOMENT_COST = 90; // one short "talking presenter" video render (xAI/Grok — per-render, NO avatar cap)
export function ivMomentCost(): number { return MOMENT_COST; }

// A talking-presenter clip: the person from their photo, speaking to camera. The clip is
// rendered SILENT then the CLONED voice is muxed in, so it plays as a real talking video.
const PROMPTS = {
  intro: "A confident, friendly professional presenter speaking directly to the camera, warmly welcoming an audience — natural talking mouth movement, expressive but subtle hand gestures, genuine smile, upper body visible, standing. Clean modern studio background, soft cinematic lighting, photoreal, high quality. NOT a static talking head.",
  outro: "A warm, professional presenter speaking directly to the camera, wrapping up and thanking the audience — natural talking mouth movement, an appreciative hand gesture, confident smile, upper body visible. Clean modern studio background, soft cinematic lighting, photoreal, high quality.",
  moment: "A professional presenter speaking directly to the camera in a natural, engaging way — talking mouth movement, warm expression, light hand gestures, upper body visible. Clean modern studio background, soft cinematic lighting, photoreal, high quality.",
};

function scriptFor(which: "intro" | "outro" | "moment", who: string, nextTitle?: string): string {
  const name = who.trim().split(/\s+/)[0] || "your co-host";
  if (which === "intro") return `Hi everyone, I'm ${name}, your A I co-host for today. I'm really glad you're here — let's take our time, keep it practical, and get the most out of our session together. Let's dive in.`;
  if (which === "outro") return `And that's everything I planned to share today. Thank you so much for being here and staying engaged — take these ideas and put them to work. I'll see you next time.`;
  return nextTitle
    ? `Great — let's take a quick breath and connect what we've covered. Coming up next: ${nextTitle}. Stay with me.`
    : `Great — let's take a quick breath and connect what we've covered so far. Alright, let's keep going.`;
}

/** Loop the silent talking clip to the length of the cloned-voice audio and mux them, so the
 *  moment plays as ONE video with the presenter's real voice. Falls back to the raw silent
 *  clip if ffmpeg isn't available. */
async function muxVoice(videoBuffer: Buffer, audioBuffer: Buffer): Promise<Buffer> {
  const ffmpeg = findFFmpegPath();
  if (!ffmpeg) return videoBuffer;
  const dir = await mkdtemp(join(tmpdir(), "moment-"));
  const vin = join(dir, "v.mp4"), ain = join(dir, "a.mp3"), out = join(dir, "out.mp4");
  try {
    await writeFile(vin, videoBuffer);
    await writeFile(ain, audioBuffer);
    await new Promise<void>((resolve, reject) => {
      const p = spawn(ffmpeg, ["-y", "-stream_loop", "-1", "-i", vin, "-i", ain, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out]);
      let e = ""; p.stderr.on("data", (d) => (e += d));
      p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${e.slice(-200)}`))));
    });
    return await readFile(out);
  } finally {
    for (const f of [vin, ain, out]) await unlink(f).catch(() => {});
  }
}

/**
 * POST /api/ai/training/presenter/iv-moment — render a REAL "talking presenter" video for a
 * MOMENT (intro / outro / between-slide) from the presenter's photo, in their CLONED voice.
 * Uses the xAI/Grok video route (per-render, NO avatar cap — scales to every customer) +
 * muxes the cloned-voice audio in. Stored on the deck; the live room plays it with its own
 * audio. { materialId, target: "intro" | "outro" | <slideId> }.
 * [[training-presenter-talking-video]] [[video-suite-4-playgrounds]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const { materialId, target } = (await request.json().catch(() => ({}))) as { materialId?: string; target?: string };
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
  const script = scriptFor(which, presenter.name, nextTitle);

  const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: MOMENT_COST, description: `Training Room: presenter ${which} video`, referenceType: "presenter_iv_moment", referenceId: mat.id });
  if (!charge.success) return err(charge.error || "Not enough credits to generate that", 402);

  try {
    // FRESH copy of the photo so the video provider gets a valid (non-expired) URL
    const buf = await downloadS3ObjectToBuffer(presenter.portraitUrl);
    const mime = /\.png($|\?)/i.test(presenter.portraitUrl) ? "image/png" : /\.webp($|\?)/i.test(presenter.portraitUrl) ? "image/webp" : "image/jpeg";
    const refUrl = await uploadToS3(`presenters/${session.userId}/ref-${nanoid(6)}.${mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg"}`, buf, mime);

    // the talking VISUAL + the cloned VOICE, in parallel
    const [rendered, spoken] = await Promise.all([
      generateVideoForRole("video_standard", { prompt: PROMPTS[which], durationSeconds: 8, aspectRatio: "16:9", characterReferenceUrls: [refUrl], disableAudio: true }),
      synthesize(script, voice, presenter.pace ?? 1, presenter.deliveryStyle ?? "conversational"),
    ]);
    if (!rendered.videoBuffer?.length) throw new Error("empty video");

    const finalBuffer = await muxVoice(rendered.videoBuffer, spoken.buffer);
    const videoUrl = await uploadToS3(`presenters/${session.userId}/moment-${nanoid(8)}.mp4`, finalBuffer, "video/mp4");

    if (target === "intro") deck.introVideoUrl = videoUrl;
    else if (target === "outro") deck.outroVideoUrl = videoUrl;
    else if (slideIdx >= 0) deck.slides[slideIdx] = { ...deck.slides[slideIdx], momentVideoUrl: videoUrl, momentScript: script };
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck) } });

    return NextResponse.json({ success: true, data: { target, videoUrl } });
  } catch (e) {
    console.error(`[iv-moment] ${target} failed:`, e instanceof Error ? e.message : e);
    await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: MOMENT_COST, description: "Refund: presenter video failed", referenceType: "presenter_iv_moment", referenceId: mat.id }).catch(() => {});
    return err(e instanceof Error && /face|photo|reference/i.test(e.message) ? "Couldn't build a talking video from that photo — try a clear, front-facing portrait" : "Couldn't render the presenter video — try again", 502);
  }
}
