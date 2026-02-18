import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";

// Validation schema
const autoGenerateSchema = z.object({
  templateId: z.string(),
  templateCategory: z.string(),
  templatePrompt: z.string(),
  platforms: z.array(z.string()).min(1),
  settings: z.object({
    tone: z.string(),
    length: z.string(),
    includeHashtags: z.boolean(),
    includeEmojis: z.boolean(),
    includeCTA: z.boolean(),
  }),
});

// Platform constraints
const platformConstraints: Record<string, { maxLength: number; hashtagLimit: number; description: string }> = {
  instagram: {
    maxLength: 2200,
    hashtagLimit: 30,
    description: "Instagram - visual-first platform, great for storytelling",
  },
  twitter: {
    maxLength: 280,
    hashtagLimit: 5,
    description: "X (Twitter) - concise, punchy, conversation-starting",
  },
  linkedin: {
    maxLength: 3000,
    hashtagLimit: 5,
    description: "LinkedIn - professional, insightful, industry-focused",
  },
  facebook: {
    maxLength: 63206,
    hashtagLimit: 10,
    description: "Facebook - community-focused, engaging, shareable",
  },
  youtube: {
    maxLength: 5000,
    hashtagLimit: 15,
    description: "YouTube - descriptive, SEO-optimized content",
  },
};

// Length targets
const lengthTargets: Record<string, { min: number; max: number }> = {
  short: { min: 50, max: 100 },
  medium: { min: 150, max: 250 },
  long: { min: 300, max: 500 },
};

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Please log in to generate content",
          },
        },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "AI auto-generation", session.userId);
    if (gate) return gate;

    const cost = await getDynamicCreditCost("AI_AUTO");

    // Check AI credits (free credits can only be used for email marketing)
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_AUTO", !!session.adminId);
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = autoGenerateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { templateCategory, templatePrompt, platforms, settings } = validation.data;

    // Fetch user's brand identity
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });

    if (!brandKit || !brandKit.isComplete) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BRAND_IDENTITY_INCOMPLETE",
            message: "Please complete your brand identity setup first",
          },
        },
        { status: 400 }
      );
    }

    // Parse brand kit JSON fields
    const personality = JSON.parse(brandKit.personality) as string[];
    const keywords = JSON.parse(brandKit.keywords) as string[];
    const avoidWords = JSON.parse(brandKit.avoidWords) as string[];
    const products = JSON.parse(brandKit.products) as string[];
    const hashtags = JSON.parse(brandKit.hashtags) as string[];

    // Build brand context
    const brandContext = buildBrandContext({
      name: brandKit.name,
      tagline: brandKit.tagline,
      description: brandKit.description,
      industry: brandKit.industry,
      niche: brandKit.niche,
      targetAudience: brandKit.targetAudience,
      audienceAge: brandKit.audienceAge,
      audienceLocation: brandKit.audienceLocation,
      voiceTone: brandKit.voiceTone,
      personality,
      keywords,
      avoidWords,
      products,
      hashtags,
      uniqueValue: brandKit.uniqueValue,
    });

    // Get platform info
    const primaryPlatform = platforms[0];
    const constraints = platformConstraints[primaryPlatform] || platformConstraints.instagram;
    const lengthTarget = lengthTargets[settings.length] || lengthTargets.medium;

    // Generate content based on category
    let prompt: string;
    let responseType: "content" | "hashtags" | "ideas";

    switch (templateCategory) {
      case "social-post":
      case "thread":
        prompt = buildPostPrompt({
          brandContext,
          templatePrompt,
          platforms,
          settings,
          lengthTarget,
          hashtagLimit: constraints.hashtagLimit,
        });
        responseType = "content";
        break;

      case "caption":
        prompt = buildCaptionPrompt({
          brandContext,
          templatePrompt,
          platforms,
          settings,
          lengthTarget,
          hashtagLimit: constraints.hashtagLimit,
        });
        responseType = "content";
        break;

      case "hashtags":
        prompt = buildHashtagPrompt({
          brandContext,
          templatePrompt,
          platforms,
        });
        responseType = "hashtags";
        break;

      case "ideas":
        prompt = buildIdeasPrompt({
          brandContext,
          templatePrompt,
          platforms,
        });
        responseType = "ideas";
        break;

      default:
        prompt = buildPostPrompt({
          brandContext,
          templatePrompt,
          platforms,
          settings,
          lengthTarget,
          hashtagLimit: constraints.hashtagLimit,
        });
        responseType = "content";
    }

    // Generate content with AI
    const aiResponse = await ai.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.8,
      systemPrompt: `You are an expert social media content creator and marketing specialist.
You create engaging, platform-optimized content that drives engagement and conversions.
You deeply understand brand voice and always maintain consistency with the brand identity.
You understand each platform's unique culture, best practices, and algorithm preferences.`,
    });

    // Parse response based on type
    let responseData;
    if (responseType === "content") {
      responseData = { content: aiResponse.trim() };
    } else if (responseType === "hashtags") {
      // Parse hashtags from response
      const hashtagMatches = aiResponse.match(/#\w+/g) || [];
      responseData = { hashtags: hashtagMatches };
    } else if (responseType === "ideas") {
      // Parse ideas from response
      const ideas = parseIdeasResponse(aiResponse);
      responseData = { ideas };
    }

    // Track usage - for admin users, don't decrement credits but still track
    if (session.adminId) {
      await prisma.aIUsage.create({
        data: {
          adminId: session.adminId,
          userId: null,
          feature: `auto_${templateCategory}`,
          inputTokens: ai.estimateTokens(prompt),
          outputTokens: ai.estimateTokens(aiResponse),
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
            feature: `auto_${templateCategory}`,
            inputTokens: ai.estimateTokens(prompt),
            outputTokens: ai.estimateTokens(aiResponse),
            model: "claude-sonnet-4-20250514",
          },
        }),
      ]);
    }

    // Save to Generated Content Library
    let savedContent = "";
    if (responseType === "content") {
      savedContent = aiResponse.trim();
    } else if (responseType === "hashtags") {
      const savedHashtags = aiResponse.match(/#\w+/g) || [];
      savedContent = savedHashtags.join(" ");
    } else if (responseType === "ideas") {
      savedContent = aiResponse;
    }

    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: `auto_${templateCategory}`,
        content: savedContent,
        prompt: templatePrompt.substring(0, 500),
        platforms: JSON.stringify(platforms),
        settings: JSON.stringify(settings),
        metadata: JSON.stringify({ templateCategory }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...responseData,
        platforms,
        creditsUsed: cost,
        creditsRemaining: session.user.aiCredits - cost,
      },
    });
  } catch (error) {
    console.error("Auto-generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to generate content",
        },
      },
      { status: 500 }
    );
  }
}

