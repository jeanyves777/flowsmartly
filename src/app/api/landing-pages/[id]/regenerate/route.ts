import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { generateLandingPage } from "@/lib/landing-pages/generator";
import { sanitizeHtml } from "@/lib/landing-pages/sanitizer";

// POST /api/landing-pages/[id]/regenerate - Regenerate page with AI
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "AI landing page builder", session.userId);
    if (gate) return gate;

    // Check credits (free credits can only be used for email marketing)
    const creditCost = await getDynamicCreditCost("AI_LANDING_PAGE");
    const creditCheck = await checkCreditsForFeature(session.user.id, "AI_LANDING_PAGE");
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Find and verify ownership
    const existingPage = await prisma.landingPage.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingPage) {
      return NextResponse.json(
        { success: false, error: { message: "Landing page not found" } },
        { status: 404 }
      );
    }

    // Parse body for optional overrides
    const body = await request.json();
    const { prompt, pageType, brandName, colors, tone, audience, ctaText, keywords, imageUrl, videoUrl } = body as {
      prompt?: string;
      pageType?: string;
      brandName?: string;
      colors?: { primary?: string; secondary?: string; accent?: string };
      tone?: string;
      audience?: string;
      ctaText?: string;
      keywords?: string;
      imageUrl?: string;
      videoUrl?: string;
    };

    // Merge existing settings with any overrides
    const existingSettings = JSON.parse(existingPage.settings) as Record<string, unknown>;

    const generationOptions = {
      prompt: prompt || existingPage.prompt,
      pageType: pageType || existingPage.pageType,
      brandName: brandName ?? (existingSettings.brandName as string | undefined),
      colors: colors ?? (existingSettings.colors as { primary?: string; secondary?: string; accent?: string } | undefined),
      tone: tone ?? (existingSettings.tone as string | undefined),
      audience: audience ?? (existingSettings.audience as string | undefined),
      ctaText: ctaText ?? (existingSettings.ctaText as string | undefined),
      keywords: keywords ?? (existingSettings.keywords as string | undefined),
      imageUrl: imageUrl ?? (existingSettings.imageUrl as string | undefined),
      videoUrl: videoUrl ?? (existingSettings.videoUrl as string | undefined),
    };

    // Generate new landing page with AI
    const generated = await generateLandingPage(generationOptions);

    // Sanitize the generated HTML
    const sanitizedHtml = sanitizeHtml(generated.html);

    // Update the page record
    const updatedPage = await prisma.landingPage.update({
      where: { id },
      data: {
        title: generated.title,
        description: generated.description,
        prompt: generationOptions.prompt,
        pageType: generationOptions.pageType,
        htmlContent: sanitizedHtml,
        settings: JSON.stringify({
          brandName: generationOptions.brandName,
          colors: generationOptions.colors,
          tone: generationOptions.tone,
          audience: generationOptions.audience,
          ctaText: generationOptions.ctaText,
          keywords: generationOptions.keywords,
          imageUrl: generationOptions.imageUrl,
          videoUrl: generationOptions.videoUrl,
        }),
      },
    });

    // Deduct credits
    await creditService.deductCredits({
      userId: session.user.id,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: "AI landing page regeneration",
      referenceType: "landing_page",
      referenceId: updatedPage.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        page: {
          ...updatedPage,
          settings: JSON.parse(updatedPage.settings),
        },
        creditsUsed: creditCost,
      },
    });
  } catch (error) {
    console.error("Landing page regeneration error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to regenerate landing page" } },
      { status: 500 }
    );
  }
}
