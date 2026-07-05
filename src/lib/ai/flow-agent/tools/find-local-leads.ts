import { prisma } from "@/lib/db/client";
import { searchGooglePlaces, googlePlacesKey } from "@/lib/leads/google-places";
import type { FlowAgentTool } from "../registry";

/**
 * find_local_leads — pull REAL local businesses from Google Places (verified name,
 * address, phone, website, Google rating + review count) and save them as leads.
 *
 * This is the Google path, alongside Claude's native web_search: use it for
 * LOCAL / brick-and-mortar targets (dentists, cafés, gyms, clinics, contractors,
 * salons…) where you want a phone + website + rating straight away. For online /
 * national companies or specific PEOPLE (CFOs, CMOs), use web_search + find_leads.
 */
export const findLocalLeads: FlowAgentTool = {
  name: "find_local_leads",
  description:
    "Find REAL local businesses via Google Places (verified name, address, phone, website, Google rating + review count) and save them as a lead list. Use for LOCAL / brick-and-mortar targets — 'dentists in Austin', 'gyms near Miami', 'plumbers in Leeds' — where the phone + website matter. Pass `query` (business type) + `location`, and a `listName` (or `listId`). Google Places returns up to 60 per search (its hard cap); if the user asked for more (e.g. 100), get 60 here and top up the rest with web_search + find_leads. For online/national companies or specific people (a CFO, a CMO), use web_search + find_leads instead. Finding is billed once per search.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — the planId from a confirmed propose_plan (a local search costs AI_WEB_SEARCH)." },
      query: { type: "string", description: "Business type to search, e.g. 'dentists', 'coffee shops', 'HVAC contractors'." },
      location: { type: "string", description: "City / area, e.g. 'Austin, TX' or 'Manchester UK'." },
      listName: { type: "string", description: "Name for a NEW list to hold these leads. Omit if using listId." },
      listId: { type: "string", description: "Existing lead list id to append to. Omit to create a new list via listName." },
      limit: { type: "number", description: "Max leads to save (default 20)." },
    },
    required: ["planId", "query"],
  },
  plans: null,
  costKey: "AI_WEB_SEARCH",
  mutating: true,
  handler: async (input, ctx) => {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    const location = typeof input.location === "string" ? input.location.trim() : "";
    if (!query) return { ok: false, error_code: "missing_input", message: "query (business type) is required." };
    if (!googlePlacesKey()) {
      return { ok: false, error_code: "upstream_failed", message: "Google Places isn't configured (GOOGLE_MAPS_API_KEY). Use web_search + find_leads instead for this one." };
    }

    const limit = Math.min(60, Math.max(1, Number(input.limit) || 20)); // Google Places caps at 60
    let results;
    try {
      results = await searchGooglePlaces(query, location, limit);
    } catch (e) {
      return { ok: false, error_code: "upstream_failed", message: `Google Places search failed: ${e instanceof Error ? e.message : "unknown error"}. You can fall back to web_search + find_leads.` };
    }
    const businesses = results.slice(0, limit);
    const capped = limit >= 60 && businesses.length >= 60;
    if (businesses.length === 0) {
      return { ok: true, data: { count: 0, userMessage: `No local businesses found for "${query}"${location ? ` in ${location}` : ""}. Try a broader term or a different location.` } };
    }

    // Persist — wrapped so a DB/schema error degrades to a clear fallback instead
    // of crashing the tool (the handler contract is: never throw).
    let listId = typeof input.listId === "string" ? input.listId : null;
    const created: { id: string; name: string }[] = [];
    try {
      // Resolve or create the target list.
      if (listId) {
        const owned = await prisma.savedLeadList.findFirst({ where: { id: listId, userId: ctx.userId }, select: { id: true } });
        if (!owned) listId = null;
      }
      if (!listId) {
        const name = (typeof input.listName === "string" && input.listName.trim()) || [query, location].filter(Boolean).join(" — ") || "Local leads";
        const list = await prisma.savedLeadList.create({ data: { userId: ctx.userId, name: name.slice(0, 120), category: query.slice(0, 120) }, select: { id: true } });
        listId = list.id;
      }

      // De-dupe by placeId within the list, then save the business-level leads.
      const existing = await prisma.savedLead.findMany({ where: { userId: ctx.userId, listId, placeId: { in: businesses.map((b) => b.placeId) } }, select: { placeId: true } });
      const seen = new Set(existing.map((e) => e.placeId));
      for (const b of businesses) {
        if (b.placeId && seen.has(b.placeId)) continue;
        const lead = await prisma.savedLead.create({
          data: {
            userId: ctx.userId, listId, placeId: b.placeId || null,
            name: b.name.slice(0, 160), address: b.address, phone: b.phone || null, website: b.website || null,
            rating: typeof b.rating === "number" ? b.rating : null, reviewCount: typeof b.reviewCount === "number" ? b.reviewCount : null,
            businessStatus: b.businessStatus || null, category: query.slice(0, 120), types: JSON.stringify(b.types || []),
            googleMapsUrl: b.googleMapsUrl, status: "NEW",
          },
          select: { id: true, name: true },
        });
        created.push(lead);
      }

      await prisma.savedLeadList.update({ where: { id: listId }, data: { leadCount: await prisma.savedLead.count({ where: { listId } }) } }).catch(() => {});
    } catch (e) {
      return {
        ok: false,
        error_code: "upstream_failed",
        message: `Found ${businesses.length} local ${query}, but couldn't save them — a database error occurred${e instanceof Error ? `: ${e.message.slice(0, 160)}` : ""}. Tell the user saving leads is temporarily unavailable; you can still share the top results and retry shortly.`,
      };
    }
    ctx.emit({ type: "canvas_update", patch: { __leads: { refresh: true, listId } } });

    return {
      ok: true,
      data: {
        listId, count: created.length, source: "google_places",
        leads: created.slice(0, 10),
        userMessage: `Found + saved ${created.length} local ${query}${location ? ` in ${location}` : ""} from Google (with phone + website + ratings).${capped ? " That's Google's 60-per-search cap — if the user wanted more, run web_search + find_leads to top up the same list." : ""} Tell the user they can build an outreach automation on this list or enrich decision-maker contacts.`,
      },
      resultRefType: "SavedLeadList",
      resultRefId: listId,
    };
  },
};