function buildBrandContext(brand: {
  name: string;
  tagline?: string | null;
  description?: string | null;
  industry?: string | null;
  niche?: string | null;
  targetAudience?: string | null;
  audienceAge?: string | null;
  audienceLocation?: string | null;
  voiceTone?: string | null;
  personality: string[];
  keywords: string[];
  avoidWords: string[];
  products: string[];
  hashtags: string[];
  uniqueValue?: string | null;
}): string {
  let context = `BRAND IDENTITY:
Brand Name: ${brand.name}`;

  if (brand.tagline) context += `\nTagline: ${brand.tagline}`;
  if (brand.description) context += `\nBrand Description: ${brand.description}`;
  if (brand.industry) context += `\nIndustry: ${brand.industry}`;
  if (brand.niche) context += `\nNiche: ${brand.niche}`;
  if (brand.uniqueValue) context += `\nUnique Value Proposition: ${brand.uniqueValue}`;

  context += `\n\nTARGET AUDIENCE:`;
  if (brand.targetAudience) context += `\n- ${brand.targetAudience}`;
  if (brand.audienceAge) context += `\n- Age: ${brand.audienceAge}`;
  if (brand.audienceLocation) context += `\n- Location: ${brand.audienceLocation}`;

  context += `\n\nBRAND VOICE:`;
  if (brand.voiceTone) context += `\nTone: ${brand.voiceTone}`;
  if (brand.personality.length > 0) context += `\nPersonality: ${brand.personality.join(", ")}`;

  if (brand.keywords.length > 0) {
    context += `\n\nKEY TOPICS/KEYWORDS: ${brand.keywords.join(", ")}`;
  }

  if (brand.products.length > 0) {
    context += `\n\nPRODUCTS/SERVICES: ${brand.products.join(", ")}`;
  }

  if (brand.hashtags.length > 0) {
    context += `\n\nBRAND HASHTAGS: ${brand.hashtags.join(" ")}`;
  }

  if (brand.avoidWords.length > 0) {
    context += `\n\nWORDS/TOPICS TO AVOID: ${brand.avoidWords.join(", ")}`;
  }

  return context;
}

