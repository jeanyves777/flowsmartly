import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { remixTemplate } from "@/lib/ai/template-remix-agent";
import { generateTextOverlay } from "@/lib/ai/template-text-overlay-agent";

/**
 * POST /api/studio/templates/remix
 *
 * Personalize a finished template (Featured / AI / Premium) with the
 * user's text and photos via gpt-image-1 edit-multi. Output is a FLAT
 * PNG that lands as a locked background on the canvas — same role as
 * the old free "Use as Background" but personalized.
 *
 * Body: {
 *   imageUrl: string,            // source design — relative or https
 *   customText?: string,         // user's text (headline, name, etc.)
 *   userPhotos?: string[],       // data:image/* URLs (max 4)
 * }
 * Returns: { remixedImageUrl, width, height, creditsUsed, creditsRemaining }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const body = await req.json();
    const imageUrl: string = String(body?.imageUrl || "").trim();
    if (!imageUrl || !(imageUrl.startsWith("/") || imageUrl.startsWith("http"))) {
      return NextResponse.json(
        { success: false, error: { message: "imageUrl is required (must start with / or http)" } },
        { status: 400 },
      );
    }

    const customText: string =
      typeof body?.customText === "string" ? body.customText.slice(0, 2000) : "";
    const userPhotos: string[] = Array.isArray(body?.userPhotos)
      ? body.userPhotos
          .filter((s: unknown): s is string => typeof s === "string" && s.startsWith("data:image/"))
          .slice(0, 4)
      : [];
    const useBrandColors: boolean = !!body?.useBrandColors;

    // Pull the user's BrandKit colors when requested. Same pattern as
    // /api/studio/templates/reproduce — pass plain hex strings to the
    // agent. If the user hasn't set up a BrandKit, silently skip and
    // gpt-image-1 uses the source's original palette.
    let brandColors: { primary?: string; secondary?: string; accent?: string } | undefined;
    if (useBrandColors) {
      try {
        const kit = await prisma.brandKit.findFirst({
          where: { userId: session.userId },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          select: { colors: true },
        });
        if (kit?.colors) {
          try {
            const parsed = JSON.parse(kit.colors);
            if (parsed && typeof parsed === "object") {
              brandColors = {
                primary: parsed.primary,
                secondary: parsed.secondary,
                accent: parsed.accent,
              };
            }
          } catch { /* ignore — agent falls through to source palette */ }
        }
      } catch { /* ignore — non-fatal */ }
    }

    const creditCost = await getDynamicCreditCost("AI_TEMPLATE_REMIX");
    const isAdmin = !!session.adminId;
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    if (!isAdmin && (!user || user.aiCredits < creditCost)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: `Personalizing this design costs ${creditCost} credits. You have ${user?.aiCredits || 0}.`,
            required: creditCost,
            available: user?.aiCredits || 0,
          },
        },
        { status: 402 },
      );
    }

    console.log(
      `[TemplateRemix] user=${session.userId} src=${imageUrl.slice(0, 80)} text=${customText.length}ch photos=${userPhotos.length}`,
    );

    // Phase 1: gpt-image-1 produces a TEXT-FREE composition. The agent
    // also returns the source buffer + dims (we'll reuse them for the
    // overlay agent below) and picks the gpt-image-1 size that best
    // matches the source's aspect ratio.
    const result = await remixTemplate({
      sourceImageUrl: imageUrl,
      userPhotosDataUrls: userPhotos,
      brandColors,
      quality: "high",
    });

    // Upload the remixed PNG to S3 under the user's media namespace.
    const buf = Buffer.from(result.b64, "base64");
    const key = `media/${session.userId}-remix-${randomBytes(6).toString("hex")}.png`;
    const remixedImageUrl = await uploadToS3(key, buf, "image/png");

    // Auto-promote to the master AiTemplate library so the stock grows
    // organically with every remix. Visible to all users in the AI-
    // Generated Templates section — they can use it as a starting point
    // for their own remix. Tagged `(personalized)` in the query so admins
    // can hide it later if it's too user-specific. Non-fatal — a DB
    // hiccup here shouldn't lose the user's remix.
    const remixBatch = randomBytes(12).toString("hex");
    try {
      const queryHash = createHash("sha256").update(`${imageUrl} :: remix :: ${remixBatch}`).digest("hex");
      const queryLabel = customText.trim()
        ? `${customText.trim().split(/\n+/)[0].slice(0, 80)} (personalized remix)`
        : `Personalized remix (${imageUrl.split("/").pop()?.split(".")[0]?.slice(0, 40) ?? "template"})`;
      await prisma.aiTemplate.create({
        data: {
          queryHash,
          query: queryLabel,
          prompt: `[Remix] source=${imageUrl}${userPhotos.length ? ` +${userPhotos.length}photos` : ""}`,
          imageUrl: remixedImageUrl,
          width: result.outputWidth,
          height: result.outputHeight,
          generationBatch: remixBatch,
          position: 0,
          createdById: session.userId,
        },
      });
    } catch (err) {
      console.warn("[TemplateRemix] failed to promote to library (non-fatal):", err);
    }

    // Phase 2: Claude vision reads the SOURCE design (where original
    // text is rendered cleanly) and emits Fabric textbox specs in
    // SOURCE coord space. We then scale them to the output canvas.
    // Failure is non-fatal — we still return the bg image.
    let scaledTextLayers: Awaited<ReturnType<typeof generateTextOverlay>>["layers"] = [];
    let overlayUsage = { inputTokens: 0, outputTokens: 0 };
    try {
      const overlay = await generateTextOverlay({
        sourceImageB64: result.sourceBuffer.toString("base64"),
        width: result.sourceWidth,
        height: result.sourceHeight,
        customText,
      });
      // Scale source-space coords → output canvas coords.
      // Uniform-min for fontSize so type doesn't get stretched.
      const sx = result.outputWidth / result.sourceWidth;
      const sy = result.outputHeight / result.sourceHeight;
      const fontScale = Math.min(sx, sy);
      scaledTextLayers = overlay.layers.map((l) => ({
        ...l,
        left: Math.round(l.left * sx),
        top: Math.round(l.top * sy),
        width: Math.round(l.width * sx),
        fontSize: Math.round(l.fontSize * fontScale),
      }));
      overlayUsage = { inputTokens: overlay.inputTokens, outputTokens: overlay.outputTokens };
      console.log(
        `[TemplateRemix] text overlay: ${scaledTextLayers.length} layers, source ${result.sourceWidth}x${result.sourceHeight} → output ${result.outputWidth}x${result.outputHeight}, scale (${sx.toFixed(2)},${sy.toFixed(2)})`,
      );
    } catch (err) {
      console.warn("[TemplateRemix] text overlay failed (non-fatal):", err);
    }

    if (!isAdmin) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { aiCredits: { decrement: creditCost } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -creditCost,
            balanceAfter: (user?.aiCredits || 0) - creditCost,
            referenceType: "ai_template_remix",
            description: `Template remix${result.usedUserPhotos ? " (with user photos)" : ""}`,
          },
        }),
      ]);
    }

    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "template_remix",
        // Combined feature — gpt-image-1 + Claude vision text overlay
        model: "gpt-image-1+claude-opus-4-7",
        inputTokens: overlayUsage.inputTokens,
        outputTokens: overlayUsage.outputTokens,
        // Rough — gpt-image-1 high (~$0.15) + Claude vision (~$0.05) ≈ $0.20
        costCents: (result.usedUserPhotos ? 18 : 12) + 5,
      },
    });

    return NextResponse.json({
      success: true,
      remixedImageUrl,
      width: result.outputWidth,
      height: result.outputHeight,
      // Editable text layers Claude extracted from the source design —
      // already scaled into output canvas coords. Frontend layers them
      // on top of the locked bg image so users can edit any text
      // without redoing the gpt-image-1 step.
      textLayers: scaledTextLayers,
      creditsUsed: isAdmin ? 0 : creditCost,
      creditsRemaining: isAdmin ? 999 : (user?.aiCredits || 0) - creditCost,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Remix failed";
    console.error("[TemplateRemix] error:", err);
    return NextResponse.json(
      { success: false, error: { message: msg } },
      { status: 500 },
    );
  }
}
