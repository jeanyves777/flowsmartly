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

  const { materialId, slideId } = (await request.json().catch(() => ({}))) as { materialId?: string; slideId?: string };
  if (!materialId || !slideId) return err("Nothing to generate");

  const mat = await prisma.trainingMaterial.findFirst({ where: { id: materialId, session: { id, userId: session.userId } }, select: { id: true, deck: true } });
  if (!mat?.deck) return err("That deck no longer exists", 404);
  const deck: TrainingDeck = parseDeck(mat.deck);
  const idx = deck.slides.findIndex((s) => s.id === slideId);
  if (idx < 0) return err("That slide isn't in the deck", 404);
  const prompt = (deck.slides[idx].videoPrompt || "").trim();
  if (!prompt) return err("This slide isn't a video demo");

  // ~15s Avatar-free demonstration clip (xAI Imagine direct) — the AI_VIDEO_CHEAP per-15s basis.
  const COST = Math.max(1, await getDynamicCreditCost("AI_VIDEO_CHEAP"));
  const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: COST, description: "Training Room: demonstration video", referenceType: "training_deck_video", referenceId: mat.id });
  if (!charge.success) return err(charge.error || "Not enough credits to generate the video", 402);

  try {
    const result = await generateVideoForRole("video_standard", {
      prompt: `${prompt}. A clean, modern, high-quality educational demonstration. Smooth motion, cinematic lighting, no text, no watermark, no captions.`,
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
