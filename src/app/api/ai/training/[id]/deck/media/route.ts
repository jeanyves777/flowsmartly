import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { parseDeck } from "@/lib/training/deck";
import { getSessionDTO } from "@/lib/training/session";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { nanoid } from "nanoid";
import type { TrainingDeck, VisualType } from "@/lib/training/types";

const err = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });

export const maxDuration = 120;

const OK_IMAGE = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const OK_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMG = 12 * 1024 * 1024, MAX_VID = 80 * 1024 * 1024;

const typeForStyle = (style?: string): VisualType => (style === "3d" ? "3d" : style === "illustration" ? "illustration" : "photo");

/**
 * POST /api/ai/training/[id]/deck/media — manage a doc slide's visual.
 *  - multipart/form-data { file, materialId, slideId } → upload the user's OWN image or video
 *    (a video replaces the image and plays as the slide's visual).
 *  - application/json { materialId, slideId, action: "regenerate_image", instruction? } →
 *    generate a fresh image for the slide (unique key so caches don't replay the old one).
 * Returns the updated session so the media lands in place. [[training-studio]]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;
  const ct = request.headers.get("content-type") || "";

  const load = async (materialId: string, slideId: string) => {
    const mat = await prisma.trainingMaterial.findFirst({ where: { id: materialId, session: { id, userId: session.userId } }, select: { id: true, deck: true } });
    if (!mat?.deck) return null;
    const deck: TrainingDeck = parseDeck(mat.deck);
    const idx = deck.slides.findIndex((s) => s.id === slideId);
    if (idx < 0) return null;
    return { mat, deck, idx };
  };

  // ---- upload your own image / video ----
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const materialId = String(form?.get("materialId") || ""), slideId = String(form?.get("slideId") || "");
    if (!(file instanceof File)) return err("No file");
    const isVideo = OK_VIDEO.includes(file.type), isImage = OK_IMAGE.includes(file.type);
    if (!isVideo && !isImage) return err("Upload an image (PNG / JPG / WEBP) or a video (MP4 / WEBM)");
    if (file.size > (isVideo ? MAX_VID : MAX_IMG)) return err(`That ${isVideo ? "video" : "image"} is too big (max ${isVideo ? "80" : "12"}MB)`);
    const loaded = await load(materialId, slideId);
    if (!loaded) return err("That slide no longer exists", 404);
    const { mat, deck, idx } = loaded, slide = deck.slides[idx];
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = isVideo ? (file.type.includes("webm") ? "webm" : file.type.includes("quicktime") ? "mov" : "mp4") : (file.type.split("/")[1] || "png");
    const url = await uploadToS3(`training/${id}/media/${slideId}-${nanoid(8)}.${ext}`, buffer, file.type);
    // target=moment → attach the uploaded video as this slide's PRESENTER-MOMENT talking video
    // (plays full-screen with its own audio), not the slide's background visual.
    const target = String(form?.get("target") || "");
    deck.slides[idx] = isVideo && target === "moment"
      ? { ...slide, momentVideoUrl: url }
      : isVideo
      ? { ...slide, videoUrl: url, visualType: "video" }
      : { ...slide, visual: { ...(slide.visual ?? { kind: "image" }), kind: "image", url, tag: slide.visual?.tag ?? "Photo" }, videoUrl: undefined, visualType: typeForStyle(slide.visual?.style) };
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck) } });
    return NextResponse.json({ success: true, data: { slideId, url, kind: isVideo ? "video" : "image", session: await getSessionDTO(id) } });
  }

  // ---- regenerate the image with AI ----
  const body = (await request.json().catch(() => ({}))) as { materialId?: string; slideId?: string; action?: string; instruction?: string };
  if (body.action !== "regenerate_image") return err("Unknown action");
  const loaded = await load(body.materialId || "", body.slideId || "");
  if (!loaded) return err("That slide no longer exists", 404);
  const { mat, deck, idx } = loaded, slide = deck.slides[idx];
  const base = (slide.visual?.prompt || `${slide.title}. ${slide.subtitle || ""}`).slice(0, 300);
  const style = slide.visual?.style;
  const full = `${body.instruction ? body.instruction.trim() + ". " : ""}${base}. ${style === "3d" ? "A premium 3D render, Octane/Pixar quality, glossy materials, cinematic studio lighting." : style === "illustration" ? "A polished modern editorial illustration, clean vector shapes." : "Hyper-realistic professional photography, natural lighting, shallow depth of field."} No text, no watermark. variation ${Math.random().toString(36).slice(2, 8)}`;

  const COST = Math.max(1, await getDynamicCreditCost("TRAINING_DECK_IMAGE"));
  const charge = await creditService.deductCredits({ userId: session.userId, type: "USAGE", amount: COST, description: "Training Room: regenerate slide image", referenceType: "training_deck_image", referenceId: mat.id });
  if (!charge.success) return err(charge.error || "Not enough credits to regenerate the image", 402);
  try {
    const result = await generateImageXaiFirst(full, 1280, 720, { quality: "medium" });
    if (!result.base64) throw new Error("no image");
    const url = await uploadToS3(`training/${id}/media/${slide.id}-img-${nanoid(8)}.png`, Buffer.from(result.base64, "base64"), "image/png");
    deck.slides[idx] = { ...slide, visual: { ...(slide.visual ?? { kind: "image" }), kind: "image", url, prompt: base }, videoUrl: undefined, visualType: typeForStyle(style) };
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck) } });
    return NextResponse.json({ success: true, data: { slideId: slide.id, url, session: await getSessionDTO(id) } });
  } catch (e) {
    console.error("[deck-media] image regen failed:", e instanceof Error ? e.message : e);
    await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: COST, description: "Refund: image regen failed", referenceType: "training_deck_image", referenceId: mat.id }).catch(() => {});
    return err("Couldn't regenerate the image — try again", 502);
  }
}
