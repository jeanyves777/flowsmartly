import { HAIKU_MODEL, ai } from "@/lib/ai/client";
import type { AgentTool } from "@/lib/ai/client";
import type { ProposalDeckLayout, ProposalDeckPlan, ProposalDeckSlide, ProposalDeckSlideRole } from "./proposal-deck-types";
import type { ProposalLibraryAsset } from "./proposal-asset-library";
import { listProposalVisualAssets } from "./proposal-asset-library";
import type { ServiceProposalContent, ServiceProposalInput } from "./proposal-agent";

const SLIDE_ROLES: ProposalDeckSlideRole[] = [
  "cover",
  "about",
  "commitments",
  "benefits",
  "proof",
  "terms",
  "closing",
];

const ROLE_LAYOUT: Record<ProposalDeckSlideRole, ProposalDeckLayout> = {
  cover: "hero-split",
  about: "two-visuals",
  commitments: "visual-right",
  benefits: "two-visuals",
  proof: "metrics",
  terms: "terms",
  closing: "closing",
};

interface ProposalDeckAgentInput {
  proposal: ServiceProposalContent;
  request: ServiceProposalInput;
  brandKit?: Record<string, unknown> | null;
}

function cleanText(value: unknown, max = 260): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanList(value: unknown, maxItems = 6, maxChars = 160): string[] {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, maxChars)).filter(Boolean).slice(0, maxItems)
    : [];
}

function roleFrom(value: unknown): ProposalDeckSlideRole | null {
  const raw = String(value || "").toLowerCase();
  return SLIDE_ROLES.includes(raw as ProposalDeckSlideRole) ? raw as ProposalDeckSlideRole : null;
}

function layoutFrom(value: unknown, role: ProposalDeckSlideRole): ProposalDeckLayout {
  const raw = String(value || "").toLowerCase();
  if (
    raw === "hero-split" ||
    raw === "visual-right" ||
    raw === "two-visuals" ||
    raw === "metrics" ||
    raw === "terms" ||
    raw === "closing"
  ) {
    return raw;
  }
  return ROLE_LAYOUT[role];
}

function assetSummary(asset: ProposalLibraryAsset) {
  return {
    id: asset.id,
    title: asset.title,
    url: asset.url,
    kind: asset.kind,
    preset: asset.preset,
    tags: asset.tags,
    source: asset.source,
    width: asset.width,
    height: asset.height,
  };
}

function preferredAssetsForRole(role: ProposalDeckSlideRole, assets: ProposalLibraryAsset[], preset: string): ProposalLibraryAsset[] {
  const kind = role === "cover" ? "cover" : role === "about" ? "about" : "impact";
  return [...assets]
    .sort((a, b) => {
      const score = (asset: ProposalLibraryAsset) => {
        let value = 0;
        if (asset.kind === kind) value += 40;
        if (asset.kind === "general") value += 10;
        if (asset.preset === preset) value += 24;
        if (asset.preset === "any") value += 12;
        if (asset.tags.includes("pregenerated")) value += 12;
        if (asset.source !== "default") value += 8;
        return value;
      };
      return score(b) - score(a);
    })
    .slice(0, role === "cover" || role === "proof" ? 1 : 2);
}

