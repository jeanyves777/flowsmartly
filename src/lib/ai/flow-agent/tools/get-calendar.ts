import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * get_calendar — unified view of what's happening on the user's
 * marketing calendar in a date range: scheduled social posts +
 * scheduled email/SMS campaigns + currently-enabled automations.
 *
 * Read-only. Use this when the user asks "what's coming up?", "what's
 * scheduled this week?", or before scheduling something new so you can
 * warn them about conflicts at the same time slot.
 *
 * Returns a single sorted timeline of entries with a `kind` discriminator
 * so the agent can render or summarize them by source.
 */
export const getCalendar: FlowAgentTool = {
  name: "get_calendar",
  description:
    "Return everything scheduled on the user's marketing calendar in a date range — scheduled social posts + scheduled email/SMS campaigns + currently-enabled automations (which fire on triggers, not fixed dates, so they're listed separately). Returns a sorted timeline of dated entries plus a list of always-on automations. Use BEFORE scheduling something new to spot conflicts at the same time slot.",
  input_schema: {
    type: "object",
    properties: {
      fromIso: { type: "string", description: "Optional ISO datetime lower bound. Default: now." },
      toIso: { type: "string", description: "Optional ISO datetime upper bound. Default: +30 days." },
      limit: { type: "number", description: "Max dated entries (1-100, default 50)." },
    },
  },
  plans: null,
  costKey: "AGENT_GET_CALENDAR",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const now = new Date();
      const from = typeof input.fromIso === "string" && input.fromIso ? new Date(input.fromIso) : now;
      const to =
        typeof input.toIso === "string" && input.toIso
          ? new Date(input.toIso)
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: "fromIso / toIso must be valid ISO datetimes",
        };
      }
      const limit =
        typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 50;

      const [posts, campaigns, automations] = await Promise.all([
        prisma.post.findMany({
          where: {
            userId: ctx.userId,
            status: "SCHEDULED",
            deletedAt: null,
            scheduledAt: { gte: from, lte: to },
          },
          orderBy: { scheduledAt: "asc" },
          take: limit,
          select: {
            id: true,
            caption: true,
            scheduledAt: true,
            platforms: true,
            mediaType: true,
          },
        }),
        prisma.campaign.findMany({
          where: {
            userId: ctx.userId,
            status: { in: ["SCHEDULED", "SENDING"] },
            scheduledAt: { gte: from, lte: to },
          },
          orderBy: { scheduledAt: "asc" },
          take: limit,
          select: {
            id: true,
            type: true,
            name: true,
            subject: true,
            scheduledAt: true,
            status: true,
          },
        }),
        prisma.automation.findMany({
          where: { userId: ctx.userId, enabled: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            type: true,
            campaignType: true,
            sendTime: true,
            daysOffset: true,
            timezone: true,
          },
        }),
      ]);

      const entries: Array<{
        kind: "post" | "campaign";
        id: string;
        at: string;
        label: string;
        detail: string;
        link: string;
      }> = [];

      for (const p of posts) {
        if (!p.scheduledAt) continue;
        entries.push({
          kind: "post",
          id: p.id,
          at: p.scheduledAt.toISOString(),
          label: "Social post",
          detail: `${truncate(p.caption ?? "", 80)} → ${safeArray(p.platforms).join(", ")}`,
          link: "/content/calendar",
        });
      }
      for (const c of campaigns) {
        if (!c.scheduledAt) continue;
        entries.push({
          kind: "campaign",
          id: c.id,
          at: c.scheduledAt.toISOString(),
          label: `${c.type} campaign`,
          detail: `${c.name}${c.subject ? ` — "${truncate(c.subject, 60)}"` : ""}`,
          link: `/campaigns/${c.id}`,
        });
      }
      entries.sort((a, b) => a.at.localeCompare(b.at));

      return {
        ok: true,
        data: {
          range: { fromIso: from.toISOString(), toIso: to.toISOString() },
          datedCount: entries.length,
          dated: entries.slice(0, limit),
          alwaysOnAutomations: automations.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            channel: a.campaignType,
            sendTime: a.sendTime,
            daysOffset: a.daysOffset,
            timezone: a.timezone,
            link: `/automations/${a.id}`,
          })),
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to load calendar",
      };
    }
  },
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function safeArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}
