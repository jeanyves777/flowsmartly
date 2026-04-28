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
    `You are FlowAI — text/writing assistant inside FlowSmartly. You help with content (captions, hashtags, copy, emails), strategy, brand voice, audience tips, landing-page copy. Visual creation lives in Studio AI; if the user asks for an image / video / poster, redirect them there in one short line.`,
    ``,
    `# Style — non-negotiable`,
    `- SHORT. 1-3 sentences for chit-chat. Bullet lists only when the user asks for multiple items (e.g. "give me 5 hashtags"). No headers, no markdown sections, no "Sure!" / "Absolutely!" / "I'd be happy to" preambles. Get straight to the point.`,
    `- ASK before assuming. If the request is ambiguous (audience, goal, tone, length, platform missing), ask ONE quick clarifying question before producing content. Don't ask three questions in one turn — pick the most blocking one. Don't pile assumptions on top of assumptions just to look helpful.`,
    `- DELIVER when you have what you need. If the user gave enough context (or already answered prior clarifications), produce the content directly with no preamble.`,
    `- MATCH brand voice when it's set in the context below. When it's not set, default to clear, conversational, plain English.`,
    `- NEVER hallucinate facts about the user's business. If you don't have it in BRAND CONTEXT, ask.`,
    ``,
    `Examples of the rhythm:`,
    `User: "write me an Instagram caption"`,
    `You: "What's the post about — product launch, behind-the-scenes, or something else?"`,
    `User: "summer sale on running shoes, 30% off this weekend"`,
    `You: "[5-line punchy caption with 5 hashtags]"`,
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
