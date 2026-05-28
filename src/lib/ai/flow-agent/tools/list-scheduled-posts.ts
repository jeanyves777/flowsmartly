import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * list_scheduled_posts — show what the user has on the calendar.
 * Read-only, free. The agent should use this when the user asks
 * "what's scheduled?" or before scheduling something new (to avoid
 * stomping on an existing post at the same time).
 */
export const listScheduledPosts: FlowAgentTool = {
  name: "list_scheduled_posts",
  description:
    "List the user's upcoming SCHEDULED posts, in order of scheduledAt ascending. Returns at most `limit` rows (default 20, max 50). Optionally filter by a date range. Use BEFORE scheduling something new so you can warn the user if there's already a post at that time.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max rows (1-50, default 20)." },
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
        typeof input.limit === "number" ? Math.min(50, Math.max(1, Math.floor(input.limit))) : 20;
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

      const posts = await prisma.post.findMany({
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
      });

      return {
        ok: true,
        data: {
          count: posts.length,
          range: { fromIso: from.toISOString(), toIso: to.toISOString() },
          posts: posts.map((p) => ({
            postId: p.id,
            caption: (p.caption ?? "").slice(0, 280),
            scheduledAt: p.scheduledAt?.toISOString() ?? null,
            platforms: safeParseArray(p.platforms),
            mediaType: p.mediaType,
            hasMedia: !!p.mediaUrl,
          })),
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
