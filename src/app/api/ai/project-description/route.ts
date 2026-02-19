import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { buildBrandContext, SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import type { BrandContext } from "@/lib/ai/types";

// POST /api/ai/project-description — Generate project description + highlights
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
    const { title } = body as { title: string };

    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Project title is required" } },
        { status: 400 }
      );
    }

    // Check credits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    if (!user || user.aiCredits < 1) {
      return NextResponse.json(
        { success: false, error: { message: "Not enough AI credits" } },
        { status: 403 }
      );
    }

    // Fetch agent profile
    const agentProfile = await prisma.agentProfile.findUnique({
      where: { userId: session.userId },
      select: {
        displayName: true,
        bio: true,
        specialties: true,
        industries: true,
      },
    });

    const specialties: string[] = (() => {
      try { return JSON.parse(agentProfile?.specialties || "[]"); } catch { return []; }
    })();
    const industries: string[] = (() => {
      try { return JSON.parse(agentProfile?.industries || "[]"); } catch { return []; }
    })();

    // Fetch brand identity
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });

    let brandSection = "";
    if (brandKit) {
      const brandContext: BrandContext = {
        name: brandKit.name,
        tagline: brandKit.tagline || "",
        description: brandKit.description || "",
        industry: brandKit.industry || "",
        niche: brandKit.niche || "",
        targetAudience: brandKit.targetAudience || "",
        audienceAge: brandKit.audienceAge || "",
        audienceLocation: brandKit.audienceLocation || "",
        voiceTone: (brandKit.voiceTone || "professional") as BrandContext["voiceTone"],
        personality: (() => { try { return JSON.parse(brandKit.personality); } catch { return []; } })(),
        keywords: (() => { try { return JSON.parse(brandKit.keywords); } catch { return []; } })(),
        hashtags: (() => { try { return JSON.parse(brandKit.hashtags); } catch { return []; } })(),
        products: (() => { try { return JSON.parse(brandKit.products); } catch { return []; } })(),
        avoidWords: (() => { try { return JSON.parse(brandKit.avoidWords); } catch { return []; } })(),
        uniqueValue: brandKit.uniqueValue || "",
        email: brandKit.email || "",
        phone: brandKit.phone || "",
        website: brandKit.website || "",
        address: brandKit.address || "",
      };
      brandSection = "\n\nBRAND IDENTITY:\n" + buildBrandContext(brandContext);
    }

    const prompt = `Generate a compelling project showcase description for a professional agent's portfolio.

AGENT PROFILE:
- Name: ${agentProfile?.displayName || "Agent"}
- Specialties: ${specialties.length > 0 ? specialties.join(", ") : "General marketing"}
- Industries: ${industries.length > 0 ? industries.join(", ") : "Various"}
${agentProfile?.bio ? `- Bio excerpt: ${agentProfile.bio.substring(0, 200)}` : ""}
${brandSection}

PROJECT TITLE: "${title.trim()}"

Return a JSON object with:
- "description": A professional, benefit-focused description of 2-3 sentences that highlights client impact, methods used, and results achieved. Write in third person about what the agent delivered.
- "highlights": An array of 3-4 short bullet points (each under 60 characters) showcasing specific results, metrics, or key deliverables. Be specific and use numbers where possible.

Return ONLY valid JSON, no explanations or markdown.`;

    const result = await ai.generateJSON<{
      description: string;
      highlights: string[];
    }>(prompt, {
      maxTokens: 500,
      temperature: 0.7,
      systemPrompt: SYSTEM_PROMPTS.contentCreator,
    });

    if (!result || !result.description) {
      return NextResponse.json(
        { success: false, error: { message: "Failed to generate description" } },
        { status: 500 }
      );
    }

    // Deduct 1 credit
    await prisma.user.update({
      where: { id: session.userId },
      data: { aiCredits: { decrement: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: {
        description: result.description,
        highlights: Array.isArray(result.highlights)
          ? result.highlights.map(String).slice(0, 5)
          : [],
      },
    });
  } catch (error) {
    console.error("Project description generation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate description" } },
      { status: 500 }
    );
  }
}
