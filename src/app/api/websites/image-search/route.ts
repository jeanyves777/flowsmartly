import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { searchPexels, downloadToMediaLibrary } from "@/lib/website/image-search";

// GET /api/websites/image-search?q=...&count=6 — Search Pexels
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = request.nextUrl.searchParams.get("q");
    const count = parseInt(request.nextUrl.searchParams.get("count") || "6");
    const orientation = request.nextUrl.searchParams.get("orientation") as "landscape" | "portrait" | undefined;

    if (!q) return NextResponse.json({ error: "Query required" }, { status: 400 });

    const results = await searchPexels(q, Math.min(count, 15), orientation);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("Image search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

// POST /api/websites/image-search — Download a Pexels image to user's media library
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { imageUrl, filename, alt } = await request.json();
    if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

    const s3Url = await downloadToMediaLibrary(imageUrl, session.userId, filename, alt);
    if (!s3Url) return NextResponse.json({ error: "Download failed" }, { status: 500 });

    return NextResponse.json({ url: s3Url });
  } catch (err) {
    console.error("Image download error:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
