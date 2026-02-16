import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ai } from "@/lib/ai/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";

// POST /api/content/automation/generate-topic — AI-suggest a topic from brand identity
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Load user's brand kit
    let brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });
    if (!brandKit) {
      brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
      });
    }

    if (!brandKit) {
      return NextResponse.json(
        { success: false, error: { message: "No brand identity found. Set up your brand first." } },
        { status: 404 }
      );
    }

    // Check credits
    const creditCost = await getDynamicCreditCost("AI_IDEAS");
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });
    const isAdmin = !!session.adminId;
    if (!isAdmin && (!user || user.aiCredits < creditCost)) {
      return NextResponse.json(
        { success: false, error: { message: "Insufficient AI credits" } },
        { status: 403 }
      );
    }

    // Build context from brand
    const brandContext = [
      `Brand: ${brandKit.name}`,
      brandKit.tagline ? `Tagline: ${brandKit.tagline}` : null,
      brandKit.niche ? `Niche: ${brandKit.niche}` : null,
      brandKit.industry ? `Industry: ${brandKit.industry}` : null,
      brandKit.targetAudience ? `Target audience: ${brandKit.targetAudience}` : null,
      brandKit.uniqueValue ? `Value proposition: ${brandKit.uniqueValue}` : null,
      (() => { try { const kw = JSON.parse(brandKit.keywords); return kw.length > 0 ? `Keywords: ${kw.join(", ")}` : null; } catch { return null; } })(),
      (() => { try { const pr = JSON.parse(brandKit.products); return pr.length > 0 ? `Products/services: ${pr.join(", ")}` : null; } catch { return null; } })(),
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Based on this brand identity:\n\n${brandContext}\n\nSuggest a specific, engaging topic for automated social media content. The topic should be relevant to the brand's niche and audience, specific enough to generate good content, and evergreen (not time-sensitive).\n\nRespond with ONLY the topic, no explanations. Keep it under 12 words.`;

    const topic = await ai.generate(prompt, {
      maxTokens: 60,
      systemPrompt:
        "You are a marketing strategist. Generate creative, relevant social media content topics. Respond with only the topic text, nothing else.",
    });

    const cleanTopic = topic?.trim().replace(/^["']|["']$/g, "") || "Content for your audience";

    // Deduct credits + track usage
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
            referenceType: "ai_automation_topic",
            description: "Content automation: AI topic suggestion",
          },
        }),
      ]);
    }

    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "automation_topic",
        model: "claude-sonnet-4-20250514",
        inputTokens: ai.estimateTokens(prompt),
        outputTokens: ai.estimateTokens(cleanTopic),
        costCents: 0,
      },
    });

    // Save to history
    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "automation_topics",
        content: JSON.stringify([cleanTopic]),
        prompt: "automation topic",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        topic: cleanTopic,
        creditsUsed: creditCost,
        creditsRemaining: isAdmin ? undefined : (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("Generate topic error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate topic" } },
      { status: 500 }
    );
  }
}
