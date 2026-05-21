import { HAIKU_MODEL, ai } from "@/lib/ai/client";
import type { AgentTool } from "@/lib/ai/client";
import type {
  ProposalDeckBackgroundStyle,
  ProposalDeckColorRole,
  ProposalDeckLayout,
  ProposalDeckMarkerStyle,
  ProposalDeckPlan,
  ProposalDeckSlide,
  ProposalDeckSlideRole,
  ProposalDeckStyleVariant,
} from "./proposal-deck-types";
import type { ProposalLibraryAsset } from "./proposal-asset-library";
import { listProposalVisualAssets } from "./proposal-asset-library";
import { DEFAULT_PROPOSAL_BUILDER_TYPE, type ProposalBuilderType, type ServiceProposalContent, type ServiceProposalInput } from "./proposal-agent";
import { clientProofBody, clientProofHeadline } from "./proposal-proof-copy";

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
  about: "visual-right",
  commitments: "visual-right",
  benefits: "visual-right",
  proof: "metrics",
  terms: "terms",
  closing: "closing",
};

const STYLE_VARIANTS: ProposalDeckStyleVariant[] = ["clean-light", "bold-brand", "editorial", "dark-cover", "minimal-grid"];
const COLOR_ROLES: ProposalDeckColorRole[] = ["primary", "secondary", "accent"];
const BACKGROUND_STYLES: ProposalDeckBackgroundStyle[] = ["white", "soft-tint", "split-band", "brand-wash"];
const MARKER_STYLES: ProposalDeckMarkerStyle[] = ["corner-block", "side-tab", "small-pill"];

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

function pickBySeed<T>(seed: string, values: T[]): T {
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return values[Math.abs(hash) % values.length];
}

function styleVariantFrom(value: unknown, proposal: ServiceProposalContent): ProposalDeckStyleVariant {
  const raw = String(value || "").toLowerCase();
  if (STYLE_VARIANTS.includes(raw as ProposalDeckStyleVariant)) return raw as ProposalDeckStyleVariant;
  return pickBySeed(`${proposal.preparedBy}:${proposal.preparedFor}:${proposal.preset}`, STYLE_VARIANTS);
}

function colorRoleFrom(value: unknown, proposal: ServiceProposalContent): ProposalDeckColorRole {
  const raw = String(value || "").toLowerCase();
  if (COLOR_ROLES.includes(raw as ProposalDeckColorRole)) return raw as ProposalDeckColorRole;
  return pickBySeed(`${proposal.serviceTitle}:${proposal.preparedFor}`, COLOR_ROLES);
}

function backgroundStyleFrom(value: unknown, proposal: ServiceProposalContent): ProposalDeckBackgroundStyle {
  const raw = String(value || "").toLowerCase();
  if (BACKGROUND_STYLES.includes(raw as ProposalDeckBackgroundStyle)) return raw as ProposalDeckBackgroundStyle;
  return pickBySeed(`${proposal.preparedFor}:${proposal.serviceTitle}:background`, BACKGROUND_STYLES);
}

