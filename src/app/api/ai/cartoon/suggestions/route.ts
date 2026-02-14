import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ai } from "@/lib/ai/client";

interface BrandKit {
  name: string;
  tagline?: string | null;
  description?: string | null;
  industry?: string | null;
  niche?: string | null;
  targetAudience?: string | null;
  voiceTone?: string | null;
  personality: string[];
  keywords: string[];
  products: string[];
  uniqueValue?: string | null;
}

interface StorySuggestion {
  title: string;
  prompt: string;
  hook: string;
}

// Theme categories for variety - each request picks a random subset
const THEME_POOLS = [
  "origin story / how it all began",
  "customer success story / transformation",
  "behind-the-scenes / day in the life",
  "problem-solution adventure",
  "seasonal / holiday special",
  "unexpected hero / underdog tale",
  "time travel / future vision",
  "comedy / funny mishap",
  "emotional / heartwarming moment",
  "mystery / detective story",
  "space / sci-fi adventure",
  "nature / animal friendship",
  "sports / competition challenge",
  "cooking / food journey",
  "travel / exploration adventure",
  "superhero / powers discovery",
  "music / dance celebration",
  "teamwork / collaboration story",
  "innovation / invention tale",
  "cultural celebration / tradition",
];

// Storytelling angles for even more variety
const STORYTELLING_ANGLES = [
  "told from a child's perspective",
  "narrated by the product itself",
  "set in a fantasy world",
  "set in outer space",
  "happening in reverse (end to beginning)",
  "told as a fairy tale",
  "set in the future (year 2050)",
  "told through a pet's eyes",
  "set during a big event or festival",
  "told as a mini documentary",
  "set in a magical version of everyday life",
  "told as a comic book adventure",
  "set underwater",
  "told through a series of lucky coincidences",
  "set in a tiny miniature world",
];

/**
 * Randomly pick N items from an array (Fisher-Yates shuffle)
 */
