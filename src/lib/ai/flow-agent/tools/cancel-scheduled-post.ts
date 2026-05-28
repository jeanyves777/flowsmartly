import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * cancel_scheduled_post — soft-cancel a SCHEDULED post by id. Mutating,
 * so it needs a confirmed propose_plan first.
 */
export const cancelScheduledPost: FlowAgentTool = {
  name: "cancel_scheduled_post",
  description:
    "Cancel a SCHEDULED post the user previously created. Pass the postId (find it via list_scheduled_posts if you don't have it) and a confirmed planId. The post is moved to status=CANCELED — not deleted, so it remains in history.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      postId: { type: "string", description: "Id of the post to cancel." },
    },
    required: ["planId", "postId"],
  },
  plans: null,
  costKey: "AGENT_CANCEL_SCHEDULED_POST",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const postId = typeof input.postId === "string" ? input.postId : "";
      if (!postId) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "postId is required",
        };
      }
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, userId: true, status: true, caption: true },
      });
      if (!post) {
        return { ok: false, error_code: "not_found", message: `No post with id ${postId}` };
      }
      if (post.userId !== ctx.userId) {
        return { ok: false, error_code: "permission_denied", message: "That post belongs to another user." };
      }
      if (post.status !== "SCHEDULED") {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `Post is in status ${post.status}, only SCHEDULED posts can be canceled here.`,
        };
      }
      const updated = await prisma.post.update({
        where: { id: postId },
        data: { status: "CANCELED" },
        select: { id: true, status: true },
      });
      return {
        ok: true,
        data: {
          postId: updated.id,
          status: updated.status,
          summary: `Canceled scheduled post: "${(post.caption ?? "").slice(0, 80)}"`,
        },
        resultRefType: "Post",
        resultRefId: updated.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to cancel post",
      };
    }
  },
};
