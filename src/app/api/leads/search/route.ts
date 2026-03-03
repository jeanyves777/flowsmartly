import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const LEAD_SEARCH_COST_SUBSCRIBER = 5;    // paying plan users
const LEAD_SEARCH_COST_FREE_USER   = 250; // STARTER plan, after their 1 free trial run

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

async function searchGooglePlaces(query: string, location: string): Promise<BusinessLead[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not configured");

  const searchQuery = [query, location].filter(Boolean).join(" in ");

  // Step 1: Text search to get place IDs
  const textSearchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  textSearchUrl.searchParams.set("query", searchQuery);
  textSearchUrl.searchParams.set("type", "establishment");
  textSearchUrl.searchParams.set("key", apiKey);

  const searchRes = await fetch(textSearchUrl.toString());
  const searchData = await searchRes.json() as {
    results: Array<{
      place_id: string;
      name: string;
      formatted_address: string;
      rating?: number;
      user_ratings_total?: number;
      business_status?: string;
      types?: string[];
      opening_hours?: { open_now?: boolean };
    }>;
    status: string;
    error_message?: string;
  };

  if (searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
    throw new Error(`Google Places API error: ${searchData.status} — ${searchData.error_message || ""}`);
  }

  const places = searchData.results?.slice(0, 20) || [];

  // Step 2: Fetch details for each place (phone + website)
  const leads: BusinessLead[] = await Promise.all(
    places.map(async (place) => {
      const detailFields = "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,business_status,types,opening_hours";
      const detailUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      detailUrl.searchParams.set("place_id", place.place_id);
      detailUrl.searchParams.set("fields", detailFields);
      detailUrl.searchParams.set("key", apiKey);

      try {
        const detailRes = await fetch(detailUrl.toString());
        const detailData = await detailRes.json() as {
          result: {
            name?: string;
            formatted_address?: string;
            formatted_phone_number?: string;
            website?: string;
            rating?: number;
            user_ratings_total?: number;
            business_status?: string;
            types?: string[];
            opening_hours?: { open_now?: boolean };
          };
          status: string;
        };

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
        // Fallback to text search data
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
    })
  );

  return leads;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await request.json();
    const { query, location, industry } = body;

    if (!query?.trim() && !industry?.trim()) {
      return NextResponse.json({ success: false, error: { message: "Search query or industry is required" } }, { status: 400 });
    }

    // Check if Google Places API is configured
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: {
          code: "API_KEY_MISSING",
          message: "Google Maps API key not configured. Add GOOGLE_MAPS_API_KEY to your environment variables and enable the Places API in Google Cloud Console.",
        },
      }, { status: 503 });
    }

    // Load user plan + credits + existing search count in parallel
    const [user, searchCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true, freeCredits: true, plan: true },
      }),
      prisma.leadSearch.count({ where: { userId: session.userId } }),
    ]);

    const isSubscriber = user?.plan && user.plan !== "STARTER";
    const isFreeRun    = !isSubscriber && searchCount === 0;
    const creditCost   = isFreeRun ? 0 : isSubscriber ? LEAD_SEARCH_COST_SUBSCRIBER : LEAD_SEARCH_COST_FREE_USER;
    const totalCredits = user?.aiCredits || 0;

    if (!isFreeRun && totalCredits < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: isSubscriber
              ? `This search costs ${creditCost} credits.`
              : `Your free trial has been used. Additional searches cost ${creditCost} credits. Please purchase credits or upgrade to a plan.`,
          },
        },
        { status: 403 }
      );
    }

    // Search Google Places
    const searchQuery = (query || industry || "").trim();
    const results = await searchGooglePlaces(searchQuery, location?.trim() || "");

    // Deduct credits (skip for free trial run)
    if (creditCost > 0) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { aiCredits: { decrement: creditCost } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -creditCost,
            balanceAfter: totalCredits - creditCost,
            description: `Lead search: ${searchQuery}${location ? ` in ${location}` : ""}`,
          },
        }),
      ]);
    }

    // Save search record
    const search = await prisma.leadSearch.create({
      data: {
        userId: session.userId,
        query: searchQuery,
        location: location?.trim() || null,
        industry: industry?.trim() || null,
        results: JSON.stringify(results),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        searchId: search.id,
        query: searchQuery,
        location: location || null,
        results,
        total: results.length,
        creditsUsed: creditCost,
        creditsRemaining: totalCredits - creditCost,
        isFreeRun,
      },
    });
  } catch (error) {
    console.error("Lead search error:", error);
    const msg = error instanceof Error ? error.message : "Lead search failed";
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 });
  }
}

// GET /api/leads/search — list past searches
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const searches = await prisma.leadSearch.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, query: true, location: true, industry: true, createdAt: true, results: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        searches: searches.map((s) => ({
          ...s,
          resultCount: (() => { try { return JSON.parse(s.results).length; } catch { return 0; } })(),
          results: undefined,
        })),
      },
    });
  } catch (error) {
    console.error("List searches error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load searches" } }, { status: 500 });
  }
}
