import {
  AGENT_DESIGN_TEMPLATE_COUNT,
  findAgentDesignTemplates,
  serializeAgentDesignTemplateForTool,
} from "../design-templates";
import type { AgentDesignChannel } from "../design-templates";
import type { FlowAgentTool } from "../registry";

export const listAgentDesignTemplates: FlowAgentTool = {
  name: "list_agent_design_templates",
  description:
    "Search FlowAI's dedicated agent design-template catalog. Use this BEFORE create_branded_design when the user asks for an industry-based design, wants template options, or gives an industry like restaurant, real estate, church, medical, salon, tax, ecommerce, fitness, law, etc. Returns template ids with industry labels, meta tags, layout direction, palette, and copy zones so you can pick a templateId for create_branded_design.",
  input_schema: {
    type: "object",
    properties: {
      industry: {
        type: "string",
        description: "Optional industry or business category, e.g. restaurant, real estate, church, salon, dental, ecommerce.",
      },
      query: {
        type: "string",
        description: "Optional natural-language design request or search phrase.",
      },
      channel: {
        type: "string",
        description: "Optional channel: social_post, story, flyer, ad, poster, banner, email_header, website_hero, or any.",
      },
      useCase: {
        type: "string",
        description: "Optional goal, e.g. launch offer, event invite, trust story, premium showcase, open house, seasonal sale.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Optional meta/style tags to match.",
      },
      limit: {
        type: "number",
        description: "How many matches to return. Default 8, maximum 25.",
      },
    },
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: false,
  handler: async (input) => {
    try {
      const tags = Array.isArray(input.tags)
        ? input.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
        : [];
      const matches = findAgentDesignTemplates({
        industry: readString(input.industry),
        query: readString(input.query),
        channel: readChannel(input.channel),
        useCase: readString(input.useCase),
        tags,
        limit: typeof input.limit === "number" ? input.limit : null,
      });

      return {
        ok: true,
        data: {
          totalCatalogTemplates: AGENT_DESIGN_TEMPLATE_COUNT,
          matches: matches.map((match) => ({
            score: match.score,
            matchedTags: match.matchedTags,
            ...serializeAgentDesignTemplateForTool(match.template),
          })),
          usage:
            "Pick the strongest template id and pass it as templateId to create_branded_design. If none fit, call create_branded_design without a templateId and it will choose the closest default from brand industry and prompt.",
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to search agent design templates.",
      };
    }
  },
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readChannel(value: unknown): AgentDesignChannel | "any" | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "any") return "any";
  if (
    [
      "social_post",
      "story",
      "flyer",
      "ad",
      "poster",
      "banner",
      "email_header",
      "website_hero",
    ].includes(normalized)
  ) {
    return normalized as AgentDesignChannel;
  }
  return null;
}
