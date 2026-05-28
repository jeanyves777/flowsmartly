import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/core";
import type { FlowAgentTool } from "../registry";

/**
 * send_test_email_campaign — fire a one-off test of an email campaign
 * to a single address (default: the user's own email). No CampaignSend
 * row, no recipient-list scan — just a single rendered preview so the
 * user can check formatting + merge tags before queuing the real send.
 *
 * Mutating because it actually sends an email, but cheap + low blast.
 * Requires confirmed propose_plan only so the user explicitly approves
 * sending mail.
 */
export const sendTestEmailCampaign: FlowAgentTool = {
  name: "send_test_email_campaign",
  description:
    "Send a single test copy of an email campaign to one address (defaults to the user's own email) so they can preview formatting + content before queuing the real send. Doesn't touch CampaignSend stats or the recipient list. Pass `planId` from a confirmed propose_plan and `campaignId`. Optionally pass `toEmail` to override the recipient (e.g. send a preview to a teammate).",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      campaignId: { type: "string", description: "Id of the campaign to test." },
      toEmail: { type: "string", description: "Optional override recipient. Defaults to the user's account email." },
    },
    required: ["planId", "campaignId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const campaignId = typeof input.campaignId === "string" ? input.campaignId : "";
      if (!campaignId) {
        return { ok: false, error_code: "missing_input", message: "campaignId is required." };
      }
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          userId: true,
          type: true,
          name: true,
          subject: true,
          content: true,
          contentHtml: true,
        },
      });
      if (!campaign || campaign.userId !== ctx.userId) {
        return { ok: false, error_code: "not_found", message: `No campaign ${campaignId} in this account.` };
      }
      if (campaign.type !== "EMAIL") {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `Campaign type is ${campaign.type}; this tool only sends EMAIL test previews.`,
        };
      }

      let toEmail = typeof input.toEmail === "string" ? input.toEmail.trim() : "";
      if (!toEmail) {
        const user = await prisma.user.findUnique({
          where: { id: ctx.userId },
          select: { email: true },
        });
        toEmail = user?.email ?? "";
      }
      if (!toEmail || !toEmail.includes("@")) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "Couldn't determine a recipient — user has no email on file and toEmail was omitted.",
        };
      }

      const subject = `[TEST] ${campaign.subject ?? campaign.name}`;
      const html =
        campaign.contentHtml ??
        `<div style="font-family:system-ui,sans-serif;line-height:1.6"><p style="background:#fff3cd;padding:8px;border-radius:6px;font-size:12px"><strong>TEST PREVIEW</strong> — this is a preview of the campaign "${escapeHtml(campaign.name)}", not the real send.</p>${escapeHtml(campaign.content).replace(/\n/g, "<br>")}</div>`;

      const result = await sendEmail({
        to: toEmail,
        subject,
        html,
        text: campaign.content,
      });

      if (!result.success) {
        return {
          ok: false,
          error_code: "upstream_failed",
          message: `Email send failed: ${result.error ?? "unknown"}`,
        };
      }

      return {
        ok: true,
        data: {
          campaignId,
          toEmail,
          messageId: result.messageId,
          summary: `Sent test of "${campaign.name}" to ${toEmail}.`,
        },
        resultRefType: "Campaign",
        resultRefId: campaignId,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to send test",
      };
    }
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
