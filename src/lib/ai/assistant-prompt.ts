import { prisma } from "@/lib/db/client";

/**
 * Build the FlowAI assistant system prompt with brand context and conversation memory
 */
export async function buildAssistantPrompt(userId: string): Promise<string> {
  // Load default brand kit
  const brandKit = await prisma.brandKit.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  // Load recent conversation summaries for memory context
  const recentConversations = await prisma.aIConversation.findMany({
    where: { userId, summary: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { title: true, summary: true, updatedAt: true },
  });

  const parts: string[] = [
    `You are FlowAI, the intelligent assistant built into FlowSmartly — an all-in-one marketing and social media management platform.`,
    ``,
    `Your role is to help the user with:`,
    `- Content creation (social media posts, captions, hashtags, email copy)`,
    `- Marketing strategy and campaign ideas`,
    `- Brand voice and messaging guidance`,
    `- Audience targeting and growth tips`,
    `- Landing page and ad copy suggestions`,
    `- General business and marketing advice`,
    ``,
    `Guidelines:`,
    `- Be concise and actionable. Provide specific, ready-to-use content when possible.`,
    `- Match the user's brand voice and tone when creating content.`,
    `- Format responses with markdown (bold, lists, headers) for readability.`,
    `- If the user asks for content, provide it directly — don't ask too many clarifying questions.`,
    `- Reference the user's brand details naturally when relevant.`,
    `- Be friendly, professional, and encouraging.`,
  ];

  // Add brand context
  if (brandKit) {
    parts.push(``, `--- BRAND CONTEXT ---`);
    parts.push(`Brand Name: ${brandKit.name}`);
    if (brandKit.tagline) parts.push(`Tagline: ${brandKit.tagline}`);
    if (brandKit.description) parts.push(`Description: ${brandKit.description}`);
    if (brandKit.industry) parts.push(`Industry: ${brandKit.industry}`);
    if (brandKit.niche) parts.push(`Niche: ${brandKit.niche}`);
    if (brandKit.targetAudience) parts.push(`Target Audience: ${brandKit.targetAudience}`);
    if (brandKit.voiceTone) parts.push(`Voice/Tone: ${brandKit.voiceTone}`);
    if (brandKit.uniqueValue) parts.push(`Unique Value Proposition: ${brandKit.uniqueValue}`);

    try {
      const personality = JSON.parse(brandKit.personality);
      if (Array.isArray(personality) && personality.length > 0) {
        parts.push(`Brand Personality: ${personality.join(", ")}`);
      }
    } catch { /* ignore */ }

    try {
      const keywords = JSON.parse(brandKit.keywords);
      if (Array.isArray(keywords) && keywords.length > 0) {
        parts.push(`Keywords: ${keywords.join(", ")}`);
      }
    } catch { /* ignore */ }

    try {
      const avoidWords = JSON.parse(brandKit.avoidWords);
      if (Array.isArray(avoidWords) && avoidWords.length > 0) {
        parts.push(`Words to Avoid: ${avoidWords.join(", ")}`);
      }
    } catch { /* ignore */ }

    try {
      const products = JSON.parse(brandKit.products);
      if (Array.isArray(products) && products.length > 0) {
        parts.push(`Products/Services: ${products.join(", ")}`);
      }
    } catch { /* ignore */ }
  }

  // Add conversation memory
  if (recentConversations.length > 0) {
    parts.push(``, `--- RECENT CONVERSATION MEMORY ---`);
    parts.push(`The user has had these recent conversations with you:`);
    for (const conv of recentConversations) {
      parts.push(`- "${conv.title}": ${conv.summary}`);
    }
    parts.push(`Use this context if the user references past discussions.`);
  }

  return parts.join("\n");
}
