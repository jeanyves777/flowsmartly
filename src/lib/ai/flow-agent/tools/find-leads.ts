import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * find_leads — persist the decision-makers / companies the agent found (via its
 * own web search + reasoning) into the Lead studio. This is the "AI + web-search
 * finding" path: the AGENT does the finding, this tool saves the results as
 * person-level SavedLead rows (contact info stays empty until enrich_lead reveals
 * it) grouped under a lead list, and refreshes the Lead studio.
 */
export const findLeads: FlowAgentTool = {
  name: "find_leads",
  description:
    "Save the real decision-makers / companies you found (from web search) into the user's Lead studio as a working list. Use AFTER you've researched real, plausible companies + people matching the user's criteria (industry, size, seniority, titles, location). Each lead is a person (name + title + company). Do NOT invent contact emails/phones here — leave them out; the user reveals them later with enrich_lead (which costs credits). Pass `leads` (the people you found) and either `listName` (creates a new list) or `listId`. Finding is free; enrichment is billed per lead.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — the planId from a confirmed propose_plan (reuse the same plan you used for the search)." },
      listName: { type: "string", description: "Name for a NEW list to hold these leads (e.g. 'TX SaaS CFOs'). Omit if using listId." },
      listId: { type: "string", description: "Existing lead list id to append to. Omit to create a new list via listName." },
      mode: { type: "string", description: "'contacts' (people, default) or 'companies'." },
      leads: {
        type: "array",
        description: "The real leads you found. Each: { name (person), title, company, domain?, location?, seniority?, department?, industry? }.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            title: { type: "string" },
            company: { type: "string" },
            domain: { type: "string" },
            location: { type: "string" },
            seniority: { type: "string" },
            department: { type: "string" },
            industry: { type: "string" },
          },
          required: ["name", "company"],
        },
      },
    },
    required: ["planId", "leads"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    const raw = Array.isArray(input.leads) ? input.leads : [];
    const leads = raw
      .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
      .map((l) => ({
        name: String(l.name || "").trim(),
        title: typeof l.title === "string" ? l.title.trim() : null,
        company: String(l.company || "").trim(),
        domain: typeof l.domain === "string" ? l.domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null,
        location: typeof l.location === "string" ? l.location.trim() : null,
        seniority: typeof l.seniority === "string" ? l.seniority.trim() : null,
        department: typeof l.department === "string" ? l.department.trim() : null,
        industry: typeof l.industry === "string" ? l.industry.trim() : null,
      }))
      .filter((l) => l.name && l.company)
      .slice(0, 50);

    if (leads.length === 0) {
      return { ok: false, error_code: "missing_input", message: "leads must contain at least one { name, company }." };
    }

    // Resolve or create the target list.
    let listId = typeof input.listId === "string" ? input.listId : null;
    if (listId) {
      const owned = await prisma.savedLeadList.findFirst({ where: { id: listId, userId: ctx.userId }, select: { id: true } });
      if (!owned) listId = null;
    }
    if (!listId) {
      const name = (typeof input.listName === "string" && input.listName.trim()) || "Found leads";
      const list = await prisma.savedLeadList.create({ data: { userId: ctx.userId, name: name.slice(0, 120) }, select: { id: true } });
      listId = list.id;
    }

    // Upsert companies (dedup by domain, else name) then create the person leads.
    const created: { id: string; name: string; title: string | null; company: string }[] = [];
    for (const l of leads) {
      let company = null as { id: string } | null;
      if (l.domain) company = await prisma.company.findFirst({ where: { userId: ctx.userId, domain: l.domain }, select: { id: true } });
      if (!company) company = await prisma.company.findFirst({ where: { userId: ctx.userId, name: l.company }, select: { id: true } });
      if (!company) {
        company = await prisma.company.create({
          data: { userId: ctx.userId, name: l.company.slice(0, 160), domain: l.domain, industry: l.industry, location: l.location },
          select: { id: true },
        });
      }
      const lead = await prisma.savedLead.create({
        data: {
          userId: ctx.userId,
          listId,
          name: l.name.slice(0, 160),
          title: l.title,
          seniority: l.seniority,
          department: l.department,
          category: l.company.slice(0, 120),
          companyId: company.id,
          status: "NEW",
        },
        select: { id: true, name: true, title: true, category: true },
      });
      created.push({ id: lead.id, name: lead.name, title: lead.title, company: lead.category ?? l.company });
    }

    await prisma.savedLeadList.update({
      where: { id: listId },
      data: { leadCount: await prisma.savedLead.count({ where: { listId } }) },
    }).catch(() => {});

    // Nudge the Lead studio to refresh if it's open.
    ctx.emit({ type: "canvas_update", patch: { __leads: { refresh: true, listId } } });

    return {
      ok: true,
      data: {
        listId,
        count: created.length,
        leads: created,
        userMessage: `Saved ${created.length} lead${created.length === 1 ? "" : "s"} to the list. Tell the user they can reveal each lead's email/phone with "enrich" (billed per lead) or start outreach.`,
      },
      resultRefType: "SavedLeadList",
      resultRefId: listId,
    };
  },
};
