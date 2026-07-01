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
    "Reveal & save a lead's contact details you found via web search (email, phone, LinkedIn/X/Facebook/company site). Pass the leadId plus whatever you verified — email, phones, socials, title. Costs credits per lead (billed). Only call for leads the user asked to enrich; for a whole list, propose_plan first with the count so the user sees the cost.",
  input_schema: {
    type: "object",
    properties: {
      leadId: { type: "string", description: "The SavedLead id to enrich." },
      email: { type: "string", description: "Primary work email you verified." },
      phone: { type: "string", description: "Primary phone." },
      phones: { type: "array", items: { type: "string" }, description: "Additional phone numbers." },
      title: { type: "string", description: "Corrected/confirmed job title." },
      socials: {
        type: "object",
        description: "Public profile links you found: { linkedin?, x?, facebook?, google? }.",
        properties: { linkedin: { type: "string" }, x: { type: "string" }, facebook: { type: "string" }, google: { type: "string" } },
      },
    },
    required: ["leadId"],
  },
  plans: null,
  costKey: "AI_WEB_SEARCH",
  mutating: true,
  handler: async (input, ctx) => {
    const leadId = typeof input.leadId === "string" ? input.leadId : "";
    if (!leadId) return { ok: false, error_code: "missing_input", message: "leadId is required." };

    const lead = await prisma.savedLead.findFirst({ where: { id: leadId, userId: ctx.userId }, select: { id: true } });
    if (!lead) return { ok: false, error_code: "not_found", message: "That lead was not found." };

    const phones = Array.isArray(input.phones) ? input.phones.filter((p): p is string => typeof p === "string" && p.trim().length > 0) : [];
    const socials = input.socials && typeof input.socials === "object" ? (input.socials as Record<string, unknown>) : {};
    const cleanSocials = ["linkedin", "x", "facebook", "google"].reduce<Record<string, string>>((acc, k) => {
      const v = socials[k];
      if (typeof v === "string" && v.trim()) acc[k] = v.trim();
      return acc;
    }, {});

    const updated = await prisma.savedLead.update({
      where: { id: leadId },
      data: {
        email: typeof input.email === "string" && input.email.trim() ? input.email.trim() : undefined,
        phone: typeof input.phone === "string" && input.phone.trim() ? input.phone.trim() : undefined,
        phones: phones.length ? JSON.stringify(phones) : undefined,
        title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : undefined,
        socials: Object.keys(cleanSocials).length ? JSON.stringify(cleanSocials) : undefined,
        enrichedAt: new Date(),
        enrichmentSource: "web",
      },
      select: { id: true, name: true, title: true, email: true, phone: true },
    });

    // Log the touch + refresh the studio.
    await prisma.activity.create({ data: { userId: ctx.userId, type: "note", subject: "Lead enriched", savedLeadId: leadId } }).catch(() => {});
    ctx.emit({ type: "canvas_update", patch: { __leads: { enrichedLeadId: leadId } } });

    return {
      ok: true,
      data: { lead: updated, userMessage: `Enriched ${updated.name}${updated.email ? ` — ${updated.email}` : ""}.` },
      resultRefType: "SavedLead",
      resultRefId: leadId,
    };
  },
};
