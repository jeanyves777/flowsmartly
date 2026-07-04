import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { ensureDefaultStages } from "@/lib/crm/pipeline";
import type { FlowAgentTool } from "../registry";

interface RawLead {
  name: string; title: string | null; company: string;
  domain: string | null; location: string | null; seniority: string | null;
  department: string | null; industry: string | null;
  email: string | null; phone: string | null; phones: string[]; socials: Record<string, string>;
  dealValue: number | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * run_lead_autopilot — the one-shot top-of-funnel autopilot. Given the prospects
 * the agent researched (via web search), it does the whole repetitive setup in one
 * pass: saves them as a lead list, reveals the contact info the agent found
 * (billed per enriched lead, like enrich_lead), and drops ONE deal per company into
 * the pipeline (default "New" stage) — each linked to its lead + company and logged
 * on the timeline. After it runs, the agent drafts outreach with create_pitch /
 * create_proposal (pass the returned opportunityId to link + track it).
 *
 * Because it can bill for enrichment, it REQUIRES a confirmed `planId` — the agent
 * must propose_plan first (find is free; each enriched contact costs AI_WEB_SEARCH;
 * building the pipeline is free) so the user sees and approves the spend.
 */
export const runLeadAutopilot: FlowAgentTool = {
  name: "run_lead_autopilot",
  description:
    "Run the lead autopilot end-to-end in ONE pass: save the prospects you found (from web search) as a working list, reveal the contact info you verified (email/phone/socials — billed per enriched lead), and create a pipeline deal for each company so they're ready to work toward a close. Use when the user wants you to 'find and set up' / 'build my pipeline' / 'run autopilot' for a target (industry + location + who). Pass `leads` (each: name, company, title, and optionally email/phone/socials/dealValue), a `listName`, and `stageName` (default New). REQUIRES `planId` from a confirmed propose_plan — the plan should total the enrichment cost (AI_WEB_SEARCH × the number of leads with contact info; finding + pipeline setup are free). After it runs, draft outreach with create_pitch/create_proposal using the returned opportunityId to link each deal.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — planId from a confirmed propose_plan covering the enrichment spend." },
      listName: { type: "string", description: "Name for a NEW list holding these leads (e.g. 'Austin dental clinics'). Omit if using listId." },
      listId: { type: "string", description: "Existing lead list id to append to. Omit to create a new list via listName." },
      stageName: { type: "string", description: "Starting pipeline stage for the created deals (New | Contacted | Qualified | Proposal | Negotiation). Defaults to New." },
      createDeals: { type: "boolean", description: "Create one pipeline deal per company (default true)." },
      defaultDealValue: { type: "number", description: "Fallback estimated deal value used when a lead has no dealValue." },
      leads: {
        type: "array",
        description: "The prospects you found. Contact fields (email/phone/socials) are OPTIONAL — include only what you verified; each lead with any of them is billed as an enrichment.",
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
            email: { type: "string" },
            phone: { type: "string" },
            phones: { type: "array", items: { type: "string" } },
            socials: { type: "object", properties: { linkedin: { type: "string" }, x: { type: "string" }, facebook: { type: "string" }, google: { type: "string" } } },
            dealValue: { type: "number", description: "Estimated deal value for this company's deal." },
          },
          required: ["name", "company"],
        },
      },
    },
    required: ["planId", "leads"],
  },
  plans: null,
  // Base tool charge; per-lead enrichment is billed inside the handler.
  costKey: "AGENT_TOOL_CALL_BASE",
  mutating: true,
  handler: async (input, ctx) => {
    const raw = Array.isArray(input.leads) ? input.leads : [];
    const leads: RawLead[] = raw
      .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
      .map((l) => {
        const socialsIn = l.socials && typeof l.socials === "object" ? (l.socials as Record<string, unknown>) : {};
        const socials = ["linkedin", "x", "facebook", "google"].reduce<Record<string, string>>((acc, k) => {
          const v = str(socialsIn[k]); if (v) acc[k] = v; return acc;
        }, {});
        return {
          name: String(l.name || "").trim(),
          title: str(l.title),
          company: String(l.company || "").trim(),
          domain: typeof l.domain === "string" ? l.domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null : null,
          location: str(l.location),
          seniority: str(l.seniority),
          department: str(l.department),
          industry: str(l.industry),
          email: str(l.email),
          phone: str(l.phone),
          phones: Array.isArray(l.phones) ? l.phones.filter((p): p is string => typeof p === "string" && !!p.trim()).map((p) => p.trim()) : [],
          socials,
          dealValue: num(l.dealValue),
        };
      })
      .filter((l) => l.name && l.company)
      .slice(0, 50);

    if (leads.length === 0) {
      return { ok: false, error_code: "missing_input", message: "leads must contain at least one { name, company }." };
    }

    const hasContact = (l: RawLead) => !!(l.email || l.phone || l.phones.length || Object.keys(l.socials).length);
    const enrichCount = leads.filter(hasContact).length;

    // Cost check up front (negotiable) — enrichment is the only billed part.
    const enrichUnit = await getDynamicCreditCost("AI_WEB_SEARCH");
    const enrichTotal = enrichCount * enrichUnit;
    if (!ctx.isAdmin && enrichTotal > 0) {
      const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { aiCredits: true } });
      if ((user?.aiCredits ?? 0) < enrichTotal) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `Revealing ${enrichCount} contact${enrichCount === 1 ? "" : "s"} costs ${enrichTotal} credits. User has ${user?.aiCredits ?? 0}. Offer to run autopilot without enrichment (save leads + build the pipeline for free) or top up.`,
          meta: { need: enrichTotal, have: user?.aiCredits ?? 0 },
        };
      }
    }

    // Resolve or create the target list.
    let listId = typeof input.listId === "string" ? input.listId : null;
    if (listId) {
      const owned = await prisma.savedLeadList.findFirst({ where: { id: listId, userId: ctx.userId }, select: { id: true } });
      if (!owned) listId = null;
    }
    if (!listId) {
      const name = (typeof input.listName === "string" && input.listName.trim()) || "Autopilot leads";
      const list = await prisma.savedLeadList.create({ data: { userId: ctx.userId, name: name.slice(0, 120) }, select: { id: true } });
      listId = list.id;
    }

    // Starting stage for created deals.
    const createDeals = input.createDeals !== false;
    const stages = await ensureDefaultStages(ctx.userId);
    const wanted = typeof input.stageName === "string" ? input.stageName.trim().toLowerCase() : "";
    const stage = stages.find((s) => s.name.toLowerCase() === wanted) ?? stages[0];
    const dealStatus = stage?.isWon ? "won" : stage?.isLost ? "lost" : "open";
    const fallbackValue = num(input.defaultDealValue) ?? 0;

    const dealByCompany = new Map<string, string>(); // companyId -> opportunityId
    const savedLeads: { id: string; name: string; company: string; enriched: boolean; opportunityId: string | null }[] = [];
    let dealsCreated = 0;
    let pipelineValue = 0;

    for (const l of leads) {
      // Upsert the company (dedup by domain, else name).
      let company = null as { id: string } | null;
      if (l.domain) company = await prisma.company.findFirst({ where: { userId: ctx.userId, domain: l.domain }, select: { id: true } });
      if (!company) company = await prisma.company.findFirst({ where: { userId: ctx.userId, name: l.company }, select: { id: true } });
      if (!company) {
        company = await prisma.company.create({
          data: { userId: ctx.userId, name: l.company.slice(0, 160), domain: l.domain, industry: l.industry, location: l.location },
          select: { id: true },
        });
      }

      const enriched = hasContact(l);
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
          ...(enriched
            ? {
                email: l.email,
                phone: l.phone,
                phones: l.phones.length ? JSON.stringify(l.phones) : undefined,
                socials: Object.keys(l.socials).length ? JSON.stringify(l.socials) : undefined,
                enrichedAt: new Date(),
                enrichmentSource: "autopilot",
              }
            : {}),
        },
        select: { id: true, name: true },
      });
      if (enriched) {
        await prisma.activity.create({ data: { userId: ctx.userId, type: "note", subject: "Lead enriched (autopilot)", savedLeadId: lead.id } }).catch(() => {});
      }

      // One deal per company.
      let opportunityId = dealByCompany.get(company.id) ?? null;
      if (createDeals && !opportunityId) {
        const value = l.dealValue ?? fallbackValue;
        const opp = await prisma.opportunity.create({
          data: {
            userId: ctx.userId,
            title: l.company.slice(0, 200),
            value,
            stageId: stage?.id ?? null,
            status: dealStatus,
            closedAt: dealStatus === "open" ? null : new Date(),
            source: "autopilot",
            savedLeadId: lead.id,
            companyId: company.id,
          },
          select: { id: true },
        });
        opportunityId = opp.id;
        dealByCompany.set(company.id, opp.id);
        dealsCreated += 1;
        pipelineValue += value;
        await prisma.activity.create({ data: { userId: ctx.userId, type: "note", subject: "Autopilot: added to pipeline", opportunityId: opp.id, savedLeadId: lead.id } }).catch(() => {});
      }

      savedLeads.push({ id: lead.id, name: lead.name, company: l.company, enriched, opportunityId });
    }

    // Charge the enrichment (base tool call is charged by the loop via costKey).
    if (!ctx.isAdmin && enrichTotal > 0) {
      await creditService.deductCredits({
        userId: ctx.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: enrichTotal,
        referenceType: "ai_lead_autopilot",
        referenceId: listId,
        description: `Flow-AI autopilot: enriched ${enrichCount} lead${enrichCount === 1 ? "" : "s"}`,
      }).catch((e) => console.error("[run_lead_autopilot] enrichment charge failed:", e));
    }

    await prisma.savedLeadList.update({
      where: { id: listId },
      data: { leadCount: await prisma.savedLead.count({ where: { listId } }) },
    }).catch(() => {});

    ctx.emit({ type: "canvas_update", patch: { __leads: { refresh: true, listId, pipeline: true } } });

    return {
      ok: true,
      data: {
        listId,
        leadsSaved: savedLeads.length,
        enrichedCount: enrichCount,
        dealsCreated,
        pipelineValue,
        creditCostQuoted: enrichTotal,
        deals: [...dealByCompany.values()].map((oppId) => {
          const s = savedLeads.find((x) => x.opportunityId === oppId)!;
          return { company: s.company, opportunityId: oppId };
        }),
        userMessage: `Autopilot done: saved ${savedLeads.length} lead${savedLeads.length === 1 ? "" : "s"}${enrichCount ? `, revealed ${enrichCount} contact${enrichCount === 1 ? "" : "s"}` : ""}, and set up ${dealsCreated} deal${dealsCreated === 1 ? "" : "s"} in the pipeline${pipelineValue ? ` (~$${pipelineValue.toLocaleString()} potential)` : ""}. Next: draft outreach for the top deals — call create_pitch or create_proposal and pass the deal's opportunityId to link it to the timeline.`,
      },
      resultRefType: "SavedLeadList",
      resultRefId: listId,
    };
  },
};
