/**
 * Lead opportunity scoring — rule-based, deterministic, zero-cost.
 *
 * Ranks saved leads so the richest, best-fit prospects surface on top. The score
 * (0–100) is transparent and recomputes on the client the moment a list loads,
 * so it climbs live as a lead is enriched. Two halves:
 *
 *   Brand fit (0–50)      — how well the business matches what the user searched
 *                           for and whether it's in the searched area.
 *   Data readiness (0–50) — how actionable the row is right now (email, phone,
 *                           website, address, socials on file).
 *
 * No AI / network calls — purely the fields already on the lead plus the search
 * context (the list name it was found under). Self-contained on purpose: it does
 * not import the address discrepancy-validator, so it stands alone.
 */

export interface OpportunityLead {
  name?: string | null;
  category?: string | null; // company / industry
  title?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  phones?: string | null; // JSON array string
  website?: string | null;
  socials?: string | null; // JSON object string
  rating?: number | null;
  reviewCount?: number | null;
  enrichedAt?: string | null;
}

export interface OpportunityContext {
  /** Where the user searched — typically the list name ("Pittsfield Home Care Service Owners"). */
  searchLocation?: string | null;
  /** ICP / brand terms worth rewarding a match on (list category, search keywords). */
  focusTerms?: string[];
}

export type OppBand = "high" | "med" | "low";

export interface OpportunityScore {
  score: number; // 0–100
  band: OppBand;
  fit: number; // 0–50
  readiness: number; // 0–50
  parts: { match: number; area: number; signal: number; email: number; phone: number; web: number; addr: number; social: number };
  /** The lead's address is in a different place than the search — surfaced as a flag. */
  outOfArea: boolean;
}

export const BAND_HIGH = 72;
export const BAND_MED = 45;

export function bandOf(score: number): OppBand {
  return score >= BAND_HIGH ? "high" : score >= BAND_MED ? "med" : "low";
}

const US_STATE_CODES = new Set(
  ("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC").split(" "),
);
// List-name filler words that must never be mistaken for a city.
const PLACE_STOP = new Set(
  ("home care service services owner owners the and of in near greater found new my saved leads list lists prospect prospects target targets potential local business businesses company companies group groups").split(" "),
);

