import { NextRequest, NextResponse } from "next/server";
import { searchDomains } from "@/lib/domains/manager";

/**
 * POST /api/domains/search
 * Search for available domains across supported TLDs.
 * Auth is optional — allows anonymous domain search.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = body.query as string | undefined;
    const tlds = body.tlds as string[] | undefined;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_QUERY", message: "A non-empty search query is required" } },
        { status: 400 }
      );
    }

    const results = await searchDomains(query, tlds);

    return NextResponse.json({
      success: true,
      data: { results },
    });
  } catch (error) {
    console.error("Domain search error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SEARCH_FAILED", message: "Domain search failed" } },
      { status: 500 }
    );
  }
}
