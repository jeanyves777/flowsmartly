import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { remixTemplate } from "@/lib/ai/template-remix-agent";

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

    const result = await remixTemplate({
      sourceImageUrl: imageUrl,
      customText,
      userPhotosDataUrls: userPhotos,
      // Portrait flyer is the dominant Featured/Premium aspect — match it.
      // gpt-image-1 will resize to fit if the source is square or landscape.
      size: "1024x1536",
      quality: "high",
    });

    // Upload the remixed PNG to S3 under the user's media namespace.
    const buf = Buffer.from(result.b64, "base64");
    const key = `media/${session.userId}-remix-${randomBytes(6).toString("hex")}.png`;
    const remixedImageUrl = await uploadToS3(key, buf, "image/png");

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
        model: "gpt-image-1",
        inputTokens: 0,
        outputTokens: 0,
        // Rough — gpt-image-1 edit-multi high quality runs ~$0.10-0.20.
        costCents: result.usedUserPhotos ? 18 : 12,
      },
    });

    return NextResponse.json({
      success: true,
      remixedImageUrl,
      width: 1024,
      height: 1536,
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
