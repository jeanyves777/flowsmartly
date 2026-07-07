import { HAIKU_MODEL, ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { currentDateContext } from "@/lib/ai/date-context";
import type { AgentTool } from "@/lib/ai/client";
import type { ProposalDeckPlan } from "./proposal-deck-types";
import type { ProposalClientProfile } from "./client-profile";
import { researchBusiness } from "./researcher";

// Kept as free-text optional hints for stored compatibility and the PDF
// renderer's layout switch. The agent does NOT branch on these values.
export type ProposalPreset = string;
export type ProposalBuilderType =
  | "visual-sales-deck"
  | "professional-services"
  | "process-framework";

export const DEFAULT_PROPOSAL_BUILDER_TYPE: ProposalBuilderType = "visual-sales-deck";

export interface ServiceProposalInput {
  userId: string;
  targetName: string;
  targetWebsite?: string;
  recipientName?: string;
  recipientEmail?: string;
  builderType?: ProposalBuilderType;
  preset?: ProposalPreset;
  proposalTypes?: ProposalPreset[];
  servicePackages?: string[];
  customAdditions?: string[];
  serviceTitle: string;
  serviceDescription: string;
  goals?: string;
  price?: number;
  originalPrice?: number;
  billingInterval?: string;
  terms?: string;
  clientProfile?: ProposalClientProfile;
}

export interface ProposalPricing {
  name: string;
  amount?: number;
  originalAmount?: number;
  interval?: string;
  note?: string;
}

export interface ProposalDesignDirection {
  themeName?: string;
  brandVoice?: string;
  visualStyle?: string;
  colorPalette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    ink?: string;
  };
  typography?: {
    headline?: string;
    body?: string;
  };
  coverImagePrompt?: string;
  sectionImagePrompts?: string[];
  visualMotifs?: string[];
  layoutNotes?: string[];
}

export interface ProposalVisualAsset {
  kind: "cover" | "about" | "impact";
  url: string;
  alt: string;
  provider?: string;
  model?: string;
  prompt?: string;
  width?: number;
  height?: number;
}

export interface ProposalVisualAssets {
  generatedAt?: string;
  images: ProposalVisualAsset[];
}

export interface ProposalCustomSection {
  title: string;
  body?: string;
  bullets: string[];
}

export interface ServiceProposalContent {
  documentType: "service_proposal";
  subject: string;
  title: string;
  subtitle: string;
  preparedFor: string;
  preparedBy: string;
  builderType?: ProposalBuilderType;
  preset?: ProposalPreset;
  serviceTitle: string;
  executiveSummary: string;
  aboutBrand: string;
  clientNeed: string;
  commitments: string[];
  benefits: string[];
  deliverables: Array<{ title: string; description: string }>;
  timeline: Array<{ label: string; title: string; description: string }>;
  proofPoints: Array<{ metric: string; label: string; note: string }>;
  pricing: ProposalPricing;
  terms: string[];
  nextSteps: string[];
  customSections?: ProposalCustomSection[];
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
  };
  design: ProposalDesignDirection;
  visualAssets?: ProposalVisualAssets;
  /** User-overridden section labels (kickers + headings), keyed by a stable slot
   *  id (e.g. "overview", "deliverablesTitle"). Lets the client rename every
   *  section label in Pitch Studio while the renderers fall back to defaults. */
  headings?: Record<string, string>;
  deckPlan?: ProposalDeckPlan;
  clientProfile?: ProposalClientProfile;
  proposalTypes?: ProposalPreset[];
  servicePackages?: string[];
  customAdditions?: string[];
  brandSnapshot: Record<string, unknown>;
}

function safeJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function cleanMetric(value: unknown): string {
  return String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/[★☆⭐]/g, "+")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
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