function norm(v: string): string {
  return v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Best-effort {city,state} from an address OR a free-text list name. Conservative:
 *  returns nothing rather than guessing a city out of filler words. */
function extractPlace(s?: string | null): { city?: string; state?: string } {
  if (!s) return {};
  const raw = s.trim();
  let state: string | undefined;
  for (const code of raw.toUpperCase().match(/\b[A-Z]{2}\b/g) || []) {
    if (US_STATE_CODES.has(code)) { state = code; break; }
  }
  let city: string | undefined;
  if (raw.includes(",")) {
    // Comma-formatted address: the segment just before the state is the city.
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    const idx = state ? parts.findIndex((p) => new RegExp(`\\b${state}\\b`, "i").test(p)) : -1;
    const cand = idx > 0 ? parts[idx - 1] : parts.length >= 2 ? parts[parts.length - 2] : undefined;
    if (cand) {
      const cleaned = cand
        .replace(/^\d+\s+/, "")
        .replace(/\b(?:st|street|rd|road|ave|avenue|blvd|dr|drive|ln|lane|suite|ste|hwy|highway|floor|fl|unit|apt)\b.*$/i, "")
        .trim();
      if (cleaned) city = norm(cleaned);
    }
  } else {
    // Free text (a list name): take the first place-like word that isn't filler.
    const first = raw.split(/\s+/).find((w) => /^[A-Za-z][A-Za-z.-]+$/.test(w) && !PLACE_STOP.has(w.toLowerCase()));
    if (first) city = norm(first);
  }
  return { city: city || undefined, state };
}

/** Area score (0–15) + out-of-area flag, docking points only on confident conflicts. */
function scoreArea(leadAddress: string | null | undefined, searchLocation: string | null | undefined): { area: number; outOfArea: boolean } {
  const want = extractPlace(searchLocation);
  const got = extractPlace(leadAddress);
  if (!want.city && !want.state) return { area: 12, outOfArea: false }; // no search location to compare against
  if (!leadAddress) return { area: 8, outOfArea: false }; // lead not enriched yet — unknown, mild
  if (want.state && got.state && want.state !== got.state) return { area: 0, outOfArea: true };
  if (want.city && got.city && want.city === got.city) return { area: 15, outOfArea: false };
  if (want.state && got.state && want.state === got.state) {
    return want.city && got.city && want.city !== got.city ? { area: 6, outOfArea: false } : { area: 13, outOfArea: false };
  }
  if (want.city && got.city && want.city !== got.city) return { area: 5, outOfArea: true }; // clear city conflict, no state to soften
  return { area: 10, outOfArea: false }; // partial / can't confidently tell
}

function hasText(v?: string | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}
function hasSocial(socials?: string | null): boolean {
  if (!hasText(socials)) return false;
  try {
    const o = JSON.parse(socials as string) as Record<string, unknown>;
    return Object.values(o).some((x) => typeof x === "string" && x.trim());
  } catch { return false; }
}
function hasPhone(lead: OpportunityLead): boolean {
  if (hasText(lead.phone)) return true;
  if (!hasText(lead.phones)) return false;
  try { const a = JSON.parse(lead.phones as string); return Array.isArray(a) && a.some((p) => typeof p === "string" && p.trim()); } catch { return false; }
}

/** Offer/industry match (0–30) — a solid baseline for anything that matched the
 *  search, nudged up when the lead's own text overlaps the ICP focus terms. */
function scoreMatch(lead: OpportunityLead, focusTerms?: string[]): number {
  const base = hasText(lead.category) ? 20 : 8;
  if (!focusTerms || focusTerms.length === 0) return Math.min(30, base + (hasText(lead.category) ? 4 : 0));
  const hay = norm([lead.category, lead.title, lead.name].filter(Boolean).join(" "));
  const terms = Array.from(new Set(focusTerms.map((t) => norm(t)).filter((t) => t.length >= 3)));
  if (terms.length === 0) return Math.min(30, base + 4);
  const hits = terms.filter((t) => hay.includes(t)).length;
  return Math.min(30, base + Math.round((hits / terms.length) * 10));
}

function scoreSignal(lead: OpportunityLead): number {
  const reviews = typeof lead.reviewCount === "number" ? lead.reviewCount : 0;
  const rating = typeof lead.rating === "number" ? lead.rating : 0;
  if (reviews >= 100 && rating >= 4.3) return 5;
  if (reviews >= 25) return 3;
  if (rating > 0 || reviews > 0) return 2;
  return 0;
}

export function scoreOpportunity(lead: OpportunityLead, ctx: OpportunityContext = {}): OpportunityScore {
  const match = scoreMatch(lead, ctx.focusTerms);
  const { area, outOfArea } = scoreArea(lead.address, ctx.searchLocation);
  const signal = scoreSignal(lead);
  const fit = match + area + signal;

  const email = hasText(lead.email) ? 20 : 0;
  const phone = hasPhone(lead) ? 12 : 0;
  const web = hasText(lead.website) ? 8 : 0;
  const addr = hasText(lead.address) ? 6 : 0;
  const social = hasSocial(lead.socials) ? 4 : 0;
  const readiness = email + phone + web + addr + social;

  const score = Math.max(0, Math.min(100, fit + readiness));
  return { score, band: bandOf(score), fit, readiness, parts: { match, area, signal, email, phone, web, addr, social }, outOfArea };
}

/** Attach a score to each lead and return them ranked best-first (tiebreak: readiness, then name). */
export function rankLeads<T extends OpportunityLead>(leads: T[], ctx: OpportunityContext = {}): Array<T & { opportunity: OpportunityScore }> {
  return leads
    .map((l) => ({ ...l, opportunity: scoreOpportunity(l, ctx) }))
    .sort(
      (a, b) =>
        b.opportunity.score - a.opportunity.score ||
        b.opportunity.readiness - a.opportunity.readiness ||
        (a.name || "").localeCompare(b.name || ""),
    );
}
