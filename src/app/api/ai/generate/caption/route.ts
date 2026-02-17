import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";

const generateCaptionSchema = z.object({
  platforms: z.array(z.enum(["instagram", "twitter", "linkedin", "facebook", "youtube"])).min(1),
  mediaType: z.enum(["image", "video", "carousel"]),
  mediaDescription: z.string().min(10, "Description must be at least 10 characters").max(1000),
  context: z.string().max(500).optional(),
  tone: z.enum(["professional", "casual", "humorous", "inspirational", "educational"]),
  length: z.enum(["short", "medium", "long"]),
  includeHashtags: z.boolean().default(true),
  includeEmojis: z.boolean().default(true),
});

const platformConstraints = {
  instagram: {
    maxLength: 2200,
    hashtagLimit: 30,
    description: "Instagram - visual storytelling, engaging captions that complement imagery",
  },
  twitter: {
    maxLength: 280,
    hashtagLimit: 3,
    description: "X (Twitter) - concise, punchy captions that spark conversation",
  },
  linkedin: {
    maxLength: 3000,
    hashtagLimit: 5,
    description: "LinkedIn - professional insights, thought leadership captions",
  },
  facebook: {
    maxLength: 63206,
    hashtagLimit: 10,
    description: "Facebook - community-focused, story-driven captions",
  },
  youtube: {
    maxLength: 5000,
    hashtagLimit: 15,
    description: "YouTube - descriptive, SEO-optimized video descriptions",
  },
};

const lengthTargets = {
  short: { min: 30, max: 80 },
  medium: { min: 100, max: 200 },
  long: { min: 250, max: 400 },
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Please log in to generate content" },
        },
        { status: 401 }
      );
    }

    const gate = checkPlanAccess(session.user.plan, "AI caption generation");
    if (gate) return gate;

    const cost = await getDynamicCreditCost("AI_CAPTION");

    const creditCheck = await checkCreditsForFeature(session.userId, "AI_CAPTION", !!session.adminId);
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = generateCaptionSchema.safeParse(body);

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

    const {
      platforms,
      mediaType,
      mediaDescription,
      context,
      tone,
      length,
      includeHashtags,
      includeEmojis,
    } = validation.data;

    const primaryPlatform = platforms[0];
    const constraints = platformConstraints[primaryPlatform];
    const lengthTarget = lengthTargets[length];

    const platformDescriptions = platforms
      .map(p => platformConstraints[p]?.description || p)
      .join("; ");

    const prompt = buildCaptionPrompt({
      platforms,
      platformDescriptions,
      mediaType,
      mediaDescription,
      context,
      tone,
      lengthTarget,
      includeHashtags,
      hashtagLimit: constraints.hashtagLimit,
      includeEmojis,
    });

    const content = await ai.generate(prompt, {
      maxTokens: 1024,
      temperature: 0.8,
      systemPrompt: `You are an expert social media caption writer and content strategist.
You craft compelling captions that enhance visual content and drive engagement.
You understand how to write captions that complement images and videos while capturing attention.
Always return ONLY the caption content, nothing else - no explanations, no quotation marks, no labels.`,
    });

    // Track usage - for admin users, don't decrement credits but still track
    if (session.adminId) {
      await prisma.aIUsage.create({
        data: {
          adminId: session.adminId,
          userId: null,
          feature: "caption_generation",
          inputTokens: ai.estimateTokens(prompt),
          outputTokens: ai.estimateTokens(content),
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
            feature: "caption_generation",
            inputTokens: ai.estimateTokens(prompt),
            outputTokens: ai.estimateTokens(content),
            model: "claude-sonnet-4-20250514",
          },
        }),
      ]);
    }

    // Save to Generated Content Library
    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "caption",
        content: content.trim(),
        prompt: mediaDescription,
        platforms: JSON.stringify(platforms),
        settings: JSON.stringify({ mediaType, tone, length, includeHashtags, includeEmojis }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        content: content.trim(),
        platforms,
        mediaType,
        creditsUsed: cost,
        creditsRemaining: session.user.aiCredits - cost,
      },
    });
  } catch (error) {
    console.error("Caption generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to generate caption",
        },
      },
      { status: 500 }
    );
  }
}

function buildCaptionPrompt(params: {
  platforms: string[];
  platformDescriptions: string;
  mediaType: string;
  mediaDescription: string;
  context?: string;
  tone: string;
  lengthTarget: { min: number; max: number };
  includeHashtags: boolean;
  hashtagLimit: number;
  includeEmojis: boolean;
}): string {
  const {
    platforms,
    platformDescriptions,
    mediaType,
    mediaDescription,
    context,
    tone,
    lengthTarget,
    includeHashtags,
    hashtagLimit,
    includeEmojis,
  } = params;

  const platformList = platforms.map(p => p.toUpperCase()).join(", ");

  let prompt = `Write a captivating caption for a ${mediaType} optimized for: ${platformList}

Visual Content Description: ${mediaDescription}
${context ? `\nAdditional Context: ${context}` : ""}

Target Platforms: ${platformDescriptions}
Tone: ${tone}
Target length: ${lengthTarget.min}-${lengthTarget.max} characters

Requirements:
- Create a caption that enhances and complements the visual content
- Write in a ${tone} voice that works well across all selected platforms
- Make it engaging and encourage interaction
- Hook the reader in the first line`;

  if (includeHashtags) {
    prompt += `\n- Include relevant hashtags (max ${hashtagLimit}) at the end`;
  } else {
    prompt += `\n- Do NOT include any hashtags`;
  }

  if (includeEmojis) {
    prompt += `\n- Use emojis strategically to enhance the message`;
  } else {
    prompt += `\n- Do NOT use any emojis`;
  }

  prompt += `\n
Write ONLY the caption. No explanations, no quotation marks, no "Here's your caption:" prefix.
Just the ready-to-use caption.`;

  return prompt;
}