function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// POST /api/ai/cartoon/suggestions - Generate brand-focused story suggestions
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Fetch user's brand kit
    const brandKitRaw = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });

    if (!brandKitRaw) {
      // Try to find any brand kit
      const anyBrandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
      });

      if (!anyBrandKit) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "NO_BRAND_KIT",
              message: "Please set up your brand identity first to get personalized suggestions"
            }
          },
          { status: 400 }
        );
      }
    }

    const rawKit = brandKitRaw || await prisma.brandKit.findFirst({
      where: { userId: session.userId },
    });

    if (!rawKit) {
      return NextResponse.json(
        { success: false, error: { message: "Brand kit not found" } },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const brandKit: BrandKit = {
      name: rawKit.name,
      tagline: rawKit.tagline,
      description: rawKit.description,
      industry: rawKit.industry,
      niche: rawKit.niche,
      targetAudience: rawKit.targetAudience,
      voiceTone: rawKit.voiceTone,
      personality: JSON.parse(rawKit.personality || "[]"),
      keywords: JSON.parse(rawKit.keywords || "[]"),
      products: JSON.parse(rawKit.products || "[]"),
      uniqueValue: rawKit.uniqueValue,
    };

    // Fetch recent cartoon prompts to avoid repeating similar ideas
    const recentCartoons = await prisma.cartoonVideo.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { storyPrompt: true },
    });
    const recentPrompts = recentCartoons.map(c => c.storyPrompt).filter(Boolean);

    // Pick random themes and angles for this request
    const selectedThemes = pickRandom(THEME_POOLS, 4);
    const selectedAngles = pickRandom(STORYTELLING_ANGLES, 4);
    const randomSeed = Math.floor(Math.random() * 100000);

    // Build the avoid-repetition section
    const avoidSection = recentPrompts.length > 0
      ? `\nPREVIOUSLY USED STORY IDEAS (DO NOT repeat or closely resemble these):\n${recentPrompts.map((p, i) => `${i + 1}. "${p.slice(0, 120)}"`).join("\n")}\n`
      : "";

    // Generate AI suggestions based on brand with randomized constraints
    const prompt = `You are a wildly creative marketing storyteller. Generate 4 completely unique and fresh animated cartoon story ideas for this brand. Each suggestion MUST be different from anything you've generated before.

BRAND INFORMATION:
- Brand Name: ${brandKit.name}
${brandKit.tagline ? `- Tagline: ${brandKit.tagline}` : ""}
${brandKit.description ? `- Description: ${brandKit.description}` : ""}
${brandKit.industry ? `- Industry: ${brandKit.industry}` : ""}
${brandKit.niche ? `- Niche: ${brandKit.niche}` : ""}
${brandKit.targetAudience ? `- Target Audience: ${brandKit.targetAudience}` : ""}
${brandKit.voiceTone ? `- Brand Voice: ${brandKit.voiceTone}` : ""}
${brandKit.personality.length > 0 ? `- Brand Personality: ${brandKit.personality.join(", ")}` : ""}
${brandKit.keywords.length > 0 ? `- Brand Keywords: ${brandKit.keywords.join(", ")}` : ""}
${brandKit.products.length > 0 ? `- Products/Services: ${brandKit.products.join(", ")}` : ""}
${brandKit.uniqueValue ? `- Unique Value: ${brandKit.uniqueValue}` : ""}
${avoidSection}
MANDATORY THEME ASSIGNMENTS (each story MUST use its assigned theme):
- Story 1 theme: ${selectedThemes[0]}
- Story 2 theme: ${selectedThemes[1]}
- Story 3 theme: ${selectedThemes[2]}
- Story 4 theme: ${selectedThemes[3]}

MANDATORY STORYTELLING ANGLE (each story MUST use its assigned angle):
- Story 1 angle: ${selectedAngles[0]}
- Story 2 angle: ${selectedAngles[1]}
- Story 3 angle: ${selectedAngles[2]}
- Story 4 angle: ${selectedAngles[3]}

CREATIVITY SEED: ${randomSeed} (use this to inspire unexpected creative choices)

REQUIREMENTS:
1. Each story MUST follow its assigned theme and storytelling angle above
2. Each story should subtly promote the brand while telling an engaging story
3. Stories should appeal to the target audience
4. Match the brand voice and personality
5. Include unique, memorable characters with distinct names
6. Stories should be suitable for 30-90 second animated videos
7. Make stories memorable, shareable, and entertaining
8. Don't make it feel like an ad - tell a genuine story with brand values
9. Be BOLD and CREATIVE - surprise the viewer with unexpected twists

OUTPUT FORMAT (strict JSON):
{
  "suggestions": [
    {
      "title": "Short catchy title (4-6 words)",
      "prompt": "Full story prompt for the cartoon maker (50-100 words describing the story, characters, and arc)",
      "hook": "Why this story works for the brand (1 sentence)"
    }
  ]
}

Generate 4 wildly different, creative, brand-aligned story suggestions:`;

    const result = await ai.generateJSON<{ suggestions: StorySuggestion[] }>(prompt, {
      maxTokens: 2000,
      temperature: 1.0,
      systemPrompt: `You are an incredibly creative marketing storyteller with an endless imagination. You NEVER repeat yourself. Every set of suggestions you create is completely fresh and unexpected. You love mixing genres, surprising twists, and unique character concepts. Creativity seed for this session: ${randomSeed}. Always respond with valid JSON only.`,
    });

    if (!result?.suggestions || result.suggestions.length === 0) {
      throw new Error("Failed to generate suggestions");
    }

    // Track AI usage
    await prisma.aIUsage.create({
      data: {
        userId: session.userId,
        feature: "cartoon_suggestions",
        model: "claude-sonnet",
        inputTokens: 0,
        outputTokens: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        suggestions: result.suggestions,
        brandName: brandKit.name,
      },
    });
  } catch (error) {
    console.error("Generate suggestions error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate suggestions" } },
      { status: 500 }
    );
  }
}
