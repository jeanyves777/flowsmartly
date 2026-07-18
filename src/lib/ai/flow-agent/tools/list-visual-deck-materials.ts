import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { visualDeckMaterialsView } from "@/lib/agent-views/templates";
import type { FlowAgentTool } from "../registry";

/**
 * list_visual_deck_materials - show existing images/designs that can be used as
 * source material for a custom Visual Deck. This is the "which one?" card for
 * vague requests like "use those images in my visual deck".
 */
export const listVisualDeckMaterials: FlowAgentTool = {
  name: "list_visual_deck_materials",
  description:
    "List the user's existing media/images and saved designs as a clickable picker for building a custom VISUAL DECK presentation. Use this when the user says 'use these images', 'turn these into a visual deck', 'use my existing images/designs/materials', or references unclear existing assets. If the user did not clearly identify which assets, call this with an optional query and STOP; the card lets them pick one item or all shown. After they pick, create_visual_deck builds the full branded deck and shows it inline.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Optional text to filter names/tags/categories, e.g. 'logo', 'restaurant', 'Boston agency'." },
      limit: { type: "number", description: "Max items to show, 1-40. Default 20." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const query = typeof input.query === "string" ? input.query.trim().toLowerCase().slice(0, 80) : "";
      const limit = typeof input.limit === "number" ? Math.min(40, Math.max(1, Math.floor(input.limit))) : 20;

      const [media, designs] = await Promise.all([
        prisma.mediaFile.findMany({
          where: { userId: ctx.userId, type: { in: ["image", "svg"] } },
          orderBy: { createdAt: "desc" },
          take: 80,
          select: { id: true, originalName: true, filename: true, url: true, type: true, width: true, height: true, tags: true, createdAt: true },
        }),
        prisma.design.findMany({
          where: { userId: ctx.userId, imageUrl: { not: null }, type: { notIn: ["director_film", "agent_view", "story_ad_script_draft"] } },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: { id: true, name: true, category: true, size: true, style: true, imageUrl: true, type: true, updatedAt: true },
        }),
      ]);

      const materials = [
        ...media.map((m) => ({
          id: m.id,
          title: m.originalName || m.filename || "Media image",
          sourceType: "media" as const,
          type: m.type,
          url: m.url,
          details: [m.width && m.height ? `${m.width}x${m.height}` : null, parseTags(m.tags).slice(0, 3).join(", ")].filter(Boolean).join(" - "),
          updatedAt: m.createdAt.toISOString(),
          haystack: [m.originalName, m.filename, m.type, m.tags].filter(Boolean).join(" ").toLowerCase(),
        })),
        ...designs.map((d) => ({
          id: d.id,
          title: d.name || "Saved design",
          sourceType: "design" as const,
          type: d.type,
          url: d.imageUrl,
          details: [d.category, d.size, d.style].filter(Boolean).join(" - "),
          updatedAt: d.updatedAt.toISOString(),
          haystack: [d.name, d.category, d.size, d.style, d.type].filter(Boolean).join(" ").toLowerCase(),
        })),
      ]
        .filter((m) => !!m.url)
        .filter((m) => !query || m.haystack.includes(query))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .slice(0, limit);

      const spec = visualDeckMaterialsView({ query, materials });
      ctx.emit({ type: "agent_view", requestId: randomUUID(), spec });

      return {
        ok: true,
        data: {
          count: materials.length,
          materials: materials.map(({ haystack: _haystack, ...m }) => m),
          userMessage:
            materials.length === 0
              ? "No matching images or designs were found. Ask the user to upload material or describe the deck."
              : `Rendered ${materials.length} possible visual-deck material${materials.length === 1 ? "" : "s"} as a picker. STOP and wait for the user's click.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list visual deck materials" };
    }
  },
};

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
}
