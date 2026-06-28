import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { draftReviewResponse } from "@/lib/listsmartly/ai-review-responder";
import type { FlowAgentTool } from "../registry";

/**
 * respond_to_review — the agent drafts an on-brand reply to a customer review
 * and records it as the user's posted response, FOR them. Mirrors POST
 * /api/listsmartly/reviews/[id]/reply (auto mode): drafts with the brand voice
 * (draftReviewResponse), then sets responseStatus="posted" + postedResponse so
 * it shows as replied on the Reviews surface. The user identifies the review by
 * the reviewer's name and (optionally) the platform; the agent can also flag or
 * archive a review instead of replying.
 *
 * Mutating + confirmed plan. Drafting is AI work → costs AI_REVIEW_RESPONSE
 * (unless flag/archive only, which is free). Lands at /home/reviews.
 * [[agent-operates-account-full-crud]]
 */

const clean = (v: unknown, max: number): string =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const respondToReview: FlowAgentTool = {
  name: "respond_to_review",
  description:
    "Reply to a customer review on the Reviews & local SEO surface FOR the user. Use when they ask to respond to / reply to / thank / address a review. Identify the review by the reviewer's name via `author` (and optionally `platform` like 'google'/'yelp'). The agent AI-drafts an on-brand reply (matching their Brand Kit voice) and posts it. Alternatively set `action` to 'flag' (mark for attention) or 'archive' (hide it) instead of replying. To reply with the user's OWN words, pass `text` (free; no AI draft). Requires local presence to be set up. Pass `planId` from a confirmed propose_plan. Costs AI_REVIEW_RESPONSE for an AI draft; free for flag/archive or a user-supplied reply.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      author: { type: "string", description: "Reviewer's name to identify the review, e.g. 'Sarah M'. Required unless reviewId given." },
      reviewId: { type: "string", description: "Exact review id, if known (overrides author)." },
      platform: { type: "string", description: "Optional platform filter to disambiguate, e.g. 'google', 'yelp', 'facebook'." },
      action: { type: "string", description: "'reply' (default), 'flag', or 'archive'." },
      text: { type: "string", description: "Optional — reply with these exact words instead of an AI draft (free)." },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AGENT_RESPOND_TO_REVIEW",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const action = (clean(input.action, 20).toLowerCase() || "reply") as "reply" | "flag" | "archive";

      const profile = await prisma.listSmartlyProfile.findUnique({
        where: { userId: ctx.userId },
        select: { id: true, businessName: true, industry: true },
      });
      if (!profile) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: "The user hasn't set up local presence yet. Use setup_local_presence first.",
        };
      }

      // Resolve the target review.
      const reviewId = clean(input.reviewId, 60);
      const author = clean(input.author, 120);
      if (!reviewId && !author) {
        return { ok: false, error_code: "missing_input", message: "Tell me which review — give the reviewer's name." };
      }
      const platform = clean(input.platform, 40).toLowerCase();
      const review = await prisma.listingReview.findFirst({
        where: {
          profileId: profile.id,
          ...(reviewId ? { id: reviewId } : { authorName: { contains: author } }),
          ...(platform ? { platform } : {}),
        },
        orderBy: { publishedAt: "desc" },
      });
      if (!review) {
        return {
          ok: false,
          error_code: "not_found",
          message: `No review found${author ? ` from "${author}"` : ""}${platform ? ` on ${platform}` : ""}. Ask the user to confirm the reviewer's name.`,
        };
      }

      // ---- flag / archive (free) ----
      if (action === "flag" || action === "archive") {
        const updated = await prisma.listingReview.update({
          where: { id: review.id },
          data: action === "flag" ? { isFlagged: true } : { isArchived: true },
        });
        return {
          ok: true,
          data: {
            reviewId: updated.id,
            link: "/home/reviews",
            summary: `${action === "flag" ? "Flagged" : "Archived"} the review from ${review.authorName}. Confirm in ONE short sentence.`,
          },
          resultRefType: "ListingReview",
          resultRefId: updated.id,
        };
      }

      // ---- reply with the user's own words (free) ----
      const userText = clean(input.text, 1500);
      if (userText) {
        const updated = await prisma.listingReview.update({
          where: { id: review.id },
          data: { postedResponse: userText, responseStatus: "posted", respondedAt: new Date() },
        });
        return {
          ok: true,
          data: {
            reviewId: updated.id,
            response: userText,
            posted: true,
            link: "/home/reviews",
            summary: `Posted your reply to ${review.authorName}'s ${review.rating}-star review. Confirm in ONE short sentence.`,
          },
          resultRefType: "ListingReview",
          resultRefId: updated.id,
        };
      }

      // ---- AI-draft + post (charges credits) ----
      const cost = await getDynamicCreditCost("AI_REVIEW_RESPONSE");
      const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
      if (!ctx.isAdmin && (user?.aiCredits ?? 0) < cost) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `Drafting a review reply costs ${cost} credits. The user has ${user?.aiCredits ?? 0}.`,
          meta: { need: cost, have: user?.aiCredits ?? 0 },
        };
      }

      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: ctx.userId },
        select: { voiceTone: true, personality: true },
      });
      let personalityStr: string | undefined;
      if (brandKit?.personality) {
        try {
          personalityStr = (JSON.parse(brandKit.personality) as string[]).join(", ");
        } catch {
          personalityStr = brandKit.personality;
        }
      }

      const result = await draftReviewResponse(
        { text: review.text, rating: review.rating, authorName: review.authorName },
        {
          businessName: profile.businessName,
          voiceTone: brandKit?.voiceTone || undefined,
          personality: personalityStr,
          industry: profile.industry || undefined,
        }
      );

      const updated = await prisma.listingReview.update({
        where: { id: review.id },
        data: {
          aiDraftResponse: result.response,
          postedResponse: result.response,
          responseStatus: "posted",
          respondedAt: new Date(),
        },
      });

      if (!ctx.isAdmin && cost > 0) {
        await creditService.deductCredits({
          userId: ctx.userId,
          type: TRANSACTION_TYPES.USAGE,
          amount: cost,
          referenceType: "ai_review_response",
          referenceId: review.id,
          description: `Flow-AI review reply (${review.platform})`,
        });
      }

      return {
        ok: true,
        data: {
          reviewId: updated.id,
          response: result.response,
          tone: result.tone,
          posted: true,
          creditsUsed: ctx.isAdmin ? 0 : cost,
          link: "/home/reviews",
          summary: `Drafted and posted an on-brand reply to ${review.authorName}'s ${review.rating}-star ${review.platform} review. Share the reply text with the user in your confirmation.`,
        },
        resultRefType: "ListingReview",
        resultRefId: updated.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to respond to review" };
    }
  },
};
