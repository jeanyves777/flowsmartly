import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * Server proxy for Pexels image search. Keeps the API key server-side —
 * never expose PEXELS_API_KEY to the client. Returns a normalized payload
 * the studio + builders can render without knowing Pexels' shape.
 *
 * GET /api/pexels/search?q=mountain&page=1&per_page=20&orientation=landscape
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: { message: "Pexels not configured" } },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const perPage = Math.min(80, Math.max(1, parseInt(searchParams.get("per_page") || "24", 10) || 24));
  const orientation = searchParams.get("orientation"); // landscape | portrait | square

  // Empty query → curated feed (Pexels' "popular right now" endpoint).
  // Same shape on both endpoints so the client doesn't have to branch.
  const base = q
    ? `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}`
    : `https://api.pexels.com/v1/curated?per_page=${perPage}&page=${page}`;
  const url = orientation && q ? `${base}&orientation=${encodeURIComponent(orientation)}` : base;

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: apiKey },
      // Cache identical queries server-side for 5 minutes — Pexels rate
      // limits at 200 req/hr by default and search results barely change
      // between identical queries within that window.
      next: { revalidate: 300 },
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, error: { message: `Pexels returned ${upstream.status}` } },
        { status: 502 },
      );
    }
    const data = await upstream.json();
    const photos = (data.photos || []).map((p: {
      id: number;
      width: number;
      height: number;
      alt: string;
      photographer: string;
      photographer_url: string;
      url: string;
      src: { large2x: string; large: string; medium: string; small: string; tiny: string };
    }) => ({
      id: p.id,
      width: p.width,
      height: p.height,
      alt: p.alt || q || "Stock photo",
      // Per Pexels guidelines: include attribution + their hosted URL.
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      sourceUrl: p.url,
      // Multiple sizes — caller picks based on use (thumb vs full background).
      thumbUrl: p.src.medium,
      previewUrl: p.src.large,
      fullUrl: p.src.large2x,
    }));
    return NextResponse.json({
      success: true,
      photos,
      page: data.page || page,
      perPage: data.per_page || perPage,
      totalResults: data.total_results || photos.length,
      nextPage: data.next_page ? page + 1 : null,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { message: err instanceof Error ? err.message : "Search failed" } },
      { status: 500 },
    );
  }
}
