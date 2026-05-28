import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * update_post — edit caption / scheduledAt / platforms / hashtags on
 * an existing Post. Only allowed on DRAFT or SCHEDULED posts (already-
 * PUBLISHED posts are immutable; trying returns a structured error).
 *
 * Mutating. The agent is expected to compose the new caption in the
 * user's preferred language.
 */
export const updatePost: FlowAgentTool = {
  name: "update_post",
  description:
    "Edit a DRAFT or SCHEDULED post (the only mutable post states). You can update any combination of caption / scheduledAt / platforms / hashtags. Use list_scheduled_posts first to find the postId. Pass `planId` from a confirmed propose_plan. Returns the updated post.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      postId: { type: "string", description: "Id of the post to update." },
      content: { type: "string", description: "Optional new caption (in user's preferred language)." },
      scheduledAt: { type: "string", description: "Optional new ISO datetime. Pass empty string to clear scheduling and move back to DRAFT (rare — usually pass a new datetime)." },
      platforms: { type: "array", items: { type: "string" }, description: "Optional new platforms array. Replaces the existing array entirely." },
      hashtags: { type: "array", items: { type: "string" }, description: "Optional new hashtag array. Replaces existing — extracted ones from content are merged in automatically." },
    },
    required: ["planId", "postId"],
  },
  plans: null,
  costKey: "AGENT_UPDATE_POST",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const postId = typeof input.postId === "string" ? input.postId : "";
      if (!postId) {
        return { ok: false, error_code: "missing_input", message: "postId is required." };
      }
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, userId: true, status: true, caption: true, hashtags: true, platforms: true, scheduledAt: true },
      });
      if (!post || post.userId !== ctx.userId) {
        return { ok: false, error_code: "not_found", message: `No post with id ${postId} in this account.` };
      }
      if (post.status !== "DRAFT" && post.status !== "SCHEDULED") {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `Post is in status ${post.status} — only DRAFT and SCHEDULED posts can be edited. Tell the user already-published posts are immutable; suggest creating a new one.`,
        };
      }

      const updateData: Record<string, unknown> = {};
      if (typeof input.content === "string" && input.content.trim()) {
        const content = input.content.trim();
        if (content.length > 2200) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: "Caption can't exceed 2200 characters.",
          };
        }
        updateData.caption = content;
        // Re-extract hashtags from new content if user didn't pass an explicit array.
        if (!Array.isArray(input.hashtags)) {
          const extracted = content.match(/#\w+/g) ?? [];
          const existing = safeStringArray(post.hashtags);
          updateData.hashtags = JSON.stringify(Array.from(new Set([...existing, ...extracted])));
        }
        updateData.mentions = JSON.stringify(content.match(/@\w+/g) ?? []);
      }

      if (Array.isArray(input.hashtags)) {
        const explicit = input.hashtags
          .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
          .map((h) => (h.startsWith("#") ? h : `#${h}`));
        const content = (typeof updateData.caption === "string" ? updateData.caption : post.caption) ?? "";
        const extracted = content.match(/#\w+/g) ?? [];
        updateData.hashtags = JSON.stringify(Array.from(new Set([...explicit, ...extracted])));
      }

      if (Array.isArray(input.platforms)) {
        const platforms = input.platforms
          .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
          .slice(0, 6);
        if (platforms.length === 0) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: "platforms can't be an empty array — pass at least one platform or omit the field entirely.",
          };
        }
        updateData.platforms = JSON.stringify(platforms);
      }

      if (typeof input.scheduledAt === "string") {
        const raw = input.scheduledAt.trim();
        if (raw === "") {
          // Clear scheduling — move back to DRAFT.
          updateData.scheduledAt = null;
          updateData.status = "DRAFT";
        } else {
          const d = new Date(raw);
          if (Number.isNaN(d.getTime())) {
            return {
              ok: false,
              error_code: "validation_failed",
              message: `Invalid scheduledAt — "${raw}" is not a valid ISO datetime.`,
            };
          }
          if (d.getTime() <= Date.now()) {
            return {
              ok: false,
              error_code: "validation_failed",
              message: "scheduledAt must be in the future.",
            };
          }
          updateData.scheduledAt = d;
          updateData.status = "SCHEDULED";
        }
      }

      if (Object.keys(updateData).length === 0) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "Nothing to update — pass at least one of content / scheduledAt / platforms / hashtags.",
        };
      }

      const updated = await prisma.post.update({
        where: { id: postId },
        data: updateData,
        select: { id: true, status: true, scheduledAt: true, caption: true },
      });

      return {
        ok: true,
        data: {
          postId: updated.id,
          status: updated.status,
          scheduledAt: updated.scheduledAt?.toISOString() ?? null,
          captionPreview: (updated.caption ?? "").slice(0, 200),
          link: updated.status === "SCHEDULED" ? "/content/calendar" : "/content",
          summary:
            updated.status === "SCHEDULED"
              ? `Updated — scheduled for ${updated.scheduledAt?.toISOString()}.`
              : `Updated as ${updated.status}.`,
        },
        resultRefType: "Post",
        resultRefId: updated.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to update post",
      };
    }
  },
};

function safeStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}