function buildPostPrompt(params: {
  brandContext: string;
  templatePrompt: string;
  platforms: string[];
  settings: { tone: string; includeHashtags: boolean; includeEmojis: boolean; includeCTA: boolean };
  lengthTarget: { min: number; max: number };
  hashtagLimit: number;
}): string {
  const { brandContext, templatePrompt, platforms, settings, lengthTarget, hashtagLimit } = params;

  const platformDescriptions = platforms
    .map(p => platformConstraints[p]?.description || p)
    .join("; ");

  let prompt = `${brandContext}

TEMPLATE GUIDE (use as inspiration, adapt for the brand):
${templatePrompt}

TARGET PLATFORMS: ${platformDescriptions}
TARGET LENGTH: ${lengthTarget.min}-${lengthTarget.max} characters

REQUIREMENTS:
- Create an engaging social media post that perfectly represents this brand
- Use the brand's voice, tone (${settings.tone}), and personality throughout
- Address the target audience directly
- Incorporate relevant brand keywords naturally
- Make it platform-optimized for maximum engagement`;

  if (settings.includeCTA) {
    prompt += `\n- Include a compelling call-to-action`;
  }

  if (settings.includeHashtags) {
    prompt += `\n- Include relevant hashtags (max ${hashtagLimit}) - mix of brand hashtags and trending ones`;
  } else {
    prompt += `\n- Do NOT include hashtags`;
  }

  if (settings.includeEmojis) {
    prompt += `\n- Use emojis strategically to enhance the message`;
  } else {
    prompt += `\n- Do NOT use emojis`;
  }

  prompt += `\n
Write ONLY the ready-to-publish post content. No explanations, no quotation marks, no labels.`;

  return prompt;
}

function buildCaptionPrompt(params: {
  brandContext: string;
  templatePrompt: string;
  platforms: string[];
  settings: { tone: string; includeHashtags: boolean; includeEmojis: boolean };
  lengthTarget: { min: number; max: number };
  hashtagLimit: number;
}): string {
  const { brandContext, templatePrompt, platforms, settings, lengthTarget, hashtagLimit } = params;

  let prompt = `${brandContext}

CAPTION TEMPLATE GUIDE:
${templatePrompt}

TARGET PLATFORMS: ${platforms.join(", ")}
TARGET LENGTH: ${lengthTarget.min}-${lengthTarget.max} characters

Create a compelling caption for an image/video post that:
- Perfectly captures the brand's voice and personality
- Engages the target audience
- Works well with visual content
- Is optimized for ${platforms.join(" and ")}`;

  if (settings.includeHashtags) {
    prompt += `\n- Includes relevant hashtags (max ${hashtagLimit})`;
  }

  if (settings.includeEmojis) {
    prompt += `\n- Uses emojis to add visual appeal`;
  }

  prompt += `\n
Write ONLY the caption. No explanations or labels.`;

  return prompt;
}

function buildHashtagPrompt(params: {
  brandContext: string;
  templatePrompt: string;
  platforms: string[];
}): string {
  const { brandContext, templatePrompt, platforms } = params;

  return `${brandContext}

HASHTAG STRATEGY GUIDE:
${templatePrompt}

TARGET PLATFORMS: ${platforms.join(", ")}

Generate 20 hashtags that:
- Include the brand's signature hashtags
- Mix high-reach trending hashtags with niche-specific ones
- Are relevant to the brand's industry and target audience
- Work well on ${platforms.join(" and ")}

Format: Return ONLY the hashtags, each starting with #, separated by spaces.
Example: #hashtag1 #hashtag2 #hashtag3`;
}

function buildIdeasPrompt(params: {
  brandContext: string;
  templatePrompt: string;
  platforms: string[];
}): string {
  const { brandContext, templatePrompt, platforms } = params;

  return `${brandContext}

CONTENT PLANNING GUIDE:
${templatePrompt}

TARGET PLATFORMS: ${platforms.join(", ")}

Generate 5 unique content ideas for this brand that:
- Align with the brand's voice and values
- Appeal to the target audience
- Are suitable for ${platforms.join(" and ")}
- Mix educational, engaging, and promotional content

Format each idea as:
TITLE: [Short catchy title]
DESCRIPTION: [2-3 sentences explaining the content]
PILLAR: [educational/entertaining/inspiring/promotional]

---`;
}

function parseIdeasResponse(response: string): Array<{ title: string; description: string; pillar: string }> {
  const ideas: Array<{ title: string; description: string; pillar: string }> = [];
  const blocks = response.split("---").filter(Boolean);

  for (const block of blocks) {
    const titleMatch = block.match(/TITLE:\s*(.+)/i);
    const descMatch = block.match(/DESCRIPTION:\s*(.+)/is);
    const pillarMatch = block.match(/PILLAR:\s*(\w+)/i);

    if (titleMatch && descMatch) {
      ideas.push({
        title: titleMatch[1].trim(),
        description: descMatch[1].trim().replace(/\n/g, " ").substring(0, 200),
        pillar: pillarMatch ? pillarMatch[1].toLowerCase() : "educational",
      });
    }
  }

  // If parsing failed, create basic ideas from the response
  if (ideas.length === 0 && response.trim()) {
    const lines = response.split("\n").filter(l => l.trim());
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      ideas.push({
        title: lines[i].substring(0, 50),
        description: lines[i],
        pillar: "educational",
      });
    }
  }

  return ideas.slice(0, 5);
}
