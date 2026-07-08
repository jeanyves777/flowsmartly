import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";
import { leadsListView } from "@/lib/agent-views/templates";

/**
 * list_leads — READ the user's saved leads (the Lead Studio Contacts/lists), so
 * the agent can answer "how many leads need enrichment in the Pittsfield list?"
 * itself instead of asking the user to count. Resolves a list by NAME or id,
 * reports exact enriched / un-enriched / deep counts, and returns each lead's id
 * + what contact info is MISSING — everything needed to propose_plan and then
 * enrich_lead / deep_enrich_lead the right rows. Read-only. [[agent-operates-account-full-crud]]
 */
export const listLeads: FlowAgentTool = {
  name: "list_leads",
  description:
    "READ the user's saved leads (Lead Studio). Use this BEFORE enriching so you know the EXACT number of un-enriched leads and their ids — never ask the user to count. Pass listName (the list/folder as the user says it, e.g. 'Pittsfield Home Services Owners') or listId to scope to one list; omit both to see all lists. Filter with status: 'unenriched' (no contact info yet — the enrich targets), 'enriched', 'deep' (deep-enriched), or 'all'. Returns: the resolved list, exact counts (total / enriched / unenriched / deep), the user's available lists, and a sample of leads each with id, name, company and a `missing` array (email/phone/website/address). Then propose_plan the enrichment for the unenriched count and call enrich_lead (or deep_enrich_lead) per lead id. Read-only.",
  input_schema: {
    type: "object",
    properties: {
      listName: { type: "string", description: "The list/folder name as the user refers to it (fuzzy-matched). Omit to search all lists." },
      listId: { type: "string", description: "Exact SavedLeadList id, if you already have it (takes precedence over listName)." },
      status: { type: "string", enum: ["all", "unenriched", "enriched", "deep"], description: "Filter the returned leads. Default 'all'. Use 'unenriched' to get exactly the leads that still need enrich_lead." },
      limit: { type: "number", description: "Max lead rows to return (1-200, default 60). Counts are always exact regardless of this." },
      asView: { type: "boolean", description: "Set TRUE to show a pickable leads table in the chat when the user actually asked to SEE/browse their leads. Default (omitted/false) stays text-only — the common path here is internal (counting / resolving ids before enrich_lead), which should NOT pop a table." },
    },
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: false,
  handler: async (input, ctx) => {
    try {
      const limit = typeof input.limit === "number" ? Math.min(200, Math.max(1, Math.floor(input.limit))) : 60;

      // Always surface the user's lists (for resolution + context).
      const lists = await prisma.savedLeadList.findMany({
        where: { userId: ctx.userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, category: true, _count: { select: { leads: true } } },
      });

      // Resolve the requested list: exact id first, else a fuzzy name match.
      const listId = typeof input.listId === "string" ? input.listId.trim() : "";
      const listName = typeof input.listName === "string" ? input.listName.trim() : "";
      let resolved = listId ? lists.find((l) => l.id === listId) ?? null : null;
      if (!resolved && listName) {
        const lc = listName.toLowerCase();
        resolved =
          lists.find((l) => l.name.toLowerCase() === lc) ||
          lists.find((l) => l.name.toLowerCase().includes(lc)) ||
          lists.find((l) => lc.includes(l.name.toLowerCase())) ||
          null;
      }
      // Asked for a specific list but couldn't match it → tell the agent, list the options.
      if ((listId || listName) && !resolved) {
        return {
          ok: true,
          data: {
            resolvedList: null,
            note: `No saved list matched ${listId ? `id "${listId}"` : `"${listName}"`}. Pick one of the available lists (by name) and try again, or omit listName to search all leads.`,
            lists: lists.map((l) => ({ id: l.id, name: l.name, leadCount: l._count.leads })),
          },
        };
      }

      const scope = { userId: ctx.userId, ...(resolved ? { listId: resolved.id } : {}) } as const;
      const statusWhere =
        input.status === "unenriched" ? { enrichedAt: null }
        : input.status === "enriched" ? { enrichedAt: { not: null } }
        : input.status === "deep" ? { deepEnrichedAt: { not: null } }
        : {};

      const [total, enriched, deep, rows] = await Promise.all([
        prisma.savedLead.count({ where: scope }),
        prisma.savedLead.count({ where: { ...scope, enrichedAt: { not: null } } }),
        prisma.savedLead.count({ where: { ...scope, deepEnrichedAt: { not: null } } }),
        prisma.savedLead.findMany({
          where: { ...scope, ...statusWhere },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true, name: true, category: true, title: true,
            email: true, phone: true, phones: true, website: true, address: true,
            enrichedAt: true, deepEnrichedAt: true, list: { select: { name: true } },
          },
        }),
      ]);
      const unenriched = total - enriched;
      const counts = { total, enriched, unenriched, deep };

      const hasExtraPhone = (v: string | null) => { try { const a = JSON.parse(v || "[]"); return Array.isArray(a) && a.length > 0; } catch { return false; } };
      const leads = rows.map((l) => {
        const missing: string[] = [];
        if (!l.email) missing.push("email");
        if (!l.phone && !hasExtraPhone(l.phones)) missing.push("phone");
        if (!l.website) missing.push("website");
        if (!l.address || !/\d/.test(l.address)) missing.push("address"); // no street number ≈ partial
        return {
          id: l.id,
          name: l.name,
          company: l.category ?? null,
          title: l.title ?? null,
          list: l.list?.name ?? null,
          enriched: !!l.enrichedAt,
          deep: !!l.deepEnrichedAt,
          missing,
        };
      });

      // Show a pickable leads table ONLY when the agent wants to present them
      // (asView true) — the common internal path (counting before enrich) passes
      // asView:false and stays text-only.
      const shown = input.asView === true && leads.length > 0;
      if (shown) ctx.emit({ type: "agent_view", requestId: randomUUID(), spec: leadsListView(leads, counts, resolved?.name) });
      return {
        ok: true,
        data: {
          resolvedList: resolved ? { id: resolved.id, name: resolved.name } : null,
          scope: resolved ? "list" : "all_leads",
          counts,
          returned: leads.length,
          leads,
          lists: lists.map((l) => ({ id: l.id, name: l.name, leadCount: l._count.leads })),
          userMessage:
            total === 0
              ? (resolved ? `The "${resolved.name}" list has no saved leads yet.` : "No saved leads yet — use find_leads / find_local_leads first.")
              : `${resolved ? `"${resolved.name}": ` : ""}${total} lead${total === 1 ? "" : "s"}, ${unenriched} still un-enriched.${shown ? " A pickable leads table is ALREADY shown in the chat — don't re-list them as text." : ""} To enrich them, propose_plan (2× AI_WEB_SEARCH per lead), then call enrich_lead for each un-enriched lead id.`,
        },
      };
    } catch (e) {
      return { ok: false, error_code: "internal", message: e instanceof Error ? e.message : "Failed to list leads" };
    }
  },
};
