import { prisma } from "@/lib/db/client";
import type { FlowAgentTool } from "../registry";

/**
 * enrich_lead — reveal a lead's contact info (email / phone / socials), found by
 * the agent via web search (LinkedIn, the company site, public directories). The
 * agent passes the details it verified; this persists them and stamps enrichedAt.
 * Billed per lead (AI_WEB_SEARCH) — the agent should confirm via propose_plan
 * before enriching many at once.
 */
export const enrichLead: FlowAgentTool = {
  name: "enrich_lead",
  description:
    "Reveal & SAVE a lead's contact details you found via web search. Capture the REACHABLE info the user needs: work EMAIL, PHONE, business WEBSITE and ADDRESS/location, plus LinkedIn. FINDING THE EMAIL IS THE PRIORITY (it's what the outreach pitch sends to) and it's rarely in search results — it's on the business's OWN WEBSITE: once you know their site, use web_fetch on the homepage AND the /contact or /about page and read out the email (info@ / hello@ / bookings@ / reservations@ / the owner's), or search '\"@theirdomain.com\"'. Always include the business phone + address too (not just a LinkedIn). This is how enrichment results reach the user — they appear IN THE LEAD'S ROW in the Lead Studio UI. You MUST call this to deliver the result; NEVER just write the found details as a message or a table in the chat. Pass `planId` from a confirmed propose_plan, plus leadId (the UI provides it — e.g. 'leadId: xxx') and every field you verified. If you don't have the exact id, pass leadName (+ optional listId). Costs credits per lead. For a whole list, propose_plan ONCE with two AI_WEB_SEARCH per lead (search + save), then reuse that planId for every enrich_lead call.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — the planId from a confirmed propose_plan. For a bulk enrich, pass the SAME planId to every enrich_lead call." },
      leadId: { type: "string", description: "The SavedLead id to enrich (preferred — the Enrich button passes it in the instruction)." },
      leadName: { type: "string", description: "Fallback when you don't have the exact leadId: the lead's name to resolve the row (optionally narrowed by listId)." },
      listId: { type: "string", description: "Optional — the list the lead belongs to, to disambiguate a leadName lookup." },
      email: { type: "string", description: "Primary work email you verified." },
      phone: { type: "string", description: "Primary phone — the business phone (from Google Business / their site) if you can't find a direct one." },
      phones: { type: "array", items: { type: "string" }, description: "Additional phone numbers." },
      title: { type: "string", description: "Corrected/confirmed job title." },
      website: { type: "string", description: "The business website URL." },
      address: { type: "string", description: "The business street address / location (from Google Business)." },
      socials: {
        type: "object",
        description: "Public profile links you found: { linkedin?, x?, facebook?, google? }.",
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
    if (!leadId && !leadName) return { ok: false, error_code: "missing_input", message: "Pass leadId (preferred) or leadName so the enrichment can be saved into a specific lead row." };

    // Resolve the row: by id first, else by name (optionally within a list). The
    // name fallback guarantees enrichment ALWAYS lands in the UI — never in chat.
    let lead = leadId ? await prisma.savedLead.findFirst({ where: { id: leadId, userId: ctx.userId }, select: { id: true } }) : null;
    if (!lead && leadName) {
      lead = await prisma.savedLead.findFirst({
        where: { userId: ctx.userId, name: { contains: leadName }, ...(listId ? { listId } : {}) },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
    }
    if (!lead) return { ok: false, error_code: "not_found", message: `No saved lead matched ${leadId ? `id "${leadId}"` : `name "${leadName}"`}. Do NOT report the details in chat — ask the user to reopen the list, or pass the exact leadId from the row.` };
    const resolvedId = lead.id;

    const phones = Array.isArray(input.phones) ? input.phones.filter((p): p is string => typeof p === "string" && p.trim().length > 0) : [];
    const socials = input.socials && typeof input.socials === "object" ? (input.socials as Record<string, unknown>) : {};
    const cleanSocials = ["linkedin", "x", "facebook", "google"].reduce<Record<string, string>>((acc, k) => {
      const v = socials[k];
      if (typeof v === "string" && v.trim()) acc[k] = v.trim();
      return acc;
    }, {});

    const updated = await prisma.savedLead.update({
      where: { id: resolvedId },
      data: {
        email: typeof input.email === "string" && input.email.trim() ? input.email.trim() : undefined,
        phone: typeof input.phone === "string" && input.phone.trim() ? input.phone.trim() : undefined,
        phones: phones.length ? JSON.stringify(phones) : undefined,
        title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : undefined,
        website: typeof input.website === "string" && input.website.trim() ? input.website.trim() : undefined,
        address: typeof input.address === "string" && input.address.trim() ? input.address.trim() : undefined,
        socials: Object.keys(cleanSocials).length ? JSON.stringify(cleanSocials) : undefined,
        enrichedAt: new Date(),
        enrichmentSource: "web",
      },
      select: { id: true, name: true, title: true, email: true, phone: true },
    });

    // Log the touch + refresh the studio.
    await prisma.activity.create({ data: { userId: ctx.userId, type: "note", subject: "Lead enriched", savedLeadId: resolvedId } }).catch(() => {});
    ctx.emit({ type: "canvas_update", patch: { __leads: { enrichedLeadId: resolvedId } } });

    return {
      ok: true,
      data: { lead: updated, userMessage: `Enriched ${updated.name}${updated.email ? ` — ${updated.email}` : ""} — the details are now saved in their row in the Lead Studio (do NOT repeat them in chat).` },
      resultRefType: "SavedLead",
      resultRefId: resolvedId,
    };
  },
};
