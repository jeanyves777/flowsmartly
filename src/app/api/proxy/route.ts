import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/proxy?url=https://example.com
 *
 * Server-side proxy for embedding external websites in iframes.
 * Fetches the target page and strips X-Frame-Options / CSP frame-ancestors
 * headers so the browser allows iframe embedding.
 *
 * - Requires authentication (prevents abuse)
 * - Only allows http/https URLs
 * - Rewrites relative URLs to absolute so assets load correctly
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const targetUrl = req.nextUrl.searchParams.get("url");
  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return new NextResponse("Only http/https URLs allowed", { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "text/html";

    // For HTML responses, inject a <base> tag so relative URLs resolve correctly
    if (contentType.includes("text/html")) {
      let html = await response.text();

      // Determine the final URL after redirects
      const finalUrl = response.url || targetUrl;
      const baseUrl = new URL(finalUrl);
      const baseHref = `${baseUrl.protocol}//${baseUrl.host}`;

      // Inject <base> tag if not already present
      if (!/<base\s/i.test(html)) {
        html = html.replace(
          /(<head[^>]*>)/i,
          `$1<base href="${baseHref}/" />`
        );
      }

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          // Remove frame-blocking headers by NOT forwarding them
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    // For non-HTML resources (CSS, JS, images), pipe through directly
    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[proxy] Failed to fetch:", targetUrl, error);
    return new NextResponse("Failed to fetch the requested URL", { status: 502 });
  }
}
