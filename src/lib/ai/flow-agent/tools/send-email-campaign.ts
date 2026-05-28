import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * send_email_campaign — flip a DRAFT (or SCHEDULED-for-later) email
 * campaign into the send queue. Two modes:
 *  - sendNow: true → status SENDING, sentAt = now. The existing campaign
 *    cron picks it up on the next tick (and the user can also hit Send
 *    in the UI for instant send).
 *  - scheduledAt set → status SCHEDULED, scheduledAt = that ISO time.
 *
 * Always requires a confirmed propose_plan first because sending blasts
 * the recipient list — a high-blast-radius action.
 *
 * Important: this tool does NOT actually run the send. It just flips
 * the status; the existing cron / send-now button still owns the
 * delivery side. The agent's response should say "queued for delivery"
 * and reference the campaign page.
 */
export const sendEmailCampaign: FlowAgentTool = {
  name: "send_email_campaign",
  description:
    "Queue an existing draft email campaign to send — either immediately (`sendNow=true`) or at a future ISO datetime (`scheduledAt`). The user MUST have already reviewed the campaign in /campaigns/{id}; the agent's job here is to flip the status, not to compose content. Pass `planId` from a confirmed propose_plan. Returns the campaign id + the new status. Use list_campaigns first to confirm the right campaign is the one being queued.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      campaignId: { type: "string", description: "Id of the campaign to send. Use list_campaigns to find it." },
      sendNow: { type: "boolean", description: "Set true to queue for immediate send. Omit and set scheduledAt for a future send." },
      scheduledAt: { type: "string", description: "ISO datetime for a future send. Required when sendNow is omitted/false." },
    },
    required: ["planId", "campaignId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const campaignId = typeof input.campaignId === "string" ? input.campaignId.trim() : "";
      if (!campaignId) {
        return { ok: false, error_code: "missing_input", message: "campaignId is required." };
      }
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, userId: true, status: true, type: true, name: true },
      });
      if (!campaign || campaign.userId !== ctx.userId) {
        return {
          ok: false,
          error_code: "not_found",
          message: `Campaign ${campaignId} not found in this account.`,
        };
      }
      if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `Campaign "${campaign.name}" is in status ${campaign.status} — only DRAFT or SCHEDULED campaigns can be (re-)queued.`,
        };
      }

      const sendNow = input.sendNow === true;
      let scheduledAt: Date | null = null;
      if (!sendNow) {
        if (typeof input.scheduledAt !== "string" || !input.scheduledAt.trim()) {
          return {
            ok: false,
            error_code: "missing_input",
            message: "Either sendNow=true or a future scheduledAt is required.",
          };
        }
        scheduledAt = new Date(input.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime())) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: `Invalid scheduledAt — "${input.scheduledAt}" is not a valid ISO datetime.`,
          };
        }
        if (scheduledAt.getTime() <= Date.now()) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: "scheduledAt must be in the future. Use sendNow=true for immediate send.",
          };
        }
      }

      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: sendNow
          ? { status: "SENDING", scheduledAt: null }
          : { status: "SCHEDULED", scheduledAt },
        select: { id: true, status: true, scheduledAt: true, name: true },
      });

      return {
        ok: true,
        data: {
          campaignId: updated.id,
          status: updated.status,
          scheduledAt: updated.scheduledAt?.toISOString() ?? null,
          link: `/campaigns/${updated.id}`,
          summary: sendNow
            ? `Queued "${updated.name}" for immediate send. The cron picks it up on the next tick.`
            : `Scheduled "${updated.name}" for ${updated.scheduledAt?.toISOString()}.`,
        },
        resultRefType: "Campaign",
        resultRefId: updated.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to queue campaign",
      };
    }
  },
};
