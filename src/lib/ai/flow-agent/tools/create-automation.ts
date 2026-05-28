import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * create_automation — set up a trigger-based automation (birthday,
 * welcome, holiday, re-engagement, custom). Created DISABLED by default
 * so the user can review timing + content in the dashboard before
 * flipping it on. The agent's response should mention this.
 *
 * Mutating. Content/subject must be written in the user's preferred
 * language (per the language directive in the system prompt).
 */

const AUTOMATION_TYPES = new Set([
  "BIRTHDAY",
  "HOLIDAY",
  "WELCOME",
  "RE_ENGAGEMENT",
  "CUSTOM",
  "ANNIVERSARY",
  "ABANDONED_CART",
  "INACTIVITY",
]);

export const createAutomation: FlowAgentTool = {
  name: "create_automation",
  description:
    "Create a trigger-based marketing automation (birthday, welcome, holiday, re-engagement, etc.). Saved DISABLED so the user reviews timing + content + targeting in the editor before flipping it on. Write subject + content in the user's preferred language. Pass `planId` from a confirmed propose_plan. Suggest enabling it at /automations/{id} once they've reviewed.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      name: { type: "string", description: "Internal name ('Welcome series for newsletter signups')." },
      type: {
        type: "string",
        description: "BIRTHDAY | HOLIDAY | WELCOME | RE_ENGAGEMENT | CUSTOM | ANNIVERSARY | ABANDONED_CART | INACTIVITY.",
      },
      campaignType: { type: "string", description: "'EMAIL' or 'SMS'. SMS requires A2P registration." },
      subject: { type: "string", description: "Email subject (omit for SMS). Required for EMAIL type." },
      content: { type: "string", description: "Message body. For SMS keep it under 160 chars. In the user's preferred language." },
      sendTime: { type: "string", description: "Time of day to fire, HH:mm (24h). Default '09:00'." },
      daysOffset: { type: "number", description: "Day offset from trigger event: -1 = day before, 0 = same day, 1 = day after. Default 0." },
      timezone: { type: "string", description: "IANA timezone for sendTime (e.g. 'America/New_York'). Default 'UTC' — usually pass the user's tz from the system prompt." },
      contactListId: { type: "string", description: "Optional — limit to a specific ContactList. Omit = all contacts." },
      holidayId: { type: "string", description: "REQUIRED when type=HOLIDAY — the holiday id from the holiday catalog." },
    },
    required: ["planId", "name", "type", "campaignType", "content"],
  },
  plans: null,
  costKey: "AGENT_CREATE_AUTOMATION",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      const type = typeof input.type === "string" ? input.type.trim().toUpperCase() : "";
      const campaignType = typeof input.campaignType === "string" ? input.campaignType.trim().toUpperCase() : "";
      const content = typeof input.content === "string" ? input.content.trim() : "";

      if (!name || !type || !campaignType || !content) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "name, type, campaignType, and content are required.",
        };
      }
      if (!AUTOMATION_TYPES.has(type)) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `Unknown automation type "${type}". Valid: ${Array.from(AUTOMATION_TYPES).join(", ")}.`,
        };
      }
      if (campaignType !== "EMAIL" && campaignType !== "SMS") {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `campaignType must be 'EMAIL' or 'SMS', got "${campaignType}".`,
        };
      }
      const subject = typeof input.subject === "string" ? input.subject.trim() : null;
      if (campaignType === "EMAIL" && !subject) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "subject is required for EMAIL campaigns. Ask the user.",
        };
      }
      if (campaignType === "SMS" && content.length > 320) {
        return {
          ok: false,
          error_code: "validation_failed",
          message: `SMS content is ${content.length} chars — try to keep under 160 (or 320 for two segments).`,
        };
      }

      const sendTime = typeof input.sendTime === "string" && /^\d{1,2}:\d{2}$/.test(input.sendTime) ? input.sendTime : "09:00";
      const daysOffset = typeof input.daysOffset === "number" ? Math.max(-30, Math.min(30, Math.round(input.daysOffset))) : 0;
      const timezone = typeof input.timezone === "string" && input.timezone.trim() ? input.timezone.trim() : "UTC";

      const contactListId =
        typeof input.contactListId === "string" && input.contactListId.trim() ? input.contactListId.trim() : null;
      if (contactListId) {
        const list = await prisma.contactList.findFirst({
          where: { id: contactListId, userId: ctx.userId },
          select: { id: true },
        });
        if (!list) {
          return {
            ok: false,
            error_code: "not_found",
            message: `No contact list with id "${contactListId}".`,
          };
        }
      }

      // Build the trigger payload — for HOLIDAY type we need a holidayId.
      const trigger: Record<string, unknown> = {};
      if (type === "HOLIDAY") {
        const holidayId = typeof input.holidayId === "string" ? input.holidayId.trim() : "";
        if (!holidayId) {
          return {
            ok: false,
            error_code: "missing_input",
            message: "holidayId is required when type=HOLIDAY. Ask which holiday (or list them from /automations).",
          };
        }
        trigger.holidayId = holidayId;
      }

      const automation = await prisma.automation.create({
        data: {
          userId: ctx.userId,
          name,
          type,
          trigger: JSON.stringify(trigger),
          enabled: false,
          campaignType,
          subject,
          content,
          sendTime,
          daysOffset,
          timezone,
          contactListId,
        },
        select: { id: true, name: true, type: true, enabled: true },
      });

      return {
        ok: true,
        data: {
          automationId: automation.id,
          name: automation.name,
          type: automation.type,
          enabled: automation.enabled,
          link: `/automations/${automation.id}`,
          summary: `Created automation "${automation.name}" (${automation.type}, ${campaignType}). It's DISABLED — the user reviews + enables at /automations/${automation.id}.`,
        },
        resultRefType: "Automation",
        resultRefId: automation.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to create automation",
      };
    }
  },
};
