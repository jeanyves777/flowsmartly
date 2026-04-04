import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { generateWebsite } from "@/lib/website/ai-generator";

// POST /api/websites/[id]/generate — AI-generate site content
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      include: { brandKit: { select: { colors: true, fonts: true, logo: true, name: true, voiceTone: true, industry: true, targetAudience: true } } },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check credits
    const cost = await getDynamicCreditCost("AI_WEBSITE_GENERATE");
    const check = await checkCreditsForFeature(session.userId, "AI_WEBSITE_GENERATE");
    if (check) {
      // check is non-null means insufficient credits
      return NextResponse.json({ error: check.message, required: cost }, { status: 402 });
    }

    const body = await request.json();
    const questionnaire = body.questionnaire;
    if (!questionnaire) return NextResponse.json({ error: "Questionnaire data required" }, { status: 400 });

    // Generate website with AI
    const brandKit = website.brandKit ? {
      colors: website.brandKit.colors ?? undefined,
      fonts: website.brandKit.fonts ?? undefined,
      logo: website.brandKit.logo ?? undefined,
      name: website.brandKit.name ?? undefined,
      voiceTone: website.brandKit.voiceTone ?? undefined,
      industry: website.brandKit.industry ?? undefined,
      targetAudience: website.brandKit.targetAudience ?? undefined,
    } : null;

    const generated = await generateWebsite(questionnaire, brandKit);

    // Update website theme + navigation
    await prisma.website.update({
      where: { id },
      data: {
        theme: JSON.stringify(generated.theme),
        navigation: JSON.stringify(generated.navigation),
        name: generated.name || website.name,
      },
    });

    // Delete existing pages and create new ones
    await prisma.websitePage.deleteMany({ where: { websiteId: id } });

    for (let i = 0; i < generated.pages.length; i++) {
      const page = generated.pages[i];
      await prisma.websitePage.create({
        data: {
          websiteId: id,
          title: page.title,
          slug: page.slug,
          description: page.description || null,
          isHomePage: page.isHomePage,
          sortOrder: i,
          blocks: JSON.stringify(page.blocks),
          status: "DRAFT",
        },
      });
    }

    await prisma.website.update({ where: { id }, data: { pageCount: generated.pages.length } });

    // Deduct credits
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: `AI website generation: ${website.name}`,
    });

    return NextResponse.json({ success: true, pages: generated.pages.length });
  } catch (err) {
    console.error("POST /api/websites/[id]/generate error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
