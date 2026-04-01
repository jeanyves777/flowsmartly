import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { aiHub } from "@/lib/ai/hub";
import { generateEmailContent, designEmailTemplate, optimizeEmail } from "@/lib/ai/agents/email";
import { renderEmailHtml, sectionsToPlainText } from "@/lib/marketing/email-renderer";
import type { EmailBrand } from "@/lib/marketing/email-renderer";

/**
 * POST /api/email-templates/generate — Generate email content or a full template via AI agents.
 * Saves result as a reusable EmailTemplate.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, category, tone, mode, subject, sections: existingSections } = body;
    // mode: "content" (generate copy for existing structure), "template" (design full template), "optimize" (improve existing)

    if (mode === "optimize") {
      // Optimization doesn't cost credits — it's a suggestion engine
      const brandContext = await aiHub.getBrandContext(session.userId);
      const result = await optimizeEmail(subject || "", existingSections || [], brandContext);
      return NextResponse.json({ success: true, data: result });
    }

    if (!prompt?.trim()) {
      return NextResponse.json({ success: false, error: { message: "Please provide a prompt" } }, { status: 400 });
    }

    // Check credits
    const creditCost = await getDynamicCreditCost("AI_POST");
    const balance = await creditService.getBalance(session.userId);
    if (balance < creditCost) {
      return NextResponse.json(
        { success: false, error: { message: `Insufficient credits. You need ${creditCost} credits.` } },
        { status: 400 }
      );
    }

    // Get brand context
    const brandContext = await aiHub.getBrandContext(session.userId);

    // Build brand for rendering
    let emailBrand: Partial<EmailBrand> | undefined;
    if (brandContext) {
      emailBrand = {
        name: brandContext.name,
        logo: brandContext.logo || undefined,
        colors: brandContext.colors,
        fonts: brandContext.fonts,
        website: brandContext.website || undefined,
        email: brandContext.email || undefined,
        phone: brandContext.phone || undefined,
        address: brandContext.address || undefined,
        socials: brandContext.handles,
      };
    }

    const agentInput = { prompt, category, tone, brandContext };

    let result;
    let templateName: string;
    let templateDescription: string | undefined;
    let templateCategory: string;

    if (mode === "template") {
      // Full template design
      const templateResult = await designEmailTemplate(agentInput);
      result = templateResult;
      templateName = templateResult.name;
      templateDescription = templateResult.description;
      templateCategory = templateResult.category;
    } else {
      // Content generation (default)
      const contentResult = await generateEmailContent(agentInput);
      result = contentResult;
      templateName = contentResult.subject || "Generated Email";
      templateDescription = undefined;
      templateCategory = category || "custom";
    }

    // Render HTML from sections
    const contentHtml = renderEmailHtml(result.sections, emailBrand);
    const plainText = sectionsToPlainText(result.sections);

    // Save as reusable template
    const template = await prisma.emailTemplate.create({
      data: {
        userId: session.userId,
        name: templateName,
        description: templateDescription,
        category: templateCategory,
        subject: result.subject,
        preheader: result.preheader,
        content: plainText,
        contentHtml,
        sections: JSON.stringify(result.sections),
        source: "ai_generated",
        sourcePrompt: prompt,
      },
    });

    // Deduct credits
    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: `AI email ${mode || "content"}: ${prompt.slice(0, 50)}`,
      referenceType: "ai_campaign",
    });

    // Track AI usage
    await prisma.aIUsage.create({
      data: {
        userId: session.userId,
        feature: `email_${mode || "content"}_generation`,
        model: "claude-sonnet-4-20250514",
        inputTokens: 600,
        outputTokens: 1200,
        costCents: creditCost,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        template,
        sections: result.sections,
        subject: result.subject,
        preheader: result.preheader,
        contentHtml,
        creditsUsed: creditCost,
        hasBrandKit: !!brandContext,
        brandName: brandContext?.name,
      },
    });
  } catch (error) {
    console.error("Generate email template error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate email content" } },
      { status: 500 }
    );
  }
}
