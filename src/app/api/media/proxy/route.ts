import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/utils/s3-client";

/**
 * Media proxy — streams S3 content through our verified domain.
 * Used by TikTok Content Posting API which requires URL from a verified domain.
 * GET /api/media/proxy?key=media/abc.mp4
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  try {
    // Get a presigned S3 URL and stream it through
    const s3Url = await getPresignedUrl(key);
    const res = await fetch(s3Url);

    if (!res.ok) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const contentLength = res.headers.get("content-length");

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    };
    if (contentLength) headers["Content-Length"] = contentLength;

    return new NextResponse(res.body, { status: 200, headers });
  } catch (err) {
    console.error("[Media Proxy] Error:", err);
    return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
  }
}
