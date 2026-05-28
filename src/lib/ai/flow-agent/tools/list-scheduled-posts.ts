import { prisma } from "@/lib/db/client";
import { enumerateCampaignAutomationOccurrences } from "@/lib/content/campaign-calendar";
import type { FlowAgentTool } from "../registry";

/**
 * list_scheduled_posts — show what the user actually has on the calendar.
 *
 * CRITICAL: the content calendar is fed by TWO sources, not one. A
 * previous version only queried scheduled `Post` rows and reported
 * "nothing scheduled" to users whose calendars were full of content
 * automations — see the 2026-05-28 live bug. We now merge:
 *   1. `Post` rows with status=SCHEDULED (one-off posts the user queued)
 *   2. ContentAutomation occurrences (recurring/calendar-driven "cron
 *      jobs waiting") via the same `enumerateCampaignAutomationOccurrences`
 *      helper the calendar UI uses.
 *
 * Read-only, free.
 */
export const listScheduledPosts: FlowAgentTool = {
  name: "list_scheduled_posts",
  description:
    "List everything on the user's content calendar in a date range — both one-off SCHEDULED posts AND recurring/automation occurrences ('cron jobs' that will fire). Merged + sorted by time ascending. Returns up to `limit` items (default 30, max 100). Use BEFORE telling the user their calendar is empty, and BEFORE scheduling something new so you can flag conflicts. The two kinds are tagged with `source: 'post' | 'automation'`.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max items (1-100, default 30)." },
      fromIso: { type: "string", description: "Optional ISO datetime lower bound (default = now)." },
      toIso: { type: "string", description: "Optional ISO datetime upper bound (default = +30 days)." },
    },
  },
  plans: null,
  costKey: "AGENT_LIST_SCHEDULED_POSTS",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit =
        typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 30;
      const fromIso = typeof input.fromIso === "string" ? input.fromIso : null;
      const toIso = typeof input.toIso === "string" ? input.toIso : null;
      const now = new Date();
      const from = fromIso ? new Date(fromIso) : now;
      const to = toIso ? new Date(toIso) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: "fromIso / toIso must be valid ISO datetimes",
        };
      }

      // Pull both sources in parallel — same as the calendar UI.
      const [posts, automationOccurrences] = await Promise.all([
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
            mediaUrl: true,
          },
        }),
        enumerateCampaignAutomationOccurrences(ctx.userId, from, to).catch((e) => {
          console.error("[list_scheduled_posts] automation enumerate failed:", e);
          return [];
        }),
      ]);

      type Item = {
        source: "post" | "automation";
        id: string;
        caption: string;
        scheduledAt: string | null;
        platforms: string[];
        kind: string;
        editable: boolean;
      };

      const postItems: Item[] = posts.map((p) => ({
        source: "post",
        id: p.id,
        caption: (p.caption ?? "").slice(0, 200),
        scheduledAt: p.scheduledAt?.toISOString() ?? null,
        platforms: safeParseArray(p.platforms),
        kind: "one-off post",
        editable: true, // can update_post / cancel_scheduled_post
      }));

      const automationItems: Item[] = automationOccurrences.map((o) => ({
        source: "automation",
        id: o.id, // composite automationId:occurrenceKey
        caption: o.topic || o.itemName || o.campaignName,
        scheduledAt: o.scheduledAt,
        platforms: o.platforms,
        kind: `${o.triggerType.toLowerCase()} automation (campaign: ${o.campaignName})`,
        editable: false, // managed via the automation, not a Post row — use update_automation
      }));

      const merged = [...postItems, ...automationItems]
        .filter((i) => i.scheduledAt)
        .sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1))
        .slice(0, limit);

      return {
        ok: true,
        data: {
          totalScheduledPosts: postItems.length,
          totalAutomationOccurrences: automationItems.length,
          count: merged.length,
          range: { fromIso: from.toISOString(), toIso: to.toISOString() },
          items: merged,
          note:
            automationItems.length > 0
              ? "Some items come from recurring content automations (source='automation') — those are edited via update_automation, not update_post/cancel_scheduled_post."
              : undefined,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to list scheduled posts",
      };
    }
  },
};

function safeParseArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}
