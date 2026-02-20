import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/proxy?url=https://example.com
 *
 * Server-side proxy for embedding external websites in iframes.
 * - Strips X-Frame-Options / CSP frame-ancestors headers
 * - Injects frame-neutralizing script to defeat frame-busting JS
 * - Removes CSP meta tags that could block our injected script
 * - Injects <base> tag so relative URLs resolve correctly
 * - Requires authentication (prevents abuse)
 * - Only allows http/https URLs
 */

// Script injected before any site scripts to neutralize frame detection.
// Makes the iframe appear as the top-level window so frame-busting code
// like `if (top !== self) top.location = ...` is defeated.
const FRAME_NEUTRALIZER = `<script>
(function(){
  try{Object.defineProperty(window,'top',{get:function(){return window.self},configurable:false})}catch(e){}
  try{Object.defineProperty(window,'parent',{get:function(){return window.self},configurable:false})}catch(e){}
  try{Object.defineProperty(window,'frameElement',{get:function(){return null},configurable:false})}catch(e){}
  // Block attempts to assign to top.location or parent.location
  try{
    var _loc=window.location;
    Object.defineProperty(window,'location',{
      get:function(){return _loc},
      set:function(v){_loc.href=v},
      configurable:true
    });
  }catch(e){}
})();
</script>`;

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

    // For HTML responses, process and inject protections
    if (contentType.includes("text/html")) {
      let html = await response.text();

      // Determine the final URL after redirects
      const finalUrl = response.url || targetUrl;
      const baseUrl = new URL(finalUrl);
      const baseHref = `${baseUrl.protocol}//${baseUrl.host}`;

      // 1. Remove CSP meta tags that could block our injected script or enforce frame-ancestors
      html = html.replace(
        /<meta[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi,
        ""
      );

      // 2. Inject frame-neutralizing script + <base> tag at the very start of <head>
      //    The script MUST come before any other scripts to override window.top/parent first
      if (/<head[^>]*>/i.test(html)) {
        const baseTag = !/<base\s/i.test(html) ? `<base href="${baseHref}/" />` : "";
        html = html.replace(
          /(<head[^>]*>)/i,
          `$1${FRAME_NEUTRALIZER}${baseTag}`
        );
      } else {
        // No <head> tag — inject before <body> or at the start
        const baseTag = `<base href="${baseHref}/" />`;
        if (/<body[^>]*>/i.test(html)) {
          html = `<head>${FRAME_NEUTRALIZER}${baseTag}</head>${html}`;
        } else {
          html = `${FRAME_NEUTRALIZER}${baseTag}${html}`;
        }
      }

      // 3. Strip inline frame-busting patterns from <script> blocks
      //    Common patterns: top.location=, parent.location=, window.top.location=
      html = html.replace(
        /(?:window\.)?top\.location\s*[=!]/g,
        "void 0//"
      );
      html = html.replace(
        /(?:window\.)?parent\.location\s*[=!]/g,
        "void 0//"
      );

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          // Remove ALL frame-blocking headers by setting our own permissive ones
          "X-Frame-Options": "ALLOWALL",
          "Content-Security-Policy": "frame-ancestors *",
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
