import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPresignedUrl } from "@/lib/utils/s3-client";

/**
 * GET /api/flow-ai/download?url=<assetUrl>&name=<filename>
 *
 * Same-origin download proxy for Flow-AI generated media. A plain
 * `<a href="https://...s3...png" download>` does NOT download cross-origin —
 * the browser ignores the `download` attribute and just opens the image in a
 * new tab ("sends the user to the web"). This endpoint fetches the asset
 * server-side and re-streams it with `Content-Disposition: attachment`, so the
 * browser saves the file directly without leaving the chat.
 *
 * Session-gated + host-allowlisted (no arbitrary SSRF — only our own media
 * buckets / presigned S3 URLs).
 */

function isAllowedHost(u: URL): boolean {
  const h = u.hostname.toLowerCase();
  return (
    h.endsWith(".amazonaws.com") ||
    h.includes("flowsmartly-media") ||
    h.endsWith("flowsmartly.com")
  );
}

function extFromType(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("mp4")) return "mp4";
  if (type.includes("pdf")) return "pdf";
  return "bin";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("url")?.trim() || "";
  const rawName = req.nextUrl.searchParams.get("name")?.trim() || "flowsmartly-design";
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "flowsmartly-design";
  if (!raw) {
    return new NextResponse("Missing url", { status: 400 });
  }

  // Resolve to a fetchable URL: absolute (allowed host) is used as-is;
  // a bare storage key is presigned.
  let target: string;
  const isAbsolute = /^https?:\/\//i.test(raw);
  if (isAbsolute) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return new NextResponse("Bad url", { status: 400 });
    }
    if (!isAllowedHost(parsed)) {
      return new NextResponse("Forbidden host", { status: 400 });
    }
    target = raw;
  } else {
    try {
      target = await getPresignedUrl(raw);
    } catch {
      return new NextResponse("Bad url", { status: 400 });
    }
  }

  const upstream = await fetch(target).catch(() => null);
  if (!upstream || !upstream.ok) {
    return new NextResponse("Could not fetch the file", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const filename = safeName.includes(".") ? safeName : `${safeName}.${extFromType(contentType)}`;
  const buffer = Buffer.from(await upstream.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
