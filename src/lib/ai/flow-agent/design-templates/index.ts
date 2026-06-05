import { AGENT_DESIGN_TEMPLATES } from "./catalog";
import type {
  AgentDesignChannel,
  AgentDesignTemplate,
  AgentDesignTemplateMatch,
  AgentDesignTemplateSearchInput,
} from "./types";

export { AGENT_DESIGN_TEMPLATE_COUNT, AGENT_DESIGN_TEMPLATES } from "./catalog";
export type {
  AgentDesignChannel,
  AgentDesignFormat,
  AgentDesignOrientation,
  AgentDesignPalette,
  AgentDesignTemplate,
  AgentDesignTemplateMatch,
  AgentDesignTemplateSearchInput,
} from "./types";

const CHANNEL_ALIASES: Record<string, AgentDesignChannel> = {
  instagram: "social_post",
  facebook: "social_post",
  post: "social_post",
  social: "social_post",
  story: "story",
  reel: "story",
  flyer: "flyer",
  flier: "flyer",
  ad: "ad",
  advert: "ad",
  advertisement: "ad",
  poster: "poster",
  banner: "banner",
  email: "email_header",
  website: "website_hero",
  hero: "website_hero",
};

export function getAgentDesignTemplateById(id: string | null | undefined): AgentDesignTemplate | null {
  if (!id) return null;
  const normalized = normalize(id);
  return AGENT_DESIGN_TEMPLATES.find((template) => normalize(template.id) === normalized) || null;
}

export function findAgentDesignTemplates(input: AgentDesignTemplateSearchInput = {}): AgentDesignTemplateMatch[] {
  const limit = clampLimit(input.limit);
  const industry = normalize(input.industry || "");
  const query = normalize(input.query || "");
  const useCase = normalize(input.useCase || "");
  const tags = (input.tags || []).map((tag) => normalize(tag)).filter(Boolean);
  const channel = normalizeChannel(input.channel);

  return AGENT_DESIGN_TEMPLATES
    .map((template) => {
      const textParts = [
        template.id,
        template.name,
        template.industry,
        template.industryLabel,
        template.useCase,
        template.layout,
        template.imageDirection,
        template.typography,
        template.promptGuidance,
        ...template.audience,
        ...template.industryTags,
        ...template.styleTags,
        ...template.metaTags,
      ];
      const haystack = normalize(textParts.join(" "));
      const matchedTags = new Set<string>();
      let score = 0;

      if (industry) {
        if (normalize(template.industry) === industry || normalize(template.industryLabel) === industry) score += 80;
        if (template.industryTags.some((tag) => normalize(tag).includes(industry) || industry.includes(normalize(tag)))) score += 45;
        if (haystack.includes(industry)) score += 18;
      }

      if (channel && template.format.channel === channel) score += 35;

      if (useCase) {
        for (const token of tokenize(useCase)) {
          if (haystack.includes(token)) {
            score += 8;
            matchedTags.add(token);
          }
        }
      }

      if (query) {
        for (const token of tokenize(query)) {
          if (haystack.includes(token)) {
            score += 6;
            matchedTags.add(token);
          }
        }
      }

      for (const tag of tags) {
        if (haystack.includes(tag)) {
          score += 12;
          matchedTags.add(tag);
        }
      }

      if (!industry && !query && !useCase && tags.length === 0 && (!channel || input.channel === "any")) {
        score = 1;
      }

      return { template, score, matchedTags: Array.from(matchedTags).slice(0, 12) };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name))
    .slice(0, limit);
}

export function chooseAgentDesignTemplate(input: AgentDesignTemplateSearchInput = {}): AgentDesignTemplate | null {
  return findAgentDesignTemplates({ ...input, limit: 1 })[0]?.template || null;
}

export function buildAgentDesignTemplatePrompt(template: AgentDesignTemplate): string {
  return [
    `Agent design template: ${template.name} (${template.id})`,
    `Industry label: ${template.industryLabel}`,
    `Meta tags: ${template.metaTags.join(", ")}`,
    `Format: ${template.format.channel}, ${template.format.orientation}, ${template.format.width}x${template.format.height}`,
    `Palette direction: primary ${template.palette.primary}, secondary ${template.palette.secondary}, accent ${template.palette.accent}, background ${template.palette.background}, text ${template.palette.text}`,
    `Layout: ${template.layout}`,
    `Image direction: ${template.imageDirection}`,
    `Typography: ${template.typography}`,
    `Copy zones: ${template.copySlots.join(", ")}`,
    `CTA style: ${template.ctaStyle}`,
    `Template guidance: ${template.promptGuidance}`,
    `Avoid: ${template.avoid.join(", ")}`,
    "Use this as the structural design template. Adapt all copy, imagery, colors, and proof to the user's actual brand kit and prompt. Do not invent facts.",
  ].join("\n");
}

export function serializeAgentDesignTemplateForTool(template: AgentDesignTemplate) {
  return {
    id: template.id,
    name: template.name,
    industry: template.industry,
    industryLabel: template.industryLabel,
    useCase: template.useCase,
    format: template.format,
    palette: template.palette,
    audience: template.audience,
    metaTags: template.metaTags,
    industryTags: template.industryTags,
    styleTags: template.styleTags,
    layout: template.layout,
    imageDirection: template.imageDirection,
    typography: template.typography,
    copySlots: template.copySlots,
    ctaStyle: template.ctaStyle,
    promptGuidance: template.promptGuidance,
    imageUrl: template.imageUrl,
    thumbnailUrl: template.thumbnailUrl,
    metaUrl: template.metaUrl,
  };
}

function normalizeChannel(channel: AgentDesignTemplateSearchInput["channel"]): AgentDesignChannel | null {
  if (!channel || channel === "any") return null;
  const normalized = normalize(channel);
  return CHANNEL_ALIASES[normalized] || (isAgentDesignChannel(normalized) ? normalized : null);
}

function isAgentDesignChannel(value: string): value is AgentDesignChannel {
  return [
    "social_post",
    "story",
    "flyer",
    "ad",
    "poster",
    "banner",
    "email_header",
    "website_hero",
  ].includes(value);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return Array.from(new Set(normalize(value).split(" ").filter((token) => token.length >= 3))).slice(0, 24);
}

function clampLimit(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 8;
  return Math.min(25, Math.max(1, Math.round(value)));
}