function buildTools(ctx: { userId: string }): AgentTool[] {
  return [
    {
      name: "get_brand_identity",
      description:
        "Fetch the user's live brand identity. Always call this first. Includes brand name, services/products the user actually sells, voice, audience, unique value, colors, fonts, logo, and contact details. Treat this as the source of truth for what the SENDER offers.",
      input_schema: { type: "object", properties: {} },
      handler: async () => {
        const kit = await prisma.brandKit.findFirst({
          where: { userId: ctx.userId },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        });
        if (!kit) return { configured: false };
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
          colors: safeJSON<Record<string, string>>(kit.colors, {}),
          fonts: safeJSON<Record<string, string>>(kit.fonts, {}),
          guidelines: kit.guidelines,
          logoUrl: kit.logo,
          iconLogoUrl: kit.iconLogo,
          website: kit.website,
          email: kit.email,
          phone: kit.phone,
          address: kit.address,
          city: kit.city,
          state: kit.state,
          country: kit.country,
        };
      },
    },
    {
      name: "research_prospect",
      description:
        "Research the target client. Returns the prospect's website signals (SSL, mobile, analytics, lead-capture, social, tech stack), Google Business Profile data when available (rating, review count, address, phone, recent reviews, categories), AI-inferred industry, services they offer, pain points, and growth opportunities. Call this when you need real facts about the client to write a credible, specific proposal. Skip only when no website is available AND the user's brief already contains enough specifics.",
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Prospect website URL. Optional but strongly recommended." },
          businessName: { type: "string", description: "Prospect business name. Required." },
        },
        required: ["businessName"],
      },
      handler: async (input) => {
        const url = String(input.url || "").trim();
        const businessName = String(input.businessName || "").trim();
        if (!businessName) return { error: "businessName is required" };
        try {
          const data = await researchBusiness(url, businessName);
          return data;
        } catch (error) {
          return { error: error instanceof Error ? error.message : "Research failed" };
        }
      },
    },
    {
      name: "get_past_proposals",
      description:
        "Return up to 5 of the user's most recent past proposals as raw examples. Use them to learn the user's voice, structure preferences, pricing patterns, and the kinds of deliverables they typically offer. These are examples to LEARN FROM, not templates to copy verbatim.",
      input_schema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "How many examples to return (1-5). Default 3." },
        },
      },
      handler: async (input) => {
        const limit = Math.min(5, Math.max(1, Number(input.limit) || 3));
        const rows = await prisma.pitch.findMany({
          where: { userId: ctx.userId, status: "READY", documentType: "service_proposal" },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { businessName: true, pitchContent: true, createdAt: true },
        });
        const proposals = rows
          .map((row) => {
            try {
              const parsed = JSON.parse(row.pitchContent || "{}") as Partial<ServiceProposalContent>;
              return {
                targetName: row.businessName,
                createdAt: row.createdAt.toISOString(),
                serviceTitle: parsed.serviceTitle,
                executiveSummary: parsed.executiveSummary,
                commitments: parsed.commitments,
                deliverables: parsed.deliverables?.map((d) => d.title).filter(Boolean),
                terms: parsed.terms,
                pricing: parsed.pricing,
              };
            } catch {
              return null;
            }
          })
          .filter(Boolean)
          .slice(0, limit);
        return { count: proposals.length, proposals };
      },
    },
    {
      name: "fetch_url",
      description:
        "Fetch and return the plain text content of a URL (HTML stripped, first ~6000 chars). Use when you need to read a specific page on the prospect's site (about, services, pricing) or the user's own site that wasn't surfaced by research_prospect. Do NOT use for arbitrary web browsing.",
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

function systemPrompt(input: ServiceProposalInput): string {
  const layoutHint = input.builderType
    ? `Layout preference (PDF renderer only): ${input.builderType}. This affects how the PDF is laid out, not what the proposal says.`
    : "Layout preference: none specified.";

  return `You are FlowSmartly's Service Proposal Agent.

${currentDateContext()}

Your job: write a polished, specific, client-ready proposal for the user, using their actual brand, their actual offering, and real facts about the prospect.

How to think:
1. Call get_brand_identity FIRST. If configured:false, return {"error":"BRAND_NOT_CONFIGURED"}.
2. If the prospect has a website OR you need facts about their public presence, call research_prospect. Cite what you find.
3. If you want to see how this user usually writes proposals, call get_past_proposals (optional).
4. If you need to read a specific page (about, services, case study), call fetch_url.

You decide the structure. There is no preset template. There is no fixed list of sections. Use what is appropriate for THIS user, selling THIS offer, to THIS prospect. The JSON shape below is the maximum surface — leave fields empty or short when not relevant. Use customSections when the offer needs sections that don't fit the standard ones.

LENGTH & PUNCH (HARD RULE): This is a PITCH to WIN a client in seconds — not a document to read, not a report, not a brochure. Be SHORT, direct, and benefit-led. Lead with the winning point. Every sentence must earn its place; cut filler, hedging, throat-clearing, and generic marketing fluff ("in today's fast-paced world", "we are committed to excellence"). Concretely: executiveSummary ≤ 3 punchy sentences; clientNeed and aboutBrand ≤ 2 sentences each; every bullet (commitments/benefits/nextSteps/terms) ≤ ~14 words, a crisp outcome, MAX 3–4 bullets per list (pick the strongest — do not pad to fill); customSection bodies 1–2 sentences. Prefer specific, quantified wins over adjectives. If in doubt, make it shorter. A prospect should grasp the value at a glance.

${layoutHint}

Return ONLY valid JSON with this shape:
{
  "documentType": "service_proposal",
  "subject": "Email subject when sending this proposal",
  "title": "Proposal title",
  "subtitle": "Short value proposition",
  "preparedFor": "Target client/entity",
  "preparedBy": "Sender brand",
  "serviceTitle": "Service package name",
  "executiveSummary": "≤3 punchy sentences — the winning hook for THIS prospect, benefit-first.",
  "aboutBrand": "About the sender brand and why they're suited to this engagement.",
  "clientNeed": "Why this target client needs this — grounded in real facts when available.",
  "commitments": ["Concrete commitments the sender makes"],
  "benefits": ["Business benefits the prospect gains"],
  "deliverables": [{"title":"...", "description":"..."}],
  "timeline": [{"label":"Week 1 | Phase 1 | etc.", "title":"...", "description":"..."}],
  "proofPoints": [{"metric":"...", "label":"...", "note":"..."}],
  "pricing": {"name":"...", "amount":199, "originalAmount":399, "interval":"month | project | year | one-time", "note":"..."},
  "terms": ["Clear plain-language terms"],
  "nextSteps": ["Concrete next steps for the prospect"],
  "customSections": [{"title":"Anything that doesn't fit above", "body":"short client-facing body", "bullets":["specific bullets"]}],
  "contact": {"name":"...", "email":"...", "phone":"...", "website":"...", "address":"..."},
  "design": {
    "themeName": "Short branded theme name",
    "brandVoice": "How the writing should sound",
    "visualStyle": "Visual style direction matching the brand and industry",
    "colorPalette": {"primary":"#...", "secondary":"#...", "accent":"#...", "background":"#...", "ink":"#..."},
    "typography": {"headline":"...", "body":"..."},
    "coverImagePrompt": "Hero image prompt. No text, no words, no logos.",
    "sectionImagePrompts": ["Supporting visual prompts. No text, no words, no logos."],
    "visualMotifs": ["Recurring visual motifs"],
    "layoutNotes": ["PDF layout notes"]
  },
  "brandSnapshot": {}
}

Rules:
- Write for THIS prospect. Reference what you actually found via research_prospect (rating, reviews, tech gaps, business category, etc.). Do not invent facts.
- Match the user's brand: voice, services, audience, unique value. The user's services in get_brand_identity are what they actually sell — do not propose services the user doesn't offer.
- If price/originalPrice are provided in the request, use them; otherwise propose a reasonable price grounded in the offering described.
- Keep proofPoints metric values ASCII-only and short (e.g. "2-3x", "+40%", "4.8/5", "Top 3"). Use them only when you have a real basis (research data or honest projection language).
- Do not write meta phrases like "this section", "proof points", "the client can see", or "proposal builder". Speak directly to the client using "you" and "your".
- Design colors must come from the brand. Image prompts must never ask for logos, text, fake brand marks, dashed placeholders, or reserved white logo boxes — the real logo is overlaid in code.
- Do not expose backend details, internal tool names, or that templates/examples were consulted.

Proposal request (raw, from the user):
- Target client/entity: ${input.targetName}
- Target website: ${input.targetWebsite || "not provided"}
- Recipient: ${input.recipientName || "not provided"}
- Service title: ${input.serviceTitle}
- Service description: ${input.serviceDescription}
- Selected services/packages: ${input.servicePackages?.length ? input.servicePackages.join(", ") : "not provided"}
- Custom additions: ${input.customAdditions?.length ? input.customAdditions.join("; ") : "not provided"}
- Goals: ${input.goals || "not provided"}
- Pricing: ${input.price ? `$${input.price}` : "not provided"}${input.billingInterval ? ` per ${input.billingInterval}` : ""}
- Original price: ${input.originalPrice ? `$${input.originalPrice}` : "not provided"}
- Terms note: ${input.terms || "not provided"}
- Category hint (free-text, optional): ${input.preset || "none"}`;
}

export async function runServiceProposalAgent(input: ServiceProposalInput): Promise<{
  proposal: ServiceProposalContent;
  usage: { inputTokens: number; outputTokens: number };
  iterations: number;
  toolsUsed: string[];
}> {
  const builderType = input.builderType;
  const run = await ai.runWithTools<ServiceProposalContent | { error: string }>(
    `Generate the service proposal for ${input.targetName}. Use the tools to gather facts before writing. Return only the requested JSON object.`,
    buildTools({ userId: input.userId }),
    {
      systemPrompt: systemPrompt(input),
      model: HAIKU_MODEL,
      maxTokens: 10000,
      maxIterations: 8,
      thinkingBudget: false,
    },
  );

  if (!run.json) {
    throw new Error(`Proposal agent returned non-JSON output: ${run.text.slice(0, 180)}`);
  }
  if ("error" in run.json) throw new Error(run.json.error);

  const raw = run.json as ServiceProposalContent;
  const kit = await prisma.brandKit.findFirst({
    where: { userId: input.userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  const brandSnapshot: Record<string, unknown> = kit
    ? {
        name: kit.name,
        tagline: kit.tagline,
        description: kit.description,
        colors: safeJSON<Record<string, string>>(kit.colors, {}),
        fonts: safeJSON<Record<string, string>>(kit.fonts, {}),
        logoUrl: kit.logo,
        iconLogoUrl: kit.iconLogo,
        website: kit.website,
        email: kit.email,
        phone: kit.phone,
        address: kit.address,
        city: kit.city,
        state: kit.state,
        country: kit.country,
        voiceTone: kit.voiceTone,
        personality: safeJSON<string[]>(kit.personality, []),
        keywords: safeJSON<string[]>(kit.keywords, []),
        guidelines: kit.guidelines,
        uniqueValue: kit.uniqueValue,
      }
    : {};
  const clientProofPoints = input.clientProfile?.insights?.map((insight) => ({
    metric: cleanMetric(insight.metric),
    label: String(insight.label || "").replace(/\s+/g, " ").trim().slice(0, 80),
    note: String(insight.note || "").replace(/\s+/g, " ").trim().slice(0, 180),
  })) || [];

  const proposal: ServiceProposalContent = {
    documentType: "service_proposal",
    subject: raw.subject || `${input.serviceTitle} proposal for ${input.targetName}`,
    title: raw.title || `${input.serviceTitle} Proposal`,
    subtitle: raw.subtitle || "",
    preparedFor: raw.preparedFor || input.targetName,
    preparedBy: raw.preparedBy || String(brandSnapshot.name || "FlowSmartly"),
    builderType,
    preset: input.preset,
    serviceTitle: raw.serviceTitle || input.serviceTitle,
    executiveSummary: raw.executiveSummary || "",
    aboutBrand: raw.aboutBrand || "",
    clientNeed: raw.clientNeed || "",
    commitments: Array.isArray(raw.commitments) ? raw.commitments.slice(0, 12) : [],
    benefits: Array.isArray(raw.benefits) ? raw.benefits.slice(0, 12) : [],
    deliverables: Array.isArray(raw.deliverables) ? raw.deliverables.slice(0, 10) : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline.slice(0, 8) : [],
    proofPoints: [
      ...clientProofPoints,
      ...(Array.isArray(raw.proofPoints)
        ? raw.proofPoints.slice(0, 6).map((point) => ({
            metric: cleanMetric(point.metric),
            label: String(point.label || "").replace(/\s+/g, " ").trim().slice(0, 80),
            note: String(point.note || "").replace(/\s+/g, " ").trim().slice(0, 180),
          }))
        : []),
    ].slice(0, 6),
    pricing: {
      name: raw.pricing?.name || input.serviceTitle,
      amount: typeof input.price === "number" ? input.price : raw.pricing?.amount,
      originalAmount: typeof input.originalPrice === "number" ? input.originalPrice : raw.pricing?.originalAmount,
      interval: input.billingInterval || raw.pricing?.interval || "project",
      note: raw.pricing?.note || "",
    },
    terms: Array.isArray(raw.terms) ? raw.terms.slice(0, 10) : [],
    nextSteps: Array.isArray(raw.nextSteps) ? raw.nextSteps.slice(0, 6) : [],
    customSections: Array.isArray(raw.customSections)
      ? raw.customSections
          .map((section) => ({
            title: String(section?.title || "").replace(/\s+/g, " ").trim().slice(0, 90),
            body: String(section?.body || "").replace(/\s+/g, " ").trim().slice(0, 650),
            bullets: Array.isArray(section?.bullets)
              ? section.bullets.map((item) => String(item || "").replace(/\s+/g, " ").trim().slice(0, 170)).filter(Boolean).slice(0, 5)
              : [],
          }))
          .filter((section) => section.title)
          .slice(0, 4)
      : [],
    contact: {
      name: raw.contact?.name,
      email: raw.contact?.email || String(brandSnapshot.email || ""),
      phone: raw.contact?.phone || String(brandSnapshot.phone || ""),
      website: raw.contact?.website || String(brandSnapshot.website || ""),
      address:
        raw.contact?.address ||
        [brandSnapshot.city, brandSnapshot.state, brandSnapshot.country].filter(Boolean).join(", "),
    },
    design: {
      themeName: raw.design?.themeName || `${String(brandSnapshot.name || input.serviceTitle)} proposal`,
      brandVoice: raw.design?.brandVoice || String(brandSnapshot.voiceTone || "professional and helpful"),
      visualStyle:
        raw.design?.visualStyle ||
        "premium proposal layout with clean geometry, confident whitespace, and imagery that matches the brand",
      colorPalette: {
        primary:
          raw.design?.colorPalette?.primary ||
          (brandSnapshot.colors as Record<string, string> | undefined)?.primary ||
          "#0ea5e9",
        secondary:
          raw.design?.colorPalette?.secondary ||
          (brandSnapshot.colors as Record<string, string> | undefined)?.secondary ||
          "#8b5cf6",
        accent:
          raw.design?.colorPalette?.accent ||
          (brandSnapshot.colors as Record<string, string> | undefined)?.accent ||
          "#f59e0b",
        background: raw.design?.colorPalette?.background || "#f8fafc",
        ink: raw.design?.colorPalette?.ink || "#0f172a",
      },
      typography: {
        headline:
          raw.design?.typography?.headline ||
          (brandSnapshot.fonts as Record<string, string> | undefined)?.heading ||
          "bold modern sans serif",
        body:
          raw.design?.typography?.body ||
          (brandSnapshot.fonts as Record<string, string> | undefined)?.body ||
          "clean readable sans serif",
      },
      coverImagePrompt: raw.design?.coverImagePrompt || "",
      sectionImagePrompts: Array.isArray(raw.design?.sectionImagePrompts)
        ? raw.design.sectionImagePrompts.slice(0, 3)
        : [],
      visualMotifs: Array.isArray(raw.design?.visualMotifs) ? raw.design.visualMotifs.slice(0, 6) : [],
      layoutNotes: Array.isArray(raw.design?.layoutNotes) ? raw.design.layoutNotes.slice(0, 6) : [],
    },
    clientProfile: input.clientProfile,
    proposalTypes: input.proposalTypes?.length ? input.proposalTypes.slice(0, 4) : input.preset ? [input.preset] : [],
    servicePackages: input.servicePackages?.slice(0, 12) || [],
    customAdditions: input.customAdditions?.slice(0, 12) || [],
    brandSnapshot,
  };

  return {
    proposal,
    usage: run.usage,
    iterations: run.iterations,
    toolsUsed: run.toolsUsed,
  };
}
