/**
 * Next.js Middleware — Custom domain routing for websites and stores,
 * plus a first-line auth guard for /api/admin/* that checks the
 * admin_token cookie before the request reaches the route handler.
 * Route handlers still do their own getAdminSession() / role checks —
 * this is defense in depth, not a replacement.
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

// Admin paths that must stay reachable without an admin_token cookie:
// - the login endpoint itself (how else would you get a token?)
// - logout (safe even with no session — just clears cookie)
// - first-run bootstrap (setup route gates itself on whether any admin exists)
// - OAuth callbacks (Google redirects here with no cookies of ours)
const ADMIN_PUBLIC_PATHS = new Set<string>([
  "/api/admin/auth/login",
  "/api/admin/auth/logout",
  "/api/admin/setup",
]);

const ADMIN_PUBLIC_PREFIXES: readonly string[] = [
  "/api/admin/google-ads/callback",
];

function requireAdminAuth(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/api/admin/")) return null;
  if (ADMIN_PUBLIC_PATHS.has(path)) return null;
  if (ADMIN_PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return null;

  // Server-to-server admin backdoor: route handlers that support an
  // x-admin-secret header compare it against ADMIN_SECRET env. If the
  // header is present, let the request reach the handler — handler
  // does the actual secret comparison and returns 403 if it's wrong.
  if (request.headers.get("x-admin-secret")) return null;

  const adminToken = request.cookies.get("admin_token");
  if (!adminToken?.value) {
    return NextResponse.json(
      { success: false, error: { message: "Admin authentication required" } },
      { status: 401 }
    );
  }
  return null;
}

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

  // Admin API auth gate — runs for any host, enforced even on custom domains
  // so a compromised customer domain can't proxy to /api/admin/*.
  const adminBlock = requireAdminAuth(request);
  if (adminBlock) return adminBlock;

  // Skip if this is the main domain or localhost
  if (MAIN_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;

  // Always skip API routes for custom domains
  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  // For /_next/ paths: skip only if it's a known Next.js app asset (main app chunks)
  // Custom domain website assets at /_next/static/... need to be rewritten
  // We handle this AFTER domain resolution below

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

    // Build resolve URL — must hit our own server, not loop through the custom domain
    // Use localhost to avoid DNS resolution of the custom domain
    const internalOrigin = `http://127.0.0.1:${request.nextUrl.port || "3000"}`;
    const resolveUrl = new URL("/api/domains/resolve", internalOrigin);
    resolveUrl.searchParams.set("domain", lookupDomain);
    if (forceStore) resolveUrl.searchParams.set("forceStore", "1");

    const res = await fetch(resolveUrl.toString(), {
      headers: { "x-middleware-resolve": "1" },
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
      // WEBSITE: rewrite ALL paths to /sites/{slug}/...
      // Skip prefixing if path already starts with /sites/{slug} (avoids double-prefix)
      const sitePrefix = `/sites/${slug}`;
      const alreadyPrefixed = path.startsWith(sitePrefix);
      const sitePath = alreadyPrefixed ? path : (path === "/" ? sitePrefix : `${sitePrefix}${path}`);
      const rewriteUrl = new URL(sitePath, request.url);
      rewriteUrl.search = request.nextUrl.search;

      const response = NextResponse.rewrite(rewriteUrl);
      response.headers.set("x-custom-domain", hostname);
      response.headers.set("x-store-slug", slug);
      response.headers.set("x-domain-type", "website");
      return response;
    }

    // STORE: Check version — V3 independent, V2 static, or V1 SSR
    const storeVersion = data.storeVersion || "ssr";

    // V3 Independent SSR: nginx reverse proxies to the store's PM2 port
    // Middleware just passes through — nginx handles the routing via upstream config
    if (storeVersion === "independent") {
      // For custom domains: nginx proxies directly to the store's port
      // For /stores/{slug}/ paths: nginx also proxies
      // Middleware only needs to set headers for identification
      const response = NextResponse.next();
      response.headers.set("x-custom-domain", hostname);
      response.headers.set("x-store-slug", slug);
      response.headers.set("x-domain-type", "store-v3");
      return response;
    }

    // V2 static stores: serve from /stores/{slug}/ (nginx static files)
    // EXCEPT checkout/track/order-confirmation which stay SSR on the main app
    if (storeVersion === "static") {
      const isSSRPath = /\/(checkout|track|order-confirmation|account)(\/|$|\?)/.test(path);

      if (isSSRPath) {
        // Dynamic SSR paths route to main app /store/{slug}/...
        const storePath = `/store/${slug}${path}`;
        const rewriteUrl = new URL(storePath, request.url);
        rewriteUrl.search = request.nextUrl.search;
        const response = NextResponse.rewrite(rewriteUrl);
        response.headers.set("x-custom-domain", hostname);
        response.headers.set("x-store-slug", slug);
        response.headers.set("x-domain-type", "store-v2-ssr");
        return response;
      }

      // Static store files at /stores/{slug}/...
      const storePrefix = `/stores/${slug}`;
      const alreadyPrefixed = path.startsWith(storePrefix);
      const storePath = alreadyPrefixed ? path : (path === "/" ? storePrefix : `${storePrefix}${path}`);
      const rewriteUrl = new URL(storePath, request.url);
      rewriteUrl.search = request.nextUrl.search;

      const response = NextResponse.rewrite(rewriteUrl);
      response.headers.set("x-custom-domain", hostname);
      response.headers.set("x-store-slug", slug);
      response.headers.set("x-domain-type", "store-v2");
      return response;
    }

    // V1 SSR stores: /_next/ paths pass through to Next.js
    if (path.startsWith("/_next/")) {
      return NextResponse.next();
    }

    // V1 SSR stores: rewrite to /store/{slug}/...
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
  // Match ALL paths — custom domains need /_next/static rewriting for website assets
  matcher: ["/(.*)",],
};
