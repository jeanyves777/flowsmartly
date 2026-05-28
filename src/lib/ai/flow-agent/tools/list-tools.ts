import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * Read-only list tools — campaigns + automations.
 *
 * The agent should use these BEFORE creating duplicates ("looks like you
 * already have a 'Father's Day 2026' campaign — want to update that
 * one?") and when the user asks "what do I have set up?".
 */

export const listCampaigns: FlowAgentTool = {
  name: "list_campaigns",
  description:
    "List the user's marketing campaigns (email + SMS). Read-only. Optional filters: status ('DRAFT' | 'SENT' | 'SCHEDULED' | 'SENDING' | 'CANCELED'), type ('EMAIL' | 'SMS'). Returns most recent first. Use BEFORE create_email_campaign so you can suggest editing an existing draft instead of duplicating.",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Optional status filter." },
      type: { type: "string", description: "Optional 'EMAIL' or 'SMS' filter." },
      limit: { type: "number", description: "Max rows (1-50, default 20)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit =
        typeof input.limit === "number" ? Math.min(50, Math.max(1, Math.floor(input.limit))) : 20;
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (typeof input.status === "string" && input.status.trim()) {
        where.status = input.status.trim().toUpperCase();
      }
      if (typeof input.type === "string" && input.type.trim()) {
        where.type = input.type.trim().toUpperCase();
      }

      const campaigns = await prisma.campaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          name: true,
          subject: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
          sentCount: true,
          openCount: true,
          clickCount: true,
          createdAt: true,
        },
      });

      return {
        ok: true,
        data: {
          count: campaigns.length,
          campaigns: campaigns.map((c) => ({
            id: c.id,
            type: c.type,
            name: c.name,
            subject: c.subject,
            status: c.status,
            scheduledAt: c.scheduledAt?.toISOString() ?? null,
            sentAt: c.sentAt?.toISOString() ?? null,
            stats: {
              sent: c.sentCount,
              opened: c.openCount,
              clicked: c.clickCount,
            },
            link: `/campaigns/${c.id}`,
            createdAt: c.createdAt.toISOString(),
          })),
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to list campaigns",
      };
    }
  },
};

export const listAutomations: FlowAgentTool = {
  name: "list_automations",
  description:
    "List the user's marketing automations. Read-only. Returns each automation's type (BIRTHDAY/HOLIDAY/WELCOME/RE_ENGAGEMENT/etc.), enabled state, and last-fired timestamp. Use BEFORE create_automation so you can suggest editing an existing one of the same type instead of duplicating.",
  input_schema: {
    type: "object",
    properties: {
      enabledOnly: { type: "boolean", description: "If true, only return automations that are currently enabled." },
      type: { type: "string", description: "Optional type filter (BIRTHDAY, HOLIDAY, WELCOME, etc.)." },
      limit: { type: "number", description: "Max rows (1-50, default 20)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit =
        typeof input.limit === "number" ? Math.min(50, Math.max(1, Math.floor(input.limit))) : 20;
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (input.enabledOnly === true) where.enabled = true;
      if (typeof input.type === "string" && input.type.trim()) {
        where.type = input.type.trim().toUpperCase();
      }

      const automations = await prisma.automation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
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
          totalSent: true,
          lastTriggered: true,
          createdAt: true,
        },
      });

      return {
        ok: true,
        data: {
          count: automations.length,
          automations: automations.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            enabled: a.enabled,
            channel: a.campaignType,
            subject: a.subject,
            sendTime: a.sendTime,
            daysOffset: a.daysOffset,
            timezone: a.timezone,
            totalSent: a.totalSent,
            lastTriggered: a.lastTriggered?.toISOString() ?? null,
            link: `/automations/${a.id}`,
            createdAt: a.createdAt.toISOString(),
          })),
        },
      };
    } catch (e) {
      return {
        ok: false,
        error_code: "internal",
        message: e instanceof Error ? e.message : "Failed to list automations",
      };
    }
  },
};