function markerStyleFrom(value: unknown, proposal: ServiceProposalContent): ProposalDeckMarkerStyle {
  const raw = String(value || "").toLowerCase();
  if (MARKER_STYLES.includes(raw as ProposalDeckMarkerStyle)) return raw as ProposalDeckMarkerStyle;
  return pickBySeed(`${proposal.preparedBy}:${proposal.preparedFor}:marker`, MARKER_STYLES);
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

function redLikeHex(value: unknown): boolean {
  const raw = String(value || "").trim();
  const match = raw.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return /red|crimson|rose|ruby/i.test(raw);
  const hex = match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return r > 150 && g < 120 && b < 120;
}

function brandAllowsRedAssets(input: ProposalDeckAgentInput): boolean {
  const colors = [
    input.proposal.design?.colorPalette?.primary,
    input.proposal.design?.colorPalette?.secondary,
    input.proposal.design?.colorPalette?.accent,
  ];
  const brandColors = input.brandKit?.colors;
  if (typeof brandColors === "string") {
    try {
      const parsed = JSON.parse(brandColors) as Record<string, unknown>;
      colors.push(parsed.primary as string, parsed.secondary as string, parsed.accent as string);
    } catch {
      colors.push(brandColors);
    }
  } else if (brandColors && typeof brandColors === "object") {
    const parsed = brandColors as Record<string, unknown>;
    colors.push(parsed.primary as string, parsed.secondary as string, parsed.accent as string);
  }
  return colors.some(redLikeHex);
}

function filterAssetsForBrand(input: ProposalDeckAgentInput, assets: ProposalLibraryAsset[]) {
  if (brandAllowsRedAssets(input)) return assets;
  return assets.filter((asset) => !/\bred\b/i.test(`${asset.id} ${asset.title} ${asset.tags.join(" ")}`));
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
    .slice(0, 1);
}

function proposalBuilderType(proposal: ServiceProposalContent): ProposalBuilderType {
  return proposal.builderType || DEFAULT_PROPOSAL_BUILDER_TYPE;
}

function fallbackSlide(role: ProposalDeckSlideRole, proposal: ServiceProposalContent, assets: ProposalLibraryAsset[]): ProposalDeckSlide {
  const builderType = proposalBuilderType(proposal);
  const selected = preferredAssetsForRole(role, assets, proposal.preset);
  const visuals = selected.map((asset, index) => ({
    id: asset.id,
    title: asset.title,
    url: asset.url,
    role: index === 0 ? "primary" as const : "secondary" as const,
    fit: asset.width && asset.height && asset.height > asset.width ? "portrait" as const : "contain" as const,
  }));

  const visualDeck = {
    bodyByRole: {
      cover: proposal.subtitle,
      about: proposal.aboutBrand,
      commitments: proposal.clientNeed,
      benefits: proposal.executiveSummary,
      proof: clientProofBody(proposal),
      terms: proposal.pricing?.note || "Clear expectations, simple next steps, and a practical launch path.",
      closing: proposal.executiveSummary,
    },
    bulletsByRole: {
      cover: [],
      about: [proposal.clientNeed].filter(Boolean),
      commitments: proposal.commitments,
      benefits: proposal.deliverables.map((item) => item.title || item.description),
      proof: [
        ...(proposal.clientProfile?.insights || []).map((item) => `${item.metric} ${item.label}`),
        ...proposal.proofPoints.map((item) => `${item.metric} ${item.label}`),
      ],
      terms: proposal.terms,
      closing: proposal.nextSteps,
    },
    headlineByRole: {
      cover: proposal.title || "Business Development Proposal",
      about: "About Us",
      commitments: "Our Commitments",
      benefits: `Benefits of ${proposal.serviceTitle || "the Service"}`,
      proof: clientProofHeadline(proposal),
      terms: "Clear Expectations",
      closing: "Ready to get found, trusted, and chosen?",
    },
  } satisfies {
    bodyByRole: Record<ProposalDeckSlideRole, string>;
    bulletsByRole: Record<ProposalDeckSlideRole, string[]>;
    headlineByRole: Record<ProposalDeckSlideRole, string>;
  };

  const professionalServices = {
    bodyByRole: {
      cover: proposal.subtitle,
      about: proposal.executiveSummary || proposal.aboutBrand,
      commitments: proposal.clientNeed,
      benefits: proposal.aboutBrand,
      proof: "A clear timeline keeps review, approval, and delivery moving without surprises.",
      terms: proposal.pricing?.note || "Fees, scope boundaries, and payment expectations are documented before work begins.",
      closing: proposal.executiveSummary,
    },
    bulletsByRole: {
      cover: [],
      about: [proposal.aboutBrand, proposal.clientNeed].filter(Boolean),
      commitments: [...proposal.deliverables.map((item) => item.title || item.description), ...proposal.commitments],
      benefits: proposal.benefits,
      proof: proposal.timeline.map((item) => `${item.label}: ${item.title}`),
      terms: proposal.terms,
      closing: proposal.nextSteps,
    },
    headlineByRole: {
      cover: proposal.title || "Professional Services Proposal",
      about: "Professional Overview",
      commitments: "Scope of Work",
      benefits: "Why Work With Us",
      proof: "Proposed Timeline",
      terms: "Fee Estimate and Terms",
      closing: "Next Steps",
    },
  } satisfies typeof visualDeck;

  const processFramework = {
    bodyByRole: {
      cover: proposal.subtitle,
      about: proposal.executiveSummary,
      commitments: proposal.clientNeed,
      benefits: "The framework turns the engagement into clear phases, owners, deliverables, and measurable checkpoints.",
      proof: "The plan addresses the gaps that typically slow execution before they become expensive delays.",
      terms: proposal.pricing?.note || "We begin with practical quick wins, then move into the full operating framework.",
      closing: proposal.executiveSummary,
    },
    bulletsByRole: {
      cover: [],
      about: [proposal.aboutBrand, proposal.clientNeed].filter(Boolean),
      commitments: proposal.commitments,
      benefits: proposal.timeline.map((item) => `${item.label}: ${item.title}`),
      proof: proposal.proofPoints.map((item) => `${item.metric} ${item.label}`),
      terms: [...proposal.terms, ...proposal.benefits].slice(0, 6),
      closing: proposal.nextSteps,
    },
    headlineByRole: {
      cover: proposal.title || "Implementation Framework Proposal",
      about: "Executive Summary",
      commitments: "Engagement Coverage",
      benefits: "Implementation Framework",
      proof: "Risks We Will Resolve",
      terms: "Quick Wins and Working Terms",
      closing: "Success Criteria and Next Steps",
    },
  } satisfies typeof visualDeck;

  const copy =
    builderType === "professional-services"
      ? professionalServices
      : builderType === "process-framework"
        ? processFramework
        : visualDeck;

  return {
    role,
    headline: copy.headlineByRole[role],
    subhead: role === "cover" ? proposal.serviceTitle : undefined,
    body: cleanText(copy.bodyByRole[role], 420),
    bullets: cleanList(copy.bulletsByRole[role], role === "terms" ? 4 : 6, 130),
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

    const layout = layoutFrom(slide.layout, role);
    const maxVisuals = layout === "two-visuals" && (role === "about" || role === "benefits") ? 2 : 1;
    const uniqueIds = Array.from(new Set(rawIds)).filter((id) => assetById.has(id)).slice(0, maxVisuals);
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
      layout,
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
      "Premium 16:9 sales deck with large transparent PNG visuals, compact copy, brand-color callouts, and generous whitespace.",
    styleVariant: styleVariantFrom(rawObj.styleVariant, proposal),
    calloutColor: colorRoleFrom(rawObj.calloutColor, proposal),
    backgroundStyle: backgroundStyleFrom(rawObj.backgroundStyle, proposal),
    markerStyle: markerStyleFrom(rawObj.markerStyle, proposal),
    copyDensity: rawObj.copyDensity === "tight" ? "tight" : "balanced",
    colorUse:
      cleanText(rawObj.colorUse, 220) ||
      "Use the brand palette for accents, callouts, page markers, metric rings, and support shapes.",
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
        builderType: input.proposal.builderType || input.request.builderType || DEFAULT_PROPOSAL_BUILDER_TYPE,
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
          "Use a second image only when it adds a different idea, such as client trust plus growth, not a repeated version of the same story.",
          "Use concise bullets with strong hierarchy; avoid paragraphs that become noisy.",
          "Use brand-colored callout bars or tags for pricing and critical terms.",
          "Never use prompt text as a caption.",
          "Never ask image AI to draw logos, logo boxes, white logo spaces, dashed placeholders, or fake indicators.",
          "Use the real brand logo separately in the renderer.",
        ],
      }),
    },
    {
      name: "get_design_system_options",
      description: "Return the PDF renderer style options. Pick one combination that fits the brand and client instead of reusing the same deck style every time.",
      input_schema: { type: "object", properties: {} },
      handler: async () => ({
        styleVariant: STYLE_VARIANTS,
        calloutColor: COLOR_ROLES,
        backgroundStyle: BACKGROUND_STYLES,
        markerStyle: MARKER_STYLES,
        guidance: [
          "Choose a style variant based on the sender brand, offer, and client industry.",
          "Use the sender's actual brand palette; only use red if it is truly part of that brand palette.",
          "Vary page markers, background treatment, and section composition across users.",
          "Keep the final deck concise and premium, usually 7-9 slides.",
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
  const assets = filterAssetsForBrand(input, await listProposalVisualAssets({ presign: false }));
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
4. Call get_design_system_options.

Return ONLY valid JSON. Do not include markdown.

Return this exact shape:
{
  "styleSummary": "short deck style direction",
  "styleVariant": "clean-light | bold-brand | editorial | dark-cover | minimal-grid",
  "calloutColor": "primary | secondary | accent",
  "backgroundStyle": "white | soft-tint | split-band | brand-wash",
  "markerStyle": "corner-block | side-tab | small-pill",
  "copyDensity": "tight | balanced",
  "colorUse": "how to use actual brand colors in callouts, markers, metrics, and support shapes",
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
- The proposal builder type from raw context controls the story:
  - visual-sales-deck: sell the offer with a concise branded deck, visual proof, pricing, terms, and next steps.
  - professional-services: structure the deck as professional overview, scope of work, proposed timeline, fee estimate, why work with us, and next steps.
  - process-framework: structure the deck as executive summary, engagement coverage, phased framework, risks or failure points, quick wins, success criteria, and next steps.
- Proposal types and service packages describe what is being sold; builder type describes how the proposal should be organized.
- Choose image IDs from list_available_images only.
- Favor reusable transparent PNG / 3D cutout assets.
- Pick a different design treatment when the brand, industry, or offer calls for it. Do not default every proposal to the same accent template.
- Use the actual brand colors from raw context. Only choose red-like callouts if the brand palette includes a red-like color.
- Make the visual sections feel full. Use two-visuals for about or benefits only when the second selected image adds a clearly different idea.
- Keep headlines and callout copy short enough to fit without cutting a sentence; avoid long unfinished clauses.
- If client Google/local profile facts exist in the raw context, include them in the proof or about slide with exact rating, review count, category, or profile status.
- For professional-services or process-framework proposals, do not force Google/local-growth language unless the request is actually about local presence.
- Keep bullets concise enough for PDF layout.
- Use client-facing language only. Do not show internal wording such as "public profile signals" or "raw context".
- Speak directly to the client using "you" and "your". Do not write meta phrases such as "this section", "proof points", "slide", "proposal builder", or "the client can see".
- For the proof slide, use a client-facing headline such as "Your Local Growth Opportunity" or "What Your Local Profile Shows", not "Your Proof Points".
- Write complete short phrases. Do not end visible slide copy mid-sentence.
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
