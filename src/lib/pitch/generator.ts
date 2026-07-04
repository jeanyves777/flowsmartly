import { HAIKU_MODEL, ai } from "@/lib/ai/client";
import type { AgentTool } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import type { ResearchData } from "./researcher";

export interface PitchContent {
  subject: string;
  headline: string;
  personalizedHook: string;
  keyFindings: string[];
  hiddenFindingsCount: number;
  opportunityParagraph: string;
  solutionBullets: string[];
  impactParagraph: string;
  ctaText: string;
  ctaSubtext: string;
  closingLine: string;
}

export interface BrandContext {
  name: string;
  description?: string;
  industry?: string;
  niche?: string;
  products?: string[];
  uniqueValue?: string;
  targetAudience?: string;
  website?: string;
  senderName?: string;
}

function safeJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clean(value: unknown, max = 800): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function htmlToText(html: string, max = 6000): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function buildTools(ctx: { userId: string; research: ResearchData; brand: BrandContext }): AgentTool[] {
  return [
    {
      name: "get_brand_identity",
      description:
        "Fetch the user's live brand identity. Use this as the source of truth for the SENDER: name, services/products they actually sell, voice, audience, unique value, contact details. Do not propose services not listed here.",
      input_schema: { type: "object", properties: {} },
      handler: async () => {
        const kit = await prisma.brandKit.findFirst({
          where: { userId: ctx.userId },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        });
        if (!kit) return { configured: false, fallback: ctx.brand };
        return {
          configured: true,
          name: kit.name,
          tagline: kit.tagline,
          description: kit.description,
          industry: kit.industry,
          niche: kit.niche,
          targetAudience: kit.targetAudience,
          voiceTone: kit.voiceTone,
          personality: safeJSON<string[]>(kit.personality, []),
          keywords: safeJSON<string[]>(kit.keywords, []),
          avoidWords: safeJSON<string[]>(kit.avoidWords, []),
          uniqueValue: kit.uniqueValue,
          products: safeJSON<unknown[]>(kit.products, []),
          website: kit.website,
          email: kit.email,
          phone: kit.phone,
        };
      },
    },
    {
      name: "get_prospect_research",
      description:
        "Return the pre-computed research on the target prospect. Includes website tech signals (SSL, mobile, analytics, lead-capture, social, tech stack), Google Business Profile data when available (rating, review count, address, phone, recent reviews, categories), AI-inferred industry, services they offer, pain points, and growth opportunities. This is your source of truth for facts about the prospect.",
      input_schema: { type: "object", properties: {} },
      handler: async () => ctx.research,
    },
    {
      name: "get_past_pitches",
      description:
        "Return up to 5 of the user's most recent past pitches as raw examples. Learn the user's voice, hook style, and how they typically structure findings. These are examples to LEARN FROM, not templates to copy.",
      input_schema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "How many examples to return (1-5). Default 3." },
        },
      },
      handler: async (input) => {
        const limit = Math.min(5, Math.max(1, Number(input.limit) || 3));
        const rows = await prisma.pitch.findMany({
          where: { userId: ctx.userId, status: { in: ["READY", "SENT"] }, documentType: "pitch" },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { businessName: true, pitchContent: true, createdAt: true },
        });
        const pitches = rows
          .map((row) => {
            try {
              const parsed = JSON.parse(row.pitchContent || "{}") as Partial<PitchContent>;
              return {
                targetName: row.businessName,
                createdAt: row.createdAt.toISOString(),
                subject: parsed.subject,
                headline: parsed.headline,
                personalizedHook: parsed.personalizedHook,
                keyFindings: parsed.keyFindings,
                solutionBullets: parsed.solutionBullets,
                ctaText: parsed.ctaText,
              };
            } catch {
              return null;
            }
          })
          .filter(Boolean)
          .slice(0, limit);
        return { count: pitches.length, pitches };
      },
    },
    {
      name: "fetch_url",
      description:
        "Fetch and return the plain text content of a URL (HTML stripped, first ~6000 chars). Use when you need to read a specific page on the prospect's site that wasn't in get_prospect_research (about, services, pricing, case studies). Do NOT use for arbitrary browsing.",
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL including protocol." },
        },
        required: ["url"],
      },
      handler: async (input) => {
        const url = String(input.url || "").trim();
        if (!/^https?:\/\//i.test(url)) return { error: "URL must start with http:// or https://" };
        try {
          const res = await fetch(url, {
            signal: AbortSignal.timeout(8000),
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });
          if (!res.ok) return { error: `HTTP ${res.status}`, status: res.status };
          const html = await res.text();
          return { url: res.url, status: res.status, text: htmlToText(html) };
        } catch (error) {
          return { error: error instanceof Error ? error.message : "Fetch failed" };
        }
      },
    },
  ];
}

