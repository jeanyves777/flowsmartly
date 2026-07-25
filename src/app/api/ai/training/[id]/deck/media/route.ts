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
    // target=cover → a DECK-LEVEL cover image (intro/first-slide background + thumbnail + lobby),
    // not this slide's own visual. Only an image; a stray video falls through to the normal paths.
    if (!isVideo && target === "cover") {
      deck.coverImageUrl = url;
    } else {
      deck.slides[idx] = isVideo && target === "moment"
        ? { ...slide, momentVideoUrl: url }
        : isVideo && target === "cohost"
        ? { ...slide, cohostVideoUrl: url }
        : isVideo
        ? { ...slide, videoUrl: url, visualType: "video" }
        : { ...slide, visual: { ...(slide.visual ?? { kind: "image" }), kind: "image", url, tag: slide.visual?.tag ?? "Photo" }, videoUrl: undefined, visualType: typeForStyle(slide.visual?.style) };
    }
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck) } });
    return NextResponse.json({ success: true, data: { slideId, url, kind: isVideo ? "video" : "image", session: await getSessionDTO(id) } });
  }

  const body = (await request.json().catch(() => ({}))) as { materialId?: string; slideId?: string; action?: string; instruction?: string; what?: string };

  // ---- REMOVE media from a slide. Writes the deck directly (no `?? prev` merge), so the clear
  //      actually sticks — the /deck PATCH merge deliberately preserves media across autosaves. ----
  if (body.action === "remove_media") {
    const loaded = await load(body.materialId || "", body.slideId || "");
    if (!loaded) return err("That slide no longer exists", 404);
    const { mat, deck, idx } = loaded, slide = deck.slides[idx];
    deck.slides[idx] = body.what === "cohost"
      ? { ...slide, cohostVideoUrl: undefined }
      : { ...slide, visual: undefined, videoUrl: undefined, infographic: undefined, visualType: undefined };
    await prisma.trainingMaterial.update({ where: { id: mat.id }, data: { deck: JSON.stringify(deck) } });
    return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
  }

  // ---- regenerate the image with AI ----
  if (body.action !== "regenerate_image") return err("Unknown action");
  const loaded = await load(body.materialId || "", body.slideId || "");
  if (!loaded) return err("That slide no longer exists", 404);
  const { mat, deck, idx } = loaded, slide = deck.slides[idx];
  // Ground EVERY regeneration in the TRAINING TOPIC + this slide's own content, so the image can't
  // drift to a random subject (e.g. a stray photo of a wolf on an "AI agents" slide). We deliberately
  // do NOT reuse the old slide.visual.prompt as the anchor — a drifted prompt is what caused the drift.
  const sess = await prisma.trainingSession.findFirst({ where: { id, userId: session.userId }, select: { title: true, brief: true } });
  const topic = (sess?.brief || sess?.title || "").replace(/\s+/g, " ").trim().slice(0, 180);
  const bullets = (slide.bullets ?? []).slice(0, 3).map((b) => b.replace(/\*\*/g, "").trim()).filter(Boolean).join("; ");
  const subject = ([slide.title, slide.subtitle].map((s) => (s || "").trim()).filter(Boolean).join(" — ").slice(0, 160)) || slide.title || "the topic";
  const instruction = (body.instruction || "").trim().slice(0, 200);
  const style = slide.visual?.style;
  const styleLine = style === "3d" ? "A premium 3D render, Octane/Pixar quality, glossy materials, cinematic studio lighting." : style === "illustration" ? "A polished modern editorial illustration, clean vector shapes." : "Hyper-realistic professional photography, natural lighting, shallow depth of field.";
  const full = `A relevant, on-topic image for a professional training presentation${topic ? ` about "${topic}"` : ""}. This slide is titled "${subject}"${bullets ? `, covering: ${bullets}` : ""}.${instruction ? ` Art direction: ${instruction}.` : ""} Illustrate the ACTUAL subject literally and professionally — do NOT depict unrelated wildlife, animals, mascots or random scenery. ${styleLine} No text, no watermark, no logos. variation ${Math.random().toString(36).slice(2, 8)}`;
  const base = instruction || subject;

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