function fallbackSlide(role: ProposalDeckSlideRole, proposal: ServiceProposalContent, assets: ProposalLibraryAsset[]): ProposalDeckSlide {
  const selected = preferredAssetsForRole(role, assets, proposal.preset);
  const visuals = selected.map((asset, index) => ({
    id: asset.id,
    title: asset.title,
    url: asset.url,
    role: index === 0 ? "primary" as const : "secondary" as const,
    fit: asset.width && asset.height && asset.height > asset.width ? "portrait" as const : "contain" as const,
  }));

  const bodyByRole: Record<ProposalDeckSlideRole, string> = {
    cover: proposal.subtitle,
    about: proposal.aboutBrand,
    commitments: proposal.clientNeed,
    benefits: proposal.executiveSummary,
    proof: "Realistic outcome ranges, not guaranteed results. The goal is practical local growth the client can see.",
    terms: proposal.pricing?.note || "Clear expectations, simple next steps, and a practical launch path.",
    closing: proposal.executiveSummary,
  };

  const bulletsByRole: Record<ProposalDeckSlideRole, string[]> = {
    cover: [],
    about: [proposal.clientNeed].filter(Boolean),
    commitments: proposal.commitments,
    benefits: proposal.deliverables.map((item) => item.title || item.description),
    proof: proposal.proofPoints.map((item) => `${item.metric} ${item.label}`),
    terms: proposal.terms,
    closing: proposal.nextSteps,
  };

  const headlineByRole: Record<ProposalDeckSlideRole, string> = {
    cover: proposal.title || "Business Development Proposal",
    about: "About Us",
    commitments: "Our Commitments",
    benefits: `Benefits of ${proposal.serviceTitle || "the Service"}`,
    proof: "Expected Impact",
    terms: "Clear Expectations",
    closing: "Ready to get found, trusted, and chosen?",
  };

  return {
    role,
    headline: headlineByRole[role],
    subhead: role === "cover" ? proposal.serviceTitle : undefined,
    body: cleanText(bodyByRole[role], 420),
    bullets: cleanList(bulletsByRole[role], role === "terms" ? 4 : 6, 130),
    layout: ROLE_LAYOUT[role],
    visualIds: selected.map((asset) => asset.id),
    visuals,
  };
}

function normalizePlan(raw: unknown, proposal: ServiceProposalContent, assets: ProposalLibraryAsset[]): ProposalDeckPlan {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const rawObj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rawSlides = Array.isArray(rawObj.slides) ? rawObj.slides as Array<Record<string, unknown>> : [];
  const slideByRole = new Map<ProposalDeckSlideRole, Record<string, unknown>>();

  for (const slide of rawSlides) {
    const role = roleFrom(slide.role);
    if (role && !slideByRole.has(role)) slideByRole.set(role, slide);
  }

  const slides = SLIDE_ROLES.map((role) => {
    const fallback = fallbackSlide(role, proposal, assets);
    const slide = slideByRole.get(role);
    if (!slide) return fallback;

    const rawIds = [
      ...cleanList(slide.visualIds, 4, 120),
      ...cleanList(slide.assetIds, 4, 120),
    ];
    const rawVisuals = Array.isArray(slide.visuals) ? slide.visuals as Array<Record<string, unknown>> : [];
    rawVisuals.forEach((visual) => {
      const id = cleanText(visual.id, 120);
      if (id) rawIds.push(id);
    });

    const uniqueIds = Array.from(new Set(rawIds)).filter((id) => assetById.has(id)).slice(0, 2);
    const selectedAssets = uniqueIds.length
      ? uniqueIds.map((id) => assetById.get(id)).filter(Boolean) as ProposalLibraryAsset[]
      : preferredAssetsForRole(role, assets, proposal.preset);

    return {
      role,
      headline: cleanText(slide.headline, 120) || fallback.headline,
      kicker: cleanText(slide.kicker, 80) || fallback.kicker,
      subhead: cleanText(slide.subhead, 180) || fallback.subhead,
      body: cleanText(slide.body, 500) || fallback.body,
      bullets: cleanList(slide.bullets, role === "terms" ? 4 : 6, 140).length
        ? cleanList(slide.bullets, role === "terms" ? 4 : 6, 140)
        : fallback.bullets,
      layout: layoutFrom(slide.layout, role),
      visualIds: selectedAssets.map((asset) => asset.id),
      visuals: selectedAssets.map((asset, index) => ({
        id: asset.id,
        title: asset.title,
        url: asset.url,
        role: index === 0 ? "primary" as const : "secondary" as const,
        fit: asset.width && asset.height && asset.height > asset.width ? "portrait" as const : "contain" as const,
      })),
      emphasis: cleanText(slide.emphasis, 120) || fallback.emphasis,
    } satisfies ProposalDeckSlide;
  });

  return {
    generatedBy: "claude-haiku-deck-agent",
    styleSummary:
      cleanText(rawObj.styleSummary, 320) ||
      "Premium 16:9 sales deck with large transparent PNG visuals, compact copy, branded red callouts, and generous whitespace.",
    copyDensity: rawObj.copyDensity === "tight" ? "tight" : "balanced",
    colorUse:
      cleanText(rawObj.colorUse, 220) ||
      "Use brand colors for accents, red for callout bands, dark ink for headings, and light page backgrounds.",
    designerNotes: cleanList(rawObj.designerNotes, 6, 160),
    selectedAssetIds: Array.from(new Set(slides.flatMap((slide) => slide.visualIds || []))),
    slides,
  };
}

