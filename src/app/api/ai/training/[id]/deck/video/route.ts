import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateVideoForRole } from "@/lib/ai/video-router";
import { parseDeck } from "@/lib/training/deck";
import { getSessionDTO } from "@/lib/training/session";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { nanoid } from "nanoid";
import type { TrainingDeck } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 300;

/**
 * POST /api/ai/training/[id]/deck/video — generate the short (~15s) DEMONSTRATION video for a
 * slide flagged as a video demo (slide.videoPrompt). A moving 3D/photoreal illustration of the
 * concept, rendered via the xAI/Grok video route (text-to-video, up to 15s). Stored on the slide
 * (videoUrl); the room + builder play it as the slide's visual. { materialId, slideId }.
 * [[training-studio]] [[video-suite-4-playgrounds]]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const { materialId, slideId, style } = (await request.json().catch(() => ({}))) as { materialId?: string; slideId?: string; style?: string };
  if (!materialId || !slideId) return err("Nothing to generate");

  const mat = await prisma.trainingMaterial.findFirst({ where: { id: materialId, session: { id, userId: session.userId } }, select: { id: true, deck: true } });
  if (!mat?.deck) return err("That deck no longer exists", 404);
  const deck: TrainingDeck = parseDeck(mat.deck);
  const idx = deck.slides.findIndex((s) => s.id === slideId);
  if (idx < 0) return err("That slide isn't in the deck", 404);
  const s = deck.slides[idx];
  // "Turn into AI video" works on ANY slide: use its videoPrompt if it has one, else derive from
  // the slide's visual / title so the user can animate any illustration. `style` flavours the look.
  const STYLE_FLAVOR: Record<string, string> = {
    "3d": "A premium 3D animated explainer, Octane/Pixar quality, glossy materials.",
    cinematic: "A cinematic live-action style shot, filmic lighting and depth of field.",
    realistic: "Photorealistic documentary footage, natural lighting.",
    illustration: "A moving editorial illustration, clean modern motion graphics.",
  };
  const prompt = ((s.videoPrompt || "").trim() || `${s.title}. ${s.subtitle || ""} ${s.visual?.prompt || ""}`.trim()).slice(0, 320);
  if (!prompt) return err("Add a title or visual to this slide first");
  const flavor = STYLE_FLAVOR[style ?? ""] || "";

  // ~15s Avatar-free demonstration clip (xAI Imagine direct) — the AI_VIDEO_CHEAP per-15s basis.
  const COST = Math.max(1, await getDynamicCreditCost("AI_VIDEO_CHEAP"));
  const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: COST, description: "Training Room: demonstration video", referenceType: "training_deck_video", referenceId: mat.id });
  if (!charge.success) return err(charge.error || "Not enough credits to generate the video", 402);

  try {
    const result = await generateVideoForRole("video_standard", {
      prompt: `${prompt}. ${flavor} A clean, modern, high-quality educational demonstration. Smooth motion, cinematic lighting, no text, no watermark, no captions.`,
      durationSeconds: 15,
      aspectRatio: "16:9",
    });
    if (!result.videoBuffer?.length) throw new Error("empty video");
    const videoUrl = await uploadToS3(`training/${id}/video/${slideId}-${nanoid(8)}.mp4`, result.videoBuffer, "video/mp4");

    deck.slides[idx] = { ...deck.slides[idx], videoUrl, visualType: "video" };
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck) } });
    return NextResponse.json({ success: true, data: { slideId, videoUrl, session: await getSessionDTO(id) } });
  } catch (e) {
    console.error("[deck-video] failed:", e instanceof Error ? e.message : e);
    await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: COST, description: "Refund: demonstration video failed", referenceType: "training_deck_video", referenceId: mat.id }).catch(() => {});
    return err("Couldn't render the demonstration video — try again", 502);
  }
}
