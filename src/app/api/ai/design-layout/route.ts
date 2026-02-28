import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateDesignLayout } from "@/lib/ai/design-layout-generator";
import { generateLayoutImages, type ImageProvider } from "@/lib/ai/design-image-pipeline";

/**
 * POST /api/ai/design-layout
 *
 * Generates a structured design layout (individual canvas elements)
 * using Claude text AI. Optionally generates images for hero/background
 * placeholders using the selected image provider.
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
      generateHeroImage, generateBackground, imageProvider,
    } = body;

    if (!prompt || !category || !size) {
      return NextResponse.json(
        { success: false, error: { message: "Prompt, category, and size are required" } },
        { status: 400 }
      );
    }

    // Calculate total credit cost
    const isAdmin = !!session.adminId;
    const layoutCost = await getDynamicCreditCost("AI_DESIGN_LAYOUT");
    const imageCost = await getDynamicCreditCost("AI_DESIGN_LAYOUT_IMAGE");

    let imageCount = 0;
    if (generateHeroImage) imageCount++;
    if (generateBackground) imageCount++;

    const totalCost = layoutCost + (imageCost * imageCount);

    // Check credits (manual check since it's a combined cost)
    if (!isAdmin) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true, freeCredits: true },
      });
      if (!user) {
        return NextResponse.json(
          { success: false, error: { code: "INSUFFICIENT_CREDITS", message: "User not found." } },
          { status: 403 }
        );
      }
      const purchasedCredits = Math.max(0, user.aiCredits - (user.freeCredits || 0));
      if (purchasedCredits < totalCost) {
        if (user.freeCredits > 0 && user.aiCredits >= totalCost) {
          return NextResponse.json(
            { success: false, error: { code: "FREE_CREDITS_RESTRICTED", message: `Your free credits can only be used for email marketing. Purchase credits to use this feature (${totalCost} credits required).` } },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { success: false, error: { code: "INSUFFICIENT_CREDITS", message: `This requires ${totalCost} credits. You have ${purchasedCredits} purchased credits remaining.` } },
          { status: 403 }
        );
      }
    }

    const [width, height] = size.split("x").map(Number);

    // 1. Generate layout via Claude
    let layout = await generateDesignLayout({
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
      generateHeroImage: generateHeroImage || false,
      generateBackground: generateBackground || false,
    });

    // 2. Generate images if requested
    let imagesGenerated = 0;
    if (imageCount > 0 && imageProvider) {
      const provider = imageProvider as ImageProvider;
      const result = await generateLayoutImages(layout, provider, {
        generateHeroImage: generateHeroImage || false,
        generateBackground: generateBackground || false,
        width,
        height,
      });
      layout = result.layout;
      imagesGenerated = result.imagesGenerated;
    }

    // 3. Deduct credits
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
          data: { aiCredits: { decrement: totalCost } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -totalCost,
            balanceAfter: (currentUser?.aiCredits || 0) - totalCost,
            referenceType: "ai_design_layout",
            referenceId: `layout-${Date.now()}`,
            description: `AI smart layout: ${category}${imagesGenerated > 0 ? ` + ${imagesGenerated} image(s)` : ""}`,
          },
        }),
      ]);
    }

    // 4. Track AI usage
    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "design_layout",
        model: imagesGenerated > 0 ? `claude-sonnet-4 + ${imageProvider}` : "claude-sonnet-4",
        inputTokens: prompt.length,
        outputTokens: JSON.stringify(layout).length,
        costCents: 0,
        prompt: prompt.substring(0, 500),
        response: `${layout.elements.length} elements, ${imagesGenerated} images`,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        layout,
        size: `${width}x${height}`,
        creditsUsed: isAdmin ? 0 : totalCost,
        creditsRemaining: isAdmin ? 999 : (currentUser?.aiCredits || 0) - totalCost,
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
