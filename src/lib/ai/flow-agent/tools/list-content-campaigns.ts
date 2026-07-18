import { prisma } from "@/lib/db/client";
import { contentCampaignsListView } from "@/lib/agent-views/templates";
import { randomUUID } from "crypto";
import type { FlowAgentTool } from "../registry";

/**
 * list_content_campaigns — READ the user's Campaign-Studio content campaigns so
 * the agent can find the campaignId to improve_content_campaign / add_campaign_post
 * instead of asking the user which campaign. Read-only. [[campaign-studio-playground]]
 */
export const listContentCampaigns: FlowAgentTool = {
  name: "list_content_campaigns",
  description:
    "READ the user's CONTENT CAMPAIGNS (Campaign Studio — batches of scheduled social posts). Use before improve_content_campaign / add_campaign_post so you can resolve the right campaignId instead of asking the user. Optional status filter (DRAFT | ACTIVE | PAUSED | CANCELED | COMPLETED). Returns each campaign's id, name, status, brief, date range and post count. Read-only. (This is the content-post Campaign Studio — NOT email/SMS campaigns, which are list_campaigns.)",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Optional status filter (DRAFT | ACTIVE | PAUSED | CANCELED | COMPLETED)." },
      limit: { type: "number", description: "Max campaigns (1-50, default 20)." },
      asView: { type: "boolean", description: "Render a pickable inline chat view. Default true." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(50, Math.max(1, Math.floor(input.limit))) : 20;
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (typeof input.status === "string" && input.status.trim()) where.status = input.status.trim().toUpperCase();
      const campaigns = await prisma.contentCampaign.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true, name: true, description: true, status: true, startDate: true, endDate: true,
          defaultPlatforms: true, updatedAt: true,
          automations: { select: { _count: { select: { posts: true } } } },
        },
      });
      const parse = (v: string | null) => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } };
      const items = campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        brief: c.description || "",
        platforms: parse(c.defaultPlatforms),
        postCount: c.automations.reduce((n, a) => n + a._count.posts, 0),
        startDate: c.startDate?.toISOString() ?? null,
        endDate: c.endDate?.toISOString() ?? null,
        updatedAt: c.updatedAt.toISOString(),
      }));
      if (input.asView !== false && items.length > 0) {
        ctx.emit({ type: "agent_view", requestId: randomUUID(), spec: contentCampaignsListView(items) });
      }
      return {
        ok: true,
        data: {
          count: campaigns.length,
          campaigns: items,
          userMessage: campaigns.length === 0 ? "No content campaigns yet." : `${campaigns.length} content campaign${campaigns.length === 1 ? "" : "s"} shown in an inline picker. STOP and wait for the user's row action if they need to choose one.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list content campaigns" };
    }
  },
};
