import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * list_designs / list_media — READ the user's saved DESIGNS and MEDIA LIBRARY so
 * the agent can reference/reuse something they already made ("use the logo I
 * generated last week") instead of regenerating blindly. Read-only.
 * [[design-canvas-progress]] [[agent-operates-account-full-crud]]
 */
export const listDesigns: FlowAgentTool = {
  name: "list_designs",
  description:
    "READ the user's saved DESIGNS (Design Studio / agent-generated graphics + video projects). Use to reuse or reference an existing design instead of regenerating. Optional type filter ('image' | 'video_project') and category (social_post, ad, flyer, poster, banner, logo, …). Returns each design's id, name, category, size, imageUrl, type and status. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["image", "video_project"], description: "Optional — 'image' or 'video_project'." },
      category: { type: "string", description: "Optional category filter (e.g. social_post, ad, flyer, logo)." },
      limit: { type: "number", description: "Max designs (1-60, default 30)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(60, Math.max(1, Math.floor(input.limit))) : 30;
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (input.type === "image" || input.type === "video_project") where.type = input.type;
      if (typeof input.category === "string" && input.category.trim()) where.category = input.category.trim();
      const rows = await prisma.design.findMany({
        where, orderBy: { updatedAt: "desc" }, take: limit,
        select: { id: true, name: true, category: true, size: true, style: true, imageUrl: true, type: true, status: true, updatedAt: true },
      });
      return {
        ok: true,
        data: {
          count: rows.length,
          designs: rows.map((d) => ({
            id: d.id, name: d.name, category: d.category, size: d.size, style: d.style ?? null,
            type: d.type, status: d.status, imageUrl: d.imageUrl ?? null, updatedAt: d.updatedAt.toISOString(),
          })),
          userMessage: rows.length === 0 ? "No saved designs yet." : `${rows.length} design${rows.length === 1 ? "" : "s"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list designs" };
    }
  },
};

export const listMedia: FlowAgentTool = {
  name: "list_media",
  description:
    "READ the user's MEDIA LIBRARY (uploaded + AI-generated images, videos, audio, documents). Use to reuse an existing asset by url instead of regenerating. Optional type filter ('image' | 'video' | 'document' | 'svg'). Returns each file's id, name, url, type and size. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["image", "video", "document", "svg"], description: "Optional media type filter." },
      limit: { type: "number", description: "Max files (1-100, default 40)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 40;
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (["image", "video", "document", "svg"].includes(String(input.type))) where.type = input.type;
      const rows = await prisma.mediaFile.findMany({
        where, orderBy: { createdAt: "desc" }, take: limit,
        select: { id: true, originalName: true, filename: true, url: true, type: true, size: true, width: true, height: true, createdAt: true },
      });
      return {
        ok: true,
        data: {
          count: rows.length,
          media: rows.map((m) => ({
            id: m.id, name: m.originalName || m.filename, url: m.url, type: m.type,
            dimensions: m.width && m.height ? `${m.width}×${m.height}` : null,
            sizeKB: Math.round(m.size / 1024), createdAt: m.createdAt.toISOString(),
          })),
          userMessage: rows.length === 0 ? "The media library is empty." : `${rows.length} media file${rows.length === 1 ? "" : "s"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list media" };
    }
  },
};
