/**
 * Next.js Middleware — Custom domain routing for FlowShop stores.
 *
 * When a request comes in with a Host header that isn't flowsmartly.com
 * or localhost, we look up the domain in the database and rewrite
 * the request to the store's public storefront.
 */

import { NextRequest, NextResponse } from "next/server";

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
      // Domain not found — show 404 or redirect to main site
      return NextResponse.redirect(new URL("/", "https://flowsmartly.com"));
    }

    const data = await res.json();
    const slug = data.slug;

    if (!slug) {
      return NextResponse.redirect(new URL("/", "https://flowsmartly.com"));
    }

    // Rewrite to the store page, preserving the path
    const storePath = path === "/" ? `/store/${slug}` : `/store/${slug}${path}`;
    const rewriteUrl = new URL(storePath, request.url);
    rewriteUrl.search = request.nextUrl.search;

    const response = NextResponse.rewrite(rewriteUrl);

    // Set a header so the store page knows it's being served on a custom domain
    response.headers.set("x-custom-domain", hostname);
    response.headers.set("x-store-slug", slug);

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
