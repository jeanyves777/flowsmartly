import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * create_sms_campaign — draft an SMS (or MMS) blast to the user's subscribers.
 * Always saved as DRAFT; sending stays a separate explicit step in the SMS
 * studio (Grow → SMS) so the user reviews the audience + cost first.
 *
 * Runs on Telnyx. US long-code sending is gated on A2P 10DLC approval, so the
 * result reports the number + registration readiness honestly rather than
 * implying the blast is ready to fire.
 *
 * Mutating. The agent writes the body in the user's preferred language (per the
 * language directive in the system prompt) and should keep it short — every
 * ~160 characters is a billed segment — and include a "Reply STOP to opt out".
 */
export const createSmsCampaign: FlowAgentTool = {
  name: "create_sms_campaign",
  description:
    "Create a draft SMS/MMS blast (Telnyx) for the user's opted-in subscribers, optionally targeting a contact list or attaching one image (MMS). Always saved as DRAFT — the user reviews recipients + cost and hits Send in the SMS studio. Keep the body short (each ~160 chars is a billed segment) and end with 'Reply STOP to opt out'. Write in the user's language. Use list_contacts first to size the audience and pick a contactListId. The result reports whether the user's SMS number + A2P 10DLC registration are ready — relay that honestly. Pass `planId` from a confirmed propose_plan.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      name: { type: "string", description: "Internal blast name ('July flash sale'). Shows in the SMS studio list." },
      content: {
        type: "string",
        description:
          "The SMS body. Required. Keep it concise; each ~160 chars is a billed segment. End with 'Reply STOP to opt out'. Merge tags like {{firstName}} are supported.",
      },
      imageUrl: { type: "string", description: "Optional image URL — makes it an MMS (costs more per message)." },
      contactListId: {
        type: "string",
        description: "Optional — id of a ContactList to target. Omit to let the user pick recipients in the studio.",
      },
      scheduledAt: {
        type: "string",
        description: "Optional ISO datetime — queues the blast to send then, once the user confirms in the studio.",
      },
    },
    required: ["planId", "name", "content"],
  },
  plans: null,
  costKey: "AGENT_CREATE_CAMPAIGN",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      const content = typeof input.content === "string" ? input.content.trim() : "";
      if (!name || !content) {
        return { ok: false, error_code: "missing_input", message: "name and content are required." };
      }

      const imageUrl =
        typeof input.imageUrl === "string" && input.imageUrl.trim() ? input.imageUrl.trim() : null;

      const contactListId =
        typeof input.contactListId === "string" && input.contactListId.trim() ? input.contactListId.trim() : null;
      let audienceSize: number | null = null;
      if (contactListId) {
        const list = await prisma.contactList.findFirst({
          where: { id: contactListId, userId: ctx.userId },
          select: { id: true },
        });
        if (!list) {
          return {
            ok: false,
            error_code: "not_found",
            message: `No contact list found with id "${contactListId}". Call list_contacts or omit contactListId and let the user pick in the studio.`,
          };
        }
        audienceSize = await prisma.contact.count({
          where: { userId: ctx.userId, lists: { some: { contactListId } }, smsOptedIn: true, phone: { not: null } },
        }).catch(() => null);
      }

      let scheduledAt: Date | null = null;
      if (typeof input.scheduledAt === "string" && input.scheduledAt.trim()) {
        const d = new Date(input.scheduledAt);
        if (Number.isNaN(d.getTime())) {
          return { ok: false, error_code: "validation_failed", message: `Invalid scheduledAt — "${input.scheduledAt}" is not a valid ISO datetime.` };
        }
        if (d.getTime() <= Date.now()) {
          return { ok: false, error_code: "validation_failed", message: "scheduledAt must be in the future." };
        }
        scheduledAt = d;
      }

      // Read the user's SMS line + carrier-registration readiness for an honest result.
      const cfg = await prisma.marketingConfig.findUnique({
        where: { userId: ctx.userId },
        select: {
          smsEnabled: true,
          smsPhoneNumber: true,
          smsA2pBrandStatus: true,
          smsA2pCampaignStatus: true,
          smsTollfreeVerifyStatus: true,
        },
      });

      const hasNumber = !!(cfg?.smsEnabled && cfg?.smsPhoneNumber);
      const isTollFree = !!cfg?.smsPhoneNumber && /^\+1(800|833|844|855|866|877|888)/.test(cfg.smsPhoneNumber);
      const a2pReady =
        cfg?.smsA2pBrandStatus === "APPROVED" &&
        (cfg?.smsA2pCampaignStatus === "VERIFIED" || cfg?.smsA2pCampaignStatus === "SUCCESSFUL");
      const tollfreeReady = cfg?.smsTollfreeVerifyStatus === "APPROVED" || cfg?.smsTollfreeVerifyStatus === "TWILIO_APPROVED";
      const registrationReady = isTollFree ? tollfreeReady : a2pReady;

      let readiness: string;
      if (!hasNumber) {
        readiness = "No SMS number yet — rent one in the SMS studio (Grow → SMS) before this can send.";
      } else if (!registrationReady) {
        readiness = isTollFree
          ? "Your toll-free number's verification is still pending — carriers may filter sends until it's approved (usually a few days)."
          : "Your number's A2P 10DLC carrier registration is still pending — US carriers may filter sends until it's approved (usually a few days).";
      } else {
        readiness = "Your SMS line is live — review recipients and hit Send.";
      }

      const segments = Math.max(1, Math.ceil(content.length / 160));
      const campaign = await prisma.campaign.create({
        data: {
          userId: ctx.userId,
          type: "SMS",
          name,
          content,
          imageUrl,
          imageSource: imageUrl ? "ai" : null,
          contactListId,
          status: "DRAFT",
          scheduledAt,
        },
        select: { id: true, name: true, status: true, scheduledAt: true },
      });

      const audienceNote =
        audienceSize != null ? ` Audience: ${audienceSize} opted-in subscriber${audienceSize === 1 ? "" : "s"}.` : "";
      const mmsNote = imageUrl ? " Sent as an MMS (image attached)." : "";
      const segNote = segments > 1 ? ` ~${segments} segments/message.` : "";

      return {
        ok: true,
        data: {
          campaignId: campaign.id,
          status: campaign.status,
          scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
          audienceSize,
          segments,
          registrationReady,
          hasNumber,
          link: "/home",
          summary: `Drafted SMS blast "${campaign.name}".${audienceNote}${mmsNote}${segNote} ${readiness}`,
        },
        resultRefType: "Campaign",
        resultRefId: campaign.id,
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to create SMS blast" };
    }
  },
};
