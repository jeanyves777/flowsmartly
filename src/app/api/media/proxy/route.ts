import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/utils/s3-client";

/**
 * Media proxy — streams S3 content through our verified domain.
 * Used by TikTok Content Posting API which requires URL from a verified domain.
 * GET /api/media/proxy?key=media/abc.mp4
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const url = request.nextUrl.searchParams.get("url");
  const mediaReference = key || url;
  if (!mediaReference) {
    return NextResponse.json({ error: "Missing media reference" }, { status: 400 });
  }

  try {
    // Get a presigned S3 URL and stream it through
    const s3Url = await getPresignedUrl(mediaReference);
    const range = request.headers.get("range");
    const res = await fetch(s3Url, range ? { headers: { Range: range } } : undefined);

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
    const contentRange = res.headers.get("content-range");
    const acceptRanges = res.headers.get("accept-ranges");
    if (contentRange) headers["Content-Range"] = contentRange;
    if (acceptRanges) headers["Accept-Ranges"] = acceptRanges;

    return new NextResponse(res.body, { status: res.status, headers });
  } catch (err) {
    console.error("[Media Proxy] Error:", err);
    return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
  }
}
