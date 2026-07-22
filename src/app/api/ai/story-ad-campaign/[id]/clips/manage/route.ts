import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import {
  addAndRenderClip,
  addBlankClip,
  getCampaign,
  refundStoryAdCampaignUsage,
  removeClip,
  reorderClips,
  setClipApproval,
} from "@/lib/story-ad-campaign";
import type { ActPosition } from "@/lib/story-ad-campaign/types";

/**
 * Clip review actions for the Produce step (manual review-before-compose flow).
 * Single dispatcher keyed on `action`:
 *   - "approve"  { clipId, approved }       → toggle a clip's reviewed flag (free, no render)
 *   - "remove"   { clipId }                 → delete a clip + re-index (free)
 *   - "reorder"  { orderedIds: string[] }   → reorder clips (free)
 *   - "add"      { afterClipId?, sceneAction?, act? } → insert + render a new clip (charges a clip render)
 *
 * approve/remove/reorder are free state edits. "add" renders a video so it charges the
 * per-clip cost and refunds on render failure.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const current = await getCampaign(id, session.userId);
  if (!current) {
    return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    clipId?: string;
    approved?: boolean;
    orderedIds?: string[];
    afterClipId?: string | null;
    sceneAction?: string;
    act?: ActPosition;
  };

  try {
    switch (body.action) {
      case "approve": {
        if (!body.clipId) return badRequest("clipId required");
        const state = await setClipApproval({
          campaignId: id,
          userId: session.userId,
          clipId: body.clipId,
          approved: body.approved !== false,
        });
        return NextResponse.json({ success: true, data: { state } });
      }
      case "remove": {
        if (!body.clipId) return badRequest("clipId required");
        const state = await removeClip({ campaignId: id, userId: session.userId, clipId: body.clipId });
        return NextResponse.json({ success: true, data: { state } });
      }
      case "add_blank": {
        // Insert an empty scene (no render → free). User fills + generates it.
        // afterClipId (optional) inserts it BETWEEN scenes; else appended before the outro.
        const state = await addBlankClip({ campaignId: id, userId: session.userId, afterClipId: body.afterClipId });
        return NextResponse.json({ success: true, data: { state } });
      }
      case "reorder": {
        if (!Array.isArray(body.orderedIds) || !body.orderedIds.length) return badRequest("orderedIds required");
        const state = await reorderClips({ campaignId: id, userId: session.userId, orderedIds: body.orderedIds });
        return NextResponse.json({ success: true, data: { state } });
      }
      case "add": {
        // Adding a clip renders a video → charge the per-clip cost.
        const isAdmin = !!session.adminId;
        const providerCostKey = current.state.provider === "veo3"
          ? "AI_VIDEO_STUDIO"
          : current.state.provider === "cheap"
            ? "AI_VIDEO_CHEAP"
            : "AI_VIDEO_LITE";
        const cost = await getDynamicCreditCost(providerCostKey);
        if (!isAdmin) {
          const charge = await creditService.deductCredits({
            userId: session.userId,
            type: TRANSACTION_TYPES.USAGE,
            amount: cost,
            referenceType: "story_ad_campaign",
            referenceId: id,
            description: "Story Ad Campaign: add + render new clip",
          });
          if (!charge.success) {
            return NextResponse.json(
              { success: false, error: { code: "INSUFFICIENT_CREDITS", message: charge.error || `This requires ${cost} credits.` } },
              { status: 402 },
            );
          }
        }
        const result = await addAndRenderClip({
          campaignId: id,
          userId: session.userId,
          afterClipId: body.afterClipId,
          sceneAction: body.sceneAction,
          act: body.act,
        });
        // Refund if the new clip failed to render.
        if (result.status === "FAILED" && !isAdmin) {
          await refundStoryAdCampaignUsage({
            userId: session.userId,
            amount: cost,
            campaignId: id,
            reason: "Refund: added clip failed to render",
          }).catch(() => { /* best-effort */ });
        }
        return NextResponse.json({ success: true, data: result });
      }
      default:
        return badRequest("Unknown action");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clip action failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: { message } }, { status: 400 });
}