interface RunPitchAgentInput {
  userId: string;
  businessName: string;
  research: ResearchData;
  brand: BrandContext;
  recipientName?: string;
}

export async function generatePitch(
  research: ResearchData,
  businessName: string,
  brand: BrandContext,
  options: { userId?: string; recipientName?: string } = {},
): Promise<PitchContent> {
  const userId = options.userId;
  if (!userId) {
    throw new Error("generatePitch requires options.userId to run the agent loop");
  }
  return runPitchAgent({ userId, businessName, research, brand, recipientName: options.recipientName });
}

async function runPitchAgent(input: RunPitchAgentInput): Promise<PitchContent> {
  const { userId, businessName, research, brand, recipientName } = input;
  const senderName = brand.senderName || brand.name;
  const hiddenCount = Math.max(0, (research.painPoints?.length || 0) - 3);

  const systemPrompt = `You are FlowSmartly's Outreach Pitch Agent.

Your job: write a highly personalized B2B outreach pitch on behalf of the SENDER (the user's brand) to the PROSPECT (the target business).

How to think:
1. Call get_brand_identity to confirm what the SENDER actually offers. Do not propose services the sender doesn't sell.
2. Call get_prospect_research to read the verified facts about the prospect.
3. Optionally call get_past_pitches to learn the user's voice and style.
4. Optionally call fetch_url to read a specific page on the prospect's site.
5. Then return the pitch as ONE JSON object.

Voice & substance:
- Write as if it came personally from ${senderName} at ${brand.name} — first person ("we", "our team").
- Reference SPECIFIC findings from research (Google rating, review count, exact tech gaps, tools missing, what their site says).
- Map the SENDER's actual services to the PROSPECT's actual pain points.
- Create curiosity. Tease findings — mention you found more opportunities to discuss.
- Soft CTA. Invite a conversation, not a hard sell.
- Do NOT invent statistics. Do NOT use placeholder percentages. If you don't have a real basis for a number, omit it.
${recipientName ? `- Address ${recipientName} by name where natural.\n` : ""}

Return ONLY valid JSON with this shape:
{
  "subject": "Email subject line, under 60 chars, personalized",
  "headline": "Proposal headline, 10-15 words, specific to their situation",
  "personalizedHook": "Opening 2-3 sentences. Reference something specific.",
  "keyFindings": ["3 specific pain points phrased as opportunities, not warnings"],
  "opportunityParagraph": "1 paragraph (3-4 sentences) painting what's possible.",
  "solutionBullets": ["2-3 specific ${brand.name} capabilities matched to THIS prospect's pain points"],
  "impactParagraph": "1 paragraph on impact — bold but believable. Use specific numbers only when you can ground them in the research; otherwise speak qualitatively.",
  "ctaText": "Call to action, 5-8 words, action-oriented",
  "ctaSubtext": "1 sentence below CTA explaining what happens next",
  "closingLine": "Warm professional closing, 1 sentence"
}

Hint: the research already found ${hiddenCount + 3} total pain points — tease that there are more to discuss when relevant.`;

  const run = await ai.runWithTools<PitchContent>(
    `Write the outreach pitch from ${brand.name} to ${businessName}. Use the tools first, then return only the requested JSON object.`,
    buildTools({ userId, research, brand }),
    {
      systemPrompt,
      model: HAIKU_MODEL,
      maxTokens: 4000,
      maxIterations: 6,
      thinkingBudget: false,
    },
  );

  if (!run.json) {
    throw new Error(`Pitch agent returned non-JSON output: ${run.text.slice(0, 180)}`);
  }
  const raw = run.json;

  return {
    subject: clean(raw.subject, 180) || `${brand.name} <> ${businessName}`,
    headline: clean(raw.headline, 220) || `A growth conversation between ${brand.name} and ${businessName}`,
    personalizedHook: clean(raw.personalizedHook, 800),
    keyFindings: Array.isArray(raw.keyFindings) ? raw.keyFindings.map((f) => clean(f, 240)).filter(Boolean).slice(0, 4) : [],
    hiddenFindingsCount: hiddenCount,
    opportunityParagraph: clean(raw.opportunityParagraph, 900),
    solutionBullets: Array.isArray(raw.solutionBullets) ? raw.solutionBullets.map((s) => clean(s, 240)).filter(Boolean).slice(0, 4) : [],
    impactParagraph: clean(raw.impactParagraph, 900),
    ctaText: clean(raw.ctaText, 80) || "Let's talk",
    ctaSubtext: clean(raw.ctaSubtext, 200),
    closingLine: clean(raw.closingLine, 200),
  };
}
