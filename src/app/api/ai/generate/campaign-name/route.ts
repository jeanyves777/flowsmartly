import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { aiHub } from "@/lib/ai";
import { getDynamicCreditCost } from "@/lib/credits/costs";

const schema = z.object({
  objective: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  postSummaries: z.array(z.string()).optional(),
  currentName: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "AI campaign name suggestion", session.userId);
    if (gate) return gate;

    const body = await request.json();
    const validation = schema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
        { status: 400 }
      );
    }

    const { objective, platforms, postSummaries, currentName } = validation.data;

    // Check credits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    const cost = await getDynamicCreditCost("AI_CAMPAIGN_NAME");
    const credits = session.adminId ? (session.user.aiCredits ?? 0) : (user?.aiCredits ?? 0);

    if (credits < cost) {
      return NextResponse.json(
        { success: false, error: { code: "INSUFFICIENT_CREDITS", message: "Not enough AI credits" } },
        { status: 403 }
      );
    }

    // Get brand context
    const brandContext = await aiHub.getBrandContext(session.userId);

    // Build prompt
    const contextParts: string[] = [];

    if (objective) contextParts.push(`Campaign objective: ${objective}`);
    if (platforms?.length) contextParts.push(`Target platforms: ${platforms.join(", ")}`);
    if (postSummaries?.length) {
      contextParts.push(`Posts being promoted:\n${postSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
    }
    if (currentName) {
      contextParts.push(`Current name (suggest different alternatives): "${currentName}"`);
    }
    if (brandContext) {
      const brandParts: string[] = [];
      if (brandContext.name) brandParts.push(`Brand: ${brandContext.name}`);
      if (brandContext.industry) brandParts.push(`Industry: ${brandContext.industry}`);
      if (brandContext.niche) brandParts.push(`Niche: ${brandContext.niche}`);
      if (brandParts.length) contextParts.push(`Brand info:\n${brandParts.join("\n")}`);
    }

    const prompt = `You are a creative marketing strategist. Based on the context below, suggest campaign names.

${contextParts.length > 0 ? contextParts.join("\n\n") : "No specific context — suggest versatile campaign names."}

Return a JSON array of 5 campaign name suggestions. Each should be:
- Short and catchy (2-6 words)
- Professional but creative
- Relevant to the campaign objective and content
- Unique and memorable

Example format:
["Summer Style Blitz", "Engage & Grow Q1", "Brand Awareness Push", "Holiday Flash Sale", "Content Creator Spotlight"]

Return ONLY the JSON array.`;

    const result = await ai.generateJSON<string[]>(prompt, {
      maxTokens: 300,
      temperature: 0.9,
      systemPrompt: "You are a creative marketing strategist. Return only valid JSON arrays of campaign name strings.",
    });

    const names: string[] = Array.isArray(result)
      ? result.filter(n => typeof n === "string" && n.trim()).slice(0, 5)
      : [];

    // Deduct credits and track usage
    if (session.adminId) {
      await prisma.aIUsage.create({
        data: {
          adminId: session.adminId,
          userId: null,
          feature: "campaign_name",
          inputTokens: ai.estimateTokens(prompt),
          outputTokens: ai.estimateTokens(JSON.stringify(names)),
          model: "claude-sonnet-4-20250514",
        },
      });
    } else {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { aiCredits: { decrement: cost } },
        }),
        prisma.aIUsage.create({
          data: {
            userId: session.userId,
            feature: "campaign_name",
            inputTokens: ai.estimateTokens(prompt),
            outputTokens: ai.estimateTokens(JSON.stringify(names)),
            model: "claude-sonnet-4-20250514",
          },
        }),
      ]);
    }

    // Save to history
    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "campaign_names",
        content: JSON.stringify(names),
        prompt: objective || "campaign",
        settings: JSON.stringify({ objective, platforms }),
      },
    });

    const creditsRemaining = session.adminId
      ? credits - cost
      : (await prisma.user.findUnique({ where: { id: session.userId }, select: { aiCredits: true } }))?.aiCredits ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        names,
        creditsUsed: cost,
        creditsRemaining,
      },
    });
  } catch (error) {
    console.error("Campaign name generation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: "Failed to generate campaign names" } },
      { status: 500 }
    );
  }
}
