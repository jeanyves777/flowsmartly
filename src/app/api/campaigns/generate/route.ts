import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import {
  generateEmailContent,
  generateSMSContent,
  EmailTemplateType,
  SMSTemplateType,
} from "@/lib/ai/generators/campaign";
import { aiHub } from "@/lib/ai/hub";

// POST /api/campaigns/generate - Generate AI campaign content
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      type, // "email" or "sms"
      templateType,
      tone,
      topic,
      productName,
      discount,
      eventName,
      eventDate,
      link,
      customPrompt,
    } = body;

    if (!type || !["email", "sms"].includes(type)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid campaign type. Use 'email' or 'sms'." } },
        { status: 400 }
      );
    }

    if (!templateType && !customPrompt?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Please provide a prompt or select a template" } },
        { status: 400 }
      );
    }

    // Check credit balance
    const creditCost = await getDynamicCreditCost(type === "email" ? "AI_POST" : "AI_CAPTION");
    const balance = await creditService.getBalance(session.userId);

    if (balance < creditCost) {
      return NextResponse.json(
        { success: false, error: { message: `Insufficient credits. You need ${creditCost} credits.` } },
        { status: 400 }
      );
    }

    // Fetch user's brand identity for personalized AI generation
    const brandContext = await aiHub.getBrandContext(session.userId) ?? undefined;

    let result;

    if (type === "email") {
      result = await generateEmailContent({
        templateType: templateType || undefined,
        brandContext,
        tone,
        topic,
        productName,
        discount,
        eventName,
        eventDate,
        customPrompt,
      });
    } else {
      result = await generateSMSContent({
        templateType: templateType as SMSTemplateType,
        brandContext,
        tone,
        topic,
        productName,
        discount,
        eventName,
        link,
        customPrompt,
      });
    }

    // Deduct credits
    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: `AI ${type} content: ${templateType || "custom"}`,
      referenceType: "ai_campaign",
    });

    // Track AI usage
    await prisma.aIUsage.create({
      data: {
        userId: session.userId,
        feature: `campaign_${type}_${templateType || "custom"}`,
        model: "claude-sonnet-4-20250514",
        inputTokens: 500, // Estimate
        outputTokens: type === "email" ? 800 : 100,
        costCents: creditCost,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        type,
        templateType,
        ...result,
        creditsUsed: creditCost,
        hasBrandKit: !!brandContext,
        brandName: brandContext?.name,
        brandTone: brandContext?.voiceTone,
      },
    });
  } catch (error) {
    console.error("Generate campaign content error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate content" } },
      { status: 500 }
    );
  }
}
