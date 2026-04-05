import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { searchPexels } from "@/lib/website/image-search";

// GET /api/websites/image-search?q=...&count=6 — Search Pexels
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = request.nextUrl.searchParams.get("q");
    const count = parseInt(request.nextUrl.searchParams.get("count") || "6");

    if (!q) return NextResponse.json({ error: "Query required" }, { status: 400 });

    const results = await searchPexels(q, Math.min(count, 15));
    return NextResponse.json({ results });
  } catch (err) {
    console.error("Image search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
