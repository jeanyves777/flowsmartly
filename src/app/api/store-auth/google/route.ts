import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { sanitizeRedirectUrl } from "@/lib/auth/safe-redirect";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";

/**
 * Google OAuth for STORE CUSTOMERS (not FlowSmartly users).
 * Stores the callbackUrl (store page) in a cookie, then redirects to Google.
 *
 * Usage: GET /api/store-auth/google?callbackUrl=<storeUrl>&storeSlug=<slug>
 */
export async function GET(request: NextRequest) {
  const googleClientId = process.env.STORE_GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return NextResponse.json({ error: "Store Google OAuth not configured" }, { status: 500 });
  }

  const rawCallbackUrl = request.nextUrl.searchParams.get("callbackUrl") || APP_URL;
  const storeSlug = request.nextUrl.searchParams.get("storeSlug") || extractSlugFromUrl(rawCallbackUrl);

  // Resolve the store's custom domain (if any) so it counts as an allowed host.
  const extraAllowedHosts: string[] = [];
  if (storeSlug) {
    const store = await prisma.store.findUnique({
      where: { slug: storeSlug },
      select: { customDomain: true },
    });
    if (store?.customDomain) extraAllowedHosts.push(store.customDomain);
  }

  const callbackUrl = sanitizeRedirectUrl(rawCallbackUrl, extraAllowedHosts, APP_URL);

  const redirectUri = `${APP_URL}/api/store-auth/google/callback`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", googleClientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl.toString());

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };

  response.cookies.set("store_oauth_callback", callbackUrl, cookieOpts);
  response.cookies.set("store_oauth_slug", storeSlug, cookieOpts);

  return response;
}

/** Extract store slug (e.g. "store-cmlnwpoz") from a store URL path. */
function extractSlugFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    // Pattern: /stores/store-{id}/... → second segment is the store slug
    const storesIdx = parts.indexOf("stores");
    if (storesIdx >= 0 && parts[storesIdx + 1]) {
      return parts[storesIdx + 1];
    }
    return "";
  } catch {
    return "";
  }
}
