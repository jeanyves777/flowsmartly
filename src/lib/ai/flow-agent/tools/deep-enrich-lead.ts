import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * deep_enrich_lead — the "Deep details" pass in Lead Studio. AFTER a basic
 * enrich (email/phone/website), this goes DEEPER: the complete formatted street
 * address, firmographics (company size, revenue band, year founded, industry),
 * business hours, a reviews summary, and ADDITIONAL decision-makers at the
 * company. The agent finds these via web_search + web_fetch, then calls this to
 * SAVE them onto the lead — the deep fields land in the SavedLead.enrichment JSON
 * blob (rendered in the detail card), the full address overwrites the partial one,
 * and any newly-found basic contact fields fill gaps. Results appear IN THE ROW,
 * never in chat. Billed per lead (AI_WEB_SEARCH) — confirm via propose_plan first.
 * [[agent-operates-account-full-crud]]
 */
export const deepEnrichLead: FlowAgentTool = {
  name: "deep_enrich_lead",
  description:
    "SAVE DEEPER details on an already-enriched lead (the Lead Studio 'Deep details' / 'Find more details' actions). Use this — NOT enrich_lead — when the user asks for the FULL street address, more decision-makers/contacts, business hours, company size/revenue, year founded, industry, an about/description, or a reviews summary. Find them via web_search + web_fetch (the business's own site, Google Business, LinkedIn, directories), then call this with the leadId + only the fields you VERIFIED. `fullAddress` should be the COMPLETE address (street, city, state, ZIP, country) and overwrites any partial one. `contacts` is additional named people at the company. This is how deep results reach the user — they render IN THE LEAD'S ROW; NEVER write the details as a chat message/table. Pass `planId` from a confirmed propose_plan (two AI_WEB_SEARCH per lead: search + save). Leave a field out if you didn't verify it.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — the planId from a confirmed propose_plan." },
      leadId: { type: "string", description: "The SavedLead id to deep-enrich (preferred — the UI passes it in the instruction)." },
      leadName: { type: "string", description: "Fallback when you don't have the exact leadId: the lead's name to resolve the row (optionally narrowed by listId)." },
      listId: { type: "string", description: "Optional — the list the lead belongs to, to disambiguate a leadName lookup." },
      fullAddress: { type: "string", description: "The COMPLETE formatted address — street number + street, city, state, ZIP, country. Overwrites any partial address on the row." },
      employeeSize: { type: "string", description: "Company headcount band, e.g. '1-10', '11-50', '51-200', '200+'." },
      revenueBand: { type: "string", description: "Estimated annual revenue band, e.g. '<$1M', '$1M-$10M', '$10M+'." },
      yearFounded: { type: "string", description: "Year the business was founded." },
      industry: { type: "string", description: "Primary industry / vertical." },
      about: { type: "string", description: "A short company description / what they do (1-2 sentences)." },
      hours: { type: "string", description: "Business hours summary, e.g. 'Mon-Fri 8am-6pm, Sat 9am-1pm'." },
      reviews: { type: "string", description: "A short reviews summary / highlights (themes, standout quotes) — not the raw star count." },
      contacts: {
        type: "array",
        description: "Additional decision-makers found at the company.",
        items: {
          type: "object",
          properties: { name: { type: "string" }, title: { type: "string" }, email: { type: "string" }, phone: { type: "string" } },
          required: ["name"],
        },
      },
      email: { type: "string", description: "A newly-found work email (fills a gap on the primary row)." },
      phone: { type: "string", description: "A newly-found phone (fills a gap on the primary row)." },
      website: { type: "string", description: "A newly-found website (fills a gap)." },
      socials: {
        type: "object",
        description: "Newly-found public profile links: { linkedin?, x?, facebook?, google? }.",
        properties: { linkedin: { type: "string" }, x: { type: "string" }, facebook: { type: "string" }, google: { type: "string" } },
      },
    },
    required: ["planId"],
  },
  plans: null,
  costKey: "AI_WEB_SEARCH",
  mutating: true,
  handler: async (input, ctx) => {
    const leadId = typeof input.leadId === "string" ? input.leadId.trim() : "";
    const leadName = typeof input.leadName === "string" ? input.leadName.trim() : "";
    const listId = typeof input.listId === "string" ? input.listId.trim() : "";
    if (!leadId && !leadName) return { ok: false, error_code: "missing_input", message: "Pass leadId (preferred) or leadName so the deep details can be saved into a specific lead row." };

    let lead = leadId
      ? await prisma.savedLead.findFirst({ where: { id: leadId, userId: ctx.userId }, select: { id: true, enrichment: true } })
      : null;
    if (!lead && leadName) {
      lead = await prisma.savedLead.findFirst({
        where: { userId: ctx.userId, name: { contains: leadName }, ...(listId ? { listId } : {}) },
        orderBy: { createdAt: "desc" },
        select: { id: true, enrichment: true },
      });
    }
    if (!lead) return { ok: false, error_code: "not_found", message: `No saved lead matched ${leadId ? `id "${leadId}"` : `name "${leadName}"`}. Do NOT report the details in chat — ask the user to reopen the list, or pass the exact leadId.` };
    const resolvedId = lead.id;

    // Merge new deep fields into the existing enrichment blob (never lose prior data).
    const prior = (() => { try { const o = JSON.parse(lead.enrichment || "{}"); return o && typeof o === "object" ? (o as Record<string, unknown>) : {}; } catch { return {}; } })();
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const deep: Record<string, unknown> = { ...prior };
    for (const k of ["fullAddress", "employeeSize", "revenueBand", "yearFounded", "industry", "about", "hours", "reviews"] as const) {
      const v = str(input[k]);
      if (v) deep[k] = v;
    }
    if (Array.isArray(input.contacts)) {
      const contacts = (input.contacts as unknown[])
        .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : null))
        .filter((c): c is Record<string, unknown> => !!c && typeof c.name === "string" && !!(c.name as string).trim())
        .map((c) => ({ name: str(c.name)!, title: str(c.title), email: str(c.email), phone: str(c.phone) }));
      if (contacts.length) deep.contacts = contacts;
    }

    const socials = input.socials && typeof input.socials === "object" ? (input.socials as Record<string, unknown>) : {};
    const cleanSocials = ["linkedin", "x", "facebook", "google"].reduce<Record<string, string>>((acc, k) => {
      const v = socials[k];
      if (typeof v === "string" && v.trim()) acc[k] = v.trim();
      return acc;
    }, {});

    const updated = await prisma.savedLead.update({
      where: { id: resolvedId },
      data: {
        enrichment: JSON.stringify(deep),
        // The full address replaces any partial one saved during the basic pass.
        address: str(input.fullAddress) ?? undefined,
        email: str(input.email) ?? undefined,
        phone: str(input.phone) ?? undefined,
        website: str(input.website) ?? undefined,
        socials: Object.keys(cleanSocials).length ? JSON.stringify(cleanSocials) : undefined,
        enrichedAt: new Date(),
        deepEnrichedAt: new Date(),
        enrichmentSource: "web",
      },
      select: { id: true, name: true },
    });

    await prisma.activity.create({ data: { userId: ctx.userId, type: "note", subject: "Lead deep-enriched", savedLeadId: resolvedId } }).catch(() => {});
    ctx.emit({ type: "canvas_update", patch: { __leads: { enrichedLeadId: resolvedId } } });

    const added = Object.keys(deep).filter((k) => !(k in prior)).length;
    return {
      ok: true,
      data: { lead: updated, userMessage: `Added deeper details to ${updated.name}${added ? ` (${added} new)` : ""} — saved in their row in the Lead Studio (do NOT repeat them in chat).` },
      resultRefType: "SavedLead",
      resultRefId: resolvedId,
    };
  },
};
