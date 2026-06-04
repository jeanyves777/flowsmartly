import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * schedule_social_post — create a Post (caption + optional media) and
 * either publish it now or schedule it for a future timestamp on the
 * selected platforms.
 *
 * Mutating — requires a confirmed propose_plan first (the agent loop
 * enforces this via the planId check in registry/agent-loop).
 *
 * Cost: AGENT_SCHEDULE_POST (charged by the agent loop before this
 * handler runs).
 */
export const scheduleSocialPost: FlowAgentTool = {
  name: "schedule_social_post",
  description:
    "Create a social post with a caption (required) and optional media + hashtags + platforms, then publish it now or schedule it for a future ISO datetime. Pass `planId` from a confirmed propose_plan call. Returns the created post id and a link to view it on the calendar. Use ISO 8601 in UTC for scheduledAt — convert from the user's stated time using their timezone from the system prompt.",
  input_schema: {
    type: "object",
    properties: {
      planId: {
        type: "string",
        description: "REQUIRED — the planId returned by a confirmed propose_plan call. Without this the tool returns a validation_failed error.",
      },
      content: {
        type: "string",
        description: "Post caption (1-2200 chars). Required.",
      },
      scheduledAt: {
        type: "string",
        description: "ISO 8601 datetime in UTC. Omit to publish immediately. e.g. '2026-06-15T20:00:00Z' for 4 PM EST.",
      },
      platforms: {
        type: "array",
        description: "Platforms to publish to. Defaults to ['feed']. Valid: 'feed', 'facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'.",
        items: { type: "string" },
      },
      mediaUrl: {
        type: "string",
        description: "Optional single media URL (image or video). Use the agent's generate_image / generate_video tools first to produce one if needed.",
      },
      mediaType: {
        type: "string",
        description: "Type of mediaUrl: 'image' or 'video'. Default 'image' when mediaUrl is set.",
      },
      hashtags: {
        type: "array",
        description: "Optional explicit hashtag array. Hashtags inside `content` are auto-detected — only pass this if you want extras.",
        items: { type: "string" },
      },
    },
    required: ["planId", "content"],
  },
  plans: null,
  costKey: "AGENT_SCHEDULE_POST",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const content = typeof input.content === "string" ? input.content.trim() : "";
      if (!content) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "Caption is required. Ask the user what the post should say.",
        };
      }
      if (content.length > 2200) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: "Caption is over 2200 characters. Trim it down before retrying.",
        };
      }

      let parsedScheduledAt: Date | null = null;
      if (typeof input.scheduledAt === "string" && input.scheduledAt.trim().length > 0) {
        parsedScheduledAt = new Date(input.scheduledAt);
        if (Number.isNaN(parsedScheduledAt.getTime())) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: `Invalid scheduledAt — '${input.scheduledAt}' is not a valid ISO datetime.`,
          };
        }
        if (parsedScheduledAt.getTime() <= Date.now()) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: "scheduledAt must be in the future. If the user said a date that already passed, ask which next occurrence they meant.",
          };
        }
      }

      const platformsRaw = Array.isArray(input.platforms) ? input.platforms : ["feed"];
      const platforms = platformsRaw
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        .slice(0, 6);
      if (platforms.length === 0) platforms.push("feed");

      const hashtagsRaw = Array.isArray(input.hashtags) ? input.hashtags : [];
      const explicitHashtags = hashtagsRaw.filter(
        (h): h is string => typeof h === "string" && h.trim().length > 0,
      );
      const extractedHashtags = content.match(/#\w+/g) ?? [];
      const allHashtags = Array.from(
        new Set([
          ...explicitHashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)),
          ...extractedHashtags,
        ]),
      );

      const mediaUrl = typeof input.mediaUrl === "string" ? input.mediaUrl : null;
      const mediaType = mediaUrl
        ? typeof input.mediaType === "string" && (input.mediaType === "video" || input.mediaType === "image")
          ? input.mediaType
          : "image"
        : null;

      // Guard against a FABRICATED / broken media URL. The agent has been seen
      // inventing a plausible filename (e.g. .../generated-video-15s-premium.mp4)
      // instead of using the real generated asset URL, which publishes a post
      // with "Video unavailable". Verify the URL actually resolves first.
      if (mediaUrl && /^https?:\/\//i.test(mediaUrl)) {
        const reachable = await mediaUrlIsReachable(mediaUrl);
        if (!reachable) {
          return {
            ok: false,
            error_code: "validation_failed",
            message:
              "That media URL doesn't resolve — it looks invented or expired. Use the EXACT URL of the actual generated asset (the 'Media URL to REUSE' from the completed task) — never make up a filename. If the media isn't ready yet, wait for the task to finish, then post.",
          };
        }
      }

      const status = parsedScheduledAt ? "SCHEDULED" : "PUBLISHED";

      const post = await prisma.post.create({
        data: {
          userId: ctx.userId,
          caption: content,
          mediaUrl,
          mediaType,
          mediaMeta: mediaUrl ? JSON.stringify([mediaUrl]) : null,
          hashtags: JSON.stringify(allHashtags),
          mentions: JSON.stringify(content.match(/@\w+/g) ?? []),
          platforms: JSON.stringify(platforms),
          status,
          scheduledAt: parsedScheduledAt,
          publishedAt: parsedScheduledAt ? null : new Date(),
        },
        select: { id: true, status: true, scheduledAt: true, publishedAt: true },
      });

      const link = parsedScheduledAt ? `/content/calendar` : `/`;
      return {
        ok: true,
        data: {
          postId: post.id,
          status: post.status,
          scheduledAt: post.scheduledAt?.toISOString() ?? null,
          publishedAt: post.publishedAt?.toISOString() ?? null,
          platforms,
          link,
          summary: parsedScheduledAt
            ? `Scheduled for ${post.scheduledAt?.toISOString()} across ${platforms.join(", ")}`
            : `Published now to ${platforms.join(", ")}`,
        },
        resultRefType: "Post",
        resultRefId: post.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to create post",
      };
    }
  },
};

/**
 * Verify a media URL actually resolves before we attach it to a post — catches
 * fabricated/expired URLs that would publish as "media unavailable". HEAD first;
 * some CDNs reject HEAD, so fall back to a 1-byte ranged GET. Network failure or
 * a 4xx/5xx means "don't post this".
 */
async function mediaUrlIsReachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    let res = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (res.status === 403 || res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, signal: controller.signal });
    }
    return res.ok || res.status === 206;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
