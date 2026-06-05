import { randomUUID } from "crypto";
import { findAgentDesignTemplates, serializeAgentDesignTemplateForTool } from "../design-templates";
import type { AgentDesignChannel } from "../design-templates";
import type { FlowAgentTool } from "../registry";

/**
 * present_design_templates — show the user a few matching design templates as
 * CLICKABLE CARDS in chat (with thumbnails) so they can pick one or choose to
 * design from their prompt only. This is the visual picker the user asked for:
 * the agent must offer it BEFORE generating a branded design instead of
 * silently choosing a template.
 *
 * It emits a `template_options` event the chat renders as a card grid + a
 * "No template — use my prompt only" button. The agent then STOPS and waits;
 * the user's click sends a normal message telling the agent which template id
 * to pass to create_branded_design (or that they want no template).
 */
export const presentDesignTemplates: FlowAgentTool = {
  name: "present_design_templates",
  description:
    "Show the user a few matching design templates as CLICKABLE THUMBNAIL CARDS in the chat, plus a 'No template (use my prompt only)' option. Call this BEFORE create_branded_design for any flyer/poster/ad/social design so the user can PICK a look or decline — never silently choose a template yourself. After calling this, STOP and wait: the user clicks a card and their choice arrives as the next message (it includes the templateId to pass to create_branded_design, or says to use no template).",
  input_schema: {
    type: "object",
    properties: {
      industry: { type: "string", description: "Industry/business category, e.g. restaurant, real estate, salon, dental." },
      query: { type: "string", description: "The user's design request / search phrase." },
      channel: { type: "string", description: "social_post, story, flyer, ad, poster, banner, email_header, website_hero, or any." },
      useCase: { type: "string", description: "Goal, e.g. launch offer, event invite, seasonal sale." },
      limit: { type: "number", description: "How many to show (default 4, max 6)." },
    },
  },
  plans: null,
  costKey: "AGENT_PROPOSE_PLAN",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = Math.max(2, Math.min(typeof input.limit === "number" ? input.limit : 4, 6));
      const matches = findAgentDesignTemplates({
        industry: readString(input.industry),
        query: readString(input.query),
        channel: readChannel(input.channel),
        useCase: readString(input.useCase),
        tags: [],
        limit,
      });

      if (matches.length === 0) {
        return {
          ok: true,
          data: {
            shown: 0,
            userMessage:
              "No specific templates matched, so tell the user you'll design from their prompt directly (no template). Proceed to create_branded_design without a templateId once they confirm the format + tier.",
          },
        };
      }

      const templates = matches.map((m) => {
        const s = serializeAgentDesignTemplateForTool(m.template);
        return {
          id: s.id as string,
          name: (s.name as string) || (s.id as string),
          industry: (s.industry as string) ?? null,
          thumbnailUrl: (s.thumbnailUrl as string) || (s.imageUrl as string) || null,
        };
      });

      const requestId = randomUUID();
      ctx.emit({ type: "template_options", requestId, templates });

      return {
        ok: true,
        data: {
          shown: templates.length,
          requestId,
          templates: templates.map((t) => ({ id: t.id, name: t.name })),
          userMessage:
            `Showed ${templates.length} template options to the user as clickable cards, plus a "No template — use my prompt only" button. STOP NOW and wait for their pick — do NOT call create_branded_design yet. When they pick, they'll tell you the templateId to use (or that they want no template); then confirm the format + tier and generate. Add one short friendly line like "Pick a look below, or choose no template to design from your idea."`,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to present design templates.",
      };
    }
  },
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readChannel(value: unknown): AgentDesignChannel | "any" | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const n = value.trim().toLowerCase();
  if (n === "any") return "any";
  if (["social_post", "story", "flyer", "ad", "poster", "banner", "email_header", "website_hero"].includes(n)) {
    return n as AgentDesignChannel;
  }
  return null;
}
