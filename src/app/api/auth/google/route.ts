import { NextRequest, NextResponse } from "next/server";
import { isAllowedMobileRedirect } from "@/lib/auth/mobile-oauth";

/**
 * Google OAuth - Step 1: Redirect to Google
 * User clicks "Continue with Google" → redirects to this endpoint
 * Accepts ?mode=login|register to control behavior in callback
 */
export async function GET(request: NextRequest) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;
  const mode = request.nextUrl.searchParams.get("mode") || "login";
  // Native app passes platform=mobile so the callback returns tokens via a
  // deep link instead of setting web cookies. See flow-ai-mobile-app memory.
  const platform = request.nextUrl.searchParams.get("platform");
  // App's own deep-link base (flowsmartly:// or exp:// for Expo Go).
  const mobileRedirect = request.nextUrl.searchParams.get("redirect");

  if (!googleClientId) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", googleClientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("oauth_mode", mode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  if (platform === "mobile") {
    response.cookies.set("oauth_platform", "mobile", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    if (isAllowedMobileRedirect(mobileRedirect)) {
      response.cookies.set("oauth_redirect", mobileRedirect!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
    }
  }

  return response;
}
