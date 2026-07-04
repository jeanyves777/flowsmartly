import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, requirePermission } from "@/lib/admin/auth";
import { generateImageWithProvider, type RoutedImageProvider } from "@/lib/ai/image-router";
import { buildArtDirection } from "@/lib/ai/image-recipe";
import { DEFAULT_RECIPE, type RecipeConfig } from "@/lib/ai/media-policy";

/**
 * Admin Control Hub — LIVE test-generate. Runs the given brief through one or
 * more provider+model targets (with the art-direction recipe applied, so it
 * reflects production quality) and returns the images as data URIs for a
 * side-by-side comparison. Admin-only; does not touch user credits.
 */

// Only the design-capable providers can be test-generated from the hub; "flow"
// (self-hosted Stable Diffusion) is intentionally excluded so a large size can't
// be aimed at it.
const VALID: ReadonlySet<string> = new Set(["xai", "openai", "gemini"]);
const MAX_DIM = 2048;

interface Target { provider: string; model?: string; label?: string }

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  const denied = requirePermission(session, "EDIT_SETTINGS");
  if (denied) return denied;

  let body: { prompt?: string; size?: string; targets?: Target[]; recipe?: Partial<RecipeConfig>; hasLogo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ success: false, error: { message: "A brief/prompt is required." } }, { status: 400 });
  }
  const [rawW, rawH] = (typeof body.size === "string" && /^\d+x\d+$/.test(body.size) ? body.size : "1024x1024").split("x").map(Number);
  // Clamp so an admin can't aim an enormous canvas at a provider.
  const w = Math.min(MAX_DIM, Math.max(256, rawW || 1024));
  const h = Math.min(MAX_DIM, Math.max(256, rawH || 1024));
  const targets = (Array.isArray(body.targets) ? body.targets : [])
    .filter((t) => t && typeof t.provider === "string" && VALID.has(t.provider))
    .slice(0, 6);
  if (!targets.length) {
    return NextResponse.json({ success: false, error: { message: "At least one provider target is required." } }, { status: 400 });
  }

  const recipe: RecipeConfig = {
    fullBleed: body.recipe?.fullBleed !== false,
    premiumPolish: body.recipe?.premiumPolish !== false,
    enforceExactCopy: body.recipe?.enforceExactCopy !== false,
    singleLogo: body.recipe?.singleLogo !== false,
  };
  void DEFAULT_RECIPE;
  const fullPrompt = `${prompt}\n\n${buildArtDirection({ recipe, hasLogo: body.hasLogo === true })}`;

  const results = await Promise.all(
    targets.map(async (t) => {
      const started = Date.now();
      try {
        const res = await generateImageWithProvider(
          t.provider as RoutedImageProvider,
          fullPrompt,
          w,
          h,
          { quality: "high", model: t.model },
        );
        if (!res.base64) throw new Error("no image returned");
        const mime = res.format === "jpeg" ? "image/jpeg" : "image/png";
        return {
          provider: t.provider,
          model: res.model,
          label: t.label || `${t.provider} · ${res.model}`,
          ms: Date.now() - started,
          dataUri: `data:${mime};base64,${res.base64}`,
          ok: true as const,
        };
      } catch (e) {
        return {
          provider: t.provider,
          model: t.model || null,
          label: t.label || t.provider,
          ms: Date.now() - started,
          error: e instanceof Error ? e.message : "generation failed",
          ok: false as const,
        };
      }
    }),
  );

  return NextResponse.json({ success: true, data: { size: `${w}x${h}`, results } });
}
