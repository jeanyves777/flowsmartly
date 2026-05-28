import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * get_brand_identity — fetches the user's full BrandKit. Mirrors the
 * business-plan agent's tool of the same name. Read-only, free.
 *
 * The agent should call this any time it's about to produce copy or
 * media that needs to feel like the brand (captions, post text, image
 * prompts, voice scripts, ad headlines).
 */
export const getBrandIdentity: FlowAgentTool = {
  name: "get_brand_identity",
  description:
    "Fetch the user's full BrandKit — name, tagline, description, industry, niche, target audience, voice tone, personality, colors, fonts, unique value, products, keywords, hashtags, social handles, contact info. Call this BEFORE producing any copy or visual that should sound/look like the brand. Returns { configured: false } if no brand kit exists — in that case, prompt the user to set one up at /brand-kit before proceeding.",
  input_schema: { type: "object", properties: {} },
  plans: null,
  costKey: "AGENT_GET_BRAND_IDENTITY",
  mutating: false,
  handler: async (_input, ctx) => {
    try {
      const kit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      });
      if (!kit) {
        return {
          ok: true,
          data: { configured: false },
        };
      }
      const parseArray = (json: string | null | undefined): string[] => {
        if (!json) return [];
        try {
          const parsed = JSON.parse(json);
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
        } catch {
          return [];
        }
      };
      const parseObject = (json: string | null | undefined): Record<string, string> => {
        if (!json) return {};
        try {
          const parsed = JSON.parse(json);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const out: Record<string, string> = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === "string" && v.trim()) out[k] = v.trim();
            }
            return out;
          }
          return {};
        } catch {
          return {};
        }
      };
      return {
        ok: true,
        data: {
          configured: true,
          name: kit.name,
          tagline: kit.tagline,
          description: kit.description,
          industry: kit.industry,
          niche: kit.niche,
          targetAudience: kit.targetAudience,
          voiceTone: kit.voiceTone,
          personality: parseArray(kit.personality),
          uniqueValue: kit.uniqueValue,
          products: parseArray(kit.products),
          keywords: parseArray(kit.keywords),
          avoidWords: parseArray(kit.avoidWords),
          handles: parseObject(kit.handles),
          email: kit.email,
          phone: kit.phone,
          website: kit.website,
          address: [kit.address, kit.city, kit.state, kit.zip, kit.country]
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .join(", "),
          // Locked-in output language for this account (BCP-47). EVERY
          // piece of content you produce — captions, copy, image prompts,
          // video prompts, voice scripts — MUST be in this language.
          preferredLanguage: kit.preferredLanguage ?? "en",
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to load brand kit",
      };
    }
  },
};
