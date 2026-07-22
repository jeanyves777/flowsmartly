import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { editImagesXaiFirst } from "@/lib/ai/image-router";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { nanoid } from "nanoid";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

const OK = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX = 8 * 1024 * 1024;
export const maxDuration = 120;

/** Background scenes the user picks from (button control). */
const BG: Record<string, string> = {
  studio: "a smooth neutral light-grey studio backdrop",
  office: "a softly-lit modern office with a blurred bookshelf and a plant behind",
  home: "a warm, cosy home study with soft lamp light, gently blurred behind",
  neon: "a dark room with subtle purple and blue LED accent lighting and a plant behind",
  blur: "a clean, softly-blurred neutral background",
};
/** Clothing the user picks from (button control). "keep" leaves it as-is. */
const CLOTH: Record<string, string> = {
  keep: "",
  tee: "a fitted dark-navy crew-neck t-shirt",
  shirt: "a crisp light-blue button-up dress shirt",
  blazer: "a well-tailored navy blazer over a shirt",
  knit: "a smart charcoal knit sweater",
};

/**
 * POST /api/ai/training/presenter/style — turn an uploaded presenter photo into a
 * PRESENTATION-READY clone: the same person, re-lit and framed as a professional
 * presenter, with a chosen background + clothing. Identity-preserving image-to-image
 * (reuses the Clone-Yourself edit path, intent:"identity"). multipart { file,
 * background, clothing }. [[training-studio]] [[clone-yourself-studio]]
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Sign in to build your presenter", 401);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return err("Upload a photo first");
  if (!OK.includes(file.type)) return err("Use a PNG, JPG or WEBP image");
  if (file.size > MAX) return err("That image is too big (max 8MB)");

  const bg = BG[String(form?.get("background") || "studio")] || BG.studio;
  const cloth = CLOTH[String(form?.get("clothing") || "keep")] ?? "";
  const buffer = Buffer.from(await file.arrayBuffer());

  // Admin-tunable; identity-preserving portrait, premium image chain (was a hardcoded 18).
  const AI_COST = await getDynamicCreditCost("PRESENTER_STYLE");
  const charge = await creditService.deductCredits({
    userId: session.userId, type: "USAGE", amount: AI_COST,
    description: "Training Room: presentation-ready presenter", referenceType: "presenter_style", referenceId: session.userId,
  });
  if (!charge.success) return err(charge.error || "Not enough credits", 402);

  try {
    const prompt = `Professional presenter portrait of this exact person, upper body centred, facing the camera with a warm, confident, approachable expression, ${cloth ? `wearing ${cloth}` : "in their own clothing"}, ${bg}, soft cinematic studio lighting, sharp focus, premium corporate headshot look, 16:9 framing. Keep the person's exact face, hair, skin tone and identity completely unchanged — only restyle the clothing, lighting and background. No text, no watermark.`;
    const r = await editImagesXaiFirst(prompt, [buffer], 1280, 720, { intent: "identity", quality: "high" });
    if (!r.base64) throw new Error("no image");
    const url = await uploadToS3(`presenters/${session.userId}/ready-${nanoid(8)}.png`, Buffer.from(r.base64, "base64"), "image/png");
    return NextResponse.json({ success: true, data: { url } });
  } catch {
    await creditService.addCredits?.({ userId: session.userId, type: "REFUND", amount: AI_COST, description: "Refund: presenter portrait failed", referenceType: "presenter_style", referenceId: session.userId }).catch(() => {});
    return err("Couldn't make that presentation-ready — try a clearer photo", 502);
  }
}
