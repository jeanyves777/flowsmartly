/**
 * Google Places lead search — shared by the legacy /api/leads/search route and
 * the agent's `find_local_leads` tool. Returns real local businesses with
 * verified phone + website + Google rating. Needs GOOGLE_MAPS_API_KEY (or the
 * GOOGLE_API_KEY fallback) with the Places API enabled.
 */

export interface BusinessLead {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  types?: string[];
  openNow?: boolean;
  googleMapsUrl: string;
}

export function googlePlacesKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || null;
}

type PlaceResult = { place_id: string; name: string; formatted_address: string; rating?: number; user_ratings_total?: number; business_status?: string; types?: string[]; opening_hours?: { open_now?: boolean } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Text search (place IDs) → details (phone/website). Paginates up to `limit`
 * results — Google Places text search returns 20 per page and caps at 60 total
 * (3 pages via next_page_token, which needs ~2s to activate). For counts above
 * 60, top up with the agent's web_search + find_leads.
 */
export async function searchGooglePlaces(query: string, location: string, limit = 20): Promise<BusinessLead[]> {
  const apiKey = googlePlacesKey();
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not configured");

  const searchQuery = [query, location].filter(Boolean).join(" in ");
  const target = Math.min(Math.max(limit, 1), 60); // Google hard-caps at 60

  const raw: PlaceResult[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3 && raw.length < target; page++) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    if (pageToken) url.searchParams.set("pagetoken", pageToken);
    else { url.searchParams.set("query", searchQuery); url.searchParams.set("type", "establishment"); }
    url.searchParams.set("key", apiKey);

    const data = (await fetch(url.toString()).then((r) => r.json())) as { results: PlaceResult[]; status: string; error_message?: string; next_page_token?: string };
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      if (page === 0) throw new Error(`Google Places API error: ${data.status} — ${data.error_message || ""}`);
      break; // a later page failing shouldn't discard the results we already have
    }
    raw.push(...(data.results || []));
    pageToken = data.next_page_token;
    if (!pageToken || raw.length >= target) break;
    await sleep(2100); // next_page_token isn't valid immediately
  }

  const places = raw.slice(0, target);

  return Promise.all(
    places.map(async (place) => {
      const detailFields = "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,business_status,types,opening_hours";
      const detailUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      detailUrl.searchParams.set("place_id", place.place_id);
      detailUrl.searchParams.set("fields", detailFields);
      detailUrl.searchParams.set("key", apiKey);
      try {
        const detailRes = await fetch(detailUrl.toString());
        const detailData = (await detailRes.json()) as { result: { name?: string; formatted_address?: string; formatted_phone_number?: string; website?: string; rating?: number; user_ratings_total?: number; business_status?: string; types?: string[]; opening_hours?: { open_now?: boolean } }; status: string };
        const r = detailData.result || {};
        return {
          placeId: place.place_id,
          name: r.name || place.name,
          address: r.formatted_address || place.formatted_address,
          phone: r.formatted_phone_number,
          website: r.website,
          rating: r.rating ?? place.rating,
          reviewCount: r.user_ratings_total ?? place.user_ratings_total,
          businessStatus: r.business_status || place.business_status,
          types: r.types || place.types,
          openNow: r.opening_hours?.open_now,
          googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        } as BusinessLead;
      } catch {
        return {
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          rating: place.rating,
          reviewCount: place.user_ratings_total,
          businessStatus: place.business_status,
          types: place.types,
          openNow: place.opening_hours?.open_now,
          googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        } as BusinessLead;
      }
    }),
  );
}
