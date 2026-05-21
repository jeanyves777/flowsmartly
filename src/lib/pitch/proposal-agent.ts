import { HAIKU_MODEL, ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import type { AgentTool } from "@/lib/ai/client";
import type { ProposalDeckPlan } from "./proposal-deck-types";
import type { ProposalClientProfile } from "./client-profile";

export type ProposalPreset =
  | "google-business-profile"
  | "website-redesign"
  | "local-seo"
  | "custom";

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
  preset: ProposalPreset;
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
  preset: ProposalPreset;
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
  deckPlan?: ProposalDeckPlan;
  clientProfile?: ProposalClientProfile;
  proposalTypes?: ProposalPreset[];
  servicePackages?: string[];
  customAdditions?: string[];
  brandSnapshot: Record<string, unknown>;
}

const PRESET_CONTEXT: Record<ProposalPreset, { name: string; focus: string; sections: string[] }> = {
  "google-business-profile": {
    name: "Google Business Profile Growth",
    focus:
      "Google Business Profile optimization, local 3-pack visibility, weekly posts, reputation management, citations, geotagging, reporting, and conversion tracking.",
    sections: [
      "Top placement on Google Business Profile",
      "Show up in Google's local 3-pack",
      "Reputation management",
      "Weekly posts and content creation",
      "Social media, backlinks, and citations",
      "Reporting portal and conversion tracking",
    ],
  },
  "website-redesign": {
    name: "Website Redesign and Development",
    focus:
      "Modern website redesign, mobile performance, SEO-friendly pages, conversion sections, tracking, and ongoing support.",
    sections: [
      "Elegant website design",
      "SEO-friendly website structure",
      "Mobile-first experience",
      "Engaging content",
      "SEO-enabled backend",
      "Conversion tracking and reporting",
    ],
  },
  "local-seo": {
    name: "Local SEO Growth",
    focus:
      "Organic search visibility, local pages, citations, content, reviews, technical SEO, reporting, and long-term lead generation.",
    sections: [
      "Organic local search growth",
      "Citation building",
      "Keyword and area pages",
      "Review improvement",
      "Technical SEO checks",
      "Monthly reporting",
    ],
  },
  custom: {
    name: "Custom Service Proposal",
    focus:
      "A custom service proposal based on the user's brand, the target client, and the service definition entered by the user.",
    sections: [
      "Service overview",
      "Client goals",
      "Deliverables",
      "Timeline",
      "Pricing",
      "Terms and next steps",
    ],
  },
};

const BUILDER_CONTEXT: Record<ProposalBuilderType, { name: string; intent: string; sections: string[]; rules: string[] }> = {
  "visual-sales-deck": {
    name: "Visual sales deck",
    intent:
      "A concise branded PDF sales deck that uses strong visuals, short client-facing copy, proof metrics, pricing, and next steps.",
    sections: [
      "Cover with offer and client name",
      "About the sender brand and client opportunity",
      "Commitments and deliverables",
      "Benefits and business outcomes",
      "Relevant proof, findings, or local profile stats",
      "Pricing, terms, and next steps",
    ],
    rules: [
      "Use compact copy that fits a visual deck.",
      "Use proof metrics only when they support the client's buying decision.",
      "Keep the deck usually 7-9 slides.",
    ],
  },
  "professional-services": {
    name: "Professional services proposal",
    intent:
      "A services proposal patterned after professional tax/accounting style proposals: overview, scope, timeline, fees, credentials, and next steps.",
    sections: [
      "Introduction and professional overview",
      "Scope of work by service area",
      "Proposed timeline",
      "Fee estimate and payment expectations",
      "Why work with us",
      "Next steps and contact details",
    ],
    rules: [
      "Do not force local marketing proof language when the work is professional services.",
      "Make scope boundaries, client responsibilities, timeline, and fee assumptions clear.",
      "Use proofPoints for trust, readiness, timeline, document status, or decision criteria when marketing metrics are not relevant.",
    ],
  },
  "process-framework": {
    name: "Process/framework proposal",
    intent:
      "A structured implementation framework patterned after annual budget process proposals: executive summary, phases, ownership, failure points, quick wins, success criteria, and next steps.",
    sections: [
      "Executive summary",
      "Our commitment",
      "What the engagement covers",
      "Phased framework with timing, owner, and key deliverable",
      "Common failure points and mitigations",
      "Quick wins and implementation approach",
      "Success criteria and next steps",
    ],
    rules: [
      "Write like an implementation partner presenting a clear operating framework.",
      "Use timeline entries as phases with timing, owner, and deliverable language where possible.",
      "Use customSections for failure points, quick wins, success criteria, or implementation notes when helpful.",
    ],
  },
};

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

