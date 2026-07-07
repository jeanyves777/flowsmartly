import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * Read-only CRM extras — a lead/deal's activity timeline, outreach sequences, and
 * CRM companies — so the agent can see history + existing setup instead of asking.
 * [[lead-studio-redesign-approved]] [[agent-operates-account-full-crud]]
 */

export const getActivities: FlowAgentTool = {
  name: "get_activities",
  description:
    "READ the activity TIMELINE (notes, emails, calls, meetings, stage changes, pitch-sent) for a lead or an opportunity — so you can see what already happened before advancing a deal or following up. Pass savedLeadId or opportunityId to scope it (omit both for the account's most recent activity). Read-only.",
  input_schema: {
    type: "object",
    properties: {
      savedLeadId: { type: "string", description: "Scope to one lead's timeline." },
      opportunityId: { type: "string", description: "Scope to one deal's timeline." },
      limit: { type: "number", description: "Max entries (1-100, default 40)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 40;
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (typeof input.savedLeadId === "string" && input.savedLeadId.trim()) where.savedLeadId = input.savedLeadId.trim();
      if (typeof input.opportunityId === "string" && input.opportunityId.trim()) where.opportunityId = input.opportunityId.trim();
      const rows = await prisma.activity.findMany({
        where, orderBy: { at: "desc" }, take: limit,
        select: { id: true, type: true, subject: true, body: true, at: true, savedLeadId: true, opportunityId: true },
      });
      return {
        ok: true,
        data: {
          count: rows.length,
          activities: rows.map((a) => ({
            id: a.id, type: a.type, subject: a.subject ?? null,
            note: a.body ? a.body.slice(0, 240) : null,
            leadId: a.savedLeadId ?? null, dealId: a.opportunityId ?? null,
            at: a.at.toISOString(),
          })),
          userMessage: rows.length === 0 ? "No activity logged yet." : `${rows.length} activity entr${rows.length === 1 ? "y" : "ies"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to read activities" };
    }
  },
};

export const listSequences: FlowAgentTool = {
  name: "list_sequences",
  description:
    "READ the user's OUTREACH SEQUENCES (multi-channel lead automations: pitch → follow-ups → WhatsApp/SMS → task). Returns each sequence's id, name, status (draft/active/paused/archived), step count, the list it runs on, and how many leads are enrolled. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Optional status filter (draft | active | paused | archived)." },
      limit: { type: "number", description: "Max sequences (1-50, default 20)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(50, Math.max(1, Math.floor(input.limit))) : 20;
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (typeof input.status === "string" && input.status.trim()) where.status = input.status.trim().toLowerCase();
      const rows = await prisma.outreachSequence.findMany({
        where, orderBy: { updatedAt: "desc" }, take: limit,
        select: { id: true, name: true, status: true, listId: true, steps: true, updatedAt: true, _count: { select: { enrollments: true } } },
      });
      const stepCount = (v: string) => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a.length : 0; } catch { return 0; } };
      return {
        ok: true,
        data: {
          count: rows.length,
          sequences: rows.map((s) => ({
            id: s.id, name: s.name, status: s.status, listId: s.listId ?? null,
            steps: stepCount(s.steps), enrolled: s._count.enrollments, updatedAt: s.updatedAt.toISOString(),
          })),
          userMessage: rows.length === 0 ? "No outreach sequences yet." : `${rows.length} outreach sequence${rows.length === 1 ? "" : "s"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list sequences" };
    }
  },
};

export const listCompanies: FlowAgentTool = {
  name: "list_companies",
  description:
    "READ the CRM companies (auto-created when finding leads / enriching). Optional search by name or domain. Returns each company's id, name, domain, industry, size, revenue band, location and whether it's been enriched. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Optional — filter by company name or domain (contains)." },
      limit: { type: "number", description: "Max companies (1-100, default 40)." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, Math.floor(input.limit))) : 40;
      const search = typeof input.search === "string" ? input.search.trim() : "";
      const where: Record<string, unknown> = { userId: ctx.userId };
      if (search) where.OR = [{ name: { contains: search } }, { domain: { contains: search } }];
      const rows = await prisma.company.findMany({
        where, orderBy: { updatedAt: "desc" }, take: limit,
        select: { id: true, name: true, domain: true, industry: true, employeeSize: true, revenueBand: true, location: true, enrichedAt: true },
      });
      return {
        ok: true,
        data: {
          count: rows.length,
          companies: rows.map((c) => ({
            id: c.id, name: c.name, domain: c.domain ?? null, industry: c.industry ?? null,
            size: c.employeeSize ?? null, revenue: c.revenueBand ?? null, location: c.location ?? null,
            enriched: !!c.enrichedAt,
          })),
          userMessage: rows.length === 0 ? "No CRM companies yet." : `${rows.length} compan${rows.length === 1 ? "y" : "ies"}.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list companies" };
    }
  },
};
