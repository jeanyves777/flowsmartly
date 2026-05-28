import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * list_connected_socials — the user's connected social accounts so the
 * agent can show them and let the user PICK which platforms to post /
 * schedule to. Read-only, free.
 *
 * The agent must call this BEFORE scheduling/posting and confirm the
 * target platforms with the user — never silently default to all or to
 * "feed". "feed" (the in-app FlowSmartly feed) is always available even
 * with zero external connections.
 */
export const listConnectedSocials: FlowAgentTool = {
  name: "list_connected_socials",
  description:
    "List the user's CONNECTED social accounts (Instagram, Facebook, X/Twitter, LinkedIn, TikTok, etc.) so you can show them and let the user choose which platforms to post/schedule to. ALWAYS call this before scheduling a post and confirm the targets — never assume platforms. The in-app 'feed' is always available even with no external connections. If a platform the user wants isn't connected, tell them to connect it at /settings/social (or /social).",
  input_schema: { type: "object", properties: {} },
  plans: null,
  costKey: "AGENT_LIST_FEATURES", // free
  mutating: false,
  handler: async (_input, ctx) => {
    try {
      const accounts = await prisma.socialAccount.findMany({
        where: { userId: ctx.userId, isActive: true },
        select: {
          platform: true,
          platformUsername: true,
          platformDisplayName: true,
          followersCount: true,
        },
        orderBy: { connectedAt: "desc" },
      });

      const connected = accounts.map((a) => ({
        platform: a.platform,
        handle: a.platformUsername || a.platformDisplayName || null,
        followers: a.followersCount ?? null,
      }));

      return {
        ok: true,
        data: {
          // "feed" is the always-available in-app destination.
          alwaysAvailable: ["feed"],
          connectedCount: connected.length,
          connected,
          postablePlatforms: ["feed", ...connected.map((c) => c.platform)],
          guidance:
            connected.length > 0
              ? "Show the user these connected platforms (+ in-app feed) and ask which to post/schedule to. Pass only the chosen ones to schedule_social_post."
              : "No external socials connected. Offer to post to the in-app feed, and mention they can connect Instagram/Facebook/etc. at /settings/social to cross-post.",
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to list connected socials",
      };
    }
  },
};
