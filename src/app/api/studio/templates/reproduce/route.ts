import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { reproduceTemplate } from "@/lib/ai/template-reproduce-agent";

/**
 * POST /api/studio/templates/reproduce
 *
 * Body: { imageUrl: string }
 *  - imageUrl can be a relative /templates/... path (Featured Templates) OR
 *    any absolute https:// URL (e.g. a Pexels photo the user wants to
 *    decompose into editable layers).
 *
 * Returns: { canvas: <Fabric.js JSON the studio loads via safeLoadFromJSON>,
 *            creditsUsed, creditsRemaining }
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
    const imageUrl: string = String(body.imageUrl || "").trim();
    if (!imageUrl || !(imageUrl.startsWith("/") || imageUrl.startsWith("http"))) {
      return NextResponse.json(
        { success: false, error: { message: "imageUrl is required (must start with / or http)" } },
        { status: 400 },
      );
    }

    const customText: string = typeof body.customText === "string" ? body.customText.slice(0, 2000) : "";
    const useBrandColors: boolean = !!body.useBrandColors;

    // Pull the user's BrandKit colors when requested. We pass them to the
    // agent as plain hex strings; if the user hasn't set up a BrandKit,
    // we silently skip and the agent uses the template's original palette.
    let brandColors: { primary?: string; secondary?: string; accent?: string } | null = null;
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
          } catch { /* ignore — agent falls through to template palette */ }
        }
      } catch { /* ignore — non-fatal */ }
    }

    const creditCost = await getDynamicCreditCost("AI_TEMPLATE_REPRODUCE");
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
            message: `Recreating an editable design costs ${creditCost} credits. You have ${user?.aiCredits || 0}.`,
            required: creditCost,
            available: user?.aiCredits || 0,
          },
        },
        { status: 402 },
      );
    }

    const result = await reproduceTemplate(imageUrl, { customText, brandColors });

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
            referenceType: "ai_template_reproduce",
            description: `Template reproduction (${result.imagesGenerated} image gens)`,
          },
        }),
      ]);
    }

    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "template_reproduce",
        model: "claude-opus-4-7",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costCents: 0,
      },
    });

    return NextResponse.json({
      success: true,
      canvas: result.canvas,
      data: {
        imagesGenerated: result.imagesGenerated,
        creditsUsed: isAdmin ? 0 : creditCost,
        creditsRemaining: isAdmin ? 999 : (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reproduction failed";
    console.error("[TemplateReproduce] error:", err);
    return NextResponse.json(
      { success: false, error: { message: msg } },
      { status: 500 },
    );
  }
}
