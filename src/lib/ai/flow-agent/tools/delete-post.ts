import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * delete_post — soft-delete a post (any status). Sets `deletedAt` so
 * the post disappears from the feed + calendar but remains in history
 * for audit and undo.
 *
 * Mutating. Requires confirmed propose_plan. The agent should make sure
 * the user really meant DELETE (not cancel-scheduled) — published posts
 * vanish from the feed when deleted, which is a higher-blast-radius
 * action than cancel.
 */
export const deletePost: FlowAgentTool = {
  name: "delete_post",
  description:
    "Soft-delete a post (any status — DRAFT / SCHEDULED / PUBLISHED). Removes it from the feed and calendar but the row stays for audit. Mutating; pass `planId` from a confirmed propose_plan. For SCHEDULED posts, prefer `cancel_scheduled_post` instead (less destructive — just flips status to CANCELED without hiding the row).",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      postId: { type: "string", description: "Id of the post to delete." },
    },
    required: ["planId", "postId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const postId = typeof input.postId === "string" ? input.postId : "";
      if (!postId) {
        return { ok: false, error_code: "missing_input", message: "postId is required." };
      }
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, userId: true, status: true, caption: true, deletedAt: true },
      });
      if (!post || post.userId !== ctx.userId) {
        return { ok: false, error_code: "not_found", message: `No post with id ${postId} in this account.` };
      }
      if (post.deletedAt) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `Post is already deleted (at ${post.deletedAt.toISOString()}).`,
        };
      }
      await prisma.post.update({
        where: { id: postId },
        data: { deletedAt: new Date() },
      });
      return {
        ok: true,
        data: {
          postId,
          previousStatus: post.status,
          summary: `Deleted post: "${(post.caption ?? "").slice(0, 80)}"`,
        },
        resultRefType: "Post",
        resultRefId: postId,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to delete post",
      };
    }
  },
};
