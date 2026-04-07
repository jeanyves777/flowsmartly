/**
 * Static file server for generated websites.
 *
 * When a custom domain resolves to a website, the middleware rewrites
 * the request to /sites/{slug}/... — this route serves the corresponding
 * static files from the sites-output directory.
 *
 * Also handles direct /sites/{slug}/... requests from flowsmartly.com.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join, resolve, extname } from "path";

const OUTPUT_BASE =
  process.platform === "win32"
    ? "C:\\Users\\koffi\\Dev\\flowsmartly\\sites-output"
    : "/var/www/flowsmartly/sites-output";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function getCacheControl(filePath: string): string {
  // Long cache for hashed assets (_next/static/...)
  if (filePath.includes("/_next/static/") || filePath.includes("\\_next\\static\\")) {
    return "public, max-age=31536000, immutable";
  }
  // Short cache for HTML pages
  const ext = extname(filePath).toLowerCase();
  if (ext === ".html") {
    return "public, max-age=0, must-revalidate";
  }
  // Medium cache for images and other assets
  return "public, max-age=86400";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;

  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build file path from segments
  const requestedPath = pathSegments.join("/");
  let filePath = resolve(OUTPUT_BASE, requestedPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(resolve(OUTPUT_BASE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Check if path exists
    let fileStat = await stat(filePath).catch(() => null);

    // If it's a directory, look for index.html
    if (fileStat?.isDirectory()) {
      filePath = join(filePath, "index.html");
      fileStat = await stat(filePath).catch(() => null);
    }

    // If no extension and not found, try appending .html
    if (!fileStat && !extname(filePath)) {
      const htmlPath = filePath + ".html";
      fileStat = await stat(htmlPath).catch(() => null);
      if (fileStat) filePath = htmlPath;
    }

    if (!fileStat || !fileStat.isFile()) {
      // Try 404.html in the site root (slug is first segment)
      const slug = pathSegments[0];
      const notFoundPath = join(OUTPUT_BASE, slug, "404.html");
      const notFoundStat = await stat(notFoundPath).catch(() => null);
      if (notFoundStat?.isFile()) {
        const content = await readFile(notFoundPath);
        return new NextResponse(content, {
          status: 404,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const content = await readFile(filePath);
    const mimeType = getMimeType(filePath);
    const cacheControl = getCacheControl(filePath);

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": cacheControl,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Static file serve error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
