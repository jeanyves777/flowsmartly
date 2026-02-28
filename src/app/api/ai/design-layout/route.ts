import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { generateDesignLayout } from "@/lib/ai/design-layout-generator";

/**
 * POST /api/ai/design-layout
 *
 * Generates a structured design layout (individual canvas elements)
 * using Claude text AI. Returns JSON that the client converts to
 * Fabric.js objects on the canvas.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "AI smart layout", session.userId);
    if (gate) return gate;

    const body = await request.json();
    const {
      prompt, category, size, style,
      heroType, textMode, ctaText,
      brandColors, brandName, brandFonts,
      contactInfo, socialHandles,
      showBrandName, showSocialIcons,
    } = body;

    if (!prompt || !category || !size) {
      return NextResponse.json(
        { success: false, error: { message: "Prompt, category, and size are required" } },
        { status: 400 }
      );
    }

    // Check credits
    const isAdmin = !!session.adminId;
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_DESIGN_LAYOUT", isAdmin);
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 403 }
      );
    }
    const creditCost = await getDynamicCreditCost("AI_DESIGN_LAYOUT");

    const [width, height] = size.split("x").map(Number);

    // Generate layout
    const layout = await generateDesignLayout({
      prompt,
      category,
      width,
      height,
      style: style || "modern",
      heroType: heroType || "text-only",
      textMode: textMode || "creative",
      ctaText: ctaText || null,
      brandName: showBrandName ? brandName : null,
      brandColors: brandColors || null,
      brandFonts: brandFonts || null,
      contactInfo: contactInfo || null,
      socialHandles: showSocialIcons ? socialHandles : null,
      showBrandName: showBrandName || false,
      showSocialIcons: showSocialIcons || false,
    });

    // Deduct credits
    const currentUser = !isAdmin
      ? await prisma.user.findUnique({
          where: { id: session.userId },
          select: { aiCredits: true },
        })
      : null;
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
            balanceAfter: (currentUser?.aiCredits || 0) - creditCost,
            referenceType: "ai_design_layout",
            referenceId: `layout-${Date.now()}`,
            description: `AI smart layout: ${category}`,
          },
        }),
      ]);
    }

    // Track AI usage
    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "design_layout",
        model: "claude-sonnet-4",
        inputTokens: prompt.length,
        outputTokens: JSON.stringify(layout).length,
        costCents: 0,
        prompt: prompt.substring(0, 500),
        response: `${layout.elements.length} elements`,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        layout,
        size: `${width}x${height}`,
        creditsUsed: isAdmin ? 0 : creditCost,
        creditsRemaining: isAdmin ? 999 : (currentUser?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("Design layout generation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate design layout" } },
      { status: 500 }
    );
  }
}