function buildTools(ctx: { userId: string; preset: ProposalPreset; builderType: ProposalBuilderType }): AgentTool[] {
  return [
    {
      name: "get_brand_identity",
      description:
        "Fetch the user's live brand identity. Always call this first. Use the brand name, logo context, services/products, unique value, voice, website, contact details, and colors to make the proposal feel like it came from the user's business.",
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
      name: "get_proposal_template",
      description:
        "Return the selected proposal template pattern. Use it for section structure, benefits, deliverables, terms, pricing, and proposal flow.",
      input_schema: { type: "object", properties: {} },
      handler: async () => PRESET_CONTEXT[ctx.preset],
    },
    {
      name: "get_proposal_builder_pattern",
      description:
        "Return the selected proposal builder pattern. Use it to decide whether the proposal should read like a visual sales deck, a professional services proposal, or a process/framework proposal.",
      input_schema: { type: "object", properties: {} },
      handler: async () => BUILDER_CONTEXT[ctx.builderType],
    },
  ];
}

function systemPrompt(input: ServiceProposalInput): string {
  const builderType = input.builderType || DEFAULT_PROPOSAL_BUILDER_TYPE;
  const builderContext = BUILDER_CONTEXT[builderType];
  const clientProfileContext = input.clientProfile
    ? `
Client Google/local profile facts:
- Google rating: ${input.clientProfile.rating !== undefined ? `${input.clientProfile.rating}/5` : "not available"}
- Review count: ${input.clientProfile.reviewCount ?? "not available"}
- Address: ${input.clientProfile.address || "not available"}
- Phone: ${input.clientProfile.phone || "not available"}
- Business status: ${input.clientProfile.businessStatus || "not available"}
- Business categories: ${input.clientProfile.types?.join(", ") || "not available"}
`
    : "Client Google/local profile facts: not available.";

  return `You are FlowSmartly's dedicated Service Proposal Agent.

Your job is to generate a polished service proposal and a brand-aware art direction packet for a visual PDF deck.

Required tool flow:
1. Call get_brand_identity first. If configured:false, return {"error":"BRAND_NOT_CONFIGURED"}.
2. Call get_proposal_template before writing the proposal.
3. Call get_proposal_builder_pattern before writing the proposal.

Selected proposal builder:
- Builder type: ${builderContext.name} (${builderType})
- Builder intent: ${builderContext.intent}
- Builder structure: ${builderContext.sections.join(" | ")}
- Builder rules: ${builderContext.rules.join(" | ")}

The selected builder controls the proposal structure. The selected proposal types and service packages control the offer being sold.

Do not mention that a template or PDF sample was used. Do not expose backend details.

Return ONLY valid JSON with this shape:
{
  "documentType": "service_proposal",
  "subject": "Email subject for sending this proposal",
  "title": "Proposal title",
  "subtitle": "Short value proposition",
  "preparedFor": "Target client/entity",
  "preparedBy": "Sender brand",
  "builderType": "${builderType}",
  "preset": "${input.preset}",
  "serviceTitle": "Service package name",
  "executiveSummary": "Tight 3-5 sentence summary.",
  "aboutBrand": "About the sender brand and vision.",
  "clientNeed": "Why this target client needs the service.",
  "commitments": ["6-10 concrete commitments"],
  "benefits": ["6-10 business benefits"],
  "deliverables": [{"title":"...", "description":"..."}],
  "timeline": [{"label":"Week 1", "title":"...", "description":"..."}],
  "proofPoints": [{"metric":"50%", "label":"...", "note":"..."}],
  "pricing": {"name":"...", "amount":199, "originalAmount":399, "interval":"month", "note":"..."},
  "terms": ["5-8 clear terms"],
  "nextSteps": ["3-5 next steps"],
  "customSections": [{"title":"Optional client-ready add-on section", "body":"short client-facing body", "bullets":["2-4 specific bullets"]}],
  "contact": {"name":"...", "email":"...", "phone":"...", "website":"...", "address":"..."},
  "design": {
    "themeName": "Short branded theme name",
    "brandVoice": "How the writing should sound",
    "visualStyle": "Premium visual style direction",
    "colorPalette": {"primary":"#...", "secondary":"#...", "accent":"#...", "background":"#...", "ink":"#..."},
    "typography": {"headline":"...", "body":"..."},
    "coverImagePrompt": "Visual background/hero image prompt. No text, no words, no logos.",
    "sectionImagePrompts": ["2-3 supporting visual prompts. No text, no words, no logos."],
    "visualMotifs": ["3-5 recurring visual motifs"],
    "layoutNotes": ["3-5 PDF layout notes"]
  },
  "brandSnapshot": {}
}

Rules:
- Make the content useful for a real customer, not generic filler.
- Follow the selected proposal builder. For professional-services proposals, write scope, timeline, fees, credentials, and next steps. For process-framework proposals, write executive summary, commitment, engagement coverage, phases, mitigations, quick wins, success criteria, and next steps. For visual-sales-deck proposals, write compact sales-deck copy with strong value and proof.
- If price is provided, include it. If originalPrice is provided, present it as a promotional comparison.
- Keep terms plain and fair: activation timing, client information needed, cancellation/refund expectations, reporting, and provider delays if relevant.
- Use short sentences suitable for a PDF layout.
- For proofPoints, use realistic evidence, decision factors, or outcome ranges, not guaranteed results.
- For proofPoints and proof slide copy, turn facts into client-facing reasons to act: state what the finding means, why it matters, and what the offer will improve. Do not write meta copy such as "this section", "proof points", "proposal builder", or "the client can see".
- Keep proofPoint metric values ASCII-only and short, such as "2-3x", "+40%", "4.8+", or "Top 3". Do not use star symbols, emoji, or decorative characters in metric values.
- If Client Google/local profile facts are available and the request is about local presence, Google Business Profile, local SEO, reviews, maps, or nearby customers, cite the actual rating, review count, category, address, or status in clientNeed, proofPoints, or benefits. Do not invent Google stats when unavailable.
- Match the brand voice and service category.
- If multiple proposal types, service packages, or custom additions are provided, blend them into one coherent proposal. Do not drop custom user additions.
- Keep the proposal deck concise. Use customSections only for truly useful client-specific add-ons, special custom user additions, promotional terms, or cross-sell details. Generate 0-2 customSections unless the user explicitly added more sections in the editor.
- Design must use the live BrandKit: colors, fonts, logo availability, audience, voice, services, and unique value.
- Image prompts are for background/hero PNG assets only. They must NEVER ask the image model to draw text, words, UI labels, logos, logo boxes, logo placeholders, white reserved rectangles, dashed frames, or fake brand marks. The real logo is overlaid after generation.
- Make the PDF feel like a polished sales deck, not a plain document: strong cover, section imagery, price badge, proof metrics, branded footer, and clear visual hierarchy.

Proposal request:
- Target client/entity: ${input.targetName}
- Target website: ${input.targetWebsite || "not provided"}
- Recipient: ${input.recipientName || "not provided"}
- Proposal builder: ${builderContext.name}
- Selected proposal types: ${input.proposalTypes?.length ? input.proposalTypes.join(", ") : input.preset}
- Selected services/packages: ${input.servicePackages?.length ? input.servicePackages.join(", ") : "not provided"}
- Custom additions: ${input.customAdditions?.length ? input.customAdditions.join("; ") : "not provided"}
- Service title: ${input.serviceTitle}
- Service description: ${input.serviceDescription}
- Goals: ${input.goals || "not provided"}
- Pricing: ${input.price ? `$${input.price}` : "not provided"}${input.billingInterval ? ` per ${input.billingInterval}` : ""}
- Original price: ${input.originalPrice ? `$${input.originalPrice}` : "not provided"}
- Terms note: ${input.terms || "not provided"}

${clientProfileContext}`;
}

