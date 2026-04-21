import { prisma } from "@/lib/db/client";
import { POPULAR_FONTS } from "@/components/studio/utils/font-loader";
import type { AgentTool } from "./client";

/**
 * Studio agent tools — read-only context fetchers the design agent can call
 * mid-loop to ground its output in real user/brand data.
 *
 * All tools take `userId` from a closure rather than as a model-supplied
 * argument so the agent can never reach into another user's data.
 *
 * Token budget: each tool result is bounded (top N records, truncated text)
 * because the model has to round-trip them through context.
 */

export interface StudioToolContext {
  userId: string;
}

const FONT_PAIRINGS: Array<{ heading: string; body: string; mood: string }> = [
  { heading: "Playfair Display", body: "Lato", mood: "elegant editorial" },
  { heading: "Bebas Neue", body: "Open Sans", mood: "bold modern" },
  { heading: "Montserrat", body: "Merriweather", mood: "professional" },
  { heading: "Great Vibes", body: "Raleway", mood: "wedding / luxury" },
  { heading: "Anton", body: "Roboto", mood: "sports / energetic" },
  { heading: "Cinzel", body: "Lora", mood: "classical / formal" },
  { heading: "Pacifico", body: "Quicksand", mood: "playful / fun" },
  { heading: "Oswald", body: "PT Sans", mood: "magazine" },
  { heading: "Allura", body: "Cormorant Garamond", mood: "romantic" },
  { heading: "Bangers", body: "Comic Neue", mood: "comic / casual" },
];

export function buildStudioTools(ctx: StudioToolContext): AgentTool[] {
  return [
    {
      name: "get_brand_kit",
      description:
        "Fetch the user's brand kit — name, voice, colors, tagline, industry, target audience. Call once at the start of any design task to ground choices in the user's brand. Returns null fields when the kit is not configured.",
      input_schema: {
        type: "object",
        properties: {},
      },
      handler: async () => {
        const kit = await prisma.brandKit.findFirst({
          where: { userId: ctx.userId },
          select: {
            name: true,
            voiceTone: true,
            description: true,
            tagline: true,
            industry: true,
            niche: true,
            targetAudience: true,
            colors: true,
            fonts: true,
          },
        });
        if (!kit) return { configured: false };

        // Parse JSON fields stored as strings — surface as objects
        let parsedColors: unknown = null;
        let parsedFonts: unknown = null;
        try { parsedColors = kit.colors ? JSON.parse(kit.colors) : null; } catch {}
        try { parsedFonts = kit.fonts ? JSON.parse(kit.fonts) : null; } catch {}

        return {
          configured: true,
          name: kit.name,
          voiceTone: kit.voiceTone,
          description: kit.description,
          tagline: kit.tagline,
          industry: kit.industry,
          niche: kit.niche,
          targetAudience: kit.targetAudience,
          colors: parsedColors,
          fonts: parsedFonts, // { heading, body } when configured
        };
      },
    },
    {
      name: "get_recent_designs_in_category",
      description:
        "Fetch up to 5 of the user's most recent designs in a given category (social_post, ad, flyer, poster, banner, signboard). Use this to understand the user's style preferences and avoid repeating concepts they have already created.",
      input_schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["social_post", "ad", "flyer", "poster", "banner", "signboard"],
            description: "Design category to filter by",
          },
        },
        required: ["category"],
      },
      handler: async (input) => {
        const category = String(input.category || "");
        const designs = await prisma.design.findMany({
          where: { userId: ctx.userId, category },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            prompt: true,
            style: true,
            createdAt: true,
          },
        });
        return designs.map((d: { prompt: string; style: string | null; createdAt: Date }) => ({
          prompt: d.prompt.slice(0, 200),
          style: d.style,
          createdAt: d.createdAt.toISOString(),
        }));
      },
    },
    {
      name: "get_typography_pairings",
      description:
        "Get curated font pairings (heading + body) by mood. Returns the 10 best-performing pairs from our library so you can pick fonts that actually exist in the editor instead of inventing names.",
      input_schema: {
        type: "object",
        properties: {
          mood: {
            type: "string",
            description:
              "Optional mood filter (e.g. 'elegant', 'bold', 'playful', 'wedding'). Omit for all pairings.",
          },
        },
      },
      handler: async (input) => {
        const mood = String(input.mood || "").toLowerCase();
        if (!mood) return FONT_PAIRINGS;
        const filtered = FONT_PAIRINGS.filter((p) =>
          p.mood.toLowerCase().includes(mood),
        );
        return filtered.length > 0 ? filtered : FONT_PAIRINGS.slice(0, 5);
      },
    },
    {
      name: "list_available_fonts",
      description:
        "Return the full list of font families available in the editor. Use this only if you need to verify a specific font name; otherwise prefer get_typography_pairings.",
      input_schema: {
        type: "object",
        properties: {},
      },
      handler: async () => POPULAR_FONTS,
    },
  ];
}
