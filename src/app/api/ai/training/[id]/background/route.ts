import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { generateImageXaiFirst } from "@/lib/ai/image-router";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

const OK_IMAGE = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX = 8 * 1024 * 1024;

/**
 * POST — a virtual-background image for the Training Room.
 *
 *  - multipart/form-data { file }  → upload the user's own image to S3.
 *  - application/json { prompt }   → generate one with AI, then store it.
 *
 * Returns { url }. The client keeps its own library of these in localStorage and
 * composites them onto the camera in the browser. Logged-in users only —
 * guests use blur / brand presets. [[training-studio]]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Sign in to upload or generate a background", 401);
  const { id } = await params;
  const contentType = request.headers.get("content-type") || "";

  // ---- upload your own ----
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return err("No file");
    if (!OK_IMAGE.includes(file.type)) return err("Use a PNG, JPG or WEBP image");
    if (file.size > MAX) return err("That image is too big (max 8MB)");
    const buffer = Buffer.from(await file.arrayBuffer());
    const safe = (file.name || "background").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const url = await uploadToS3(`training/${id}/bg/${Date.now()}-${safe}`, buffer, file.type);
    return NextResponse.json({ success: true, data: { url } });
  }

  // ---- generate with AI ----
  const body = (await request.json().catch(() => ({}))) as { prompt?: string };
  const prompt = (body.prompt || "").trim();
  if (!prompt) return err("Describe the background you want");

  // Admin-tunable; one 16:9 standard image (was a hardcoded 12).
  const AI_COST = await getDynamicCreditCost("TRAINING_BACKGROUND");
  const charge = await creditService.deductCredits({
    userId: session.userId,
    type: "USAGE",
    amount: AI_COST,
    description: "Training Room: AI background",
    referenceType: "training_background",
    referenceId: id,
  });
  if (!charge.success) return err(charge.error || "Not enough credits", 402);

  try {
    const full = `${prompt}. A clean, professional video-call background scene, 16:9, no people, no text, softly lit, tasteful.`;
    const result = await generateImageXaiFirst(full, 1280, 720, { quality: "medium" });
    if (!result.base64) throw new Error("no image");
    const url = await uploadToS3(`training/${id}/bg/ai-${Date.now()}.png`, Buffer.from(result.base64, "base64"), "image/png");
    return NextResponse.json({ success: true, data: { url } });
  } catch {
    // refund on failure — the user shouldn't pay for an image they never got
    await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: AI_COST, description: "Refund: AI background failed", referenceType: "training_background", referenceId: id }).catch(() => {});
    return err("Couldn't generate that background — try a different description", 502);
  }
}
