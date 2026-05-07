import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { geminiText as ai } from "@/lib/ai/gemini-text-client";
import { getDynamicCreditCost } from "@/lib/credits/costs";

const safeJsonArray = (value: string | null | undefined) => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

type GeneratedPostIdea = {
  title: string;
  angle: string;
  format: string;
  platforms: string[];
  caption: string;
};

const stripJsonFence = (value: string) =>
  value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const parseJsonPayload = (raw: string) => {
  const cleaned = stripJsonFence(raw);
  const candidates = [cleaned];
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(cleaned.slice(objectStart, objectEnd + 1));
  }
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(cleaned.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next likely JSON slice.
    }
  }
  return null;
};

const normalizeIdea = (idea: unknown, fallbackPlatforms: string[]): GeneratedPostIdea | null => {
  if (!idea || typeof idea !== "object") return null;
  const item = idea as Record<string, unknown>;
  const caption = typeof item.caption === "string" ? item.caption.trim() : "";
  if (!caption) return null;

  return {
    title: typeof item.title === "string" && item.title.trim() ? item.title.trim().slice(0, 60) : "Brand-ready post",
    angle: typeof item.angle === "string" && item.angle.trim() ? item.angle.trim().slice(0, 40) : "Brand idea",
    format: typeof item.format === "string" && item.format.trim() ? item.format.trim().slice(0, 70) : "Ready-to-use caption",
    platforms: Array.isArray(item.platforms)
      ? item.platforms.filter((platform): platform is string => typeof platform === "string").slice(0, 5)
      : fallbackPlatforms,
    caption: caption.slice(0, 2000),
  };
};

const parseGeneratedIdeas = (raw: string, fallbackPlatforms: string[]): GeneratedPostIdea[] => {
  const parsed = parseJsonPayload(raw);
  if (!parsed) return [];
  const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.ideas) ? parsed.ideas : [];
  return items
    .map((item: unknown) => normalizeIdea(item, fallbackPlatforms))
    .filter((item: GeneratedPostIdea | null): item is GeneratedPostIdea => Boolean(item));
};

const buildSinglePostPrompt = (brandContext: string, requestedPlatforms: string[], usedAngles: string[] = []) =>
  `Based on this brand identity:\n\n${brandContext}\n\nWrite one complete, ready-to-use social post with enough substance to publish without extra rewriting.${
    requestedPlatforms.length > 0 ? `\nSelected platforms: ${requestedPlatforms.join(", ")}` : ""
  }${usedAngles.length > 0 ? `\nAvoid repeating these angles: ${usedAngles.join(", ")}` : ""}\n\nRules:\n- Return only the finished post copy; no labels such as Hook, Post, CTA, Hashtags, no markdown, no JSON.\n- 120-180 words unless the selected platform requires shorter copy.\n- Open with a strong customer-facing line, then 2-3 short paragraphs with concrete brand/customer details.\n- Include one clear call-to-action in natural language.\n- Include 5-8 relevant hashtags at the end, mixing brand, niche, local, and discovery tags.\n- Naturally include 3-5 SEO/search phrases from the brand identity without keyword stuffing.\n- Use 2-4 tasteful emojis to make the hook, body, and CTA easier to scan.\n- Use real paragraph breaks. Do not return one compact wall of text.\n- No placeholders like [brand], [offer], or \"your customer\".\n\nRespond with only the ready-to-paste post.`;

const generateSingleIdea = async (
  brandContext: string,
  requestedPlatforms: string[],
  usedAngles: string[] = []
): Promise<GeneratedPostIdea | null> => {
  const response = await ai.generate(buildSinglePostPrompt(brandContext, requestedPlatforms, usedAngles), {
    maxTokens: 900,
    systemPrompt:
      "You are a senior social media strategist and SEO copywriter. Return only finished customer-facing post copy that is ready to paste. Do not return labels, JSON, markdown, or instructions.",
  });
  const clean = response.trim();
  if (!clean) return null;

  const parsed = parseGeneratedIdeas(clean, requestedPlatforms);
  if (parsed[0]) return parsed[0];

  return {
    title: "Brand-ready post",
    angle: "AI idea",
    format: requestedPlatforms.length > 0 ? requestedPlatforms.join(", ") : "Selected channels",
    platforms: requestedPlatforms,
    caption: clean.slice(0, 2000),
  };
};

