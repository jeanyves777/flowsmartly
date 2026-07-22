import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost, checkCreditsAvailable } from "@/lib/credits/costs";
import { extractLocationSignal, validateAddressAgainstLocation } from "@/lib/leads/discrepancy-validator";
import { searchGooglePlaces, googlePlacesKey } from "@/lib/leads/google-places";
import type { FlowAgentTool } from "../registry";

// Google Places fans out one (billed) Place Details call per business (~$0.025) +
// a Text Search (~$0.032), so a flat charge lost money. Charge base + per-result,
// and cap the fan-out so a single search can't run away. See credit-pricing audit.
const LOCAL_LEAD_FANOUT_CAP = 20;
async function localLeadCharge(count: number): Promise<number> {
  const [base, per] = await Promise.all([
    getDynamicCreditCost("LOCAL_LEAD_SEARCH_BASE"),
    getDynamicCreditCost("LOCAL_LEAD_PER_RESULT"),
  ]);
  return base + per * Math.max(0, count);
}

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
    "Find REAL local businesses via Google Places (verified name, address, phone, website, Google rating + review count) and save them as a lead list. Use for LOCAL / brick-and-mortar targets — 'dentists in Austin', 'gyms near Miami', 'plumbers in Leeds' — where the phone + website matter. Pass `query` (business type) + `location`, and a `listName` (or `listId`). Returns up to 20 verified businesses per search; if the user asked for more, run the search again (a different area) or top up with web_search + find_leads. For online/national companies or specific people (a CFO, a CMO), use web_search + find_leads instead. Billed as a small base plus a per-business fee for the ones saved.",
  input_schema: {
    type: "object",
    properties: {
      planId: { type: "string", description: "REQUIRED — the planId from a confirmed propose_plan (a local search bills a base + a per-business fee)." },
      query: { type: "string", description: "Business type to search, e.g. 'dentists', 'coffee shops', 'HVAC contractors'." },
      location: { type: "string", description: "City / area, e.g. 'Austin, TX' or 'Manchester UK'." },
      listName: { type: "string", description: "Name for a NEW list to hold these leads. Omit if using listId." },
      listId: { type: "string", description: "Existing lead list id to append to. Omit to create a new list via listName." },
      limit: { type: "number", description: "Max leads to save (default 20, hard cap 20)." },
    },
    required: ["planId", "query"],
  },
  plans: null,
  // Real charge is computed per-result inside the handler (base + per-business);
  // the framework's flat costKey is set free to avoid double-charging.
  costKey: "AGENT_PROPOSE_PLAN",
  autoPlanCost: async (input) => {
    const limit = Math.min(LOCAL_LEAD_FANOUT_CAP, Math.max(1, Number(input.limit) || 20));
    return {
      credits: await localLeadCharge(limit),
      label: "Find local leads",
      detail: `Up to ${limit} verified businesses from Google`,
    };
  },
  mutating: true,
  handler: async (input, ctx) => {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    const location = typeof input.location === "string" ? input.location.trim() : "";
    if (!query) return { ok: false, error_code: "missing_input", message: "query (business type) is required." };
    if (!googlePlacesKey()) {
      return { ok: false, error_code: "upstream_failed", message: "Google Places isn't configured (GOOGLE_MAPS_API_KEY). Use web_search + find_leads instead for this one." };
    }

    const limit = Math.min(LOCAL_LEAD_FANOUT_CAP, Math.max(1, Number(input.limit) || 20)); // capped so a search can't run away on Place Details cost

    // Pre-check the worst-case charge BEFORE spending on Google Places (each
    // Place Details lookup is billed). Charge the ACTUAL per-result amount after save.
    if (!ctx.isAdmin) {
      const estMax = await localLeadCharge(limit);
      const shortfall = await checkCreditsAvailable(ctx.userId, estMax, false, ctx.isAdmin);
      if (shortfall) {
        return {
          ok: false,
          error_code: "insufficient_credits",
          message: `${shortfall.message} A local search costs a base plus a small fee per business saved. Offer to top up (buy_credits) or search a smaller area.`,
          recoverable: true,
        };
      }
    }

    let results;
    try {
      results = await searchGooglePlaces(query, location, limit);
    } catch (e) {
      return { ok: false, error_code: "upstream_failed", message: `Google Places search failed: ${e instanceof Error ? e.message : "unknown error"}. You can fall back to web_search + find_leads.` };
    }
    const requestedLocation = extractLocationSignal(location);
    const filtered = location
      ? results.filter((business) => validateAddressAgainstLocation(business.address, requestedLocation).length === 0)
      : results;
    const skippedForLocation = results.length - filtered.length;
    const businesses = filtered.slice(0, limit);
    const capped = limit >= LOCAL_LEAD_FANOUT_CAP && businesses.length >= LOCAL_LEAD_FANOUT_CAP;
    if (businesses.length === 0) {
      const reason = skippedForLocation > 0
        ? ` Google returned ${skippedForLocation} result${skippedForLocation === 1 ? "" : "s"}, but their addresses conflicted with ${location}, so I did not save them.`
        : "";
      return { ok: true, data: { count: 0, userMessage: `No local businesses found for "${query}"${location ? ` in ${location}` : ""}.${reason} Try a broader term or a different location.` } };
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

    // Charge the ACTUAL per-result cost now that we know how many were saved
    // (base + per business). Never throws past the tool boundary.
    if (!ctx.isAdmin && created.length > 0) {
      const cost = await localLeadCharge(created.length);
      await creditService
        .deductCredits({
          userId: ctx.userId,
          amount: cost,
          type: "USAGE",
          description: `Lead search: ${created.length} local ${query}`,
          referenceType: "local_lead_search",
          referenceId: listId,
        })
        .catch((e) => console.error("[find_local_leads] charge failed:", e));
    }

    return {
      ok: true,
      data: {
        listId, count: created.length, source: "google_places",
        leads: created.slice(0, 10),
        userMessage: `Found + saved ${created.length} local ${query}${location ? ` in ${location}` : ""} from Google (with phone + website + ratings).${skippedForLocation > 0 ? ` I skipped ${skippedForLocation} Google result${skippedForLocation === 1 ? "" : "s"} because the address did not match the requested location.` : ""}${capped ? " That's the 20-per-search cap — if the user wanted more, search a different area or run web_search + find_leads to top up the same list." : ""} Tell the user they can build an outreach automation on this list or enrich decision-maker contacts.`,
      },
      resultRefType: "SavedLeadList",
      resultRefId: listId,
    };
  },
};
