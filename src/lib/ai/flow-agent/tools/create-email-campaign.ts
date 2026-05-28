import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * create_email_campaign — draft an email campaign (subject + body +
 * recipient list). Always creates as DRAFT — sending stays a separate
 * explicit step at /campaigns/{id} so the user has a chance to review.
 * The agent should call this, then point the user to the campaigns page
 * to hit Send when they're ready.
 *
 * Mutating. The agent is expected to write the subject and body content
 * in the user's preferred language (system prompt's languageDirective
 * enforces this).
 */
export const createEmailCampaign: FlowAgentTool = {
  name: "create_email_campaign",
  description:
    "Create a draft email campaign with subject + body, optionally targeting a specific contact list. Always saved as DRAFT — the user reviews and hits Send at /campaigns/{id}. Write subject + content in the user's preferred language (per the language directive in the system prompt). Use list_contacts first to check the audience size and pick a sensible contactListId. Pass `planId` from a confirmed propose_plan.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      name: { type: "string", description: "Internal campaign name ('Father's Day 2026 promo'). Shows in the user's dashboard list." },
      subject: { type: "string", description: "Email subject line. Should be punchy + in the user's language." },
      preheaderText: { type: "string", description: "Optional preheader (the gray preview text after the subject in most clients)." },
      content: { type: "string", description: "Plain-text body. Required. The HTML version is auto-generated from this if contentHtml is omitted." },
      contentHtml: { type: "string", description: "Optional rich HTML body. If you provide this, also provide a plain-text fallback in `content`." },
      contactListId: { type: "string", description: "Optional — id of a ContactList to target. Omit to leave recipient targeting for the user to set in the editor." },
      scheduledAt: { type: "string", description: "Optional ISO datetime — if set, the campaign is queued to send at that time once the user confirms in the editor." },
    },
    required: ["planId", "name", "subject", "content"],
  },
  plans: null,
  costKey: "AGENT_CREATE_CAMPAIGN",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      const subject = typeof input.subject === "string" ? input.subject.trim() : "";
      const content = typeof input.content === "string" ? input.content.trim() : "";
      if (!name || !subject || !content) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "name, subject, and content are required.",
        };
      }
      const contactListId =
        typeof input.contactListId === "string" && input.contactListId.trim()
          ? input.contactListId.trim()
          : null;
      if (contactListId) {
        const list = await prisma.contactList.findFirst({
          where: { id: contactListId, userId: ctx.userId },
          select: { id: true },
        });
        if (!list) {
          return {
            ok: false,
            error_code: "not_found",
            message: `No contact list found with id "${contactListId}". Call list_contacts or omit contactListId and let the user pick in the editor.`,
          };
        }
      }

      let scheduledAt: Date | null = null;
      if (typeof input.scheduledAt === "string" && input.scheduledAt.trim()) {
        const d = new Date(input.scheduledAt);
        if (Number.isNaN(d.getTime())) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: `Invalid scheduledAt — "${input.scheduledAt}" is not a valid ISO datetime.`,
          };
        }
        if (d.getTime() <= Date.now()) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: "scheduledAt must be in the future.",
          };
        }
        scheduledAt = d;
      }

      const contentHtml =
        typeof input.contentHtml === "string" && input.contentHtml.trim()
          ? input.contentHtml
          : null;
      const preheaderText =
        typeof input.preheaderText === "string" && input.preheaderText.trim()
          ? input.preheaderText.trim()
          : null;

      const campaign = await prisma.campaign.create({
        data: {
          userId: ctx.userId,
          type: "EMAIL",
          name,
          subject,
          preheaderText,
          content,
          contentHtml,
          contactListId,
          status: "DRAFT",
          scheduledAt,
        },
        select: { id: true, name: true, status: true, scheduledAt: true },
      });

      return {
        ok: true,
        data: {
          campaignId: campaign.id,
          status: campaign.status,
          scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
          link: `/campaigns/${campaign.id}`,
          summary: `Created draft email campaign "${campaign.name}". The user reviews and sends from ${`/campaigns/${campaign.id}`}.`,
        },
        resultRefType: "Campaign",
        resultRefId: campaign.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to create campaign",
      };
    }
  },
};