function buildTools(input: ProposalDeckAgentInput, assets: ProposalLibraryAsset[]): AgentTool[] {
  return [
    {
      name: "get_raw_proposal_context",
      description: "Return all available raw proposal, request, pricing, brand, and business context for the deck.",
      input_schema: { type: "object", properties: {} },
      handler: async () => ({
        request: input.request,
        proposal: input.proposal,
        brandKit: input.brandKit || input.proposal.brandSnapshot,
      }),
    },
    {
      name: "list_available_images",
      description: "Return the reusable proposal image library. Choose images by id and url; do not ask for new image generation.",
      input_schema: { type: "object", properties: {} },
      handler: async () => assets.map(assetSummary),
    },
    {
      name: "get_pdf_style_reference",
      description: "Return the desired PDF style rules extracted from the user's preferred proposal examples.",
      input_schema: { type: "object", properties: {} },
      handler: async () => ({
        format: "16:9 landscape PDF deck, 1440 by 810 design space",
        visualRules: [
          "Use big transparent PNG or cutout images directly on the page, not boxed screenshots.",
          "Some slides should use two images when it helps fill the visual area.",
          "Use concise bullets with strong hierarchy; avoid paragraphs that become noisy.",
          "Use red rounded callout bars or tags for pricing and critical terms.",
          "Never use prompt text as a caption.",
          "Never ask image AI to draw logos, logo boxes, white logo spaces, dashed placeholders, or fake indicators.",
          "Use the real brand logo separately in the renderer.",
        ],
      }),
    },
  ];
}

export async function runServiceProposalDeckAgent(input: ProposalDeckAgentInput): Promise<{
  plan: ProposalDeckPlan;
  usage: { inputTokens: number; outputTokens: number };
  toolsUsed: string[];
}> {
  const assets = await listProposalVisualAssets({ presign: false });
  const run = await ai.runWithTools<ProposalDeckPlan>(
    `Plan the PDF deck for ${input.proposal.preparedFor}. Return only valid JSON.`,
    buildTools(input, assets),
    {
      model: HAIKU_MODEL,
      maxTokens: 7000,
      maxIterations: 5,
      thinkingBudget: false,
      systemPrompt: `You are FlowSmartly's low-cost Claude Haiku proposal deck designer.

Required tool flow:
1. Call get_raw_proposal_context.
2. Call list_available_images.
3. Call get_pdf_style_reference.

Return ONLY valid JSON. Do not include markdown.

Return this exact shape:
{
  "styleSummary": "short deck style direction",
  "copyDensity": "tight | balanced",
  "colorUse": "how to use brand colors and red callouts",
  "designerNotes": ["short implementation notes"],
  "slides": [
    {
      "role": "cover | about | commitments | benefits | proof | terms | closing",
      "headline": "short headline",
      "kicker": "optional short label",
      "subhead": "optional one-line subhead",
      "body": "optional short body copy",
      "bullets": ["short bullet"],
      "layout": "hero-split | visual-right | two-visuals | metrics | terms | closing",
      "visualIds": ["image-library-id"],
      "emphasis": "optional short callout"
    }
  ]
}

Rules:
- Use all seven slide roles exactly once.
- Choose image IDs from list_available_images only.
- Favor reusable transparent PNG / 3D cutout assets.
- Make the visual sections feel full. Use two-visuals for about or benefits when helpful.
- Keep bullets concise enough for PDF layout.
- Do not put raw prompts, backend/provider details, or template instructions in any visible text.
- Do not invent guaranteed results.`,
    },
  );

  return {
    plan: normalizePlan(run.json, input.proposal, assets),
    usage: run.usage,
    toolsUsed: run.toolsUsed,
  };
}
