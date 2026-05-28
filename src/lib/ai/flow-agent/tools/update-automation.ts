import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * update_automation — partial edit of an existing Automation. Common
 * uses: flip enabled on/off, tweak subject/content/sendTime, change
 * timezone, switch the contact list.
 *
 * Mutating. Returns the new state so the agent can confirm to the user.
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

export const updateAutomation: FlowAgentTool = {
  name: "update_automation",
  description:
    "Edit an existing automation: toggle `enabled` on/off, change subject/content/sendTime/daysOffset/timezone, swap the contactListId. Pass only the fields you want to change — others are left alone. Use list_automations to find the id. Content/subject must be in the user's preferred language. Pass `planId` from a confirmed propose_plan.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan." },
      automationId: { type: "string", description: "Id of the automation to edit." },
      enabled: { type: "boolean", description: "Flip the automation on/off." },
      name: { type: "string", description: "Optional new internal name." },
      subject: { type: "string", description: "New email subject (EMAIL only)." },
      content: { type: "string", description: "New message body. In user's preferred language." },
      sendTime: { type: "string", description: "New time of day HH:mm (24h)." },
      daysOffset: { type: "number", description: "New offset from trigger event (-30..30)." },
      timezone: { type: "string", description: "New IANA timezone (e.g. 'America/New_York')." },
      contactListId: { type: "string", description: "New ContactList id, or empty string '' to remove the list filter (all contacts)." },
      type: { type: "string", description: "Rare — change the trigger type (BIRTHDAY/HOLIDAY/WELCOME/...). Only do this if the user explicitly asks." },
    },
    required: ["planId", "automationId"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    try {
      const automationId = typeof input.automationId === "string" ? input.automationId : "";
      if (!automationId) {
        return { ok: false, error_code: "missing_input", message: "automationId is required." };
      }
      const automation = await prisma.automation.findUnique({
        where: { id: automationId },
        select: { id: true, userId: true, campaignType: true, name: true },
      });
      if (!automation || automation.userId !== ctx.userId) {
        return { ok: false, error_code: "not_found", message: `No automation with id ${automationId} in this account.` };
      }

      const data: Record<string, unknown> = {};
      if (typeof input.enabled === "boolean") data.enabled = input.enabled;
      if (typeof input.name === "string" && input.name.trim()) data.name = input.name.trim();
      if (typeof input.subject === "string") {
        const s = input.subject.trim();
        data.subject = s.length > 0 ? s : null;
      }
      if (typeof input.content === "string" && input.content.trim()) {
        const content = input.content.trim();
        if (automation.campaignType === "SMS" && content.length > 320) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: `SMS content is ${content.length} chars — keep under 160 (or 320 for two segments).`,
          };
        }
        data.content = content;
      }
      if (typeof input.sendTime === "string" && /^\d{1,2}:\d{2}$/.test(input.sendTime)) {
        data.sendTime = input.sendTime;
      }
      if (typeof input.daysOffset === "number") {
        data.daysOffset = Math.max(-30, Math.min(30, Math.round(input.daysOffset)));
      }
      if (typeof input.timezone === "string" && input.timezone.trim()) {
        data.timezone = input.timezone.trim();
      }
      if (typeof input.contactListId === "string") {
        const id = input.contactListId.trim();
        if (id === "") {
          data.contactListId = null;
        } else {
          const list = await prisma.contactList.findFirst({
            where: { id, userId: ctx.userId },
            select: { id: true },
          });
          if (!list) {
            return {
              ok: false,
              error_code: "not_found",
              message: `No contact list with id "${id}".`,
            };
          }
          data.contactListId = id;
        }
      }
      if (typeof input.type === "string" && input.type.trim()) {
        const type = input.type.trim().toUpperCase();
        if (!AUTOMATION_TYPES.has(type)) {
          return {
            ok: false,
            error_code: "validation_failed",
            message: `Unknown automation type "${type}". Valid: ${Array.from(AUTOMATION_TYPES).join(", ")}.`,
          };
        }
        data.type = type;
      }

      if (Object.keys(data).length === 0) {
        return {
          ok: false,
          error_code: "missing_input",
          message: "Nothing to update — pass at least one field.",
        };
      }

      const updated = await prisma.automation.update({
        where: { id: automation.id },
        data,
        select: {
          id: true,
          name: true,
          type: true,
          enabled: true,
          campaignType: true,
          subject: true,
          sendTime: true,
          daysOffset: true,
          timezone: true,
          contactListId: true,
        },
      });

      return {
        ok: true,
        data: {
          automationId: updated.id,
          name: updated.name,
          type: updated.type,
          enabled: updated.enabled,
          channel: updated.campaignType,
          subject: updated.subject,
          sendTime: updated.sendTime,
          daysOffset: updated.daysOffset,
          timezone: updated.timezone,
          contactListId: updated.contactListId,
          link: `/automations/${updated.id}`,
          summary: `Updated "${updated.name}" — currently ${updated.enabled ? "ENABLED" : "DISABLED"}.`,
        },
        resultRefType: "Automation",
        resultRefId: updated.id,
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to update automation",
      };
    }
  },
};
