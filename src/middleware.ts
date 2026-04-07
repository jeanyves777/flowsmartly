/**
 * Next.js Middleware — Custom domain routing for websites and stores.
 *
 * When a request comes in with a Host header that isn't flowsmartly.com:
 * 1. Resolve domain → website slug or store slug via /api/domains/resolve
 * 2. Website: rewrite ALL requests (pages + assets) to /sites/{slug}/...
 * 3. Store: rewrite page requests to /store/{slug}/...
 * 4. Unlinked domain: show "Under Construction" parking page
 *
 * Also handles shop.domain.com subdomains for FlowShop stores.
 */

import { NextRequest, NextResponse } from "next/server";

function parkingPageHtml(domain: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${domain} — Coming Soon</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}.wrap{text-align:center;padding:40px 24px;max-width:600px}.icon{font-size:64px;margin-bottom:24px}.title{font-size:36px;font-weight:800;margin:0 0 8px;letter-spacing:-.5px}.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);border-radius:24px;padding:6px 16px;margin:16px 0 24px;font-size:14px;color:#93c5fd}.dot{width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block;animation:pulse 2s infinite}.desc{font-size:18px;color:#94a3b8;line-height:1.6;margin:0 0 32px}.footer{margin-top:48px;padding-top:24px;border-top:1px solid rgba(255,255,255,.1)}.footer p{font-size:12px;color:#64748b}.footer a{color:#3b82f6;text-decoration:none;font-weight:600}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}</style></head><body><div class="wrap"><div class="icon">🚧</div><h1 class="title">${domain}</h1><div class="badge"><span class="dot"></span>Under Construction</div><p class="desc">We&apos;re building something amazing. This website is being set up and will be live soon.</p><div class="footer"><p>Powered by <a href="https://flowsmartly.com">FlowSmartly</a></p></div></div></body></html>`;
}

function parkingResponse(hostname: string) {
  return new NextResponse(parkingPageHtml(hostname), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "x-custom-domain": hostname,
    },
  });
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

  const path = request.nextUrl.pathname;

  // Always skip internal Next.js and API routes for custom domains
  if (path.startsWith("/api/") || path.startsWith("/_next/")) {
    return NextResponse.next();
  }

  // This is a custom domain request — resolve it
  try {
    // Determine the lookup domain:
    // - shop.example.com → resolve "example.com" as store (shop subdomain)
    // - example.com → resolve "example.com" (could be website or store)
    let lookupDomain = hostname;
    let forceStore = false;

    // Handle shop.domain.com subdomain → always resolves as store
    const shopMatch = hostname.match(/^shop\.(.+)$/);
    if (shopMatch) {
      lookupDomain = shopMatch[1];
      forceStore = true;
    }

    // Build resolve URL using the origin (works for both main domain and custom domains)
    // Use request.nextUrl.origin which always points to the actual server
    const resolveUrl = new URL("/api/domains/resolve", request.nextUrl.origin);
    resolveUrl.searchParams.set("domain", lookupDomain);
    if (forceStore) resolveUrl.searchParams.set("forceStore", "1");

    const res = await fetch(resolveUrl.toString(), {
      headers: {
        "x-middleware-resolve": "1",
        // Pass the correct host so the request reaches our server, not the custom domain
        "Host": request.nextUrl.host,
      },
    });

    if (!res.ok) {
      return parkingResponse(hostname);
    }

    const data = await res.json();
    const slug = data.slug;
    let type = data.type || "store";

    // shop.domain.com always goes to store
    if (forceStore) type = "store";

    if (!slug) {
      return parkingResponse(hostname);
    }

    if (type === "website") {
      // WEBSITE: rewrite ALL paths (pages + assets) to /sites/{slug}/...
      // The /sites/[...path] route handler serves the static files
      const sitePath = path === "/" ? `/sites/${slug}` : `/sites/${slug}${path}`;
      const rewriteUrl = new URL(sitePath, request.url);
      rewriteUrl.search = request.nextUrl.search;

      const response = NextResponse.rewrite(rewriteUrl);
      response.headers.set("x-custom-domain", hostname);
      response.headers.set("x-store-slug", slug);
      response.headers.set("x-domain-type", "website");
      return response;
    }

    // STORE: rewrite to /store/{slug}/...
    const storePath = path === "/" ? `/store/${slug}` : `/store/${slug}${path}`;
    const rewriteUrl = new URL(storePath, request.url);
    rewriteUrl.search = request.nextUrl.search;

    const response = NextResponse.rewrite(rewriteUrl);
    response.headers.set("x-custom-domain", hostname);
    response.headers.set("x-store-slug", slug);
    response.headers.set("x-domain-type", "store");
    return response;
  } catch (error) {
    console.error("Middleware domain resolution error:", error);
    return parkingResponse(hostname);
  }
}

export const config = {
  matcher: [
    // Match all paths except static Next.js internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