// POST /api/content/posts/generate-idea — AI-suggest a post idea from brand identity
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const requestedPlatforms = Array.isArray(body.platforms)
      ? body.platforms
          .filter((platform: unknown): platform is string => typeof platform === "string")
          .slice(0, 6)
      : [];
    const currentDraft = typeof body.currentDraft === "string" ? body.currentDraft.trim().slice(0, 700) : "";
    const count = Math.min(5, Math.max(1, Number.isFinite(Number(body.count)) ? Number(body.count) : 3));

    // Build context from brand
    const brandContext = [
      `Brand: ${brandKit.name}`,
      brandKit.tagline ? `Tagline: ${brandKit.tagline}` : null,
      brandKit.niche ? `Niche: ${brandKit.niche}` : null,
      brandKit.industry ? `Industry: ${brandKit.industry}` : null,
      brandKit.targetAudience ? `Target audience: ${brandKit.targetAudience}` : null,
      brandKit.uniqueValue ? `Value proposition: ${brandKit.uniqueValue}` : null,
      safeJsonArray(brandKit.keywords).length > 0 ? `Keywords: ${safeJsonArray(brandKit.keywords).join(", ")}` : null,
      safeJsonArray(brandKit.products).length > 0 ? `Products/services: ${safeJsonArray(brandKit.products).join(", ")}` : null,
      safeJsonArray(brandKit.hashtags).length > 0 ? `Preferred hashtags: ${safeJsonArray(brandKit.hashtags).join(", ")}` : null,
      brandKit.voiceTone ? `Voice/tone: ${brandKit.voiceTone}` : null,
      requestedPlatforms.length > 0 ? `Selected platforms: ${requestedPlatforms.join(", ")}` : null,
      currentDraft ? `Current draft/context: ${currentDraft}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = count > 1
      ? `Based on this brand identity:\n\n${brandContext}\n\nGenerate exactly ${count} ready-to-use social post ideas. These must be finished captions, not instructions, not templates, and not placeholders.\n\nReturn ONLY valid JSON in this exact shape:\n{\n  "ideas": [\n    {\n      "title": "short descriptive title",\n      "angle": "short marketing angle",\n      "format": "where/how this works best",\n      "platforms": ["facebook", "linkedin"],\n      "caption": "finished customer-facing post copy with no backend labels, ending with relevant hashtags"\n    }\n  ]\n}\n\nRules:\n- Return exactly ${count} items in the ideas array.\n- Every caption must be ready to paste and publish.\n- Each caption should be 120-180 words unless the selected platform needs shorter copy.\n- Use the brand name, audience, offer, voice, products/services, keywords, preferred hashtags, location, and contact context when available.\n- Include a natural CTA and 5-8 relevant hashtags inside the caption.\n- Naturally include 3-5 SEO/search phrases inside the caption without keyword stuffing.\n- Use 2-4 tasteful emojis to separate hook, value, and CTA.\n- Use real paragraph breaks. Do not return one compact wall of text.\n- Do NOT expose labels like Hook, Post, CTA, Hashtags in the caption text.\n- Do NOT say \"show\", \"share\", \"use\", \"insert\", \"add\", or any instruction telling the user what to do, unless it is a customer-facing CTA.\n- No placeholders like [brand], [offer], or \"your customer\".\n- Match the selected platforms when provided.\n- Make each idea meaningfully different.`
      : buildSinglePostPrompt(brandContext, requestedPlatforms);

    const idea = await ai.generate(prompt, {
      maxTokens: count > 1 ? 2800 : 900,
      systemPrompt:
        "You are a senior social media strategist, SEO copywriter, and content planner. Create complete, ready-to-use post copy. Keep provider/backend details hidden and never expose internal labels in customer-facing captions.",
    });

    const cleanIdea = idea?.trim() || "Share something amazing with your audience today!";
    const ideas = parseGeneratedIdeas(cleanIdea, requestedPlatforms);
    if (count > 1) {
      while (ideas.length < count) {
        const nextIdea = await generateSingleIdea(
          brandContext,
          requestedPlatforms,
          ideas.map((item) => item.angle)
        );
        if (!nextIdea) break;
        ideas.push({
          ...nextIdea,
          title: nextIdea.title === "Brand-ready post" ? `Brand-ready post ${ideas.length + 1}` : nextIdea.title,
        });
      }
    }
    const primaryIdea = ideas[0]?.caption || cleanIdea;

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
            referenceType: "ai_post_idea",
            description: "Post creation: AI idea suggestion",
          },
        }),
      ]);
    }

    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "post_idea",
        model: "gemini-2.5-flash",
        inputTokens: ai.estimateTokens(prompt),
        outputTokens: ai.estimateTokens(count > 1 ? JSON.stringify(ideas) : cleanIdea),
        costCents: 0,
      },
    });

    // Save to history
    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "post_ideas",
        content: JSON.stringify(count > 1 ? ideas.map((item) => item.caption) : [primaryIdea]),
        prompt: count > 1 ? "brand trend post ideas" : "post idea",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        idea: primaryIdea,
        ideas,
        creditsUsed: creditCost,
        creditsRemaining: isAdmin ? undefined : (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("Generate post idea error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to generate post idea" } },
      { status: 500 }
    );
  }
}
