/**
 * Next.js Middleware — Custom domain routing for FlowShop stores.
 *
 * When a request comes in with a Host header that isn't flowsmartly.com
 * or localhost, we look up the domain in the database and rewrite
 * the request to the store's public storefront.
 */

import { NextRequest, NextResponse } from "next/server";

function parkingPageHtml(domain: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${domain} — Coming Soon</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}.wrap{text-align:center;padding:40px 24px;max-width:600px}.icon{font-size:64px;margin-bottom:24px}.title{font-size:36px;font-weight:800;margin:0 0 8px;letter-spacing:-.5px}.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);border-radius:24px;padding:6px 16px;margin:16px 0 24px;font-size:14px;color:#93c5fd}.dot{width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block;animation:pulse 2s infinite}.desc{font-size:18px;color:#94a3b8;line-height:1.6;margin:0 0 32px}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,.1)}.footer p{font-size:12px;color:#64748b}.footer a{color:#3b82f6;text-decoration:none;font-weight:600}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}</style></head><body><div class="wrap"><div class="icon">🚧</div><h1 class="title">${domain}</h1><div class="badge"><span class="dot"></span>Under Construction</div><p class="desc">We&apos;re building something amazing. This website is being set up and will be live soon.</p><div class="footer"><p>Powered by <a href="https://flowsmartly.com">FlowSmartly</a></p></div></div></body></html>`;
}

const MAIN_DOMAINS = [
  "flowsmartly.com",
  "www.flowsmartly.com",
  "localhost",
  "127.0.0.1",
];

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0]; // Strip port

  // Skip if this is the main domain or localhost
  if (MAIN_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
    return NextResponse.next();
  }

  // Skip API routes, _next, and static assets
  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/api/") ||
    path.startsWith("/_next/") ||
    path.startsWith("/favicon") ||
    path.startsWith("/logo") ||
    path.startsWith("/icon") ||
    path.includes(".")
  ) {
    return NextResponse.next();
  }

  // This is a custom domain request — look up the store
  try {
    // Use internal API to resolve domain → store slug
    // We can't use Prisma directly in Edge middleware, so we call our own API
    const resolveUrl = new URL("/api/domains/resolve", request.url);
    resolveUrl.searchParams.set("domain", hostname);

    const res = await fetch(resolveUrl.toString(), {
      headers: { "x-middleware-resolve": "1" },
    });

    if (!res.ok) {
      // Domain not linked to anything — show under construction page
      return new NextResponse(parkingPageHtml(hostname), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "x-custom-domain": hostname },
      });
    }

    const data = await res.json();
    const slug = data.slug;
    const type = data.type || "store"; // "store" or "website"

    if (!slug) {
      return new NextResponse(parkingPageHtml(hostname), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "x-custom-domain": hostname },
      });
    }

    // Rewrite to the appropriate page based on type
    const basePath = type === "website" ? `/sites/${slug}` : `/store/${slug}`;
    const rewritePath = path === "/" ? basePath : `${basePath}${path}`;
    const rewriteUrl = new URL(rewritePath, request.url);
    rewriteUrl.search = request.nextUrl.search;

    const response = NextResponse.rewrite(rewriteUrl);

    // Set headers so the page knows it's being served on a custom domain
    response.headers.set("x-custom-domain", hostname);
    response.headers.set("x-store-slug", slug);
    response.headers.set("x-domain-type", type);

    return response;
  } catch (error) {
    console.error("Middleware domain resolution error:", error);
    return NextResponse.next();
  }
}

export const config = {
  // Run middleware on all routes except static files and API
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo|icon|robots.txt|sitemap|manifest).*)",
  ],
};