export async function runServiceProposalAgent(input: ServiceProposalInput): Promise<{
  proposal: ServiceProposalContent;
  usage: { inputTokens: number; outputTokens: number };
  iterations: number;
  toolsUsed: string[];
}> {
  const builderType = input.builderType || DEFAULT_PROPOSAL_BUILDER_TYPE;
  const run = await ai.runWithTools<ServiceProposalContent | { error: string }>(
    `Generate the service proposal for ${input.targetName}. Return only the requested JSON object.`,
    buildTools({ userId: input.userId, preset: input.preset, builderType }),
    {
      systemPrompt: systemPrompt(input),
      model: HAIKU_MODEL,
      maxTokens: 10000,
      maxIterations: 6,
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
    subtitle: raw.subtitle || "A practical growth plan prepared for your team.",
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
          .slice(0, 2)
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
      themeName: raw.design?.themeName || `${String(brandSnapshot.name || input.serviceTitle)} growth deck`,
      brandVoice: raw.design?.brandVoice || String(brandSnapshot.voiceTone || "professional and helpful"),
      visualStyle:
        raw.design?.visualStyle ||
        "premium SaaS sales deck with clean geometry, confident whitespace, and polished business-growth imagery",
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
      coverImagePrompt:
        raw.design?.coverImagePrompt ||
        `Premium abstract business-growth hero image for ${input.serviceTitle}, polished 3D marketing dashboard elements, local search growth, clean professional lighting. No text, no words, no letters, no logos.`,
      sectionImagePrompts: Array.isArray(raw.design?.sectionImagePrompts)
        ? raw.design.sectionImagePrompts.slice(0, 3)
        : [
            `Premium illustration of a growth team improving local visibility for ${input.targetName}, charts, map pins, review stars, clean brand-colored scene. No text, no words, no letters, no logos.`,
            `High-end abstract proof dashboard with analytics rings, rising bars, customer activity, polished SaaS style. No text, no words, no letters, no logos.`,
          ],
      visualMotifs: Array.isArray(raw.design?.visualMotifs)
        ? raw.design.visualMotifs.slice(0, 6)
        : ["growth arcs", "metric rings", "local search map pins", "soft geometric brand panels"],
      layoutNotes: Array.isArray(raw.design?.layoutNotes)
        ? raw.design.layoutNotes.slice(0, 6)
        : ["Use a visual deck layout with one strong idea per page.", "Overlay the real brand logo in code, not in generated images."],
    },
    clientProfile: input.clientProfile,
    proposalTypes: input.proposalTypes?.length ? input.proposalTypes.slice(0, 4) : [input.preset],
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
