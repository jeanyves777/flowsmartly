import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/** lowercase, strip accents/punctuation → single-spaced tokens, for loose matching. */
function norm(v: string): string {
  return v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Generic roles/titles (normalized form) some searches hand back in place of a
 * real person. Saving one as a lead's `name` fabricates a contact that doesn't
 * exist ("Owner/Manager") — we demote such rows to org-level (no name) so the
 * user sees the company honestly and can enrich a real named contact instead.
 */
const PLACEHOLDER_NAME =
  /^(the |a )?(owner|owners|co owner|manager|management|owner manager|owner operator|proprietor|founder|co founder|ceo|cfo|cmo|coo|cto|president|vice president|vp|director|director of \w+|head of \w+|managing director|principal|partner|operator|business owner|store manager|general manager|practice manager|office manager|branch manager|decision maker|contact|contact person|admin|administrator|staff|team|receptionist|reception|to whom it may concern|na|n a|none|unknown|not found|not available|tbd)$/;

/** True when `name` is a generic role, or merely echoes the title/company — i.e. not a real person. */
function isPlaceholderPersonName(name: string, title: string | null, company: string): boolean {
  const n = norm(name);
  if (!n) return false;
  if (PLACEHOLDER_NAME.test(n)) return true;
  if (title && n === norm(title)) return true;
  if (company && n === norm(company)) return true;
  return false;
}

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
    "PERSIST the real leads you found (from web search) into the user's Lead studio as a working list — this is how you save research; NEVER hand the user a to-do list of things to look up themselves. Leads can be PEOPLE (name + title + company) OR ORGANIZATIONS / COMPANIES (just the org/company name — omit `name` and it's saved as an org-level lead the user can enrich into named contacts, or contact directly). So even when your research only surfaces companies, networks, or groups (not 50 named individuals), save THOSE — do not discard them. Use AFTER researching real matches (industry, size, seniority, titles, location, or the orgs/networks where the target audience clusters). Do NOT invent emails/phones here — leave them out; enrich_lead reveals them later (billed). NEVER invent a company or person: save the business's REAL name exactly as the source shows it and NEVER append the search city/region to it (no 'Acme Plumbing Pittsfield' when the source says 'Acme Plumbing' — the city belongs in `location`, not the name); and if you don't have the real decision-maker's name, OMIT `name` (org-level) rather than passing a placeholder like 'Owner', 'Owner/Manager', or a bare job title. Pass `leads` and either `listName` (new list) or `listId`. Set `mode:'companies'` if every row is an organization. Finding is free; enrichment is billed per lead.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — the planId from a confirmed propose_plan (reuse the same plan you used for the search)." },
      listName: { type: "string", description: "Name for a NEW list to hold these leads (e.g. 'TX SaaS CFOs' or 'Albany Young-Pro Orgs'). Omit if using listId." },
      listId: { type: "string", description: "Existing lead list id to append to. Omit to create a new list via listName." },
      mode: { type: "string", description: "'contacts' (people, default) or 'companies' (every lead is an organization/company — person name optional)." },
      leads: {
        type: "array",
        description: "The real leads you found. Person: { name, title, company, domain?, location?, seniority?, department?, industry? }. Organization: { company (the org/company/group name), domain?, location?, industry? } — omit `name` to save it as an org-level lead.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "The person's full name. OMIT for an organization/company-level lead." },
            title: { type: "string" },
            company: { type: "string", description: "Company / organization / group name. Required (for a person lead this is their employer; for an org lead this IS the lead)." },
            domain: { type: "string" },
            location: { type: "string" },
            seniority: { type: "string" },
            department: { type: "string" },
            industry: { type: "string" },
          },
          required: ["company"],
        },
      },
    },
    required: ["planId", "leads"],
  },
  plans: null,
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    const modeCompanies = input.mode === "companies";
    const raw = Array.isArray(input.leads) ? input.leads : [];
    const leads = raw
      .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
      .map((l) => {
        const rawName = String(l.name || "").trim();
        const title = typeof l.title === "string" ? l.title.trim() : null;
        // An org-level lead can arrive with the org in `company` OR `name`; make
        // `company` the source of truth so nothing is discarded for lacking a person.
        const company = String(l.company || "").trim() || rawName;
        // Drop fabricated/placeholder people ("Owner/Manager", a bare title, or a
        // name that just echoes the company) → saved org-level, never as a fake contact.
        const name = rawName && !isPlaceholderPersonName(rawName, title, company) ? rawName : "";
        return {
          name,
          company,
          title,
          domain: typeof l.domain === "string" ? l.domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null,
          location: typeof l.location === "string" ? l.location.trim() : null,
          seniority: typeof l.seniority === "string" ? l.seniority.trim() : null,
          department: typeof l.department === "string" ? l.department.trim() : null,
          industry: typeof l.industry === "string" ? l.industry.trim() : null,
        };
      })
      .filter((l) => l.company) // keep anything with at least an org/company (name falls back to company)
      .slice(0, 50);

    if (leads.length === 0) {
      return { ok: false, error_code: "missing_input", message: "leads must contain at least one entry with a company or organization name." };
    }

    // Persist — wrapped so a DB/schema error degrades to a clear message instead
    // of crashing the tool (handler contract: never throw).
    let listId = typeof input.listId === "string" ? input.listId : null;
    const created: { id: string; name: string; title: string | null; company: string; isOrg: boolean }[] = [];
    try {
      if (listId) {
        const owned = await prisma.savedLeadList.findFirst({ where: { id: listId, userId: ctx.userId }, select: { id: true } });
        if (!owned) listId = null;
      }
      if (!listId) {
        const name = (typeof input.listName === "string" && input.listName.trim()) || "Found leads";
        const list = await prisma.savedLeadList.create({ data: { userId: ctx.userId, name: name.slice(0, 120) }, select: { id: true } });
        listId = list.id;
      }

      // Upsert companies (dedup by domain, else name) then create the leads. A row
      // with no person `name` (or mode:companies) is saved as an ORG-level lead:
      // name = the org, seniority = "organization" so the UI + enrich_lead treat it
      // as a company to expand into named contacts rather than a person.
      for (const l of leads) {
        const isOrg = modeCompanies || !l.name;
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
            name: (isOrg ? l.company : l.name).slice(0, 160),
            title: isOrg ? null : l.title,
            seniority: isOrg ? "organization" : l.seniority,
            department: isOrg ? null : l.department,
            category: l.company.slice(0, 120),
            companyId: company.id,
            status: "NEW",
          },
          select: { id: true, name: true, title: true, category: true },
        });
        created.push({ id: lead.id, name: lead.name, title: lead.title, company: lead.category ?? l.company, isOrg });
      }

      await prisma.savedLeadList.update({
        where: { id: listId },
        data: { leadCount: await prisma.savedLead.count({ where: { listId } }) },
      }).catch(() => {});
    } catch (e) {
      return {
        ok: false,
        error_code: "upstream_failed",
        message: `Found ${leads.length} leads but couldn't save them — a database error occurred${e instanceof Error ? `: ${e.message.slice(0, 160)}` : ""}. Tell the user saving leads is temporarily unavailable; share the top results you found and retry shortly.`,
      };
    }

    // Nudge the Lead studio to refresh if it's open.
    ctx.emit({ type: "canvas_update", patch: { __leads: { refresh: true, listId } } });

    const orgCount = created.filter((c) => c.isOrg).length;
    const kind = orgCount === created.length ? "organization" : orgCount > 0 ? "lead" : "lead";
    return {
      ok: true,
      data: {
        listId,
        count: created.length,
        leads: created,
        userMessage: `Saved ${created.length} ${kind}${created.length === 1 ? "" : "s"} to the list${orgCount > 0 && orgCount < created.length ? ` (${orgCount} organisation-level)` : ""}. Tell the user they can reveal contact details with "enrich" (billed per lead) or start outreach — do NOT tell them to research these themselves.`,
      },
      resultRefType: "SavedLeadList",
      resultRefId: listId,
    };
  },
};
